import http from "node:http";
import { createHash, randomInt } from "node:crypto";
import { existsSync } from "node:fs";
import { networkInterfaces } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import cors from "cors";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import helmet from "helmet";
import multer from "multer";
import { nanoid } from "nanoid";
import { PDFParse } from "pdf-parse";
import { Server } from "socket.io";
import { z } from "zod";
import {
  optionalAuth,
  requireAdmin,
  requireHost,
  requirePlayer,
  signHost,
  signPlayer,
  verifyToken,
} from "./auth.js";
import { config } from "./config.js";
import {
  importQuizQuestionsFromCsv,
  quizCsvTemplate,
} from "./csv-quiz-import.js";
import {
  isSmtpConfigured,
  sendVerificationCode,
  verifyMailConnection,
} from "./mailer.js";
import { isUnsafeNickname } from "./nickname-filter.js";
import { connectRedis, closeRedis, redis } from "./redis.js";
import { calculateScore, normalizeText } from "./score.js";
import {
  generateQuizQuestionsSmart,
  getOllamaStatus,
} from "./ollama-quiz-generator.js";
import {
  buildReport,
  buildPlayerResult,
  countAnswersForQuestion,
  createSession,
  createUser,
  deleteQuestion,
  deleteQuiz,
  getLeaderboard,
  getPlayer,
  getPlayerRank,
  getQuestion,
  getQuiz,
  getSession,
  getSessionByPin,
  getTeamLeaderboard,
  getUser,
  getUserByEmail,
  getUserByUsername,
  joinSession,
  keys,
  listPlayers,
  listQuestions,
  listQuizzes,
  listSessions,
  listUsers,
  removePlayer,
  saveQuestion,
  saveQuiz,
  submitAnswerAtomic,
  updateSession,
} from "./store.js";
import type {
  GameSession,
  Question,
  Quiz,
  SessionSettings,
  User,
} from "./types.js";

const app = express();
const server = http.createServer(app);
const isAllowedWebOrigin = (origin: string) => {
  const configuredPublicUrl = config.PUBLIC_WEB_URL?.replace(/\/$/, "");
  if (origin === config.WEB_ORIGIN || origin === configuredPublicUrl)
    return true;
  try {
    const url = new URL(origin);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    const port = Number(url.port || (url.protocol === "https:" ? "443" : "80"));
    const allowedPort = port === config.WEB_PORT || port === config.PORT;
    if (!allowedPort) return false;
    const hostname = url.hostname.replace(/^\[|\]$/g, "");
    const loopback =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1";
    const privateNetwork = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(
      hostname,
    );
    return loopback || privateNetwork;
  } catch {
    return false;
  }
};
const allowWebOrigin = (
  origin: string | undefined,
  callback: (error: Error | null, allow?: boolean) => void,
) => {
  if (!origin || isAllowedWebOrigin(origin)) callback(null, true);
  else
    callback(
      Object.assign(new Error("Origin không được phép truy cập RankRush."), {
        status: 403,
        code: "CORS_ORIGIN_DENIED",
      }),
    );
};
const io = new Server(server, {
  cors: { origin: allowWebOrigin, credentials: true },
});

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: allowWebOrigin, credentials: true }));
app.use(express.json({ limit: "1mb" }));

const quizSourceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const supported =
      file.mimetype === "application/pdf" ||
      file.mimetype === "text/csv" ||
      file.mimetype === "application/vnd.ms-excel" ||
      extension === ".csv";
    if (!supported) {
      callback(
        Object.assign(new Error("Chỉ hỗ trợ tệp PDF hoặc CSV."), {
          status: 400,
          code: "SOURCE_FILE_UNSUPPORTED",
        }),
      );
      return;
    }
    callback(null, true);
  },
});

const asyncRoute =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    void fn(req, res, next).catch(next);
  };
const authId = (req: Request) => {
  if (req.auth?.kind !== "host")
    throw Object.assign(new Error("Không có quyền."), {
      status: 401,
      code: "UNAUTHORIZED",
    });
  return req.auth.sub;
};
async function ownedQuiz(req: Request, id: string) {
  const quiz = await getQuiz(id);
  if (!quiz)
    throw Object.assign(new Error("Không tìm thấy quiz."), {
      status: 404,
      code: "QUIZ_NOT_FOUND",
    });
  const isAdmin = req.auth?.kind === "host" && req.auth.role === "ADMIN";
  if (quiz.ownerId !== authId(req) && !isAdmin)
    throw Object.assign(new Error("Bạn không sở hữu quiz này."), {
      status: 403,
      code: "FORBIDDEN",
    });
  return quiz;
}
async function hostableQuiz(req: Request, id: string) {
  const quiz = await getQuiz(id);
  if (!quiz)
    throw Object.assign(new Error("Không tìm thấy quiz."), {
      status: 404,
      code: "QUIZ_NOT_FOUND",
    });
  const isAdmin = req.auth?.kind === "host" && req.auth.role === "ADMIN";
  if (quiz.ownerId !== authId(req) && quiz.status !== "PUBLISHED" && !isAdmin)
    throw Object.assign(new Error("Quiz này chưa được công khai để tổ chức."), {
      status: 403,
      code: "FORBIDDEN",
    });
  return quiz;
}
async function ownedSession(req: Request, id: string) {
  const s = await getSession(id);
  if (!s)
    throw Object.assign(new Error("Không tìm thấy phiên."), {
      status: 404,
      code: "SESSION_NOT_FOUND",
    });
  const isAdmin = req.auth?.kind === "host" && req.auth.role === "ADMIN";
  if (s.hostId !== authId(req) && !isAdmin)
    throw Object.assign(new Error("Bạn không phải host của phiên."), {
      status: 403,
      code: "FORBIDDEN",
    });
  return s;
}

