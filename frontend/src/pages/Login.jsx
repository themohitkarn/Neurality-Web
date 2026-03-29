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
      title="Open the feed, pick up the story, and keep the moment moving."
      description="Neurality blends a calm app surface with the familiar rhythm of sharing photos, stories, comments, and follows."
      footerText="Need an account?"
      footerLink="/signup"
      footerLabel="Create one"
    >
      <div>
        <p className="font-display text-3xl text-ink">Login</p>
        <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
          Use your email or username and the password you set when signing up.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-ink">Email or username</label>
          <input
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            className="field"
            placeholder="santa or santa@neurality.dev"
            required
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-ink">Password</label>
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="field"
            type="password"
            placeholder="Enter your password"
            required
          />
        </div>

        {error ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-500">{error}</p> : null}

        <button type="submit" disabled={submitting} className="accent-button w-full gap-2">
          {submitting ? "Signing in..." : "Login"}
          <ArrowRight size={16} />
        </button>
      </form>

      <div className="mt-8 rounded-[24px] border border-[color:var(--line)] bg-white/70 px-5 py-4 text-sm text-[color:var(--muted)]">
        Demo after seeding:
        <p className="mt-1 font-medium text-ink">santa@neurality.dev / northpole123</p>
      </div>

      <p className="mt-6 text-center text-sm text-[color:var(--muted)]">
        <Link to="/signup" className="font-semibold text-[color:var(--accent)]">
          Prefer to start fresh?
        </Link>
      </p>
    </AuthShell>
  );
}
