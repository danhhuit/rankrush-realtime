import bcrypt from "bcryptjs";
import { connectRedis, closeRedis, redis } from "./redis.js";
import {
  createSession,
  createUser,
  getSession,
  getUser,
  joinSession,
  keys,
  saveQuestion,
  saveQuiz,
  submitAnswerAtomic,
  updateSession,
} from "./store.js";
import type {
  GameSession,
  Player,
  Question,
  Quiz,
  SessionState,
  User,
} from "./types.js";

type Fact = [
  prompt: string,
  correct: string,
  distractors: [string, string, string],
  explanation: string,
];

type QuizPack = {
  slug: string;
  title: string;
  description: string;
  category: string;
  subcategory: string;
  color: string;
  facts: [Fact, Fact, Fact, Fact];
};

const DEMO_PASSWORD = "Demo@123";

const quizPacks: QuizPack[] = [
  {
    slug: "redis",
    title: "Redis và bảng xếp hạng",
    description: "Cấu trúc dữ liệu và các lệnh Redis dùng trong hệ thống realtime.",
    category: "Technology",
    subcategory: "Redis",
    color: "#2B9FBD",
    facts: [
      ["Cấu trúc Redis phù hợp nhất để làm bảng xếp hạng là gì?", "Sorted Set", ["String", "List", "Stream"], "Sorted Set lưu member kèm score và tự sắp xếp theo điểm."],
      ["Lệnh nào cộng thêm điểm cho một member trong Sorted Set?", "ZINCRBY", ["ZADDNX", "HINCRBYFLOAT", "LPUSH"], "ZINCRBY tăng score hiện tại của member theo một lượng cho trước."],
      ["Lệnh nào lấy bảng xếp hạng theo điểm giảm dần?", "ZREVRANGE", ["ZRANGE", "ZSCAN", "ZPOPMIN"], "ZREVRANGE trả về member từ score cao xuống thấp."],
      ["TTL trong Redis có tác dụng gì?", "Tự động xóa key khi hết hạn", ["Mã hóa dữ liệu", "Sắp xếp key", "Sao lưu dữ liệu"], "TTL giúp dữ liệu tạm như phiên chơi tự hết hạn và giải phóng bộ nhớ."],
    ],
  },
  {
    slug: "database",
    title: "Nền tảng cơ sở dữ liệu",
    description: "Kiến thức cơ bản về SQL, NoSQL và lựa chọn cơ sở dữ liệu.",
    category: "Technology",
    subcategory: "Databases",
    color: "#00B894",
    facts: [
      ["MongoDB lưu dữ liệu chính theo mô hình nào?", "Document", ["Đồ thị", "Key-value thuần túy", "Chuỗi thời gian bắt buộc"], "MongoDB tổ chức dữ liệu thành các document gần với JSON."],
      ["Neo4j phù hợp nhất với loại dữ liệu nào?", "Dữ liệu có nhiều quan hệ", ["Tệp ảnh lớn", "Bộ nhớ đệm đơn giản", "Nhật ký dạng văn bản"], "Neo4j tối ưu cho mô hình nút và cạnh."],
      ["Cassandra nổi bật ở đặc điểm nào?", "Khả năng phân tán và ghi lớn", ["JOIN phức tạp", "Giao dịch trên nhiều bảng", "Chạy hoàn toàn trên trình duyệt"], "Cassandra được thiết kế cho tính sẵn sàng và mở rộng theo chiều ngang."],
      ["Ưu điểm chính của cơ sở dữ liệu quan hệ là gì?", "Ràng buộc và giao dịch chặt chẽ", ["Không cần schema", "Mọi truy vấn đều O(1)", "Không cần chỉ mục"], "SQL mạnh ở tính toàn vẹn, quan hệ và giao dịch ACID."],
    ],
  },
  {
    slug: "gaming",
    title: "Kiến thức trò chơi điện tử",
    description: "Thuật ngữ và kiến thức phổ biến trong game.",
    category: "Entertainment",
    subcategory: "Gaming",
    color: "#0984E3",
    facts: [
      ["FPS trong thể loại game thường là viết tắt của cụm nào?", "First-person shooter", ["Fast player score", "Final play stage", "Frame power system"], "FPS là thể loại bắn súng góc nhìn thứ nhất."],
      ["NPC là gì?", "Nhân vật không do người chơi điều khiển", ["Mã PIN phòng", "Máy chủ game", "Bảng xếp hạng"], "NPC là nhân vật được điều khiển bởi trò chơi."],
      ["Ping thấp thường cho biết điều gì?", "Độ trễ mạng thấp", ["Điểm số thấp", "FPS thấp", "Âm lượng thấp"], "Ping đo thời gian dữ liệu đi và về giữa thiết bị với máy chủ."],
      ["Co-op mô tả cách chơi nào?", "Người chơi hợp tác với nhau", ["Chỉ chơi một mình", "Tự động thoát trận", "Không có mục tiêu"], "Co-op là chế độ nhiều người phối hợp để hoàn thành mục tiêu."],
    ],
  },
  {
    slug: "digital-safety",
    title: "An toàn số",
    description: "Bảo vệ tài khoản, mật khẩu và thông tin cá nhân.",
    category: "Education",
    subcategory: "Digital Safety",
    color: "#1F9D72",
    facts: [
      ["Mật khẩu an toàn nên có đặc điểm nào?", "Dài, khó đoán và không dùng lại", ["Giống tên tài khoản", "Chỉ gồm 123456", "Dùng chung cho mọi dịch vụ"], "Mật khẩu riêng cho từng dịch vụ làm giảm thiệt hại khi một nơi bị lộ."],
      ["Xác thực hai yếu tố giúp ích gì?", "Thêm một lớp xác minh", ["Tăng tốc Wi-Fi", "Xóa lịch sử đăng nhập", "Tự chia sẻ mật khẩu"], "2FA yêu cầu thêm mã hoặc thiết bị xác minh ngoài mật khẩu."],
      ["Khi nhận liên kết lạ yêu cầu đăng nhập, nên làm gì?", "Kiểm tra tên miền và nguồn gửi", ["Nhập ngay mật khẩu", "Chuyển tiếp cho mọi người", "Tắt phần mềm bảo mật"], "Kiểm tra nguồn giúp tránh trang giả mạo và lừa đảo."],
      ["Có nên cung cấp mã OTP cho người khác không?", "Không", ["Có, nếu họ nhắn gấp", "Có, nếu qua mạng xã hội", "Có, nếu tự xưng nhân viên"], "OTP là mã xác thực bí mật và không được chia sẻ."],
    ],
  },
  {
    slug: "cinema",
    title: "Điện ảnh đại chúng",
    description: "Những kiến thức nhập môn về phim ảnh.",
    category: "Art & Literature",
    subcategory: "Entertainment",
    color: "#E85D75",
    facts: [
      ["Oscar là giải thưởng nổi tiếng thuộc lĩnh vực nào?", "Điện ảnh", ["Kiến trúc", "Thiên văn", "Bóng đá"], "Oscar là giải thưởng thường niên của ngành điện ảnh."],
      ["Người định hướng diễn xuất và hình ảnh của bộ phim là ai?", "Đạo diễn", ["Thủ thư", "Kiến trúc sư", "Trọng tài"], "Đạo diễn chịu trách nhiệm chính về định hướng sáng tạo của phim."],
      ["Thể loại phim nào tập trung tạo cảm giác sợ hãi?", "Kinh dị", ["Tài liệu khoa học", "Ca nhạc", "Thể thao"], "Phim kinh dị dùng bối cảnh và nhịp kể để tạo căng thẳng."],
      ["Kịch bản phim chủ yếu mô tả điều gì?", "Câu chuyện, lời thoại và hành động", ["Giá vé", "Lịch chiếu của rạp", "Cấu hình máy tính"], "Kịch bản là nền tảng nội dung để đoàn phim sản xuất tác phẩm."],
    ],
  },
  {
    slug: "literature",
    title: "Văn học thế giới",
    description: "Tác giả, tác phẩm và thể loại văn học tiêu biểu.",
    category: "Art & Literature",
    subcategory: "Books",
    color: "#7C5CFC",
    facts: [
      ["Ai là tác giả của Romeo and Juliet?", "William Shakespeare", ["Victor Hugo", "Mark Twain", "Homer"], "Romeo and Juliet là bi kịch nổi tiếng của Shakespeare."],
      ["Don Quixote được viết bởi ai?", "Miguel de Cervantes", ["Franz Kafka", "Leo Tolstoy", "Dante Alighieri"], "Cervantes là tác giả của Don Quixote."],
      ["Tác phẩm tự sự dài bằng văn xuôi thường được gọi là gì?", "Tiểu thuyết", ["Sonnet", "Tục ngữ", "Kịch câm"], "Tiểu thuyết là một thể loại tự sự có dung lượng lớn."],
      ["Nhân vật kể lại câu chuyện được gọi là gì?", "Người kể chuyện", ["Nhà xuất bản", "Độc giả", "Họa sĩ"], "Người kể chuyện là chủ thể truyền đạt diễn biến tới người đọc."],
    ],
  },
  {
    slug: "astronomy",
    title: "Khám phá vũ trụ",
    description: "Hệ Mặt Trời, hành tinh và các thiên thể.",
    category: "Science & Nature",
    subcategory: "Astronomy",
    color: "#3D63DD",
    facts: [
      ["Hành tinh gần Mặt Trời nhất là gì?", "Sao Thủy", ["Sao Kim", "Trái Đất", "Sao Hỏa"], "Sao Thủy nằm gần Mặt Trời nhất trong tám hành tinh."],
      ["Thiên hà chứa Hệ Mặt Trời có tên gì?", "Ngân Hà", ["Andromeda", "Sombrero", "Whirlpool"], "Hệ Mặt Trời nằm trong thiên hà Ngân Hà."],
      ["Vệ tinh tự nhiên của Trái Đất là gì?", "Mặt Trăng", ["Titan", "Europa", "Phobos"], "Mặt Trăng là vệ tinh tự nhiên duy nhất của Trái Đất."],
      ["Hành tinh nào nổi tiếng với hệ vành đai dễ quan sát?", "Sao Thổ", ["Sao Hỏa", "Sao Thủy", "Sao Kim"], "Sao Thổ có hệ vành đai lớn cấu tạo từ băng và đá."],
    ],
  },
  {
    slug: "biology",
    title: "Sinh học quanh ta",
    description: "Kiến thức nền tảng về cơ thể và sự sống.",
    category: "Science & Nature",
    subcategory: "Biology",
    color: "#20A37A",
    facts: [
      ["Đơn vị cấu trúc cơ bản của sự sống là gì?", "Tế bào", ["Nguyên tử", "Khoáng vật", "Tinh thể"], "Tế bào là đơn vị cấu trúc và chức năng cơ bản của cơ thể sống."],
      ["Thực vật tạo chất hữu cơ nhờ quá trình nào?", "Quang hợp", ["Bay hơi", "Ngưng tụ", "Kết tinh"], "Quang hợp sử dụng ánh sáng để tổng hợp chất hữu cơ."],
      ["Cơ quan nào bơm máu trong cơ thể người?", "Tim", ["Phổi", "Gan", "Dạ dày"], "Tim co bóp để đưa máu đi qua hệ tuần hoàn."],
      ["ADN mang chức năng chính nào?", "Lưu trữ thông tin di truyền", ["Tiêu hóa thức ăn", "Bơm máu", "Trao đổi khí trực tiếp"], "ADN chứa chỉ dẫn di truyền cho hoạt động và phát triển của sinh vật."],
    ],
  },
  {
    slug: "history",
    title: "Các nền văn minh cổ",
    description: "Dấu mốc và thành tựu của lịch sử cổ đại.",
    category: "History & Geography",
    subcategory: "Ancient History",
    color: "#A66A3F",
    facts: [
      ["Kim tự tháp Giza thuộc nền văn minh nào?", "Ai Cập cổ đại", ["La Mã", "Maya", "Hy Lạp"], "Kim tự tháp Giza được xây dựng ở Ai Cập cổ đại."],
      ["Thành phố Pompeii bị chôn vùi bởi núi lửa nào?", "Vesuvius", ["Fuji", "Etna", "Kilimanjaro"], "Vesuvius phun trào năm 79 và chôn vùi Pompeii."],
      ["Thế vận hội cổ đại bắt nguồn từ đâu?", "Hy Lạp", ["Ai Cập", "Ấn Độ", "Ba Tư"], "Olympic cổ đại bắt nguồn tại Olympia, Hy Lạp."],
      ["Chữ số La Mã X biểu thị số nào?", "10", ["5", "50", "100"], "Trong hệ chữ số La Mã, X có giá trị bằng 10."],
    ],
  },
  {
    slug: "geography",
    title: "Địa lý thế giới",
    description: "Châu lục, đại dương và các quốc gia.",
    category: "History & Geography",
    subcategory: "World Geography",
    color: "#2B8A9A",
    facts: [
      ["Đại dương lớn nhất thế giới là gì?", "Thái Bình Dương", ["Đại Tây Dương", "Ấn Độ Dương", "Bắc Băng Dương"], "Thái Bình Dương có diện tích lớn nhất."],
      ["Sa mạc Sahara nằm ở châu lục nào?", "Châu Phi", ["Châu Á", "Châu Âu", "Nam Mỹ"], "Sahara trải rộng ở khu vực Bắc Phi."],
      ["Thủ đô của Nhật Bản là gì?", "Tokyo", ["Osaka", "Kyoto", "Nagoya"], "Tokyo là thủ đô và trung tâm đô thị lớn của Nhật Bản."],
      ["Dãy núi Himalaya nằm chủ yếu ở châu lục nào?", "Châu Á", ["Châu Phi", "Châu Âu", "Châu Đại Dương"], "Himalaya trải qua nhiều quốc gia ở châu Á."],
    ],
  },
  {
    slug: "football",
    title: "Bóng đá thế giới",
    description: "Luật chơi và kiến thức bóng đá phổ biến.",
    category: "Sports",
    subcategory: "Football",
    color: "#319B62",
    facts: [
      ["Một đội bóng đá có bao nhiêu cầu thủ trên sân khi đủ người?", "11", ["9", "10", "12"], "Mỗi đội có 11 cầu thủ, bao gồm thủ môn."],
      ["Cơ quan quản lý bóng đá thế giới là tổ chức nào?", "FIFA", ["IOC", "NBA", "ATP"], "FIFA là liên đoàn bóng đá quốc tế."],
      ["Thẻ nào truất quyền thi đấu trực tiếp?", "Thẻ đỏ", ["Thẻ vàng", "Thẻ xanh", "Thẻ trắng"], "Cầu thủ nhận thẻ đỏ phải rời sân."],
      ["Một trận bóng đá tiêu chuẩn có bao nhiêu hiệp chính?", "2", ["1", "3", "4"], "Trận đấu tiêu chuẩn có hai hiệp chính."],
    ],
  },
  {
    slug: "music",
    title: "Âm nhạc hiện đại",
    description: "Nhạc cụ, thể loại và kiến thức âm nhạc cơ bản.",
    category: "Music",
    subcategory: "V-POP",
    color: "#E84393",
    facts: [
      ["Nhạc cụ nào thường có 88 phím?", "Piano", ["Violin", "Sáo", "Trống"], "Piano tiêu chuẩn hiện đại thường có 88 phím."],
      ["Tempo trong âm nhạc mô tả yếu tố nào?", "Tốc độ của bản nhạc", ["Độ dài tên bài hát", "Màu bìa album", "Số lượng ca sĩ"], "Tempo cho biết nhịp độ nhanh hay chậm."],
      ["V-POP là cách gọi phổ biến của dòng nhạc nào?", "Nhạc pop Việt Nam", ["Nhạc cổ điển Ý", "Nhạc dân gian Nhật Bản", "Nhạc jazz Mỹ"], "V-POP là tên gọi ngắn của Vietnamese Pop."],
      ["Người sáng tác phần giai điệu của bài hát thường được gọi là gì?", "Nhạc sĩ", ["Đạo diễn", "Biên tập viên", "Trọng tài"], "Nhạc sĩ sáng tác hoặc biên soạn tác phẩm âm nhạc."],
    ],
  },
  {
    slug: "business",
    title: "Kinh doanh căn bản",
    description: "Khái niệm nhập môn về khách hàng, doanh thu và thị trường.",
    category: "Business",
    subcategory: "Business Basics",
    color: "#D97706",
    facts: [
      ["Doanh thu là gì?", "Tổng tiền thu từ bán hàng và dịch vụ", ["Chi phí thuê văn phòng", "Số nhân viên", "Giá trị hàng tồn kho"], "Doanh thu phản ánh khoản tiền doanh nghiệp tạo ra từ hoạt động bán hàng."],
      ["Khách hàng mục tiêu là ai?", "Nhóm có khả năng cần và mua sản phẩm", ["Mọi người không phân biệt nhu cầu", "Chỉ nhân viên công ty", "Chỉ đối thủ cạnh tranh"], "Xác định khách hàng mục tiêu giúp hoạt động tiếp thị tập trung hơn."],
      ["Lợi nhuận được tính cơ bản như thế nào?", "Doanh thu trừ chi phí", ["Doanh thu cộng chi phí", "Chi phí trừ doanh thu", "Doanh thu nhân số nhân viên"], "Lợi nhuận là phần còn lại sau khi trừ chi phí khỏi doanh thu."],
      ["Nghiên cứu thị trường nhằm mục đích gì?", "Hiểu khách hàng và đối thủ", ["Tăng ngẫu nhiên giá bán", "Xóa mọi dữ liệu cũ", "Thay thế hoàn toàn kế toán"], "Nghiên cứu thị trường cung cấp dữ liệu cho quyết định kinh doanh."],
    ],
  },
];

