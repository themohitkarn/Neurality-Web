import { useState } from "react";
import { Send } from "lucide-react";

import BottomSheet from "./BottomSheet";
import Avatar from "./Avatar";
import { hapticLight } from "../utils/capacitor";


export default function BeatComments({ open, onClose, beatId }) {
  const [comments, setComments] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);

  // Comments are loaded from the existing comment system
  // For now, this is a placeholder that can be wired to the backend

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!draft.trim()) return;
    hapticLight();
    // TODO: Wire to commentApi.add({ post_id: beatId, content: draft })
    setComments((prev) => [
      ...prev,
      {
        id: Date.now(),
        username: "you",
        content: draft.trim(),
        created_at: new Date().toISOString(),
      },
    ]);
    setDraft("");
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={`Comments`} snapPoints={["55vh", "85vh"]}>
      <div className="flex flex-col h-full">
        {/* Comments list */}
        <div className="flex-1 overflow-y-auto space-y-4 pb-4">
          {comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
                No comments yet
              </p>
              <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
                Start the conversation.
              </p>
            </div>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="flex gap-3">
                <Avatar name={comment.username} size="sm" />
                <div className="flex-1">
                  <p className="text-sm">
                    <span className="font-semibold mr-1.5" style={{ color: "var(--text-primary)" }}>
                      {comment.username}
                    </span>
                    <span style={{ color: "var(--text-secondary)" }}>{comment.content}</span>
                  </p>
                  <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
                    Just now
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Comment input */}
        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-3 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] border-t border-[color:var(--border)]"
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a comment…"
            className="flex-1 bg-transparent text-sm outline-none py-2"
            style={{ color: "var(--text-primary)" }}
            maxLength={280}
          />
          {draft.trim() ? (
            <button
              type="submit"
              className="transition-transform active:scale-90"
              style={{ color: "var(--accent)" }}
            >
              <Send size={20} />
            </button>
          ) : null}
        </form>
      </div>
    </BottomSheet>
  );
}
