import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Activity,
  Archive,
  Ban,
  Bot,
  CheckCircle2,
  Clock3,
  Database,
  Download,
  ExternalLink,
  FileQuestion,
  Globe2,
  Home,
  LogOut,
  Monitor,
  Moon,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
  Shield,
  Sun,
  Trash2,
  UserCog,
  Users,
  X,
  Zap,
  KeyRound,
  Eye,
  EyeOff,
  UserPlus,
} from "lucide-react";
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
  useBlocker,
} from "react-router-dom";
import { hostToken, request } from "./api";
import { usePreferences } from "./preferences";

type StoredUser = {
  id?: string;
  username?: string;
  email?: string;
  displayName?: string;
  role?: "HOST" | "ADMIN";
};

type AdminUser = Required<
  Pick<StoredUser, "id" | "username" | "email" | "displayName" | "role">
> & {
  status: "ACTIVE" | "SUSPENDED";
  createdAt: string;
  quizCount?: number;
  sessionCount?: number;
};

type AdminSession = {
  id: string;
  pin: string;
  state: string;
  createdAt: string;
  startedAt: string;
  endedAt: string;
  playerCount: number;
  quiz: { id: string; title: string; category: string } | null;
  host: {
    id: string;
    displayName: string;
    username: string;
    email: string;
  } | null;
};

type OverviewData = {
  stats: {
    users: number;
    admins: number;
    quizzes: number;
    publicQuizzes: number;
    questions: number;
    sessions: number;
    activeSessions: number;
    players: number;
    answers: number;
  };
  recentUsers: AdminUser[];
  recentSessions: AdminSession[];
};

type ActivityRow = {
  id: string;
  scope: "ADMIN" | "SESSION";
  sessionId: string;
  type: string;
  at: string;
  details: Record<string, string>;
};

type SystemData = {
  redis: {
    version: string;
    mode: string;
    uptimeSeconds: number;
    usedMemory: string;
    peakMemory: string;
    connectedClients: number;
    totalCommands: number;
  };
  namespace: string;
  namespaceKeys: number;
  totalDatabaseKeys: number;
  typeCounts: Record<string, number>;
  checkedAt: string;
};

type BackupSummary = {
  id: string;
  label: string;
  reason: "MANUAL" | "PRE_RESTORE";
  createdAt: string;
  namespace: string;
  appVersion: string;
  keyCount: number;
  sizeBytes: number;
  checksum: string;
};

type Confirmation = {
  title: string;
  message: string;
  confirmLabel: string;
  tone?: "danger" | "primary";
  run: () => Promise<void>;
};

type GeneratedQuizResult = {
  quiz: { id: string; title: string };
  questionCount: number;
  provider: string;
  model: string;
  warning?: string;
};

const readStoredUser = (): StoredUser => {
  try {
    return JSON.parse(localStorage.getItem("rr_user") || "{}");
  } catch {
    return {};
  }
};

function Pagination({
  page,
  total,
  onPageChange,
  tr,
}: {
  page: number;
  total: number;
  onPageChange: (p: number) => void;
  tr: (vi: string, en: string) => string;
}) {
  if (total <= 1) return null;
  return (
    <div className="admin-pagination">
      <button onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
        {tr("Trước", "Prev")}
      </button>
      <span>
        {tr("Trang", "Page")} {page} / {total}
      </span>
      <button onClick={() => onPageChange(page + 1)} disabled={page >= total}>
        {tr("Sau", "Next")}
      </button>
    </div>
  );
}

const dateTime = (value: string, locale: "vi" | "en") =>
  value
    ? new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(value))
    : "—";

const sessionLabel = (state: string, tr: (vi: string, en: string) => string) =>
  ({
    LOBBY: tr("Đang chờ", "Lobby"),
    GAME_COUNTDOWN: tr("Đếm ngược", "Countdown"),
    QUESTION_PREVIEW: tr("Xem câu hỏi", "Question preview"),
    RUNNING: tr("Đang chơi", "Running"),
    QUESTION_RESULT: tr("Kết quả câu", "Question result"),
    PAUSED: tr("Tạm dừng", "Paused"),
    ENDED: tr("Đã kết thúc", "Ended"),
    CANCELLED: tr("Đã hủy", "Cancelled"),
  })[state] || state;

function useAdminData<T>(path: string, refresh: number) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void request<T>(path, { token: hostToken() })
      .then((result) => active && setData(result))
      .catch((reason) => active && setError((reason as Error).message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [path, refresh]);
  return { data, setData, loading, error };
}

function AdminLoading() {
  const { tr } = usePreferences();
  return (
    <div
      className="admin-loading"
      role="status"
      aria-label={tr("Đang tải dữ liệu quản trị", "Loading admin data")}
    >
      <div className="admin-loading-heading">
        <span>
          <RefreshCw />
        </span>
        <div>
          <b>{tr("Đang đồng bộ dữ liệu", "Syncing data")}</b>
          <small>
            {tr(
              "RankRush đang đọc trạng thái dữ liệu mới nhất.",
              "RankRush is loading the latest data status.",
            )}
          </small>
        </div>
      </div>
      <div className="admin-skeleton-grid" aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <span key={index}>
            <i />
            <i />
            <i />
          </span>
        ))}
      </div>
    </div>
  );
}

function AdminError({ message }: { message: string }) {
  return message ? <div className="admin-error">{message}</div> : null;
}

