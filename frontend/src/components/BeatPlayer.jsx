import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

import Avatar from "./Avatar";
import BeatActionBar from "./BeatActionBar";
import MuteOverlay from "./MuteOverlay";
import { hapticHeavy, hapticLight } from "../utils/capacitor";
import { useVideoAutoplay } from "../hooks/useVideoAutoplay";
import AdaptiveMediaRenderer from "./AdaptiveMediaRenderer";


export default function BeatPlayer({ beat, onToggleLike, onAddStory, currentUser }) {
  const { containerRef, isActive } = useVideoAutoplay(`beat-${beat.id}`, 0.6);
  const videoRef = useRef(null);
  const [muted, setMuted] = useState(beat.is_muted !== false);
  const [showMuteOverlay, setShowMuteOverlay] = useState(false);
  const [showHeartOverlay, setShowHeartOverlay] = useState(false);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const lastTapRef = useRef(0);
  const lastTapXRef = useRef(0);
  const longPressRef = useRef(null);

  /* Auto-play / pause based on active state */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isActive) {
      video.currentTime = 0;
      const playPromise = video.play();
      if (playPromise?.catch) playPromise.catch(() => {});
      setPaused(false);
    } else {
      video.pause();
      setPaused(true);
    }
  }, [isActive]);

  /* Progress tracking */
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isActive) return;

    const updateProgress = () => {
      if (video.duration) {
        setProgress((video.currentTime / video.duration) * 100);
      }
    };

    video.addEventListener("timeupdate", updateProgress);
    return () => video.removeEventListener("timeupdate", updateProgress);
  }, [isActive]);

  const tapTimeoutRef = useRef(null);

  /* Single tap to mute, double tap to like */
  const handleTap = useCallback((e) => {
    const now = Date.now();
    const x = e.clientX || e.changedTouches?.[0]?.clientX || 0;

    if (now - lastTapRef.current < 300 && Math.abs(x - lastTapXRef.current) < 50) {
      // Double tap → like
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
        tapTimeoutRef.current = null;
      }
      if (!beat.is_liked) {
        onToggleLike(beat.id);
        hapticHeavy();
      }
      setShowHeartOverlay(true);
      setTimeout(() => setShowHeartOverlay(false), 900);
      lastTapRef.current = 0;
    } else {
      // First tap
      lastTapRef.current = now;
      lastTapXRef.current = x;
      
      tapTimeoutRef.current = setTimeout(() => {
        // It's a single tap (no second tap came in time)
        setMuted((m) => {
          const next = !m;
          const video = videoRef.current;
          if (video) video.muted = next;
          
          // Show overlay feedback
          setShowMuteOverlay(true);
          setTimeout(() => setShowMuteOverlay(false), 800);
          hapticLight();
          
          return next;
        });
        tapTimeoutRef.current = null;
      }, 300);
    }
  }, [beat.id, beat.is_liked, onToggleLike]);

  /* Long press to pause */
  const handleTouchStart = useCallback(() => {
    longPressRef.current = setTimeout(() => {
      const video = videoRef.current;
      if (video && isActive) {
        video.pause();
        setPaused(true);
      }
    }, 300);
  }, [isActive]);

  const handleTouchEnd = useCallback(() => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
    if (paused && isActive) {
      const video = videoRef.current;
      if (video) {
        video.play().catch(() => {});
        setPaused(false);
      }
    }
  }, [paused, isActive]);

  return (
    <div
      ref={containerRef}
      className="beat-container snap-start relative select-none w-full flex items-center justify-center bg-black overflow-hidden"
      onClick={handleTap}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleTouchStart}
      onMouseUp={handleTouchEnd}
      onMouseLeave={handleTouchEnd}
      style={{ height: "100dvh" }}
    >
      {/* Video Container */}
      <div className="relative w-full h-full flex items-center justify-center bg-black">
        {/* Video */}
        <AdaptiveMediaRenderer
          ref={videoRef}
          src={beat.video_url}
          type="video"
          aspectRatio={beat.aspect_ratio}
          orientation={beat.orientation}
          isMuted={muted}
          isPlaying={isActive && !paused}
          className="h-full w-full"
        />

        {/* Mute Overlay Feedback */}
        <MuteOverlay isMuted={muted} visible={showMuteOverlay} />

        {/* Dark gradient overlays */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/40 via-transparent to-black/60 z-10" />

        {/* Progress bar at top */}
        <div className="absolute top-0 inset-x-0 h-[3px] z-50" style={{ background: "rgba(255,255,255,0.15)", top: "env(safe-area-inset-top, 0px)" }}>
          <div
            className="h-full transition-all duration-150"
            style={{
              width: `${progress}%`,
              background: "white",
              boxShadow: "0 0 8px rgba(255,255,255,0.5)"
            }}
          />
        </div>

        {/* Top Header Overlay */}
        <div className="absolute top-0 inset-x-0 z-30 flex items-center justify-between p-5" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 20px)" }}>
          <div className="flex items-center gap-2">
            <span
              className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-[0.2em] text-white"
              style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.15)" }}
            >
              Beat
            </span>
          </div>
        </div>

        {/* Heart overlay on double-tap */}
        <AnimatePresence>
          {showHeartOverlay && (
            <motion.div 
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1.2, opacity: 1 }}
              exit={{ scale: 2, opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none z-40"
            >
              <svg
                viewBox="0 0 24 24"
                width="120"
                height="120"
                className="drop-shadow-[0_0_30px_rgba(255,45,85,0.5)]"
                fill="#ff2d55"
              >
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Paused indicator */}
        <AnimatePresence>
          {paused && isActive && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.2 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none z-30"
            >
              <div className="flex items-center justify-center rounded-full bg-black/30 backdrop-blur-xl border border-white/20 shadow-2xl" style={{ width: 80, height: 80 }}>
                <svg viewBox="0 0 24 24" width="36" height="36" fill="white" className="ml-1">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Vertical Action Rail (Right) */}
        <div 
          className="absolute right-3 z-30 flex flex-col items-center gap-6"
          style={{ 
            bottom: "clamp(120px, 15vh, 200px)",
            paddingBottom: "env(safe-area-inset-bottom, 0px)"
          }}
        >
          <BeatActionBar
            beat={beat}
            onToggleLike={onToggleLike}
            onAddStory={() => onAddStory?.({ ...beat, type: "reel" })}
          />
        </div>

        {/* Bottom User/Caption Info (Left) */}
        <div 
          className="absolute bottom-0 left-0 right-16 z-20 p-5 pr-4 flex flex-col gap-4 pointer-events-none"
          style={{ 
            paddingBottom: "calc(var(--bottomnav-h, 0px) + env(safe-area-inset-bottom, 0px) + 24px)"
          }}
        >
          <div className="pointer-events-auto flex flex-col items-start gap-3">
            <Link to={`/profile/${beat.author.id}`} className="flex items-center gap-3">
              <div className="p-0.5 rounded-full border-2 border-[color:var(--accent)] shadow-[0_0_15px_rgba(225,29,72,0.3)]">
                <Avatar src={beat.author.profile_pic} name={beat.author.username} size="sm" className="border border-black/20" />
              </div>
              <span className="text-white text-[15px] font-bold drop-shadow-lg tracking-tight">
                {beat.author.username}
              </span>
              {currentUser && beat.author && String(beat.author.id) !== String(currentUser.id) && (
                <button className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-[11px] font-black uppercase tracking-wider text-white transition-all hover:bg-white/20 active:scale-95 ml-2">
                  {beat.author.is_following ? "Following" : "Follow"}
                </button>
              )}
            </Link>
            
            <div className="w-full">
              {beat.caption && (
                <p className="text-white/95 text-[14px] leading-relaxed line-clamp-3 drop-shadow-md font-medium max-w-[90%]">
                  {beat.caption}
                </p>
              )}
            </div>

            {/* Music Info */}
            <div className="flex items-center gap-2 max-w-[80%]">
              <div className="w-4 h-4 text-white/70 animate-spin-slow">
                 <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
              </div>
              <div className="overflow-hidden">
                <p className="text-white/80 text-[12px] font-semibold animate-marquee whitespace-nowrap">
                   {beat.author.username} • Original Audio
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
