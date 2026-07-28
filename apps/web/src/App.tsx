import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
  type CSSProperties,
} from "react";
import {
  Activity,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
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
  Dices,
  Dumbbell,
  Edit3,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Gamepad2,
  Gauge,
  Globe2,
  GraduationCap,
  Home as HomeIcon,
  Landmark,
  Library,
  LoaderCircle,
  LogIn,
  LogOut,
  Medal,
  Maximize2,
  Menu,
  Moon,
  Music2,
  Palette,
  Pause,
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
  SkipForward,
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
  useBlocker,
  useNavigate,
  useParams,
} from "react-router-dom";
import { io, type Socket } from "socket.io-client";
import { ApiError, hostToken, playerToken, request } from "./api";
import AdminPage from "./AdminPage";
import PlayerMusic from "./PlayerMusic";
import {
  AvatarImageError,
  createAvatarDataUrl,
} from "./avatar-image";
import { AvatarCustomizer, defaultAvatar, PlayerAvatar } from "./PlayerAvatar";
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
    color: "#2b9fbd",
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
    name: "Music",
    icon: Music2,
    color: "#e84393",
    branches: [
      "K-POP",
      "V-POP",
      "US-UK Pop",
      "Latin Pop",
      "J-POP",
      "C-POP",
      "Hip-Hop & Rap",
      "EDM",
      "R&B & Soul",
      "Bolero",
      "Rock",
      "Indie & Alternative",
      "Free Fire Soundtrack",
    ],
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
const vietnameseContentLabels: Record<string, string> = {
  "Art & Literature": "Nghệ thuật & Văn học",
  "Science & Nature": "Khoa học & Tự nhiên",
  "History & Geography": "Lịch sử & Địa lý",
  Technology: "Công nghệ",
  Sports: "Thể thao",
  Entertainment: "Giải trí",
  Music: "Âm nhạc",
  Education: "Giáo dục",
  Business: "Kinh doanh",
  Books: "Sách",
  "Visual Arts": "Mỹ thuật",
  Astronomy: "Thiên văn học",
  Biology: "Sinh học",
  "Ancient History": "Lịch sử cổ đại",
  "World Geography": "Địa lý thế giới",
  Redis: "Redis",
  Databases: "Cơ sở dữ liệu",
  Football: "Bóng đá",
  Gaming: "Trò chơi",
  "K-POP": "K-POP",
  "V-POP": "V-POP",
  "US-UK Pop": "Nhạc Âu Mỹ",
  "Latin Pop": "Nhạc Latin",
  "J-POP": "J-POP",
  "C-POP": "C-POP",
  "Hip-Hop & Rap": "Hip-Hop & Rap",
  EDM: "Nhạc điện tử (EDM)",
  "R&B & Soul": "R&B & Soul",
  Bolero: "Bolero",
  Rock: "Rock",
  "Indie & Alternative": "Indie & Alternative",
  "Free Fire Soundtrack": "Nhạc nền Free Fire",
  "Digital Safety": "An toàn số",
};

const randomNicknameParts = {
  vi: {
    adjectives: [
      "Dũng Cảm",
      "Nhanh Nhẹn",
      "Tỏa Sáng",
      "Thông Thái",
      "Vui Vẻ",
      "May Mắn",
      "Bền Bỉ",
      "Tinh Nghịch",
      "Siêu Tốc",
      "Mộng Mơ",
      "Gan Dạ",
      "Lanh Lợi",
      "Năng Động",
      "Điềm Tĩnh",
      "Ấm Áp",
      "Kỳ Diệu",
      "Bất Bại",
      "Tự Tin",
      "Phi Thường",
      "Đáng Yêu",
    ],
    nouns: [
      "Cáo",
      "Hổ",
      "Gấu",
      "Cú",
      "Rái Cá",
      "Cá Heo",
      "Đại Bàng",
      "Thỏ",
      "Sói",
      "Gấu Trúc",
    ],
  },
  en: {
    adjectives: [
      "Brave",
      "Swift",
      "Bright",
      "Clever",
      "Happy",
      "Lucky",
      "Mighty",
      "Playful",
      "Turbo",
      "Dreamy",
      "Fearless",
      "Nimble",
      "Dynamic",
      "Calm",
      "Sunny",
      "Magic",
      "Unbeaten",
      "Confident",
      "Epic",
      "Lovely",
    ],
    nouns: [
      "Fox",
      "Tiger",
      "Bear",
      "Owl",
      "Otter",
      "Dolphin",
      "Eagle",
      "Rabbit",
      "Wolf",
      "Panda",
    ],
  },
} as const;

function randomNickname(locale: "vi" | "en", current = "") {
  const parts = randomNicknameParts[locale];
  let nickname = current;
  for (let attempt = 0; attempt < 12 && nickname === current; attempt++) {
    const adjective =
      parts.adjectives[Math.floor(Math.random() * parts.adjectives.length)];
    const noun = parts.nouns[Math.floor(Math.random() * parts.nouns.length)];
    nickname = `${adjective} ${noun}`;
  }
  return nickname;
}
function contentLabel(value: string, tr: (vi: string, en: string) => string) {
  return tr(vietnameseContentLabels[value] || value, value);
}
function cx(...v: Array<string | false | undefined | null>) {
  return v.filter(Boolean).join(" ");
}
function displayCoverColor(color: string) {
  return ["#6c5ce7", "#5b5bd6", "#7868f4", "#5647d7"].includes(
    color.toLowerCase(),
  )
    ? "#2B9FBD"
    : color;
}
async function createHostRoom(quizId: string, token: string) {
  return request<{ id: string }>("/sessions", {
    method: "POST",
    token,
    body: JSON.stringify({ quizId }),
  });
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

type ConfirmationOptions = {
  title?: string;
  tone?: "default" | "danger";
};
type ConfirmationRequest = ConfirmationOptions & { message: string };
type AskConfirmation = (
  message: string,
  options?: ConfirmationOptions,
) => Promise<boolean>;

const ConfirmationContext = createContext<AskConfirmation | null>(null);

function useConfirmation() {
  const value = useContext(ConfirmationContext);
  if (!value)
    throw new Error("useConfirmation must be used inside ConfirmationProvider");
  return value;
}

function ConfirmationProvider({ children }: { children: ReactNode }) {
  const { tr } = usePreferences();
  const [dialog, setDialog] = useState<ConfirmationRequest | null>(null);
  const resolver = useRef<((accepted: boolean) => void) | null>(null);

  const close = useCallback((accepted: boolean) => {
    resolver.current?.(accepted);
    resolver.current = null;
    setDialog(null);
  }, []);

  const ask = useCallback<AskConfirmation>((message, options = {}) => {
    resolver.current?.(false);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setDialog({ message, ...options });
    });
  }, []);

  useEffect(() => {
    if (!dialog) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [dialog, close]);

  return (
    <ConfirmationContext.Provider value={ask}>
      {children}
      {dialog && (
        <div
          className="confirm-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close(false);
          }}
        >
          <section
            className={cx(
              "confirm-dialog",
              dialog.tone === "danger" && "is-danger",
            )}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            aria-describedby="confirm-message"
          >
            <div className="confirm-dialog-heading">
              <span className="confirm-dialog-icon">
                <CircleHelp />
              </span>
              <div>
                <span className="eyebrow">
                  {tr("Cần bạn xác nhận", "Confirmation required")}
                </span>
                <h2 id="confirm-title">
                  {dialog.title || tr("Xác nhận thao tác", "Confirm action")}
                </h2>
              </div>
            <p id="confirm-message">{dialog.message}</p>
            <div className="confirm-dialog-actions">
              <button
                type="button"
                className="button button-secondary"
                onClick={() => close(false)}
                autoFocus
              >
                {tr("Không", "No")}
              </button>
              </div>
              <button
                type="button"
                className={cx(
                  "button confirm-accept",
                  dialog.tone === "danger" ? "button-danger" : "button-primary",
                )}
                onClick={() => close(true)}
              >
                {tr("Có", "Yes")}
              </button>
            </div>
          </section>
        </div>
      )}
    </ConfirmationContext.Provider>
  );
}

function useRoomLeaveGuard(active: boolean, message: string) {
  const { tr } = usePreferences();
  const askConfirmation = useConfirmation();
  const bypass = useRef(false);
  const prompting = useRef(false);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      active &&
      !bypass.current &&
      `${currentLocation.pathname}${currentLocation.search}${currentLocation.hash}` !==
        `${nextLocation.pathname}${nextLocation.search}${nextLocation.hash}`,
  );

  useEffect(() => {
    if (!active) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (bypass.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [active]);

  useEffect(() => {
    if (blocker.state !== "blocked" || prompting.current) return;
    prompting.current = true;
    void askConfirmation(message, {
      title: tr("Xác nhận rời phòng", "Leave this room?"),
      tone: "danger",
    }).then((accepted) => {
      prompting.current = false;
      if (accepted) blocker.proceed();
      else blocker.reset();
    });
  }, [askConfirmation, blocker, message, tr]);

  return useCallback((action: () => void) => {
    bypass.current = true;
    action();
    window.setTimeout(() => {
      bypass.current = false;
    }, 0);
  }, []);
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
function PasswordField({ value, onChange, placeholder, minLength, required, label, compact }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  minLength?: number;
  required?: boolean;
  label: string;
  compact?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const { tr } = usePreferences();
  return (
    <label className={compact ? "compact-password" : ""}>
      {label}
      <div className="password-wrap">
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          minLength={minLength}
          required={required}
        />
        <button
          type="button"
          className="password-toggle"
          tabIndex={-1}
          onClick={() => setVisible(!visible)}
          aria-label={visible ? tr("?n m?t kh?u","Hide password") : tr("Hi?n m?t kh?u","Show password")}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </label>
  );
}

function PreferenceControls({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, theme, toggleTheme, t } = usePreferences();
  return (
    <div className={cx("preference-controls", compact && "compact")}>
      <label className="language-control" title={t("language")}>
        <span className="language-flag">{locale === "vi" ? "🇻🇳" : "🇬🇧"}</span>
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
        className="theme-control-button"
        title={t("appearance")}
        onClick={toggleTheme}
        aria-label={t("appearance")}
      >
        {theme === "dark" ? <Moon /> : <Sun />}
        {compact && <span>{theme === "dark" ? t("darkTheme") : t("lightTheme")}</span>}
      </button>
    </div>
  );
}
function Header() {
  const nav = useNavigate();
  const { t, tr } = usePreferences();
  const [showToast, setShowToast] = useState<string | null>(null);
  useEffect(() => {
    if (!showToast) return;
    const timer = setTimeout(() => setShowToast(null), 2500);
    return () => clearTimeout(timer);
  }, [showToast]);
  const showToastMsg = useCallback((msg: string) => setShowToast(msg), []);
  useEffect(() => {
    (window as any).__headerToast = showToastMsg;
    return () => { delete (window as any).__headerToast; };
  }, [showToastMsg]);
  const token = hostToken();
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [userVersion, setUserVersion] = useState(0);
  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("rr_user") || "{}");
    } catch {
      return {};
    }
  }, [token, userVersion]);
  useEffect(() => {
    const handler = () => setUserVersion((v) => v + 1);
    window.addEventListener("rr-user-updated", handler);
    return () => window.removeEventListener("rr-user-updated", handler);
  }, []);
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
            <button aria-label={t("enterRoom")} disabled={pin.length !== 6}>
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
              <div className="header-profile-menu">
                <button
                  className="header-avatar"
                  onClick={() => setProfileOpen(!profileOpen)}
                  style={user.avatar && user.avatar.startsWith("data:image") ? { backgroundImage: `url(${user.avatar})`, backgroundSize: 'cover', backgroundPosition: 'center', color: 'transparent' } : {}}
                >
                  {user.avatar && !user.avatar.startsWith("data:image") ? user.avatar : (user.displayName || "H")[0]}
                </button>
                {profileOpen && (
                  <div className="profile-dropdown">
                    <Link to="/dashboard/settings" onClick={() => setProfileOpen(false)}>
                      <Settings2 size={15} /> {tr("Hồ sơ", "Profile")}
                    </Link>
                    <button
                      id="header-logout-btn"
                      onClick={() => {
                        const bd = document.createElement('div');
                        bd.className = 'confirm-backdrop';
                        bd.innerHTML = '<section class="confirm-dialog" role="alertdialog" aria-modal="true"><div class="confirm-dialog-heading"><span class="confirm-dialog-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></span><div><span class="eyebrow">' + tr("X\u00e1c nh\u1eadn","Confirmation") + '</span><h2>' + tr("\u0110\u0103ng xu\u1ea5t?","Log out?") + '</h2></div></div><p>' + tr("B\u1ea1n c\u00f3 ch\u1eafc mu\u1ed1n \u0111\u0103ng xu\u1ea5t?","Are you sure you want to log out?") + '</p><div class="confirm-dialog-actions"><button class="button button-secondary" id="hdr-logout-no">' + tr("Kh\u00f4ng","No") + '</button><button class="button button-danger" id="hdr-logout-yes">' + tr("C\u00f3","Yes") + '</button></div></section>';
                        document.body.appendChild(bd);
                        document.getElementById("hdr-logout-no")!.addEventListener("click", () => bd.remove());
                        document.getElementById("hdr-logout-yes")!.addEventListener("click", () => {
                          bd.remove();
                          localStorage.removeItem("rr_host_token");
                          localStorage.removeItem("rr_user");
                          nav("/");
                        });
                      }}
                    >
                      <LogOut size={15} /> {t("logout")}
                    </button>
                  </div>
                )}
              </div>
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
      {showToast && (
        <div style={{position:"fixed",bottom:"30px",left:"50%",transform:"translateX(-50%)",zIndex:9999,background:"var(--panel-bg)",border:"1px solid var(--line)",borderRadius:"12px",padding:"12px 20px",display:"flex",alignItems:"center",gap:"10px",color:"var(--ink)",boxShadow:"0 8px 32px rgba(0,0,0,0.14)"}}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <span>{showToast}</span>
        </div>
      )}
      <div id="header-toast-portal"></div>
    </>
  );
}

