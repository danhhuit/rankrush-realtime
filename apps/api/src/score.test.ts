import { describe, expect, it } from "vitest";
import { calculateScore, normalizeText } from "./score.js";

describe("calculateScore",()=>{
  it("returns zero for incorrect answer",()=>expect(calculateScore(600,20,1000,false)).toBe(0));
  it("rewards faster correct answers",()=>expect(calculateScore(600,20,1000,true)).toBeGreaterThan(calculateScore(600,20,18000,true)));
  it("returns base score when speed scoring is off",()=>expect(calculateScore(600,20,1000,true,false)).toBe(600));
  it("never drops below base score",()=>expect(calculateScore(600,20,999999,true)).toBe(600));
});
describe("normalizeText",()=>it("normalizes whitespace and case",()=>expect(normalizeText("  Redis   ZSET ")).toBe("redis zset")));
