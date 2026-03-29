import { useState } from "react";
import { Sparkles } from "lucide-react";

import PostComposer from "../components/PostComposer";
import { useAuth } from "../context/AuthContext";
import { aiApi, getErrorMessage, postApi } from "../services/api";


export default function Drop() {
  const { setUser } = useAuth();
  const [caption, setCaption] = useState("");
  const [captionPrompt, setCaptionPrompt] = useState("");
  const [captionIdeas, setCaptionIdeas] = useState([]);
  const [captionHashtags, setCaptionHashtags] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [posting, setPosting] = useState(false);
  const [generatingCaptions, setGeneratingCaptions] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleGenerateCaptions = async () => {
    if (!captionPrompt.trim() && !selectedFile) {
      setError("Add a short prompt or choose an image before generating AI captions.");
      return;
    }

    setGeneratingCaptions(true);
    setError("");
    setMessage("");

    try {
      const payload = new FormData();
      if (captionPrompt.trim()) {
        payload.append("prompt", captionPrompt.trim());
      }
      if (selectedFile) {
        payload.append("image", selectedFile);
      }
      const { data } = await aiApi.generateCaption(payload);
      setCaptionIdeas(data.captions || []);
      setCaptionHashtags(data.hashtags || []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setGeneratingCaptions(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!selectedFile) {
      setError("Choose an image before dropping it.");
      return;
    }

    setPosting(true);
    setError("");
    setMessage("");

    try {
      const payload = new FormData();
      payload.append("caption", caption);
      payload.append("image", selectedFile);
      await postApi.create(payload);
      setCaption("");
      setCaptionPrompt("");
      setCaptionIdeas([]);
      setCaptionHashtags([]);
      setSelectedFile(null);
      setMessage("Drop published.");
      setUser((current) =>
        current
          ? {
              ...current,
              posts_count: (current.posts_count || 0) + 1,
            }
          : current,
      );
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setPosting(false);
    }
  };

  return (
    <main className="mx-auto max-w-[1180px] px-4 py-4 lg:py-10">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <PostComposer
          caption={caption}
          setCaption={setCaption}
          captionPrompt={captionPrompt}
          setCaptionPrompt={setCaptionPrompt}
          captionIdeas={captionIdeas}
          captionHashtags={captionHashtags}
          selectedFile={selectedFile}
          setSelectedFile={setSelectedFile}
          generatingCaptions={generatingCaptions}
          posting={posting}
          onGenerateCaptions={handleGenerateCaptions}
          onApplyCaptionSuggestion={setCaption}
          onAppendHashtags={() => {
            const hashtagLine = captionHashtags.join(" ");
            if (!hashtagLine) {
              return;
            }
            setCaption((current) => (current.trim() ? `${current.trim()}\n\n${hashtagLine}` : hashtagLine));
          }}
          onSubmit={handleSubmit}
        />

        <aside className="space-y-6 xl:sticky xl:top-10 xl:self-start">
          <section className="panel soft-ring px-5 py-6">
            <div className="flex items-center gap-2 text-[color:var(--accent)]">
              <Sparkles size={16} />
              <span className="text-sm font-semibold">Drop studio</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
              This is your dedicated posting surface. Draft the caption, use AI if you want, and publish without leaving the flow.
            </p>
          </section>

          {message ? (
            <div className="rounded-[24px] bg-[rgba(142,13,115,0.08)] px-5 py-4 text-sm text-[color:var(--accent)]">
              {message}
            </div>
          ) : null}
          {error ? <div className="rounded-[24px] bg-red-50 px-5 py-4 text-sm text-red-500">{error}</div> : null}
        </aside>
      </div>
    </main>
  );
}