function seededShuffle<T>(values: T[], seed: string) {
  let state = [...seed].reduce(
    (sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0,
    2166136261,
  );
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const j = state % (i + 1);
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

async function sessionQuestions(session: GameSession) {
  const questions = await listQuestions(session.quizId);
  if (!session.questionOrder?.length) return questions;
  const byId = new Map(questions.map((question) => [question.id, question]));
  return session.questionOrder
    .map((id) => byId.get(id))
    .filter((question): question is Question => Boolean(question));
}

const publicQuestion = (
  q: Question,
  shuffleAnswers: boolean,
  seed: string,
) => ({
  id: q.id,
  type: q.type,
  prompt: q.prompt,
  options: shuffleAnswers ? seededShuffle(q.options, seed) : q.options,
  timeLimitSec: q.timeLimitSec,
  order: q.order,
});
type SnapshotViewer = "host" | "player" | "public";
async function gameSnapshot(
  sessionId: string,
  playerId?: string,
  viewer: SnapshotViewer = "public",
) {
  const [session, players, leaderboard, teams] = await Promise.all([
    getSession(sessionId),
    listPlayers(sessionId),
    getLeaderboard(sessionId, 10),
    getTeamLeaderboard(sessionId),
  ]);
  if (!session) return null;
  const quiz = await getQuiz(session.quizId);
  const questions = await sessionQuestions(session);
  const current = questions[session.currentQuestionIndex];
  const activePhase =
    session.state === "PAUSED" ? session.pausedState : session.state;
  const isResultPhase = activePhase === "QUESTION_RESULT";
  const canSeeRanks =
    session.state === "ENDED" ||
    (isResultPhase && (viewer === "host" || !session.settings.hideLeaderboard));
  return {
    session,
    quiz: quiz
      ? {
          id: quiz.id,
          title: quiz.title,
          description: quiz.description,
          category: quiz.category,
        }
      : null,
    playerCount: players.length,
    players: players.map(({ id, nickname, avatar, country, team, online }) => ({
      id,
      nickname,
      avatar,
      country:
        viewer === "host" || !session.settings.hideCountryFlags ? country : "",
      team,
      online,
    })),
    leaderboard: canSeeRanks ? leaderboard : [],
    teamLeaderboard: canSeeRanks ? teams : [],
    currentQuestion:
      current &&
      !["LOBBY", "GAME_COUNTDOWN", "ENDED", "CANCELLED"].includes(session.state)
        ? publicQuestion(
            current,
            Boolean(quiz?.settings.shuffleAnswers),
            `${session.id}:${current.id}`,
          )
        : null,
    revealedQuestion:
      current && isResultPhase
        ? {
            correctOptionId: current.correctOptionId,
            acceptedAnswers: current.acceptedAnswers,
            explanation: current.explanation,
          }
        : null,
    selfRank:
      playerId && canSeeRanks ? await getPlayerRank(sessionId, playerId) : null,
  };
}

async function emitSnapshot(event: string, sessionId: string) {
  const players = await listPlayers(sessionId);
  const [hostSnapshot, ...playerSnapshots] = await Promise.all([
    gameSnapshot(sessionId, undefined, "host"),
    ...players.map((player) => gameSnapshot(sessionId, player.id, "player")),
  ]);
  io.to(`host:${sessionId}`).emit(event, hostSnapshot);
  players.forEach((player, index) => {
    io.to(`player:${player.id}`).emit(event, playerSnapshots[index]);
  });
}

const GAME_COUNTDOWN_MS = 4_000;
const QUESTION_PREVIEW_MS = 5_000;
const QUESTION_RESULT_MS = 5_000;
const phaseTimers = new Map<string, ReturnType<typeof setTimeout>>();

function clearPhaseTimer(sessionId: string) {
  const timer = phaseTimers.get(sessionId);
  if (timer) clearTimeout(timer);
  phaseTimers.delete(sessionId);
}

async function withPhaseLock<T>(
  sessionId: string,
  operation: () => Promise<T>,
): Promise<T | null> {
  const token = nanoid(12);
  const acquired = await redis.set(
    keys.phaseLock(sessionId),
    token,
    "PX",
    5_000,
    "NX",
  );
  if (acquired !== "OK") return null;
  try {
    return await operation();
  } finally {
    await redis.eval(
      "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end",
      1,
      keys.phaseLock(sessionId),
      token,
    );
  }
}

function phaseDurationMs(session: GameSession, question: Question) {
  const phase =
    session.state === "PAUSED" ? session.pausedState : session.state;
  if (phase === "GAME_COUNTDOWN") return GAME_COUNTDOWN_MS;
  if (phase === "QUESTION_PREVIEW") return QUESTION_PREVIEW_MS;
  if (phase === "QUESTION_RESULT") return QUESTION_RESULT_MS;
  return question.timeLimitSec * 1_000;
}

async function scheduleSessionPhase(
  sessionId: string,
  forcedRemainingMs?: number,
) {
  clearPhaseTimer(sessionId);
  const session = await getSession(sessionId);
  if (
    !session ||
    ![
      "GAME_COUNTDOWN",
      "QUESTION_PREVIEW",
      "RUNNING",
      "QUESTION_RESULT",
    ].includes(session.state)
  )
    return;
  const questions = await sessionQuestions(session);
  const question = questions[session.currentQuestionIndex];
  if (!question) return;
  const elapsed = Math.max(
    0,
    Date.now() - new Date(session.questionStartedAt).getTime(),
  );
  const remaining = Math.max(
    0,
    forcedRemainingMs ?? phaseDurationMs(session, question) - elapsed,
  );
  const timer = setTimeout(() => {
    phaseTimers.delete(sessionId);
    void advanceAutomaticPhase(sessionId);
  }, remaining);
  phaseTimers.set(sessionId, timer);
}

async function beginQuestionPreview(sessionId: string) {
  return withPhaseLock(sessionId, async () => {
    const session = await getSession(sessionId);
    if (session?.state !== "GAME_COUNTDOWN") return session;
    clearPhaseTimer(sessionId);
    const updated = await updateSession(sessionId, {
      state: "QUESTION_PREVIEW",
      questionStartedAt: new Date().toISOString(),
    });
    await emitSnapshot("question:preview", sessionId);
    await scheduleSessionPhase(sessionId);
    return updated;
  });
}

async function openCurrentQuestion(sessionId: string) {
  return withPhaseLock(sessionId, async () => {
    const session = await getSession(sessionId);
    if (session?.state !== "QUESTION_PREVIEW") return session;
    clearPhaseTimer(sessionId);
    const updated = await updateSession(sessionId, {
      state: "RUNNING",
      questionStartedAt: new Date().toISOString(),
    });
    await emitSnapshot("question:shown", sessionId);
    await scheduleSessionPhase(sessionId);
    return updated;
  });
}

async function revealCurrentQuestion(sessionId: string) {
  return withPhaseLock(sessionId, async () => {
    const session = await getSession(sessionId);
    if (session?.state !== "RUNNING") return session;
    clearPhaseTimer(sessionId);
    const questions = await sessionQuestions(session);
    const question = questions[session.currentQuestionIndex];
    if (!question) return session;
    const updated = await updateSession(sessionId, {
      state: "QUESTION_RESULT",
      questionStartedAt: new Date().toISOString(),
    });
    await emitSnapshot("question:revealed", sessionId);
    await scheduleSessionPhase(sessionId);
    return updated;
  });
}

async function moveToNextQuestion(sessionId: string) {
  return withPhaseLock(sessionId, async () => {
    const session = await getSession(sessionId);
    if (
      !session ||
      !["QUESTION_PREVIEW", "RUNNING", "QUESTION_RESULT", "PAUSED"].includes(
        session.state,
      )
    )
      return session;
    clearPhaseTimer(sessionId);
    const questions = await sessionQuestions(session);
    const next = session.currentQuestionIndex + 1;
    if (next >= questions.length) {
      const ended = await updateSession(sessionId, {
        state: "ENDED",
        endedAt: new Date().toISOString(),
      });
      await emitSnapshot("session:ended", sessionId);
      return ended;
    }
    const updated = await updateSession(sessionId, {
      state: "QUESTION_PREVIEW",
      currentQuestionIndex: next,
      questionStartedAt: new Date().toISOString(),
    });
    await emitSnapshot("question:preview", sessionId);
    await scheduleSessionPhase(sessionId);
    return updated;
  });
}

async function advanceAutomaticPhase(sessionId: string) {
  const session = await getSession(sessionId);
  if (session?.state === "GAME_COUNTDOWN")
    return beginQuestionPreview(sessionId);
  if (session?.state === "QUESTION_PREVIEW")
    return openCurrentQuestion(sessionId);
  if (session?.state === "RUNNING") return revealCurrentQuestion(sessionId);
  if (session?.state === "QUESTION_RESULT")
    return moveToNextQuestion(sessionId);
  return session;
}

app.get(
  "/api/health",
  asyncRoute(async (_req, res) => {
    const pong = await redis.ping();
    res.json({ status: "ok", redis: pong, at: new Date().toISOString() });
  }),
);
app.get("/api/meta/network", (req, res) => {
  const requestedPort = z.coerce
    .number()
    .int()
    .min(1)
    .max(65535)
    .safeParse(req.query.port);
  const webPort = requestedPort.success ? requestedPort.data : config.WEB_PORT;
  const addresses = Object.entries(networkInterfaces())
    .filter(
      ([name]) =>
        !/loopback|virtual|vmware|vethernet|wsl|docker|hyper-v/i.test(name),
    )
    .flatMap(([, entries]) => entries || [])
    .filter(
      (entry) =>
        entry.family === "IPv4" &&
        !entry.internal &&
        /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(entry.address),
    )
    .map((entry) => entry.address);
  const origins = [...new Set(addresses)].map(
    (address) => `http://${address}:${webPort}`,
  );
  const configured = config.PUBLIC_WEB_URL?.replace(/\/$/, "");
  res.json({
    preferredOrigin: configured || origins[0] || config.WEB_ORIGIN,
    origins,
    publicUrlConfigured: Boolean(configured),
  });
});

const registerSchema = z
  .object({
    displayName: z.string().trim().min(2).max(40),
    username: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9._-]{3,30}$/),
    email: z.string().email(),
    password: z.string().min(8).max(100),
    confirmPassword: z.string().min(8).max(100),
    verificationCode: z.string().regex(/^\d{6}$/),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Mật khẩu xác nhận không khớp.",
    path: ["confirmPassword"],
  });

const verificationDigest = (purpose: string, email: string, code: string) =>
  createHash("sha256")
    .update(`${purpose}:${email.toLowerCase()}:${code}:${config.JWT_SECRET}`)
    .digest("hex");

async function issueEmailCode(email: string, purpose: "register" | "reset") {
  const cooldownKey = keys.emailCodeCooldown(purpose, email);
  const allowed = await redis.set(cooldownKey, "1", "EX", 60, "NX");
  if (!allowed)
    throw Object.assign(
      new Error("Vui lòng chờ 60 giây trước khi gửi lại mã."),
      {
        status: 429,
        code: "EMAIL_CODE_RATE_LIMITED",
      },
    );
  const code = String(randomInt(100000, 1000000));
  const ttl =
    purpose === "register"
      ? config.EMAIL_CODE_TTL_SECONDS
      : config.RESET_CODE_TTL_SECONDS;
  const codeKey =
    purpose === "register"
      ? keys.emailVerification(email)
      : keys.passwordReset(email);
  await redis.set(codeKey, verificationDigest(purpose, email, code), "EX", ttl);
  await redis.del(keys.emailCodeAttempts(purpose, email));
  let sent = false;
  try {
    sent = await sendVerificationCode(email, code, purpose);
  } catch (error) {
    await redis.del(codeKey, cooldownKey);
    throw error;
  }
  return {
    sent,
    expiresIn: ttl,
    ...(config.NODE_ENV !== "production" &&
    config.EMAIL_DEV_CODE_ENABLED &&
    !sent
      ? { devCode: code }
      : {}),
  };
}

app.get(
  "/api/auth/email-status",
  asyncRoute(async (_req, res) => {
    const configured = isSmtpConfigured();
    let ready = false;
    if (configured) {
      try {
        ready = await verifyMailConnection();
      } catch {
        ready = false;
      }
    }
    res.json({ configured, ready });
  }),
);

app.post(
  "/api/auth/email-verification/request",
  asyncRoute(async (req, res) => {
    const data = z
      .object({
        email: z.string().email(),
        username: z
          .string()
          .trim()
          .toLowerCase()
          .regex(/^[a-z0-9._-]{3,30}$/),
      })
      .parse(req.body);
    const email = data.email.toLowerCase();
    const [emailUser, usernameUser] = await Promise.all([
      getUserByEmail(email),
      getUserByUsername(data.username),
    ]);
    if (emailUser)
      throw Object.assign(new Error("Email đã được sử dụng."), {
        status: 409,
        code: "EMAIL_EXISTS",
      });
    if (usernameUser)
      throw Object.assign(new Error("Tên đăng nhập đã được sử dụng."), {
        status: 409,
        code: "USERNAME_EXISTS",
      });
    const result = await issueEmailCode(email, "register");
    res.json({
      ...result,
      message: result.sent
        ? "Mã xác nhận đã được gửi đến email."
        : "SMTP chưa được cấu hình; đang dùng mã phát triển.",
    });
  }),
);

