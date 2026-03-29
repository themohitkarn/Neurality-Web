import { ImagePlus, Sparkles, WandSparkles } from "lucide-react";


export default function PostComposer({
  caption,
  setCaption,
  captionPrompt,
  setCaptionPrompt,
  captionIdeas,
  captionHashtags,
  selectedFile,
  setSelectedFile,
  generatingCaptions,
  posting,
  onGenerateCaptions,
  onApplyCaptionSuggestion,
  onAppendHashtags,
  onSubmit,
  compact = false,
}) {
  return (
    <section className="panel soft-ring px-5 py-6">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgba(142,13,115,0.14)]">
          <ImagePlus size={20} className="text-[color:var(--accent)]" />
        </div>
        <div>
          <p className="font-display text-2xl text-ink">{compact ? "New drop" : "Start a drop"}</p>
          <p className="text-sm text-[color:var(--muted)]">
            {compact ? "Upload fast from mobile." : "Upload a new image and shape the drop with AI."}
          </p>
        </div>
      </div>

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
                Describe the vibe, location, or intent. If a photo is selected, the AI can use that too.
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

        <label className="flex cursor-pointer items-center justify-between rounded-[24px] border border-dashed border-[color:var(--line)] bg-white/70 px-4 py-4 transition hover:bg-white">
          <div>
            <p className="text-sm font-medium text-ink">Photo upload</p>
            <p className="text-xs text-[color:var(--muted)]">
              {selectedFile ? selectedFile.name : "Choose a photo for the drop"}
            </p>
          </div>
          <span className="ghost-button">Select</span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
          />
        </label>

        <button type="submit" disabled={posting} className="accent-button w-full">
          {posting ? "Dropping..." : compact ? "Drop now" : "Publish drop"}
        </button>
      </form>
    </section>
  );
}
