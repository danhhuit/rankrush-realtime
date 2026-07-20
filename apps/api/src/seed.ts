import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { connectRedis, closeRedis, redis } from "./redis.js";
import {
  createSession,
  createUser,
  joinSession,
  keys,
  saveQuestion,
  saveQuiz,
  submitAnswerAtomic,
} from "./store.js";
import type { Question, Quiz, User } from "./types.js";
import { config } from "./config.js";

async function clearNamespace() {
  let cursor = "0";
  do {
    const [next, found] = await redis.scan(
      cursor,
      "MATCH",
      `${config.REDIS_PREFIX}:*`,
      "COUNT",
      500,
    );
    cursor = next;
    if (found.length) await redis.del(...found);
  } while (cursor !== "0");
}

const quizData = [
  {
    title: "Redis & bảng xếp hạng",
    description: "Kiểm tra kiến thức Redis Sorted Set và leaderboard realtime.",
    category: "Technology",
    subcategory: "Redis",
    popularity: 95,
    coverColor: "#6C5CE7",
  },
  {
    title: "Nền tảng NoSQL",
    description:
      "MongoDB, Cassandra, Neo4j và Redis trong các bài toán thực tế.",
    category: "Technology",
    subcategory: "Databases",
    popularity: 89,
    coverColor: "#00B894",
  },
  {
    title: "Kiến thức game",
    description: "Thuật ngữ và kiến thức phổ biến trong trò chơi điện tử.",
    category: "Entertainment",
    subcategory: "Gaming",
    popularity: 90,
    coverColor: "#0984E3",
  },
  {
    title: "An toàn số",
    description: "Những nguyên tắc bảo vệ tài khoản và dữ liệu cá nhân.",
    category: "Education",
    subcategory: "Digital Safety",
    popularity: 80,
    coverColor: "#E17055",
  },
];
const prompts = [
  [
    "Kiểu Redis phù hợp nhất cho leaderboard?",
    ["String", "List", "Sorted Set", "Stream"],
    2,
  ],
  ["Lệnh cộng dồn điểm cho member?", ["ZADD", "ZINCRBY", "INCR", "LPUSH"], 1],
  ["Lệnh lấy Top 10 giảm dần?", ["ZRANGE", "ZREVRANGE", "ZSCAN", "ZSCORE"], 1],
  [
    "ZRANK trả về vị trí theo chiều nào?",
    ["Tăng dần", "Giảm dần", "Ngẫu nhiên", "Theo thời gian"],
    0,
  ],
  [
    "Member của leaderboard nên là gì?",
    ["Tên hiển thị", "playerId", "avatar", "email"],
    1,
  ],
  [
    "NoSQL thường phù hợp khi nào?",
    [
      "Chỉ dữ liệu bảng",
      "Mô hình linh hoạt và tải lớn",
      "Không có dữ liệu",
      "Chỉ một người dùng",
    ],
    1,
  ],
  [
    "MongoDB lưu dữ liệu chính theo dạng?",
    ["Đồ thị", "Document", "Cột rộng", "Vector"],
    1,
  ],
  [
    "Cassandra thiết kế ưu tiên điều gì?",
    ["Query-driven", "Chuẩn hóa 3NF", "JOIN", "Trigger"],
    0,
  ],
  [
    "Neo4j mạnh ở mô hình nào?",
    ["Đồ thị", "Key-value", "File", "Bảng tính"],
    0,
  ],
  ["Redis chủ yếu lưu dữ liệu ở đâu?", ["Băng từ", "Bộ nhớ", "GPU", "CDN"], 1],
  [
    "FPS là viết tắt của?",
    [
      "First-person shooter",
      "Fast player score",
      "Final play stage",
      "Frame power system",
    ],
    0,
  ],
  ["Co-op nghĩa là?", ["Chơi hợp tác", "Chơi đơn", "Tạm dừng", "Xếp hạng"], 0],
  [
    "NPC là gì?",
    [
      "Nhân vật không do người chơi điều khiển",
      "Mã PIN",
      "Giải đấu",
      "Bộ điều khiển",
    ],
    0,
  ],
  [
    "Ping thấp thường biểu thị?",
    ["Độ trễ thấp", "Điểm thấp", "FPS thấp", "Mạng bị ngắt"],
    0,
  ],
  [
    "Leaderboard dùng để?",
    ["Xếp hạng", "Lưu mật khẩu", "Phát video", "Nén ảnh"],
    0,
  ],
  [
    "Mật khẩu tốt nên thế nào?",
    ["Dài và duy nhất", "Giống tên", "Dùng chung", "Chỉ có số 1"],
    0,
  ],
  [
    "2FA giúp ích gì?",
    ["Tăng lớp xác thực", "Tăng tốc mạng", "Giảm bộ nhớ", "Tắt mã hóa"],
    0,
  ],
  [
    "Link lạ yêu cầu đăng nhập nên làm gì?",
    ["Kiểm tra nguồn", "Nhập ngay", "Chia sẻ", "Tắt trình duyệt mãi mãi"],
    0,
  ],
  [
    "Có nên chia sẻ OTP?",
    ["Có", "Không", "Chỉ trên mạng xã hội", "Chỉ với người lạ"],
    1,
  ],
  [
    "Cập nhật phần mềm để làm gì?",
    ["Vá lỗ hổng", "Xóa tài khoản", "Giảm bảo mật", "Tắt mạng"],
    0,
  ],
];