app.post(
  "/api/auth/register",
  asyncRoute(async (req, res) => {
    const data = registerSchema.parse(req.body);
    const email = data.email.toLowerCase();
    const storedCode = await redis.get(keys.emailVerification(email));
    if (
      !storedCode ||
      storedCode !==
        verificationDigest("register", email, data.verificationCode)
    ) {
      const attemptsKey = keys.emailCodeAttempts("register", email);
      const attempts = await redis.incr(attemptsKey);
      if (attempts === 1)
        await redis.expire(attemptsKey, config.EMAIL_CODE_TTL_SECONDS);
      if (attempts >= 5)
        await redis.del(keys.emailVerification(email), attemptsKey);
      throw Object.assign(
        new Error("Mã xác nhận email không đúng hoặc đã hết hạn."),
        { status: 400, code: "EMAIL_CODE_INVALID" },
      );
    }
    const user: User = {
      id: nanoid(12),
      displayName: data.displayName,
      username: data.username,
      email,
      passwordHash: await bcrypt.hash(data.password, 12),
      rawPassword: data.password,
      role: "HOST",
      status: "ACTIVE",
      createdAt: new Date().toISOString(),
    };
    await createUser(user);
    await redis.del(
      keys.emailVerification(email),
      keys.emailCodeAttempts("register", email),
    );
    res.status(201).json({
      token: signHost({ sub: user.id, email: user.email, role: user.role }),
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      },
    });
  }),
);
app.post(
  "/api/auth/login",
  asyncRoute(async (req, res) => {
    const data = z
      .object({
        identifier: z.string().trim().min(3).optional(),
        email: z.string().trim().optional(),
        password: z.string().min(1),
      })
      .refine((value) => value.identifier || value.email, {
        message: "Hãy nhập email hoặc tên đăng nhập.",
      })
      .parse(req.body);
    const identifier = (data.identifier || data.email || "").toLowerCase();
    const attemptsKey = keys.loginAttempts(identifier);
    const attempts = Number((await redis.get(attemptsKey)) || 0);
    if (attempts >= 10)
      throw Object.assign(
        new Error("Quá nhiều lần đăng nhập sai. Vui lòng thử lại sau 15 phút."),
        { status: 429, code: "LOGIN_RATE_LIMITED" },
      );
    const user = identifier.includes("@")
      ? await getUserByEmail(identifier)
      : await getUserByUsername(identifier);
    if (!user || !(await bcrypt.compare(data.password, user.passwordHash))) {
      const failed = await redis.incr(attemptsKey);
      if (failed === 1) await redis.expire(attemptsKey, 15 * 60);
      throw Object.assign(
        new Error("Tên đăng nhập/email hoặc mật khẩu không đúng."),
        {
          status: 401,
          code: "LOGIN_FAILED",
        },
      );
    }
    if (user.status === "SUSPENDED")
      throw Object.assign(
        new Error("Tài khoản đã bị tạm khóa. Vui lòng liên hệ quản trị viên."),
        { status: 403, code: "ACCOUNT_SUSPENDED" },
      );
    await redis.del(attemptsKey);
    res.json({
      token: signHost({ sub: user.id, email: user.email, role: user.role }),
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      },
    });
  }),
);
app.post(
  "/api/auth/forgot-password",
  asyncRoute(async (req, res) => {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    const normalizedEmail = email.toLowerCase();
    const user = await getUserByEmail(normalizedEmail);
    let devCode: string | undefined;
    if (user) {
      const result = await issueEmailCode(normalizedEmail, "reset");
      devCode = result.devCode;
    }
    res.json({
      message:
        "Nếu email tồn tại, mã đặt lại đã được tạo và có hiệu lực 15 phút.",
      devCode,
    });
  }),
);
app.post(
  "/api/auth/reset-password",
  asyncRoute(async (req, res) => {
    const data = z
      .object({
        email: z.string().email(),
        code: z.string().regex(/^\d{6}$/),
        password: z.string().min(8).max(100),
        confirmPassword: z.string().min(8).max(100),
      })
      .refine((value) => value.password === value.confirmPassword, {
        message: "Mật khẩu xác nhận không khớp.",
        path: ["confirmPassword"],
      })
      .parse(req.body);
    const email = data.email.toLowerCase();
    const [stored, user] = await Promise.all([
      redis.get(keys.passwordReset(email)),
      getUserByEmail(email),
    ]);
    const digest = verificationDigest("reset", email, data.code);
    if (!stored || stored !== digest || !user) {
      const attemptsKey = keys.emailCodeAttempts("reset", email);
      const attempts = await redis.incr(attemptsKey);
      if (attempts === 1)
        await redis.expire(attemptsKey, config.RESET_CODE_TTL_SECONDS);
      if (attempts >= 5)
        await redis.del(keys.passwordReset(email), attemptsKey);
      throw Object.assign(new Error("Mã đặt lại không đúng hoặc đã hết hạn."), {
        status: 400,
        code: "RESET_CODE_INVALID",
      });
    }
    await redis
      .multi()
      .hset(keys.user(user.id), {
        passwordHash: await bcrypt.hash(data.password, 12),
        rawPassword: data.password,
      })
      .del(keys.passwordReset(email))
      .del(keys.emailCodeAttempts("reset", email))
      .exec();
    res.json({ message: "Mật khẩu đã được cập nhật." });
  }),
);
app.get(
  "/api/auth/me",
  requireHost,
  asyncRoute(async (req, res) => {
    const user = await getUser(authId(req));
    if (!user)
      throw Object.assign(new Error("Không tìm thấy tài khoản."), {
        status: 404,
      });
    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
    });
  }),
);
app.put(
  "/api/auth/me",
  requireHost,
  asyncRoute(async (req, res) => {
    const current = await getUser(authId(req));
    if (!current)
      throw Object.assign(new Error("Không tìm thấy tài khoản."), {
        status: 404,
      });
    const data = z
      .object({
        displayName: z.string().trim().min(2).max(40),
        username: z
          .string()
          .trim()
          .toLowerCase()
          .regex(/^[a-z0-9._-]{3,30}$/),
        currentPassword: z.string().max(100).optional().or(z.literal("")),
        password: z.string().min(8).max(100).optional().or(z.literal("")),
        confirmPassword: z.string().max(100).optional().or(z.literal("")),
      })
      .refine(
        (value) => !value.password || value.password === value.confirmPassword,
        {
          message: "Mật khẩu xác nhận không khớp.",
          path: ["confirmPassword"],
        },
      )
      .parse(req.body);
    if (
      data.password &&
      (!data.currentPassword ||
        !(await bcrypt.compare(data.currentPassword, current.passwordHash)))
    )
      throw Object.assign(new Error("Mật khẩu hiện tại không đúng."), {
        status: 400,
        code: "CURRENT_PASSWORD_INVALID",
      });
    const usernameOwner = await redis.get(keys.userUsername(data.username));
    if (usernameOwner && usernameOwner !== current.id)
      throw Object.assign(new Error("Tên đăng nhập đã được sử dụng."), {
        status: 409,
        code: "USERNAME_EXISTS",
      });
    const updated: User = {
      ...current,
      displayName: data.displayName,
      username: data.username,
      passwordHash: data.password
        ? await bcrypt.hash(data.password, 12)
        : current.passwordHash,
      rawPassword: data.password ? data.password : current.rawPassword,
    };
    const tx = redis.multi().hset(keys.user(updated.id), {
      displayName: updated.displayName,
      username: updated.username || "",
      passwordHash: updated.passwordHash,
      rawPassword: updated.rawPassword,
    });
    if (current.username && current.username !== updated.username)
      tx.del(keys.userUsername(current.username));
    if (updated.username)
      tx.set(keys.userUsername(updated.username), updated.id);
    await tx.exec();
    res.json({
      id: updated.id,
      username: updated.username,
      email: updated.email,
      displayName: updated.displayName,
      role: updated.role,
    });
  }),
);

async function currentAdmin(req: Request) {
  const user = await getUser(authId(req));
  if (!user || user.role !== "ADMIN" || user.status === "SUSPENDED")
    throw Object.assign(new Error("Tài khoản không còn quyền quản trị viên."), {
      status: 403,
      code: "ADMIN_REQUIRED",
    });
  return user;
}

function publicAdminUser(user: User) {
  return {
    id: user.id,
    username: user.username || "",
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    status: user.status || "ACTIVE",
    createdAt: user.createdAt,
    rawPassword: user.rawPassword || "",
  };
}

async function sessionAdminRow(session: GameSession) {
  const [quiz, host, playerCount] = await Promise.all([
    getQuiz(session.quizId),
    getUser(session.hostId),
    redis.scard(keys.sessionPlayers(session.id)),
  ]);
  return {
    ...session,
    quiz: quiz
      ? { id: quiz.id, title: quiz.title, category: quiz.category }
      : null,
    host: host
      ? {
          id: host.id,
          displayName: host.displayName,
          username: host.username || "",
          email: host.email,
        }
      : null,
    playerCount,
  };
}

function streamFields(values: string[]) {
  const result: Record<string, string> = {};
  for (let index = 0; index < values.length; index += 2)
    result[values[index]!] = values[index + 1] || "";
  return result;
}

function redisInfoValue(info: string, field: string) {
  const line = info.split("\n").find((entry) => entry.startsWith(`${field}:`));
  return line?.slice(field.length + 1).trim() || "";
}

async function namespaceStats() {
  let cursor = "0";
  const typeCounts: Record<string, number> = {};
  let keyCount = 0;
  do {
    const [nextCursor, found] = await redis.scan(
      cursor,
      "MATCH",
      `${config.REDIS_PREFIX}:*`,
      "COUNT",
      500,
    );
    cursor = nextCursor;
    keyCount += found.length;
    if (found.length) {
      const pipeline = redis.pipeline();
      found.forEach((redisKey) => pipeline.type(redisKey));
      const rows = await pipeline.exec();
      for (const [, value] of rows || []) {
        const type = String(value || "unknown");
        typeCounts[type] = (typeCounts[type] || 0) + 1;
      }
    }
  } while (cursor !== "0");
  return { keyCount, typeCounts };
}