const demoUsers = [
  ["sample-admin", "sampleadmin", "sample.admin@rankrush.local", "Quản trị mẫu", "ADMIN"],
  ["sample-host-01", "minhanh", "minhanh@rankrush.local", "Minh Anh", "HOST"],
  ["sample-host-02", "quanghuy", "quanghuy@rankrush.local", "Quang Huy", "HOST"],
  ["sample-host-03", "thanhha", "thanhha@rankrush.local", "Thanh Hà", "HOST"],
  ["sample-host-04", "ngoclan", "ngoclan@rankrush.local", "Ngọc Lan", "HOST"],
  ["sample-host-05", "hoangnam", "hoangnam@rankrush.local", "Hoàng Nam", "HOST"],
  ["sample-host-06", "tuongvy", "tuongvy@rankrush.local", "Tường Vy", "HOST"],
  ["sample-host-07", "ducphuc", "ducphuc@rankrush.local", "Đức Phúc", "HOST"],
  ["sample-host-08", "baotram", "baotram@rankrush.local", "Bảo Trâm", "HOST"],
  ["sample-host-09", "giabao", "giabao@rankrush.local", "Gia Bảo", "HOST"],
] as const;

const playerNames = [
  "Sao Băng", "Mèo Máy", "Cáo Lửa", "Gấu Trúc",
  "Sóc Nâu", "Hổ Xanh", "Ong Vàng", "Thỏ Ngọc",
  "Mây Trắng", "Sư Tử", "Cú Đêm", "Rồng Con",
  "Cá Heo", "Chim Én", "Gấu Bắc Cực", "Mèo Mun",
  "Hải Âu", "Báo Đốm", "Sóc Bay", "Cá Voi",
] as const;

