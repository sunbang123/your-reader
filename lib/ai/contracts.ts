import type { PersonaId } from "../models";

export const emotionLabels = ["안도", "그리움", "긴장", "기쁨"] as const;

export type EmotionLabel = (typeof emotionLabels)[number];

export type EmotionResult = {
  emotion: EmotionLabel;
  score: number;
  evidence: string;
};

export type AiResult = {
  entryId: string;
  personaId: PersonaId;
  summary: string;
  dominantEmotion: EmotionLabel;
  emotions: EmotionResult[];
  highlightedSentence: string;
  selectedComment: string;
  selectedCommentLanguage: "ko" | "en";
  translationEn: string;
  commentEn: string;
  model: string;
  promptVersion: string;
};

export type PipelineInput = {
  entryId: string;
  title: string;
  body: string;
  personaId: PersonaId;
};

export type ModelMessage = {
  role: "system" | "user";
  content: string;
};

export type Complete = (messages: ModelMessage[], options?: { temperature?: number; maxTokens?: number }) => Promise<string>;
