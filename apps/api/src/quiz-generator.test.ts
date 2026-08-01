import { describe, expect, it } from "vitest";
import { generateQuizQuestions } from "./quiz-generator.js";

describe("generateQuizQuestions", () => {
  it("generates the requested number of questions from a known subject", () => {
    const questions = generateQuizQuestions({
      subject: "Redis leaderboard",
      count: 5,
    });
    expect(questions).toHaveLength(5);
    for (const question of questions) {
      expect(question.options).toHaveLength(4);
      expect(
        question.options.some(
          (option) => option.id === question.correctOptionId,
        ),
      ).toBe(true);
    }
  });

  it("grounds generated questions in document text", () => {
    const sourceText = [
      "Redis Sorted Set lưu mỗi thành viên cùng một score và duy trì thứ tự theo score.",
      "Lệnh ZINCRBY cộng dồn điểm của một thành viên theo cách nguyên tử.",
      "Lệnh ZREVRANGE đọc các thành viên từ điểm cao xuống điểm thấp.",
      "Redis Stream lưu chuỗi sự kiện theo thời gian để phục vụ truy vết.",
    ].join(" ");
    const questions = generateQuizQuestions({
      subject: "Redis",
      sourceText,
      count: 3,
    });
    expect(questions).toHaveLength(3);
    expect(questions[0]?.prompt).toContain("_____");
    expect(questions[0]?.explanation.length).toBeGreaterThan(30);
  });

  it("applies English and hard-difficulty settings in local fallback", () => {
    const questions = generateQuizQuestions({
      subject: "Redis leaderboard",
      count: 3,
      language: "en",
      difficulty: "HARD",
    });
    expect(questions).toHaveLength(3);
    expect(questions[0]?.prompt).toMatch(/^Which /);
    expect(questions.every((question) => question.timeLimitSec === 15)).toBe(
      true,
    );
    expect(questions.every((question) => question.basePoints === 800)).toBe(
      true,
    );
  });
});