const sessionStates: SessionState[] = [
  "ENDED",
  "RUNNING",
  "PAUSED",
  "LOBBY",
  "CANCELLED",
];

function isoHoursAgo(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

async function removeExistingDemoSession(sessionId: string) {
  const current = await getSession(sessionId);
  const patterns = [
    keys.player(sessionId, "*"),
    keys.answer(sessionId, "*", "*"),
  ];
  const found = new Set<string>();
  for (const pattern of patterns) {
    let cursor = "0";
    do {
      const [next, rows] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 200);
      cursor = next;
      rows.forEach((row) => found.add(row));
    } while (cursor !== "0");
  }
  if (current?.pin) found.add(keys.sessionPin(current.pin));
  [
    keys.session(sessionId),
    keys.sessionPlayers(sessionId),
    keys.sessionNicknames(sessionId),
    keys.leaderboard(sessionId),
    keys.teamboard(sessionId),
    keys.answers(sessionId),
    keys.events(sessionId),
    keys.phaseLock(sessionId),
  ].forEach((key) => found.add(key));
  if (found.size) await redis.del(...found);
  await redis.srem(keys.sessions, sessionId);
}

async function seedUsers(passwordHash: string, now: string) {
  const users: User[] = [];
  for (const [id, username, email, displayName, role] of demoUsers) {
    const existing = await getUser(id);
    if (existing) {
      users.push(existing);
      continue;
    }
    const user: User = {
      id,
      username,
      email,
      displayName,
      passwordHash,
      rawPassword: DEMO_PASSWORD,
      role,
      status: "ACTIVE",
      createdAt: now,
    };
    users.push(await createUser(user));
  }
  return users;
}

