import { useState } from "react";
import { Heart, MessageCircle, Send, MoreHorizontal, Repeat2, Bookmark, Copy, Eye, EyeOff, Flag, ShieldAlert, Trash2, Edit3, Archive, Pin, Info, MessageSquareOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import BeatComments from "./BeatComments";
import ShareSheet from "./ShareSheet";
import BottomSheet from "./BottomSheet";
import { hapticMedium, hapticLight, hapticHeavy } from "../utils/capacitor";
import { reelApi, socialApi } from "../services/api";

export default function BeatActionBar({ beat, onToggleLike, onAddStory, onDeleteBeat, onHideBeat, onBlockUser, currentUser }) {
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isSaved, setIsSaved] = useState(beat.is_saved);
  const [isReposted, setIsReposted] = useState(beat.is_reposted);
  const [repostsCount, setRepostsCount] = useState(beat.reposts_count || 0);
  const [isDeleting, setIsDeleting] = useState(false);

  const isOwner = currentUser && String(beat.author.id) === String(currentUser.id);

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

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this beat?")) return;
    
    setIsDeleting(true);
    hapticHeavy();
    try {
      await onDeleteBeat(beat.id);
      setShowMenu(false);
    } catch (err) {
      console.error(err);
      alert("Failed to delete beat");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleHide = async () => {
    try {
      hapticMedium();
      await socialApi.hideContent({ reel_id: beat.id });
      alert("Marked as 'Not interested'. We'll show you fewer beats like this.");
      if (onHideBeat) {
        onHideBeat(beat.id);
      }
      setShowMenu(false);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Failed to hide content");
    }
  };

  const handleReport = async () => {
    const reason = window.prompt("Why are you reporting this content? (e.g., spam, hate speech, inappropriate):");
    if (!reason || !reason.trim()) return;

    try {
      hapticMedium();
      await socialApi.report({
        target_type: "reel",
        target_id: beat.id,
        reason: reason.trim(),
        description: "Reported from feed action bar options menu."
      });
      alert("Thank you! Report submitted for review.");
      setShowMenu(false);
    } catch (err) {
      console.error(err);
      alert("Failed to submit report");
    }
  };

  const handleBlock = async () => {
    if (!window.confirm(`Are you sure you want to block @${beat.author.username}? You will no longer see their content.`)) return;

    try {
      hapticHeavy();
      await socialApi.toggleBlock(beat.author.id);
      alert(`@${beat.author.username} has been blocked.`);
      if (onBlockUser) {
        onBlockUser(beat.author.id);
      }
      setShowMenu(false);
    } catch (err) {
      console.error(err);
      alert("Failed to block user");
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

  const menuItems = isOwner ? [
    { label: "Delete Beat", icon: Trash2, danger: true, onClick: handleDelete },
    { label: "Edit Caption", icon: Edit3, onClick: () => {} },
    { label: "Archive", icon: Archive, onClick: () => {} },
    { label: "Pin to Profile", icon: Pin, onClick: () => {} },
    { label: "Disable Comments", icon: MessageSquareOff, onClick: () => {} },
    { label: "View Insights", icon: Info, onClick: () => {} },
    { label: "Copy link", icon: Copy, onClick: () => {
      navigator.clipboard.writeText(`${window.location.origin}/beat/${beat.id}`);
      alert("Link copied!");
    }},
  ] : [
    { label: "Not interested", icon: EyeOff, desc: "See fewer beats like this", onClick: handleHide },
    { label: "Report", icon: Flag, desc: "Report inappropriate content", danger: true, onClick: handleReport },
    { label: "Block user", icon: ShieldAlert, desc: `Block @${beat.author.username}`, danger: true, onClick: handleBlock },
    { label: "Copy link", icon: Copy, onClick: () => {
      navigator.clipboard.writeText(`${window.location.origin}/beat/${beat.id}`);
      alert("Link copied!");
    }},
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
          {menuItems.map((item) => (
            <button
              key={item.label}
              type="button"
              disabled={isDeleting && item.label === "Delete Beat"}
              onClick={() => { item.onClick?.(); if(item.label !== "Delete Beat") setShowMenu(false); hapticLight(); }}
              className="w-full flex items-center gap-4 rounded-2xl px-4 py-3.5 text-left transition-colors hover:bg-[rgba(255,255,255,0.05)] disabled:opacity-50"
            >
              <div className={`p-2.5 rounded-xl bg-[rgba(255,255,255,0.05)] ${item.danger ? "text-red-500" : "text-[color:var(--text-secondary)]"}`}>
                <item.icon size={20} strokeWidth={1.5} />
              </div>
              <div className="flex-1">
                <p
                  className={`text-[15px] font-semibold ${item.danger ? "text-red-500" : "text-[color:var(--text-primary)]"}`}
                >
                  {isDeleting && item.label === "Delete Beat" ? "Deleting..." : item.label}
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
