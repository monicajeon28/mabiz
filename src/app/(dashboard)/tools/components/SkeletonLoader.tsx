export function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-3/4 mb-3" />
      <div className="h-3 bg-gray-100 rounded w-full mb-2" />
      <div className="h-3 bg-gray-100 rounded w-2/3" />
    </div>
  );
}

export function SkeletonTrainingCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 animate-pulse">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 bg-gray-200 rounded-lg" />
        <div className="flex-1">
          <div className="h-4 bg-gray-200 rounded w-2/3 mb-1" />
          <div className="h-3 bg-gray-100 rounded w-1/3" />
        </div>
      </div>
      <div className="h-3 bg-gray-100 rounded w-full mb-2" />
      <div className="h-3 bg-gray-100 rounded w-4/5" />
    </div>
  );
}

export function SkeletonRecommendationCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 animate-pulse">
      <div className="flex justify-between items-start mb-2">
        <div className="h-4 bg-gray-200 rounded w-1/2" />
        <div className="h-5 w-12 bg-gray-100 rounded-full" />
      </div>
      <div className="h-3 bg-gray-100 rounded w-full mb-1" />
      <div className="h-3 bg-gray-100 rounded w-3/4" />
    </div>
  );
}
