import { NextResponse } from "next/server";
import type { AiResult } from "../../../../../lib/ai/contracts";
import { createClient } from "../../../../../lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

function isStoredResult(value: unknown): value is AiResult {
  if (!value || typeof value !== "object") return false;
  const result = value as Partial<AiResult>;
  return typeof result.summary === "string" && Array.isArray(result.emotions) &&
    typeof result.highlightedSentence === "string" && typeof result.translationEn === "string" &&
    typeof result.commentEn === "string";
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { data: entry } = await supabase.from("entries").select("id,status,failure_reason").eq("id", id).single();
  if (!entry) return NextResponse.json({ error: "글을 찾을 수 없습니다." }, { status: 404 });
  const { data: analysis } = await supabase
    .from("emotion_analyses")
    .select("raw_output")
    .eq("entry_id", id)
    .maybeSingle();
  if (!isStoredResult(analysis?.raw_output)) {
    return NextResponse.json({ error: entry.failure_reason ?? "아직 분석 결과가 없습니다.", status: entry.status }, { status: 404 });
  }
  return NextResponse.json({ result: analysis.raw_output });
}
