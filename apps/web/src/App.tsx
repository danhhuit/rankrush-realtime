import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  BookOpen,
  BriefcaseBusiness,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  Copy,
  Cpu,
  Crown,
  Dumbbell,
  Edit3,
  Eye,
  Gamepad2,
  Gauge,
  Globe2,
  GraduationCap,
  Home as HomeIcon,
  Landmark,
  Library,
  LogIn,
  LogOut,
  Medal,
  Menu,
  Moon,
  Music2,
  Palette,
  Play,
  Plus,
  QrCode,
  Radio,
  Rocket,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  FlaskConical,
  Sparkles,
  Sun,
  Target,
  Trash2,
  Trophy,
  UserPlus,
  Users,
  Volume2,
  WandSparkles,
  X,
  Zap,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import {
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { io, type Socket } from "socket.io-client";
import { ApiError, hostToken, playerToken, request } from "./api";
import { usePreferences } from "./preferences";
import type {
  LeaderboardEntry,
  Option,
  Player,
  PlayerResult,
  Question,
  Quiz,
  SessionSettings,
  Snapshot,
} from "./types";

const avatars = [
  "rocket",
  "fox",
  "owl",
  "tiger",
  "panda",
  "bolt",
  "star",
  "ghost",
];
const avatarEmoji: Record<string, string> = {
  rocket: "🚀",
  fox: "🦊",
  owl: "🦉",
  tiger: "🐯",
  panda: "🐼",
  bolt: "⚡",
  star: "🌟",
  ghost: "👻",
};
const categories = [
  {
    name: "Art & Literature",
    icon: Palette,
    color: "#e85d75",
    branches: ["Entertainment", "Books", "Visual Arts"],
  },
  {
    name: "Science & Nature",
    icon: FlaskConical,
    color: "#1f9d72",
    branches: ["Astronomy", "Biology"],
  },
  {
    name: "History & Geography",
    icon: Landmark,
    color: "#a66a3f",
    branches: ["Ancient History", "World Geography"],
  },
  {
    name: "Technology",
    icon: Cpu,
    color: "#6c5ce7",
    branches: ["Redis", "Databases"],
  },
  {
    name: "Sports",
    icon: Dumbbell,
    color: "#319b62",
    branches: ["Football"],
  },
  {
    name: "Entertainment",
    icon: Gamepad2,
    color: "#0984e3",
    branches: ["Gaming"],
  },
  {
    name: "Education",
    icon: GraduationCap,
    color: "#00b894",
    branches: ["Digital Safety"],
  },
  {
    name: "Business",
    icon: BriefcaseBusiness,
    color: "#d97706",
    branches: [],
  },
];
function cx(...v: Array<string | false | undefined | null>) {
  return v.filter(Boolean).join(" ");
}
function useToast() {
  const [message, setMessage] = useState("");
  const show = useCallback((m: string) => {
    setMessage(m);
    setTimeout(() => setMessage(""), 3200);
  }, []);
  return {
    show,
    node: message ? (
      <div className="toast">
        <Check size={18} />
        {message}
      </div>
    ) : null,
  };
}
function Logo() {
  return (
    <Link to="/" className="logo">
      <span className="logo-mark">
        <img src="/brand/rankrush-r2.png" alt="R²" />
      </span>
      <span>
        Rank<span>Rush</span>
      </span>
    </Link>
  );
}
function PreferenceControls({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, theme, toggleTheme, t } = usePreferences();
  return (
    <div className={cx("preference-controls", compact && "compact")}>
      <label className="language-control" title={t("language")}>
        <Globe2 />
        <select
          value={locale}
          onChange={(event) => setLocale(event.target.value as "vi" | "en")}
          aria-label={t("language")}
        >
          <option value="vi">VI</option>
          <option value="en">EN</option>
        </select>
      </label>
      <button
        type="button"
        className="theme-toggle"
        onClick={toggleTheme}
        title={theme === "dark" ? t("lightMode") : t("darkMode")}
        aria-label={theme === "dark" ? t("lightMode") : t("darkMode")}
      >
        {theme === "dark" ? <Sun /> : <Moon />}
      </button>
    </div>
  );
}
function Header() {
  const nav = useNavigate();
  const { t } = usePreferences();
  const token = hostToken();
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [pin, setPin] = useState("");
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", keyboard);
    return () => window.removeEventListener("keydown", keyboard);
  }, []);
  return (
    <>
      <header className="header">
        <Logo />
        <div className="nav-tools">
          <button className="nav-search" onClick={() => setSearchOpen(true)}>
            <Search />
            <span>{t("searchQuiz")}</span>
            <kbd>Ctrl K</kbd>
          </button>
          <form
            className="nav-pin"
            onSubmit={(event) => {
              event.preventDefault();
              if (/^\d{6}$/.test(pin)) nav(`/join/${pin}`);
            }}
          >
            <Gamepad2 />
            <input
              value={pin}
              onChange={(event) =>
                setPin(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
              placeholder={t("roomCode")}
              inputMode="numeric"
              aria-label={t("roomCode")}
            />
            <button aria-label={t("enterRoom")}>
              <ChevronRight />
            </button>
          </form>
        </div>
        <PreferenceControls />
        <button className="menu-button" onClick={() => setOpen(!open)}>
          <Menu />
        </button>
        <nav className={cx("nav", open && "open")}>
          <Link to="/">
            <HomeIcon size={17} />
            {t("home")}
          </Link>
          <Link to="/#library">
            <Library size={17} />
            {t("library")}
          </Link>
          <Link to="/join">
            <Gamepad2 size={17} />
            {t("join")}
          </Link>
          {token ? (
            <>
              <Link to="/dashboard">
                <Gauge size={17} />
                {t("dashboard")}
              </Link>
              <button
                className="nav-link"
                onClick={() => {
                  localStorage.removeItem("rr_host_token");
                  localStorage.removeItem("rr_user");
                  nav("/");
                }}
              >
                <LogOut size={17} />
                {t("logout")}
              </button>
            </>
          ) : (
            <Link className="button button-sm button-ghost" to="/login">
              <LogIn size={17} />
              {t("login")}
            </Link>
          )}
        </nav>
      </header>
      {searchOpen && <SearchDialog onClose={() => setSearchOpen(false)} />}
    </>
  );
}

function SearchDialog({ onClose }: { onClose: () => void }) {
  const nav = useNavigate();
  const { t } = usePreferences();
  const [query, setQuery] = useState("");
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  useEffect(() => {
    void request<Quiz[]>("/quizzes").then(setQuizzes);
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", keyboard);
    return () => window.removeEventListener("keydown", keyboard);
  }, []);
  const results = quizzes
    .filter((quiz) =>
      `${quiz.title} ${quiz.description} ${quiz.category}`
        .toLocaleLowerCase("vi-VN")
        .includes(query.toLocaleLowerCase("vi-VN")),
    )
    .slice(0, 8);
  return (
    <div className="search-backdrop" onMouseDown={onClose}>
      <section
        className="search-dialog"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="search-input-wrap">
          <Search />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("searchPlaceholder")}
          />
          <button onClick={onClose}>
            <X />
          </button>
        </div>
        <p>{query ? `${t("resultsFor")} “${query}”` : t("publicQuizzes")}</p>
        <div className="search-results">
          {results.map((quiz) => (
            <button
              key={quiz.id}
              onClick={() => {
                onClose();
                nav(`/quiz/${quiz.id}`);
              }}
            >
              <span style={{ background: quiz.coverColor }}>
                <BookOpen />
              </span>
              <div>
                <b>{quiz.title}</b>
                <small>{quiz.category}</small>
              </div>
              <ChevronRight />
            </button>
          ))}
          {!results.length && (
            <Empty
              icon={<Search />}
              title={t("notFound")}
              text={t("shorterKeyword")}
            />
          )}
        </div>
      </section>
    </div>
  );
}
function Page({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <>
      <Header />
      <main className={className}>{children}</main>
      <footer>
        <Logo />
        <p>Live quiz. Real-time glory. Powered by Redis ZSET.</p>
        <span>© 2026 RankRush</span>
      </footer>
    </>
  );
}
function ErrorBox({ error }: { error: string }) {
  return error ? (
    <div className="error-box">
      <CircleHelp size={18} />
      {error}
    </div>
  ) : null;
}
function Empty({
  icon,
  title,
  text,
  action,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      {icon}
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}

function Home() {
  const nav = useNavigate();
  const { t, tr } = usePreferences();
  const [pin, setPin] = useState("");
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [category, setCategory] = useState("Tất cả");
  const [subcategory, setSubcategory] = useState("Tất cả");
  const [error, setError] = useState("");
  const activeCategory = categories.find((item) => item.name === category);
  useEffect(() => {
    request<Quiz[]>("/quizzes")
      .then(setQuizzes)
      .catch(() => {});
  }, []);
  function join(e: FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(pin)) {
      setError(t("pinSixDigits"));
      return;
    }
    nav(`/join/${pin}`);
  }
  return (
    <Page>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <Radio size={16} /> {t("liveNoInstall")}
          </div>
          <h1>
            {t("heroTitleBefore")} <em>{t("heroTitleAccent")}</em>.
          </h1>
          <p>{t("heroDescription")}</p>
          <div className="hero-actions">
            <Link
              className="button button-primary button-lg"
              to={hostToken() ? "/dashboard" : "/register"}
            >
              <Plus />
              {t("createFree")}
            </Link>
            <a className="button button-secondary button-lg" href="#how">
              <Play />
              {t("howItWorks")}
            </a>
          </div>
          <div className="trust-row">
            <span>
              <Check />
              {t("upToPlayers")}
            </span>
            <span>
              <Check />
              {t("realtimeLeaderboard")}
            </span>
            <span>
              <Check />
              {t("noAccount")}
            </span>
          </div>
        </div>
        <div className="join-panel">
          <div className="floating-rank rank-one">
            🥇 <b>NovaFox</b>
            <span>4,920</span>
          </div>
          <div className="floating-rank rank-two">
            🥈 <b>LunaSpark</b>
            <span>4,740</span>
          </div>
          <div className="join-card">
            <div className="join-icon">
              <Gamepad2 />
            </div>
            <h2>{t("joinGame")}</h2>
            <p>{t("enterSharedPin")}</p>
            <form onSubmit={join}>
              <input
                className="pin-input"
                value={pin}
                onChange={(e) =>
                  setPin(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="000 000"
                inputMode="numeric"
              />
              <ErrorBox error={error} />
              <button
                className="button button-primary button-block"
                type="submit"
              >
                {t("enterRoom")} <ChevronRight />
              </button>
            </form>
          </div>
        </div>
      </section>
      <section className="metrics">
        <div>
          <strong>300</strong>
          <span>{tr("người / phòng", "players / room")}</span>
        </div>
        <div>
          <strong>&lt; 300ms</strong>
          <span>{tr("mục tiêu realtime", "real-time target")}</span>
        </div>
        <div>
          <strong>100%</strong>
          <span>Redis leaderboard</span>
        </div>
        <div>
          <strong>0</strong>
          <span>{tr("lần tải ứng dụng", "app downloads")}</span>
        </div>
      </section>
      <section id="how" className="section">
        <div className="section-head">
          <span className="eyebrow">{t("getStarted")}</span>
          <h2>{t("threeSteps")}</h2>
          <p>
            {tr(
              "Luồng đơn giản như các nền tảng live quiz hiện đại, với trải nghiệm RankRush độc lập.",
              "A simple modern live-quiz flow with an independent RankRush experience.",
            )}
          </p>
        </div>
        <div className="steps">
          <article>
            <span>01</span>
            <div className="step-icon purple">
              <Edit3 />
            </div>
            <h3>{t("createQuiz")}</h3>
            <p>
              {tr(
                "Soạn câu hỏi, đáp án, timer và điểm. Lưu nháp hoặc công khai trong thư viện.",
                "Write questions, answers, timers, and points. Save a draft or publish it to the library.",
              )}
            </p>
          </article>
          <article>
            <span>02</span>
            <div className="step-icon teal">
              <QrCode />
            </div>
            <h3>{t("sharePin")}</h3>
            <p>
              {tr(
                "Mở lobby, chiếu QR/PIN và xem người chơi xuất hiện ngay trên màn hình host.",
                "Open the lobby, share the QR/PIN, and see players appear instantly on the host screen.",
              )}
            </p>
          </article>
          <article>
            <span>03</span>
            <div className="step-icon orange">
              <Trophy />
            </div>
            <h3>{t("raceRanks")}</h3>
            <p>
              {tr(
                "Điểm tốc độ được cộng nguyên tử; Top 10 thay đổi trực tiếp sau từng câu.",
                "Speed points are added atomically and the Top 10 updates after every question.",
              )}
            </p>
          </article>
        </div>
      </section>
      <section id="library" className="section surface">
        <nav
          className="category-navigation"
          aria-label={tr("Lĩnh vực quiz", "Quiz categories")}
        >
          <button
            className={category === "Tất cả" ? "active" : ""}
            onClick={() => {
              setCategory("Tất cả");
              setSubcategory("Tất cả");
            }}
          >
            <span className="category-icon start">
              <HomeIcon />
            </span>
            <b>{tr("Bắt đầu", "Start")}</b>
          </button>
          {categories.map((c) => {
            const CategoryIcon = c.icon;
            return (
              <button
                key={c.name}
                className={category === c.name ? "active" : ""}
                onClick={() => {
                  setCategory(c.name);
                  setSubcategory("Tất cả");
                }}
              >
                <span
                  className="category-icon"
                  style={{ color: c.color, background: `${c.color}18` }}
                >
                  <CategoryIcon />
                </span>
                <b>{c.name}</b>
              </button>
            );
          })}
        </nav>
        <div className="library-promos">
          <article className="library-promo create-promo">
            <div className="promo-illustration" aria-hidden="true">
              <BookOpen />
              <Edit3 />
              <Sparkles />
            </div>
            <div>
              <span>
                {tr("Tạo nội dung của riêng bạn", "Create your own content")}
              </span>
              <h2>Create a quiz</h2>
              <p>
                {tr(
                  "Chơi miễn phí với tối đa 300 người tham gia",
                  "Play free with up to 300 participants",
                )}
              </p>
              <Link
                className="promo-button green"
                to={hostToken() ? "/dashboard" : "/register"}
              >
                <Edit3 /> {tr("Trình tạo quiz", "Quiz editor")}
              </Link>
            </div>
          </article>
          <article className="library-promo ai-promo">
            <div className="promo-illustration" aria-hidden="true">
              <WandSparkles />
              <BookOpen />
              <Sparkles />
            </div>
            <div>
              <span>
                {tr(
                  "Tạo nhanh bằng trí tuệ nhân tạo",
                  "Create quickly with AI",
                )}
              </span>
              <h2>A.I.</h2>
              <p>Generate a quiz from any subject or PDF</p>
              <Link
                className="promo-button cyan"
                to={hostToken() ? "/ai-create" : "/login"}
              >
                <WandSparkles /> {tr("Tạo bằng AI", "Create with AI")}
              </Link>
            </div>
          </article>
        </div>
        <div className="section-head row library-heading">
          <div>
            <span className="eyebrow">{t("exploreContent")}</span>
            <h2>{t("featuredQuizzes")}</h2>
          </div>
          <Link to={hostToken() ? "/dashboard" : "/register"}>
            {t("viewAll")} <ChevronRight />
          </Link>
        </div>
        {activeCategory && activeCategory.branches.length > 0 && (
          <div
            className="subcategory-row"
            aria-label={tr("Nhánh nội dung", "Content branches")}
          >
            {["Tất cả", ...activeCategory.branches].map((branch) => (
              <button
                key={branch}
                className={subcategory === branch ? "active" : ""}
                onClick={() => setSubcategory(branch)}
              >
                {branch === "Tất cả" ? t("all") : branch}
                {branch === "Entertainment" && (
                  <span>{tr("Phổ biến nhất", "Most popular")}</span>
                )}
              </button>
            ))}
          </div>
        )}
        <div className="quiz-grid">
          {quizzes
            .filter(
              (q) =>
                (category === "Tất cả" || q.category === category) &&
                (subcategory === "Tất cả" || q.subcategory === subcategory),
            )
            .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
            .slice(0, 12)
            .map((q) => (
              <QuizCard
                key={q.id}
                quiz={q}
                publicView
                onOpen={() => nav(`/quiz/${q.id}`)}
                onPractice={() => nav(`/practice/${q.id}`)}
              />
            ))}
        </div>
      </section>
      <section className="section">
        <div className="feature-banner">
          <div>
            <span className="eyebrow light">
              <Sparkles size={16} />{" "}
              {tr(
                "Trải nghiệm thật, dữ liệu thật",
                "Real experience, real data",
              )}
            </span>
            <h2>
              {tr(
                "Realtime không chỉ là hiệu ứng.",
                "Real-time is more than an effect.",
              )}
            </h2>
            <p>
              {tr(
                "RankRush dùng Redis Sorted Set để cập nhật điểm, duy trì thứ tự và trả đúng Top 10 mà không sắp xếp ở frontend hay backend.",
                "RankRush uses Redis Sorted Sets to update scores, preserve order, and return the exact Top 10 without sorting in the frontend or backend.",
              )}
            </p>
            <div className="feature-pills">
              <span>{tr("ZINCRBY nguyên tử", "Atomic ZINCRBY")}</span>
              <span>ZREVRANGE Top 10</span>
              <span>Socket.IO rooms</span>
              <span>Reconnect snapshot</span>
            </div>
          </div>
          <div className="mini-board">
            <h4>
              <Activity /> Live leaderboard
            </h4>
            {[
              ["🥇", "NovaFox", 4920],
              ["🥈", "LunaSpark", 4740],
              ["🥉", "ByteKnight", 4560],
              ["4", "PixelBee", 4210],
            ].map((r, i) => (
              <div key={i}>
                <b>{r[0]}</b>
                <span>{r[1]}</span>
                <strong>{Number(r[2]).toLocaleString()}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>
    </Page>
  );
}

function Auth({ mode }: { mode: "login" | "register" }) {
  const { tr } = usePreferences();
  const nav = useNavigate();
  const [form, setForm] = useState({
    displayName: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await request<{ token: string; user: unknown }>(
        `/auth/${mode}`,
        { method: "POST", body: JSON.stringify(form) },
      );
      localStorage.setItem("rr_host_token", data.token);
      localStorage.setItem("rr_user", JSON.stringify(data.user));
      nav("/dashboard");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : tr("Không thể xác thực.", "Authentication failed."),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page className="auth-page">
      <div className="auth-visual">
        <div>
          <Logo />
          <span className="eyebrow light">
            <Sparkles size={16} /> Host studio
          </span>
          <h1>
            {tr(
              "Tạo khoảnh khắc cả phòng cùng reo hò.",
              "Create moments that make the whole room cheer.",
            )}
          </h1>
          <p>
            {tr(
              "Từ câu hỏi đầu tiên đến bục chiến thắng cuối cùng — mọi thứ trong một luồng mượt mà.",
              "From the first question to the final podium, everything flows smoothly.",
            )}
          </p>
          <div className="auth-quote">
            <Trophy />
            <div>
              <strong>
                {tr(
                  "Leaderboard cập nhật tức thì",
                  "Instant leaderboard updates",
                )}
              </strong>
              <span>
                {tr(
                  "Được vận hành trực tiếp bởi Redis ZSET",
                  "Powered directly by Redis ZSET",
                )}
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="auth-form">
        <div className="auth-card">
          <span className="eyebrow">
            {mode === "login"
              ? tr("Chào mừng trở lại", "Welcome back")
              : tr("Bắt đầu miễn phí", "Get started free")}
          </span>
          <h2>
            {mode === "login"
              ? tr("Đăng nhập Host", "Host login")
              : tr("Tạo tài khoản Host", "Create a Host account")}
          </h2>
          <p>
            {mode === "login"
              ? tr(
                  "Quản lý quiz và bắt đầu game tiếp theo.",
                  "Manage quizzes and start your next game.",
                )
              : tr(
                  "Không cần thẻ thanh toán. Người chơi không cần đăng ký.",
                  "No payment card required. Players do not need to register.",
                )}
          </p>
          <form onSubmit={submit}>
            {mode === "register" && (
              <label>
                {tr("Tên hiển thị", "Display name")}
                <input
                  value={form.displayName}
                  onChange={(e) =>
                    setForm({ ...form, displayName: e.target.value })
                  }
                  placeholder={tr("Thành Danh", "John Smith")}
                  required
                />
              </label>
            )}
            <label>
              Email
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="you@example.com"
                required
              />
            </label>
            <label>
              {tr("Mật khẩu", "Password")}
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder={tr("Tối thiểu 8 ký tự", "At least 8 characters")}
                required
                minLength={8}
              />
            </label>
            {mode === "login" && (
              <Link className="forgot-link" to="/forgot-password">
                {tr("Quên mật khẩu?", "Forgot password?")}
              </Link>
            )}
            <ErrorBox error={error} />
            <button
              disabled={busy}
              className="button button-primary button-block button-lg"
            >
              {busy
                ? tr("Đang xử lý...", "Processing...")
                : mode === "login"
                  ? tr("Đăng nhập", "Log in")
                  : tr("Tạo tài khoản", "Create account")}
            </button>
          </form>
          <p className="auth-switch">
            {mode === "login"
              ? tr("Chưa có tài khoản? ", "No account yet? ")
              : tr("Đã có tài khoản? ", "Already have an account? ")}
            <Link to={mode === "login" ? "/register" : "/login"}>
              {mode === "login"
                ? tr("Đăng ký", "Register")
                : tr("Đăng nhập", "Log in")}
            </Link>
          </p>
          {mode === "login" && (
            <div className="demo-account">
              <b>{tr("Tài khoản demo", "Demo account")}</b>
              <span>danhtn@rankrush.local</span>
              <span>RankRush@123</span>
            </div>
          )}
        </div>
      </div>
    </Page>
  );
}

function ForgotPassword() {
  const { tr } = usePreferences();
  const [step, setStep] = useState<"request" | "reset" | "done">("request");
  const [form, setForm] = useState({ email: "", code: "", password: "" });
  const [devCode, setDevCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (step === "request") {
        const result = await request<{ devCode?: string }>(
          "/auth/forgot-password",
          { method: "POST", body: JSON.stringify({ email: form.email }) },
        );
        setDevCode(result.devCode || "");
        setStep("reset");
      } else {
        await request("/auth/reset-password", {
          method: "POST",
          body: JSON.stringify(form),
        });
        setStep("done");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page className="reset-page">
      <section className="reset-card">
        <Logo />
        {step === "done" ? (
          <>
            <Check className="reset-success" />
            <h1>{tr("Đã đổi mật khẩu", "Password changed")}</h1>
            <p>
              {tr(
                "Bạn có thể đăng nhập bằng mật khẩu mới.",
                "You can now log in with your new password.",
              )}
            </p>
            <Link className="button button-primary button-block" to="/login">
              {tr("Về trang đăng nhập", "Back to login")}
            </Link>
          </>
        ) : (
          <>
            <span className="eyebrow">
              {tr("Khôi phục tài khoản", "Account recovery")}
            </span>
            <h1>
              {step === "request"
                ? tr("Quên mật khẩu?", "Forgot password?")
                : tr("Nhập mã xác nhận", "Enter verification code")}
            </h1>
            <p>
              {step === "request"
                ? tr(
                    "Nhập email tài khoản Host để nhận mã đặt lại.",
                    "Enter your Host account email to receive a reset code.",
                  )
                : tr(
                    `Mã gồm 6 số đã được tạo cho ${form.email}.`,
                    `A 6-digit code was created for ${form.email}.`,
                  )}
            </p>
            <form onSubmit={submit}>
              {step === "request" ? (
                <label>
                  Email
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                    placeholder="you@example.com"
                  />
                </label>
              ) : (
                <>
                  <label>
                    {tr("Mã xác nhận", "Verification code")}
                    <input
                      className="reset-code"
                      inputMode="numeric"
                      maxLength={6}
                      required
                      value={form.code}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          code: e.target.value.replace(/\D/g, "").slice(0, 6),
                        })
                      }
                      placeholder="000000"
                    />
                  </label>
                  {devCode && (
                    <div className="dev-code">
                      {tr("Mã demo", "Demo code")}: <b>{devCode}</b>
                    </div>
                  )}
                  <label>
                    {tr("Mật khẩu mới", "New password")}
                    <input
                      type="password"
                      minLength={8}
                      required
                      value={form.password}
                      onChange={(e) =>
                        setForm({ ...form, password: e.target.value })
                      }
                      placeholder={tr(
                        "Tối thiểu 8 ký tự",
                        "At least 8 characters",
                      )}
                    />
                  </label>
                </>
              )}
              <ErrorBox error={error} />
              <button
                className="button button-primary button-block"
                disabled={busy}
              >
                {busy
                  ? tr("Đang xử lý...", "Processing...")
                  : step === "request"
                    ? tr("Tạo mã đặt lại", "Create reset code")
                    : tr("Đổi mật khẩu", "Change password")}
              </button>
            </form>
            <Link className="forgot-back" to="/login">
              <ArrowLeft />
              {tr("Quay lại đăng nhập", "Back to login")}
            </Link>
          </>
        )}
      </section>
    </Page>
  );
}

function QuizCard({
  quiz,
  onOpen,
  onPractice,
  onHost,
  onClone,
  onDelete,
  publicView = false,
}: {
  quiz: Quiz;
  onOpen: () => void;
  onPractice?: () => void;
  onHost?: () => void;
  onClone?: () => void;
  onDelete?: () => void;
  publicView?: boolean;
}) {
  const { tr } = usePreferences();
  return (
    <article className="quiz-card">
      <div
        className="quiz-cover"
        style={{
          background: `linear-gradient(135deg,${quiz.coverColor},${quiz.coverColor}bb)`,
        }}
      >
        <span>{quiz.category}</span>
        <BookOpen />
        <div className="quiz-cover-dots" />
      </div>
      <div className="quiz-body">
        <div className="quiz-meta">
          <span className={cx("status", quiz.status.toLowerCase())}>
            {quiz.status === "PUBLISHED"
              ? tr("Công khai", "Public")
              : quiz.status === "DRAFT"
                ? tr("Bản nháp", "Draft")
                : tr("Lưu trữ", "Archived")}
          </span>
          <span>
            <CircleHelp />
            {quiz.questionCount || 0} {tr("câu", "questions")}
          </span>
          <span>
            <Clock3 />
            20 {tr("giây/câu", "sec/question")}
          </span>
        </div>
        {quiz.subcategory && (
          <div className="quiz-specialty">
            <Target /> {quiz.subcategory}
            {(quiz.popularity || 0) >= 90 && (
              <b>{tr("Đang nổi bật", "Featured")}</b>
            )}
          </div>
        )}
        <h3>{quiz.title}</h3>
        <p>
          {quiz.description ||
            tr(
              "Quiz tương tác trực tiếp cùng RankRush.",
              "An interactive live quiz with RankRush.",
            )}
        </p>
        <div className="quiz-actions">
          {publicView ? (
            <>
              <button className="button button-secondary" onClick={onOpen}>
                <Eye />
                {tr("Chi tiết", "Details")}
              </button>
              <button className="button button-primary" onClick={onPractice}>
                <Play />
                {tr("Chơi ngay", "Play now")}
              </button>
            </>
          ) : (
            <>
              <button
                className="icon-button"
                title={tr("Chỉnh sửa", "Edit")}
                onClick={onOpen}
              >
                <Edit3 />
              </button>
              <button className="button button-primary" onClick={onHost}>
                <Play />
                {tr("Tổ chức", "Host")}
              </button>
              <button
                className="icon-button"
                title={tr("Nhân bản", "Duplicate")}
                onClick={onClone}
              >
                <Copy />
              </button>
              <button
                className="icon-button danger"
                title={tr("Xóa", "Delete")}
                onClick={onDelete}
              >
                <Trash2 />
              </button>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

function Dashboard() {
  const { tr } = usePreferences();
  const nav = useNavigate();
  const location = useLocation();
  const quizOnly = location.pathname.endsWith("/quizzes");
  const toast = useToast();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [statusFilter, setStatusFilter] = useState<"ALL" | Quiz["status"]>(
    "ALL",
  );
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const token = hostToken();
  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("rr_user") || "{}") as {
        displayName?: string;
      };
    } catch {
      return {};
    }
  }, []);
  const load = () =>
    request<Quiz[]>("/quizzes?mine=1", { token })
      .then(setQuizzes)
      .finally(() => setLoading(false));
  useEffect(() => {
    if (token) void load();
  }, []);
  if (!token) return <Navigate to="/login" />;
  async function create() {
    setCreating(true);
    try {
      const q = await request<Quiz>("/quizzes", {
        method: "POST",
        token,
        body: JSON.stringify({
          title: tr("Quiz chưa đặt tên", "Untitled quiz"),
          description: "",
          category: tr("Công nghệ", "Technology"),
          coverColor: "#6C5CE7",
          status: "DRAFT",
        }),
      });
      nav(`/editor/${q.id}`);
    } finally {
      setCreating(false);
    }
  }
  async function host(q: Quiz) {
    try {
      const s = await request<{ id: string }>("/sessions", {
        method: "POST",
        token,
        body: JSON.stringify({
          quizId: q.id,
          settings: {
            teamMode: false,
            hideLeaderboard: false,
            safeNames: false,
            hideCountryFlags: false,
            mutePlayers: false,
            speedScoring: true,
          },
        }),
      });
      nav(`/host/${s.id}`);
    } catch (e) {
      toast.show(
        e instanceof Error
          ? e.message
          : tr("Không thể tạo phòng.", "Could not create the room."),
      );
    }
  }
  async function remove(q: Quiz) {
    if (!confirm(tr(`Xóa quiz “${q.title}”?`, `Delete quiz “${q.title}”?`)))
      return;
    await request(`/quizzes/${q.id}`, { method: "DELETE", token });
    toast.show(tr("Đã xóa quiz.", "Quiz deleted."));
    void load();
  }
  async function clone(q: Quiz) {
    const copy = await request<Quiz>(`/quizzes/${q.id}/clone`, {
      method: "POST",
      token,
    });
    toast.show(tr("Đã tạo bản sao quiz.", "Quiz duplicated."));
    nav(`/editor/${copy.id}`);
  }
  return (
    <>
      <div className="dashboard-shell">
        <DashboardSideNav
          active={
            location.pathname.endsWith("/quizzes") ? "quizzes" : "overview"
          }
        />
        <div className="dashboard-main">
          <div className="dashboard-top">
            <div>
              <span className="eyebrow">Host studio</span>
              <h1>
                {quizOnly
                  ? tr("Quiz của tôi", "My quizzes")
                  : tr(
                      `Chào ${user.displayName || "Host"}`,
                      `Hello ${user.displayName || "Host"}`,
                    )}
              </h1>
              <p>
                {quizOnly
                  ? tr(
                      "Tạo, chỉnh sửa hoặc tổ chức quiz.",
                      "Create, edit, or host a quiz.",
                    )
                  : tr(
                      "Sẵn sàng tạo một phiên chơi mới?",
                      "Ready to start a new game?",
                    )}
              </p>
            </div>
            <button
              disabled={creating}
              className="button button-primary button-lg"
              onClick={create}
            >
              <Plus />
              {tr("Tạo quiz mới", "Create new quiz")}
            </button>
          </div>
          {!quizOnly && (
            <div className="stat-cards">
              <div>
                <span className="stat-icon purple">
                  <BookOpen />
                </span>
                <b>{quizzes.length}</b>
                <small>{tr("Quiz của bạn", "Your quizzes")}</small>
              </div>
              <div>
                <span className="stat-icon teal">
                  <Radio />
                </span>
                <b>0</b>
                <small>{tr("Phiên đang live", "Live sessions")}</small>
              </div>
              <div>
                <span className="stat-icon orange">
                  <Users />
                </span>
                <b>60</b>
                <small>{tr("Người chơi mẫu", "Demo players")}</small>
              </div>
              <div>
                <span className="stat-icon blue">
                  <Trophy />
                </span>
                <b>132</b>
                <small>{tr("Bản ghi seed", "Seed records")}</small>
              </div>
            </div>
          )}
          <section className="dashboard-section">
            <div className="section-title">
              <div>
                <h2>{tr("Quiz của tôi", "My quizzes")}</h2>
                <p>
                  {tr(
                    "Tạo, chỉnh sửa và bắt đầu game trực tiếp.",
                    "Create, edit, and start a live game.",
                  )}
                </p>
              </div>
              <div className="segmented">
                <button
                  className={statusFilter === "ALL" ? "active" : ""}
                  onClick={() => setStatusFilter("ALL")}
                >
                  {tr("Tất cả", "All")}
                </button>
                <button
                  className={statusFilter === "PUBLISHED" ? "active" : ""}
                  onClick={() => setStatusFilter("PUBLISHED")}
                >
                  {tr("Đã xuất bản", "Published")}
                </button>
                <button
                  className={statusFilter === "DRAFT" ? "active" : ""}
                  onClick={() => setStatusFilter("DRAFT")}
                >
                  {tr("Bản nháp", "Drafts")}
                </button>
              </div>
            </div>
            {loading ? (
              <div className="loader">
                {tr("Đang tải quiz...", "Loading quizzes...")}
              </div>
            ) : quizzes.length ? (
              <div className="quiz-grid dashboard-grid">
                {quizzes
                  .filter(
                    (q) => statusFilter === "ALL" || q.status === statusFilter,
                  )
                  .map((q) => (
                    <QuizCard
                      key={q.id}
                      quiz={q}
                      onOpen={() => nav(`/editor/${q.id}`)}
                      onHost={() => void host(q)}
                      onClone={() => void clone(q)}
                      onDelete={() => void remove(q)}
                    />
                  ))}
              </div>
            ) : (
              <Empty
                icon={<BookOpen />}
                title={tr("Chưa có quiz nào", "No quizzes yet")}
                text={tr(
                  "Tạo quiz đầu tiên và mời cả phòng cùng chơi.",
                  "Create your first quiz and invite everyone to play.",
                )}
                action={
                  <button className="button button-primary" onClick={create}>
                    <Plus />
                    {tr("Tạo quiz", "Create quiz")}
                  </button>
                }
              />
            )}
          </section>
        </div>
      </div>
      {toast.node}
    </>
  );
}

type SessionSummary = Snapshot["session"] & {
  quiz: { id: string; title: string; category: string } | null;
  playerCount: number;
  top: LeaderboardEntry[];
};

function DashboardSideNav({ active }: { active: string }) {
  const { tr } = usePreferences();
  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("rr_user") || "{}") as {
        displayName?: string;
      };
    } catch {
      return {};
    }
  }, []);
  const item = (to: string, key: string, icon: ReactNode, label: string) => (
    <Link className={active === key ? "active" : ""} to={to}>
      {icon}
      {label}
    </Link>
  );
  return (
    <aside className="sidebar">
      <Logo />
      <nav>
        {item(
          "/dashboard",
          "overview",
          <HomeIcon />,
          tr("Tổng quan", "Overview"),
        )}
        {item(
          "/dashboard/quizzes",
          "quizzes",
          <Library />,
          tr("Quiz của tôi", "My quizzes"),
        )}
        {item(
          "/ai-create",
          "ai",
          <WandSparkles />,
          tr("Tạo tự động", "AI creator"),
        )}
        <a href="/#library">
          <Globe2 />
          {tr("Thư viện", "Library")}
        </a>
        <span>{tr("PHÂN TÍCH", "ANALYTICS")}</span>
        {item(
          "/dashboard/reports",
          "reports",
          <BarChart3 />,
          tr("Báo cáo", "Reports"),
        )}
        {item(
          "/dashboard/leaderboards",
          "leaderboards",
          <Trophy />,
          tr("Bảng xếp hạng", "Leaderboards"),
        )}
        <span>{tr("TÀI KHOẢN", "ACCOUNT")}</span>
        {item(
          "/dashboard/settings",
          "settings",
          <Settings2 />,
          tr("Cài đặt", "Settings"),
        )}
      </nav>
      <div className="sidebar-user">
        <div>{(user.displayName || "H")[0]}</div>
        <span>
          <b>{user.displayName || "Host"}</b>
          <small>{tr("Tài khoản Host", "Host account")}</small>
        </span>
      </div>
    </aside>
  );
}

