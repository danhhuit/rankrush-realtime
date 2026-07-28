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
import { customAlphabet, nanoid } from "nanoid";
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
import { validateAvatarValue } from "./avatar.js";
import {
  createBackup,
  deleteBackup,
  getBackupDownload,
  listBackups,
  restoreBackup,
} from "./backup-service.js";
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
      Object.assign(
        new Error("Origin khÃ´ng Ä‘Æ°á»£c phÃ©p truy cáº­p RankRush."),
        {
          status: 403,
          code: "CORS_ORIGIN_DENIED",
        },
      ),
    );
};
const io = new Server(server, {
  cors: { origin: allowWebOrigin, credentials: true },
});

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: allowWebOrigin, credentials: true }));
app.use(express.json({ limit: "2mb" }));

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
        Object.assign(new Error("Chá»‰ há»— trá»£ tá»‡p PDF hoáº·c CSV."), {
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
    throw Object.assign(new Error("KhÃ´ng cÃ³ quyá»n."), {
      status: 401,
      code: "UNAUTHORIZED",
    });
  return req.auth.sub;
};
async function ownedQuiz(req: Request, id: string) {
  const quiz = await getQuiz(id);
  if (!quiz)
    throw Object.assign(new Error("KhÃ´ng tÃ¬m tháº¥y quiz."), {
      status: 404,
      code: "QUIZ_NOT_FOUND",
    });
  const isAdmin = req.auth?.kind === "host" && req.auth.role === "ADMIN";
  if (quiz.ownerId !== authId(req) && !isAdmin)
    throw Object.assign(new Error("Báº¡n khÃ´ng sá»Ÿ há»¯u quiz nÃ y."), {
      status: 403,
      code: "FORBIDDEN",
    });
  return quiz;
}
async function hostableQuiz(req: Request, id: string) {
  const quiz = await getQuiz(id);
  if (!quiz)
    throw Object.assign(new Error("KhÃ´ng tÃ¬m tháº¥y quiz."), {
      status: 404,
      code: "QUIZ_NOT_FOUND",
    });
  const isAdmin = req.auth?.kind === "host" && req.auth.role === "ADMIN";
  if (quiz.ownerId !== authId(req) && quiz.status !== "PUBLISHED" && !isAdmin)
    throw Object.assign(
      new Error("Quiz nÃ y chÆ°a Ä‘Æ°á»£c cÃ´ng khai Ä‘á»ƒ tá»• chá»©c."),
      {
        status: 403,
        code: "FORBIDDEN",
      },
    );
  return quiz;
}
async function ownedSession(req: Request, id: string) {
  const s = await getSession(id);
  if (!s)
    throw Object.assign(new Error("KhÃ´ng tÃ¬m tháº¥y phiÃªn."), {
      status: 404,
      code: "SESSION_NOT_FOUND",
    });
  const isAdmin = req.auth?.kind === "host" && req.auth.role === "ADMIN";
  if (s.hostId !== authId(req) && !isAdmin)
    throw Object.assign(new Error("Báº¡n khÃ´ng pháº£i host cá»§a phiÃªn."), {
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
  const hostRoom = `host:${sessionId}`;
  const hostRoomSet = io.sockets.adapter.rooms.get(hostRoom);
  const hasHost = hostRoomSet && hostRoomSet.size > 0;

  const players = await listPlayers(sessionId);
  const activePlayers = players.filter((p) => {
    const playerRoom = `player:${p.id}`;
    const roomSet = io.sockets.adapter.rooms.get(playerRoom);
    return roomSet && roomSet.size > 0;
  });

  const hostSnapPromise = hasHost
    ? gameSnapshot(sessionId, undefined, "host")
    : Promise.resolve(null);

  const playerSnapPromises = activePlayers.map((p) =>
    gameSnapshot(sessionId, p.id, "player")
  );

  const [hostSnapshot, ...playerSnapshots] = await Promise.all([
    hostSnapPromise,
    ...playerSnapPromises,
  ]);

  if (hasHost && hostSnapshot) {
    io.to(hostRoom).emit(event, hostSnapshot);
  }

  activePlayers.forEach((player, index) => {
    const snap = playerSnapshots[index];
    if (snap) {
      io.to(`player:${player.id}`).emit(event, snap);
    }
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
    message: "Máº­t kháº©u xÃ¡c nháº­n khÃ´ng khá»›p.",
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
      new Error("Vui lÃ²ng chá» 60 giÃ¢y trÆ°á»›c khi gá»­i láº¡i mÃ£."),
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
      throw Object.assign(new Error("Email Ä‘Ã£ Ä‘Æ°á»£c sá»­ dá»¥ng."), {
        status: 409,
        code: "EMAIL_EXISTS",
      });
    if (usernameUser)
      throw Object.assign(
        new Error("TÃªn Ä‘Äƒng nháº­p Ä‘Ã£ Ä‘Æ°á»£c sá»­ dá»¥ng."),
        {
          status: 409,
          code: "USERNAME_EXISTS",
        },
      );
    const result = await issueEmailCode(email, "register");
    res.json({
      ...result,
      message: result.sent
        ? "MÃ£ xÃ¡c nháº­n Ä‘Ã£ Ä‘Æ°á»£c gá»­i Ä‘áº¿n email."
        : "SMTP chÆ°a Ä‘Æ°á»£c cáº¥u hÃ¬nh; Ä‘ang dÃ¹ng mÃ£ phÃ¡t triá»ƒn.",
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
        new Error(
          "MÃ£ xÃ¡c nháº­n email khÃ´ng Ä‘Ãºng hoáº·c Ä‘Ã£ háº¿t háº¡n.",
        ),
        { status: 400, code: "EMAIL_CODE_INVALID" },
      );
    }
    const user: User = {
      id: nanoid(12),
      displayName: data.displayName,
      username: data.username,
      email,
      passwordHash: await bcrypt.hash(data.password, 12),
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
        avatar: user.avatar || "",
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
        message: "HÃ£y nháº­p email hoáº·c tÃªn Ä‘Äƒng nháº­p.",
      })
      .parse(req.body);
    const identifier = (data.identifier || data.email || "").toLowerCase();
    const attemptsKey = keys.loginAttempts(identifier);
    const attempts = Number((await redis.get(attemptsKey)) || 0);
    if (attempts >= 10)
      throw Object.assign(
        new Error(
          "QuÃ¡ nhiá»u láº§n Ä‘Äƒng nháº­p sai. Vui lÃ²ng thá»­ láº¡i sau 15 phÃºt.",
        ),
        { status: 429, code: "LOGIN_RATE_LIMITED" },
      );
    const user = identifier.includes("@")
      ? await getUserByEmail(identifier)
      : await getUserByUsername(identifier);
    if (!user || !(await bcrypt.compare(data.password, user.passwordHash))) {
      const failed = await redis.incr(attemptsKey);
      if (failed === 1) await redis.expire(attemptsKey, 15 * 60);
      throw Object.assign(
        new Error(
          "TÃªn Ä‘Äƒng nháº­p/email hoáº·c máº­t kháº©u khÃ´ng Ä‘Ãºng.",
        ),
        {
          status: 401,
          code: "LOGIN_FAILED",
        },
      );
    }
    if (user.status === "SUSPENDED")
      throw Object.assign(
        new Error(
          "TÃ i khoáº£n Ä‘Ã£ bá»‹ táº¡m khÃ³a. Vui lÃ²ng liÃªn há»‡ quáº£n trá»‹ viÃªn.",
        ),
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
        avatar: user.avatar || "",
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
        "Náº¿u email tá»“n táº¡i, mÃ£ Ä‘áº·t láº¡i Ä‘Ã£ Ä‘Æ°á»£c táº¡o vÃ  cÃ³ hiá»‡u lá»±c 15 phÃºt.",
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
        message: "Máº­t kháº©u xÃ¡c nháº­n khÃ´ng khá»›p.",
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
      throw Object.assign(
        new Error("MÃ£ Ä‘áº·t láº¡i khÃ´ng Ä‘Ãºng hoáº·c Ä‘Ã£ háº¿t háº¡n."),
        {
          status: 400,
          code: "RESET_CODE_INVALID",
        },
      );
    }
    const userKey = keys.user(user.id);
    await redis
      .multi()
      .hset(userKey, {
        passwordHash: await bcrypt.hash(data.password, 12),
      })
      .hdel(userKey, "rawPassword")
      .del(keys.passwordReset(email))
      .del(keys.emailCodeAttempts("reset", email))
      .exec();
    res.json({ message: "Máº­t kháº©u Ä‘Ã£ Ä‘Æ°á»£c cáº­p nháº­t." });
  }),
);
app.get(
  "/api/auth/me",
  requireHost,
  asyncRoute(async (req, res) => {
    const user = await getUser(authId(req));
    if (!user)
      throw Object.assign(new Error("KhÃ´ng tÃ¬m tháº¥y tÃ i khoáº£n."), {
        status: 404,
      });
    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      avatar: user.avatar || "",
    });
  }),
);
app.put(
  "/api/auth/me",
  requireHost,
  asyncRoute(async (req, res) => {
    const current = await getUser(authId(req));
    if (!current)
      throw Object.assign(new Error("KhÃ´ng tÃ¬m tháº¥y tÃ i khoáº£n."), {
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
        avatar: z.string().optional().or(z.literal("")),
        currentPassword: z.string().max(100).optional().or(z.literal("")),
        password: z.string().min(8).max(100).optional().or(z.literal("")),
        confirmPassword: z.string().max(100).optional().or(z.literal("")),
      })
      .refine(
        (value) => !value.password || value.password === value.confirmPassword,
        {
          message: "Máº­t kháº©u xÃ¡c nháº­n khÃ´ng khá»›p.",
          path: ["confirmPassword"],
        },
      )
      .parse(req.body);
    const avatarIssue = validateAvatarValue(
      data.avatar !== undefined ? data.avatar : current.avatar || "",
    );
    if (avatarIssue)
      throw Object.assign(
        new Error(
          avatarIssue === "TOO_LARGE"
            ? "Ảnh đại diện quá lớn. Hãy chọn ảnh khác."
            : "Ảnh đại diện không đúng định dạng.",
        ),
        {
          status: 400,
          code:
            avatarIssue === "TOO_LARGE"
              ? "AVATAR_TOO_LARGE"
              : "AVATAR_INVALID",
        },
      );
    if (
      data.password &&
      (!data.currentPassword ||
        !(await bcrypt.compare(data.currentPassword, current.passwordHash)))
    )
      throw Object.assign(
        new Error("Máº­t kháº©u hiá»‡n táº¡i khÃ´ng Ä‘Ãºng."),
        {
          status: 400,
          code: "CURRENT_PASSWORD_INVALID",
        },
      );
    const usernameOwner = await redis.get(keys.userUsername(data.username));
    if (usernameOwner && usernameOwner !== current.id)
      throw Object.assign(
        new Error("TÃªn Ä‘Äƒng nháº­p Ä‘Ã£ Ä‘Æ°á»£c sá»­ dá»¥ng."),
        {
          status: 409,
          code: "USERNAME_EXISTS",
        },
      );
    const updated: User = {
      ...current,
      displayName: data.displayName,
      username: data.username,
      avatar: data.avatar !== undefined ? data.avatar : (current.avatar || ""),
      passwordHash: data.password
        ? await bcrypt.hash(data.password, 12)
        : current.passwordHash,
    };
    const tx = redis.multi().hset(keys.user(updated.id), {
      displayName: updated.displayName,
      username: updated.username || "",
      avatar: updated.avatar || "",
      passwordHash: updated.passwordHash,
    });
    if (data.password) tx.hdel(keys.user(updated.id), "rawPassword");
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
      avatar: updated.avatar,
      role: updated.role,
    });
  }),
);

