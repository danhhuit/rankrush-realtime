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
): GeneratedQuestion {
  const values = [correct, ...distractors.filter((x) => x !== correct)].slice(
    0,
    4,
  );
  while (values.length < 4) values.push(`Lựa chọn ${values.length + 1}`);
  const options = values.map((text) => ({ id: nanoid(8), text }));
  return {
    type: "SINGLE_CHOICE",
    prompt,
    options,
    correctOptionId: options[0]!.id,
    acceptedAnswers: [],
    timeLimitSec: 20,
    basePoints: 600,
    order,
    explanation,
  };
}

function fromDocument(source: string, count: number) {
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
    const prompt = `Điền khái niệm còn thiếu: ${sentence.replace(
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

function fromSubject(subject: string, count: number) {
  const bank = subjectBanks.find((item) => item.match.test(subject));
  const facts = bank?.facts ?? [
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
  return Array.from({ length: count }, (_, index) => {
    const [prompt, correct, distractors] = facts[index % facts.length]!;
    return optionQuestion(
      prompt,
      correct,
      distractors,
      index,
      `Nội dung được tạo từ chủ đề “${subject}”; Host nên rà soát trước khi xuất bản.`,
    );
  });
}

export function generateQuizQuestions(input: {
  subject: string;
  sourceText?: string;
  count: number;
}) {
  const fromPdf = input.sourceText
    ? fromDocument(input.sourceText, input.count)
    : [];
  if (fromPdf.length >= Math.min(3, input.count)) return fromPdf;
  return fromSubject(input.subject, input.count);
}
