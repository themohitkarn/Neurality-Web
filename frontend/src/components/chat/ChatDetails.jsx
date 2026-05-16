import React from "react";
import { motion } from "framer-motion";
import { 
  X, Phone, Video, Search, BellOff, 
  ChevronRight, Trash2, ShieldAlert, UserMinus,
  Grid, Clock, Palette, Type, Users, Image
} from "lucide-react";
import Avatar from "../Avatar";
import SharedMediaGrid from "./SharedMediaGrid";
import { chatApi } from "../../services/api";

export default function ChatDetails({ 
  contact, 
  settings, 
  onClose, 
  onUpdateSettings,
  onClearChat,
  onBlock
}) {
  const [sharedMedia, setSharedMedia] = React.useState([]);
  const [loadingMedia, setLoadingMedia] = React.useState(true);

  React.useEffect(() => {
    const fetchMedia = async () => {
      try {
        const res = await chatApi.getSharedMedia(contact.conversationId);
        setSharedMedia(res.data.media || []);
      } catch (err) {
        console.error("Failed to fetch media signals:", err);
      } finally {
        setLoadingMedia(false);
      }
    };
    if (contact.conversationId) fetchMedia();
  }, [contact.conversationId]);
  
  const sections = [
    { id: "theme", label: "Theme", icon: <Palette size={18} />, value: settings.theme_color || "Default", color: "text-purple-400" },
    { id: "disappearing", label: "Disappearing messages", icon: <Clock size={18} />, value: "Off", color: "text-amber-400" },
    { id: "nicknames", label: "Nicknames", icon: <Type size={18} />, value: null, color: "text-blue-400" },
    { id: "group", label: "Create a group chat", icon: <Users size={18} />, value: null, color: "text-sky-400" },
  ];

  const privacyActions = [
    { id: "restrict", label: "Restrict", icon: <ShieldAlert size={18} />, desc: "Move chat to requests", action: () => {} },
    { id: "block", label: "Block", icon: <UserMinus size={18} />, desc: "Prevent all interaction", action: onBlock, variant: "danger" },
    { id: "report", label: "Report", icon: <Trash2 size={18} />, desc: "Flag for moderation", action: () => {}, variant: "danger" },
  ];

  return (
    <div className="h-full w-full flex flex-col bg-bg-amoled overflow-hidden">
      {/* Header */}
      <header className="h-[72px] flex-shrink-0 px-4 border-b border-white/5 flex items-center justify-between bg-bg-amoled/80 backdrop-blur-xl">
        <h2 className="text-[15px] font-black uppercase tracking-widest text-white/50">Neural Details</h2>
        <button onClick={onClose} className="p-2.5 bg-white/5 hover:bg-white/10 rounded-full text-white/70 transition-all">
          <X size={20} />
        </button>
      </header>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-10 pb-20">
        
        {/* Profile Info */}
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-6">
            <Avatar 
              src={contact.group_pic || contact.profile_pic} 
              name={contact.username} 
              size="xl" 
              className="ring-8 ring-white/5 ring-offset-8 ring-offset-bg-amoled"
            />
            {!contact.is_group && (
              <span className="absolute bottom-2 right-2 w-6 h-6 bg-emerald-500 rounded-full border-[5px] border-bg-amoled" />
            )}
          </div>
          <h3 className="text-2xl font-black text-white mb-1 uppercase italic tracking-tighter">{contact.name || contact.username}</h3>
          <p className="text-xs font-black uppercase tracking-widest text-muted">@{contact.username}</p>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { icon: <Search size={20} />, label: "Search" },
            { icon: <Phone size={20} />, label: "Audio" },
            { icon: <Video size={20} />, label: "Video" },
            { icon: <BellOff size={20} />, label: "Mute" },
          ].map((action, i) => (
            <button key={i} className="flex flex-col items-center gap-2 group">
              <div className="w-full aspect-square rounded-2xl bg-white/5 flex items-center justify-center text-white/40 group-hover:bg-white/10 group-hover:text-white transition-all active:scale-90">
                {action.icon}
              </div>
              <span className="text-[10px] font-black uppercase tracking-tighter text-muted group-hover:text-white/60">{action.label}</span>
            </button>
          ))}
        </div>

        {/* Shared Media Grid Teaser */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
             <div className="flex items-center gap-2 text-white/40">
                <Image size={16} />
                <span className="text-[11px] font-black uppercase tracking-widest">Shared Signals</span>
             </div>
             <button className="text-[10px] font-black text-accent uppercase tracking-widest">See All</button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="aspect-square bg-white/5 rounded-xl border border-white/5 flex items-center justify-center">
                 <Grid size={20} className="text-white/5" />
              </div>
            ))}
          </div>
        </div>

        {/* Menu Sections */}
        <div className="space-y-1 bg-white/[0.02] border border-white/5 rounded-[32px] p-2">
          {sections.map((section, i) => (
            <button 
              key={i} 
              onClick={() => onUpdateSettings && onUpdateSettings(section.id)}
              className="w-full flex items-center justify-between p-4 rounded-3xl hover:bg-white/5 transition-all active:scale-[0.98]"
            >
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center ${section.color}`}>
                  {section.icon}
                </div>
                <div className="text-left">
                  <p className="text-[14px] font-bold text-white/90 leading-none mb-1">{section.label}</p>
                  <p className="text-[10px] uppercase font-black tracking-widest text-muted">
                    {section.id === 'disappearing' 
                      ? (settings.disappearing_timer === 0 ? "Off" : settings.disappearing_timer >= 3600 ? `${settings.disappearing_timer/3600}h` : "1m")
                      : section.value}
                  </p>
                </div>
              </div>
              <ChevronRight size={16} className="text-white/20" />
            </button>
          ))}
        </div>

        {/* Privacy & Safety Header */}
        <div className="px-1">
           <span className="text-[11px] font-black uppercase tracking-widest text-white/40">Privacy & Safety</span>
        </div>

        {/* Privacy Actions */}
        <div className="space-y-1 bg-white/[0.02] border border-white/5 rounded-[32px] p-2">
          {privacyActions.map((action, i) => (
            <button 
              key={i} 
              onClick={action.action}
              className={`w-full flex items-center justify-between p-4 rounded-3xl hover:bg-white/5 transition-all active:scale-[0.98] ${action.variant === 'danger' ? 'text-rose-500' : 'text-white/90'}`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center ${action.variant === 'danger' ? 'text-rose-500' : 'text-white/40'}`}>
                  {action.icon}
                </div>
                <div className="text-left">
                  <p className="text-[14px] font-bold leading-none mb-1">{action.label}</p>
                  <p className="text-[10px] uppercase font-black tracking-widest opacity-40">{action.desc}</p>
                </div>
              </div>
              <ChevronRight size={16} className="opacity-20" />
            </button>
          ))}
        </div>

        {/* Final Actions */}
        <div className="pt-4 border-t border-white/5 px-2 flex flex-col gap-2">
           <button onClick={onClearChat} className="w-full py-4 text-center text-[11px] font-black uppercase tracking-[0.2em] text-rose-500/60 hover:text-rose-500 transition-colors">
              Clear Neural History
           </button>
        </div>
      </div>
    </div>
  );
}
