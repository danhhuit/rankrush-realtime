import { nanoid } from "nanoid";
import { key, config } from "./config.js";
import { redis } from "./redis.js";
import type {
  GameSession,
  LeaderboardEntry,
  Player,
  Question,
  Quiz,
  User,
} from "./types.js";

const jsonFields = new Set([
  "settings",
  "options",
  "acceptedAnswers",
  "questionOrder",
]);
function encode<T extends object>(value: T) {
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => [
      k,
      typeof v === "object" ? JSON.stringify(v) : String(v ?? ""),
    ]),
  );
}
function decode<T>(hash: Record<string, string>): T {
  const out: Record<string, unknown> = { ...hash };
  for (const field of jsonFields)
    if (field in out) {
      try {
        out[field] = JSON.parse(String(out[field]));
      } catch {}
    }
  for (const field of [
    "currentQuestionIndex",
    "timeLimitSec",
    "basePoints",
    "order",
  ])
    if (field in out) out[field] = Number(out[field]);
  for (const field of ["online"])
    if (field in out) out[field] = out[field] === "true";
  return out as T;
}

export const keys = {
  users: key("users"),
  user: (id: string) => key("user", id),
  userEmail: (email: string) => key("user-email", email.toLowerCase()),
  passwordReset: (email: string) => key("password-reset", email.toLowerCase()),
  quizzes: key("quizzes"),
  publicQuizzes: key("quizzes", "public"),
  userQuizzes: (id: string) => key("user", id, "quizzes"),
  quiz: (id: string) => key("quiz", id),
  quizQuestions: (id: string) => key("quiz", id, "questions"),
  question: (id: string) => key("question", id),
  sessions: key("sessions"),
  session: (id: string) => key("session", `{${id}}`),
  sessionPin: (pin: string) => key("session-pin", pin),
  sessionPlayers: (id: string) => key("session", `{${id}}`, "players"),
  sessionNicknames: (id: string) => key("session", `{${id}}`, "nicknames"),
  player: (sid: string, pid: string) => key("player", `{${sid}}`, pid),
  leaderboard: (id: string) => key("leaderboard", `{${id}}`),
  teamboard: (id: string) => key("teamboard", `{${id}}`),
  answer: (sid: string, pid: string, qid: string) =>
    key("answer", `{${sid}}`, pid, qid),
  answers: (id: string) => key("session", `{${id}}`, "answers"),
  events: (id: string) => key("events", `{${id}}`),
};

export async function createUser(user: User) {
  const existing = await redis.get(keys.userEmail(user.email));
  if (existing)
    throw Object.assign(new Error("Email đã được sử dụng."), {
      status: 409,
      code: "EMAIL_EXISTS",
    });
  await redis
    .multi()
    .hset(keys.user(user.id), encode(user))
    .set(keys.userEmail(user.email), user.id)
    .sadd(keys.users, user.id)
    .exec();
  return user;
}
export async function getUser(id: string) {
  const h = await redis.hgetall(keys.user(id));
  return Object.keys(h).length ? decode<User>(h) : null;
}
export async function getUserByEmail(email: string) {
  const id = await redis.get(keys.userEmail(email));
  return id ? getUser(id) : null;
}

