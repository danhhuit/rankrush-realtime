import { describe, expect, it } from "vitest";
import {
  hasOnlinePlayers,
  shouldEndEmptySession,
} from "./session-presence.js";

describe("session presence", () => {
  it("detects whether at least one player is online", () => {
    expect(hasOnlinePlayers([{ online: false }, { online: true }])).toBe(true);
    expect(hasOnlinePlayers([{ online: false }])).toBe(false);
  });

  it("ends an active game when every player is offline", () => {
    expect(
      shouldEndEmptySession({ state: "RUNNING" }, [{ online: false }]),
    ).toBe(true);
    expect(shouldEndEmptySession({ state: "PAUSED" }, [])).toBe(true);
  });

  it("does not end a lobby, completed room, or room with an online player", () => {
    expect(shouldEndEmptySession({ state: "LOBBY" }, [])).toBe(false);
    expect(shouldEndEmptySession({ state: "ENDED" }, [])).toBe(false);
    expect(
      shouldEndEmptySession({ state: "RUNNING" }, [{ online: true }]),
    ).toBe(false);
  });
});
