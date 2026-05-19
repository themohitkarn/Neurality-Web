import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, UserRound, Smartphone, Globe, MapPin, AlignLeft, Camera, Check, AlertCircle } from "lucide-react";
import Avatar from "../components/Avatar";
import { useAuth } from "../context/AuthContext";
import { getErrorMessage, userApi } from "../services/api";

export default function EditProfile() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();

  const [profileForm, setProfileForm] = useState({
    username: user?.username || "",
    full_name: user?.full_name || "",
    bio: user?.bio || "",
    website: user?.website || "",
    location: user?.location || "",
  });

  const [profilePic, setProfilePic] = useState(null);
  const [profilePicPreview, setProfilePicPreview] = useState(null);
  const [removeProfilePic, setRemoveProfilePic] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Sync state if user context updates
  useEffect(() => {
    if (user) {
      setProfileForm({
        username: user.username || "",
        full_name: user.full_name || "",
        bio: user.bio || "",
        website: user.website || "",
        location: user.location || "",
      });
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfileForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setProfilePic(file);
      setRemoveProfilePic(false);
      setProfilePicPreview(URL.createObjectURL(file));
    }
  };

  const handleRemovePhoto = () => {
    setProfilePic(null);
    setProfilePicPreview(null);
    setRemoveProfilePic(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccessMessage("");

    try {
      const payload = new FormData();
      Object.entries(profileForm).forEach(([key, value]) => {
        payload.append(key, value);
      });
      payload.append("remove_profile_pic", removeProfilePic ? "true" : "false");
      if (profilePic) {
        payload.append("profile_pic", profilePic);
      }

      const { data } = await userApi.updateProfile(payload);
      setUser(data.user);
      setProfilePic(null);
      setProfilePicPreview(null);
      setRemoveProfilePic(false);
      setSuccessMessage("Profile updated successfully!");
      
      // Auto redirect back to profile after a short delay
      setTimeout(() => {
        navigate(`/profile/${data.user.id}`);
      }, 1500);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-screen w-full overflow-y-auto overflow-x-hidden bg-[color:var(--bg)] pb-[var(--bottomnav-h)] lg:pb-0 scroll-smooth">
      <div className="mx-auto max-w-2xl px-4 py-8 lg:py-12">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate(`/profile/${user?.id}`)}
            className="p-3 rounded-2xl bg-zinc-100 hover:bg-zinc-200 text-zinc-900 transition-all active:scale-95 flex items-center justify-center border border-zinc-200 shadow-sm"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-display text-ink">Edit Profile</h1>
            <p className="text-xs text-[color:var(--text-muted)] mt-0.5">Customize your digital presence on Neurality</p>
          </div>
        </div>

        {error && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl bg-red-50 dark:bg-red-500/10 px-5 py-4 text-sm text-red-500 border border-red-200/20">
            <AlertCircle size={18} className="flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 px-5 py-4 text-sm text-emerald-600 border border-emerald-200/20">
            <Check size={18} className="flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="panel soft-ring p-6 sm:p-8 space-y-6">
          {/* Avatar Setup */}
          <div className="flex flex-col sm:flex-row items-center gap-6 pb-6 border-b border-[color:var(--border)]">
            <div className="relative group cursor-pointer">
              <Avatar
                src={profilePicPreview || (removeProfilePic ? null : user?.profile_pic)}
                name={user?.username}
                size="xl"
                className="ring-4 ring-[color:var(--accent-soft)]"
              />
              <label className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                <Camera size={24} className="text-white" />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>
            
            <div className="flex-1 text-center sm:text-left space-y-2">
              <h3 className="font-bold text-ink">Profile Picture</h3>
              <p className="text-xs text-[color:var(--text-muted)]">Recommended: Square JPG or PNG, max 5MB.</p>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                <label className="px-4 py-2 rounded-xl bg-[color:var(--accent)] text-white text-xs font-bold shadow-sm hover:bg-[color:var(--accent-hover)] transition-all cursor-pointer">
                  Upload Image
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
                {(user?.profile_pic || profilePicPreview) && !removeProfilePic && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="px-4 py-2 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-500 text-xs font-bold transition-all hover:bg-red-100"
                  >
                    Remove Photo
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Fields */}
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 ml-1">Username</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 font-medium">@</span>
                  <input
                    type="text"
                    name="username"
                    value={profileForm.username}
                    onChange={handleChange}
                    className="field !bg-zinc-50 dark:!bg-zinc-900/50 !pl-8"
                    placeholder="username"
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 ml-1">Full Name</label>
                <div className="relative">
                  <UserRound size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    name="full_name"
                    value={profileForm.full_name}
                    onChange={handleChange}
                    className="field !bg-zinc-50 dark:!bg-zinc-900/50 !pl-11"
                    placeholder="Full Name"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 ml-1">Bio</label>
              <div className="relative">
                <AlignLeft size={16} className="absolute left-4 top-4 text-zinc-400" />
                <textarea
                  name="bio"
                  value={profileForm.bio}
                  onChange={handleChange}
                  className="field !bg-zinc-50 dark:!bg-zinc-900/50 !pl-11 min-h-[100px] py-3.5 resize-none"
                  placeholder="Write something about yourself..."
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 ml-1">Website</label>
                <div className="relative">
                  <Globe size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="url"
                    name="website"
                    value={profileForm.website}
                    onChange={handleChange}
                    className="field !bg-zinc-50 dark:!bg-zinc-900/50 !pl-11"
                    placeholder="https://yourwebsite.com"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 ml-1">Location</label>
                <div className="relative">
                  <MapPin size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    name="location"
                    value={profileForm.location}
                    onChange={handleChange}
                    className="field !bg-zinc-50 dark:!bg-zinc-900/50 !pl-11"
                    placeholder="San Francisco, CA"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div className="pt-6 border-t border-[color:var(--border)] flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-[color:var(--accent)] text-white font-bold shadow-lg shadow-[rgba(142,13,115,0.2)] hover:bg-[color:var(--accent-hover)] active:scale-95 transition-all"
            >
              {saving ? "Saving Changes..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
