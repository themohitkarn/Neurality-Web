import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  BellRing, MoonStar, Save, ShieldCheck, SunMedium, UserRound, 
  Waves, MonitorCog, KeyRound, Trash2, ChevronRight, ArrowLeft,
  Smartphone, UserCheck, Heart, Info, LogOut 
} from "lucide-react";

import Avatar from "../components/Avatar";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { getErrorMessage, userApi, authApi } from "../services/api";


function ToggleRow({ label, description, checked, onChange }) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-[24px] bg-white/72 px-4 py-4 cursor-pointer hover:bg-white/80 transition-all">
      <div>
        <p className="text-sm font-semibold text-ink">{label}</p>
        <p className="mt-1 text-sm leading-6 text-[color:var(--muted)]">{description}</p>
      </div>
      <span
        className={`relative mt-1 inline-flex h-7 w-12 shrink-0 rounded-full p-1 transition ${
          checked ? "bg-accent" : "bg-zinc-200 dark:bg-zinc-800"
        }`}
      >
        <input type="checkbox" checked={checked} onChange={onChange} className="sr-only" />
        <span
          className={`h-5 w-5 rounded-full bg-white shadow-lg transition ${checked ? "translate-x-5" : "translate-x-0"}`}
        />
      </span>
    </label>
  );
}