async function seed() {
  await connectRedis();
  await clearNamespace();
  const now = new Date().toISOString();
  const user: User = {
    id: "host-danhtn",
    email: "danhtn@rankrush.local",
    displayName: "Thành Danh",
    passwordHash: await bcrypt.hash("RankRush@123", 12),
    role: "ADMIN",
    createdAt: now,
  };
  await createUser(user);
  const quizzes: Quiz[] = [];
  for (let i = 0; i < 4; i++) {
    const d = quizData[i]!;
    const quiz: Quiz = {
      id: `quiz-${i + 1}`,
      ownerId: user.id,
      status: "PUBLISHED",
      settings: {
        shuffleQuestions: false,
        shuffleAnswers: false,
        showLeaderboard: true,
        speedScoring: true,
      },
      createdAt: now,
      updatedAt: now,
      ...d,
    };
    await saveQuiz(quiz);
    quizzes.push(quiz);
    for (let j = 0; j < 5; j++) {
      const idx = i * 5 + j;
      const [prompt, opts, correct] = prompts[idx]! as [
        string,
        string[],
        number,
      ];
      const options = opts.map((text, k) => ({
        id: `q${idx + 1}-o${k + 1}`,
        text,
      }));
      const q: Question = {
        id: `question-${idx + 1}`,
        quizId: quiz.id,
        type: "SINGLE_CHOICE",
        prompt,
        options,
        correctOptionId: options[correct]!.id,
        acceptedAnswers: [],
        timeLimitSec: 20,
        basePoints: 600,
        order: j,
        explanation: "Xem lại kiến thức trong tài liệu môn học.",
      };
      await saveQuestion(q);
    }
  }
  const libraryData: Array<{
    title: string;
    category: string;
    subcategory: string;
    popularity: number;
    color: string;
    facts: Array<[string, string, string[], string]>;
  }> = [
    {
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
          "Màu nào là màu cơ bản trong hệ màu hội họa truyền thống?",
          "Đỏ",
          ["Nâu", "Hồng", "Xám"],
          "Đỏ, vàng và xanh lam thường được xem là màu cơ bản truyền thống.",
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
  let extraQuestionIndex = 21;
  for (let i = 0; i < libraryData.length; i++) {
    const item = libraryData[i]!;
    const quiz: Quiz = {
      id: `quiz-${i + 5}`,
      ownerId: user.id,
      title: item.title,
      description: `${item.subcategory} · Bộ câu hỏi luyện tập theo chuyên môn.`,
      category: item.category,
      subcategory: item.subcategory,
      popularity: item.popularity,
      coverColor: item.color,
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
    quizzes.push(quiz);
    for (let order = 0; order < item.facts.length; order++) {
      const [prompt, correct, distractors, explanation] = item.facts[order]!;
      const options = [correct, ...distractors].map((text, optionIndex) => ({
        id: `q${extraQuestionIndex}-o${optionIndex + 1}`,
        text,
      }));
      await saveQuestion({
        id: `question-${extraQuestionIndex}`,
        quizId: quiz.id,
        type: "SINGLE_CHOICE",
        prompt,
        options,
        correctOptionId: options[0]!.id,
        acceptedAnswers: [],
        timeLimitSec: 20,
        basePoints: 600,
        order,
        explanation,
      });
      extraQuestionIndex++;
    }
  }
  const playerNames = [
    "NovaFox",
    "ByteKnight",
    "LunaSpark",
    "RedPanda",
    "CodeTiger",
    "MintDragon",
    "PixelBee",
    "CloudWolf",
    "AquaRay",
    "IronCat",
    "NeonOwl",
    "SwiftKoala",
    "DataDolphin",
    "RubyFalcon",
    "EchoBear",
    "ZenRabbit",
    "VioletYak",
    "CryptoCrab",
    "SolarSeal",
    "LogicLion",
    "MangoMoth",
    "CometCrow",
    "JadeJaguar",
    "FrostFawn",
    "TurboTurtle",
    "AmberAnt",
    "QuantumQuail",
    "BlueBison",
    "RapidRaven",
    "CobaltCobra",
    "HappyHeron",
    "VectorViper",
    "NimbleNewt",
    "OrbitOtter",
    "CleverCarp",
    "DeltaDeer",
    "BrightBat",
    "CosmicCamel",
    "AgileApe",
    "BinaryBoar",
    "GoldenGecko",
    "HyperHawk",
    "IrisIbex",
    "KeenKiwi",
    "LaserLemur",
    "MagicMole",
    "NavyNarwhal",
    "OmegaOx",
    "PlasmaPuma",
    "QuickQuokka",
    "RocketRobin",
    "SilverShark",
    "TinyToucan",
    "UltraUrchin",
    "VelvetVole",
    "WiseWhale",
    "XenoXerus",
    "YoungYak",
    "ZestyZebra",
    "SaigonStar",
  ];
  const sessions = [];
  for (let i = 0; i < 4; i++) {
    const s = await createSession({
      id: `session-${i + 1}`,
      quizId: quizzes[i]!.id,
      hostId: user.id,
      state: i === 0 ? "ENDED" : "LOBBY",
      currentQuestionIndex: 0,
      questionStartedAt: now,
      questionOrder: Array.from(
        { length: 5 },
        (_, questionIndex) => `question-${i * 5 + questionIndex + 1}`,
      ),
      settings: {
        teamMode: i === 2,
        hideLeaderboard: false,
        safeNames: false,
        hideCountryFlags: false,
        mutePlayers: false,
        speedScoring: true,
      },
      createdAt: now,
      startedAt: i === 0 ? now : "",
      endedAt: i === 0 ? now : "",
    });
    sessions.push(s);
  }
  const players = [];
  for (let i = 0; i < 60; i++)
    players.push(
      await joinSession(
        { ...sessions[0]!, state: "LOBBY" },
        {
          nickname: playerNames[i]!,
          avatar: ["rocket", "fox", "owl", "tiger", "panda"][i % 5]!,
          country: "VN",
          team: i % 2 ? "Tia Chớp" : "Sao Băng",
        },
      ),
    );
  await redis.hset(keys.session(sessions[0]!.id), "state", "ENDED");
  for (let i = 0; i < 12; i++) {
    await submitAnswerAtomic({
      sessionId: sessions[0]!.id,
      playerId: players[i]!.id,
      questionId: `question-${(i % 5) + 1}`,
      selectedAnswer: "seed",
      isCorrect: i % 4 !== 3,
      responseMs: 2500 + i * 350,
      awardedPoints: i % 4 !== 3 ? 900 - i * 5 : 0,
      team: players[i]!.team,
    });
  }
  console.log(
    "Seed hoàn tất: 60 Player + 12 Quiz + 44 Question + 4 Session + 12 Answer = 132 bản ghi logic",
  );
  console.log("Host demo: danhtn@rankrush.local / RankRush@123");
}
seed()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => void closeRedis());
