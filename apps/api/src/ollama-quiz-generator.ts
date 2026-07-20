import { nanoid } from "nanoid";
import { z } from "zod";
import { config } from "./config.js";
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

export type QuizGenerationResult = {
  questions: GeneratedQuestion[];
  provider: "OLLAMA" | "LOCAL_FALLBACK";
  model: string;
  warning?: string;
};

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

async function generateWithOllama(input: {
  subject: string;
  sourceText?: string;
  count: number;
}) {
  const schema = outputSchema(input.count);
  const source = input.sourceText?.replace(/\s+/g, " ").trim().slice(0, 24_000);
  const groundingRule = source
    ? "Chỉ sử dụng dữ kiện có trong tài liệu. Không thêm kiến thức ngoài tài liệu."
    : "Sử dụng kiến thức phổ thông chính xác về chủ đề được cung cấp.";
  const content = source
    ? `CHỦ ĐỀ: ${input.subject}\n\nTÀI LIỆU NGUỒN:\n${source}`
    : `CHỦ ĐỀ: ${input.subject}`;

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
            "Bạn là chuyên gia thiết kế câu hỏi trắc nghiệm bằng tiếng Việt.",
            `Tạo đúng ${input.count} câu hỏi, mỗi câu có đúng 4 lựa chọn và chỉ một đáp án đúng.`,
            "Câu hỏi phải rõ ràng; phương án nhiễu hợp lý; phần giải thích ngắn gọn và nêu căn cứ cho đáp án.",
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

export async function generateQuizQuestionsSmart(input: {
  subject: string;
  sourceText?: string;
  count: number;
}): Promise<QuizGenerationResult> {
  if (config.OLLAMA_ENABLED) {
    try {
      return {
        questions: await generateWithOllama(input),
        provider: "OLLAMA",
        model: config.OLLAMA_MODEL,
      };
    } catch (error) {
      const warning = (error as Error).message;
      console.warn(`[OLLAMA_FALLBACK] ${warning}`);
      return {
        questions: generateQuizQuestions(input),
        provider: "LOCAL_FALLBACK",
        model: config.OLLAMA_MODEL,
        warning,
      };
    }
  }
  return {
    questions: generateQuizQuestions(input),
    provider: "LOCAL_FALLBACK",
    model: config.OLLAMA_MODEL,
    warning: "Ollama đã bị tắt bằng cấu hình OLLAMA_ENABLED.",
  };
}
