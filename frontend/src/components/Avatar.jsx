const sizeClasses = {
  sm: "h-10 w-10 text-sm",
  md: "h-12 w-12 text-base",
  lg: "h-16 w-16 text-lg",
  xl: "h-24 w-24 text-2xl",
};


export default function Avatar({ src, name = "User", size = "md", className = "" }) {
  const initials = name.trim().charAt(0).toUpperCase() || "N";
  const baseClass = sizeClasses[size] || sizeClasses.md;

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`${baseClass} rounded-full object-cover ${className}`}
      />
    );
  }

  return (
    <div
      className={`${baseClass} flex items-center justify-center rounded-full bg-[rgba(142,13,115,0.14)] font-display font-semibold text-[color:var(--accent)] ${className}`}
    >
      {initials}
    </div>
  );
}