app.get(
  "/api/admin/overview",
  requireAdmin,
  asyncRoute(async (req, res) => {
    await currentAdmin(req);
    const [users, sessions, quizIds] = await Promise.all([
      listUsers(),
      listSessions(),
      redis.smembers(keys.quizzes),
    ]);
    const questionPipeline = redis.pipeline();
    quizIds.forEach((id) => questionPipeline.llen(keys.quizQuestions(id)));
    const playerPipeline = redis.pipeline();
    sessions.forEach((session) => {
      playerPipeline.scard(keys.sessionPlayers(session.id));
      playerPipeline.scard(keys.answers(session.id));
    });
    const [questionRows, playerRows, publicQuizCount] = await Promise.all([
      questionPipeline.exec(),
      playerPipeline.exec(),
      redis.zcard(keys.publicQuizzes),
    ]);
    const questionCount = (questionRows || []).reduce(
      (sum, [, value]) => sum + Number(value || 0),
      0,
    );
    let playerCount = 0;
    let answerCount = 0;
    for (let index = 0; index < (playerRows || []).length; index += 2) {
      playerCount += Number(playerRows?.[index]?.[1] || 0);
      answerCount += Number(playerRows?.[index + 1]?.[1] || 0);
    }
    const activeSessions = sessions.filter(
      (session) => !["ENDED", "CANCELLED"].includes(session.state),
    );
    res.json({
      stats: {
        users: users.length,
        admins: users.filter((user) => user.role === "ADMIN").length,
        quizzes: quizIds.length,
        publicQuizzes: publicQuizCount,
        questions: questionCount,
        sessions: sessions.length,
        activeSessions: activeSessions.length,
        players: playerCount,
        answers: answerCount,
      },
      recentUsers: users.slice(0, 6).map(publicAdminUser),
      recentSessions: await Promise.all(
        sessions.slice(0, 6).map(sessionAdminRow),
      ),
    });
  }),
);

app.post(
  "/api/admin/users",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const admin = await currentAdmin(req);
    const data = z
      .object({
        displayName: z.string().trim().min(1).max(50),
        username: z
          .string()
          .trim()
          .toLowerCase()
          .regex(/^[a-z0-9._-]{3,30}$/),
        email: z.string().trim().toLowerCase().email(),
        password: z.string().min(1).max(100),
        role: z.enum(["HOST", "ADMIN"]),
      })
      .parse(req.body);

    const [existingEmail, existingUsername] = await Promise.all([
      redis.get(keys.userEmail(data.email)),
      redis.get(keys.userUsername(data.username)),
    ]);

    if (existingEmail)
      throw Object.assign(new Error("Địa chỉ email đã được sử dụng."), {
        status: 409,
        code: "EMAIL_EXISTS",
      });
    if (existingUsername)
      throw Object.assign(new Error("Tên đăng nhập đã được sử dụng."), {
        status: 409,
        code: "USERNAME_EXISTS",
      });

    const user: User = {
      id: customAlphabet(
        "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
        12,
      )(),
      displayName: data.displayName,
      username: data.username,
      email: data.email,
      passwordHash: await bcrypt.hash(data.password, 12),
      rawPassword: data.password,
      role: data.role,
      status: "ACTIVE",
      createdAt: new Date().toISOString(),
    };

    await redis
      .multi()
      .hset(keys.user(user.id), user)
      .set(keys.userEmail(data.email), user.id)
      .set(keys.userUsername(data.username), user.id)
      .sadd(keys.users, user.id)
      .xadd(
        keys.adminEvents,
        "MAXLEN",
        "~",
        2000,
        "*",
        "type",
        "USER_CREATED",
        "adminId",
        admin.id,
        "targetId",
        user.id,
        "role",
        user.role,
        "at",
        new Date().toISOString(),
      )
      .exec();

    res.json(publicAdminUser(user));
  }),
);

app.get(
  "/api/admin/users",
  requireAdmin,
  asyncRoute(async (req, res) => {
    await currentAdmin(req);
    const query = String(req.query.q || "")
      .trim()
      .toLocaleLowerCase("vi-VN");
    const role = z
      .enum(["ALL", "HOST", "ADMIN"])
      .default("ALL")
      .parse(String(req.query.role || "ALL"));
    const [users, sessions] = await Promise.all([listUsers(), listSessions()]);
    const quizPipeline = redis.pipeline();
    users.forEach((user) => quizPipeline.scard(keys.userQuizzes(user.id)));
    const quizCounts = await quizPipeline.exec();
    const rows = users.map((user, index) => ({
      ...publicAdminUser(user),
      quizCount: Number(quizCounts?.[index]?.[1] || 0),
      sessionCount: sessions.filter((session) => session.hostId === user.id)
        .length,
    }));
    res.json(
      rows.filter(
        (user) =>
          (role === "ALL" || user.role === role) &&
          (!query ||
            `${user.displayName} ${user.username} ${user.email}`
              .toLocaleLowerCase("vi-VN")
              .includes(query)),
      ),
    );
  }),
);

app.patch(
  "/api/admin/users/:id",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const admin = await currentAdmin(req);
    const target = await getUser(req.params.id);
    if (!target)
      throw Object.assign(new Error("Không tìm thấy người dùng."), {
        status: 404,
      });
    const patch = z
      .object({
        role: z.enum(["HOST", "ADMIN"]).optional(),
        status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
      })
      .refine((value) => value.role || value.status, {
        message: "Không có thay đổi cần lưu.",
      })
      .parse(req.body);
    const nextRole = patch.role || target.role;
    const nextStatus = patch.status || target.status || "ACTIVE";
    if (
      target.id === admin.id &&
      (nextRole !== "ADMIN" || nextStatus !== "ACTIVE")
    )
      throw Object.assign(
        new Error("Bạn không thể tự hạ quyền hoặc khóa tài khoản của mình."),
        { status: 409, code: "ADMIN_SELF_PROTECTED" },
      );
    if (
      target.role === "ADMIN" &&
      (nextRole !== "ADMIN" || nextStatus === "SUSPENDED")
    ) {
      const users = await listUsers();
      const activeAdmins = users.filter(
        (user) =>
          user.role === "ADMIN" && (user.status || "ACTIVE") === "ACTIVE",
      );
      if (activeAdmins.length <= 1)
        throw Object.assign(
          new Error("Hệ thống phải còn ít nhất một quản trị viên hoạt động."),
          { status: 409, code: "LAST_ADMIN_PROTECTED" },
        );
    }
    await redis
      .multi()
      .hset(keys.user(target.id), { role: nextRole, status: nextStatus })
      .xadd(
        keys.adminEvents,
        "MAXLEN",
        "~",
        2000,
        "*",
        "type",
        "USER_UPDATED",
        "adminId",
        admin.id,
        "targetId",
        target.id,
        "role",
        nextRole,
        "status",
        nextStatus,
        "at",
        new Date().toISOString(),
      )
      .exec();
    res.json(
      publicAdminUser({
        ...target,
        role: nextRole,
        status: nextStatus,
      }),
    );
  }),
);

app.put(
  "/api/admin/users/:id/reset-password",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const admin = await currentAdmin(req);
    const target = await getUser(req.params.id);
    if (!target)
      throw Object.assign(new Error("Người dùng không tồn tại."), {
        status: 404,
      });

    const data = z
      .object({
        newPassword: z.string().min(1),
      })
      .parse(req.body);

    if (admin.id === target.id) {
      throw Object.assign(
        new Error(
          "Vui lòng sử dụng chức năng Đổi mật khẩu trong Cài đặt hồ sơ thay vì thao tác này.",
        ),
        { status: 409, code: "ADMIN_SELF_PROTECTED" },
      );
    }

    const passwordHash = await bcrypt.hash(data.newPassword, 12);

    await redis
      .multi()
      .hset(keys.user(target.id), { passwordHash, rawPassword: data.newPassword })
      .xadd(
        keys.adminEvents,
        "MAXLEN",
        "~",
        2000,
        "*",
        "type",
        "USER_PASSWORD_RESET",
        "adminId",
        admin.id,
        "targetId",
        target.id,
        "at",
        new Date().toISOString(),
      )
      .exec();

    res.json({ message: "Đã đặt lại mật khẩu thành công." });
  }),
);

app.get(
  "/api/admin/sessions",
  requireAdmin,
  asyncRoute(async (req, res) => {
    await currentAdmin(req);
    const state = String(req.query.state || "ALL");
    const sessions = await listSessions();
    const filtered = sessions.filter(
      (session) => state === "ALL" || session.state === state,
    );
    res.json(await Promise.all(filtered.map(sessionAdminRow)));
  }),
);

app.get(
  "/api/admin/activity",
  requireAdmin,
  asyncRoute(async (req, res) => {
    await currentAdmin(req);
    const limit = z.coerce
      .number()
      .int()
      .min(10)
      .max(200)
      .default(80)
      .parse(req.query.limit);
    const sessions = await listSessions();
    const recentSessions = sessions.slice(0, 40);
    const eventRows = await Promise.all(
      recentSessions.map(async (session) => ({
        session,
        rows: await redis.xrevrange(
          keys.events(session.id),
          "+",
          "-",
          "COUNT",
          Math.min(30, limit),
        ),
      })),
    );
    const adminRows = await redis.xrevrange(
      keys.adminEvents,
      "+",
      "-",
      "COUNT",
      limit,
    );
    const activity = eventRows.flatMap(({ session, rows }) =>
      rows.map(([id, values]) => {
        const fields = streamFields(values);
        return {
          id: `${session.id}:${id}`,
          scope: "SESSION",
          sessionId: session.id,
          type: fields.type || "UNKNOWN",
          at: fields.at || new Date(Number(id.split("-")[0])).toISOString(),
          details: fields,
        };
      }),
    );
    activity.push(
      ...adminRows.map(([id, values]) => {
        const fields = streamFields(values);
        return {
          id: `admin:${id}`,
          scope: "ADMIN",
          sessionId: "",
          type: fields.type || "UNKNOWN",
          at: fields.at || new Date(Number(id.split("-")[0])).toISOString(),
          details: fields,
        };
      }),
    );
    activity.sort((a, b) => b.at.localeCompare(a.at));
    res.json(activity.slice(0, limit));
  }),
);

