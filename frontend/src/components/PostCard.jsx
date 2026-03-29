import { useState } from "react";
import { Heart, MessageCircle, Send, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";

import Avatar from "./Avatar";


function formatTimestamp(value) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}


export default function PostCard({ post, onToggleLike, onAddComment, onDeleteComment }) {
  const [commentText, setCommentText] = useState("");
  const [liking, setLiking] = useState(false);
  const [commentBusy, setCommentBusy] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState(null);

  const handleLike = async () => {
    setLiking(true);
    await onToggleLike(post.id);
    setLiking(false);
  };

  const handleCommentSubmit = async (event) => {
    event.preventDefault();
    const content = commentText.trim();
    if (!content) {
      return;
    }

    setCommentBusy(true);
    const success = await onAddComment(post.id, content);
    setCommentBusy(false);

    if (success) {
      setCommentText("");
    }
  };

  const handleDelete = async (commentId) => {
    setDeletingCommentId(commentId);
    await onDeleteComment(post.id, commentId);
    setDeletingCommentId(null);
  };

  return (
    <article className="panel soft-ring overflow-hidden animate-fade-up">
      <div className="flex items-center justify-between gap-3 px-5 py-5 sm:px-6">
        <Link to={`/profile/${post.author.id}`} className="flex items-center gap-3">
          <Avatar src={post.author.profile_pic} name={post.author.username} size="md" />
          <div>
            <p className="font-semibold text-ink">{post.author.username}</p>
            <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--muted)]">
              {formatTimestamp(post.created_at)}
            </p>
          </div>
        </Link>
        <span className="rounded-full bg-[rgba(142,13,115,0.1)] px-3 py-1 text-xs font-medium text-[color:var(--accent)]">
          {post.likes_count} likes
        </span>
      </div>

      <div className="aspect-[4/5] overflow-hidden bg-[rgba(20,16,20,0.05)]">
        <img
          src={post.image_url}
          alt={post.caption || `${post.author.username} post`}
          className="h-full w-full object-cover transition duration-500 hover:scale-[1.02]"
        />
      </div>

      <div className="px-5 py-5 sm:px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleLike}
            disabled={liking}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
              post.is_liked
                ? "bg-[rgba(142,13,115,0.14)] text-[color:var(--accent)]"
                : "bg-white/80 text-[color:var(--muted)] hover:text-ink"
            }`}
          >
            <Heart size={16} fill={post.is_liked ? "currentColor" : "none"} />
            {post.is_liked ? "Liked" : "Like"}
          </button>
          <span className="inline-flex items-center gap-2 rounded-full bg-white/75 px-4 py-2 text-sm text-[color:var(--muted)]">
            <MessageCircle size={16} />
            {post.comments_count} comments
          </span>
        </div>

        {post.caption ? (
          <p className="mt-4 text-[15px] leading-7 text-ink">
            <span className="mr-2 font-semibold">{post.author.username}</span>
            {post.caption}
          </p>
        ) : null}

        <div className="mt-5 space-y-3">
          {post.comments.map((comment) => (
            <div
              key={comment.id}
              className="flex items-start justify-between gap-3 rounded-2xl bg-white/62 px-4 py-3"
            >
              <div className="flex gap-3">
                <Avatar src={comment.author.profile_pic} name={comment.author.username} size="sm" />
                <div>
                  <p className="text-sm font-semibold text-ink">{comment.author.username}</p>
                  <p className="text-sm leading-6 text-[color:var(--muted)]">{comment.content}</p>
                </div>
              </div>

              {comment.can_delete ? (
                <button
                  type="button"
                  onClick={() => handleDelete(comment.id)}
                  disabled={deletingCommentId === comment.id}
                  className="rounded-full p-2 text-[color:var(--muted)] transition hover:bg-white hover:text-red-500"
                >
                  <Trash2 size={15} />
                </button>
              ) : null}
            </div>
          ))}
        </div>

        <form onSubmit={handleCommentSubmit} className="mt-5 flex flex-col gap-3 sm:flex-row">
          <input
            value={commentText}
            onChange={(event) => setCommentText(event.target.value)}
            placeholder="Write a thoughtful comment"
            className="field flex-1"
            maxLength={280}
          />
          <button type="submit" disabled={commentBusy} className="accent-button gap-2">
            <Send size={16} />
            {commentBusy ? "Sending..." : "Comment"}
          </button>
        </form>
      </div>
    </article>
  );
}
