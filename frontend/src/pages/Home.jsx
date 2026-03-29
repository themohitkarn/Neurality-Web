import { useEffect, useRef, useState } from "react";
import { RefreshCcw } from "lucide-react";

import FeedNotes from "../components/FeedNotes";
import FeedStream from "../components/FeedStream";
import PostComposer from "../components/PostComposer";
import ProfileStatsPanel from "../components/ProfileStatsPanel";
import RecommendedPosts from "../components/RecommendedPosts";
import StoryBar from "../components/StoryBar";
import StorySidePanel from "../components/StorySidePanel";
import StoryViewer from "../components/StoryViewer";
import { useAuth } from "../context/AuthContext";
import { aiApi, commentApi, getErrorMessage, postApi, storyApi } from "../services/api";


export default function Home() {
  const { user, setUser } = useAuth();
  const [posts, setPosts] = useState([]);
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasNext, setHasNext] = useState(false);
  const [error, setError] = useState("");
  const [caption, setCaption] = useState("");
  const [captionPrompt, setCaptionPrompt] = useState("");
  const [captionIdeas, setCaptionIdeas] = useState([]);
  const [captionHashtags, setCaptionHashtags] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [posting, setPosting] = useState(false);
  const [creatingStory, setCreatingStory] = useState(false);
  const [generatingCaptions, setGeneratingCaptions] = useState(false);
  const [recommendedPosts, setRecommendedPosts] = useState([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [activeStoryGroup, setActiveStoryGroup] = useState(null);

  const sentinelRef = useRef(null);
  const nextPageRef = useRef(2);

  const fetchStories = async () => {
    try {
      const { data } = await storyApi.feed();
      setStories(data.stories || []);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const fetchFeed = async (pageNumber = 1, replace = false) => {
    if (pageNumber === 1) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const { data } = await postApi.feed(pageNumber);
      setPosts((current) => {
        if (replace) {
          return data.posts;
        }

        const existingIds = new Set(current.map((item) => item.id));
        return [...current, ...data.posts.filter((item) => !existingIds.has(item.id))];
      });
      setHasNext(Boolean(data.has_next));
      nextPageRef.current = pageNumber + 1;
      setError("");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const fetchRecommendations = async () => {
    setLoadingRecommendations(true);
    try {
      const { data } = await postApi.recommended();
      setRecommendedPosts(data.posts || []);
    } catch (_err) {
      setRecommendedPosts([]);
    } finally {
      setLoadingRecommendations(false);
    }
  };

  const refreshWorkspace = async () => {
    await Promise.all([fetchFeed(1, true), fetchStories(), fetchRecommendations()]);
  };

  useEffect(() => {
    refreshWorkspace();
  }, []);

  useEffect(() => {
    if (!sentinelRef.current || !hasNext) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && !loading && !loadingMore) {
          fetchFeed(nextPageRef.current, false);
        }
      },
      { threshold: 0.2 },
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasNext, loading, loadingMore]);

  const handleCreatePost = async (event) => {
    event.preventDefault();
    if (!selectedFile) {
      setError("Choose an image before dropping.");
      return;
    }

    setPosting(true);
    setError("");

    try {
      const payload = new FormData();
      payload.append("caption", caption);
      payload.append("image", selectedFile);

      const { data } = await postApi.create(payload);
      setPosts((current) => [data.post, ...current]);
      setCaption("");
      setCaptionPrompt("");
      setCaptionIdeas([]);
      setCaptionHashtags([]);
      setSelectedFile(null);
      setUser((current) =>
        current
          ? {
              ...current,
              posts_count: (current.posts_count || 0) + 1,
            }
          : current,
      );
      fetchRecommendations();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setPosting(false);
    }
  };

  const handleCreateStory = async (file) => {
    setCreatingStory(true);
    setError("");

    try {
      const payload = new FormData();
      payload.append("image", file);
      await storyApi.create(payload);
      await fetchStories();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setCreatingStory(false);
    }
  };

  const handleGenerateCaptions = async () => {
    if (!captionPrompt.trim() && !selectedFile) {
      setError("Add a short prompt or choose an image before generating AI captions.");
      return;
    }

    setGeneratingCaptions(true);
    setError("");

    try {
      const payload = new FormData();
      if (captionPrompt.trim()) {
        payload.append("prompt", captionPrompt.trim());
      }
      if (selectedFile) {
        payload.append("image", selectedFile);
      }

      const { data } = await aiApi.generateCaption(payload);
      setCaptionIdeas(data.captions || []);
      setCaptionHashtags(data.hashtags || []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setGeneratingCaptions(false);
    }
  };

  const handleToggleLike = async (postId) => {
    const target = posts.find((post) => post.id === postId);
    if (!target) {
      return;
    }

    const optimistic = !target.is_liked;
    setPosts((current) =>
      current.map((post) =>
        post.id === postId
          ? {
              ...post,
              is_liked: optimistic,
              likes_count: post.likes_count + (optimistic ? 1 : -1),
            }
          : post,
      ),
    );

    try {
      const { data } = await postApi.toggleLike(postId);
      setPosts((current) =>
        current.map((post) =>
          post.id === postId
            ? {
                ...post,
                is_liked: data.liked,
                likes_count: data.likes_count,
              }
            : post,
        ),
      );
      fetchRecommendations();
    } catch (err) {
      setError(getErrorMessage(err));
      setPosts((current) =>
        current.map((post) =>
          post.id === postId
            ? {
                ...post,
                is_liked: target.is_liked,
                likes_count: target.likes_count,
              }
            : post,
        ),
      );
    }
  };

  const handleAddComment = async (postId, content) => {
    try {
      const { data } = await commentApi.add({ post_id: postId, content });
      setPosts((current) =>
        current.map((post) =>
          post.id === postId
            ? {
                ...post,
                comments: [...post.comments, data.comment],
                comments_count: post.comments_count + 1,
              }
            : post,
        ),
      );
      fetchRecommendations();
      return true;
    } catch (err) {
      setError(getErrorMessage(err));
      return false;
    }
  };

  const handleDeleteComment = async (postId, commentId) => {
    try {
      await commentApi.remove(commentId);
      setPosts((current) =>
        current.map((post) =>
          post.id === postId
            ? {
                ...post,
                comments: post.comments.filter((comment) => comment.id !== commentId),
                comments_count: Math.max(post.comments_count - 1, 0),
              }
            : post,
        ),
      );
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const composerProps = {
    caption,
    setCaption,
    captionPrompt,
    setCaptionPrompt,
    captionIdeas,
    captionHashtags,
    selectedFile,
    setSelectedFile,
    generatingCaptions,
    posting,
    onGenerateCaptions: handleGenerateCaptions,
    onApplyCaptionSuggestion: setCaption,
    onAppendHashtags: () => {
      const hashtagLine = captionHashtags.join(" ");
      if (!hashtagLine) {
        return;
      }

      setCaption((current) => {
        if (current.includes(hashtagLine)) {
          return current;
        }
        return current.trim() ? `${current.trim()}\n\n${hashtagLine}` : hashtagLine;
      });
    },
    onSubmit: handleCreatePost,
  };

  const feedProps = {
    loading,
    posts,
    loadingMore,
    hasNext,
    sentinelRef,
    onToggleLike: handleToggleLike,
    onAddComment: handleAddComment,
    onDeleteComment: handleDeleteComment,
  };

  return (
    <>
      <main className="mx-auto max-w-[1440px] px-4 py-4 lg:py-6">
        <section className="space-y-5 lg:hidden">
          <div className="panel soft-ring overflow-hidden px-5 py-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-[color:var(--accent)]">
                  Mobile stream
                </p>
                <p className="mt-2 font-display text-3xl text-ink">Today&apos;s flow</p>
                <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                  Fast drops, story updates, and recommendations tuned for the phone experience.
                </p>
              </div>
              <button type="button" onClick={refreshWorkspace} className="ghost-button gap-2">
                <RefreshCcw size={16} />
                Refresh
              </button>
            </div>
          </div>

          <StoryBar
            stories={stories}
            onCreateStory={handleCreateStory}
            creatingStory={creatingStory}
            onOpenStory={setActiveStoryGroup}
          />

          <ProfileStatsPanel user={user} compact />

          {error ? (
            <div className="rounded-[24px] bg-red-50 px-5 py-4 text-sm text-red-500">{error}</div>
          ) : null}

          <PostComposer {...composerProps} compact />
          <RecommendedPosts posts={recommendedPosts} loading={loadingRecommendations} />
          <section className="space-y-5">
            <FeedStream {...feedProps} />
          </section>
        </section>

        <section className="hidden gap-6 lg:grid xl:grid-cols-[360px_minmax(0,1fr)_320px]">
          <aside className="space-y-6 xl:sticky xl:top-28 xl:self-start">
            <PostComposer {...composerProps} />
            <ProfileStatsPanel user={user} />
          </aside>

          <section className="space-y-6">
            <StoryBar
              stories={stories}
              onCreateStory={handleCreateStory}
              creatingStory={creatingStory}
              onOpenStory={setActiveStoryGroup}
            />

            {error ? (
              <div className="rounded-[24px] bg-red-50 px-5 py-4 text-sm text-red-500">{error}</div>
            ) : null}

            <FeedStream {...feedProps} />
          </section>

          <aside className="space-y-6 xl:sticky xl:top-28 xl:self-start">
            <StorySidePanel
              stories={stories}
              onCreateStory={handleCreateStory}
              creatingStory={creatingStory}
              onOpenStory={setActiveStoryGroup}
            />
            <RecommendedPosts posts={recommendedPosts} loading={loadingRecommendations} />
            <FeedNotes postsCount={posts.length} storiesCount={stories.length} onRefresh={refreshWorkspace} />
          </aside>
        </section>
      </main>

      <StoryViewer
        group={activeStoryGroup}
        open={Boolean(activeStoryGroup)}
        onClose={() => setActiveStoryGroup(null)}
      />
    </>
  );
}
