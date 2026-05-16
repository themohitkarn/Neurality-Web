import { useState, useEffect, useRef } from "react";
import { Search, X, Send, UserPlus, Users, Plus, Check, MessageSquare } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import BottomSheet from "./BottomSheet";
import Avatar from "./Avatar";
import { shareApi, getErrorMessage } from "../services/api";
import { hapticMedium, hapticLight } from "../utils/capacitor";

export default function ShareSheet({ open, onClose, contentType, contentId, title, onAddStory }) {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState([]);
  const [recentChats, setRecentChats] = useState([]);
  const [following, setFollowing] = useState([]);
  const [suggested, setSuggested] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  
  const searchTimeout = useRef(null);

  useEffect(() => {
    if (open) {
      fetchInitialData();
    } else {
      setQuery("");
      setUsers([]);
      setSelectedIds([]);
    }
  }, [open]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [recentRes, followingRes, suggestedRes] = await Promise.all([
        shareApi.recentChats(),
        shareApi.following(),
        shareApi.suggestedUsers()
      ]);
      setRecentChats(recentRes.data.users || []);
      setFollowing(followingRes.data.users || []);
      setSuggested(suggestedRes.data.users || []);
    } catch (err) {
      console.error("Fetch share data error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (val) => {
    setQuery(val);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    
    if (!val.trim()) {
      setUsers([]);
      return;
    }

    searchTimeout.current = setTimeout(async () => {
      try {
        const { data } = await shareApi.searchUsers(val);
        setUsers(data.users || []);
      } catch (err) {
        console.error("Search error:", err);
      }
    }, 400);
  };

  const toggleSelect = (id) => {
    hapticLight();
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSend = async () => {
    if (selectedIds.length === 0 || sending) return;
    setSending(true);
    try {
      const payload = {
        user_ids: selectedIds,
        [contentType === "beat" ? "reel_id" : "post_id"]: contentId,
      };
      await shareApi.sendShare(payload);
      hapticMedium();
      onClose();
    } catch (err) {
      alert(getErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  const renderUserItem = (user) => {
    const isSelected = selectedIds.includes(user.id);
    return (
      <button
        key={user.id}
        onClick={() => toggleSelect(user.id)}
        className="flex items-center gap-3 w-full p-2 rounded-2xl transition-colors hover:bg-[rgba(255,255,255,0.05)] active:scale-[0.98]"
      >
        <div className="relative">
          <Avatar src={user.profile_pic} name={user.username} size="md" />
          {isSelected && (
            <div className="absolute -bottom-1 -right-1 bg-blue-500 rounded-full p-1 border-2 border-black">
              <Check size={10} strokeWidth={4} className="text-white" />
            </div>
          )}
        </div>
        <div className="flex-1 text-left">
          <p className="text-sm font-bold text-white">{user.username}</p>
          <p className="text-xs text-[color:var(--text-muted)]">{user.full_name || "Neurality User"}</p>
        </div>
        <div 
          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? "bg-blue-500 border-blue-500" : "border-white/20"}`}
        >
          {isSelected && <Check size={14} strokeWidth={3} className="text-white" />}
        </div>
      </button>
    );
  };

  return (
    <BottomSheet 
      open={open} 
      onClose={onClose} 
      title={null}
      maxHeight="85vh"
    >
      <div className="flex flex-col h-full bg-[#0a0a0a]">
        {/* Search Bar */}
        <div className="px-4 py-2 border-b border-white/5">
          <div className="relative flex items-center bg-[rgba(255,255,255,0.08)] rounded-2xl px-4 py-3 group focus-within:bg-[rgba(255,255,255,0.12)] transition-all">
            <Search size={18} className="text-zinc-500 group-focus-within:text-white" />
            <input 
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search people..."
              className="flex-1 bg-transparent border-none outline-none text-sm ml-3 text-white placeholder-zinc-500"
            />
            {query && (
              <button onClick={() => handleSearch("")} className="text-zinc-500 hover:text-white">
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Shortcuts Bar (Horizontal) */}
        <div className="flex items-center gap-6 px-6 py-4 overflow-x-auto scrollbar-hide border-b border-white/5">
          {/* Add to Story */}
          <button 
            onClick={() => { onClose(); onAddStory?.(); hapticMedium(); }}
            className="flex flex-col items-center gap-2 shrink-0 group"
          >
            <div className="w-14 h-14 rounded-full border-2 border-dashed border-zinc-700 flex items-center justify-center text-zinc-400 group-hover:border-white group-hover:text-white transition-all">
              <Plus size={24} />
            </div>
            <span className="text-[10px] font-bold text-zinc-400 group-hover:text-white uppercase tracking-wider">Add story</span>
          </button>

          {/* Recent Selected chips */}
          <AnimatePresence>
            {selectedIds.map(id => {
              const user = [...users, ...recentChats, ...following, ...suggested].find(u => u.id === id);
              if (!user) return null;
              return (
                <motion.button
                  key={id}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  onClick={() => toggleSelect(id)}
                  className="flex flex-col items-center gap-2 shrink-0"
                >
                  <div className="relative">
                    <Avatar src={user.profile_pic} name={user.username} size="md" className="ring-2 ring-blue-500" />
                    <div className="absolute -top-1 -right-1 bg-zinc-800 rounded-full p-1 border border-white/10">
                      <X size={10} className="text-white" />
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">Selected</span>
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>

        {/* User List */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {query ? (
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[2px] mb-2 px-2">Search Results</p>
              {users.length > 0 ? users.map(renderUserItem) : (
                <div className="flex flex-col items-center justify-center py-20 opacity-40">
                  <UserPlus size={48} strokeWidth={1} />
                  <p className="mt-4 text-sm font-medium">No users found</p>
                </div>
              )}
            </div>
          ) : (
            <>
              {recentChats.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[2px] mb-2 px-2">Recent Chats</p>
                  {recentChats.map(renderUserItem)}
                </div>
              )}

              {suggested.length > 0 && (
                <div className="space-y-1 pt-2">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[2px] mb-2 px-2">Suggested</p>
                  {suggested.map(renderUserItem)}
                </div>
              )}
              
              {following.length > 0 && (
                <div className="space-y-1 pt-2">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[2px] mb-2 px-2">Following</p>
                  {following.map(renderUserItem)}
                </div>
              )}
            </>
          )}
        </div>

        {/* Send Button Overlay */}
        <AnimatePresence>
          {selectedIds.length > 0 && (
            <motion.div 
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              className="absolute bottom-0 inset-x-0 p-6 bg-gradient-to-t from-black to-transparent"
            >
              <button
                onClick={handleSend}
                disabled={sending}
                className="w-full flex items-center justify-center gap-3 bg-white text-black h-14 rounded-[20px] font-black uppercase tracking-widest text-sm shadow-[0_20px_40px_rgba(255,255,255,0.15)] disabled:opacity-50 active:scale-[0.98] transition-transform"
              >
                {sending ? (
                  <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                ) : (
                  <>
                    <Send size={18} />
                    <span>Send to {selectedIds.length} {selectedIds.length === 1 ? "person" : "people"}</span>
                  </>
                )}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </BottomSheet>
  );
}