app.get(
  "/api/admin/system",
  requireAdmin,
  asyncRoute(async (req, res) => {
    await currentAdmin(req);
    const [serverInfo, memoryInfo, clientsInfo, statsInfo, keyStats, dbSize] =
      await Promise.all([
        redis.info("server"),
        redis.info("memory"),
        redis.info("clients"),
        redis.info("stats"),
        namespaceStats(),
        redis.dbsize(),
      ]);
    res.json({
      redis: {
        version: redisInfoValue(serverInfo, "redis_version"),
        mode: redisInfoValue(serverInfo, "redis_mode"),
        uptimeSeconds: Number(
          redisInfoValue(serverInfo, "uptime_in_seconds") || 0,
        ),
        usedMemory: redisInfoValue(memoryInfo, "used_memory_human"),
        peakMemory: redisInfoValue(memoryInfo, "used_memory_peak_human"),
        connectedClients: Number(
          redisInfoValue(clientsInfo, "connected_clients") || 0,
        ),
        totalCommands: Number(
          redisInfoValue(statsInfo, "total_commands_processed") || 0,
        ),
      },
      namespace: config.REDIS_PREFIX,
      namespaceKeys: keyStats.keyCount,
      totalDatabaseKeys: dbSize,
      typeCounts: keyStats.typeCounts,
      checkedAt: new Date().toISOString(),
    });
  }),
);

const quizInput = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().max(500).default(""),
  category: z.string().min(2).max(50).default("Trivia"),
  subcategory: z.string().max(60).default("General"),
  popularity: z.number().int().min(0).max(100).default(50),
  coverColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .default("#2B9FBD"),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).default("DRAFT"),
  settings: z
    .object({
      shuffleQuestions: z.boolean().default(false),
      shuffleAnswers: z.boolean().default(false),
      showLeaderboard: z.boolean().default(true),
      speedScoring: z.boolean().default(true),
    })
    .default({
      shuffleQuestions: false,
      shuffleAnswers: false,
      showLeaderboard: true,
      speedScoring: true,
    }),
});
app.get(
  "/api/quizzes",
  optionalAuth,
  asyncRoute(async (req, res) => {
    const owner =
      req.query.mine && req.auth?.kind === "host" ? req.auth.sub : undefined;
    const options = z
      .object({
        q: z.string().trim().max(120).optional(),
        category: z.string().trim().max(50).optional(),
        offset: z.coerce.number().int().min(0).default(0),
        limit: z.coerce.number().int().min(1).max(100).default(100),
      })
      .parse(req.query);
    res.json(
      await listQuizzes(owner, {
        query: options.q,
        category: options.category,
        offset: options.offset,
        limit: options.limit,
      }),
    );
  }),
);
app.get(
  "/api/quizzes/:id",
  optionalAuth,
  asyncRoute(async (req, res) => {
    const quiz = await getQuiz(req.params.id);
    if (!quiz)
      throw Object.assign(new Error("Không tìm thấy quiz."), {
        status: 404,
        code: "QUIZ_NOT_FOUND",
      });
    const editorRequested = req.query.editor === "1";
    const canEdit =
      req.auth?.kind === "host" &&
      (req.auth.role === "ADMIN" || req.auth.sub === quiz.ownerId);
    if (quiz.status !== "PUBLISHED" && !canEdit)
      throw Object.assign(new Error("Không tìm thấy quiz công khai."), {
        status: 404,
        code: "QUIZ_NOT_FOUND",
      });
    if (editorRequested && !canEdit)
      throw Object.assign(
        new Error("Bạn không có quyền xem đáp án của quiz này."),
        { status: 403, code: "FORBIDDEN" },
      );
    const questions = await listQuestions(quiz.id);
    res.json({
      quiz: canEdit ? quiz : { ...quiz, ownerId: "" },
      questions: questions.map((q) => ({
        ...q,
        correctOptionId: canEdit && editorRequested ? q.correctOptionId : "",
        acceptedAnswers: canEdit && editorRequested ? q.acceptedAnswers : [],
        explanation: canEdit && editorRequested ? q.explanation : "",
      })),
    });
  }),
);
app.post(
  "/api/quizzes/:id/practice/:questionId/check",
  asyncRoute(async (req, res) => {
    const [quiz, question] = await Promise.all([
      getQuiz(req.params.id),
      getQuestion(req.params.questionId),
    ]);
    if (
      !quiz ||
      quiz.status !== "PUBLISHED" ||
      !question ||
      question.quizId !== quiz.id
    )
      throw Object.assign(new Error("Không tìm thấy câu hỏi luyện tập."), {
        status: 404,
      });
    const { answer } = z
      .object({ answer: z.string().max(300) })
      .parse(req.body);
    const correct =
      question.type === "TEXT"
        ? question.acceptedAnswers.some(
            (item) => normalizeText(item) === normalizeText(answer),
          )
        : question.correctOptionId === answer;
    res.json({
      correct,
      correctOptionId: question.correctOptionId,
      correctAnswer:
        question.type === "TEXT"
          ? question.acceptedAnswers[0] || ""
          : question.options.find(
              (option) => option.id === question.correctOptionId,
            )?.text || "",
      explanation: question.explanation,
    });
  }),
);
app.post(
  "/api/quizzes",
  requireHost,
  asyncRoute(async (req, res) => {
    const data = quizInput.parse(req.body);
    if (data.status === "PUBLISHED")
      throw Object.assign(
        new Error("Hãy tạo và kiểm tra câu hỏi trước khi xuất bản quiz."),
        { status: 400, code: "QUIZ_INVALID" },
      );
    const now = new Date().toISOString();
    const quiz: Quiz = {
      id: nanoid(12),
      ownerId: authId(req),
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    await saveQuiz(quiz);
    res.status(201).json(quiz);
  }),
);
app.put(
  "/api/quizzes/:id",
  requireHost,
  asyncRoute(async (req, res) => {
    const current = await ownedQuiz(req, req.params.id);
    const data = quizInput.partial().parse(req.body);
    const quiz = { ...current, ...data, updatedAt: new Date().toISOString() };
    if (quiz.status === "PUBLISHED") await assertQuizPublishable(quiz.id);
    await saveQuiz(quiz);
    res.json(quiz);
  }),
);
app.delete(
  "/api/quizzes/:id",
  requireHost,
  asyncRoute(async (req, res) => {
    await ownedQuiz(req, req.params.id);
    await deleteQuiz(req.params.id);
    res.status(204).end();
  }),
);
app.post(
  "/api/quizzes/:id/clone",
  requireHost,
  asyncRoute(async (req, res) => {
    const source = await hostableQuiz(req, req.params.id);
    const now = new Date().toISOString();
    const quiz: Quiz = {
      ...source,
      id: nanoid(12),
      ownerId: authId(req),
      title: `${source.title} (bản sao)`,
      status: "DRAFT",
      createdAt: now,
      updatedAt: now,
    };
    await saveQuiz(quiz);
    try {
      const qs = await listQuestions(source.id);
      for (const q of qs)
        await saveQuestion({ ...q, id: nanoid(12), quizId: quiz.id });
    } catch (error) {
      await deleteQuiz(quiz.id);
      throw error;
    }
    res.status(201).json(quiz);
  }),
);

app.get(
  "/api/ai/status",
  requireHost,
  asyncRoute(async (_req, res) => res.json(await getOllamaStatus())),
);
app.get("/api/ai/csv-template", (_req, res) => {
  res
    .status(200)
    .type("text/csv")
    .setHeader(
      "Content-Disposition",
      'attachment; filename="rankrush-quiz-template.csv"',
    )
    .send(`\uFEFF${quizCsvTemplate}`);
});
app.post(
  "/api/ai/generate-quiz",
  requireHost,
  quizSourceUpload.single("file"),
  asyncRoute(async (req, res) => {
    const input = z
      .object({
        subject: z.string().trim().max(160).default(""),
        context: z.string().trim().max(30_000).default(""),
        sourceText: z.string().trim().max(30_000).default(""),
        title: z.string().trim().max(120).default(""),
        category: z.string().trim().max(50).default("Giáo dục"),
        questionCount: z.coerce.number().int().min(3).max(15).default(5),
        timeLimitSec: z.coerce.number().int().min(5).max(300).default(20),
        basePoints: z.coerce.number().int().min(100).max(5000).default(600),
        language: z.enum(["vi", "en"]).default("vi"),
        difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).default("MEDIUM"),
      })
      .parse(req.body);
    if (!input.subject && !input.context && !input.sourceText && !req.file)
      throw Object.assign(
        new Error("Hãy nhập chủ đề, nội dung tham khảo hoặc tải lên một PDF."),
        {
          status: 400,
          code: "GENERATOR_SOURCE_REQUIRED",
        },
      );

    let sourceText = input.sourceText || input.context || "";
    const extension = path.extname(req.file?.originalname || "").toLowerCase();
    const isCsv = extension === ".csv";
    if (req.file && !isCsv) {
      const parser = new PDFParse({ data: req.file.buffer });
      try {
        sourceText = (await parser.getText()).text;
      } finally {
        await parser.destroy();
      }
      if (sourceText.trim().length < 80)
        throw Object.assign(
          new Error("PDF không có đủ văn bản có thể đọc để tạo câu hỏi."),
          { status: 400, code: "PDF_TEXT_EMPTY" },
        );
    } else if (req.file) {
      sourceText = req.file.buffer.toString("utf8");
    }

    const subject =
      input.subject ||
      req.file?.originalname.replace(/\.(pdf|csv)$/i, "") ||
      "Quiz tự động";
    const generation = isCsv
      ? {
          questions: importQuizQuestionsFromCsv(sourceText),
          provider: "CSV" as const,
          model: "",
        }
      : await generateQuizQuestionsSmart({
          subject,
          context: input.context,
          sourceText,
          count: input.questionCount,
          language: input.language,
          difficulty: input.difficulty,
          requireAi: false,
        }).catch((error) => {
          throw Object.assign(
            new Error(
              req.file
                ? "AI chưa sẵn sàng để đọc PDF. Hãy khởi động AI cục bộ hoặc tải tệp CSV theo mẫu."
                : "AI chưa sẵn sàng để tạo câu hỏi. Hãy khởi động AI cục bộ hoặc nhập câu hỏi bằng CSV.",
            ),
            {
              status: 503,
              code: req.file
                ? "AI_DOCUMENT_UNAVAILABLE"
                : "AI_GENERATOR_UNAVAILABLE",
              cause: error,
            },
          );
        });
    const generated = generation.questions;
    const now = new Date().toISOString();
    const quiz: Quiz = {
      id: nanoid(12),
      ownerId: authId(req),
      title: input.title || subject,
      description:
        input.context ||
        (req.file
          ? `Được tạo từ tệp ${req.file.originalname}. Hãy rà soát câu hỏi và đáp án trước khi xuất bản.`
          : `Được tạo tự động từ chủ đề “${subject}”. Hãy rà soát câu hỏi và đáp án trước khi xuất bản.`),
      category: input.category,
      coverColor: "#2B9FBD",
      status: "DRAFT",
      settings: {
        shuffleQuestions: false,
        shuffleAnswers: false,
        showLeaderboard: true,
        speedScoring: true,
      },
      createdAt: now,
      updatedAt: now,
    };
    await saveQuiz(quiz);
    try {
      for (const question of generated)
        await saveQuestion({
          ...question,
          id: nanoid(12),
          quizId: quiz.id,
          timeLimitSec: input.timeLimitSec,
          basePoints: input.basePoints,
        });
    } catch (error) {
      await deleteQuiz(quiz.id);
      throw error;
    }
    res.status(201).json({
      quiz,
      questionCount: generated.length,
      source: isCsv ? "CSV" : req.file ? "PDF" : "SUBJECT",
      provider: generation.provider,
      model: generation.model,
      warning: "warning" in generation ? generation.warning : undefined,
    });
  }),
);

