import { useState } from "react";
import { Sparkles } from "lucide-react";

import PostComposer from "../components/PostComposer";
import MediaEditor from "../components/MediaEditor";
import { useAuth } from "../context/AuthContext";
import { aiApi, getErrorMessage, postApi } from "../services/api";
import { detectMediaDimensions } from "../utils/mediaUtils";


export default function Drop() {
  const { setUser } = useAuth();
  const [caption, setCaption] = useState("");
  const [captionPrompt, setCaptionPrompt] = useState("");
  const [captionIdeas, setCaptionIdeas] = useState([]);
  const [captionHashtags, setCaptionHashtags] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [selectedAudio, setSelectedAudio] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [posting, setPosting] = useState(false);
  const [generatingCaptions, setGeneratingCaptions] = useState(false);
  const [editingMedia, setEditingMedia] = useState(null); // { file, index, url }
  const [mediaMeta, setMediaMeta] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleGenerateCaptions = async () => {
    if (!captionPrompt.trim() && !selectedFile) {
      setError("Add a short prompt or choose a media file before generating AI captions.");
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
    const hasFiles = selectedFiles.length > 0 || selectedFile;
    if (!hasFiles) {
      setError("Choose a media file before posting it.");
      return;
    }

    setPosting(true);
    setError("");
    setMessage("");

    try {
      const payload = new FormData();
      payload.append("caption", caption);

      // Multi-image carousel
      if (selectedFiles.length > 1) {
        for (const file of selectedFiles) {
          payload.append("images", file);
        }
        payload.append("media_type", "image");
      } else {
        const file = selectedFile || selectedFiles[0];
        payload.append("image", file);
        payload.append("media_type", file.type.startsWith("video") ? "video" : "image");
      }

      if (selectedAudio) {
        payload.append("audio", selectedAudio);
      }

      if (mediaMeta) {
        payload.append("width", mediaMeta.width);
        payload.append("height", mediaMeta.height);
        payload.append("aspect_ratio", mediaMeta.aspectRatio);
        payload.append("orientation", mediaMeta.orientation);
      }

      payload.append("is_muted", isMuted ? "true" : "false");

      await postApi.create(payload);
      setCaption("");
      setCaptionPrompt("");
      setCaptionIdeas([]);
      setCaptionHashtags([]);
      setSelectedFile(null);
      setSelectedFiles([]);
      setSelectedAudio(null);
      setIsMuted(false);
      setMessage("Post published.");
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
  
  const handleFileSelect = async (files) => {
    if (files.length > 1) {
      setSelectedFiles(files);
      setSelectedFile(files[0]);
    } else if (files.length === 1) {
      setSelectedFile(files[0]);
      setSelectedFiles([]);
    }

    if (files.length > 0) {
      try {
        const meta = await detectMediaDimensions(files[0]);
        setMediaMeta(meta);
      } catch (err) {
        console.error("Error detecting media meta:", err);
      }
    }
  };

  const handleEditMedia = (file, index) => {
    setEditingMedia({
      file,
      index,
      url: URL.createObjectURL(file)
    });
  };

  const handleSaveEditedMedia = (blob) => {
    const editedFile = new File([blob], editingMedia.file.name, { type: "image/jpeg" });
    
    if (selectedFiles.length > 0) {
      const next = [...selectedFiles];
      next[editingMedia.index] = editedFile;
      setSelectedFiles(next);
      if (editingMedia.index === 0) setSelectedFile(editedFile);
    } else {
      setSelectedFile(editedFile);
    }
    
    setEditingMedia(null);
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
          selectedFiles={selectedFiles}
          setSelectedFiles={setSelectedFiles}
          isMuted={isMuted}
          setIsMuted={setIsMuted}
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
          onEditMedia={handleEditMedia}
          onFileSelect={handleFileSelect}
          selectedAudio={selectedAudio}
          setSelectedAudio={setSelectedAudio}
        />

        {editingMedia && (
          <MediaEditor 
            media={editingMedia} 
            onClose={() => setEditingMedia(null)} 
            onSave={handleSaveEditedMedia} 
          />
        )}

        <aside className="space-y-6 xl:sticky xl:top-10 xl:self-start">
          <section className="panel soft-ring px-5 py-6">
            <div className="flex items-center gap-2 text-[color:var(--accent)]">
              <Sparkles size={16} />
              <span className="text-sm font-semibold">Drop studio</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
              This is your dedicated dropping surface. Draft the caption, use AI if you want, and publish without leaving the flow.
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
