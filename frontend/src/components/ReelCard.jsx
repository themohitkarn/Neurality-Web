import { useEffect, useRef, useState } from "react";
import { Heart, Play } from "lucide-react";
import { Link } from "react-router-dom";

import Avatar from "./Avatar";


export default function ReelCard({ reel, onToggleLike, autoplayEnabled = true }) {
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [liking, setLiking] = useState(false);
  const [manualPlaying, setManualPlaying] = useState(false);

  useEffect(() => {
    if (!containerRef.current) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        setVisible(entry.isIntersecting && entry.intersectionRatio >= 0.65);
      },
      {
        threshold: [0.35, 0.65, 0.85],
      },
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    if ((autoplayEnabled && visible) || manualPlaying) {
      const playPromise = video.play();
      if (playPromise?.catch) {
        playPromise.catch(() => undefined);
      }
      return;
    }

    video.pause();
  }, [autoplayEnabled, manualPlaying, visible]);

  const handleLike = async () => {
    setLiking(true);
    await onToggleLike(reel.id);
    setLiking(false);
  };

  return (
    <article
      ref={containerRef}
      className="relative h-[calc(100vh-8.5rem)] snap-start overflow-hidden rounded-[32px] bg-[#120d15] shadow-[0_28px_80px_rgba(18,12,20,0.24)]"
    >
      <video
        ref={videoRef}
        src={reel.video_url}
        poster={reel.thumbnail_url}
        className="h-full w-full object-cover"
        loop
        muted
        playsInline
        onClick={() => {
          if (!autoplayEnabled) {
            setManualPlaying((current) => !current);
          }
        }}
      />

      <div className="absolute inset-0 bg-gradient-to-t from-[rgba(12,10,14,0.82)] via-[rgba(12,10,14,0.12)] to-transparent" />

      <div className="absolute left-5 top-5 rounded-full bg-white/14 px-3 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-white backdrop-blur-md">
        Reels
      </div>

      <div className="absolute right-5 top-5 rounded-full bg-white/14 px-3 py-2 text-xs font-semibold text-white backdrop-blur-md">
        {autoplayEnabled ? (visible ? "Playing" : "Queued") : manualPlaying ? "Playing" : "Tap to play"}
      </div>

      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-5 p-5 sm:p-6">
        <div className="max-w-xl">
          <Link to={`/profile/${reel.author.id}`} className="flex items-center gap-3">
            <Avatar src={reel.author.profile_pic} name={reel.author.username} size="md" />
            <div className="text-white">
              <p className="font-semibold">{reel.author.username}</p>
              <p className="text-xs uppercase tracking-[0.24em] text-white/70">Video moment</p>
            </div>
          </Link>

          <p className="mt-4 text-sm leading-7 text-white/88">
            {reel.caption || "No caption added for this reel yet."}
          </p>
        </div>

        <div className="flex flex-col items-center gap-3 text-white">
          <button
            type="button"
            onClick={handleLike}
            disabled={liking}
            className={`flex h-14 w-14 items-center justify-center rounded-full backdrop-blur-md transition ${
              reel.is_liked ? "bg-[rgba(142,13,115,0.88)]" : "bg-white/14 hover:bg-white/22"
            }`}
          >
            <Heart size={18} fill={reel.is_liked ? "currentColor" : "none"} />
          </button>
          <span className="text-xs font-semibold">{reel.likes_count}</span>
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/14 backdrop-blur-md">
            <Play size={16} className="translate-x-[1px]" />
          </div>
        </div>
      </div>
    </article>
  );
}
