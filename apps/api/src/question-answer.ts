import { normalizeText } from "./score.js";
import type { Question } from "./types.js";

function parseAnswerList(value: string) {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) &&
      parsed.every((item): item is string => typeof item === "string")
      ? parsed
      : [];
  } catch {
    return [];
  }
}

function sameSet(left: string[], right: string[]) {
  return (
    left.length === right.length &&
    new Set(left).size === left.length &&
    left.every((item) => right.includes(item))
  );
}

export function isQuestionAnswerCorrect(
  question: Pick<
    Question,
    "type" | "correctOptionId" | "acceptedAnswers"
  >,
  answer: string,
) {
  switch (question.type) {
    case "TEXT":
      return question.acceptedAnswers.some(
        (item) => normalizeText(item) === normalizeText(answer),
      );
    case "MULTIPLE_CHOICE":
      return sameSet(parseAnswerList(answer), question.acceptedAnswers);
    case "ORDERING": {
      const ordered = parseAnswerList(answer);
      return (
        ordered.length === question.acceptedAnswers.length &&
        ordered.every((item, index) => item === question.acceptedAnswers[index])
      );
    }
    case "RANGE": {
      const submitted = Number(answer);
      const target = Number(question.correctOptionId);
      const tolerance = Number(question.acceptedAnswers[0] || "0");
      return (
        Number.isFinite(submitted) &&
        Number.isFinite(target) &&
        Number.isFinite(tolerance) &&
        Math.abs(submitted - target) <= Math.abs(tolerance)
      );
    }
    case "INFO":
      return false;
    default:
      return question.correctOptionId === answer;
  }
}