function DashboardWorkspace({
  active,
  children,
}: {
  active: string;
  children: ReactNode;
}) {
  if (!hostToken()) return <Navigate to="/login" />;
  return (
    <div className="dashboard-shell dashboard-standalone">
      <DashboardSideNav active={active} />
      <main className="dashboard-main">
        <div className="workspace-mobile-head">
          <Logo />
          <Link to="/dashboard">
            <ArrowLeft />
            Dashboard
          </Link>
        </div>
        {children}
      </main>
    </div>
  );
}

function ReportsPage() {
  const { tr } = usePreferences();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    void request<SessionSummary[]>("/sessions", { token: hostToken() })
      .then(setSessions)
      .finally(() => setLoading(false));
  }, []);
  return (
    <DashboardWorkspace active="reports">
      <div className="subpage-head">
        <div>
          <span className="eyebrow">{tr("Phân tích", "Analytics")}</span>
          <h1>{tr("Báo cáo phiên chơi", "Game reports")}</h1>
          <p>
            {tr(
              "Mở kết quả chi tiết hoặc tiếp tục phiên đang chạy.",
              "Open detailed results or continue an active session.",
            )}
          </p>
        </div>
      </div>
      {loading ? (
        <div className="loader">{tr("Đang tải...", "Loading...")}</div>
      ) : (
        <div className="session-list">
          {sessions.map((session) => (
            <article key={session.id}>
              <div className="session-icon">
                <BarChart3 />
              </div>
              <div>
                <b>
                  {session.quiz?.title || tr("Quiz đã xóa", "Deleted quiz")}
                </b>
                <span>
                  {new Date(session.createdAt).toLocaleString("vi-VN")}
                </span>
              </div>
              <span
                className={cx("session-state", session.state.toLowerCase())}
              >
                {session.state === "ENDED"
                  ? tr("Đã kết thúc", "Ended")
                  : session.state === "LOBBY"
                    ? tr("Phòng chờ", "Lobby")
                    : tr("Đang chạy", "Running")}
              </span>
              <strong>
                {session.playerCount} {tr("người", "players")}
              </strong>
              <Link
                className="button button-secondary"
                to={
                  session.state === "ENDED"
                    ? `/report/${session.id}`
                    : `/host/${session.id}`
                }
              >
                {session.state === "ENDED"
                  ? tr("Xem báo cáo", "View report")
                  : tr("Mở phiên", "Open session")}
              </Link>
            </article>
          ))}
          {!sessions.length && (
            <Empty
              icon={<BarChart3 />}
              title={tr("Chưa có báo cáo", "No reports yet")}
              text={tr(
                "Tổ chức một quiz để dữ liệu xuất hiện ở đây.",
                "Host a quiz to see data here.",
              )}
            />
          )}
        </div>
      )}
    </DashboardWorkspace>
  );
}

