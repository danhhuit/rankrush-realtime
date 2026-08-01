import { describe, expect, it } from "vitest";
import { isQuestionAnswerCorrect } from "./question-answer.js";
import type { Question } from "./types.js";

const base = {
  correctOptionId: "",
  acceptedAnswers: [],
} as Pick<Question, "correctOptionId" | "acceptedAnswers">;

describe("isQuestionAnswerCorrect", () => {
  it("matches text answers without case or extra spaces", () => {
    expect(
      isQuestionAnswerCorrect(
        { ...base, type: "TEXT", acceptedAnswers: ["Hà Nội"] },
        "  hà   nội ",
      ),
    ).toBe(true);
  });

  it("matches multiple-choice answers regardless of selection order", () => {
    expect(
      isQuestionAnswerCorrect(
        {
          ...base,
          type: "MULTIPLE_CHOICE",
          acceptedAnswers: ["a", "c"],
        },
        JSON.stringify(["c", "a"]),
      ),
    ).toBe(true);
  });

  it("requires the exact ordering", () => {
    const question = {
      ...base,
      type: "ORDERING" as const,
      acceptedAnswers: ["a", "b", "c"],
    };
    expect(isQuestionAnswerCorrect(question, '["a","b","c"]')).toBe(true);
    expect(isQuestionAnswerCorrect(question, '["b","a","c"]')).toBe(false);
  });

  it("accepts a number inside the configured tolerance", () => {
    const question = {
      ...base,
      type: "RANGE" as const,
      correctOptionId: "50",
      acceptedAnswers: ["5"],
    };
    expect(isQuestionAnswerCorrect(question, "54")).toBe(true);
    expect(isQuestionAnswerCorrect(question, "56")).toBe(false);
  });

  it("does not score an information slide", () => {
    expect(
      isQuestionAnswerCorrect({ ...base, type: "INFO" }, ""),
    ).toBe(false);
  });
});
