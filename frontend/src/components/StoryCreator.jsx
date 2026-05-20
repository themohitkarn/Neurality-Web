import { useState, useRef, useEffect } from "react";
import { X, Camera, Image as ImageIcon, RotateCcw, Zap, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import MediaEditor from "./MediaEditor";
import { useVideoPlayback } from "../context/VideoPlaybackContext";


export default function StoryCreator({ isOpen, onClose, onPublish, sharedContent = null }) {
  const [mode, setMode] = useState(sharedContent ? "edit" : "select"); // select, camera, edit
  const [media, setMedia] = useState(sharedContent ? { 
    type: sharedContent.type, // 'post' or 'reel'
    content: sharedContent,
    url: sharedContent.media_url || sharedContent.thumbnail_url || (sharedContent.carousel_images?.[0]?.image_url)
  } : null); // { file, url, type, content }
  
  const [cameraStream, setCameraStream] = useState(null);
  const [facingMode, setFacingMode] = useState("user");
  const [flash, setFlash] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  const videoRef = useRef(null);
  const fileInputRef = useRef(null);

  const { isPlaybackEnabled, pausePlayback, resumePlayback } = useVideoPlayback() || {};

  // Handle modal playback state
  useEffect(() => {
    if (isOpen && pausePlayback) {
      pausePlayback();
    }
    return () => {
      if (isOpen && resumePlayback) resumePlayback();
    };
  }, [isOpen, pausePlayback, resumePlayback]);

  // Handle camera video playback
  useEffect(() => {
    const video = videoRef.current;
    if (!video || mode !== "camera") return;

    if (isPlaybackEnabled) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [isPlaybackEnabled, mode]);

  // Handle open state reset
  useEffect(() => {
    if (isOpen) {
      if (sharedContent) {
        setMode("edit");
        setMedia({
          type: sharedContent.type,
          content: sharedContent,
          url: sharedContent.media_url || sharedContent.thumbnail_url || (sharedContent.carousel_images?.[0]?.image_url)
        });
      } else {
        setMode("select");
        setMedia(null);
      }
    }
  }, [isOpen, sharedContent]);

  // Stop camera when modal closes
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
    }
  }, [isOpen]);

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode },
        audio: false
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setMode("camera");
    } catch (err) {
      console.error("Camera error:", err);
      alert("Unable to access camera. Please check permissions.");
    }
  };

  const flipCamera = () => {
    setFacingMode(prev => prev === "user" ? "environment" : "user");
    stopCamera();
    setTimeout(startCamera, 100);
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    
    // Flip if front camera
    if (facingMode === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    
    ctx.drawImage(video, 0, 0);
    
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      setMedia({ file: blob, url, type: "image" });
      setMode("edit");
      stopCamera();
    }, "image/jpeg", 0.9);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      const type = file.type.startsWith("video") ? "video" : "image";
      setMedia({ file, url, type });
      setMode("edit");
    }
  };

  const handleEditorSave = async ({ blob, layers, paths, selectedFilter, imageRotation, adjustments }) => {
    setIsPublishing(true);
    try {
      const formData = new FormData();
      if (media?.type === "video") {
        formData.append("image", media.file, media.file.name || "story_video.mp4");
        formData.append("media_type", "video");
      } else {
        formData.append("image", blob, "story_image.png");
        formData.append("media_type", "image");
      }
      
      // Save all overlays, drawings, adjustments, and filters as text_style
      const textStyleData = {
        layers,
        paths,
        selectedFilter,
        imageRotation,
        adjustments
      };
      formData.append("text_style", JSON.stringify(textStyleData));
      formData.append("is_muted", "false");
      
      if (media?.content) {
        if (media.type === "post") formData.append("post_id", media.content.id);
        if (media.type === "reel") formData.append("reel_id", media.content.id);
      }
      
      await onPublish(formData);
      onClose();
      // Reset
      setMode("select");
      setMedia(null);
    } catch (err) {
      console.error("Publish error:", err);
    } finally {
      setIsPublishing(false);
    }
  };


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black text-white overflow-hidden">
      {/* Media Editor Overlay (replaces standard edit UI) */}
      {mode === "edit" && media && (
        <MediaEditor 
          media={media} 
          onClose={() => setMode("select")} 
          onSave={handleEditorSave} 
        />
      )}

      {/* Header (Selection & Camera Only) */}
      {mode !== "edit" && (
        <div className="absolute top-0 inset-x-0 z-50 flex items-center justify-between p-4 bg-gradient-to-b from-black/60 to-transparent">
          <button onClick={onClose} className="p-2 rounded-full bg-black/20 backdrop-blur-md">
            <X size={24} />
          </button>
          
          {mode === "camera" && (
            <button onClick={flipCamera} className="p-2 rounded-full bg-black/20 backdrop-blur-md">
              <RotateCcw size={22} />
            </button>
          )}
        </div>
      )}


      {/* Main Content Area */}
      <div className="flex-1 relative flex items-center justify-center">
        
        {/* MODE: Select */}
        {mode === "select" && (
          <div className="flex flex-col items-center gap-8 animate-in fade-in zoom-in duration-300">
            <h2 className="text-xl font-bold">Add to story</h2>
            <div className="grid grid-cols-2 gap-4 w-full max-w-sm px-6">
              <button 
                onClick={startCamera}
                className="flex flex-col items-center justify-center gap-3 aspect-square rounded-3xl bg-[color:var(--bg-elevated)] border border-[color:var(--border)] hover:bg-[color:var(--surface)] transition-colors"
              >
                <div className="w-14 h-14 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
                  <Camera size={28} />
                </div>
                <span className="font-medium text-sm">Camera</span>
              </button>
              
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-3 aspect-square rounded-3xl bg-[color:var(--bg-elevated)] border border-[color:var(--border)] hover:bg-[color:var(--surface)] transition-colors"
              >
                <div className="w-14 h-14 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500">
                  <ImageIcon size={28} />
                </div>
                <span className="font-medium text-sm">Gallery</span>
              </button>
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*,video/*"
              onChange={handleFileSelect} 
            />
          </div>
        )}

        {/* MODE: Camera View */}
        {mode === "camera" && (
          <div className="w-full h-full relative">
            <video 
              ref={videoRef} 
              playsInline 
              className={`w-full h-full object-cover ${facingMode === "user" ? "scale-x-[-1]" : ""}`}
            />
            
            {/* Camera Controls */}
            <div className="absolute bottom-12 inset-x-0 flex items-center justify-center gap-12">
              <div className="w-12 h-12" /> {/* Spacer */}
              
              <button 
                onClick={capturePhoto}
                className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center p-1"
              >
                <div className="w-full h-full rounded-full bg-white active:scale-90 transition-transform" />
              </button>

              <button 
                onClick={() => setFlash(!flash)}
                className={`p-3 rounded-full ${flash ? "bg-yellow-400 text-black" : "bg-black/20 text-white"}`}
              >
                <Zap size={20} fill={flash ? "currentColor" : "none"} />
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
