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


ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
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
  </React.StrictMode>,
);