import { useState } from "react";
import { ArrowRight, ImagePlus } from "lucide-react";
import { useNavigate } from "react-router-dom";

import AuthShell from "../components/AuthShell";
import { useAuth } from "../context/AuthContext";
import { getErrorMessage } from "../services/api";


export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    bio: "",
  });
  const [profilePic, setProfilePic] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const payload = new FormData();
      payload.append("username", form.username);
      payload.append("email", form.email);
      payload.append("password", form.password);
      payload.append("bio", form.bio);
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
      footerText="Already have an account?"
      footerLink="/login"
      footerLabel="Log in"
    >
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Create account</h1>
        <p className="mt-1.5 text-sm" style={{ color: "var(--text-muted)" }}>
          Set up your profile and start sharing.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Email
          </label>
          <input
            value={form.email}
            onChange={(e) => setForm((c) => ({ ...c, email: e.target.value }))}
            className="field"
            type="email"
            placeholder="your@email.com"
            required
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

        {error ? (
          <div className="rounded-xl px-4 py-3 text-sm" style={{ background: "rgba(239,68,68,0.1)", color: "#f87171" }}>
            {error}
          </div>
        ) : null}

        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? "Creating…" : "Create account"}
          <ArrowRight size={16} />
        </button>
      </form>
    </AuthShell>
  );
}
