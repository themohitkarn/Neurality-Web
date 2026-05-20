import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  BellRing, ShieldCheck, MoonStar, KeyRound, Smartphone, Sparkles, 
  ChevronRight, ArrowLeft, LogOut, Trash2, ShieldAlert, Check, 
  AlertCircle, Plus, X, EyeOff, LayoutList, CheckCircle2, MessageSquareText,
  Volume2, HelpCircle, HardDrive, Languages, MonitorPlay, Eye, UserCheck
} from "lucide-react";

import Avatar from "../components/Avatar";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { getErrorMessage, userApi, authApi, socialApi } from "../services/api";

function ToggleRow({ label, description, checked, onChange }) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-[20px] bg-zinc-50 dark:bg-zinc-900/50 p-4 border border-[color:var(--border)] cursor-pointer hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50 transition-all">
      <div>
        <p className="text-sm font-semibold text-ink">{label}</p>
        <p className="mt-1 text-xs text-[color:var(--text-muted)] leading-relaxed">{description}</p>
      </div>
      <span
        className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 rounded-full p-0.5 transition-colors duration-200 ${
          checked ? "bg-[color:var(--accent)]" : "bg-zinc-200 dark:bg-zinc-800"
        }`}
      >
        <input type="checkbox" checked={checked} onChange={onChange} className="sr-only" />
        <span
          className={`h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-200 ${checked ? "translate-x-5" : "translate-x-0"}`}
        />
      </span>
    </label>
  );
}

export default function Settings() {
  const { user, setUser, logout } = useAuth();
  const { 
    themePreference, 
    setThemePreference, 
    accentColor, 
    setAccentColor, 
    customThemeColors, 
    updateCustomThemeColors 
  } = useTheme();
  const { category: urlCategory } = useParams();
  const navigate = useNavigate();
  
  const [activeCategory, setActiveCategory] = useState(urlCategory || "");
  const scrollContainerRef = useRef(null);

  // Sync state with URL category
  useEffect(() => {
    if (urlCategory) {
      setActiveCategory(urlCategory);
    } else {
      setActiveCategory("");
    }
  }, [urlCategory]);

  const categories = [
    { id: "account", label: "Account Center", icon: KeyRound, color: "text-rose-500", desc: "Password, sessions & deactivation" },
    { id: "privacy", label: "Privacy & Safety", icon: ShieldCheck, color: "text-emerald-500", desc: "Blocked lists, visibility & story privacy" },
    { id: "chat-controls", label: "Chat Controls", icon: MessageSquareText, color: "text-blue-500", desc: "Themes, timers, nicknames & receipts" },
    { id: "notifications", label: "Notifications", icon: BellRing, color: "text-orange-500", desc: "Push sound, vibration & action preferences" },
    { id: "appearance", label: "Appearance", icon: MoonStar, color: "text-purple-500", desc: "Theme modes, AMOLED & custom accent colors" },
    { id: "content", label: "Content Preferences", icon: MonitorPlay, color: "text-amber-500", desc: "Autoplay, media quality & NSFW filters" },
    { id: "device", label: "Device & App", icon: Smartphone, color: "text-indigo-500", desc: "Permissions, language & tablet support" },
    { id: "feature-labs", label: "Feature Labs", icon: Sparkles, color: "text-cyan-500", desc: "Opt-in to experimental beta features" },
    { id: "support", label: "Support & Help", icon: HelpCircle, color: "text-teal-500", desc: "Report issues, assistant & documentation" },
  ];

  // Forms and Settings States
  const [settingsForm, setSettingsForm] = useState({
    theme_preference: user?.settings?.theme_preference || "system",
    amoled_mode: localStorage.getItem("amoled_mode") === "true",
    ui_density: localStorage.getItem("ui_density") || "default",
    is_private: user?.settings?.is_private || false,
    account_type: user?.settings?.account_type || user?.account_type || "personal",
    allow_message_requests: user?.settings?.allow_message_requests ?? true,
    show_activity_status: user?.settings?.show_activity_status ?? true,
    email_notifications: user?.settings?.email_notifications ?? true,
    push_notifications: user?.settings?.push_notifications ?? true,
    read_receipts_enabled: user?.settings?.read_receipts_enabled ?? true,
    typing_indicators_enabled: user?.settings?.typing_indicators_enabled ?? true,
    biometric_lock_enabled: user?.settings?.biometric_lock_enabled ?? false,
    who_can_comment: user?.settings?.who_can_comment || "everyone",
    who_can_tag: user?.settings?.who_can_tag || "everyone",
    story_privacy: user?.settings?.story_privacy || "everyone",
  });

  // Additional Interactive States
  const [passwordForm, setPasswordForm] = useState({ current_password: "", new_password: "", confirm_password: "" });
  const [changingPassword, setChangingPassword] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [linkEmailInput, setLinkEmailInput] = useState("");
  const [linkPhoneInput, setLinkPhoneInput] = useState("");
  const [isLinkingEmail, setIsLinkingEmail] = useState(false);
  const [isLinkingPhone, setIsLinkingPhone] = useState(false);
  
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [loadingBlocked, setLoadingBlocked] = useState(false);
  const [mutedUsersCount, setMutedUsersCount] = useState(0);
  const [restrictedUsersCount, setRestrictedUsersCount] = useState(0);
  
  const [hiddenWordInput, setHiddenWordInput] = useState("");
  const [hiddenWords, setHiddenWords] = useState(
    JSON.parse(localStorage.getItem("hidden_words") || '["spam", "crypto", "scam", "ads"]')
  );

  const [chatTheme, setChatTheme] = useState(localStorage.getItem("default_chat_theme") || "matcha");
  const [disappearingTimer, setDisappearingTimer] = useState(
    parseInt(localStorage.getItem("default_disappearing_timer") || "0")
  );

  // Notification Detailed Preferences
  const [notifSound, setNotifSound] = useState(localStorage.getItem("notif_sound") || "cyber_ping");
  const [vibrationEnabled, setVibrationEnabled] = useState(localStorage.getItem("notif_vibration") !== "false");
  const [notifPreferences, setNotifPreferences] = useState({
    likes: localStorage.getItem("notif_likes") !== "false",
    follows: localStorage.getItem("notif_follows") !== "false",
    comments: localStorage.getItem("notif_comments") !== "false",
    reels: localStorage.getItem("notif_reels") !== "false",
    messages: localStorage.getItem("notif_messages") !== "false",
    mentions: localStorage.getItem("notif_mentions") !== "false",
  });

  // Accent and spacing states
  // Accent color state is now driven globally by the Theme Context
  const [fontSize, setFontSize] = useState(localStorage.getItem("font_size") || "standard");
  const [animationIntensity, setAnimationIntensity] = useState(localStorage.getItem("animation_intensity") || "fluid");

  // Content preferences state
  const [contentPrefs, setContentPrefs] = useState({
    autoplay_videos: localStorage.getItem("content_autoplay") !== "false",
    data_saver: localStorage.getItem("content_datasaver") === "true",
    high_quality_media: localStorage.getItem("content_hqmedia") !== "false",
    ai_recommendations: localStorage.getItem("content_airecom") !== "false",
    nsfw_filter: localStorage.getItem("content_nsfw") !== "false",
    content_sensitivity: localStorage.getItem("content_sensitivity") || "standard",
    recommendation_tuning: localStorage.getItem("recommendation_tuning") || "balanced"
  });

  // Device & App preferences state
  const [devicePermissions, setDevicePermissions] = useState({
    camera: true,
    mic: true,
    storage: true,
    location: false,
    website_permissions: true
  });
  const [appLanguage, setAppLanguage] = useState(localStorage.getItem("app_lang") || "english");
  const [archivedMode, setArchivedMode] = useState(localStorage.getItem("app_archive_save") !== "false");
  const [tabletSupport, setTabletSupport] = useState(localStorage.getItem("app_tablet_layout") === "true");
  const [earlyAccess, setEarlyAccess] = useState(localStorage.getItem("flag_early_access") === "true");

  // High Performance FastAPI Feature Flag State
  const [featureFlags, setFeatureFlags] = useState({
    dm_reactions_v2: localStorage.getItem("flag_dm_reactions_v2") === "true",
    ai_translation: localStorage.getItem("flag_ai_translation") === "true",
    webrtc_calling_v2: localStorage.getItem("flag_webrtc_calling_v2") === "true",
    beta_rollout_10: localStorage.getItem("flag_beta_rollout_10") === "true",
    beta_reels_engine: localStorage.getItem("flag_beta_reels_engine") === "true",
    smart_preload: localStorage.getItem("flag_smart_preload") === "true",
    ai_feed_ranker: localStorage.getItem("flag_ai_feed_ranker") === "true",
    new_profile_layout: localStorage.getItem("flag_new_profile_layout") === "true",
  });

  // Support State
  const [supportMessage, setSupportMessage] = useState("");
  const [submittingSupport, setSubmittingSupport] = useState(false);

  const [savingSettings, setSavingSettings] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Save generic setting helper
  const handleSavePreference = async (key, value) => {
    try {
      const { data } = await userApi.updateSettings({ [key]: value });
      if (data?.user) {
        setUser(data.user);
      }
    } catch (err) {
      console.error(`Failed to save preference ${key} to backend:`, err);
    }
  };

  // Load Settings and Real Blocked List
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { data } = await userApi.getSettings();
        setUser(data.user);
        
        const settings = data.user.settings || {};
        setSettingsForm({
          theme_preference: settings.theme_preference || "system",
          amoled_mode: settings.amoled_mode ?? (localStorage.getItem("amoled_mode") === "true"),
          ui_density: settings.ui_density || localStorage.getItem("ui_density") || "default",
          is_private: settings.is_private || false,
          account_type: settings.account_type || data.user.account_type || "personal",
          allow_message_requests: settings.allow_message_requests ?? true,
          show_activity_status: settings.show_activity_status ?? true,
          email_notifications: settings.email_notifications ?? true,
          push_notifications: settings.push_notifications ?? true,
          read_receipts_enabled: settings.read_receipts_enabled ?? true,
          typing_indicators_enabled: settings.typing_indicators_enabled ?? true,
          biometric_lock_enabled: settings.biometric_lock_enabled ?? false,
          who_can_comment: settings.who_can_comment || "everyone",
          who_can_tag: settings.who_can_tag || "everyone",
          story_privacy: settings.story_privacy || "everyone",
        });

        if (settings.default_chat_theme) setChatTheme(settings.default_chat_theme);
        if (settings.default_disappearing_timer !== undefined) setDisappearingTimer(parseInt(settings.default_disappearing_timer));
        if (settings.notif_sound) setNotifSound(settings.notif_sound);
        if (settings.notif_vibration !== undefined) setVibrationEnabled(settings.notif_vibration);

        setNotifPreferences({
          likes: settings.notif_likes ?? (localStorage.getItem("notif_likes") !== "false"),
          follows: settings.notif_follows ?? (localStorage.getItem("notif_follows") !== "false"),
          comments: settings.notif_comments ?? (localStorage.getItem("notif_comments") !== "false"),
          reels: settings.notif_reels ?? (localStorage.getItem("notif_reels") !== "false"),
          messages: settings.notif_messages ?? (localStorage.getItem("notif_messages") !== "false"),
          mentions: settings.notif_mentions ?? (localStorage.getItem("notif_mentions") !== "false"),
        });

        if (settings.font_size) setFontSize(settings.font_size);
        if (settings.animation_intensity) setAnimationIntensity(settings.animation_intensity);

        setContentPrefs({
          autoplay_videos: settings.content_autoplay ?? (localStorage.getItem("content_autoplay") !== "false"),
          data_saver: settings.content_datasaver ?? (localStorage.getItem("content_datasaver") === "true"),
          high_quality_media: settings.content_hqmedia ?? (localStorage.getItem("content_hqmedia") !== "false"),
          ai_recommendations: settings.content_airecom ?? (localStorage.getItem("content_airecom") !== "false"),
          nsfw_filter: settings.content_nsfw ?? (localStorage.getItem("content_nsfw") !== "false"),
          content_sensitivity: settings.content_sensitivity || "standard",
          recommendation_tuning: settings.recommendation_tuning || "balanced",
        });

        if (settings.app_lang) setAppLanguage(settings.app_lang);
        if (settings.app_archive_save !== undefined) setArchivedMode(settings.app_archive_save);
        if (settings.app_tablet_layout !== undefined) setTabletSupport(settings.app_tablet_layout);
        if (settings.flag_early_access !== undefined) setEarlyAccess(settings.flag_early_access);

        setFeatureFlags({
          dm_reactions_v2: settings.flag_dm_reactions_v2 ?? (localStorage.getItem("flag_dm_reactions_v2") === "true"),
          ai_translation: settings.flag_ai_translation ?? (localStorage.getItem("flag_ai_translation") === "true"),
          webrtc_calling_v2: settings.flag_webrtc_calling_v2 ?? (localStorage.getItem("flag_webrtc_calling_v2") === "true"),
          beta_rollout_10: settings.flag_beta_rollout_10 ?? (localStorage.getItem("flag_beta_rollout_10") === "true"),
          beta_reels_engine: settings.flag_beta_reels_engine ?? (localStorage.getItem("flag_beta_reels_engine") === "true"),
          smart_preload: settings.flag_smart_preload ?? (localStorage.getItem("flag_smart_preload") === "true"),
          ai_feed_ranker: settings.flag_ai_feed_ranker ?? (localStorage.getItem("flag_ai_feed_ranker") === "true"),
          new_profile_layout: settings.flag_new_profile_layout ?? (localStorage.getItem("flag_new_profile_layout") === "true"),
        });

      } catch (err) {
        console.error("Failed to load settings:", err);
      }
    };

    loadSettings();
  }, [setUser]);

  // Load blocked list when entering privacy category
  useEffect(() => {
    if (activeCategory === "privacy") {
      const loadBlocked = async () => {
        setLoadingBlocked(true);
        try {
          const { data } = await socialApi.listBlocked();
          setBlockedUsers(data.blocked_users || []);
        } catch (err) {
          console.error("Failed to load blocked list:", err);
        } finally {
          setLoadingBlocked(false);
        }
      };
      loadBlocked();
    }
  }, [activeCategory]);

  // Load sessions when entering account category
  useEffect(() => {
    if (activeCategory === "account") {
      const loadSessions = async () => {
        setSessionsLoading(true);
        try {
          const { data } = await authApi.getSessions();
          setSessions(data || []);
        } catch (err) {
          console.error("Failed to load device sessions:", err);
        } finally {
          setSessionsLoading(false);
        }
      };
      loadSessions();
    }
  }, [activeCategory]);

  const handleRevokeSession = async (sessionId) => {
    try {
      setError("");
      setSuccessMessage("");
      const { data } = await authApi.deleteSession(sessionId);
      if (data.is_self) {
        logout();
        navigate("/login");
        return;
      }
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      setSuccessMessage("Session revoked successfully.");
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleLogoutOthers = async () => {
    try {
      setError("");
      setSuccessMessage("");
      await authApi.logoutOthers();
      // Keep only current session
      setSessions((prev) => prev.filter((s) => s.is_current));
      setSuccessMessage("Logged out from all other devices successfully.");
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleLinkIdentifier = async (type, value) => {
    if (!value) return;
    if (type === "email") setIsLinkingEmail(true);
    if (type === "phone") setIsLinkingPhone(true);
    setError("");
    setSuccessMessage("");
    try {
      const { data } = await authApi.linkIdentifier({ type, value });
      setUser(data.user);
      setSuccessMessage(`Successfully linked ${type}.`);
      if (type === "email") setLinkEmailInput("");
      if (type === "phone") setLinkPhoneInput("");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLinkingEmail(false);
      setIsLinkingPhone(false);
    }
  };

  const handleUnlinkIdentifier = async (type) => {
    setError("");
    setSuccessMessage("");
    try {
      const { data } = await authApi.unlinkIdentifier({ type });
      setUser(data.user);
      setSuccessMessage(`Successfully unlinked ${type}.`);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const updateSetting = async (key, value) => {
    setSettingsForm((current) => ({ ...current, [key]: value }));
    
    if (key === "theme_preference") {
      setThemePreference(value);
      if (value === "custom") {
        setThemePreference("custom");
      } else if (value === "amoled") {
        setThemePreference("dark");
        localStorage.setItem("amoled_mode", "true");
        document.documentElement.style.setProperty("--bg", "#000000");
        document.documentElement.style.setProperty("--bg-card", "#09090b");
      } else {
        localStorage.setItem("amoled_mode", "false");
        document.documentElement.style.removeProperty("--bg");
        document.documentElement.style.removeProperty("--bg-card");
      }
    }
    if (key === "amoled_mode") {
      localStorage.setItem("amoled_mode", value ? "true" : "false");
      if (value && (document.documentElement.dataset.theme === "dark" || themePreference === "dark")) {
        document.documentElement.style.setProperty("--bg", "#000000");
        document.documentElement.style.setProperty("--bg-card", "#09090b");
      } else {
        document.documentElement.style.removeProperty("--bg");
        document.documentElement.style.removeProperty("--bg-card");
      }
    }
    if (key === "ui_density") {
      localStorage.setItem("ui_density", value);
      applyUiDensity(value);
    }

    try {
      await userApi.updateSettings({ [key]: value });
    } catch (e) {
      console.error(`Failed to sync settings form parameter ${key} to backend:`, e);
    }
  };

  const applyUiDensity = (density) => {
    const root = document.documentElement;
    if (density === "compact") {
      root.style.setProperty("--density-padding", "8px");
      root.style.setProperty("--density-font-scale", "0.9");
    } else if (density === "cozy") {
      root.style.setProperty("--density-padding", "20px");
      root.style.setProperty("--density-font-scale", "1.1");
    } else {
      root.style.removeProperty("--density-padding");
      root.style.removeProperty("--density-font-scale");
    }
  };

  // Sync settings helper
  const handleSaveSettings = async (customSettings = settingsForm) => {
    setSavingSettings(true);
    setError("");
    setSuccessMessage("");

    try {
      const { data } = await userApi.updateSettings(customSettings);
      setUser(data.user);
      setSuccessMessage("Settings updated successfully!");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSavingSettings(false);
    }
  };

  // Handle Unblocking
  const handleUnblock = async (targetUserId) => {
    try {
      await socialApi.toggleBlock(targetUserId);
      setBlockedUsers((prev) => prev.filter((u) => u.id !== targetUserId));
      setSuccessMessage("User unblocked successfully!");
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  // Handle Hidden Words additions
  const handleAddHiddenWord = async (e) => {
    e.preventDefault();
    if (!hiddenWordInput.trim()) return;
    const newWord = hiddenWordInput.trim().toLowerCase();
    if (!hiddenWords.includes(newWord)) {
      const updated = [...hiddenWords, newWord];
      setHiddenWords(updated);
      localStorage.setItem("hidden_words", JSON.stringify(updated));
      await handleSavePreference("hidden_words", updated);
    }
    setHiddenWordInput("");
  };

  const handleRemoveHiddenWord = async (word) => {
    const updated = hiddenWords.filter((w) => w !== word);
    setHiddenWords(updated);
    localStorage.setItem("hidden_words", JSON.stringify(updated));
    await handleSavePreference("hidden_words", updated);
  };

  // Chat Controls handlers
  const handleSelectChatTheme = async (themeId) => {
    setChatTheme(themeId);
    localStorage.setItem("default_chat_theme", themeId);
    await handleSavePreference("default_chat_theme", themeId);
    setSuccessMessage(`Default conversation theme set to ${themeId}!`);
  };

  const handleSelectTimer = async (seconds) => {
    setDisappearingTimer(seconds);
    localStorage.setItem("default_disappearing_timer", seconds.toString());
    await handleSavePreference("default_disappearing_timer", seconds);
    setSuccessMessage(`Disappearing messages default timer updated!`);
  };

  // Feature Flag handlers
  const handleToggleFlag = async (flagName) => {
    const newValue = !featureFlags[flagName];
    setFeatureFlags((prev) => ({ ...prev, [flagName]: newValue }));
    localStorage.setItem(`flag_${flagName}`, newValue ? "true" : "false");
    await handleSavePreference(`flag_${flagName}`, newValue);
    setSuccessMessage(`Feature flag '${flagName}' toggled successfully!`);
  };

  // Accent Color Handler
  const handleSelectAccent = async (colorId) => {
    setAccentColor(colorId);
    localStorage.setItem("accent_color", colorId);
    await handleSavePreference("accent_color", colorId);
    setSuccessMessage(`System accent color set to ${colorId}!`);
  };

  // Sound Selector Handler
  const handleSelectSound = async (soundId) => {
    setNotifSound(soundId);
    localStorage.setItem("notif_sound", soundId);
    await handleSavePreference("notif_sound", soundId);
    setSuccessMessage(`Alert sound updated to ${soundId}!`);
  };

  // Submit Support Handler
  const handleSupportSubmit = (e) => {
    e.preventDefault();
    if (!supportMessage.trim()) return;
    setSubmittingSupport(true);
    setTimeout(() => {
      setSuccessMessage("Support request registered! Ticket #N" + Math.floor(Math.random() * 90000 + 10000));
      setSupportMessage("");
      setSubmittingSupport(false);
    }, 1000);
  };

  return (
    <div className="min-h-screen w-full bg-[color:var(--bg)] pb-[var(--bottomnav-h)] lg:pb-0 scroll-smooth">
      <main className="mx-auto max-w-[1200px] px-4 py-6 lg:py-10">
        <div className="flex flex-col lg:flex-row gap-8 relative min-h-[calc(100vh-8rem)]">
          
          {/* Settings Navigation Sidebar */}
          <aside className={`w-full lg:w-[340px] lg:sticky lg:top-24 h-fit ${activeCategory ? "hidden lg:block" : "block"}`}>
            <div className="panel p-3">
              <div className="px-4 py-6 border-b border-[color:var(--border)] mb-4">
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
                      onClick={() => navigate(`/settings/${cat.id}`)}
                      className={`w-full flex items-center justify-between p-3.5 rounded-2xl transition-all text-left ${
                        isActive 
                          ? "bg-[color:var(--accent-soft)] text-[color:var(--accent)]" 
                          : "hover:bg-[color:var(--surface)] text-[color:var(--text-secondary)]"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl bg-[color:var(--bg-elevated)] shadow-sm ${isActive ? cat.color : "text-[color:var(--text-muted)]"}`}>
                          <Icon size={18} />
                        </div>
                        <div className="min-w-0">
                          <span className="font-semibold text-sm block whitespace-nowrap">{cat.label}</span>
                          <span className="text-[10px] text-[color:var(--text-muted)] block truncate">{cat.desc}</span>
                        </div>
                      </div>
                      <ChevronRight size={16} className={isActive ? "opacity-100" : "opacity-40"} />
                    </button>
                  );
                })}
              </nav>

              <div className="mt-6 pt-6 border-t border-[color:var(--border)] p-2">
                <button 
                  onClick={logout}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all font-bold"
                >
                  <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-500 shadow-sm">
                    <LogOut size={18} />
                  </div>
                  <span className="text-sm">Logout</span>
                </button>
              </div>
            </div>
          </aside>

          {/* Settings Content Pane */}
          <div className={`flex-1 space-y-6 pb-24 ${!activeCategory ? "hidden lg:block" : "block"}`}>
            
            {/* Header & Back Button (Mobile Only) */}
            <div className="flex items-center gap-4 mb-4 lg:hidden">
              <button
                onClick={() => navigate("/settings")}
                className="p-3 rounded-2xl bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 border border-[color:var(--border)] transition-all active:scale-95 flex items-center justify-center shadow-sm"
              >
                <ArrowLeft size={18} />
              </button>
              <div>
                <h2 className="text-xl font-display text-ink capitalize">
                  {activeCategory ? categories.find(c => c.id === activeCategory)?.label : "Settings"}
                </h2>
              </div>
            </div>

            {/* Feedback messages */}
            {error && (
              <div className="flex items-center gap-3 rounded-2xl bg-red-50 dark:bg-red-500/10 px-5 py-4 text-sm text-red-500 border border-red-200/20">
                <AlertCircle size={18} className="flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {successMessage && (
              <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 px-5 py-4 text-sm text-emerald-600 border border-emerald-200/20">
                <Check size={18} className="flex-shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* Category View: Settings Home (Show welcome guide if no category active on desktop) */}
            {!activeCategory && (
              <div className="hidden lg:flex flex-col items-center justify-center text-center p-12 py-20 panel soft-ring h-full border border-dashed">
                <div className="w-16 h-16 rounded-full bg-[color:var(--accent-soft)] flex items-center justify-center text-[color:var(--accent)] mb-6 shadow-sm">
                  <Smartphone size={32} />
                </div>
                <h2 className="text-2xl font-display text-ink">Ecosystem Preferences</h2>
                <p className="mt-2 text-sm text-[color:var(--text-muted)] max-w-sm">
                  Select a category from the sidebar menu to view and modify your account details, privacy preferences, feature flags, and calling configurations.
                </p>
              </div>
            )}

            {/* 2. Category View: Account Center */}
            {activeCategory === "account" && (
              <div className="space-y-6">
                {/* Personal Profile Details */}
                <div className="space-y-3">
                  <h3 className="text-lg font-bold text-ink flex items-center gap-2">
                    <UserCheck size={18} className="text-rose-500" />
                    Personal Details
                  </h3>
                  <div className="panel soft-ring p-6 space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-[color:var(--border)]">
                        <p className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold">Display Name</p>
                        <p className="text-sm font-semibold text-ink mt-1">{user?.full_name || "Not specified"}</p>
                      </div>
                      <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-[color:var(--border)]">
                        <p className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold">Account Tier</p>
                        <p className="text-sm font-semibold text-rose-500 mt-1 capitalize flex items-center gap-1.5">
                          <Sparkles size={14} />
                          {user?.account_type || "Personal"}
                        </p>
                      </div>
                    </div>

                    <div className="border-t border-[color:var(--border)] pt-4 space-y-4">
                      <h4 className="text-sm font-bold text-ink">Linked Contact Methods</h4>
                      <div className="space-y-3">
                        {/* Email Row */}
                        <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-[color:var(--border)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold">Email Address</p>
                            <p className="text-sm font-semibold text-ink mt-1 truncate">{user?.email || "No email linked"}</p>
                          </div>
                          <div>
                            {user?.email ? (
                              <button
                                onClick={() => handleUnlinkIdentifier("email")}
                                className="px-3 py-1.5 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-500 text-xs font-bold transition-all hover:bg-red-100/50 active:scale-95"
                              >
                                Unlink Email
                              </button>
                            ) : (
                              <div className="flex gap-2">
                                <input
                                  type="email"
                                  placeholder="Enter email"
                                  value={linkEmailInput}
                                  onChange={(e) => setLinkEmailInput(e.target.value)}
                                  className="field !py-1 !px-3 text-xs"
                                />
                                <button
                                  onClick={() => handleLinkIdentifier("email", linkEmailInput)}
                                  disabled={isLinkingEmail}
                                  className="px-3 py-1.5 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-xs font-bold transition-all active:scale-95"
                                >
                                  {isLinkingEmail ? "Linking..." : "Link"}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Phone Row */}
                        <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-[color:var(--border)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold">Phone Number</p>
                            <p className="text-sm font-semibold text-ink mt-1 truncate">{user?.phone_number || "No phone number linked"}</p>
                          </div>
                          <div>
                            {user?.phone_number ? (
                              <button
                                onClick={() => handleUnlinkIdentifier("phone")}
                                className="px-3 py-1.5 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-500 text-xs font-bold transition-all hover:bg-red-100/50 active:scale-95"
                              >
                                Unlink Phone
                              </button>
                            ) : (
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  placeholder="e.g. +919999999999"
                                  value={linkPhoneInput}
                                  onChange={(e) => setLinkPhoneInput(e.target.value)}
                                  className="field !py-1 !px-3 text-xs"
                                />
                                <button
                                  onClick={() => handleLinkIdentifier("phone", linkPhoneInput)}
                                  disabled={isLinkingPhone}
                                  className="px-3 py-1.5 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-xs font-bold transition-all active:scale-95"
                                >
                                  {isLinkingPhone ? "Linking..." : "Link"}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Security Credentials */}
                <div className="space-y-3">
                  <h3 className="text-lg font-bold text-ink flex items-center gap-2">
                    <KeyRound size={18} className="text-rose-500" />
                    Credentials & Password
                  </h3>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (passwordForm.new_password !== passwordForm.confirm_password) {
                        setError("New passwords do not match.");
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
                    className="panel soft-ring p-6 space-y-4"
                  >
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
                    <button type="submit" disabled={changingPassword} className="px-6 py-3 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-sm font-bold active:scale-95 transition-all shadow-md">
                      {changingPassword ? "Updating..." : "Update Password"}
                    </button>
                  </form>
                </div>

                {/* Login Sessions */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-ink flex items-center gap-2">
                      <Smartphone size={18} className="text-rose-500" />
                      Active Device Sessions
                    </h3>
                    {sessions.filter(s => !s.is_current).length > 0 && (
                      <button
                        onClick={handleLogoutOthers}
                        className="text-xs font-bold text-red-500 hover:underline flex items-center gap-1 active:scale-95 transition-all"
                      >
                        Logout other devices
                      </button>
                    )}
                  </div>
                  <div className="panel soft-ring p-6 space-y-4">
                    {sessionsLoading ? (
                      <p className="text-sm text-[color:var(--text-muted)] animate-pulse">Loading active sessions...</p>
                    ) : sessions.length === 0 ? (
                      <p className="text-sm text-[color:var(--text-muted)]">No active sessions found.</p>
                    ) : (
                      sessions.map((session) => (
                        <div key={session.id} className={`flex items-center justify-between p-3.5 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-[color:var(--border)] ${!session.is_current ? "opacity-75" : ""}`}>
                          <div className="flex items-center gap-3">
                            <div className={`p-2.5 rounded-xl ${session.is_current ? "bg-emerald-500/10 text-emerald-500" : "bg-zinc-400/10 text-[color:var(--text-muted)]"}`}>
                              <Smartphone size={20} />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-ink">{session.device_name || "Unknown Device"}</p>
                              <p className="text-[10px] text-zinc-400">
                                {session.ip_address} · {session.location} · Active {session.is_current ? "now" : new Date(session.last_active).toLocaleString()}
                              </p>
                            </div>
                          </div>
                          {session.is_current ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600">Current</span>
                          ) : (
                            <button
                              onClick={() => handleRevokeSession(session.id)}
                              className="px-3 py-1.5 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-500 text-xs font-bold transition-all hover:bg-red-100 active:scale-95"
                            >
                              Revoke
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
>

                {/* Danger Zone */}
                <div className="space-y-3">
                  <h3 className="text-lg font-bold text-red-500 flex items-center gap-2">
                    <ShieldAlert size={18} />
                    Danger Zone
                  </h3>
                  <div className="panel soft-ring p-6 space-y-4 border-red-500/20 bg-red-500/[0.02]">
                    <p className="text-xs text-[color:var(--text-muted)] leading-relaxed">
                      Permanently deleting your account deletes your drops, beats, group settings, and all active device sessions. This action cannot be reversed.
                    </p>
                    
                    {showDeleteConfirm ? (
                      <div className="space-y-4 pt-2">
                        <input
                          type="password"
                          value={deletePassword}
                          onChange={(e) => setDeletePassword(e.target.value)}
                          className="field !bg-red-50/50 dark:!bg-red-950/20 border-red-200"
                          placeholder="Type current password to confirm deletion"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={async () => {
                              if (!deletePassword) return;
                              setDeletingAccount(true);
                              try {
                                await authApi.deleteAccount({ password: deletePassword });
                                logout();
                              } catch (err) {
                                setError(getErrorMessage(err));
                              } finally {
                                setDeletingAccount(false);
                              }
                            }}
                            className="px-6 py-2.5 rounded-xl bg-red-500 text-white font-bold text-sm hover:bg-red-600 transition-all active:scale-95"
                            disabled={deletingAccount}
                          >
                            {deletingAccount ? "Deleting..." : "Permanently Delete My Account"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShowDeleteConfirm(false);
                              setDeletePassword("");
                            }}
                            className="px-6 py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-bold text-sm transition-all"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(true)}
                        className="flex items-center gap-2 text-sm font-bold text-red-500 hover:underline"
                      >
                        <Trash2 size={16} />
                        Request Permanent Account Deletion
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 3. Category View: Privacy & Safety */}
            {activeCategory === "privacy" && (
              <div className="space-y-6">
                {/* Account Privacy Controls */}
                <div className="space-y-3">
                  <h3 className="text-lg font-bold text-ink flex items-center gap-2">
                    <ShieldCheck size={18} className="text-emerald-500" />
                    Ecosystem Privacy
                  </h3>
                  <div className="panel soft-ring p-6 space-y-4">
                    <ToggleRow
                      label="Private Account"
                      description="Only people you approve will be able to see your drops, beats, and highlights."
                      checked={settingsForm.is_private}
                      onChange={async () => {
                        const updated = !settingsForm.is_private;
                        updateSetting("is_private", updated);
                        await handleSaveSettings({ ...settingsForm, is_private: updated });
                      }}
                    />
                    <ToggleRow
                      label="Activity Status"
                      description="Allow people you follow to see when you are online or typing. This is mutual."
                      checked={settingsForm.show_activity_status}
                      onChange={async () => {
                        const updated = !settingsForm.show_activity_status;
                        updateSetting("show_activity_status", updated);
                        await handleSaveSettings({ ...settingsForm, show_activity_status: updated });
                      }}
                    />
                    
                    <div className="grid gap-4 sm:grid-cols-3 pt-4 border-t border-[color:var(--border)]">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Who can Comment</label>
                        <select
                          value={settingsForm.who_can_comment}
                          onChange={async (e) => {
                            const val = e.target.value;
                            updateSetting("who_can_comment", val);
                            await handleSaveSettings({ ...settingsForm, who_can_comment: val });
                          }}
                          className="field text-xs !py-2.5 cursor-pointer"
                        >
                          <option value="everyone">Everyone</option>
                          <option value="followers">Followers Only</option>
                          <option value="nobody">Nobody</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Tagging Controls</label>
                        <select
                          value={settingsForm.who_can_tag}
                          onChange={async (e) => {
                            const val = e.target.value;
                            updateSetting("who_can_tag", val);
                            await handleSaveSettings({ ...settingsForm, who_can_tag: val });
                          }}
                          className="field text-xs !py-2.5 cursor-pointer"
                        >
                          <option value="everyone">Everyone</option>
                          <option value="followers">Followers Only</option>
                          <option value="nobody">Nobody</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Stories Audience</label>
                        <select
                          value={settingsForm.story_privacy}
                          onChange={async (e) => {
                            const val = e.target.value;
                            updateSetting("story_privacy", val);
                            await handleSaveSettings({ ...settingsForm, story_privacy: val });
                          }}
                          className="field text-xs !py-2.5 cursor-pointer"
                        >
                          <option value="everyone">Everyone</option>
                          <option value="followers">Followers Only</option>
                          <option value="close_friends">Close Friends</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Blocked, Muted & Restricted Lists */}
                <div className="space-y-3">
                  <h3 className="text-lg font-bold text-ink flex items-center gap-2">
                    <EyeOff size={18} className="text-emerald-500" />
                    Mutes, Restrictions & Blocks
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    {/* Blocked Users (Real API Driven) */}
                    <div className="panel p-5 space-y-4">
                      <p className="font-bold text-sm text-ink flex items-center justify-between">
                        <span>Blocked Users ({blockedUsers.length})</span>
                        <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-[10px] text-[color:var(--text-muted)] font-bold">API Sync</span>
                      </p>
                      
                      {loadingBlocked ? (
                        <p className="text-xs text-[color:var(--text-muted)] text-center py-4">Loading blocked list...</p>
                      ) : blockedUsers.length === 0 ? (
                        <p className="text-xs text-[color:var(--text-muted)] text-center py-4">No blocked users</p>
                      ) : (
                        <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                          {blockedUsers.map((item) => (
                            <div key={item.id} className="flex items-center justify-between p-2 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 border border-[color:var(--border)]">
                              <div className="flex items-center gap-2 min-w-0">
                                <Avatar src={item.profile_pic} name={item.username} size="sm" />
                                <span className="text-xs font-semibold truncate text-ink">@{item.username}</span>
                              </div>
                              <button
                                onClick={() => handleUnblock(item.id)}
                                className="px-2.5 py-1 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 text-[10px] font-bold transition-all"
                              >
                                Unblock
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Interactive Muted & Restricted lists */}
                    <div className="panel p-5 space-y-4">
                      <p className="font-bold text-sm text-ink flex items-center justify-between">
                        <span>Muted & Restricted</span>
                        <span className="px-2 py-0.5 rounded-md bg-[color:var(--accent-soft)] text-[10px] text-[color:var(--accent)] font-bold">Labs</span>
                      </p>
                      <div className="space-y-2.5">
                        <div className="p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-[color:var(--border)] flex items-center justify-between">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-ink">Muted Accounts</p>
                            <p className="text-[10px] text-[color:var(--text-muted)]">Hide stories and drops from timeline</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-[10px] text-zinc-500 font-semibold rounded">{mutedUsersCount} accounts</span>
                            <button onClick={() => setMutedUsersCount(prev => prev + 1)} className="p-1 text-xs bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 rounded">+</button>
                          </div>
                        </div>
                        <div className="p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-[color:var(--border)] flex items-center justify-between">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-ink">Restricted Accounts</p>
                            <p className="text-[10px] text-[color:var(--text-muted)]">Hide comments and message requests</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-[10px] text-zinc-500 font-semibold rounded">{restrictedUsersCount} accounts</span>
                            <button onClick={() => setRestrictedUsersCount(prev => prev + 1)} className="p-1 text-xs bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 rounded">+</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Hidden Words Control */}
                <div className="space-y-3">
                  <h3 className="text-lg font-bold text-ink flex items-center gap-2">
                    <EyeOff size={18} className="text-emerald-500" />
                    Hidden Words & Content Filter
                  </h3>
                  <div className="panel soft-ring p-6 space-y-4">
                    <p className="text-xs text-[color:var(--text-muted)] leading-relaxed">
                      Drops, comments, and direct messages containing any of these keywords will be filtered or hidden automatically.
                    </p>
                    
                    <form onSubmit={handleAddHiddenWord} className="flex gap-2">
                      <input
                        type="text"
                        value={hiddenWordInput}
                        onChange={(e) => setHiddenWordInput(e.target.value)}
                        className="field !bg-zinc-50 dark:!bg-zinc-900/50 flex-1"
                        placeholder="Add keyword (e.g. spam, crypto, bots)"
                      />
                      <button type="submit" className="px-5 py-3 rounded-2xl bg-[color:var(--accent)] text-white font-bold text-sm shadow-sm flex items-center justify-center">
                        <Plus size={18} />
                      </button>
                    </form>

                    <div className="flex flex-wrap gap-2 pt-2">
                      {hiddenWords.map((word) => (
                        <span key={word} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-[color:var(--border)] text-xs text-[color:var(--text-secondary)] font-bold">
                          <span>{word}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveHiddenWord(word)}
                            className="p-0.5 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400"
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 4. Category View: Chat Controls */}
            {activeCategory === "chat-controls" && (
              <div className="space-y-6">
                {/* Default Chat Theme */}
                <div className="space-y-3">
                  <h3 className="text-lg font-bold text-ink flex items-center gap-2">
                    <LayoutList size={18} className="text-blue-500" />
                    Default Chat Theme
                  </h3>
                  <div className="panel soft-ring p-6">
                    <p className="text-xs text-[color:var(--text-muted)] mb-4 leading-relaxed">
                      Set a preferred default theme for all newly created 1:1 and group conversation bubbles.
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { id: "default", label: "Classic Indigo", color: "bg-indigo-500" },
                        { id: "matcha", label: "Matcha Green", color: "bg-emerald-500" },
                        { id: "lavender", label: "Lavender Purple", color: "bg-purple-500" },
                        { id: "cyber", label: "Cyber Neon", color: "bg-pink-500" },
                        { id: "sunset", label: "Sunset Orange", color: "bg-orange-500" },
                        { id: "ocean", label: "Deep Ocean", color: "bg-blue-600" },
                        { id: "bubblegum", label: "Bubblegum Pink", color: "bg-rose-400" },
                      ].map((theme) => {
                        const active = chatTheme === theme.id;
                        return (
                          <button
                            key={theme.id}
                            onClick={() => handleSelectChatTheme(theme.id)}
                            className={`p-3.5 rounded-2xl flex flex-col items-center justify-center border text-center transition-all ${
                              active 
                                ? "border-[color:var(--accent)] ring-2 ring-[color:var(--accent-soft)]" 
                                : "border-[color:var(--border)] hover:border-zinc-300 dark:hover:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50"
                            }`}
                          >
                            <div className={`w-8 h-8 rounded-full ${theme.color} shadow-md mb-2 relative flex items-center justify-center`}>
                              {active && <CheckCircle2 size={16} className="text-white fill-emerald-500" />}
                            </div>
                            <span className="text-[10px] font-bold text-ink">{theme.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Default Disappearing Message Timer */}
                <div className="space-y-3">
                  <h3 className="text-lg font-bold text-ink flex items-center gap-2">
                    <LayoutList size={18} className="text-blue-500" />
                    Default Vanish Mode Timer
                  </h3>
                  <div className="panel soft-ring p-6">
                    <p className="text-xs text-[color:var(--text-muted)] mb-4 leading-relaxed">
                      Control how long messages persist inside all direct chats. Set to Off by default.
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      {[
                        { seconds: 0, label: "Off" },
                        { seconds: 60, label: "1 Minute" },
                        { seconds: 300, label: "5 Minutes" },
                        { seconds: 3600, label: "1 Hour" },
                        { seconds: 86400, label: "24 Hours" },
                      ].map((opt) => {
                        const active = disappearingTimer === opt.seconds;
                        return (
                          <button
                            key={opt.seconds}
                            onClick={() => handleSelectTimer(opt.seconds)}
                            className={`p-3 rounded-xl border text-center text-xs font-bold transition-all ${
                              active 
                                ? "border-[color:var(--accent)] bg-[color:var(--accent)] text-white shadow-md shadow-[rgba(142,13,115,0.15)]" 
                                : "border-[color:var(--border)] bg-zinc-50 dark:bg-zinc-900/50 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 text-[color:var(--text-secondary)]"
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Chat indicators & Mutual receipts */}
                <div className="space-y-3">
                  <h3 className="text-lg font-bold text-ink flex items-center gap-2">
                    <LayoutList size={18} className="text-blue-500" />
                    Chat Behavior & Receipts
                  </h3>
                  <div className="panel soft-ring p-6 space-y-4">
                    <ToggleRow
                      label="Read Receipts"
                      description="Allow other participants to see when you've read a message. This setting is mutual."
                      checked={settingsForm.read_receipts_enabled}
                      onChange={async () => {
                        const updated = !settingsForm.read_receipts_enabled;
                        updateSetting("read_receipts_enabled", updated);
                        await handleSaveSettings({ ...settingsForm, read_receipts_enabled: updated });
                      }}
                    />
                    <ToggleRow
                      label="Typing Indicators"
                      description="Show real-time indicators when you are typing inside any DM. This setting is mutual."
                      checked={settingsForm.typing_indicators_enabled}
                      onChange={async () => {
                        const updated = !settingsForm.typing_indicators_enabled;
                        updateSetting("typing_indicators_enabled", updated);
                        await handleSaveSettings({ ...settingsForm, typing_indicators_enabled: updated });
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 5. Category View: Notifications */}
            {activeCategory === "notifications" && (
              <div className="space-y-6">
                <div className="space-y-3">
                  <h3 className="text-lg font-bold text-ink flex items-center gap-2">
                    <BellRing size={18} className="text-orange-500" />
                    Ecosystem Alerts & Notifications
                  </h3>
                  <div className="panel soft-ring p-6 space-y-4">
                    <ToggleRow
                      label="Global Push Notifications"
                      description="Enable high-performance realtime device banners for story reactions, likes, and messages."
                      checked={settingsForm.push_notifications}
                      onChange={async () => {
                        const updated = !settingsForm.push_notifications;
                        updateSetting("push_notifications", updated);
                        await handleSaveSettings({ ...settingsForm, push_notifications: updated });
                      }}
                    />
                    <ToggleRow
                      label="Email Notifications"
                      description="Receive account summaries, deactivation updates, and de-duplicated weekly digests."
                      checked={settingsForm.email_notifications}
                      onChange={async () => {
                        const updated = !settingsForm.email_notifications;
                        updateSetting("email_notifications", updated);
                        await handleSaveSettings({ ...settingsForm, email_notifications: updated });
                      }}
                    />
                  </div>
                </div>

                {/* Sub-action Notification Controls */}
                <div className="space-y-3">
                  <h3 className="text-lg font-bold text-ink flex items-center gap-2">
                    <BellRing size={18} className="text-orange-500" />
                    In-App Activity Filters
                  </h3>
                  <div className="panel soft-ring p-6 space-y-3">
                    {Object.entries(notifPreferences).map(([k, v]) => (
                      <ToggleRow
                        key={k}
                        label={`${k.charAt(0).toUpperCase() + k.slice(1)} Alerts`}
                        description={`Receive real-time push banners and internal bubble signals when someone leaves ${k}.`}
                        checked={v}
                        onChange={async () => {
                          const updated = !v;
                          setNotifPreferences(prev => ({ ...prev, [k]: updated }));
                          localStorage.setItem(`notif_${k}`, updated ? "true" : "false");
                          await handleSavePreference(`notif_${k}`, updated);
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* Sound & Haptics */}
                <div className="space-y-3">
                  <h3 className="text-lg font-bold text-ink flex items-center gap-2">
                    <Volume2 size={18} className="text-orange-500" />
                    Alert Sound & Vibration
                  </h3>
                  <div className="panel soft-ring p-6 space-y-4">
                    <ToggleRow
                      label="Device Vibration"
                      description="Triggers short structural haptic response on mobile viewports for new messages and direct rings."
                      checked={vibrationEnabled}
                      onChange={async () => {
                        const updated = !vibrationEnabled;
                        setVibrationEnabled(updated);
                        localStorage.setItem("notif_vibration", updated ? "true" : "false");
                        await handleSavePreference("notif_vibration", updated);
                      }}
                    />

                    <div className="space-y-2 pt-2 border-t border-[color:var(--border)]">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">Notification Sound Theme</label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                        {["cyber_ping", "neon_pulse", "matcha_drop", "classic_bell"].map((sound) => {
                          const active = notifSound === sound;
                          return (
                            <button
                              key={sound}
                              onClick={() => handleSelectSound(sound)}
                              className={`py-2 px-3 rounded-xl border text-xs font-semibold capitalize transition-all ${
                                active
                                  ? "bg-orange-500 border-orange-500 text-white shadow-sm"
                                  : "border-[color:var(--border)] bg-zinc-50 dark:bg-zinc-900/50 hover:bg-zinc-100 text-[color:var(--text-secondary)]"
                              }`}
                            >
                              {sound.replace("_", " ")}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 6. Category View: Appearance */}
            {activeCategory === "appearance" && (
              <div className="space-y-6">
                {/* Theme Selector */}
                <div className="space-y-3">
                  <h3 className="text-lg font-bold text-ink flex items-center gap-2">
                    <MoonStar size={18} className="text-purple-500" />
                    Ecosystem Theme Mode
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                      { value: "light", label: "Light Mode", icon: CheckCircle2, desc: "Classic clean layout" },
                      { value: "dark", label: "Dark Mode", icon: MoonStar, desc: "Sleek low-light contrast" },
                      { value: "system", label: "System Sync", icon: CheckCircle2, desc: "Matches operating system" },
                      { value: "custom", label: "Custom Theme", icon: Sparkles, desc: "Design your own RGB palette" },
                    ].map((option) => {
                      const active = themePreference === option.value;
                      return (
                        <button
                          key={option.value}
                          onClick={async () => {
                            updateSetting("theme_preference", option.value);
                            await handleSaveSettings({ ...settingsForm, theme_preference: option.value });
                          }}
                          className={`panel p-5 text-left transition-all relative overflow-hidden group ${
                            active 
                              ? "border-[color:var(--accent)] ring-2 ring-[color:var(--accent-soft)]" 
                              : "hover:border-zinc-300 dark:hover:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50"
                          }`}
                        >
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${active ? "bg-[color:var(--accent)] text-white" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"}`}>
                            <option.icon size={20} />
                          </div>
                          <p className="font-bold text-ink text-sm">{option.label}</p>
                          <p className="text-xs text-[color:var(--text-muted)] mt-1 leading-relaxed">{option.desc}</p>
                          {active && <div className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-[color:var(--accent)]" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Custom Theme Builder Studio */}
                {themePreference === "custom" && (
                  <div className="space-y-3">
                    <h3 className="text-lg font-bold text-ink flex items-center gap-2">
                      <Sparkles size={18} className="text-purple-500" />
                      Custom RGB Theme Studio (Live Preview)
                    </h3>
                    <div className="panel soft-ring p-6 space-y-4">
                      <p className="text-xs text-[color:var(--text-muted)] leading-relaxed">
                        Fine-tune your layout's core colors with instant real-time live preview mapping to CSS variables.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {[
                          { label: "Background Base", key: "bg", desc: "Main viewport backdrop" },
                          { label: "Elevated Surfaces (Cards)", key: "bg_card", desc: "Panels, cards & headers" },
                          { label: "Popups & Hover Tabs", key: "bg_elevated", desc: "Dropdowns & search panels" },
                          { label: "Borders & structural lines", key: "border", desc: "Separators & borders" },
                          { label: "Primary Typography", key: "text", desc: "Main header & body text" },
                        ].map((colorOpt) => (
                          <div key={colorOpt.key} className="flex items-center justify-between p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border border-[color:var(--border)] gap-4">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-ink truncate">{colorOpt.label}</p>
                              <p className="text-[10px] text-[color:var(--text-muted)] truncate">{colorOpt.desc}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <input
                                type="text"
                                value={customThemeColors[colorOpt.key]}
                                onChange={(e) => updateCustomThemeColors({ [colorOpt.key]: e.target.value })}
                                className="field !py-1 px-2 text-[10px] w-20 text-center font-mono !bg-white dark:!bg-zinc-900"
                              />
                              <input
                                type="color"
                                value={customThemeColors[colorOpt.key].startsWith("#") ? customThemeColors[colorOpt.key] : "#00ffcc"}
                                onChange={(e) => updateCustomThemeColors({ [colorOpt.key]: e.target.value })}
                                className="w-8 h-8 rounded-lg cursor-pointer border border-[color:var(--border)] overflow-hidden bg-transparent shrink-0"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* AMOLED Pure Black (only makes sense if not in custom RGB theme) */}
                {themePreference !== "custom" && (
                  <div className="space-y-3">
                    <h3 className="text-lg font-bold text-ink flex items-center gap-2">
                      <MoonStar size={18} className="text-purple-500" />
                      OLED Premium Screen Optimization
                    </h3>
                    <div className="panel soft-ring p-6">
                      <ToggleRow
                        label="AMOLED Black Mode"
                        description="Overrides Dark Mode base colors to absolute pure black (#000000) to optimize device batteries."
                        checked={settingsForm.amoled_mode}
                        onChange={() => updateSetting("amoled_mode", !settingsForm.amoled_mode)}
                      />
                    </div>
                  </div>
                )}

                {/* System Accent Color */}
                <div className="space-y-3">
                  <h3 className="text-lg font-bold text-ink flex items-center gap-2">
                    <Sparkles size={18} className="text-purple-500" />
                    Ecosystem Accent Aura
                  </h3>
                  <div className="panel soft-ring p-6">
                    <p className="text-xs text-[color:var(--text-muted)] mb-4">
                      Select a preferred brand color to tint active links, floating tabs, primary buttons, and borders.
                    </p>
                    <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
                      {[
                        { id: "purple", label: "Aura Purple", color: "bg-purple-600" },
                        { id: "indigo", label: "Indigo Sky", color: "bg-indigo-600" },
                        { id: "rose", label: "Rose Petal", color: "bg-rose-500" },
                        { id: "emerald", label: "Matcha", color: "bg-emerald-500" },
                        { id: "amber", label: "Amber Glow", color: "bg-amber-500" },
                        { id: "cyan", label: "Cyber Cyan", color: "bg-cyan-500" },
                        { id: "custom", label: "Custom Aura", color: "bg-gradient-to-r from-red-500 via-green-500 to-blue-500" },
                      ].map((color) => {
                        const active = accentColor === color.id;
                        return (
                          <button
                            key={color.id}
                            onClick={() => handleSelectAccent(color.id)}
                            className={`p-2.5 rounded-xl border text-[10px] font-bold text-center transition-all ${
                              active
                                ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)]"
                                : "border-[color:var(--border)] bg-zinc-50 dark:bg-zinc-900/50 hover:bg-zinc-100"
                            }`}
                          >
                            <div className={`w-6 h-6 rounded-full mx-auto mb-1.5 ${color.color} shadow-sm`} />
                            <span className="text-ink truncate block">{color.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* If Custom Accent is selected, show RGB input & color picker */}
                    {accentColor === "custom" && (
                      <div className="mt-4 pt-4 border-t border-[color:var(--border)] grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border border-[color:var(--border)] gap-4">
                          <div>
                            <p className="text-sm font-semibold text-ink">Custom Accent Base</p>
                            <p className="text-[10px] text-[color:var(--text-muted)]">Core link & action tint</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={customThemeColors.accent}
                              onChange={(e) => updateCustomThemeColors({ accent: e.target.value })}
                              className="field !py-1 px-2 text-[10px] w-20 text-center font-mono !bg-white dark:!bg-zinc-900"
                            />
                            <input
                              type="color"
                              value={customThemeColors.accent.startsWith("#") ? customThemeColors.accent : "#00ffcc"}
                              onChange={(e) => updateCustomThemeColors({ accent: e.target.value })}
                              className="w-8 h-8 rounded-lg cursor-pointer border border-[color:var(--border)] overflow-hidden bg-transparent"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border border-[color:var(--border)] gap-4">
                          <div>
                            <p className="text-sm font-semibold text-ink">Custom Gradient End</p>
                            <p className="text-[10px] text-[color:var(--text-muted)]">End color for text/button glow</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={customThemeColors.accent_end}
                              onChange={(e) => updateCustomThemeColors({ accent_end: e.target.value })}
                              className="field !py-1 px-2 text-[10px] w-20 text-center font-mono !bg-white dark:!bg-zinc-900"
                            />
                            <input
                              type="color"
                              value={customThemeColors.accent_end.startsWith("#") ? customThemeColors.accent_end : "#00b3ff"}
                              onChange={(e) => updateCustomThemeColors({ accent_end: e.target.value })}
                              className="w-8 h-8 rounded-lg cursor-pointer border border-[color:var(--border)] overflow-hidden bg-transparent"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Spacing Density & Font Scale */}
                <div className="space-y-3">
                  <h3 className="text-lg font-bold text-ink flex items-center gap-2">
                    <LayoutList size={18} className="text-purple-500" />
                    Display Sizing & Density
                  </h3>
                  <div className="panel soft-ring p-6 space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">UI Padding Density</label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: "compact", label: "Compact Mode" },
                          { id: "default", label: "System Default" },
                          { id: "cozy", label: "Cozy Spacing" },
                        ].map((density) => {
                          const active = settingsForm.ui_density === density.id;
                          return (
                            <button
                              key={density.id}
                              onClick={() => updateSetting("ui_density", density.id)}
                              className={`py-2 rounded-xl text-xs font-bold transition-all ${
                                active 
                                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm" 
                                  : "bg-zinc-50 dark:bg-zinc-900/50 text-zinc-400 hover:text-zinc-500"
                              }`}
                            >
                              {density.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t border-[color:var(--border)]">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Typography Scale</label>
                        <select
                          value={fontSize}
                          onChange={async (e) => {
                            const val = e.target.value;
                            setFontSize(val);
                            localStorage.setItem("font_size", val);
                            await handleSavePreference("font_size", val);
                            setSuccessMessage("Font scaling updated!");
                          }}
                          className="field text-xs cursor-pointer !py-2.5"
                        >
                          <option value="small">Small Text (90%)</option>
                          <option value="standard">Standard Text (100%)</option>
                          <option value="large">Large Text (110%)</option>
                          <option value="xlarge">Extra Large (120%)</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Animation Physics</label>
                        <select
                          value={animationIntensity}
                          onChange={async (e) => {
                            const val = e.target.value;
                            setAnimationIntensity(val);
                            localStorage.setItem("animation_intensity", val);
                            await handleSavePreference("animation_intensity", val);
                            setSuccessMessage("Animation dynamics synced!");
                          }}
                          className="field text-xs cursor-pointer !py-2.5"
                        >
                          <option value="none">No Motion (Reduce Jitter)</option>
                          <option value="stable">Stiff Springs (Snappy)</option>
                          <option value="fluid">Fluid Springs (Smooth)</option>
                          <option value="playful">Extended Springs (Bouncy)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 7. Category View: Content Preferences */}
            {activeCategory === "content" && (
              <div className="space-y-6">
                <div className="space-y-3">
                  <h3 className="text-lg font-bold text-ink flex items-center gap-2">
                    <MonitorPlay size={18} className="text-amber-500" />
                    Media Delivery & Data Saver
                  </h3>
                  <div className="panel soft-ring p-6 space-y-4">
                    <ToggleRow
                      label="Autoplay Reels & Videos"
                      description="Drops and beat feeds will play immediately when they enter your screen viewport bounds."
                      checked={contentPrefs.autoplay_videos}
                      onChange={async () => {
                        const updated = !contentPrefs.autoplay_videos;
                        setContentPrefs(prev => ({ ...prev, autoplay_videos: updated }));
                        localStorage.setItem("content_autoplay", updated ? "true" : "false");
                        await handleSavePreference("content_autoplay", updated);
                      }}
                    />

                    <ToggleRow
                      label="Data Saver Mode"
                      description="Automatically reduces media quality down to standard resolution to save cellular data bandwidth."
                      checked={contentPrefs.data_saver}
                      onChange={async () => {
                        const updated = !contentPrefs.data_saver;
                        setContentPrefs(prev => ({ ...prev, data_saver: updated }));
                        localStorage.setItem("content_datasaver", updated ? "true" : "false");
                        await handleSavePreference("content_datasaver", updated);
                      }}
                    />

                    <ToggleRow
                      label="Ultra HD High Quality Uploads"
                      description="Forces app to upload stories and drops at maximum 1080p density rather than compressing."
                      checked={contentPrefs.high_quality_media}
                      onChange={async () => {
                        const updated = !contentPrefs.high_quality_media;
                        setContentPrefs(prev => ({ ...prev, high_quality_media: updated }));
                        localStorage.setItem("content_hqmedia", updated ? "true" : "false");
                        await handleSavePreference("content_hqmedia", updated);
                      }}
                    />
                  </div>
                </div>

                {/* AI & Recommendations */}
                <div className="space-y-3">
                  <h3 className="text-lg font-bold text-ink flex items-center gap-2">
                    <Eye size={18} className="text-amber-500" />
                    Recommendation Filters & NSFW Controls
                  </h3>
                  <div className="panel soft-ring p-6 space-y-4">
                    <ToggleRow
                      label="Smart AI Feeds"
                      description="Allow the recommendation engine to prioritize content based on your recent messaging, views, and likes."
                      checked={contentPrefs.ai_recommendations}
                      onChange={async () => {
                        const updated = !contentPrefs.ai_recommendations;
                        setContentPrefs(prev => ({ ...prev, ai_recommendations: updated }));
                        localStorage.setItem("content_airecom", updated ? "true" : "false");
                        await handleSavePreference("content_airecom", updated);
                      }}
                    />

                    <ToggleRow
                      label="NSFW / Sensitive Media Filter"
                      description="Automatically blur drops and beats containing mature elements or high sensitivity warnings."
                      checked={contentPrefs.nsfw_filter}
                      onChange={async () => {
                        const updated = !contentPrefs.nsfw_filter;
                        setContentPrefs(prev => ({ ...prev, nsfw_filter: updated }));
                        localStorage.setItem("content_nsfw", updated ? "true" : "false");
                        await handleSavePreference("content_nsfw", updated);
                      }}
                    />

                    <div className="grid gap-4 sm:grid-cols-2 pt-4 border-t border-[color:var(--border)]">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Content Sensitivity Level</label>
                        <select
                          value={contentPrefs.content_sensitivity}
                          onChange={async (e) => {
                            const val = e.target.value;
                            setContentPrefs(prev => ({ ...prev, content_sensitivity: val }));
                            localStorage.setItem("content_sensitivity", val);
                            await handleSavePreference("content_sensitivity", val);
                            setSuccessMessage("Sensitivity criteria updated!");
                          }}
                          className="field text-xs cursor-pointer !py-2.5"
                        >
                          <option value="low">Low (Filter almost all)</option>
                          <option value="standard">Standard (Balanced filter)</option>
                          <option value="high">High (Show full media spectrum)</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Recommendation Tuning</label>
                        <select
                          value={contentPrefs.recommendation_tuning}
                          onChange={async (e) => {
                            const val = e.target.value;
                            setContentPrefs(prev => ({ ...prev, recommendation_tuning: val }));
                            localStorage.setItem("recommendation_tuning", val);
                            await handleSavePreference("recommendation_tuning", val);
                            setSuccessMessage("AI Feed parameters updated!");
                          }}
                          className="field text-xs cursor-pointer !py-2.5"
                        >
                          <option value="discovery">Broad Discovery (New accounts)</option>
                          <option value="balanced">Balanced Matrix</option>
                          <option value="focused">Highly Focused (Friends only)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 8. Category View: Device & App */}
            {activeCategory === "device" && (
              <div className="space-y-6">
                <div className="space-y-3">
                  <h3 className="text-lg font-bold text-ink flex items-center gap-2">
                    <Smartphone size={18} className="text-indigo-500" />
                    Device Capability & Permissions
                  </h3>
                  <div className="panel soft-ring p-6 space-y-4">
                    <ToggleRow
                      label="Camera Hardware Access"
                      description="Required to snap new photos, upload drops, and publish live video streams."
                      checked={devicePermissions.camera}
                      onChange={async () => {
                        const updated = !devicePermissions.camera;
                        setDevicePermissions(prev => ({ ...prev, camera: updated }));
                        await handleSavePreference("device_permission_camera", updated);
                      }}
                    />

                    <ToggleRow
                      label="Microphone Hardware Access"
                      description="Required to record stories, transmit real-time RTC voices, and send chat voice notes."
                      checked={devicePermissions.mic}
                      onChange={async () => {
                        const updated = !devicePermissions.mic;
                        setDevicePermissions(prev => ({ ...prev, mic: updated }));
                        await handleSavePreference("device_permission_mic", updated);
                      }}
                    />

                    <ToggleRow
                      label="File Storage Access"
                      description="Allows you to choose files from device library to upload and download drops."
                      checked={devicePermissions.storage}
                      onChange={async () => {
                        const updated = !devicePermissions.storage;
                        setDevicePermissions(prev => ({ ...prev, storage: updated }));
                        await handleSavePreference("device_permission_storage", updated);
                      }}
                    />

                    <ToggleRow
                      label="Precise Geolocation Access"
                      description="Optionally tag posts with physical cities. We never track you in the background."
                      checked={devicePermissions.location}
                      onChange={async () => {
                        const updated = !devicePermissions.location;
                        setDevicePermissions(prev => ({ ...prev, location: updated }));
                        await handleSavePreference("device_permission_location", updated);
                      }}
                    />
                  </div>
                </div>

                {/* Language and accessibility */}
                <div className="space-y-3">
                  <h3 className="text-lg font-bold text-ink flex items-center gap-2">
                    <Languages size={18} className="text-indigo-500" />
                    App Configurations & Accessibility
                  </h3>
                  <div className="panel soft-ring p-6 space-y-4">
                    <ToggleRow
                      label="Auto-save to Media Gallery"
                      description="Instantly downloads any stories and photos captured with the Neurality camera to your local camera roll."
                      checked={archivedMode}
                      onChange={async () => {
                        const updated = !archivedMode;
                        setArchivedMode(updated);
                        localStorage.setItem("app_archive_save", updated ? "true" : "false");
                        await handleSavePreference("app_archive_save", updated);
                      }}
                    />

                    <ToggleRow
                      label="Force Tablet Layout"
                      description="Forces wide screen split views and secondary lists on smaller handheld screens."
                      checked={tabletSupport}
                      onChange={async () => {
                        const updated = !tabletSupport;
                        setTabletSupport(updated);
                        localStorage.setItem("app_tablet_layout", updated ? "true" : "false");
                        await handleSavePreference("app_tablet_layout", updated);
                      }}
                    />

                    <div className="grid gap-4 sm:grid-cols-2 pt-4 border-t border-[color:var(--border)]">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Ecosystem Language</label>
                        <select
                          value={appLanguage}
                          onChange={async (e) => {
                            const val = e.target.value;
                            setAppLanguage(val);
                            localStorage.setItem("app_lang", val);
                            await handleSavePreference("app_lang", val);
                            setSuccessMessage("Ecosystem language set to " + val);
                          }}
                          className="field text-xs cursor-pointer !py-2.5"
                        >
                          <option value="english">English (US)</option>
                          <option value="spanish">Español</option>
                          <option value="hindi">हिन्दी (Hindi)</option>
                          <option value="french">Français</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Early Access Program</label>
                        <div className="flex items-center gap-2 pt-1">
                          <ToggleRow
                            label="Beta Builds"
                            description="Opt-in to daily unreleased layouts."
                            checked={earlyAccess}
                            onChange={async () => {
                              const updated = !earlyAccess;
                              setEarlyAccess(updated);
                              localStorage.setItem("flag_early_access", updated ? "true" : "false");
                              await handleSavePreference("flag_early_access", updated);
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 9. Category View: Feature Labs */}
            {activeCategory === "feature-labs" && (
              <div className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h3 className="text-lg font-bold text-ink flex items-center gap-2">
                      <Sparkles size={18} className="text-cyan-500" />
                      Neurality Gatekeeper Feature Labs
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-cyan-500/10 text-cyan-600">FastAPI Sync</span>
                  </div>
                  <div className="panel soft-ring p-6 space-y-4">
                    <p className="text-xs text-[color:var(--text-muted)] leading-relaxed">
                      Test next-generation social, calling, and messaging infrastructure directly integrated into our high-performance FastAPI experimentation engine.
                    </p>
                    
                    <div className="space-y-3 pt-2">
                      <ToggleRow
                        label="Direct Message Reactions v2"
                        description="Opt-in to custom emoji selectors, custom skin tones, and rich reactive spring feedback on chat bubbles."
                        checked={featureFlags.dm_reactions_v2}
                        onChange={() => handleToggleFlag("dm_reactions_v2")}
                      />
                      
                      <ToggleRow
                        label="AI-Powered Direct Translation"
                        description="Performs automatic translation of messages in chats in real-time, leveraging low-latency models."
                        checked={featureFlags.ai_translation}
                        onChange={() => handleToggleFlag("ai_translation")}
                      />

                      <ToggleRow
                        label="Ultra-Low-Latency Audio Calling"
                        description="Route all audio call channels through the WebRTC horizontal SFU scaling layer for lower jitter."
                        checked={featureFlags.webrtc_calling_v2}
                        onChange={() => handleToggleFlag("webrtc_calling_v2")}
                      />

                      <ToggleRow
                        label="Staged Rollout Beta Program"
                        description="Enables automatic 10% bucket user targeting for live experimentation features."
                        checked={featureFlags.beta_rollout_10}
                        onChange={() => handleToggleFlag("beta_rollout_10")}
                      />

                      <ToggleRow
                        label="Next-Gen Reels Feed Engine"
                        description="Pre-compiles reels dynamically inside background threads to prevent screen frame drops during fast scrolls."
                        checked={featureFlags.beta_reels_engine}
                        onChange={() => handleToggleFlag("beta_reels_engine")}
                      />

                      <ToggleRow
                        label="Smart Media Preloading"
                        description="Loads content ahead of time on WiFi based on user historical timeline session lengths."
                        checked={featureFlags.smart_preload}
                        onChange={() => handleToggleFlag("smart_preload")}
                      />

                      <ToggleRow
                        label="AI Feed Ranker v2"
                        description="Uses client-side lightweight heuristics to re-order feeds without sending tracking keys to servers."
                        checked={featureFlags.ai_feed_ranker}
                        onChange={() => handleToggleFlag("ai_feed_ranker")}
                      />

                      <ToggleRow
                        label="Card Mode Profile Layout"
                        description="Enables a floating modern container setup on profile viewports for a more premium look."
                        checked={featureFlags.new_profile_layout}
                        onChange={() => handleToggleFlag("new_profile_layout")}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 10. Category View: Support & Help */}
            {activeCategory === "support" && (
              <div className="space-y-6">
                <div className="space-y-3">
                  <h3 className="text-lg font-bold text-ink flex items-center gap-2">
                    <HelpCircle size={18} className="text-teal-500" />
                    Help & Diagnostics
                  </h3>
                  <div className="panel soft-ring p-6 space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <a href="https://neurality.dev/help" target="_blank" rel="noreferrer" className="p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-[color:var(--border)] block hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                        <p className="text-xs font-bold text-ink">Ecosystem Knowledge Hub</p>
                        <p className="text-[10px] text-zinc-400 mt-1">Read guides, tutorials, and privacy compliance forms.</p>
                      </a>

                      <a href="https://neurality.dev/privacy" target="_blank" rel="noreferrer" className="p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-[color:var(--border)] block hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                        <p className="text-xs font-bold text-ink">Ecosystem Privacy Center</p>
                        <p className="text-[10px] text-zinc-400 mt-1">Manage your active social signals, cookies and metadata rights.</p>
                      </a>
                    </div>
                  </div>
                </div>

                {/* Report a Problem Form */}
                <div className="space-y-3">
                  <h3 className="text-lg font-bold text-ink flex items-center gap-2">
                    <ShieldAlert size={18} className="text-teal-500" />
                    Report a Problem / Bug Tracker
                  </h3>
                  <form onSubmit={handleSupportSubmit} className="panel soft-ring p-6 space-y-4">
                    <p className="text-xs text-[color:var(--text-muted)] leading-relaxed">
                      Facing chat disconnects, display issues, or setting errors? Write a short report, and our diagnostic bot will review it instantly.
                    </p>
                    
                    <textarea
                      value={supportMessage}
                      onChange={(e) => setSupportMessage(e.target.value)}
                      className="field min-h-[120px] py-3.5 !bg-zinc-50 dark:!bg-zinc-900/50 resize-none text-xs"
                      placeholder="Describe the issue you're experiencing (e.g. settings page not saving, websocket lagging...)"
                      required
                    />

                    <button
                      type="submit"
                      disabled={submittingSupport}
                      className="px-6 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                      {submittingSupport ? "Submitting Ticket..." : "File Diagnostic Ticket"}
                    </button>
                  </form>
                </div>
              </div>
            )}

            <div className="flex justify-center py-10 opacity-30">
              <p className="text-[10px] font-bold uppercase tracking-[0.5em] text-zinc-500">Neurality Social Engine v2.0</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
