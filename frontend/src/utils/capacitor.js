import { Capacitor } from "@capacitor/core";

/* ── Platform Detection ── */
export const isNative = Capacitor.isNativePlatform();
export const isIOS = Capacitor.getPlatform() === "ios";
export const isAndroid = Capacitor.getPlatform() === "android";
export const isWeb = Capacitor.getPlatform() === "web";

/* ── Haptics ── */
let Haptics = null;
if (isNative) {
  import("@capacitor/haptics").then((mod) => {
    Haptics = mod.Haptics;
  });
}

export async function hapticLight() {
  if (Haptics) {
    try { await Haptics.impact({ style: "LIGHT" }); } catch (_) {}
  }
}

export async function hapticMedium() {
  if (Haptics) {
    try { await Haptics.impact({ style: "MEDIUM" }); } catch (_) {}
  }
}

export async function hapticHeavy() {
  if (Haptics) {
    try { await Haptics.impact({ style: "HEAVY" }); } catch (_) {}
  }
}

export async function hapticSelection() {
  if (Haptics) {
    try { await Haptics.selectionStart(); await Haptics.selectionChanged(); await Haptics.selectionEnd(); } catch (_) {}
  }
}

/* ── Camera ── */
export async function takePicture(options = {}) {
  if (!isNative) {
    return null;
  }
  try {
    const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera");
    const image = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      source: CameraSource.Prompt,
      ...options,
    });
    return image;
  } catch (_) {
    return null;
  }
}

/* ── Share ── */
export async function shareContent({ title, text, url }) {
  if (isNative) {
    try {
      const { Share } = await import("@capacitor/share");
      await Share.share({ title, text, url });
      return true;
    } catch (_) {
      return false;
    }
  }
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return true;
    } catch (_) {
      return false;
    }
  }
  try {
    await navigator.clipboard.writeText(url || text || "");
    return true;
  } catch (_) {
    return false;
  }
}

/* ── Keyboard ── */
export async function hideKeyboard() {
  if (isNative) {
    try {
      const { Keyboard } = await import("@capacitor/keyboard");
      await Keyboard.hide();
    } catch (_) {}
  }
}

/* ── Status Bar ── */
export async function setStatusBarStyle(style = "Dark") {
  if (isNative) {
    try {
      const { StatusBar } = await import("@capacitor/status-bar");
      await StatusBar.setStyle({ style });
    } catch (_) {}
  }
}

export async function setStatusBarColor(color = "#09090b") {
  if (isAndroid) {
    try {
      const { StatusBar } = await import("@capacitor/status-bar");
      await StatusBar.setBackgroundColor({ color });
    } catch (_) {}
  }
}

/* ── Local Storage (Preferences) ── */
export async function setPreference(key, value) {
  if (isNative) {
    try {
      const { Preferences } = await import("@capacitor/preferences");
      await Preferences.set({ key, value: JSON.stringify(value) });
    } catch (_) {
      localStorage.setItem(key, JSON.stringify(value));
    }
  } else {
    localStorage.setItem(key, JSON.stringify(value));
  }
}

export async function getPreference(key) {
  if (isNative) {
    try {
      const { Preferences } = await import("@capacitor/preferences");
      const { value } = await Preferences.get({ key });
      return value ? JSON.parse(value) : null;
    } catch (_) {
      const val = localStorage.getItem(key);
      return val ? JSON.parse(val) : null;
    }
  }
  const val = localStorage.getItem(key);
  return val ? JSON.parse(val) : null;
}