export default function Settings() {
  const { user, setUser, logout } = useAuth();
  const { themePreference, setThemePreference } = useTheme();
  const { category: urlCategory } = useParams();
  const navigate = useNavigate();
  
  const [activeCategory, setActiveCategory] = useState(urlCategory || "profile");
  const scrollContainerRef = useRef(null);

  // Sync state with URL
  useEffect(() => {
    if (urlCategory) {
      setActiveCategory(urlCategory);
      const element = document.getElementById(`category-${urlCategory}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }, [urlCategory]);

  const scrollToCategory = (id) => {
    navigate(`/settings/${id}`);
  };
  const categories = [
    { id: "profile", label: "Profile", icon: UserRound, color: "text-blue-500" },
    { id: "privacy", label: "Privacy", icon: ShieldCheck, color: "text-emerald-500" },
    { id: "notifications", label: "Notifications", icon: BellRing, color: "text-orange-500" },
    { id: "appearance", label: "Appearance", icon: MoonStar, color: "text-purple-500" },
    { id: "security", label: "Security", icon: KeyRound, color: "text-amber-500" },
    { id: "account", label: "Account", icon: Smartphone, color: "text-rose-500" },
  ];

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
    read_receipts_enabled: user?.settings?.read_receipts_enabled ?? true,
    typing_indicators_enabled: user?.settings?.typing_indicators_enabled ?? true,
    biometric_lock_enabled: user?.settings?.biometric_lock_enabled ?? false,
    who_can_comment: user?.settings?.who_can_comment || "everyone",
    who_can_tag: user?.settings?.who_can_tag || "everyone",
    story_privacy: user?.settings?.story_privacy || "everyone",
  });
  const [passwordForm, setPasswordForm] = useState({ current_password: "", new_password: "", confirm_password: "" });
  const [changingPassword, setChangingPassword] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
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
          read_receipts_enabled: data.user.settings?.read_receipts_enabled ?? true,
          typing_indicators_enabled: data.user.settings?.typing_indicators_enabled ?? true,
          biometric_lock_enabled: data.user.settings?.biometric_lock_enabled ?? false,
          who_can_comment: data.user.settings?.who_can_comment || "everyone",
          who_can_tag: data.user.settings?.who_can_tag || "everyone",
          story_privacy: data.user.settings?.story_privacy || "everyone",
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
    <main className="mx-auto max-w-[1200px] px-4 py-4 lg:py-10">
      <div className="flex flex-col lg:flex-row gap-8 relative min-h-[calc(100vh-8rem)]">
        
        {/* Modern Settings Sidebar */}
        <aside className={`
          w-full lg:w-[320px] lg:sticky lg:top-24 h-fit
          ${urlCategory ? 'hidden lg:block' : 'block'}
        `}>
          <div className="panel p-2">
            <div className="px-4 py-6 border-b border-[color:var(--border)] mb-2">
              <div className="flex items-center gap-3">
                <Avatar src={user?.profile_pic} name={user?.username} size="lg" />
                <div className="min-w-0">
                  <p className="font-display text-xl truncate text-ink">Settings</p>
                  <p className="text-xs text-[color:var(--text-muted)] truncate">@{user?.username}</p>
                </div>
              </div>
            </div>

            <nav className="flex flex-col gap-1">
              {categories.map((cat) => {
                const Icon = cat.icon;
                const isActive = activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => scrollToCategory(cat.id)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-all ${
                      isActive 
                        ? "bg-[color:var(--accent-soft)] text-[color:var(--accent)]" 
                        : "hover:bg-[color:var(--surface)] text-[color:var(--text-secondary)]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl bg-[color:var(--bg-elevated)] shadow-sm ${isActive ? cat.color : "text-[color:var(--text-muted)]"}`}>
                        <Icon size={18} />
                      </div>
                      <span className="font-semibold text-sm whitespace-nowrap">{cat.label}</span>
                    </div>
                    <ChevronRight size={16} className={isActive ? "opacity-100" : "opacity-40"} />
                  </button>
                );
              })}
            </nav>

            <div className="mt-6 pt-6 border-t border-[color:var(--border)] p-2">
              <button 
                onClick={logout}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-red-500 hover:bg-red-500/10 transition-all"
              >
                <div className="p-2 rounded-xl bg-[color:var(--bg-elevated)] shadow-sm">
                  <LogOut size={18} />
                </div>
                <span className="font-semibold text-sm">Logout</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Settings Content */}
        <div 
          ref={scrollContainerRef}
          className={`
            flex-1 space-y-12 pb-32 lg:h-[calc(100vh-8rem)] lg:overflow-y-auto custom-scrollbar lg:pr-4
            ${!urlCategory ? 'hidden lg:block' : 'block'}
          `}
        >
          {/* Mobile Header */}
          <div className="lg:hidden flex items-center gap-4 mb-8">
             <button onClick={() => navigate('/settings')} className="p-2 rounded-full bg-white/5"><ArrowLeft size={20} /></button>
             <h2 className="text-xl font-display capitalize">{urlCategory} Settings</h2>
          </div>

          {error ? <div className="rounded-[24px] bg-red-50 px-5 py-4 text-sm text-red-500">{error}</div> : null}
          {successMessage ? (
            <div className="rounded-[24px] bg-[rgba(142,13,115,0.08)] px-5 py-4 text-sm text-[color:var(--accent)]">
              {successMessage}
            </div>
          ) : null}

          {/* Section: Profile */}
          <section id="category-profile" className="space-y-6 scroll-mt-24">
            <div className="flex items-center gap-3 px-2">
              <div className="h-10 w-1 bg-[color:var(--accent)] rounded-full" />
              <h2 className="text-2xl font-display text-ink">Profile Details</h2>
            </div>
            
            <form onSubmit={handleProfileSave} className="panel soft-ring p-6 space-y-6">
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 ml-1">Username</label>
                  <input
                    value={profileForm.username}
                    onChange={(event) => setProfileForm((current) => ({ ...current, username: event.target.value }))}
                    className="field !bg-zinc-50 dark:!bg-zinc-900/50"
                    placeholder="Username"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 ml-1">Full Name</label>
                  <input
                    value={profileForm.full_name}
                    onChange={(event) => setProfileForm((current) => ({ ...current, full_name: event.target.value }))}
                    className="field !bg-zinc-50 dark:!bg-zinc-900/50"
                    placeholder="Full name"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 ml-1">Bio</label>
                <textarea
                  value={profileForm.bio}
                  onChange={(event) => setProfileForm((current) => ({ ...current, bio: event.target.value }))}
                  className="field !bg-zinc-50 dark:!bg-zinc-900/50 min-h-[100px] resize-none"
                  placeholder="Tell your story..."
                />
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 ml-1">Website</label>
                  <input
                    value={profileForm.website}
                    onChange={(event) => setProfileForm((current) => ({ ...current, website: event.target.value }))}
                    className="field !bg-zinc-50 dark:!bg-zinc-900/50"
                    placeholder="https://yourlink.com"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 ml-1">Location</label>
                  <input
                    value={profileForm.location}
                    onChange={(event) => setProfileForm((current) => ({ ...current, location: event.target.value }))}
                    className="field !bg-zinc-50 dark:!bg-zinc-900/50"
                    placeholder="City, Country"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <label className="w-full flex-1 cursor-pointer group">
                    <div className="flex items-center gap-4 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800 transition-all group-hover:border-[color:var(--accent)]">
                      <div className="w-12 h-12 rounded-xl bg-white dark:bg-zinc-800 shadow-sm flex items-center justify-center text-zinc-400 group-hover:text-[color:var(--accent)]">
                        <Smartphone size={24} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-ink">Change Profile Photo</p>
                        <p className="text-xs text-zinc-400 truncate">{profilePic ? profilePic.name : "Recommended: 400x400 JPG"}</p>
                      </div>
                      <span className="px-4 py-1.5 rounded-lg bg-white dark:bg-zinc-800 text-xs font-bold shadow-sm">Choose</span>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => setProfilePic(event.target.files?.[0] || null)}
                    />
                  </label>
                  <button type="submit" disabled={savingProfile} className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-[color:var(--accent)] text-white font-bold shadow-lg shadow-[rgba(142,13,115,0.2)] active:scale-95 transition-all">
                    {savingProfile ? "Saving..." : "Update Profile"}
                  </button>
                </div>
              </div>
            </form>
          </section>

          {/* Section: Privacy */}
          <section id="category-privacy" className="space-y-6 scroll-mt-24">
            <div className="flex items-center gap-3 px-2">
              <div className="h-10 w-1 bg-emerald-500 rounded-full" />
              <h2 className="text-2xl font-display text-ink">Privacy & Safety</h2>
            </div>

            <div className="panel soft-ring p-6 space-y-4">
              <ToggleRow
                label="Private Account"
                description="Only your followers will be able to see your posts and stories."
                checked={settingsForm.is_private}
                onChange={() => updateSetting("is_private", !settingsForm.is_private)}
              />
              <ToggleRow
                label="Activity Status"
                description="Allow people you follow to see when you were last active."
                checked={settingsForm.show_activity_status}
                onChange={() => updateSetting("show_activity_status", !settingsForm.show_activity_status)}
              />
              <ToggleRow
                label="Message Requests"
                description="Control who can send you direct message requests."
                checked={settingsForm.allow_message_requests}
                onChange={() => updateSetting("allow_message_requests", !settingsForm.allow_message_requests)}
              />
              <ToggleRow
                label="Read Receipts"
                description="Allow others to see when you've read their messages. This is mutual."
                checked={settingsForm.read_receipts_enabled}
                onChange={() => updateSetting("read_receipts_enabled", !settingsForm.read_receipts_enabled)}
              />
              <ToggleRow
                label="Typing Indicators"
                description="Allow others to see when you're typing. This is mutual."
                checked={settingsForm.typing_indicators_enabled}
                onChange={() => updateSetting("typing_indicators_enabled", !settingsForm.typing_indicators_enabled)}
              />
              
              <div className="grid gap-4 sm:grid-cols-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Comments</label>
                  <select
                    value={settingsForm.who_can_comment}
                    onChange={(e) => updateSetting("who_can_comment", e.target.value)}
                    className="field text-xs !py-2.5"
                  >
                    <option value="everyone">Everyone</option>
                    <option value="followers">Followers</option>
                    <option value="nobody">Nobody</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Tagging</label>
                  <select
                    value={settingsForm.who_can_tag}
                    onChange={(e) => updateSetting("who_can_tag", e.target.value)}
                    className="field text-xs !py-2.5"
                  >
                    <option value="everyone">Everyone</option>
                    <option value="followers">Followers</option>
                    <option value="nobody">Nobody</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Stories</label>
                  <select
                    value={settingsForm.story_privacy}
                    onChange={(e) => updateSetting("story_privacy", e.target.value)}
                    className="field text-xs !py-2.5"
                  >
                    <option value="everyone">Everyone</option>
                    <option value="followers">Followers</option>
                    <option value="close_friends">Close Friends</option>
                  </select>
                </div>
              </div>
              <div className="pt-4 flex justify-end">
                <button 
                  onClick={handleSettingsSave} 
                  disabled={savingSettings}
                  className="px-6 py-2.5 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 font-bold text-sm active:scale-95 transition-all shadow-lg"
                >
                  {savingSettings ? "Saving..." : "Save Privacy"}
                </button>
              </div>
            </div>
          </section>

          {/* Section: Appearance */}
          <section id="category-appearance" className="space-y-6 scroll-mt-24">
            <div className="flex items-center gap-3 px-2">
              <div className="h-10 w-1 bg-purple-500 rounded-full" />
              <h2 className="text-2xl font-display text-ink">Appearance</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { value: "light", label: "Light Mode", icon: SunMedium, desc: "Classic bright theme" },
                { value: "dark", label: "Dark Mode", icon: MoonStar, desc: "Easy on the eyes" },
                { value: "system", label: "System", icon: MonitorCog, desc: "Matches device" },
              ].map((option) => {
                const Icon = option.icon;
                const active = settingsForm.theme_preference === option.value;
                return (
                  <button
                    key={option.value}
                    onClick={() => updateSetting("theme_preference", option.value)}
                    className={`panel p-5 text-left transition-all relative overflow-hidden group ${
                      active 
                        ? "border-[color:var(--accent)] ring-2 ring-[color:var(--accent-soft)]" 
                        : "hover:border-zinc-300 dark:hover:border-zinc-700"
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${active ? "bg-[color:var(--accent)] text-white" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"}`}>
                      <Icon size={20} />
                    </div>
                    <p className="font-bold text-ink">{option.label}</p>
                    <p className="text-xs text-zinc-400 mt-1">{option.desc}</p>
                    {active && <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[color:var(--accent)]" />}
                  </button>
                );
              })}
            </div>
            <div className="pt-2 flex justify-end">
              <button 
                onClick={handleSettingsSave} 
                disabled={savingSettings}
                className="px-6 py-2.5 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 font-bold text-sm active:scale-95 transition-all shadow-lg"
              >
                {savingSettings ? "Saving..." : "Apply Theme"}
              </button>
            </div>
          </section>

          {/* Section: Notifications */}
          <section id="category-notifications" className="space-y-6 scroll-mt-24">
            <div className="flex items-center gap-3 px-2">
              <div className="h-10 w-1 bg-orange-500 rounded-full" />
              <h2 className="text-2xl font-display text-ink">Notifications</h2>
            </div>

            <div className="panel soft-ring p-6 space-y-4">
              <ToggleRow
                label="Push Notifications"
                description="Receive real-time alerts for likes, comments, and messages."
                checked={settingsForm.push_notifications}
                onChange={() => updateSetting("push_notifications", !settingsForm.push_notifications)}
              />
              <ToggleRow
                label="Email Updates"
                description="Weekly digest and important account security alerts."
                checked={settingsForm.email_notifications}
                onChange={() => updateSetting("email_notifications", !settingsForm.email_notifications)}
              />
            </div>
            <div className="pt-2 flex justify-end">
              <button 
                onClick={handleSettingsSave} 
                disabled={savingSettings}
                className="px-6 py-2.5 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 font-bold text-sm active:scale-95 transition-all shadow-lg"
              >
                {savingSettings ? "Saving..." : "Save Notifications"}
              </button>
            </div>
          </section>

          {/* Section: Security */}
          <section id="category-security" className="space-y-6 scroll-mt-24">
            <div className="flex items-center gap-3 px-2">
              <div className="h-10 w-1 bg-amber-500 rounded-full" />
              <h2 className="text-2xl font-display text-ink">Security</h2>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (passwordForm.new_password !== passwordForm.confirm_password) {
                  setError("New passwords don't match.");
                  return;
                }
                setChangingPassword(true);
                setError("");
                setSuccessMessage("");
                try {
                  const { data } = await authApi.changePassword({
                    current_password: passwordForm.current_password,
                    new_password: passwordForm.new_password,
                  });
                  setSuccessMessage(data.message);
                  setPasswordForm({ current_password: "", new_password: "", confirm_password: "" });
                } catch (err) {
                  setError(getErrorMessage(err));
                } finally {
                  setChangingPassword(false);
                }
              }}
              className="panel soft-ring p-6 space-y-6"
            >
              <div className="space-y-4">
                <input
                  type="password"
                  value={passwordForm.current_password}
                  onChange={(e) => setPasswordForm((c) => ({ ...c, current_password: e.target.value }))}
                  className="field !bg-zinc-50 dark:!bg-zinc-900/50"
                  placeholder="Current Password"
                  required
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <input
                    type="password"
                    value={passwordForm.new_password}
                    onChange={(e) => setPasswordForm((c) => ({ ...c, new_password: e.target.value }))}
                    className="field !bg-zinc-50 dark:!bg-zinc-900/50"
                    placeholder="New Password"
                    minLength={6}
                    required
                  />
                  <input
                    type="password"
                    value={passwordForm.confirm_password}
                    onChange={(e) => setPasswordForm((c) => ({ ...c, confirm_password: e.target.value }))}
                    className="field !bg-zinc-50 dark:!bg-zinc-900/50"
                    placeholder="Confirm New Password"
                    minLength={6}
                    required
                  />
                </div>
              </div>
              
              <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <ToggleRow
                  label="Biometric Lock"
                  description="Require fingerprint or PIN to access the Neurality ecosystem."
                  checked={settingsForm.biometric_lock_enabled}
                  onChange={() => updateSetting("biometric_lock_enabled", !settingsForm.biometric_lock_enabled)}
                />
              </div>

              <button type="submit" disabled={changingPassword} className="w-full sm:w-auto px-8 py-3 rounded-xl border-2 border-amber-500/20 text-amber-600 font-bold hover:bg-amber-500/10 transition-all">
                {changingPassword ? "Updating..." : "Update Security"}
              </button>
            </form>
          </section>

          {/* Section: Account Actions */}
          <section id="category-account" className="space-y-6 scroll-mt-24">
            <div className="flex items-center gap-3 px-2">
              <div className="h-10 w-1 bg-rose-500 rounded-full" />
              <h2 className="text-2xl font-display text-ink">Professional Account</h2>
            </div>

            <div className="panel soft-ring p-6 space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-ink">Account Mode</label>
                <div className="grid grid-cols-3 gap-2">
                  {["personal", "professional", "creator"].map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => updateSetting("account_type", type)}
                      className={`py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
                        settingsForm.account_type === type 
                          ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-md" 
                          : "bg-zinc-50 dark:bg-zinc-900/50 text-zinc-400"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-2 text-sm font-bold text-red-500 hover:underline"
                >
                  <Trash2 size={16} />
                  Request Account Deletion
                </button>
              </div>
            </div>
          </section>

          <div className="flex justify-center py-10 opacity-30">
            <p className="text-[10px] font-bold uppercase tracking-[0.5em] text-zinc-500">Neurality Social Engine v2.0</p>
          </div>
        </div>
      </div>
    </main>
  );
}
