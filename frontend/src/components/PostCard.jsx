import { useRef, useState, useEffect } from "react";
import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal, BadgeCheck, Volume2, VolumeX, Repeat } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import Avatar from "./Avatar";
import ShareSheet from "./ShareSheet";
import { hapticMedium, hapticLight } from "../utils/capacitor";
import { socialApi, postApi } from "../services/api";
import { useVideoAutoplay } from "../hooks/useVideoAutoplay";
import AdaptiveMediaRenderer from "./AdaptiveMediaRenderer";


export default function PostCard({ post, onToggleLike, onAddComment, onDeleteComment, onAddStory, currentUser }) {
  const navigate = useNavigate();
  const [showHeartOverlay, setShowHeartOverlay] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [showComments, setShowComments] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(post.is_saved || false);
  const [isMuted, setIsMuted] = useState(post.is_muted !== false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const lastTapRef = useRef(0);
  
  const { containerRef, isActive } = useVideoAutoplay(`post-${post.id}`, 0.6);

  useEffect(() => {
    if (!containerRef.current) return;
    
    const videos = containerRef.current.querySelectorAll("video");
    const audios = containerRef.current.querySelectorAll("audio");

    if (isActive) {
      videos.forEach(v => v.play().catch(() => {}));
      audios.forEach(a => a.play().catch(() => {}));
    } else {
      videos.forEach(v => v.pause());
      audios.forEach(a => a.pause());
    }
  }, [isActive]);

  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      if (!post.is_liked) {
        onToggleLike(post.id);
        hapticMedium();
      }
      setShowHeartOverlay(true);
      setTimeout(() => setShowHeartOverlay(false), 800);
    }
    lastTapRef.current = now;
  };

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    if (!commentDraft.trim() || submitting) return;
    setSubmitting(true);
    const success = await onAddComment(post.id, commentDraft.trim());
    if (success) setCommentDraft("");
    setSubmitting(false);
  };

  const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "now";
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d`;
    return `${Math.floor(days / 7)}w`;
  };

  const [carouselIndex, setCarouselIndex] = useState(0);
  const carouselRef = useRef(null);

  const handleCarouselScroll = () => {
    const el = carouselRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / el.offsetWidth);
    setCarouselIndex(idx);
  };

  const carouselItems = post.is_carousel ? post.carousel_images : null;

  const renderMedia = (src, type, alt = "") => {
    return (
      <AdaptiveMediaRenderer
        src={src}
        type={type}
        alt={alt}
        aspectRatio={post.aspect_ratio}
        orientation={post.orientation}
        isMuted={isMuted}
        isPlaying={isActive}
        containerClassName="aspect-auto max-h-[85vh]"
      />
    );
  };

  const hasAudio = post.media_type === "video" || post.has_audio || post.music;

  return (
    <article ref={containerRef} className="w-full max-w-[470px] mx-auto bg-[color:var(--bg)] sm:bg-[color:var(--bg-card)] sm:border sm:border-[color:var(--border)] sm:rounded-[8px] mb-4 sm:mb-8 overflow-hidden">
      <ShareSheet
        open={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        contentType="post"
        contentId={post.id}
        title={post.caption}
        onAddStory={() => onAddStory?.({ ...post, type: "post" })}
      />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[color:var(--border)] sm:border-none">
        <Link to={`/profile/${post.author.id}`} className="flex items-center gap-3">
          <Avatar src={post.author.profile_pic} name={post.author.username} size="sm" />
          <div>
            <div className="flex items-center gap-1">
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                {post.author.username}
              </p>
              {post.author.is_verified && <BadgeCheck size={14} className="text-blue-500" />}
            </div>
            {post.author.location ? (
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{post.author.location}</p>
            ) : null}
          </div>
        </Link>
        <button type="button" className="btn-icon" style={{ width: 32, height: 32, background: "transparent" }}>
          <MoreHorizontal size={20} />
        </button>
      </div>

      {/* Media - double-tap to like */}
      <div 
        className="relative select-none w-full bg-black/5 min-h-[300px]" 
        onClick={handleDoubleTap}
      >
        {carouselItems ? (
          /* Carousel mode */
          <>
            <div
              ref={carouselRef}
              className="flex w-full overflow-x-auto snap-x snap-mandatory"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              onScroll={handleCarouselScroll}
            >
              {carouselItems.map((item, idx) => (
                <div key={item.id || idx} className="w-full flex-shrink-0 snap-center flex items-center justify-center">
                  {renderMedia(item.image_url, item.media_type, `Slide ${idx + 1}`)}
                </div>
              ))}
            </div>
            {/* Dot indicators */}
            {carouselItems.length > 1 && (
              <div className="absolute bottom-3 inset-x-0 flex items-center justify-center gap-1.5 z-10">
                {carouselItems.map((_, idx) => (
                  <div
                    key={idx}
                    className="rounded-full transition-all duration-200"
                    style={{
                      width: idx === carouselIndex ? 7 : 5,
                      height: idx === carouselIndex ? 7 : 5,
                      background: idx === carouselIndex ? "var(--accent)" : "rgba(255,255,255,0.5)",
                    }}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          /* Single media mode */
          <div className="flex items-center justify-center">
            {renderMedia(post.image_url, post.media_type, post.caption || "Post")}
          </div>
        )}

        {/* Mute Button Overlay */}
        {hasAudio && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsMuted(!isMuted);
              hapticLight();
            }}
            className="absolute bottom-3 right-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-all hover:bg-black/60 active:scale-90"
          >
            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
        )}

        {/* Heart overlay on double-tap */}
        {showHeartOverlay && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <Heart
              size={80}
              fill="white"
              className="text-white heart-burst-overlay drop-shadow-2xl"
            />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => {
              onToggleLike(post.id);
              if (!post.is_liked) hapticMedium();
            }}
            className="transition-transform duration-200 active:scale-75"
          >
            <Heart
              size={24}
              strokeWidth={1.8}
              fill={post.is_liked ? "#e11d48" : "none"}
              className={post.is_liked ? "text-[#e11d48]" : ""}
            />
          </button>
          <button
            type="button"
            onClick={() => setShowComments(!showComments)}
            className="transition-transform duration-200 active:scale-75"
          >
            <MessageCircle size={24} strokeWidth={1.8} />
          </button>
          <button 
            type="button" 
            onClick={() => { setIsShareOpen(true); hapticLight(); }}
            className="transition-transform duration-200 active:scale-75"
          >
            <Send size={22} strokeWidth={1.8} />
          </button>
          <button 
            type="button" 
            onClick={async () => {
              hapticMedium();
              try {
                await postApi.toggleRepost(post.id);
              } catch (err) { console.error(err); }
            }}
            className="transition-transform duration-200 active:scale-75"
          >
            <Repeat size={22} strokeWidth={1.8} />
          </button>
        </div>
        <button 
          type="button" 
          onClick={async () => {
            hapticLight();
            const prev = saved;
            setSaved(!prev);
            try {
              const { data } = await socialApi.toggleSave(post.id);
              setSaved(data.saved);
            } catch { setSaved(prev); }
          }}
          className="transition-transform duration-200 active:scale-75"
        >
          <Bookmark size={24} strokeWidth={1.8} fill={saved ? "var(--text-primary)" : "none"} />
        </button>
      </div>

      {/* Likes count */}
      <div className="px-4">
        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {post.likes_count.toLocaleString()} {post.likes_count === 1 ? "like" : "likes"}
        </p>
      </div>

      {/* Caption */}
      {post.caption ? (
        <div className="px-4 mt-1">
          <p className="text-sm" style={{ color: "var(--text-primary)" }}>
            <Link
              to={`/profile/${post.author.id}`}
              className="font-semibold mr-1.5"
            >
              {post.author.username}
            </Link>
            <span style={{ color: "var(--text-secondary)" }}>{post.caption}</span>
          </p>
        </div>
      ) : null}

      {/* Comment preview */}
      {post.comments_count > 0 && !showComments ? (
        <button
          type="button"
          onClick={() => setShowComments(true)}
          className="px-4 mt-1 text-sm"
          style={{ color: "var(--text-muted)" }}
        >
          View all {post.comments_count} comments
        </button>
      ) : null}

      {/* Comments expanded */}
      {showComments && post.comments?.length > 0 ? (
        <div className="px-4 mt-2 space-y-1.5">
          {post.comments.map((comment) => (
            <div key={comment.id} className="flex items-start gap-2 group">
              <div className="flex-1 text-sm">
                <Link
                  to={`/profile/${comment.user_id}`}
                  className="font-semibold mr-1.5"
                  style={{ color: "var(--text-primary)" }}
                >
                  {comment.username}
                </Link>
                <span style={{ color: "var(--text-secondary)" }}>{comment.content}</span>
              </div>
              {comment.user_id === currentUser?.id && (
                <button
                  type="button"
                  onClick={() => onDeleteComment(post.id, comment.id)}
                  className="text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: "var(--text-muted)" }}
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      ) : null}

      {/* Timestamp */}
      <p className="px-4 mt-1 pb-3 text-[11px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
        {timeAgo(post.created_at)}
      </p>

      {/* Comment input */}
      <form
        onSubmit={handleSubmitComment}
        className="flex items-center gap-3 px-4 py-2.5 border-t border-[color:var(--border)]"
      >
        <Avatar src={currentUser?.profile_pic} name={currentUser?.username} size="xs" />
        <input
          value={commentDraft}
          onChange={(e) => setCommentDraft(e.target.value)}
          placeholder="Add a comment…"
          className="flex-1 bg-transparent text-sm outline-none"
          style={{ color: "var(--text-primary)" }}
          maxLength={280}
        />
        {commentDraft.trim() ? (
          <button
            type="submit"
            disabled={submitting}
            className="text-sm font-semibold transition-opacity"
            style={{ color: "var(--accent)" }}
          >
            Post
          </button>
        ) : null}
      </form>
    </article>
  );
}
