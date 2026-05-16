import { useEffect, useState, useRef, useCallback } from "react";
import { X, Send, Heart, Smile } from "lucide-react";
import { useSocket } from "../context/SocketContext";

import Avatar from "./Avatar";
import { storyApi } from "../services/api";
import { useVideoPlayback } from "../context/VideoPlaybackContext";


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

  const { isPlaybackEnabled, pausePlayback, resumePlayback } = useVideoPlayback();

  // Handle modal playback state
  useEffect(() => {
    if (open) {
      pausePlayback();
    }
    return () => {
      if (open) resumePlayback();
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
  }, [group?.user?.id]);

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050505] overflow-hidden">
      <div
        ref={containerRef}
        className="relative w-full h-full max-w-[480px] mx-auto bg-black overflow-hidden shadow-2xl flex flex-col items-center justify-center"
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
        {/* Story media */}
        {activeStory.media_type === "video" ? (
          <video 
            ref={videoRef}
            src={activeStory.image_url} 
            playsInline 
            muted={activeStory.is_muted}
            className="w-full h-full object-contain"
            onEnded={goNext}
          />
        ) : (
          <img
            src={activeStory.image_url}
            alt=""
            className="w-full h-full object-contain"
            draggable={false}
          />
        )}

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
                          width: activeStory.media_type === "video" ? "0%" : undefined
                        }
                      : { width: 0 }
                }
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div
          className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-4"
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
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="flex items-center justify-center rounded-full text-white transition active:scale-90"
            style={{ width: 36, height: 36, background: "rgba(0,0,0,0.3)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <X size={20} />
          </button>
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
