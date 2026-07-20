import http from "node:http";
import { createHash, randomInt } from "node:crypto";
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
  requireHost,
  requirePlayer,
  signHost,
  signPlayer,
  verifyToken,
} from "./auth.js";
import { config } from "./config.js";
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
  joinSession,
  keys,
  listPlayers,
  listQuestions,
  listQuizzes,
  listSessions,
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

const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (file.mimetype !== "application/pdf") {
      callback(
        Object.assign(new Error("Chỉ hỗ trợ tệp PDF."), { status: 400 }),
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
  const canSeeRanks =
    viewer === "host" ||
    !session.settings.hideLeaderboard ||
    session.state === "ENDED";
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
      current && session.state !== "LOBBY" && session.state !== "ENDED"
        ? publicQuestion(
            current,
            Boolean(quiz?.settings.shuffleAnswers),
            `${session.id}:${current.id}`,
          )
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

const registerSchema = z.object({
  displayName: z.string().trim().min(2).max(40),
  email: z.string().email(),
  password: z.string().min(8).max(100),
});
app.post(
  "/api/auth/register",
  asyncRoute(async (req, res) => {
    const data = registerSchema.parse(req.body);
    const user: User = {
      id: nanoid(12),
      displayName: data.displayName,
      email: data.email.toLowerCase(),
      passwordHash: await bcrypt.hash(data.password, 12),
      role: "HOST",
      createdAt: new Date().toISOString(),
    };
    await createUser(user);
    res.status(201).json({
      token: signHost({ sub: user.id, email: user.email, role: user.role }),
      user: {
        id: user.id,
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
      .object({ email: z.string().email(), password: z.string().min(1) })
      .parse(req.body);
    const user = await getUserByEmail(data.email);
    if (!user || !(await bcrypt.compare(data.password, user.passwordHash)))
      throw Object.assign(new Error("Email hoặc mật khẩu không đúng."), {
        status: 401,
        code: "LOGIN_FAILED",
      });
    res.json({
      token: signHost({ sub: user.id, email: user.email, role: user.role }),
      user: {
        id: user.id,
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
      const code = String(randomInt(100000, 1000000));
      const digest = createHash("sha256").update(code).digest("hex");
      await redis.set(
        keys.passwordReset(normalizedEmail),
        digest,
        "EX",
        config.RESET_CODE_TTL_SECONDS,
      );
      if (config.NODE_ENV !== "production") {
        devCode = code;
        console.info(`[password-reset] ${normalizedEmail}: ${code}`);
      }
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
      })
      .parse(req.body);
    const email = data.email.toLowerCase();
    const [stored, user] = await Promise.all([
      redis.get(keys.passwordReset(email)),
      getUserByEmail(email),
    ]);
    const digest = createHash("sha256").update(data.code).digest("hex");
    if (!stored || stored !== digest || !user)
      throw Object.assign(new Error("Mã đặt lại không đúng hoặc đã hết hạn."), {
        status: 400,
        code: "RESET_CODE_INVALID",
      });
    await redis
      .multi()
      .hset(
        keys.user(user.id),
        "passwordHash",
        await bcrypt.hash(data.password, 12),
      )
      .del(keys.passwordReset(email))
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
        password: z.string().min(8).max(100).optional().or(z.literal("")),
      })
      .parse(req.body);
    const updated: User = {
      ...current,
      displayName: data.displayName,
      passwordHash: data.password
        ? await bcrypt.hash(data.password, 12)
        : current.passwordHash,
    };
    await redis.hset(keys.user(updated.id), {
      displayName: updated.displayName,
      passwordHash: updated.passwordHash,
    });
    res.json({
      id: updated.id,
      email: updated.email,
      displayName: updated.displayName,
      role: updated.role,
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
    .default("#6C5CE7"),
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
    res.json(await listQuizzes(owner));
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
    if (editorRequested && !canEdit)
      throw Object.assign(
        new Error("Bạn không có quyền xem đáp án của quiz này."),
        { status: 403, code: "FORBIDDEN" },
      );
    const questions = await listQuestions(quiz.id);
    res.json({
      quiz,
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
      explanation: question.explanation,
    });
  }),
);
app.post(
  "/api/quizzes",
  requireHost,
  asyncRoute(async (req, res) => {
    const data = quizInput.parse(req.body);
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
    await saveQuiz(quiz);
    res.json(quiz);
  }),
);
app.delete(
  "/api/quizzes/:id",
  requireHost,
  asyncRoute(async (req, res) => {
    await ownedQuiz(req, req.params.id);
    await deleteQuiz(req.params.id, authId(req));
    res.status(204).end();
  }),
);
app.post(
  "/api/quizzes/:id/clone",
  requireHost,
  asyncRoute(async (req, res) => {
    const source = await getQuiz(req.params.id);
    if (!source)
      throw Object.assign(new Error("Không tìm thấy quiz."), { status: 404 });
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
    const qs = await listQuestions(source.id);
    for (const q of qs)
      await saveQuestion({ ...q, id: nanoid(12), quizId: quiz.id });
    res.status(201).json(quiz);
  }),
);

app.get(
  "/api/ai/status",
  requireHost,
  asyncRoute(async (_req, res) => res.json(await getOllamaStatus())),
);
app.post(
  "/api/ai/generate-quiz",
  requireHost,
  pdfUpload.single("pdf"),
  asyncRoute(async (req, res) => {
    const input = z
      .object({
        subject: z.string().trim().max(160).default(""),
        title: z.string().trim().max(120).default(""),
        category: z.string().trim().max(50).default("Giáo dục"),
        questionCount: z.coerce.number().int().min(3).max(15).default(5),
      })
      .parse(req.body);
    if (!input.subject && !req.file)
      throw Object.assign(new Error("Hãy nhập chủ đề hoặc tải lên một PDF."), {
        status: 400,
        code: "GENERATOR_SOURCE_REQUIRED",
      });

    let sourceText = "";
    if (req.file) {
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
    }

    const subject =
      input.subject ||
      req.file?.originalname.replace(/\.pdf$/i, "") ||
      "Quiz từ PDF";
    const generation = await generateQuizQuestionsSmart({
      subject,
      sourceText,
      count: input.questionCount,
    });
    const generated = generation.questions;
    const now = new Date().toISOString();
    const quiz: Quiz = {
      id: nanoid(12),
      ownerId: authId(req),
      title: input.title || subject,
      description: req.file
        ? `Được tạo từ tệp ${req.file.originalname} bằng ${generation.provider === "OLLAMA" ? `Ollama ${generation.model}` : "bộ sinh cục bộ"}. Hãy rà soát trước khi xuất bản.`
        : `Được tạo từ chủ đề “${subject}” bằng ${generation.provider === "OLLAMA" ? `Ollama ${generation.model}` : "bộ sinh cục bộ"}. Hãy rà soát trước khi xuất bản.`,
      category: input.category,
      coverColor: "#5B5BD6",
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
    for (const question of generated)
      await saveQuestion({
        ...question,
        id: nanoid(12),
        quizId: quiz.id,
      });
    res.status(201).json({
      quiz,
      questionCount: generated.length,
      source: req.file ? "PDF" : "SUBJECT",
      provider: generation.provider,
      model: generation.model,
      warning: generation.warning,
    });
  }),
);

const questionInput = z.object({
  type: z.enum(["SINGLE_CHOICE", "TRUE_FALSE", "TEXT"]),
  prompt: z.string().trim().min(3).max(500),
  options: z
    .array(
      z.object({ id: z.string(), text: z.string().trim().min(1).max(200) }),
    )
    .max(6)
    .default([]),
  correctOptionId: z.string().default(""),
  acceptedAnswers: z.array(z.string()).default([]),
  timeLimitSec: z.number().int().min(5).max(300).default(20),
  basePoints: z.number().int().min(100).max(5000).default(600),
  order: z.number().int().min(0).default(0),
  explanation: z.string().max(500).default(""),
});
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
    const question = { ...current, ...questionInput.partial().parse(req.body) };
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
  teamMode: z.boolean().default(false),
  hideLeaderboard: z.boolean().default(false),
  safeNames: z.boolean().default(false),
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
        settings: settingsSchema.default({
          teamMode: false,
          hideLeaderboard: false,
          safeNames: false,
          hideCountryFlags: false,
          mutePlayers: false,
          speedScoring: true,
        }),
      })
      .parse(req.body);
    const quiz = await ownedQuiz(req, data.quizId);
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
      settings: data.settings,
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
        pid = c.sub;
        viewer = "player";
      }
      if (c?.kind === "host") {
        const session = await getSession(req.params.id);
        if (session?.hostId === c.sub || c.role === "ADMIN") viewer = "host";
      }
    } catch {}
    const snap = await gameSnapshot(req.params.id, pid, viewer);
    if (!snap)
      throw Object.assign(new Error("Không tìm thấy phiên."), { status: 404 });
    res.json(snap);
  }),
);
app.post(
  "/api/sessions/join",
  asyncRoute(async (req, res) => {
    const data = z
      .object({
        pin: z.string().regex(/^\d{6}$/),
        nickname: z.string().trim().min(2).max(24),
        avatar: z.string().max(30).default("rocket"),
        country: z.string().max(4).default("VN"),
        team: z.string().max(30).default(""),
      })
      .parse(req.body);
    const s = await getSessionByPin(data.pin);
    if (!s)
      throw Object.assign(new Error("PIN không tồn tại hoặc đã hết hạn."), {
        status: 404,
        code: "PIN_NOT_FOUND",
      });
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
    const now = new Date().toISOString();
    const updated = await updateSession(s.id, {
      state: "RUNNING",
      currentQuestionIndex: 0,
      startedAt: now,
      questionStartedAt: now,
    });
    await emitSnapshot("session:started", s.id);
    res.json(updated);
  }),
);
app.post(
  "/api/sessions/:id/advance",
  requireHost,
  asyncRoute(async (req, res) => {
    const s = await ownedSession(req, req.params.id);
    const questions = await sessionQuestions(s);
    if (s.state === "RUNNING") {
      const q = questions[s.currentQuestionIndex];
      if (!q)
        throw Object.assign(new Error("Không có câu hỏi hiện tại."), {
          status: 409,
        });
      const payload = {
        questionId: q.id,
        correctOptionId: q.correctOptionId,
        acceptedAnswers: q.acceptedAnswers,
        explanation: q.explanation,
        leaderboard: await getLeaderboard(s.id, 10),
        teamLeaderboard: await getTeamLeaderboard(s.id),
      };
      await updateSession(s.id, { state: "QUESTION_RESULT" });
      const playerPayload = s.settings.hideLeaderboard
        ? { ...payload, leaderboard: [], teamLeaderboard: [] }
        : payload;
      io.to(`session:${s.id}`).emit("question:revealed", playerPayload);
      io.to(`host:${s.id}`).emit("question:revealed", payload);
      res.json({ state: "QUESTION_RESULT", ...payload });
      return;
    }
    if (s.state === "QUESTION_RESULT") {
      const next = s.currentQuestionIndex + 1;
      if (next >= questions.length) {
        const ended = await updateSession(s.id, {
          state: "ENDED",
          endedAt: new Date().toISOString(),
        });
        await emitSnapshot("session:ended", s.id);
        res.json(ended);
        return;
      }
      const now = new Date().toISOString();
      const updated = await updateSession(s.id, {
        state: "RUNNING",
        currentQuestionIndex: next,
        questionStartedAt: now,
      });
      await emitSnapshot("question:shown", s.id);
      res.json(updated);
      return;
    }
    throw Object.assign(new Error("Phiên không ở trạng thái có thể chuyển."), {
      status: 409,
    });
  }),
);
app.post(
  "/api/sessions/:id/end",
  requireHost,
  asyncRoute(async (req, res) => {
    const s = await ownedSession(req, req.params.id);
    const updated = await updateSession(s.id, {
      state: "ENDED",
      endedAt: new Date().toISOString(),
    });
    await emitSnapshot("session:ended", s.id);
    res.json(updated);
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
    const player = await getPlayer(s.id, req.params.playerId);
    if (player)
      await redis
        .multi()
        .srem(keys.sessionPlayers(s.id), player.id)
        .hdel(
          keys.sessionNicknames(s.id),
          player.nickname.toLocaleLowerCase("vi-VN"),
        )
        .zrem(keys.leaderboard(s.id), player.id)
        .del(keys.player(s.id, player.id))
        .exec();
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
        responseMs: z.number().int().min(0).max(300000),
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
    const points = calculateScore(
      q.basePoints,
      q.timeLimitSec,
      data.responseMs,
      correct,
      s.settings.speedScoring,
    );
    const saved = await submitAnswerAtomic({
      sessionId: s.id,
      playerId: player.id,
      questionId: q.id,
      selectedAnswer: data.answer,
      isCorrect: correct,
      responseMs: data.responseMs,
      awardedPoints: points,
      team: player.team,
    });
    const rank = await getPlayerRank(s.id, player.id);
    const visibleRank = s.settings.hideLeaderboard ? null : rank;
    const answered = await countAnswersForQuestion(s.id, q.id);
    io.to(`player:${player.id}`).emit("answer:accepted", {
      ...saved,
      correct,
      rank: visibleRank,
    });
    io.to(`host:${s.id}`).emit("host:progress", {
      questionId: q.id,
      answered,
      playerCount: await redis.scard(keys.sessionPlayers(s.id)),
    });
    if (!s.settings.hideLeaderboard)
      io.to(`session:${s.id}`).emit("leaderboard:updated", {
        leaderboard: await getLeaderboard(s.id, 10),
        teamLeaderboard: await getTeamLeaderboard(s.id),
      });
    res.json({ ...saved, correct, rank: visibleRank });
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
      if (!s || s.hostId !== claims.sub) return;
      socket.join(`session:${sessionId}`);
      socket.join(`host:${sessionId}`);
    } else if (claims.kind === "player" && claims.sessionId === sessionId) {
      socket.join(`session:${sessionId}`);
      socket.join(`player:${claims.sub}`);
      await redis.hset(keys.player(sessionId, claims.sub), "online", "true");
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
    if (claims?.kind === "player")
      await redis.hset(
        keys.player(claims.sessionId, claims.sub),
        "online",
        "false",
      );
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
if (config.NODE_ENV === "production") {
  app.use(express.static(webDist));
  app.get("*", (_req, res) => res.sendFile(path.join(webDist, "index.html")));
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
