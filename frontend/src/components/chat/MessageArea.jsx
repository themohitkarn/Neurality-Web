import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import MessageBubble from "./MessageBubble";
import { X } from "lucide-react";

export default function MessageArea({ 
  messages, 
  user, 
  chatSummary, 
  onCloseSummary, 
  setReactingTo,
  onReplyClick,
  messagesEndRef,
  chatContainerRef
}) {
  return (
    <div 
      ref={chatContainerRef}
      className="flex-1 min-h-0 overflow-y-auto px-4 py-6 space-y-4 no-scrollbar bg-[url('/grid-dark.png')] bg-fixed"
    >
      <AnimatePresence>
        {chatSummary && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mb-6 p-4 bg-accent/5 border border-accent/10 rounded-3xl relative"
          >
            <button 
              onClick={onCloseSummary} 
              className="absolute top-3 right-3 text-white/20 hover:text-white"
            >
              <X size={14} />
            </button>
            <p className="text-[10px] uppercase font-black tracking-widest text-accent mb-1">Neural Summary</p>
            <p className="text-xs text-white/70 italic leading-relaxed">"{chatSummary}"</p>
          </motion.div>
        )}
      </AnimatePresence>

      {messages.map((msg, i) => {
        const isFirst = i === 0 || messages[i-1].sender_id !== msg.sender_id;
        const isLast = i === messages.length - 1 || messages[i+1].sender_id !== msg.sender_id;
        
        return (
          <div key={msg.id || i} id={`msg-${msg.id}`}>
            <MessageBubble 
              message={msg} 
              isMe={msg.sender_id === user?.id}
              isFirstInGroup={isFirst}
              isLastInGroup={isLast}
              showStatus={isLast && msg.sender_id === user?.id}
              onLongPress={setReactingTo}
              onReplyClick={onReplyClick}
            />
          </div>
        );
      })}
      
      <div ref={messagesEndRef} className="h-4" />
    </div>
  );
}
