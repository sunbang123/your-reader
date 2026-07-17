export type EmotionScores = Record<string, number>;

export interface EmotionAnalyzer {
  analyze(text: string): Promise<EmotionScores>;
  dispose?(): Promise<void>;
}

const DISPLAY_GROUPS: Record<string, Set<string>> = {
  슬픔: new Set(["슬픔", "우울", "비참", "상실", "후회", "절망", "서러움"]),
  불안: new Set(["불안", "걱정", "두려움", "긴장", "당황", "혼란", "외로움"]),
  기쁨: new Set(["기쁨", "즐거움", "행복", "신남", "만족", "설렘", "고마움", "감동"]),
  안도: new Set(["안도", "평온", "편안", "희망", "위로", "사랑", "신뢰"]),
};

export function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?。！？])\s+|\n+/u).map((part) => part.trim()).filter(Boolean);
}

export function normalize(scores: EmotionScores): EmotionScores {
  const values = Object.values(scores);
  if (values.length === 0) return {};
  const maximum = Math.max(...values) || 1;
  return Object.fromEntries(Object.entries(scores).map(([label, value]) => [label, Number((value / maximum).toFixed(4))]));
}

export function aggregateForDisplay(raw: EmotionScores): EmotionScores {
  const grouped = Object.fromEntries(Object.entries(DISPLAY_GROUPS).map(([group, labels]) => [
    group,
    Math.max(0, ...Object.entries(raw).filter(([label]) => labels.has(label)).map(([, score]) => score)),
  ]));
  return normalize(grouped);
}

export type HighlightResult = { sentence: string; score: number; sentenceEmotions: EmotionScores };

export async function selectHighlight(
  text: string,
  analyzer: EmotionAnalyzer,
  intensityWeight = 0.7,
  themeWeight = 0.3,
): Promise<HighlightResult> {
  const whole = await analyzer.analyze(text);
  const theme = Object.entries(whole).sort((a, b) => b[1] - a[1])[0]?.[0];
  const candidates = await Promise.all(splitSentences(text).map(async (sentence) => {
    const scores = await analyzer.analyze(sentence);
    const intensity = Math.max(0, ...Object.values(scores));
    const themeMatch = theme ? scores[theme] ?? 0 : 0;
    return { sentence, score: Number((intensityWeight * intensity + themeWeight * themeMatch).toFixed(4)), sentenceEmotions: scores };
  }));
  return candidates.sort((a, b) => b.score - a.score)[0] ?? { sentence: "", score: 0, sentenceEmotions: {} };
}

export class MockEmotionAnalyzer implements EmotionAnalyzer {
  private readonly keywords: Record<string, string[]> = {
    슬픔: ["눈물", "슬프", "망쳤", "서럽", "상실"], 불안: ["어쩌나", "불안", "걱정", "결과", "긴장"],
    외로움: ["혼자", "외롭", "누군가", "짐이"], 기쁨: ["합격", "기쁘", "벅차", "행복"],
    고마움: ["고맙", "감사", "기다려 준"], 안도: ["그래도", "다시", "괜찮", "따뜻한", "위로"],
  };

  async analyze(text: string): Promise<EmotionScores> {
    return Object.fromEntries(Object.entries(this.keywords).map(([label, words]) => {
      const count = words.reduce((sum, word) => sum + text.split(word).length - 1, 0);
      return [label, Math.min(1, 0.15 + count * 0.35)];
    }).filter(([, score]) => Number(score) > 0.15));
  }
}
