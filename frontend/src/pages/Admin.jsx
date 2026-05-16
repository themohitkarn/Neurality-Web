import { useEffect, useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { adminApi, getErrorMessage } from "../services/api";
import {
  Shield,
  Users,
  FileWarning,
  BarChart3,
  Search,
  BadgeCheck,
  Ban,
  Crown,
  ChevronRight,
  Trash2,
  Eye,
  CheckCircle2,
  XCircle,
  Image as ImageIcon,
  Film,
  RefreshCw,
} from "lucide-react";

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: BarChart3 },
  { id: "users", label: "Users", icon: Users },
  { id: "reports", label: "Reports", icon: FileWarning },
];

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="rounded-2xl p-5 flex items-center gap-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
        <Icon size={22} />
      </div>
      <div>
        <div className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{value}</div>
        <div className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>{label}</div>
      </div>
    </div>
  );
}

function DashboardTab({ stats }) {
  if (!stats) return null;
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
      <StatCard icon={Users} label="Total Users" value={stats.total_users} color="bg-blue-500/20 text-blue-400" />
      <StatCard icon={ImageIcon} label="Total Posts" value={stats.total_posts} color="bg-green-500/20 text-green-400" />
      <StatCard icon={Film} label="Total Reels" value={stats.total_reels} color="bg-purple-500/20 text-purple-400" />
      <StatCard icon={FileWarning} label="Pending Reports" value={stats.pending_reports} color="bg-amber-500/20 text-amber-400" />
      <StatCard icon={Shield} label="Total Reports" value={stats.total_reports} color="bg-red-500/20 text-red-400" />
    </div>
  );
}

function UsersTab() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  const fetchUsers = useCallback(async (p = 1, q = "") => {
    setLoading(true);
    try {
      const { data } = await adminApi.listUsers(p, q);
      setUsers(data.users);
      setHasNext(data.has_next);
      setPage(p);
    } catch (err) {
      console.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(1, search); }, [search]);

  const handleAction = async (action, userId) => {
    setActionLoading(`${action}-${userId}`);
    try {
      if (action === "verify") await adminApi.toggleVerify(userId);
      else if (action === "ban") await adminApi.banUser(userId);
      else if (action === "admin") await adminApi.toggleAdmin(userId);
      await fetchUsers(page, search);
    } catch (err) {
      console.error(getErrorMessage(err));
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search users..."
          className="w-full pl-12 pr-4 py-3 rounded-xl border-none outline-none text-sm font-medium"
          style={{ background: "var(--surface)", color: "var(--text-primary)" }}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--text-muted)", borderTopColor: "transparent" }} />
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <div
              key={u.id}
              className="flex items-center justify-between p-4 rounded-xl"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                  {u.username[0]?.toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{u.username}</span>
                    {u.is_verified && <BadgeCheck size={14} className="text-blue-500 shrink-0" />}
                    {u.is_admin && <Crown size={14} className="text-amber-500 shrink-0" />}
                    {u.account_type === "banned" && <Ban size={14} className="text-red-500 shrink-0" />}
                  </div>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>{u.email}</span>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleAction("verify", u.id)}
                  disabled={actionLoading === `verify-${u.id}`}
                  className={`p-2 rounded-lg transition-colors ${u.is_verified ? "bg-blue-500/20 text-blue-400" : "hover:bg-white/5"}`}
                  style={{ color: u.is_verified ? undefined : "var(--text-muted)" }}
                  title={u.is_verified ? "Remove verification" : "Verify user"}
                >
                  <BadgeCheck size={16} />
                </button>
                <button
                  onClick={() => handleAction("ban", u.id)}
                  disabled={actionLoading === `ban-${u.id}`}
                  className={`p-2 rounded-lg transition-colors ${u.account_type === "banned" ? "bg-red-500/20 text-red-400" : "hover:bg-white/5"}`}
                  style={{ color: u.account_type === "banned" ? undefined : "var(--text-muted)" }}
                  title={u.account_type === "banned" ? "Unban user" : "Ban user"}
                >
                  <Ban size={16} />
                </button>
                <button
                  onClick={() => handleAction("admin", u.id)}
                  disabled={actionLoading === `admin-${u.id}`}
                  className={`p-2 rounded-lg transition-colors ${u.is_admin ? "bg-amber-500/20 text-amber-400" : "hover:bg-white/5"}`}
                  style={{ color: u.is_admin ? undefined : "var(--text-muted)" }}
                  title={u.is_admin ? "Remove admin" : "Make admin"}
                >
                  <Crown size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {hasNext && (
        <button
          onClick={() => fetchUsers(page + 1, search)}
          className="w-full py-3 rounded-xl text-sm font-semibold transition-colors"
          style={{ background: "var(--surface)", color: "var(--text-primary)" }}
        >
          Load more
        </button>
      )}
    </div>
  );
}

