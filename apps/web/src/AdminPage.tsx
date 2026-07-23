import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  Ban,
  Bot,
  CheckCircle2,
  Clock3,
  Database,
  ExternalLink,
  FileQuestion,
  Globe2,
  Home,
  LogOut,
  Monitor,
  Moon,
  Play,
  RefreshCw,
  Search,
  Server,
  Shield,
  Sun,
  UserCog,
  Users,
  X,
  Zap,
} from "lucide-react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
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
    <div className="admin-loading">
      <RefreshCw />
      {tr("Đang tải dữ liệu quản trị...", "Loading admin data...")}
    </div>
  );
}

function AdminError({ message }: { message: string }) {
  return message ? <div className="admin-error">{message}</div> : null;
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
  const { locale, setLocale, theme, themePreference, setThemePreference, t } =
    usePreferences();
  return (
    <div className="admin-appearance">
      <label title={t("language")}>
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
      <label title={t("appearance")}>
        {themePreference === "system" ? (
          <Monitor />
        ) : theme === "dark" ? (
          <Moon />
        ) : (
          <Sun />
        )}
        <select
          value={themePreference}
          onChange={(event) =>
            setThemePreference(
              event.target.value as "system" | "light" | "dark",
            )
          }
          aria-label={t("appearance")}
        >
          <option value="system">{t("systemTheme")}</option>
          <option value="light">{t("lightTheme")}</option>
          <option value="dark">{t("darkTheme")}</option>
        </select>
      </label>
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
  const { tr } = usePreferences();
  const navigate = useNavigate();
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
          onClick={() => {
            localStorage.removeItem("rr_host_token");
            localStorage.removeItem("rr_user");
            navigate("/login");
          }}
        >
          <LogOut />
        </button>
      </div>
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
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [busy, setBusy] = useState(false);
  const visible = useMemo(
    () =>
      (data || []).filter((user) => {
        const text =
          `${user.displayName} ${user.username} ${user.email}`.toLocaleLowerCase(
            "vi-VN",
          );
        return (
          (role === "ALL" || user.role === role) &&
          text.includes(query.trim().toLocaleLowerCase("vi-VN"))
        );
      }),
    [data, query, role],
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
              "Tìm tên, username hoặc email...",
              "Search name, username or email...",
            )}
          />
        </label>
        <select
          value={role}
          onChange={(event) => setRole(event.target.value as typeof role)}
        >
          <option value="ALL">{tr("Tất cả vai trò", "All roles")}</option>
          <option value="HOST">Host</option>
          <option value="ADMIN">Admin</option>
        </select>
      </div>
      {loading && !data ? (
        <AdminLoading />
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{tr("Người dùng", "User")}</th>
                <th>{tr("Vai trò", "Role")}</th>
                <th>{tr("Dữ liệu", "Data")}</th>
                <th>{tr("Ngày tạo", "Created")}</th>
                <th>{tr("Trạng thái", "Status")}</th>
                <th>{tr("Thao tác", "Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((user) => (
                <tr key={user.id}>
                  <td>
                    <div className="admin-user-cell">
                      <span className="admin-avatar">
                        {user.displayName[0]?.toUpperCase()}
                      </span>
                      <div>
                        <b>{user.displayName}</b>
                        <small>
                          @{user.username} · {user.email}
                        </small>
                      </div>
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
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [busy, setBusy] = useState(false);
  const visible = (data || []).filter(
    (session) => filter === "ALL" || session.state === filter,
  );
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
  return (
    <section className="admin-panel admin-table-panel">
      <AdminError message={error} />
      <div className="admin-toolbar">
        <div className="admin-filter-tabs">
          {["ALL", "LOBBY", "RUNNING", "PAUSED", "ENDED", "CANCELLED"].map(
            (state) => (
              <button
                key={state}
                className={filter === state ? "active" : ""}
                onClick={() => setFilter(state)}
              >
                {state === "ALL"
                  ? tr("Tất cả", "All")
                  : sessionLabel(state, tr)}
              </button>
            ),
          )}
        </div>
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
              {visible.map((session) => {
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
                      <code>{session.pin || "—"}</code>
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
  const label = (row: ActivityRow) =>
    ({
      SESSION_CREATED: tr("Phòng chơi được tạo", "Game room created"),
      SESSION_STATE_CHANGED: tr("Phòng đổi trạng thái", "Room state changed"),
      PLAYER_JOINED: tr("Người chơi tham gia", "Player joined"),
      ANSWER_SUBMITTED: tr("Đã gửi câu trả lời", "Answer submitted"),
      USER_UPDATED: tr("Cập nhật người dùng", "User updated"),
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
  return (
    <section className="admin-panel">
      <AdminError message={error} />
      {loading && !data ? (
        <AdminLoading />
      ) : (
        <div className="admin-timeline">
          {(data || []).map((row) => (
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
          {!data?.length && (
            <div className="admin-empty">
              {tr(
                "Chưa có hoạt động để hiển thị.",
                "No activity to display yet.",
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function AdminSystem({ refresh }: { refresh: number }) {
  const { tr, locale } = usePreferences();
  const { data, loading, error } = useAdminData<SystemData>(
    "/admin/system",
    refresh,
  );
  if (loading && !data) return <AdminLoading />;
  if (!data) return <AdminError message={error} />;
  const uptimeDays = Math.floor(data.redis.uptimeSeconds / 86400);
  return (
    <>
      <AdminError message={error} />
      <section className="admin-system-grid">
        <article>
          <Server />
          <span>
            <small>Redis</small>
            <b>v{data.redis.version}</b>
            <em>{data.redis.mode || "standalone"}</em>
          </span>
        </article>
        <article>
          <Database />
          <span>
            <small>{tr("Khóa namespace", "Namespace keys")}</small>
            <b>{data.namespaceKeys.toLocaleString()}</b>
            <em>{data.namespace}:*</em>
          </span>
        </article>
        <article>
          <Zap />
          <span>
            <small>{tr("Bộ nhớ đang dùng", "Memory used")}</small>
            <b>{data.redis.usedMemory || "—"}</b>
            <em>Peak {data.redis.peakMemory || "—"}</em>
          </span>
        </article>
        <article>
          <Clock3 />
          <span>
            <small>Uptime</small>
            <b>
              {uptimeDays} {tr("ngày", "days")}
            </b>
            <em>{data.redis.connectedClients} clients</em>
          </span>
        </article>
      </section>
      <section className="admin-panel">
        <div className="admin-panel-head">
          <div>
            <h2>{tr("Cấu trúc dữ liệu Redis", "Redis data structures")}</h2>
            <p>
              {tr(
                `Namespace ${data.namespace}:* được kiểm tra trực tiếp`,
                `Live inspection of ${data.namespace}:*`,
              )}
            </p>
          </div>
          <time>{dateTime(data.checkedAt, locale)}</time>
        </div>
        <div className="admin-type-grid">
          {Object.entries(data.typeCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([type, count]) => (
              <div key={type}>
                <span>
                  <b>{type.toUpperCase()}</b>
                  <small>{count} keys</small>
                </span>
                <progress max={Math.max(1, data.namespaceKeys)} value={count} />
              </div>
            ))}
        </div>
        <div className="admin-system-foot">
          <span>
            {tr("Tổng khóa toàn database", "Total database keys")}
            <b>{data.totalDatabaseKeys}</b>
          </span>
          <span>
            {tr("Lệnh đã xử lý", "Commands processed")}
            <b>{data.redis.totalCommands.toLocaleString()}</b>
          </span>
        </div>
      </section>
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
                "Ví dụ: Redis Sorted Set",
                "Example: Redis Sorted Sets",
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
              {tr("câu", "questions")} · {result.provider}
              {result.warning ? ` · ${result.warning}` : ""}
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
        "Trạng thái Redis và cấu trúc dữ liệu",
        "Redis health and data structures",
      ),
    ],
    assistant: [
      tr("Trợ lý tạo câu hỏi", "Question assistant"),
      tr(
        "Tạo quiz nháp bằng Ollama hoặc bộ sinh cục bộ",
        "Create draft quizzes with Ollama or local fallback",
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
              onClick={() => setRefresh((value) => value + 1)}
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
