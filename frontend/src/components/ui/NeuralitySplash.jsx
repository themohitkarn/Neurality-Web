export default function NeuralitySplash() {
  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center overflow-hidden z-[9999]">
      {/* Background Glow */}
      <div 
        className="absolute w-72 h-72 rounded-full blur-3xl animate-pulse opacity-15"
        style={{ backgroundColor: "var(--accent, #e11d48)" }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center">
        {/* N Logo */}
        <div 
          className="w-24 h-24 rounded-3xl border bg-white/5 backdrop-blur-xl flex items-center justify-center shadow-2xl animate-pulse transition-all duration-300"
          style={{ 
            borderColor: "rgba(var(--accent-rgb, 225, 29, 72), 0.25)",
            boxShadow: "0 0 40px var(--accent-glow, rgba(225, 29, 72, 0.2))"
          }}
        >
          <svg className="w-14 h-14" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="splash-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="var(--accent, #e11d48)" />
                <stop offset="100%" stopColor="var(--gradient-end, #f97316)" />
              </linearGradient>
              <filter id="splash-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <path 
              d="M30 75V25L70 75V25" 
              stroke="url(#splash-grad)" 
              strokeWidth="12" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              filter="url(#splash-glow)"
            />
            <circle cx="30" cy="25" r="5" fill="var(--accent, #e11d48)" />
            <circle cx="70" cy="75" r="5" fill="var(--accent, #e11d48)" />
          </svg>
        </div>

        {/* Title */}
        <h1 className="mt-6 text-white text-3xl font-black tracking-tight drop-shadow-md">
          Neurality
        </h1>

        {/* Subtitle */}
        <p className="mt-2 text-white/60 text-sm tracking-wide font-medium">
          syncing your universe...
        </p>

        {/* Loading dots */}
        <div className="mt-6 flex gap-2">
          <span 
            className="w-2.5 h-2.5 rounded-full animate-bounce" 
            style={{ backgroundColor: "var(--accent, #e11d48)" }}
          />
          <span 
            className="w-2.5 h-2.5 rounded-full animate-bounce [animation-delay:150ms]" 
            style={{ backgroundColor: "var(--accent, #e11d48)" }}
          />
          <span 
            className="w-2.5 h-2.5 rounded-full animate-bounce [animation-delay:300ms]" 
            style={{ backgroundColor: "var(--accent, #e11d48)" }}
          />
        </div>
      </div>
    </div>
  );
}