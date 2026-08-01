import { describe, expect, it } from "vitest";
import { validateAvatarValue } from "./avatar.js";

describe("validateAvatarValue", () => {
  it("accepts empty, generated and preset avatars", () => {
    expect(validateAvatarValue("")).toBeNull();
    expect(validateAvatarValue("human|1|0|4|3")).toBeNull();
    expect(validateAvatarValue("🦊")).toBeNull();
  });

  it("accepts supported image data URLs with matching signatures", () => {
    expect(
      validateAvatarValue("data:image/png;base64,iVBORw0KGgo="),
    ).toBeNull();
    expect(validateAvatarValue("data:image/jpeg;base64,/9j/")).toBeNull();
    expect(
      validateAvatarValue(
        `data:image/webp;base64,${Buffer.from("RIFFxxxxWEBP").toString("base64")}`,
      ),
    ).toBeNull();
  });

  it("rejects malformed, unsafe and oversized values", () => {
    expect(validateAvatarValue("data:image/png;base64,dGV4dA==")).toBe(
      "INVALID",
    );
    expect(validateAvatarValue("data:image/svg+xml;base64,PHN2Zz4=")).toBe(
      "INVALID",
    );
    expect(validateAvatarValue("<img src=x>")).toBe("INVALID");
    expect(validateAvatarValue("x".repeat(700_000))).toBe("TOO_LARGE");
  });
});
