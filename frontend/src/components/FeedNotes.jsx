import { RefreshCcw, Sparkles } from "lucide-react";


export default function FeedNotes({ postsCount, storiesCount, onRefresh }) {
  return (
    <section className="panel soft-ring px-5 py-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-display text-2xl text-ink">Session notes</p>
          <p className="text-sm text-[color:var(--muted)]">Quick signals from the current session.</p>
        </div>
        <button type="button" onClick={onRefresh} className="ghost-button gap-2">
          <RefreshCcw size={16} />
          Refresh
        </button>
      </div>

      <div className="mt-5 space-y-4">
        <div className="rounded-[24px] bg-white/75 px-4 py-4">
          <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--muted)]">Visible drops</p>
          <p className="mt-2 font-display text-3xl text-ink">{postsCount}</p>
        </div>
        <div className="rounded-[24px] bg-white/75 px-4 py-4">
          <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--muted)]">Story groups</p>
          <p className="mt-2 font-display text-3xl text-ink">{storiesCount}</p>
        </div>
        <div className="rounded-[24px] border border-dashed border-[color:var(--line)] px-4 py-4">
          <div className="flex items-center gap-2 text-[color:var(--accent)]">
            <Sparkles size={16} />
            <span className="text-sm font-semibold">Studio note</span>
          </div>
          <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
            Stalk profiles, follow people, and your home flow will stay personal instead of defaulting to a generic stream.
          </p>
        </div>
      </div>
    </section>
  );
}
