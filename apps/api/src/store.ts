import { nanoid } from "nanoid";
import { key, config } from "./config.js";
import { isUnsafeNickname } from "./nickname-filter.js";
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
    "pausedRemainingMs",
    "timeLimitSec",
    "basePoints",
    "order",
    "popularity",
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
  userUsername: (username: string) =>
    key("user-username", username.toLowerCase()),
  passwordReset: (email: string) => key("password-reset", email.toLowerCase()),
  emailVerification: (email: string) =>
    key("email-verification", email.toLowerCase()),
  emailCodeCooldown: (purpose: string, email: string) =>
    key("email-code-cooldown", purpose, email.toLowerCase()),
  emailCodeAttempts: (purpose: string, email: string) =>
    key("email-code-attempts", purpose, email.toLowerCase()),
  loginAttempts: (identifier: string) =>
    key("login-attempts", identifier.toLowerCase()),
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
  phaseLock: (id: string) => key("session", `{${id}}`, "phase-lock"),
};

export async function createUser(user: User) {
  const normalizedUsername = user.username?.trim().toLowerCase();
  const [emailOwner, usernameOwner] = await Promise.all([
    redis.get(keys.userEmail(user.email)),
    normalizedUsername
      ? redis.get(keys.userUsername(normalizedUsername))
      : Promise.resolve(null),
  ]);
  if (emailOwner)
    throw Object.assign(new Error("Email đã được sử dụng."), {
      status: 409,
      code: "EMAIL_EXISTS",
    });
  if (usernameOwner)
    throw Object.assign(new Error("Tên đăng nhập đã được sử dụng."), {
      status: 409,
      code: "USERNAME_EXISTS",
    });
  const normalizedUser = { ...user, username: normalizedUsername };
  const tx = redis
    .multi()
    .hset(keys.user(user.id), encode(normalizedUser))
    .set(keys.userEmail(user.email), user.id)
    .sadd(keys.users, user.id);
  if (normalizedUsername)
    tx.set(keys.userUsername(normalizedUsername), user.id);
  await tx.exec();
  return normalizedUser;
}
export async function getUser(id: string) {
  const h = await redis.hgetall(keys.user(id));
  return Object.keys(h).length ? decode<User>(h) : null;
}
export async function getUserByEmail(email: string) {
  const id = await redis.get(keys.userEmail(email));
  return id ? getUser(id) : null;
}
export async function getUserByUsername(username: string) {
  const normalized = username.trim().toLowerCase();
  const id = await redis.get(keys.userUsername(normalized));
  if (id) return getUser(id);
  // Lazy migration for accounts created before usernames were introduced.
  const ids = await redis.smembers(keys.users);
  if (!ids.length) return null;
  const pipe = redis.pipeline();
  ids.forEach((userId) => pipe.hgetall(keys.user(userId)));
  const rows = await pipe.exec();
  const match = (rows ?? [])
    .map(([, hash]) => decode<User>(hash as Record<string, string>))
    .find(
      (user) =>
        user.username?.toLowerCase() === normalized ||
        user.email.split("@")[0]?.toLowerCase() === normalized,
    );
  if (!match) return null;
  await redis
    .multi()
    .set(keys.userUsername(normalized), match.id)
    .hset(keys.user(match.id), "username", normalized)
    .exec();
  return { ...match, username: normalized };
}

