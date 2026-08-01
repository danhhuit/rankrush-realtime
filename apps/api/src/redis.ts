import { Redis } from "ioredis";
import { config } from "./config.js";

export const redis = new Redis(config.REDIS_URL, { maxRetriesPerRequest: 2, enableReadyCheck: true, lazyConnect: true });
export async function connectRedis() { if (redis.status === "wait") await redis.connect(); await redis.ping(); }
export async function closeRedis() { if (["ready", "connect", "connecting"].includes(redis.status)) await redis.quit(); }
