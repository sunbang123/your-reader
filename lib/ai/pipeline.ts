import { personas, type PersonaId } from "../models";
import type { AiResult, Complete, EmotionLabel, PipelineInput } from "./contracts";
import { normalizeEmotionResults, parseModelJson, resolveHighlight } from "./parse";

const promptVersion = "2.0";

const personaDirections: Record<PersonaId, string> = {
  listener: "차분한 경청자 다온. 판단이나 행동 권유 없이 구체적인 문장을 짚고 감정을 부드럽게 반영한다.",
  penpal: "따뜻한 외국인 펜팔 Alex. 자연스럽고 쉬운 영어로 답하며 한국 문화를 타자화하거나 글을 교정하지 않는다.",
  librarian: "밤의 사서 해온. 반복되는 이미지와 시간의 흐름을 읽고 문학적이되 이해하기 쉬운 말로 조용한 질문을 건넨다.",
};

type AnalysisPayload = {
  summary?: unknown;
  dominantEmotion?: unknown;
  scores?: Partial<Record<EmotionLabel, unknown>>;
  evidence?: Partial<Record<EmotionLabel, unknown>>;
  highlightedSentence?: unknown;
};

type CommentPayload = { comment?: unknown; language?: unknown };
type PenpalPayload = { translationEn?: unknown; commentEn?: unknown };

export async function runPipeline(input: PipelineInput, complete: Complete, model: string): Promise<AiResult> {
  const essay = input.body.slice(0, 12_000);
  const analysisRaw = await complete([
    {
      role: "system",
      content: "당신은 한국어 에세이의 정서를 조심스럽게 읽는 분석가입니다. 진단하지 말고, 반드시 유효한 JSON만 반환하세요.",
    },
    {
      role: "user",
      content: `다음 글을 분석하세요.\n\n${essay}\n\nJSON 형식: {"summary":"두 문장 이내의 마음의 결 요약","dominantEmotion":"안도|그리움|긴장|기쁨","scores":{"안도":0.0,"그리움":0.0,"긴장":0.0,"기쁨":0.0},"evidence":{"안도":"짧은 근거","그리움":"짧은 근거","긴장":"짧은 근거","기쁨":"짧은 근거"},"highlightedSentence":"원문에서 글자 하나도 바꾸지 않은 인상적인 문장"}`,
    },
  ], { temperature: 0.15, maxTokens: 700 });
  const analysis = parseModelJson<AnalysisPayload>(analysisRaw);
  const emotions = normalizeEmotionResults(analysis.scores ?? {}, analysis.evidence ?? {});
  const dominantEmotion = emotions.some(({ emotion }) => emotion === analysis.dominantEmotion)
    ? analysis.dominantEmotion as EmotionLabel
    : emotions.toSorted((left, right) => right.score - left.score)[0].emotion;
  const highlightedSentence = resolveHighlight(essay, analysis.highlightedSentence);
  const persona = personas.find(({ id }) => id === input.personaId) ?? personas[0];

  const commentRaw = await complete([
    {
      role: "system",
      content: `${personaDirections[persona.id]} 해결책, 훈계, 심리 진단은 하지 않습니다. 반드시 유효한 JSON만 반환하세요.`,
    },
    {
      role: "user",
      content: `제목: ${input.title || "제목 없는 글"}\n글: ${essay}\n마음의 결: ${String(analysis.summary ?? "")}\n인상적인 문장: ${highlightedSentence}\n\n선택한 독자는 ${persona.name}입니다. 2~3개의 짧은 문단으로 공감의 감상평을 쓰세요. ${persona.id === "penpal" ? "영어" : "한국어"}로 쓰고 JSON {"comment":"...","language":"${persona.id === "penpal" ? "en" : "ko"}"}만 반환하세요.`,
    },
  ], { temperature: 0.55, maxTokens: 750 });
  const selected = parseModelJson<CommentPayload>(commentRaw);

  const penpalRaw = await complete([
    {
      role: "system",
      content: "You are Alex, a thoughtful international pen pal. Preserve emotional nuance, avoid advice and diagnosis, and return valid JSON only.",
    },
    {
      role: "user",
      content: `Translate the Korean essay into natural, literary but accessible English. Then write a warm 2-3 paragraph English response.\n\nEssay:\n${essay}\n\nReturn {"translationEn":"...","commentEn":"..."}.`,
    },
  ], { temperature: 0.45, maxTokens: 1_400 });
  const penpal = parseModelJson<PenpalPayload>(penpalRaw);

  if (typeof analysis.summary !== "string" || typeof selected.comment !== "string" ||
      typeof penpal.translationEn !== "string" || typeof penpal.commentEn !== "string") {
    throw new Error("AI 응답 형식이 올바르지 않습니다.");
  }

  return {
    entryId: input.entryId,
    personaId: persona.id,
    summary: analysis.summary,
    dominantEmotion,
    emotions,
    highlightedSentence,
    selectedComment: selected.comment,
    selectedCommentLanguage: persona.id === "penpal" ? "en" : "ko",
    translationEn: penpal.translationEn,
    commentEn: penpal.commentEn,
    model,
    promptVersion,
  };
}