function LeaderboardsPage() {
  const { tr } = usePreferences();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [selected, setSelected] = useState("");
  const [board, setBoard] = useState<LeaderboardEntry[]>([]);
  useEffect(() => {
    void request<SessionSummary[]>("/sessions", { token: hostToken() }).then(
      (rows) => {
        setSessions(rows);
        setSelected(rows[0]?.id || "");
      },
    );
  }, []);
  useEffect(() => {
    if (!selected) return;
    void request<{ leaderboard: LeaderboardEntry[] }>(
      `/sessions/${selected}/leaderboard?limit=100`,
      { token: hostToken() },
    ).then((data) => setBoard(data.leaderboard));
  }, [selected]);
  return (
    <DashboardWorkspace active="leaderboards">
      <div className="subpage-head row">
        <div>
          <span className="eyebrow">{tr("Kết quả", "Results")}</span>
          <h1>{tr("Bảng xếp hạng", "Leaderboard")}</h1>
          <p>
            {tr(
              "Chọn một phiên để xem toàn bộ thứ hạng do Redis trả về.",
              "Select a session to view the complete ranking returned by Redis.",
            )}
          </p>
        </div>
        <select value={selected} onChange={(e) => setSelected(e.target.value)}>
          {sessions.map((session) => (
            <option key={session.id} value={session.id}>
              {session.quiz?.title} ·{" "}
              {new Date(session.createdAt).toLocaleDateString("vi-VN")}
            </option>
          ))}
        </select>
      </div>
      <section className="dashboard-section ranking-page">
        <Leaderboard entries={board} />
      </section>
    </DashboardWorkspace>
  );
}

