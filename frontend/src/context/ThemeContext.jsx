import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { userApi } from "../services/api";

const ThemeContext = createContext(null);
const THEME_STORAGE_KEY = "neurality_theme_preference";
const ACCENT_STORAGE_KEY = "accent_color";

export const PREMIUM_THEMES = {
  default: {
    id: "default",
    name: "Classic Neural",
    gradient: "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)",
    accent: "#a855f7",
    bubble: "bg-white/10",
    text: "text-white",
    glass: "backdrop-blur-xl bg-black/20"
  },
  cyberpunk: {
    id: "cyberpunk",
    name: "Cyber Neon",
    gradient: "linear-gradient(135deg, #ff00ff 0%, #00ffff 100%)",
    accent: "#00ffff",
    bubble: "bg-cyan-500/10 border border-cyan-500/20",
    text: "text-cyan-400",
    glass: "backdrop-blur-2xl bg-fuchsia-900/10"
  },
  deepsea: {
    id: "deepsea",
    name: "Deep Ocean",
    gradient: "linear-gradient(135deg, #0f172a 0%, #334155 100%)",
    accent: "#38bdf8",
    bubble: "bg-sky-500/10 border border-sky-500/20",
    text: "text-sky-300",
    glass: "backdrop-blur-xl bg-slate-900/40"
  },
  lavender: {
    id: "lavender",
    name: "Ethereal Lavender",
    gradient: "linear-gradient(135deg, #d8b4fe 0%, #818cf8 100%)",
    accent: "#818cf8",
    bubble: "bg-indigo-500/10 border border-indigo-500/20",
    text: "text-indigo-200",
    glass: "backdrop-blur-xl bg-purple-900/20"
  },
  monochrome: {
    id: "monochrome",
    name: "Noir",
    gradient: "linear-gradient(135deg, #111111 0%, #333333 100%)",
    accent: "#ffffff",
    bubble: "bg-white/5 border border-white/10",
    text: "text-white",
    glass: "backdrop-blur-md bg-white/5"
  }
};

const ACCENT_COLORS = {
  purple: { accent: "#a855f7", soft: "rgba(168, 85, 247, 0.14)", glow: "rgba(168, 85, 247, 0.3)", start: "#8b5cf6", end: "#d8b4fe" },
  indigo: { accent: "#4f46e5", soft: "rgba(79, 70, 229, 0.14)", glow: "rgba(79, 70, 229, 0.3)", start: "#4f46e5", end: "#818cf8" },
  rose: { accent: "#f43f5e", soft: "rgba(244, 63, 94, 0.14)", glow: "rgba(244, 63, 94, 0.3)", start: "#f43f5e", end: "#fda4af" },
  emerald: { accent: "#10b981", soft: "rgba(16, 185, 129, 0.14)", glow: "rgba(16, 185, 129, 0.3)", start: "#10b981", end: "#6ee7b7" },
  amber: { accent: "#f59e0b", soft: "rgba(245, 158, 11, 0.14)", glow: "rgba(245, 158, 11, 0.3)", start: "#f59e0b", end: "#fde047" },
  cyan: { accent: "#06b6d4", soft: "rgba(6, 182, 212, 0.14)", glow: "rgba(6, 182, 212, 0.3)", start: "#06b6d4", end: "#67e8f9" },
};

