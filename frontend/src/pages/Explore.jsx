import { useEffect, useState } from "react";
import { Search } from "lucide-react";

import EmptyState from "../components/EmptyState";
import { getErrorMessage, postApi } from "../services/api";


export default function Explore() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const loadExplore = async () => {
      setLoading(true);
      try {
        const [recommended, feed] = await Promise.all([postApi.recommended(8), postApi.feed(1, 8)]);
        const merged = [...(recommended.data.posts || []), ...(feed.data.posts || [])];
        const unique = [];
        const seen = new Set();
        for (const post of merged) {
          if (seen.has(post.id)) {
            continue;
          }
          seen.add(post.id);
          unique.push(post);
        }
        setPosts(unique);
        setError("");
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };

    loadExplore();
  }, []);

  const visiblePosts = !query.trim()
    ? posts
    : posts.filter((post) =>
        [post.caption, post.author?.username]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(query.trim().toLowerCase())),
      );

  return (
    <main className="mx-auto max-w-[1240px] px-4 py-4 lg:py-10">
      <section className="mx-auto max-w-5xl">
        <div className="text-center">
          <p className="font-display text-4xl text-ink lg:text-5xl">Explore</p>
          <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
            A discover view built from fresh drops and the recommendation engine.
          </p>
        </div>

        <div className="mx-auto mt-8 max-w-md rounded-full border border-[color:var(--line)] bg-white/84 px-5 py-4 shadow-soft">
          <div className="flex items-center gap-3">
            <Search size={18} className="text-[color:var(--muted)]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-full bg-transparent text-sm"
              placeholder="Stalk drops in explore"
            />
          </div>
        </div>

        {loading ? <p className="mt-10 text-center text-sm text-[color:var(--muted)]">Loading explore...</p> : null}
        {error ? <p className="mt-10 text-center text-sm text-red-500">{error}</p> : null}

        {!loading && !error && visiblePosts.length === 0 ? (
          <div className="mt-10">
            <EmptyState
              title="Nothing to explore yet"
              description={
                query.trim()
                  ? "No drops match this explore search yet."
                  : "Follow more people or create a few drops so explore has something to surface."
              }
            />
          </div>
        ) : null}

        <div className="mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {visiblePosts.map((post) => (
            <article key={post.id} className="panel overflow-hidden">
              <img src={post.image_url} alt={post.caption || `${post.author.username} drop`} className="aspect-square w-full object-cover" />
              <div className="px-4 py-4">
                <p className="font-semibold text-[color:var(--accent)]">@{post.author.username}</p>
                <p className="mt-2 max-h-[72px] overflow-hidden text-sm leading-6 text-[color:var(--muted)]">
                  {post.caption || "Fresh drop from your network."}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
