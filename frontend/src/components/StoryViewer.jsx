import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

import Avatar from "./Avatar";


export default function StoryViewer({ group, open, onClose }) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [group?.user?.id]);

  useEffect(() => {
    if (!open || !group) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      if (activeIndex >= group.stories.length - 1) {
        onClose();
        return;
      }
      setActiveIndex((current) => current + 1);
    }, 4000);

    return () => window.clearTimeout(timer);
  }, [activeIndex, group, onClose, open]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open || !group) {
    return null;
  }

  const activeStory = group.stories[activeIndex];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(18,12,20,0.82)] px-4 py-6 backdrop-blur-md">
      <div className="relative w-full max-w-md overflow-hidden rounded-[34px] bg-[#120d15] shadow-[0_30px_120px_rgba(0,0,0,0.4)]">
        <div className="absolute inset-x-0 top-0 z-20 flex gap-2 px-4 pt-4">
          {group.stories.map((story, index) => (
            <span key={story.id} className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/20">
              <span
                className={`block h-full rounded-full bg-white ${
                  index === activeIndex ? "animate-progress" : index < activeIndex ? "w-full" : "w-0"
                }`}
              />
            </span>
          ))}
        </div>

        <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4 pt-8">
          <div className="flex items-center gap-3 text-white">
            <Avatar src={group.user.profile_pic} name={group.user.username} size="sm" />
            <div>
              <p className="font-semibold">{group.user.username}</p>
              <p className="text-xs text-white/70">Story {activeIndex + 1}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-full bg-white/12 p-2 text-white transition hover:bg-white/20">
            <X size={18} />
          </button>
        </div>

        <img src={activeStory.image_url} alt="" className="h-[75vh] w-full object-cover" />

        <button
          type="button"
          onClick={() => setActiveIndex((current) => Math.max(current - 1, 0))}
          className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/12 p-2 text-white transition hover:bg-white/20"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          type="button"
          onClick={() =>
            setActiveIndex((current) => {
              if (current >= group.stories.length - 1) {
                onClose();
                return current;
              }
              return current + 1;
            })
          }
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/12 p-2 text-white transition hover:bg-white/20"
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
