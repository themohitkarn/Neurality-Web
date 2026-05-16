import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.neurality.app",
  appName: "Neurality",
  webDir: "dist",
  server: {
    // Comment this out for production builds
    // url: "http://YOUR_LOCAL_IP:5173",
    cleartext: true,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 2000,
      backgroundColor: "#09090b",
      showSpinner: false,
      splashImmersive: true,
      splashFullScreen: true,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#09090b",
    },
    Keyboard: {
      resize: "body",
      resizeOnFullScreen: true,
    },
    Camera: {
      permissions: ["camera", "photos"],
    },
  },
};

export default config;
