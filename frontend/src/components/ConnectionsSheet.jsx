import { Link } from "react-router-dom";
import { X } from "lucide-react";

import Avatar from "./Avatar";


export default function ConnectionsSheet({ open, title, users, loading, onClose }) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-[rgba(18,12,20,0.62)] px-0 py-0 backdrop-blur-sm sm:items-center sm:justify-center sm:px-4 sm:py-6">
      <div className="flex h-[86vh] w-full flex-col rounded-t-[32px] bg-[var(--surface-strong)] shadow-[0_28px_80px_rgba(18,12,20,0.28)] sm:h-auto sm:max-h-[78vh] sm:max-w-lg sm:rounded-[32px]">
        <div className="flex items-center justify-between border-b border-[color:var(--line)] px-5 py-4">
          <div>
            <p className="font-display text-2xl text-ink">{title}</p>
            <p className="text-sm text-[color:var(--muted)]">Tap a person to open their profile.</p>
          </div>
          <button type="button" onClick={onClose} className="ghost-button h-11 w-11 rounded-2xl p-0">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {loading ? (
            <div className="rounded-[24px] bg-white/72 px-4 py-4 text-sm text-[color:var(--muted)]">
              Loading {title.toLowerCase()}...
            </div>
          ) : null}

          {!loading && users.length === 0 ? (
            <div className="rounded-[24px] bg-white/72 px-4 py-4 text-sm text-[color:var(--muted)]">
              Nobody is here yet.
            </div>
          ) : null}

          <div className="space-y-3">
            {users.map((person) => (
              <Link
                key={person.id}
                to={`/profile/${person.id}`}
                onClick={onClose}
                className="flex items-center gap-3 rounded-[24px] bg-white/78 px-4 py-4 transition hover:bg-white active:scale-[0.99]"
              >
                <Avatar src={person.profile_pic} name={person.username} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{person.username}</p>
                  <p className="truncate text-xs text-[color:var(--muted)]">
                    {person.full_name || `${person.followers_count} followers`}
                  </p>
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--accent)]">
                  View
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
