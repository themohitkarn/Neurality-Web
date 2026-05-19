import { useState, useCallback, useEffect, useRef } from "react";
import { Plus } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import BeatPlayer from "../components/BeatPlayer";
import BeatCreator from "../components/BeatCreator";
import StoryCreator from "../components/StoryCreator";
import { SkeletonLine } from "../components/SkeletonLoader";
import { useAuth } from "../context/AuthContext";
import { getErrorMessage, reelApi, storyApi } from "../services/api";


export default function Beat() {
  const { user } = useAuth();
  const [beats, setBeats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isCreatorOpen, setIsCreatorOpen] = useState(false);
  const [isStoryOpen, setIsStoryOpen] = useState(false);
  const [sharedContent, setSharedContent] = useState(null);
  const [searchParams] = useSearchParams();
  const containerRef = useRef(null);

  const fetchBeats = useCallback(async (pageNum = 1, append = false) => {
    if (pageNum === 1) setLoading(true);
    try {
      const sharedId = searchParams.get("id");
      const { data } = await reelApi.feed(pageNum, 6);
      let newBeats = data.reels || [];

      // If we have a sharedId and we're on the first page, ensure it's at the top
      if (pageNum === 1 && sharedId) {
        const sharedBeat = newBeats.find(b => b.id.toString() === sharedId);
        if (sharedBeat) {
          newBeats = [sharedBeat, ...newBeats.filter(b => b.id.toString() !== sharedId)];
        } else {
          // If not in first page, fetch it specifically
          try {
            const { data: specificData } = await reelApi.get(sharedId);
            if (specificData.reel) {
              newBeats = [specificData.reel, ...newBeats];
            }
          } catch (e) { console.error("Shared reel not found", e); }
        }
      }

      setBeats((current) => {
        if (!append) return newBeats;
        const ids = new Set(current.map((b) => b.id));
        return [...current, ...newBeats.filter((b) => !ids.has(b.id))];
      });
      setHasMore(newBeats.length >= 6);
      setError("");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const handleBeatPublished = (newBeat) => {
    setBeats((current) => [newBeat, ...current]);
    setActiveIndex(0);
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  };

  useEffect(() => {
    fetchBeats(1);
  }, [fetchBeats]);

  /* Load more when near the end */
  useEffect(() => {
    if (beats.length > 0 && hasMore && !loading) {
      const el = containerRef.current;
      if (!el) return;
      const handleScroll = () => {
        if (el.scrollHeight - el.scrollTop <= el.clientHeight * 2) {
          const nextPage = page + 1;
          setPage(nextPage);
          fetchBeats(nextPage, true);
        }
      };
      el.addEventListener('scroll', handleScroll);
      return () => el.removeEventListener('scroll', handleScroll);
    }
  }, [beats.length, hasMore, loading, page, fetchBeats]);

  const handleDeleteBeat = async (beatId) => {
    const target = beats.find((b) => b.id === beatId);
    if (!target) return;

    // Optimistic removal
    setBeats((current) => current.filter((b) => b.id !== beatId));
    
    try {
      await reelApi.delete(beatId);
      // Success - already removed optimistically
    } catch (err) {
      setError(getErrorMessage(err));
      // Revert if failed
      setBeats((current) => [target, ...current].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
    }
  };

  const handleHideBeat = (beatId) => {
    setBeats((current) => current.filter((b) => b.id !== beatId));
  };

  const handleBlockUser = (authorId) => {
    setBeats((current) => current.filter((b) => b.author.id !== authorId));
  };

  const handleToggleLike = async (beatId) => {
    const target = beats.find((b) => b.id === beatId);
    if (!target) return;
    const optimistic = !target.is_liked;
    setBeats((current) =>
      current.map((b) =>
        b.id === beatId
          ? { ...b, is_liked: optimistic, likes_count: b.likes_count + (optimistic ? 1 : -1) }
          : b,
      ),
    );
    try {
      const { data } = await reelApi.toggleLike(beatId);
      setBeats((current) =>
        current.map((b) =>
          b.id === beatId ? { ...b, is_liked: data.liked, likes_count: data.likes_count } : b,
        ),
      );
    } catch (err) {
      setError(getErrorMessage(err));
      setBeats((current) =>
        current.map((b) =>
          b.id === beatId ? { ...b, is_liked: target.is_liked, likes_count: target.likes_count } : b,
        ),
      );
    }
  };

  const handleAddStory = (content) => {
    setSharedContent(content);
    setIsStoryOpen(true);
  };

  const handlePublishStory = async (formData) => {
    try {
      await storyApi.create(formData);
    } catch (err) {
      console.error(err);
      alert("Failed to publish story");
    } finally {
      setIsStoryOpen(false);
      setSharedContent(null);
    }
  };

  if (loading && beats.length === 0) {
    return (
      <div
        className="beat-container flex flex-col items-center justify-center gap-4"
        style={{ background: "#000" }}
      >
        <div
          className="h-8 w-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }}
        />
        <p className="text-sm text-white/60">Loading beats…</p>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full bg-black">
      <StoryCreator 
        isOpen={isStoryOpen} 
        onClose={() => { setIsStoryOpen(false); setSharedContent(null); }} 
        onPublish={handlePublishStory}
        sharedContent={sharedContent}
      />

      {/* Create Beat Button */}
      <div className="absolute top-4 right-4 z-50">
        <button
          onClick={() => setIsCreatorOpen(true)}
          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-white backdrop-blur-md transition-all hover:bg-white/20 active:scale-95"
        >
          <Plus size={24} />
        </button>
      </div>

      <div
        ref={containerRef}
        className="beat-container mx-auto snap-y snap-mandatory overflow-y-auto overscroll-contain"
        style={{
          background: "#000",
          scrollSnapType: "y mandatory",
          WebkitOverflowScrolling: "touch",
          maxWidth: "480px", 
          borderLeft: "1px solid var(--border)",
          borderRight: "1px solid var(--border)",
        }}
      >
        {beats.length === 0 && !loading && (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
            <p className="text-lg font-semibold text-white">No beats yet</p>
            <p className="text-sm text-white/50">Upload the first video to start the Beats feed.</p>
            <button
              onClick={() => setIsCreatorOpen(true)}
              className="mt-4 rounded-full bg-[color:var(--accent)] px-8 py-2 text-sm font-bold text-white transition-transform active:scale-95"
            >
              Upload Now
            </button>
          </div>
        )}

        {beats.map((beat, index) => (
          <BeatPlayer
            key={beat.id}
            beat={beat}
            index={index}
            nextReel={beats[index + 1]}
            onToggleLike={handleToggleLike}
            onAddStory={handleAddStory}
            onDeleteBeat={handleDeleteBeat}
            onHideBeat={handleHideBeat}
            onBlockUser={handleBlockUser}
            currentUser={user}
          />
        ))}

        {/* Loading more indicator */}
        {hasMore ? (
          <div className="beat-container snap-start flex items-center justify-center">
            <div
              className="h-6 w-6 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: "white", borderTopColor: "transparent" }}
            />
          </div>
        ) : null}
      </div>

      <BeatCreator
        isOpen={isCreatorOpen}
        onClose={() => setIsCreatorOpen(false)}
        onPublished={handleBeatPublished}
      />
    </div>
  );
}
