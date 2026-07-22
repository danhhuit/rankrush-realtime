import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";

// Workspace scripts may run with apps/api as cwd. Always also load the root .env.
const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config();
dotenv.config({ path: path.resolve(here, "../../../.env") });

const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.string().default("http://localhost:5173"),
  PUBLIC_WEB_URL: z.string().url().optional().or(z.literal("")),
  WEB_PORT: z.coerce.number().int().positive().default(5173),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  REDIS_PREFIX: z.string().default("rankrush"),
  JWT_SECRET: z.string().min(16).default("rankrush-change-this-secret"),
  SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(604800),
  JOIN_CODE_TTL_SECONDS: z.coerce.number().int().positive().default(86400),
  MAX_PLAYERS_PER_SESSION: z.coerce.number().int().positive().default(300),
  RESET_CODE_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  EMAIL_CODE_TTL_SECONDS: z.coerce.number().int().positive().default(600),
  EMAIL_DEV_CODE_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  SMTP_HOST: z.string().default(""),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  SMTP_USER: z.string().default(""),
  SMTP_PASS: z.string().default(""),
  SMTP_FROM: z.string().default("RankRush <no-reply@rankrush.local>"),
  OLLAMA_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  OLLAMA_BASE_URL: z.string().url().default("http://127.0.0.1:11434"),
  OLLAMA_MODEL: z.string().min(1).default("qwen2.5:3b"),
  OLLAMA_TIMEOUT_MS: z.coerce.number().int().positive().default(300000),
});

export const config = schema.parse(process.env);
export const key = (...parts: Array<string | number>) =>
  [config.REDIS_PREFIX, ...parts].join(":");
