import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "./config.js";

export type HostClaims = { kind: "host"; sub: string; email: string; role: "HOST" | "ADMIN" };
export type PlayerClaims = { kind: "player"; sub: string; sessionId: string };

declare global { namespace Express { interface Request { auth?: HostClaims | PlayerClaims; } } }

export const signHost = (claims: Omit<HostClaims, "kind">) => jwt.sign({ ...claims, kind: "host" }, config.JWT_SECRET, { expiresIn: "7d" });
export const signPlayer = (claims: Omit<PlayerClaims, "kind">) => jwt.sign({ ...claims, kind: "player" }, config.JWT_SECRET, { expiresIn: "24h" });
export const verifyToken = (token: string) => jwt.verify(token, config.JWT_SECRET) as HostClaims | PlayerClaims;

function readBearer(req: Request) { const h = req.headers.authorization; return h?.startsWith("Bearer ") ? h.slice(7) : ""; }
export function optionalAuth(req: Request, _res: Response, next: NextFunction) { try { const token = readBearer(req); if (token) req.auth = verifyToken(token); } catch {} next(); }
export function requireHost(req: Request, res: Response, next: NextFunction) { try { const claims = verifyToken(readBearer(req)); if (claims.kind !== "host") throw new Error(); req.auth = claims; next(); } catch { res.status(401).json({ code: "UNAUTHORIZED", message: "Vui lòng đăng nhập bằng tài khoản host." }); } }
export function requirePlayer(req: Request, res: Response, next: NextFunction) { try { const claims = verifyToken(readBearer(req)); if (claims.kind !== "player") throw new Error(); req.auth = claims; next(); } catch { res.status(401).json({ code: "PLAYER_TOKEN_INVALID", message: "Phiên người chơi không hợp lệ hoặc đã hết hạn." }); } }
