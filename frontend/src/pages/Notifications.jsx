import { useEffect, useState } from "react";

import Avatar from "../components/Avatar";
import { useAuth } from "../context/AuthContext";
import { chatApi, followApi, getErrorMessage, postApi, storyApi } from "../services/api";


export default function Notifications() {
  const { setUser } = useAuth();
  const [items, setItems] = useState([]);
  const [followRequests, setFollowRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [requestActionKey, setRequestActionKey] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    const loadNotifications = async () => {
      setLoading(true);
      try {
        const [recommended, chats, stories, followRequestsData] = await Promise.all([
          postApi.recommended(2),
          chatApi.users(),
          storyApi.feed(),
          followApi.requests(),
        ]);

        const nextItems = [];

        (recommended.data.posts || []).slice(0, 2).forEach((post, index) => {
          nextItems.push({
            id: `drop-${post.id}`,
            actor: post.author,
            text: `shared a drop you might like.`,
            time: index === 0 ? "2m" : "8m",
          });
        });

        (chats.data.users || []).slice(0, 1).forEach((user) => {
          nextItems.push({
            id: `chat-${user.id}`,
            actor: user,
            text: user.last_message_preview ? `messaged you: "${user.last_message_preview}"` : "is ready to chat.",
            time: "12m",
          });
        });

        (stories.data.stories || []).slice(0, 1).forEach((group) => {
          nextItems.push({
            id: `story-${group.user.id}`,
            actor: group.user,
            text: `posted a new story.`,
            time: "1h",
          });
        });

        setItems(nextItems);
        setFollowRequests(followRequestsData.data.incoming || []);
        setError("");
        setSuccessMessage("");
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };

    loadNotifications();
  }, []);

  const handleFollowRequest = async (requestId, action) => {
    const actionKey = `${action}-${requestId}`;
    setRequestActionKey(actionKey);
    setError("");
    setSuccessMessage("");

    try {
      const { data } =
        action === "accepted"
          ? await followApi.accept({ request_id: requestId })
          : await followApi.reject({ request_id: requestId });

      setFollowRequests((current) => current.filter((item) => item.id !== requestId));
      if (action === "accepted") {
        setUser((current) =>
          current
            ? {
                ...current,
                followers_count: data.followers_count ?? current.followers_count,
              }
            : current,
        );
      }
      setSuccessMessage(action === "accepted" ? "Follow request accepted." : "Follow request rejected.");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setRequestActionKey("");
    }
  };

  return (
    <main className="mx-auto max-w-[1040px] px-4 py-4 lg:py-10">
      <section className="mx-auto max-w-3xl">
        <div className="text-center">
          <p className="font-display text-4xl text-ink lg:text-5xl">Notifications</p>
          <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
            Fresh activity from the people and drops around you.
          </p>
        </div>

        {loading ? <p className="mt-10 text-center text-sm text-[color:var(--muted)]">Loading notifications...</p> : null}
        {error ? <p className="mt-10 text-center text-sm text-red-500">{error}</p> : null}
        {successMessage ? (
          <p className="mt-6 rounded-[24px] bg-[rgba(142,13,115,0.08)] px-5 py-4 text-center text-sm text-[color:var(--accent)]">
            {successMessage}
          </p>
        ) : null}

        <div className="mt-10 space-y-4">
          {followRequests.map((requestItem) => (
            <article key={`follow-request-${requestItem.id}`} className="panel px-5 py-5">
              <div className="flex items-center gap-4">
                <Avatar src={requestItem.sender.profile_pic} name={requestItem.sender.username} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="text-base text-ink">
                    <span className="font-semibold text-[color:var(--accent)]">{requestItem.sender.username}</span>{" "}
                    requested to follow your private account.
                  </p>
                  <p className="mt-1 text-sm text-[color:var(--muted)]">
                    {requestItem.sender.account_type} account
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => handleFollowRequest(requestItem.id, "accepted")}
                  disabled={requestActionKey === `accepted-${requestItem.id}`}
                  className="accent-button gap-2"
                >
                  {requestActionKey === `accepted-${requestItem.id}` ? "Accepting..." : "Accept"}
                </button>
                <button
                  type="button"
                  onClick={() => handleFollowRequest(requestItem.id, "rejected")}
                  disabled={requestActionKey === `rejected-${requestItem.id}`}
                  className="ghost-button gap-2"
                >
                  {requestActionKey === `rejected-${requestItem.id}` ? "Rejecting..." : "Reject"}
                </button>
              </div>
            </article>
          ))}

          {items.map((item) => (
            <article key={item.id} className="panel flex items-center gap-4 px-5 py-5">
              <Avatar src={item.actor.profile_pic} name={item.actor.username} size="md" />
              <div>
                <p className="text-base text-ink">
                  <span className="font-semibold text-[color:var(--accent)]">{item.actor.username}</span> {item.text}
                </p>
                <p className="mt-1 text-sm text-[color:var(--muted)]">{item.time}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
