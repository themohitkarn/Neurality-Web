export default function ProfileStatsPanel({ user, compact = false }) {
  const stats = [
    { label: "Drops", value: user?.posts_count || 0 },
    { label: "Followers", value: user?.followers_count || 0 },
    { label: "Following", value: user?.following_count || 0 },
  ];

  if (compact) {
    return (
      <section className="panel soft-ring overflow-x-auto px-4 py-4">
        <div className="flex min-w-max gap-3">
          {stats.map((stat) => (
            <div key={stat.label} className="min-w-[120px] rounded-[22px] bg-white/72 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--muted)]">{stat.label}</p>
              <p className="mt-2 font-display text-3xl text-ink">{stat.value}</p>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="panel soft-ring px-5 py-6">
      <p className="font-display text-2xl text-ink">Your rhythm</p>
      <div className="mt-5 grid gap-3">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-[22px] bg-white/72 px-4 py-4">
            <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--muted)]">{stat.label}</p>
            <p className="mt-2 font-display text-3xl text-ink">{stat.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
