import { NextResponse, type NextRequest } from "next/server";
import { createHuggingFaceClient } from "../../../../../lib/ai/huggingface";
import { runPipeline } from "../../../../../lib/ai/pipeline";
import type { AiResult } from "../../../../../lib/ai/contracts";
import { personas, type PersonaId } from "../../../../../lib/models";
import { createClient } from "../../../../../lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 180;

type RouteContext = { params: Promise<{ id: string }> };

function publicError(error: unknown) {
  const message = error instanceof Error ? error.message : "알 수 없는 오류";
  if (message.includes("Hugging Face 요청 실패 (401)")) return "Hugging Face 토큰을 확인해 주세요.";
  if (message.includes("Hugging Face 요청 실패 (429)")) return "AI 요청이 많습니다. 잠시 후 다시 시도해 주세요.";
  if (message.includes("timeout") || message.includes("aborted")) return "AI 응답 시간이 초과되었습니다. 다시 시도해 주세요.";
  return "분석을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

async function persistResult(supabase: Awaited<ReturnType<typeof createClient>>, result: AiResult) {
  const { data: analysis, error: analysisError } = await supabase
    .from("emotion_analyses")
    .upsert({
      entry_id: result.entryId,
      model: result.model,
      model_version: result.model,
      summary: result.summary,
      dominant_emotion: result.dominantEmotion,
      raw_output: result,
    }, { onConflict: "entry_id" })
    .select("id")
    .single();
  if (analysisError || !analysis) throw analysisError ?? new Error("분석 결과를 저장하지 못했습니다.");

  const { error: deleteScoreError } = await supabase.from("emotion_scores").delete().eq("analysis_id", analysis.id);
  if (deleteScoreError) throw deleteScoreError;
  const { error: scoreError } = await supabase.from("emotion_scores").insert(result.emotions.map((item) => ({
    analysis_id: analysis.id,
    emotion: item.emotion,
    score: item.score,
    evidence: item.evidence,
  })));
  if (scoreError) throw scoreError;

  const comments = [{
    entry_id: result.entryId,
    persona_id: result.personaId,
    prompt_version: result.promptVersion,
    model: result.model,
    model_version: result.model,
    language: result.selectedCommentLanguage,
    content: result.selectedComment,
    translated_content: result.personaId === "penpal" ? result.translationEn : null,
  }];
  if (result.personaId !== "penpal") {
    comments.push({
      entry_id: result.entryId,
      persona_id: "penpal",
      prompt_version: result.promptVersion,
      model: result.model,
      model_version: result.model,
      language: "en",
      content: result.commentEn,
      translated_content: result.translationEn,
    });
  }
  const { error: commentError } = await supabase.from("generated_comments").insert(comments);
  if (commentError) throw commentError;
}

export async function POST(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { data: entry, error: entryError } = await supabase
    .from("entries")
    .select("id,title,body,persona_id")
    .eq("id", id)
    .single();
  if (entryError || !entry) return NextResponse.json({ error: "글을 찾을 수 없습니다." }, { status: 404 });
  if (entry.body.trim().length < 20) {
    return NextResponse.json({ error: "마음을 읽으려면 본문을 20자 이상 적어 주세요." }, { status: 400 });
  }

  const token = process.env.HF_TOKEN;
  const model = process.env.HF_CHAT_MODEL ?? "Qwen/Qwen2.5-7B-Instruct:fastest";
  if (!token) return NextResponse.json({ error: "서버에 HF_TOKEN이 설정되지 않았습니다." }, { status: 503 });
  const personaId = personas.some(({ id: persona }) => persona === entry.persona_id)
    ? entry.persona_id as PersonaId
    : "listener";

  await supabase.from("entries").update({ status: "analyzing", failure_reason: null }).eq("id", id);
  try {
    const result = await runPipeline({
      entryId: entry.id,
      title: entry.title,
      body: entry.body,
      personaId,
    }, createHuggingFaceClient(token, model), model);
    await persistResult(supabase, result);
    const completedAt = new Date().toISOString();
    const { error: statusError } = await supabase
      .from("entries")
      .update({ status: "completed", completed_at: completedAt, failure_reason: null })
      .eq("id", id);
    if (statusError) throw statusError;
    return NextResponse.json({ result });
  } catch (error) {
    const message = publicError(error);
    await supabase.from("entries").update({ status: "failed", failure_reason: message }).eq("id", id);
    console.error("AI pipeline failed", error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
