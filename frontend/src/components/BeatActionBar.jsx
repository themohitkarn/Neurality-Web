import { useState } from "react";
import { Heart, MessageCircle, Send, MoreHorizontal, Repeat2, Bookmark, Copy, EyeOff, Flag, ShieldAlert } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import BeatComments from "./BeatComments";
import ShareSheet from "./ShareSheet";
import BottomSheet from "./BottomSheet";
import { hapticMedium, hapticLight } from "../utils/capacitor";
import { reelApi, socialApi } from "../services/api";

export default function BeatActionBar({ beat, onToggleLike, onAddStory }) {
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isSaved, setIsSaved] = useState(beat.is_saved);
  const [isReposted, setIsReposted] = useState(beat.is_reposted);
  const [repostsCount, setRepostsCount] = useState(beat.reposts_count || 0);

  const handleToggleRepost = async () => {
    try {
      hapticMedium();
      const { data } = await reelApi.toggleRepost(beat.id);
      setIsReposted(data.reposted);
      setRepostsCount(data.reposts_count);
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleSave = async () => {
    try {
      hapticLight();
      const { data } = await reelApi.toggleSave(beat.id);
      setIsSaved(data.saved);
    } catch (err) {
      console.error(err);
    }
  };

  const actions = [
    {
      key: "like",
      icon: Heart,
      label: beat.likes_count,
      active: beat.is_liked,
      onClick: () => {
        onToggleLike(beat.id);
        if (!beat.is_liked) hapticMedium();
      },
      activeColor: "#ff2d55",
    },
    {
      key: "comment",
      icon: MessageCircle,
      label: beat.comments_count || "0",
      onClick: () => { setShowComments(true); hapticLight(); },
    },
    {
      key: "share",
      icon: Send,
      label: "",
      onClick: () => { setShowShare(true); hapticLight(); },
    },
    {
      key: "repost",
      icon: Repeat2,
      label: repostsCount > 0 ? repostsCount : "",
      active: isReposted,
      activeColor: "#10b981",
      onClick: handleToggleRepost,
    },
    {
      key: "save",
      icon: Bookmark,
      label: "",
      active: isSaved,
      activeColor: "#f59e0b",
      onClick: handleToggleSave,
    },
    {
      key: "more",
      icon: MoreHorizontal,
      label: "",
      onClick: () => { setShowMenu(true); hapticLight(); },
    },
  ];

  return (
    <>
      <div className="flex flex-col items-center gap-5">
        {actions.map((action, index) => {
          const Icon = action.icon;
          const isActive = action.active;
          
          return (
            <motion.div
              key={action.key}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex flex-col items-center gap-1"
            >
              <motion.button
                whileTap={{ scale: 0.9 }}
                whileHover={{ scale: 1.05 }}
                onClick={(e) => { e.stopPropagation(); action.onClick(); }}
                className="relative"
              >
                {/* Minimal Glass Background */}
                <div 
                  className="flex items-center justify-center rounded-full transition-all duration-300"
                  style={{ 
                    width: 44, 
                    height: 44, 
                    background: isActive ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.25)", 
                    backdropFilter: "blur(20px)",
                    border: isActive ? `1px solid rgba(255,255,255,0.3)` : "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  <Icon
                    size={22}
                    strokeWidth={isActive ? 2 : 1.5}
                    className="transition-all duration-300"
                    style={{ 
                      color: isActive ? action.activeColor : "white",
                    }}
                    fill={isActive ? "currentColor" : "none"}
                  />
                </div>
              </motion.button>
              
              {action.label !== "" && (
                <span className="text-white text-[11px] font-semibold drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                  {action.label}
                </span>
              )}
            </motion.div>
          );
        })}
      </div>

      <BeatComments
        open={showComments}
        onClose={() => setShowComments(false)}
        beatId={beat.id}
      />

      <ShareSheet
        open={showShare}
        onClose={() => setShowShare(false)}
        contentType="beat"
        contentId={beat.id}
        title={`Beat by ${beat.author.username}`}
        onAddStory={onAddStory}
      />

      <BottomSheet open={showMenu} onClose={() => setShowMenu(false)} title="Options">
        <div className="space-y-1 pb-6 px-2">
          {[
            { label: "Copy link", icon: Copy, onClick: () => navigator.clipboard.writeText(`${window.location.origin}/beat/${beat.id}`) },
            { label: "Not interested", icon: EyeOff, desc: "See fewer beats like this" },
            { label: "Report", icon: Flag, desc: "Report inappropriate content", danger: true, onClick: () => { /* Report logic */ } },
            { label: "Block user", icon: ShieldAlert, desc: `Block @${beat.author.username}`, danger: true, onClick: () => { /* Block logic */ } },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => { item.onClick?.(); setShowMenu(false); hapticLight(); }}
              className="w-full flex items-center gap-4 rounded-2xl px-4 py-3.5 text-left transition-colors hover:bg-[rgba(255,255,255,0.05)]"
            >
              <div className={`p-2.5 rounded-xl bg-[rgba(255,255,255,0.05)] ${item.danger ? "text-red-500" : "text-[color:var(--text-secondary)]"}`}>
                <item.icon size={20} strokeWidth={1.5} />
              </div>
              <div className="flex-1">
                <p
                  className={`text-[15px] font-semibold ${item.danger ? "text-red-500" : "text-[color:var(--text-primary)]"}`}
                >
                  {item.label}
                </p>
                {item.desc && <p className="text-xs text-[color:var(--text-muted)] mt-0.5">{item.desc}</p>}
              </div>
            </button>
          ))}
        </div>
      </BottomSheet>
    </>
  );
}
