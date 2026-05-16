import { useState, useRef, useEffect } from "react";
import { X, Upload, Clapperboard, Music, Volume2, VolumeX } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getErrorMessage, reelApi } from "../services/api";
import { useVideoPlayback } from "../context/VideoPlaybackContext";
import AspectRatioSelector from "./AspectRatioSelector";
import { detectMediaDimensions } from "../utils/mediaUtils";
import AdaptiveEditorViewport from "./AdaptiveEditorViewport";


export default function BeatCreator({ isOpen, onClose, onPublished }) {
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [videoPreview, setVideoPreview] = useState(null);
  const [caption, setCaption] = useState("");
  const [aspectRatio, setAspectRatio] = useState("9:16");
  const [mediaMeta, setMediaMeta] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);
  const previewVideoRef = useRef(null);

  const { isPlaybackEnabled, pausePlayback, resumePlayback } = useVideoPlayback();

  // Handle modal playback state
  useEffect(() => {
    if (isOpen) {
      pausePlayback();
    }
    return () => {
      if (isOpen) resumePlayback();
    };
  }, [isOpen, pausePlayback, resumePlayback]);

  // Handle preview video playback
  useEffect(() => {
    const video = previewVideoRef.current;
    if (!video) return;

    if (isPlaybackEnabled) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [isPlaybackEnabled, videoPreview]);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("video/")) {
        setError("Please select a valid video file.");
        return;
      }
      setSelectedVideo(file);
      setVideoPreview(URL.createObjectURL(file));
      setError("");

      try {
        const meta = await detectMediaDimensions(file);
        setMediaMeta(meta);
        setAspectRatio(meta.aspectRatio);
      } catch (err) {
        console.error("Error detecting media meta:", err);
      }
    }
  };

  const handlePublish = async () => {
    if (!selectedVideo) return;
    setUploading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("video", selectedVideo);
      formData.append("caption", caption);
      formData.append("is_muted", isMuted ? "true" : "false");
      formData.append("aspect_ratio", aspectRatio);
      
      if (mediaMeta) {
        formData.append("width", mediaMeta.width);
        formData.append("height", mediaMeta.height);
        formData.append("orientation", mediaMeta.orientation);
      }

      const { data } = await reelApi.upload(formData);
      onPublished && onPublished(data.reel);
      handleClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setSelectedVideo(null);
    setVideoPreview(null);
    setCaption("");
    setError("");
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex flex-col bg-black text-white"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <button onClick={handleClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <X size={24} />
            </button>
            <h2 className="text-lg font-bold">New Beat</h2>
            <button
              onClick={handlePublish}
              disabled={!selectedVideo || uploading}
              className="px-6 py-2 bg-[color:var(--accent)] rounded-full font-bold text-sm disabled:opacity-50 disabled:grayscale transition-all hover:scale-105"
            >
              {uploading ? "Publishing..." : "Share"}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto pb-safe">
            <div className="max-w-md mx-auto p-4 space-y-6">
              {/* Video Preview / Upload Area */}
                <div className="w-full relative group transition-all duration-500 shadow-2xl overflow-hidden rounded-[32px]">
                {videoPreview ? (
                  <AdaptiveEditorViewport
                    src={videoPreview}
                    type="video"
                    meta={mediaMeta}
                    showControls={false}
                    className="w-full"
                  >
                    <div className="absolute top-4 right-4 flex flex-col gap-2 z-30">
                      <button
                        onClick={() => setIsMuted(!isMuted)}
                        className="p-3 bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl text-white hover:bg-white/20 transition-all active:scale-95 pointer-events-auto"
                      >
                        {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                      </button>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="p-3 bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl text-white hover:bg-white/20 transition-all active:scale-95 pointer-events-auto"
                      >
                        <Upload size={20} />
                      </button>
                    </div>
                  </AdaptiveEditorViewport>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full aspect-[9/16] bg-zinc-900 border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-4 p-8 text-center hover:bg-zinc-800 transition-colors"
                  >
                    <div className="w-20 h-20 rounded-3xl bg-white/5 flex items-center justify-center text-[color:var(--accent)] group-hover:scale-110 transition-transform">
                      <Clapperboard size={40} />
                    </div>
                    <div>
                      <p className="font-bold text-xl">Select Beat</p>
                      <p className="text-sm text-zinc-500 mt-1">Up to 60 seconds recommended</p>
                    </div>
                    <div className="mt-4 px-8 py-2.5 bg-white text-black rounded-full text-xs font-bold uppercase tracking-wider transition-all active:scale-95">
                      Choose File
                    </div>
                  </button>
                )}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="video/*"
                  className="hidden"
                />
              </div>

              {/* Form Fields */}
              <div className="space-y-6">
                <AspectRatioSelector 
                  activeRatio={aspectRatio} 
                  onChange={setAspectRatio} 
                />

                <div>
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1 mb-2 block">
                    Caption
                  </label>
                  <textarea
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="Tell your story..."
                    className="w-full bg-zinc-900/50 border border-white/10 rounded-2xl p-4 text-sm focus:border-[color:var(--accent)] outline-none transition-colors min-h-[100px] resize-none"
                  />
                </div>

                <div className="p-4 rounded-2xl bg-zinc-900/30 border border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Music size={18} className="text-zinc-500" />
                    <span className="text-sm font-medium">Original Audio</span>
                  </div>
                  <span className="text-xs text-zinc-500 italic">Auto-detected</span>
                </div>

                {error && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs text-center font-medium">
                    {error}
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