function SearchDialog({ onClose }: { onClose: () => void }) {
  const nav = useNavigate();
  const { t, tr } = usePreferences();
  const [query, setQuery] = useState("");
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", keyboard);
    return () => window.removeEventListener("keydown", keyboard);
  }, []);
  useEffect(() => {
    setLoading(true);
    setError("");
    const timer = window.setTimeout(
      () => {
        void request<Quiz[]>(
          `/quizzes?limit=8&q=${encodeURIComponent(query.trim())}`,
        )
          .then(setQuizzes)
          .catch((reason) => setError((reason as Error).message))
          .finally(() => setLoading(false));
      },
      query ? 250 : 0,
    );
    return () => window.clearTimeout(timer);
  }, [query]);
  const results = quizzes;
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
          {loading && (
            <div className="loader">{tr("Đang tìm...", "Searching...")}</div>
          )}
          <ErrorBox error={error} />
          {!loading &&
            !error &&
            results.map((quiz) => (
              <button
                key={quiz.id}
                onClick={() => {
                  onClose();
                  nav(`/quiz/${quiz.id}`);
                }}
              >
                <span
                  style={{ background: displayCoverColor(quiz.coverColor) }}
                >
                  <BookOpen />
                </span>
                <div>
                  <b>{quiz.title}</b>
                  <small>{contentLabel(quiz.category, tr)}</small>
                </div>
                <ChevronRight />
              </button>
            ))}
          {!loading && !error && !results.length && (
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
  const { tr } = usePreferences();
  return (
    <>
      <Header />
      <main className={className}>{children}</main>
      <footer>
        <Logo />
        <p>
          {tr(
            "Quiz trực tiếp, thứ hạng thời gian thực, vận hành bằng Redis ZSET.",
            "Live quizzes and real-time rankings, powered by Redis ZSET.",
          )}
        </p>
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
  const [joinError, setJoinError] = useState("");
  const [libraryError, setLibraryError] = useState("");
  const [actionError, setActionError] = useState("");
  const [libraryLoading, setLibraryLoading] = useState(true);
  const activeCategory = categories.find((item) => item.name === category);
  useEffect(() => {
    request<Quiz[]>("/quizzes")
      .then(setQuizzes)
      .catch((reason) => setLibraryError((reason as Error).message))
      .finally(() => setLibraryLoading(false));
  }, []);
  function join(e: FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(pin)) {
      setJoinError(t("pinSixDigits"));
      return;
    }
    setJoinError("");
    nav(`/join/${pin}`);
  }
  async function playNow(quizId: string) {
    const token = hostToken();
    if (!token) {
      sessionStorage.setItem("rr_pending_host_quiz", quizId);
      nav("/login");
      return;
    }
    try {
      const room = await createHostRoom(quizId, token);
      nav(`/host/${room.id}`);
    } catch (e) {
      setActionError((e as Error).message);
    }
  }
  const featuredQuizzes = quizzes
    .filter(
      (quiz) =>
        (category === "Tất cả" || quiz.category === category) &&
        (subcategory === "Tất cả" || quiz.subcategory === subcategory),
    )
    .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
    .slice(0, 12);
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
              <ErrorBox error={joinError} />
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
                  style={{ "--category-color": c.color } as CSSProperties}
                >
                  <CategoryIcon />
                </span>
                <b>{contentLabel(c.name, tr)}</b>
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
              <h2>{tr("Tạo quiz", "Create a quiz")}</h2>
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
              <p>
                {tr(
                  "Tạo quiz từ bất kỳ chủ đề hoặc PDF nào",
                  "Generate a quiz from any subject or PDF",
                )}
              </p>
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
                {branch === "Tất cả" ? t("all") : contentLabel(branch, tr)}
                {branch === "Entertainment" && (
                  <span>{tr("Phổ biến nhất", "Most popular")}</span>
                )}
              </button>
            ))}
          </div>
        )}
        <ErrorBox error={libraryError || actionError} />
        {libraryLoading ? (
          <div className="full-loader inline-loader">
            <LoaderCircle className="spin" />{" "}
            {tr("Đang tải quiz...", "Loading quizzes...")}
          </div>
        ) : featuredQuizzes.length ? (
          <div className="quiz-grid">
            {featuredQuizzes.map((q) => (
              <QuizCard
                key={q.id}
                quiz={q}
                publicView
                onOpen={() => nav(`/quiz/${q.id}`)}
                onPractice={() => void playNow(q.id)}
              />
            ))}
          </div>
        ) : (
          <Empty
            icon={<Library />}
            title={tr("Chưa có quiz phù hợp", "No matching quizzes")}
            text={tr(
              "Hãy chọn lĩnh vực khác hoặc tạo bộ câu hỏi đầu tiên.",
              "Choose another category or create the first quiz.",
            )}
          />
        )}
      </section>
      <IntroCarousel />
    </Page>
  );
}

