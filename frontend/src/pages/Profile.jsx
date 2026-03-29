import { useEffect, useState } from "react";
import { ArrowLeft, LockKeyhole, MapPin, PencilLine, Sparkles } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";

import Avatar from "../components/Avatar";
import ConnectionsSheet from "../components/ConnectionsSheet";
import EmptyState from "../components/EmptyState";
import StoryViewer from "../components/StoryViewer";
import { useAuth } from "../context/AuthContext";
import { followApi, getErrorMessage, userApi } from "../services/api";


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
  const [connectionsState, setConnectionsState] = useState({
    open: false,
    type: "followers",
    users: [],
    loading: false,
  });

  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true);
      try {
        const { data } = await userApi.getProfile(id);
        setProfile(data.user);
        setError("");
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
    <>
      <main className="mx-auto max-w-[1380px] px-4 py-6">
        <button type="button" onClick={() => navigate(-1)} className="ghost-button gap-2">
          <ArrowLeft size={16} />
          Back
        </button>

        {loading ? (
          <div className="panel soft-ring mt-6 px-6 py-12 text-center">
            <p className="font-display text-2xl text-ink">Loading profile</p>
            <p className="mt-2 text-sm text-[color:var(--muted)]">Pulling drops, stories, and social counts.</p>
          </div>
        ) : null}

        {error && !loading ? (
          <div className="mt-6 rounded-[24px] bg-red-50 px-5 py-4 text-sm text-red-500">{error}</div>
        ) : null}

        {profile && !loading ? (
          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
            <section className="panel soft-ring overflow-hidden">
              <div className="relative overflow-hidden px-6 py-8 sm:px-8">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_center,rgba(142,13,115,0.16),transparent_26%),linear-gradient(180deg,rgba(255,255,255,0.4),transparent_58%)]" />
                <div className="relative flex flex-col items-center gap-6 text-center">
                  <div className="flex flex-col items-center">
                    <Avatar src={profile.profile_pic} name={profile.username} size="xl" className="shadow-soft" />
                    <div className="mt-5">
                      <p className="font-display text-4xl text-ink">@{profile.username}</p>
                      {profile.full_name ? (
                        <p className="mt-2 text-sm font-medium text-[color:var(--accent)]">{profile.full_name}</p>
                      ) : null}
                      <p className="mt-3 max-w-xl text-sm leading-7 text-[color:var(--muted)]">
                        {profile.bio || "No bio added yet."}
                      </p>
                      {profile.website ? (
                        <a
                          href={profile.website}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 inline-flex text-sm font-medium text-[color:var(--accent)]"
                        >
                          {profile.website}
                        </a>
                      ) : null}
                      {profile.location ? (
                        <p className="mt-2 inline-flex items-center gap-2 text-sm text-[color:var(--muted)]">
                          <MapPin size={14} />
                          {profile.location}
                        </p>
                      ) : null}
                      {profile.email ? (
                        <p className="mt-2 text-sm font-medium text-[color:var(--accent)]">{profile.email}</p>
                      ) : null}
                    </div>
                  </div>

                  {!profile.is_self ? (
                    <button
                      type="button"
                      onClick={handleFollow}
                      disabled={followBusy}
                      className={
                        profile.is_following ||
                        (profile.follow_request_status === "pending" &&
                          profile.follow_request_direction === "outgoing")
                          ? "ghost-button"
                          : "accent-button"
                      }
                    >
                      {followBusy
                        ? "Updating..."
                        : profile.is_following
                          ? "Following"
                          : profile.follow_request_status === "pending" &&
                              profile.follow_request_direction === "outgoing"
                            ? "Requested"
                            : profile.is_private
                              ? "Request follow"
                              : "Follow"}
                    </button>
                  ) : (
                    <div className="flex flex-wrap justify-center gap-3">
                      <button
                        type="button"
                        onClick={handleTogglePrivacy}
                        disabled={privacyBusy}
                        className="ghost-button gap-2"
                      >
                        <LockKeyhole size={16} />
                        {privacyBusy
                          ? "Updating..."
                          : profile.is_private
                            ? "Private account"
                            : "Public account"}
                      </button>
                      <Link to="/settings" className="accent-button gap-2">
                        <PencilLine size={16} />
                        Edit profile
                      </Link>
                      <Link to="/" className="ghost-button">
                        Back to home
                      </Link>
                    </div>
                  )}
                </div>

                <div className="relative mt-8 grid w-full gap-4 sm:grid-cols-3">
                  <div className="rounded-[24px] bg-white/72 px-4 py-5">
                    <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--muted)]">Drops</p>
                    <p className="mt-2 font-display text-4xl text-ink">{profile.posts_count}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenConnections("followers")}
                    disabled={profile.requires_follow && !profile.is_self}
                    className="rounded-[24px] bg-white/72 px-4 py-5 text-left transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--muted)]">Followers</p>
                    <p className="mt-2 font-display text-4xl text-ink">{profile.followers_count}</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenConnections("following")}
                    disabled={profile.requires_follow && !profile.is_self}
                    className="rounded-[24px] bg-white/72 px-4 py-5 text-left transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--muted)]">Following</p>
                    <p className="mt-2 font-display text-4xl text-ink">{profile.following_count}</p>
                  </button>
                </div>
              </div>

              {profile.requires_follow ? (
                <div className="px-6 pb-8 sm:px-8">
                  <EmptyState
                    title="This account is private"
                    description={`Follow ${profile.username} to unlock their drops and active stories.`}
                  />
                </div>
              ) : profile.posts.length === 0 ? (
                <div className="px-6 pb-8 sm:px-8">
                  <EmptyState
                    title="No drops here yet"
                    description={
                      profile.is_self
                        ? "Create your first drop from home and it will appear here."
                        : "This profile has not dropped anything yet."
                    }
                  />
                </div>
              ) : (
                <div className="grid gap-1 bg-[rgba(255,255,255,0.5)] sm:grid-cols-2 xl:grid-cols-3">
                  {profile.posts.map((post) => (
                    <article key={post.id} className="group relative aspect-square overflow-hidden">
                      <img
                        src={post.image_url}
                        alt={post.caption || `${profile.username} drop`}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[rgba(18,12,20,0.82)] via-transparent to-transparent opacity-0 transition duration-300 group-hover:opacity-100">
                        <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                          <p className="text-sm font-semibold">{post.likes_count} likes</p>
                          <p className="mt-2 max-h-[72px] overflow-hidden text-sm text-white/82">
                            {post.caption || "Fresh drop"}
                          </p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <aside className="space-y-6">
              <section className="panel soft-ring px-5 py-6">
                <div className="flex items-center gap-2 text-[color:var(--accent)]">
                  <Sparkles size={16} />
                  <span className="text-sm font-semibold">Profile note</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
                  {profile.is_self
                    ? "Your profile updates automatically as you post, collect likes, and share stories."
                    : `Follow ${profile.username} to make their latest drops show up in your home flow.`}
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
                    Home
                  </Link>
                  <Link to={`/profile/${currentUser?.id || profile.id}`} className="ghost-button justify-start">
                    My profile
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
    </>
  );
}
