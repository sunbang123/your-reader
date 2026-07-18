import { emotionLabels, type EmotionLabel, type EmotionResult } from "./contracts";

export function parseModelJson<T>(value: string): T {
  const trimmed = value.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const source = fenced ?? trimmed;

  for (let start = 0; start < source.length; start += 1) {
    const opening = source[start];
    if (opening !== "{" && opening !== "[") continue;

    const closing = opening === "{" ? "}" : "]";
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let end = start; end < source.length; end += 1) {
      const character = source[end];

      if (inString) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === '"') inString = false;
        continue;
      }

      if (character === '"') {
        inString = true;
        continue;
      }
      if (character === opening) depth += 1;
      else if (character === closing) depth -= 1;
      else if ((character === "}" || character === "]") && depth > 0) break;

      if (depth === 0) {
        try {
          return JSON.parse(source.slice(start, end + 1)) as T;
        } catch {
          break;
        }
      }
    }
  }

  throw new Error("AI 응답에서 유효한 JSON을 찾지 못했습니다.");
}

function clamp(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(1, Math.max(0, numeric));
}

export function normalizeEmotionResults(
  scores: Partial<Record<EmotionLabel, unknown>>,
  evidence: Partial<Record<EmotionLabel, unknown>> = {},
): EmotionResult[] {
  const normalized = emotionLabels.map((emotion) => ({
    emotion,
    score: Number(clamp(scores[emotion]).toFixed(4)),
    evidence: typeof evidence[emotion] === "string" ? evidence[emotion] : "",
  }));
  if (normalized.every(({ score }) => score === 0)) {
    return normalized.map((item) => ({ ...item, score: item.emotion === "안도" ? 0.25 : 0.1 }));
  }
  return normalized;
}

export function resolveHighlight(body: string, requested: unknown) {
  const candidate = typeof requested === "string" ? requested.trim() : "";
  if (candidate && body.includes(candidate)) return candidate;
  return body
    .split(/(?<=[.!?。！？])\s+|\n+/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .sort((left, right) => right.length - left.length)[0] ?? body.slice(0, 160);
}
