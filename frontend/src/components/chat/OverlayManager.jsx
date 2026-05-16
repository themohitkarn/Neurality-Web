import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Reply, Forward, Pin, StickyNote, Trash2, Plus, 
  Settings, Users, X 
} from "lucide-react";
import GroupCreator from "../GroupCreator";

export default function OverlayManager({
  isDetailsOpen,
  selectedContact,
  activeTheme,
  onCloseDetails,
  onOpenTheme,
  isThemeOpen,
  setActiveTheme,
  onCloseTheme,
  isGroupCreatorOpen,
  onCloseGroupCreator,
  onGroupCreated,
  reactingTo,
  setReactingTo,
  onReaction,
  onAction,
  currentUser
}) {
  const [quickEmojis, setQuickEmojis] = React.useState(["❤️", "😂", "😮", "😢", "😠"]);
  const isMine = reactingTo && String(reactingTo.sender_id) === String(currentUser?.id);

  const actions = [
    { label: "Reply", icon: <Reply size={18} />, onClick: () => { onAction('reply', reactingTo); setReactingTo(null); } },
    { label: "Forward", icon: <Forward size={18} />, onClick: () => onAction('forward', reactingTo) },
    { label: "Pin", icon: <Pin size={18} />, onClick: () => {} },
    { label: "Add sticker", icon: <StickyNote size={18} />, onClick: () => {} },
    { label: "Copy", icon: <Plus size={18} />, onClick: () => { navigator.clipboard.writeText(reactingTo.content); setReactingTo(null); } },
    ...(isMine ? [
      { label: "Unsend", icon: <Trash2 size={18} />, onClick: () => { onAction('unsend', reactingTo); setReactingTo(null); }, danger: true }
    ] : []),
    { label: "Delete for me", icon: <Trash2 size={18} />, onClick: () => { onAction('delete', reactingTo); setReactingTo(null); }, danger: true },
  ];

  return (
    <>
      {/* 2. Group Creator Overlay */}
      <AnimatePresence>{isGroupCreatorOpen && <GroupCreator onClose={onCloseGroupCreator} onCreated={onGroupCreated} />}</AnimatePresence>

      {/* 3. PREMIUM REACTION & ACTION MENU (Instagram Style) */}
      <AnimatePresence>
        {reactingTo && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-xl flex flex-col items-center justify-center p-6"
            onClick={() => setReactingTo(null)}
          >
            <div className="w-full max-w-xs space-y-4" onClick={e => e.stopPropagation()}>
              
              {/* Quick Emojis Pill */}
              <motion.div 
                initial={{ scale: 0.8, y: 20 }} animate={{ scale: 1, y: 0 }}
                className="bg-zinc-900/90 border border-white/10 p-2.5 rounded-full flex items-center justify-around shadow-2xl"
              >
                {quickEmojis.map(emoji => (
                  <button key={emoji} onClick={() => onReaction(emoji)} className="text-2xl hover:scale-125 active:scale-90 transition-all">{emoji}</button>
                ))}
                <button className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-white transition-all">
                  <Plus size={18} />
                </button>
              </motion.div>

              {/* Action List */}
              <motion.div 
                initial={{ scale: 0.8, y: 10 }} animate={{ scale: 1, y: 0 }}
                className="bg-zinc-900/90 border border-white/10 rounded-[32px] overflow-hidden shadow-2xl"
              >
                {actions.map((action, i) => (
                  <button 
                    key={i} 
                    onClick={action.onClick}
                    className={`
                      w-full flex items-center justify-between px-6 py-4 hover:bg-white/5 active:bg-white/10 transition-all border-b border-white/5 last:border-0
                      ${action.danger ? 'text-rose-500' : 'text-white/90'}
                    `}
                  >
                    <span className="text-[14px] font-bold">{action.label}</span>
                    <div className="opacity-40">{action.icon}</div>
                  </button>
                ))}
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
