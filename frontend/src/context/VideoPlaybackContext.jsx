import { createContext, useContext, useState, useEffect } from "react";

const VideoPlaybackContext = createContext();

export function VideoPlaybackProvider({ children }) {
  const [activeVideoId, setActiveVideoId] = useState(null);
  const [isAppVisible, setIsAppVisible] = useState(true);
  const [modalsCount, setModalsCount] = useState(0);

  // Handle global visibility changes (tab switch, app minimize)
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsAppVisible(document.visibilityState === "visible");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const pausePlayback = () => setModalsCount(c => c + 1);
  const resumePlayback = () => setModalsCount(c => Math.max(0, c - 1));

  const isPlaybackEnabled = isAppVisible && modalsCount === 0;

  return (
    <VideoPlaybackContext.Provider
      value={{
        activeVideoId,
        setActiveVideoId,
        isPlaybackEnabled,
        pausePlayback,
        resumePlayback,
      }}
    >
      {children}
    </VideoPlaybackContext.Provider>
  );
}

export function useVideoPlayback() {
  return useContext(VideoPlaybackContext);
}