function resolveTheme(themePreference) {
  if (themePreference === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return themePreference;
}

export function ThemeProvider({ children }) {
  const { user, setUser } = useAuth();
  const [themePreference, setThemePreference] = useState(
    () => localStorage.getItem(THEME_STORAGE_KEY) || "system"
  );
  const [accentColor, setAccentColorState] = useState(
    () => localStorage.getItem(ACCENT_STORAGE_KEY) || "purple"
  );
  
  const [customThemeColors, setCustomThemeColors] = useState({
    bg: localStorage.getItem("custom_bg") || "#0a0915",
    bg_card: localStorage.getItem("custom_bg_card") || "#121124",
    bg_elevated: localStorage.getItem("custom_bg_elevated") || "#1a1835",
    border: localStorage.getItem("custom_border") || "#252145",
    text: localStorage.getItem("custom_text") || "#ffffff",
    accent: localStorage.getItem("custom_accent") || "#00ffcc",
    accent_end: localStorage.getItem("custom_accent_end") || "#00b3ff",
  });

  const [activeChatTheme, setActiveChatTheme] = useState(PREMIUM_THEMES.default);

  // Sync settings when authenticated user object changes (persistent login)
  useEffect(() => {
    if (user?.settings) {
      if (user.settings.theme_preference) {
        setThemePreference(user.settings.theme_preference);
      }
      if (user.settings.accent_color) {
        setAccentColorState(user.settings.accent_color);
      }
      setCustomThemeColors({
        bg: user.settings.custom_bg || localStorage.getItem("custom_bg") || "#0a0915",
        bg_card: user.settings.custom_bg_card || localStorage.getItem("custom_bg_card") || "#121124",
        bg_elevated: user.settings.custom_bg_elevated || localStorage.getItem("custom_bg_elevated") || "#1a1835",
        border: user.settings.custom_border || localStorage.getItem("custom_border") || "#252145",
        text: user.settings.custom_text || localStorage.getItem("custom_text") || "#ffffff",
        accent: user.settings.custom_accent || localStorage.getItem("custom_accent") || "#00ffcc",
        accent_end: user.settings.custom_accent_end || localStorage.getItem("custom_accent_end") || "#00b3ff",
      });
    }
  }, [user]);

  // Set local state & update localStorage + SQL DB
  const setAccentColor = useCallback(async (color) => {
    setAccentColorState(color);
    localStorage.setItem(ACCENT_STORAGE_KEY, color);
    try {
      const { data } = await userApi.updateSettings({ accent_color: color });
      if (data?.user) {
        setUser(data.user);
      }
    } catch (e) {
      console.error("Failed to persist accent color to database:", e);
    }
  }, [setUser]);

  const updateCustomThemeColors = useCallback(async (updates) => {
    setCustomThemeColors((prev) => {
      const merged = { ...prev, ...updates };
      Object.entries(updates).forEach(([k, v]) => {
        localStorage.setItem(`custom_${k}`, v);
      });
      return merged;
    });

    const apiUpdates = {};
    Object.entries(updates).forEach(([k, v]) => {
      apiUpdates[`custom_${k}`] = v;
    });
    try {
      const { data } = await userApi.updateSettings(apiUpdates);
      if (data?.user) {
        setUser(data.user);
      }
    } catch (e) {
      console.error("Failed to persist custom theme colors to database:", e);
    }
  }, [setUser]);

  // Inject Chat-Specific Variables
  const injectChatTheme = useCallback((themeId) => {
    const theme = PREMIUM_THEMES[themeId] || PREMIUM_THEMES.default;
    setActiveChatTheme(theme);
    
    const root = document.documentElement;
    if (themeId === "default") {
      root.style.setProperty('--chat-accent', 'var(--accent)');
      root.style.setProperty('--chat-accent-opaque', 'var(--accent-soft)');
      root.style.setProperty('--chat-gradient', 'linear-gradient(135deg, var(--gradient-start) 0%, var(--gradient-end) 100%)');
      root.style.setProperty('--chat-bubble-bg', 'rgba(255,255,255,0.08)');
      root.style.setProperty('--chat-text', 'text-white');
      root.style.setProperty('--chat-glass', 'backdrop-blur-xl bg-black/20');
    } else {
      root.style.setProperty('--chat-accent', theme.accent);
      root.style.setProperty('--chat-accent-opaque', `${theme.accent}33`); // 20% opacity hex
      root.style.setProperty('--chat-gradient', theme.gradient);
      root.style.setProperty('--chat-bubble-bg', theme.bubble);
      root.style.setProperty('--chat-text', theme.text);
      root.style.setProperty('--chat-glass', theme.glass);
    }
  }, []);

  // Inject dynamic variables on change
  useEffect(() => {
    const root = document.documentElement;
    localStorage.setItem(THEME_STORAGE_KEY, themePreference);
    
    // Resolve theme modes
    const resolved = resolveTheme(themePreference);
    root.dataset.theme = resolved;

    // Apply main accent variables
    let accentVals = ACCENT_COLORS[accentColor];
    if (accentColor === "custom" || !accentVals) {
      const act = customThemeColors.accent;
      const actEnd = customThemeColors.accent_end;
      accentVals = {
        accent: act,
        soft: `${act}22`,
        glow: `${act}44`,
        start: act,
        end: actEnd
      };
    }

    root.style.setProperty('--accent', accentVals.accent);
    root.style.setProperty('--accent-soft', accentVals.soft);
    root.style.setProperty('--accent-glow', accentVals.glow);
    root.style.setProperty('--gradient-start', accentVals.start);
    root.style.setProperty('--gradient-end', accentVals.end);

    // Apply custom base styling if custom theme is chosen
    if (themePreference === "custom") {
      root.style.setProperty('--bg', customThemeColors.bg);
      root.style.setProperty('--bg-card', customThemeColors.bg_card);
      root.style.setProperty('--bg-elevated', customThemeColors.bg_elevated);
      root.style.setProperty('--border', customThemeColors.border);
      root.style.setProperty('--text-primary', customThemeColors.text);
    } else {
      // Remove inline properties to allow amoled or light mode to render safely
      root.style.removeProperty('--bg');
      root.style.removeProperty('--bg-card');
      root.style.removeProperty('--bg-elevated');
      root.style.removeProperty('--border');
      root.style.removeProperty('--text-primary');
    }

    // Auto-synchronize active chat theme with the active accent color
    injectChatTheme(activeChatTheme.id);

    if (themePreference === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handleChange = () => {
        root.dataset.theme = resolveTheme("system");
      };
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }
  }, [themePreference, accentColor, customThemeColors, activeChatTheme.id, injectChatTheme]);


  return (
    <ThemeContext.Provider
      value={{
        themePreference,
        resolvedTheme: resolveTheme(themePreference),
        setThemePreference,
        accentColor,
        setAccentColor,
        customThemeColors,
        updateCustomThemeColors,
        activeChatTheme,
        injectChatTheme,
        premiumThemes: PREMIUM_THEMES
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider.");
  return context;
}
