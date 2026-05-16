import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Camera, Mic, Image as ImageIcon, 
  Smile, Plus, Send, X, Paperclip 
} from "lucide-react";

export default function ChatInput({ 
  onSend, 
  onCamera, 
  onMedia, 
  onVoice, 
  onStickers,
  onTyping,
  isConnected,
  isMediaTrayOpen,
  setIsMediaTrayOpen
}) {
  const [text, setText] = useState("");
  const textareaRef = useRef(null);

  // Auto-expand textarea (max 5 lines)
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [text]);

  const handleSend = (e) => {
    e?.preventDefault();
    if (!text.trim() || !isConnected) return;
    onSend(text.trim());
    setText("");
  };

  const handleChange = (e) => {
    setText(e.target.value);
    if (onTyping) onTyping(e.target.value.length > 0);
  };

  return (
    <div className="w-full relative z-40 bg-bg-amoled lg:bg-transparent">
      <div className="flex items-end gap-2 max-w-4xl mx-auto px-1 py-2">
        
        {/* Mobile: Floating Style | Desktop: Integrated */}
        <div className="flex-1 flex items-end gap-2 bg-white/5 lg:bg-surface border border-white/5 rounded-[28px] px-3 py-1.5 transition-all focus-within:bg-white/[0.08] focus-within:border-white/10">
          
          {/* Camera - Always visible but styled subtly */}
          <button
            onClick={onCamera}
            className="p-2.5 bg-accent text-white rounded-full flex-shrink-0 active:scale-90 transition-all shadow-lg shadow-accent/20"
          >
            <Camera size={20} />
          </button>

          <textarea
            ref={textareaRef}
            rows={1}
            value={text}
            onChange={handleChange}
            placeholder="Message..."
            className="flex-1 bg-transparent border-none focus:ring-0 text-[15px] py-2.5 text-white placeholder-white/30 resize-none max-h-[120px] leading-tight"
          />

          <div className="flex items-center gap-0.5 mb-1">
            <AnimatePresence mode="popLayout">
              {!text.trim() && (
                <>
                  <motion.button initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} onClick={onVoice} className="p-2 text-white/40 hover:text-white"><Mic size={20} /></motion.button>
                  <motion.button initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} onClick={onMedia} className="p-2 text-white/40 hover:text-white"><ImageIcon size={20} /></motion.button>
                </>
              )}
            </AnimatePresence>
            
            <button onClick={onStickers} className="p-2 text-white/40 hover:text-white"><Smile size={20} /></button>
            <button onClick={() => setIsMediaTrayOpen(!isMediaTrayOpen)} className="p-2 text-white/40 hover:text-white"><Plus size={20} /></button>
          </div>
        </div>

        {/* Send Button (Pops out when text exists) */}
        <AnimatePresence>
          {text.trim() && (
            <motion.button
              initial={{ scale: 0, width: 0 }}
              animate={{ scale: 1, width: 44 }}
              exit={{ scale: 0, width: 0 }}
              onClick={handleSend}
              className="h-11 bg-accent text-white rounded-full flex items-center justify-center shadow-lg shadow-accent/20 overflow-hidden"
            >
              <Send size={18} className="ml-0.5" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
