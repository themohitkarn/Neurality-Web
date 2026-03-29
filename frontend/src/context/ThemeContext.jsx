import { createContext, useContext, useEffect, useState } from "react";

import { useAuth } from "./AuthContext";


const ThemeContext = createContext(null);
const THEME_STORAGE_KEY = "neurality_theme_preference";


function resolveTheme(themePreference) {
  if (themePreference === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return themePreference;
}


export function ThemeProvider({ children }) {
  const { user } = useAuth();
  const [themePreference, setThemePreference] = useState(
    () => localStorage.getItem(THEME_STORAGE_KEY) || user?.settings?.theme_preference || "system",
  );

  useEffect(() => {
    const nextPreference = user?.settings?.theme_preference;
    if (!nextPreference) {
      return;
    }
    setThemePreference(nextPreference);
    localStorage.setItem(THEME_STORAGE_KEY, nextPreference);
  }, [user?.settings?.theme_preference]);

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, themePreference);

    const applyTheme = () => {
      document.documentElement.dataset.theme = resolveTheme(themePreference);
    };

    applyTheme();

    if (themePreference !== "system") {
      return undefined;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => applyTheme();

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, [themePreference]);

  return (
    <ThemeContext.Provider
      value={{
        themePreference,
        resolvedTheme: resolveTheme(themePreference),
        setThemePreference,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}


export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider.");
  }
  return context;
}
