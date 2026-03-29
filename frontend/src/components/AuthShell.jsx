import { Link } from "react-router-dom";


export default function AuthShell({
  eyebrow,
  title,
  description,
  footerText,
  footerLink,
  footerLabel,
  children,
}) {
  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-6 sm:px-6 lg:px-8">
      <div className="absolute inset-0 -z-10">
        <div className="absolute left-[6%] top-24 h-56 w-56 rounded-full bg-[rgba(142,13,115,0.12)] blur-3xl" />
        <div className="absolute right-[8%] top-16 h-72 w-72 rounded-full bg-[rgba(254,230,212,0.7)] blur-3xl" />
        <div className="absolute bottom-0 left-1/4 h-80 w-80 rounded-full bg-[rgba(214,38,61,0.08)] blur-3xl" />
      </div>

      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-[1280px] gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="panel soft-ring relative overflow-hidden px-6 py-8 sm:px-10 sm:py-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.45),transparent_36%),linear-gradient(135deg,rgba(142,13,115,0.12),transparent_45%)]" />
          <div className="relative flex h-full flex-col justify-between gap-10">
            <div>
              <Link to="/" className="inline-flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgba(142,13,115,0.14)] font-display text-2xl text-[color:var(--accent)]">
                  N
                </span>
                <div>
                  <p className="font-display text-2xl font-bold tracking-tight">Neurality</p>
                  <p className="text-xs uppercase tracking-[0.28em] text-[color:var(--muted)]">
                    Photo-first social
                  </p>
                </div>
              </Link>
            </div>

            <div className="max-w-xl">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[color:var(--accent)]">
                {eyebrow}
              </p>
              <h1 className="mt-4 max-w-lg text-4xl font-bold leading-tight text-ink sm:text-5xl">
                {title}
              </h1>
              <p className="mt-5 max-w-md text-base leading-7 text-[color:var(--muted)]">
                {description}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-[26px] border border-white/50 bg-white/62 px-5 py-6">
                <p className="font-display text-3xl text-ink">24h</p>
                <p className="mt-2 text-sm text-[color:var(--muted)]">Stories vanish on schedule.</p>
              </div>
              <div className="rounded-[26px] border border-white/50 bg-white/62 px-5 py-6">
                <p className="font-display text-3xl text-ink">JWT</p>
                <p className="mt-2 text-sm text-[color:var(--muted)]">Secure sessions across the app.</p>
              </div>
              <div className="rounded-[26px] border border-white/50 bg-white/62 px-5 py-6">
                <p className="font-display text-3xl text-ink">MySQL</p>
                <p className="mt-2 text-sm text-[color:var(--muted)]">Scalable data model underneath.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="panel soft-ring flex items-center px-6 py-8 sm:px-10 sm:py-10">
          <div className="mx-auto w-full max-w-md">
            {children}
            <p className="mt-8 text-center text-sm text-[color:var(--muted)]">
              {footerText}{" "}
              <Link to={footerLink} className="font-semibold text-[color:var(--accent)]">
                {footerLabel}
              </Link>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
