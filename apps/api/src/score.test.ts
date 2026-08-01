import { describe, expect, it } from "vitest";
import { calculateScore, normalizeText } from "./score.js";

describe("calculateScore", () => {
  it("returns zero for an incorrect answer", () =>
    expect(calculateScore(20, 1000, false)).toBe(0));
  it("awards one thousand points for an immediate correct answer", () =>
    expect(calculateScore(20, 0, true)).toBe(1000));
  it("drops through ten score bands as time passes", () => {
    expect(calculateScore(20, 2500, true)).toBe(900);
    expect(calculateScore(20, 19000, true)).toBe(100);
  });
  it("doubles the final question score", () =>
    expect(calculateScore(20, 0, true, true)).toBe(2000));
});
describe("normalizeText", () =>
  it("normalizes whitespace and case", () =>
    expect(normalizeText("  Redis   ZSET ")).toBe("redis zset")));
