import { useEffect, useRef, useState } from "react";

import { Link } from "react-router-dom";

import Avatar from "../components/Avatar";
import PostCard from "../components/PostCard";
import PullToRefresh from "../components/PullToRefresh";
import { SkeletonPostCard, SkeletonStoryBar } from "../components/SkeletonLoader";
import StoryBar from "../components/StoryBar";
import StoryCreator from "../components/StoryCreator";
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
  const [creatingStory, setCreatingStory] = useState(false);
  const [activeStoryGroup, setActiveStoryGroup] = useState(null);
  const [isCreatorOpen, setIsCreatorOpen] = useState(false);
  const [sharedContent, setSharedContent] = useState(null);

  const sentinelRef = useRef(null);
  const nextPageRef = useRef(2);

  const fetchStories = async () => {
    try {
      const { data } = await storyApi.feed();
      setStories(data.stories || []);
    } catch (err) {
      console.error("Stories fetch error:", err);
    }
  };

  const handlePublishStory = async (formData) => {
    setCreatingStory(true);
    try {
      await storyApi.create(formData);
      await fetchStories();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setCreatingStory(false);
      setIsCreatorOpen(false);
      setSharedContent(null);
    }
  };

  const handleAddStory = (content) => {
    setSharedContent(content);
    setIsCreatorOpen(true);
  };

  const fetchFeed = async (pageNumber = 1, replace = false) => {
    if (pageNumber === 1) setLoading(true);
    else setLoadingMore(true);

    try {
      const { data } = await postApi.feed(pageNumber);
      setPosts((current) => {
        if (replace) return data.posts;
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

  const refreshAll = async () => {
    await Promise.all([fetchFeed(1, true), fetchStories()]);
  };

  useEffect(() => {
    refreshAll();
  }, []);

  /* Infinite scroll */
  useEffect(() => {
    if (!sentinelRef.current || !hasNext) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading && !loadingMore) {
          fetchFeed(nextPageRef.current, false);
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasNext, loading, loadingMore]);



  const handleToggleLike = async (postId) => {
    const target = posts.find((p) => p.id === postId);
    if (!target) return;
    const optimistic = !target.is_liked;
    setPosts((current) =>
      current.map((p) =>
        p.id === postId
          ? { ...p, is_liked: optimistic, likes_count: p.likes_count + (optimistic ? 1 : -1) }
          : p,
      ),
    );
    try {
      const { data } = await postApi.toggleLike(postId);
      setPosts((current) =>
        current.map((p) =>
          p.id === postId ? { ...p, is_liked: data.liked, likes_count: data.likes_count } : p,
        ),
      );
    } catch (err) {
      setError(getErrorMessage(err));
      setPosts((current) =>
        current.map((p) =>
          p.id === postId ? { ...p, is_liked: target.is_liked, likes_count: target.likes_count } : p,
        ),
      );
    }
  };

  const handleAddComment = async (postId, content) => {
    try {
      const { data } = await commentApi.add({ post_id: postId, content });
      setPosts((current) =>
        current.map((p) =>
          p.id === postId
            ? { ...p, comments: [...p.comments, data.comment], comments_count: p.comments_count + 1 }
            : p,
        ),
      );
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
        current.map((p) =>
          p.id === postId
            ? {
                ...p,
                comments: p.comments.filter((c) => c.id !== commentId),
                comments_count: Math.max(p.comments_count - 1, 0),
              }
            : p,
        ),
      );
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <PullToRefresh onRefresh={refreshAll} className="h-full w-full overflow-x-hidden box-border bg-[color:var(--bg)] custom-scrollbar">
      <div className="w-full max-w-[850px] mx-auto flex justify-center lg:justify-between pt-0 lg:pt-8 px-0 lg:px-4 xl:max-w-[950px] xl:gap-8">
          {/* Feed Column */}
          <div className="w-full max-w-[470px] flex-shrink-0 flex flex-col">
            {/* Stories */}
            {loading ? (
              <SkeletonStoryBar />
            ) : (
              <div className="border-b border-[color:var(--border)] max-w-[470px] mx-auto w-full sm:border sm:rounded-xl sm:bg-[color:var(--bg-card)] sm:mb-6 sm:overflow-hidden">
                <StoryBar
                  stories={stories}
                  onOpenCreator={() => setIsCreatorOpen(true)}
                  creatingStory={creatingStory}
                  onOpenStory={setActiveStoryGroup}
                />
              </div>
            )}

            {/* Error */}
            {error ? (
              <div className="mx-auto max-w-[470px] mt-3 rounded-xl px-4 py-3 text-sm text-red-400" style={{ background: "rgba(239,68,68,0.1)" }}>
                {error}
              </div>
            ) : null}

            {/* Feed */}
            <div className="pb-safe sm:pt-0 pt-4">
              {loading ? (
                <div className="space-y-4 p-4 max-w-[470px] mx-auto w-full">
                  <SkeletonPostCard />
                  <SkeletonPostCard />
                </div>
              ) : posts.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-8 py-20 text-center max-w-[470px] mx-auto">
                  <p className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Welcome to Neurality</p>
                  <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
                    Follow people to see their posts here, or create your first post.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col w-full items-center">
                  {posts.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      currentUser={user}
                      onToggleLike={handleToggleLike}
                      onAddComment={handleAddComment}
                      onDeleteComment={handleDeleteComment}
                      onAddStory={handleAddStory}
                    />
                  ))}

                  {/* Infinite scroll sentinel */}
                  {hasNext ? (
                    <div ref={sentinelRef} className="flex items-center justify-center py-8 w-full">
                      <div
                        className="h-6 w-6 rounded-full border-2 border-t-transparent animate-spin"
                        style={{ borderColor: "var(--text-muted)", borderTopColor: "transparent" }}
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center py-12 text-center w-full">
                      <p className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
                        You're all caught up ✓
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar Column */}
          <div className="hidden lg:block w-[320px] flex-shrink-0 relative">
            <div className="sticky top-8 flex flex-col gap-6 w-full">
              {/* User Profile Mini */}
              {user && (
                <div className="flex items-center justify-between">
                  <Link to={`/profile/${user.id}`} className="flex items-center gap-3">
                    <Avatar src={user.profile_pic} name={user.username} size="md" />
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{user.username}</span>
                      <span className="text-sm" style={{ color: "var(--text-muted)" }}>{user.full_name || "Neurality"}</span>
                    </div>
                  </Link>
                  <button className="text-xs font-semibold text-blue-500 hover:text-blue-400 transition-colors">Switch</button>
                </div>
              )}

              {/* Suggestions */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-semibold" style={{ color: "var(--text-muted)" }}>Suggested for you</span>
                  <Link to="/explore" className="text-xs font-semibold hover:text-[color:var(--text-secondary)]" style={{ color: "var(--text-primary)" }}>See All</Link>
                </div>
                <div className="flex flex-col gap-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[color:var(--surface)] animate-pulse" />
                        <div className="flex flex-col gap-1.5">
                          <div className="w-20 h-2.5 bg-[color:var(--surface-active)] rounded animate-pulse" />
                          <div className="w-14 h-2 bg-[color:var(--surface)] rounded animate-pulse" />
                        </div>
                      </div>
                      <button className="text-xs font-semibold text-blue-500 hover:text-blue-400 transition-colors">Follow</button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer links */}
              <div className="mt-4 flex flex-wrap gap-x-2 gap-y-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
                <span>About</span><span>•</span><span>Help</span><span>•</span><span>API</span><span>•</span><span>Privacy</span><span>•</span><span>Terms</span>
              </div>
              <div className="mt-2 text-[11px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                © 2026 Neurality
              </div>
            </div>
          </div>
        </div>
      </PullToRefresh>

      {/* Story viewer */}
      <StoryViewer
        group={activeStoryGroup}
        open={Boolean(activeStoryGroup)}
        onClose={() => setActiveStoryGroup(null)}
        allGroups={stories}
        onNextGroup={setActiveStoryGroup}
      />

      {/* Story creator */}
      <StoryCreator
        isOpen={isCreatorOpen}
        onClose={() => { setIsCreatorOpen(false); setSharedContent(null); }}
        onPublish={handlePublishStory}
        sharedContent={sharedContent}
      />
    </div>
  );
}
