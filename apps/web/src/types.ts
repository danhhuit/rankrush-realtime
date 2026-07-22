export type QuizSettings = {
  shuffleQuestions: boolean;
  shuffleAnswers: boolean;
  showLeaderboard: boolean;
  speedScoring: boolean;
};
export type Quiz = {
  id: string;
  title: string;
  description: string;
  category: string;
  subcategory?: string;
  popularity?: number;
  questionCount?: number;
  averageTimeLimitSec?: number;
  coverColor: string;
  ownerId: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  settings: QuizSettings;
  createdAt: string;
  updatedAt: string;
};
export type Option = { id: string; text: string };
export type Question = {
  id: string;
  quizId: string;
  type: "SINGLE_CHOICE" | "TRUE_FALSE" | "TEXT";
  prompt: string;
  options: Option[];
  correctOptionId: string;
  acceptedAnswers: string[];
  timeLimitSec: number;
  basePoints: number;
  order: number;
  explanation: string;
};
export type SessionSettings = {
  autoAdvance: boolean;
  teamMode: boolean;
  hideLeaderboard: boolean;
  safeNames: boolean;
  hideCountryFlags: boolean;
  mutePlayers: boolean;
  speedScoring: boolean;
};
export type Session = {
  id: string;
  quizId: string;
  hostId: string;
  pin: string;
  state:
    | "LOBBY"
    | "GAME_COUNTDOWN"
    | "QUESTION_PREVIEW"
    | "RUNNING"
    | "QUESTION_RESULT"
    | "PAUSED"
    | "ENDED"
    | "CANCELLED";
  currentQuestionIndex: number;
  questionStartedAt: string;
  pausedState?: "QUESTION_PREVIEW" | "RUNNING" | "QUESTION_RESULT";
  pausedRemainingMs?: number;
  questionOrder: string[];
  settings: SessionSettings;
  createdAt: string;
  startedAt: string;
  endedAt: string;
};
export type Player = {
  id: string;
  sessionId: string;
  nickname: string;
  avatar: string;
  country: string;
  team: string;
  joinedAt: string;
  online: boolean;
};
export type LeaderboardEntry = {
  rank: number;
  playerId: string;
  nickname: string;
  avatar: string;
  country: string;
  team: string;
  score: number;
};
export type Snapshot = {
  session: Session;
  quiz: { id: string; title: string; description: string; category: string };
  playerCount: number;
  players: Array<
    Pick<Player, "id" | "nickname" | "avatar" | "country" | "team" | "online">
  >;
  leaderboard: LeaderboardEntry[];
  teamLeaderboard: Array<{ rank: number; team: string; score: number }>;
  currentQuestion?: Pick<
    Question,
    "id" | "type" | "prompt" | "options" | "timeLimitSec" | "order"
  >;
  revealedQuestion?: {
    correctOptionId: string;
    acceptedAnswers: string[];
    explanation: string;
  } | null;
  selfRank?: { score: number; rank: number; ascendingRank: number } | null;
};

export type PlayerResult = {
  rank: number;
  score: number;
  answers: number;
  correct: number;
  totalQuestions: number;
  accuracy: number;
  avgResponseMs: number;
};
