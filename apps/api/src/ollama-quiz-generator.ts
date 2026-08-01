import { nanoid } from "nanoid";
import { z } from "zod";
import type {
  QuizGenerationInput,
  QuizGenerationResult,
} from "./ai-provider.js";
import { config } from "./config.js";
import {
  generateWithGemini,
  getGeminiStatus,
} from "./gemini-quiz-generator.js";
import {
  generateQuizQuestions,
  type GeneratedQuestion,
} from "./quiz-generator.js";

const rawQuestionSchema = z.object({
  prompt: z.string().trim().min(3).max(500),
  options: z
    .array(z.string().trim().min(1).max(200))
    .length(4)
    .refine(
      (items) => new Set(items.map((item) => item.toLowerCase())).size === 4,
      {
        message: "Bốn lựa chọn phải khác nhau.",
      },
    ),
  correctIndex: z.number().int().min(0).max(3),
  explanation: z.string().trim().min(5).max(500),
});

const rawQuizSchema = z.object({ questions: z.array(rawQuestionSchema) });
const chatResponseSchema = z.object({
  model: z.string().optional(),
  message: z.object({ content: z.string() }),
});
const tagsResponseSchema = z.object({
  models: z.array(
    z.object({
      name: z.string(),
      model: z.string().optional(),
      size: z.number().optional(),
    }),
  ),
});

const baseUrl = () => config.OLLAMA_BASE_URL.replace(/\/$/, "");

function outputSchema(questionCount: number) {
  return {
    type: "object",
    properties: {
      questions: {
        type: "array",
        minItems: questionCount,
        maxItems: questionCount,
        items: {
          type: "object",
          properties: {
            prompt: { type: "string" },
            options: {
              type: "array",
              minItems: 4,
              maxItems: 4,
              items: { type: "string" },
            },
            correctIndex: { type: "integer", minimum: 0, maximum: 3 },
            explanation: { type: "string" },
          },
          required: ["prompt", "options", "correctIndex", "explanation"],
          additionalProperties: false,
        },
      },
    },
    required: ["questions"],
    additionalProperties: false,
  } as const;
}

function toQuestions(
  rawQuestions: z.infer<typeof rawQuestionSchema>[],
): GeneratedQuestion[] {
  return rawQuestions.map((raw, order) => {
    const options = raw.options.map((text) => ({ id: nanoid(8), text }));
    return {
      type: "SINGLE_CHOICE",
      prompt: raw.prompt,
      options,
      correctOptionId: options[raw.correctIndex]!.id,
      acceptedAnswers: [],
      timeLimitSec: 20,
      basePoints: 600,
      order,
      explanation: raw.explanation,
    };
  });
}

