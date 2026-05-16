/**
 * Detects the dimensions and aspect ratio of an image or video file.
 * @param {File} file - The media file to analyze.
 * @returns {Promise<{width: number, height: number, aspectRatio: string, orientation: string}>}
 */
export const detectMediaDimensions = (file) => {
  return new Promise((resolve, reject) => {
    const isVideo = file.type.startsWith("video/");
    const url = URL.createObjectURL(file);

    if (isVideo) {
      const video = document.createElement("video");
      video.src = url;
      video.onloadedmetadata = () => {
        const { videoWidth: width, videoHeight: height } = video;
        resolve(calculateMetadata(width, height));
        URL.revokeObjectURL(url);
      };
      video.onerror = () => {
        reject(new Error("Failed to load video metadata"));
        URL.revokeObjectURL(url);
      };
    } else {
      const img = new Image();
      img.src = url;
      img.onload = () => {
        const { width, height } = img;
        resolve(calculateMetadata(width, height));
        URL.revokeObjectURL(url);
      };
      img.onerror = () => {
        reject(new Error("Failed to load image dimensions"));
        URL.revokeObjectURL(url);
      };
    }
  });
};

const calculateMetadata = (width, height) => {
  const ratio = width / height;
  let orientation = "square";
  let aspectRatio = "1:1";

  if (ratio > 1.2) {
    orientation = "landscape";
    aspectRatio = "16:9";
  } else if (ratio < 0.8) {
    orientation = "portrait";
    aspectRatio = "9:16";
  } else if (ratio < 1 && ratio >= 0.8) {
    orientation = "portrait";
    aspectRatio = "4:5";
  } else {
    orientation = "square";
    aspectRatio = "1:1";
  }

  // Exact ratio string for better precision if needed
  const exactRatio = `${width}:${height}`;

  return { width, height, aspectRatio, orientation, exactRatio };
};