function IntroCarousel() {
  const { tr } = usePreferences();
  const [slide, setSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  const slides = [
    {
      icon: <Radio />,
      eyebrow: tr("Thi đấu cùng nhau", "Play together"),
      title: tr(
        "Bảng xếp hạng thay đổi ngay khi có đáp án.",
        "Rankings change the moment answers arrive.",
      ),
      text: tr(
        "Mọi người cùng vào bằng PIN, trả lời trên thiết bị riêng và nhìn thứ hạng cập nhật theo thời gian thực.",
        "Everyone joins by PIN, answers on their own device, and watches the live ranking update.",
      ),
      visual: "leaderboard",
    },
    {
      icon: <WandSparkles />,
      eyebrow: tr("Tạo nhanh bằng AI", "Create faster with AI"),
      title: tr(
        "Biến một chủ đề hoặc PDF thành bộ câu hỏi.",
        "Turn a subject or PDF into a quiz.",
      ),
      text: tr(
        "AI phân tích nội dung, tự xác định đáp án và tạo bản nháp để bạn xem lại trước khi công khai; CSV luôn sẵn sàng cho dữ liệu có cấu trúc.",
        "AI analyzes content, identifies answers, and creates a draft for review; CSV import is available for structured data.",
      ),
      visual: "generator",
    },
  ] as const;
  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(
      () => setSlide((value) => (value + 1) % slides.length),
      5200,
    );
    return () => window.clearInterval(timer);
  }, [paused, slides.length]);
  const current = slides[slide]!;
  return (
    <section className="section intro-carousel-section">
      <div
        className="intro-carousel"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div className="intro-slide-copy" key={`${slide}-copy`}>
          <span className="eyebrow light">
            {current.icon} {current.eyebrow}
          </span>
          <h2>{current.title}</h2>
          <p>{current.text}</p>
          <div
            className="carousel-dots"
            aria-label={tr("Chọn slide", "Select slide")}
          >
            {slides.map((item, index) => (
              <button
                key={item.visual}
                className={slide === index ? "active" : ""}
                onClick={() => setSlide(index)}
                aria-label={`${tr("Slide", "Slide")} ${index + 1}`}
              />
            ))}
          </div>
        </div>
        <div
          className={`intro-visual ${current.visual}`}
          key={`${slide}-visual`}
        >
          {current.visual === "leaderboard" && (
            <>
              <h4>
                <Activity /> Live leaderboard
              </h4>
              {["Nova", "Luna", "Byte", "Pixel"].map((name, index) => (
                <div className="intro-rank" key={name}>
                  <b>#{index + 1}</b>
                  <span>{name}</span>
                  <strong>{4920 - index * 230}</strong>
                </div>
              ))}
            </>
          )}
          {current.visual === "generator" && (
            <div className="intro-generator">
              <BookOpen />
              <b>{tr("Tài liệu bài học.pdf", "Lesson notes.pdf")}</b>
              <i />
              <i />
              <i />
              <span>
                <WandSparkles />{" "}
                {tr("Đã tạo 10 câu hỏi", "10 questions created")}
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Auth({ mode }: { mode: "login" | "register" }) {
  const { tr } = usePreferences();
  const nav = useNavigate();
  const [form, setForm] = useState({
    displayName: "",
    username: "",
    email: "",
    identifier: "",
    password: "",
    confirmPassword: "",
    verificationCode: "",
  });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [devCode, setDevCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!resendIn) return;
    const timer = window.setInterval(
      () => setResendIn((value) => Math.max(0, value - 1)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [resendIn]);
  async function sendRegistrationCode() {
    setError("");
    setNotice("");
    if (!form.username || !form.email) {
      setError(
        tr(
          "Hãy nhập tên đăng nhập và email trước.",
          "Enter a username and email first.",
        ),
      );
      return;
    }
    setBusy(true);
    try {
      const result = await request<{
        message: string;
        sent: boolean;
        devCode?: string;
      }>("/auth/email-verification/request", {
        method: "POST",
        body: JSON.stringify({ username: form.username, email: form.email }),
      });
      setCodeSent(true);
      setResendIn(60);
      setDevCode(result.devCode || "");
      setNotice(
        result.sent
          ? tr(
              "Đã gửi mã 6 số đến email của bạn.",
              "A 6-digit code was sent to your email.",
            )
          : result.devCode
            ? tr(
                "SMTP chưa cấu hình: mã thử nghiệm hiển thị bên dưới.",
                "SMTP is not configured: the test code is shown below.",
              )
            : tr(
                "SMTP chưa cấu hình và máy chủ đang ẩn mã thử nghiệm.",
                "SMTP is not configured and the server is hiding test codes.",
              ),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (mode === "register" && form.password !== form.confirmPassword) {
      setError(tr("Mật khẩu xác nhận không khớp.", "Passwords do not match."));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const data = await request<{
        token: string;
        user: { role?: "HOST" | "ADMIN" };
      }>(`/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify(
          mode === "login"
            ? { identifier: form.identifier, password: form.password }
            : form,
        ),
      });
      localStorage.setItem("rr_host_token", data.token);
      localStorage.setItem("rr_user", JSON.stringify(data.user));
      if (mode === "login") {
        sessionStorage.setItem("rr_login_notice", "true");
      }
      const pendingQuiz = sessionStorage.getItem("rr_pending_host_quiz");
      if (pendingQuiz) {
        sessionStorage.removeItem("rr_pending_host_quiz");
        const room = await createHostRoom(pendingQuiz, data.token);
        nav(`/host/${room.id}`);
        return;
      }
      (window as any).__headerToast?.(tr("Đăng nhập thành công!", "Login successful!"));
                      nav(data.user.role === "ADMIN" ? "/admin" : "/");
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
            <Sparkles size={16} /> {tr("Phòng điều khiển Host", "Host studio")}
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
              <>
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
                <label>
                  {tr("Tên đăng nhập", "Username")}
                  <input
                    value={form.username}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        username: e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9._-]/g, ""),
                      })
                    }
                    placeholder="thanhdanh"
                    minLength={3}
                    maxLength={30}
                    required
                  />
                </label>
              </>
            )}
            {mode === "login" ? (
              <label>
                {tr("Tên đăng nhập hoặc email", "Username or email")}
                <input
                  value={form.identifier}
                  onChange={(e) =>
                    setForm({ ...form, identifier: e.target.value })
                  }
                  placeholder={tr(
                    "thanhdanh hoặc you@example.com",
                    "username or you@example.com",
                  )}
                  required
                />
              </label>
            ) : (
              <label>
                Email
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => {
                    setForm({ ...form, email: e.target.value });
                    setCodeSent(false);
                  }}
                  placeholder="you@example.com"
                  required
                />
              </label>
            )}
            <label>
              {tr("Mật khẩu", "Password")}
              <div className="password-wrap">
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder={tr("Tối thiểu 8 ký tự", "At least 8 characters")}
                  required
                  minLength={8}
                  id="pw-login"
                />
                <button
                  type="button"
                  className="password-toggle"
                  tabIndex={-1}
                  onClick={() => {
                    const inp = document.getElementById("pw-login") as HTMLInputElement;
                    if (inp) inp.type = inp.type === "password" ? "text" : "password";
                  }}
                  aria-label={tr("Hiện/ẩn mật khẩu","Toggle password visibility")}
                >
                  <Eye size={18} />
                </button>
              </div>
            </label>
            {mode === "register" && (
              <>
                <label>
                  {tr("Xác nhận mật khẩu", "Confirm password")}
                  <div className="password-wrap">
                    <input
                      type="password"
                      value={form.confirmPassword}
                      onChange={(e) =>
                        setForm({ ...form, confirmPassword: e.target.value })
                      }
                      placeholder={tr(
                        "Nhập lại mật khẩu",
                        "Enter password again",
                      )}
                      required
                      minLength={8}
                      id="pw-reg-cf"
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      tabIndex={-1}
                      onClick={() => {
                        const inp = document.getElementById("pw-reg-cf") as HTMLInputElement;
                        if (inp) inp.type = inp.type === "password" ? "text" : "password";
                      }}
                      aria-label={tr("Hiện/ẩn mật khẩu","Toggle password visibility")}
                    >
                      <Eye size={18} />
                    </button>
                  </div>
                </label>
                <div className="verification-row">
                  <label>
                    {tr("Mã xác nhận email", "Email verification code")}
                    <input
                      className="reset-code"
                      inputMode="numeric"
                      value={form.verificationCode}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          verificationCode: e.target.value
                            .replace(/\D/g, "")
                            .slice(0, 6),
                        })
                      }
                      placeholder="000000"
                      required
                      maxLength={6}
                    />
                  </label>
                  <button
                    type="button"
                    className="button button-secondary send-code-button"
                    disabled={busy || resendIn > 0}
                    onClick={() => void sendRegistrationCode()}
                  >
                    {resendIn
                      ? `${resendIn}s`
                      : codeSent
                        ? tr("Gửi lại", "Resend")
                        : tr("Gửi mã", "Send code")}
                  </button>
                </div>
                {devCode && (
                  <div className="dev-code">
                    {tr("Mã phát triển", "Development code")}: <b>{devCode}</b>
                  </div>
                )}
              </>
            )}
            {mode === "login" && (
              <Link className="forgot-link" to="/forgot-password">
                {tr("Quên mật khẩu?", "Forgot password?")}
              </Link>
            )}
            <ErrorBox error={error} />
            {notice && (
              <div className="success-box">
                <Check /> {notice}
              </div>
            )}
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
              <b>{tr("Tài khoản Admin", "Admin account")}</b>
              <span>admin</span>
              <span>@dmin123</span>
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
  const [form, setForm] = useState({
    email: "",
    code: "",
    password: "",
    confirmPassword: "",
  });
  const [devCode, setDevCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  useEffect(() => {
    if (!resendIn) return;
    const timer = window.setInterval(
      () => setResendIn((value) => Math.max(0, value - 1)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [resendIn]);
  async function requestResetCode() {
    const result = await request<{ devCode?: string }>(
      "/auth/forgot-password",
      { method: "POST", body: JSON.stringify({ email: form.email }) },
    );
    setDevCode(result.devCode || "");
    setResendIn(60);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (step === "reset" && form.password !== form.confirmPassword) {
      setError(tr("Mật khẩu xác nhận không khớp.", "Passwords do not match."));
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (step === "request") {
        await requestResetCode();
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
                    `Mã gồm 6 số đã được gửi đến ${form.email}.`,
                    `A 6-digit code was sent to ${form.email}.`,
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
                  <button
                    type="button"
                    className="text-button"
                    disabled={busy || resendIn > 0}
                    onClick={() => {
                      setBusy(true);
                      setError("");
                      void requestResetCode()
                        .catch((reason) => setError((reason as Error).message))
                        .finally(() => setBusy(false));
                    }}
                  >
                    {resendIn
                      ? tr(`Gửi lại sau ${resendIn}s`, `Resend in ${resendIn}s`)
                      : tr("Gửi lại mã", "Resend code")}
                  </button>
                  <label>
                    {tr("Mật khẩu mới", "New password")}
                    <div className="password-wrap">
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
                        id="pw-forgot"
                      />
                      <button
                        type="button"
                        className="password-toggle"
                        tabIndex={-1}
                        onClick={() => {
                          const inp = document.getElementById("pw-forgot") as HTMLInputElement;
                          if (inp) inp.type = inp.type === "password" ? "text" : "password";
                        }}
                        aria-label={tr("Hiện/ẩn mật khẩu","Toggle password visibility")}
                      >
                        <Eye size={18} />
                      </button>
                    </div>
                  </label>
                  <label>
                    {tr("Xác nhận mật khẩu mới", "Confirm new password")}
                    <div className="password-wrap">
                      <input
                        type="password"
                        minLength={8}
                        required
                        value={form.confirmPassword}
                        onChange={(e) =>
                          setForm({ ...form, confirmPassword: e.target.value })
                        }
                        placeholder={tr(
                          "Nhập lại mật khẩu mới",
                          "Enter the new password again",
                        )}
                        id="pw-forgot-cf"
                      />
                      <button
                        type="button"
                        className="password-toggle"
                        tabIndex={-1}
                        onClick={() => {
                          const inp = document.getElementById("pw-forgot-cf") as HTMLInputElement;
                          if (inp) inp.type = inp.type === "password" ? "text" : "password";
                        }}
                        aria-label={tr("Hiện/ẩn mật khẩu","Toggle password visibility")}
                      >
                        <Eye size={18} />
                      </button>
                    </div>
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
                    ? tr("Gửi mã qua email", "Email reset code")
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
          background: `linear-gradient(135deg,${displayCoverColor(quiz.coverColor)},${displayCoverColor(quiz.coverColor)}bb)`,
        }}
      >
        <span>{contentLabel(quiz.category, tr)}</span>
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
            {quiz.averageTimeLimitSec || 0} {tr("giây/câu", "sec/question")}
          </span>
        </div>
        {quiz.subcategory && (
          <div className="quiz-specialty">
            <Target /> {contentLabel(quiz.subcategory, tr)}
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
  const askConfirmation = useConfirmation();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
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
        role?: "HOST" | "ADMIN";
      };
    } catch {
      return {};
    }
  }, []);
  const load = () =>
    Promise.all([
      request<Quiz[]>("/quizzes?mine=1", { token }),
      request<SessionSummary[]>("/sessions", { token }),
    ])
      .then(([quizRows, sessionRows]) => {
        setQuizzes(quizRows);
        setSessions(sessionRows);
      })
      .catch((error) => toast.show((error as Error).message))
      .finally(() => setLoading(false));
  useEffect(() => {
    if (token && user.role !== "ADMIN") void load();
    if (sessionStorage.getItem("rr_login_notice")) {
      sessionStorage.removeItem("rr_login_notice");
      setTimeout(() => toast.show(tr("Đăng nhập thành công!", "Logged in successfully!")), 300);
    }
  }, []);
  if (!token) return <Navigate to="/login" />;
  if (user.role === "ADMIN") return <Navigate to="/admin" replace />;
  const visibleQuizzes = quizzes.filter(
    (quiz) => statusFilter === "ALL" || quiz.status === statusFilter,
  );
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
          coverColor: "#2B9FBD",
          status: "DRAFT",
        }),
      });
      nav(`/editor/${q.id}`);
    } catch (error) {
      toast.show((error as Error).message);
    } finally {
      setCreating(false);
    }
  }
  async function host(q: Quiz) {
    try {
      const s = await createHostRoom(q.id, token);
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
    if (
      !(await askConfirmation(
        tr(`Xóa quiz “${q.title}”?`, `Delete quiz “${q.title}”?`),
        {
          title: tr("Xóa quiz", "Delete quiz"),
          tone: "danger",
        },
      ))
    )
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
              <span className="eyebrow">
                {tr("Phòng điều khiển Host", "Host studio")}
              </span>
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
                <b>
                  {
                    sessions.filter(
                      (session) =>
                        session.state === "LOBBY" ||
                        session.state === "RUNNING" ||
                        session.state === "QUESTION_RESULT",
                    ).length
                  }
                </b>
                <small>{tr("Phiên đang live", "Live sessions")}</small>
              </div>
              <div>
                <span className="stat-icon orange">
                  <Users />
                </span>
                <b>
                  {sessions.reduce(
                    (total, session) => total + session.playerCount,
                    0,
                  )}
                </b>
                <small>{tr("Tổng lượt người chơi", "Total players")}</small>
              </div>
              <div>
                <span className="stat-icon blue">
                  <Trophy />
                </span>
                <b>
                  {
                    sessions.filter((session) => session.state === "ENDED")
                      .length
                  }
                </b>
                <small>{tr("Phiên đã hoàn thành", "Completed sessions")}</small>
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
            ) : visibleQuizzes.length ? (
              <div className="quiz-grid dashboard-grid">
                {visibleQuizzes.map((q) => (
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
  const [userVersion, setUserVersion] = useState(0);
  useEffect(() => {
    const handler = () => setUserVersion((v) => v + 1);
    window.addEventListener("rr-user-updated", handler);
    return () => window.removeEventListener("rr-user-updated", handler);
  }, []);
  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("rr_user") || "{}") as {
        displayName?: string;
        avatar?: string;
      };
    } catch {
      return {};
    }
  }, [userVersion]);
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
        <div
          style={
            user.avatar && (user.avatar.startsWith("data:image") || user.avatar.startsWith("http") || user.avatar.startsWith("/"))
              ? {
                  backgroundImage: `url(${user.avatar})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  color: "transparent",
                }
              : {}
          }
        >
          {user.avatar &&
          !(
            user.avatar.startsWith("data:image") ||
            user.avatar.startsWith("http") ||
            user.avatar.startsWith("/")
          )
            ? user.avatar
            : (user.displayName || "H")[0]}
        </div>
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
  try {
    const user = JSON.parse(localStorage.getItem("rr_user") || "{}") as {
      role?: "HOST" | "ADMIN";
    };
    if (user.role === "ADMIN")
      return (
        <Navigate
          to={active === "ai" ? "/admin/assistant" : "/admin"}
          replace
        />
      );
  } catch {}
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
  const { tr, locale } = usePreferences();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"ALL" | "ENDED" | "ACTIVE">("ALL");
  useEffect(() => {
    void request<SessionSummary[]>("/sessions", { token: hostToken() })
      .then(setSessions)
      .catch((reason) => setError((reason as Error).message))
      .finally(() => setLoading(false));
  }, []);
  const visibleSessions = sessions.filter((session) =>
    filter === "ALL"
      ? true
      : filter === "ENDED"
        ? session.state === "ENDED"
        : session.state !== "ENDED" && session.state !== "CANCELLED",
  );
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
        <select
          value={filter}
          onChange={(event) => setFilter(event.target.value as typeof filter)}
        >
          <option value="ALL">{tr("Tất cả", "All")}</option>
          <option value="ENDED">{tr("Đã kết thúc", "Ended")}</option>
          <option value="ACTIVE">{tr("Đang hoạt động", "Active")}</option>
        </select>
      </div>
      <ErrorBox error={error} />
      {loading ? (
        <div className="loader">{tr("Đang tải...", "Loading...")}</div>
      ) : (
        <div className="session-list">
          {visibleSessions.map((session) => (
            <article key={session.id}>
              <div className="session-icon">
                <BarChart3 />
              </div>
              <div>
                <b>
                  {session.quiz?.title || tr("Quiz đã xóa", "Deleted quiz")}
                </b>
                <span>
                  {new Date(session.createdAt).toLocaleString(
                    locale === "vi" ? "vi-VN" : "en-US",
                  )}
                </span>
              </div>
              <span
                className={cx("session-state", session.state.toLowerCase())}
              >
                {session.state === "ENDED"
                  ? tr("Đã kết thúc", "Ended")
                  : session.state === "CANCELLED"
                    ? tr("Đã hủy", "Cancelled")
                    : session.state === "LOBBY"
                      ? tr("Phòng chờ", "Lobby")
                      : tr("Đang chạy", "Running")}
              </span>
              <strong>
                {session.playerCount} {tr("người", "players")}
              </strong>
              {session.state !== "CANCELLED" && (
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
              )}
            </article>
          ))}
          {!visibleSessions.length && (
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
  const { tr, locale } = usePreferences();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [selected, setSelected] = useState("");
  const [board, setBoard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    void request<SessionSummary[]>("/sessions", { token: hostToken() })
      .then((rows) => {
        setSessions(rows);
        setSelected(rows[0]?.id || "");
      })
      .catch((reason) => setError((reason as Error).message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (!selected) return;
    void request<{ leaderboard: LeaderboardEntry[] }>(
      `/sessions/${selected}/leaderboard?limit=100`,
      { token: hostToken() },
    )
      .then((data) => setBoard(data.leaderboard))
      .catch((reason) => setError((reason as Error).message));
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
              {new Date(session.createdAt).toLocaleDateString(
                locale === "vi" ? "vi-VN" : "en-US",
              )}
            </option>
          ))}
        </select>
      </div>
      <ErrorBox error={error} />
      <section className="dashboard-section ranking-page">
        {loading ? (
          <div className="loader">{tr("Đang tải...", "Loading...")}</div>
        ) : sessions.length ? (
          <Leaderboard entries={board} />
        ) : (
          <Empty
            icon={<Trophy />}
            title={tr("Chưa có phiên chơi", "No game sessions yet")}
            text={tr(
              "Tổ chức một quiz để tạo bảng xếp hạng.",
              "Host a quiz to create a leaderboard.",
            )}
          />
        )}
      </section>
    </DashboardWorkspace>
  );
}

function SettingsPage() {
  const { tr } = usePreferences();
  const toast = useToast();
  const [form, setForm] = useState({
    displayName: "",
    username: "",
    email: "",
    currentPassword: "",
    password: "",
    confirmPassword: "",
    logoutOther: false,
  });
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarProcessing, setAvatarProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    void request<{ displayName: string; username?: string; email: string; avatar?: string }>(
      "/auth/me",
      {
        token: hostToken(),
      },
    )
      .then((user) => {
        setForm({
          ...user,
          username: user.username || user.email.split("@")[0] || "host",
          currentPassword: "",
          password: "",
          confirmPassword: "",
          logoutOther: false,
        });
        if (user.avatar) {
          setAvatarPreview(user.avatar);
        }
      })
      .catch((error) => toast.show((error as Error).message));
  }, []);
  async function selectAvatar(file?: File) {
    if (!file) return;
    setAvatarProcessing(true);
    try {
      setAvatarPreview(await createAvatarDataUrl(file));
      toast.show(
        tr(
          "Ảnh đã sẵn sàng. Bấm Lưu thay đổi để lưu vào Redis.",
          "Photo ready. Select Save changes to store it in Redis.",
        ),
      );
    } catch (error) {
      const code =
        error instanceof AvatarImageError ? error.code : "AVATAR_IMAGE_INVALID";
      const messages = {
        AVATAR_FILE_TOO_LARGE: tr(
          "Ảnh gốc không được lớn hơn 10 MB.",
          "The source image must not exceed 10 MB.",
        ),
        AVATAR_FILE_UNSUPPORTED: tr(
          "Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP.",
          "Only JPG, PNG or WebP images are supported.",
        ),
        AVATAR_IMAGE_INVALID: tr(
          "Không thể đọc tệp ảnh này.",
          "This image file could not be read.",
        ),
        AVATAR_RESULT_TOO_LARGE: tr(
          "Không thể thu nhỏ ảnh đủ để lưu. Hãy chọn ảnh khác.",
          "The image could not be reduced enough. Choose another image.",
        ),
      };
      toast.show(messages[code]);
    } finally {
      setAvatarProcessing(false);
    }
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (avatarProcessing) return;
    if (form.password !== form.confirmPassword) {
      toast.show(
        tr("Mật khẩu xác nhận không khớp.", "Passwords do not match."),
      );
      return;
    }
    setSaving(true);
    try {
      const user = await request<{
        displayName: string;
        username: string;
        email: string;
        avatar?: string;
      }>("/auth/me", {
        method: "PUT",
        token: hostToken(),
        body: JSON.stringify({
          displayName: form.displayName,
          username: form.username,
          avatar: avatarPreview || "",
          currentPassword: form.currentPassword,
          password: form.password,
          confirmPassword: form.confirmPassword,
        }),
      });
      localStorage.setItem("rr_user", JSON.stringify(user));
      window.dispatchEvent(new Event("rr-user-updated"));
      
      if (form.password) {
        toast.show(
          form.logoutOther 
            ? tr("Đã đổi mật khẩu thành công. Các thiết bị khác đã bị đăng xuất.", "Password changed. Other devices logged out.") 
            : tr("Đã đổi mật khẩu thành công.", "Password changed successfully.")
        );
      } else {
        toast.show(tr("Đã lưu cài đặt tài khoản.", "Account settings saved."));
      }

      setForm((prev) => ({
        ...prev,
        ...user,
        currentPassword: "",
        password: "",
        confirmPassword: "",
        logoutOther: false,
      }));
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
            {tr("Tên đăng nhập", "Username")}
            <input
              value={form.username}
              onChange={(event) =>
                setForm({
                  ...form,
                  username: event.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9._-]/g, ""),
                })
              }
              required
              minLength={3}
              maxLength={30}
              disabled
            />
          </label>
          <div className="settings-avatar-section">
            <label className="avatar-upload-label">
              <span className="eyebrow">{tr("\u1ea2nh \u0111\u1ea1i di\u1ec7n","Avatar")}</span>
              <div className="avatar-upload-area">

                {avatarPreview &&
                !(
                  avatarPreview.startsWith("data:image") ||
                  avatarPreview.startsWith("http") ||
                  avatarPreview.startsWith("/")
                ) ? (
                  <div className="avatar-preview avatar-preview-emoji">
                    {avatarPreview}
                  </div>
                ) : (
                  <img
                    src={avatarPreview || "/brand/rankrush-r2.png"}
                    alt="Avatar"
                    className="avatar-preview"
                  />
                )}
                <input type="file" accept="image/*" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string);
                    reader.readAsDataURL(file);
                  }
                }} />
                <span>{tr("T\u1ea3i \u1ea3nh l\u00ean","Upload photo")}</span>

              </div>
            </label>
            <small className="avatar-upload-hint">
              {tr(
                "JPG, PNG hoặc WebP; tối đa 10 MB. Ảnh sẽ được thu nhỏ trước khi lưu.",
                "JPG, PNG or WebP; up to 10 MB. The image is resized before saving.",
              )}
            </small>
            <div className="avatar-presets">
              <span className="eyebrow">{tr("Ho\u1eb7c ch\u1ecdn m\u1eabu","Or pick a preset")}</span>
              <div className="preset-icons">
                {["\ud83e\udd8b","\ud83e\udd8d","\ud83e\udd81","\ud83e\udd87","\ud83d\udc3a","\ud83e\udd86","\ud83e\udd8a","\ud83d\udc39","\ud83d\udc31","\ud83d\udc2f","\ud83d\udc18","\ud83d\udc37"].map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    className={cx("preset-icon-btn", avatarPreview === icon && "active")}
                    onClick={() => setAvatarPreview(icon)}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <label>
            {tr("Mật khẩu hiện tại", "Current password")}{" "}
            <small>
              {tr(
                "Chỉ cần nhập khi đổi mật khẩu",
                "Required only when changing password",
              )}
            </small>
              <div className="password-wrap">
                <input
                type="password"
                value={form.currentPassword}
                onChange={(event) =>
                setForm({ ...form, currentPassword: event.target.value })
                }
                required={Boolean(form.password)}
                id="pw-setting-current"
                />
                <button
                type="button"
                className="password-toggle"
                tabIndex={-1}
                onClick={() => {
                const inp = document.getElementById("pw-setting-current") as HTMLInputElement;
                if (inp) inp.type = inp.type === "password" ? "text" : "password";
                }}
                aria-label={tr("Hi\u1ec7n/\u1ea9n m\u1eadt kh\u1ea9u","Toggle password visibility")}
                >
                <Eye size={18} />
                </button>
              </div>
          </label>
          <label>
            {tr("Mật khẩu mới", "New password")}{" "}
            <small>
              {tr(
                "Để trống nếu không muốn thay đổi",
                "Leave blank to keep the current password",
              )}
            </small>
              <div className="password-wrap">
                <input
                type="password"
                minLength={8}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                id="pw-setting-new"
                />
                <button
                type="button"
                className="password-toggle"
                tabIndex={-1}
                onClick={() => {
                const inp = document.getElementById("pw-setting-new") as HTMLInputElement;
                if (inp) inp.type = inp.type === "password" ? "text" : "password";
                }}
                aria-label={tr("Hi\u1ec7n/\u1ea9n m\u1eadt kh\u1ea9u","Toggle password visibility")}
                >
                <Eye size={18} />
                </button>
              </div>
          </label>
          <label>
            {tr("Xác nhận mật khẩu mới", "Confirm new password")}
            <div className="password-wrap">
              <input
                type="password"
                minLength={8}
                value={form.confirmPassword}
                onChange={(event) =>
                  setForm({ ...form, confirmPassword: event.target.value })
                }
                required={Boolean(form.password)}
                id="pw-setting-confirm"
              />
              <button
                type="button"
                className="password-toggle"
                tabIndex={-1}
                onClick={() => {
                  const inp = document.getElementById("pw-setting-confirm") as HTMLInputElement;
                  if (inp) inp.type = inp.type === "password" ? "text" : "password";
                }}
                aria-label={tr("Hiện/ẩn mật khẩu","Toggle password visibility")}
              >
                <Eye size={18} />
              </button>
            </div>
          </label>
          {Boolean(form.password) && (
            <label className="checkbox-label">
              <input 
                type="checkbox" 
                checked={form.logoutOther}
                onChange={(e) => setForm({ ...form, logoutOther: e.target.checked })}
              />
              {tr("Đăng xuất khỏi các thiết bị khác", "Log out of other devices")}
            </label>
          )}
          <button className="button button-primary" disabled={saving || avatarProcessing}>
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
  const { tr, locale } = usePreferences();
  const nav = useNavigate();
  const [source, setSource] = useState<"SUBJECT" | "PDF" | "CSV">("SUBJECT");
  const [form, setForm] = useState({
    subject: "",
    context: "",
    title: "",
    category: "",
    questionCount: 0,
    language: "" as "" | "vi" | "en",
    difficulty: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const progressTimer = useRef<number | null>(null);
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
  const hasCommonDetails = Boolean(
    form.title.trim() &&
      form.category &&
      form.questionCount > 0 &&
      form.language &&
      form.difficulty,
  );
  const hasSourceDetails =
    source === "SUBJECT"
      ? Boolean(form.subject.trim() && form.context.trim())
      : source === "PDF"
        ? Boolean(file && form.context.trim())
        : Boolean(file);
  const hasAllDetails = hasCommonDetails && hasSourceDetails;
  const aiReady = Boolean(aiStatus?.reachable && aiStatus.modelInstalled);

  function clearProgressTimer() {
    if (progressTimer.current !== null) {
      window.clearInterval(progressTimer.current);
      progressTimer.current = null;
    }
  }

  useEffect(() => clearProgressTimer, []);

  async function generate(event: FormEvent) {
    event.preventDefault();
    if (!hasAllDetails) {
      setError(
        tr(
          "Vui lòng điền đầy đủ tất cả thông tin bắt buộc trước khi tạo quiz.",
          "Please complete every required field before generating the quiz.",
        ),
      );
      return;
    }
    setBusy(true);
    setProgress(8);
    setError("");
    clearProgressTimer();
    progressTimer.current = window.setInterval(() => {
      setProgress((current) => {
        if (current < 70) return current + 7;
        if (current < 90) return current + 2;
        if (current < 96) return current + 1;
        return current;
      });
    }, 650);
    try {
      const body = new FormData();
      Object.entries(form).forEach(([key, value]) =>
        body.append(key, String(value)),
      );
      if (file) body.append("file", file);
      const result = await request<{
        quiz: Quiz;
        questionCount: number;
        source: "SUBJECT" | "PDF" | "CSV";
        provider: "OLLAMA" | "LOCAL_FALLBACK" | "CSV";
        model: string;
        warning?: string;
      }>("/ai/generate-quiz", {
        method: "POST",
        token: hostToken(),
        body,
      });
      clearProgressTimer();
      setProgress(100);
      sessionStorage.setItem(
        "rr_ai_notice",
        result.source === "CSV"
          ? tr(
              `Đã nhập và kiểm tra ${result.questionCount} câu hỏi từ CSV.`,
              `Imported and validated ${result.questionCount} questions from CSV.`,
            )
          : tr(
              `AI đã tạo ${result.questionCount} câu hỏi. Hãy kiểm tra lại đáp án trước khi xuất bản.`,
              `AI created ${result.questionCount} questions. Review the answers before publishing.`,
            ),
      );
      await new Promise<void>((resolve) => window.setTimeout(resolve, 250));
      nav(`/editor/${result.quiz.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      clearProgressTimer();
      setBusy(false);
    }
  }
  return (
    <DashboardWorkspace active="ai">
      <div className="ai-create-page">
        <button className="text-button back" onClick={() => nav("/")}>
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
                <button
                  type="button"
                  className={source === "SUBJECT" ? "active" : ""}
                  onClick={() => {
                    setSource("SUBJECT");
                    setFile(null);
                  }}
                >
                  <WandSparkles />
                  {tr("Chủ đề", "Subject")}
                </button>
                <button
                  type="button"
                  className={source === "PDF" ? "active" : ""}
                  onClick={() => {
                    setSource("PDF");
                    setFile(null);
                  }}
                >
                  <BookOpen />
                  PDF
                </button>
                <button
                  type="button"
                  className={source === "CSV" ? "active" : ""}
                  onClick={() => {
                    setSource("CSV");
                    setFile(null);
                  }}
                >
                  <FileSpreadsheet />
                  CSV
                </button>
              </div>
              {source !== "CSV" && (
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
                    <b>{tr("Trình tạo câu hỏi AI", "AI quiz generator")}</b>
                    <span>
                      {!aiStatus
                        ? tr(
                            "Đang kiểm tra trạng thái...",
                            "Checking availability...",
                          )
                        : aiStatus.reachable && aiStatus.modelInstalled
                          ? tr(
                              "Đã sẵn sàng · dữ liệu được xử lý trên máy",
                              "Ready · data is processed on this device",
                            )
                          : tr(
                              "AI chưa sẵn sàng · bạn vẫn có thể nhập bằng CSV",
                              "AI is not ready · CSV import is still available",
                            )}
                    </span>
                  </div>
                  <i />
                </div>
              )}
              {source === "SUBJECT" ? (
                <label>
                  {tr("Chủ đề", "Subject")}
                  <input
                    value={form.subject}
                    onChange={(e) =>
                      setForm({ ...form, subject: e.target.value })
                    }
                    required
                    placeholder={tr(
                      "Ví dụ: Redis và bảng xếp hạng",
                      "Example: Redis and leaderboards",
                    )}
                  />
                </label>
              ) : (
                <label className="pdf-drop">
                  <input
                    type="file"
                    accept={
                      source === "PDF"
                        ? "application/pdf,.pdf"
                        : "text/csv,.csv"
                    }
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    required
                  />
                  {source === "PDF" ? <BookOpen /> : <FileSpreadsheet />}
                  <b>
                    {file
                      ? file.name
                      : source === "PDF"
                        ? tr("Thả hoặc chọn tệp PDF", "Drop or choose a PDF")
                        : tr("Thả hoặc chọn tệp CSV", "Drop or choose a CSV")}
                  </b>
                  <span>
                    {source === "PDF"
                      ? tr(
                          "Tối đa 10 MB · PDF phải có văn bản có thể chọn",
                          "Up to 10 MB · PDF must contain selectable text",
                        )
                      : tr(
                          "Đáp án được kiểm tra theo từng dòng · tối đa 100 câu",
                          "Answers are validated row by row · up to 100 questions",
                        )}
                  </span>
                </label>
              )}
              {source === "CSV" && (
                <a
                  className="button button-secondary csv-template-link"
                  href="/api/ai/csv-template"
                  download
                >
                  <FileSpreadsheet />
                  {tr("Tải tệp CSV mẫu", "Download CSV template")}
                </a>
              )}
              {source !== "CSV" && (
                <label>
                  {tr(
                    "Mô tả / yêu cầu chi tiết",
                    "Description / detailed brief",
                  )}
                  <textarea
                    className="generator-context"
                    value={form.context}
                    onChange={(event) =>
                      setForm({ ...form, context: event.target.value })
                    }
                    placeholder={tr(
                      "Ví dụ: Dành cho sinh viên năm 2; tập trung vào đặc điểm cầu thủ, mỗi câu chỉ có một đáp án rõ ràng; tránh hỏi tiểu sử ngoài phạm vi.",
                      "Example: For second-year students; focus on player characteristics, use one unambiguous answer, and avoid out-of-scope biography questions.",
                    )}
                    maxLength={2000}
                    required
                  />
                  <small>
                    {tr(
                      "Mô tả càng cụ thể thì câu hỏi và phương án nhiễu càng sát yêu cầu.",
                      "A precise brief produces more relevant questions and distractors.",
                    )}
                  </small>
                </label>
              )}
              <div className="form-grid">
                <label>
                  {tr("Tên quiz", "Quiz name")}
                  <input
                    value={form.title}
                    onChange={(e) =>
                      setForm({ ...form, title: e.target.value })
                    }
                    required
                    placeholder={tr(
                      "Nhập tên quiz rõ ràng",
                      "Enter a clear quiz name",
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
                    required
                  >
                    <option value={0} disabled>
                      {tr("Chọn số câu", "Select a question count")}
                    </option>
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
                  required
                >
                  <option value="" disabled>
                    {tr("Chọn danh mục", "Select a category")}
                  </option>
                  {categories.map((category) => (
                    <option key={category.name} value={category.name}>
                      {contentLabel(category.name, tr)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="form-grid">
                <label>
                  {tr("Ngôn ngữ câu hỏi", "Question language")}
                  <select
                    value={form.language}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        language: event.target.value as "" | "vi" | "en",
                      })
                    }
                    required
                  >
                    <option value="" disabled>
                      {tr("Chọn ngôn ngữ", "Select a language")}
                    </option>
                    <option value="vi">Tiếng Việt</option>
                    <option value="en">English</option>
                  </select>
                </label>
                <label>
                  {tr("Độ khó", "Difficulty")}
                  <select
                    value={form.difficulty}
                    onChange={(event) =>
                      setForm({ ...form, difficulty: event.target.value })
                    }
                    required
                  >
                    <option value="" disabled>
                      {tr("Chọn độ khó", "Select a difficulty")}
                    </option>
                    <option value="EASY">{tr("Dễ", "Easy")}</option>
                    <option value="MEDIUM">{tr("Trung bình", "Medium")}</option>
                    <option value="HARD">{tr("Khó", "Hard")}</option>
                  </select>
                </label>
              </div>
              <ErrorBox error={error} />
              {busy && (
                <div className="generation-progress-bar-container">
                  <div className="generation-progress-bar-header">
                    <span className="generation-progress-bar-label">
                      {source === "CSV"
                        ? tr("Đang kiểm tra và nhập CSV...", "Validating CSV...")
                        : tr(
                            "AI đang phân tích và tạo câu hỏi...",
                            "AI is analyzing and generating questions...",
                          )}
                    </span>
                    <span className="generation-progress-bar-percent">
                      {Math.round(progress)}%
                    </span>
                  </div>
                  <div className="generation-progress-bar-track">
                    <div
                      className="generation-progress-bar-fill"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <small className="generation-progress-bar-hint">
                    {progress < 30
                      ? tr("Đang khởi tạo...", "Initializing...")
                      : progress < 60
                        ? tr("Đang tạo câu hỏi...", "Generating questions...")
                        : progress < 90
                          ? tr("Đang kiểm tra đáp án...", "Verifying answers...")
                          : tr("Sắp hoàn thành...", "Almost done...")}
                  </small>
                </div>
              )}
              <button
                className="button button-primary button-lg button-block"
                disabled={busy || !hasAllDetails}
                aria-busy={busy}
              >
                {busy ? (
                  <LoaderCircle className="spin-icon" />
                ) : (
                  <WandSparkles />
                )}
                {busy
                  ? tr(
                      `Đang tạo... ${Math.round(progress)}%`,
                      `Generating... ${Math.round(progress)}%`,
                    )
                  : source === "CSV"
                    ? tr("Nhập quiz từ CSV", "Import quiz from CSV")
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
  const askConfirmation = useConfirmation();
  const token = hostToken();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selected, setSelected] = useState<number>(0);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  useEffect(() => {
    request<{ quiz: Quiz; questions: Question[] }>(`/quizzes/${id}?editor=1`, {
      token,
    })
      .then((d) => {
        setQuiz(d.quiz);
        setQuestions(d.questions);
      })
      .catch((e) => {
        setLoadError(e.message);
        toast.show(e.message);
      });
  }, [id]);
  useEffect(() => {
    const notice = sessionStorage.getItem("rr_ai_notice");
    if (notice) {
      sessionStorage.removeItem("rr_ai_notice");
      toast.show(notice);
    }
  }, []);
  if (!token) return <Navigate to="/login" />;
  if (!quiz && loadError)
    return (
      <Page>
        <Empty
          icon={<CircleHelp />}
          title={tr("Không thể mở Quiz Editor", "Could not open Quiz Editor")}
          text={loadError}
          action={
            <Link className="button button-secondary" to="/dashboard">
              <ArrowLeft /> Dashboard
            </Link>
          }
        />
      </Page>
    );
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
      for (const question of questions)
        await request<Question>(`/questions/${question.id}`, {
          method: "PUT",
          token,
          body: JSON.stringify(question),
        });
      const updated = await request<Quiz>(`/quizzes/${quiz!.id}`, {
        method: "PUT",
        token,
        body: JSON.stringify(quiz),
      });
      setQuiz(updated);
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
    if (
      !(await askConfirmation(tr("Xóa câu hỏi này?", "Delete this question?"), {
        title: tr("Xóa câu hỏi", "Delete question"),
        tone: "danger",
      }))
    )
      return;
    await request(`/questions/${q.id}`, { method: "DELETE", token });
    const next = questions.filter((x) => x.id !== q.id);
    setQuestions(next);
    setSelected(Math.max(0, Math.min(selected, next.length - 1)));
  }
  async function moveQuestion(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= questions.length) return;
    const previous = questions;
    const next = [...questions];
    [next[index], next[target]] = [next[target]!, next[index]!];
    const ordered = next.map((question, order) => ({ ...question, order }));
    setQuestions(ordered);
    setSelected(target);
    try {
      await Promise.all(
        ordered.map((question) =>
          request<Question>(`/questions/${question.id}`, {
            method: "PUT",
            token,
            body: JSON.stringify(question),
          }),
        ),
      );
    } catch (error) {
      setQuestions(previous);
      setSelected(index);
      toast.show((error as Error).message);
    }
  }
  return (
    <div className="editor-page">
      <header className="editor-header">
        <button className="icon-button" onClick={() => nav("/")}>
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
          <PreferenceControls compact />
          <button
            className="button button-secondary"
            onClick={() => nav(`/quiz/${quiz.id}`)}
          >
            <Eye /> {tr("Xem trước", "Preview")}
          </button>
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
            <div className="question-thumb-wrap" key={q.id}>
              <button
                className={cx("question-thumb", i === selected && "active")}
                onClick={() => setSelected(i)}
              >
                <span>{i + 1}</span>
                <div>
                  <b>{q.prompt}</b>
                  <small>
                    {q.type === "TEXT"
                      ? tr("Nhập văn bản", "Text answer")
                      : q.type === "TRUE_FALSE"
                        ? tr("Đúng / Sai", "True / False")
                        : tr("Trắc nghiệm", "Multiple choice")}{" "}
                    • {q.timeLimitSec}s
                  </small>
                </div>
              </button>
              <span className="question-order-actions">
                <button
                  type="button"
                  disabled={i === 0}
                  onClick={() => void moveQuestion(i, -1)}
                  aria-label={tr("Đưa câu hỏi lên", "Move question up")}
                >
                  <ArrowUp />
                </button>
                <button
                  type="button"
                  disabled={i === questions.length - 1}
                  onClick={() => void moveQuestion(i, 1)}
                  aria-label={tr("Đưa câu hỏi xuống", "Move question down")}
                >
                  <ArrowDown />
                </button>
              </span>
            </div>
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
                <option key={c.name} value={c.name}>
                  {contentLabel(c.name, tr)}
                </option>
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
          <Toggle
            label={tr("Điểm theo tốc độ", "Speed scoring")}
            value={quiz.settings.speedScoring}
            onChange={(value) =>
              setQuiz({
                ...quiz,
                settings: { ...quiz.settings, speedScoring: value },
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
  function changeType(type: Question["type"]) {
    if (type === "TRUE_FALSE") {
      const truth = { id: crypto.randomUUID(), text: tr("Đúng", "True") };
      const falsity = { id: crypto.randomUUID(), text: tr("Sai", "False") };
      onChange({
        ...q,
        type,
        options: [truth, falsity],
        correctOptionId: truth.id,
        acceptedAnswers: [],
      });
      return;
    }
    if (type === "TEXT") {
      onChange({
        ...q,
        type,
        options: [],
        correctOptionId: "",
      });
      return;
    }
    const options =
      q.type === "SINGLE_CHOICE" && q.options.length >= 2
        ? q.options
        : [
            { id: crypto.randomUUID(), text: tr("Đáp án A", "Answer A") },
            { id: crypto.randomUUID(), text: tr("Đáp án B", "Answer B") },
          ];
    onChange({
      ...q,
      type,
      options,
      correctOptionId: options.some((option) => option.id === q.correctOptionId)
        ? q.correctOptionId
        : options[0]!.id,
      acceptedAnswers: [],
    });
  }
  return (
    <div className="question-form">
      <div className="question-toolbar">
        <select
          value={q.type}
          onChange={(e) => changeType(e.target.value as Question["type"])}
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
                  onClick={() => {
                    const options = q.options.filter((x) => x.id !== o.id);
                    onChange({
                      ...q,
                      options,
                      correctOptionId:
                        q.correctOptionId === o.id
                          ? options[0]?.id || ""
                          : q.correctOptionId,
                    });
                  }}
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
  const { locale, tr, t } = usePreferences();
  const [pin, setPin] = useState(routePin || "");
  const [info, setInfo] = useState<any>(null);
  const [form, setForm] = useState({
    nickname: "",
    avatar: defaultAvatar,
    team: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [diceRoll, setDiceRoll] = useState(0);
  useEffect(() => {
    if (routePin) void lookup();
  }, [routePin]);
  async function lookup() {
    setError("");
    try {
      const room = await request<any>(`/sessions/pin/${pin}`, {
        token: hostToken(),
      });
      if (room.hostOwnsRoom) {
        nav(`/host/${room.session.id}`);
        return;
      }
      setInfo(room);
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
        token: hostToken(),
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
                  <span>{t("nickname")}</span>
                  <div className="nickname-input-row">
                    <input
                      value={form.nickname}
                      onChange={(e) =>
                        setForm({ ...form, nickname: e.target.value })
                      }
                      placeholder={t("yourName")}
                      maxLength={24}
                      required
                    />
                    <button
                      type="button"
                      className="nickname-random-button"
                      title={tr(
                        "Tạo biệt danh ngẫu nhiên",
                        "Randomize nickname",
                      )}
                      aria-label={tr(
                        "Tạo biệt danh ngẫu nhiên",
                        "Randomize nickname",
                      )}
                      onClick={() => {
                        setForm({
                          ...form,
                          nickname: randomNickname(locale, form.nickname),
                        });
                        setDiceRoll((current) => current + 1);
                      }}
                    >
                      <Dices key={diceRoll} />
                    </button>
                  </div>
                </label>
                <label>
                  {t("chooseAvatar")}
                  <AvatarCustomizer
                    value={form.avatar}
                    onChange={(avatar) => setForm({ ...form, avatar })}
                    labels={{
                      skin: tr("Màu da", "Skin"),
                      hair: tr("Tóc", "Hair"),
                      shirt: tr("Trang phục", "Outfit"),
                      accessory: tr("Phụ kiện", "Accessory"),
                      none: tr("Không", "None"),
                    }}
                  />
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
      "question:preview",
      "question:shown",
      "question:revealed",
      "session:updated",
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
    let notified = false;
    const tick = () => {
      const elapsed = (Date.now() - new Date(startedAt).getTime()) / 1000;
      const n = Math.max(0, Math.ceil(seconds - elapsed));
      setLeft(n);
      if (n === 0 && !notified) {
        notified = true;
        onExpire?.();
      }
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

function StartCountdown({ startedAt }: { startedAt: string }) {
  const { tr } = usePreferences();
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const tick = () =>
      setStage(
        Math.min(
          3,
          Math.max(
            0,
            Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000),
          ),
        ),
      );
    tick();
    const timer = window.setInterval(tick, 100);
    return () => window.clearInterval(timer);
  }, [startedAt]);
  const labels = ["3", "2", "1", tr("Bắt đầu!", "Go!")];
  return (
    <div
      className="start-countdown-overlay"
      role="status"
      aria-live="assertive"
    >
      <div key={stage} className="start-countdown-value">
        {labels[stage]}
      </div>
      <span>{tr("Sẵn sàng cho cuộc đua", "Get ready for the race")}</span>
    </div>
  );
}

function PlayerGame() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const { t, tr } = usePreferences();
  const token = playerToken(id);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [selected, setSelected] = useState("");
  const [result, setResult] = useState<any>(null);
  const [reveal, setReveal] = useState<any>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [expired, setExpired] = useState(false);
  const [finalResult, setFinalResult] = useState<PlayerResult | null>(null);
  const runWithoutLeavePrompt = useRoomLeaveGuard(
    Boolean(
      snapshot && !["ENDED", "CANCELLED"].includes(snapshot.session.state),
    ),
    tr(
      "Bạn đang tham gia một phòng chơi. Nếu rời trang, bạn có thể bỏ lỡ câu hỏi hiện tại. Bạn có chắc muốn rời đi?",
      "You are currently playing in a room. Leaving may cause you to miss the current question. Are you sure you want to leave?",
    ),
  );
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
    if (!reveal || !selected || snapshot?.session.settings.mutePlayers) return;
    const AudioContextClass = window.AudioContext;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const correct =
      snapshot?.currentQuestion?.type === "TEXT"
        ? reveal.acceptedAnswers?.some(
            (answer: string) =>
              answer.trim().toLocaleLowerCase("vi-VN") ===
              selected.trim().toLocaleLowerCase("vi-VN"),
          )
        : selected === reveal.correctOptionId;
    oscillator.frequency.value = correct ? 660 : 190;
    gain.gain.setValueAtTime(0.08, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.18);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.18);
    oscillator.addEventListener("ended", () => void context.close());
  }, [reveal, selected, snapshot?.session.settings.mutePlayers]);
  useGameSocket(
    id,
    token,
    (d) => setSnapshot(d),
    (name, data) => {
      if (
        name === "lobby:updated" ||
        name === "session:started" ||
        name === "question:preview" ||
        name === "question:shown" ||
        name === "session:updated" ||
        name === "session:ended"
      ) {
        if (data?.session) setSnapshot(data);
        else void load();
        if (name === "question:preview" || name === "session:started") {
          setSelected("");
          setResult(null);
          setReveal(null);
          setExpired(false);
        }
      }
      if (name === "question:revealed") {
        if (data?.session) {
          setSnapshot(data);
          setReveal(data.revealedQuestion);
        } else {
          setReveal(data);
          void load();
        }
      }
      if (name === "leaderboard:updated")
        setSnapshot((s) => (s ? { ...s, ...data } : s));
      if (name === "answer:accepted") setResult(data);
      if (name === "player:kicked") {
        sessionStorage.removeItem(`rr_player_${id}`);
        sessionStorage.removeItem(`rr_player_meta_${id}`);
        runWithoutLeavePrompt(() => nav("/join"));
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
  const phase =
    snapshot.session.state === "PAUSED"
      ? snapshot.session.pausedState
      : snapshot.session.state;
  const activeReveal = reveal || snapshot.revealedQuestion;
  const isLastQuestion =
    snapshot.session.currentQuestionIndex ===
    snapshot.session.questionOrder.length - 1;
  const selectedIsCorrect = activeReveal
    ? snapshot.currentQuestion?.type === "TEXT"
      ? activeReveal.acceptedAnswers.some(
          (answer: string) =>
            answer.trim().toLocaleLowerCase("vi-VN") ===
            selected.trim().toLocaleLowerCase("vi-VN"),
        )
      : selected === activeReveal.correctOptionId
    : false;
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
                width: `${Math.min(
                  100,
                  ((snapshot.session.currentQuestionIndex + 1) /
                    Math.max(1, snapshot.session.questionOrder.length)) *
                    100,
                )}%`,
              }}
            />
          </div>
        </div>
        <div className="player-chip">
          <PlayerAvatar value={meta.avatar} size={34} />
          <b>{meta.nickname || t("player")}</b>
          <strong>{self?.score || 0}</strong>
        </div>
        <PlayerMusic
          disabled={
            snapshot.session.settings.mutePlayers ||
            snapshot.session.state === "ENDED" ||
            snapshot.session.state === "CANCELLED"
          }
        />
        <PreferenceControls compact />
      </div>
      {snapshot.session.state === "LOBBY" ? (
        <LobbyPlayer snapshot={snapshot} meta={meta} />
      ) : snapshot.session.state === "GAME_COUNTDOWN" ? (
        <StartCountdown startedAt={snapshot.session.questionStartedAt} />
      ) : snapshot.session.state === "CANCELLED" ? (
        <div className="final-player">
          <X />
          <h1>{t("sessionCancelled")}</h1>
          <Link className="button button-primary" to="/join">
            <Gamepad2 /> {t("playAnother")}
          </Link>
        </div>
      ) : snapshot.session.state === "ENDED" ? (
        <FinalPlayer snapshot={snapshot} meta={meta} result={finalResult} />
      ) : (
        <div className="play-layout">
          <section className="question-stage">
            {snapshot.currentQuestion && (
              <>
                {snapshot.session.state !== "PAUSED" && (
                  <Countdown
                    startedAt={snapshot.session.questionStartedAt}
                    seconds={
                      phase === "RUNNING"
                        ? snapshot.currentQuestion.timeLimitSec
                        : 5
                    }
                    onExpire={
                      phase === "RUNNING" ? () => setExpired(true) : undefined
                    }
                  />
                )}
                <span className="question-label">
                  {t("questionUpper")}{" "}
                  {snapshot.session.currentQuestionIndex + 1}
                </span>
                {isLastQuestion && (
                  <span className="double-points-badge">
                    <Zap />{" "}
                    {tr(
                      "Câu cuối • Nhân đôi điểm",
                      "Final question • Double points",
                    )}
                  </span>
                )}
                <h1>{snapshot.currentQuestion.prompt}</h1>
                {snapshot.session.state === "PAUSED" ? (
                  <div className="phase-banner paused">
                    <Pause />
                    <div>
                      <b>{tr("Trò chơi đang tạm dừng", "Game paused")}</b>
                      <span>
                        {tr(
                          "Host sẽ tiếp tục khi mọi người sẵn sàng.",
                          "The host will resume when everyone is ready.",
                        )}
                      </span>
                    </div>
                  </div>
                ) : phase === "QUESTION_PREVIEW" ? (
                  <div className="preview-content">
                    <div className="phase-banner">
                      <Clock3 />
                      <div>
                        <b>
                          {tr(
                            "Các đáp án đang xuất hiện",
                            "Answer choices are appearing",
                          )}
                        </b>
                        <span>
                          {tr(
                            "Quan sát kỹ — bạn có thể chọn khi đồng hồ trả lời bắt đầu.",
                            "Watch closely — you can choose when the answer timer starts.",
                          )}
                        </span>
                      </div>
                    </div>
                    {snapshot.currentQuestion.type !== "TEXT" && (
                      <div className="answer-grid preview-options">
                        {snapshot.currentQuestion.options.map(
                          (option, index) => (
                            <button
                              type="button"
                              disabled
                              className="answer-option preview-sequence"
                              style={{ animationDelay: `${index * 0.9}s` }}
                              key={option.id}
                            >
                              <span>
                                {["▲", "◆", "●", "■", "★", "⬟"][index]}
                              </span>
                              {option.text}
                            </button>
                          ),
                        )}
                      </div>
                    )}
                  </div>
                ) : snapshot.currentQuestion.type === "TEXT" ? (
                  <TextAnswer
                    key={snapshot.currentQuestion.id}
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
                          activeReveal &&
                            o.id === activeReveal.correctOptionId &&
                            "correct",
                          activeReveal &&
                            selected === o.id &&
                            o.id !== activeReveal.correctOptionId &&
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
                {result && phase === "RUNNING" && (
                  <div className="answer-result recorded">
                    <span>
                      <Check />
                    </span>
                    <div>
                      <b>{tr("Đã ghi nhận đáp án", "Answer recorded")}</b>
                      <p>
                        {tr(
                          "Chờ những người chơi còn lại…",
                          "Waiting for the other players…",
                        )}
                      </p>
                    </div>
                  </div>
                )}
                {result && phase === "QUESTION_RESULT" && activeReveal && (
                  <div
                    className={cx(
                      "answer-result",
                      selectedIsCorrect ? "correct" : "wrong",
                    )}
                  >
                    <span>{selectedIsCorrect ? "✓" : "×"}</span>
                    <div>
                      <b>{selectedIsCorrect ? t("correct") : t("incorrect")}</b>
                      <p>
                        {tr(
                          "Điểm và thứ hạng đã được cập nhật.",
                          "Your score and rank have been updated.",
                        )}
                      </p>
                    </div>
                  </div>
                )}
                {phase === "QUESTION_RESULT" && (
                  <>
                    {activeReveal && (
                      <div className="question-explanation">
                        <Check />
                        <div>
                          {snapshot.currentQuestion.type === "TEXT" &&
                            activeReveal.acceptedAnswers?.[0] && (
                              <b>
                                {t("correct")}:{" "}
                                {activeReveal.acceptedAnswers[0]}
                              </b>
                            )}
                          {activeReveal.explanation && (
                            <p>{activeReveal.explanation}</p>
                          )}
                        </div>
                      </div>
                    )}
                    <div className="waiting-host">{t("revealedWaiting")}</div>
                  </>
                )}
              </>
            )}
          </section>
          {phase === "QUESTION_RESULT" &&
            !snapshot.session.settings.hideLeaderboard && (
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
  const { t, tr } = usePreferences();
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
      <small>
        {tr(
          "Nhấn Enter để gửi ngay — không có bước xác nhận.",
          "Press Enter to submit instantly — no confirmation step.",
        )}
      </small>
    </form>
  );
}
function LobbyPlayer({ snapshot, meta }: { snapshot: Snapshot; meta: Player }) {
  const { t } = usePreferences();
  return (
    <div className="lobby-player">
      <div className="lobby-orbit">
        <div className="avatar-big">
          <PlayerAvatar value={meta.avatar} size={92} />
        </div>
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
            <b>{t("realtimeLeaderboard")}</b>
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
                <PlayerAvatar value={e.avatar} size={34} />
              </span>
              <span className="leader-name">
                <b>{e.nickname}</b>
                {e.team && <small>{e.team}</small>}
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
  const askConfirmation = useConfirmation();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [progress, setProgress] = useState({ answered: 0, playerCount: 0 });
  const [revealed, setRevealed] = useState<any>(null);
  const runWithoutLeavePrompt = useRoomLeaveGuard(
    Boolean(
      snapshot && !["ENDED", "CANCELLED"].includes(snapshot.session.state),
    ),
    tr(
      "Bạn đang quản lý một phòng chơi. Rời trang có thể làm gián đoạn quá trình điều khiển game. Bạn có chắc muốn rời đi?",
      "You are managing an active room. Leaving may interrupt game control. Are you sure you want to leave?",
    ),
  );
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
      name === "question:preview" ||
      name === "question:shown" ||
      name === "session:updated" ||
      name === "session:ended"
    ) {
      if (data?.session) setSnapshot(data);
      else void load();
      if (name === "question:preview" || name === "question:shown") {
        setRevealed(null);
        setProgress({ answered: 0, playerCount: data.playerCount || 0 });
      }
    }
    if (name === "host:progress") setProgress(data);
    if (name === "question:revealed") {
      if (data?.session) {
        setSnapshot(data);
        setRevealed(data.revealedQuestion);
      } else {
        setRevealed(data);
        void load();
      }
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
  async function pauseOrResume() {
    try {
      const action = snapshot?.session.state === "PAUSED" ? "resume" : "pause";
      await request(`/sessions/${id}/${action}`, { method: "POST", token });
    } catch (e) {
      toast.show((e as Error).message);
    }
  }
  async function skip() {
    if (
      !(await askConfirmation(
        tr("Bỏ qua câu hỏi hiện tại?", "Skip the current question?"),
        { title: tr("Bỏ qua câu hỏi", "Skip question") },
      ))
    )
      return;
    try {
      await request(`/sessions/${id}/skip`, { method: "POST", token });
    } catch (e) {
      toast.show((e as Error).message);
    }
  }
  async function end() {
    if (
      !(await askConfirmation(
        tr("Kết thúc game ngay bây giờ?", "End the game now?"),
        {
          title: tr("Kết thúc game", "End game"),
          tone: "danger",
        },
      ))
    )
      return;
    try {
      await request(`/sessions/${id}/end`, { method: "POST", token });
    } catch (error) {
      toast.show((error as Error).message);
    }
  }
  async function cancel() {
    if (
      !(await askConfirmation(tr("Hủy phòng chờ này?", "Cancel this lobby?"), {
        title: tr("Hủy phòng chờ", "Cancel lobby"),
        tone: "danger",
      }))
    )
      return;
    try {
      await request(`/sessions/${id}/cancel`, { method: "POST", token });
      runWithoutLeavePrompt(() => nav("/dashboard/reports"));
    } catch (error) {
      toast.show((error as Error).message);
    }
  }
  async function replay() {
    try {
      const session = await request<{ id: string }>(`/sessions/${id}/replay`, {
        method: "POST",
        token,
      });
      nav(`/host/${session.id}`);
    } catch (error) {
      toast.show((error as Error).message);
    }
  }
  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      toast.show(
        tr(
          "Trình duyệt không cho phép toàn màn hình.",
          "Fullscreen is not available.",
        ),
      );
    }
  }
  function testSound() {
    if (snapshot?.session.settings.mutePlayers) {
      toast.show(tr("Âm thanh người chơi đang tắt.", "Player sound is muted."));
      return;
    }
    const AudioContextClass =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 620;
    gain.gain.value = 0.05;
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.12);
  }
  const phase =
    snapshot.session.state === "PAUSED"
      ? snapshot.session.pausedState
      : snapshot.session.state;
  const activeReveal = revealed || snapshot.revealedQuestion;
  const isLastQuestion =
    snapshot.session.currentQuestionIndex ===
    snapshot.session.questionOrder.length - 1;
  return (
    <main className="host-page">
      <header className="host-bar">
        <Logo />
        <div>
          <span className="live-dot" />
          {tr("BẢNG ĐIỀU KHIỂN HOST", "HOST CONSOLE")}
        </div>
        <div className="host-bar-actions">
          <button
            className="icon-button"
            title={tr("Thử âm thanh", "Test sound")}
            onClick={testSound}
          >
            <Volume2 />
          </button>
          <button
            className="icon-button"
            title={tr("Toàn màn hình", "Fullscreen")}
            onClick={() => void toggleFullscreen()}
          >
            <Maximize2 />
          </button>
          <PreferenceControls compact />
          <button
            className="button button-ghost"
            onClick={() => nav("/")}
          >
            <X />
            {tr("Thoát", "Exit")}
          </button>
        </div>
      </header>
      {snapshot.session.state === "LOBBY" ? (
        <HostLobby
          snapshot={snapshot}
          onStart={start}
          onCancel={cancel}
          onRefresh={load}
        />
      ) : snapshot.session.state === "GAME_COUNTDOWN" ? (
        <StartCountdown startedAt={snapshot.session.questionStartedAt} />
      ) : snapshot.session.state === "CANCELLED" ? (
        <div className="host-final">
          <X />
          <h1>{tr("Phòng đã được hủy", "Lobby cancelled")}</h1>
          <button
            className="button button-secondary"
            onClick={() => nav("/")}
          >
            {tr("Về dashboard", "Back to dashboard")}
          </button>
        </div>
      ) : snapshot.session.state === "ENDED" ? (
        <HostFinal
          snapshot={snapshot}
          onReport={() => nav(`/report/${id}`)}
          onReplay={replay}
          onExit={() => nav("/")}
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
                {snapshot.session.state !== "PAUSED" && (
                  <Countdown
                    startedAt={snapshot.session.questionStartedAt}
                    seconds={
                      phase === "RUNNING"
                        ? snapshot.currentQuestion.timeLimitSec
                        : 5
                    }
                  />
                )}
                <span className="question-label">
                  {phase === "QUESTION_PREVIEW"
                    ? tr("5 GIÂY ĐỌC CÂU HỎI", "5-SECOND QUESTION PREVIEW")
                    : phase === "QUESTION_RESULT"
                      ? tr("BẢNG XẾP HẠNG", "LEADERBOARD BREAK")
                      : tr("CÂU HỎI HIỆN TẠI", "CURRENT QUESTION")}
                </span>
                {isLastQuestion && (
                  <span className="double-points-badge">
                    <Zap />{" "}
                    {tr(
                      "Câu cuối • Nhân đôi điểm",
                      "Final question • Double points",
                    )}
                  </span>
                )}
                <h1>{snapshot.currentQuestion.prompt}</h1>
                {snapshot.session.state === "PAUSED" && (
                  <div className="phase-banner paused">
                    <Pause />
                    <div>
                      <b>{tr("Trò chơi đang tạm dừng", "Game paused")}</b>
                      <span>
                        {tr(
                          "Đồng hồ đã được giữ nguyên.",
                          "The timer is frozen.",
                        )}
                      </span>
                    </div>
                  </div>
                )}
                {phase === "QUESTION_PREVIEW" &&
                  snapshot.session.state !== "PAUSED" && (
                    <div className="phase-banner">
                      <Clock3 />
                      <div>
                        <b>
                          {tr(
                            "Người chơi đang đọc câu hỏi",
                            "Players are reading the question",
                          )}
                        </b>
                        <span>
                          {tr(
                            "Các lựa chọn đang xuất hiện lần lượt trong 5 giây.",
                            "Answer choices are appearing one by one over 5 seconds.",
                          )}
                        </span>
                      </div>
                    </div>
                  )}
                <div className="host-options">
                  {snapshot.currentQuestion.options.map((o, i) => (
                    <div
                      className={cx(
                        phase === "QUESTION_PREVIEW" && "preview-sequence",
                        activeReveal &&
                          o.id === activeReveal.correctOptionId &&
                          "correct",
                      )}
                      style={
                        phase === "QUESTION_PREVIEW"
                          ? { animationDelay: `${i * 0.9}s` }
                          : undefined
                      }
                      key={o.id}
                    >
                      <span>{["▲", "◆", "●", "■", "★", "⬟"][i]}</span>
                      {o.text}
                      {activeReveal &&
                        o.id === activeReveal.correctOptionId && <Check />}
                    </div>
                  ))}
                </div>
                {activeReveal?.explanation && (
                  <div className="question-explanation">
                    <CircleHelp /> <p>{activeReveal.explanation}</p>
                  </div>
                )}
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
            {phase === "QUESTION_RESULT" ? (
              <>
                <Leaderboard entries={snapshot.leaderboard} />
                {snapshot.session.settings.teamMode && (
                  <TeamLeaderboard entries={snapshot.teamLeaderboard} />
                )}
              </>
            ) : (
              <div className="host-phase-card">
                <Radio />
                <span>
                  <b>
                    {snapshot.session.state === "PAUSED"
                      ? tr("Đang tạm dừng", "Paused")
                      : phase === "QUESTION_PREVIEW"
                        ? tr("Đang chuẩn bị", "Previewing question")
                        : tr("Đang nhận đáp án", "Accepting answers")}
                  </b>
                  <small>
                    {tr(
                      "Bảng xếp hạng sẽ xuất hiện sau khi đóng câu hỏi.",
                      "The leaderboard appears after the question closes.",
                    )}
                  </small>
                </span>
              </div>
            )}
            <div className="host-buttons">
              <button
                className="button button-primary button-lg button-block"
                onClick={() => void pauseOrResume()}
              >
                {snapshot.session.state === "PAUSED" ? (
                  <>
                    <Play /> {tr("Tiếp tục", "Resume")}
                  </>
                ) : (
                  <>
                    <Pause /> {tr("Tạm dừng", "Pause")}
                  </>
                )}
              </button>
              <button
                className="button button-secondary button-block"
                onClick={() => void skip()}
              >
                <SkipForward /> {tr("Bỏ qua câu hỏi", "Skip question")}
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
      key: "mutePlayers",
      title: tr("Tắt âm thiết bị", "Mute player devices"),
      text: tr(
        "Thiết lập trải nghiệm im lặng cho thiết bị người chơi.",
        "Keep player devices silent.",
      ),
      icon: <Volume2 />,
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
  onCancel,
  onRefresh,
}: {
  snapshot: Snapshot;
  onStart: () => void;
  onCancel: () => void;
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
  const roomPrivacyKey = `rr_room_privacy_${snapshot.session.id}`;
  const [roomInfoHidden, setRoomInfoHidden] = useState(
    () => localStorage.getItem(roomPrivacyKey) === "hidden",
  );
  const toggleRoomPrivacy = () => {
    setRoomInfoHidden((hidden) => {
      const next = !hidden;
      localStorage.setItem(roomPrivacyKey, next ? "hidden" : "visible");
      return next;
    });
  };
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
    try {
      await request(`/sessions/${snapshot.session.id}/kick/${pid}`, {
        method: "POST",
        token: hostToken(),
      });
      onRefresh();
    } catch (error) {
      toast.show((error as Error).message);
    }
  }
  return (
    <div className="host-lobby">
      <section className="lobby-share">
        <div className="lobby-share-heading">
          <span className="eyebrow">
            <Radio size={16} /> {tr("Lobby đang mở", "Lobby is open")}
          </span>
          <button
            type="button"
            className={cx("room-privacy-toggle", roomInfoHidden && "active")}
            onClick={toggleRoomPrivacy}
            title={tr(
              roomInfoHidden ? "Hiện thông tin phòng" : "Ẩn thông tin phòng",
              roomInfoHidden
                ? "Show room information"
                : "Hide room information",
            )}
          >
            {roomInfoHidden ? <Eye /> : <EyeOff />}
            {tr(
              roomInfoHidden ? "Hiện thông tin" : "Ẩn thông tin",
              roomInfoHidden ? "Show info" : "Hide info",
            )}
          </button>
        </div>
        <h1>{snapshot.quiz.title}</h1>
        {roomInfoHidden ? (
          <div className="room-private-cover">
            <div className="room-private-icon">
              <ShieldCheck />
            </div>
            <h2>
              {tr("Thông tin phòng đã được ẩn", "Room information is hidden")}
            </h2>
            <p>
              {tr(
                "PIN, mã QR và đường dẫn tham gia đang được bảo vệ khỏi người không mong muốn.",
                "The PIN, QR code, and join link are protected from unwanted viewers.",
              )}
            </p>
            <div className="masked-room-pin">••• •••</div>
            <button
              type="button"
              className="button button-secondary button-block"
              onClick={toggleRoomPrivacy}
            >
              <Eye /> {tr("Hiện lại thông tin phòng", "Show room information")}
            </button>
          </div>
        ) : (
          <>
            <p>
              {tr("Người chơi vào tại", "Players join at")}{" "}
              <b>{joinOrigin.replace(/^https?:\/\//, "")}</b>
            </p>
            <div className="pin-display">
              <span>{tr("MÃ PIN", "GAME PIN")}</span>
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
          </>
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
        <button
          type="button"
          className="button button-danger"
          onClick={onCancel}
        >
          <X /> {tr("Hủy phòng", "Cancel lobby")}
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
              className={cx("player-bubble", !p.online && "offline")}
              style={{ animationDelay: `${i * 40}ms` }}
              key={p.id}
            >
              <PlayerAvatar value={p.avatar} size={42} />
              <b>{p.nickname}</b>
              {p.team && <small>{p.team}</small>}
              {!p.online && <small>{tr("Mất kết nối", "Disconnected")}</small>}
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
  onReplay,
  onExit,
}: {
  snapshot: Snapshot;
  onReport: () => void;
  onReplay: () => void;
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
              <PlayerAvatar value={e.avatar} size={72} />
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
        <button
          className="button button-secondary button-lg"
          onClick={onReplay}
        >
          <Play /> {tr("Chơi lại", "Play again")}
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
  const [error, setError] = useState("");
  useEffect(() => {
    if (token)
      request(`/sessions/${id}/report`, { token })
        .then(setReport)
        .catch((reason) => setError((reason as Error).message));
  }, [id]);
  if (!token) return <Navigate to="/login" />;
  if (error)
    return (
      <Page>
        <Empty
          icon={<BarChart3 />}
          title={tr("Không thể mở báo cáo", "Could not open report")}
          text={error}
          action={
            <Link className="button button-secondary" to="/dashboard/reports">
              <ArrowLeft /> {tr("Danh sách báo cáo", "Report list")}
            </Link>
          }
        />
      </Page>
    );
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
      [],
      [
        tr("Câu hỏi", "Question"),
        tr("Lượt trả lời", "Answers"),
        tr("Số câu đúng", "Correct answers"),
        tr("Độ chính xác", "Accuracy"),
      ],
      ...report.questions.map((question: any) => [
        question.prompt,
        question.answers,
        question.correct,
        `${question.accuracy}%`,
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
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = `rankrush-${id}-report.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <Page>
      <div className="report-page">
        <button className="text-button back" onClick={() => nav("/")}>
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
                        <PlayerAvatar value={p.avatar} size={34} />
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
    correctAnswer: string;
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
            {contentLabel(data.quiz.subcategory || data.quiz.category, tr)}.
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
        correctAnswer: string;
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
            <span>
              {contentLabel(data.quiz.subcategory || data.quiz.category, tr)}
            </span>
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
                  {!result.correct && result.correctAnswer && (
                    <strong>
                      {tr("Đáp án đúng", "Correct answer")}:{" "}
                      {result.correctAnswer}
                    </strong>
                  )}
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
  const [error, setError] = useState("");
  const [data, setData] = useState<{
    quiz: Quiz;
    questions: Question[];
  } | null>(null);
  useEffect(() => {
    request<{ quiz: Quiz; questions: Question[] }>(`/quizzes/${id}`, {
      token: hostToken(),
    })
      .then(setData)
      .catch((reason) => setError((reason as Error).message));
  }, [id]);
  async function hostNow() {
    const token = hostToken();
    if (!token) {
      sessionStorage.setItem("rr_pending_host_quiz", id);
      nav("/login");
      return;
    }
    try {
      const room = await createHostRoom(id, token);
      nav(`/host/${room.id}`);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  if (!data && error)
    return (
      <Page>
        <Empty
          icon={<BookOpen />}
          title={tr("Không thể mở quiz", "Could not open quiz")}
          text={error}
          action={
            <Link className="button button-secondary" to="/">
              <ArrowLeft /> {tr("Về thư viện", "Back to library")}
            </Link>
          }
        />
      </Page>
    );
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
          style={{ background: displayCoverColor(data.quiz.coverColor) }}
        >
          <BookOpen />
          <span>{contentLabel(data.quiz.category, tr)}</span>
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
            <button
              className="button button-primary button-lg"
              onClick={() => void hostNow()}
            >
              <Play /> {tr("Chơi ngay", "Play now")}
            </button>
            <Link
              className="button button-secondary button-lg"
              to={`/practice/${data.quiz.id}`}
            >
              <Target /> {tr("Luyện tập một mình", "Practice solo")}
            </Link>
          </div>
          <ErrorBox error={error} />
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
    <ConfirmationProvider>
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
        <Route path="/admin/*" element={<AdminPage />} />
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
    </ConfirmationProvider>
  );
}
