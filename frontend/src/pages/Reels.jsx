import { useEffect, useState } from "react";
import { Clapperboard, Upload } from "lucide-react";

import EmptyState from "../components/EmptyState";
import ReelCard from "../components/ReelCard";
import StoryCreator from "../components/StoryCreator";
import { useAuth } from "../context/AuthContext";
import { getErrorMessage, reelApi, storyApi } from "../services/api";


export default function Reels() {
  const { user } = useAuth();
  const [reels, setReels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [isStoryOpen, setIsStoryOpen] = useState(false);
  const [sharedContent, setSharedContent] = useState(null);

  const autoplayEnabled = user?.settings?.autoplay_reels !== false;

  useEffect(() => {
    const loadReels = async () => {
      setLoading(true);
      try {
        const { data } = await reelApi.feed();
        setReels(data.reels || []);
        setError("");
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };

    loadReels();
  }, []);

  const handleUpload = async (event) => {
    event.preventDefault();
    if (!selectedVideo) {
      setError("Choose a video before uploading a reel.");
      return;
    }

    setUploading(true);
    setError("");

    try {
      const payload = new FormData();
      payload.append("caption", caption);
      payload.append("video", selectedVideo);

      const { data } = await reelApi.upload(payload);
      setReels((current) => [data.reel, ...current]);
      setCaption("");
      setSelectedVideo(null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const handleToggleLike = async (reelId) => {
    const target = reels.find((item) => item.id === reelId);
    if (!target) return;

    const optimistic = !target.is_liked;
    setReels((current) =>
      current.map((item) =>
        item.id === reelId
          ? {
              ...item,
              is_liked: optimistic,
              likes_count: item.likes_count + (optimistic ? 1 : -1),
            }
          : item,
      ),
    );

    try {
      const { data } = await reelApi.toggleLike(reelId);
      setReels((current) =>
        current.map((item) =>
          item.id === reelId
            ? {
                ...item,
                is_liked: data.liked,
                likes_count: data.likes_count,
              }
            : item,
        ),
      );
    } catch (err) {
      setError(getErrorMessage(err));
      setReels((current) =>
        current.map((item) =>
          item.id === reelId
            ? {
                ...item,
                is_liked: target.is_liked,
                likes_count: target.likes_count,
              }
            : item,
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
    }
  };

  return (
    <main className="mx-auto grid max-w-[1440px] gap-6 px-4 py-6 xl:grid-cols-[320px_minmax(0,820px)]">
      <StoryCreator 
        isOpen={isStoryOpen} 
        onClose={() => { setIsStoryOpen(false); setSharedContent(null); }} 
        onPublish={handlePublishStory}
        sharedContent={sharedContent}
      />

      <aside className="space-y-6 xl:sticky xl:top-28 xl:self-start">
        <section className="panel soft-ring px-5 py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgba(142,13,115,0.14)]">
              <Clapperboard size={20} className="text-[color:var(--accent)]" />
            </div>
            <div>
              <p className="font-display text-2xl text-ink">Upload a reel</p>
              <p className="text-sm text-[color:var(--muted)]">
                Short video moments with autoplay and loop.
              </p>
            </div>
          </div>

          <form onSubmit={handleUpload} className="mt-6 space-y-4">
            <textarea
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              className="field min-h-[120px] resize-none"
              placeholder="Add a short caption for the reel"
              maxLength={500}
            />

            <label className="flex cursor-pointer items-center justify-between rounded-[24px] border border-dashed border-[color:var(--line)] bg-white/70 px-4 py-4 transition hover:bg-white">
              <div>
                <p className="text-sm font-medium text-ink">Video file</p>
                <p className="text-xs text-[color:var(--muted)]">
                  {selectedVideo ? selectedVideo.name : "Most common formats supported, up to 3 minutes"}
                </p>
              </div>
              <span className="ghost-button gap-2">
                <Upload size={16} />
                Select
              </span>
              <input
                type="file"
                accept="video/*,.mp4,.mov,.m4v,.webm,.mkv,.avi,.mpeg,.mpg,.3gp,.ogv"
                className="hidden"
                onChange={(event) => setSelectedVideo(event.target.files?.[0] || null)}
              />
            </label>

            <button type="submit" disabled={uploading} className="accent-button w-full">
              {uploading ? "Uploading reel..." : "Publish reel"}
            </button>
          </form>
        </section>

        <section className="panel soft-ring px-5 py-6">
          <p className="font-display text-2xl text-ink">How it works</p>
          <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
            Reels are compressed with ffmpeg, checked for a 3-minute limit, and can go up to your server upload size settings.
          </p>
          <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
            {autoplayEnabled ? "Autoplay is on right now." : "Autoplay is off in Settings, so tap a reel to play it."}
          </p>
        </section>
      </aside>

      <section className="space-y-6">
        {error ? (
          <div className="rounded-[24px] bg-red-50 px-5 py-4 text-sm text-red-500">{error}</div>
        ) : null}

        {loading ? (
          <div className="panel soft-ring px-6 py-12 text-center">
            <p className="font-display text-2xl text-ink">Loading reels</p>
            <p className="mt-2 text-sm text-[color:var(--muted)]">
              Pulling in the latest short-form video feed.
            </p>
          </div>
        ) : null}

        {!loading && reels.length === 0 ? (
          <EmptyState
            title="No reels yet"
            description="Upload the first reel to activate the vertical video feed."
          />
        ) : null}

        {!loading && reels.length > 0 ? (
            <div className="h-[calc(100vh-8rem)] snap-y snap-mandatory space-y-5 overflow-y-auto pr-1">
              {reels.map((reel) => (
                <ReelCard
                  key={reel.id}
                  reel={reel}
                  onToggleLike={handleToggleLike}
                  onAddStory={handleAddStory}
                  autoplayEnabled={autoplayEnabled}
                />
              ))}
            </div>
          ) : null}
      </section>
    </main>
  );
}
