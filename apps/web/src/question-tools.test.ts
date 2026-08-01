import { describe, expect, it } from "vitest";
import {
  isRevealedAnswerCorrect,
  makeBlankQuestion,
} from "./question-tools";

const tr = (_vi: string, en: string) => en;

describe("question tools", () => {
  it("creates valid defaults for every supported question type", () => {
    const types = [
      "SINGLE_CHOICE",
      "MULTIPLE_CHOICE",
      "TRUE_FALSE",
      "TEXT",
      "ORDERING",
      "RANGE",
      "INFO",
    ] as const;
    for (const type of types) {
      const question = makeBlankQuestion(type, tr);
      expect(question.type).toBe(type);
      expect(question.prompt.length).toBeGreaterThan(2);
    }
  });

  it("checks multiple, ordering, and range reveals correctly", () => {
    expect(
      isRevealedAnswerCorrect("MULTIPLE_CHOICE", '["b","a"]', {
        correctOptionId: "",
        acceptedAnswers: ["a", "b"],
      }),
    ).toBe(true);
    expect(
      isRevealedAnswerCorrect("ORDERING", '["a","b"]', {
        correctOptionId: "",
        acceptedAnswers: ["a", "b"],
      }),
    ).toBe(true);
    expect(
      isRevealedAnswerCorrect("RANGE", "12", {
        correctOptionId: "10",
        acceptedAnswers: ["2"],
      }),
    ).toBe(true);
  });
});