async function seedQuizzes(users: User[], now: string) {
  const quizzes: Quiz[] = [];
  const questionsByQuiz = new Map<string, Question[]>();
  for (let packIndex = 0; packIndex < quizPacks.length; packIndex++) {
    const pack = quizPacks[packIndex]!;
    const quizId = `sample-quiz-${String(packIndex + 1).padStart(2, "0")}`;
    const quiz: Quiz = {
      id: quizId,
      ownerId: users[(packIndex % (users.length - 1)) + 1]!.id,
      title: pack.title,
      description: pack.description,
      category: pack.category,
      subcategory: pack.subcategory,
      popularity: 98 - packIndex * 2,
      coverColor: pack.color,
      status: "PUBLISHED",
      settings: {
        shuffleQuestions: packIndex % 2 === 0,
        shuffleAnswers: true,
        showLeaderboard: true,
        speedScoring: true,
      },
      createdAt: isoHoursAgo(72 - packIndex * 3),
      updatedAt: now,
    };
    await saveQuiz(quiz);
    quizzes.push(quiz);
    const questions: Question[] = [];
    for (let order = 0; order < pack.facts.length; order++) {
      const [prompt, correct, distractors, explanation] = pack.facts[order]!;
      const rawOptions = [correct, ...distractors];
      const shift = (packIndex + order) % rawOptions.length;
      const rotated = [...rawOptions.slice(shift), ...rawOptions.slice(0, shift)];
      const options = rotated.map((text, optionIndex) => ({
        id: `${quizId}-q${order + 1}-o${optionIndex + 1}`,
        text,
      }));
      const question: Question = {
        id: `${quizId}-q${order + 1}`,
        quizId,
        type: "SINGLE_CHOICE",
        prompt,
        options,
        correctOptionId: options.find((option) => option.text === correct)!.id,
        acceptedAnswers: [],
        timeLimitSec: 20 + (order % 2) * 10,
        basePoints: 600,
        order,
        explanation,
      };
      await saveQuestion(question);
      questions.push(question);
    }
    questionsByQuiz.set(quizId, questions);
  }
  return { quizzes, questionsByQuiz };
}

