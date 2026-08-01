import { nanoid } from "nanoid";
import type { Question } from "./types.js";

export type GeneratedQuestion = Pick<
  Question,
  | "type"
  | "prompt"
  | "options"
  | "correctOptionId"
  | "acceptedAnswers"
  | "timeLimitSec"
  | "basePoints"
  | "order"
  | "explanation"
>;
type GenerationLanguage = "vi" | "en";
type GenerationDifficulty = "EASY" | "MEDIUM" | "HARD";

const stopWords = new Set(
  "và là của có được trong một những cho với từ này đó các khi về trên dưới hoặc bằng vào theo để như không người the and for with from that this are was were have has".split(
    " ",
  ),
);

function cleanText(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, 30_000);
}

function keywords(text: string) {
  return [...new Set(text.match(/[\p{L}\p{N}-]{4,}/gu) ?? [])]
    .filter((word) => !stopWords.has(word.toLocaleLowerCase("vi-VN")))
    .sort((a, b) => b.length - a.length);
}

function optionQuestion(
  prompt: string,
  correct: string,
  distractors: string[],
  order: number,
  explanation: string,
  language: GenerationLanguage = "vi",
  difficulty: GenerationDifficulty = "MEDIUM",
): GeneratedQuestion {
  const values = [correct, ...distractors.filter((x) => x !== correct)].slice(
    0,
    4,
  );
  while (values.length < 4)
    values.push(
      language === "en"
        ? `Option ${values.length + 1}`
        : `Lựa chọn ${values.length + 1}`,
    );
  const options = values.map((text) => ({ id: nanoid(8), text }));
  return {
    type: "SINGLE_CHOICE",
    prompt,
    options,
    correctOptionId: options[0]!.id,
    acceptedAnswers: [],
    timeLimitSec: { EASY: 30, MEDIUM: 20, HARD: 15 }[difficulty],
    basePoints: { EASY: 400, MEDIUM: 600, HARD: 800 }[difficulty],
    order,
    explanation,
  };
}

function fromDocument(
  source: string,
  count: number,
  language: GenerationLanguage,
  difficulty: GenerationDifficulty,
) {
  const text = cleanText(source);
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 35 && sentence.length <= 260);
  const pool = keywords(text).slice(0, 80);
  const output: GeneratedQuestion[] = [];
  for (const sentence of sentences) {
    const correct = keywords(sentence)[0];
    if (!correct || output.some((q) => q.prompt.includes(correct))) continue;
    const prompt = `${language === "en" ? "Fill in the missing concept" : "Điền khái niệm còn thiếu"}: ${sentence.replace(
      new RegExp(correct.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
      "_____",
    )}`;
    const distractors = pool.filter(
      (word) =>
        word.toLocaleLowerCase("vi-VN") !== correct.toLocaleLowerCase("vi-VN"),
    );
    output.push(
      optionQuestion(
        prompt,
        correct,
        distractors.slice(output.length, output.length + 3),
        output.length,
        sentence,
        language,
        difficulty,
      ),
    );
    if (output.length >= count) break;
  }
  return output;
}

