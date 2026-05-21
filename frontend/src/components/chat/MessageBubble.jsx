import React from "react";
import { motion } from "framer-motion";
import { Check, CheckCheck, Loader2, Play, Pause } from "lucide-react";
import SharedContentCard from "../SharedContentCard";
import VoiceMessage from "./VoiceMessage";
import { useMedia } from "../../context/MediaContext";

export default function MessageBubble({ 
  message, 
  isMe, 
  showStatus, 
  isFirstInGroup, 
  isLastInGroup,
  onLongPress,
  onReplyClick
}) {
  const { openMedia } = useMedia();
  
  // Adaptive rounding based on position in cluster
  const bubbleRadius = isMe 
    ? `rounded-[22px] ${isFirstInGroup ? 'rounded-tr-lg' : ''} ${isLastInGroup ? 'rounded-br-lg' : ''}`
    : `rounded-[22px] ${isFirstInGroup ? 'rounded-tl-lg' : ''} ${isLastInGroup ? 'rounded-bl-lg' : ''}`;

  const [timeLeft, setTimeLeft] = React.useState(null);

  React.useEffect(() => {
    if (!message.expires_at || message.is_deleted) return;
    
    const updateTimer = () => {
      const remaining = Math.max(0, Math.floor((new Date(message.expires_at).getTime() - Date.now()) / 1000));
      setTimeLeft(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [message.expires_at, message.is_deleted]);

  return (
    <div className={`flex flex-col w-full ${isMe ? 'items-end' : 'items-start'} mb-1`}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 5 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="max-w-[75%] sm:max-w-[70%] lg:max-w-[65%] relative group"
        onContextMenu={(e) => {
          e.preventDefault();
          if (onLongPress) onLongPress(message);
        }}
        whileTap={{ scale: 0.98 }}
      >
        {/* TTL Countdown Overlay */}
        {timeLeft !== null && timeLeft < 3600 && (
          <div className={`absolute top-0 ${isMe ? '-left-8' : '-right-8'} h-full flex items-center`}>
             <div className="flex flex-col items-center gap-0.5 opacity-20 group-hover:opacity-100 transition-opacity">
                <Clock size={10} className={timeLeft < 10 ? 'text-rose-500 animate-pulse' : 'text-amber-500'} />
                <span className={`text-[8px] font-black tracking-tighter ${timeLeft < 10 ? 'text-rose-500' : 'text-white'}`}>
                  {timeLeft}S
                </span>
             </div>
          </div>
        )}

        {/* Reply Context */}
        {message.reply_to && (
          <div 
            onClick={() => onReplyClick && onReplyClick(message.reply_to_id)}
            className={`
              mb-1 px-3 py-1.5 rounded-2xl text-[11px] opacity-40 italic truncate cursor-pointer hover:opacity-60 transition-opacity
              ${isMe ? 'bg-white/10 border-r-2 border-accent' : 'bg-white/5 border-l-2 border-white/20'}
            `}
          >
            {message.reply_to.is_deleted ? 'Message unsent' : message.reply_to.content}
          </div>
        )}

        {/* The Message Bubble */}
        <div className={`
          relative px-4 py-2.5 text-[15px] leading-relaxed shadow-sm transition-all duration-500
          ${isMe ? '' : 'text-zinc-100'}
          ${bubbleRadius}
          ${message.type === 'image' ? 'p-1' : ''}
        `}
        style={{
          background: isMe ? 'var(--chat-gradient)' : 'var(--chat-bubble-bg)',
          color: isMe ? 'white' : 'var(--chat-text)',
          boxShadow: isMe ? '0 4px 15px -3px var(--chat-accent-opaque)' : 'none'
        }}>
          {message.type === "image" ? (
            <div 
              className="relative group/img overflow-hidden rounded-xl bg-white/5 cursor-pointer"
              onClick={() => openMedia(message.content, 'image', { username: isMe ? 'You' : 'Neural Signal' })}
            >
              <img src={message.content} className="max-w-full block max-h-[300px] object-cover transition-transform group-hover/img:scale-105" alt="Neural Signal" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover/img:opacity-100 transition-all flex items-end p-3">
                 <span className="text-[10px] font-black uppercase tracking-widest">Signal Encrypted</span>
              </div>
            </div>
          ) : message.type === "voice" ? (
            <VoiceMessage url={message.content} isMe={isMe} />
          ) : message.type?.startsWith("shared_") ? (
            <SharedContentCard type={message.type} data={message.content} />
          ) : (
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          )}

          {/* Reactions Attached Below Bubble */}
          {message.reactions && message.reactions.length > 0 && (
            <div className={`
              absolute left-2 right-2 flex ${isMe ? 'justify-end' : 'justify-start'}
              translate-y-1/2 pointer-events-none z-10
            `}>
              <div className="flex gap-1 bg-zinc-900 border border-white/10 rounded-full px-1.5 py-0.5 text-[11px] shadow-xl pointer-events-auto">
                {Object.entries(
                  message.reactions.reduce((acc, r) => {
                    acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                    return acc;
                  }, {})
                ).map(([emoji, count]) => (
                  <span key={emoji} className="flex items-center gap-0.5">
                    {emoji} {count > 1 && <span className="text-[9px] opacity-60">{count}</span>}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Status Indicators */}
        {isMe && showStatus && (
          <div className="flex items-center gap-1.5 mt-1 mr-1 justify-end opacity-60">
            {message.status === "failed" ? (
              <span className="text-[9px] font-black uppercase tracking-[0.2em] flex items-center gap-1 text-red-500 cursor-pointer hover:underline" onClick={() => window.toast("Message will retry when online")}>
                FAILED (TAP TO RETRY)
              </span>
            ) : message.status === "sending" || message.is_optimistic ? (
              <span className="text-[9px] font-black uppercase tracking-[0.2em] flex items-center gap-1">
                <Loader2 size={10} className="animate-spin" /> SENDING
              </span>
            ) : (
              <div className="flex items-center gap-1">
                <span className="text-[9px] font-black uppercase tracking-[0.2em]">
                  {message.is_read ? "SEEN" : "SENT"}
                </span>
                {message.is_read ? <CheckCheck size={12} className="text-accent" /> : <Check size={12} />}
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
