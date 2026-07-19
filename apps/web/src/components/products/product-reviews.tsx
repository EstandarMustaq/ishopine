"use client";

import { Star } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Review } from "@/lib/types";

interface ProductReviewsProps {
  productId: string;
}

function Stars({
  value,
  onChange,
  size = "sm",
}: {
  value: number;
  onChange?: (v: number) => void;
  size?: "sm" | "md";
}) {
  const cls = size === "md" ? "size-5" : "size-4";
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(n)}
          className={cn(
            "text-[#61005D]",
            onChange && "cursor-pointer hover:opacity-80",
            !onChange && "cursor-default",
          )}
          aria-label={`${n} estrelas`}
        >
          <Star
            className={cn(cls, n <= value ? "fill-current" : "opacity-30")}
          />
        </button>
      ))}
    </div>
  );
}

export function ProductReviews({ productId }: ProductReviewsProps) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api<Review[] | { items: Review[] }>(
        `/products/${productId}/reviews`,
        { token: null },
      );
      setReviews(Array.isArray(data) ? data : (data.items ?? []));
    } catch {
      setReviews([]);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    void load();
  }, [load]);

  const avg =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken) {
      toast.message("Entre para avaliar o produto");
      return;
    }
    setSubmitting(true);
    try {
      await api(`/products/${productId}/reviews`, {
        method: "POST",
        body: JSON.stringify({
          rating,
          title: title || undefined,
          comment: comment || undefined,
        }),
      });
      toast.success("Avaliação enviada");
      setTitle("");
      setComment("");
      setRating(5);
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao enviar avaliação",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mt-14 border-t border-border pt-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-charcoal">Avaliações</h2>
          <p className="mt-1 text-sm text-taupe">
            {reviews.length === 0
              ? "Ainda sem avaliações"
              : `${avg.toFixed(1)} · ${reviews.length} avaliação${reviews.length > 1 ? "ões" : ""}`}
          </p>
        </div>
        {reviews.length > 0 && <Stars value={Math.round(avg)} />}
      </div>

      {accessToken && (
        <form
          onSubmit={onSubmit}
          className="mt-6 max-w-lg space-y-3 rounded-[12px] bg-beige p-5"
        >
          <div>
            <Label>Nota</Label>
            <div className="mt-1">
              <Stars value={rating} onChange={setRating} size="md" />
            </div>
          </div>
          <div>
            <Label htmlFor="review-title">Título (opcional)</Label>
            <Input
              id="review-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
            />
          </div>
          <div>
            <Label htmlFor="review-comment">Comentário (opcional)</Label>
            <Textarea
              id="review-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
            />
          </div>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Enviando..." : "Enviar avaliação"}
          </Button>
        </form>
      )}

      {loading ? (
        <p className="mt-6 text-sm text-taupe">Carregando avaliações...</p>
      ) : reviews.length === 0 ? (
        <p className="mt-6 text-sm text-taupe">
          Seja o primeiro a avaliar este produto.
        </p>
      ) : (
        <ul className="mt-6 space-y-4">
          {reviews.map((review) => (
            <li
              key={review.id}
              className="rounded-[12px] border border-border p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Stars value={review.rating} />
                <span className="text-xs text-taupe">
                  {formatDate(review.createdAt)}
                </span>
              </div>
              {review.title && (
                <p className="mt-2 text-sm font-semibold text-charcoal">
                  {review.title}
                </p>
              )}
              {review.comment && (
                <p className="mt-1 text-sm text-taupe">{review.comment}</p>
              )}
              {review.user?.name && (
                <p className="mt-2 text-xs font-medium text-charcoal">
                  {review.user.name}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
