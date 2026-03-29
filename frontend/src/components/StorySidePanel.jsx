import { ImagePlus } from "lucide-react";

import Avatar from "./Avatar";


export default function StorySidePanel({ stories, onCreateStory, creatingStory, onOpenStory }) {
  return (
    <section className="panel soft-ring px-5 py-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-display text-2xl text-ink">Stories</p>
          <p className="text-sm text-[color:var(--muted)]">Quick circles from your people.</p>
        </div>
        <label className="ghost-button cursor-pointer gap-2 px-4 py-2.5 text-xs">
          <ImagePlus size={14} />
          {creatingStory ? "Adding..." : "Add story"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={creatingStory}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                onCreateStory(file);
              }
              event.target.value = "";
            }}
          />
        </label>
      </div>

      {stories.length === 0 ? (
        <p className="mt-4 text-sm leading-6 text-[color:var(--muted)]">
          No stories yet. Add one and it will show up here.
        </p>
      ) : (
        <div className="mt-5 flex flex-wrap gap-4">
          {stories.slice(0, 6).map((storyGroup) => (
            <button
              key={storyGroup.user.id}
              type="button"
              onClick={() => onOpenStory(storyGroup)}
              className="flex flex-col items-center gap-2 text-center"
            >
              <span className="story-ring flex h-[64px] w-[64px] items-center justify-center rounded-full p-[3px]">
                <span className="flex h-full w-full items-center justify-center rounded-full bg-[var(--surface-strong)]">
                  <Avatar src={storyGroup.user.profile_pic} name={storyGroup.user.username} size="md" />
                </span>
              </span>
              <span className="max-w-[76px] truncate text-xs font-medium text-ink">
                {storyGroup.user.username}
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
