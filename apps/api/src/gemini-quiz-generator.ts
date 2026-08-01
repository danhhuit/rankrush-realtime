import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { nanoid } from "nanoid";
import { z } from "zod";
import type {
  QuestionQualityReview,
  QuizAiProvider,
  QuizGenerationInput,
  QuizGenerationResult,
} from "./ai-provider.js";
import { config } from "./config.js";
import { findDuplicateQuestionIndexes } from "./question-diversity.js";
import type { GeneratedQuestion } from "./quiz-generator.js";

const generatedTypeSchema = z.enum([
  "SINGLE_CHOICE",
  "MULTIPLE_CHOICE",
  "TRUE_FALSE",
  "TEXT",
  "ORDERING",
  "RANGE",
]);

const rawGeminiQuestionSchema = z
  .object({
    type: generatedTypeSchema,
    prompt: z.string().trim().min(3).max(500),
    options: z.array(z.string().trim().min(1).max(200)).max(8),
    correctIndexes: z.array(z.number().int().min(0).max(7)).max(8),
    acceptedAnswers: z.array(z.string().trim().min(1).max(300)).max(20),
    rangeMin: z.number(),
    rangeMax: z.number(),
    rangeTarget: z.number(),
    rangeTolerance: z.number().min(0),
    explanation: z.string().trim().min(5).max(500),
    sourceEvidence: z.string().trim().max(500),
  })
  .superRefine((question, context) => {
    const uniqueOptions = new Set(
      question.options.map((item) => item.toLocaleLowerCase("vi-VN")),
    );
    if (uniqueOptions.size !== question.options.length)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["options"],
        message: "Các lựa chọn không được trùng nhau.",
      });
    if (
      ["SINGLE_CHOICE", "TRUE_FALSE"].includes(question.type) &&
      (question.correctIndexes.length !== 1 ||
        question.options.length < 2 ||
        question.correctIndexes[0]! >= question.options.length)
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["correctIndexes"],
        message: "Câu hỏi cần đúng một đáp án hợp lệ.",
      });
    if (question.type === "TRUE_FALSE" && question.options.length !== 2)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["options"],
        message: "Câu Đúng/Sai phải có đúng hai lựa chọn.",
      });
    if (
      question.type === "MULTIPLE_CHOICE" &&
      (question.options.length < 3 ||
        question.correctIndexes.length < 2 ||
        new Set(question.correctIndexes).size !==
          question.correctIndexes.length ||
        question.correctIndexes.some((index) => index >= question.options.length))
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["correctIndexes"],
        message: "Câu nhiều đáp án cần ít nhất hai đáp án đúng hợp lệ.",
      });
    if (question.type === "TEXT" && !question.acceptedAnswers.length)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["acceptedAnswers"],
        message: "Câu nhập văn bản cần đáp án được chấp nhận.",
      });
    if (question.type === "ORDERING" && question.options.length < 3)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["options"],
        message: "Câu sắp xếp cần ít nhất ba mục.",
      });
    if (
      question.type === "RANGE" &&
      (question.rangeMin >= question.rangeMax ||
        question.rangeTarget < question.rangeMin ||
        question.rangeTarget > question.rangeMax)
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["rangeTarget"],
        message: "Cấu hình khoảng số không hợp lệ.",
      });
  });

const rawGeminiQuizSchema = z.object({
  questions: z.array(rawGeminiQuestionSchema),
});

const rawReviewSchema = z.object({
  reviews: z.array(
    z.object({
      index: z.number().int().min(0),
      qualityScore: z.number().int().min(0).max(100),
      groundedInSource: z.boolean(),
      answerIsCorrect: z.boolean(),
      questionIsUnambiguous: z.boolean(),
      distractorsArePlausible: z.boolean(),
      problems: z.array(z.string().trim().min(1).max(300)).max(10),
    }),
  ),
});

const questionJsonSchema = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: [
              "SINGLE_CHOICE",
              "MULTIPLE_CHOICE",
              "TRUE_FALSE",
              "TEXT",
              "ORDERING",
              "RANGE",
            ],
          },
          prompt: { type: "string" },
          options: { type: "array", items: { type: "string" } },
          correctIndexes: { type: "array", items: { type: "integer" } },
          acceptedAnswers: { type: "array", items: { type: "string" } },
          rangeMin: { type: "number" },
          rangeMax: { type: "number" },
          rangeTarget: { type: "number" },
          rangeTolerance: { type: "number" },
          explanation: { type: "string" },
          sourceEvidence: { type: "string" },
        },
        required: [
          "type",
          "prompt",
          "options",
          "correctIndexes",
          "acceptedAnswers",
          "rangeMin",
          "rangeMax",
          "rangeTarget",
          "rangeTolerance",
          "explanation",
          "sourceEvidence",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["questions"],
  additionalProperties: false,
} as const;

