import { Link } from "react-router-dom";

import Avatar from "./Avatar";


export default function RecommendedPosts({
  posts,
  loading,
  title = "Suggestions for you",
  subtitle = "Picked from your likes, comments, and follow graph.",
}) {
  return (
    <section className="panel soft-ring px-5 py-6">
      <div>
        <p className="font-display text-2xl text-ink">{title}</p>
        <p className="mt-1 text-sm text-[color:var(--muted)]">{subtitle}</p>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-[color:var(--muted)]">Refreshing recommendations...</p>
      ) : null}

      {!loading && posts.length === 0 ? (
        <p className="mt-4 text-sm leading-6 text-[color:var(--muted)]">
          Interact with a few drops and the recommendation engine will start shaping this section.
        </p>
      ) : null}

      <div className="mt-5 space-y-4">
        {posts.map((post) => (
          <article key={post.id} className="rounded-[24px] bg-white/75 p-3">
            <div className="flex gap-3">
              <img
                src={post.image_url}
                alt={post.caption || `${post.author.username} drop`}
                className="h-20 w-20 rounded-[18px] object-cover"
              />
              <div className="min-w-0 flex-1">
                <Link to={`/profile/${post.author.id}`} className="flex items-center gap-2">
                  <Avatar src={post.author.profile_pic} name={post.author.username} size="sm" />
                  <span className="truncate text-sm font-semibold text-ink">{post.author.username}</span>
                </Link>
                <p className="mt-2 max-h-[72px] overflow-hidden text-sm leading-6 text-[color:var(--muted)]">
                  {post.caption || "A fresh drop from your network."}
                </p>
                <p className="mt-2 text-xs uppercase tracking-[0.22em] text-[color:var(--muted)]">
                  {post.likes_count} likes
                </p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
