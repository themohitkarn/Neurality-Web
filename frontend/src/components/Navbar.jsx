import { useEffect, useState } from "react";
import {
  Bell,
  Compass,
  Home,
  LogOut,
  MessageCircleMore,
  Search,
  Settings2,
  SquarePlus,
  UserCircle2,
  Film,
  Heart,
  Send,
  Shield,
} from "lucide-react";
import { Link, NavLink, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { getErrorMessage, notificationApi, userApi } from "../services/api";
import Avatar from "./Avatar";
import { useUnread } from "../context/UnreadContext";


const sidebarNavItemClass = ({ isActive }) =>
  `flex items-center gap-3.5 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
    isActive
      ? "bg-[color:var(--surface-active)] text-[color:var(--text-primary)] font-semibold"
      : "text-[color:var(--text-secondary)] hover:bg-[color:var(--surface)]"
  }`;

const desktopPrimaryItems = [
  { to: "/", label: "Orbit", icon: Home },
  { to: "/stalk", label: "Stalk", icon: Search },
  { to: "/drop", label: "Drop", icon: SquarePlus },
  { to: "/beat", label: "Beats", icon: Film },
  { to: "/chat", label: "Signals", icon: MessageCircleMore },
  { to: "/notifications", label: "Pulsar", icon: Heart },
];


export default function Navbar({ onLogout }) {
  const { user } = useAuth();
  const { totalUnread } = useUnread();
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [unreadNotifs, setUnreadNotifs] = useState(0);

  // Fetch unread notifications count on mount + poll every 30s
  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const { data } = await notificationApi.unreadCount();
        setUnreadNotifs(data.unread_count || 0);
      } catch {}
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setSearchError("");
      setSearching(false);
      return undefined;
    }

    const timer = window.setTimeout(async () => {
      setSearching(true);
      setSearchError("");
      try {
        const { data } = await userApi.search(query.trim());
        setResults(data.users || []);
      } catch (error) {
        setSearchError(getErrorMessage(error));
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [query]);

  const openProfile = (id) => {
    setQuery("");
    setResults([]);
    navigate(`/profile/${id}`);
  };

  const showSearchResults = query.trim().length >= 2 || searching || searchError;

  return (
    <>
      {/* ── Mobile Top Bar ── */}
      <header
        className="sticky top-0 z-40 lg:hidden"
        style={{
          background: "var(--bg)",
          borderBottom: "1px solid var(--border)",
          paddingTop: "var(--safe-top)",
        }}
      >
        <div className="flex items-center justify-between px-4 py-2.5">
          <Link to="/" className="flex items-center gap-2">
            <span
              className="text-xl font-bold tracking-tight"
              style={{
                background: "linear-gradient(135deg, var(--gradient-start), var(--gradient-end))",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Neurality
            </span>
          </Link>

          <div className="flex items-center gap-1">
            <Link
              to="/notifications"
              className="btn-icon relative"
              style={{ width: 36, height: 36, background: "transparent" }}
            >
              <Heart size={22} strokeWidth={1.8} />
              {unreadNotifs > 0 && (
                <span className="badge absolute -top-1 -right-1">{unreadNotifs > 9 ? "9+" : unreadNotifs}</span>
              )}
            </Link>
            <Link
              to="/chat"
              className="btn-icon relative"
              style={{ width: 36, height: 36, background: "transparent" }}
            >
              <Send size={22} strokeWidth={1.8} />
              {totalUnread > 0 && (
                <span className="badge absolute -top-1 -right-1 bg-red-500">{totalUnread > 9 ? "9+" : totalUnread}</span>
              )}
            </Link>
          </div>
        </div>
      </header>

      {/* ── Desktop Sidebar ── */}
      <aside
        className="hidden h-screen lg:sticky lg:top-0 lg:flex lg:flex-col px-3 py-6"
        style={{
          background: "var(--bg)",
          borderRight: "1px solid var(--border)",
        }}
      >
        <Link to="/" className="flex items-center gap-3 px-4 mb-8">
          <span
            className="text-xl font-bold tracking-tight"
            style={{
              background: "linear-gradient(135deg, var(--gradient-start), var(--gradient-end))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Neurality
          </span>
        </Link>

        <nav className="space-y-1 flex-1">
          {desktopPrimaryItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.to} to={item.to} className={sidebarNavItemClass}>
                <div className="relative">
                  <Icon size={22} />
                  {item.to === "/notifications" && unreadNotifs > 0 && (
                    <span className="badge absolute -top-2 -right-2.5" style={{ fontSize: 9, minWidth: 16, height: 16 }}>
                      {unreadNotifs > 9 ? "9+" : unreadNotifs}
                    </span>
                  )}
                  {item.to === "/chat" && totalUnread > 0 && (
                    <span className="badge absolute -top-2 -right-2.5 bg-red-500" style={{ fontSize: 9, minWidth: 16, height: 16 }}>
                      {totalUnread > 9 ? "9+" : totalUnread}
                    </span>
                  )}
                </div>
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="space-y-1">
          {/* Search */}
          <div className="relative px-1 mb-4">
            <div
              className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <Search size={16} style={{ color: "var(--text-muted)" }} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search users..."
                className="w-full bg-transparent text-sm outline-none"
                style={{ color: "var(--text-primary)" }}
              />
            </div>

            {showSearchResults ? (
              <div
                className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-xl shadow-soft-lg"
                style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
              >
                {searching ? (
                  <div className="px-4 py-3 text-sm" style={{ color: "var(--text-muted)" }}>Searching…</div>
                ) : null}
                {!searching && searchError ? (
                  <div className="px-4 py-3 text-sm text-red-400">{searchError}</div>
                ) : null}
                {!searching && !searchError && results.length === 0 ? (
                  <div className="px-4 py-3 text-sm" style={{ color: "var(--text-muted)" }}>No results</div>
                ) : null}
                {!searching && !searchError && results.length > 0 ? (
                  <div className="max-h-60 overflow-y-auto">
                    {results.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => openProfile(r.id)}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[color:var(--surface)]"
                      >
                        <Avatar src={r.profile_pic} name={r.username} size="sm" />
                        <div>
                          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{r.username}</p>
                          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                            {r.full_name || `${r.followers_count} followers`}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <NavLink to={`/profile/${user?.id || ""}`} className={sidebarNavItemClass}>
            <UserCircle2 size={22} />
            <span>Aura</span>
          </NavLink>
          <NavLink to="/settings" className={sidebarNavItemClass}>
            <Settings2 size={22} />
            <span>Settings</span>
          </NavLink>
          {user?.is_admin && (
            <NavLink to="/admin" className={sidebarNavItemClass}>
              <Shield size={22} />
              <span>Admin</span>
            </NavLink>
          )}

          {/* User card */}
          <div className="flex items-center gap-3 rounded-xl px-4 py-3 mt-4" style={{ background: "var(--surface)" }}>
            <Avatar src={user?.profile_pic} name={user?.username} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{user?.username}</p>
              <p className="truncate text-xs" style={{ color: "var(--text-muted)" }}>{user?.full_name || "Neurality"}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center gap-3.5 rounded-xl px-4 py-3 text-sm font-medium transition-colors text-[color:var(--text-muted)] hover:bg-[color:var(--surface)] hover:text-red-400"
          >
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}