const subjectBanks: Array<{
  match: RegExp;
  facts: Array<[string, string, string[]]>;
}> = [
  {
    match: /redis|leaderboard|bảng xếp hạng/i,
    facts: [
      [
        "Cấu trúc Redis phù hợp nhất cho bảng xếp hạng?",
        "Sorted Set",
        ["List", "Hash", "Stream"],
      ],
      [
        "Lệnh cộng điểm cho một thành viên Sorted Set?",
        "ZINCRBY",
        ["LPUSH", "HSET", "SADD"],
      ],
      [
        "Lệnh lấy thứ hạng theo điểm giảm dần?",
        "ZREVRANK",
        ["ZRANK", "ZSCORE", "ZSCAN"],
      ],
      [
        "Lệnh lấy Top 10 theo điểm giảm dần?",
        "ZREVRANGE",
        ["LRANGE", "SMEMBERS", "GET"],
      ],
      [
        "Đặc tính quan trọng khi cộng điểm bằng ZINCRBY?",
        "Nguyên tử",
        ["Tuần tự thủ công", "Phụ thuộc frontend", "Luôn bất đồng bộ"],
      ],
    ],
  },
  {
    match: /nosql|cơ sở dữ liệu|database/i,
    facts: [
      [
        "NoSQL phù hợp với loại mô hình nào?",
        "Dữ liệu linh hoạt và tải lớn",
        ["Chỉ bảng cố định", "Chỉ file ảnh", "Không có truy vấn"],
      ],
      [
        "MongoDB lưu dữ liệu chủ yếu dưới dạng gì?",
        "Document",
        ["Đồ thị", "Hàng đợi", "Tệp nhị phân thuần"],
      ],
      [
        "Neo4j nổi bật với mô hình dữ liệu nào?",
        "Đồ thị",
        ["Key-value", "Cột rộng", "Document"],
      ],
      [
        "Cassandra thường được thiết kế theo hướng nào?",
        "Query-driven",
        ["JOIN-driven", "UI-driven", "File-driven"],
      ],
      [
        "Redis thường lưu dữ liệu làm việc chính ở đâu?",
        "Bộ nhớ",
        ["Băng từ", "GPU", "CDN"],
      ],
    ],
  },
  {
    match: /javascript|typescript|lập trình|programming/i,
    facts: [
      [
        "TypeScript bổ sung điều gì cho JavaScript?",
        "Hệ thống kiểu tĩnh",
        ["Cơ sở dữ liệu", "Trình duyệt mới", "Máy ảo riêng"],
      ],
      [
        "Promise dùng để biểu diễn điều gì?",
        "Kết quả bất đồng bộ",
        ["CSS selector", "Bảng dữ liệu", "Hình ảnh"],
      ],
      [
        "Từ khóa khai báo biến không thể gán lại?",
        "const",
        ["var", "let", "function"],
      ],
      [
        "Array.map thường trả về gì?",
        "Một mảng mới",
        ["Một boolean", "Một socket", "Không có giá trị"],
      ],
      [
        "JSON.parse dùng để làm gì?",
        "Chuyển chuỗi JSON thành giá trị",
        ["Mã hóa mật khẩu", "Nén ảnh", "Sắp xếp mảng"],
      ],
    ],
  },
];

const englishSubjectBanks: typeof subjectBanks = [
  {
    match: /redis|leaderboard|ranking/i,
    facts: [
      [
        "Which Redis data structure is best suited to a leaderboard?",
        "Sorted Set",
        ["List", "Hash", "Stream"],
      ],
      [
        "Which command atomically increments a Sorted Set member's score?",
        "ZINCRBY",
        ["LPUSH", "HSET", "SADD"],
      ],
      [
        "Which command returns a member's rank from highest score to lowest?",
        "ZREVRANK",
        ["ZRANK", "ZSCORE", "ZSCAN"],
      ],
      [
        "Which command reads the Top 10 from highest score to lowest?",
        "ZREVRANGE",
        ["LRANGE", "SMEMBERS", "GET"],
      ],
      [
        "What key property makes ZINCRBY suitable for concurrent scoring?",
        "Atomic execution",
        ["Manual sequencing", "Frontend ordering", "File locking"],
      ],
    ],
  },
  {
    match: /nosql|database/i,
    facts: [
      [
        "Which workload is commonly well suited to NoSQL?",
        "Flexible data at high scale",
        ["Only fixed tables", "Only image files", "Queries without data"],
      ],
      [
        "What is MongoDB's primary data model?",
        "Document",
        ["Graph", "Queue", "Plain binary file"],
      ],
      [
        "Which data model is Neo4j known for?",
        "Graph",
        ["Key-value", "Wide column", "Document"],
      ],
      [
        "How are Cassandra tables commonly designed?",
        "Around query patterns",
        ["Around joins", "Around UI colors", "Around file names"],
      ],
      [
        "Where does Redis primarily keep working data?",
        "Memory",
        ["Magnetic tape", "GPU memory only", "A CDN"],
      ],
    ],
  },
  {
    match: /javascript|typescript|programming/i,
    facts: [
      [
        "What does TypeScript add to JavaScript?",
        "A static type system",
        ["A database", "A new browser", "A separate virtual machine"],
      ],
      [
        "What does a Promise represent?",
        "An asynchronous result",
        ["A CSS selector", "A table", "An image"],
      ],
      [
        "Which keyword declares a binding that cannot be reassigned?",
        "const",
        ["var", "let", "function"],
      ],
      [
        "What does Array.map normally return?",
        "A new array",
        ["A boolean", "A socket", "No value"],
      ],
      [
        "What does JSON.parse do?",
        "Converts JSON text into a value",
        ["Hashes a password", "Compresses an image", "Sorts an array"],
      ],
    ],
  },
];

