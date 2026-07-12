interface LoadingSkeletonProps {
  type?: "card" | "table" | "list";
  count?: number;
}

export function LoadingSkeleton({ type = "card", count = 3 }: LoadingSkeletonProps) {
  const items = Array.from({ length: count });

  if (type === "table") {
    return (
      <div className="w-full space-y-3.5 animate-pulse">
        <div className="h-8 bg-default rounded-lg w-full" />
        {items.map((_, i) => (
          <div key={i} className="flex gap-4 items-center">
            <div className="h-6.5 bg-default/60 rounded-md flex-1" />
            <div className="h-6.5 bg-default/60 rounded-md w-24" />
            <div className="h-6.5 bg-default/60 rounded-md w-32" />
            <div className="h-6.5 bg-default/60 rounded-md w-20" />
          </div>
        ))}
      </div>
    );
  }

  if (type === "list") {
    return (
      <div className="space-y-3 animate-pulse">
        {items.map((_, i) => (
          <div key={i} className="flex gap-3 items-center border border-separator rounded-lg p-3">
            <div className="h-9 w-9 rounded-full bg-default" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 bg-default rounded w-1/3" />
              <div className="h-2.5 bg-default/65 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-3 animate-pulse">
      {items.map((_, i) => (
        <div key={i} className="h-24 border border-separator bg-surface rounded-xl p-5 space-y-3.5">
          <div className="h-3 bg-default rounded w-1/3" />
          <div className="h-6 bg-default/70 rounded w-1/2" />
        </div>
      ))}
    </div>
  );
}
