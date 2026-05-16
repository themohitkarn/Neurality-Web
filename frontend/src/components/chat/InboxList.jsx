import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import Avatar from "../Avatar";
import { Check, CheckCheck, Camera, Mic, Image as ImageIcon } from "lucide-react";

export default function InboxList({ contacts, selectedId, onSelect, currentUser, onlineUsers }) {
  
  const getUnreadLabel = (count) => {
    if (!count || count === 0) return null;
    return count > 3 ? "4+" : count;
  };

  const getPreviewText = (contact) => {
    const lastMsg = contact.last_message;
    if (!lastMsg) return "No messages yet";

    const isMe = lastMsg.sender_id === currentUser?.id;
    
    // Preview rules
    if (lastMsg.type === "image") return (
      <span className="flex items-center gap-1">
        <Camera size={12} className="text-muted" /> {isMe ? "Sent a photo" : "Sent a photo"}
      </span>
    );
    if (lastMsg.type === "voice") return (
      <span className="flex items-center gap-1">
        <Mic size={12} className="text-muted" /> {isMe ? "Sent a voice message" : "Sent a voice message"}
      </span>
    );
    if (lastMsg.type === "reel") return "Sent a reel";
    
    if (isMe) {
      if (lastMsg.is_read) return <span className="text-muted">Seen</span>;
      return <span className="text-muted">Sent</span>;
    }

    // Reaction rule (placeholder for reaction logic check)
    if (lastMsg.latest_reaction) return `Reacted ${lastMsg.latest_reaction} to your message`;

    return lastMsg.content;
  };

  return (
    <div className="flex-1 overflow-y-auto hide-scrollbar pb-24 pt-2">
      <AnimatePresence mode="popLayout">
        {contacts.map((contact, index) => {
          const isActive = String(contact.id) === String(selectedId);
          const unreadCount = getUnreadLabel(contact.unread_count);
          const isOnline = onlineUsers?.has(String(contact.id));

          return (
            <motion.div
              key={contact.conversationId || contact.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => onSelect(contact)}
              className={`
                relative flex items-center gap-4 px-5 py-4 cursor-pointer transition-all active:scale-[0.98]
                ${isActive ? 'bg-white/5' : 'hover:bg-white/[0.02]'}
              `}
            >
              {/* Avatar Section */}
              <div className="relative flex-shrink-0">
                <Avatar 
                  src={contact.group_pic || contact.profile_pic} 
                  name={contact.username} 
                  size="lg" 
                  className={contact.is_group ? "rounded-2xl" : "rounded-full ring-2 ring-white/5"}
                />
                {isOnline && !contact.is_group && (
                  <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 rounded-full border-[3px] border-[#09090b] shadow-lg" />
                )}
              </div>

              {/* Info Section */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h3 className={`text-[15px] font-bold truncate ${unreadCount ? 'text-white' : 'text-zinc-200'}`}>
                    {contact.name || contact.username}
                  </h3>
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted">
                    {contact.last_message_time || "now"}
                  </span>
                </div>
                
                <div className="flex items-center justify-between gap-2">
                  <p className={`text-[13px] truncate flex-1 leading-tight ${unreadCount ? 'text-white font-bold' : 'text-muted'}`}>
                    {getPreviewText(contact)}
                  </p>
                  
                  {unreadCount && (
                    <div className="bg-accent text-white text-[10px] font-black min-w-[20px] h-[20px] flex items-center justify-center rounded-full px-1.5 shadow-[0_0_15px_rgba(225,29,72,0.4)]">
                      {unreadCount}
                    </div>
                  )}
                  
                  {!unreadCount && contact.last_message?.sender_id === currentUser?.id && (
                    <div className="flex-shrink-0 opacity-40">
                      {contact.last_message.is_read ? (
                        <CheckCheck size={14} className="text-accent" />
                      ) : (
                        <Check size={14} />
                      )}
                    </div>
                  )}
                </div>
              </div>

              {isActive && (
                <motion.div 
                  layoutId="active-indicator"
                  className="absolute left-0 top-4 bottom-4 w-1 bg-accent rounded-r-full shadow-[0_0_10px_rgba(225,29,72,0.5)]" 
                />
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
