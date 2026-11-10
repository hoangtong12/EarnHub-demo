
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
  Unlock,
  KeyRound,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Menu,
  X,
  CircleDollarSign,
  AlertCircle,
} from "lucide-react";

const API = (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/+$/, "");

const money = (value) =>
  Number(value || 0).toLocaleString("vi-VN", { maximumFractionDigits: 2 });

const date = (value) => {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleString("vi-VN");
};

async function request(path, token, options = {}) {
  const headers = {
    Accept: "application/json",
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API}${path}`, {
    ...options,
    headers,
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      result.message ||
      result.error ||
      `Yêu cầu thất bại (HTTP ${response.status})`
    );
  }

  return result;
}

function App() {
  const [token, setToken] = useState(
    () => localStorage.getItem("earnhub_token") || ""
  );

  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [page, setPage] = useState("overview");

  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(Boolean(token));

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

  const load = useCallback(async (activeToken = token) => {
    if (!activeToken) return;

    setLoading(true);
    setError("");

    try {
      const [
        meResult,
        walletResult,
        taskResult,
        withdrawalResult,
      ] = await Promise.all([
        request("/auth/me", activeToken),
        request("/wallet", activeToken),
        request("/tasks", activeToken),
        request("/withdrawals", activeToken),
      ]);

      const currentUser =
        meResult.user ||
        meResult.data ||
        meResult;

      setUser(currentUser);

      setWallet({
        points:
          walletResult.points ??
          walletResult.wallet?.points ??
          0,

        balanceVND:
          walletResult.balanceVND ??
          walletResult.wallet?.balanceVND ??
          0,

        transactions:
          walletResult.transactions ||
          walletResult.wallet?.transactions ||
          [],
      });

      setTasks(
        Array.isArray(taskResult)
          ? taskResult
          : taskResult.tasks || taskResult.data || []
      );

      setWithdrawals(
        Array.isArray(withdrawalResult)
          ? withdrawalResult
          : withdrawalResult.withdrawals ||
            withdrawalResult.data ||
            []
      );

      if (currentUser?.role === "admin") {
        const [
          dashResult,
          memberResult,
          adminWithdrawalResult,
        ] = await Promise.all([
          request("/admin/dashboard", activeToken),
          request("/admin/users", activeToken),
          request("/admin/withdrawals", activeToken),
        ]);

        setDashboard(
          dashResult.dashboard ||
          dashResult.data ||
          dashResult
        );

        setMembers(
          Array.isArray(memberResult)
            ? memberResult
            : memberResult.users || memberResult.data || []
        );

        setAdminWithdrawals(
          Array.isArray(adminWithdrawalResult)
            ? adminWithdrawalResult
            : adminWithdrawalResult.withdrawals ||
              adminWithdrawalResult.data ||
              []
        );
      } else {
        setDashboard({});
        setMembers([]);
        setAdminWithdrawals([]);
      }
    } catch (err) {
      setError(err.message || "Không thể tải dữ liệu tài khoản.");

      if (
        /token|unauthorized|unauthenticated|đăng nhập/i.test(
          err.message || ""
        )
      ) {
        localStorage.removeItem("earnhub_token");
        setToken("");
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      load(token);
    } else {
      setLoading(false);
    }
  }, [token, load]);

  async function run(action, successMessage = "Thao tác thành công.") {
    setBusy(true);
    setError("");
    setNotice("");

    try {
      await action();

      setNotice(successMessage);

      await load(token);
    } catch (err) {
      setError(err.message || "Có lỗi xảy ra. Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }

  async function submitAuth(event) {
    event.preventDefault();

    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());

    await run(async () => {
      const result = await request(
        authMode === "login"
          ? "/auth/login"
          : "/auth/register",
        "",
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      );

      const newToken =
        result.token ||
        result.accessToken ||
        result.data?.token;

      if (!newToken) {
        throw new Error("Máy chủ không trả về token đăng nhập.");
      }

      localStorage.setItem("earnhub_token", newToken);

      setToken(newToken);
      setUser(result.user || result.data?.user || null);
      setPage("overview");
    }, authMode === "login"
      ? "Đăng nhập thành công."
      : "Đăng ký thành công."
    );
  }

  function logout() {
    localStorage.removeItem("earnhub_token");

    setToken("");
    setUser(null);
    setPage("overview");

    setWallet({
      points: 0,
      balanceVND: 0,
      transactions: [],
    });

    setNotice("");
    setError("");
  }

  async function createTask(event) {
    event.preventDefault();

    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const payload = Object.fromEntries(form.entries());

    payload.points = Number(payload.points || 0);

    await run(async () => {
      await request("/admin/tasks", token, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      formElement.reset();
    }, "Đã tạo nhiệm vụ DEMO.");
  }

  async function submitWithdrawal(event) {
    event.preventDefault();

    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const payload = Object.fromEntries(form.entries());

    payload.points = Number(payload.points || 0);

    await run(async () => {
      await request("/withdrawals", token, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      formElement.reset();
    }, "Đã gửi yêu cầu rút tiền.");
  }

  async function adjustPoints(member) {
    const raw = window.prompt(
      `Nhập số điểm muốn điều chỉnh cho ${member.username}. Dùng số âm để trừ điểm:`
    );

    if (raw === null || raw.trim() === "") return;

    const points = Number(raw);

    if (!Number.isFinite(points) || points === 0) {
      setError("Số điểm không hợp lệ.");
      return;
    }

    await run(() =>
      request(`/admin/users/${member._id}/points`, token, {
        method: "PATCH",
        body: JSON.stringify({ points }),
      }),
      "Đã cập nhật số dư thành viên."
    );
  }

  async function resetPassword(member) {
    const password = window.prompt(
      `Nhập mật khẩu mới cho ${member.username} (tối thiểu 6 ký tự):`
    );

    if (password === null) return;

    if (password.length < 6) {
      setError("Mật khẩu phải có ít nhất 6 ký tự.");
      return;
    }

    await run(() =>
      request(`/admin/users/${member._id}/password`, token, {
        method: "PATCH",
        body: JSON.stringify({ password }),
      }),
      "Đã đổi mật khẩu thành viên."
    );
  }

  async function toggleMember(member) {
    const nextStatus =
      member.status === "blocked"
        ? "active"
        : "blocked";

    await run(() =>
      request(`/admin/users/${member._id}/status`, token, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      }),
      nextStatus === "blocked"
        ? "Đã khóa tài khoản."
        : "Đã mở khóa tài khoản."
    );
  }

  async function processWithdrawal(item, status) {
    await run(() =>
      request(`/admin/withdrawals/${item._id}`, token, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
      status === "paid"
        ? "Đã xác nhận thanh toán."
        : "Đã từ chối yêu cầu."
    );
  }

  const filteredUsers = useMemo(() => {
    const term = query.trim().toLowerCase();

    if (!term) return members;

    return members.filter((member) =>
      [
        member.username,
        member.email,
        member.status,
        member.role,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(term)
        )
    );
  }, [members, query]);

  const adminNav = [
    {
      id: "overview",
      label: "Tổng quan",
      icon: LayoutDashboard,
    },
    {
      id: "members",
      label: "Thành viên",
      icon: Users,
    },
    {
      id: "withdrawals",
      label: "Yêu cầu rút tiền",
      icon: ArrowDownToLine,
    },
    {
      id: "tasks",
      label: "Quản lý nhiệm vụ",
      icon: ClipboardList,
    },
  ];

  const memberNav = [
    {
      id: "overview",
      label: "Tổng quan",
      icon: LayoutDashboard,
    },
    {
      id: "offerwall",
      label: "Offerwall kiếm thưởng",
      icon: Activity,
    },
    {
      id: "tasks",
      label: "Nhiệm vụ DEMO",
      icon: ClipboardList,
    },
    {
      id: "wallet",
      label: "Ví của tôi",
      icon: Wallet,
    },
    {
      id: "withdraw",
      label: "Rút tiền",
      icon: ArrowDownToLine,
    },
  ];

  const navItems = isAdmin ? adminNav : memberNav;

  function navigate(nextPage) {
    setPage(nextPage);
    setMobileOpen(false);
    setError("");
    setNotice("");
  }

  if (!token) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="brand-mark">
            <CircleDollarSign size={30} />
          </div>

          <h1>EarnHub Pro</h1>

          <p className="muted">
            Nền tảng nhiệm vụ và phần thưởng trực tuyến
          </p>

          <div className="auth-switch">
            <button
              className={authMode === "login" ? "active" : ""}
              onClick={() => setAuthMode("login")}
            >
              Đăng nhập
            </button>

            <button
              className={authMode === "register" ? "active" : ""}
              onClick={() => setAuthMode("register")}
            >
              Đăng ký
            </button>
          </div>

          <form className="stack-form" onSubmit={submitAuth}>
            {authMode === "register" && (
              <label>
                Tên tài khoản
                <input
                  name="username"
                  minLength="3"
                  maxLength="24"
                  required
                  placeholder="Tên đăng nhập"
                />
              </label>
            )}

            <label>
              Email
              <input
                name="email"
                type="email"
                required
                placeholder="you@example.com"
              />
            </label>

            <label>
              Mật khẩu
              <input
                name="password"
                type="password"
                minLength="6"
                required
                placeholder="Mật khẩu"
              />
            </label>

            {error && (
              <div className="alert error">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            {notice && (
              <div className="alert success">
                <CheckCircle2 size={16} />
                {notice}
              </div>
            )}

            <button
              className="btn primary"
              type="submit"
              disabled={busy}
            >
              {busy
                ? "Đang xử lý..."
                : authMode === "login"
                  ? "Đăng nhập"
                  : "Tạo tài khoản"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (loading && !user) {
    return (
      <div className="loading-screen">
        <div className="loader" />
        Đang tải EarnHub Pro...
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
        <div className="sidebar-brand">
          <div className="brand-mark">
            <CircleDollarSign size={25} />
          </div>

          <div>
            <b>EarnHub Pro</b>
            <small>Reward platform</small>
          </div>

          <button
            className="icon-btn mobile-close"
            onClick={() => setMobileOpen(false)}
            aria-label="Đóng menu"
          >
            <X />
          </button>
        </div>

        <div className="sidebar-user">
          <div className="avatar">
            {(user?.username || "U").slice(0, 1).toUpperCase()}
          </div>

          <div>
            <b>{user?.username || "Thành viên"}</b>
            <small>
              {isAdmin ? "Quản trị viên" : "Thành viên"}
            </small>
          </div>
        </div>

        <nav className="side-nav">
          <span className="nav-caption">MENU CHÍNH</span>

          {navItems.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                className={`nav-item ${page === item.id ? "active" : ""}`}
                onClick={() => navigate(item.id)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <button className="logout-btn" onClick={logout}>
          <LogOut size={18} />
          Đăng xuất
        </button>
      </aside>

      {mobileOpen && (
        <button
          className="mobile-backdrop"
          onClick={() => setMobileOpen(false)}
          aria-label="Đóng menu"
        />
      )}

      <main className="main-area">
        <header className="topbar">
          <button
            className="icon-btn mobile-menu"
            onClick={() => setMobileOpen(true)}
            aria-label="Mở menu"
          >
            <Menu />
          </button>

          <div>
            <span className="topbar-eyebrow">EARNHUB PRO</span>
            <h1>
              {navItems.find((item) => item.id === page)?.label ||
                "Tổng quan"}
            </h1>
          </div>

          <div className="topbar-right">
            <span className="user-chip">
              <ShieldCheck size={16} />
              {user?.username}
            </span>

            <button
              className="icon-btn"
              onClick={() => load(token)}
              disabled={loading}
              aria-label="Làm mới"
            >
              <RefreshCw size={18} />
            </button>
          </div>
        </header>

        {(error || notice) && (
          <div className={`global-message ${error ? "error" : "success"}`}>
            {error
              ? <AlertCircle size={17} />
              : <CheckCircle2 size={17} />}

            <span>{error || notice}</span>

            <button
              onClick={() => {
                setError("");
                setNotice("");
              }}
              aria-label="Đóng"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {page === "overview" && isAdmin && (
          <>
            <div className="page-intro">
              <div>
                <h2>Bảng điều khiển quản trị</h2>
                <p className="muted">
                  Theo dõi hoạt động và quản lý EarnHub Pro.
                </p>
              </div>
            </div>

            <div className="stats-grid">
              <Stat
                icon={Users}
                label="Thành viên"
                value={money(dashboard.totalUsers ?? dashboard.usersCount)}
                hint="Tổng tài khoản"
              />

              <Stat
                icon={Wallet}
                label="Tổng điểm"
                value={money(dashboard.totalPoints)}
                hint="Số điểm trong hệ thống"
              />

              <Stat
                icon={ArrowDownToLine}
                label="Yêu cầu rút"
                value={money(dashboard.pendingWithdrawals)}
                hint="Đang chờ xử lý"
              />

              <Stat
                icon={Activity}
                label="Nhiệm vụ"
                value={money(dashboard.totalTasks)}
                hint="Nhiệm vụ hiện có"
              />
            </div>

            <div className="panel">
              <h3>Quản lý nhanh</h3>

              <div className="quick-grid">
                <Quick
                  icon={Users}
                  title="Thành viên"
                  desc="Quản lý tài khoản và số dư"
                  onClick={() => navigate("members")}
                />

                <Quick
                  icon={ArrowDownToLine}
                  title="Rút tiền"
                  desc="Duyệt yêu cầu rút tiền"
                  onClick={() => navigate("withdrawals")}
                />

                <Quick
                  icon={ClipboardList}
                  title="Nhiệm vụ"
                  desc="Tạo nhiệm vụ DEMO"
                  onClick={() => navigate("tasks")}
                />
              </div>
            </div>
          </>
        )}

        {page === "overview" && !isAdmin && (
          <>
            <div className="page-intro">
              <div>
                <h2>Xin chào, {user?.username || "bạn"}!</h2>
                <p className="muted">
                  Hoàn thành nhiệm vụ để tích lũy phần thưởng.
                </p>
              </div>
            </div>

            <div className="balance-card">
              <div>
                <span>SỐ DƯ HIỆN TẠI</span>
                <h2>
                  {money(wallet.balanceVND)}
                  <small> VNĐ</small>
                </h2>
                <p>{money(wallet.points)} điểm</p>
              </div>

              <div className="balance-icon">
                <Wallet size={30} />
              </div>
            </div>

            <div className="quick-grid">
              <Quick
                icon={Activity}
                title="Offerwall kiếm thưởng"
                desc="Nhiệm vụ, offers và khảo sát từ đối tác"
                onClick={() => navigate("offerwall")}
              />

              <Quick
                icon={Wallet}
                title="Ví của tôi"
                desc="Xem số dư và lịch sử giao dịch"
                onClick={() => navigate("wallet")}
              />

              <Quick
                icon={ArrowDownToLine}
                title="Rút tiền"
                desc="Tạo yêu cầu rút tiền"
                onClick={() => navigate("withdraw")}
              />
            </div>

            <div className="panel">
              <div className="panel-head">
                <div>
                  <h3>Giao dịch gần đây</h3>
                  <p className="muted">
                    Các giao dịch mới nhất của bạn.
                  </p>
                </div>
              </div>

              <TransactionTable
                rows={(wallet.transactions || []).slice(0, 5)}
              />
            </div>
          </>
        )}

        {page === "members" && isAdmin && (
          <>
            <div className="page-intro">
              <div>
                <h2>Quản lý thành viên</h2>
                <p className="muted">
                  Tìm kiếm, điều chỉnh điểm và quản lý trạng thái tài khoản.
                </p>
              </div>
            </div>

            <div className="panel">
              <div className="panel-head">
                <h3>Danh sách thành viên ({members.length})</h3>

                <div className="search-box">
                  <Search size={17} />

                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Tìm tên hoặc email..."
                  />
                </div>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Thành viên</th>
                      <th>Email</th>
                      <th>Vai trò</th>
                      <th>Trạng thái</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredUsers.map((member) => (
                      <tr key={member._id}>
                        <td><b>{member.username}</b></td>
                        <td>{member.email}</td>
                        <td>{member.role}</td>

                        <td>
                          <span
                            className={`status-pill ${
                              member.status === "blocked"
                                ? "blocked"
                                : "live"
                            }`}
                          >
                            {member.status === "blocked"
                              ? "Đã khóa"
                              : "Hoạt động"}
                          </span>
                        </td>

                        <td>
                          <div className="action-row">
                            <button
                              className="icon-btn"
                              title="Điều chỉnh điểm"
                              onClick={() => adjustPoints(member)}
                            >
                              <Plus size={16} />
                              <Minus size={16} />
                            </button>

                            <button
                              className="icon-btn"
                              title="Đổi mật khẩu"
                              onClick={() => resetPassword(member)}
                            >
                              <KeyRound size={16} />
                            </button>

                            <button
                              className="icon-btn"
                              title={
                                member.status === "blocked"
                                  ? "Mở khóa"
                                  : "Khóa"
                              }
                              onClick={() => toggleMember(member)}
                            >
                              {member.status === "blocked"
                                ? <Unlock size={16} />
                                : <Lock size={16} />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {filteredUsers.length === 0 && (
                  <div className="empty">
                    Không tìm thấy thành viên.
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {page === "withdrawals" && isAdmin && (
          <div className="panel">
            <div className="panel-head">
              <div>
                <h3>Quản lý yêu cầu rút tiền</h3>
                <p className="muted">
                  Kiểm tra và xử lý yêu cầu của thành viên.
                </p>
              </div>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Thành viên</th>
                    <th>Số tiền</th>
                    <th>Ngân hàng</th>
                    <th>Tài khoản</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>

                <tbody>
                  {adminWithdrawals.map((item) => (
                    <tr key={item._id}>
                      <td>
                        {item.user?.username || item.username || "—"}
                      </td>

                      <td>{money(item.amountVND)} VNĐ</td>
                      <td>{item.bankName}</td>

                      <td>
                        {item.bankAccount}
                        <small>{item.bankHolder}</small>
                      </td>

                      <td>
                        <span className={`status-pill ${item.status}`}>
                          {item.status}
                        </span>
                      </td>

                      <td>
                        {item.status === "pending" ? (
                          <div className="action-row">
                            <button
                              className="btn small primary"
                              disabled={busy}
                              onClick={() =>
                                processWithdrawal(item, "paid")
                              }
                            >
                              <CheckCircle2 size={15} />
                              Duyệt
                            </button>

                            <button
                              className="btn small danger"
                              disabled={busy}
                              onClick={() =>
                                processWithdrawal(item, "rejected")
                              }
                            >
                              <XCircle size={15} />
                              Từ chối
                            </button>
                          </div>
                        ) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {adminWithdrawals.length === 0 && (
                <div className="empty">
                  Chưa có yêu cầu rút tiền.
                </div>
              )}
            </div>
          </div>
        )}

        {page === "tasks" && isAdmin && (
          <>
            <div className="page-intro">
              <div>
                <h2>Quản lý nhiệm vụ</h2>
                <p className="muted">
                  Nhiệm vụ tạo tại đây là DEMO, không tự cộng điểm.
                </p>
              </div>
            </div>

            <div className="panel form-panel">
              <h3>Tạo nhiệm vụ mới</h3>

              <form className="task-form" onSubmit={createTask}>
                <label>
                  Tên nhiệm vụ
                  <input
                    name="title"
                    required
                    placeholder="Ví dụ: Khảo sát trải nghiệm"
                  />
                </label>

                <label>
                  Danh mục
                  <select name="category">
                    <option>Khảo sát</option>
                    <option>Xem quảng cáo</option>
                    <option>Ứng dụng</option>
                    <option>Khác</option>
                  </select>
                </label>

                <label>
                  Điểm hiển thị
                  <input
                    name="points"
                    type="number"
                    min="0"
                    defaultValue="0"
                  />
                </label>

                <label className="wide">
                  Mô tả
                  <textarea
                    name="description"
                    rows="3"
                    placeholder="Mô tả nhiệm vụ..."
                  />
                </label>

                <button
                  className="btn primary"
                  type="submit"
                  disabled={busy}
                >
                  <Plus size={16} />
                  Tạo nhiệm vụ DEMO
                </button>
              </form>
            </div>

            <div className="panel">
              <h3>Nhiệm vụ hiện tại</h3>

              <div className="task-list">
                {tasks.map((task) => (
                  <div className="task-row" key={task._id}>
                    <div>
                      <b>{task.title}</b>
                      <small>
                        {task.category} · {money(task.points)} điểm ·{" "}
                        {task.isDemo ? "DEMO" : "Đối tác"}
                      </small>
                    </div>

                    <span
                      className={`status-pill ${
                        task.active ? "live" : "blocked"
                      }`}
                    >
                      {task.active ? "Đang bật" : "Đã tắt"}
                    </span>
                  </div>
                ))}
              </div>

              {tasks.length === 0 && (
                <div className="empty">
                  Chưa có nhiệm vụ nào.
                </div>
              )}
            </div>
          </>
        )}

        {page === "offerwall" && !isAdmin && (
          <OfferwallPanel token={token} />
        )}

        {page === "tasks" && !isAdmin && (
          <>
            <div className="page-intro">
              <div>
                <h2>Nhiệm vụ DEMO</h2>
                <p className="muted">
                  Nhiệm vụ demo chưa phát sinh điểm thưởng.
                </p>
              </div>
            </div>

            <div className="task-grid">
              {tasks.map((task) => (
                <div className="task-card" key={task._id}>
                  <div className="task-icon">
                    <ClipboardList />
                  </div>

                  <span className="status-pill">
                    {task.category}
                  </span>

                  <h3>{task.title}</h3>

                  <p>
                    {task.description ||
                      "Thông tin nhiệm vụ đang được cập nhật."}
                  </p>

                  <div className="task-bottom">
                    <b>{money(task.points)} điểm</b>
                    <span className="status-pill pending">DEMO</span>
                  </div>
                </div>
              ))}
            </div>

            {tasks.length === 0 && (
              <div className="empty">
                Chưa có nhiệm vụ nào.
              </div>
            )}
          </>
        )}

        {page === "wallet" && !isAdmin && (
          <>
            <div className="balance-card compact">
              <div>
                <span>SỐ DƯ HIỆN TẠI</span>
                <h2>
                  {money(wallet.balanceVND)}
                  <small> VNĐ</small>
                </h2>
                <p>{money(wallet.points)} điểm</p>
              </div>

              <div className="balance-icon">
                <Wallet />
              </div>
            </div>

            <div className="panel">
              <div className="panel-head">
                <div>
                  <h3>Lịch sử giao dịch</h3>
                  <p className="muted">
                    Tối đa 30 giao dịch gần nhất.
                  </p>
                </div>
              </div>

              <TransactionTable rows={wallet.transactions || []} />
            </div>
          </>
        )}

        {page === "withdraw" && !isAdmin && (
          <>
            <div className="page-intro">
              <div>
                <h2>Tạo yêu cầu rút tiền</h2>
                <p className="muted">
                  Số dư hiện tại: {money(wallet.balanceVND)} VNĐ (
                  {money(wallet.points)} điểm).
                </p>
              </div>
            </div>

            <div className="split-grid">
              <div className="panel form-panel">
                <h3>Thông tin nhận tiền</h3>

                <form
                  className="stack-form"
                  onSubmit={submitWithdrawal}
                >
                  <label>
                    Số điểm muốn rút
                    <input
                      name="points"
                      type="number"
                      min="1"
                      step="1"
                      required
                      placeholder="Ví dụ: 10000"
                    />
                  </label>

                  <label>
                    Ngân hàng
                    <input
                      name="bankName"
                      required
                      placeholder="Ví dụ: MBBank"
                    />
                  </label>

                  <label>
                    Số tài khoản
                    <input
                      name="bankAccount"
                      required
                      placeholder="Số tài khoản nhận"
                    />
                  </label>

                  <label>
                    Chủ tài khoản
                    <input
                      name="bankHolder"
                      required
                      placeholder="Tên chủ tài khoản"
                    />
                  </label>

                  <button
                    className="btn primary"
                    disabled={busy}
                    type="submit"
                  >
                    <ArrowDownToLine size={16} />
                    Gửi yêu cầu rút tiền
                  </button>
                </form>

                <p className="hint">
                  Tối thiểu 1.000đ. Điểm được trừ khi gửi yêu cầu;
                  nếu bị từ chối, hệ thống hoàn điểm.
                </p>
              </div>

              <div className="panel">
                <h3>Lịch sử yêu cầu</h3>

                {withdrawals.map((item) => (
                  <div className="withdraw-row" key={item._id}>
                    <div>
                      <b>{money(item.amountVND)}đ</b>
                      <small>
                        {item.bankName} · {date(item.createdAt)}
                      </small>
                    </div>

                    <span className={`status-pill ${item.status}`}>
                      {item.status === "pending"
                        ? "Đang chờ"
                        : item.status === "paid"
                          ? "Đã chuyển"
                          : "Đã từ chối"}
                    </span>
                  </div>
                ))}

                {withdrawals.length === 0 && (
                  <div className="empty">
                    Chưa có yêu cầu rút tiền.
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function OfferwallPanel({ token }) {
  const [activeTab, setActiveTab] = useState("tasks");

  const [data, setData] = useState({
    tasks: [],
    offers: [],
    surveys: [],
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState({});

  const tabs = [
    { id: "tasks", label: "Nhiệm vụ" },
    { id: "offers", label: "Offers" },
    { id: "surveys", label: "Khảo sát" },
  ];

  const loadTab = useCallback(async (type) => {
    setLoading(true);
    setError("");

    try {
      const result = await request(`/offerwall/${type}`, token);

      const rows = Array.isArray(result.data)
        ? result.data
        : Array.isArray(result)
          ? result
          : [];

      setData((previous) => ({
        ...previous,
        [type]: rows,
      }));

      setLoaded((previous) => ({
        ...previous,
        [type]: true,
      }));
    } catch (err) {
      setError(
        err.message ||
        "Không tải được dữ liệu Offerwall.me."
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!loaded[activeTab]) {
      loadTab(activeTab);
    }
  }, [activeTab, loaded, loadTab]);

  function titleOf(item) {
    return (
      item.title ||
      item.name ||
      item.offer_name ||
      "Nhiệm vụ mới"
    );
  }

  function descriptionOf(item) {
    return (
      item.description ||
      item.instructions ||
      item.short_description ||
      "Mở nhiệm vụ và đọc kỹ yêu cầu của đối tác."
    );
  }

  function rewardOf(item) {
    const amount = Number(
      item.reward ??
      item.payout ??
      item.amount ??
      0
    );

    return Number.isFinite(amount) ? amount : 0;
  }

  function openItem(item) {
    const url =
      item.url ||
      item.link ||
      item.offer_url;

    if (
      typeof url !== "string" ||
      !/^https?:\/\//i.test(url)
    ) {
      window.alert(
        "Mục này chưa có đường dẫn hợp lệ. Nhiệm vụ cần gửi minh chứng sẽ được tích hợp riêng."
      );
      return;
    }

    window.open(url, "_blank", "noopener,noreferrer");
  }

  const rows = data[activeTab] || [];

  return (
    <section className="offerwall-section">
      <div className="page-intro">
        <div>
          <h2>Nhiệm vụ kiếm thưởng</h2>
          <p className="muted">
            Dữ liệu lấy từ Offerwall.me. Phần thưởng chỉ được
            ghi nhận khi đối tác gửi postback hợp lệ về máy chủ.
          </p>
        </div>

        <button
          className="btn subtle"
          onClick={() => loadTab(activeTab)}
          disabled={loading}
        >
          <RefreshCw size={16} />
          {loading ? "Đang tải..." : "Làm mới"}
        </button>
      </div>

      <div className="offerwall-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`btn ${
              activeTab === tab.id
                ? "primary"
                : "subtle"
            }`}
            onClick={() => setActiveTab(tab.id)}
            disabled={loading}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="alert error">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {loading && (
        <div className="empty">
          Đang tải dữ liệu từ Offerwall.me...
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <div className="empty">
          Hiện chưa có mục khả dụng ở danh mục này.
          Hãy thử làm mới sau.
        </div>
      )}

      <div className="task-grid">
        {rows.map((item, index) => (
          <article
            className="task-card"
            key={
              item.id ||
              item.offer_id ||
              item.task_id ||
              index
            }
          >
            <div className="task-icon">
              <Activity size={22} />
            </div>

            <span className="status-pill live">
              Offerwall.me
            </span>

            <h3>{titleOf(item)}</h3>

            <p>{descriptionOf(item)}</p>

            <div className="task-bottom">
              <b>
                {rewardOf(item).toLocaleString("en-US", {
                  maximumFractionDigits: 4,
                })}
              </b>

              <button
                className="btn primary"
                onClick={() => openItem(item)}
              >
                Tham gia
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function Stat({ icon: Icon, label, value, hint }) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        <Icon size={19} />
      </div>

      <strong>{value ?? "—"}</strong>
      <small>{hint}</small>
    </div>
  );
}

function Quick({ icon: Icon, title, desc, onClick }) {
  return (
    <button className="quick-link" onClick={onClick}>
      <span><Icon /></span>

      <div>
        <b>{title}</b>
        <small>{desc}</small>
      </div>

      <span className="quick-arrow">↗</span>
    </button>
  );
}

function TransactionTable({ rows = [] }) {
  if (!rows.length) {
    return (
      <div className="empty">
        Chưa có giao dịch nào.
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Loại giao dịch</th>
            <th>Điểm</th>
            <th>Trạng thái</th>
            <th>Ghi chú</th>
            <th>Thời gian</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr key={row._id}>
              <td>
                {row.type === "withdrawal"
                  ? "Rút tiền"
                  : row.type === "reward"
                    ? "Thưởng"
                    : "Điều chỉnh"}
              </td>

              <td
                className={
                  row.points >= 0
                    ? "positive"
                    : "negative"
                }
              >
                {row.points > 0 ? "+" : ""}
                {money(row.points)}
              </td>

              <td>
                <span className={`status-pill ${row.status}`}>
                  {row.status === "completed"
                    ? "Hoàn tất"
                    : row.status === "pending"
                      ? "Đang chờ"
                      : "Từ chối"}
                </span>
              </td>

              <td>{row.note || "—"}</td>
              <td>{date(row.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default App;
