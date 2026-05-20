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
    <div className="relative min-h-screen min-h-[100dvh] overflow-hidden" style={{ background: "var(--bg)" }}>
      {/* Decorative blobs */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-20 -top-20 h-80 w-80 rounded-full opacity-30 blur-3xl" style={{ background: "var(--accent)" }} />
        <div className="absolute -right-20 top-1/3 h-64 w-64 rounded-full opacity-20 blur-3xl" style={{ background: "var(--gradient-end)" }} />
        <div className="absolute bottom-0 left-1/4 h-72 w-72 rounded-full opacity-15 blur-3xl" style={{ background: "var(--accent)" }} />
      </div>

      <div className="mx-auto flex min-h-screen min-h-[100dvh] max-w-[480px] flex-col justify-center px-6 py-12">
        {/* Logo */}
        <div className="mb-10 text-center">
          <Link to="/" className="inline-block">
            <span
              className="text-3xl font-bold tracking-tight"
              style={{
                background: "linear-gradient(135deg, var(--gradient-start), var(--gradient-end))",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Neurality
            </span>
          </Link>
        </div>

        {/* Form card */}
        <div
          className="relative z-10 rounded-2xl p-6 sm:p-8 shadow-2xl transition-all duration-500 hover:shadow-[0_8px_32px_rgba(225,29,72,0.1)]"
          style={{
            background: "rgba(255, 255, 255, 0.03)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
          }}
        >
          {children}
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>
          {footerText}{" "}
          <Link to={footerLink} className="font-semibold" style={{ color: "var(--accent)" }}>
            {footerLabel}
          </Link>
        </p>
      </div>
    </div>
  );
}
