import { useEffect, useState } from "react";
import { BellRing, MoonStar, Save, ShieldCheck, SunMedium, UserRound, Waves, MonitorCog } from "lucide-react";

import Avatar from "../components/Avatar";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { getErrorMessage, userApi } from "../services/api";


function ToggleRow({ label, description, checked, onChange }) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-[24px] bg-white/72 px-4 py-4">
      <div>
        <p className="text-sm font-semibold text-ink">{label}</p>
        <p className="mt-1 text-sm leading-6 text-[color:var(--muted)]">{description}</p>
      </div>
      <span
        className={`relative mt-1 inline-flex h-7 w-12 shrink-0 rounded-full p-1 transition ${
          checked ? "bg-[rgba(142,13,115,0.82)]" : "bg-[rgba(29,22,32,0.12)]"
        }`}
      >
        <input type="checkbox" checked={checked} onChange={onChange} className="sr-only" />
        <span
          className={`h-5 w-5 rounded-full bg-white shadow transition ${checked ? "translate-x-5" : "translate-x-0"}`}
        />
      </span>
    </label>
  );
}


export default function Settings() {
  const { user, setUser, logout } = useAuth();
  const { themePreference, setThemePreference } = useTheme();

  const [profileForm, setProfileForm] = useState({
    username: user?.username || "",
    full_name: user?.full_name || "",
    email: user?.email || "",
    bio: user?.bio || "",
    website: user?.website || "",
    location: user?.location || "",
  });
  const [settingsForm, setSettingsForm] = useState({
    theme_preference: user?.settings?.theme_preference || themePreference,
    is_private: user?.settings?.is_private || false,
    account_type: user?.settings?.account_type || user?.account_type || "personal",
    allow_message_requests: user?.settings?.allow_message_requests ?? true,
    show_activity_status: user?.settings?.show_activity_status ?? true,
    email_notifications: user?.settings?.email_notifications ?? true,
    push_notifications: user?.settings?.push_notifications ?? true,
    autoplay_reels: user?.settings?.autoplay_reels ?? true,
    reduce_data_usage: user?.settings?.reduce_data_usage ?? false,
  });
  const [profilePic, setProfilePic] = useState(null);
  const [removeProfilePic, setRemoveProfilePic] = useState(false);
  const [followRequests, setFollowRequests] = useState({ incoming: [], outgoing: [] });
  const [loadingFollowRequests, setLoadingFollowRequests] = useState(true);
  const [followActionKey, setFollowActionKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    const loadFollowRequests = async () => {
      setLoadingFollowRequests(true);
      try {
        const { data } = await userApi.getFollowRequests();
        setFollowRequests({
          incoming: data.incoming || [],
          outgoing: data.outgoing || [],
        });
      } catch (_err) {
        setFollowRequests({ incoming: [], outgoing: [] });
      } finally {
        setLoadingFollowRequests(false);
      }
    };

    const loadSettings = async () => {
      setLoading(true);
      try {
        const { data } = await userApi.getSettings();
        setUser(data.user);
        setProfileForm({
          username: data.user.username || "",
          full_name: data.user.full_name || "",
          email: data.user.email || "",
          bio: data.user.bio || "",
          website: data.user.website || "",
          location: data.user.location || "",
        });
        setSettingsForm({
          theme_preference: data.user.settings?.theme_preference || "system",
          is_private: data.user.settings?.is_private || false,
          account_type: data.user.settings?.account_type || data.user.account_type || "personal",
          allow_message_requests: data.user.settings?.allow_message_requests ?? true,
          show_activity_status: data.user.settings?.show_activity_status ?? true,
          email_notifications: data.user.settings?.email_notifications ?? true,
          push_notifications: data.user.settings?.push_notifications ?? true,
          autoplay_reels: data.user.settings?.autoplay_reels ?? true,
          reduce_data_usage: data.user.settings?.reduce_data_usage ?? false,
        });
        setThemePreference(data.user.settings?.theme_preference || "system");
        setError("");
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };

    loadFollowRequests();
    loadSettings();
  }, [setThemePreference, setUser]);

  const updateSetting = (key, value) => {
    setSettingsForm((current) => ({ ...current, [key]: value }));
    if (key === "theme_preference") {
      setThemePreference(value);
    }
  };

  const handleProfileSave = async (event) => {
    event.preventDefault();
    setSavingProfile(true);
    setError("");
    setSuccessMessage("");

    try {
      const payload = new FormData();
      Object.entries(profileForm).forEach(([key, value]) => payload.append(key, value));
      payload.append("remove_profile_pic", removeProfilePic ? "true" : "false");
      if (profilePic) {
        payload.append("profile_pic", profilePic);
      }

      const { data } = await userApi.updateProfile(payload);
      setUser(data.user);
      setProfilePic(null);
      setRemoveProfilePic(false);
      setSuccessMessage("Profile updated.");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSettingsSave = async (event) => {
    event.preventDefault();
    setSavingSettings(true);
    setError("");
    setSuccessMessage("");

    try {
      const { data } = await userApi.updateSettings(settingsForm);
      setUser(data.user);
      setThemePreference(data.user.settings?.theme_preference || "system");
      setSuccessMessage("Settings updated.");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSavingSettings(false);
    }
  };

  const handleRespondToFollowRequest = async (requestId, action) => {
    const actionKey = `${action}-${requestId}`;
    setFollowActionKey(actionKey);
    setError("");
    setSuccessMessage("");

    try {
      await userApi.respondFollowRequest({ request_id: requestId, action });
      const [{ data: settingsData }, { data: requestsData }] = await Promise.all([
        userApi.getSettings(),
        userApi.getFollowRequests(),
      ]);
      setUser(settingsData.user);
      setFollowRequests({
        incoming: requestsData.incoming || [],
        outgoing: requestsData.outgoing || [],
      });
      setSuccessMessage(action === "accepted" ? "Follow request accepted." : "Follow request rejected.");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setFollowActionKey("");
    }
  };

  return (
    <main className="mx-auto max-w-[1440px] px-4 py-4 lg:py-6">
      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="space-y-6 xl:sticky xl:top-28 xl:self-start">
          <section className="panel soft-ring px-5 py-6">
            <div className="flex items-center gap-4">
              <Avatar src={user?.profile_pic} name={user?.username} size="lg" />
              <div>
                <p className="font-display text-3xl text-ink">Settings</p>
                <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                  Appearance, privacy, notifications, and profile controls for a more production-ready account setup.
                </p>
              </div>
            </div>
          </section>

          <section className="panel soft-ring px-5 py-6">
            <p className="font-display text-2xl text-ink">Theme</p>
            <div className="mt-4 grid gap-3">
              {[
                { value: "light", label: "Light", icon: SunMedium },
                { value: "dark", label: "Dark", icon: MoonStar },
                { value: "system", label: "System", icon: MonitorCog },
              ].map((option) => {
                const Icon = option.icon;
                const active = settingsForm.theme_preference === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => updateSetting("theme_preference", option.value)}
                    className={`flex items-center justify-between rounded-[22px] px-4 py-4 text-left transition ${
                      active ? "bg-[rgba(142,13,115,0.14)] text-ink" : "bg-white/72 text-[color:var(--muted)]"
                    }`}
                  >
                    <span className="inline-flex items-center gap-3">
                      <Icon size={18} />
                      {option.label}
                    </span>
                    <span className="text-xs uppercase tracking-[0.22em]">
                      {active ? "Active" : "Select"}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="panel soft-ring px-5 py-6">
            <p className="font-display text-2xl text-ink">Account actions</p>
            <div className="mt-4 grid gap-3">
              <button type="button" onClick={logout} className="ghost-button justify-start">
                Log out
              </button>
            </div>
          </section>
        </aside>

        <section className="space-y-6">
          {loading ? (
            <div className="panel soft-ring px-6 py-12 text-center">
              <p className="font-display text-2xl text-ink">Loading settings</p>
              <p className="mt-2 text-sm text-[color:var(--muted)]">Pulling your current account preferences.</p>
            </div>
          ) : null}

          {error ? <div className="rounded-[24px] bg-red-50 px-5 py-4 text-sm text-red-500">{error}</div> : null}
          {successMessage ? (
            <div className="rounded-[24px] bg-[rgba(142,13,115,0.08)] px-5 py-4 text-sm text-[color:var(--accent)]">
              {successMessage}
            </div>
          ) : null}

          <form onSubmit={handleProfileSave} className="panel soft-ring px-5 py-6">
            <div className="flex items-center gap-3">
              <UserRound size={18} className="text-[color:var(--accent)]" />
              <p className="font-display text-2xl text-ink">Edit profile</p>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <input
                value={profileForm.username}
                onChange={(event) => setProfileForm((current) => ({ ...current, username: event.target.value }))}
                className="field"
                placeholder="Username"
              />
              <input
                value={profileForm.full_name}
                onChange={(event) => setProfileForm((current) => ({ ...current, full_name: event.target.value }))}
                className="field"
                placeholder="Full name"
              />
              <input
                value={profileForm.email}
                onChange={(event) => setProfileForm((current) => ({ ...current, email: event.target.value }))}
                className="field"
                placeholder="Email"
                type="email"
              />
              <input
                value={profileForm.location}
                onChange={(event) => setProfileForm((current) => ({ ...current, location: event.target.value }))}
                className="field"
                placeholder="Location"
              />
            </div>

            <textarea
              value={profileForm.bio}
              onChange={(event) => setProfileForm((current) => ({ ...current, bio: event.target.value }))}
              className="field mt-4 min-h-[120px] resize-none"
              placeholder="Bio"
            />

            <input
              value={profileForm.website}
              onChange={(event) => setProfileForm((current) => ({ ...current, website: event.target.value }))}
              className="field mt-4"
              placeholder="Website"
            />

            <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
              <label className="flex cursor-pointer items-center justify-between rounded-[24px] border border-dashed border-[color:var(--line)] bg-white/70 px-4 py-4 transition hover:bg-white">
                <div>
                  <p className="text-sm font-medium text-ink">Profile photo</p>
                  <p className="text-xs text-[color:var(--muted)]">
                    {profilePic ? profilePic.name : "Choose a new profile image"}
                  </p>
                </div>
                <span className="ghost-button">Select</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => setProfilePic(event.target.files?.[0] || null)}
                />
              </label>

              <ToggleRow
                label="Remove current photo"
                description="Clear the current avatar if you want a fresh start."
                checked={removeProfilePic}
                onChange={() => setRemoveProfilePic((current) => !current)}
              />
            </div>

            <button type="submit" disabled={savingProfile} className="accent-button mt-5 gap-2">
              <Save size={16} />
              {savingProfile ? "Saving profile..." : "Save profile"}
            </button>
          </form>

          <form onSubmit={handleSettingsSave} className="panel soft-ring px-5 py-6">
            <div className="flex items-center gap-3">
              <ShieldCheck size={18} className="text-[color:var(--accent)]" />
              <p className="font-display text-2xl text-ink">Privacy and safety</p>
            </div>

            <div className="mt-5 rounded-[24px] bg-white/72 px-4 py-4">
              <p className="text-sm font-semibold text-ink">Account type</p>
              <p className="mt-1 text-sm leading-6 text-[color:var(--muted)]">
                Switch between personal, professional, and creator account modes.
              </p>
              <select
                value={settingsForm.account_type}
                onChange={(event) => updateSetting("account_type", event.target.value)}
                className="field mt-4"
              >
                <option value="personal">Personal</option>
                <option value="professional">Professional</option>
                <option value="creator">Creator</option>
              </select>
            </div>

            <div className="mt-5 grid gap-4">
              <ToggleRow
                label="Private account"
                description="Only followers can view your drops and active stories."
                checked={settingsForm.is_private}
                onChange={() => updateSetting("is_private", !settingsForm.is_private)}
              />
              <ToggleRow
                label="Allow message requests"
                description="Turn this off if you only want followers to message you."
                checked={settingsForm.allow_message_requests}
                onChange={() =>
                  updateSetting("allow_message_requests", !settingsForm.allow_message_requests)
                }
              />
              <ToggleRow
                label="Show activity status"
                description="Keep your chat presence visible to other people."
                checked={settingsForm.show_activity_status}
                onChange={() =>
                  updateSetting("show_activity_status", !settingsForm.show_activity_status)
                }
              />
            </div>

            <div className="mt-6">
              <p className="font-display text-2xl text-ink">Follow requests</p>
              <p className="mt-2 text-sm text-[color:var(--muted)]">
                Approve or reject who gets access to your private account.
              </p>

              {loadingFollowRequests ? (
                <div className="mt-4 rounded-[24px] bg-white/72 px-4 py-4 text-sm text-[color:var(--muted)]">
                  Loading follow requests...
                </div>
              ) : null}

              {!loadingFollowRequests && followRequests.incoming.length === 0 ? (
                <div className="mt-4 rounded-[24px] bg-white/72 px-4 py-4 text-sm text-[color:var(--muted)]">
                  No pending follow requests right now.
                </div>
              ) : null}

              {!loadingFollowRequests && followRequests.incoming.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {followRequests.incoming.map((requestItem) => (
                    <div key={requestItem.id} className="rounded-[24px] bg-white/72 px-4 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar src={requestItem.sender.profile_pic} name={requestItem.sender.username} size="md" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-ink">{requestItem.sender.username}</p>
                          <p className="truncate text-xs text-[color:var(--muted)]">
                            wants to follow your {settingsForm.account_type} account
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => handleRespondToFollowRequest(requestItem.id, "accepted")}
                          disabled={followActionKey === `accepted-${requestItem.id}`}
                          className="accent-button gap-2"
                        >
                          {followActionKey === `accepted-${requestItem.id}` ? "Accepting..." : "Accept"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRespondToFollowRequest(requestItem.id, "rejected")}
                          disabled={followActionKey === `rejected-${requestItem.id}`}
                          className="ghost-button gap-2"
                        >
                          {followActionKey === `rejected-${requestItem.id}` ? "Rejecting..." : "Reject"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="mt-6 flex items-center gap-3">
              <BellRing size={18} className="text-[color:var(--accent)]" />
              <p className="font-display text-2xl text-ink">Notifications and media</p>
            </div>

            <div className="mt-5 grid gap-4">
              <ToggleRow
                label="Email notifications"
                description="Receive account and activity updates by email."
                checked={settingsForm.email_notifications}
                onChange={() => updateSetting("email_notifications", !settingsForm.email_notifications)}
              />
              <ToggleRow
                label="Push notifications"
                description="Keep in-app alerts and reaction updates active."
                checked={settingsForm.push_notifications}
                onChange={() => updateSetting("push_notifications", !settingsForm.push_notifications)}
              />
              <ToggleRow
                label="Autoplay reels"
                description="Control whether reels start playing automatically in the feed."
                checked={settingsForm.autoplay_reels}
                onChange={() => updateSetting("autoplay_reels", !settingsForm.autoplay_reels)}
              />
              <ToggleRow
                label="Reduce data usage"
                description="Prefer lighter media behavior on slower or metered mobile networks."
                checked={settingsForm.reduce_data_usage}
                onChange={() => updateSetting("reduce_data_usage", !settingsForm.reduce_data_usage)}
              />
            </div>

            <button type="submit" disabled={savingSettings} className="accent-button mt-5 gap-2">
              <Waves size={16} />
              {savingSettings ? "Saving settings..." : "Save settings"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
