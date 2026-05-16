import React from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Phone, Video, Info } from "lucide-react";
import Avatar from "../Avatar";

export default function ChatHeader({ 
  contact, 
  typingUserId, 
  onBack, 
  onDetails, 
  onCall 
}) {
  return (
    <header className="h-[72px] px-4 border-b border-white/5 flex items-center gap-3 bg-bg-amoled/80 backdrop-blur-3xl z-30 sticky top-0">
      {/* Mobile Back Button */}
      <button 
        onClick={onBack}
        className="lg:hidden p-2 -ml-2 text-white/70 hover:text-white active:scale-90 transition-all"
      >
        <ArrowLeft size={24} />
      </button>
      
      {/* Profile Info */}
      <div className="flex-1 flex items-center gap-3 cursor-pointer" onClick={onDetails}>
        <div className="relative">
          <Avatar src={contact.profile_pic} name={contact.username} size="md" />
          {!contact.is_group && (
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-bg-amoled" />
          )}
        </div>
        <div className="min-w-0">
          <h2 className="text-[15px] font-bold truncate text-white leading-none mb-1">
            {contact.name || contact.username}
          </h2>
          <div className="text-[10px] uppercase font-black tracking-widest">
            {typingUserId ? (
              <span className="text-accent animate-pulse">Neural Typing...</span>
            ) : (
              <span className="text-muted">Verified Neurality</span>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-1">
        <button 
          onClick={() => onCall("audio")} 
          className="w-10 h-10 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 rounded-xl transition-all"
        >
          <Phone size={20} />
        </button>
        <button 
          onClick={() => onCall("video")} 
          className="w-10 h-10 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 rounded-xl transition-all"
        >
          <Video size={20} />
        </button>
        <button 
          onClick={onDetails} 
          className="w-10 h-10 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 rounded-xl transition-all"
        >
          <Info size={20} />
        </button>
      </div>
    </header>
  );
}
