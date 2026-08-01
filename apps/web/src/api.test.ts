import { beforeEach, describe, expect, it } from "vitest";
import { ApiError, playerToken } from "./api";

describe("playerToken", () => {
  const values = new Map<string, string>();

  beforeEach(() => {
    values.clear();
    Object.defineProperty(globalThis, "sessionStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => values.get(key) ?? null,
      },
    });
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => (key === "rr_locale" ? "en" : null),
      },
    });
  });

  it("reads the player identity from tab-scoped session storage", () => {
    values.set("rr_player_session-a", "player-a-token");
    values.set("rr_player_session-b", "player-b-token");

    expect(playerToken("session-a")).toBe("player-a-token");
    expect(playerToken("session-b")).toBe("player-b-token");
  });

  it("localizes coded API errors when English is selected", () => {
    expect(
      new ApiError(404, {
        code: "PIN_NOT_FOUND",
        message: "PIN không tồn tại.",
      }).message,
    ).toBe("The PIN does not exist or has expired.");
  });

  it("replaces corrupted server text with a proper Vietnamese message", () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => (key === "rr_locale" ? "vi" : null),
      },
    });

    expect(
      new ApiError(409, {
        code: "USERNAME_EXISTS",
        message: "TÃªn Ä‘Äƒng nháº­p Ä‘Ã£ Ä‘Æ°á»£c sá»­ dá»¥ng.",
      }).message,
    ).toBe("Tên đăng nhập đã được sử dụng.");
  });
});
