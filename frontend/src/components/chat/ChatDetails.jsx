import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, Phone, Video, Search, BellOff, 
  ChevronRight, Trash2, ShieldAlert, UserMinus,
  Grid, Clock, Palette, Type, Users, Image, ArrowLeft,
  CheckCircle2, Plus, Info, Sparkles, ShieldCheck, Heart
} from "lucide-react";
import Avatar from "../Avatar";
import { chatApi, shareApi, getErrorMessage } from "../../services/api";
import { useSocket } from "../../context/SocketContext";
import { useTheme } from "../../context/ThemeContext";

export default function ChatDetails({ 
  contact, 
  settings, 
  onClose, 
  onUpdateSettings,
  onClearChat,
  onBlock
}) {
  const { socket } = useSocket();
  const { injectChatTheme } = useTheme();

  const [sharedMedia, setSharedMedia] = useState([]);
  const [loadingMedia, setLoadingMedia] = useState(true);
  const [activeSubpage, setActiveSubpage] = useState(null);

  // Subpage states
  const [activeTheme, setActiveTheme] = useState(settings.theme_color || "default");
  const [vanishTimer, setVanishTimer] = useState(settings.disappearing_timer || 0);
  const [nicknameInput, setNicknameInput] = useState("");
  const [loadingAction, setLoadingAction] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Group creation states
  const [groupName, setGroupName] = useState("");
  const [groupDesc, setGroupDesc] = useState("");
  const [groupPic, setGroupPic] = useState(null);
  const [groupPicPreview, setGroupPicPreview] = useState(null);
  const [followingUsers, setFollowingUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingFollows, setLoadingFollows] = useState(false);

  // Load shared media
  useEffect(() => {
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

  // Load following users for Group Creator
  useEffect(() => {
    if (activeSubpage === "group") {
      const fetchFollows = async () => {
        setLoadingFollows(true);
        try {
          const res = await shareApi.following();
          setFollowingUsers(res.data.following || []);
        } catch (err) {
          console.error("Failed to load following list for group creator:", err);
        } finally {
          setLoadingFollows(false);
        }
      };
      fetchFollows();
    }
  }, [activeSubpage]);

  // Sync state if settings prop changes
  useEffect(() => {
    if (settings.theme_color) setActiveTheme(settings.theme_color);
    if (settings.disappearing_timer !== undefined) setVanishTimer(settings.disappearing_timer);
  }, [settings]);

  const handleSelectTheme = (themeId) => {
    setActiveTheme(themeId);
    injectChatTheme(themeId);
    if (socket?.connected) {
      socket.emit("settings:update", {
        conversationId: contact.conversationId,
        key: "theme_id",
        value: themeId
      });
      // Show mini feedback
      showFeedback("Theme synced successfully!");
    }
  };

  const handleSelectVanish = (seconds) => {
    setVanishTimer(seconds);
    if (socket?.connected) {
      socket.emit("settings:update", {
        conversationId: contact.conversationId,
        key: "disappearing_timer",
        value: seconds
      });
      showFeedback("Vanish timer synced!");
    }
  };

  const handleSaveNickname = () => {
    if (socket?.connected) {
      socket.emit("settings:update", {
        conversationId: contact.conversationId,
        key: "nickname_peer",
        value: nicknameInput.trim()
      });
      showFeedback("Nickname saved!");
      setTimeout(() => setActiveSubpage(null), 1000);
    }
  };

  const showFeedback = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 2000);
  };

  // Group Create Flow
  const handleGroupPicChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setGroupPic(file);
      setGroupPicPreview(URL.createObjectURL(file));
    }
  };

  const handleToggleUser = (userId) => {
    setSelectedUsers(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!groupName.trim()) {
      setErrorMsg("Group Name is required");
      return;
    }
    setLoadingAction(true);
    setErrorMsg("");

    try {
      const payload = new FormData();
      payload.append("name", groupName.trim());
      payload.append("description", groupDesc.trim());
      payload.append("members", selectedUsers.join(","));
      if (groupPic) {
        payload.append("avatar", groupPic);
      }

      await chatApi.createGroup(payload);
      showFeedback("Group Chat established!");
      
      // Reset and go back
      setGroupName("");
      setGroupDesc("");
      setGroupPic(null);
      setGroupPicPreview(null);
      setSelectedUsers([]);
      setTimeout(() => {
        setActiveSubpage(null);
        onClose(); // Reload chat or redirect
      }, 1500);
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    } finally {
      setLoadingAction(false);
    }
  };

  const filteredUsers = followingUsers.filter(u => 
    u.username.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (u.full_name && u.full_name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="h-full w-full flex flex-col bg-bg-amoled overflow-hidden relative">
      
      {/* 1. Details Home Page */}
      <div className="h-full w-full flex flex-col bg-bg-amoled overflow-hidden">
        {/* Header */}
        <header className="h-[72px] flex-shrink-0 px-4 border-b border-white/5 flex items-center justify-between bg-bg-amoled/80 backdrop-blur-xl z-10">
          <h2 className="text-[15px] font-black uppercase tracking-widest text-white/50">Signal Identity</h2>
          <button onClick={onClose} className="p-2.5 bg-white/5 hover:bg-white/10 rounded-full text-white/70 transition-all active:scale-95">
            <X size={20} />
          </button>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8 pb-24 z-10">
          
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
            {sharedMedia.length === 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="aspect-square bg-white/5 rounded-2xl border border-white/5 flex items-center justify-center">
                     <Grid size={20} className="text-white/5" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {sharedMedia.slice(0, 3).map((item, idx) => (
                  <div key={idx} className="aspect-square rounded-2xl bg-zinc-900 overflow-hidden border border-white/5">
                    <img src={item.url} alt="Shared Signal" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Menu Sections */}
          <div className="space-y-1 bg-white/[0.02] border border-white/5 rounded-[32px] p-2">
            {[
              { id: "theme", label: "Bubble Theme", icon: <Palette size={18} />, value: activeTheme, color: "text-purple-400" },
              { id: "disappearing", label: "Disappearing timer", icon: <Clock size={18} />, value: vanishTimer === 0 ? "Off" : vanishTimer >= 86400 ? `${vanishTimer/86400}d` : vanishTimer >= 3600 ? `${vanishTimer/3600}h` : "1m", color: "text-amber-400" },
              { id: "nicknames", label: "Custom Nicknames", icon: <Type size={18} />, value: settings.nickname_peer || "Not set", color: "text-blue-400" },
              { id: "group", label: "Create Group Chat", icon: <Users size={18} />, value: "Multi-user", color: "text-sky-400" },
            ].map((section, i) => (
              <button 
                key={i} 
                onClick={() => setActiveSubpage(section.id)}
                className="w-full flex items-center justify-between p-4 rounded-3xl hover:bg-white/5 transition-all active:scale-[0.98]"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center ${section.color}`}>
                    {section.icon}
                  </div>
                  <div className="text-left">
                    <p className="text-[14px] font-bold text-white/90 leading-none mb-1">{section.label}</p>
                    <p className="text-[10px] uppercase font-black tracking-widest text-muted">{section.value}</p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-white/20" />
              </button>
            ))}
          </div>

          {/* Privacy Actions */}
          <div className="space-y-1 bg-white/[0.02] border border-white/5 rounded-[32px] p-2">
            {[
              { id: "restrict", label: "Restrict", icon: <ShieldAlert size={18} />, desc: "Move chat to requests", action: () => alert("User restricted. Signals sent will go to requests folder.") },
              { id: "block", label: "Block Profile", icon: <UserMinus size={18} />, desc: "Prevent all direct mutes", action: onBlock, variant: "danger" },
            ].map((action, i) => (
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

          {/* Final Action */}
          <div className="pt-4 border-t border-white/5 px-2 flex flex-col gap-2">
             <button onClick={onClearChat} className="w-full py-4 text-center text-[11px] font-black uppercase tracking-[0.2em] text-rose-500/60 hover:text-rose-500 transition-colors">
                Clear Neural History
             </button>
          </div>
        </div>
      </div>

      {/* 2. SLIDING SUBPAGES */}
      <AnimatePresence>
        {activeSubpage && (
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 220 }}
            className="absolute inset-0 bg-bg-amoled z-20 flex flex-col"
          >
            {/* Subpage Header */}
            <header className="h-[72px] flex-shrink-0 px-4 border-b border-white/5 flex items-center gap-3 bg-bg-amoled/80 backdrop-blur-xl">
              <button 
                onClick={() => { setActiveSubpage(null); setErrorMsg(""); }} 
                className="p-2.5 bg-white/5 hover:bg-white/10 rounded-full text-white/70 transition-all"
              >
                <ArrowLeft size={18} />
              </button>
              <h2 className="text-[15px] font-black uppercase tracking-widest text-white capitalize">
                {activeSubpage === "theme" && "Theme Selector"}
                {activeSubpage === "disappearing" && "Vanish Mode Timer"}
                {activeSubpage === "nicknames" && "Edit Nicknames"}
                {activeSubpage === "group" && "Create Group Chat"}
              </h2>
            </header>

            {/* Subpage Alerts */}
            {successMsg && (
              <div className="m-4 flex items-center gap-2 rounded-2xl bg-emerald-500/10 px-4 py-3 text-xs text-emerald-500 border border-emerald-500/20">
                <CheckCircle2 size={16} />
                <span>{successMsg}</span>
              </div>
            )}
            {errorMsg && (
              <div className="m-4 flex items-center gap-2 rounded-2xl bg-rose-500/10 px-4 py-3 text-xs text-rose-500 border border-rose-500/20">
                <Info size={16} />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Subpage Content Router */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
              
              {/* 2A. Theme Selection Subpage */}
              {activeSubpage === "theme" && (
                <div className="space-y-4">
                  <p className="text-xs text-muted leading-relaxed">
                    Personalize conversation bubbles with modern high-contrast color palettes. This will immediately update for all participants.
                  </p>
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    {[
                      { id: "default", label: "Classic Indigo", color: "bg-indigo-500" },
                      { id: "matcha", label: "Matcha Green", color: "bg-emerald-500" },
                      { id: "lavender", label: "Lavender Purple", color: "bg-purple-500" },
                      { id: "cyber", label: "Cyber Pink", color: "bg-pink-500" },
                      { id: "sunset", label: "Sunset Orange", color: "bg-orange-500" },
                      { id: "ocean", label: "Deep Ocean", color: "bg-blue-600" },
                      { id: "bubblegum", label: "Bubblegum Pink", color: "bg-rose-400" },
                    ].map(t => {
                      const active = activeTheme === t.id;
                      return (
                        <button
                          key={t.id}
                          onClick={() => handleSelectTheme(t.id)}
                          className={`p-4 rounded-3xl border flex items-center gap-3 text-left transition-all ${
                            active 
                              ? "border-accent bg-white/5 ring-1 ring-accent" 
                              : "border-white/5 bg-white/[0.02] hover:bg-white/5"
                          }`}
                        >
                          <div className={`w-6 h-6 rounded-full ${t.color} flex items-center justify-center shrink-0`}>
                            {active && <CheckCircle2 size={12} className="text-white fill-emerald-500" />}
                          </div>
                          <span className="text-xs font-bold text-white/90">{t.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 2B. Disappearing messages timer selection */}
              {activeSubpage === "disappearing" && (
                <div className="space-y-4">
                  <p className="text-xs text-muted leading-relaxed">
                    Assign a duration for which messages reside inside this inbox. After the specified time passes since message delivery, the messages evaporate.
                  </p>
                  <div className="space-y-2 pt-2 bg-white/[0.02] border border-white/5 rounded-[32px] p-2">
                    {[
                      { seconds: 0, label: "Off (Infinite Persistence)" },
                      { seconds: -1, label: "Vanish Mode (Once Seen)" },
                      { seconds: 60, label: "1 Minute" },
                      { seconds: 3600, label: "1 Hour" },
                      { seconds: 86400, label: "24 Hours (1 Day)" },
                      { seconds: 604800, label: "7 Days (1 Week)" },
                    ].map(opt => {
                      const active = vanishTimer === opt.seconds;
                      return (
                        <button
                          key={opt.seconds}
                          onClick={() => handleSelectVanish(opt.seconds)}
                          className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all ${
                            active ? "bg-white/5 text-accent font-bold" : "text-white/80 hover:bg-white/[0.02]"
                          }`}
                        >
                          <span className="text-xs">{opt.label}</span>
                          {active && <CheckCircle2 size={16} className="text-accent" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 2C. Nickname Editing Subpage */}
              {activeSubpage === "nicknames" && (
                <div className="space-y-4">
                  <p className="text-xs text-muted leading-relaxed">
                    Set a custom local nickname for {contact.username} inside this specific direct message path.
                  </p>
                  
                  <div className="panel p-5 space-y-4 bg-white/[0.02] border border-white/5 rounded-3xl">
                    <div className="flex items-center gap-3 mb-2">
                      <Avatar src={contact.profile_pic} name={contact.username} size="sm" />
                      <div>
                        <p className="text-xs font-semibold text-white/90">Current User Identity</p>
                        <p className="text-[10px] text-muted">@{contact.username}</p>
                      </div>
                    </div>
                    <input
                      type="text"
                      value={nicknameInput}
                      onChange={(e) => setNicknameInput(e.target.value)}
                      placeholder={`Assign nickname for ${contact.username}...`}
                      className="w-full bg-white/5 border border-white/5 rounded-xl py-3 px-4 text-xs focus:bg-white/10 outline-none text-white font-bold"
                    />
                    
                    <button
                      onClick={handleSaveNickname}
                      className="w-full py-3.5 rounded-xl bg-accent text-white font-bold text-xs transition-all active:scale-95 shadow-md shadow-accent/20"
                    >
                      Save Nickname
                    </button>
                  </div>
                </div>
              )}

              {/* 2D. Group Creator Subpage */}
              {activeSubpage === "group" && (
                <form onSubmit={handleCreateGroup} className="space-y-5">
                  {/* Setup Name, Pic */}
                  <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-3xl bg-white/[0.02] border border-white/5">
                    <div className="relative group cursor-pointer shrink-0">
                      <div className="w-16 h-16 rounded-full bg-white/5 border border-white/5 flex items-center justify-center overflow-hidden">
                        {groupPicPreview ? (
                          <img src={groupPicPreview} alt="Group Preview" className="w-full h-full object-cover" />
                        ) : (
                          <Users size={24} className="text-white/40" />
                        )}
                      </div>
                      <label className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                        <Plus size={16} className="text-white" />
                        <input type="file" accept="image/*" onChange={handleGroupPicChange} className="hidden" />
                      </label>
                    </div>

                    <div className="flex-1 space-y-2 w-full">
                      <input
                        type="text"
                        value={groupName}
                        onChange={(e) => setGroupName(e.target.value)}
                        placeholder="Group Name (e.g. Aura Orbit)"
                        className="w-full bg-white/5 border border-white/5 rounded-xl py-2.5 px-4 text-xs focus:bg-white/10 outline-none text-white font-bold"
                        required
                      />
                      <input
                        type="text"
                        value={groupDesc}
                        onChange={(e) => setGroupDesc(e.target.value)}
                        placeholder="Description (Optional)"
                        className="w-full bg-white/5 border border-white/5 rounded-xl py-2 px-4 text-[10px] focus:bg-white/10 outline-none text-white"
                      />
                    </div>
                  </div>

                  {/* Users search */}
                  <div className="space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-wider text-white/40">Select Members ({selectedUsers.length})</p>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search followers..."
                      className="w-full bg-white/5 border border-white/5 rounded-xl py-2.5 px-4 text-xs focus:bg-white/10 outline-none text-white"
                    />

                    {loadingFollows ? (
                      <p className="text-xs text-muted text-center py-4">Scanning followers...</p>
                    ) : filteredUsers.length === 0 ? (
                      <p className="text-xs text-muted text-center py-4">No followers match search</p>
                    ) : (
                      <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                        {filteredUsers.map(u => {
                          const isSelected = selectedUsers.includes(u.id);
                          return (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => handleToggleUser(u.id)}
                              className={`w-full flex items-center justify-between p-3 rounded-2xl border text-left transition-all ${
                                isSelected 
                                  ? "border-accent bg-accent/[0.03] text-white" 
                                  : "border-white/5 bg-white/[0.01] hover:bg-white/5 text-white/70"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <Avatar src={u.profile_pic} name={u.username} size="sm" />
                                <div>
                                  <span className="text-xs font-bold block">{u.full_name || u.username}</span>
                                  <span className="text-[9px] text-muted block">@{u.username}</span>
                                </div>
                              </div>
                              <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                                isSelected ? "bg-accent border-accent text-white" : "border-white/20"
                              }`}>
                                {isSelected && <CheckCircle2 size={12} />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={loadingAction}
                    className="w-full py-4 rounded-2xl bg-accent text-white font-bold text-xs transition-all active:scale-95 shadow-md shadow-accent/20 flex items-center justify-center gap-2"
                  >
                    <Sparkles size={14} />
                    {loadingAction ? "Establishing Signal..." : "Establish Group Signal"}
                  </button>
                </form>
              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
    </div>
  );
}
