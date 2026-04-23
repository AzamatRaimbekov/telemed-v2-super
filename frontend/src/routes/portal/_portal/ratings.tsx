import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Star, Send } from "lucide-react";
import portalApiClient from "@/lib/portal-api-client";

export const Route = createFileRoute("/portal/_portal/ratings")({
  component: RatingsPage,
});

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(star)}
          className="transition-transform hover:scale-110"
        >
          <Star
            size={28}
            className={`transition-colors ${(hover || value) >= star ? "fill-amber-400 text-amber-400" : "text-gray-200"}`}
          />
        </button>
      ))}
    </div>
  );
}

function RatingsPage() {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const queryClient = useQueryClient();

  const { data: myRatings } = useQuery({
    queryKey: ["portal-ratings"],
    queryFn: async () => {
      const { data } = await portalApiClient.get("/portal/ratings/my");
      return data;
    },
  });

  const submitRating = useMutation({
    mutationFn: async () => {
      await portalApiClient.post("/portal/ratings", { doctor_id: doctorId, rating, comment: comment || undefined });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal-ratings"] });
      setRating(0);
      setComment("");
      setDoctorId("");
    },
  });

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Оценка врачей</h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">Помогите улучшить качество обслуживания</p>
      </div>

      {/* Submit form */}
      <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Оставить отзыв</h2>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-[var(--color-text-secondary)]">Ваша оценка:</span>
            <StarRating value={rating} onChange={setRating} />
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Комментарий (необязательно)"
            className="w-full h-24 px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-sm resize-none focus:outline-none focus:border-[var(--color-secondary)]/40"
          />
          <button
            onClick={() => submitRating.mutate()}
            disabled={!rating || submitRating.isPending}
            className="h-10 px-6 rounded-xl bg-[var(--color-secondary)] text-white text-sm font-semibold disabled:opacity-50 flex items-center gap-2"
          >
            <Send size={14} /> Отправить
          </button>
        </div>
      </div>

      {/* My ratings */}
      <div>
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">Мои отзывы</h2>
        {!myRatings?.length ? (
          <p className="text-sm text-[var(--color-text-tertiary)]">У вас пока нет отзывов</p>
        ) : (
          <div className="space-y-3">
            {myRatings.map((r: any) => (
              <div key={r.id} className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-4">
                <div className="flex items-center gap-2 mb-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} size={14} className={i < r.rating ? "fill-amber-400 text-amber-400" : "text-gray-200"} />
                  ))}
                </div>
                {r.comment && <p className="text-sm text-[var(--color-text-secondary)]">{r.comment}</p>}
                <p className="text-xs text-[var(--color-text-tertiary)] mt-2">{new Date(r.created_at).toLocaleDateString("ru-RU")}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
