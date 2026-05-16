const sizeMap = {
  xs: 28,
  sm: 36,
  md: 44,
  lg: 64,
  xl: 88,
};

const textSizeMap = {
  xs: "text-[10px]",
  sm: "text-xs",
  md: "text-sm",
  lg: "text-xl",
  xl: "text-2xl",
};


export default function Avatar({ src, name = "", size = "md", hasStory = false, storySeen = false, className = "", onClick }) {
  const dimension = sizeMap[size] || sizeMap.md;
  const textSize = textSizeMap[size] || textSizeMap.md;
  const initial = name ? name.charAt(0).toUpperCase() : "?";
  const borderWidth = size === "xs" || size === "sm" ? 2 : 3;

  const avatarContent = src ? (
    <img
      src={src}
      alt={name}
      className="h-full w-full rounded-full object-cover"
      loading="lazy"
      draggable={false}
    />
  ) : (
    <div
      className={`flex h-full w-full items-center justify-center rounded-full font-semibold ${textSize}`}
      style={{ background: "var(--surface-active)", color: "var(--text-secondary)" }}
    >
      {initial}
    </div>
  );

  if (hasStory) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`shrink-0 p-[${borderWidth}px] rounded-full transition-transform duration-200 active:scale-95 ${
          storySeen ? "story-ring-seen" : "story-ring"
        } ${className}`}
        style={{ width: dimension + borderWidth * 2 + 4, height: dimension + borderWidth * 2 + 4 }}
      >
        <div className="story-ring-inner rounded-full" style={{ width: dimension + 4, height: dimension + 4 }}>
          <div style={{ width: dimension, height: dimension }} className="rounded-full overflow-hidden">
            {avatarContent}
          </div>
        </div>
      </button>
    );
  }

  const Wrapper = onClick ? "button" : "div";

  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`shrink-0 rounded-full overflow-hidden transition-transform duration-200 ${onClick ? "active:scale-95" : ""} ${className}`}
      style={{ width: dimension, height: dimension }}
    >
      {avatarContent}
    </Wrapper>
  );
}
