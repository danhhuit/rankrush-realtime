import { connectRedis, closeRedis } from "./redis.js";
import {
  getQuiz,
  getUserByEmail,
  listQuizzes,
  saveQuestion,
  saveQuiz,
} from "./store.js";
import type { Question, Quiz } from "./types.js";

type Fact = [
  prompt: string,
  correct: string,
  distractors: string[],
  explanation: string,
];
type Pack = {
  id: string;
  title: string;
  category: string;
  subcategory: string;
  popularity: number;
  color: string;
  facts: Fact[];
};

const packs: Pack[] = [
  {
    id: "library-cinema",
    title: "Điện ảnh đại chúng",
    category: "Art & Literature",
    subcategory: "Entertainment",
    popularity: 98,
    color: "#E85D75",
    facts: [
      [
        "Oscar là giải thưởng nổi tiếng thuộc lĩnh vực nào?",
        "Điện ảnh",
        ["Kiến trúc", "Thiên văn", "Bóng đá"],
        "Oscar gắn với ngành công nghiệp điện ảnh.",
      ],
      [
        "Người chỉ đạo diễn xuất và hình ảnh của một bộ phim là ai?",
        "Đạo diễn",
        ["Biên tập viên sách", "Nhạc trưởng", "Kiến trúc sư"],
        "Đạo diễn chịu trách nhiệm định hướng sáng tạo của phim.",
      ],
      [
        "Thể loại phim tạo cảm giác hồi hộp và sợ hãi?",
        "Kinh dị",
        ["Tài liệu", "Hoạt hình giáo dục", "Ca nhạc"],
        "Phim kinh dị tập trung vào cảm giác sợ hãi và căng thẳng.",
      ],
    ],
  },
  {
    id: "library-books",
    title: "Văn học thế giới",
    category: "Art & Literature",
    subcategory: "Books",
    popularity: 84,
    color: "#7C5CFC",
    facts: [
      [
        "Ai là tác giả của Romeo and Juliet?",
        "William Shakespeare",
        ["Victor Hugo", "Homer", "Mark Twain"],
        "Romeo and Juliet là bi kịch của Shakespeare.",
      ],
      [
        "Don Quixote được viết bởi ai?",
        "Miguel de Cervantes",
        ["Dante Alighieri", "Franz Kafka", "Leo Tolstoy"],
        "Cervantes là tác giả Don Quixote.",
      ],
      [
        "Thể loại kể chuyện dài bằng văn xuôi thường gọi là gì?",
        "Tiểu thuyết",
        ["Sonnet", "Kịch câm", "Tranh sơn dầu"],
        "Tiểu thuyết là tác phẩm tự sự dài bằng văn xuôi.",
      ],
    ],
  },
  {
    id: "library-visual-arts",
    title: "Hội họa và nghệ thuật",
    category: "Art & Literature",
    subcategory: "Visual Arts",
    popularity: 79,
    color: "#F39C4A",
    facts: [
      [
        "Mona Lisa là tác phẩm của ai?",
        "Leonardo da Vinci",
        ["Pablo Picasso", "Claude Monet", "Vincent van Gogh"],
        "Leonardo da Vinci vẽ Mona Lisa.",
      ],
      [
        "Màu nào là màu cơ bản trong hội họa truyền thống?",
        "Đỏ",
        ["Nâu", "Hồng", "Xám"],
        "Đỏ, vàng và xanh lam là các màu cơ bản truyền thống.",
      ],
      [
        "Trường phái của Claude Monet là gì?",
        "Ấn tượng",
        ["Lập thể", "Siêu thực", "Pop Art"],
        "Monet là đại diện tiêu biểu của trường phái Ấn tượng.",
      ],
    ],
  },
  {
    id: "library-astronomy",
    title: "Khám phá vũ trụ",
    category: "Science & Nature",
    subcategory: "Astronomy",
    popularity: 91,
    color: "#3D63DD",
    facts: [
      [
        "Hành tinh gần Mặt Trời nhất?",
        "Sao Thủy",
        ["Sao Kim", "Trái Đất", "Sao Hỏa"],
        "Sao Thủy là hành tinh gần Mặt Trời nhất.",
      ],
      [
        "Thiên hà chứa Hệ Mặt Trời có tên gì?",
        "Ngân Hà",
        ["Andromeda", "Sombrero", "Whirlpool"],
        "Hệ Mặt Trời nằm trong thiên hà Ngân Hà.",
      ],
      [
        "Vệ tinh tự nhiên của Trái Đất?",
        "Mặt Trăng",
        ["Titan", "Europa", "Phobos"],
        "Mặt Trăng là vệ tinh tự nhiên duy nhất của Trái Đất.",
      ],
    ],
  },
  {
    id: "library-biology",
    title: "Sinh học quanh ta",
    category: "Science & Nature",
    subcategory: "Biology",
    popularity: 82,
    color: "#1F9D72",
    facts: [
      [
        "Đơn vị cơ bản của sự sống?",
        "Tế bào",
        ["Nguyên tử", "Khoáng vật", "Tinh thể"],
        "Tế bào là đơn vị cấu trúc và chức năng cơ bản của sự sống.",
      ],
      [
        "Thực vật tạo chất hữu cơ nhờ quá trình nào?",
        "Quang hợp",
        ["Bay hơi", "Ngưng tụ", "Kết tinh"],
        "Quang hợp sử dụng ánh sáng để tổng hợp chất hữu cơ.",
      ],
      [
        "Cơ quan bơm máu trong cơ thể người?",
        "Tim",
        ["Phổi", "Gan", "Dạ dày"],
        "Tim co bóp để bơm máu qua hệ tuần hoàn.",
      ],
    ],
  },
  {
    id: "library-ancient-history",
    title: "Các nền văn minh cổ",
    category: "History & Geography",
    subcategory: "Ancient History",
    popularity: 86,
    color: "#A66A3F",
    facts: [
      [
        "Kim tự tháp Giza thuộc nền văn minh nào?",
        "Ai Cập cổ đại",
        ["La Mã", "Maya", "Hy Lạp"],
        "Kim tự tháp Giza được xây dựng ở Ai Cập cổ đại.",
      ],
      [
        "Thành phố Pompeii bị chôn vùi bởi núi lửa nào?",
        "Vesuvius",
        ["Fuji", "Etna", "Kilimanjaro"],
        "Núi Vesuvius phun trào năm 79 và chôn vùi Pompeii.",
      ],
      [
        "Thế vận hội cổ đại bắt nguồn từ đâu?",
        "Hy Lạp",
        ["Ai Cập", "Ấn Độ", "Ba Tư"],
        "Olympic cổ đại bắt nguồn tại Olympia, Hy Lạp.",
      ],
    ],
  },
  {
    id: "library-geography",
    title: "Địa lý thế giới",
    category: "History & Geography",
    subcategory: "World Geography",
    popularity: 88,
    color: "#2B8A9A",
    facts: [
      [
        "Đại dương lớn nhất thế giới?",
        "Thái Bình Dương",
        ["Đại Tây Dương", "Ấn Độ Dương", "Bắc Băng Dương"],
        "Thái Bình Dương có diện tích lớn nhất.",
      ],
      [
        "Sa mạc Sahara nằm ở châu lục nào?",
        "Châu Phi",
        ["Châu Á", "Châu Âu", "Nam Mỹ"],
        "Sahara trải rộng ở Bắc Phi.",
      ],
      [
        "Thủ đô của Nhật Bản?",
        "Tokyo",
        ["Osaka", "Kyoto", "Nagoya"],
        "Tokyo là thủ đô Nhật Bản.",
      ],
    ],
  },
  {
    id: "library-football",
    title: "Bóng đá thế giới",
    category: "Sports",
    subcategory: "Football",
    popularity: 93,
    color: "#319B62",
    facts: [
      [
        "Một đội bóng đá có bao nhiêu cầu thủ trên sân khi đủ người?",
        "11",
        ["9", "10", "12"],
        "Mỗi đội có 11 cầu thủ trên sân.",
      ],
      [
        "Cơ quan quản lý bóng đá thế giới?",
        "FIFA",
        ["IOC", "NBA", "ATP"],
        "FIFA là liên đoàn bóng đá thế giới.",
      ],
      [
        "Thẻ nào truất quyền thi đấu trực tiếp?",
        "Thẻ đỏ",
        ["Thẻ vàng", "Thẻ xanh", "Thẻ trắng"],
        "Thẻ đỏ buộc cầu thủ rời sân.",
      ],
    ],
  },
];