async function currentAdmin(req: Request) {
  const user = await getUser(authId(req));
  if (!user || user.role !== "ADMIN" || user.status === "SUSPENDED")
    throw Object.assign(
      new Error("TÃ i khoáº£n khÃ´ng cÃ²n quyá»n quáº£n trá»‹ viÃªn."),
      {
        status: 403,
        code: "ADMIN_REQUIRED",
      },
    );
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
      throw Object.assign(
        new Error("Äá»‹a chá»‰ email Ä‘Ã£ Ä‘Æ°á»£c sá»­ dá»¥ng."),
        {
          status: 409,
          code: "EMAIL_EXISTS",
        },
      );
    if (existingUsername)
      throw Object.assign(
        new Error("TÃªn Ä‘Äƒng nháº­p Ä‘Ã£ Ä‘Æ°á»£c sá»­ dá»¥ng."),
        {
          status: 409,
          code: "USERNAME_EXISTS",
        },
      );

    const user: User = {
      id: customAlphabet(
        "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
        12,
      )(),
      displayName: data.displayName,
      username: data.username,
      email: data.email,
      passwordHash: await bcrypt.hash(data.password, 12),
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
      throw Object.assign(new Error("KhÃ´ng tÃ¬m tháº¥y ngÆ°á»i dÃ¹ng."), {
        status: 404,
      });
    const patch = z
      .object({
        role: z.enum(["HOST", "ADMIN"]).optional(),
        status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
      })
      .refine((value) => value.role || value.status, {
        message: "KhÃ´ng cÃ³ thay Ä‘á»•i cáº§n lÆ°u.",
      })
      .parse(req.body);
    const nextRole = patch.role || target.role;
    const nextStatus = patch.status || target.status || "ACTIVE";
    if (
      target.id === admin.id &&
      (nextRole !== "ADMIN" || nextStatus !== "ACTIVE")
    )
      throw Object.assign(
        new Error(
          "Báº¡n khÃ´ng thá»ƒ tá»± háº¡ quyá»n hoáº·c khÃ³a tÃ i khoáº£n cá»§a mÃ¬nh.",
        ),
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
          new Error(
            "Há»‡ thá»‘ng pháº£i cÃ²n Ã­t nháº¥t má»™t quáº£n trá»‹ viÃªn hoáº¡t Ä‘á»™ng.",
          ),
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
      throw Object.assign(new Error("NgÆ°á»i dÃ¹ng khÃ´ng tá»“n táº¡i."), {
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
          "Vui lÃ²ng sá»­ dá»¥ng chá»©c nÄƒng Äá»•i máº­t kháº©u trong CÃ i Ä‘áº·t há»“ sÆ¡ thay vÃ¬ thao tÃ¡c nÃ y.",
        ),
        { status: 409, code: "ADMIN_SELF_PROTECTED" },
      );
    }

    const passwordHash = await bcrypt.hash(data.newPassword, 12);

    const userKey = keys.user(target.id);
    await redis
      .multi()
      .hset(userKey, { passwordHash })
      .hdel(userKey, "rawPassword")
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

    res.json({ message: "ÄÃ£ Ä‘áº·t láº¡i máº­t kháº©u thÃ nh cÃ´ng." });
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

app.get(
  "/api/admin/backups",
  requireAdmin,
  asyncRoute(async (req, res) => {
    await currentAdmin(req);
    res.json(await listBackups());
  }),
);

app.post(
  "/api/admin/backups",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const admin = await currentAdmin(req);
    const { label } = z
      .object({ label: z.string().trim().max(80).default("") })
      .parse(req.body || {});
    const backup = await createBackup(label || "Bản sao thủ công");
    await redis.xadd(
      keys.adminEvents,
      "MAXLEN",
      "~",
      2000,
      "*",
      "type",
      "BACKUP_CREATED",
      "adminId",
      admin.id,
      "backupId",
      backup.id,
      "keyCount",
      String(backup.keyCount),
      "at",
      new Date().toISOString(),
    );
    res.status(201).json(backup);
  }),
);

