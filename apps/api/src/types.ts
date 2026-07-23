export type QuizStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type QuestionType = "SINGLE_CHOICE" | "TRUE_FALSE" | "TEXT";
export type SessionState =
  | "LOBBY"
  | "GAME_COUNTDOWN"
  | "QUESTION_PREVIEW"
  | "RUNNING"
  | "QUESTION_RESULT"
  | "PAUSED"
  | "ENDED"
  | "CANCELLED";
export type PlayPhase = "QUESTION_PREVIEW" | "RUNNING" | "QUESTION_RESULT";

export interface User {
  id: string;
  username?: string;
  email: string;
  displayName: string;
  passwordHash: string;
  rawPassword?: string;
  role: "HOST" | "ADMIN";
  status?: "ACTIVE" | "SUSPENDED";
  createdAt: string;
}
export interface QuizSettings {
  shuffleQuestions: boolean;
  shuffleAnswers: boolean;
  showLeaderboard: boolean;
  speedScoring: boolean;
}
export interface Quiz {
  id: string;
  title: string;
  description: string;
  category: string;
  subcategory?: string;
  popularity?: number;
  coverColor: string;
  ownerId: string;
  status: QuizStatus;
  settings: QuizSettings;
  createdAt: string;
  updatedAt: string;
}
export interface AnswerOption {
  id: string;
  text: string;
}
export interface Question {
  id: string;
  quizId: string;
  type: QuestionType;
  prompt: string;
  options: AnswerOption[];
  correctOptionId: string;
  acceptedAnswers: string[];
  timeLimitSec: number;
  basePoints: number;
  order: number;
  explanation: string;
}
export interface SessionSettings {
  autoAdvance: boolean;
  teamMode: boolean;
  hideLeaderboard: boolean;
  safeNames: boolean;
  hideCountryFlags: boolean;
  mutePlayers: boolean;
  speedScoring: boolean;
}
export interface GameSession {
  id: string;
  quizId: string;
  hostId: string;
  pin: string;
  state: SessionState;
  currentQuestionIndex: number;
  questionStartedAt: string;
  pausedState?: PlayPhase;
  pausedRemainingMs?: number;
  questionOrder: string[];
  settings: SessionSettings;
  createdAt: string;
  startedAt: string;
  endedAt: string;
}
export interface Player {
  id: string;
  sessionId: string;
  nickname: string;
  avatar: string;
  country: string;
  team: string;
  joinedAt: string;
  online: boolean;
}
export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  nickname: string;
  avatar: string;
  country: string;
  team: string;
  score: number;
}