function SettingsPage() {
  const { tr } = usePreferences();
  const toast = useToast();
  const [form, setForm] = useState({
    displayName: "",
    email: "",
    password: "",
  });
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    void request<{ displayName: string; email: string }>("/auth/me", {
      token: hostToken(),
    }).then((user) => setForm({ ...user, password: "" }));
  }, []);
  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const user = await request<{ displayName: string; email: string }>(
        "/auth/me",
        {
          method: "PUT",
          token: hostToken(),
          body: JSON.stringify({
            displayName: form.displayName,
            password: form.password,
          }),
        },
      );
      localStorage.setItem("rr_user", JSON.stringify(user));
      setForm({ ...form, password: "" });
      toast.show(tr("Đã lưu cài đặt tài khoản.", "Account settings saved."));
    } catch (error) {
      toast.show((error as Error).message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <DashboardWorkspace active="settings">
      <div className="subpage-head">
        <div>
          <span className="eyebrow">{tr("Tài khoản", "Account")}</span>
          <h1>{tr("Cài đặt", "Settings")}</h1>
          <p>
            {tr(
              "Cập nhật tên hiển thị và mật khẩu đăng nhập.",
              "Update your display name and login password.",
            )}
          </p>
        </div>
      </div>
      <section className="settings-card">
        <form onSubmit={save}>
          <label>
            {tr("Tên hiển thị", "Display name")}
            <input
              value={form.displayName}
              onChange={(e) =>
                setForm({ ...form, displayName: e.target.value })
              }
              required
              minLength={2}
            />
          </label>
          <label>
            Email
            <input value={form.email} disabled />
          </label>
          <label>
            {tr("Mật khẩu mới", "New password")}{" "}
            <small>
              {tr(
                "Để trống nếu không muốn thay đổi",
                "Leave blank to keep the current password",
              )}
            </small>
            <input
              type="password"
              minLength={8}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </label>
          <button className="button button-primary" disabled={saving}>
            <Save />
            {saving
              ? tr("Đang lưu...", "Saving...")
              : tr("Lưu thay đổi", "Save changes")}
          </button>
        </form>
      </section>
      {toast.node}
    </DashboardWorkspace>
  );
}

