import { useEffect, useState } from "react";
import { ArrowLeft, LockKeyhole, MapPin, PencilLine, Sparkles, BadgeCheck, Briefcase, MoreVertical, MessageCircle, Film, Grid3x3, Clapperboard, Bookmark, Settings2, Phone, Video } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";

import Avatar from "../components/Avatar";
import ConnectionsSheet from "../components/ConnectionsSheet";
import EmptyState from "../components/EmptyState";
import StoryViewer from "../components/StoryViewer";
import { useAuth } from "../context/AuthContext";
import { followApi, getErrorMessage, userApi, highlightApi } from "../services/api";


export default function Profile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: currentUser, setUser } = useAuth();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [followBusy, setFollowBusy] = useState(false);
  const [privacyBusy, setPrivacyBusy] = useState(false);
  const [activeStoryGroup, setActiveStoryGroup] = useState(null);
  const [activeTab, setActiveTab] = useState("posts");
  const [highlights, setHighlights] = useState([]);
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
    <div className="h-screen w-full overflow-y-auto overflow-x-hidden custom-scrollbar bg-[color:var(--bg)] pb-[var(--bottomnav-h)] lg:pb-0 scroll-smooth">
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
                <div className="flex flex-col sm:flex-row items-end sm:items-center justify-between -mt-12 sm:-mt-16 gap-4">
                  <div className="p-1 rounded-full bg-[color:var(--bg-card)] shadow-lg relative group">
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
                  
                  <div className="flex gap-2 mb-2 sm:mb-0">
                    {!profile.is_self ? (
                      <>
                        <button
                          type="button"
                          onClick={handleFollow}
                          disabled={followBusy}
                          className={`h-11 px-8 rounded-2xl font-bold transition-all active:scale-95 ${
                            profile.is_following || (profile.follow_request_status === "pending" && profile.follow_request_direction === "outgoing")
                              ? "bg-zinc-100 text-zinc-900 border border-zinc-200"
                              : "bg-[color:var(--accent)] text-white shadow-lg shadow-[rgba(142,13,115,0.2)]"
                          }`}
                        >
                          {followBusy ? "..." : profile.is_following ? "Following" : "Follow"}
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate("/chat", { state: { selectUser: profile } })}
                          className="h-11 px-6 rounded-2xl font-bold bg-zinc-100 text-zinc-900 border border-zinc-200 transition-all active:scale-95 flex items-center gap-2"
                        >
                          <MessageCircle size={18} />
                          Message
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate("/chat", { state: { selectUser: profile, initiateCall: "audio" } })}
                          className="h-11 w-11 rounded-2xl bg-zinc-100 text-zinc-900 border border-zinc-200 transition-all active:scale-95 flex items-center justify-center"
                        >
                          <Phone size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate("/chat", { state: { selectUser: profile, initiateCall: "video" } })}
                          className="h-11 w-11 rounded-2xl bg-zinc-100 text-zinc-900 border border-zinc-200 transition-all active:scale-95 flex items-center justify-center"
                        >
                          <Video size={18} />
                        </button>
                        <div className="h-11 w-11 flex items-center justify-center rounded-2xl bg-zinc-100 text-zinc-900 border border-zinc-200 transition-all active:scale-95 group relative cursor-pointer">
                          <MoreVertical size={18} />
                          <div className="absolute top-full right-0 mt-2 w-48 py-2 bg-[color:var(--bg-elevated)] border border-[color:var(--border)] rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                            <button 
                              onClick={() => navigate("/chat", { state: { selectUser: profile } })}
                              className="w-full px-4 py-2 text-left text-sm font-medium hover:bg-[color:var(--surface)] flex items-center gap-2"
                            >
                              <MessageCircle size={14} />
                              Send Message
                            </button>
                            <button className="w-full px-4 py-2 text-left text-sm font-medium hover:bg-[color:var(--surface)] flex items-center gap-2">
                              <Sparkles size={14} />
                              About this profile
                            </button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="flex gap-2">
                        <Link 
                          to="/settings" 
                          className="h-11 px-6 flex items-center gap-2 rounded-2xl bg-zinc-100 text-zinc-900 font-bold border border-zinc-200 transition-all hover:bg-zinc-200 active:scale-95"
                        >
                          <PencilLine size={18} />
                          <span className="hidden sm:inline">Edit Profile</span>
                        </Link>
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
                            {/* Pinned indicator */}
                            {post.is_pinned && (
                              <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center">
                                <span className="text-xs">📌</span>
                              </div>
                            )}
                            {/* Carousel indicator */}
                            {post.is_carousel && (
                              <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center">
                                <span className="text-xs">⊞</span>
                              </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-[rgba(18,12,20,0.82)] via-transparent to-transparent opacity-0 transition duration-300 group-hover:opacity-100">
                              <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                                <p className="text-sm font-semibold">{post.likes_count} likes · {post.comments_count} comments</p>
                                <p className="mt-2 max-h-[72px] overflow-hidden text-sm text-white/82">
                                  {post.caption || "Fresh post"}
                                </p>
                              </div>
                            </div>
                          </article>
                        ))}
                      </div>
                    )
                  )}

                  {activeTab === "reels" && (
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

              <section className="panel soft-ring px-5 py-6">
                <p className="font-display text-2xl text-ink">Quick links</p>
                <div className="mt-4 grid gap-3">
                  <Link to="/" className="ghost-button justify-start">
                    Orbit
                  </Link>
                  <Link to={`/profile/${currentUser?.id || profile.id}`} className="ghost-button justify-start">
                    My Aura
                  </Link>
                </div>
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
    </div>
  );
}
