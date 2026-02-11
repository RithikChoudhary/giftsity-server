/**
 * Skeleton loaders that mimic actual card/content shapes while loading.
 * Uses Tailwind animate-pulse for a polished loading appearance.
 */

export function SkeletonProductCard() {
  return (
    <div className="bg-card border border-edge/50 rounded-xl overflow-hidden animate-pulse">
      {/* Image area */}
      <div className="aspect-square bg-inset" />
      {/* Content */}
      <div className="p-3 space-y-2.5">
        <div className="h-3 bg-inset rounded-full w-3/4" />
        <div className="h-3 bg-inset rounded-full w-1/2" />
        <div className="flex items-center justify-between pt-1">
          <div className="h-4 bg-inset rounded-full w-20" />
          <div className="h-3 bg-inset rounded-full w-12" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonSellerCard() {
  return (
    <div className="bg-card border border-edge/50 rounded-xl p-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-inset rounded-full" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 bg-inset rounded-full w-2/3" />
          <div className="h-3 bg-inset rounded-full w-1/3" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonLine({ width = 'w-full', height = 'h-3' }) {
  return <div className={`${height} ${width} bg-inset rounded-full animate-pulse`} />;
}

export function SkeletonProductGrid({ count = 8 }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonProductCard key={i} />
      ))}
    </div>
  );
}

export default SkeletonProductCard;
