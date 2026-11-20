import { useState } from "react";
import { Card } from "@/shared/components/ui/Card";
import { Button } from "@/shared/components/ui/Button";
import { Textarea } from "@/shared/components/form/Textarea";
import { useToast } from "@/shared/components/ui/Toast";
import { formatDateTime } from "@/shared/lib/format";
import { messageFor } from "@/shared/lib/messages";
import { tr } from "@/shared/i18n/tr";
import { trainingApi } from "../api";
import type { PlanReview, TrainingPlan } from "../types";
import styles from "./TrainerReview.module.css";

const RATING_HINT = ["", "Very poor", "Poor", "Fair", "Good", "Excellent"];

/** Sao chỉ đọc (★★★★☆). */
export function Stars({ value, size = "md" }: { value: number; size?: "sm" | "md" }) {
  const rounded = Math.round(value);
  return (
    <span className={size === "sm" ? styles.starsSm : styles.stars} role="img" aria-label={tr("{{value}} out of 5 stars", { value: String(value) })}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= rounded ? styles.on : styles.off} aria-hidden="true">★</span>
      ))}
    </span>
  );
}

interface Props {
  plan: TrainingPlan;
  /** Chủ ngựa của giáo án: được viết / sửa. */
  canWrite: boolean;
  onSaved: (review: PlanReview) => void;
}

/** Chủ ngựa chấm sao + nhận xét HLV; CM / HLV chỉ xem. */
export function TrainerReviewCard({ plan, canWrite, onSaved }: Props) {
  const toast = useToast();
  const review = plan.review ?? null;
  const reviewable = plan.status === "ACTIVE" || plan.status === "COMPLETED";
  const [editing, setEditing] = useState(false);
  const [rating, setRating] = useState(review?.rating ?? 0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState(review?.comment ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!review && !(canWrite && reviewable)) return null;

  const showForm = canWrite && reviewable && (editing || !review);

  async function save() {
    if (rating < 1) {
      setError(tr("Pick 1 to 5 stars."));
      return;
    }
    setSaving(true);
    setError("");
    try {
      const saved = await trainingApi.saveReview(plan.id, { rating, comment: comment.trim() || undefined });
      onSaved({ id: saved.id, rating: saved.rating, comment: saved.comment, updatedAt: saved.updatedAt });
      setEditing(false);
      toast.show(tr("Thanks! Your review was sent to the trainer."), "ok");
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card
      title={canWrite ? tr("Rate the trainer") : tr("Owner review")}
      subtitle={canWrite ? tr("How did {{name}} handle this plan? The trainer and the club manager can read it.", { name: plan.headTrainerName }) : undefined}
      action={review && canWrite && reviewable && !editing ? <Button size="sm" tone="secondary" onClick={() => setEditing(true)}>{tr("Edit review")}</Button> : undefined}
    >
      {showForm ? (
        <div className={styles.form}>
          <div className={styles.picker} role="radiogroup" aria-label={tr("Rating")} onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={rating === n}
                aria-label={tr("{{value}} out of 5 stars", { value: String(n) })}
                className={n <= (hover || rating) ? styles.pickOn : styles.pickOff}
                onMouseEnter={() => setHover(n)}
                onClick={() => { setRating(n); setError(""); }}
              >
                ★
              </button>
            ))}
            <span className={styles.hint}>{hover || rating ? tr(RATING_HINT[hover || rating]) : tr("Tap a star")}</span>
          </div>
          <Textarea
            rows={3}
            maxLength={1000}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="What went well, what should change? (optional)"
            aria-label={tr("Comment")}
          />
          {error && <p className={styles.error} role="alert">{error}</p>}
          <div className={styles.actions}>
            {review && <Button tone="ghost" onClick={() => { setEditing(false); setRating(review.rating); setComment(review.comment ?? ""); setError(""); }}>{tr("Cancel")}</Button>}
            <Button tone="primary" disabled={saving} onClick={() => void save()}>{saving ? tr("Saving...") : review ? tr("Save review") : tr("Send review")}</Button>
          </div>
        </div>
      ) : review ? (
        <div className={styles.view}>
          <div className={styles.row}>
            <Stars value={review.rating} />
            <span className={styles.hint}>{tr(RATING_HINT[review.rating])} · {formatDateTime(review.updatedAt)}</span>
          </div>
          {review.comment ? <p className={styles.comment}>“{review.comment}”</p> : <p className={styles.hint}>{tr("No comment.")}</p>}
        </div>
      ) : null}
    </Card>
  );
}
