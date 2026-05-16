import { useEffect, useState, useCallback } from "react";
import { Heart, MessageCircle, UserPlus, AtSign, Image, Film, Star, Bell, Check, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

import Avatar from "../components/Avatar";
import { notificationApi, getErrorMessage } from "../services/api";


const ICON_MAP = {
  like: { icon: Heart, color: "text-rose-500", bg: "bg-rose-500/10" },
  comment: { icon: MessageCircle, color: "text-blue-500", bg: "bg-blue-500/10" },
  follow: { icon: UserPlus, color: "text-emerald-500", bg: "bg-emerald-500/10" },
  follow_request: { icon: UserPlus, color: "text-amber-500", bg: "bg-amber-500/10" },
  mention: { icon: AtSign, color: "text-purple-500", bg: "bg-purple-500/10" },
  story_reaction: { icon: Star, color: "text-yellow-500", bg: "bg-yellow-500/10" },
  reel_like: { icon: Film, color: "text-pink-500", bg: "bg-pink-500/10" },
};

function getNotificationText(n) {
  const actor = n.actor?.username || "Someone";
  switch (n.type) {
    case "like": return <><strong>{actor}</strong> liked your post</>;
    case "comment": return <><strong>{actor}</strong> commented: {n.body}</>;
    case "follow": return <><strong>{actor}</strong> started following you</>;
    case "follow_request": return <><strong>{actor}</strong> requested to follow you</>;
    case "mention": return <><strong>{actor}</strong> mentioned you</>;
    case "story_reaction": return <><strong>{actor}</strong> reacted to your story {n.body}</>;
    case "reel_like": return <><strong>{actor}</strong> liked your beat</>;
    default: return n.body || "New notification";
  }
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}

function groupNotifications(notifications) {
  const today = [];
  const thisWeek = [];
  const earlier = [];
  const now = Date.now();
  const dayMs = 86400000;

  for (const n of notifications) {
    const age = now - new Date(n.created_at).getTime();
    if (age < dayMs) today.push(n);
    else if (age < 7 * dayMs) thisWeek.push(n);
    else earlier.push(n);
  }

  return [
    { label: "Today", items: today },
    { label: "This Week", items: thisWeek },
    { label: "Earlier", items: earlier },
  ].filter(g => g.items.length > 0);
}


export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hasNext, setHasNext] = useState(false);
  const [page, setPage] = useState(1);

  const fetchNotifications = useCallback(async (pageNum = 1, append = false) => {
    try {
      const { data } = await notificationApi.list(pageNum);
      setNotifications(prev =>
        append
          ? [...prev, ...data.notifications]
          : data.notifications
      );
      setHasNext(data.has_next);
      setPage(pageNum);
      setError("");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    // Mark all as read after viewing
    notificationApi.markRead().catch(() => {});
  }, [fetchNotifications]);

  const handleMarkAllRead = async () => {
    try {
      await notificationApi.markRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (err) {
      console.error(err);
    }
  };

  const groups = groupNotifications(notifications);

  return (
    <div className="h-[100vh] w-full overflow-y-auto overflow-x-hidden bg-[color:var(--bg)]">
      <div className="w-full max-w-[600px] mx-auto">
        {/* Header */}
        <div className="sticky top-0 z-30 px-4 py-4 flex items-center justify-between bg-[color:var(--bg)] border-b border-[color:var(--border)]" style={{ paddingTop: "calc(var(--safe-top) + 16px)" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[color:var(--accent-soft)]">
              <Bell size={20} className="text-[color:var(--accent)]" />
            </div>
            <div>
              <h1 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Notifications</h1>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {notifications.filter(n => !n.is_read).length} unread
              </p>
            </div>
          </div>

          {notifications.some(n => !n.is_read) && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
              style={{ color: "var(--accent)", background: "var(--accent-soft)" }}
            >
              <Check size={14} />
              Read all
            </button>
          )}
        </div>

        {/* Content */}
        <div className="pb-safe">
          {loading ? (
            <div className="space-y-1 p-4">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="flex items-center gap-3 px-4 py-4 rounded-2xl">
                  <div className="w-12 h-12 rounded-full skeleton" />
                  <div className="flex-1 space-y-2">
                    <div className="w-3/4 h-3 skeleton" />
                    <div className="w-1/2 h-2.5 skeleton" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="mx-4 mt-4 rounded-xl px-4 py-3 text-sm text-red-400" style={{ background: "rgba(239,68,68,0.1)" }}>
              {error}
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-8">
              <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4" style={{ background: "var(--surface)" }}>
                <Bell size={32} style={{ color: "var(--text-muted)" }} />
              </div>
              <p className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>No notifications yet</p>
              <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
                When someone interacts with your content, you'll see it here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[color:var(--border)]">
              {groups.map(group => (
                <div key={group.label}>
                  <div className="px-4 pt-4 pb-2">
                    <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                      {group.label}
                    </span>
                  </div>
                  {group.items.map(n => {
                    const config = ICON_MAP[n.type] || ICON_MAP.like;
                    const Icon = config.icon;

                    return (
                      <div
                        key={n.id}
                        className={`flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-[color:var(--surface)] ${
                          !n.is_read ? "bg-[color:var(--accent-soft)]" : ""
                        }`}
                      >
                        {/* Actor avatar */}
                        <div className="relative flex-shrink-0">
                          <Avatar src={n.actor?.profile_pic} name={n.actor?.username || "?"} size="md" />
                          <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center ${config.bg} border-2 border-[color:var(--bg)]`}>
                            <Icon size={12} className={config.color} fill={n.type === "like" || n.type === "reel_like" ? "currentColor" : "none"} />
                          </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm leading-snug" style={{ color: "var(--text-primary)" }}>
                            {getNotificationText(n)}
                          </p>
                          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                            {timeAgo(n.created_at)}
                          </p>
                        </div>

                        {/* Unread dot */}
                        {!n.is_read && (
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: "var(--accent)" }} />
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}

              {/* Load more */}
              {hasNext && (
                <button
                  onClick={() => fetchNotifications(page + 1, true)}
                  className="w-full py-4 text-center text-sm font-medium transition-colors"
                  style={{ color: "var(--accent)" }}
                >
                  Load more
                </button>
              )}

              {/* End of list */}
              {!hasNext && notifications.length > 0 && (
                <div className="py-8 text-center">
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>You're all caught up ✓</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