function AiCreatePage() {
  const { tr } = usePreferences();
  const nav = useNavigate();
  const [form, setForm] = useState({
    subject: "",
    title: "",
    category: "Education",
    questionCount: 5,
  });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [aiStatus, setAiStatus] = useState<{
    enabled: boolean;
    reachable: boolean;
    model: string;
    modelInstalled: boolean;
    models: string[];
  } | null>(null);
  useEffect(() => {
    void request<{
      enabled: boolean;
      reachable: boolean;
      model: string;
      modelInstalled: boolean;
      models: string[];
    }>("/ai/status", { token: hostToken() })
      .then(setAiStatus)
      .catch(() =>
        setAiStatus({
          enabled: true,
          reachable: false,
          model: "qwen2.5:3b",
          modelInstalled: false,
          models: [],
        }),
      );
  }, []);
  if (!hostToken()) return <Navigate to="/login" />;
  async function generate(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      Object.entries(form).forEach(([key, value]) =>
        body.append(key, String(value)),
      );
      if (file) body.append("pdf", file);
      const result = await request<{
        quiz: Quiz;
        questionCount: number;
        provider: "OLLAMA" | "LOCAL_FALLBACK";
        model: string;
        warning?: string;
      }>("/ai/generate-quiz", {
        method: "POST",
        token: hostToken(),
        body,
      });
      sessionStorage.setItem(
        "rr_ai_notice",
        result.provider === "OLLAMA"
          ? tr(
              `Đã tạo ${result.questionCount} câu bằng Ollama ${result.model}.`,
              `Created ${result.questionCount} questions with Ollama ${result.model}.`,
            )
          : tr(
              `Ollama chưa sẵn sàng; đã tạo ${result.questionCount} câu bằng bộ sinh dự phòng.`,
              `Ollama was unavailable; created ${result.questionCount} questions with the fallback generator.`,
            ),
      );
      nav(`/editor/${result.quiz.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <DashboardWorkspace active="ai">
      <div className="ai-create-page">
        <button className="text-button back" onClick={() => nav("/dashboard")}>
          <ArrowLeft />
          Dashboard
        </button>
        <div className="ai-create-grid">
          <section className="ai-copy">
            <span className="eyebrow">A.I.</span>
            <h1>
              {tr("Tạo quiz từ", "Generate a quiz from")}
              <br />
              <em>{tr("bất kỳ chủ đề hoặc PDF nào", "any subject or PDF")}</em>
            </h1>
            <p>
              {tr(
                "Nhập chủ đề hoặc tải tài liệu. RankRush tạo một bản nháp để bạn kiểm tra, sửa và xuất bản.",
                "Enter a subject or upload a document. RankRush creates a draft for you to review, edit, and publish.",
              )}
            </p>
            <ol>
              <li>
                <b>1</b> {tr("Chọn nguồn nội dung", "Choose a content source")}
              </li>
              <li>
                <b>2</b>{" "}
                {tr("Tạo câu hỏi tự động", "Generate questions automatically")}
              </li>
              <li>
                <b>3</b>{" "}
                {tr("Rà soát trong Quiz Editor", "Review in Quiz Editor")}
              </li>
            </ol>
          </section>
          <section className="generator-card">
            <form onSubmit={generate}>
              <div className="source-tabs">
                <span className={!file ? "active" : ""}>
                  <WandSparkles />
                  {tr("Chủ đề", "Subject")}
                </span>
                <span className={file ? "active" : ""}>
                  <BookOpen />
                  PDF
                </span>
              </div>
              <div
                className={cx(
                  "ai-provider-status",
                  !aiStatus
                    ? "loading"
                    : aiStatus.reachable && aiStatus.modelInstalled
                      ? "ready"
                      : "unavailable",
                )}
              >
                <Cpu />
                <div>
                  <b>
                    Ollama ·{" "}
                    {aiStatus?.model || tr("đang kiểm tra", "checking")}
                  </b>
                  <span>
                    {!aiStatus
                      ? tr(
                          "Đang kết nối dịch vụ AI cục bộ...",
                          "Connecting to local AI...",
                        )
                      : aiStatus.reachable && aiStatus.modelInstalled
                        ? tr(
                            "Đã sẵn sàng · dữ liệu xử lý trên máy",
                            "Ready · data stays on this device",
                          )
                        : aiStatus.reachable
                          ? tr(
                              "Ollama đang chạy nhưng chưa có model",
                              "Ollama is running but the model is missing",
                            )
                          : tr(
                              "Không kết nối được · sẽ dùng bộ sinh dự phòng",
                              "Unavailable · the fallback generator will be used",
                            )}
                  </span>
                </div>
                <i />
              </div>
              <label>
                {tr("Chủ đề", "Subject")}
                <input
                  value={form.subject}
                  onChange={(e) =>
                    setForm({ ...form, subject: e.target.value })
                  }
                  placeholder={tr(
                    "Ví dụ: Redis và bảng xếp hạng",
                    "Example: Redis and leaderboards",
                  )}
                />
              </label>
              <label className="pdf-drop">
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                <BookOpen />
                <b>
                  {file
                    ? file.name
                    : tr("Thả hoặc chọn tệp PDF", "Drop or choose a PDF")}
                </b>
                <span>
                  {tr(
                    "Tối đa 10 MB · PDF có văn bản",
                    "Up to 10 MB · text-based PDF",
                  )}
                </span>
              </label>
              <div className="form-grid">
                <label>
                  {tr("Tên quiz", "Quiz name")}
                  <input
                    value={form.title}
                    onChange={(e) =>
                      setForm({ ...form, title: e.target.value })
                    }
                    placeholder={tr(
                      "Để trống để dùng tên chủ đề",
                      "Leave blank to use the subject",
                    )}
                  />
                </label>
                <label>
                  {tr("Số câu", "Question count")}
                  <select
                    value={form.questionCount}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        questionCount: Number(e.target.value),
                      })
                    }
                  >
                    {[3, 5, 8, 10, 12, 15].map((n) => (
                      <option key={n}>{n}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                {tr("Danh mục", "Category")}
                <select
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value })
                  }
                >
                  {categories.map((category) => (
                    <option key={category.name}>{category.name}</option>
                  ))}
                </select>
              </label>
              <ErrorBox error={error} />
              <button
                className="button button-primary button-lg button-block"
                disabled={busy || (!form.subject.trim() && !file)}
              >
                <WandSparkles />
                {busy
                  ? tr(
                      "Ollama đang đọc và tạo câu hỏi...",
                      "Ollama is reading and generating questions...",
                    )
                  : tr("Tạo quiz tự động", "Generate quiz")}
              </button>
              <small className="generator-note">
                {tr(
                  "Nội dung tạo tự động cần được Host kiểm tra trước khi sử dụng.",
                  "AI-generated content must be reviewed by the Host before use.",
                )}
              </small>
            </form>
          </section>
        </div>
      </div>
    </DashboardWorkspace>
  );
}

function Editor() {
  const { tr } = usePreferences();
  const { id = "" } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const token = hostToken();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selected, setSelected] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    request<{ quiz: Quiz; questions: Question[] }>(`/quizzes/${id}?editor=1`, {
      token,
    })
      .then((d) => {
        setQuiz(d.quiz);
        setQuestions(d.questions);
      })
      .catch((e) => toast.show(e.message));
  }, [id]);
  useEffect(() => {
    const notice = sessionStorage.getItem("rr_ai_notice");
    if (notice) {
      sessionStorage.removeItem("rr_ai_notice");
      toast.show(notice);
    }
  }, []);
  if (!token) return <Navigate to="/login" />;
  if (!quiz)
    return (
      <div className="full-loader">
        <Zap />
        {tr("Đang mở Quiz Editor...", "Opening Quiz Editor...")}
      </div>
    );
  const current = questions[selected];
  async function saveQuiz() {
    setSaving(true);
    try {
      await request(`/quizzes/${quiz!.id}`, {
        method: "PUT",
        token,
        body: JSON.stringify(quiz),
      });
      toast.show(tr("Đã lưu thông tin quiz.", "Quiz details saved."));
    } catch (e) {
      toast.show((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  function blankQuestion(): Omit<Question, "id" | "quizId"> {
    const a = { id: crypto.randomUUID(), text: tr("Đáp án A", "Answer A") },
      b = { id: crypto.randomUUID(), text: tr("Đáp án B", "Answer B") };
    return {
      type: "SINGLE_CHOICE",
      prompt: tr("Câu hỏi mới", "New question"),
      options: [a, b],
      correctOptionId: a.id,
      acceptedAnswers: [],
      timeLimitSec: 20,
      basePoints: 600,
      order: questions.length,
      explanation: "",
    };
  }
  async function addQuestion() {
    const q = await request<Question>(`/quizzes/${quiz!.id}/questions`, {
      method: "POST",
      token,
      body: JSON.stringify(blankQuestion()),
    });
    setQuestions([...questions, q]);
    setSelected(questions.length);
    toast.show(tr("Đã thêm câu hỏi.", "Question added."));
  }
  async function saveQuestion(q: Question) {
    const updated = await request<Question>(`/questions/${q.id}`, {
      method: "PUT",
      token,
      body: JSON.stringify(q),
    });
    setQuestions(questions.map((x) => (x.id === q.id ? updated : x)));
    toast.show(tr("Đã lưu câu hỏi.", "Question saved."));
  }
  async function removeQuestion(q: Question) {
    if (!confirm(tr("Xóa câu hỏi này?", "Delete this question?"))) return;
    await request(`/questions/${q.id}`, { method: "DELETE", token });
    const next = questions.filter((x) => x.id !== q.id);
    setQuestions(next);
    setSelected(Math.max(0, Math.min(selected, next.length - 1)));
  }
  return (
    <div className="editor-page">
      <header className="editor-header">
        <button className="icon-button" onClick={() => nav("/dashboard")}>
          <ArrowLeft />
        </button>
        <div>
          <input
            className="title-input"
            value={quiz.title}
            onChange={(e) => setQuiz({ ...quiz, title: e.target.value })}
          />
          <span>
            {questions.length} {tr("câu hỏi", "questions")} •{" "}
            {quiz.status === "PUBLISHED"
              ? tr("Công khai", "Public")
              : tr("Bản nháp", "Draft")}
          </span>
        </div>
        <div className="editor-header-actions">
          <select
            value={quiz.status}
            onChange={(e) =>
              setQuiz({ ...quiz, status: e.target.value as Quiz["status"] })
            }
          >
            <option value="DRAFT">{tr("Bản nháp", "Draft")}</option>
            <option value="PUBLISHED">{tr("Công khai", "Public")}</option>
            <option value="ARCHIVED">{tr("Lưu trữ", "Archived")}</option>
          </select>
          <button
            className="button button-primary"
            onClick={() => void saveQuiz()}
            disabled={saving}
          >
            <Save />
            {saving ? tr("Đang lưu", "Saving") : tr("Lưu quiz", "Save quiz")}
          </button>
        </div>
      </header>
      <div className="editor-layout">
        <aside className="question-list">
          <div className="question-list-head">
            <b>{tr("Câu hỏi", "Questions")}</b>
            <button className="icon-button" onClick={() => void addQuestion()}>
              <Plus />
            </button>
          </div>
          {questions.map((q, i) => (
            <button
              key={q.id}
              className={cx("question-thumb", i === selected && "active")}
              onClick={() => setSelected(i)}
            >
              <span>{i + 1}</span>
              <div>
                <b>{q.prompt}</b>
                <small>
                  {q.type === "TEXT"
                    ? tr("Nhập văn bản", "Text answer")
                    : tr("Trắc nghiệm", "Multiple choice")}{" "}
                  • {q.timeLimitSec}s
                </small>
              </div>
            </button>
          ))}
          <button className="add-question" onClick={() => void addQuestion()}>
            <Plus />
            {tr("Thêm câu hỏi", "Add question")}
          </button>
        </aside>
        <main className="question-editor">
          {current ? (
            <QuestionForm
              question={current}
              onChange={(q) =>
                setQuestions(questions.map((x) => (x.id === q.id ? q : x)))
              }
              onSave={() => void saveQuestion(current)}
              onDelete={() => void removeQuestion(current)}
            />
          ) : (
            <Empty
              icon={<CircleHelp />}
              title={tr("Quiz chưa có câu hỏi", "This quiz has no questions")}
              text={tr(
                "Thêm câu hỏi đầu tiên để bắt đầu.",
                "Add the first question to get started.",
              )}
              action={
                <button
                  className="button button-primary"
                  onClick={() => void addQuestion()}
                >
                  <Plus />
                  {tr("Thêm câu hỏi", "Add question")}
                </button>
              }
            />
          )}
        </main>
        <aside className="quiz-settings">
          <h3>
            <Settings2 />
            {tr("Cài đặt quiz", "Quiz settings")}
          </h3>
          <label>
            {tr("Mô tả", "Description")}
            <textarea
              value={quiz.description}
              onChange={(e) =>
                setQuiz({ ...quiz, description: e.target.value })
              }
            />
          </label>
          <label>
            {tr("Danh mục", "Category")}
            <select
              value={quiz.category}
              onChange={(e) => setQuiz({ ...quiz, category: e.target.value })}
            >
              {categories.map((c) => (
                <option key={c.name}>{c.name}</option>
              ))}
            </select>
          </label>
          <label>
            {tr("Màu chủ đạo", "Theme color")}
            <input
              type="color"
              value={quiz.coverColor}
              onChange={(e) => setQuiz({ ...quiz, coverColor: e.target.value })}
            />
          </label>
          <Toggle
            label={tr("Xáo trộn câu hỏi", "Shuffle questions")}
            value={quiz.settings.shuffleQuestions}
            onChange={(v) =>
              setQuiz({
                ...quiz,
                settings: { ...quiz.settings, shuffleQuestions: v },
              })
            }
          />
          <Toggle
            label={tr("Xáo trộn đáp án", "Shuffle answers")}
            value={quiz.settings.shuffleAnswers}
            onChange={(v) =>
              setQuiz({
                ...quiz,
                settings: { ...quiz.settings, shuffleAnswers: v },
              })
            }
          />
          <Toggle
            label={tr("Hiện leaderboard", "Show leaderboard")}
            value={quiz.settings.showLeaderboard}
            onChange={(v) =>
              setQuiz({
                ...quiz,
                settings: { ...quiz.settings, showLeaderboard: v },
              })
            }
          />
          <button
            className="button button-secondary button-block"
            onClick={() => void saveQuiz()}
          >
            <Save />
            {tr("Lưu cài đặt", "Save settings")}
          </button>
        </aside>
      </div>
      {toast.node}
    </div>
  );
}

function Toggle({
  label,
  value,
  onChange,
  description,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  description?: string;
}) {
  return (
    <label className="toggle-row">
      <span>
        <b>{label}</b>
        {description && <small>{description}</small>}
      </span>
      <button
        type="button"
        className={cx("toggle", value && "on")}
        onClick={() => onChange(!value)}
      >
        <i />
      </button>
    </label>
  );
}
function QuestionForm({
  question: q,
  onChange,
  onSave,
  onDelete,
}: {
  question: Question;
  onChange: (q: Question) => void;
  onSave: () => void;
  onDelete: () => void;
}) {
  const { tr } = usePreferences();
  function setOption(id: string, text: string) {
    onChange({
      ...q,
      options: q.options.map((o) => (o.id === id ? { ...o, text } : o)),
    });
  }
  function addOption() {
    if (q.options.length >= 6) return;
    onChange({
      ...q,
      options: [
        ...q.options,
        {
          id: crypto.randomUUID(),
          text: `${tr("Đáp án", "Answer")} ${String.fromCharCode(65 + q.options.length)}`,
        },
      ],
    });
  }
  return (
    <div className="question-form">
      <div className="question-toolbar">
        <select
          value={q.type}
          onChange={(e) =>
            onChange({ ...q, type: e.target.value as Question["type"] })
          }
        >
          <option value="SINGLE_CHOICE">
            {tr("Trắc nghiệm", "Multiple choice")}
          </option>
          <option value="TRUE_FALSE">{tr("Đúng / Sai", "True / False")}</option>
          <option value="TEXT">{tr("Nhập văn bản", "Text answer")}</option>
        </select>
        <label>
          <Clock3 />
          <input
            type="number"
            min={5}
            max={300}
            value={q.timeLimitSec}
            onChange={(e) =>
              onChange({ ...q, timeLimitSec: Number(e.target.value) })
            }
          />{" "}
          {tr("giây", "seconds")}
        </label>
        <label>
          <Trophy />
          <input
            type="number"
            min={100}
            max={5000}
            value={q.basePoints}
            onChange={(e) =>
              onChange({ ...q, basePoints: Number(e.target.value) })
            }
          />{" "}
          {tr("điểm", "points")}
        </label>
      </div>
      <textarea
        className="prompt-input"
        value={q.prompt}
        onChange={(e) => onChange({ ...q, prompt: e.target.value })}
        placeholder={tr("Nhập câu hỏi...", "Enter a question...")}
      />
      {q.type === "TEXT" ? (
        <label className="accepted">
          {tr("Các đáp án được chấp nhận", "Accepted answers")}
          <input
            value={q.acceptedAnswers.join(", ")}
            onChange={(e) =>
              onChange({
                ...q,
                acceptedAnswers: e.target.value
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean),
              })
            }
            placeholder="Redis, redis, REDIS"
          />
          <small>
            {tr(
              "Phân cách bằng dấu phẩy; hệ thống bỏ qua hoa/thường và khoảng trắng.",
              "Separate answers with commas; capitalization and extra spaces are ignored.",
            )}
          </small>
        </label>
      ) : (
        <div className="option-editor">
          {q.options.map((o, i) => (
            <div
              className={cx(
                "option-row",
                q.correctOptionId === o.id && "correct",
              )}
              key={o.id}
            >
              <button
                className="correct-radio"
                onClick={() => onChange({ ...q, correctOptionId: o.id })}
              >
                {q.correctOptionId === o.id ? (
                  <Check />
                ) : (
                  String.fromCharCode(65 + i)
                )}
              </button>
              <input
                value={o.text}
                onChange={(e) => setOption(o.id, e.target.value)}
              />
              {q.options.length > 2 && (
                <button
                  className="icon-button"
                  onClick={() =>
                    onChange({
                      ...q,
                      options: q.options.filter((x) => x.id !== o.id),
                    })
                  }
                >
                  <X />
                </button>
              )}
            </div>
          ))}
          <button className="button button-secondary" onClick={addOption}>
            <Plus />
            {tr("Thêm đáp án", "Add answer")}
          </button>
        </div>
      )}
      <label className="explanation">
        {tr("Giải thích sau câu hỏi", "Explanation after the question")}
        <textarea
          value={q.explanation}
          onChange={(e) => onChange({ ...q, explanation: e.target.value })}
          placeholder={tr(
            "Giải thích ngắn cho người chơi...",
            "A short explanation for players...",
          )}
        />
      </label>
      <div className="question-actions">
        <button className="button button-danger" onClick={onDelete}>
          <Trash2 />
          {tr("Xóa", "Delete")}
        </button>
        <button className="button button-primary" onClick={onSave}>
          <Save />
          {tr("Lưu câu hỏi", "Save question")}
        </button>
      </div>
    </div>
  );
}

function Join() {
  const { pin: routePin } = useParams();
  const nav = useNavigate();
  const { locale, setLocale, t } = usePreferences();
  const [pin, setPin] = useState(routePin || "");
  const [info, setInfo] = useState<any>(null);
  const [form, setForm] = useState({
    nickname: "",
    avatar: "rocket",
    country: "VN",
    team: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (routePin) void lookup();
  }, [routePin]);
  async function lookup() {
    setError("");
    try {
      setInfo(await request(`/sessions/pin/${pin}`));
    } catch (e) {
      setInfo(null);
      setError((e as Error).message);
    }
  }
  async function join(e: FormEvent) {
    e.preventDefault();
    if (!info) {
      await lookup();
      return;
    }
    setLoading(true);
    try {
      const data = await request<{
        token: string;
        sessionId: string;
        player: Player;
      }>("/sessions/join", {
        method: "POST",
        body: JSON.stringify({ pin, ...form }),
      });
      sessionStorage.setItem(`rr_player_${data.sessionId}`, data.token);
      sessionStorage.setItem(
        `rr_player_meta_${data.sessionId}`,
        JSON.stringify(data.player),
      );
      nav(`/play/${data.sessionId}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <Page className="join-page">
      <div className="join-backdrop">
        <div className="join-flow-card">
          <div className="join-heading">
            <span className="join-icon">
              <Gamepad2 />
            </span>
            <div>
              <span className="eyebrow">{t("joinRankRush")}</span>
              <h1>{info ? info.quiz?.title : t("enterGamePin")}</h1>
              <p>
                {info
                  ? `${info.playerCount} ${t("lobbyWaiting")}`
                  : t("pinHelp")}
              </p>
            </div>
          </div>
          <form onSubmit={join}>
            {!info ? (
              <label>
                PIN
                <input
                  className="big-pin"
                  value={pin}
                  onChange={(e) =>
                    setPin(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="000000"
                  inputMode="numeric"
                  autoFocus
                />
              </label>
            ) : (
              <>
                <label>
                  {t("nickname")}
                  <input
                    value={form.nickname}
                    onChange={(e) =>
                      setForm({ ...form, nickname: e.target.value })
                    }
                    placeholder={t("yourName")}
                    maxLength={24}
                    required
                  />
                </label>
                <label>
                  {t("chooseAvatar")}
                  <div className="avatar-picker">
                    {avatars.map((a) => (
                      <button
                        type="button"
                        key={a}
                        className={form.avatar === a ? "active" : ""}
                        onClick={() => setForm({ ...form, avatar: a })}
                      >
                        {avatarEmoji[a]}
                      </button>
                    ))}
                  </div>
                </label>
                <div className="form-grid">
                  <label>
                    {t("country")}
                    <select
                      value={form.country}
                      onChange={(e) => {
                        const country = e.target.value;
                        setForm({ ...form, country });
                        setLocale(country === "VN" ? "vi" : "en");
                      }}
                    >
                      <option value="VN">
                        🇻🇳 {locale === "vi" ? "Việt Nam" : "Vietnam"}
                      </option>
                      <option value="US">
                        🇺🇸 {locale === "vi" ? "Hoa Kỳ" : "United States"}
                      </option>
                      <option value="JP">
                        🇯🇵 {locale === "vi" ? "Nhật Bản" : "Japan"}
                      </option>
                      <option value="KR">
                        🇰🇷 {locale === "vi" ? "Hàn Quốc" : "South Korea"}
                      </option>
                    </select>
                  </label>
                  {info.session?.settings.teamMode && (
                    <label>
                      {t("team")}
                      <input
                        value={form.team}
                        onChange={(e) =>
                          setForm({ ...form, team: e.target.value })
                        }
                        placeholder={t("teamName")}
                        required
                      />
                    </label>
                  )}
                </div>
              </>
            )}
            <ErrorBox error={error} />
            <button
              className="button button-primary button-block button-lg"
              disabled={loading || pin.length !== 6}
            >
              {loading ? t("joining") : info ? t("enterLobby") : t("continue")}
              <ChevronRight />
            </button>
            {info && (
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setInfo(null);
                  setError("");
                }}
              >
                {t("changePin")}
              </button>
            )}
          </form>
        </div>
      </div>
    </Page>
  );
}

function useGameSocket(
  sessionId: string,
  token: string,
  onSnapshot: (s: Snapshot) => void,
  onEvent: (name: string, data: any) => void,
) {
  useEffect(() => {
    if (!sessionId || !token) return;
    const socket: Socket = io({ auth: { token } });
    socket.emit("session:join", { sessionId });
    socket.on("session:snapshot", onSnapshot);
    for (const name of [
      "lobby:updated",
      "session:started",
      "question:shown",
      "question:revealed",
      "leaderboard:updated",
      "answer:accepted",
      "host:progress",
      "session:ended",
      "player:kicked",
    ])
      socket.on(name, (data) => onEvent(name, data));
    return () => {
      socket.disconnect();
    };
  }, [sessionId, token]);
}
function Countdown({
  startedAt,
  seconds,
  onExpire,
}: {
  startedAt: string;
  seconds: number;
  onExpire?: () => void;
}) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    const tick = () => {
      const elapsed = (Date.now() - new Date(startedAt).getTime()) / 1000;
      const n = Math.max(0, Math.ceil(seconds - elapsed));
      setLeft(n);
      if (n === 0) onExpire?.();
    };
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [startedAt, seconds]);
  return (
    <div
      className={cx("countdown", left <= 5 && "urgent")}
      style={{ "--progress": `${(left / seconds) * 100}%` } as any}
    >
      <Clock3 />
      <b>{left}</b>
      <span />
    </div>
  );
}