export async function saveQuiz(quiz: Quiz) {
  const tx = redis
    .multi()
    .hset(keys.quiz(quiz.id), encode(quiz))
    .sadd(keys.quizzes, quiz.id)
    .sadd(keys.userQuizzes(quiz.ownerId), quiz.id);
  if (quiz.status === "PUBLISHED")
    tx.zadd(keys.publicQuizzes, Date.parse(quiz.updatedAt), quiz.id);
  else tx.zrem(keys.publicQuizzes, quiz.id);
  await tx.exec();
  return quiz;
}
export async function getQuiz(id: string) {
  const h = await redis.hgetall(keys.quiz(id));
  return Object.keys(h).length ? decode<Quiz>(h) : null;
}
export async function listQuizzes(
  ownerId?: string,
  options: {
    query?: string;
    category?: string;
    offset?: number;
    limit?: number;
  } = {},
) {
  const ids = ownerId
    ? await redis.smembers(keys.userQuizzes(ownerId))
    : await redis.zrevrange(keys.publicQuizzes, 0, -1);
  const pipe = redis.pipeline();
  ids.forEach((id) => pipe.hgetall(keys.quiz(id)));
  const result = await pipe.exec();
  const query = options.query?.trim().toLocaleLowerCase("vi-VN") || "";
  const category = options.category?.trim() || "";
  const offset = Math.max(0, options.offset ?? 0);
  const limit = Math.min(100, Math.max(1, options.limit ?? 100));
  const quizzes = (result ?? [])
    .map(([, h]) => decode<Quiz>(h as Record<string, string>))
    .filter((q) => q.id && (ownerId || q.status === "PUBLISHED"))
    .filter((q) => !category || q.category === category)
    .filter(
      (q) =>
        !query ||
        `${q.title} ${q.description} ${q.category} ${q.subcategory}`
          .toLocaleLowerCase("vi-VN")
          .includes(query),
    );
  if (ownerId) quizzes.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const page = quizzes.slice(offset, offset + limit);
  return Promise.all(
    page.map(async (quiz) => {
      const questions = await listQuestions(quiz.id);
      return {
        ...quiz,
        questionCount: questions.length,
        averageTimeLimitSec: questions.length
          ? Math.round(
              questions.reduce(
                (sum, question) => sum + question.timeLimitSec,
                0,
              ) / questions.length,
            )
          : 0,
      };
    }),
  );
}
export async function deleteQuiz(id: string) {
  const quiz = await getQuiz(id);
  if (!quiz) return false;
  const qids = await redis.lrange(keys.quizQuestions(id), 0, -1);
  const tx = redis.multi();
  qids.forEach((qid) => tx.del(keys.question(qid)));
  tx.del(keys.quizQuestions(id), keys.quiz(id))
    .srem(keys.quizzes, id)
    .srem(keys.userQuizzes(quiz.ownerId), id)
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

async function reserveUniquePin(sessionId: string) {
  for (let i = 0; i < 20; i++) {
    const pin = String(Math.floor(100000 + Math.random() * 900000));
    const reserved = await redis.set(
      keys.sessionPin(pin),
      sessionId,
      "EX",
      config.JOIN_CODE_TTL_SECONDS,
      "NX",
    );
    if (reserved === "OK") return pin;
  }
  throw new Error("Không thể tạo PIN, vui lòng thử lại.");
}
export async function createSession(input: Omit<GameSession, "pin">) {
  const session = {
    ...input,
    pin: await reserveUniquePin(input.id),
  } as GameSession;
  try {
    await redis
      .multi()
      .hset(keys.session(session.id), encode(session))
      .sadd(keys.sessions, session.id)
      .expire(keys.session(session.id), config.SESSION_TTL_SECONDS)
      .exec();
    return session;
  } catch (error) {
    await redis.del(keys.sessionPin(session.pin));
    throw error;
  }
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
  const decoded = (rows ?? [])
    .map(([, hash]) => decode<GameSession>(hash as Record<string, string>))
    .filter((session) => session.id);
  const liveIds = new Set(decoded.map((session) => session.id));
  const staleIds = ids.filter((id) => !liveIds.has(id));
  if (staleIds.length) await redis.srem(keys.sessions, ...staleIds);
  return decoded
    .filter((session) => !hostId || session.hostId === hostId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export async function updateSession(id: string, patch: Partial<GameSession>) {
  const current = await getSession(id);
  if (!current) return null;
  const pin = patch.pin || current.pin;
  const tx = redis
    .multi()
    .hset(keys.session(id), encode(patch))
    .expire(keys.session(id), config.SESSION_TTL_SECONDS);
  if (patch.state === "ENDED" || patch.state === "CANCELLED")
    tx.del(keys.sessionPin(pin));
  else tx.expire(keys.sessionPin(pin), config.JOIN_CODE_TTL_SECONDS);
  await tx.exec();
  return getSession(id);
}

const joinSessionLua = `
local ttl = tonumber(ARGV[9])
if redis.call('HGET', KEYS[1], 'state') ~= 'LOBBY' then return 3 end
if redis.call('SCARD', KEYS[2]) >= tonumber(ARGV[1]) then return 1 end
if redis.call('HEXISTS', KEYS[3], ARGV[2]) == 1 then return 2 end
redis.call('HSET', KEYS[4], 'id', ARGV[3], 'sessionId', ARGV[4], 'nickname', ARGV[5], 'avatar', ARGV[6], 'country', '', 'team', ARGV[7], 'joinedAt', ARGV[8], 'online', 'true')
redis.call('SADD', KEYS[2], ARGV[3])
redis.call('HSET', KEYS[3], ARGV[2], ARGV[3])
redis.call('ZADD', KEYS[5], 0, ARGV[3])
if ARGV[7] ~= '' then redis.call('ZADD', KEYS[7], 0, ARGV[7]) end
redis.call('XADD', KEYS[6], 'MAXLEN', '~', 5000, '*', 'type', 'PLAYER_JOINED', 'playerId', ARGV[3], 'at', ARGV[8])
for i = 1, #KEYS do
  if redis.call('EXISTS', KEYS[i]) == 1 then redis.call('EXPIRE', KEYS[i], ttl) end
end
return 0
`;
export async function joinSession(
  session: GameSession,
  input: Pick<Player, "nickname" | "avatar" | "country" | "team">,
) {
  const requestedNickname = input.nickname.trim();
  if (isUnsafeNickname(requestedNickname)) {
    throw Object.assign(
      new Error(
        "Biệt danh chứa nội dung không phù hợp. Vui lòng chọn tên khác.",
      ),
      { status: 400, code: "UNSAFE_NICKNAME" },
    );
  }
  const nickname = requestedNickname;
  {
    const player: Player = {
      id: nanoid(12),
      sessionId: session.id,
      nickname,
      avatar: input.avatar || "human|1|0|0|0",
      country: "",
      team: input.team || "",
      joinedAt: new Date().toISOString(),
      online: true,
    };
    const result = Number(
      await redis.eval(
        joinSessionLua,
        7,
        keys.session(session.id),
        keys.sessionPlayers(session.id),
        keys.sessionNicknames(session.id),
        keys.player(session.id, player.id),
        keys.leaderboard(session.id),
        keys.events(session.id),
        keys.teamboard(session.id),
        String(config.MAX_PLAYERS_PER_SESSION),
        nickname.toLocaleLowerCase("vi-VN"),
        player.id,
        session.id,
        player.nickname,
        player.avatar,
        player.team,
        player.joinedAt,
        String(config.SESSION_TTL_SECONDS),
      ),
    );
    if (result === 0) return player;
    if (result === 1)
      throw Object.assign(new Error("Phòng đã đầy."), {
        status: 409,
        code: "SESSION_FULL",
      });
    if (result === 3)
      throw Object.assign(new Error("Phòng không còn nhận người chơi."), {
        status: 409,
        code: "SESSION_NOT_JOINABLE",
      });
    if (result === 2)
      throw Object.assign(new Error("Tên này đã có trong phòng."), {
        status: 409,
        code: "NICKNAME_EXISTS",
      });
  }
  throw Object.assign(new Error("Không thể tham gia phòng."), {
    status: 500,
    code: "JOIN_FAILED",
  });
}
export async function getPlayer(sessionId: string, playerId: string) {
  const h = await redis.hgetall(keys.player(sessionId, playerId));
  return Object.keys(h).length ? decode<Player>(h) : null;
}
export async function removePlayer(sessionId: string, playerId: string) {
  const player = await getPlayer(sessionId, playerId);
  if (!player) return false;
  await redis
    .multi()
    .srem(keys.sessionPlayers(sessionId), player.id)
    .hdel(
      keys.sessionNicknames(sessionId),
      player.nickname.toLocaleLowerCase("vi-VN"),
    )
    .zrem(keys.leaderboard(sessionId), player.id)
    .del(keys.player(sessionId, player.id))
    .exec();
  return true;
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
      avatar: pl.avatar || "human|1|0|0|0",
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
local ttl = tonumber(ARGV[11])
if redis.call('EXISTS', KEYS[1]) == 1 then
  for i = 1, #KEYS do if redis.call('EXISTS', KEYS[i]) == 1 then redis.call('EXPIRE', KEYS[i], ttl) end end
  return {0, redis.call('HGET', KEYS[1], 'awardedPoints'), redis.call('ZSCORE', KEYS[3], ARGV[1])}
end
redis.call('HSET', KEYS[1], 'id', ARGV[2], 'sessionId', ARGV[3], 'playerId', ARGV[1], 'questionId', ARGV[4], 'selectedAnswer', ARGV[5], 'isCorrect', ARGV[6], 'responseMs', ARGV[7], 'awardedPoints', ARGV[8], 'submittedAt', ARGV[9])
redis.call('SADD', KEYS[2], KEYS[1])
local newScore = redis.call('ZINCRBY', KEYS[3], ARGV[8], ARGV[1])
if ARGV[10] ~= '' then redis.call('ZINCRBY', KEYS[4], ARGV[8], ARGV[10]) end
redis.call('XADD', KEYS[5], 'MAXLEN', '~', 5000, '*', 'type', 'ANSWER_SUBMITTED', 'playerId', ARGV[1], 'questionId', ARGV[4], 'points', ARGV[8], 'at', ARGV[9])
for i = 1, #KEYS do if redis.call('EXISTS', KEYS[i]) == 1 then redis.call('EXPIRE', KEYS[i], ttl) end end
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
    7,
    answerKey,
    keys.answers(input.sessionId),
    keys.leaderboard(input.sessionId),
    keys.teamboard(input.sessionId),
    keys.events(input.sessionId),
    keys.session(input.sessionId),
    keys.player(input.sessionId, input.playerId),
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
    String(config.SESSION_TTL_SECONDS),
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
