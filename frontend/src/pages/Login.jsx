import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import AuthShell from "../components/AuthShell";
import { useAuth } from "../context/AuthContext";
import { getErrorMessage } from "../services/api";


export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const destination = location.state?.from?.pathname || "/";

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      await login({ identifier, password });
      navigate(destination, { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Sign in to your account"
      description=""
      footerText="Don't have an account?"
      footerLink="/signup"
      footerLabel="Sign up"
    >
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Login</h1>
        <p className="mt-1.5 text-sm" style={{ color: "var(--text-muted)" }}>
          Enter your credentials to access your account.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Email or username
          </label>
          <input
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            className="field"
            placeholder="your@email.com"
            required
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Password
          </label>
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="field"
            type="password"
            placeholder="••••••••"
            required
          />
        </div>

        {error ? (
          <div className="rounded-xl px-4 py-3 text-sm" style={{ background: "rgba(239,68,68,0.1)", color: "#f87171" }}>
            {error}
          </div>
        ) : null}

        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? "Signing in…" : "Login"}
          <ArrowRight size={16} />
        </button>
      </form>

      <div
        className="mt-6 rounded-xl px-4 py-3 text-sm"
        style={{ background: "var(--surface)", color: "var(--text-muted)" }}
      >
        Demo: <span style={{ color: "var(--text-primary)" }}>santa@neurality.dev</span> / <span style={{ color: "var(--text-primary)" }}>northpole123</span>
      </div>
    </AuthShell>
  );
}
