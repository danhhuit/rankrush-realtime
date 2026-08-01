import type { GeneratedQuestion } from "./quiz-generator.js";

export type AiProviderName = "GEMINI" | "OLLAMA" | "LOCAL_FALLBACK";
export type GenerationLanguage = "vi" | "en";
export type GenerationDifficulty = "EASY" | "MEDIUM" | "HARD";

export type QuizGenerationInput = {
  subject: string;
  context?: string;
  sourceText?: string;
  count: number;
  language?: GenerationLanguage;
  difficulty?: GenerationDifficulty;
  requireAi?: boolean;
  providerOverride?: "GEMINI" | "OLLAMA";
};

export type QuestionQualityReview = {
  index: number;
  qualityScore: number;
  groundedInSource: boolean;
  answerIsCorrect: boolean;
  questionIsUnambiguous: boolean;
  distractorsArePlausible: boolean;
  problems: string[];
};

export type QuizGenerationResult = {
  questions: GeneratedQuestion[];
  provider: AiProviderName;
  model: string;
  warning?: string;
  reviewed?: boolean;
  averageQualityScore?: number;
  regeneratedCount?: number;
};

export interface QuizAiProvider {
  readonly name: Exclude<AiProviderName, "LOCAL_FALLBACK">;
  readonly model: string;
  generate(input: QuizGenerationInput): Promise<QuizGenerationResult>;
  status(): Promise<Record<string, unknown>>;
}
