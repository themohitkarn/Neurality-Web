import { useState, useEffect } from "react";

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone) {
      setIsInstalled(true);
      return;
    }

    // Check if user dismissed recently (don't nag)
    const dismissed = localStorage.getItem("neurality_pwa_dismissed");
    if (dismissed) {
      const dismissedAt = parseInt(dismissed, 10);
      // Don't show again for 3 days
      if (Date.now() - dismissedAt < 3 * 24 * 60 * 60 * 1000) return;
    }

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Small delay so user can see the app first
      setTimeout(() => setShowBanner(true), 2000);
    };

    window.addEventListener("beforeinstallprompt", handler);

    // Detect post-install
    window.addEventListener("appinstalled", () => {
      setIsInstalled(true);
      setShowBanner(false);
      setDeferredPrompt(null);
    });

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem("neurality_pwa_dismissed", Date.now().toString());
  };

  if (!showBanner || isInstalled) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "80px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        width: "calc(100% - 32px)",
        maxWidth: "400px",
        background: "linear-gradient(135deg, rgba(30,20,45,0.97) 0%, rgba(18,12,30,0.98) 100%)",
        border: "1px solid rgba(168,85,247,0.35)",
        borderRadius: "18px",
        padding: "16px 18px",
        backdropFilter: "blur(20px)",
        boxShadow: "0 8px 32px rgba(168,85,247,0.2), 0 0 0 1px rgba(255,255,255,0.05) inset",
        animation: "slideUpBanner 0.5s cubic-bezier(0.16,1,0.3,1)",
      }}
    >
      <style>{`
        @keyframes slideUpBanner {
          from { opacity: 0; transform: translateX(-50%) translateY(30px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <img
          src="/icon-192.png"
          alt="Neurality"
          style={{
            width: "44px",
            height: "44px",
            borderRadius: "12px",
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontWeight: 700,
              fontSize: "15px",
              color: "#fff",
              lineHeight: 1.2,
            }}
          >
            Install Neurality
          </div>
          <div
            style={{
              fontSize: "12px",
              color: "rgba(255,255,255,0.55)",
              marginTop: "2px",
            }}
          >
            Add to home screen for the full experience
          </div>
        </div>
        <button
          onClick={handleDismiss}
          style={{
            background: "none",
            border: "none",
            color: "rgba(255,255,255,0.4)",
            fontSize: "20px",
            cursor: "pointer",
            padding: "4px",
            lineHeight: 1,
            flexShrink: 0,
          }}
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
      <button
        onClick={handleInstall}
        style={{
          width: "100%",
          marginTop: "12px",
          padding: "10px",
          borderRadius: "12px",
          border: "none",
          background: "linear-gradient(135deg, #a855f7, #7c3aed)",
          color: "#fff",
          fontWeight: 700,
          fontSize: "14px",
          cursor: "pointer",
          letterSpacing: "0.3px",
          transition: "transform 0.15s, box-shadow 0.15s",
        }}
        onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.97)")}
        onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
      >
        Install App
      </button>
    </div>
  );
}
