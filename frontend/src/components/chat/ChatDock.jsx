import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Camera, Mic, Image as ImageIcon, 
  Smile, Plus, Send, X, StopCircle, Loader2, Play
} from "lucide-react";

export default function ChatDock({ 
  onSend, 
  onCamera, 
  onMedia, 
  onStickers,
  onTyping,
  isConnected,
  isMediaTrayOpen,
  setIsMediaTrayOpen,
  replyTo,
  onCancelReply
}) {
  const [text, setText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const [pendingVoice, setPendingVoice] = useState(null);
  const [pendingMedia, setPendingMedia] = useState(null);
  const textareaRef = useRef(null);
  const timerRef = useRef(null);

  const [audioRecorder, setAudioRecorder] = useState(null);
  const mediaInputRef = useRef(null);

  // Auto-expand textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [text]);

  const handleSend = (e) => {
    e?.preventDefault();
    if (pendingVoice) {
      onSend("[Voice Signal]", "voice", { blob: pendingVoice });
      setPendingVoice(null);
      return;
    }
    if (pendingMedia) {
      onSend("[Media Signal]", pendingMedia.type.startsWith('video') ? "video" : "image", { file: pendingMedia });
      setPendingMedia(null);
      return;
    }
    if (!text.trim() || !isConnected) return;
    onSend(text.trim(), "text");
    setText("");
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/ogg; codecs=opus' });
        setPendingVoice(blob);
        setIsRecording(false);
        setRecordTime(0);
        clearInterval(timerRef.current);
      };
      recorder.start();
      setAudioRecorder(recorder);
      setIsRecording(true);
      setRecordTime(0);
      timerRef.current = setInterval(() => setRecordTime(t => t + 1), 1000);
    } catch (err) {
      console.error("Mic access denied:", err);
    }
  };

  const stopRecording = () => {
    if (audioRecorder) {
      audioRecorder.stop();
      audioRecorder.stream.getTracks().forEach(t => t.stop());
    }
  };

  const handleMediaSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPendingMedia(file);
    }
  };

  const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="w-full bg-bg-amoled border-t border-white/5 pb-[max(env(safe-area-inset-bottom),8px)] pt-2">
      {/* Reply Preview */}
      <AnimatePresence>
        {replyTo && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mx-4 mb-2 bg-white/5 rounded-2xl p-3 border border-white/10 flex items-center justify-between"
          >
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase text-accent tracking-widest">Replying to</p>
              <p className="text-xs text-white/50 truncate italic">{replyTo.content}</p>
            </div>
            <button onClick={onCancelReply} className="p-1.5 bg-white/5 rounded-full hover:bg-white/10 text-white/50"><X size={14} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-end gap-2 px-3">
        {/* Main Dock */}
        <div className={`
          flex-1 flex items-end gap-2 bg-white/5 rounded-[28px] px-3 py-1.5 transition-all
          ${isRecording ? 'bg-accent/10 border-accent/20' : 'border border-white/5 focus-within:bg-white/[0.08]'}
        `}>
          
          <button
            onClick={onCamera}
            className="w-10 h-10 flex-shrink-0 bg-accent text-white rounded-full flex items-center justify-center active:scale-90 transition-all shadow-lg shadow-accent/20"
          >
            <Camera size={20} />
          </button>

          {!isRecording && !pendingVoice && !pendingMedia ? (
            <textarea
              ref={textareaRef}
              rows={1}
              value={text}
              onChange={(e) => { setText(e.target.value); onTyping(e.target.value.length > 0); }}
              placeholder="Neural message..."
              className="flex-1 bg-transparent border-none focus:ring-0 text-[15px] py-2.5 text-white placeholder-white/30 resize-none max-h-[120px] leading-tight"
            />
          ) : isRecording ? (
            <div className="flex-1 py-2.5 flex items-center gap-3 overflow-hidden">
              <div className="flex items-center gap-1 h-4">
                {[...Array(12)].map((_, i) => (
                  <motion.div 
                    key={i}
                    animate={{ height: [4, 16, 4] }}
                    transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.05 }}
                    className="w-0.5 bg-accent rounded-full"
                  />
                ))}
              </div>
              <span className="text-sm font-black text-white/80">{formatTime(recordTime)}</span>
              <span className="text-[10px] uppercase font-black tracking-widest text-accent animate-pulse">Recording Signal...</span>
            </div>
          ) : pendingVoice ? (
            <div className="flex-1 flex items-center gap-4 bg-white/5 px-4 py-2 rounded-2xl border border-white/10">
              <button 
                onClick={() => setPendingVoice(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center bg-white/10 text-white/40 hover:text-white"
              >
                <X size={16} />
              </button>
              <div className="flex-1 flex items-center gap-2">
                <Play size={14} fill="currentColor" className="text-accent" />
                <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: 1.5 }} className="h-full bg-accent" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Audit</span>
              </div>
            </div>
          ) : (
            <div className="flex-1 py-1.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl overflow-hidden bg-white/10 border border-white/10">
                  {pendingMedia.type.startsWith('image') ? (
                    <img src={URL.createObjectURL(pendingMedia)} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-zinc-800"><Loader2 className="animate-spin text-white/20" size={16} /></div>
                  )}
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Media Ready</span>
              </div>
              <button onClick={() => setPendingMedia(null)} className="p-2 text-white/40 hover:text-white"><X size={16} /></button>
            </div>
          )}

          <div className="flex items-center gap-0.5 mb-1">
            <input type="file" ref={mediaInputRef} onChange={handleMediaSelect} className="hidden" accept="image/*,video/*" />
            <AnimatePresence mode="popLayout">
              {!text.trim() && !isRecording && (
                <>
                  <motion.button 
                    initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                    onClick={startRecording}
                    className="p-2 text-white/40 hover:text-white"
                  >
                    <Mic size={20} />
                  </motion.button>
                  <motion.button 
                    initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                    onClick={() => mediaInputRef.current?.click()}
                    className="p-2 text-white/40 hover:text-white"
                  >
                    <ImageIcon size={20} />
                  </motion.button>
                </>
              )}
            </AnimatePresence>
            
            {isRecording && (
              <button onClick={stopRecording} className="p-2 text-accent animate-bounce"><StopCircle size={22} /></button>
            )}

            {!isRecording && (
              <>
                <button onClick={onStickers} className="p-2 text-white/40 hover:text-white"><Smile size={20} /></button>
                <button onClick={() => setIsMediaTrayOpen(!isMediaTrayOpen)} className="p-2 text-white/40 hover:text-white"><Plus size={20} /></button>
              </>
            )}
          </div>
        </div>

        {/* Send Button */}
        <AnimatePresence>
          {(text.trim() || pendingVoice || pendingMedia) && (
            <motion.button
              initial={{ scale: 0, width: 0 }}
              animate={{ scale: 1, width: 44 }}
              exit={{ scale: 0, width: 0 }}
              onClick={handleSend}
              className="w-11 h-11 bg-accent text-white rounded-full flex items-center justify-center shadow-lg shadow-accent/20 flex-shrink-0"
            >
              <Send size={18} />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
