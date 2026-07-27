import { nanoid } from "nanoid";
import type { GeneratedQuestion } from "./quiz-generator.js";

const REQUIRED_HEADERS = ["question", "type", "correctanswer"] as const;

function normalizeHeader(value: string) {
  return value
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

function parseRows(input: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index]!;
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }
    if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(field.trim());
      field = "";
    } else if (character === "\n") {
      row.push(field.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
    } else if (character !== "\r") {
      field += character;
    }
  }
  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  if (quoted)
    throw Object.assign(new Error("Tệp CSV có dấu ngoặc kép chưa được đóng."), {
      status: 400,
      code: "CSV_INVALID",
    });
  return rows;
}

function normalizeType(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
  if (["singlechoice", "multiplechoice", "tracnghiem"].includes(normalized))
    return "SINGLE_CHOICE" as const;
  if (["truefalse", "dungsai"].includes(normalized))
    return "TRUE_FALSE" as const;
  if (["text", "shortanswer", "tuluan", "vanban"].includes(normalized))
    return "TEXT" as const;
  throw Object.assign(
    new Error(
      `Loại câu hỏi “${value}” không hợp lệ. Dùng SINGLE_CHOICE, TRUE_FALSE hoặc TEXT.`,
    ),
    { status: 400, code: "CSV_INVALID" },
  );
}

function rowValue(row: string[], headers: Map<string, number>, name: string) {
  const index = headers.get(normalizeHeader(name));
  return index === undefined ? "" : (row[index] || "").trim();
}

function parseTimeLimit(value: string) {
  const parsed = Number(value || 20);
  return Number.isFinite(parsed)
    ? Math.min(300, Math.max(5, Math.round(parsed)))
    : 20;
}

export function importQuizQuestionsFromCsv(input: string): GeneratedQuestion[] {
  const rows = parseRows(input);
  if (rows.length < 2)
    throw Object.assign(
      new Error("Tệp CSV phải có một hàng tiêu đề và ít nhất một câu hỏi."),
      { status: 400, code: "CSV_EMPTY" },
    );

  const headers = new Map(
    rows[0]!.map((header, index) => [normalizeHeader(header), index]),
  );
  const missing = REQUIRED_HEADERS.filter((header) => !headers.has(header));
  if (missing.length)
    throw Object.assign(
      new Error(
        `CSV thiếu cột bắt buộc: ${missing.join(", ")}. Hãy tải và dùng đúng tệp mẫu.`,
      ),
      { status: 400, code: "CSV_INVALID" },
    );

  const questions = rows.slice(1).map((row, rowIndex) => {
    const line = rowIndex + 2;
    const prompt = rowValue(row, headers, "question");
    if (prompt.length < 3)
      throw Object.assign(new Error(`Dòng ${line}: câu hỏi quá ngắn.`), {
        status: 400,
        code: "CSV_INVALID",
      });

    const type = normalizeType(rowValue(row, headers, "type"));
    const correctAnswer = rowValue(row, headers, "correctAnswer");
    const explanation = rowValue(row, headers, "explanation");
    const timeLimitSec = parseTimeLimit(rowValue(row, headers, "timeLimitSec"));

    if (type === "TEXT") {
      const acceptedAnswers = [
        correctAnswer,
        ...rowValue(row, headers, "acceptedAnswers").split("|"),
      ]
        .map((answer) => answer.trim())
        .filter(Boolean);
      if (!acceptedAnswers.length)
        throw Object.assign(
          new Error(`Dòng ${line}: câu TEXT cần ít nhất một đáp án đúng.`),
          { status: 400, code: "CSV_INVALID" },
        );
      return {
        type,
        prompt,
        options: [],
        correctOptionId: "",
        acceptedAnswers: [...new Set(acceptedAnswers)],
        timeLimitSec,
        basePoints: 600,
        order: rowIndex,
        explanation,
      };
    }

    const optionTexts =
      type === "TRUE_FALSE"
        ? ["Đúng", "Sai"]
        : ["optionA", "optionB", "optionC", "optionD", "optionE", "optionF"]
            .map((name) => rowValue(row, headers, name))
            .filter(Boolean);
    if (optionTexts.length < 2)
      throw Object.assign(
        new Error(`Dòng ${line}: câu trắc nghiệm cần ít nhất hai lựa chọn.`),
        { status: 400, code: "CSV_INVALID" },
      );

    const options = optionTexts.map((text) => ({ id: nanoid(8), text }));
    const letterIndex = /^[A-F]$/i.test(correctAnswer)
      ? correctAnswer.toUpperCase().charCodeAt(0) - 65
      : -1;
    const trueFalseIndex =
      type === "TRUE_FALSE"
        ? /^(true|đúng|dung|1)$/i.test(correctAnswer)
          ? 0
          : /^(false|sai|0)$/i.test(correctAnswer)
            ? 1
            : -1
        : -1;
    const exactIndex = optionTexts.findIndex(
      (option) => option.toLowerCase() === correctAnswer.toLowerCase(),
    );
    const correctIndex =
      trueFalseIndex >= 0
        ? trueFalseIndex
        : letterIndex >= 0
          ? letterIndex
          : exactIndex;
    if (correctIndex < 0 || correctIndex >= options.length)
      throw Object.assign(
        new Error(
          `Dòng ${line}: correctAnswer phải là ký tự A-F hoặc nội dung chính xác của đáp án đúng.`,
        ),
        { status: 400, code: "CSV_INVALID" },
      );

    return {
      type,
      prompt,
      options,
      correctOptionId: options[correctIndex]!.id,
      acceptedAnswers: [],
      timeLimitSec,
      basePoints: 600,
      order: rowIndex,
      explanation,
    };
  });

  if (questions.length > 100)
    throw Object.assign(new Error("Mỗi tệp CSV hỗ trợ tối đa 100 câu hỏi."), {
      status: 400,
      code: "CSV_TOO_LARGE",
    });
  return questions;
}

export const quizCsvTemplate = [
  "question,type,optionA,optionB,optionC,optionD,correctAnswer,acceptedAnswers,explanation,timeLimitSec",
  '"Thủ đô của Việt Nam là gì?",SINGLE_CHOICE,"Hà Nội","Huế","Đà Nẵng","TP.HCM",A,,"Hà Nội là thủ đô của Việt Nam.",20',
  '"Mặt Trời là một ngôi sao.",TRUE_FALSE,,,,,Đúng,,"Mặt Trời là ngôi sao ở trung tâm Hệ Mặt Trời.",15',
  '"Redis viết tắt của cụm từ nào?",TEXT,,,,,"Remote Dictionary Server","Redis|Remote Dictionary Server","Chấp nhận nhiều cách viết, ngăn cách bằng dấu |.",30',
].join("\r\n");
