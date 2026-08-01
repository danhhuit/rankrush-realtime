import { describe, expect, it } from "vitest";
import {
  findDuplicateQuestionIndexes,
  questionSimilarity,
} from "./question-diversity.js";

describe("question diversity", () => {
  it("detects near-duplicate prompts", () => {
    const similarity = questionSimilarity(
      "Redis Sorted Set được sử dụng để làm gì trong bảng xếp hạng?",
      "Trong bảng xếp hạng, Redis Sorted Set được dùng để làm gì?",
    );
    expect(similarity).toBeGreaterThan(0.7);
    expect(
      findDuplicateQuestionIndexes([
        { prompt: "Redis Sorted Set được sử dụng để làm gì?" },
        { prompt: "Redis Sorted Set được sử dụng để làm gì trong hệ thống?" },
        { prompt: "Lệnh ZINCRBY có tính chất nguyên tử nào?" },
      ]),
    ).toEqual([1]);
  });
});
