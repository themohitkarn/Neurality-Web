import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useAuth } from "./AuthContext";

const ThemeContext = createContext(null);
const THEME_STORAGE_KEY = "neurality_theme_preference";

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

function resolveTheme(themePreference) {
  if (themePreference === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return themePreference;
}

export function ThemeProvider({ children }) {
  const { user } = useAuth();
  const [themePreference, setThemePreference] = useState(
    () => localStorage.getItem(THEME_STORAGE_KEY) || "system",
  );
  const [activeChatTheme, setActiveChatTheme] = useState(PREMIUM_THEMES.default);

  // Apply Global Theme (Dark/Light)
  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, themePreference);
    document.documentElement.dataset.theme = resolveTheme(themePreference);
    
    if (themePreference === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handleChange = () => {
        document.documentElement.dataset.theme = resolveTheme("system");
      };
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }
  }, [themePreference]);

  // Inject Chat-Specific Variables
  const injectChatTheme = useCallback((themeId) => {
    const theme = PREMIUM_THEMES[themeId] || PREMIUM_THEMES.default;
    setActiveChatTheme(theme);
    
    const root = document.documentElement;
    root.style.setProperty('--chat-accent', theme.accent);
    root.style.setProperty('--chat-accent-opaque', `${theme.accent}33`); // 20% opacity hex
    root.style.setProperty('--chat-gradient', theme.gradient);
    root.style.setProperty('--chat-bubble-bg', theme.bubble);
    root.style.setProperty('--chat-text', theme.text);
    root.style.setProperty('--chat-glass', theme.glass);
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        themePreference,
        resolvedTheme: resolveTheme(themePreference),
        setThemePreference,
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