const questionBaseInput = z.object({
  type: z.enum(["SINGLE_CHOICE", "TRUE_FALSE", "TEXT"]),
  prompt: z.string().trim().min(3).max(500),
  options: z
    .array(
      z.object({ id: z.string(), text: z.string().trim().min(1).max(200) }),
    )
    .max(6)
    .default([]),
  correctOptionId: z.string().default(""),
  acceptedAnswers: z
    .array(z.string().trim().min(1).max(300))
    .max(20)
    .default([]),
  timeLimitSec: z.number().int().min(5).max(300).default(20),
  basePoints: z.number().int().min(100).max(5000).default(600),
  order: z.number().int().min(0).default(0),
  explanation: z.string().max(500).default(""),
});
const questionInput = questionBaseInput.superRefine((question, context) => {
  const optionIds = question.options.map((option) => option.id);
  if (new Set(optionIds).size !== optionIds.length)
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["options"],
      message: "Mã lựa chọn không được trùng nhau.",
    });
  if (question.type === "TEXT") {
    if (!question.acceptedAnswers.length)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["acceptedAnswers"],
        message: "Câu hỏi văn bản phải có ít nhất một đáp án được chấp nhận.",
      });
    return;
  }
  if (question.options.length < 2)
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["options"],
      message: "Câu hỏi lựa chọn phải có ít nhất hai phương án.",
    });
  if (!optionIds.includes(question.correctOptionId))
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["correctOptionId"],
      message: "Đáp án đúng phải thuộc danh sách lựa chọn.",
    });
  if (question.type === "TRUE_FALSE" && question.options.length !== 2)
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["options"],
      message: "Câu hỏi Đúng/Sai phải có đúng hai lựa chọn.",
    });
});

async function assertQuizPublishable(quizId: string) {
  const questions = await listQuestions(quizId);
  if (!questions.length)
    throw Object.assign(new Error("Quiz phải có ít nhất một câu hỏi."), {
      status: 400,
      code: "QUIZ_EMPTY",
    });
  const invalid = questions.find(
    (question) => !questionInput.safeParse(question).success,
  );
  if (invalid)
    throw Object.assign(
      new Error(`Câu hỏi “${invalid.prompt}” chưa có cấu hình đáp án hợp lệ.`),
      { status: 400, code: "QUIZ_INVALID" },
    );
}
app.post(
  "/api/quizzes/:id/questions",
  requireHost,
  asyncRoute(async (req, res) => {
    await ownedQuiz(req, req.params.id);
    const data = questionInput.parse(req.body);
    const question: Question = {
      id: nanoid(12),
      quizId: req.params.id,
      ...data,
    };
    await saveQuestion(question);
    res.status(201).json(question);
  }),
);
app.put(
  "/api/questions/:id",
  requireHost,
  asyncRoute(async (req, res) => {
    const current = await getQuestion(req.params.id);
    if (!current)
      throw Object.assign(new Error("Không tìm thấy câu hỏi."), {
        status: 404,
      });
    await ownedQuiz(req, current.quizId);
    const patch = questionBaseInput.partial().parse(req.body);
    const data = questionInput.parse({ ...current, ...patch });
    const question: Question = {
      id: current.id,
      quizId: current.quizId,
      ...data,
    };
    await saveQuestion(question);
    res.json(question);
  }),
);
app.delete(
  "/api/questions/:id",
  requireHost,
  asyncRoute(async (req, res) => {
    const q = await getQuestion(req.params.id);
    if (!q)
      throw Object.assign(new Error("Không tìm thấy câu hỏi."), {
        status: 404,
      });
    await ownedQuiz(req, q.quizId);
    await deleteQuestion(q.id);
    res.status(204).end();
  }),
);