function PlayerGame() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const { t } = usePreferences();
  const token = playerToken(id);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [selected, setSelected] = useState("");
  const [result, setResult] = useState<any>(null);
  const [reveal, setReveal] = useState<any>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [expired, setExpired] = useState(false);
  const [finalResult, setFinalResult] = useState<PlayerResult | null>(null);
  const meta = useMemo(() => {
    try {
      return JSON.parse(
        sessionStorage.getItem(`rr_player_meta_${id}`) || "{}",
      ) as Player;
    } catch {
      return {} as Player;
    }
  }, [id]);
  const load = useCallback(
    () =>
      request<Snapshot>(`/sessions/${id}`, { token })
        .then(setSnapshot)
        .catch((e) => setError(e.message)),
    [id, token],
  );
  useEffect(() => {
    if (token) void load();
  }, [token]);
  useEffect(() => {
    if (snapshot?.session.state !== "ENDED" || !token) return;
    void request<PlayerResult>(`/sessions/${id}/result`, { token })
      .then(setFinalResult)
      .catch((e) => setError((e as Error).message));
  }, [id, snapshot?.session.state, token]);
  useEffect(() => {
    if (!result || snapshot?.session.settings.mutePlayers) return;
    const AudioContextClass = window.AudioContext;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = result.correct ? 660 : 190;
    gain.gain.setValueAtTime(0.08, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.18);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.18);
    oscillator.addEventListener("ended", () => void context.close());
  }, [result, snapshot?.session.settings.mutePlayers]);
  useGameSocket(
    id,
    token,
    (d) => setSnapshot(d),
    (name, data) => {
      if (
        name === "lobby:updated" ||
        name === "session:started" ||
        name === "question:shown" ||
        name === "session:ended"
      ) {
        if (data?.session) setSnapshot(data);
        else void load();
        if (name === "question:shown" || name === "session:started") {
          setSelected("");
          setResult(null);
          setReveal(null);
          setExpired(false);
        }
      }
      if (name === "question:revealed") {
        setReveal(data);
        void load();
      }
      if (name === "leaderboard:updated")
        setSnapshot((s) => (s ? { ...s, ...data } : s));
      if (name === "answer:accepted") setResult(data);
      if (name === "player:kicked") {
        sessionStorage.removeItem(`rr_player_${id}`);
        sessionStorage.removeItem(`rr_player_meta_${id}`);
        nav("/join");
      }
    },
  );
  if (!token) return <Navigate to="/join" />;
  if (!snapshot)
    return (
      <div className="game-loading">
        <Zap />
        {t("connecting")}
        <ErrorBox error={error} />
      </div>
    );
  async function answer(value: string) {
    if (busy || result || expired) return;
    setSelected(value);
    setBusy(true);
    try {
      const responseMs = Math.max(
        0,
        Date.now() - new Date(snapshot!.session.questionStartedAt).getTime(),
      );
      setResult(
        await request(`/sessions/${id}/answers`, {
          method: "POST",
          token,
          body: JSON.stringify({
            questionId: snapshot!.currentQuestion?.id,
            answer: value,
            responseMs,
          }),
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const self = snapshot.selfRank;
  return (
    <main className="game-page">
      <div className="game-top">
        <Logo />
        <div className="game-progress">
          <span>
            {t("question")} {snapshot.session.currentQuestionIndex + 1}
          </span>
          <div>
            <i
              style={{
                width: `${Math.min(100, (snapshot.session.currentQuestionIndex + 1) * 10)}%`,
              }}
            />
          </div>
        </div>
        <div className="player-chip">
          <span>{avatarEmoji[meta.avatar] || "🚀"}</span>
          <b>{meta.nickname || t("player")}</b>
          <strong>{self?.score || 0}</strong>
        </div>
        <PreferenceControls compact />
      </div>
      {snapshot.session.state === "LOBBY" ? (
        <LobbyPlayer snapshot={snapshot} meta={meta} />
      ) : snapshot.session.state === "ENDED" ? (
        <FinalPlayer snapshot={snapshot} meta={meta} result={finalResult} />
      ) : (
        <div className="play-layout">
          <section className="question-stage">
            {snapshot.currentQuestion && (
              <>
                <Countdown
                  startedAt={snapshot.session.questionStartedAt}
                  seconds={snapshot.currentQuestion.timeLimitSec}
                  onExpire={() => setExpired(true)}
                />
                <span className="question-label">
                  {t("questionUpper")}{" "}
                  {snapshot.session.currentQuestionIndex + 1}
                </span>
                <h1>{snapshot.currentQuestion.prompt}</h1>
                {snapshot.currentQuestion.type === "TEXT" ? (
                  <TextAnswer
                    disabled={
                      expired ||
                      !!result ||
                      snapshot.session.state !== "RUNNING"
                    }
                    onAnswer={answer}
                  />
                ) : (
                  <div className="answer-grid">
                    {snapshot.currentQuestion.options.map((o, i) => (
                      <button
                        key={o.id}
                        disabled={
                          expired ||
                          !!result ||
                          snapshot.session.state !== "RUNNING"
                        }
                        className={cx(
                          "answer-option",
                          selected === o.id && "selected",
                          reveal &&
                            o.id === reveal.correctOptionId &&
                            "correct",
                          reveal &&
                            selected === o.id &&
                            o.id !== reveal.correctOptionId &&
                            "wrong",
                        )}
                        onClick={() => void answer(o.id)}
                      >
                        <span>{["▲", "◆", "●", "■", "★", "⬟"][i]}</span>
                        {o.text}
                        {selected === o.id && <Check />}
                      </button>
                    ))}
                  </div>
                )}
                <ErrorBox error={error} />
                {expired && !result && (
                  <div className="waiting-host">{t("timeUp")}</div>
                )}
                {result && (
                  <div
                    className={cx(
                      "answer-result",
                      result.correct ? "correct" : "wrong",
                    )}
                  >
                    <span>{result.correct ? "✓" : "×"}</span>
                    <div>
                      <b>{result.correct ? t("correct") : t("incorrect")}</b>
                      <p>
                        {result.created
                          ? `+${result.awardedPoints} ${t("points")} • ${t("rank")} #${result.rank?.rank}`
                          : t("alreadyRecorded")}
                      </p>
                    </div>
                  </div>
                )}
                {snapshot.session.state === "QUESTION_RESULT" && (
                  <div className="waiting-host">{t("revealedWaiting")}</div>
                )}
              </>
            )}
          </section>
          {!snapshot.session.settings.hideLeaderboard && (
            <aside className="live-side">
              <Leaderboard
                entries={snapshot.leaderboard}
                selfId={meta.id}
                compact
              />
              {snapshot.session.settings.teamMode && (
                <TeamLeaderboard entries={snapshot.teamLeaderboard} />
              )}
              <div className="self-rank">
                <span>{t("yourRank")}</span>
                <b>#{self?.rank || "–"}</b>
                <strong>
                  {self?.score || 0} {t("points")}
                </strong>
              </div>
            </aside>
          )}
        </div>
      )}
    </main>
  );
}
function TextAnswer({
  onAnswer,
  disabled,
}: {
  onAnswer: (v: string) => void;
  disabled: boolean;
}) {
  const [v, setV] = useState("");
  const { t } = usePreferences();
  return (
    <form
      className="text-answer"
      onSubmit={(e) => {
        e.preventDefault();
        if (v.trim()) onAnswer(v);
      }}
    >
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder={t("typeAnswer")}
        disabled={disabled}
      />
      <button className="button button-primary" disabled={disabled}>
        {t("sendAnswer")}
      </button>
    </form>
  );
}
function LobbyPlayer({ snapshot, meta }: { snapshot: Snapshot; meta: Player }) {
  const { t } = usePreferences();
  return (
    <div className="lobby-player">
      <div className="lobby-orbit">
        <div className="avatar-big">{avatarEmoji[meta.avatar] || "🚀"}</div>
        <i />
        <i />
        <i />
      </div>
      <span className="eyebrow">
        <Radio size={16} /> {t("joinedRoom")}
      </span>
      <h1>
        {t("hello")} {meta.nickname}! 👋
      </h1>
      <p>
        {t("hostPreparing")} <b>{snapshot.quiz.title}</b>.
      </p>
      <div className="waiting">
        <span />
        <span />
        <span /> {t("waitingHost")}
      </div>
      <div className="lobby-count">
        <Users />
        <b>{snapshot.playerCount}</b>
        <span>{t("joinedPlayers")}</span>
      </div>
    </div>
  );
}
function FinalPlayer({
  snapshot,
  meta,
  result,
}: {
  snapshot: Snapshot;
  meta: Player;
  result: PlayerResult | null;
}) {
  const { t } = usePreferences();
  const rank =
    result?.rank ||
    snapshot.leaderboard.find((x) => x.playerId === meta.id)?.rank ||
    snapshot.selfRank?.rank;
  const score = result?.score ?? snapshot.selfRank?.score ?? 0;
  return (
    <div className="final-player">
      <div className="confetti">✦　✧　★　✦　✧</div>
      <Medal />
      <span className="eyebrow">{t("completed")}</span>
      <h1>{rank && rank <= 3 ? t("podium") : t("greatRace")}</h1>
      <div className="final-score">
        <span>{t("rank")}</span>
        <b>#{rank || "–"}</b>
        <strong>
          {score.toLocaleString()} {t("points")}
        </strong>
      </div>
      <div className="final-result-stats" aria-live="polite">
        <div>
          <span>{t("correctAnswers")}</span>
          <b>{result ? `${result.correct}/${result.totalQuestions}` : "…"}</b>
        </div>
        <div>
          <span>{t("answered")}</span>
          <b>{result ? `${result.answers}/${result.totalQuestions}` : "…"}</b>
        </div>
        <div>
          <span>{t("accuracy")}</span>
          <b>{result ? `${result.accuracy}%` : "…"}</b>
        </div>
      </div>
      <Leaderboard entries={snapshot.leaderboard} selfId={meta.id} />
      <Link className="button button-primary button-lg" to="/join">
        <Gamepad2 />
        {t("playAnother")}
      </Link>
    </div>
  );
}

function Leaderboard({
  entries,
  selfId,
  compact = false,
}: {
  entries: LeaderboardEntry[];
  selfId?: string;
  compact?: boolean;
}) {
  const { t } = usePreferences();
  return (
    <div className={cx("leaderboard", compact && "compact")}>
      <div className="leaderboard-head">
        <div>
          <Trophy />
          <span>
            <b>Leaderboard</b>
            <small>{t("realtimeUpdate")}</small>
          </span>
        </div>
        <Radio />
      </div>
      <div className="leaderboard-rows">
        {entries.length ? (
          entries.map((e, i) => (
            <div
              key={e.playerId}
              className={cx("leader-row", e.playerId === selfId && "self")}
            >
              <b className="rank">{i < 3 ? ["🥇", "🥈", "🥉"][i] : e.rank}</b>
              <span className="mini-avatar">
                {avatarEmoji[e.avatar] || "🚀"}
              </span>
              <span className="leader-name">
                <b>{e.nickname}</b>
                <small>{e.team || e.country}</small>
              </span>
              <strong>{e.score.toLocaleString()}</strong>
            </div>
          ))
        ) : (
          <p className="no-players">{t("noScores")}</p>
        )}
      </div>
    </div>
  );
}

function TeamLeaderboard({
  entries,
}: {
  entries: Snapshot["teamLeaderboard"];
}) {
  const { tr } = usePreferences();
  return (
    <div className="leaderboard compact team-board">
      <div className="leaderboard-head">
        <div>
          <Users />
          <span>
            <b>{tr("Xếp hạng đội", "Team leaderboard")}</b>
            <small>{tr("Tổng điểm thành viên", "Total member score")}</small>
          </span>
        </div>
      </div>
      <div className="leaderboard-rows">
        {entries.map((entry) => (
          <div className="leader-row" key={entry.team}>
            <b className="rank">#{entry.rank}</b>
            <span className="leader-name">
              <b>{entry.team}</b>
            </span>
            <strong>{entry.score.toLocaleString()}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function HostGame() {
  const { tr } = usePreferences();
  const { id = "" } = useParams();
  const nav = useNavigate();
  const token = hostToken();
  const toast = useToast();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [progress, setProgress] = useState({ answered: 0, playerCount: 0 });
  const [revealed, setRevealed] = useState<any>(null);
  const load = useCallback(
    () =>
      request<Snapshot>(`/sessions/${id}`, { token })
        .then(setSnapshot)
        .catch((e) => toast.show(e.message)),
    [id, token],
  );
  useEffect(() => {
    if (token) void load();
  }, [token]);
  useGameSocket(id, token, setSnapshot, (name, data) => {
    if (
      name === "lobby:updated" ||
      name === "session:started" ||
      name === "question:shown" ||
      name === "session:ended"
    ) {
      if (data?.session) setSnapshot(data);
      else void load();
      if (name === "question:shown") {
        setRevealed(null);
        setProgress({ answered: 0, playerCount: data.playerCount || 0 });
      }
    }
    if (name === "host:progress") setProgress(data);
    if (name === "question:revealed") {
      setRevealed(data);
      setSnapshot((s) =>
        s
          ? {
              ...s,
              session: { ...s.session, state: "QUESTION_RESULT" },
              leaderboard: data.leaderboard,
              teamLeaderboard: data.teamLeaderboard,
            }
          : s,
      );
    }
    if (name === "leaderboard:updated")
      setSnapshot((s) => (s ? { ...s, ...data } : s));
  });
  if (!token) return <Navigate to="/login" />;
  if (!snapshot)
    return (
      <div className="game-loading">
        <Zap />
        {tr("Đang mở Host Console...", "Opening Host Console...")}
      </div>
    );
  async function start() {
    try {
      await request(`/sessions/${id}/start`, { method: "POST", token });
      toast.show(tr("Game đã bắt đầu!", "Game started!"));
    } catch (e) {
      toast.show((e as Error).message);
    }
  }
  async function advance() {
    try {
      await request(`/sessions/${id}/advance`, { method: "POST", token });
    } catch (e) {
      toast.show((e as Error).message);
    }
  }
  async function end() {
    if (!confirm(tr("Kết thúc game ngay bây giờ?", "End the game now?")))
      return;
    await request(`/sessions/${id}/end`, { method: "POST", token });
  }
  return (
    <main className="host-page">
      <header className="host-bar">
        <Logo />
        <div>
          <span className="live-dot" />
          HOST CONSOLE
        </div>
        <PreferenceControls compact />
        <button
          className="button button-ghost"
          onClick={() => nav("/dashboard")}
        >
          <X />
          {tr("Thoát", "Exit")}
        </button>
      </header>
      {snapshot.session.state === "LOBBY" ? (
        <HostLobby snapshot={snapshot} onStart={start} onRefresh={load} />
      ) : snapshot.session.state === "ENDED" ? (
        <HostFinal
          snapshot={snapshot}
          onReport={() => nav(`/report/${id}`)}
          onExit={() => nav("/dashboard")}
        />
      ) : (
        <div className="host-game-layout">
          <section className="host-question">
            <div className="host-question-top">
              <span>
                PIN <b>{snapshot.session.pin}</b>
              </span>
              <span>
                {tr("Câu", "Question")}{" "}
                {snapshot.session.currentQuestionIndex + 1}
              </span>
              <span>
                <Users /> {snapshot.playerCount}
              </span>
            </div>
            {snapshot.currentQuestion && (
              <>
                <Countdown
                  startedAt={snapshot.session.questionStartedAt}
                  seconds={snapshot.currentQuestion.timeLimitSec}
                />
                <span className="question-label">
                  {tr("CÂU HỎI HIỆN TẠI", "CURRENT QUESTION")}
                </span>
                <h1>{snapshot.currentQuestion.prompt}</h1>
                <div className="host-options">
                  {snapshot.currentQuestion.options.map((o, i) => (
                    <div
                      className={cx(
                        revealed &&
                          o.id === revealed.correctOptionId &&
                          "correct",
                      )}
                      key={o.id}
                    >
                      <span>{["▲", "◆", "●", "■", "★", "⬟"][i]}</span>
                      {o.text}
                      {revealed && o.id === revealed.correctOptionId && (
                        <Check />
                      )}
                    </div>
                  ))}
                </div>
                <div className="answer-progress">
                  <div>
                    <span>{tr("Đã trả lời", "Answered")}</span>
                    <b>
                      {progress.answered || 0} /{" "}
                      {progress.playerCount || snapshot.playerCount}
                    </b>
                  </div>
                  <div>
                    <i
                      style={{
                        width: `${((progress.answered || 0) / Math.max(1, progress.playerCount || snapshot.playerCount)) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              </>
            )}
          </section>
          <aside className="host-control">
            <Leaderboard entries={snapshot.leaderboard} />
            {snapshot.session.settings.teamMode && (
              <TeamLeaderboard entries={snapshot.teamLeaderboard} />
            )}
            <div className="host-buttons">
              <button
                className="button button-primary button-lg button-block"
                onClick={() => void advance()}
              >
                {snapshot.session.state === "RUNNING" ? (
                  <>
                    {tr("Công bố đáp án", "Reveal answer")} <Eye />
                  </>
                ) : (
                  <>
                    {tr("Câu tiếp theo", "Next question")} <ChevronRight />
                  </>
                )}
              </button>
              <button
                className="button button-danger button-block"
                onClick={() => void end()}
              >
                {tr("Kết thúc game", "End game")}
              </button>
            </div>
          </aside>
        </div>
      )}
      {toast.node}
    </main>
  );
}
function LobbySettings({
  sessionId,
  settings,
  onSaved,
}: {
  sessionId: string;
  settings: SessionSettings;
  onSaved: () => void;
}) {
  const { tr } = usePreferences();
  const toast = useToast();
  const choices: Array<{
    key: keyof SessionSettings;
    title: string;
    text: string;
    icon: ReactNode;
  }> = [
    {
      key: "teamMode",
      title: tr("Chế độ đội", "Team mode"),
      text: tr(
        "Người chơi chọn đội và có thêm bảng điểm đội.",
        "Players choose teams and get a team leaderboard.",
      ),
      icon: <Users />,
    },
    {
      key: "hideLeaderboard",
      title: tr("Ẩn bảng xếp hạng", "Hide leaderboard"),
      text: tr(
        "Không công bố thứ hạng cho người chơi trong trận.",
        "Do not show rankings to players during the game.",
      ),
      icon: <Eye />,
    },
    {
      key: "safeNames",
      title: tr("Tên an toàn", "Safe names"),
      text: tr(
        "Tự tạo biệt danh trung tính thay cho tên đã nhập.",
        "Generate a neutral nickname instead of using the entered name.",
      ),
      icon: <ShieldCheck />,
    },
    {
      key: "hideCountryFlags",
      title: tr("Ẩn quốc kỳ", "Hide country flags"),
      text: tr(
        "Không hiển thị quốc gia trên bảng xếp hạng.",
        "Do not show countries on the leaderboard.",
      ),
      icon: <Globe2 />,
    },
    {
      key: "mutePlayers",
      title: tr("Tắt âm thiết bị", "Mute player devices"),
      text: tr(
        "Thiết lập trải nghiệm im lặng cho thiết bị người chơi.",
        "Keep player devices silent.",
      ),
      icon: <Volume2 />,
    },
    {
      key: "speedScoring",
      title: tr("Điểm theo tốc độ", "Speed scoring"),
      text: tr(
        "Trả lời đúng càng nhanh thì điểm thưởng càng cao.",
        "Faster correct answers earn more points.",
      ),
      icon: <Zap />,
    },
  ];
  async function change(key: keyof SessionSettings) {
    try {
      await request(`/sessions/${sessionId}/settings`, {
        method: "PATCH",
        token: hostToken(),
        body: JSON.stringify({ ...settings, [key]: !settings[key] }),
      });
      onSaved();
    } catch (e) {
      toast.show((e as Error).message);
    }
  }
  return (
    <div className="lobby-settings">
      <div className="settings-heading">
        <Settings2 />
        <div>
          <b>{tr("Thiết lập phòng", "Room settings")}</b>
          <span>{tr("Chốt trước khi bắt đầu", "Review before starting")}</span>
        </div>
      </div>
      <div className="setting-grid">
        {choices.map((c) => (
          <button
            type="button"
            key={c.key}
            className={cx("setting-toggle", settings[c.key] && "active")}
            onClick={() => void change(c.key)}
          >
            <span>{c.icon}</span>
            <div>
              <b>{c.title}</b>
              <small>{c.text}</small>
            </div>
            <i
              aria-label={
                settings[c.key] ? tr("Đang bật", "On") : tr("Đang tắt", "Off")
              }
            />
          </button>
        ))}
      </div>
      {toast.node}
    </div>
  );
}
function HostLobby({
  snapshot,
  onStart,
  onRefresh,
}: {
  snapshot: Snapshot;
  onStart: () => void;
  onRefresh: () => void;
}) {
  const { tr } = usePreferences();
  const fallbackJoinOrigin = () => {
    const openedLocally = ["localhost", "127.0.0.1", "::1"].includes(
      location.hostname,
    );
    const lanIp = import.meta.env.VITE_LAN_IP;
    return openedLocally && lanIp
      ? `${location.protocol}//${lanIp}${location.port ? `:${location.port}` : ""}`
      : location.origin;
  };
  const [joinOrigin, setJoinOrigin] = useState(fallbackJoinOrigin);
  const [publicUrlConfigured, setPublicUrlConfigured] = useState(false);
  useEffect(() => {
    void request<{
      preferredOrigin: string;
      origins: string[];
      publicUrlConfigured: boolean;
    }>(
      `/meta/network?port=${location.port || (location.protocol === "https:" ? "443" : "80")}`,
    )
      .then((network) => {
        const openedLocally = ["localhost", "127.0.0.1", "::1"].includes(
          location.hostname,
        );
        setPublicUrlConfigured(network.publicUrlConfigured);
        setJoinOrigin(
          network.publicUrlConfigured || openedLocally
            ? network.preferredOrigin
            : location.origin,
        );
      })
      .catch(() => setJoinOrigin(fallbackJoinOrigin()));
  }, []);
  const joinUrl = `${joinOrigin}/join/${snapshot.session.pin}`;
  const localOnly = /localhost|127\.0\.0\.1|\[::1\]/.test(joinOrigin);
  const toast = useToast();
  async function kick(pid: string) {
    await request(`/sessions/${snapshot.session.id}/kick/${pid}`, {
      method: "POST",
      token: hostToken(),
    });
    onRefresh();
  }
  return (
    <div className="host-lobby">
      <section className="lobby-share">
        <span className="eyebrow">
          <Radio size={16} /> {tr("Lobby đang mở", "Lobby is open")}
        </span>
        <h1>{snapshot.quiz.title}</h1>
        <p>
          {tr("Người chơi vào tại", "Players join at")}{" "}
          <b>{joinOrigin.replace(/^https?:\/\//, "")}</b>
        </p>
        <div className="pin-display">
          <span>PIN GAME</span>
          <b>{snapshot.session.pin}</b>
          <button
            onClick={() => {
              void navigator.clipboard.writeText(snapshot.session.pin);
              toast.show(tr("Đã sao chép PIN.", "PIN copied."));
            }}
          >
            <Copy />
          </button>
        </div>
        <div className="qr-card">
          <QRCodeSVG value={joinUrl} size={170} level="M" />
          <b>{tr("Quét để tham gia", "Scan to join")}</b>
          <small>
            {tr(
              "Dùng Camera/Safari/Chrome và cùng mạng Wi-Fi",
              "Use Camera/Safari/Chrome on the same Wi-Fi",
            )}
          </small>
          <code>{joinUrl.replace(/^https?:\/\//, "")}</code>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(joinUrl);
              toast.show(
                tr("Đã sao chép liên kết tham gia.", "Join link copied."),
              );
            }}
          >
            <Copy /> {tr("Sao chép link", "Copy link")}
          </button>
        </div>
        {localOnly && (
          <div className="network-warning">
            <CircleHelp />{" "}
            {tr(
              "QR đang dùng localhost nên điện thoại chưa thể mở.",
              "The QR uses localhost, so phones cannot open it yet.",
            )}
          </div>
        )}
        {!localOnly && !publicUrlConfigured && (
          <div className="network-note">
            {tr(
              "Điện thoại và máy tính cần kết nối cùng một Wi-Fi.",
              "The phone and computer must use the same Wi-Fi network.",
            )}
          </div>
        )}
        <button
          className="button button-primary button-xl"
          disabled={snapshot.playerCount === 0}
          onClick={onStart}
        >
          <Play fill="currentColor" />
          {tr("Bắt đầu game", "Start game")}{" "}
          <span>
            {snapshot.playerCount} {tr("người", "players")}
          </span>
        </button>
      </section>
      <section className="lobby-roster">
        <div className="roster-head">
          <div>
            <h2>{tr("Phòng chờ", "Lobby")}</h2>
            <p>
              {tr(
                "Người chơi xuất hiện ngay khi tham gia.",
                "Players appear as soon as they join.",
              )}
            </p>
          </div>
          <div className="people-count">
            <Users />
            <b>{snapshot.playerCount}</b>
          </div>
        </div>
        <LobbySettings
          sessionId={snapshot.session.id}
          settings={snapshot.session.settings}
          onSaved={onRefresh}
        />
        <div className="player-cloud">
          {snapshot.players.map((p, i) => (
            <div
              className="player-bubble"
              style={{ animationDelay: `${i * 40}ms` }}
              key={p.id}
            >
              <span>{avatarEmoji[p.avatar] || "🚀"}</span>
              <b>{p.nickname}</b>
              {p.team && <small>{p.team}</small>}
              <button
                onClick={() => void kick(p.id)}
                title={tr("Loại khỏi phòng", "Remove from room")}
              >
                <X />
              </button>
            </div>
          ))}
        </div>
        {!snapshot.players.length && (
          <Empty
            icon={<UserPlus />}
            title={tr("Đang chờ người chơi", "Waiting for players")}
            text={tr(
              "Chia sẻ PIN hoặc QR code trên màn hình bên trái.",
              "Share the PIN or QR code shown on the left.",
            )}
          />
        )}
        <div className="lobby-tips">
          <ShieldCheck />
          <div>
            <b>
              {tr(
                "Tên an toàn và kiểm soát lobby",
                "Safe names and lobby control",
              )}
            </b>
            <span>
              {tr(
                "Host có thể loại người chơi trước khi bắt đầu.",
                "The Host can remove players before starting.",
              )}
            </span>
          </div>
        </div>
      </section>
      {toast.node}
    </div>
  );
}
function HostFinal({
  snapshot,
  onReport,
  onExit,
}: {
  snapshot: Snapshot;
  onReport: () => void;
  onExit: () => void;
}) {
  const { tr } = usePreferences();
  return (
    <div className="host-final">
      <span className="eyebrow">
        <Trophy /> {tr("Kết quả cuối", "Final results")}
      </span>
      <h1>{tr("Và nhà vô địch là...", "And the winner is...")}</h1>
      <div className="podium">
        {[
          snapshot.leaderboard[1],
          snapshot.leaderboard[0],
          snapshot.leaderboard[2],
        ].map((e, i) =>
          e ? (
            <div key={e.playerId} className={`podium-${[2, 1, 3][i]}`}>
              <span>{avatarEmoji[e.avatar] || "🚀"}</span>
              <b>{e.nickname}</b>
              <strong>{e.score.toLocaleString()}</strong>
              <i>{[2, 1, 3][i]}</i>
            </div>
          ) : null,
        )}
      </div>
      <div className="final-actions">
        <button className="button button-primary button-lg" onClick={onReport}>
          <BarChart3 />
          {tr("Xem báo cáo", "View report")}
        </button>
        <button className="button button-secondary button-lg" onClick={onExit}>
          {tr("Về dashboard", "Back to dashboard")}
        </button>
      </div>
    </div>
  );
}

function Report() {
  const { tr } = usePreferences();
  const { id = "" } = useParams();
  const nav = useNavigate();
  const token = hostToken();
  const [report, setReport] = useState<any>(null);
  useEffect(() => {
    if (token) request(`/sessions/${id}/report`, { token }).then(setReport);
  }, [id]);
  if (!token) return <Navigate to="/login" />;
  if (!report)
    return (
      <div className="full-loader">
        <BarChart3 />
        {tr("Đang tổng hợp báo cáo...", "Preparing report...")}
      </div>
    );
  function csv() {
    const rows = [
      [
        tr("Hạng", "Rank"),
        tr("Người chơi", "Player"),
        tr("Điểm", "Score"),
        tr("Đúng", "Correct"),
        tr("Số câu", "Answers"),
        tr("Độ chính xác", "Accuracy"),
        tr("Thời gian TB", "Avg. time"),
      ],
      ...report.players.map((p: any) => [
        p.rank,
        p.nickname,
        p.score,
        p.correct,
        p.answers,
        `${p.accuracy}%`,
        p.avgResponseMs,
      ]),
    ];
    const blob = new Blob(
      [
        "\ufeff" +
          rows
            .map((r: any[]) =>
              r.map((x) => `"${String(x).replaceAll('"', '""')}"`).join(","),
            )
            .join("\n"),
      ],
      { type: "text/csv;charset=utf-8" },
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `rankrush-${id}-report.csv`;
    a.click();
  }
  return (
    <Page>
      <div className="report-page">
        <button className="text-button back" onClick={() => nav("/dashboard")}>
          <ArrowLeft />
          Dashboard
        </button>
        <div className="report-head">
          <div>
            <span className="eyebrow">
              {tr("Báo cáo sau phiên", "Post-game report")}
            </span>
            <h1>{report.quiz?.title}</h1>
            <p>
              {report.playerCount} {tr("người chơi", "players")} •{" "}
              {report.answerCount} {tr("lượt trả lời", "answers")}
            </p>
          </div>
          <button className="button button-primary" onClick={csv}>
            <BarChart3 />
            {tr("Xuất CSV", "Export CSV")}
          </button>
        </div>
        <div className="report-stats">
          <div>
            <Users />
            <span>
              <b>{report.playerCount}</b>
              {tr("Người chơi", "Players")}
            </span>
          </div>
          <div>
            <Target />
            <span>
              <b>{report.questions.length}</b>
              {tr("Câu hỏi", "Questions")}
            </span>
          </div>
          <div>
            <Activity />
            <span>
              <b>{report.answerCount}</b>
              {tr("Lượt trả lời", "Answers")}
            </span>
          </div>
          <div>
            <Trophy />
            <span>
              <b>{report.players[0]?.score || 0}</b>
              {tr("Điểm cao nhất", "Top score")}
            </span>
          </div>
        </div>
        <section className="report-card">
          <h2>
            <Trophy />
            {tr("Kết quả người chơi", "Player results")}
          </h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{tr("Hạng", "Rank")}</th>
                  <th>{tr("Người chơi", "Player")}</th>
                  <th>{tr("Điểm", "Score")}</th>
                  <th>{tr("Đúng", "Correct")}</th>
                  <th>{tr("Độ chính xác", "Accuracy")}</th>
                  <th>{tr("Phản hồi TB", "Avg. response")}</th>
                </tr>
              </thead>
              <tbody>
                {report.players.map((p: any) => (
                  <tr key={p.playerId}>
                    <td>
                      <b>#{p.rank}</b>
                    </td>
                    <td>
                      <span className="table-player">
                        {avatarEmoji[p.avatar] || "🚀"}
                        <b>{p.nickname}</b>
                      </span>
                    </td>
                    <td>
                      <strong>{p.score.toLocaleString()}</strong>
                    </td>
                    <td>
                      {p.correct}/{p.answers}
                    </td>
                    <td>
                      <span className="accuracy">
                        <i style={{ width: `${p.accuracy}%` }} />
                        {p.accuracy}%
                      </span>
                    </td>
                    <td>
                      {p.avgResponseMs
                        ? `${(p.avgResponseMs / 1000).toFixed(1)}s`
                        : "–"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="report-card">
          <h2>
            <CircleHelp />
            {tr("Phân tích câu hỏi", "Question analysis")}
          </h2>
          <div className="question-analysis">
            {report.questions.map((q: any, i: number) => (
              <div key={q.questionId}>
                <span>{i + 1}</span>
                <p>
                  <b>{q.prompt}</b>
                  <small>
                    {q.answers} {tr("lượt trả lời", "answers")}
                  </small>
                </p>
                <strong className={q.accuracy < 50 ? "low" : ""}>
                  {q.accuracy}% {tr("đúng", "correct")}
                </strong>
              </div>
            ))}
          </div>
        </section>
      </div>
    </Page>
  );
}

function PracticeQuiz() {
  const { tr } = usePreferences();
  const { id = "" } = useParams();
  const [data, setData] = useState<{
    quiz: Quiz;
    questions: Question[];
  } | null>(null);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [score, setScore] = useState(0);
  const [result, setResult] = useState<{
    correct: boolean;
    correctOptionId: string;
    explanation: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    request<{ quiz: Quiz; questions: Question[] }>(`/quizzes/${id}`)
      .then(setData)
      .catch((e) => setError((e as Error).message));
  }, [id]);

  if (error)
    return (
      <Page className="practice-page">
        <section className="practice-card empty-state">
          <CircleHelp />
          <h1>{tr("Không thể mở bộ câu hỏi", "Could not open this quiz")}</h1>
          <p>{error}</p>
          <Link className="button button-secondary" to="/">
            {tr("Về trang chủ", "Back to home")}
          </Link>
        </section>
      </Page>
    );
  if (!data)
    return (
      <div className="full-loader">
        <BookOpen /> {tr("Đang chuẩn bị câu hỏi...", "Preparing questions...")}
      </div>
    );

  const question = data.questions[index];
  if (!question)
    return (
      <Page className="practice-page">
        <section className="practice-card practice-finish">
          <Trophy />
          <span className="eyebrow">{tr("Hoàn thành", "Completed")}</span>
          <h1>
            {score}/{data.questions.length} {tr("câu đúng", "correct")}
          </h1>
          <p>
            {tr("Bạn đã hoàn thành", "You completed")} <b>{data.quiz.title}</b>.{" "}
            {tr(
              "Hãy thử lại để củng cố thế mạnh ở nhánh",
              "Try again to strengthen your skills in",
            )}{" "}
            {data.quiz.subcategory || data.quiz.category}.
          </p>
          <div className="practice-actions">
            <Link className="button button-secondary" to="/">
              {tr("Về thư viện", "Back to library")}
            </Link>
            <button
              className="button button-primary"
              onClick={() => {
                setIndex(0);
                setScore(0);
                setAnswer("");
                setResult(null);
              }}
            >
              <Rocket /> {tr("Chơi lại", "Play again")}
            </button>
          </div>
        </section>
      </Page>
    );

  async function checkAnswer(event: FormEvent) {
    event.preventDefault();
    if (!answer || result) return;
    setBusy(true);
    setError("");
    try {
      const checked = await request<{
        correct: boolean;
        correctOptionId: string;
        explanation: string;
      }>(`/quizzes/${id}/practice/${question!.id}/check`, {
        method: "POST",
        body: JSON.stringify({ answer }),
      });
      setResult(checked);
      if (checked.correct) setScore((current) => current + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page className="practice-page">
      <section className="practice-shell">
        <div className="practice-topbar">
          <Link className="text-button back" to={`/quiz/${data.quiz.id}`}>
            <ArrowLeft /> {tr("Thoát", "Exit")}
          </Link>
          <div>
            <b>{data.quiz.title}</b>
            <span>{data.quiz.subcategory || data.quiz.category}</span>
          </div>
          <strong>
            {score} {tr("điểm", "points")} · {index + 1}/{data.questions.length}
          </strong>
        </div>
        <div className="practice-progress">
          <span
            style={{ width: `${((index + 1) / data.questions.length) * 100}%` }}
          />
        </div>
        <form className="practice-card" onSubmit={checkAnswer}>
          <span className="question-kicker">
            {tr("Câu", "Question")} {index + 1}
          </span>
          <h1>{question.prompt}</h1>
          {question.type === "TEXT" ? (
            <input
              className="practice-text-answer"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder={tr("Nhập câu trả lời", "Enter your answer")}
              disabled={Boolean(result)}
            />
          ) : (
            <div className="practice-options">
              {question.options.map((option, optionIndex) => (
                <button
                  type="button"
                  key={option.id}
                  className={cx(
                    answer === option.id && "selected",
                    result?.correctOptionId === option.id && "correct",
                    result &&
                      answer === option.id &&
                      !result.correct &&
                      "incorrect",
                  )}
                  onClick={() => !result && setAnswer(option.id)}
                >
                  <span>{String.fromCharCode(65 + optionIndex)}</span>
                  {option.text}
                </button>
              ))}
            </div>
          )}
          <ErrorBox error={error} />
          {result && (
            <div
              className={cx(
                "practice-feedback",
                result.correct ? "correct" : "incorrect",
              )}
            >
              {result.correct ? <Check /> : <X />}
              <div>
                <b>
                  {result.correct
                    ? tr("Chính xác!", "Correct!")
                    : tr("Chưa chính xác", "Not correct")}
                </b>
                <p>
                  {result.explanation ||
                    tr(
                      "Hãy ghi nhớ đáp án đúng và tiếp tục.",
                      "Remember the correct answer and continue.",
                    )}
                </p>
              </div>
            </div>
          )}
          <div className="practice-footer">
            <span>
              {tr(
                "Mỗi câu chỉ được trả lời một lần.",
                "Each question can only be answered once.",
              )}
            </span>
            {result ? (
              <button
                type="button"
                className="button button-primary"
                onClick={() => {
                  setIndex((current) => current + 1);
                  setAnswer("");
                  setResult(null);
                }}
              >
                {index + 1 === data.questions.length
                  ? tr("Xem kết quả", "View results")
                  : tr("Câu tiếp theo", "Next question")}
                <ChevronRight />
              </button>
            ) : (
              <button
                className="button button-primary"
                disabled={!answer || busy}
              >
                {busy
                  ? tr("Đang kiểm tra...", "Checking...")
                  : tr("Kiểm tra đáp án", "Check answer")}
              </button>
            )}
          </div>
        </form>
      </section>
    </Page>
  );
}

function PublicQuiz() {
  const { tr } = usePreferences();
  const { id = "" } = useParams();
  const nav = useNavigate();
  const [data, setData] = useState<{
    quiz: Quiz;
    questions: Question[];
  } | null>(null);
  useEffect(() => {
    request<{ quiz: Quiz; questions: Question[] }>(`/quizzes/${id}`).then(
      setData,
    );
  }, [id]);
  if (!data)
    return (
      <div className="full-loader">
        <BookOpen />
        {tr("Đang mở quiz...", "Opening quiz...")}
      </div>
    );
  return (
    <Page>
      <div className="public-quiz">
        <button className="text-button back" onClick={() => nav(-1)}>
          <ArrowLeft />
          {tr("Quay lại", "Back")}
        </button>
        <div
          className="public-cover"
          style={{ background: data.quiz.coverColor }}
        >
          <BookOpen />
          <span>{data.quiz.category}</span>
        </div>
        <div>
          <span className="eyebrow">{tr("Quiz công khai", "Public quiz")}</span>
          <h1>{data.quiz.title}</h1>
          <p>{data.quiz.description}</p>
          <div className="public-meta">
            <span>
              <CircleHelp />
              {data.questions.length} {tr("câu", "questions")}
            </span>
            <span>
              <Clock3 />
              {tr("Khoảng", "About")}{" "}
              {Math.ceil(
                data.questions.reduce((s, q) => s + q.timeLimitSec, 0) / 60,
              )}{" "}
              {tr("phút", "minutes")}
            </span>
            <span>
              <Users />
              {tr("Tối đa 300 người", "Up to 300 players")}
            </span>
          </div>
          <div className="public-actions">
            <Link
              className="button button-primary button-lg"
              to={`/practice/${data.quiz.id}`}
            >
              <Play /> {tr("Chơi ngay", "Play now")}
            </Link>
            <Link
              className="button button-secondary button-lg"
              to={hostToken() ? "/dashboard" : "/login"}
            >
              <Radio /> {tr("Tổ chức trực tiếp", "Host live")}
            </Link>
          </div>
        </div>
      </div>
      <div className="preview-questions">
        {data.questions.map((q, i) => (
          <div key={q.id}>
            <span>{i + 1}</span>
            <p>{q.prompt}</p>
            <small>
              {q.options.length || tr("Văn bản", "Text")}{" "}
              {tr("đáp án", "answers")} • {q.timeLimitSec}s
            </small>
          </div>
        ))}
      </div>
    </Page>
  );
}

export default function App() {
  const location = useLocation();
  useEffect(() => {
    if (location.hash) {
      requestAnimationFrame(() =>
        document
          .querySelector(location.hash)
          ?.scrollIntoView({ block: "start" }),
      );
    } else {
      window.scrollTo(0, 0);
    }
  }, [location.pathname, location.hash]);
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Auth mode="login" />} />
      <Route path="/register" element={<Auth mode="register" />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/dashboard/quizzes" element={<Dashboard />} />
      <Route path="/dashboard/reports" element={<ReportsPage />} />
      <Route path="/dashboard/leaderboards" element={<LeaderboardsPage />} />
      <Route path="/dashboard/settings" element={<SettingsPage />} />
      <Route path="/ai-create" element={<AiCreatePage />} />
      <Route path="/editor/:id" element={<Editor />} />
      <Route path="/join" element={<Join />} />
      <Route path="/join/:pin" element={<Join />} />
      <Route path="/play/:id" element={<PlayerGame />} />
      <Route path="/host/:id" element={<HostGame />} />
      <Route path="/report/:id" element={<Report />} />
      <Route path="/quiz/:id" element={<PublicQuiz />} />
      <Route path="/practice/:id" element={<PracticeQuiz />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
