import EmptyState from "./EmptyState";
import PostCard from "./PostCard";


export default function FeedStream({
  loading,
  posts,
  loadingMore,
  hasNext,
  sentinelRef,
  onToggleLike,
  onAddComment,
  onDeleteComment,
}) {
  return (
    <>
      {loading ? (
        <div className="panel soft-ring px-6 py-12 text-center">
          <p className="font-display text-2xl text-ink">Loading your home flow</p>
          <p className="mt-2 text-sm text-[color:var(--muted)]">
            Pulling in fresh drops and the people you follow.
          </p>
        </div>
      ) : null}

      {!loading && posts.length === 0 ? (
        <EmptyState
          title="The home flow is quiet right now"
          description="Upload the first drop or seed the backend so the timeline has something to show."
        />
      ) : null}

      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          onToggleLike={onToggleLike}
          onAddComment={onAddComment}
          onDeleteComment={onDeleteComment}
        />
      ))}

      {loadingMore ? (
        <div className="rounded-[24px] bg-white/70 px-5 py-4 text-center text-sm text-[color:var(--muted)]">
          Loading more drops...
        </div>
      ) : null}

      {!loading && hasNext ? <div ref={sentinelRef} className="h-12" /> : null}
    </>
  );
}
