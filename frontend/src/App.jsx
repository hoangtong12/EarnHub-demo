import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Wallet,
  Users,
  ShieldCheck,
  LogOut,
  LayoutDashboard,
  ClipboardList,
  ArrowDownToLine,
  Search,
  Plus,
  Minus,
  Lock,
  KeyRound,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Menu,
  X,
  CircleDollarSign,
  AlertCircle,
  Gift,
  ExternalLink,
  User,
  History,
  Settings,
  Coins,
  Gamepad2,
} from "lucide-react";

/* =========================================================
   EARNHUB PRO - FRONTEND
   Login: identity + password
   Register: username + email + password
========================================================= */

const API = (
  import.meta.env.VITE_API_URL || "http://localhost:5000/api"
).replace(/\/+$/, "");

const TOKEN_KEY = "earnhub_token";
const OLD_TOKEN_KEY = "eh_token";

async function request(path, token = "", options = {}) {
  const headers = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API}${path}`, {
    ...options,
    headers,
  });

  const text = await response.text();
  let data = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text || "Phản hồi máy chủ không hợp lệ" };
  }

  if (!response.ok) {
    throw new Error(
      data.message ||
        data.error ||
        data.msg ||
        `Lỗi máy chủ (${response.status})`
    );
  }

  return data;
}

function getToken() {
  return (
    localStorage.getItem(TOKEN_KEY) ||
    localStorage.getItem(OLD_TOKEN_KEY) ||
    ""
  );
}

function saveToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(OLD_TOKEN_KEY, token);
}

function removeToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(OLD_TOKEN_KEY);
}

function getArray(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.users)) return data.users;
  if (Array.isArray(data?.tasks)) return data.tasks;
  if (Array.isArray(data?.withdrawals)) return data.withdrawals;
  return [];
}

function money(value) {
  const number = Number(value || 0);
  return new Intl.NumberFormat("vi-VN").format(
    Number.isFinite(number) ? number : 0
  );
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("vi-VN");
}

function getErrorMessage(error) {
  return error?.message || "Đã xảy ra lỗi. Vui lòng thử lại.";
}

/* =========================================================
   MAIN APP
========================================================= */

export default function App() {
  const [token, setToken] = useState(getToken);
  const [user, setUser] = useState(null);

  const [authMode, setAuthMode] = useState("login");
  const [page, setPage] = useState("overview");

  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [wallet, setWallet] = useState({
    points: 0,
    balanceVND: 0,
    transactions: [],
  });

  const [tasks, setTasks] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);

  const [dashboard, setDashboard] = useState({});
  const [members, setMembers] = useState([]);
  const [adminWithdrawals, setAdminWithdrawals] = useState([]);

  const [query, setQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAdmin = user?.role === "admin";

  const logout = useCallback(() => {
    removeToken();
    setToken("");
    setUser(null);
    setPage("overview");
    setWallet({ points: 0, balanceVND: 0, transactions: [] });
    setTasks([]);
    setWithdrawals([]);
    setMembers([]);
    setAdminWithdrawals([]);
    setNotice("");
    setError("");
  }, []);

  const loadData = useCallback(
    async (activeToken = token) => {
      if (!activeToken) return;

      setLoading(true);
      setError("");

      try {
        const meResult = await request("/auth/me", activeToken);
        const currentUser = meResult.user || meResult.data || meResult;
        setUser(currentUser);

        const results = await Promise.allSettled([
          request("/wallet", activeToken),
          request("/tasks", activeToken),
          request("/withdrawals", activeToken),
        ]);

        if (results[0].status === "fulfilled") {
          const data = results[0].value;
          const walletData = data.wallet || data.data || data;

          setWallet({
            points: Number(
              walletData.points ??
                walletData.balance ??
                walletData.coins ??
                0
            ),
            balanceVND: Number(
              walletData.balanceVND ??
                walletData.balance_vnd ??
                walletData.vnd ??
                0
            ),
            transactions: getArray(
              walletData.transactions || data.transactions || []
            ),
          });
        }

        if (results[1].status === "fulfilled") {
          setTasks(getArray(results[1].value));
        }

        if (results[2].status === "fulfilled") {
          setWithdrawals(getArray(results[2].value));
        }

        const adminUser = currentUser?.role === "admin";

        if (adminUser) {
          const adminResults = await Promise.allSettled([
            request("/admin/dashboard", activeToken),
            request("/admin/users", activeToken),
            request("/admin/withdrawals", activeToken),
          ]);

          if (adminResults[0].status === "fulfilled") {
            setDashboard(
              adminResults[0].value.dashboard ||
                adminResults[0].value.data ||
                adminResults[0].value
            );
          }

          if (adminResults[1].status === "fulfilled") {
            setMembers(getArray(adminResults[1].value));
          }

          if (adminResults[2].status === "fulfilled") {
            setAdminWithdrawals(getArray(adminResults[2].value));
          }
        }
      } catch (err) {
        const message = getErrorMessage(err);

        if (
          message.toLowerCase().includes("token") ||
          message.toLowerCase().includes("unauthorized") ||
          message.includes("401")
        ) {
          logout();
        } else {
          setError(message);
        }
      } finally {
        setLoading(false);
      }
    },
    [token, logout]
  );

  useEffect(() => {
    if (token) {
      loadData(token);
    }
  }, [token, loadData]);

  /* -------------------------------------------------------
     AUTHENTICATION
     Important: backend receives identity, not email.
  ------------------------------------------------------- */

  async function submitAuth(event) {
    event.preventDefault();

    setBusy(true);
    setError("");
    setNotice("");

    const form = new FormData(event.currentTarget);

    const password = String(form.get("password") || "");

    let payload;
    let endpoint;

    if (authMode === "login") {
      payload = {
        identity: String(form.get("identity") || "").trim(),
        password,
      };

      endpoint = "/auth/login";

      if (!payload.identity || !payload.password) {
        setError("Vui lòng nhập tên tài khoản và mật khẩu.");
        setBusy(false);
        return;
      }
    } else {
      payload = {
        username: String(form.get("username") || "").trim(),
        email: String(form.get("email") || "").trim(),
        password,
      };

      endpoint = "/auth/register";

      if (!payload.username || !payload.email || !payload.password) {
        setError("Vui lòng nhập đầy đủ thông tin đăng ký.");
        setBusy(false);
        return;
      }

      if (payload.username.length < 3) {
        setError("Tên tài khoản phải có ít nhất 3 ký tự.");
        setBusy(false);
        return;
      }

      if (payload.password.length < 6) {
        setError("Mật khẩu phải có ít nhất 6 ký tự.");
        setBusy(false);
        return;
      }
    }

    try {
      const result = await request(endpoint, "", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const newToken =
        result.token ||
        result.accessToken ||
        result.data?.token ||
        result.data?.accessToken;

      if (!newToken) {
        throw new Error(
          result.message ||
            "Máy chủ không trả về token đăng nhập. Hãy kiểm tra backend."
        );
      }

      saveToken(newToken);
      setToken(newToken);

      setNotice(
        authMode === "login"
          ? "Đăng nhập thành công!"
          : "Đăng ký thành công!"
      );

      setPage("overview");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  /* -------------------------------------------------------
     MEMBER ACTIONS
  ------------------------------------------------------- */

  async function submitWithdrawal(event) {
    event.preventDefault();

    const form = new FormData(event.currentTarget);
    const amount = Number(form.get("amount"));
    const method = String(form.get("method") || "").trim();
    const account = String(form.get("account") || "").trim();

    if (!amount || amount <= 0 || !method || !account) {
      setError("Vui lòng nhập đầy đủ thông tin rút tiền.");
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");

    try {
      await request("/withdrawals", token, {
        method: "POST",
        body: JSON.stringify({ amount, method, account }),
      });

      setNotice("Đã gửi yêu cầu rút tiền.");
      event.currentTarget.reset();
      await loadData(token);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  /* -------------------------------------------------------
     ADMIN ACTIONS
  ------------------------------------------------------- */

  async function adminUpdateUser(userId, action, value) {
    setBusy(true);
    setError("");
    setNotice("");

    try {
      await request(`/admin/users/${userId}`, token, {
        method: "PATCH",
        body: JSON.stringify({ action, value }),
      });

      setNotice("Đã cập nhật thành viên.");
      await loadData(token);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function adminProcessWithdrawal(id, status) {
    setBusy(true);
    setError("");
    setNotice("");

    try {
      await request(`/admin/withdrawals/${id}`, token, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });

      setNotice("Đã cập nhật yêu cầu rút tiền.");
      await loadData(token);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function adminCreateTask(event) {
    event.preventDefault();

    const form = new FormData(event.currentTarget);
    const payload = {
      title: String(form.get("title") || "").trim(),
      description: String(form.get("description") || "").trim(),
      reward: Number(form.get("reward")),
      url: String(form.get("url") || "").trim(),
    };

    if (!payload.title || !payload.reward || payload.reward <= 0) {
      setError("Vui lòng nhập tên nhiệm vụ và phần thưởng hợp lệ.");
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");

    try {
      await request("/admin/tasks", token, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setNotice("Đã tạo nhiệm vụ.");
      event.currentTarget.reset();
      await loadData(token);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const filteredMembers = useMemo(() => {
    const value = query.trim().toLowerCase();

    if (!value) return members;

    return members.filter((member) => {
      const text = [
        member.username,
        member.email,
        member.role,
        member.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return text.includes(value);
    });
  }, [members, query]);

  /* -------------------------------------------------------
     AUTH SCREEN
  ------------------------------------------------------- */

  if (!token || !user) {
    return (
      <AuthScreen
        authMode={authMode}
        setAuthMode={setAuthMode}
        submitAuth={submitAuth}
        busy={busy}
        error={error}
        notice={notice}
      />
    );
  }

  /* -------------------------------------------------------
     MAIN DASHBOARD
  ------------------------------------------------------- */

  const navItems = [
    { id: "overview", label: "Tổng quan", icon: LayoutDashboard },
    { id: "tasks", label: "Nhiệm vụ", icon: ClipboardList },
    { id: "offerwall", label: "Offerwall", icon: Gift },
    { id: "wallet", label: "Ví của tôi", icon: Wallet },
    { id: "withdraw", label: "Rút tiền", icon: ArrowDownToLine },
    { id: "history", label: "Lịch sử", icon: History },
    ...(isAdmin
      ? [
          { id: "members", label: "Thành viên", icon: Users },
          {
            id: "adminWithdrawals",
            label: "Quản lý rút tiền",
            icon: ShieldCheck,
          },
          {
            id: "adminTasks",
            label: "Quản lý nhiệm vụ",
            icon: Settings,
          },
        ]
      : []),
  ];

  function changePage(id) {
    setPage(id);
    setMobileOpen(false);
    setError("");
    setNotice("");
  }

  return (
    <div className="eh-app">
      <style>{APP_CSS}</style>

      {mobileOpen && (
        <button
          className="eh-mobile-overlay"
          onClick={() => setMobileOpen(false)}
          aria-label="Đóng menu"
        />
      )}

      <aside className={`eh-sidebar ${mobileOpen ? "eh-sidebar-open" : ""}`}>
        <div className="eh-brand">
          <div className="eh-brand-icon">
            <Coins size={25} />
          </div>
          <div>
            <strong>EarnHub</strong>
            <span>PRO REWARDS</span>
          </div>
          <button
            className="eh-icon-button eh-close-menu"
            onClick={() => setMobileOpen(false)}
            aria-label="Đóng menu"
          >
            <X size={19} />
          </button>
        </div>

        <div className="eh-sidebar-label">MENU CHÍNH</div>

        <nav className="eh-nav">
          {navItems.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                className={`eh-nav-item ${
                  page === item.id ? "active" : ""
                }`}
                onClick={() => changePage(item.id)}
              >
                <Icon size={19} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="eh-sidebar-bottom">
          <div className="eh-sidebar-user">
            <div className="eh-avatar">
              {(user.username || user.email || "U")
                .charAt(0)
                .toUpperCase()}
            </div>
            <div className="eh-user-info">
              <strong>{user.username || "Thành viên"}</strong>
              <span>{isAdmin ? "Quản trị viên" : "Thành viên"}</span>
            </div>
          </div>

          <button className="eh-logout" onClick={logout}>
            <LogOut size={18} />
            Đăng xuất
          </button>
        </div>
      </aside>

      <main className="eh-main">
        <header className="eh-topbar">
          <div className="eh-topbar-left">
            <button
              className="eh-icon-button eh-menu-button"
              onClick={() => setMobileOpen(true)}
              aria-label="Mở menu"
            >
              <Menu size={21} />
            </button>

            <div>
              <div className="eh-page-eyebrow">EARNHUB PRO</div>
              <h1>{getPageTitle(page)}</h1>
            </div>
          </div>

          <div className="eh-topbar-right">
            <div className="eh-top-balance">
              <Wallet size={17} />
              <span>{money(wallet.points)} điểm</span>
            </div>
            <button
              className="eh-icon-button"
              onClick={() => loadData(token)}
              title="Tải lại dữ liệu"
            >
              <RefreshCw size={18} className={loading ? "eh-spin" : ""} />
            </button>
            <div className="eh-top-avatar">
              {(user.username || "U").charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        <section className="eh-content">
          {error && (
            <div className="eh-alert eh-alert-error">
              <AlertCircle size={18} />
              <span>{error}</span>
              <button onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}

          {notice && (
            <div className="eh-alert eh-alert-success">
              <CheckCircle2 size={18} />
              <span>{notice}</span>
              <button onClick={() => setNotice("")}>
                <X size={16} />
              </button>
            </div>
          )}

          {loading && (
            <div className="eh-loading">
              <RefreshCw size={16} className="eh-spin" />
              Đang tải dữ liệu...
            </div>
          )}

          {page === "overview" && (
            <OverviewPage
              user={user}
              wallet={wallet}
              tasks={tasks}
              withdrawals={withdrawals}
              dashboard={dashboard}
              isAdmin={isAdmin}
              changePage={changePage}
            />
          )}

          {page === "tasks" && (
            <TasksPage tasks={tasks} isAdmin={isAdmin} />
          )}

          {page === "offerwall" && <OfferwallPage token={token} />}

          {page === "wallet" && (
            <WalletPage wallet={wallet} changePage={changePage} />
          )}

          {page === "withdraw" && (
            <WithdrawPage
              wallet={wallet}
              withdrawals={withdrawals}
              submitWithdrawal={submitWithdrawal}
              busy={busy}
            />
          )}

          {page === "history" && (
            <HistoryPage wallet={wallet} withdrawals={withdrawals} />
          )}

          {page === "members" && isAdmin && (
            <MembersPage
              members={filteredMembers}
              query={query}
              setQuery={setQuery}
              updateUser={adminUpdateUser}
              busy={busy}
            />
          )}

          {page === "adminWithdrawals" && isAdmin && (
            <AdminWithdrawalsPage
              withdrawals={adminWithdrawals}
              processWithdrawal={adminProcessWithdrawal}
              busy={busy}
            />
          )}

          {page === "adminTasks" && isAdmin && (
            <AdminTasksPage
              tasks={tasks}
              createTask={adminCreateTask}
              busy={busy}
            />
          )}
        </section>

        <footer className="eh-footer">
          EarnHub Pro © {new Date().getFullYear()} · Nền tảng nhiệm vụ trực tuyến
        </footer>
      </main>
    </div>
  );
}

/* =========================================================
   AUTH SCREEN
========================================================= */

function AuthScreen({
  authMode,
  setAuthMode,
  submitAuth,
  busy,
  error,
  notice,
}) {
  const isLogin = authMode === "login";

  return (
    <div className="eh-auth">
      <style>{APP_CSS}</style>

      <div className="eh-auth-decoration eh-decoration-one" />
      <div className="eh-auth-decoration eh-decoration-two" />

      <div className="eh-auth-card">
        <div className="eh-auth-logo">
          <div className="eh-brand-icon">
            <Coins size={27} />
          </div>
          <div>
            <strong>EarnHub Pro</strong>
            <span>REWARDS PLATFORM</span>
          </div>
        </div>

        <div className="eh-auth-heading">
          <div className="eh-auth-tag">
            <ShieldCheck size={14} />
            NỀN TẢNG KIẾM THƯỞNG
          </div>

          <h1>{isLogin ? "Chào mừng trở lại!" : "Tạo tài khoản mới"}</h1>

          <p>
            {isLogin
              ? "Đăng nhập để tiếp tục sử dụng EarnHub Pro."
              : "Đăng ký để bắt đầu trải nghiệm EarnHub Pro."}
          </p>
        </div>

        {error && (
          <div className="eh-alert eh-alert-error">
            <AlertCircle size={17} />
            <span>{error}</span>
          </div>
        )}

        {notice && (
          <div className="eh-alert eh-alert-success">
            <CheckCircle2 size={17} />
            <span>{notice}</span>
          </div>
        )}

        <form className="eh-auth-form" onSubmit={submitAuth}>
          {isLogin ? (
            <label className="eh-field">
              <span>Tên tài khoản hoặc Gmail</span>
              <div className="eh-input-wrap">
                <User size={18} />
                <input
                  type="text"
                  name="identity"
                  placeholder="Nhập tên tài khoản hoặc Gmail"
                  autoComplete="username"
                  required
                />
              </div>
            </label>
          ) : (
            <>
              <label className="eh-field">
                <span>Tên tài khoản</span>
                <div className="eh-input-wrap">
                  <User size={18} />
                  <input
                    type="text"
                    name="username"
                    placeholder="Nhập tên tài khoản"
                    autoComplete="username"
                    minLength={3}
                    required
                  />
                </div>
              </label>

              <label className="eh-field">
                <span>Địa chỉ Gmail</span>
                <div className="eh-input-wrap">
                  <span className="eh-at">@</span>
                  <input
                    type="email"
                    name="email"
                    placeholder="example@gmail.com"
                    autoComplete="email"
                    required
                  />
                </div>
              </label>
            </>
          )}

          <label className="eh-field">
            <span>Mật khẩu</span>
            <div className="eh-input-wrap">
              <Lock size={18} />
              <input
                type="password"
                name="password"
                placeholder="Nhập mật khẩu"
                autoComplete={isLogin ? "current-password" : "new-password"}
                minLength={isLogin ? undefined : 6}
                required
              />
            </div>
          </label>

          <button
            type="submit"
            className="eh-primary-button eh-auth-submit"
            disabled={busy}
          >
            {busy ? (
              <>
                <RefreshCw size={18} className="eh-spin" />
                Đang xử lý...
              </>
            ) : isLogin ? (
              <>
                <KeyRound size={18} />
                Đăng nhập
              </>
            ) : (
              <>
                <Plus size={18} />
                Tạo tài khoản
              </>
            )}
          </button>
        </form>

        <div className="eh-auth-switch">
          {isLogin ? "Bạn chưa có tài khoản?" : "Bạn đã có tài khoản?"}
          <button
            type="button"
            onClick={() => setAuthMode(isLogin ? "register" : "login")}
          >
            {isLogin ? "Đăng ký ngay" : "Đăng nhập"}
          </button>
        </div>

        <div className="eh-auth-security">
          <ShieldCheck size={15} />
          Thông tin tài khoản được bảo vệ
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   OVERVIEW
========================================================= */

function OverviewPage({
  user,
  wallet,
  tasks,
  withdrawals,
  dashboard,
  isAdmin,
  changePage,
}) {
  const completedTasks = tasks.filter(
    (task) =>
      task.status === "completed" ||
      task.completed === true ||
      task.status === "done"
  ).length;

  return (
    <>
      <div className="eh-welcome">
        <div>
          <div className="eh-section-tag">DASHBOARD</div>
          <h2>
            Xin chào, {user.username || "thành viên"} <span>👋</span>
          </h2>
          <p>
            {isAdmin
              ? "Chào mừng bạn quay lại khu vực quản trị EarnHub Pro."
              : "Theo dõi số dư và khám phá các nhiệm vụ mới hôm nay."}
          </p>
        </div>

        <div className="eh-welcome-icon">
          <Gamepad2 size={36} />
        </div>
      </div>

      <div className="eh-stat-grid">
        <StatCard
          label="Số dư điểm"
          value={money(wallet.points)}
          unit="điểm"
          icon={Coins}
          tone="purple"
        />

        <StatCard
          label="Giá trị ví"
          value={`${money(wallet.balanceVND)}đ`}
          unit="Số dư hiện tại"
          icon={Wallet}
          tone="blue"
        />

        <StatCard
          label="Nhiệm vụ"
          value={money(tasks.length)}
          unit="Nhiệm vụ khả dụng"
          icon={ClipboardList}
          tone="orange"
        />

        <StatCard
          label="Yêu cầu rút"
          value={money(withdrawals.length)}
          unit="Lịch sử rút tiền"
          icon={ArrowDownToLine}
          tone="green"
        />
      </div>

      {isAdmin && (
        <div className="eh-admin-summary">
          <div className="eh-section-heading">
            <div>
              <div className="eh-section-tag">ADMINISTRATION</div>
              <h3>Tổng quan hệ thống</h3>
            </div>
            <ShieldCheck size={22} />
          </div>

          <div className="eh-mini-grid">
            <MiniStat
              label="Tổng thành viên"
              value={dashboard.totalUsers ?? dashboard.users ?? "—"}
            />
            <MiniStat
              label="Tổng nhiệm vụ"
              value={dashboard.totalTasks ?? dashboard.tasks ?? "—"}
            />
            <MiniStat
              label="Yêu cầu rút"
              value={
                dashboard.pendingWithdrawals ??
                dashboard.pending ??
                "—"
              }
            />
          </div>
        </div>
      )}

      <div className="eh-section-heading eh-section-space">
        <div>
          <div className="eh-section-tag">QUICK ACCESS</div>
          <h3>Truy cập nhanh</h3>
        </div>
      </div>

      <div className="eh-quick-grid">
        <QuickCard
          icon={ClipboardList}
          title="Nhiệm vụ"
          description="Khám phá các nhiệm vụ đang có"
          onClick={() => changePage("tasks")}
        />
        <QuickCard
          icon={Gift}
          title="Offerwall"
          description="Nhiệm vụ từ đối tác"
          onClick={() => changePage("offerwall")}
        />
        <QuickCard
          icon={Wallet}
          title="Ví của tôi"
          description="Kiểm tra số dư tài khoản"
          onClick={() => changePage("wallet")}
        />
        <QuickCard
          icon={ArrowDownToLine}
          title="Rút tiền"
          description="Gửi yêu cầu rút tiền"
          onClick={() => changePage("withdraw")}
        />
      </div>

      <div className="eh-panel eh-panel-space">
        <div className="eh-section-heading">
          <div>
            <div className="eh-section-tag">RECENT ACTIVITY</div>
            <h3>Giao dịch gần đây</h3>
          </div>
          <button
            className="eh-text-button"
            onClick={() => changePage("history")}
          >
            Xem tất cả
          </button>
        </div>

        <TransactionTable transactions={wallet.transactions.slice(0, 5)} />
      </div>
    </>
  );
}

/* =========================================================
   TASKS
========================================================= */

function TasksPage({ tasks }) {
  return (
    <div className="eh-page-stack">
      <div className="eh-page-intro">
        <div className="eh-section-tag">AVAILABLE TASKS</div>
        <h2>Nhiệm vụ dành cho bạn</h2>
        <p>Danh sách nhiệm vụ được cung cấp bởi hệ thống.</p>
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Chưa có nhiệm vụ"
          description="Hiện tại chưa có nhiệm vụ nào được đăng."
        />
      ) : (
        <div className="eh-task-grid">
          {tasks.map((task, index) => (
            <div className="eh-task-card" key={task._id || task.id || index}>
              <div className="eh-task-icon">
                <Activity size={22} />
              </div>

              <div className="eh-task-content">
                <h3>{task.title || task.name || "Nhiệm vụ"}</h3>
                <p>{task.description || "Hoàn thành nhiệm vụ theo hướng dẫn."}</p>

                <div className="eh-task-bottom">
                  <strong>
                    +{money(task.reward ?? task.points ?? 0)} điểm
                  </strong>

                  {task.url ? (
                    <a
                      href={safeHttpUrl(task.url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="eh-small-button"
                    >
                      Thực hiện <ExternalLink size={14} />
                    </a>
                  ) : (
                    <span className="eh-muted">Chưa có liên kết</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* =========================================================
   OFFERWALL
========================================================= */

function OfferwallPage({ token }) {
  const [tab, setTab] = useState("tasks");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [source, setSource] = useState("");

  const tabs = [
    { id: "tasks", label: "Tasks" },
    { id: "offers", label: "Offers" },
    { id: "surveys", label: "Surveys" },
  ];

  const loadOfferwall = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await request(`/offerwall/${tab}`, token);

      setItems(getArray(result));
      setSource(result.source || "Offerwall");
    } catch (err) {
      setItems([]);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [tab, token]);

  useEffect(() => {
    loadOfferwall();
  }, [loadOfferwall]);

  function openOffer(item) {
    const rawUrl =
      item.url ||
      item.link ||
      item.offer_url ||
      item.click_url ||
      item.tracking_url;

    const url = safeHttpUrl(rawUrl);

    if (!url) {
      setError("Nhiệm vụ này chưa có đường dẫn hợp lệ.");
      return;
    }

    const opened = window.open(url, "_blank", "noopener,noreferrer");

    if (!opened) {
      setError("Trình duyệt đã chặn cửa sổ mới. Hãy cho phép mở liên kết.");
    }
  }

  return (
    <div className="eh-page-stack">
      <div className="eh-page-intro">
        <div className="eh-section-tag">PARTNER OFFERWALL</div>
        <h2>Nhiệm vụ từ đối tác</h2>
        <p>
          Khám phá nhiệm vụ, ưu đãi và khảo sát từ hệ thống đối tác.
        </p>
      </div>

      <div className="eh-offer-info">
        <AlertCircle size={19} />
        <div>
          <strong>Lưu ý về tiền thưởng</strong>
          <p>
            Bạn sẽ được chuyển đến trang của đối tác để thực hiện nhiệm vụ.
            Việc mở liên kết chưa có nghĩa là nhiệm vụ đã hoàn thành hoặc tiền
            đã được cộng. Số dư chỉ được cập nhật khi máy chủ nhận và xác minh
            thông báo postback hợp lệ từ đối tác.
          </p>
        </div>
      </div>

      <div className="eh-tabs">
        {tabs.map((item) => (
          <button
            key={item.id}
            className={tab === item.id ? "active" : ""}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}

        <button
          className="eh-refresh-tab"
          onClick={loadOfferwall}
          disabled={loading}
          title="Tải lại"
        >
          <RefreshCw size={16} className={loading ? "eh-spin" : ""} />
        </button>
      </div>

      {source && <div className="eh-source-label">Nguồn: {source}</div>}

      {error && (
        <div className="eh-alert eh-alert-error">
          <AlertCircle size={17} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="eh-loading eh-loading-large">
          <RefreshCw size={20} className="eh-spin" />
          Đang tải danh sách nhiệm vụ...
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Gift}
          title="Chưa có dữ liệu"
          description="Đối tác hiện chưa trả về nhiệm vụ trong mục này."
        />
      ) : (
        <div className="eh-task-grid">
          {items.map((item, index) => {
            const reward =
              item.reward ??
              item.payout ??
              item.amount ??
              item.points ??
              0;

            const currency =
              item.currency ||
              item.currency_code ||
              item.currencyCode ||
              "";

            return (
              <div
                className="eh-task-card eh-offer-card"
                key={item.id || item.offer_id || item._id || index}
              >
                <div className="eh-task-icon eh-offer-icon">
                  <Gift size={22} />
                </div>

                <div className="eh-task-content">
                  <h3>
                    {item.title ||
                      item.name ||
                      item.offer_name ||
                      "Nhiệm vụ đối tác"}
                  </h3>

                  <p>
                    {item.description ||
                      item.instructions ||
                      "Xem hướng dẫn và điều kiện hoàn thành trên trang đối tác."}
                  </p>

                  <div className="eh-offer-reward">
                    <span>Thưởng hiển thị từ đối tác</span>
                    <strong>
                      {money(reward)} {currency}
                    </strong>
                    {!currency && (
                      <small>
                        Đơn vị đối tác; chưa xác nhận là VNĐ.
                      </small>
                    )}
                  </div>

                  <button
                    className="eh-primary-button eh-offer-button"
                    onClick={() => openOffer(item)}
                  >
                    Mở nhiệm vụ <ExternalLink size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* =========================================================
   WALLET
========================================================= */

function WalletPage({ wallet, changePage }) {
  return (
    <div className="eh-page-stack">
      <div className="eh-page-intro">
        <div className="eh-section-tag">MY WALLET</div>
        <h2>Ví của tôi</h2>
        <p>Thông tin số dư hiện tại của tài khoản.</p>
      </div>

      <div className="eh-wallet-card">
        <div className="eh-wallet-card-top">
          <span>TỔNG SỐ DƯ ĐIỂM</span>
          <Wallet size={23} />
        </div>

        <div className="eh-wallet-amount">
          {money(wallet.points)} <small>điểm</small>
        </div>

        <div className="eh-wallet-vnd">
          Giá trị ví: {money(wallet.balanceVND)} VNĐ
        </div>

        <div className="eh-wallet-actions">
          <button
            className="eh-primary-button"
            onClick={() => changePage("withdraw")}
          >
            <ArrowDownToLine size={17} /> Rút tiền
          </button>

          <button
            className="eh-outline-button"
            onClick={() => changePage("history")}
          >
            <History size={17} /> Lịch sử
          </button>
        </div>
      </div>

      <div className="eh-panel">
        <div className="eh-section-heading">
          <div>
            <div className="eh-section-tag">TRANSACTIONS</div>
            <h3>Lịch sử giao dịch</h3>
          </div>
        </div>
        <TransactionTable transactions={wallet.transactions} />
      </div>
    </div>
  );
}

/* =========================================================
   WITHDRAW
========================================================= */

function WithdrawPage({
  wallet,
  withdrawals,
  submitWithdrawal,
  busy,
}) {
  return (
    <div className="eh-page-stack">
      <div className="eh-page-intro">
        <div className="eh-section-tag">WITHDRAWAL</div>
        <h2>Yêu cầu rút tiền</h2>
        <p>Điền thông tin nhận tiền để gửi yêu cầu đến quản trị viên.</p>
      </div>

      <div className="eh-two-column">
        <div className="eh-panel">
          <h3 className="eh-panel-title">Thông tin rút tiền</h3>

          <div className="eh-available-balance">
            <span>Số dư hiện tại</span>
            <strong>{money(wallet.points)} điểm</strong>
          </div>

          <form className="eh-form" onSubmit={submitWithdrawal}>
            <label className="eh-field">
              <span>Số tiền muốn rút</span>
              <input
                name="amount"
                type="number"
                min="1"
                placeholder="Nhập số tiền"
                required
              />
            </label>

            <label className="eh-field">
              <span>Phương thức nhận tiền</span>
              <select name="method" required defaultValue="">
                <option value="" disabled>
                  Chọn phương thức
                </option>
                <option value="MBBank">MBBank</option>
                <option value="Vietcombank">Vietcombank</option>
                <option value="Techcombank">Techcombank</option>
                <option value="MoMo">MoMo</option>
                <option value="Other">Khác</option>
              </select>
            </label>

            <label className="eh-field">
              <span>Số tài khoản / thông tin nhận tiền</span>
              <input
                name="account"
                type="text"
                placeholder="Nhập số tài khoản hoặc ví"
                required
              />
            </label>

            <button
              type="submit"
              className="eh-primary-button eh-full-button"
              disabled={busy}
            >
              {busy ? "Đang gửi..." : "Gửi yêu cầu rút tiền"}
            </button>
          </form>
        </div>

        <div className="eh-panel">
          <h3 className="eh-panel-title">Lịch sử yêu cầu</h3>
          <WithdrawalList withdrawals={withdrawals} />
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   HISTORY
========================================================= */

function HistoryPage({ wallet, withdrawals }) {
  return (
    <div className="eh-page-stack">
      <div className="eh-page-intro">
        <div className="eh-section-tag">ACTIVITY HISTORY</div>
        <h2>Lịch sử hoạt động</h2>
        <p>Theo dõi giao dịch và các yêu cầu rút tiền.</p>
      </div>

      <div className="eh-panel">
        <h3 className="eh-panel-title">Giao dịch ví</h3>
        <TransactionTable transactions={wallet.transactions} />
      </div>

      <div className="eh-panel">
        <h3 className="eh-panel-title">Yêu cầu rút tiền</h3>
        <WithdrawalList withdrawals={withdrawals} />
      </div>
    </div>
  );
}

/* =========================================================
   ADMIN - MEMBERS
========================================================= */

function MembersPage({
  members,
  query,
  setQuery,
  updateUser,
  busy,
}) {
  return (
    <div className="eh-page-stack">
      <div className="eh-page-intro">
        <div className="eh-section-tag">USER MANAGEMENT</div>
        <h2>Quản lý thành viên</h2>
        <p>Danh sách tài khoản thành viên trên hệ thống.</p>
      </div>

      <div className="eh-panel">
        <div className="eh-search-wrap">
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm theo tên tài khoản hoặc Gmail..."
          />
        </div>

        <div className="eh-table-wrap">
          <table className="eh-table">
            <thead>
              <tr>
                <th>Thành viên</th>
                <th>Email</th>
                <th>Vai trò</th>
                <th>Số dư</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>

            <tbody>
              {members.map((member, index) => {
                const id = member._id || member.id;

                return (
                  <tr key={id || index}>
                    <td>
                      <strong>{member.username || "—"}</strong>
                    </td>
                    <td>{member.email || "—"}</td>
                    <td>{member.role || "user"}</td>
                    <td>{money(member.points ?? member.balance ?? 0)}</td>
                    <td>
                      <StatusBadge
                        status={member.status || (member.active ? "active" : "inactive")}
                      />
                    </td>
                    <td>
                      <div className="eh-table-actions">
                        <button
                          className="eh-mini-action"
                          title="Cộng 100 điểm"
                          disabled={busy || !id}
                          onClick={() => updateUser(id, "addPoints", 100)}
                        >
                          <Plus size={15} />
                        </button>

                        <button
                          className="eh-mini-action"
                          title="Trừ 100 điểm"
                          disabled={busy || !id}
                          onClick={() => updateUser(id, "subtractPoints", 100)}
                        >
                          <Minus size={15} />
                        </button>

                        <button
                          className="eh-mini-action"
                          title="Khóa / mở tài khoản"
                          disabled={busy || !id}
                          onClick={() =>
                            updateUser(
                              id,
                              "toggleStatus",
                              member.status === "active" || member.active
                                ? "inactive"
                                : "active"
                            )
                          }
                        >
                          <Lock size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {members.length === 0 && (
                <tr>
                  <td colSpan="6">
                    <div className="eh-empty-inline">
                      Không tìm thấy thành viên.
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   ADMIN - WITHDRAWALS
========================================================= */

function AdminWithdrawalsPage({
  withdrawals,
  processWithdrawal,
  busy,
}) {
  return (
    <div className="eh-page-stack">
      <div className="eh-page-intro">
        <div className="eh-section-tag">PAYOUT MANAGEMENT</div>
        <h2>Quản lý rút tiền</h2>
        <p>Kiểm tra và xử lý các yêu cầu rút tiền của thành viên.</p>
      </div>

      <div className="eh-panel">
        <div className="eh-table-wrap">
          <table className="eh-table">
            <thead>
              <tr>
                <th>Thành viên</th>
                <th>Số tiền</th>
                <th>Phương thức</th>
                <th>Tài khoản nhận</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>

            <tbody>
              {withdrawals.map((item, index) => {
                const id = item._id || item.id;

                return (
                  <tr key={id || index}>
                    <td>{item.username || item.user?.username || "—"}</td>
                    <td>{money(item.amount ?? item.value ?? 0)}</td>
                    <td>{item.method || "—"}</td>
                    <td>{item.account || item.accountNumber || "—"}</td>
                    <td>
                      <StatusBadge status={item.status || "pending"} />
                    </td>
                    <td>
                      <div className="eh-table-actions">
                        <button
                          className="eh-approve-button"
                          disabled={busy || !id}
                          onClick={() => processWithdrawal(id, "approved")}
                        >
                          <CheckCircle2 size={14} /> Duyệt
                        </button>
                        <button
                          className="eh-reject-button"
                          disabled={busy || !id}
                          onClick={() => processWithdrawal(id, "rejected")}
                        >
                          <XCircle size={14} /> Từ chối
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {withdrawals.length === 0 && (
                <tr>
                  <td colSpan="6">
                    <div className="eh-empty-inline">
                      Chưa có yêu cầu rút tiền.
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   ADMIN - TASKS
========================================================= */

function AdminTasksPage({ tasks, createTask, busy }) {
  return (
    <div className="eh-page-stack">
      <div className="eh-page-intro">
        <div className="eh-section-tag">TASK MANAGEMENT</div>
        <h2>Quản lý nhiệm vụ</h2>
        <p>Tạo nhiệm vụ hiển thị trong khu vực thành viên.</p>
      </div>

      <div className="eh-two-column">
        <div className="eh-panel">
          <h3 className="eh-panel-title">Tạo nhiệm vụ mới</h3>

          <form className="eh-form" onSubmit={createTask}>
            <label className="eh-field">
              <span>Tên nhiệm vụ</span>
              <input
                name="title"
                placeholder="Ví dụ: Theo dõi trang..."
                required
              />
            </label>

            <label className="eh-field">
              <span>Mô tả</span>
              <textarea
                name="description"
                rows="4"
                placeholder="Mô tả hướng dẫn thực hiện..."
              />
            </label>

            <label className="eh-field">
              <span>Phần thưởng (điểm)</span>
              <input
                name="reward"
                type="number"
                min="1"
                placeholder="100"
                required
              />
            </label>

            <label className="eh-field">
              <span>Đường dẫn nhiệm vụ</span>
              <input
                name="url"
                type="url"
                placeholder="https://..."
              />
            </label>

            <button
              className="eh-primary-button eh-full-button"
              type="submit"
              disabled={busy}
            >
              <Plus size={17} /> Tạo nhiệm vụ
            </button>
          </form>
        </div>

        <div className="eh-panel">
          <h3 className="eh-panel-title">
            Nhiệm vụ hiện có ({tasks.length})
          </h3>

          {tasks.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="Chưa có nhiệm vụ"
              description="Các nhiệm vụ đã tạo sẽ hiển thị ở đây."
            />
          ) : (
            <div className="eh-admin-task-list">
              {tasks.map((task, index) => (
                <div
                  className="eh-admin-task"
                  key={task._id || task.id || index}
                >
                  <div>
                    <strong>{task.title || task.name || "Nhiệm vụ"}</strong>
                    <span>
                      {money(task.reward ?? task.points ?? 0)} điểm
                    </span>
                  </div>
                  <StatusBadge status={task.active === false ? "inactive" : "active"} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   REUSABLE COMPONENTS
========================================================= */

function StatCard({ label, value, unit, icon: Icon, tone }) {
  return (
    <div className="eh-stat-card">
      <div className={`eh-stat-icon ${tone}`}>
        <Icon size={22} />
      </div>
      <div className="eh-stat-label">{label}</div>
      <div className="eh-stat-value">{value}</div>
      <div className="eh-stat-unit">{unit}</div>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="eh-mini-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function QuickCard({ icon: Icon, title, description, onClick }) {
  return (
    <button className="eh-quick-card" onClick={onClick}>
      <div className="eh-quick-icon">
        <Icon size={21} />
      </div>
      <div>
        <strong>{title}</strong>
        <span>{description}</span>
      </div>
      <ExternalLink size={15} className="eh-quick-arrow" />
    </button>
  );
}

function TransactionTable({ transactions = [] }) {
  if (!transactions.length) {
    return (
      <EmptyState
        icon={History}
        title="Chưa có giao dịch"
        description="Giao dịch của bạn sẽ hiển thị tại đây."
      />
    );
  }

  return (
    <div className="eh-table-wrap">
      <table className="eh-table">
        <thead>
          <tr>
            <th>Loại giao dịch</th>
            <th>Số điểm</th>
            <th>Trạng thái</th>
            <th>Thời gian</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((item, index) => (
            <tr key={item._id || item.id || index}>
              <td>{item.description || item.type || item.title || "Giao dịch"}</td>
              <td className={Number(item.amount ?? item.points ?? 0) >= 0 ? "eh-positive" : "eh-negative"}>
                {Number(item.amount ?? item.points ?? 0) > 0 ? "+" : ""}
                {money(item.amount ?? item.points ?? 0)}
              </td>
              <td>
                <StatusBadge status={item.status || "completed"} />
              </td>
              <td>{formatDate(item.createdAt || item.date)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WithdrawalList({ withdrawals = [] }) {
  if (!withdrawals.length) {
    return (
      <EmptyState
        icon={ArrowDownToLine}
        title="Chưa có yêu cầu"
        description="Bạn chưa gửi yêu cầu rút tiền nào."
      />
    );
  }

  return (
    <div className="eh-withdrawal-list">
      {withdrawals.map((item, index) => (
        <div className="eh-withdrawal-item" key={item._id || item.id || index}>
          <div className="eh-withdrawal-icon">
            <ArrowDownToLine size={18} />
          </div>
          <div className="eh-withdrawal-info">
            <strong>{money(item.amount ?? item.value ?? 0)}</strong>
            <span>
              {item.method || "Phương thức chưa rõ"} ·{" "}
              {formatDate(item.createdAt || item.date)}
            </span>
          </div>
          <StatusBadge status={item.status || "pending"} />
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status }) {
  const normalized = String(status || "").toLowerCase();

  let label = status || "Không rõ";
  let type = "neutral";

  if (
    ["active", "approved", "completed", "success", "done"].includes(
      normalized
    )
  ) {
    type = "success";
    label =
      normalized === "active"
        ? "Hoạt động"
        : normalized === "approved"
        ? "Đã duyệt"
        : "Hoàn thành";
  } else if (
    ["pending", "processing", "waiting"].includes(normalized)
  ) {
    type = "warning";
    label = "Đang chờ";
  } else if (
    ["inactive", "rejected", "failed", "blocked"].includes(normalized)
  ) {
    type = "danger";
    label =
      normalized === "inactive"
        ? "Đã khóa"
        : normalized === "rejected"
        ? "Từ chối"
        : "Thất bại";
  }

  return <span className={`eh-status ${type}`}>{label}</span>;
}

function EmptyState({ icon: Icon, title, description }) {
  return (
    <div className="eh-empty">
      <div className="eh-empty-icon">
        <Icon size={25} />
      </div>
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

function safeHttpUrl(value) {
  if (!value) return "";

  try {
    const url = new URL(String(value));

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "";
    }

    return url.href;
  } catch {
    return "";
  }
}

function getPageTitle(page) {
  const titles = {
    overview: "Tổng quan",
    tasks: "Nhiệm vụ",
    offerwall: "Offerwall",
    wallet: "Ví của tôi",
    withdraw: "Rút tiền",
    history: "Lịch sử",
    members: "Thành viên",
    adminWithdrawals: "Quản lý rút tiền",
    adminTasks: "Quản lý nhiệm vụ",
  };

  return titles[page] || "Tổng quan";
}

/* =========================================================
   RESPONSIVE CSS
========================================================= */

const APP_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&display=swap');

:root {
  font-family: 'Be Vietnam Pro', Arial, sans-serif;
  color: #edf0ff;
  background: #090b16;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
}

* {
  box-sizing: border-box;
}

html, body, #root {
  min-height: 100%;
  margin: 0;
  width: 100%;
}

body {
  background: #090b16;
}

button, input, textarea, select {
  font: inherit;
}

button {
  cursor: pointer;
}

button:disabled {
  cursor: not-allowed;
  opacity: .6;
}

a {
  color: inherit;
  text-decoration: none;
}

.eh-app {
  min-height: 100vh;
  display: flex;
  background:
    radial-gradient(circle at 75% 0%, rgba(93, 67, 190, .12), transparent 28%),
    #090b16;
  color: #edf0ff;
}

.eh-sidebar {
  width: 252px;
  flex: 0 0 252px;
  min-height: 100vh;
  padding: 25px 17px;
  display: flex;
  flex-direction: column;
  background: #0e1020;
  border-right: 1px solid rgba(255,255,255,.07);
  position: sticky;
  top: 0;
  height: 100vh;
  z-index: 30;
}

.eh-brand, .eh-auth-logo {
  display: flex;
  align-items: center;
  gap: 12px;
}

.eh-brand {
  padding: 0 8px 30px;
}

.eh-brand-icon {
  width: 46px;
  height: 46px;
  flex: 0 0 46px;
  border-radius: 15px;
  display: grid;
  place-items: center;
  color: white;
  background: linear-gradient(135deg, #8057ff, #4c35c9);
  box-shadow: 0 8px 25px rgba(111, 78, 255, .25);
}

.eh-brand strong, .eh-auth-logo strong {
  display: block;
  font-size: 19px;
  font-weight: 800;
  letter-spacing: -.5px;
}

.eh-brand span, .eh-auth-logo span {
  display: block;
  color: #8c91ad;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 2px;
  margin-top: 3px;
}

.eh-sidebar-label, .eh-section-tag, .eh-page-eyebrow {
  color: #858ba9;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 1.6px;
}

.eh-sidebar-label {
  padding: 0 12px 13px;
}

.eh-nav {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.eh-nav-item {
  border: 0;
  background: transparent;
  color: #a5aac2;
  border-radius: 11px;
  min-height: 46px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 13px;
  text-align: left;
  font-size: 13px;
  font-weight: 600;
  transition: .2s;
  width: 100%;
}

.eh-nav-item:hover, .eh-nav-item.active {
  color: white;
  background: linear-gradient(90deg, rgba(124, 91, 255, .2), rgba(124, 91, 255, .06));
}

.eh-nav-item.active {
  box-shadow: inset 3px 0 #9678ff;
}

.eh-sidebar-bottom {
  margin-top: auto;
  border-top: 1px solid rgba(255,255,255,.08);
  padding-top: 17px;
}

.eh-sidebar-user {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 5px 7px 15px;
  min-width: 0;
}

.eh-avatar, .eh-top-avatar {
  width: 36px;
  height: 36px;
  flex: 0 0 36px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: #493b8e;
  color: white;
  font-weight: 800;
}

.eh-user-info {
  min-width: 0;
}

.eh-user-info strong, .eh-user-info span {
  display: block;
  overflow-wrap: anywhere;
}

.eh-user-info strong {
  font-size: 12px;
}

.eh-user-info span {
  color: #858ba9;
  font-size: 10px;
  margin-top: 3px;
}

.eh-logout {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 10px;
  padding: 11px 12px;
  color: #c2c5d7;
  background: rgba(255,255,255,.025);
  font-size: 12px;
}

.eh-logout:hover {
  color: #ff858e;
  border-color: rgba(255,100,120,.3);
}

.eh-main {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.eh-topbar {
  height: 78px;
  flex: 0 0 78px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 0 34px;
  border-bottom: 1px solid rgba(255,255,255,.07);
  background: rgba(12,14,27,.8);
}

.eh-topbar-left, .eh-topbar-right {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}

.eh-topbar h1 {
  font-size: 17px;
  margin: 3px 0 0;
  font-weight: 700;
}

.eh-page-eyebrow {
  font-size: 8px;
}

.eh-topbar-right {
  color: #c8cbe0;
}

.eh-top-balance {
  display: flex;
  align-items: center;
  gap: 7px;
  background: rgba(129,100,255,.12);
  border: 1px solid rgba(129,100,255,.2);
  border-radius: 20px;
  padding: 9px 13px;
  color: #c7baff;
  font-size: 11px;
  font-weight: 700;
}

.eh-icon-button {
  width: 37px;
  height: 37px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(255,255,255,.1);
  background: rgba(255,255,255,.035);
  color: #c8cbe0;
  border-radius: 10px;
}

.eh-content {
  width: 100%;
  max-width: 1500px;
  margin: 0 auto;
  padding: 30px 34px 45px;
  min-width: 0;
  flex: 1;
}

.eh-footer {
  padding: 18px 34px;
  border-top: 1px solid rgba(255,255,255,.06);
  color: #6f7592;
  font-size: 10px;
  text-align: center;
}

.eh-welcome {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 27px 29px;
  border: 1px solid rgba(151,125,255,.18);
  border-radius: 18px;
  background:
    radial-gradient(circle at 90% 20%, rgba(135,104,255,.2), transparent 30%),
    linear-gradient(110deg, #19172f, #17182b);
  margin-bottom: 22px;
  min-width: 0;
}

.eh-welcome h2 {
  margin: 9px 0 7px;
  font-size: clamp(20px, 3vw, 27px);
  overflow-wrap: anywhere;
}

.eh-welcome p, .eh-page-intro p {
  margin: 0;
  color: #9298b4;
  font-size: 12px;
  line-height: 1.7;
}

.eh-welcome-icon {
  width: 68px;
  height: 68px;
  flex: 0 0 68px;
  border-radius: 20px;
  display: grid;
  place-items: center;
  color: #c7baff;
  background: rgba(135,104,255,.15);
}

.eh-stat-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 15px;
}

.eh-stat-card, .eh-panel, .eh-quick-card, .eh-task-card, .eh-mini-stat {
  min-width: 0;
  border: 1px solid rgba(255,255,255,.075);
  background: #111426;
  border-radius: 15px;
}

.eh-stat-card {
  padding: 19px;
}

.eh-stat-icon {
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  border-radius: 12px;
  margin-bottom: 17px;
}

.eh-stat-icon.purple { background: rgba(143,105,255,.15); color: #ae94ff; }
.eh-stat-icon.blue { background: rgba(69,151,255,.14); color: #78baff; }
.eh-stat-icon.orange { background: rgba(255,168,76,.13); color: #ffbd72; }
.eh-stat-icon.green { background: rgba(68,210,151,.13); color: #70e3b3; }

.eh-stat-label, .eh-stat-unit {
  color: #9298b4;
  font-size: 11px;
}

.eh-stat-value {
  font-size: clamp(20px, 2.5vw, 26px);
  font-weight: 800;
  margin: 7px 0 3px;
  overflow-wrap: anywhere;
}

.eh-admin-summary, .eh-panel {
  padding: 21px;
}

.eh-admin-summary {
  margin-top: 22px;
  border: 1px solid rgba(255,255,255,.075);
  border-radius: 15px;
  background: #111426;
}

.eh-section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 15px;
  margin-bottom: 17px;
}

.eh-section-heading h3, .eh-panel-title {
  font-size: 15px;
  margin: 6px 0 0;
}

.eh-mini-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0,1fr));
  gap: 12px;
}

.eh-mini-stat {
  padding: 15px;
}

.eh-mini-stat span, .eh-mini-stat strong {
  display: block;
}

.eh-mini-stat span {
  color: #9399b3;
  font-size: 11px;
}

.eh-mini-stat strong {
  font-size: 22px;
  margin-top: 8px;
}

.eh-section-space {
  margin-top: 28px;
}

.eh-quick-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0,1fr));
  gap: 12px;
}

.eh-quick-card {
  display: flex;
  align-items: center;
  gap: 13px;
  padding: 17px;
  text-align: left;
  color: #edf0ff;
  transition: .2s;
}

.eh-quick-card:hover {
  border-color: rgba(147,119,255,.4);
  transform: translateY(-2px);
}

.eh-quick-icon, .eh-empty-icon {
  width: 42px;
  height: 42px;
  flex: 0 0 42px;
  display: grid;
  place-items: center;
  border-radius: 12px;
  background: rgba(130,100,255,.14);
  color: #b7a3ff;
}

.eh-quick-card strong, .eh-quick-card span {
  display: block;
}

.eh-quick-card strong {
  font-size: 12px;
}

.eh-quick-card span {
  color: #8f95b0;
  font-size: 10px;
  margin-top: 5px;
  line-height: 1.5;
}

.eh-quick-arrow {
  margin-left: auto;
  color: #7d83a0;
  flex: 0 0 auto;
}

.eh-panel-space {
  margin-top: 22px;
}

.eh-text-button {
  border: 0;
  background: none;
  color: #a995ff;
  font-size: 11px;
  font-weight: 700;
}

.eh-page-stack {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-width: 0;
}

.eh-page-intro h2 {
  font-size: 23px;
  margin: 7px 0;
}

.eh-task-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0,1fr));
  gap: 14px;
}

.eh-task-card {
  display: flex;
  gap: 14px;
  padding: 19px;
}

.eh-task-icon {
  width: 43px;
  height: 43px;
  flex: 0 0 43px;
  display: grid;
  place-items: center;
  border-radius: 13px;
  background: rgba(120,100,255,.14);
  color: #b5a2ff;
}

.eh-task-content {
  flex: 1;
  min-width: 0;
}

.eh-task-content h3 {
  margin: 1px 0 8px;
  font-size: 13px;
  overflow-wrap: anywhere;
}

.eh-task-content p {
  color: #9298b4;
  font-size: 11px;
  line-height: 1.7;
  margin: 0;
  overflow-wrap: anywhere;
}

.eh-task-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 17px;
}

.eh-task-bottom strong {
  color: #81e4b8;
  font-size: 12px;
}

.eh-small-button, .eh-primary-button, .eh-outline-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: 9px;
  padding: 10px 14px;
  font-size: 11px;
  font-weight: 700;
}

.eh-small-button, .eh-primary-button {
  color: white;
  border: 0;
  background: linear-gradient(135deg, #805dff, #6544d6);
}

.eh-small-button:hover, .eh-primary-button:hover {
  filter: brightness(1.12);
}

.eh-primary-button:disabled {
  opacity: .6;
}

.eh-outline-button {
  color: #c9c4e9;
  background: rgba(255,255,255,.035);
  border: 1px solid rgba(255,255,255,.12);
}

.eh-offer-info {
  display: flex;
  gap: 12px;
  padding: 16px;
  color: #e5d7a8;
  background: rgba(190,147,57,.09);
  border: 1px solid rgba(190,147,57,.2);
  border-radius: 12px;
}

.eh-offer-info > svg {
  flex: 0 0 auto;
  margin-top: 2px;
}

.eh-offer-info strong {
  font-size: 12px;
}

.eh-offer-info p {
  margin: 5px 0 0;
  color: #b8ad8d;
  font-size: 11px;
  line-height: 1.7;
}

.eh-tabs {
  display: flex;
  align-items: center;
  gap: 7px;
  border-bottom: 1px solid rgba(255,255,255,.08);
  padding-bottom: 10px;
}

.eh-tabs button {
  border: 0;
  border-radius: 8px;
  padding: 9px 16px;
  color: #a3a9c1;
  background: transparent;
  font-size: 11px;
  font-weight: 700;
}

.eh-tabs button.active {
  color: white;
  background: rgba(128,93,255,.2);
}

.eh-tabs .eh-refresh-tab {
  margin-left: auto;
  display: grid;
  place-items: center;
  padding: 9px;
}

.eh-source-label {
  color: #777e9c;
  font-size: 10px;
}

.eh-offer-reward {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 14px;
}

.eh-offer-reward span, .eh-offer-reward small {
  color: #9298b4;
  font-size: 10px;
}

.eh-offer-reward strong {
  color: #82e3b6;
  font-size: 17px;
}

.eh-offer-button {
  margin-top: 13px;
}

.eh-wallet-card {
  padding: 27px;
  border-radius: 18px;
  border: 1px solid rgba(151,125,255,.2);
  background:
    radial-gradient(circle at 85% 0%, rgba(148,113,255,.25), transparent 35%),
    linear-gradient(120deg, #211b43, #17172e);
}

.eh-wallet-card-top {
  display: flex;
  justify-content: space-between;
  color: #b7addf;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 1px;
}

.eh-wallet-amount {
  font-size: clamp(30px, 5vw, 43px);
  font-weight: 800;
  margin: 20px 0 5px;
  overflow-wrap: anywhere;
}

.eh-wallet-amount small {
  font-size: 14px;
  color: #aaa1d1;
}

.eh-wallet-vnd {
  color: #a5a1c1;
  font-size: 11px;
}

.eh-wallet-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 24px;
}

.eh-two-column {
  display: grid;
  grid-template-columns: repeat(2, minmax(0,1fr));
  gap: 16px;
  align-items: start;
}

.eh-form {
  display: flex;
  flex-direction: column;
  gap: 15px;
  margin-top: 18px;
}

.eh-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.eh-field > span {
  color: #c4c8dc;
  font-size: 11px;
  font-weight: 600;
}

.eh-field input, .eh-field textarea, .eh-field select,
.eh-search-wrap input {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  color: #f1f1ff;
  background: #0b0e1c;
  border: 1px solid rgba(255,255,255,.11);
  border-radius: 9px;
  padding: 12px 13px;
  outline: none;
  font-size: 12px;
}

.eh-field input:focus, .eh-field textarea:focus, .eh-field select:focus,
.eh-search-wrap input:focus {
  border-color: #876aff;
  box-shadow: 0 0 0 3px rgba(135,106,255,.1);
}

.eh-field textarea {
  resize: vertical;
}

.eh-field select option {
  background: #111426;
}

.eh-full-button {
  width: 100%;
  min-height: 43px;
}

.eh-available-balance {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  padding: 13px;
  border-radius: 9px;
  background: rgba(128,93,255,.1);
  color: #aaa2ce;
  font-size: 11px;
}

.eh-available-balance strong {
  color: #c9baff;
}

.eh-table-wrap {
  width: 100%;
  overflow-x: auto;
  overscroll-behavior-x: contain;
}

.eh-table {
  width: 100%;
  min-width: 650px;
  border-collapse: collapse;
  text-align: left;
}

.eh-table th {
  padding: 12px 11px;
  color: #858ba8;
  font-size: 10px;
  font-weight: 700;
  border-bottom: 1px solid rgba(255,255,255,.08);
  white-space: nowrap;
}

.eh-table td {
  padding: 13px 11px;
  color: #c2c6d9;
  font-size: 11px;
  border-bottom: 1px solid rgba(255,255,255,.055);
  overflow-wrap: anywhere;
}

.eh-table tbody tr:last-child td {
  border-bottom: 0;
}

.eh-positive { color: #76dfb0 !important; }
.eh-negative { color: #ff8e9c !important; }

.eh-status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 5px 8px;
  border-radius: 20px;
  font-size: 9px;
  font-weight: 700;
  white-space: nowrap;
}

.eh-status.success { color: #75e0b2; background: rgba(72,204,146,.12); }
.eh-status.warning { color: #f0c477; background: rgba(228,173,75,.12); }
.eh-status.danger { color: #ff8c9a; background: rgba(240,89,111,.12); }
.eh-status.neutral { color: #aeb4ca; background: rgba(255,255,255,.08); }

.eh-search-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: 420px;
  margin-bottom: 18px;
  padding-left: 12px;
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 10px;
  color: #8e94b0;
  background: #0b0e1c;
}

.eh-search-wrap input {
  border: 0;
  background: transparent;
}

.eh-table-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.eh-mini-action, .eh-approve-button, .eh-reject-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 7px;
  border-radius: 7px;
  border: 1px solid rgba(255,255,255,.1);
  background: rgba(255,255,255,.04);
  color: #c4c8dc;
  font-size: 9px;
}

.eh-approve-button {
  color: #7ce0b2;
  border-color: rgba(72,204,146,.2);
}

.eh-reject-button {
  color: #ff929e;
  border-color: rgba(240,89,111,.2);
}

.eh-withdrawal-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 17px;
}

.eh-withdrawal-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  background: rgba(255,255,255,.025);
  border: 1px solid rgba(255,255,255,.06);
  border-radius: 10px;
  min-width: 0;
}

.eh-withdrawal-icon {
  width: 35px;
  height: 35px;
  flex: 0 0 35px;
  display: grid;
  place-items: center;
  border-radius: 10px;
  color: #b8a6ff;
  background: rgba(128,93,255,.13);
}

.eh-withdrawal-info {
  flex: 1;
  min-width: 0;
}

.eh-withdrawal-info strong, .eh-withdrawal-info span {
  display: block;
  overflow-wrap: anywhere;
}

.eh-withdrawal-info strong {
  font-size: 12px;
}

.eh-withdrawal-info span {
  color: #8990aa;
  font-size: 9px;
  margin-top: 4px;
}

.eh-admin-task-list {
  display: flex;
  flex-direction: column;
  gap: 9px;
  margin-top: 17px;
}

.eh-admin-task {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 12px;
  background: rgba(255,255,255,.025);
  border-radius: 9px;
}

.eh-admin-task strong, .eh-admin-task span {
  display: block;
}

.eh-admin-task strong {
  font-size: 11px;
  overflow-wrap: anywhere;
}

.eh-admin-task span {
  color: #83dfb5;
  font-size: 10px;
  margin-top: 5px;
}

.eh-empty {
  min-height: 150px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 22px;
  color: #9298b4;
}

.eh-empty-icon {
  margin-bottom: 12px;
}

.eh-empty strong {
  color: #d8dbeb;
  font-size: 12px;
}

.eh-empty p {
  max-width: 330px;
  color: #858ba7;
  font-size: 10px;
  line-height: 1.7;
  margin: 6px 0 0;
}

.eh-empty-inline {
  padding: 25px;
  text-align: center;
  color: #858ba7;
}

.eh-alert {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 10px;
  margin-bottom: 15px;
  font-size: 11px;
  line-height: 1.6;
  overflow-wrap: anywhere;
}

.eh-alert > svg {
  flex: 0 0 auto;
  margin-top: 1px;
}

.eh-alert button {
  margin-left: auto;
  display: grid;
  place-items: center;
  border: 0;
  background: transparent;
  color: inherit;
}

.eh-alert-error {
  color: #ffabb4;
  border: 1px solid rgba(255,100,120,.2);
  background: rgba(255,80,100,.08);
}

.eh-alert-success {
  color: #8be4bc;
  border: 1px solid rgba(80,220,160,.2);
  background: rgba(80,220,160,.08);
}

.eh-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #aaa2ce;
  font-size: 11px;
  margin-bottom: 13px;
}

.eh-loading-large {
  justify-content: center;
  padding: 35px;
}

.eh-spin {
  animation: eh-spin 1s linear infinite;
}

@keyframes eh-spin {
  to { transform: rotate(360deg); }
}

.eh-auth {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 30px 16px;
  position: relative;
  overflow: hidden;
  background:
    radial-gradient(circle at 20% 20%, rgba(111,78,255,.18), transparent 30%),
    radial-gradient(circle at 85% 80%, rgba(57,120,255,.12), transparent 28%),
    #090b16;
  color: #edf0ff;
}

.eh-auth-decoration {
  position: absolute;
  border-radius: 50%;
  filter: blur(2px);
  pointer-events: none;
}

.eh-decoration-one {
  width: 260px;
  height: 260px;
  border: 1px solid rgba(139,112,255,.14);
  top: -100px;
  right: -80px;
}

.eh-decoration-two {
  width: 350px;
  height: 350px;
  border: 1px solid rgba(139,112,255,.1);
  bottom: -200px;
  left: -120px;
}

.eh-auth-card {
  width: min(100%, 450px);
  position: relative;
  z-index: 1;
  padding: 34px;
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 20px;
  background: rgba(17,20,38,.96);
  box-shadow: 0 25px 90px rgba(0,0,0,.4);
}

.eh-auth-logo {
  justify-content: center;
  margin-bottom: 30px;
}

.eh-auth-heading {
  text-align: center;
  margin-bottom: 25px;
}

.eh-auth-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 10px;
  color: #b6a5ff;
  background: rgba(128,93,255,.12);
  border-radius: 20px;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: .7px;
}

.eh-auth-heading h1 {
  font-size: 24px;
  margin: 15px 0 8px;
}

.eh-auth-heading p {
  color: #9298b4;
  font-size: 11px;
  line-height: 1.6;
  margin: 0;
}

.eh-auth-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.eh-input-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-width: 0;
  padding: 0 12px;
  border: 1px solid rgba(255,255,255,.11);
  border-radius: 10px;
  background: #0b0e1c;
  color: #858ba8;
}

.eh-input-wrap:focus-within {
  border-color: #876aff;
  box-shadow: 0 0 0 3px rgba(135,106,255,.1);
}

.eh-input-wrap input {
  width: 100%;
  min-width: 0;
  height: 45px;
  padding: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: white;
  font-size: 11px;
}

.eh-input-wrap input:focus {
  box-shadow: none;
}

.eh-at {
  color: #9298b4;
  font-size: 15px;
}

.eh-auth-submit {
  min-height: 46px;
  width: 100%;
  margin-top: 5px;
}

.eh-auth-switch {
  text-align: center;
  margin-top: 23px;
  color: #9298b4;
  font-size: 10px;
}

.eh-auth-switch button {
  border: 0;
  background: none;
  color: #b6a3ff;
  font-size: 10px;
  font-weight: 800;
  margin-left: 5px;
}

.eh-auth-security {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: #737b98;
  font-size: 9px;
  margin-top: 24px;
}

.eh-mobile-overlay {
  display: none;
}

.eh-menu-button, .eh-close-menu {
  display: none;
}

@media (max-width: 1100px) {
  .eh-stat-grid {
    grid-template-columns: repeat(2, minmax(0,1fr));
  }

  .eh-content {
    padding-left: 24px;
    padding-right: 24px;
  }

  .eh-topbar {
    padding-left: 24px;
    padding-right: 24px;
  }
}

@media (max-width: 760px) {
  .eh-sidebar {
    position: fixed;
    left: 0;
    top: 0;
    transform: translateX(-105%);
    transition: transform .25s ease;
    box-shadow: 20px 0 60px rgba(0,0,0,.35);
  }

  .eh-sidebar.eh-sidebar-open {
    transform: translateX(0);
  }

  .eh-mobile-overlay {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 25;
    border: 0;
    background: rgba(0,0,0,.6);
  }

  .eh-menu-button, .eh-close-menu {
    display: grid;
  }

  .eh-close-menu {
    margin-left: auto;
  }

  .eh-topbar {
    height: 68px;
    flex-basis: 68px;
    padding: 0 15px;
  }

  .eh-content {
    padding: 20px 15px 35px;
  }

  .eh-top-balance {
    padding: 8px 10px;
  }

  .eh-top-avatar {
    display: none;
  }

  .eh-welcome {
    padding: 21px;
  }

  .eh-two-column {
    grid-template-columns: 1fr;
  }

  .eh-task-grid {
    grid-template-columns: 1fr;
  }

  .eh-footer {
    padding: 16px;
  }
}

@media (max-width: 520px) {
  .eh-stat-grid {
    grid-template-columns: repeat(2, minmax(0,1fr));
    gap: 9px;
  }

  .eh-stat-card {
    padding: 13px;
  }

  .eh-stat-value {
    font-size: 19px;
  }

  .eh-stat-icon {
    width: 34px;
    height: 34px;
    margin-bottom: 12px;
  }

  .eh-quick-grid {
    grid-template-columns: 1fr;
  }

  .eh-mini-grid {
    grid-template-columns: 1fr;
  }

  .eh-welcome-icon {
    display: none;
  }

  .eh-panel {
    padding: 15px;
  }

  .eh-auth-card {
    padding: 25px 19px;
  }

  .eh-auth-heading h1 {
    font-size: 21px;
  }

  .eh-topbar h1 {
    font-size: 14px;
  }

  .eh-top-balance {
    font-size: 9px;
  }
}

@media (max-width: 360px) {
  .eh-stat-grid {
    grid-template-columns: 1fr;
  }

  .eh-topbar-right {
    gap: 6px;
  }

  .eh-top-balance {
    padding: 7px;
  }
}
`;