async function seedSessions(
  quizzes: Quiz[],
  questionsByQuiz: Map<string, Question[]>,
  users: User[],
) {
  const sessions: GameSession[] = [];
  const players: Player[] = [];
  for (let sessionIndex = 0; sessionIndex < 5; sessionIndex++) {
    const sessionId = `sample-session-${String(sessionIndex + 1).padStart(2, "0")}`;
    await removeExistingDemoSession(sessionId);
    const quiz = quizzes[sessionIndex]!;
    const questions = questionsByQuiz.get(quiz.id)!;
    const createdAt = isoHoursAgo(24 - sessionIndex * 4);
    const session = await createSession({
      id: sessionId,
      quizId: quiz.id,
      hostId: users[sessionIndex + 1]!.id,
      state: "LOBBY",
      currentQuestionIndex: sessionIndex % questions.length,
      questionStartedAt: createdAt,
      questionOrder: questions.map((question) => question.id),
      settings: {
        autoAdvance: sessionIndex % 2 === 0,
        teamMode: sessionIndex === 2,
        hideLeaderboard: false,
        safeNames: true,
        hideCountryFlags: false,
        mutePlayers: false,
        speedScoring: true,
      },
      createdAt,
      startedAt: sessionIndex === 3 ? "" : createdAt,
      endedAt: "",
    });
    sessions.push(session);

    for (let playerIndex = 0; playerIndex < 4; playerIndex++) {
      const nameIndex = sessionIndex * 4 + playerIndex;
      const player = await joinSession(session, {
        nickname: playerNames[nameIndex]!,
        avatar: `human|${(nameIndex % 12) + 1}|${nameIndex % 6}|${nameIndex % 8}|${nameIndex % 5}`,
        country: "VN",
        team: sessionIndex === 2 ? (playerIndex % 2 === 0 ? "Tia Chớp" : "Sao Băng") : "",
      });
      players.push(player);
      const question = questions[playerIndex % questions.length]!;
      const isCorrect = (playerIndex + sessionIndex) % 4 !== 3;
      await submitAnswerAtomic({
        sessionId,
        playerId: player.id,
        questionId: question.id,
        selectedAnswer: isCorrect
          ? question.correctOptionId
          : question.options.find(
              (option) => option.id !== question.correctOptionId,
            )!.id,
        isCorrect,
        responseMs: 2100 + sessionIndex * 300 + playerIndex * 450,
        awardedPoints: isCorrect ? 920 - sessionIndex * 35 - playerIndex * 60 : 0,
        team: player.team,
      });
    }

    const finalState = sessionStates[sessionIndex]!;
    await updateSession(sessionId, {
      state: finalState,
      endedAt:
        finalState === "ENDED" || finalState === "CANCELLED"
          ? isoHoursAgo(20 - sessionIndex * 4)
          : "",
    });
  }
  return { sessions, players };
}

async function seedDemo() {
  await connectRedis();
  const now = new Date().toISOString();
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const users = await seedUsers(passwordHash, now);
  const { quizzes, questionsByQuiz } = await seedQuizzes(users, now);
  const { sessions, players } = await seedSessions(
    quizzes,
    questionsByQuiz,
    users,
  );
  const questionCount = [...questionsByQuiz.values()].reduce(
    (total, questions) => total + questions.length,
    0,
  );

  console.log("Đã tạo dữ liệu mẫu RankRush thành công.");
  console.table({
    users: users.length,
    quizzes: quizzes.length,
    questions: questionCount,
    sessions: sessions.length,
    players: players.length,
    leaderboardEntries: players.length,
  });
  console.log(
    `Tổng bản ghi chính: ${users.length + quizzes.length + questionCount + sessions.length + players.length}.`,
  );
  console.log(`Tài khoản mẫu: sampleadmin / ${DEMO_PASSWORD}`);
}

seedDemo()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => void closeRedis());
