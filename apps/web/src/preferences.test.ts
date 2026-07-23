import { describe, expect, it } from "vitest";
import { normalizeThemePreference, resolveTheme } from "./preferences";

describe("theme preferences", () => {
  it("uses the operating system theme in system mode", () => {
    expect(resolveTheme("system", "dark")).toBe("dark");
    expect(resolveTheme("system", "light")).toBe("light");
  });

  it("keeps a manual light or dark choice", () => {
    expect(resolveTheme("light", "dark")).toBe("light");
    expect(resolveTheme("dark", "light")).toBe("dark");
  });

  it("migrates an unknown stored value to system mode", () => {
    expect(normalizeThemePreference("dark")).toBe("dark");
    expect(normalizeThemePreference("invalid")).toBe("system");
    expect(normalizeThemePreference(null)).toBe("system");
  });
});
