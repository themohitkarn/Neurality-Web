import { ImagePlus, Sparkles, WandSparkles, Volume2, VolumeX, X, Images, Music, Mic, Expand } from "lucide-react";
import AdaptiveEditorViewport from "./AdaptiveEditorViewport";
import { useState, useEffect } from "react";
import { detectMediaDimensions } from "../utils/mediaUtils";


export default function PostComposer({
  caption,
  setCaption,
  captionPrompt,
  setCaptionPrompt,
  captionIdeas,
  captionHashtags,
  selectedFile,
  setSelectedFile,
  selectedFiles = [],
  setSelectedFiles,
  isMuted,
  setIsMuted,
  generatingCaptions,
  posting,
  onGenerateCaptions,
  onApplyCaptionSuggestion,
  onAppendHashtags,
  onSubmit,
  onEditMedia,
  selectedAudio,
  setSelectedAudio,
  onFileSelect,
  compact = false,
}) {
  const [activeMeta, setActiveMeta] = useState(null);
  const hasMultiFiles = selectedFiles && selectedFiles.length > 0;
  const primaryFile = hasMultiFiles ? selectedFiles[0] : selectedFile;
  const isVideo = primaryFile?.type?.startsWith("video/");

  useEffect(() => {
    if (primaryFile) {
      detectMediaDimensions(primaryFile).then(setActiveMeta).catch(console.error);
    } else {
      setActiveMeta(null);
    }
  }, [primaryFile]);

  return (
    <section className="panel soft-ring px-5 py-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgba(142,13,115,0.14)]">
            <ImagePlus size={20} className="text-[color:var(--accent)]" />
          </div>
          <div>
            <p className="font-display text-2xl text-ink">{compact ? "New drop" : "Start a drop"}</p>
            <p className="text-sm text-[color:var(--muted)]">
              {compact ? "Upload fast from mobile." : "Upload a new image or video and shape the drop with AI."}
            </p>
          </div>
        </div>
      </div>

      {/* Main Preview Area */}
      {primaryFile && (
        <div className="mb-8 group relative animate-in fade-in zoom-in duration-500">
           <AdaptiveEditorViewport 
              src={URL.createObjectURL(primaryFile)}
              type={isVideo ? "video" : "image"}
              meta={activeMeta}
              className="shadow-2xl shadow-black/20"
           >
              {/* Floating Toolbar inside preview */}
              <div className="absolute top-4 right-4 z-30 flex items-center gap-2">
                 <button 
                   type="button"
                   onClick={() => onEditMedia && onEditMedia(primaryFile, 0)}
                   className="p-2.5 rounded-xl bg-black/40 backdrop-blur-md border border-white/10 text-white hover:bg-white/20 transition-all active:scale-95 pointer-events-auto"
                 >
                   <WandSparkles size={18} />
                 </button>
                 <button 
                   type="button"
                   onClick={() => {
                     setSelectedFile(null);
                     setSelectedFiles([]);
                   }}
                   className="p-2.5 rounded-xl bg-black/40 backdrop-blur-md border border-white/10 text-white hover:bg-red-500/80 transition-all active:scale-95 pointer-events-auto"
                 >
                   <X size={18} />
                 </button>
              </div>
           </AdaptiveEditorViewport>
        </div>
      )}

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <textarea
          value={caption}
          onChange={(event) => setCaption(event.target.value)}
          className="field min-h-[130px] resize-none"
          placeholder="What are you dropping today?"
          maxLength={500}
        />

        <div className="rounded-[24px] border border-[color:var(--line)] bg-white/66 px-4 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[rgba(142,13,115,0.12)]">
              <WandSparkles size={18} className="text-[color:var(--accent)]" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-ink">AI caption assistant</p>
              <p className="mt-1 text-xs leading-5 text-[color:var(--muted)]">
                Describe the vibe, location, or intent. If a file is selected, the AI can use that too.
              </p>
            </div>
          </div>

          <textarea
            value={captionPrompt}
            onChange={(event) => setCaptionPrompt(event.target.value)}
            className="field mt-4 min-h-[96px] resize-none"
            placeholder="Golden hour by the sea, quiet weekend reset, post-gym energy..."
            maxLength={240}
          />

          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={onGenerateCaptions}
              disabled={generatingCaptions}
              className="ghost-button gap-2"
            >
              <Sparkles size={16} />
              {generatingCaptions ? "Generating..." : "Generate caption"}
            </button>

            {captionHashtags.length > 0 ? (
              <button type="button" onClick={onAppendHashtags} className="ghost-button gap-2">
                Add hashtags
              </button>
            ) : null}
          </div>

          {captionIdeas.length > 0 ? (
            <div className="mt-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">
                Suggestions
              </p>
              {captionIdeas.map((idea, index) => (
                <button
                  key={`${idea}-${index}`}
                  type="button"
                  onClick={() => onApplyCaptionSuggestion(idea)}
                  className="block w-full rounded-[20px] border border-[color:var(--line)] bg-white/82 px-4 py-3 text-left text-sm leading-6 text-ink transition hover:-translate-y-[1px] hover:bg-white"
                >
                  {idea}
                </button>
              ))}
            </div>
          ) : null}

          {captionHashtags.length > 0 ? (
            <div className="mt-4 rounded-[20px] bg-[rgba(142,13,115,0.08)] px-4 py-3 text-sm text-[color:var(--muted)]">
              <span className="font-medium text-ink">Hashtags:</span> {captionHashtags.join(" ")}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-3">
          <label className="flex cursor-pointer items-center justify-between rounded-[24px] border border-dashed border-[color:var(--line)] bg-white/70 px-4 py-4 transition hover:bg-white">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-ink">Media upload</p>
                {hasMultiFiles && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                    {selectedFiles.length} files
                  </span>
                )}
              </div>
              <p className="text-xs text-[color:var(--muted)] line-clamp-1">
                {hasMultiFiles
                  ? `${selectedFiles.length} files selected (carousel)`
                  : selectedFile
                    ? selectedFile.name
                    : "Choose photo(s) or video · Select multiple for carousel"}
              </p>
            </div>
            <span className="ghost-button flex items-center gap-1">
              <Images size={14} />
              Select
            </span>
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={(event) => {
                const files = Array.from(event.target.files || []);
                if (onFileSelect) {
                  onFileSelect(files);
                  return;
                }
                if (files.length > 1 && setSelectedFiles) {
                  setSelectedFiles(files);
                  setSelectedFile(files[0]);
                } else if (files.length === 1) {
                  setSelectedFile(files[0]);
                  if (setSelectedFiles) setSelectedFiles([]);
                }
              }}
            />
          </label>

          {/* Multi-file preview strip */}
          {hasMultiFiles && (
            <div className="flex gap-3 overflow-x-auto px-1 py-4 scrollbar-hide">
              {selectedFiles.map((file, idx) => (
                <div key={idx} className="relative flex-shrink-0 w-24 h-32 rounded-2xl overflow-hidden border border-white/10 shadow-lg group">
                  <img
                    src={URL.createObjectURL(file)}
                    alt={`Preview ${idx + 1}`}
                    className="w-full h-full object-cover transition-transform group-hover:scale-110"
                  />
                  
                  {/* Edit button overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex flex-col items-center justify-center transition-all opacity-0 group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onEditMedia && onEditMedia(file, idx);
                      }}
                      className="p-2 rounded-xl bg-white/20 backdrop-blur-md border border-white/20 text-white hover:bg-white/40 transition-all active:scale-90 mb-2"
                    >
                      <WandSparkles size={16} />
                    </button>
                    <p className="text-[10px] font-bold text-white uppercase tracking-widest drop-shadow-md">Edit</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const next = selectedFiles.filter((_, i) => i !== idx);
                      setSelectedFiles(next);
                      if (next.length <= 1) {
                        setSelectedFile(next[0] || null);
                        setSelectedFiles([]);
                      }
                    }}
                    className="absolute top-2 right-2 w-6 h-6 rounded-xl bg-black/60 backdrop-blur-md flex items-center justify-center hover:bg-red-500 transition-colors z-10"
                  >
                    <X size={12} className="text-white" />
                  </button>
                  <div className="absolute bottom-2 left-2 text-[10px] font-bold text-white bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded-lg border border-white/10">
                    {idx + 1}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Video sound or Image audio controls */}
          {(isVideo || selectedAudio) && (
            <div className="flex items-center justify-between rounded-[24px] border border-[color:var(--line)] bg-white/50 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${isMuted ? 'bg-red-100 text-red-500' : 'bg-blue-100 text-blue-500'}`}>
                  {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink">
                    {isVideo ? "Video sound" : "Background audio"}
                  </p>
                  <p className="text-xs text-[color:var(--muted)]">
                    {isMuted ? 'Sound will be muted' : 'Sound will be included'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {selectedAudio && !isVideo && (
                  <button 
                    type="button"
                    onClick={() => setSelectedAudio(null)}
                    className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 hover:text-red-500 mr-2"
                  >
                    Remove
                  </button>
                )}
                <button 
                  type="button" 
                  onClick={() => setIsMuted(!isMuted)}
                  className={`text-xs font-bold uppercase tracking-wider ${isMuted ? 'text-red-500' : 'text-blue-500'}`}
                >
                  {isMuted ? 'Unmute' : 'Mute'}
                </button>
              </div>
            </div>
          )}

          {/* Audio selection for Images */}
          {!isVideo && (selectedFile || hasMultiFiles) && !selectedAudio && (
            <label className="flex cursor-pointer items-center justify-between rounded-[24px] border border-[color:var(--line)] bg-white/40 px-5 py-3 transition hover:bg-white/60">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[rgba(142,13,115,0.08)]">
                  <Music size={16} className="text-[color:var(--accent)]" />
                </div>
                <div>
                  <p className="text-xs font-bold text-ink">Add background music</p>
                  <p className="text-[10px] text-[color:var(--muted)]">MP3 or WAV supported</p>
                </div>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--accent)]">Select</span>
              <input
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file && setSelectedAudio) setSelectedAudio(file);
                }}
              />
            </label>
          )}
        </div>

        <button type="submit" disabled={posting} className="accent-button w-full">
          {posting ? "Dropping..." : compact ? "Drop now" : "Publish drop"}
        </button>
      </form>
    </section>
  );
}
