export function SkeletonCircle({ size = 40 }) {
  return (
    <div
      className="skeleton rounded-full shrink-0"
      style={{ width: size, height: size }}
    />
  );
}


export function SkeletonLine({ width = "100%", height = 14 }) {
  return (
    <div
      className="skeleton"
      style={{ width, height, borderRadius: 6 }}
    />
  );
}


export function SkeletonPostCard() {
  return (
    <div className="card p-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <SkeletonCircle size={36} />
        <div className="flex-1 space-y-2">
          <SkeletonLine width="40%" height={12} />
          <SkeletonLine width="25%" height={10} />
        </div>
      </div>

      {/* Image */}
      <div className="skeleton" style={{ width: "100%", height: 320, borderRadius: 0 }} />

      {/* Actions */}
      <div className="flex items-center gap-4 px-4 py-3">
        <SkeletonCircle size={28} />
        <SkeletonCircle size={28} />
        <SkeletonCircle size={28} />
      </div>

      {/* Text */}
      <div className="px-4 pb-4 space-y-2">
        <SkeletonLine width="30%" height={12} />
        <SkeletonLine width="80%" height={12} />
      </div>
    </div>
  );
}


export function SkeletonStoryBar() {
  return (
    <div className="flex gap-4 overflow-hidden px-4 py-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex flex-col items-center gap-2">
          <SkeletonCircle size={60} />
          <SkeletonLine width={48} height={10} />
        </div>
      ))}
    </div>
  );
}


export function SkeletonProfile() {
  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <SkeletonCircle size={80} />
      <SkeletonLine width={120} height={16} />
      <SkeletonLine width={200} height={12} />
      <div className="flex gap-8 mt-4">
        <div className="flex flex-col items-center gap-1">
          <SkeletonLine width={40} height={20} />
          <SkeletonLine width={48} height={10} />
        </div>
        <div className="flex flex-col items-center gap-1">
          <SkeletonLine width={40} height={20} />
          <SkeletonLine width={48} height={10} />
        </div>
        <div className="flex flex-col items-center gap-1">
          <SkeletonLine width={40} height={20} />
          <SkeletonLine width={48} height={10} />
        </div>
      </div>
    </div>
  );
}
