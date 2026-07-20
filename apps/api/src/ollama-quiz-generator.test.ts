import { afterEach, describe, expect, it, vi } from "vitest";
import { generateQuizQuestionsSmart } from "./ollama-quiz-generator.js";

afterEach(() => vi.unstubAllGlobals());

describe("generateQuizQuestionsSmart", () => {
  it("maps a structured Ollama response into RankRush questions", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            model: "qwen2.5:3b",
            message: {
              content: JSON.stringify({
                questions: [
                  {
                    prompt: "Hành tinh nào gần Mặt Trời nhất?",
                    options: ["Sao Thủy", "Sao Kim", "Trái Đất", "Sao Hỏa"],
                    correctIndex: 0,
                    explanation: "Sao Thủy có quỹ đạo gần Mặt Trời nhất.",
                  },
                  {
                    prompt: "Hành tinh nào lớn nhất Hệ Mặt Trời?",
                    options: ["Sao Thổ", "Sao Mộc", "Sao Hỏa", "Sao Kim"],
                    correctIndex: 1,
                    explanation: "Sao Mộc là hành tinh lớn nhất Hệ Mặt Trời.",
                  },
                  {
                    prompt: "Trái Đất là hành tinh thứ mấy từ Mặt Trời?",
                    options: ["Thứ nhất", "Thứ hai", "Thứ ba", "Thứ tư"],
                    correctIndex: 2,
                    explanation: "Trái Đất đứng thứ ba tính từ Mặt Trời.",
                  },
                ],
              }),
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const result = await generateQuizQuestionsSmart({
      subject: "Hệ Mặt Trời",
      count: 3,
    });
    expect(result.provider).toBe("OLLAMA");
    expect(result.questions).toHaveLength(3);
    expect(result.questions[1]?.options[1]?.id).toBe(
      result.questions[1]?.correctOptionId,
    );
  });

  it("uses the local generator when Ollama is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const result = await generateQuizQuestionsSmart({
      subject: "Redis leaderboard",
      count: 3,
    });
    expect(result.provider).toBe("LOCAL_FALLBACK");
    expect(result.questions).toHaveLength(3);
    expect(result.warning).toContain("offline");
  });
});
