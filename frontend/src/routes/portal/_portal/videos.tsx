import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import portalClient from "@/lib/portal-api-client";
import { useState } from "react";

export const Route = createFileRoute("/portal/_portal/videos")({
  component: VideosPage,
});

type Video = {
  id: string;
  title: string;
  category: string;
  description: string;
  duration: string;
  thumbnail: string;
  video_url: string;
};

type Category = { id: string; name: string; count: number };

function VideosPage() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: categories } = useQuery({
    queryKey: ["video-categories"],
    queryFn: () => portalClient.get("/video-instructions/categories").then((r) => r.data),
  });

  const { data: videos, isLoading } = useQuery({
    queryKey: ["video-instructions", activeCategory],
    queryFn: () =>
      portalClient
        .get("/video-instructions/", { params: activeCategory ? { category: activeCategory } : {} })
        .then((r) => r.data),
  });

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Видео-инструкции</h1>

      {/* Category tabs */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setActiveCategory(null)}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            !activeCategory
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-[var(--color-text-secondary)] hover:bg-muted/80"
          }`}
        >
          Все
        </button>
        {(categories ?? []).map((cat: Category) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              activeCategory === cat.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-[var(--color-text-secondary)] hover:bg-muted/80"
            }`}
          >
            {cat.name} ({cat.count})
          </button>
        ))}
      </div>

      {/* Video grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse rounded-2xl bg-muted h-48" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(videos ?? []).map((video: Video) => (
            <div
              key={video.id}
              className="rounded-2xl border border-border bg-[var(--color-surface)] overflow-hidden hover:shadow-md transition-shadow"
            >
              {/* Thumbnail placeholder */}
              <div className="relative h-32 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-12 h-12 text-primary/40">
                  <path d="M8 5v14l11-7z" />
                </svg>
                <span className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-0.5 rounded">
                  {video.duration}
                </span>
              </div>
              <div className="p-4 space-y-2">
                <h3 className="font-semibold text-foreground text-sm">{video.title}</h3>
                <button
                  onClick={() => setExpandedId(expandedId === video.id ? null : video.id)}
                  className="text-xs text-primary hover:underline"
                >
                  {expandedId === video.id ? "Скрыть описание" : "Подробнее"}
                </button>
                {expandedId === video.id && (
                  <p className="text-sm text-[var(--color-text-secondary)] mt-2">{video.description}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {videos && videos.length === 0 && (
        <p className="text-center text-[var(--color-text-tertiary)] py-8">Нет видео в этой категории</p>
      )}
    </div>
  );
}
