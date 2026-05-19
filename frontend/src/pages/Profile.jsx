import { useEffect, useState } from "react";
import { ArrowLeft, LockKeyhole, MapPin, PencilLine, Sparkles, BadgeCheck, Briefcase, MoreVertical, MessageCircle, Film, Grid3x3, Clapperboard, Bookmark, Settings2, Phone, Video, Heart, Menu, X, LogOut, Eye, Ban, AlertTriangle } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

import Avatar from "../components/Avatar";
import ConnectionsSheet from "../components/ConnectionsSheet";
import EmptyState from "../components/EmptyState";
import StoryViewer from "../components/StoryViewer";
import { useAuth } from "../context/AuthContext";
import { followApi, getErrorMessage, userApi, highlightApi, reelApi, socialApi } from "../services/api";

export default function Profile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: currentUser, setUser, logout } = useAuth();
  const [optionsDrawerOpen, setOptionsDrawerOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  useEffect(() => {
    const handleOutsideClick = () => setProfileDropdownOpen(false);
    window.addEventListener("click", handleOutsideClick);
    return () => window.removeEventListener("click", handleOutsideClick);
  }, []);

  const formatViewsCount = (count) => {
    if (!count) return "0";
    if (count >= 1000000) {
      return (count / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
    }
    if (count >= 1000) {
      return (count / 1000).toFixed(1).replace(/\.0$/, "") + "K";
    }
    return count.toString();
  };

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [followBusy, setFollowBusy] = useState(false);
  const [privacyBusy, setPrivacyBusy] = useState(false);
  const [activeStoryGroup, setActiveStoryGroup] = useState(null);
  const [activeTab, setActiveTab] = useState("posts");
  const [highlights, setHighlights] = useState([]);
  const [userReels, setUserReels] = useState([]);
  const [reelsLoading, setReelsLoading] = useState(false);
  const [connectionsState, setConnectionsState] = useState({
    open: false,
    type: "followers",
    users: [],
    loading: false,
  });

  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true);
      setActiveTab("posts");
      try {
        const { data } = await userApi.getProfile(id);
        setProfile(data.user);
        setError("");
        
        // Fetch highlights
        try {
          const { data: hlData } = await highlightApi.getUserHighlights(id);
          setHighlights(hlData.highlights || []);
        } catch {
          setHighlights([]);
        }

        // Fetch user reels
        setReelsLoading(true);
        try {
          const { data: reelData } = await reelApi.getUserReels(id);
          setUserReels(reelData.reels || []);
        } catch (e) {
          console.error("Failed to load user reels", e);
        } finally {
          setReelsLoading(false);
        }

      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [id]);

  const handleFollow = async () => {
    if (!profile || profile.is_self) {
      return;
    }

    setFollowBusy(true);
    setError("");

    try {
      const shouldUnfollow =
        profile.is_following ||
        (profile.follow_request_status === "pending" && profile.follow_request_direction === "outgoing");
      const { data } = shouldUnfollow
        ? await followApi.unfollow(profile.id)
        : await followApi.follow(profile.id);

      setProfile((current) =>
        current
          ? {
              ...current,
              is_following: data.following,
              follow_request_status: data.follow_request_status || null,
              follow_request_direction: data.follow_request_direction || null,
              follow_request_id: data.follow_request_id || null,
              followers_count: data.followers_count,
              following_count: data.following_count,
            }
          : current,
      );
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setFollowBusy(false);
    }
  };

  const handleBlockUser = async () => {
    if (!profile || profile.is_self) return;
    const isBlocking = !profile.is_blocked;
    if (isBlocking && !window.confirm(`Are you sure you want to block @${profile.username}?`)) {
      return;
    }
    
    setFollowBusy(true);
    try {
      await socialApi.toggleBlock(profile.id);
      setProfile((current) =>
        current
          ? {
              ...current,
              is_blocked: isBlocking,
              is_following: false,
              followers_count: Math.max(0, current.followers_count - (current.is_following ? 1 : 0)),
              posts: isBlocking ? [] : current.posts,
              stories: isBlocking ? [] : current.stories,
            }
          : null
      );
      alert(isBlocking ? `@${profile.username} has been blocked.` : `@${profile.username} has been unblocked.`);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setFollowBusy(false);
    }
  };

  const handleReportUser = async () => {
    if (!profile || profile.is_self) return;
    const reason = window.prompt(`Please enter the reason for reporting @${profile.username}:`, "Inappropriate behavior/content");
    if (!reason || !reason.trim()) return;
    
    try {
      await socialApi.report({
        target_type: "user",
        target_id: profile.id,
        reason: reason.trim(),
        description: `User reported from profile: @${profile.username}`
      });
      alert(`Thank you. We have received your report regarding @${profile.username} and will review it.`);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleOpenConnections = async (type) => {
    if (!profile) {
      return;
    }

    setConnectionsState({
      open: true,
      type,
      users: [],
      loading: true,
    });
    setError("");

    try {
      const { data } = await userApi.connections(profile.id, type);
      setConnectionsState({
        open: true,
        type,
        users: data.users || [],
        loading: false,
      });
    } catch (err) {
      setConnectionsState((current) => ({
        ...current,
        loading: false,
        users: [],
      }));
      setError(getErrorMessage(err));
    }
  };

  const handleTogglePrivacy = async () => {
    if (!profile?.is_self) {
      return;
    }

    const nextPrivacy = !profile.is_private;
    setPrivacyBusy(true);
    setError("");

    try {
      const { data } = await userApi.updateSettings({ is_private: nextPrivacy });
      setUser(data.user);
      setProfile((current) =>
        current
          ? {
              ...current,
              is_private: data.user.settings?.is_private ?? nextPrivacy,
            }
          : current,
      );
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setPrivacyBusy(false);
    }
  };

  const profileStoryGroup =
    profile && profile.stories?.length
      ? {
          user: {
            id: profile.id,
            username: profile.username,
            profile_pic: profile.profile_pic,
          },
          stories: profile.stories,
        }
      : null;

  return (
    <div className="min-h-screen w-full bg-[color:var(--bg)] pb-[var(--bottomnav-h)] lg:pb-0 scroll-smooth">
      <main className="mx-auto max-w-[1380px] px-4 py-6">
        <button type="button" onClick={() => navigate(-1)} className="ghost-button gap-2">
          <ArrowLeft size={16} />
          Back
        </button>

        {loading ? (
          <div className="panel soft-ring mt-6 px-6 py-12 text-center">
            <p className="font-display text-2xl text-ink">Loading Aura</p>
            <p className="mt-2 text-sm text-[color:var(--muted)]">Pulling drops, stories, and social counts.</p>
          </div>
        ) : null}

        {error && !loading ? (
          <div className="mt-6 rounded-[24px] bg-red-50 px-5 py-4 text-sm text-red-500">{error}</div>
        ) : null}

        {profile && !loading ? (
          <div className="mt-6 grid gap-8 xl:grid-cols-[1fr_360px]">
            <div className="flex flex-col gap-8">
              {/* Professional Profile Header */}
              <section className="relative overflow-hidden rounded-[32px] bg-[color:var(--bg-card)] border border-[color:var(--border)] shadow-xl">
              {/* Cover/Banner Gradient */}
              <div 
                className="h-32 sm:h-48 w-full bg-gradient-to-br opacity-80" 
                style={{ background: "linear-gradient(135deg, var(--gradient-start), var(--gradient-end))" }}
              />
              
              <div className="px-6 pb-8 sm:px-12 relative">
                {/* Avatar & Action row */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between -mt-12 sm:-mt-16 gap-4 w-full">
                  <div className="p-1 rounded-full bg-[color:var(--bg-card)] shadow-lg relative group self-start">
                    <Avatar 
                      src={profile.profile_pic} 
                      name={profile.username} 
                      size="xl" 
                      className="border-4 border-[color:var(--bg-card)]" 
                    />
                    {profileStoryGroup && (
                      <div className="absolute inset-0 rounded-full border-2 border-[color:var(--accent)] animate-pulse pointer-events-none" />
                    )}
                  </div>
                  
                  <div className="w-full sm:w-auto mb-2 sm:mb-0">
                    {!profile.is_self ? (
                      <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                        <button
                          type="button"
                          onClick={profile.is_blocked ? handleBlockUser : handleFollow}
                          disabled={followBusy}
                          className={`h-11 flex-1 sm:flex-none px-6 rounded-2xl font-bold transition-all active:scale-95 flex items-center justify-center ${
                            profile.is_blocked
                              ? "bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20"
                              : profile.is_following || (profile.follow_request_status === "pending" && profile.follow_request_direction === "outgoing")
                                ? "bg-[color:var(--surface)] text-[color:var(--text-primary)] border border-[color:var(--border)] hover:bg-[color:var(--surface-active)]"
                                : "bg-[color:var(--accent)] text-white shadow-lg hover:opacity-90"
                          }`}
                        >
                          {followBusy ? "..." : profile.is_blocked ? "Unblock" : profile.is_following ? "Following" : "Follow"}
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate("/chat", { state: { selectUser: profile } })}
                          className="h-11 flex-1 sm:flex-none px-6 rounded-2xl font-bold bg-[color:var(--surface)] text-[color:var(--text-primary)] border border-[color:var(--border)] transition-all hover:bg-[color:var(--surface-active)] active:scale-95 flex items-center justify-center gap-2"
                        >
                          <MessageCircle size={18} />
                          Message
                        </button>
                        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
                          <button
                            type="button"
                            onClick={() => navigate("/chat", { state: { selectUser: profile, initiateCall: "audio" } })}
                            className="h-11 w-11 rounded-2xl bg-[color:var(--surface)] text-[color:var(--text-primary)] border border-[color:var(--border)] transition-all hover:bg-[color:var(--surface-active)] active:scale-95 flex items-center justify-center"
                          >
                            <Phone size={18} />
                          </button>
                          <button
                            type="button"
                            onClick={() => navigate("/chat", { state: { selectUser: profile, initiateCall: "video" } })}
                            className="h-11 w-11 rounded-2xl bg-[color:var(--surface)] text-[color:var(--text-primary)] border border-[color:var(--border)] transition-all hover:bg-[color:var(--surface-active)] active:scale-95 flex items-center justify-center"
                          >
                            <Video size={18} />
                          </button>
                          <div 
                            onClick={(e) => { e.stopPropagation(); setProfileDropdownOpen(!profileDropdownOpen); }}
                            className="h-11 w-11 flex items-center justify-center rounded-2xl bg-[color:var(--surface)] text-[color:var(--text-primary)] border border-[color:var(--border)] transition-all hover:bg-[color:var(--surface-active)] active:scale-95 relative cursor-pointer"
                          >
                            <MoreVertical size={18} />
                            {profileDropdownOpen && (
                              <div className="absolute bottom-full sm:top-full right-0 mb-2 sm:mb-0 sm:mt-2 w-48 py-2 bg-[color:var(--bg-elevated)] border border-[color:var(--border)] rounded-xl shadow-xl transition-all z-50">
                                <button 
                                  onClick={(e) => { e.stopPropagation(); setProfileDropdownOpen(false); navigate("/chat", { state: { selectUser: profile } }); }}
                                  className="w-full px-4 py-2 text-left text-sm font-medium hover:bg-[color:var(--surface)] flex items-center gap-2"
                                >
                                  <MessageCircle size={14} />
                                  Send Message
                                </button>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); setProfileDropdownOpen(false); handleBlockUser(); }}
                                  className="w-full px-4 py-2 text-left text-sm font-medium hover:bg-[color:var(--surface)] text-red-500 flex items-center gap-2"
                                >
                                  <Ban size={14} />
                                  {profile.is_blocked ? "Unblock User" : "Block User"}
                                </button>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); setProfileDropdownOpen(false); handleReportUser(); }}
                                  className="w-full px-4 py-2 text-left text-sm font-medium hover:bg-[color:var(--surface)] text-red-500 flex items-center gap-2"
                                >
                                  <AlertTriangle size={14} />
                                  Report User
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Link 
                          to="/profile/edit" 
                          className="h-11 px-6 flex items-center gap-2 rounded-2xl bg-[color:var(--surface)] text-[color:var(--text-primary)] font-bold border border-[color:var(--border)] transition-all hover:bg-[color:var(--surface-active)] active:scale-95"
                        >
                          <PencilLine size={18} />
                          <span className="hidden sm:inline">Edit Profile</span>
                        </Link>
                        <button
                          type="button"
                          onClick={() => setOptionsDrawerOpen(true)}
                          className="h-11 w-11 flex items-center justify-center rounded-2xl bg-[color:var(--surface)] text-[color:var(--text-primary)] border border-[color:var(--border)] transition-all hover:bg-[color:var(--surface-active)] active:scale-95"
                        >
                          <Menu size={20} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Profile Info */}
                <div className="mt-6 flex flex-col md:flex-row md:items-start md:justify-between gap-6">
                  <div className="flex-1 max-w-2xl">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className="text-3xl sm:text-4xl font-display text-ink">@{profile.username}</h1>
                      {profile.is_verified && <BadgeCheck size={24} className="text-blue-500 fill-blue-500/10" />}
                      {profile.account_type && profile.account_type !== "personal" && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[color:var(--accent-soft)] text-[color:var(--accent)]">
                          {profile.account_type}
                        </span>
                      )}
                    </div>
                    
                    {profile.full_name && (
                      <p className="mt-1.5 text-lg font-medium text-zinc-600 dark:text-zinc-400">{profile.full_name}</p>
                    )}
                    
                    <p className="mt-4 text-sm sm:text-base leading-relaxed text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">
                      {profile.bio || "Crafting digital experiences on Neurality."}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                      {profile.website && (
                        <a href={profile.website} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-[color:var(--accent)] font-medium">
                          <span className="text-zinc-400">🔗</span> {profile.website.replace(/^https?:\/\//, "")}
                        </a>
                      )}
                      {profile.location && (
                        <div className="flex items-center gap-2 text-zinc-500">
                          <MapPin size={14} /> {profile.location}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Stats Card - Mobile Optimized */}
                  <div className="grid grid-cols-3 gap-1 p-1 rounded-3xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800 md:w-80">
                    <div className="flex flex-col items-center justify-center py-4 px-2">
                      <span className="text-lg font-bold text-ink">{profile.posts_count}</span>
                      <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold">Posts</span>
                    </div>
                    <button 
                      onClick={() => handleOpenConnections("followers")}
                      className="flex flex-col items-center justify-center py-4 px-2 hover:bg-white dark:hover:bg-zinc-800 rounded-2xl transition-colors"
                    >
                      <span className="text-lg font-bold text-ink">{profile.followers_count}</span>
                      <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold">Followers</span>
                    </button>
                    <button 
                      onClick={() => handleOpenConnections("following")}
                      className="flex flex-col items-center justify-center py-4 px-2 hover:bg-white dark:hover:bg-zinc-800 rounded-2xl transition-colors"
                    >
                      <span className="text-lg font-bold text-ink">{profile.following_count}</span>
                      <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold">Following</span>
                    </button>
                  </div>
                </div>
              </div>
            </section>

              {profile.requires_follow ? (
                <div className="px-6 pb-8 sm:px-8">
                  <EmptyState
                    title="This account is private"
                    description={`Follow ${profile.username} to unlock their posts and active stories.`}
                  />
                </div>
              ) : (
                <div>
                  {/* Profile Tabs */}
                  <div className="flex border-t border-[color:var(--border)] mt-2">
                    {[
                      { key: "posts", label: "Drops", icon: "⊞" },
                      { key: "reels", label: "Beats", icon: "▶" },
                      ...(profile.is_self ? [{ key: "saved", label: "Saved", icon: "⚑" }] : []),
                    ].map(tab => (
                      <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-semibold uppercase tracking-wider transition-all border-t-2 ${
                          activeTab === tab.key
                            ? "border-[color:var(--text-primary)] text-[color:var(--text-primary)]"
                            : "border-transparent text-[color:var(--text-muted)] hover:text-[color:var(--text-secondary)]"
                        }`}
                      >
                        <span>{tab.icon}</span>
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Highlights Row (own profile only) */}
                  {profile.is_self && highlights.length > 0 && (
                    <div className="flex gap-4 overflow-x-auto px-6 py-4 pb-6 custom-scrollbar">
                      {highlights.map(h => (
                        <div key={h.id} className="flex flex-col items-center gap-1.5 flex-shrink-0">
                          <div className="w-16 h-16 rounded-full border-2 border-[color:var(--border-strong)] flex items-center justify-center overflow-hidden">
                            {h.cover_image ? (
                              <img src={h.cover_image} alt={h.title} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-lg">📎</span>
                            )}
                          </div>
                          <span className="text-[10px] font-medium max-w-[60px] truncate" style={{ color: "var(--text-secondary)" }}>
                            {h.title}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Tab Content */}
                  {activeTab === "posts" && (
                    profile.posts.length === 0 ? (
                      <div className="px-6 pb-8 sm:px-8">
                        <EmptyState
                          title="No posts here yet"
                          description={
                            profile.is_self
                              ? "Create your first post from home and it will appear here."
                              : "This profile has not posted anything yet."
                          }
                        />
                      </div>
                    ) : (
                      <div className="grid gap-1 bg-[rgba(255,255,255,0.5)] sm:grid-cols-2 xl:grid-cols-3">
                        {profile.posts.map((post) => (
                          <article key={post.id} className="group relative aspect-square overflow-hidden">
                            {post.media_type === "video" ? (
                              <video
                                src={post.image_url}
                                className="h-full w-full object-cover"
                                muted
                              />
                            ) : (
                              <img
                                src={post.image_url}
                                alt={post.caption || `${profile.username} drop`}
                                className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                              />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-[rgba(18,12,20,0.82)] via-transparent to-transparent opacity-0 transition duration-300 group-hover:opacity-100">
                              <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                                <p className="text-sm font-semibold">{post.likes_count} likes · {post.comments_count} comments</p>
                              </div>
                            </div>
                          </article>
                        ))}
                      </div>
                    )
                  )}

                  {activeTab === "reels" && (
                    reelsLoading ? (
                      <div className="p-12 text-center opacity-50">Loading beats...</div>
                    ) : userReels.length === 0 ? (
                      <div className="px-6 pb-8 sm:px-8">
                        <EmptyState 
                          icon={Film} 
                          title="No beats yet" 
                          description={
                            profile.is_self 
                              ? "Upload your first beat from the Beats page." 
                              : `${profile.username} hasn't posted any beats yet.`
                          } 
                        />
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-1 sm:gap-2">
                        {userReels.map((reel) => (
                          <Link 
                            key={reel.id} 
                            to={`/beat?id=${reel.id}`}
                            className="group relative aspect-[9/16] overflow-hidden bg-zinc-900 rounded-2xl border border-[color:var(--border)] shadow-sm"
                          >
                            <img 
                              src={reel.thumbnail_url} 
                              alt={reel.caption} 
                              className="h-full w-full object-cover transition duration-500 group-hover:scale-110" 
                            />
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                               <div className="flex items-center gap-1.5 text-white font-bold text-sm">
                                  <Heart size={16} fill="white" />
                                  {reel.likes_count}
                               </div>
                            </div>
                            {/* Translucent bottom-left corner views overlay (Instagram reel-style) */}
                            <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-lg bg-black/40 backdrop-blur-md text-[10px] text-white font-bold flex items-center gap-1.5 z-10 pointer-events-none border border-white/10 shadow-sm">
                              <Eye size={12} className="text-white fill-white/10" />
                              <span>{formatViewsCount(reel.views_count || reel.watch_count || 0)}</span>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )
                  )}

                  {activeTab === "saved" && profile.is_self && (
                    <div className="px-6 pb-8 sm:px-8 mt-4">
                      <Link
                        to="/saved"
                        className="flex items-center gap-3 rounded-2xl px-5 py-4 transition hover:bg-[color:var(--surface)]"
                        style={{ border: "1px solid var(--border)" }}
                      >
                        <span className="text-2xl">🔖</span>
                        <div>
                          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>View all saved posts</p>
                          <p className="text-xs" style={{ color: "var(--text-muted)" }}>Only you can see what you've saved</p>
                        </div>
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>

            <aside className="space-y-6 xl:sticky xl:top-24 h-fit max-h-[calc(100vh-8rem)] overflow-y-auto custom-scrollbar xl:pr-4">
              <section className="panel soft-ring px-5 py-6">
                <div className="flex items-center gap-2 text-[color:var(--accent)]">
                  <Sparkles size={16} />
                  <span className="text-sm font-semibold">Profile note</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
                  {profile.is_self
                    ? "Your profile updates automatically as you post, collect likes, and share stories."
                    : `Follow ${profile.username} to make their latest posts show up in your home flow.`}
                </p>
              </section>

              <section className="panel soft-ring px-5 py-6">
                <p className="font-display text-2xl text-ink">Active stories</p>
                {profileStoryGroup ? (
                  <button
                    type="button"
                    onClick={() => setActiveStoryGroup(profileStoryGroup)}
                    className="mt-5 flex w-full items-center gap-4 rounded-[26px] bg-white/72 px-4 py-4 text-left transition hover:bg-white"
                  >
                    <span className="story-ring flex h-[68px] w-[68px] items-center justify-center rounded-full p-[3px]">
                      <span className="flex h-full w-full items-center justify-center rounded-full bg-white">
                        <Avatar src={profile.profile_pic} name={profile.username} size="md" />
                      </span>
                    </span>
                    <div>
                      <p className="font-semibold text-ink">{profile.username}</p>
                      <p className="text-sm text-[color:var(--muted)]">
                        {profile.stories.length} active {profile.stories.length === 1 ? "story" : "stories"}
                      </p>
                    </div>
                  </button>
                ) : (
                  <p className="mt-4 text-sm text-[color:var(--muted)]">No active stories right now.</p>
                )}
              </section>


            </aside>
          </div>
        ) : null}
      </main>

      <StoryViewer
        group={activeStoryGroup}
        open={Boolean(activeStoryGroup)}
        onClose={() => setActiveStoryGroup(null)}
      />
      <ConnectionsSheet
        open={connectionsState.open}
        title={connectionsState.type === "followers" ? "Followers" : "Following"}
        users={connectionsState.users}
        loading={connectionsState.loading}
        onClose={() =>
          setConnectionsState((current) => ({
            ...current,
            open: false,
          }))
        }
      />

      {/* Options Drawer */}
      <AnimatePresence>
        {optionsDrawerOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOptionsDrawerOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
            />
            {/* Sliding Sheet */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 220 }}
              className="fixed bottom-0 inset-x-0 bg-[color:var(--bg-card)] border-t border-[color:var(--border)] rounded-t-[32px] p-6 pb-12 z-[101] shadow-2xl max-w-lg mx-auto"
            >
              {/* Drag Handle */}
              <div className="w-12 h-1.5 bg-zinc-300 dark:bg-zinc-700 rounded-full mx-auto mb-6" />
              
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-display text-ink">Options</h3>
                <button
                  onClick={() => setOptionsDrawerOpen(false)}
                  className="p-2 rounded-full hover:bg-[color:var(--surface)] text-zinc-500 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-2">
                {[
                  { label: "Settings", icon: Settings2, onClick: () => { setOptionsDrawerOpen(false); navigate("/settings"); } },
                  { label: "Saved Content", icon: Bookmark, onClick: () => { setOptionsDrawerOpen(false); navigate("/saved"); } },
                  { label: "Feature Labs", icon: Sparkles, onClick: () => { setOptionsDrawerOpen(false); navigate("/settings/feature-labs"); } },
                ].map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={idx}
                      onClick={item.onClick}
                      className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left hover:bg-[color:var(--surface)] text-[color:var(--text-primary)] transition-all font-semibold"
                    >
                      <div className="p-2 rounded-xl bg-[color:var(--bg-elevated)] text-[color:var(--accent)] shadow-sm">
                        <Icon size={18} />
                      </div>
                      <span>{item.label}</span>
                    </button>
                  );
                })}
                
                <div className="border-t border-[color:var(--border)] my-4 pt-4" />
                
                <button
                  onClick={() => { setOptionsDrawerOpen(false); logout(); }}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left hover:bg-red-50 dark:hover:bg-red-500/10 text-red-500 transition-all font-bold"
                >
                  <div className="p-2 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-500 shadow-sm">
                    <LogOut size={18} />
                  </div>
                  <span>Logout</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
