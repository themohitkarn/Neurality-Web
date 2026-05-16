import { useState, useEffect } from "react";
import { X, Camera, Users, Search, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Avatar from "./Avatar";
import { chatApi, userApi, getErrorMessage } from "../services/api";

export default function GroupCreator({ isOpen, onClose, onCreated }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [groupPic, setGroupPic] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (searchQuery.trim().length > 1) {
      const delayDebounce = setTimeout(async () => {
        try {
          const { data } = await userApi.search(searchQuery);
          setSearchResults(data.users || []);
        } catch (err) {
          console.error(err);
        }
      }, 300);
      return () => clearTimeout(delayDebounce);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const toggleUser = (user) => {
    if (selectedUsers.find(u => u.id === user.id)) {
      setSelectedUsers(selectedUsers.filter(u => u.id !== user.id));
    } else {
      setSelectedUsers([...selectedUsers, user]);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setGroupPic(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return setError("Group name is required");
    if (selectedUsers.length === 0) return setError("Add at least one member");

    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("name", name);
      formData.append("description", description);
      if (groupPic) formData.append("group_pic", groupPic);
      selectedUsers.forEach(u => formData.append("members", u.id));

      const { data } = await chatApi.createGroup(formData);
      onCreated && onCreated(data.group);
      handleClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setName("");
    setDescription("");
    setSelectedUsers([]);
    setGroupPic(null);
    setPreviewUrl(null);
    setSearchQuery("");
    setError("");
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="w-full max-w-lg bg-[color:var(--bg-card)] rounded-[32px] border border-[color:var(--border)] overflow-hidden shadow-2xl"
          >
            <div className="flex items-center justify-between p-6 border-b border-[color:var(--border)]">
              <h2 className="text-xl font-bold">Create Group</h2>
              <button onClick={handleClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              {/* Group Avatar Upload */}
              <div className="flex flex-col items-center gap-3">
                <div 
                  className="relative group cursor-pointer"
                  onClick={() => document.getElementById('group-pic-input').click()}
                >
                  {previewUrl ? (
                    <img src={previewUrl} className="w-24 h-24 rounded-full object-cover border-4 border-[color:var(--accent)]" alt="Preview" />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center text-zinc-500 border-2 border-dashed border-white/20">
                      <Camera size={32} />
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera size={24} className="text-white" />
                  </div>
                  <input type="file" id="group-pic-input" className="hidden" accept="image/*" onChange={handleFileChange} />
                </div>
                <span className="text-xs text-zinc-500 font-medium">Group Profile Picture</span>
              </div>

              <div className="space-y-4">
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Group Name"
                  className="field text-lg font-semibold"
                />
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Description (optional)"
                  className="field min-h-[80px] resize-none py-3"
                />
              </div>

              {/* Member Selection */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-bold text-zinc-400 uppercase tracking-widest">Add Members</label>
                  <span className="text-xs font-bold text-[color:var(--accent)] bg-[color:var(--accent-soft)] px-2 py-0.5 rounded-full">
                    {selectedUsers.length} Selected
                  </span>
                </div>

                {/* Selected User Pills */}
                {selectedUsers.length > 0 && (
                  <div className="flex flex-wrap gap-2 py-2">
                    {selectedUsers.map(u => (
                      <div key={u.id} className="flex items-center gap-1.5 bg-white/10 px-2 py-1 rounded-full border border-white/5">
                        <Avatar src={u.profile_pic} name={u.username} size="xs" />
                        <span className="text-xs font-medium">{u.username}</span>
                        <button type="button" onClick={() => toggleUser(u)} className="p-0.5 hover:text-red-400">
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                  <input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search people to add..."
                    className="field pl-12 bg-white/5"
                  />
                </div>

                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                  {searchResults.map(user => (
                    <div 
                      key={user.id}
                      onClick={() => toggleUser(user)}
                      className="flex items-center justify-between p-3 rounded-2xl hover:bg-white/5 cursor-pointer transition-colors border border-transparent hover:border-white/5"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar src={user.profile_pic} name={user.username} size="sm" />
                        <span className="font-medium text-sm">{user.username}</span>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                        selectedUsers.find(u => u.id === user.id) 
                          ? "bg-[color:var(--accent)] border-[color:var(--accent)]" 
                          : "border-white/20"
                      }`}>
                        {selectedUsers.find(u => u.id === user.id) && <Check size={12} className="text-white" />}
                      </div>
                    </div>
                  ))}
                  {searchQuery.trim().length > 1 && searchResults.length === 0 && (
                    <div className="text-center py-8 text-zinc-500 text-sm">No users found</div>
                  )}
                </div>
              </div>

              {error && <div className="text-red-500 text-xs text-center font-medium">{error}</div>}

              <button
                type="submit"
                disabled={loading || !name.trim() || selectedUsers.length === 0}
                className="btn-primary w-full py-4 text-base shadow-xl"
              >
                {loading ? "Creating..." : "Create Group"}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
