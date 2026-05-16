import { useEffect, useRef, useState } from "react";
import { BadgeCheck, Music } from "lucide-react";
import { Link } from "react-router-dom";

import Avatar from "./Avatar";
import BeatActionBar from "./BeatActionBar";
import { useVideoAutoplay } from "../hooks/useVideoAutoplay";

export default function ReelCard({ reel, onToggleLike, onAddStory, autoplayEnabled = true }) {
  const videoRef = useRef(null);
  const [isMuted, setIsMuted] = useState(false);
  const [manualPlaying, setManualPlaying] = useState(false);

  const { containerRef, isActive } = useVideoAutoplay(`reel-${reel.id}`, 0.65);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if ((autoplayEnabled && isActive) || manualPlaying) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [autoplayEnabled, isActive, manualPlaying]);

  return (
    <article
      ref={containerRef}
      className="relative h-full w-full mx-auto snap-start overflow-hidden bg-black flex items-center justify-center"
    >
      <video
        ref={videoRef}
        src={reel.video_url}
        poster={reel.thumbnail_url}
        className="h-full w-full object-contain"
        loop
        muted={isMuted}
        playsInline
        onClick={() => {
          if (!autoplayEnabled) {
            setManualPlaying((current) => !current);
          } else {
            setIsMuted(!isMuted);
          }
        }}
      />

      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60 pointer-events-none" />

      {/* Content Info (Bottom Left) */}
      <div className="absolute left-4 bottom-8 right-16 flex flex-col gap-3 pointer-events-none">
        <div className="flex items-center gap-3 pointer-events-auto">
          <Link to={`/profile/${reel.author.id}`}>
            <Avatar src={reel.author.profile_pic} name={reel.author.username} size="sm" className="ring-2 ring-white/20" />
          </Link>
          <div className="flex flex-col">
            <div className="flex items-center gap-1">
              <span className="text-sm font-bold text-white">{reel.author.username}</span>
              {reel.author.is_verified && <BadgeCheck size={14} className="text-blue-500" fill="currentColor" />}
            </div>
            <p className="text-[10px] text-white/60 uppercase tracking-widest font-black">Original Audio</p>
          </div>
          <button className="px-3 py-1 rounded-full border border-white/30 text-[11px] font-bold text-white hover:bg-white/10 transition-colors">
            Follow
          </button>
        </div>

        <div className="flex flex-col gap-1 pr-4">
          <p className="text-[13px] text-white leading-relaxed line-clamp-2">
            {reel.caption || "No caption added."}
          </p>
          {reel.music && (
            <div className="flex items-center gap-2 mt-1">
              <Music size={12} className="text-white/80" />
              <span className="text-[11px] text-white/80 font-medium">{reel.music.artist} • {reel.music.title}</span>
            </div>
          )}
        </div>
      </div>

      {/* Action Bar (Bottom Right) */}
      <div className="absolute right-4 bottom-8 pointer-events-auto">
        <BeatActionBar 
          beat={reel} 
          onToggleLike={onToggleLike} 
          onAddStory={() => onAddStory?.({ ...reel, type: "reel" })}
        />
      </div>
    </article>
  );
}