export async function generateWithOllama(input: QuizGenerationInput) {
  const schema = outputSchema(input.count);
  const source = input.sourceText?.replace(/\s+/g, " ").trim().slice(0, 24_000);
  const groundingRule = source
    ? "Chỉ sử dụng dữ kiện có trong tài liệu. Không thêm kiến thức ngoài tài liệu."
    : "Sử dụng kiến thức phổ thông chính xác về chủ đề được cung cấp.";
  const content = source
    ? [
        `CHỦ ĐỀ: ${input.subject}`,
        input.context ? `YÊU CẦU CỦA HOST: ${input.context}` : "",
        `TÀI LIỆU NGUỒN:\n${source}`,
      ]
        .filter(Boolean)
        .join("\n\n")
    : [
        `CHỦ ĐỀ: ${input.subject}`,
        input.context ? `YÊU CẦU CỦA HOST: ${input.context}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");
  const languageRule =
    input.language === "en"
      ? "Write every question, option, and explanation in English."
      : "Viết toàn bộ câu hỏi, lựa chọn và giải thích bằng tiếng Việt.";
  const difficultyRule = {
    EASY: "Mức độ dễ: ưu tiên kiến thức nền tảng và diễn đạt trực tiếp.",
    MEDIUM: "Mức độ trung bình: yêu cầu hiểu và áp dụng kiến thức.",
    HARD: "Mức độ khó: ưu tiên phân tích, phân biệt các khái niệm gần nhau và suy luận.",
  }[input.difficulty || "MEDIUM"];

  const response = await fetch(`${baseUrl()}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(config.OLLAMA_TIMEOUT_MS),
    body: JSON.stringify({
      model: config.OLLAMA_MODEL,
      stream: false,
      format: schema,
      options: { temperature: 0.1, num_ctx: 8192 },
      messages: [
        {
          role: "system",
          content: [
            "Bạn là chuyên gia thiết kế câu hỏi trắc nghiệm.",
            `Tạo đúng ${input.count} câu hỏi, mỗi câu có đúng 4 lựa chọn và chỉ một đáp án đúng.`,
            languageRule,
            difficultyRule,
            "Câu hỏi phải rõ ràng; phương án nhiễu hợp lý; phần giải thích ngắn gọn và nêu căn cứ cho đáp án.",
            "Bám sát mục tiêu, phạm vi và đối tượng mà Host mô tả; không biến nguyên câu mô tả thành nội dung câu hỏi.",
            "Không tạo câu hỏi kiểu hỏi mục tiêu học tập chung chung. Mỗi câu phải kiểm tra một dữ kiện, khái niệm hoặc tình huống cụ thể.",
            "Tự xác định correctIndex từ kiến thức hoặc tài liệu nguồn; kiểm tra đáp án đúng khớp chính xác với một lựa chọn trước khi trả kết quả.",
            "Không tạo câu hỏi mơ hồ, không dùng lựa chọn kiểu 'tất cả đáp án trên'.",
            groundingRule,
            `Đầu ra phải tuân thủ JSON Schema sau: ${JSON.stringify(schema)}`,
          ].join(" "),
        },
        { role: "user", content },
      ],
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Ollama trả về HTTP ${response.status}: ${detail.slice(0, 300)}`,
    );
  }
  const chat = chatResponseSchema.parse(await response.json());
  const parsed = rawQuizSchema.parse(JSON.parse(chat.message.content));
  if (parsed.questions.length !== input.count)
    throw new Error(
      `Ollama tạo ${parsed.questions.length}/${input.count} câu hỏi.`,
    );
  return toQuestions(parsed.questions);
}

export async function getOllamaStatus() {
  if (!config.OLLAMA_ENABLED)
    return {
      enabled: false,
      reachable: false,
      model: config.OLLAMA_MODEL,
      modelInstalled: false,
      models: [] as string[],
    };
  try {
    const response = await fetch(`${baseUrl()}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const tags = tagsResponseSchema.parse(await response.json());
    const models = tags.models.map((item) => item.name);
    const requestedBase = config.OLLAMA_MODEL.replace(/:latest$/, "");
    return {
      enabled: true,
      reachable: true,
      model: config.OLLAMA_MODEL,
      modelInstalled: models.some(
        (model) =>
          model === config.OLLAMA_MODEL ||
          model.replace(/:latest$/, "") === requestedBase,
      ),
      models,
    };
  } catch (error) {
    return {
      enabled: true,
      reachable: false,
      model: config.OLLAMA_MODEL,
      modelInstalled: false,
      models: [] as string[],
      error: (error as Error).message,
    };
  }
}

export async function getAiStatus() {
  const [gemini, ollama] = await Promise.all([
    getGeminiStatus(),
    getOllamaStatus(),
  ]);
  const primary = config.AI_PROVIDER === "GEMINI" ? gemini : ollama;
  const reachable = Boolean(primary.reachable);
  return {
    ...primary,
    provider: config.AI_PROVIDER,
    modelInstalled:
      config.AI_PROVIDER === "GEMINI"
        ? reachable
        : Boolean("modelInstalled" in primary && primary.modelInstalled),
    models:
      config.AI_PROVIDER === "GEMINI"
        ? [config.GEMINI_MODEL]
        : "models" in primary
          ? primary.models
          : [],
    reviewEnabled: config.AI_REVIEW_ENABLED,
    reviewProvider: config.AI_REVIEW_PROVIDER,
    minQualityScore: config.AI_MIN_QUALITY_SCORE,
    providers: { gemini, ollama },
  };
}

export async function generateQuizQuestionsSmart(
  input: QuizGenerationInput,
): Promise<QuizGenerationResult> {
  const warnings: string[] = [];
  const primary = input.providerOverride || config.AI_PROVIDER;

  if (primary === "GEMINI") {
    try {
      return await generateWithGemini(input);
    } catch (error) {
      const message = (error as Error).message;
      warnings.push(`Gemini: ${message}`);
      console.warn(`[GEMINI_FALLBACK] ${message}`);
    }
  }

  const shouldTryOllama =
    primary === "OLLAMA" ||
    (primary === "GEMINI" && config.AI_FALLBACK_PROVIDER === "OLLAMA");
  if (shouldTryOllama && config.OLLAMA_ENABLED) {
    try {
      return {
        questions: await generateWithOllama(input),
        provider: "OLLAMA",
        model: config.OLLAMA_MODEL,
        warning: warnings.length ? warnings.join(" | ") : undefined,
      };
    } catch (error) {
      const message = (error as Error).message;
      warnings.push(`Ollama: ${message}`);
      console.warn(`[OLLAMA_FALLBACK] ${message}`);
    }
  }

  if (input.requireAi)
    throw new Error(
      warnings.join(" | ") || "Không có dịch vụ AI nào đang sẵn sàng.",
    );
  return {
    questions: generateQuizQuestions(input),
    provider: "LOCAL_FALLBACK",
    model: primary === "GEMINI" ? config.GEMINI_MODEL : config.OLLAMA_MODEL,
    warning:
      warnings.join(" | ") ||
      "Không có provider AI khả dụng; đang dùng bộ sinh cục bộ.",
  };
}