function ReportsTab() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await adminApi.listReports(1, filter);
      setReports(data.reports);
    } catch (err) {
      console.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const handleResolve = async (reportId, action) => {
    try {
      await adminApi.resolveReport(reportId, action);
      fetchReports();
    } catch (err) {
      console.error(getErrorMessage(err));
    }
  };

  const statusColors = {
    pending: "bg-amber-500/20 text-amber-400",
    resolved: "bg-green-500/20 text-green-400",
    dismissed: "bg-zinc-500/20 text-zinc-400",
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {["", "pending", "resolved", "dismissed"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${filter === f ? "bg-white text-black" : ""}`}
            style={filter !== f ? { background: "var(--surface)", color: "var(--text-muted)" } : undefined}
          >
            {f || "All"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--text-muted)", borderTopColor: "transparent" }} />
        </div>
      ) : reports.length === 0 ? (
        <div className="text-center py-12">
          <Shield size={48} className="mx-auto mb-4" style={{ color: "var(--text-muted)" }} />
          <p className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>No reports found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {reports.map((r) => (
            <div
              key={r.id}
              className="p-4 rounded-xl space-y-3"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${statusColors[r.status] || ""}`}>
                    {r.status}
                  </span>
                  <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                    {r.target_type} #{r.target_id}
                  </span>
                </div>
                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                  {new Date(r.created_at).toLocaleDateString()}
                </span>
              </div>

              <div>
                <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{r.reason}</span>
                {r.description && (
                  <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>{r.description}</p>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  by @{r.reporter?.username}
                </span>
                {r.status === "pending" && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleResolve(r.id, "resolved")}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
                    >
                      <CheckCircle2 size={14} /> Resolve
                    </button>
                    <button
                      onClick={() => handleResolve(r.id, "dismissed")}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-500/20 text-zinc-400 hover:bg-zinc-500/30 transition-colors"
                    >
                      <XCircle size={14} /> Dismiss
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


export default function Admin() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDashboard() {
      try {
        const { data } = await adminApi.dashboard();
        setStats(data.stats);
      } catch (err) {
        setError(getErrorMessage(err));
      }
    }
    loadDashboard();
  }, []);

  if (!user?.is_admin) {
    return (
      <div className="h-[100vh] flex items-center justify-center" style={{ background: "var(--bg)" }}>
        <div className="text-center p-8">
          <Shield size={64} className="mx-auto mb-4" style={{ color: "var(--text-muted)" }} />
          <h2 className="text-xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Admin Access Required</h2>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>You need admin privileges to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100vh] overflow-y-auto" style={{ background: "var(--bg)" }}>
      <div className="max-w-3xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
            <Shield size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Admin Panel</h1>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Manage users, content & reports</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl text-sm text-red-400" style={{ background: "rgba(239,68,68,0.1)" }}>
            {error}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
                  activeTab === tab.id ? "bg-white text-black shadow-lg" : ""
                }`}
                style={activeTab !== tab.id ? { background: "var(--surface)", color: "var(--text-muted)" } : undefined}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        {activeTab === "dashboard" && <DashboardTab stats={stats} />}
        {activeTab === "users" && <UsersTab />}
        {activeTab === "reports" && <ReportsTab />}
      </div>
    </div>
  );
}