export async function saveQuiz(quiz: Quiz) {
  await redis
    .multi()
    .hset(keys.quiz(quiz.id), encode(quiz))
    .sadd(keys.quizzes, quiz.id)
    .sadd(keys.userQuizzes(quiz.ownerId), quiz.id)
    .zadd(
      keys.publicQuizzes,
      quiz.status === "PUBLISHED" ? Date.parse(quiz.updatedAt) : 0,
      quiz.id,
    )
    .exec();
  return quiz;
}
export async function getQuiz(id: string) {
  const h = await redis.hgetall(keys.quiz(id));
  return Object.keys(h).length ? decode<Quiz>(h) : null;
}
export async function listQuizzes(ownerId?: string) {
  const ids = ownerId
    ? await redis.smembers(keys.userQuizzes(ownerId))
    : await redis.zrevrange(keys.publicQuizzes, 0, 99);
  const pipe = redis.pipeline();
  ids.forEach((id) => pipe.hgetall(keys.quiz(id)));
  const result = await pipe.exec();
  const quizzes = (result ?? [])
    .map(([, h]) => decode<Quiz>(h as Record<string, string>))
    .filter((q) => q.id && (ownerId || q.status === "PUBLISHED"));
  const countPipe = redis.pipeline();
  quizzes.forEach((quiz) => countPipe.llen(keys.quizQuestions(quiz.id)));
  const counts = await countPipe.exec();
  return quizzes.map((quiz, index) => ({
    ...quiz,
    questionCount: Number(counts?.[index]?.[1] ?? 0),
  }));
}
export async function deleteQuiz(id: string, ownerId: string) {
  const quiz = await getQuiz(id);
  if (!quiz || quiz.ownerId !== ownerId) return false;
  const qids = await redis.lrange(keys.quizQuestions(id), 0, -1);
  const tx = redis.multi();
  qids.forEach((qid) => tx.del(keys.question(qid)));
  tx.del(keys.quizQuestions(id), keys.quiz(id))
    .srem(keys.quizzes, id)
    .srem(keys.userQuizzes(ownerId), id)
    .zrem(keys.publicQuizzes, id);
  await tx.exec();
  return true;
}
export async function saveQuestion(question: Question) {
  const exists = await redis.exists(keys.question(question.id));
  await redis.hset(keys.question(question.id), encode(question));
  if (!exists)
    await redis.rpush(keys.quizQuestions(question.quizId), question.id);
  return question;
}
export async function getQuestion(id: string) {
  const h = await redis.hgetall(keys.question(id));
  return Object.keys(h).length ? decode<Question>(h) : null;
}
export async function listQuestions(quizId: string) {
  const ids = await redis.lrange(keys.quizQuestions(quizId), 0, -1);
  const p = redis.pipeline();
  ids.forEach((id) => p.hgetall(keys.question(id)));
  const r = await p.exec();
  return (r ?? [])
    .map(([, h]) => decode<Question>(h as Record<string, string>))
    .filter((x) => x.id)
    .sort((a, b) => a.order - b.order);
}
export async function deleteQuestion(id: string) {
  const q = await getQuestion(id);
  if (!q) return false;
  await redis
    .multi()
    .del(keys.question(id))
    .lrem(keys.quizQuestions(q.quizId), 0, id)
    .exec();
  return true;
}