const settingsSchema = z.object({
  autoAdvance: z.boolean().default(false),
  teamMode: z.boolean().default(false),
  hideLeaderboard: z.boolean().default(false),
  safeNames: z.boolean().default(true),
  hideCountryFlags: z.boolean().default(false),
  mutePlayers: z.boolean().default(false),
  speedScoring: z.boolean().default(true),
});
app.post(
  "/api/sessions",
  requireHost,
  asyncRoute(async (req, res) => {
    const data = z
      .object({
        quizId: z.string(),
        settings: settingsSchema.partial().optional(),
      })
      .parse(req.body);
    const quiz = await hostableQuiz(req, data.quizId);
    await assertQuizPublishable(quiz.id);
    const questions = await listQuestions(quiz.id);
    if (!questions.length)
      throw Object.assign(new Error("Quiz phải có ít nhất một câu hỏi."), {
        status: 400,
        code: "QUIZ_EMPTY",
      });
    const now = new Date().toISOString();
    const s = await createSession({
      id: nanoid(12),
      quizId: quiz.id,
      hostId: authId(req),
      state: "LOBBY",
      currentQuestionIndex: 0,
      questionStartedAt: "",
      questionOrder: (quiz.settings.shuffleQuestions
        ? seededShuffle(questions, nanoid(8))
        : questions
      ).map((question) => question.id),
      settings: settingsSchema.parse({
        autoAdvance: false,
        teamMode: false,
        hideLeaderboard: !quiz.settings.showLeaderboard,
        safeNames: true,
        hideCountryFlags: false,
        mutePlayers: false,
        speedScoring: quiz.settings.speedScoring,
        ...data.settings,
      }),
      createdAt: now,
      startedAt: "",
      endedAt: "",
    });
    res.status(201).json(s);
  }),
);
app.get(
  "/api/sessions",
  requireHost,
  asyncRoute(async (req, res) => {
    const sessions = await listSessions(authId(req));
    const rows = await Promise.all(
      sessions.map(async (session) => {
        const [quiz, playerCount, top] = await Promise.all([
          getQuiz(session.quizId),
          redis.scard(keys.sessionPlayers(session.id)),
          getLeaderboard(session.id, 3),
        ]);
        return {
          ...session,
          quiz: quiz
            ? { id: quiz.id, title: quiz.title, category: quiz.category }
            : null,
          playerCount,
          top,
        };
      }),
    );
    res.json(rows);
  }),
);
app.patch(
  "/api/sessions/:id/settings",
  requireHost,
  asyncRoute(async (req, res) => {
    const session = await ownedSession(req, req.params.id);
    if (session.state !== "LOBBY")
      throw Object.assign(
        new Error("Chỉ có thể đổi thiết lập khi phòng đang chờ."),
        { status: 409, code: "SETTINGS_LOCKED" },
      );
    const settings = settingsSchema.parse(req.body);
    const updated = await updateSession(session.id, { settings });
    await emitSnapshot("lobby:updated", session.id);
    res.json(updated);
  }),
);
app.get(
  "/api/sessions/pin/:pin",
  optionalAuth,
  asyncRoute(async (req, res) => {
    const s = await getSessionByPin(req.params.pin);
    if (!s)
      throw Object.assign(new Error("PIN không tồn tại hoặc đã hết hạn."), {
        status: 404,
        code: "PIN_NOT_FOUND",
      });
    const quiz = await getQuiz(s.quizId);
    res.json({
      session: { id: s.id, pin: s.pin, state: s.state, settings: s.settings },
      quiz: quiz
        ? {
            id: quiz.id,
            title: quiz.title,
            description: quiz.description,
            category: quiz.category,
          }
        : null,
      playerCount: await redis.scard(keys.sessionPlayers(s.id)),
      hostOwnsRoom:
        req.auth?.kind === "host" &&
        (req.auth.sub === s.hostId || req.auth.role === "ADMIN"),
    });
  }),
);
app.get(
  "/api/sessions/:id",
  asyncRoute(async (req, res) => {
    const token = req.headers.authorization?.slice(7);
    let pid: string | undefined;
    let viewer: SnapshotViewer = "public";
    try {
      const c = token ? verifyToken(token) : null;
      if (c?.kind === "player" && c.sessionId === req.params.id) {
        const player = await getPlayer(req.params.id, c.sub);
        if (player && !isUnsafeNickname(player.nickname)) {
          pid = c.sub;
          viewer = "player";
        } else if (player) {
          await removePlayer(req.params.id, player.id);
          io.to(`player:${player.id}`).emit("player:kicked");
        }
      }
      if (c?.kind === "host") {
        const session = await getSession(req.params.id);
        if (session?.hostId === c.sub || c.role === "ADMIN") viewer = "host";
      }
    } catch {}
    if (viewer === "public")
      throw Object.assign(new Error("Vui lòng đăng nhập để xem phiên chơi."), {
        status: 401,
        code: "UNAUTHORIZED",
      });
    const snap = await gameSnapshot(req.params.id, pid, viewer);
    if (!snap)
      throw Object.assign(new Error("Không tìm thấy phiên."), { status: 404 });
    if (
      [
        "GAME_COUNTDOWN",
        "QUESTION_PREVIEW",
        "RUNNING",
        "QUESTION_RESULT",
      ].includes(snap.session.state) &&
      !phaseTimers.has(req.params.id)
    )
      void scheduleSessionPhase(req.params.id);
    res.json(snap);
  }),
);
app.post(
  "/api/sessions/join",
  optionalAuth,
  asyncRoute(async (req, res) => {
    const data = z
      .object({
        pin: z.string().regex(/^\d{6}$/),
        nickname: z.string().trim().min(2).max(24),
        avatar: z.string().max(80).default("human|1|0|0|0"),
        country: z.string().max(4).default(""),
        team: z.string().max(30).default(""),
      })
      .parse(req.body);
    const s = await getSessionByPin(data.pin);
    if (!s)
      throw Object.assign(new Error("PIN không tồn tại hoặc đã hết hạn."), {
        status: 404,
        code: "PIN_NOT_FOUND",
      });
    if (
      req.auth?.kind === "host" &&
      (req.auth.sub === s.hostId || req.auth.role === "ADMIN")
    )
      throw Object.assign(
        new Error(
          "Host là người điều khiển phòng và không được tính như một người chơi trong chính phòng này.",
        ),
        { status: 409, code: "HOST_CANNOT_JOIN_OWN_SESSION" },
      );
    const player = await joinSession(s, data);
    const token = signPlayer({ sub: player.id, sessionId: s.id });
    await emitSnapshot("lobby:updated", s.id);
    res.status(201).json({ token, player, sessionId: s.id });
  }),
);
app.post(
  "/api/sessions/:id/start",
  requireHost,
  asyncRoute(async (req, res) => {
    const s = await ownedSession(req, req.params.id);
    if (s.state !== "LOBBY")
      throw Object.assign(new Error("Chỉ có thể bắt đầu từ lobby."), {
        status: 409,
      });
    if ((await redis.scard(keys.sessionPlayers(s.id))) === 0)
      throw Object.assign(new Error("Cần ít nhất một người chơi để bắt đầu."), {
        status: 409,
        code: "SESSION_EMPTY",
      });
    const now = new Date().toISOString();
    const updated = await updateSession(s.id, {
      state: "GAME_COUNTDOWN",
      currentQuestionIndex: 0,
      startedAt: now,
      questionStartedAt: now,
    });
    await emitSnapshot("session:started", s.id);
    await scheduleSessionPhase(s.id);
    res.json(updated);
  }),
);
app.post(
  "/api/sessions/:id/advance",
  requireHost,
  asyncRoute(async (req, res) => {
    const s = await ownedSession(req, req.params.id);
    if (s.state !== "QUESTION_RESULT")
      throw Object.assign(
        new Error("Đáp án được công bố tự động; chưa thể chuyển câu."),
        {
          status: 409,
          code: "AUTO_FLOW_ACTIVE",
        },
      );
    res.json(await moveToNextQuestion(s.id));
  }),
);
app.post(
  "/api/sessions/:id/skip",
  requireHost,
  asyncRoute(async (req, res) => {
    const s = await ownedSession(req, req.params.id);
    if (
      !["QUESTION_PREVIEW", "RUNNING", "QUESTION_RESULT", "PAUSED"].includes(
        s.state,
      )
    )
      throw Object.assign(new Error("Không thể bỏ qua câu hỏi lúc này."), {
        status: 409,
      });
    res.json(await moveToNextQuestion(s.id));
  }),
);
app.post(
  "/api/sessions/:id/pause",
  requireHost,
  asyncRoute(async (req, res) => {
    await ownedSession(req, req.params.id);
    const updated = await withPhaseLock(req.params.id, async () => {
      const s = await getSession(req.params.id);
      if (
        !s ||
        !["QUESTION_PREVIEW", "RUNNING", "QUESTION_RESULT"].includes(s.state)
      )
        throw Object.assign(new Error("Phiên không thể tạm dừng lúc này."), {
          status: 409,
        });
      const questions = await sessionQuestions(s);
      const q = questions[s.currentQuestionIndex];
      if (!q)
        throw Object.assign(new Error("Không có câu hỏi hiện tại."), {
          status: 409,
        });
      const elapsed = Math.max(
        0,
        Date.now() - new Date(s.questionStartedAt).getTime(),
      );
      const remaining = Math.max(0, phaseDurationMs(s, q) - elapsed);
      clearPhaseTimer(s.id);
      const paused = await updateSession(s.id, {
        state: "PAUSED",
        pausedState: s.state as
          "QUESTION_PREVIEW" | "RUNNING" | "QUESTION_RESULT",
        pausedRemainingMs: remaining,
      });
      await emitSnapshot("session:updated", s.id);
      return paused;
    });
    res.json(updated);
  }),
);
app.post(
  "/api/sessions/:id/resume",
  requireHost,
  asyncRoute(async (req, res) => {
    await ownedSession(req, req.params.id);
    const updated = await withPhaseLock(req.params.id, async () => {
      const s = await getSession(req.params.id);
      if (s?.state !== "PAUSED" || !s.pausedState)
        throw Object.assign(new Error("Phiên hiện không tạm dừng."), {
          status: 409,
        });
      const questions = await sessionQuestions(s);
      const q = questions[s.currentQuestionIndex];
      if (!q)
        throw Object.assign(new Error("Không có câu hỏi hiện tại."), {
          status: 409,
        });
      const total = phaseDurationMs(s, q);
      const remaining = Math.max(
        0,
        Math.min(total, s.pausedRemainingMs ?? total),
      );
      const resumed = await updateSession(s.id, {
        state: s.pausedState,
        questionStartedAt: new Date(
          Date.now() - (total - remaining),
        ).toISOString(),
        pausedRemainingMs: 0,
      });
      await emitSnapshot("session:updated", s.id);
      await scheduleSessionPhase(s.id, remaining);
      return resumed;
    });
    res.json(updated);
  }),
);
app.post(
  "/api/sessions/:id/open-question",
  requireHost,
  asyncRoute(async (req, res) => {
    const s = await ownedSession(req, req.params.id);
    if (s.state !== "QUESTION_PREVIEW")
      throw Object.assign(new Error("Câu hỏi không ở pha chuẩn bị."), {
        status: 409,
      });
    res.json(await openCurrentQuestion(s.id));
  }),
);
app.post(
  "/api/sessions/:id/end",
  requireHost,
  asyncRoute(async (req, res) => {
    const s = await ownedSession(req, req.params.id);
    if (s.state === "ENDED" || s.state === "CANCELLED")
      throw Object.assign(new Error("Phiên này đã kết thúc."), {
        status: 409,
        code: "SESSION_ENDED",
      });
    const updated = await updateSession(s.id, {
      state: "ENDED",
      endedAt: new Date().toISOString(),
    });
    clearPhaseTimer(s.id);
    await emitSnapshot("session:ended", s.id);
    res.json(updated);
  }),
);
app.post(
  "/api/sessions/:id/cancel",
  requireHost,
  asyncRoute(async (req, res) => {
    const session = await ownedSession(req, req.params.id);
    if (session.state !== "LOBBY")
      throw Object.assign(new Error("Chỉ có thể hủy phòng khi đang ở lobby."), {
        status: 409,
        code: "SESSION_NOT_CANCELLABLE",
      });
    const updated = await updateSession(session.id, {
      state: "CANCELLED",
      endedAt: new Date().toISOString(),
    });
    await emitSnapshot("session:ended", session.id);
    res.json(updated);
  }),
);
app.post(
  "/api/sessions/:id/replay",
  requireHost,
  asyncRoute(async (req, res) => {
    const previous = await ownedSession(req, req.params.id);
    if (previous.state !== "ENDED")
      throw Object.assign(new Error("Chỉ có thể chơi lại phiên đã kết thúc."), {
        status: 409,
        code: "SESSION_NOT_REPLAYABLE",
      });
    const quiz = await hostableQuiz(req, previous.quizId);
    await assertQuizPublishable(quiz.id);
    const questions = await listQuestions(quiz.id);
    const now = new Date().toISOString();
    const session = await createSession({
      id: nanoid(12),
      quizId: quiz.id,
      hostId: authId(req),
      state: "LOBBY",
      currentQuestionIndex: 0,
      questionStartedAt: "",
      questionOrder: (quiz.settings.shuffleQuestions
        ? seededShuffle(questions, nanoid(8))
        : questions
      ).map((question) => question.id),
      settings: settingsSchema.parse(previous.settings),
      createdAt: now,
      startedAt: "",
      endedAt: "",
    });
    res.status(201).json(session);
  }),
);
app.post(
  "/api/sessions/:id/kick/:playerId",
  requireHost,
  asyncRoute(async (req, res) => {
    const s = await ownedSession(req, req.params.id);
    if (s.state !== "LOBBY")
      throw Object.assign(new Error("Chỉ có thể loại người chơi ở lobby."), {
        status: 409,
      });
    await removePlayer(s.id, req.params.playerId);
    io.to(`player:${req.params.playerId}`).emit("player:kicked");
    await emitSnapshot("lobby:updated", s.id);
    res.status(204).end();
  }),
);