async function seedLibrary() {
  await connectRedis();
  const owner = await getUserByEmail("admin@rankrush.local");
  if (!owner)
    throw new Error("Hãy chạy seed chính để tạo tài khoản demo trước.");
  const existingTitles = new Set(
    (await listQuizzes()).map((quiz) => quiz.title),
  );
  const now = new Date().toISOString();
  let created = 0;

  const legacySpecialties = [
    ["quiz-1", "Technology", "Redis", 95],
    ["quiz-2", "Technology", "Databases", 89],
    ["quiz-3", "Entertainment", "Gaming", 90],
    ["quiz-4", "Education", "Digital Safety", 80],
  ] as const;
  for (const [id, category, subcategory, popularity] of legacySpecialties) {
    const quiz = await getQuiz(id);
    if (quiz?.ownerId === owner.id)
      await saveQuiz({
        ...quiz,
        category,
        subcategory,
        popularity,
        updatedAt: now,
      });
  }

  for (const pack of packs) {
    if (existingTitles.has(pack.title) || (await getQuiz(pack.id))) continue;
    const quiz: Quiz = {
      id: pack.id,
      ownerId: owner.id,
      title: pack.title,
      description: `${pack.subcategory} · Bộ câu hỏi luyện tập theo chuyên môn.`,
      category: pack.category,
      subcategory: pack.subcategory,
      popularity: pack.popularity,
      coverColor: pack.color,
      status: "PUBLISHED",
      settings: {
        shuffleQuestions: false,
        shuffleAnswers: false,
        showLeaderboard: true,
        speedScoring: true,
      },
      createdAt: now,
      updatedAt: now,
    };
    await saveQuiz(quiz);
    for (let order = 0; order < pack.facts.length; order++) {
      const [prompt, correct, distractors, explanation] = pack.facts[order]!;
      const options = [correct, ...distractors].map((text, optionIndex) => ({
        id: `${pack.id}-q${order + 1}-o${optionIndex + 1}`,
        text,
      }));
      const question: Question = {
        id: `${pack.id}-q${order + 1}`,
        quizId: pack.id,
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
      await saveQuestion(question);
    }
    created++;
  }
  console.log(
    `Đã bổ sung ${created} bộ quiz, giữ nguyên toàn bộ dữ liệu hiện có.`,
  );
}

seedLibrary()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => void closeRedis());
