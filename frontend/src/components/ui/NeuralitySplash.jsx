export default function NeuralitySplash() {
  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center overflow-hidden z-[9999]">

      {/* Glow Background */}
      <div className="absolute w-72 h-72 rounded-full bg-cyan-500/10 blur-3xl animate-pulse" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center">

        {/* Logo */}
        <div className="w-20 h-20 rounded-3xl border border-cyan-400/30 bg-white/5 backdrop-blur-xl flex items-center justify-center shadow-[0_0_40px_rgba(0,255,255,0.2)] animate-pulse">
          <span className="text-4xl">⚡</span>
        </div>

        {/* Title */}
        <h1 className="mt-6 text-white text-3xl font-black tracking-tight">
          Neurality
        </h1>

        {/* Subtitle */}
        <p className="mt-2 text-cyan-200/70 text-sm tracking-wide">
          syncing your universe...
        </p>

        {/* Loading dots */}
        <div className="mt-6 flex gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" />
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce [animation-delay:150ms]" />
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce [animation-delay:300ms]" />
        </div>

      </div>
    </div>
  );
}