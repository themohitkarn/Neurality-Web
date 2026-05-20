import { useEffect, useState, useRef, useCallback } from "react";
import { X, Send, Heart, Smile, Volume2, VolumeX } from "lucide-react";
import { useSocket } from "../context/SocketContext";

import Avatar from "./Avatar";
import { storyApi } from "../services/api";
import { useVideoPlayback } from "../context/VideoPlaybackContext";

const FILTERS = [
  { id: "none", name: "Normal", filter: "none" },
  { id: "clarendon", name: "Aura", filter: "contrast(1.2) saturate(1.35)" },
  { id: "moon", name: "Moon", filter: "grayscale(1) contrast(1.1) brightness(1.1)" },
  { id: "lark", name: "Lark", filter: "brightness(1.1) contrast(0.9) saturate(1.2)" },
  { id: "reyes", name: "Vintage", filter: "sepia(0.3) brightness(1.1) contrast(0.85) saturate(0.75)" },
  { id: "juno", name: "Neon", filter: "sepia(0.2) contrast(1.3) brightness(1.1) saturate(2)" },
  { id: "aden", name: "Aden", filter: "sepia(0.2) brightness(1.15) saturate(1.4)" },
  { id: "cyber", name: "Cyber", filter: "hue-rotate(280deg) saturate(2.5) contrast(1.2)" },
  { id: "midnight", name: "Midnight", filter: "brightness(0.8) contrast(1.4) saturate(0.5) hue-rotate(200deg)" },
];

