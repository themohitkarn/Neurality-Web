import { useEffect, useState } from "react";
import { Search } from "lucide-react";

import Avatar from "../components/Avatar";
import { getErrorMessage, userApi } from "../services/api";


export default function Stalk() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setLoading(false);
      setError("");
      return undefined;
    }

    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await userApi.search(query.trim());
        setResults(data.users || []);
        setError("");
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    }, 220);

    return () => window.clearTimeout(timer);
  }, [query]);

  return (
    <main className="mx-auto max-w-[1240px] px-4 py-4 lg:py-10">
      <section className="mx-auto max-w-4xl space-y-8">
        <div className="text-center">
          <p className="font-display text-4xl text-ink lg:text-5xl">Stalk</p>
          <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
            Stalk profiles, follow the ones you like, and jump straight into their space.
          </p>
        </div>

        <div className="mx-auto max-w-xl rounded-full border border-[color:var(--line)] bg-white/84 px-5 py-4 shadow-soft">
          <div className="flex items-center gap-3">
            <Search size={18} className="text-[color:var(--muted)]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-full bg-transparent text-sm"
              placeholder="Stalk someone by username or full name"
            />
          </div>
        </div>

        {loading ? <p className="text-center text-sm text-[color:var(--muted)]">Stalking profiles...</p> : null}
        {error ? <p className="text-center text-sm text-red-500">{error}</p> : null}

        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {results.map((person) => (
            <article key={person.id} className="panel px-5 py-6 text-center">
              <div className="mx-auto w-fit rounded-full border-2 border-[color:var(--accent)]/40 p-1">
                <Avatar src={person.profile_pic} name={person.username} size="lg" />
              </div>
              <p className="mt-4 text-lg font-semibold text-[color:var(--accent)]">@{person.username}</p>
              <p className="mt-2 text-sm text-[color:var(--muted)]">
                {person.posts_count} drops | {person.followers_count} followers
              </p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
