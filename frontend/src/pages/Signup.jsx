import { useState } from "react";
import { ArrowRight, ImagePlus, ArrowLeft, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

import AuthShell from "../components/AuthShell";
import { useAuth } from "../context/AuthContext";
import { authApi, getErrorMessage } from "../services/api";

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [identifier, setIdentifier] = useState("");
  const [otp, setOtp] = useState("");
  const [verificationId, setVerificationId] = useState("");
  
  const [form, setForm] = useState({
    username: "",
    password: "",
    bio: "",
  });
  const [profilePic, setProfilePic] = useState(null);
  
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleIdentityCheck = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await authApi.checkIdentity({ identifier, action: "signup" });
      await authApi.sendOtp({ identifier, purpose: "signup" });
      setStep(2);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await authApi.verifyOtp({ identifier, otp, purpose: "signup" });
      setVerificationId(res.data.verification_id);
      setStep(3);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinalSignup = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const payload = new FormData();
      payload.append("username", form.username);
      
      if (identifier.includes("@")) {
        payload.append("email", identifier);
      } else {
        payload.append("email", identifier + "@temp.neurality.dev"); 
        payload.append("phone_number", identifier);
      }
      
      payload.append("password", form.password);
      payload.append("bio", form.bio);
      
      if (verificationId) {
        payload.append("verification_id", verificationId);
      }
      if (profilePic) {
        payload.append("profile_pic", profilePic);
      }

      await signup(payload);
      navigate("/", { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Get started"
      title="Create your account"
      description=""
      footerText={step === 1 ? "Already have an account?" : ""}
      footerLink={step === 1 ? "/login" : ""}
      footerLabel={step === 1 ? "Log in" : ""}
    >
      {step === 1 && (
        <div className="animate-slide-up">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Join Neurality</h1>
            <p className="mt-1.5 text-sm" style={{ color: "var(--text-muted)" }}>
              Enter your email or phone number to continue.
            </p>
          </div>

          <form onSubmit={handleIdentityCheck} className="mt-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                Email or Phone
              </label>
              <input
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="field"
                placeholder="your@email.com or +1234567890"
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
              {submitting ? "Checking…" : "Continue"}
              <ArrowRight size={16} />
            </button>
          </form>
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
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Verify it's you</h1>
            <p className="mt-1.5 text-sm" style={{ color: "var(--text-muted)" }}>
              We sent a code to <span className="font-semibold text-white">{identifier}</span>
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

      {step === 3 && (
        <div className="animate-slide-up">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Almost there</h1>
            <p className="mt-1.5 text-sm" style={{ color: "var(--text-muted)" }}>
              Set up your profile and password.
            </p>
          </div>

          <form onSubmit={handleFinalSignup} className="mt-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                Username
              </label>
              <input
                value={form.username}
                onChange={(e) => setForm((c) => ({ ...c, username: e.target.value }))}
                className="field"
                placeholder="yourname"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                Password
              </label>
              <input
                value={form.password}
                onChange={(e) => setForm((c) => ({ ...c, password: e.target.value }))}
                className="field"
                type="password"
                minLength={6}
                placeholder="At least 6 characters"
                required
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                Bio
              </label>
              <textarea
                value={form.bio}
                onChange={(e) => setForm((c) => ({ ...c, bio: e.target.value }))}
                className="field min-h-[80px] resize-none"
                placeholder="Tell people about yourself"
                maxLength={255}
              />
            </div>

            <label
              className="flex cursor-pointer items-center justify-between rounded-xl px-4 py-3.5 transition-colors"
              style={{
                background: "var(--surface)",
                border: "1px dashed var(--border-strong)",
              }}
            >
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Profile photo</p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {profilePic ? profilePic.name : "Optional"}
                </p>
              </div>
              <span className="btn-secondary text-xs py-2 px-3">
                <ImagePlus size={14} />
                Select
              </span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setProfilePic(e.target.files?.[0] || null)}
              />
            </label>

            {error && (
              <div className="rounded-xl px-4 py-3 text-sm" style={{ background: "rgba(239,68,68,0.1)", color: "#f87171" }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={submitting} className="btn-primary w-full">
              {submitting ? "Creating…" : "Complete Signup"}
              <ArrowRight size={16} />
            </button>
          </form>
        </div>
      )}
    </AuthShell>
  );
}
