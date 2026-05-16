import { Plus } from "lucide-react";
import Avatar from "./Avatar";


export default function StoryBar({ stories = [], onOpenCreator, onOpenStory, creatingStory }) {
  // Check if current user is in the stories list (the backend now puts them first if they have stories)
  
  return (
    <div
      className="flex gap-3 overflow-x-auto px-4 py-3 no-scrollbar"
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      {/* Create story / Your Story */}
      <div className="flex flex-col items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={onOpenCreator}
          className={`relative flex items-center justify-center rounded-full transition-transform active:scale-95 ${
            creatingStory ? "opacity-60" : ""
          }`}
          style={{
            width: 64,
            height: 64,
            background: "var(--surface)",
            border: "1px solid var(--border-strong)",
          }}
        >
          <div className="w-full h-full rounded-full flex items-center justify-center bg-[color:var(--surface)] overflow-hidden">
             <Plus size={24} className="text-[color:var(--text-secondary)]" />
          </div>
          {/* Plus badge */}
          <span
            className="absolute bottom-0.5 right-0.5 flex h-5 w-5 items-center justify-center rounded-full text-white border-2 border-[color:var(--bg-card)]"
            style={{ background: "var(--accent)", fontSize: 12, fontWeight: 700 }}
          >
            +
          </span>
        </button>
        <span className="text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>
          {creatingStory ? "Posting…" : "Your story"}
        </span>
      </div>

      {/* Other stories */}
      {stories.map((group) => (
        <div
          key={group.user.id}
          className="flex flex-col items-center gap-1.5 shrink-0"
        >
          <Avatar
            src={group.user.profile_pic}
            name={group.user.username}
            size="lg"
            hasStory={true}
            storySeen={group.all_seen}
            onClick={() => onOpenStory(group)}
          />
          <span
            className="text-[10px] font-medium max-w-[64px] truncate"
            style={{ color: group.all_seen ? "var(--text-muted)" : "var(--text-primary)" }}
          >
            {group.user.username}
          </span>
        </div>
      ))}
    </div>
  );
}