const reviewJsonSchema = {
  type: "object",
  properties: {
    reviews: {
      type: "array",
      items: {
        type: "object",
        properties: {
          index: { type: "integer" },
          qualityScore: { type: "integer" },
          groundedInSource: { type: "boolean" },
          answerIsCorrect: { type: "boolean" },
          questionIsUnambiguous: { type: "boolean" },
          distractorsArePlausible: { type: "boolean" },
          problems: { type: "array", items: { type: "string" } },
        },
        required: [
          "index",
          "qualityScore",
          "groundedInSource",
          "answerIsCorrect",
          "questionIsUnambiguous",
          "distractorsArePlausible",
          "problems",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["reviews"],
  additionalProperties: false,
} as const;

function client() {
  if (!config.GEMINI_API_KEY)
    throw new Error("GEMINI_API_KEY chưa được cấu hình.");
  return new GoogleGenAI({ apiKey: config.GEMINI_API_KEY });
}

async function generateJson<T>(
  prompt: string,
  schema: unknown,
  systemInstruction: string,
) {
  const response = await client().models.generateContent({
    model: config.GEMINI_MODEL,
    contents: prompt,
    config: {
      abortSignal: AbortSignal.timeout(config.GEMINI_TIMEOUT_MS),
      systemInstruction,
      responseMimeType: "application/json",
      responseJsonSchema: schema,
      thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
    },
  });
  if (!response.text) throw new Error("Gemini không trả về nội dung.");
  try {
    return JSON.parse(response.text) as T;
  } catch {
    throw new Error("Gemini trả về JSON không hợp lệ.");
  }
}

function blueprint(input: QuizGenerationInput, count = input.count) {
  const source = `${input.subject} ${input.context || ""} ${input.sourceText || ""}`;
  const hasUsefulNumbers = /\b\d+(?:[.,]\d+)?\b/.test(source);
  const baseTypes: Array<z.infer<typeof generatedTypeSchema>> = [
    "SINGLE_CHOICE",
    "MULTIPLE_CHOICE",
    "TEXT",
    "TRUE_FALSE",
    "ORDERING",
    ...(hasUsefulNumbers ? (["RANGE"] as const) : []),
  ];
  const cognitiveLevels = ["REMEMBER", "UNDERSTAND", "APPLY", "ANALYZE"];
  return Array.from({ length: count }, (_, index) => ({
    index,
    type: baseTypes[index % baseTypes.length],
    cognitiveLevel: cognitiveLevels[
      Math.min(
        cognitiveLevels.length - 1,
        Math.floor((index / Math.max(1, count)) * cognitiveLevels.length),
      )
    ],
  }));
}

function languageInstruction(input: QuizGenerationInput) {
  return input.language === "en"
    ? "Write all questions, answers, and explanations in English."
    : "Viết toàn bộ câu hỏi, đáp án và giải thích bằng tiếng Việt tự nhiên.";
}

function generationPrompt(
  input: QuizGenerationInput,
  count: number,
  avoidPrompts: string[] = [],
  feedback: string[] = [],
) {
  const source = input.sourceText?.replace(/\s+/g, " ").trim().slice(0, 120_000);
  return [
    `CHỦ ĐỀ: ${input.subject}`,
    input.context ? `YÊU CẦU CỦA HOST: ${input.context}` : "",
    `MỨC ĐỘ: ${input.difficulty || "MEDIUM"}`,
    `BLUEPRINT: ${JSON.stringify(blueprint(input, count))}`,
    source ? `TÀI LIỆU NGUỒN:\n${source}` : "",
    avoidPrompts.length
      ? `KHÔNG LẶP LẠI CÁC CÂU SAU:\n${avoidPrompts.join("\n")}`
      : "",
    feedback.length
      ? `CÁC LỖI PHẢI KHẮC PHỤC:\n${feedback.join("\n")}`
      : "",
    `Tạo đúng ${count} câu hỏi.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function generationSystemInstruction(input: QuizGenerationInput) {
  return [
    "Bạn là chuyên gia khảo thí và thiết kế học liệu.",
    languageInstruction(input),
    "Bám đúng blueprint, thay đổi cách hỏi và tránh lặp cấu trúc câu.",
    "Mỗi câu chỉ kiểm tra một mục tiêu rõ ràng; ưu tiên tình huống và vận dụng thay vì hỏi định nghĩa máy móc.",
    "Phương án nhiễu phải hợp lý, cùng loại ngữ nghĩa và không vô lý một cách dễ nhận ra.",
    "Không dùng 'tất cả đáp án trên', không đặt câu phủ định kép, không để lộ đáp án trong câu hỏi.",
    "Nếu có tài liệu nguồn, tuyệt đối không thêm dữ kiện ngoài tài liệu và sourceEvidence phải nêu căn cứ ngắn gọn.",
    "Với SINGLE_CHOICE/TRUE_FALSE: correctIndexes có đúng một phần tử.",
    "Với MULTIPLE_CHOICE: correctIndexes có ít nhất hai phần tử.",
    "Với TEXT: acceptedAnswers chứa các cách trả lời được chấp nhận.",
    "Với ORDERING: options phải nằm sẵn theo thứ tự đúng.",
    "Với RANGE: điền rangeMin, rangeMax, rangeTarget và rangeTolerance hợp lệ.",
    "Các trường không dùng vẫn phải trả mảng rỗng hoặc số 0 để đúng schema.",
  ].join(" ");
}

function toQuestions(
  rawQuestions: z.infer<typeof rawGeminiQuestionSchema>[],
): GeneratedQuestion[] {
  return rawQuestions.map((raw, order) => {
    if (raw.type === "RANGE") {
      const minimum = { id: nanoid(8), text: String(raw.rangeMin) };
      const maximum = { id: nanoid(8), text: String(raw.rangeMax) };
      return {
        type: raw.type,
        prompt: raw.prompt,
        options: [minimum, maximum],
        correctOptionId: String(raw.rangeTarget),
        acceptedAnswers: [String(raw.rangeTolerance)],
        timeLimitSec: 20,
        basePoints: 600,
        order,
        explanation: raw.explanation,
      };
    }
    const options = raw.options.map((text) => ({ id: nanoid(8), text }));
    const correctIds = raw.correctIndexes
      .map((index) => options[index]?.id)
      .filter((id): id is string => Boolean(id));
    return {
      type: raw.type,
      prompt: raw.prompt,
      options: raw.type === "TEXT" ? [] : options,
      correctOptionId:
        raw.type === "SINGLE_CHOICE" || raw.type === "TRUE_FALSE"
          ? correctIds[0] || ""
          : "",
      acceptedAnswers:
        raw.type === "TEXT"
          ? raw.acceptedAnswers
          : raw.type === "ORDERING"
            ? options.map((option) => option.id)
            : raw.type === "MULTIPLE_CHOICE"
              ? correctIds
              : [],
      timeLimitSec: 20,
      basePoints: 600,
      order,
      explanation: raw.explanation,
    };
  });
}

async function generateQuestions(
  input: QuizGenerationInput,
  count: number,
  avoidPrompts: string[] = [],
  feedback: string[] = [],
) {
  const raw = rawGeminiQuizSchema.parse(
    await generateJson(
      generationPrompt(input, count, avoidPrompts, feedback),
      {
        ...questionJsonSchema,
        properties: {
          ...questionJsonSchema.properties,
          questions: {
            ...questionJsonSchema.properties.questions,
            minItems: count,
            maxItems: count,
          },
        },
      },
      generationSystemInstruction(input),
    ),
  );
  if (raw.questions.length !== count)
    throw new Error(
      `Gemini tạo ${raw.questions.length}/${count} câu hỏi được yêu cầu.`,
    );
  return toQuestions(raw.questions);
}

async function reviewQuestions(
  input: QuizGenerationInput,
  questions: GeneratedQuestion[],
): Promise<QuestionQualityReview[]> {
  const source = input.sourceText?.replace(/\s+/g, " ").trim().slice(0, 120_000);
  const payload = questions.map((question, index) => ({
    index,
    type: question.type,
    prompt: question.prompt,
    options: question.options.map((option) => option.text),
    correctAnswers:
      question.type === "SINGLE_CHOICE" || question.type === "TRUE_FALSE"
        ? [
            question.options.find(
              (option) => option.id === question.correctOptionId,
            )?.text || "",
          ]
        : question.type === "MULTIPLE_CHOICE" ||
            question.type === "ORDERING"
          ? question.acceptedAnswers
              .map(
                (id) =>
                  question.options.find((option) => option.id === id)?.text,
              )
              .filter(Boolean)
          : question.type === "RANGE"
            ? [
                `${question.correctOptionId} ± ${question.acceptedAnswers[0] || "0"}`,
              ]
            : question.acceptedAnswers,
    explanation: question.explanation,
  }));
  const parsed = rawReviewSchema.parse(
    await generateJson(
      [
        `CHỦ ĐỀ: ${input.subject}`,
        source ? `TÀI LIỆU NGUỒN:\n${source}` : "",
        `CÂU HỎI CẦN KIỂM ĐỊNH:\n${JSON.stringify(payload)}`,
      ]
        .filter(Boolean)
        .join("\n\n"),
      {
        ...reviewJsonSchema,
        properties: {
          reviews: {
            ...reviewJsonSchema.properties.reviews,
            minItems: questions.length,
            maxItems: questions.length,
          },
        },
      },
      [
        "Bạn là kiểm định viên độc lập, nghiêm khắc.",
        source
          ? "Kiểm tra từng câu về độ chính xác, căn cứ tài liệu nguồn, độ rõ ràng và chất lượng phương án nhiễu."
          : "Không có tài liệu nguồn; kiểm tra độ chính xác theo kiến thức phổ thông đáng tin cậy, độ rõ ràng và chất lượng phương án nhiễu.",
        "Không mặc định tin phần giải thích hoặc đáp án được cung cấp.",
        "qualityScore từ 0 đến 100; câu sai đáp án hoặc không có căn cứ nguồn không được quá 50 điểm.",
        languageInstruction(input),
      ].join(" "),
    ),
  );
  if (parsed.reviews.length !== questions.length)
    throw new Error("Gemini reviewer không trả đủ kết quả kiểm định.");
  return parsed.reviews;
}

function lowQualityIndexes(
  reviews: QuestionQualityReview[],
  requireSourceGrounding: boolean,
) {
  return reviews
    .filter(
      (review) =>
        review.qualityScore < config.AI_MIN_QUALITY_SCORE ||
        !review.answerIsCorrect ||
        !review.questionIsUnambiguous ||
        (requireSourceGrounding && !review.groundedInSource),
    )
    .map((review) => review.index);
}

export async function generateWithGemini(
  input: QuizGenerationInput,
): Promise<QuizGenerationResult> {
  let questions = await generateQuestions(input, input.count);
  let reviews: QuestionQualityReview[] = [];
  let regeneratedCount = 0;

  if (config.AI_REVIEW_ENABLED && config.AI_REVIEW_PROVIDER === "GEMINI") {
    reviews = await reviewQuestions(input, questions);
    const rejected = new Set([
      ...lowQualityIndexes(reviews, Boolean(input.sourceText)),
      ...findDuplicateQuestionIndexes(questions),
    ]);
    if (rejected.size) {
      const indexes = [...rejected].filter((index) => index < questions.length);
      const feedback = indexes.flatMap((index) => {
        const review = reviews.find((item) => item.index === index);
        return review?.problems.length
          ? review.problems.map((problem) => `Câu ${index + 1}: ${problem}`)
          : [`Câu ${index + 1}: trùng hoặc quá giống câu khác.`];
      });
      const replacements = await generateQuestions(
        input,
        indexes.length,
        questions.map((question) => question.prompt),
        feedback,
      );
      const next = [...questions];
      indexes.forEach((index, replacementIndex) => {
        next[index] = { ...replacements[replacementIndex]!, order: index };
      });
      questions = next;
      regeneratedCount = indexes.length;
      reviews = await reviewQuestions(input, questions);
    }
  }

  const averageQualityScore = reviews.length
    ? Math.round(
        reviews.reduce((sum, review) => sum + review.qualityScore, 0) /
          reviews.length,
      )
    : undefined;
  const remainingLowQuality = reviews.length
    ? lowQualityIndexes(reviews, Boolean(input.sourceText))
    : [];
  const remainingDuplicates = findDuplicateQuestionIndexes(questions);
  return {
    questions: questions.map((question, order) => ({ ...question, order })),
    provider: "GEMINI",
    model: config.GEMINI_MODEL,
    reviewed: reviews.length > 0,
    averageQualityScore,
    regeneratedCount,
    warning:
      reviews.length &&
      (remainingLowQuality.length || remainingDuplicates.length)
        ? "Một số câu vẫn chưa đạt ngưỡng chất lượng; Host cần rà soát trước khi xuất bản."
        : undefined,
  };
}

export async function getGeminiStatus() {
  if (!config.GEMINI_API_KEY)
    return {
      enabled: config.AI_PROVIDER === "GEMINI",
      configured: false,
      reachable: false,
      model: config.GEMINI_MODEL,
      error: "GEMINI_API_KEY chưa được cấu hình.",
    };
  try {
    const model = await client().models.get({
      model: config.GEMINI_MODEL,
      config: {
        abortSignal: AbortSignal.timeout(Math.min(config.GEMINI_TIMEOUT_MS, 5000)),
      },
    });
    return {
      enabled: true,
      configured: true,
      reachable: true,
      model: config.GEMINI_MODEL,
      displayName: model.displayName,
    };
  } catch (error) {
    return {
      enabled: true,
      configured: true,
      reachable: false,
      model: config.GEMINI_MODEL,
      error: (error as Error).message,
    };
  }
}

export const geminiProvider: QuizAiProvider = {
  name: "GEMINI",
  model: config.GEMINI_MODEL,
  generate: generateWithGemini,
  status: getGeminiStatus,
};