function AdminPasswordResetModal({
  user,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  user: AdminUser | null;
  busy: boolean;
  error: string;
  onClose: () => void;
  onConfirm: (password: string) => Promise<void>;
}) {
  const { tr } = usePreferences();
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);

  if (!user) return null;

  return (
    <div className="admin-modal-backdrop" role="presentation">
      <div className="admin-modal" role="dialog" aria-modal="true">
        <button className="admin-modal-close" onClick={onClose} disabled={busy}>
          <X />
        </button>
        <div className="admin-modal-icon">
          <KeyRound />
        </div>
        <h2 style={{ textAlign: "center" }}>
          {tr("Đặt lại mật khẩu", "Reset Password")}
        </h2>
        <p style={{ textAlign: "center", margin: "10px 0 0" }}>
          {tr(
            `Đổi mật khẩu cho ${user.displayName}.`,
            `Change password for ${user.displayName}.`,
          )}
        </p>
        <div className="admin-modal-form">
          <label>
            {tr("Mật khẩu mới", "New Password")}
            <div className="admin-password-wrapper">
              <input
                type={show ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={tr("Nhập mật khẩu...", "Enter password...")}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShow(!show)}
                title={tr("Hiện/ẩn mật khẩu", "Show/hide password")}
              >
                {show ? <EyeOff /> : <Eye />}
              </button>
            </div>
          </label>
        </div>
        <div className="admin-modal-actions">
          <button
            className="admin-button secondary"
            onClick={() => {
              const random = Math.random().toString(36).slice(-8);
              setPassword(random);
              setShow(true);
            }}
            disabled={busy}
          >
            <Zap />
            {tr("Tạo ngẫu nhiên", "Generate random")}
          </button>
          <button
            className="admin-button primary"
            onClick={() =>
              onConfirm(password.trim() || Math.random().toString(36).slice(-8))
            }
            disabled={busy}
          >
            {busy ? <RefreshCw className="spin" /> : <CheckCircle2 />}
            {busy
              ? tr("Đang cập nhật...", "Updating...")
              : tr("Xác nhận", "Confirm")}
          </button>
        </div>
        {error && (
          <div className="admin-form-alert" role="alert">
            <Ban />
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function AdminCreateUserModal({
  open,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  open: boolean;
  busy: boolean;
  error: string;
  onClose: () => void;
  onConfirm: (data: any) => Promise<void>;
}) {
  const { tr } = usePreferences();
  const [form, setForm] = useState({
    displayName: "",
    username: "",
    email: "",
    password: "",
    role: "HOST",
  });
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({
      displayName: "",
      username: "",
      email: "",
      password: "",
      role: "HOST",
    });
    setShow(false);
  }, [open]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const suffix = `${Date.now().toString(36).slice(-4)}${Math.random()
      .toString(36)
      .slice(2, 5)}`;
    void onConfirm({
      ...form,
      displayName:
        form.displayName.trim() || `${tr("Người dùng", "User")} ${suffix}`,
      username: form.username.trim().toLowerCase() || `user_${suffix}`,
      password: form.password.trim() || Math.random().toString(36).slice(-8),
    });
  };

  return (
    <div className="admin-modal-backdrop" role="presentation">
      <div
        className="admin-modal"
        role="dialog"
        aria-modal="true"
        style={{ width: "min(480px, 100%)" }}
      >
        <button className="admin-modal-close" onClick={onClose} disabled={busy}>
          <X />
        </button>
        <div className="admin-modal-icon">
          <UserPlus />
        </div>
        <h2 style={{ textAlign: "center" }}>
          {tr("Thêm tài khoản mới", "Add new account")}
        </h2>
        <p className="admin-modal-description">
          {tr(
            "Chỉ email là bắt buộc. Hệ thống có thể tự tạo tên và mật khẩu.",
            "Only email is required. Names and password can be generated automatically.",
          )}
        </p>
        <form onSubmit={handleSubmit} className="admin-modal-form">
          <label>
            <span className="admin-field-label">
              {tr("Tên hiển thị", "Display name")}
              <small>{tr("Tùy chọn", "Optional")}</small>
            </span>
            <input
              value={form.displayName}
              onChange={(e) =>
                setForm({ ...form, displayName: e.target.value })
              }
              placeholder={tr(
                "Để trống để hệ thống tự tạo",
                "Leave blank to generate automatically",
              )}
              autoFocus
            />
          </label>
          <label>
            <span className="admin-field-label">
              {tr("Tên đăng nhập", "Username")}
              <small>{tr("Tùy chọn", "Optional")}</small>
            </span>
            <input
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              placeholder={tr(
                "Để trống để hệ thống tự tạo",
                "Leave blank to generate automatically",
              )}
              autoCapitalize="none"
              autoCorrect="off"
            />
          </label>
          <label>
            <span className="admin-field-label">
              {tr("Địa chỉ email", "Email address")}
              <small>{tr("Bắt buộc", "Required")}</small>
            </span>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="user@example.com"
            />
          </label>
          <label>
            <span className="admin-field-label">
              {tr("Mật khẩu", "Password")}
              <small>{tr("Tùy chọn", "Optional")}</small>
            </span>
            <div className="admin-password-wrapper">
              <input
                type={show ? "text" : "password"}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder={tr("Để trống = ngẫu nhiên", "Blank = random")}
              />
              <button
                type="button"
                onClick={() => setShow(!show)}
                title={tr("Hiện/ẩn mật khẩu", "Show/hide password")}
              >
                {show ? <EyeOff /> : <Eye />}
              </button>
            </div>
          </label>
          <label>
            <span className="admin-field-label">{tr("Vai trò", "Role")}</span>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              <option value="HOST">Host</option>
              <option value="ADMIN">Admin</option>
            </select>
          </label>
          {error && (
            <div className="admin-form-alert" role="alert">
              <Ban />
              <span>{error}</span>
            </div>
          )}
          <div className="admin-modal-actions" style={{ marginTop: "10px" }}>
            <button
              type="button"
              className="admin-button secondary"
              onClick={onClose}
              disabled={busy}
            >
              {tr("Hủy", "Cancel")}
            </button>
            <button
              type="submit"
              className="admin-button primary"
              disabled={busy}
            >
              {busy ? <RefreshCw className="spin" /> : <CheckCircle2 />}
              {busy
                ? tr("Đang tạo...", "Creating...")
                : tr("Tạo tài khoản", "Create account")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AdminConfirm({
  value,
  busy,
  onClose,
}: {
  value: Confirmation | null;
  busy: boolean;
  onClose: () => void;
}) {
  const { tr } = usePreferences();
  if (!value) return null;
  return (
    <div className="admin-modal-backdrop" role="presentation">
      <div className="admin-modal" role="dialog" aria-modal="true">
        <button className="admin-modal-close" onClick={onClose} disabled={busy}>
          <X />
        </button>
        <div className={`admin-modal-icon ${value.tone || "primary"}`}>
          {value.tone === "danger" ? <Ban /> : <Shield />}
        </div>
        <h2>{value.title}</h2>
        <p>{value.message}</p>
        <div className="admin-modal-actions">
          <button
            className="admin-button secondary"
            onClick={onClose}
            disabled={busy}
          >
            {tr("Không", "No")}
          </button>
          <button
            className={`admin-button ${value.tone === "danger" ? "danger" : "primary"}`}
            disabled={busy}
            onClick={() => void value.run()}
          >
            {busy ? tr("Đang xử lý...", "Working...") : value.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminAppearance() {
  const { locale, setLocale, theme, toggleTheme, t } = usePreferences();
  return (
    <div className="admin-preferences">
      <label className="admin-language-control" title={t("language")}>
        <Globe2 />
        <select
          value={locale}
          onChange={(event) => setLocale(event.target.value as "vi" | "en")}
          aria-label={t("language")}
        >
          <option value="vi">Tiếng Việt</option>
          <option value="en">English</option>
        </select>
      </label>
      <button
        type="button"
        className="admin-theme-toggle"
        title={t("appearance")}
        onClick={toggleTheme}
        aria-label={t("appearance")}
      >
        {theme === "dark" ? <Moon /> : <Sun />}
      </button>
    </div>
  );
}

function AdminBrand() {
  return (
    <Link to="/admin" className="admin-brand">
      <span>
        <img src="/brand/rankrush-r2.png" alt="R²" />
      </span>
      <b>
        RankRush<small>ADMIN CONSOLE</small>
      </b>
    </Link>
  );
}

function AdminSidebar({ active, user }: { active: string; user: StoredUser }) {
  const { tr, t } = usePreferences();
  const navigate = useNavigate();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const item = (
    key: string,
    to: string,
    icon: ReactNode,
    vi: string,
    en: string,
  ) => (
    <Link className={active === key ? "active" : ""} to={to}>
      {icon}
      <span>{tr(vi, en)}</span>
    </Link>
  );
  return (
    <aside className="admin-sidebar">
      <AdminBrand />
      <nav>
        {item("overview", "/admin", <Home />, "Tổng quan", "Overview")}
        {item("users", "/admin/users", <Users />, "Người dùng", "Users")}
        {item(
          "sessions",
          "/admin/sessions",
          <Play />,
          "Phòng chơi",
          "Game rooms",
        )}
        {item(
          "activity",
          "/admin/activity",
          <Activity />,
          "Nhật ký hoạt động",
          "Activity log",
        )}
        {item(
          "system",
          "/admin/system",
          <Database />,
          "Dữ liệu hệ thống",
          "System data",
        )}
        <small>{tr("CÔNG CỤ", "TOOLS")}</small>
        {item(
          "assistant",
          "/admin/assistant",
          <Bot />,
          "Trợ lý tạo câu hỏi",
          "Question assistant",
        )}
      </nav>
      <div className="admin-sidebar-user">
        <span>{(user.displayName || "A")[0]?.toUpperCase()}</span>
        <div>
          <b>{user.displayName || "Admin"}</b>
          <small>
            @{user.username || "admin"} · {tr("Quản trị viên", "Administrator")}
          </small>
        </div>
        <button
          title={tr("Đăng xuất", "Log out")}
          onClick={() => setShowLogoutConfirm(true)}
        >
          <LogOut />
        </button>
      </div>
      {showLogoutConfirm && (
        <div
          className="confirm-backdrop"
          style={{ position: "fixed", zIndex: 9999 }}
          onClick={() => setShowLogoutConfirm(false)}
        >
          <section
            className="confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="confirm-dialog-heading">
              <span className="confirm-dialog-icon">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </span>
              <div>
                <span className="eyebrow">
                  {tr("X\u00e1c nh\u1eadn", "Confirmation")}
                </span>
                <h2>{tr("Đăng xuất?", "Log out?")}</h2>
              </div>
            </div>
            <p>
              {tr(
                "Bạn có chắc muốn đăng xuất khỏi tài khoản quản trị?",
                "Are you sure you want to log out of the admin account?",
              )}
            </p>
            <div className="confirm-dialog-actions">
              <button
                className="button button-secondary"
                onClick={() => setShowLogoutConfirm(false)}
              >
                {tr("Kh\u00f4ng", "No")}
              </button>
              <button
                className="button button-danger"
                onClick={() => {
                  setShowLogoutConfirm(false);
                  localStorage.removeItem("rr_host_token");
                  localStorage.removeItem("rr_user");
                  navigate("/login");
                }}
              >
                {tr("C\u00f3", "Yes")}
              </button>
            </div>
          </section>
        </div>
      )}
    </aside>
  );
}

function AdminOverview({ refresh }: { refresh: number }) {
  const { tr, locale } = usePreferences();
  const { data, loading, error } = useAdminData<OverviewData>(
    "/admin/overview",
    refresh,
  );
  if (loading && !data) return <AdminLoading />;
  if (!data) return <AdminError message={error} />;
  const cards = [
    [
      <Users />,
      data.stats.users,
      tr("Người dùng", "Users"),
      `${data.stats.admins} Admin`,
    ],
    [
      <Play />,
      data.stats.activeSessions,
      tr("Phòng đang hoạt động", "Active rooms"),
      `${data.stats.sessions} ${tr("tổng phiên", "total")}`,
    ],
    [
      <FileQuestion />,
      data.stats.questions,
      tr("Câu hỏi", "Questions"),
      `${data.stats.quizzes} quiz`,
    ],
    [
      <Zap />,
      data.stats.answers,
      tr("Lượt trả lời", "Answers"),
      `${data.stats.players} ${tr("người chơi", "players")}`,
    ],
  ] as const;
  return (
    <>
      <AdminError message={error} />
      <section className="admin-stats">
        {cards.map(([icon, value, label, note]) => (
          <article key={label}>
            <span>{icon}</span>
            <div>
              <b>{value.toLocaleString()}</b>
              <strong>{label}</strong>
              <small>{note}</small>
            </div>
          </article>
        ))}
      </section>
      <div className="admin-overview-grid">
        <section className="admin-panel">
          <div className="admin-panel-head">
            <div>
              <h2>{tr("Người dùng mới", "Recent users")}</h2>
              <p>
                {tr(
                  "Tài khoản đăng ký gần đây",
                  "Recently registered accounts",
                )}
              </p>
            </div>
            <Link to="/admin/users">{tr("Xem tất cả", "View all")}</Link>
          </div>
          <div className="admin-list">
            {data.recentUsers.map((user) => (
              <div key={user.id} className="admin-list-row">
                <span className="admin-avatar">
                  {user.displayName[0]?.toUpperCase()}
                </span>
                <div>
                  <b>{user.displayName}</b>
                  <small>{user.email}</small>
                </div>
                <span className={`admin-badge ${user.role.toLowerCase()}`}>
                  {user.role}
                </span>
                <time>{dateTime(user.createdAt, locale)}</time>
              </div>
            ))}
          </div>
        </section>
        <section className="admin-panel">
          <div className="admin-panel-head">
            <div>
              <h2>{tr("Phòng gần đây", "Recent rooms")}</h2>
              <p>
                {tr(
                  "Trạng thái phiên chơi trực tiếp",
                  "Live game session status",
                )}
              </p>
            </div>
            <Link to="/admin/sessions">{tr("Xem tất cả", "View all")}</Link>
          </div>
          <div className="admin-list">
            {data.recentSessions.map((session) => (
              <div key={session.id} className="admin-list-row room">
                <span
                  className={`admin-room-dot ${session.state.toLowerCase()}`}
                />
                <div>
                  <b>
                    {session.quiz?.title || tr("Quiz đã xóa", "Deleted quiz")}
                  </b>
                  <small>
                    PIN {session.pin} · {session.host?.displayName || "—"}
                  </small>
                </div>
                <span
                  className={`admin-badge state ${session.state.toLowerCase()}`}
                >
                  {sessionLabel(session.state, tr)}
                </span>
                <time>
                  {session.playerCount} {tr("người", "players")}
                </time>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

function AdminUsers({ refresh }: { refresh: number }) {
  const { tr, locale } = usePreferences();
  const currentUser = readStoredUser();
  const { data, setData, loading, error } = useAdminData<AdminUser[]>(
    "/admin/users",
    refresh,
  );
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<"ALL" | "HOST" | "ADMIN">("ALL");
  const [status, setStatus] = useState<"ALL" | "ACTIVE" | "SUSPENDED">("ALL");
  const [revealedUsers, setRevealedUsers] = useState<Set<string>>(
    () => new Set(),
  );
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);
  const [resetUser, setResetUser] = useState<AdminUser | null>(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [createError, setCreateError] = useState("");
  const [resetError, setResetError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => setPage(1), [query, role, status]);

  const visible = useMemo(
    () =>
      (data || []).filter((user) => {
        const text =
          `${user.displayName} ${user.username} ${user.email}`.toLocaleLowerCase(
            "vi-VN",
          );
        return (
          (role === "ALL" || user.role === role) &&
          (status === "ALL" || user.status === status) &&
          text.includes(query.trim().toLocaleLowerCase("vi-VN"))
        );
      }),
    [data, query, role, status],
  );
  const update = async (
    user: AdminUser,
    patch: Partial<Pick<AdminUser, "role" | "status">>,
  ) => {
    setBusy(true);
    try {
      const updated = await request<AdminUser>(`/admin/users/${user.id}`, {
        method: "PATCH",
        token: hostToken(),
        body: JSON.stringify(patch),
      });
      setData((rows) =>
        (rows || []).map((row) =>
          row.id === user.id ? { ...row, ...updated } : row,
        ),
      );
      setConfirmation(null);
    } finally {
      setBusy(false);
    }
  };
  const createUser = async (payload: any) => {
    setBusy(true);
    setCreateError("");
    setNotice("");
    try {
      const newUser = await request<AdminUser>(`/admin/users`, {
        method: "POST",
        token: hostToken(),
        body: JSON.stringify(payload),
      });
      setData((rows) => [newUser, ...(rows || [])]);
      setShowAddUser(false);
      setNotice(
        tr(
          `Đã tạo tài khoản @${newUser.username}.`,
          `Created account @${newUser.username}.`,
        ),
      );
    } catch (reason) {
      setCreateError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const executePasswordReset = async (newPassword: string) => {
    if (!resetUser) return;
    setBusy(true);
    setResetError("");
    setNotice("");
    try {
      await request(`/admin/users/${resetUser.id}/reset-password`, {
        method: "PUT",
        token: hostToken(),
        body: JSON.stringify({ newPassword }),
      });

      setNotice(
        tr(
          `Đã cập nhật mật khẩu cho ${resetUser.displayName}.`,
          `Updated the password for ${resetUser.displayName}.`,
        ),
      );
      setResetUser(null);
    } catch (reason) {
      setResetError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const totalPages = Math.ceil(visible.length / 10);
  const pagedVisible = visible.slice((page - 1) * 10, page * 10);

  return (
    <section className="admin-panel admin-table-panel">
      <AdminError message={error} />
      {notice && (
        <div className="admin-success admin-user-notice" role="status">
          <CheckCircle2 />
          {notice}
        </div>
      )}
      <div className="admin-toolbar">
        <label className="admin-search">
          <Search />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={tr(
              "Tìm tên, username hoặc email...",
              "Search name, username or email...",
            )}
          />
        </label>
        <select
          className="admin-filter-select"
          value={role}
          onChange={(event) => setRole(event.target.value as typeof role)}
          aria-label={tr("Lọc theo vai trò", "Filter by role")}
        >
          <option value="ALL">{tr("Tất cả vai trò", "All roles")}</option>
          <option value="HOST">Host</option>
          <option value="ADMIN">Admin</option>
        </select>
        <select
          className="admin-filter-select"
          value={status}
          onChange={(event) => setStatus(event.target.value as typeof status)}
          aria-label={tr("Lọc theo trạng thái", "Filter by status")}
        >
          <option value="ALL">{tr("Tất cả trạng thái", "All statuses")}</option>
          <option value="ACTIVE">{tr("Hoạt động", "Active")}</option>
          <option value="SUSPENDED">{tr("Tạm khóa", "Suspended")}</option>
        </select>
        <button
          className="admin-button"
          onClick={() => {
            setCreateError("");
            setNotice("");
            setShowAddUser(true);
          }}
          style={{ whiteSpace: "nowrap" }}
        >
          <UserPlus />
          {tr("Thêm tài khoản", "Add user")}
        </button>
      </div>
      {loading && !data ? (
        <AdminLoading />
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{tr("Người dùng", "User")}</th>
                <th>{tr("Thông tin đăng nhập", "Login information")}</th>
                <th>{tr("Vai trò", "Role")}</th>
                <th>{tr("Dữ liệu", "Data")}</th>
                <th>{tr("Ngày tạo", "Created")}</th>
                <th>{tr("Trạng thái", "Status")}</th>
                <th>{tr("Thao tác", "Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {pagedVisible.map((user) => (
                <tr key={user.id}>
                  <td>
                    <div className="admin-user-cell">
                      <span className="admin-avatar">
                        {user.displayName[0]?.toUpperCase()}
                      </span>
                      <div>
                        <b>{user.displayName}</b>
                        <small>#{user.id}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="admin-sensitive-cell">
                      <div>
                        <small>
                          {tr("Tên tài khoản", "Username")}:{" "}
                          <b>
                            {revealedUsers.has(user.id)
                              ? `@${user.username}`
                              : "••••••••"}
                          </b>
                        </small>
                        <small>
                          Email:{" "}
                          <b>
                            {revealedUsers.has(user.id)
                              ? user.email
                              : "••••••••"}
                          </b>
                        </small>
                        <small>
                          {tr("Mật khẩu", "Password")}:{" "}
                          <b>
                            {revealedUsers.has(user.id)
                              ? tr("Đã mã hóa", "Encrypted")
                              : "••••••••"}
                          </b>
                        </small>
                      </div>
                      <button
                        type="button"
                        className="admin-visibility-toggle"
                        title={
                          revealedUsers.has(user.id)
                            ? tr("Ẩn thông tin", "Hide information")
                            : tr("Hiện thông tin", "Show information")
                        }
                        onClick={() =>
                          setRevealedUsers((current) => {
                            const next = new Set(current);
                            if (next.has(user.id)) next.delete(user.id);
                            else next.add(user.id);
                            return next;
                          })
                        }
                      >
                        {revealedUsers.has(user.id) ? <EyeOff /> : <Eye />}
                      </button>
                    </div>
                  </td>
                  <td>
                    <span className={`admin-badge ${user.role.toLowerCase()}`}>
                      {user.role}
                    </span>
                  </td>
                  <td>
                    <b>{user.quizCount || 0}</b> quiz ·{" "}
                    <b>{user.sessionCount || 0}</b> {tr("phiên", "rooms")}
                  </td>
                  <td>{dateTime(user.createdAt, locale)}</td>
                  <td>
                    <span
                      className={`admin-badge ${user.status.toLowerCase()}`}
                    >
                      {user.status === "ACTIVE"
                        ? tr("Hoạt động", "Active")
                        : tr("Tạm khóa", "Suspended")}
                    </span>
                  </td>
                  <td>
                    <div className="admin-row-actions">
                      <button
                        title={tr("Đặt lại mật khẩu", "Reset password")}
                        disabled={user.id === currentUser.id}
                        onClick={() => {
                          setResetError("");
                          setNotice("");
                          setResetUser(user);
                        }}
                      >
                        <KeyRound />
                      </button>
                      <button
                        disabled={user.id === currentUser.id}
                        onClick={() =>
                          setConfirmation({
                            title:
                              user.role === "ADMIN"
                                ? tr("Hạ quyền tài khoản?", "Demote account?")
                                : tr("Cấp quyền Admin?", "Promote to Admin?"),
                            message:
                              user.role === "ADMIN"
                                ? tr(
                                    `Tài khoản ${user.displayName} sẽ trở thành Host.`,
                                    `${user.displayName} will become a Host.`,
                                  )
                                : tr(
                                    `Tài khoản ${user.displayName} sẽ có quyền quản trị.`,
                                    `${user.displayName} will receive administrator access.`,
                                  ),
                            confirmLabel: tr("Xác nhận", "Confirm"),
                            run: () =>
                              update(user, {
                                role: user.role === "ADMIN" ? "HOST" : "ADMIN",
                              }),
                          })
                        }
                      >
                        <UserCog />
                      </button>
                      <button
                        className={
                          user.status === "ACTIVE" ? "danger" : "success"
                        }
                        disabled={user.id === currentUser.id}
                        onClick={() =>
                          setConfirmation({
                            title:
                              user.status === "ACTIVE"
                                ? tr("Tạm khóa tài khoản?", "Suspend account?")
                                : tr(
                                    "Mở lại tài khoản?",
                                    "Reactivate account?",
                                  ),
                            message: tr(
                              `Thay đổi trạng thái của ${user.displayName}.`,
                              `Change the status of ${user.displayName}.`,
                            ),
                            confirmLabel:
                              user.status === "ACTIVE"
                                ? tr("Tạm khóa", "Suspend")
                                : tr("Mở lại", "Reactivate"),
                            tone:
                              user.status === "ACTIVE" ? "danger" : "primary",
                            run: () =>
                              update(user, {
                                status:
                                  user.status === "ACTIVE"
                                    ? "SUSPENDED"
                                    : "ACTIVE",
                              }),
                          })
                        }
                      >
                        {user.status === "ACTIVE" ? <Ban /> : <CheckCircle2 />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination
            page={page}
            total={totalPages}
            onPageChange={setPage}
            tr={tr}
          />
          {!visible.length && (
            <div className="admin-empty">
              {tr(
                "Không tìm thấy người dùng phù hợp.",
                "No matching users found.",
              )}
            </div>
          )}
        </div>
      )}
      <AdminPasswordResetModal
        user={resetUser}
        busy={busy}
        error={resetError}
        onClose={() => {
          if (!busy) {
            setResetError("");
            setResetUser(null);
          }
        }}
        onConfirm={executePasswordReset}
      />
      <AdminCreateUserModal
        open={showAddUser}
        busy={busy}
        error={createError}
        onClose={() => {
          if (!busy) {
            setCreateError("");
            setShowAddUser(false);
          }
        }}
        onConfirm={createUser}
      />
      <AdminConfirm
        value={confirmation}
        busy={busy}
        onClose={() => !busy && setConfirmation(null)}
      />
    </section>
  );
}

function AdminSessions({ refresh }: { refresh: number }) {
  const { tr, locale } = usePreferences();
  const { data, setData, loading, error } = useAdminData<AdminSession[]>(
    "/admin/sessions",
    refresh,
  );
  const [filter, setFilter] = useState("ALL");
  const [query, setQuery] = useState("");
  const [revealedPins, setRevealedPins] = useState<Set<string>>(
    () => new Set(),
  );
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => setPage(1), [filter, query]);

  const visible = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("vi-VN");
    return (data || []).filter((session) => {
      const searchable = [
        session.id,
        session.pin,
        session.quiz?.title,
        session.quiz?.category,
        session.host?.displayName,
        session.host?.username,
        session.host?.email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("vi-VN");
      return (
        (filter === "ALL" || session.state === filter) &&
        (!normalizedQuery || searchable.includes(normalizedQuery))
      );
    });
  }, [data, filter, query]);
  const stopRoom = async (session: AdminSession) => {
    setBusy(true);
    try {
      const action = session.state === "LOBBY" ? "cancel" : "end";
      const updated = await request<AdminSession>(
        `/sessions/${session.id}/${action}`,
        { method: "POST", token: hostToken() },
      );
      setData((rows) =>
        (rows || []).map((row) =>
          row.id === session.id ? { ...row, ...updated } : row,
        ),
      );
      setConfirmation(null);
    } finally {
      setBusy(false);
    }
  };

  const totalPages = Math.ceil(visible.length / 10);
  const pagedVisible = visible.slice((page - 1) * 10, page * 10);

  return (
    <section className="admin-panel admin-table-panel">
      <AdminError message={error} />
      <div className="admin-toolbar">
        <label className="admin-search">
          <Search />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={tr(
              "Tìm quiz, host, PIN hoặc mã phòng...",
              "Search quiz, host, PIN or room ID...",
            )}
          />
        </label>
        <select
          className="admin-filter-select"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          aria-label={tr("Lọc trạng thái phòng", "Filter room status")}
        >
          {["ALL", "LOBBY", "RUNNING", "PAUSED", "ENDED", "CANCELLED"].map(
            (state) => (
              <option key={state} value={state}>
                {state === "ALL"
                  ? tr("Tất cả trạng thái", "All statuses")
                  : sessionLabel(state, tr)}
              </option>
            ),
          )}
        </select>
      </div>
      {loading && !data ? (
        <AdminLoading />
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{tr("Phòng / Quiz", "Room / Quiz")}</th>
                <th>Host</th>
                <th>PIN</th>
                <th>{tr("Người chơi", "Players")}</th>
                <th>{tr("Trạng thái", "Status")}</th>
                <th>{tr("Thời gian", "Created")}</th>
                <th>{tr("Thao tác", "Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {pagedVisible.map((session) => {
                const ended = ["ENDED", "CANCELLED"].includes(session.state);
                return (
                  <tr key={session.id}>
                    <td>
                      <b>
                        {session.quiz?.title ||
                          tr("Quiz đã xóa", "Deleted quiz")}
                      </b>
                      <small className="admin-cell-note">#{session.id}</small>
                    </td>
                    <td>
                      <b>{session.host?.displayName || "—"}</b>
                      <small className="admin-cell-note">
                        @{session.host?.username || "—"}
                      </small>
                    </td>
                    <td>
                      <div className="admin-pin-cell">
                        <code>
                          {revealedPins.has(session.id)
                            ? session.pin || "—"
                            : "••••••"}
                        </code>
                        <button
                          type="button"
                          className="admin-visibility-toggle"
                          title={
                            revealedPins.has(session.id)
                              ? tr("Ẩn mã PIN", "Hide PIN")
                              : tr("Hiện mã PIN", "Show PIN")
                          }
                          onClick={() =>
                            setRevealedPins((current) => {
                              const next = new Set(current);
                              if (next.has(session.id))
                                next.delete(session.id);
                              else next.add(session.id);
                              return next;
                            })
                          }
                        >
                          {revealedPins.has(session.id) ? <EyeOff /> : <Eye />}
                        </button>
                      </div>
                    </td>
                    <td>
                      <b>{session.playerCount}</b>
                    </td>
                    <td>
                      <span
                        className={`admin-badge state ${session.state.toLowerCase()}`}
                      >
                        {sessionLabel(session.state, tr)}
                      </span>
                    </td>
                    <td>{dateTime(session.createdAt, locale)}</td>
                    <td>
                      <div className="admin-row-actions">
                        {!ended && (
                          <Link
                            to={`/host/${session.id}`}
                            title={tr("Mở điều khiển", "Open console")}
                          >
                            <ExternalLink />
                          </Link>
                        )}
                        {!ended && (
                          <button
                            className="danger"
                            onClick={() =>
                              setConfirmation({
                                title: tr(
                                  "Dừng phòng chơi?",
                                  "Stop this room?",
                                ),
                                message: tr(
                                  `Phòng “${session.quiz?.title || session.id}” sẽ kết thúc đối với tất cả người chơi.`,
                                  `The room “${session.quiz?.title || session.id}” will end for every player.`,
                                ),
                                confirmLabel: tr("Dừng phòng", "Stop room"),
                                tone: "danger",
                                run: () => stopRoom(session),
                              })
                            }
                          >
                            <Ban />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <Pagination
            page={page}
            total={totalPages}
            onPageChange={setPage}
            tr={tr}
          />
          {!visible.length && (
            <div className="admin-empty">
              {tr(
                "Không có phòng ở trạng thái này.",
                "No rooms in this state.",
              )}
            </div>
          )}
        </div>
      )}
      <AdminConfirm
        value={confirmation}
        busy={busy}
        onClose={() => !busy && setConfirmation(null)}
      />
    </section>
  );
}

function AdminActivity({ refresh }: { refresh: number }) {
  const { tr, locale } = usePreferences();
  const { data, loading, error } = useAdminData<ActivityRow[]>(
    "/admin/activity?limit=100",
    refresh,
  );
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<"ALL" | "ADMIN" | "SESSION">("ALL");
  const [eventType, setEventType] = useState("ALL");
  const [page, setPage] = useState(1);
  const label = (row: ActivityRow) =>
    ({
      SESSION_CREATED: tr("Phòng chơi được tạo", "Game room created"),
      SESSION_STATE_CHANGED: tr("Phòng đổi trạng thái", "Room state changed"),
      PLAYER_JOINED: tr("Người chơi tham gia", "Player joined"),
      ANSWER_SUBMITTED: tr("Đã gửi câu trả lời", "Answer submitted"),
      USER_CREATED: tr("Tạo tài khoản", "User created"),
      USER_UPDATED: tr("Cập nhật người dùng", "User updated"),
      USER_PASSWORD_RESET: tr("Đặt lại mật khẩu", "Password reset"),
      BACKUP_CREATED: tr("Tạo bản sao lưu", "Backup created"),
      BACKUP_DELETED: tr("Xóa bản sao lưu", "Backup deleted"),
      BACKUP_RESTORED: tr("Khôi phục bản sao lưu", "Backup restored"),
    })[row.type] || row.type;
  const detail = (row: ActivityRow) =>
    row.type === "SESSION_STATE_CHANGED"
      ? `${sessionLabel(row.details.from || "—", tr)} → ${sessionLabel(row.details.to || "—", tr)}`
      : row.type === "ANSWER_SUBMITTED"
        ? `${row.details.points || 0} ${tr("điểm", "points")} · Player ${row.details.playerId || "—"}`
        : row.type === "USER_UPDATED"
          ? `${row.details.role} · ${row.details.status}`
          : row.details.playerId
            ? `Player ${row.details.playerId}`
            : row.sessionId
              ? `Session ${row.sessionId}`
              : tr("Hoạt động quản trị", "Admin activity");
  useEffect(() => setPage(1), [query, scope, eventType]);
  const eventTypes = Array.from(new Set((data || []).map((row) => row.type)));
  const normalizedQuery = query.trim().toLocaleLowerCase("vi-VN");
  const visible = (data || []).filter((row) => {
    const searchable = [
      label(row),
      detail(row),
      row.type,
      row.sessionId,
      ...Object.values(row.details),
    ]
      .join(" ")
      .toLocaleLowerCase("vi-VN");
    return (
      (scope === "ALL" || row.scope === scope) &&
      (eventType === "ALL" || row.type === eventType) &&
      (!normalizedQuery || searchable.includes(normalizedQuery))
    );
  });
  const totalPages = Math.ceil(visible.length / 12);
  const pagedVisible = visible.slice((page - 1) * 12, page * 12);
  return (
    <section className="admin-panel admin-activity-panel">
      <AdminError message={error} />
      <div className="admin-toolbar">
        <label className="admin-search">
          <Search />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={tr(
              "Tìm sự kiện, phòng hoặc nội dung...",
              "Search events, rooms or details...",
            )}
          />
        </label>
        <select
          className="admin-filter-select"
          value={scope}
          onChange={(event) => setScope(event.target.value as typeof scope)}
          aria-label={tr("Lọc phạm vi", "Filter scope")}
        >
          <option value="ALL">{tr("Tất cả phạm vi", "All scopes")}</option>
          <option value="SESSION">{tr("Phòng chơi", "Game rooms")}</option>
          <option value="ADMIN">{tr("Quản trị", "Administration")}</option>
        </select>
        <select
          className="admin-filter-select"
          value={eventType}
          onChange={(event) => setEventType(event.target.value)}
          aria-label={tr("Lọc loại sự kiện", "Filter event type")}
        >
          <option value="ALL">{tr("Tất cả sự kiện", "All events")}</option>
          {eventTypes.map((type) => (
            <option key={type} value={type}>
              {label({
                id: "",
                scope: "SESSION",
                sessionId: "",
                type,
                at: "",
                details: {},
              })}
            </option>
          ))}
        </select>
      </div>
      {loading && !data ? (
        <AdminLoading />
      ) : (
        <>
          <div className="admin-timeline">
            {pagedVisible.map((row) => (
              <article key={row.id}>
                <span
                  className={`admin-activity-icon ${row.scope.toLowerCase()}`}
                >
                  {row.scope === "ADMIN" ? <Shield /> : <Activity />}
                </span>
                <div>
                  <b>{label(row)}</b>
                  <p>{detail(row)}</p>
                  <small>{dateTime(row.at, locale)}</small>
                </div>
                {row.sessionId && <code>{row.sessionId}</code>}
              </article>
            ))}
            {!visible.length && (
              <div className="admin-empty">
                {tr(
                  "Không tìm thấy hoạt động phù hợp.",
                  "No matching activity was found.",
                )}
              </div>
            )}
          </div>
          <Pagination
            page={page}
            total={totalPages}
            onPageChange={setPage}
            tr={tr}
          />
        </>
      )}
    </section>
  );
}

const formatBytes = (bytes: number, locale: "vi" | "en") => {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const unit = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), 3);
  return `${new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US", {
    maximumFractionDigits: unit ? 1 : 0,
  }).format(bytes / 1024 ** unit)} ${units[unit]}`;
};

function AdminSystem({ refresh }: { refresh: number }) {
  const { tr, locale } = usePreferences();
  const [localRefresh, setLocalRefresh] = useState(0);
  const system = useAdminData<SystemData>(
    "/admin/system",
    refresh + localRefresh,
  );
  const backups = useAdminData<BackupSummary[]>(
    "/admin/backups",
    refresh + localRefresh,
  );
  const [label, setLabel] = useState("");
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);

  const reload = () => setLocalRefresh((value) => value + 1);

  const createNewBackup = async () => {
    setBusyAction("create");
    setActionError("");
    setNotice("");
    try {
      const created = await request<BackupSummary>("/admin/backups", {
        method: "POST",
        token: hostToken(),
        body: JSON.stringify({ label }),
      });
      backups.setData((rows) => [created, ...(rows || [])]);
      setLabel("");
      setNotice(
        tr(
          `Đã sao lưu ${created.keyCount} bản ghi.`,
          `Backed up ${created.keyCount} records.`,
        ),
      );
    } catch (reason) {
      setActionError((reason as Error).message);
    } finally {
      setBusyAction("");
    }
  };

  const restoreSelectedBackup = async (backup: BackupSummary) => {
    setBusyAction(`restore:${backup.id}`);
    setActionError("");
    setNotice("");
    try {
      const result = await request<{
        restoredKeys: number;
        safetyBackup: BackupSummary;
      }>(`/admin/backups/${backup.id}/restore`, {
        method: "POST",
        token: hostToken(),
      });
      setConfirmation(null);
      setNotice(
        tr(
          `Đã phục hồi ${result.restoredKeys} bản ghi. Bản sao an toàn: ${result.safetyBackup.label}.`,
          `Restored ${result.restoredKeys} records. Safety backup: ${result.safetyBackup.label}.`,
        ),
      );
      reload();
    } catch (reason) {
      setActionError((reason as Error).message);
    } finally {
      setBusyAction("");
    }
  };

  const deleteSelectedBackup = async (backup: BackupSummary) => {
    setBusyAction(`delete:${backup.id}`);
    setActionError("");
    try {
      await request<void>(`/admin/backups/${backup.id}`, {
        method: "DELETE",
        token: hostToken(),
      });
      backups.setData((rows) =>
        (rows || []).filter((row) => row.id !== backup.id),
      );
      setConfirmation(null);
      setNotice(tr("Đã xóa bản sao lưu.", "Backup deleted."));
    } catch (reason) {
      setActionError((reason as Error).message);
    } finally {
      setBusyAction("");
    }
  };

  const downloadBackup = async (backup: BackupSummary) => {
    setBusyAction(`download:${backup.id}`);
    setActionError("");
    try {
      const response = await fetch(`/api/admin/backups/${backup.id}/download`, {
        headers: { Authorization: `Bearer ${hostToken()}` },
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(
          payload?.message ||
            tr("Không thể tải bản sao lưu.", "Unable to download backup."),
        );
      }
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${backup.id}.rrbackup.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (reason) {
      setActionError((reason as Error).message);
    } finally {
      setBusyAction("");
    }
  };

  if (system.loading && !system.data) return <AdminLoading />;
  if (!system.data) return <AdminError message={system.error} />;

  const data = system.data;
  const uptimeDays = Math.floor(data.redis.uptimeSeconds / 86400);
  return (
    <>
      <AdminError message={system.error || backups.error || actionError} />
      {notice && (
        <div className="admin-success" role="status">
          <CheckCircle2 />
          {notice}
        </div>
      )}
      <section className="admin-system-grid">
        <article>
          <Shield />
          <span>
            <small>{tr("Trạng thái hệ thống", "System status")}</small>
            <b>{tr("Sẵn sàng", "Ready")}</b>
            <em>
              {tr(
                "Dữ liệu đang hoạt động bình thường",
                "Application data is operating normally",
              )}
            </em>
          </span>
        </article>
        <article>
          <Database />
          <span>
            <small>{tr("Bản ghi đang quản lý", "Managed records")}</small>
            <b>{data.namespaceKeys.toLocaleString()}</b>
            <em>{tr("Đã đồng bộ", "Synchronized")}</em>
          </span>
        </article>
        <article>
          <Archive />
          <span>
            <small>{tr("Phiên bản đã lưu", "Saved versions")}</small>
            <b>{backups.data ? backups.data.length.toLocaleString() : "—"}</b>
            <em>{tr("Có thể tải xuống và phục hồi", "Ready to restore")}</em>
          </span>
        </article>
        <article>
          <Clock3 />
          <span>
            <small>{tr("Thời gian hoạt động", "Operating time")}</small>
            <b>
              {uptimeDays} {tr("ngày", "days")}
            </b>
            <em>{tr("Đang kết nối", "Connected")}</em>
          </span>
        </article>
      </section>

      <section className="admin-panel admin-backup-panel">
        <div className="admin-panel-head admin-backup-head">
          <div>
            <span className="admin-section-icon">
              <Archive />
            </span>
            <div>
              <h2>{tr("Sao lưu và phục hồi dữ liệu", "Backup and restore")}</h2>
              <p>
                {tr(
                  "Tạo phiên bản dữ liệu để tải xuống hoặc quay lại khi cần.",
                  "Create data versions to download or restore later.",
                )}
              </p>
            </div>
          </div>
          <div className="admin-backup-create">
            <input
              value={label}
              maxLength={80}
              onChange={(event) => setLabel(event.target.value)}
              placeholder={tr(
                "Tên bản sao, ví dụ: Trước khi demo",
                "Backup name, e.g. Before demo",
              )}
            />
            <button
              className="admin-button primary"
              disabled={Boolean(busyAction)}
              onClick={() => void createNewBackup()}
            >
              {busyAction === "create" ? (
                <RefreshCw className="spin" />
              ) : (
                <Archive />
              )}
              {tr("Tạo bản sao", "Create backup")}
            </button>
          </div>
        </div>
        <div className="admin-backup-note">
          <Shield />
          <div>
            <b>{tr("Phục hồi có lớp an toàn", "Safe restore")}</b>
            <p>
              {tr(
                "Trước mỗi lần phục hồi, RankRush tự tạo một bản sao dữ liệu hiện tại. Nếu restore lỗi, hệ thống tự hoàn tác.",
                "Before every restore, RankRush creates a safety backup. If restore fails, the current data is rolled back automatically.",
              )}
            </p>
          </div>
        </div>
        {backups.loading && !backups.data ? (
          <div className="admin-backup-loading">
            {Array.from({ length: 3 }, (_, index) => (
              <span key={index} />
            ))}
          </div>
        ) : backups.data?.length ? (
          <div className="admin-backup-list">
            {backups.data.map((backup) => (
              <article key={backup.id}>
                <span className="admin-backup-icon">
                  <Database />
                </span>
                <div className="admin-backup-info">
                  <div>
                    <b>{backup.label}</b>
                    {backup.reason === "PRE_RESTORE" && (
                      <span className="admin-badge safety">
                        {tr("AN TOÀN TỰ ĐỘNG", "AUTO SAFETY")}
                      </span>
                    )}
                  </div>
                  <small>
                    {dateTime(backup.createdAt, locale)} · {backup.keyCount}{" "}
                    {tr("bản ghi", "records")} ·{" "}
                    {formatBytes(backup.sizeBytes, locale)}
                  </small>
                </div>
                <div className="admin-backup-actions">
                  <button
                    title={tr("Tải xuống", "Download")}
                    disabled={Boolean(busyAction)}
                    onClick={() => void downloadBackup(backup)}
                  >
                    {busyAction === `download:${backup.id}` ? (
                      <RefreshCw className="spin" />
                    ) : (
                      <Download />
                    )}
                  </button>
                  <button
                    className="restore"
                    title={tr("Phục hồi phiên bản này", "Restore this version")}
                    disabled={Boolean(busyAction)}
                    onClick={() =>
                      setConfirmation({
                        title: tr(
                          "Phục hồi phiên bản dữ liệu?",
                          "Restore this data version?",
                        ),
                        message: tr(
                          `Toàn bộ dữ liệu ứng dụng sẽ quay về phiên bản “${backup.label}”. Hệ thống sẽ tự sao lưu trạng thái hiện tại trước khi thực hiện.`,
                          `All application data will return to “${backup.label}”. The current state will be backed up automatically first.`,
                        ),
                        confirmLabel: tr("Phục hồi", "Restore"),
                        tone: "danger",
                        run: () => restoreSelectedBackup(backup),
                      })
                    }
                  >
                    <RotateCcw />
                  </button>
                  <button
                    className="danger"
                    title={tr("Xóa bản sao", "Delete backup")}
                    disabled={Boolean(busyAction)}
                    onClick={() =>
                      setConfirmation({
                        title: tr("Xóa bản sao lưu?", "Delete backup?"),
                        message: tr(
                          `Bản sao “${backup.label}” sẽ bị xóa khỏi máy chủ và không thể tải lại.`,
                          `“${backup.label}” will be removed from the server and cannot be downloaded again.`,
                        ),
                        confirmLabel: tr("Xóa", "Delete"),
                        tone: "danger",
                        run: () => deleteSelectedBackup(backup),
                      })
                    }
                  >
                    <Trash2 />
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="admin-empty admin-backup-empty">
            <Archive />
            <div>
              <b>{tr("Chưa có bản sao lưu", "No backups yet")}</b>
              <p>
                {tr(
                  "Hãy tạo bản sao đầu tiên trước khi thay đổi dữ liệu quan trọng.",
                  "Create your first backup before changing important data.",
                )}
              </p>
            </div>
          </div>
        )}
      </section>
      <AdminConfirm
        value={confirmation}
        busy={Boolean(busyAction)}
        onClose={() => !busyAction && setConfirmation(null)}
      />
    </>
  );
}

function AdminAssistant() {
  const { tr, locale } = usePreferences();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    subject: "",
    sourceText: "",
    title: "",
    category: tr("Giáo dục", "Education"),
    questionCount: 5,
    basePoints: 600,
    timeLimitSec: 20,
    difficulty: "MEDIUM",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<GeneratedQuizResult | null>(null);
  const generate = async () => {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const body = new FormData();
      Object.entries({ ...form, language: locale }).forEach(([key, value]) =>
        body.set(key, String(value)),
      );
      setResult(
        await request<GeneratedQuizResult>("/ai/generate-quiz", {
          method: "POST",
          token: hostToken(),
          body,
        }),
      );
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <section className="admin-assistant-intro">
        <span>
          <Bot />
        </span>
        <div>
          <b>{tr("Trợ lý đã sẵn sàng", "Assistant is ready")}</b>
          <p>
            {tr(
              "Câu hỏi được tạo thành một quiz nháp và luôn cần Admin kiểm tra trước khi xuất bản.",
              "Generated questions are saved as a draft quiz for review before publishing.",
            )}
          </p>
        </div>
        <Shield />
      </section>
      <div className="admin-assistant-grid">
        <section className="admin-panel admin-assistant-source">
          <h2>{tr("Nội dung đầu vào", "Source content")}</h2>
          <label>
            {tr("Chủ đề cần tạo câu hỏi", "Question topic")}
            <input
              value={form.subject}
              onChange={(event) =>
                setForm({ ...form, subject: event.target.value })
              }
              placeholder={tr(
                "Ví dụ: Lịch sử Việt Nam",
                "Example: Vietnamese history",
              )}
            />
          </label>
          <label>
            {tr("Nội dung tham khảo", "Reference content")}
            <textarea
              value={form.sourceText}
              onChange={(event) =>
                setForm({ ...form, sourceText: event.target.value })
              }
              placeholder={tr(
                "Giáo trình hoặc yêu cầu chi tiết (không bắt buộc nếu đã nhập chủ đề)",
                "Notes or detailed requirements (optional when a topic is provided)",
              )}
            />
          </label>
          <p>
            {tr(
              "Kết quả tự động có thể sai. Hãy kiểm tra đáp án và cách diễn đạt trước khi mở phòng.",
              "Generated content can be incorrect. Review every answer before hosting.",
            )}
          </p>
        </section>
        <section className="admin-panel admin-assistant-settings">
          <h2>{tr("Thiết lập kết quả", "Output settings")}</h2>
          <div className="admin-form-grid">
            <label>
              {tr("Số câu hỏi", "Questions")}
              <input
                type="number"
                min="3"
                max="15"
                value={form.questionCount}
                onChange={(event) =>
                  setForm({
                    ...form,
                    questionCount: Number(event.target.value),
                  })
                }
              />
            </label>
            <label>
              {tr("Điểm mỗi câu", "Points per question")}
              <input
                type="number"
                min="100"
                max="5000"
                step="100"
                value={form.basePoints}
                onChange={(event) =>
                  setForm({ ...form, basePoints: Number(event.target.value) })
                }
              />
            </label>
            <label>
              {tr("Thời gian", "Time limit")}
              <input
                type="number"
                min="5"
                max="300"
                value={form.timeLimitSec}
                onChange={(event) =>
                  setForm({ ...form, timeLimitSec: Number(event.target.value) })
                }
              />
            </label>
            <label>
              {tr("Độ khó", "Difficulty")}
              <select
                value={form.difficulty}
                onChange={(event) =>
                  setForm({ ...form, difficulty: event.target.value })
                }
              >
                <option value="EASY">{tr("Dễ", "Easy")}</option>
                <option value="MEDIUM">{tr("Trung bình", "Medium")}</option>
                <option value="HARD">{tr("Khó", "Hard")}</option>
              </select>
            </label>
          </div>
          <label>
            {tr("Tên quiz nháp", "Draft quiz title")}
            <input
              value={form.title}
              onChange={(event) =>
                setForm({ ...form, title: event.target.value })
              }
              placeholder={tr(
                "Để trống để dùng tên chủ đề",
                "Leave blank to use the topic",
              )}
            />
          </label>
          <label>
            {tr("Danh mục", "Category")}
            <input
              value={form.category}
              onChange={(event) =>
                setForm({ ...form, category: event.target.value })
              }
            />
          </label>
          <div className="admin-draft-note">
            <CheckCircle2 />
            <span>
              <b>
                {tr(
                  "Tạo quiz nháp từ các câu vừa tạo",
                  "Create a draft quiz from generated questions",
                )}
              </b>
              <small>
                {tr(
                  "Quiz sẽ được lưu vào tài khoản Admin để rà soát.",
                  "The quiz is saved to the Admin account for review.",
                )}
              </small>
            </span>
          </div>
          <button
            className="admin-button primary block"
            disabled={busy || (!form.subject.trim() && !form.sourceText.trim())}
            onClick={() => void generate()}
          >
            {busy ? <RefreshCw className="spin" /> : <Bot />}
            {busy
              ? tr("Đang tạo câu hỏi...", "Generating...")
              : tr(
                  "Tạo câu hỏi và lưu quiz nháp",
                  "Generate and save draft quiz",
                )}
          </button>
          <AdminError message={error} />
        </section>
      </div>
      {result && (
        <section className="admin-result">
          <CheckCircle2 />
          <div>
            <b>{tr("Đã tạo quiz nháp thành công", "Draft quiz created")}</b>
            <p>
              {result.quiz.title} · {result.questionCount}{" "}
              {tr("câu hỏi", "questions")}
            </p>
          </div>
          <button
            className="admin-button primary"
            onClick={() => navigate(`/editor/${result.quiz.id}`)}
          >
            {tr("Kiểm tra ngay", "Review now")}
            <ExternalLink />
          </button>
        </section>
      )}
    </>
  );
}

const pageMeta = (section: string, tr: (vi: string, en: string) => string) =>
  ({
    overview: [
      tr("Tổng quan hệ thống", "System overview"),
      tr(
        "Theo dõi dữ liệu RankRush theo thời gian thực",
        "Monitor RankRush data in real time",
      ),
    ],
    users: [
      tr("Quản lý người dùng", "User management"),
      tr(
        "Vai trò, trạng thái và dữ liệu tài khoản",
        "Account roles, status and usage",
      ),
    ],
    sessions: [
      tr("Phòng chơi", "Game rooms"),
      tr(
        "Giám sát các phiên quiz đang hoạt động",
        "Monitor live quiz sessions",
      ),
    ],
    activity: [
      tr("Nhật ký hoạt động", "Activity log"),
      tr(
        "Sự kiện phòng chơi và thao tác quản trị",
        "Room events and admin actions",
      ),
    ],
    system: [
      tr("Dữ liệu hệ thống", "System data"),
      tr(
        "Trạng thái, sao lưu và phục hồi phiên bản dữ liệu",
        "Status, backup and data-version restore",
      ),
    ],
    assistant: [
      tr("Trợ lý tạo câu hỏi", "Question assistant"),
      tr(
        "Tạo quiz nháp tự động và kiểm tra trước khi sử dụng",
        "Create draft quizzes automatically and review before use",
      ),
    ],
  })[section] || ["Admin", "RankRush"];

export default function AdminPage() {
  const { tr } = usePreferences();
  const location = useLocation();
  const user = useMemo(readStoredUser, []);
  const [refresh, setRefresh] = useState(0);
  if (!hostToken()) return <Navigate to="/login" replace />;
  if (user.role !== "ADMIN") return <Navigate to="/dashboard" replace />;
  const section = location.pathname.split("/")[2] || "overview";
  const [title, subtitle] = pageMeta(section, tr);
  const content =
    section === "users" ? (
      <AdminUsers refresh={refresh} />
    ) : section === "sessions" ? (
      <AdminSessions refresh={refresh} />
    ) : section === "activity" ? (
      <AdminActivity refresh={refresh} />
    ) : section === "system" ? (
      <AdminSystem refresh={refresh} />
    ) : section === "assistant" ? (
      <AdminAssistant />
    ) : (
      <AdminOverview refresh={refresh} />
    );
  return (
    <div className="admin-shell">
      <AdminSidebar active={section} user={user} />
      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <div>
            <AdminAppearance />
            <button
              className="admin-button secondary"
              onClick={() => {
                if ((window as any).__refreshing) return;
                (window as any).__refreshing = true;
                const bd = document.createElement("div");
                bd.className = "confirm-backdrop";
                bd.style.cssText = "position:fixed;z-index:9999";
                bd.innerHTML =
                  '<section class="confirm-dialog" role="alertdialog" aria-modal="true"><div class="confirm-dialog-heading"><span class="confirm-dialog-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></span><div><span class="eyebrow">' +
                  tr("Xác nhận", "Confirmation") +
                  "</span><h2>" +
                  tr("Làm mới dữ liệu?", "Refresh data?") +
                  "</h2></div></div><p>" +
                  tr(
                    "Thao tác này sẽ tải lại toàn bộ dữ liệu quản trị.",
                    "This will reload all admin data.",
                  ) +
                  '</p><div class="confirm-dialog-actions"><button class="button button-secondary" id="rfc-no">' +
                  tr("Kh\u00f4ng", "No") +
                  '</button><button class="button button-primary" id="rfc-yes">' +
                  tr("C\u00f3", "Yes") +
                  "</button></div></section>";
                document.body.appendChild(bd);
                const clean = () => {
                  bd.remove();
                  (window as any).__refreshing = false;
                };
                bd.querySelector("#rfc-no")?.addEventListener("click", clean);
                bd.querySelector("#rfc-yes")?.addEventListener("click", () => {
                  clean();
                  setRefresh((v) => v + 1);
                  setTimeout(() => {
                    const toast = document.createElement("div");
                    toast.className = "toast visible";
                    toast.style.cssText =
                      "position:fixed;bottom:30px;left:50%;transform:translateX(-50%);z-index:9999";
                    toast.innerHTML =
                      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> ' +
                      tr("Đã làm mới dữ liệu.", "Data refreshed.");
                    document.body.appendChild(toast);
                    setTimeout(() => {
                      toast.remove();
                    }, 2500);
                  }, 300);
                });
              }}
            >
              <RefreshCw />
              {tr("Làm mới", "Refresh")}
            </button>
          </div>
        </header>
        <div className="admin-content">{content}</div>
      </main>
    </div>
  );
}
