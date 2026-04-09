export function LoadingSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-48 bg-muted rounded-lg" />
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-12 bg-muted rounded-lg" />
        ))}
      </div>
    </div>
  );
}