function fromSubject(
  subject: string,
  count: number,
  language: GenerationLanguage,
  difficulty: GenerationDifficulty,
) {
  const bank = (language === "en" ? englishSubjectBanks : subjectBanks).find(
    (item) => item.match.test(subject),
  );
  const fallbackFacts: Array<[string, string, string[]]> =
    language === "en"
      ? [
          [
            `What is the main goal when studying “${subject}”?`,
            "Understand concepts and apply them",
            ["Memorize keywords only", "Ignore examples", "Avoid practice"],
          ],
          [
            `How can understanding of “${subject}” be checked effectively?`,
            "Combine questions with scenarios",
            ["Read headings only", "Avoid feedback", "Measure time only"],
          ],
          [
            `What should you do first with a new concept in “${subject}”?`,
            "Identify its definition and an example",
            [
              "Ignore context",
              "Memorize an incorrect answer",
              "Avoid comparison",
            ],
          ],
          [
            `Which activity improves retention of “${subject}”?`,
            "Practice retrieving the knowledge",
            ["Skim it once", "Skip exercises", "Only view the answer"],
          ],
          [
            `What makes a good question about “${subject}”?`,
            "It is clear and has one best answer",
            [
              "It is ambiguous",
              "It omits required facts",
              "It has arbitrary answers",
            ],
          ],
        ]
      : [
          [
            `Mục tiêu chính khi học “${subject}” là gì?`,
            "Hiểu khái niệm và biết vận dụng",
            ["Chỉ học thuộc từ khóa", "Bỏ qua ví dụ", "Không cần thực hành"],
          ],
          [
            `Cách kiểm tra hiểu biết về “${subject}” hiệu quả nhất?`,
            "Kết hợp câu hỏi và tình huống",
            ["Chỉ đọc tiêu đề", "Không phản hồi", "Chỉ đo thời gian"],
          ],
          [
            `Khi gặp khái niệm mới trong “${subject}”, nên làm gì trước?`,
            "Xác định định nghĩa và ví dụ",
            ["Bỏ qua bối cảnh", "Ghi nhớ đáp án sai", "Không đối chiếu"],
          ],
          [
            `Hoạt động nào giúp ghi nhớ “${subject}” tốt hơn?`,
            "Thực hành truy hồi kiến thức",
            ["Đọc lướt một lần", "Không làm bài", "Chỉ xem đáp án"],
          ],
          [
            `Một câu hỏi tốt về “${subject}” cần đặc điểm gì?`,
            "Rõ ràng và có một đáp án tốt nhất",
            ["Mơ hồ", "Thiếu dữ kiện", "Nhiều đáp án tùy ý"],
          ],
        ];
  const facts = bank?.facts ?? fallbackFacts;
  return Array.from({ length: count }, (_, index) => {
    const [prompt, correct, distractors] = facts[index % facts.length]!;
    return optionQuestion(
      prompt,
      correct,
      distractors,
      index,
      language === "en"
        ? `Generated from the subject “${subject}”; the Host should review it before publishing.`
        : `Nội dung được tạo từ chủ đề “${subject}”; Host nên rà soát trước khi xuất bản.`,
      language,
      difficulty,
    );
  });
}

export function generateQuizQuestions(input: {
  subject: string;
  sourceText?: string;
  count: number;
  language?: GenerationLanguage;
  difficulty?: GenerationDifficulty;
}) {
  const language = input.language || "vi";
  const difficulty = input.difficulty || "MEDIUM";
  const fromPdf = input.sourceText
    ? fromDocument(input.sourceText, input.count, language, difficulty)
    : [];
  if (fromPdf.length >= Math.min(3, input.count)) return fromPdf;
  return fromSubject(input.subject, input.count, language, difficulty);
}
