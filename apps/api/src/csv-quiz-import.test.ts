import { describe, expect, it } from "vitest";
import { importQuizQuestionsFromCsv } from "./csv-quiz-import.js";

describe("CSV quiz import", () => {
  it("imports choice, true/false and text questions with correct answers", () => {
    const csv = [
      "question,type,optionA,optionB,optionC,optionD,correctAnswer,acceptedAnswers,explanation,timeLimitSec",
      '"2 + 2 bằng bao nhiêu?",SINGLE_CHOICE,3,4,5,6,B,,Phép cộng cơ bản,10',
      '"Trái Đất hình cầu.",TRUE_FALSE,,,,,Đúng,,Kiến thức khoa học,15',
      '"Redis là gì?",TEXT,,,,,"Remote Dictionary Server","Redis|Remote Dictionary Server",Tên đầy đủ,30',
    ].join("\n");

    const questions = importQuizQuestionsFromCsv(csv);

    expect(questions).toHaveLength(3);
    expect(
      questions[0]?.options.find(
        (option) => option.id === questions[0]?.correctOptionId,
      )?.text,
    ).toBe("4");
    expect(
      questions[1]?.options.find(
        (option) => option.id === questions[1]?.correctOptionId,
      )?.text,
    ).toBe("Đúng");
    expect(questions[2]?.acceptedAnswers).toContain("Remote Dictionary Server");
  });

  it("rejects an invalid correct answer instead of guessing", () => {
    const csv = [
      "question,type,optionA,optionB,correctAnswer",
      "Câu hỏi hợp lệ,SINGLE_CHOICE,A,B,Z",
    ].join("\n");

    expect(() => importQuizQuestionsFromCsv(csv)).toThrow(
      /correctAnswer phải là ký tự A-F/,
    );
  });
});