app.get(
  "/api/admin/backups/:id/download",
  requireAdmin,
  asyncRoute(async (req, res) => {
    await currentAdmin(req);
    const download = await getBackupDownload(req.params.id);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${download.filename}"`,
    );
    res.sendFile(download.path);
  }),
);

app.post(
  "/api/admin/backups/:id/restore",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const admin = await currentAdmin(req);
    const result = await restoreBackup(req.params.id);
    await redis.xadd(
      keys.adminEvents,
      "MAXLEN",
      "~",
      2000,
      "*",
      "type",
      "BACKUP_RESTORED",
      "adminId",
      admin.id,
      "backupId",
      result.backup.id,
      "safetyBackupId",
      result.safetyBackup.id,
      "keyCount",
      String(result.restoredKeys),
      "at",
      result.restoredAt,
    );
    io.emit("system:restored", {
      at: result.restoredAt,
      backupId: result.backup.id,
    });
    res.json(result);
  }),
);

app.delete(
  "/api/admin/backups/:id",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const admin = await currentAdmin(req);
    await deleteBackup(req.params.id);
    await redis.xadd(
      keys.adminEvents,
      "MAXLEN",
      "~",
      2000,
      "*",
      "type",
      "BACKUP_DELETED",
      "adminId",
      admin.id,
      "backupId",
      req.params.id,
      "at",
      new Date().toISOString(),
    );
    res.status(204).end();
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
      throw Object.assign(new Error("KhÃ´ng tÃ¬m tháº¥y quiz."), {
        status: 404,
        code: "QUIZ_NOT_FOUND",
      });
    const editorRequested = req.query.editor === "1";
    const canEdit =
      req.auth?.kind === "host" &&
      (req.auth.role === "ADMIN" || req.auth.sub === quiz.ownerId);
    if (quiz.status !== "PUBLISHED" && !canEdit)
      throw Object.assign(new Error("KhÃ´ng tÃ¬m tháº¥y quiz cÃ´ng khai."), {
        status: 404,
        code: "QUIZ_NOT_FOUND",
      });
    if (editorRequested && !canEdit)
      throw Object.assign(
        new Error("Báº¡n khÃ´ng cÃ³ quyá»n xem Ä‘Ã¡p Ã¡n cá»§a quiz nÃ y."),
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
      throw Object.assign(
        new Error("KhÃ´ng tÃ¬m tháº¥y cÃ¢u há»i luyá»‡n táº­p."),
        {
          status: 404,
        },
      );
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
        new Error(
          "HÃ£y táº¡o vÃ  kiá»ƒm tra cÃ¢u há»i trÆ°á»›c khi xuáº¥t báº£n quiz.",
        ),
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
      title: `${source.title} (báº£n sao)`,
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
        category: z.string().trim().max(50).default("GiÃ¡o dá»¥c"),
        questionCount: z.coerce.number().int().min(3).max(15).default(5),
        timeLimitSec: z.coerce.number().int().min(5).max(300).default(20),
        basePoints: z.coerce.number().int().min(100).max(5000).default(600),
        language: z.enum(["vi", "en"]).default("vi"),
        difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).default("MEDIUM"),
      })
      .parse(req.body);
    if (!input.subject && !input.context && !input.sourceText && !req.file)
      throw Object.assign(
        new Error(
          "HÃ£y nháº­p chá»§ Ä‘á», ná»™i dung tham kháº£o hoáº·c táº£i lÃªn má»™t PDF.",
        ),
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
          new Error(
            "PDF khÃ´ng cÃ³ Ä‘á»§ vÄƒn báº£n cÃ³ thá»ƒ Ä‘á»c Ä‘á»ƒ táº¡o cÃ¢u há»i.",
          ),
          { status: 400, code: "PDF_TEXT_EMPTY" },
        );
    } else if (req.file) {
      sourceText = req.file.buffer.toString("utf8");
    }

    const subject =
      input.subject ||
      req.file?.originalname.replace(/\.(pdf|csv)$/i, "") ||
      "Quiz tá»± Ä‘á»™ng";
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
                ? "AI chÆ°a sáºµn sÃ ng Ä‘á»ƒ Ä‘á»c PDF. HÃ£y khá»Ÿi Ä‘á»™ng AI cá»¥c bá»™ hoáº·c táº£i tá»‡p CSV theo máº«u."
                : "AI chÆ°a sáºµn sÃ ng Ä‘á»ƒ táº¡o cÃ¢u há»i. HÃ£y khá»Ÿi Ä‘á»™ng AI cá»¥c bá»™ hoáº·c nháº­p cÃ¢u há»i báº±ng CSV.",
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
          ? `ÄÆ°á»£c táº¡o tá»« tá»‡p ${req.file.originalname}. HÃ£y rÃ  soÃ¡t cÃ¢u há»i vÃ  Ä‘Ã¡p Ã¡n trÆ°á»›c khi xuáº¥t báº£n.`
          : `ÄÆ°á»£c táº¡o tá»± Ä‘á»™ng tá»« chá»§ Ä‘á» â€œ${subject}â€. HÃ£y rÃ  soÃ¡t cÃ¢u há»i vÃ  Ä‘Ã¡p Ã¡n trÆ°á»›c khi xuáº¥t báº£n.`),
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
      message: "MÃ£ lá»±a chá»n khÃ´ng Ä‘Æ°á»£c trÃ¹ng nhau.",
    });
  if (question.type === "TEXT") {
    if (!question.acceptedAnswers.length)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["acceptedAnswers"],
        message:
          "CÃ¢u há»i vÄƒn báº£n pháº£i cÃ³ Ã­t nháº¥t má»™t Ä‘Ã¡p Ã¡n Ä‘Æ°á»£c cháº¥p nháº­n.",
      });
    return;
  }
  if (question.options.length < 2)
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["options"],
      message: "CÃ¢u há»i lá»±a chá»n pháº£i cÃ³ Ã­t nháº¥t hai phÆ°Æ¡ng Ã¡n.",
    });
  if (!optionIds.includes(question.correctOptionId))
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["correctOptionId"],
      message: "ÄÃ¡p Ã¡n Ä‘Ãºng pháº£i thuá»™c danh sÃ¡ch lá»±a chá»n.",
    });
  if (question.type === "TRUE_FALSE" && question.options.length !== 2)
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["options"],
      message: "CÃ¢u há»i ÄÃºng/Sai pháº£i cÃ³ Ä‘Ãºng hai lá»±a chá»n.",
    });
});

