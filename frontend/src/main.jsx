import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { VideoPlaybackProvider } from "./context/VideoPlaybackContext";
import { SocketProvider } from "./context/SocketContext";
import { CallProvider } from "./context/CallContext";
import { UnreadProvider } from "./context/UnreadContext";
import { CommunicationProvider } from "./context/CommunicationContext";
import { MediaProvider } from "./context/MediaContext";
import { isNative, setStatusBarColor, setStatusBarStyle } from "./utils/capacitor";
import "./index.css";


/* ── Capacitor bootstrap ── */
async function initNative() {
  if (!isNative) return;

  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide();
  } catch (_) {}

  await setStatusBarStyle("Dark");
  await setStatusBarColor("#09090b");

  try {
    const { Keyboard } = await import("@capacitor/keyboard");
    Keyboard.addListener("keyboardWillShow", () => {
      document.body.classList.add("keyboard-open");
    });
    Keyboard.addListener("keyboardWillHide", () => {
      document.body.classList.remove("keyboard-open");
    });
  } catch (_) {}
}

initNative();

// --- Non-blocking Global Toast to replace alerts ---
window.toast = (msg) => {
  console.log("[Toast]", msg);
  const div = document.createElement("div");
  div.textContent = msg;
  div.style.cssText = "position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:rgba(20,20,20,0.9);color:#fff;padding:10px 20px;border-radius:20px;z-index:9999;font-size:14px;box-shadow:0 4px 12px rgba(0,0,0,0.2);transition:opacity 0.3s;opacity:0;backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.1);text-align:center;max-width:80%;";
  document.body.appendChild(div);
  requestAnimationFrame(() => div.style.opacity = "1");
  setTimeout(() => {
    div.style.opacity = "0";
    setTimeout(() => div.remove(), 300);
  }, 3000);
};
window.alert = window.toast;
// ---------------------------------------------------

import ErrorBoundary from "./ErrorBoundary";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <ThemeProvider>
            <VideoPlaybackProvider>
              <SocketProvider>
                <CallProvider>
                  <UnreadProvider>
                    <CommunicationProvider>
                      <MediaProvider>
                        <App />
                      </MediaProvider>
                    </CommunicationProvider>
                  </UnreadProvider>
                </CallProvider>
              </SocketProvider>
            </VideoPlaybackProvider>
          </ThemeProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
);