import { useState } from "react";
import { ArrowRight, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import AuthShell from "../components/AuthShell";
import { useAuth } from "../context/AuthContext";
import { getErrorMessage } from "../services/api";

export default function Login() {
  const { login, verifyLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [step, setStep] = useState(1);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const destination = location.state?.from?.pathname || "/";

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const res = await login({ identifier, password });
      if (res?.requires_verification) {
        if (res.identifier) {
          setIdentifier(res.identifier);
        }
        setStep(2);
      } else {
        navigate(destination, { replace: true });
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyOtp = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      await verifyLogin({ identifier, otp });
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
      footerText={step === 1 ? "Don't have an account?" : ""}
      footerLink={step === 1 ? "/signup" : ""}
      footerLabel={step === 1 ? "Sign up" : ""}
    >
      {step === 1 && (
        <div className="animate-slide-up">
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
        </div>
      )}

      {step === 2 && (
        <div className="animate-slide-up">
          <button 
            onClick={() => {setStep(1); setError("");}}
            className="mb-4 inline-flex items-center gap-1 text-sm font-medium transition-colors hover:opacity-80"
            style={{ color: "var(--text-muted)" }}
          >
            <ArrowLeft size={16} /> Back
          </button>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>New Device Detected</h1>
            <p className="mt-1.5 text-sm" style={{ color: "var(--text-muted)" }}>
              We sent a verification code to <span className="font-semibold text-white">{identifier}</span>
            </p>
          </div>

          <form onSubmit={handleVerifyOtp} className="mt-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                Verification Code
              </label>
              <input
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="field text-center text-2xl tracking-widest"
                placeholder="••••••"
                maxLength={6}
                required
                autoFocus
              />
            </div>
            {error && (
              <div className="rounded-xl px-4 py-3 text-sm" style={{ background: "rgba(239,68,68,0.1)", color: "#f87171" }}>
                {error}
              </div>
            )}
            <button type="submit" disabled={submitting} className="btn-primary w-full">
              {submitting ? "Verifying…" : "Verify Code"}
              <CheckCircle2 size={16} />
            </button>
          </form>
        </div>
      )}
    </AuthShell>
  );
}
