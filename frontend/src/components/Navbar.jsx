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
} from "lucide-react";
import { Link, NavLink, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { getErrorMessage, userApi } from "../services/api";
import Avatar from "./Avatar";


const sidebarNavItemClass = ({ isActive }) =>
  `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${
    isActive
      ? "bg-[rgba(142,13,115,0.12)] text-[color:var(--accent)]"
      : "text-[color:var(--muted)] hover:bg-white/82 hover:text-ink"
  }`;

const desktopPrimaryItems = [
  { to: "/", label: "Home", icon: Home },
  { to: "/stalk", label: "Stalk", icon: Search },
  { to: "/explore", label: "Explore", icon: Compass },
  { to: "/drop", label: "Drop", icon: SquarePlus },
  { to: "/chat", label: "Chat", icon: MessageCircleMore },
  { to: "/notifications", label: "Notifications", icon: Bell },
];


export default function Navbar({ onLogout }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

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
    setMobileSearchOpen(false);
    navigate(`/profile/${id}`);
  };

  const showSearchResults = query.trim().length >= 2 || searching || searchError;

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[color:var(--line)] bg-[rgba(251,238,244,0.88)] px-4 py-4 backdrop-blur-xl lg:hidden">
        <div className="flex items-center justify-between gap-3 lg:hidden">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[rgba(142,13,115,0.12)]">
              <span className="font-display text-2xl text-[color:var(--accent)]">N</span>
            </div>
            <div>
              <p className="font-display text-xl font-bold tracking-tight text-ink">Neurality</p>
              <p className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted)]">
                Mobile flow
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileSearchOpen((current) => !current)}
              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[color:var(--line)] bg-white/70 text-[color:var(--muted)]"
            >
              <Search size={18} />
            </button>
            <Link
              to="/settings"
              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[color:var(--line)] bg-white/70 text-[color:var(--muted)]"
            >
              <Settings2 size={18} />
            </Link>
            <Link to={`/profile/${user?.id || ""}`} className="rounded-full">
              <Avatar src={user?.profile_pic} name={user?.username} size="sm" />
            </Link>
          </div>
        </div>

        {mobileSearchOpen ? (
          <div className="relative mt-4 lg:hidden">
            <div className="panel flex items-center gap-3 rounded-full px-4 py-3">
              <Search size={18} className="text-[color:var(--muted)]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Stalk profiles"
                className="w-full bg-transparent text-sm placeholder:text-[color:var(--muted)]"
              />
            </div>

            {showSearchResults ? (
              <div className="panel soft-ring absolute left-0 right-0 top-[calc(100%+10px)] overflow-hidden">
                {searching ? (
                  <div className="px-4 py-4 text-sm text-[color:var(--muted)]">Stalking profiles...</div>
                ) : null}

                {!searching && searchError ? (
                  <div className="px-4 py-4 text-sm text-red-500">{searchError}</div>
                ) : null}

                {!searching && !searchError && results.length === 0 ? (
                  <div className="px-4 py-4 text-sm text-[color:var(--muted)]">No matching users yet.</div>
                ) : null}

                {!searching && !searchError && results.length > 0 ? (
                  <div className="divide-y divide-[color:var(--line)]">
                    {results.map((result) => (
                      <button
                        key={result.id}
                        type="button"
                        onClick={() => openProfile(result.id)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/90"
                      >
                        <Avatar src={result.profile_pic} name={result.username} size="sm" />
                        <div>
                          <p className="font-medium text-ink">{result.username}</p>
                          <p className="text-xs text-[color:var(--muted)]">
                            {result.posts_count} drops - {result.followers_count} followers
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

      </header>

      <aside className="hidden h-screen border-r border-[color:var(--line)] bg-white/78 px-5 py-8 backdrop-blur-xl lg:sticky lg:top-0 lg:flex lg:flex-col">
        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgba(142,13,115,0.12)]">
            <span className="font-display text-2xl text-[color:var(--accent)]">N</span>
          </div>
          <div>
            <p className="font-display text-2xl font-bold tracking-tight text-ink">Neurality</p>
            <p className="text-xs uppercase tracking-[0.28em] text-[color:var(--muted)]">
              desktop flow
            </p>
          </div>
        </Link>

        <nav className="mt-12 space-y-2">
          {desktopPrimaryItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.to} to={item.to} className={sidebarNavItemClass}>
                <Icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="mt-auto space-y-4">
          <div className="relative">
            <div className="rounded-2xl bg-[rgba(250,219,232,0.76)] px-4 py-3">
              <div className="flex items-center gap-3">
                <Search size={18} className="text-[color:var(--muted)]" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Stalk people"
                  className="w-full bg-transparent text-sm placeholder:text-[color:var(--muted)]"
                />
              </div>
            </div>

            {showSearchResults ? (
              <div className="panel soft-ring absolute left-0 right-0 top-[calc(100%+10px)] overflow-hidden">
                {searching ? (
                  <div className="px-4 py-4 text-sm text-[color:var(--muted)]">Stalking profiles...</div>
                ) : null}

                {!searching && searchError ? (
                  <div className="px-4 py-4 text-sm text-red-500">{searchError}</div>
                ) : null}

                {!searching && !searchError && results.length === 0 ? (
                  <div className="px-4 py-4 text-sm text-[color:var(--muted)]">No matching people yet.</div>
                ) : null}

                {!searching && !searchError && results.length > 0 ? (
                  <div className="divide-y divide-[color:var(--line)]">
                    {results.map((result) => (
                      <button
                        key={result.id}
                        type="button"
                        onClick={() => openProfile(result.id)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/90"
                      >
                        <Avatar src={result.profile_pic} name={result.username} size="sm" />
                        <div>
                          <p className="font-medium text-ink">{result.username}</p>
                          <p className="text-xs text-[color:var(--muted)]">
                            {result.posts_count} drops - {result.followers_count} followers
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
            <UserCircle2 size={18} />
            <span>Profile</span>
          </NavLink>
          <NavLink to="/settings" className={sidebarNavItemClass}>
            <Settings2 size={18} />
            <span>Settings</span>
          </NavLink>

          <div className="flex items-center gap-3 rounded-2xl bg-[rgba(250,219,232,0.54)] px-4 py-4">
            <Avatar src={user?.profile_pic} name={user?.username} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{user?.username}</p>
              <p className="truncate text-xs text-[color:var(--muted)]">ready to drop</p>
            </div>
          </div>

          <button type="button" onClick={onLogout} className="ghost-button w-full justify-start gap-2">
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}
