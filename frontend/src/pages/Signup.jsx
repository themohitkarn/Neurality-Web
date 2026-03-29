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
      eyebrow="Start sharing"
      title="Build a profile, publish your first photo, and grow a following."
      description="The signup flow is connected to Flask, MySQL, JWT auth, and secure local media storage so new accounts are production-shaped from the first request."
      footerText="Already have an account?"
      footerLink="/login"
      footerLabel="Log in"
    >
      <div>
        <p className="font-display text-3xl text-ink">Create account</p>
        <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
          Pick a username, add an optional bio, and upload a profile photo to launch your space.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-ink">Username</label>
            <input
              value={form.username}
              onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
              className="field"
              placeholder="santa"
              required
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-ink">Email</label>
            <input
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              className="field"
              type="email"
              placeholder="santa@neurality.dev"
              required
            />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-ink">Password</label>
          <input
            value={form.password}
            onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
            className="field"
            type="password"
            minLength={6}
            placeholder="At least 6 characters"
            required
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-ink">Bio</label>
          <textarea
            value={form.bio}
            onChange={(event) => setForm((current) => ({ ...current, bio: event.target.value }))}
            className="field min-h-[108px] resize-none"
            placeholder="What should people know about you?"
            maxLength={255}
          />
        </div>

        <label className="flex cursor-pointer items-center justify-between rounded-[24px] border border-dashed border-[color:var(--line)] bg-white/60 px-4 py-4 transition hover:bg-white/85">
          <div>
            <p className="text-sm font-medium text-ink">Profile photo</p>
            <p className="text-xs text-[color:var(--muted)]">
              {profilePic ? profilePic.name : "Optional. JPG, PNG, WEBP, GIF, or SVG."}
            </p>
          </div>
          <span className="ghost-button gap-2">
            <ImagePlus size={16} />
            Select
          </span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => setProfilePic(event.target.files?.[0] || null)}
          />
        </label>

        {error ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-500">{error}</p> : null}

        <button type="submit" disabled={submitting} className="accent-button w-full gap-2">
          {submitting ? "Creating account..." : "Create account"}
          <ArrowRight size={16} />
        </button>
      </form>
    </AuthShell>
  );
}