async function uniquePin() {
  for (let i = 0; i < 20; i++) {
    const pin = String(Math.floor(100000 + Math.random() * 900000));
    if (!(await redis.exists(keys.sessionPin(pin)))) return pin;
  }
  throw new Error("Không thể tạo PIN, vui lòng thử lại.");
}
export async function createSession(input: Omit<GameSession, "pin">) {
  const session = { ...input, pin: await uniquePin() } as GameSession;
  await redis
    .multi()
    .hset(keys.session(session.id), encode(session))
    .sadd(keys.sessions, session.id)
    .set(
      keys.sessionPin(session.pin),
      session.id,
      "EX",
      config.JOIN_CODE_TTL_SECONDS,
    )
    .expire(keys.session(session.id), config.SESSION_TTL_SECONDS)
    .exec();
  return session;
}
export async function getSession(id: string) {
  const h = await redis.hgetall(keys.session(id));
  return Object.keys(h).length ? decode<GameSession>(h) : null;
}
export async function getSessionByPin(pin: string) {
  const id = await redis.get(keys.sessionPin(pin));
  return id ? getSession(id) : null;
}
export async function listSessions(hostId?: string) {
  const ids = await redis.smembers(keys.sessions);
  const pipeline = redis.pipeline();
  ids.forEach((id) => pipeline.hgetall(keys.session(id)));
  const rows = await pipeline.exec();
  return (rows ?? [])
    .map(([, hash]) => decode<GameSession>(hash as Record<string, string>))
    .filter((session) => session.id && (!hostId || session.hostId === hostId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export async function updateSession(id: string, patch: Partial<GameSession>) {
  await redis.hset(keys.session(id), encode(patch));
  return getSession(id);
}

const safeAdjectives = [
  "Nhanh",
  "Thông Minh",
  "Dũng Cảm",
  "Tỏa Sáng",
  "May Mắn",
  "Bền Bỉ",
];
const safeAnimals = ["Cáo", "Hổ", "Gấu", "Cú", "Rái Cá", "Đại Bàng", "Cá Heo"];
export async function joinSession(
  session: GameSession,
  input: Pick<Player, "nickname" | "avatar" | "country" | "team">,
) {
  if (session.state !== "LOBBY")
    throw Object.assign(new Error("Phòng không còn nhận người chơi."), {
      status: 409,
      code: "SESSION_NOT_JOINABLE",
    });
  if (
    (await redis.scard(keys.sessionPlayers(session.id))) >=
    config.MAX_PLAYERS_PER_SESSION
  )
    throw Object.assign(new Error("Phòng đã đầy."), {
      status: 409,
      code: "SESSION_FULL",
    });
  let nickname = input.nickname.trim();
  if (session.settings.safeNames)
    nickname = `${safeAdjectives[Math.floor(Math.random() * safeAdjectives.length)]} ${safeAnimals[Math.floor(Math.random() * safeAnimals.length)]}`;
  const normalized = nickname.toLocaleLowerCase("vi-VN");
  if (await redis.hexists(keys.sessionNicknames(session.id), normalized))
    throw Object.assign(new Error("Tên này đã có trong phòng."), {
      status: 409,
      code: "NICKNAME_EXISTS",
    });
  const player: Player = {
    id: nanoid(12),
    sessionId: session.id,
    nickname,
    avatar: input.avatar || "rocket",
    country: input.country || "VN",
    team: input.team || "",
    joinedAt: new Date().toISOString(),
    online: true,
  };
  const tx = redis
    .multi()
    .hset(keys.player(session.id, player.id), encode(player))
    .sadd(keys.sessionPlayers(session.id), player.id)
    .hset(keys.sessionNicknames(session.id), normalized, player.id)
    .zadd(keys.leaderboard(session.id), 0, player.id)
    .xadd(
      keys.events(session.id),
      "MAXLEN",
      "~",
      5000,
      "*",
      "type",
      "PLAYER_JOINED",
      "playerId",
      player.id,
      "at",
      player.joinedAt,
    );
  if (player.team) tx.zadd(keys.teamboard(session.id), 0, player.team);
  await tx.exec();
  return player;
}
export async function getPlayer(sessionId: string, playerId: string) {
  const h = await redis.hgetall(keys.player(sessionId, playerId));
  return Object.keys(h).length ? decode<Player>(h) : null;
}
export async function listPlayers(sessionId: string) {
  const ids = await redis.smembers(keys.sessionPlayers(sessionId));
  const p = redis.pipeline();
  ids.forEach((id) => p.hgetall(keys.player(sessionId, id)));
  const r = await p.exec();
  return (r ?? [])
    .map(([, h]) => decode<Player>(h as Record<string, string>))
    .filter((x) => x.id);
}

export async function getLeaderboard(
  sessionId: string,
  limit = 10,
): Promise<LeaderboardEntry[]> {
  const raw = await redis.zrevrange(
    keys.leaderboard(sessionId),
    0,
    Math.max(0, limit - 1),
    "WITHSCORES",
  );
  const rows: Array<{ id: string; score: number }> = [];
  for (let i = 0; i < raw.length; i += 2)
    rows.push({ id: raw[i]!, score: Number(raw[i + 1]) });
  const p = redis.pipeline();
  rows.forEach((x) => p.hgetall(keys.player(sessionId, x.id)));
  const meta = await p.exec();
  return rows.map((row, index) => {
    const pl = decode<Player>(
      (meta?.[index]?.[1] ?? {}) as Record<string, string>,
    );
    return {
      rank: index + 1,
      playerId: row.id,
      nickname: pl.nickname || "Người chơi",
      avatar: pl.avatar || "rocket",
      country: pl.country || "",
      team: pl.team || "",
      score: row.score,
    };
  });
}
export async function getPlayerRank(sessionId: string, playerId: string) {
  const [score, reverseRank, ascendingRank] = await Promise.all([
    redis.zscore(keys.leaderboard(sessionId), playerId),
    redis.zrevrank(keys.leaderboard(sessionId), playerId),
    redis.zrank(keys.leaderboard(sessionId), playerId),
  ]);
  return score === null
    ? null
    : {
        score: Number(score),
        rank: (reverseRank ?? 0) + 1,
        ascendingRank: (ascendingRank ?? 0) + 1,
      };
}
export async function getTeamLeaderboard(sessionId: string) {
  const raw = await redis.zrevrange(
    keys.teamboard(sessionId),
    0,
    9,
    "WITHSCORES",
  );
  const out = [];
  for (let i = 0; i < raw.length; i += 2)
    out.push({ rank: i / 2 + 1, team: raw[i]!, score: Number(raw[i + 1]) });
  return out;
}

const submitLua = `
if redis.call('EXISTS', KEYS[1]) == 1 then
  return {0, redis.call('HGET', KEYS[1], 'awardedPoints'), redis.call('ZSCORE', KEYS[3], ARGV[1])}
end
redis.call('HSET', KEYS[1], 'id', ARGV[2], 'sessionId', ARGV[3], 'playerId', ARGV[1], 'questionId', ARGV[4], 'selectedAnswer', ARGV[5], 'isCorrect', ARGV[6], 'responseMs', ARGV[7], 'awardedPoints', ARGV[8], 'submittedAt', ARGV[9])
redis.call('SADD', KEYS[2], KEYS[1])
local newScore = redis.call('ZINCRBY', KEYS[3], ARGV[8], ARGV[1])
if ARGV[10] ~= '' then redis.call('ZINCRBY', KEYS[4], ARGV[8], ARGV[10]) end
redis.call('XADD', KEYS[5], 'MAXLEN', '~', 5000, '*', 'type', 'ANSWER_SUBMITTED', 'playerId', ARGV[1], 'questionId', ARGV[4], 'points', ARGV[8], 'at', ARGV[9])
return {1, ARGV[8], newScore}
`;
export async function submitAnswerAtomic(input: {
  sessionId: string;
  playerId: string;
  questionId: string;
  selectedAnswer: string;
  isCorrect: boolean;
  responseMs: number;
  awardedPoints: number;
  team: string;
}) {
  const answerKey = keys.answer(
    input.sessionId,
    input.playerId,
    input.questionId,
  );
  const id = nanoid(14);
  const now = new Date().toISOString();
  const result = (await redis.eval(
    submitLua,
    5,
    answerKey,
    keys.answers(input.sessionId),
    keys.leaderboard(input.sessionId),
    keys.teamboard(input.sessionId),
    keys.events(input.sessionId),
    input.playerId,
    id,
    input.sessionId,
    input.questionId,
    input.selectedAnswer,
    String(input.isCorrect),
    String(input.responseMs),
    String(input.awardedPoints),
    now,
    input.team,
  )) as [number, string, string];
  return {
    created: Number(result[0]) === 1,
    awardedPoints: Number(result[1]),
    totalScore: Number(result[2]),
  };
}
export async function countAnswersForQuestion(
  sessionId: string,
  questionId: string,
) {
  const answerKeys = await redis.smembers(keys.answers(sessionId));
  if (!answerKeys.length) return 0;
  const p = redis.pipeline();
  answerKeys.forEach((k) => p.hget(k, "questionId"));
  const r = await p.exec();
  return (r ?? []).filter(([, v]) => v === questionId).length;
}
export async function buildReport(sessionId: string) {
  const [session, players, leaderboard, answerKeys] = await Promise.all([
    getSession(sessionId),
    listPlayers(sessionId),
    getLeaderboard(sessionId, 1000),
    redis.smembers(keys.answers(sessionId)),
  ]);
  const p = redis.pipeline();
  answerKeys.forEach((k) => p.hgetall(k));
  const raw = await p.exec();
  const answers = (raw ?? []).map(([, h]) =>
    decode<Record<string, string>>(h as Record<string, string>),
  );
  const playerRows = leaderboard.map((entry) => {
    const mine = answers.filter((a) => a.playerId === entry.playerId);
    const correct = mine.filter((a) => a.isCorrect === "true").length;
    const avg = mine.length
      ? Math.round(
          mine.reduce((s, a) => s + Number(a.responseMs), 0) / mine.length,
        )
      : 0;
    return {
      ...entry,
      answers: mine.length,
      correct,
      accuracy: mine.length ? Math.round((correct / mine.length) * 100) : 0,
      avgResponseMs: avg,
    };
  });
  const quiz = session ? await getQuiz(session.quizId) : null;
  const questions = quiz ? await listQuestions(quiz.id) : [];
  const questionRows = questions.map((q) => {
    const mine = answers.filter((a) => a.questionId === q.id);
    const correct = mine.filter((a) => a.isCorrect === "true").length;
    return {
      questionId: q.id,
      prompt: q.prompt,
      answers: mine.length,
      correct,
      accuracy: mine.length ? Math.round((correct / mine.length) * 100) : 0,
    };
  });
  return {
    session,
    quiz,
    playerCount: players.length,
    answerCount: answers.length,
    players: playerRows,
    questions: questionRows,
  };
}

export async function buildPlayerResult(sessionId: string, playerId: string) {
  const [session, rank, answerKeys] = await Promise.all([
    getSession(sessionId),
    getPlayerRank(sessionId, playerId),
    redis.smembers(keys.answers(sessionId)),
  ]);
  const playerAnswerPrefix = keys.answer(sessionId, playerId, "");
  const playerAnswerKeys = answerKeys.filter((answerKey) =>
    answerKey.startsWith(playerAnswerPrefix),
  );
  const pipeline = redis.pipeline();
  playerAnswerKeys.forEach((answerKey) => pipeline.hgetall(answerKey));
  const raw = await pipeline.exec();
  const answers = (raw ?? []).map(([, value]) =>
    decode<Record<string, string>>(value as Record<string, string>),
  );
  const correct = answers.filter(
    (answer) => answer.isCorrect === "true",
  ).length;
  const avgResponseMs = answers.length
    ? Math.round(
        answers.reduce(
          (total, answer) => total + Number(answer.responseMs),
          0,
        ) / answers.length,
      )
    : 0;
  return {
    rank: rank?.rank ?? 0,
    score: rank?.score ?? 0,
    answers: answers.length,
    correct,
    totalQuestions: session?.questionOrder.length ?? 0,
    accuracy: answers.length ? Math.round((correct / answers.length) * 100) : 0,
    avgResponseMs,
  };
}