app.post(
  "/api/sessions/:id/answers",
  requirePlayer,
  asyncRoute(async (req, res) => {
    if (req.auth?.kind !== "player" || req.auth.sessionId !== req.params.id)
      throw Object.assign(new Error("Player token không thuộc phiên."), {
        status: 403,
      });
    const data = z
      .object({
        questionId: z.string(),
        answer: z.string().max(300),
        responseMs: z.number().int().min(0).max(300000).optional(),
      })
      .parse(req.body);
    const [s, player, q] = await Promise.all([
      getSession(req.params.id),
      getPlayer(req.params.id, req.auth.sub),
      getQuestion(data.questionId),
    ]);
    if (!s || !player || !q)
      throw Object.assign(new Error("Dữ liệu phiên không hợp lệ."), {
        status: 404,
      });
    if (s.state !== "RUNNING")
      throw Object.assign(new Error("Câu hỏi hiện không nhận đáp án."), {
        status: 409,
        code: "QUESTION_CLOSED",
      });
    const questions = await sessionQuestions(s);
    if (questions[s.currentQuestionIndex]?.id !== q.id)
      throw Object.assign(new Error("Không phải câu hỏi hiện tại."), {
        status: 409,
      });
    const elapsedMs = Date.now() - new Date(s.questionStartedAt).getTime();
    if (elapsedMs > q.timeLimitSec * 1000 + 1000)
      throw Object.assign(new Error("Đã hết thời gian trả lời câu hỏi."), {
        status: 409,
        code: "QUESTION_TIMEOUT",
      });
    const correct =
      q.type === "TEXT"
        ? q.acceptedAnswers.some(
            (x) => normalizeText(x) === normalizeText(data.answer),
          )
        : q.correctOptionId === data.answer;
    const serverResponseMs = Math.max(0, elapsedMs);
    const points = calculateScore(
      q.timeLimitSec,
      serverResponseMs,
      correct,
      s.currentQuestionIndex === questions.length - 1,
    );
    const saved = await submitAnswerAtomic({
      sessionId: s.id,
      playerId: player.id,
      questionId: q.id,
      selectedAnswer: data.answer,
      isCorrect: correct,
      responseMs: serverResponseMs,
      awardedPoints: points,
      team: player.team,
    });
    const answered = await countAnswersForQuestion(s.id, q.id);
    io.to(`player:${player.id}`).emit("answer:accepted", {
      created: saved.created,
      accepted: true,
    });
    const playerCount = await redis.scard(keys.sessionPlayers(s.id));
    io.to(`host:${s.id}`).emit("host:progress", {
      questionId: q.id,
      answered,
      playerCount,
    });
    res.json({ created: saved.created, accepted: true });
    if (saved.created && answered >= playerCount)
      void revealCurrentQuestion(s.id);
  }),
);
app.get(
  "/api/sessions/:id/result",
  requirePlayer,
  asyncRoute(async (req, res) => {
    if (req.auth?.kind !== "player" || req.auth.sessionId !== req.params.id)
      throw Object.assign(new Error("Player token không thuộc phiên."), {
        status: 403,
      });
    const session = await getSession(req.params.id);
    if (!session)
      throw Object.assign(new Error("Không tìm thấy phiên."), { status: 404 });
    if (session.state !== "ENDED")
      throw Object.assign(new Error("Kết quả chỉ có sau khi game kết thúc."), {
        status: 409,
      });
    res.json(await buildPlayerResult(req.params.id, req.auth.sub));
  }),
);
app.get(
  "/api/sessions/:id/leaderboard",
  optionalAuth,
  asyncRoute(async (req, res) => {
    const session = await getSession(req.params.id);
    if (!session)
      throw Object.assign(new Error("Không tìm thấy phiên."), { status: 404 });
    const hostCanSee =
      req.auth?.kind === "host" &&
      (req.auth.role === "ADMIN" || req.auth.sub === session.hostId);
    const playerCanSee =
      req.auth?.kind === "player" && req.auth.sessionId === session.id;
    if (!hostCanSee && !playerCanSee)
      throw Object.assign(
        new Error("Bạn không có quyền xem bảng xếp hạng này."),
        {
          status: 401,
          code: "UNAUTHORIZED",
        },
      );
    if (session.settings.hideLeaderboard && !hostCanSee) {
      res.json({ leaderboard: [], teamLeaderboard: [] });
      return;
    }
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
    res.json({
      leaderboard: await getLeaderboard(req.params.id, limit),
      teamLeaderboard: await getTeamLeaderboard(req.params.id),
    });
  }),
);
app.get(
  "/api/sessions/:id/report",
  requireHost,
  asyncRoute(async (req, res) => {
    await ownedSession(req, req.params.id);
    res.json(await buildReport(req.params.id));
  }),
);

io.use((socket, next) => {
  try {
    const token = String(socket.handshake.auth.token || "");
    socket.data.claims = token ? verifyToken(token) : null;
    next();
  } catch {
    next(new Error("AUTH_INVALID"));
  }
});
io.on("connection", (socket) => {
  socket.on("session:join", async ({ sessionId }: { sessionId: string }) => {
    const claims = socket.data.claims;
    if (!claims) return;
    if (claims.kind === "host") {
      const s = await getSession(sessionId);
      if (!s || (s.hostId !== claims.sub && claims.role !== "ADMIN")) return;
      socket.join(`session:${sessionId}`);
      socket.join(`host:${sessionId}`);
    } else if (claims.kind === "player" && claims.sessionId === sessionId) {
      const [session, player] = await Promise.all([
        getSession(sessionId),
        getPlayer(sessionId, claims.sub),
      ]);
      if (!session || !player) return;
      if (isUnsafeNickname(player.nickname)) {
        await removePlayer(sessionId, player.id);
        socket.emit("player:kicked");
        await emitSnapshot("lobby:updated", sessionId);
        return;
      }
      socket.join(`session:${sessionId}`);
      socket.join(`player:${claims.sub}`);
      await redis.hset(keys.player(sessionId, claims.sub), "online", "true");
      await emitSnapshot("lobby:updated", sessionId);
    }
    socket.emit(
      "session:snapshot",
      await gameSnapshot(
        sessionId,
        claims.kind === "player" ? claims.sub : undefined,
        claims.kind === "host" ? "host" : "player",
      ),
    );
  });
  socket.on("disconnect", async () => {
    const claims = socket.data.claims;
    if (claims?.kind === "player") {
      const remaining = await io.in(`player:${claims.sub}`).fetchSockets();
      if (
        !remaining.length &&
        (await getPlayer(claims.sessionId, claims.sub))
      ) {
        await redis.hset(
          keys.player(claims.sessionId, claims.sub),
          "online",
          "false",
        );
        await emitSnapshot("lobby:updated", claims.sessionId);
      }
    }
  });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof z.ZodError) {
    res.status(400).json({
      code: "VALIDATION_ERROR",
      message: "Dữ liệu không hợp lệ.",
      details: err.flatten(),
    });
    return;
  }
  const e = err as Error & {
    status?: number;
    statusCode?: number;
    code?: string;
  };
  const status = e.status ?? e.statusCode ?? 500;
  if (status >= 500) console.error(e);
  else if (config.NODE_ENV === "development")
    console.warn(`[${status}] ${e.code || "REQUEST_REJECTED"}: ${e.message}`);
  res.status(status).json({
    code: e.code ?? "INTERNAL_ERROR",
    message: status < 500 ? e.message : "Hệ thống gặp lỗi, vui lòng thử lại.",
  });
});

const here = path.dirname(fileURLToPath(import.meta.url));
const webDist = path.resolve(here, "../../web/dist");
const webIndex = path.join(webDist, "index.html");
if (existsSync(webIndex)) {
  app.use(express.static(webDist));
  app.get("*", (req, res) => {
    if (req.path.startsWith("/api/")) {
      res.status(404).json({
        code: "API_NOT_FOUND",
        message: "API không tồn tại.",
      });
      return;
    }
    res.sendFile(webIndex);
  });
} else if (config.NODE_ENV === "production") {
  console.warn(
    `[WEB_BUILD_MISSING] Không tìm thấy ${webIndex}. Hãy chạy npm run build trước khi start.`,
  );
}

async function main() {
  await connectRedis();
  server.listen(config.PORT, () =>
    console.log(`RankRush API: http://localhost:${config.PORT}`),
  );
}
if (config.NODE_ENV !== "test") void main();
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    server.close(() => void closeRedis().finally(() => process.exit(0)));
  });

export { app, server, io };
