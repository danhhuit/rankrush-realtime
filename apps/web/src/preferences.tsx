import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Locale = "vi" | "en";
export type Theme = "light" | "dark";
export type ThemePreference = Theme | "system";

const messages = {
  vi: {
    searchQuiz: "Tìm quiz",
    roomCode: "Mã phòng",
    enterRoom: "Vào phòng",
    home: "Trang chủ",
    library: "Thư viện",
    join: "Tham gia",
    dashboard: "Dashboard",
    logout: "Đăng xuất",
    login: "Đăng nhập",
    language: "Ngôn ngữ",
    appearance: "Giao diện",
    systemTheme: "Theo hệ thống",
    lightTheme: "Sáng",
    darkTheme: "Tối",
    lightMode: "Chuyển sang giao diện sáng",
    darkMode: "Chuyển sang giao diện tối",
    searchPlaceholder: "Tìm theo tên hoặc danh mục...",
    publicQuizzes: "Quiz công khai",
    resultsFor: "Kết quả cho",
    notFound: "Không tìm thấy",
    shorterKeyword: "Thử một từ khóa ngắn hơn.",
    joinRankRush: "Tham gia RankRush",
    enterGamePin: "Nhập PIN game",
    lobbyWaiting: "người đang chờ trong lobby.",
    pinHelp: "PIN gồm 6 chữ số được hiển thị trên màn hình host.",
    nickname: "Biệt danh",
    yourName: "Tên của bạn",
    chooseAvatar: "Chọn avatar",
    country: "Quốc gia",
    team: "Đội",
    teamName: "Tên đội",
    joining: "Đang vào phòng...",
    enterLobby: "Vào lobby",
    continue: "Tiếp tục",
    changePin: "Đổi PIN",
    connecting: "Đang kết nối phòng chơi...",
    sessionCancelled: "Phòng chơi đã được Host hủy.",
    question: "Câu",
    questionUpper: "CÂU HỎI",
    player: "Người chơi",
    typeAnswer: "Nhập câu trả lời...",
    sendAnswer: "Gửi đáp án",
    timeUp: "Đã hết thời gian trả lời",
    correct: "Chính xác!",
    incorrect: "Chưa đúng rồi",
    points: "điểm",
    rank: "Hạng",
    alreadyRecorded: "Đáp án này đã được ghi nhận trước đó.",
    revealedWaiting: "Đáp án đã được công bố • Đang chờ câu tiếp theo",
    yourRank: "Hạng của bạn",
    joinedRoom: "Đã vào phòng",
    hello: "Chào",
    hostPreparing: "Host đang chuẩn bị game",
    waitingHost: "Đang chờ host bắt đầu",
    joinedPlayers: "người đã tham gia",
    completed: "Hoàn thành",
    podium: "Bạn đã lên bục chiến thắng!",
    greatRace: "Một cuộc đua tuyệt vời!",
    correctAnswers: "Câu đúng",
    answered: "Đã trả lời",
    accuracy: "Độ chính xác",
    playAnother: "Chơi game khác",
    realtimeUpdate: "Cập nhật thời gian thực",
    noScores: "Chưa có điểm số.",
    liveNoInstall: "Quiz trực tiếp • Không cần cài app",
    heroTitleBefore: "Biến mọi câu hỏi thành một",
    heroTitleAccent: "cuộc đua",
    heroDescription:
      "Tạo quiz, chia sẻ PIN và xem thứ hạng thay đổi ngay khi người chơi trả lời. Nhanh, vui và vận hành hoàn toàn trên trình duyệt.",
    createFree: "Tạo quiz miễn phí",
    howItWorks: "Xem cách hoạt động",
    upToPlayers: "Tối đa 300 người",
    realtimeLeaderboard: "Leaderboard thời gian thực",
    noAccount: "Không cần tài khoản để chơi",
    joinGame: "Tham gia game",
    enterSharedPin: "Nhập PIN do host chia sẻ",
    pinSixDigits: "PIN gồm đúng 6 chữ số.",
    getStarted: "Bắt đầu trong vài phút",
    threeSteps: "Ba bước để cả phòng cùng chơi",
    createQuiz: "Tạo quiz",
    sharePin: "Chia sẻ PIN",
    raceRanks: "Đua thứ hạng",
    exploreContent: "Khám phá nội dung",
    featuredQuizzes: "Quiz nổi bật",
    viewAll: "Xem tất cả",
    all: "Tất cả",
  },
  en: {
    searchQuiz: "Search quizzes",
    roomCode: "Room code",
    enterRoom: "Enter room",
    home: "Home",
    library: "Library",
    join: "Join",
    dashboard: "Dashboard",
    logout: "Log out",
    login: "Log in",
    language: "Language",
    appearance: "Appearance",
    systemTheme: "System",
    lightTheme: "Light",
    darkTheme: "Dark",
    lightMode: "Switch to light mode",
    darkMode: "Switch to dark mode",
    searchPlaceholder: "Search by name or category...",
    publicQuizzes: "Public quizzes",
    resultsFor: "Results for",
    notFound: "No results found",
    shorterKeyword: "Try a shorter keyword.",
    joinRankRush: "Join RankRush",
    enterGamePin: "Enter game PIN",
    lobbyWaiting: "players are waiting in the lobby.",
    pinHelp: "The 6-digit PIN is shown on the host screen.",
    nickname: "Nickname",
    yourName: "Your name",
    chooseAvatar: "Choose an avatar",
    country: "Country",
    team: "Team",
    teamName: "Team name",
    joining: "Joining room...",
    enterLobby: "Enter lobby",
    continue: "Continue",
    changePin: "Change PIN",
    connecting: "Connecting to the game...",
    sessionCancelled: "The host cancelled this game room.",
    question: "Question",
    questionUpper: "QUESTION",
    player: "Player",
    typeAnswer: "Type your answer...",
    sendAnswer: "Submit answer",
    timeUp: "Time is up",
    correct: "Correct!",
    incorrect: "Not quite",
    points: "points",
    rank: "Rank",
    alreadyRecorded: "This answer was already recorded.",
    revealedWaiting: "Answer revealed • Waiting for the next question",
    yourRank: "Your rank",
    joinedRoom: "Joined room",
    hello: "Hello",
    hostPreparing: "The host is preparing",
    waitingHost: "Waiting for the host to start",
    joinedPlayers: "players joined",
    completed: "Completed",
    podium: "You made the podium!",
    greatRace: "What a great race!",
    correctAnswers: "Correct",
    answered: "Answered",
    accuracy: "Accuracy",
    playAnother: "Play another game",
    realtimeUpdate: "Updated in real time",
    noScores: "No scores yet.",
    liveNoInstall: "Live quizzes • No app required",
    heroTitleBefore: "Turn every question into a",
    heroTitleAccent: "race",
    heroDescription:
      "Create a quiz, share a PIN, and watch rankings change as players answer. Fast, fun, and completely browser-based.",
    createFree: "Create a free quiz",
    howItWorks: "See how it works",
    upToPlayers: "Up to 300 players",
    realtimeLeaderboard: "Real-time leaderboard",
    noAccount: "No account needed to play",
    joinGame: "Join a game",
    enterSharedPin: "Enter the PIN shared by the host",
    pinSixDigits: "PIN must contain exactly 6 digits.",
    getStarted: "Get started in minutes",
    threeSteps: "Three steps to play together",
    createQuiz: "Create a quiz",
    sharePin: "Share the PIN",
    raceRanks: "Race the rankings",
    exploreContent: "Explore content",
    featuredQuizzes: "Featured quizzes",
    viewAll: "View all",
    all: "All",
  },
} as const;