async function assertQuizPublishable(quizId: string) {
  const questions = await listQuestions(quizId);
  if (!questions.length)
    throw Object.assign(
      new Error("Quiz pháº£i cÃ³ Ã­t nháº¥t má»™t cÃ¢u há»i."),
      {
        status: 400,
        code: "QUIZ_EMPTY",
      },
    );
  const invalid = questions.find(
    (question) => !questionInput.safeParse(question).success,
  );
  if (invalid)
    throw Object.assign(
      new Error(
        `CÃ¢u há»i â€œ${invalid.prompt}â€ chÆ°a cÃ³ cáº¥u hÃ¬nh Ä‘Ã¡p Ã¡n há»£p lá»‡.`,
      ),
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
      throw Object.assign(new Error("KhÃ´ng tÃ¬m tháº¥y cÃ¢u há»i."), {
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
      throw Object.assign(new Error("KhÃ´ng tÃ¬m tháº¥y cÃ¢u há»i."), {
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
      throw Object.assign(
        new Error("Quiz pháº£i cÃ³ Ã­t nháº¥t má»™t cÃ¢u há»i."),
        {
          status: 400,
          code: "QUIZ_EMPTY",
        },
      );
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
        new Error(
          "Chá»‰ cÃ³ thá»ƒ Ä‘á»•i thiáº¿t láº­p khi phÃ²ng Ä‘ang chá».",
        ),
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
      throw Object.assign(
        new Error("PIN khÃ´ng tá»“n táº¡i hoáº·c Ä‘Ã£ háº¿t háº¡n."),
        {
          status: 404,
          code: "PIN_NOT_FOUND",
        },
      );
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
      throw Object.assign(
        new Error("Vui lÃ²ng Ä‘Äƒng nháº­p Ä‘á»ƒ xem phiÃªn chÆ¡i."),
        {
          status: 401,
          code: "UNAUTHORIZED",
        },
      );
    const snap = await gameSnapshot(req.params.id, pid, viewer);
    if (!snap)
      throw Object.assign(new Error("KhÃ´ng tÃ¬m tháº¥y phiÃªn."), {
        status: 404,
      });
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
    const forwarded = req.headers["x-forwarded-for"];
    const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0].trim() || req.ip || "unknown";
    const ipKey = `${config.REDIS_PREFIX}:rate-limit:join:${ip}`;
    const joinAttempts = await redis.incr(ipKey);
    if (joinAttempts === 1) await redis.expire(ipKey, 60);
    if (joinAttempts > 10) {
      throw Object.assign(
        new Error("Quá nhiều yêu cầu tham gia. Vui lòng thử lại sau."),
        { status: 429, code: "JOIN_RATE_LIMITED" },
      );
    }
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
      throw Object.assign(
        new Error("PIN khÃ´ng tá»“n táº¡i hoáº·c Ä‘Ã£ háº¿t háº¡n."),
        {
          status: 404,
          code: "PIN_NOT_FOUND",
        },
      );
    if (
      req.auth?.kind === "host" &&
      (req.auth.sub === s.hostId || req.auth.role === "ADMIN")
    )
      throw Object.assign(
        new Error(
          "Host lÃ  ngÆ°á»i Ä‘iá»u khiá»ƒn phÃ²ng vÃ  khÃ´ng Ä‘Æ°á»£c tÃ­nh nhÆ° má»™t ngÆ°á»i chÆ¡i trong chÃ­nh phÃ²ng nÃ y.",
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
      throw Object.assign(
        new Error("Chá»‰ cÃ³ thá»ƒ báº¯t Ä‘áº§u tá»« lobby."),
        {
          status: 409,
        },
      );
    if ((await redis.scard(keys.sessionPlayers(s.id))) === 0)
      throw Object.assign(
        new Error("Cáº§n Ã­t nháº¥t má»™t ngÆ°á»i chÆ¡i Ä‘á»ƒ báº¯t Ä‘áº§u."),
        {
          status: 409,
          code: "SESSION_EMPTY",
        },
      );
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
        new Error(
          "ÄÃ¡p Ã¡n Ä‘Æ°á»£c cÃ´ng bá»‘ tá»± Ä‘á»™ng; chÆ°a thá»ƒ chuyá»ƒn cÃ¢u.",
        ),
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
      throw Object.assign(
        new Error("KhÃ´ng thá»ƒ bá» qua cÃ¢u há»i lÃºc nÃ y."),
        {
          status: 409,
        },
      );
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
        throw Object.assign(
          new Error("PhiÃªn khÃ´ng thá»ƒ táº¡m dá»«ng lÃºc nÃ y."),
          {
            status: 409,
          },
        );
      const questions = await sessionQuestions(s);
      const q = questions[s.currentQuestionIndex];
      if (!q)
        throw Object.assign(new Error("KhÃ´ng cÃ³ cÃ¢u há»i hiá»‡n táº¡i."), {
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
        throw Object.assign(new Error("PhiÃªn hiá»‡n khÃ´ng táº¡m dá»«ng."), {
          status: 409,
        });
      const questions = await sessionQuestions(s);
      const q = questions[s.currentQuestionIndex];
      if (!q)
        throw Object.assign(new Error("KhÃ´ng cÃ³ cÃ¢u há»i hiá»‡n táº¡i."), {
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
      throw Object.assign(new Error("CÃ¢u há»i khÃ´ng á»Ÿ pha chuáº©n bá»‹."), {
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
      throw Object.assign(new Error("PhiÃªn nÃ y Ä‘Ã£ káº¿t thÃºc."), {
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
      throw Object.assign(
        new Error("Chá»‰ cÃ³ thá»ƒ há»§y phÃ²ng khi Ä‘ang á»Ÿ lobby."),
        {
          status: 409,
          code: "SESSION_NOT_CANCELLABLE",
        },
      );
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
      throw Object.assign(
        new Error("Chá»‰ cÃ³ thá»ƒ chÆ¡i láº¡i phiÃªn Ä‘Ã£ káº¿t thÃºc."),
        {
          status: 409,
          code: "SESSION_NOT_REPLAYABLE",
        },
      );
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
      throw Object.assign(
        new Error("Chá»‰ cÃ³ thá»ƒ loáº¡i ngÆ°á»i chÆ¡i á»Ÿ lobby."),
        {
          status: 409,
        },
      );
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
      throw Object.assign(new Error("Player token khÃ´ng thuá»™c phiÃªn."), {
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
      throw Object.assign(new Error("Dá»¯ liá»‡u phiÃªn khÃ´ng há»£p lá»‡."), {
        status: 404,
      });
    if (s.state !== "RUNNING")
      throw Object.assign(
        new Error("CÃ¢u há»i hiá»‡n khÃ´ng nháº­n Ä‘Ã¡p Ã¡n."),
        {
          status: 409,
          code: "QUESTION_CLOSED",
        },
      );
    const questions = await sessionQuestions(s);
    if (questions[s.currentQuestionIndex]?.id !== q.id)
      throw Object.assign(new Error("KhÃ´ng pháº£i cÃ¢u há»i hiá»‡n táº¡i."), {
        status: 409,
      });
    const elapsedMs = Date.now() - new Date(s.questionStartedAt).getTime();
    if (elapsedMs > q.timeLimitSec * 1000 + 1000)
      throw Object.assign(
        new Error("ÄÃ£ háº¿t thá»i gian tráº£ lá»i cÃ¢u há»i."),
        {
          status: 409,
          code: "QUESTION_TIMEOUT",
        },
      );
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
      throw Object.assign(new Error("Player token khÃ´ng thuá»™c phiÃªn."), {
        status: 403,
      });
    const session = await getSession(req.params.id);
    if (!session)
      throw Object.assign(new Error("KhÃ´ng tÃ¬m tháº¥y phiÃªn."), {
        status: 404,
      });
    if (session.state !== "ENDED")
      throw Object.assign(
        new Error("Káº¿t quáº£ chá»‰ cÃ³ sau khi game káº¿t thÃºc."),
        {
          status: 409,
        },
      );
    res.json(await buildPlayerResult(req.params.id, req.auth.sub));
  }),
);
app.get(
  "/api/sessions/:id/leaderboard",
  optionalAuth,
  asyncRoute(async (req, res) => {
    const session = await getSession(req.params.id);
    if (!session)
      throw Object.assign(new Error("KhÃ´ng tÃ¬m tháº¥y phiÃªn."), {
        status: 404,
      });
    const hostCanSee =
      req.auth?.kind === "host" &&
      (req.auth.role === "ADMIN" || req.auth.sub === session.hostId);
    const playerCanSee =
      req.auth?.kind === "player" && req.auth.sessionId === session.id;
    if (!hostCanSee && !playerCanSee)
      throw Object.assign(
        new Error("Báº¡n khÃ´ng cÃ³ quyá»n xem báº£ng xáº¿p háº¡ng nÃ y."),
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
      message: "Dá»¯ liá»‡u khÃ´ng há»£p lá»‡.",
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
    message:
      status < 500
        ? e.message
        : "Há»‡ thá»‘ng gáº·p lá»—i, vui lÃ²ng thá»­ láº¡i.",
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
        message: "API khÃ´ng tá»“n táº¡i.",
      });
      return;
    }
    res.sendFile(webIndex);
  });
} else if (config.NODE_ENV === "production") {
  console.warn(
    `[WEB_BUILD_MISSING] KhÃ´ng tÃ¬m tháº¥y ${webIndex}. HÃ£y cháº¡y npm run build trÆ°á»›c khi start.`,
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
