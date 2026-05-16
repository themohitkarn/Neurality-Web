import React, { createContext, useContext, useState } from "react";

const MediaContext = createContext();

export function MediaProvider({ children }) {
  const [activeMedia, setActiveMedia] = useState(null); // { url, type, sender }

  const openMedia = (url, type = "image", sender = null) => {
    setActiveMedia({ url, type, sender });
  };

  const closeMedia = () => {
    setActiveMedia(null);
  };

  return (
    <MediaContext.Provider value={{ activeMedia, openMedia, closeMedia }}>
      {children}
    </MediaContext.Provider>
  );
}

export const useMedia = () => useContext(MediaContext);
