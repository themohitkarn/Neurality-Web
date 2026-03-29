import { ImagePlus, Sparkles } from "lucide-react";

import Avatar from "./Avatar";


export default function StoryBar({ stories, onCreateStory, creatingStory, onOpenStory }) {
  return (
    <section className="panel soft-ring overflow-hidden px-5 py-5 sm:px-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-display text-2xl text-ink">Stories</p>
          <p className="text-sm text-[color:var(--muted)]">
            Fast circles that disappear in 24 hours.
          </p>
        </div>
        <label className="ghost-button cursor-pointer gap-2">
          <ImagePlus size={16} />
          {creatingStory ? "Uploading..." : "Add story"}
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

      <div className="mt-6 flex gap-4 overflow-x-auto pb-1">
        {stories.length === 0 ? (
          <div className="flex min-h-[112px] w-full items-center gap-3 rounded-[24px] border border-dashed border-[color:var(--line)] px-5 text-sm text-[color:var(--muted)]">
            <Sparkles size={18} />
            Stories will show up here as soon as people start sharing.
          </div>
        ) : null}

        {stories.map((storyGroup, index) => (
          <button
            key={storyGroup.user.id}
            type="button"
            onClick={() => onOpenStory(storyGroup)}
            className="group flex min-w-[92px] flex-col items-center gap-3 text-center animate-fade-up"
            style={{ animationDelay: `${index * 80}ms` }}
          >
            <span className="story-ring flex h-[74px] w-[74px] items-center justify-center rounded-full p-[3px] shadow-soft">
              <span className="flex h-full w-full items-center justify-center rounded-full bg-[var(--surface-strong)]">
                <Avatar src={storyGroup.user.profile_pic} name={storyGroup.user.username} size="md" />
              </span>
            </span>
            <span className="max-w-[90px] truncate text-sm font-medium text-ink">
              {storyGroup.user.username}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