export type MessageKey = keyof (typeof messages)["vi"];

type PreferencesValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  theme: Theme;
  themePreference: ThemePreference;
  setThemePreference: (theme: ThemePreference) => void;
  t: (key: MessageKey) => string;
  tr: (vi: string, en: string) => string;
};

const PreferencesContext = createContext<PreferencesValue | null>(null);

<<<<<<< HEAD
function initialTheme(): Theme {
  const saved = localStorage.getItem("rr_theme");
  if (saved === "light" || saved === "dark") return saved;
  // Keep first render deterministic across browsers. Users can still opt in to
  // dark mode with the theme button, and that explicit choice is persisted.
  return "light";
=======
export function normalizeThemePreference(
  value: string | null,
): ThemePreference {
  if (value === "system" || value === "light" || value === "dark") {
    return value;
  }
  return "system";
}

export function resolveTheme(
  preference: ThemePreference,
  systemTheme: Theme,
): Theme {
  return preference === "system" ? systemTheme : preference;
}

function getSystemTheme(): Theme {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
>>>>>>> 979bc34374fff67edfb6d55e9f9dbd30bf107e64
}

function initialThemePreference(): ThemePreference {
  const saved = localStorage.getItem("rr_theme");
  return normalizeThemePreference(saved);
}

function initialLocale(): Locale {
  const saved = localStorage.getItem("rr_locale");
  if (saved === "vi" || saved === "en") return saved;
  return "vi";
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [themePreference, setThemePreference] = useState<ThemePreference>(
    initialThemePreference,
  );
  const [systemTheme, setSystemTheme] = useState<Theme>(getSystemTheme);
  const theme = resolveTheme(themePreference, systemTheme);

  useEffect(() => {
    localStorage.setItem("rr_locale", locale);
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const updateSystemTheme = (event: MediaQueryListEvent | MediaQueryList) =>
      setSystemTheme(event.matches ? "dark" : "light");

    updateSystemTheme(media);
    media.addEventListener("change", updateSystemTheme);
    return () => media.removeEventListener("change", updateSystemTheme);
  }, []);

  useEffect(() => {
    localStorage.setItem("rr_theme", themePreference);
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.themePreference = themePreference;
    document.documentElement.style.colorScheme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#10131a" : "#ffffff");
  }, [theme, themePreference]);

  const value = useMemo<PreferencesValue>(
    () => ({
      locale,
      setLocale,
      theme,
      themePreference,
      setThemePreference,
      t: (key) => messages[locale][key],
      tr: (vi, en) => (locale === "vi" ? vi : en),
    }),
    [locale, theme, themePreference],
  );

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const value = useContext(PreferencesContext);
  if (!value)
    throw new Error("usePreferences must be used inside PreferencesProvider");
  return value;
}
