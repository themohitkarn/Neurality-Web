import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useVideoPlayback } from "../context/VideoPlaybackContext";


export default function BottomSheet({ open, onClose, title, children, snapPoints = ["60vh", "90vh"] }) {
  const sheetRef = useRef(null);
  const startY = useRef(0);
  const currentY = useRef(0);
  const [snapIndex, setSnapIndex] = useState(0);
  const [dragging, setDragging] = useState(false);

  const { pausePlayback, resumePlayback } = useVideoPlayback();

  useEffect(() => {
    if (open) {
      setSnapIndex(0);
      document.body.style.overflow = "hidden";
      pausePlayback();
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      if (open) resumePlayback();
      document.body.style.overflow = "";
    };
  }, [open, pausePlayback, resumePlayback]);

  const handleTouchStart = (e) => {
    startY.current = e.touches[0].clientY;
    currentY.current = 0;
    setDragging(true);
  };

  const handleTouchMove = (e) => {
    const diff = e.touches[0].clientY - startY.current;
    currentY.current = diff;
    if (diff > 0 && sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${diff}px)`;
    }
  };

  const handleTouchEnd = () => {
    setDragging(false);
    if (sheetRef.current) {
      sheetRef.current.style.transform = "";
    }
    if (currentY.current > 120) {
      onClose();
    }
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className="relative z-10 flex flex-col rounded-t-3xl animate-slide-up"
        style={{
          maxHeight: snapPoints[snapIndex] || "60vh",
          background: "var(--bg-elevated)",
          borderTop: "1px solid var(--border)",
          transition: dragging ? "none" : "transform 0.35s cubic-bezier(0.16,1,0.3,1)",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Handle */}
        <div className="flex flex-col items-center pt-3 pb-2">
          <div className="sheet-handle" />
        </div>

        {/* Header */}
        {title ? (
          <div className="flex items-center justify-between px-5 pb-3 border-b border-[color:var(--border)]">
            <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h3>
            <button onClick={onClose} className="btn-icon" style={{ width: 32, height: 32 }}>
              <X size={16} />
            </button>
          </div>
        ) : null}

        {/* Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-3">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
