import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { requireAdmin, signHost, signPlayer } from "./auth.js";

function run(token: string) {
  const req = {
    headers: { authorization: `Bearer ${token}` },
  } as Request;
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const res = { status } as unknown as Response;
  const next = vi.fn() as NextFunction;
  requireAdmin(req, res, next);
  return { req, status, json, next };
}

describe("requireAdmin", () => {
  it("accepts an ADMIN host token", () => {
    const result = run(
      signHost({
        sub: "admin-1",
        email: "admin@rankrush.local",
        role: "ADMIN",
      }),
    );
    expect(result.next).toHaveBeenCalledOnce();
    expect(result.req.auth).toMatchObject({ sub: "admin-1", role: "ADMIN" });
    expect(result.status).not.toHaveBeenCalled();
  });

  it("rejects a regular HOST with 403", () => {
    const result = run(
      signHost({
        sub: "host-1",
        email: "host@rankrush.local",
        role: "HOST",
      }),
    );
    expect(result.next).not.toHaveBeenCalled();
    expect(result.status).toHaveBeenCalledWith(403);
    expect(result.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "ADMIN_REQUIRED" }),
    );
  });

  it("rejects a player token with 401", () => {
    const result = run(signPlayer({ sub: "player-1", sessionId: "session-1" }));
    expect(result.next).not.toHaveBeenCalled();
    expect(result.status).toHaveBeenCalledWith(401);
    expect(result.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "UNAUTHORIZED" }),
    );
  });
});
