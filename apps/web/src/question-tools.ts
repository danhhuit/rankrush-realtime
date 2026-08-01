import type { Question } from "./types";
import { createClientId } from "./client-id";

export type Translate = (vi: string, en: string) => string;

export const questionTypeItems: Array<{
  type: Question["type"];
  icon: string;
  vi: string;
  en: string;
  viDescription: string;
  enDescription: string;
}> = [
  {
    type: "SINGLE_CHOICE",
    icon: "●",
    vi: "Một đáp án",
    en: "Single choice",
    viDescription: "Chọn một đáp án đúng",
    enDescription: "Choose one correct answer",
  },
  {
    type: "MULTIPLE_CHOICE",
    icon: "☑",
    vi: "Nhiều đáp án",
    en: "Multiple choice",
    viDescription: "Chọn tất cả đáp án đúng",
    enDescription: "Choose every correct answer",
  },
  {
    type: "ORDERING",
    icon: "≡",
    vi: "Sắp xếp",
    en: "Ordering",
    viDescription: "Đưa các đáp án về đúng thứ tự",
    enDescription: "Put answers in the correct order",
  },
  {
    type: "RANGE",
    icon: "↔",
    vi: "Khoảng số",
    en: "Number range",
    viDescription: "Đoán một giá trị trên thang số",
    enDescription: "Guess a value on a numeric scale",
  },
  {
    type: "TRUE_FALSE",
    icon: "✓",
    vi: "Đúng / Sai",
    en: "True / False",
    viDescription: "Xác định nhận định đúng hay sai",
    enDescription: "Decide whether a statement is true",
  },
  {
    type: "TEXT",
    icon: "Aa",
    vi: "Nhập câu trả lời",
    en: "Type answer",
    viDescription: "Người chơi tự nhập đáp án",
    enDescription: "Players type the answer",
  },
  {
    type: "INFO",
    icon: "i",
    vi: "Trang thông tin",
    en: "Info slide",
    viDescription: "Cung cấp nội dung, không chấm điểm",
    enDescription: "Provide context without scoring",
  },
];

export function questionTypeLabel(type: Question["type"], tr: Translate) {
  const item = questionTypeItems.find((entry) => entry.type === type);
  return item ? tr(item.vi, item.en) : type;
}

export function makeBlankQuestion(
  type: Question["type"],
  tr: Translate,
  order = 0,
): Omit<Question, "id" | "quizId"> {
  const option = (vi: string, en: string) => ({
    id: createClientId(),
    text: tr(vi, en),
  });
  const a = option("Đáp án A", "Answer A");
  const b = option("Đáp án B", "Answer B");
  const c = option("Đáp án C", "Answer C");
  const common = {
    prompt:
      type === "INFO"
        ? tr("Nội dung mới", "New information")
        : tr("Câu hỏi mới", "New question"),
    timeLimitSec: type === "INFO" ? 10 : 20,
    basePoints: 600,
    order,
    explanation: "",
  };
  switch (type) {
    case "MULTIPLE_CHOICE":
      return {
        ...common,
        type,
        options: [a, b, c],
        correctOptionId: "",
        acceptedAnswers: [a.id],
      };
    case "ORDERING":
      return {
        ...common,
        type,
        options: [a, b, c],
        correctOptionId: "",
        acceptedAnswers: [a.id, b.id, c.id],
      };
    case "RANGE": {
      const minimum = { id: createClientId(), text: "0" };
      const maximum = { id: createClientId(), text: "100" };
      return {
        ...common,
        type,
        options: [minimum, maximum],
        correctOptionId: "50",
        acceptedAnswers: ["5"],
      };
    }
    case "TRUE_FALSE": {
      const truth = option("Đúng", "True");
      const falsity = option("Sai", "False");
      return {
        ...common,
        type,
        options: [truth, falsity],
        correctOptionId: truth.id,
        acceptedAnswers: [],
      };
    }
    case "TEXT":
      return {
        ...common,
        type,
        options: [],
        correctOptionId: "",
        acceptedAnswers: [tr("Đáp án", "Answer")],
      };
    case "INFO":
      return {
        ...common,
        type,
        options: [],
        correctOptionId: "",
        acceptedAnswers: [],
      };
    default:
      return {
        ...common,
        type: "SINGLE_CHOICE",
        options: [a, b],
        correctOptionId: a.id,
        acceptedAnswers: [],
      };
  }
}

export function parseAnswerList(value: string) {
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

export function isRevealedAnswerCorrect(
  type: Question["type"],
  selected: string,
  reveal: { correctOptionId: string; acceptedAnswers: string[] },
) {
  if (type === "TEXT")
    return reveal.acceptedAnswers.some(
      (answer) =>
        answer.trim().toLocaleLowerCase("vi-VN").replace(/\s+/g, " ") ===
        selected.trim().toLocaleLowerCase("vi-VN").replace(/\s+/g, " "),
    );
  if (type === "MULTIPLE_CHOICE") {
    const values = parseAnswerList(selected);
    return (
      values.length === reveal.acceptedAnswers.length &&
      values.every((value) => reveal.acceptedAnswers.includes(value))
    );
  }
  if (type === "ORDERING") {
    const values = parseAnswerList(selected);
    return (
      values.length === reveal.acceptedAnswers.length &&
      values.every((value, index) => value === reveal.acceptedAnswers[index])
    );
  }
  if (type === "RANGE") {
    const value = Number(selected);
    const target = Number(reveal.correctOptionId);
    const tolerance = Number(reveal.acceptedAnswers[0] || "0");
    return (
      Number.isFinite(value) &&
      Number.isFinite(target) &&
      Math.abs(value - target) <= Math.abs(tolerance)
    );
  }
  return type !== "INFO" && selected === reveal.correctOptionId;
}