export default function StoryViewer({ group, open, onClose, allGroups, onNextGroup }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [swipeY, setSwipeY] = useState(0);
  const [swipeScale, setSwipeScale] = useState(1);
  const [dragging, setDragging] = useState(false);
  const startYRef = useRef(0);
  const timerRef = useRef(null);
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const STORY_DURATION = 5000;
  const { socket, isConnected } = useSocket();
  const [replyText, setReplyText] = useState("");
  const [showReactions, setShowReactions] = useState(false);

  // Video-specific states
  const [videoProgress, setVideoProgress] = useState(0);
  const [isMuted, setIsMuted] = useState(true); // Premium muted-autoplay by default

  const { isPlaybackEnabled, pausePlayback, resumePlayback } = useVideoPlayback() || {};

  // Handle modal playback state
  useEffect(() => {
    if (open && pausePlayback) {
      pausePlayback();
    }
    return () => {
      if (open && resumePlayback) resumePlayback();
    };
  }, [open, pausePlayback, resumePlayback]);

  /* Handle play/pause based on global active state and local pause state */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaybackEnabled && !paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [isPlaybackEnabled, paused, activeIndex]);

  /* Reset on group change */
  useEffect(() => {
    setActiveIndex(0);
    setPaused(false);
    setVideoProgress(0);
  }, [group?.user?.id]);

  /* Reset video progress when active story changes */
  useEffect(() => {
    setVideoProgress(0);
  }, [activeIndex]);

  /* Mark story as seen */
  useEffect(() => {
    if (open && group && group.stories[activeIndex]) {
      const storyId = group.stories[activeIndex].id;
      storyApi.markSeen(storyId).catch(console.error);
    }
  }, [activeIndex, group?.user?.id, open]);

  /* Auto-advance timer */
  useEffect(() => {
    if (!open || !group || paused) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    // Video stories will auto-advance on onEnded of the video tag
    if (group.stories[activeIndex]?.media_type === "video") {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    timerRef.current = setTimeout(() => {
      goNext();
    }, STORY_DURATION);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [activeIndex, group, open, paused]);

  /* Keyboard */
  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, activeIndex, group]);

  /* Lock body scroll */
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const goPrev = useCallback(() => {
    if (activeIndex > 0) {
      setActiveIndex(activeIndex - 1);
    } else if (allGroups && onNextGroup) {
      // Try going to PREVIOUS user
      const idx = allGroups.findIndex((g) => g.user.id === group.user.id);
      if (idx > 0) {
        const prevGroup = allGroups[idx - 1];
        onNextGroup(prevGroup);
        setActiveIndex(prevGroup.stories.length - 1);
      }
    }
  }, [activeIndex, allGroups, group, onNextGroup]);

  const goNext = useCallback(() => {
    if (!group) return;
    if (activeIndex < group.stories.length - 1) {
      setActiveIndex(activeIndex + 1);
    } else if (allGroups && onNextGroup) {
      // Try going to NEXT user
      const idx = allGroups.findIndex((g) => g.user.id === group.user.id);
      if (idx < allGroups.length - 1) {
        onNextGroup(allGroups[idx + 1]);
      } else {
        onClose();
      }
    } else {
      onClose();
    }
  }, [activeIndex, group, allGroups, onNextGroup, onClose]);

  /* Tap zones: left 30% = prev, right 70% = next */
  const handleTap = useCallback((e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX || e.changedTouches?.[0]?.clientX || 0) - rect.left;
    const ratio = x / rect.width;

    if (ratio < 0.3) {
      goPrev();
    } else {
      goNext();
    }
  }, [goPrev, goNext]);

  /* Long press to pause */
  const handlePointerDown = useCallback(() => {
    setPaused(true);
  }, []);

  /* Unpause */
  const handlePointerUp = useCallback(() => {
    setPaused(false);
  }, []);

  /* Swipe down to exit */
  const handleTouchStart = useCallback((e) => {
    startYRef.current = e.touches[0].clientY;
    setDragging(true);
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (!dragging) return;
    const diff = e.touches[0].clientY - startYRef.current;
    if (diff > 0) {
      setSwipeY(diff);
      setSwipeScale(Math.max(1 - diff / 800, 0.85));
    }
  }, [dragging]);

  const handleTouchEnd = useCallback(() => {
    setDragging(false);
    if (swipeY > 120) {
      onClose();
    }
    setSwipeY(0);
    setSwipeScale(1);
  }, [swipeY, onClose, dragging]);

  const handleSendReply = (e) => {
    if (e) e.preventDefault();
    if (!replyText.trim() || !socket || !isConnected) return;

    socket.emit("message:send", {
      content: replyText.trim(),
      receiverId: group.user.id,
      type: "text",
      metadata: {
        storyId: activeStory.id,
        storyUrl: activeStory.image_url
      }
    });

    setReplyText("");
    onClose();
  };

  const handleQuickReaction = (emoji) => {
    if (!socket || !isConnected) return;
    
    socket.emit("message:send", {
      content: emoji,
      receiverId: group.user.id,
      type: "text",
      metadata: {
        storyId: activeStory.id,
        storyUrl: activeStory.image_url,
        isReaction: true
      }
    });
    onClose();
  };

  if (!open || !group) return null;

  const activeStory = group.stories[activeIndex];

  // Parse rich overlay styles
  const overlayData = (() => {
    if (!activeStory?.text_style) return null;
    if (typeof activeStory.text_style === "string") {
      try {
        return JSON.parse(activeStory.text_style);
      } catch (e) {
        return null;
      }
    }
    return activeStory.text_style;
  })();

  const selectedFilter = overlayData?.selectedFilter || "none";
  const adjustments = overlayData?.adjustments || {
    brightness: 100,
    contrast: 100,
    saturate: 100,
    sepia: 0,
    hueRotate: 0,
    blur: 0,
  };
  const imageRotation = overlayData?.imageRotation || 0;

  const getFilterString = () => {
    const base = FILTERS.find(f => f.id === selectedFilter)?.filter || "none";
    const adj = `brightness(${adjustments.brightness}%) contrast(${adjustments.contrast}%) saturate(${adjustments.saturate}%) sepia(${adjustments.sepia}%) hue-rotate(${adjustments.hueRotate}deg) blur(${adjustments.blur}px)`;
    return base === "none" ? adj : `${base} ${adj}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050505] overflow-hidden">
      <div
        ref={containerRef}
        className="relative w-full h-full max-w-[480px] mx-auto bg-black overflow-hidden shadow-2xl flex flex-col items-center justify-center animate-in fade-in duration-300"
        style={{
          transform: `translateY(${swipeY}px) scale(${swipeScale})`,
          transition: dragging ? "none" : "transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
          borderRadius: swipeY > 0 ? "24px" : "0px",
        }}
        onClick={handleTap}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Story media & dynamic overlays container */}
        <div className="absolute inset-0 w-full h-full flex items-center justify-center overflow-hidden pointer-events-none">
          {activeStory.media_type === "video" ? (
            <video 
              ref={videoRef}
              src={activeStory.image_url} 
              playsInline 
              muted={isMuted}
              className="w-full h-full object-contain pointer-events-auto"
              style={{
                filter: getFilterString(),
                transform: `rotate(${imageRotation}deg)`,
                transformOrigin: "center center"
              }}
              onTimeUpdate={(e) => {
                if (e.target.duration) {
                  const progress = (e.target.currentTime / e.target.duration) * 100;
                  setVideoProgress(progress);
                }
              }}
              onEnded={goNext}
            />
          ) : (
            <img
              src={activeStory.image_url}
              alt=""
              className="w-full h-full object-contain pointer-events-auto"
              style={{
                filter: getFilterString(),
                transform: `rotate(${imageRotation}deg)`,
                transformOrigin: "center center"
              }}
              draggable={false}
            />
          )}

          {/* SVG Drawings Overlay */}
          {overlayData?.paths && overlayData.paths.length > 0 && (
            <div className="absolute inset-0 z-10 pointer-events-none">
              <svg className="w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                {overlayData.paths.map((path, i) => (
                  <polyline
                    key={i}
                    points={path.points.map(p => `${p.x},${p.y}`).join(" ")}
                    fill="none"
                    stroke={path.color}
                    strokeWidth={path.size / 5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}
              </svg>
            </div>
          )}

          {/* Dynamic Layers Overlay (text, sticker, image overlays) */}
          {overlayData?.layers?.map((layer) => (
            <div
              key={layer.id}
              className="absolute pointer-events-none select-none p-2 rounded-lg z-20"
              style={{ 
                left: `${layer.x}%`, 
                top: `${layer.y}%`, 
                transform: `translate(-50%, -50%) scale(${layer.scale}) rotate(${layer.rotation}deg)`,
                transformOrigin: "center center"
              }}
            >
              {layer.type === "text" ? (
                <div
                  style={{
                    color: layer.color,
                    fontSize: layer.fontSize,
                    fontWeight: "bold",
                    textShadow: "0 2px 10px rgba(0,0,0,0.5)",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    maxWidth: "250px",
                  }}
                >
                  {layer.content}
                </div>
              ) : layer.type === "image" ? (
                <img
                  src={layer.content}
                  crossOrigin="anonymous"
                  className="max-w-[200px] rounded-2xl shadow-2xl"
                  draggable={false}
                />
              ) : (
                <div className="text-6xl">
                  {layer.content}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Progress bars */}
        <div className="absolute inset-x-0 top-0 z-40 flex gap-1 px-2 pt-2" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 8px)" }}>
          {group.stories.map((story, index) => (
            <div key={story.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-white shadow-[0_0_4px_rgba(255,255,255,0.4)]"
                style={
                  index < activeIndex
                    ? { width: "100%" }
                    : index === activeIndex
                      ? {
                          animation: paused || activeStory.media_type === "video"
                            ? "none"
                            : `progressBar ${STORY_DURATION}ms linear forwards`,
                          animationPlayState: paused ? "paused" : "running",
                          width: activeStory.media_type === "video" ? `${videoProgress}%` : undefined
                        }
                      : { width: 0 }
                }
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div
          className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-4 w-full"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 24px)" }}
        >
          <div className="flex items-center gap-3">
            <Avatar src={group.user.profile_pic} name={group.user.username} size="sm" className="border border-white/20 shadow-md" />
            <div>
              <p className="text-sm font-bold text-white drop-shadow-md">{group.user.username}</p>
              <p className="text-[11px] text-white/70 drop-shadow-sm font-medium">
                {new Date(activeStory.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              </p>
            </div>
          </div>

          {/* Volume and Close Actions */}
          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            {activeStory.media_type === "video" && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }}
                className="flex items-center justify-center rounded-full text-white transition active:scale-90"
                style={{ width: 36, height: 36, background: "rgba(0,0,0,0.3)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
            )}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              className="flex items-center justify-center rounded-full text-white transition active:scale-90"
              style={{ width: 36, height: 36, background: "rgba(0,0,0,0.3)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Bottom gradient */}
        <div className="absolute bottom-0 inset-x-0 h-40 bg-gradient-to-t from-black/80 to-transparent pointer-events-none z-20" />

        {/* Reply Bar */}
        <div 
          className="absolute bottom-0 inset-x-0 z-40 p-4 flex flex-col gap-4"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}
          onClick={(e) => e.stopPropagation()}
        >
          {showReactions && (
            <div className="flex items-center justify-between px-2 animate-in slide-in-from-bottom-4 duration-300">
              {["😂", "😮", "😍", "😢", "👏", "🔥", "❤️", "🙌"].map(emoji => (
                <button
                  key={emoji}
                  onClick={() => handleQuickReaction(emoji)}
                  className="text-2xl transition-transform active:scale-125 hover:scale-110"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3">
            <form 
              onSubmit={handleSendReply}
              className="flex-1 flex items-center gap-3 rounded-full border border-white/20 bg-white/10 px-4 py-2.5 backdrop-blur-md"
            >
              <input
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onFocus={() => { setPaused(true); setShowReactions(true); }}
                onBlur={() => { setPaused(false); setTimeout(() => setShowReactions(false), 200); }}
                placeholder="Send message"
                className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/50"
              />
              {replyText.trim() ? (
                <button type="submit" className="text-white transition-transform active:scale-90">
                  <Send size={18} />
                </button>
              ) : (
                <button 
                  type="button"
                  onClick={() => setShowReactions(!showReactions)}
                  className="text-white/70"
                >
                  <Smile size={20} />
                </button>
              )}
            </form>
            <button
              onClick={() => handleQuickReaction("❤️")}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white backdrop-blur-md transition-all active:scale-90"
            >
              <Heart size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
