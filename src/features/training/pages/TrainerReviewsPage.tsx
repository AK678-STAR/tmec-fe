import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation as useScreenTranslation } from "react-i18next";
import { PageHeader } from "@/shared/components/layout/PageHeader";
import { Card } from "@/shared/components/ui/Card";
import { Alert } from "@/shared/components/ui/Alert";
import { Button } from "@/shared/components/ui/Button";
import { EmptyState } from "@/shared/components/ui/EmptyState";
import { KpiTile } from "@/shared/components/ui/KpiTile";
import { SkeletonTable } from "@/shared/components/ui/Skeleton";
import { useCurrentUser } from "@/shared/components/layout/AuthProvider";
import { formatDate } from "@/shared/lib/format";
import { messageFor } from "@/shared/lib/messages";
import { tr } from "@/shared/i18n/tr";
import { trainingApi } from "../api";
import { Stars } from "../components/TrainerReviewCard";
import type { TrainerReviewItem, TrainerReviewSummary } from "../types";
import styles from "./TrainerReviewsPage.module.css";

/** Đánh giá HLV từ chủ ngựa: CM xem mọi HLV, HLV xem của mình. */
export default function TrainerReviewsPage() {
  useScreenTranslation();
  const user = useCurrentUser();
  const isManager = user.role === "CLUB_MANAGER";
  const [data, setData] = useState<{ trainers: TrainerReviewSummary[]; items: TrainerReviewItem[] } | null>(null);
  const [error, setError] = useState("");
  const [trainerFilter, setTrainerFilter] = useState("ALL");
  const [ratingFilter, setRatingFilter] = useState(0);

  async function load() {
    setError("");
    try {
      setData(await trainingApi.getTrainerReviews());
    } catch (err) {
      setError(messageFor(err));
    }
  }
  useEffect(() => {
    void load();
  }, []);

  const trainers = data?.trainers ?? [];
  const items = data?.items ?? [];
  const shown = items.filter(
    (r) => (trainerFilter === "ALL" || r.trainer.id === trainerFilter) && (!ratingFilter || r.rating === ratingFilter),
  );
  const scope = trainerFilter === "ALL" ? items : items.filter((r) => r.trainer.id === trainerFilter);
  const avg = scope.length ? Math.round((10 * scope.reduce((t, r) => t + r.rating, 0)) / scope.length) / 10 : null;
  const low = scope.filter((r) => r.rating <= 2).length;
  const dist = [5, 4, 3, 2, 1].map((n) => ({ n, count: scope.filter((r) => r.rating === n).length }));

  return (
    <div className={styles.page}>
      <PageHeader
        title={isManager ? tr("Trainer reviews") : tr("My reviews")}
        description={isManager
          ? tr("Ratings and comments from horse owners, per training plan.")
          : tr("What horse owners say about your training plans.")}
      />

      {error && (
        <Alert tone="danger" title={tr("Could not load data")} action={<Button tone="secondary" onClick={() => void load()}>{tr("Try again")}</Button>}>
          {error}
        </Alert>
      )}

      <div className={styles.metrics}>
        <KpiTile label={tr("Average rating")} value={avg == null ? "—" : avg.toFixed(1)} unit="/ 5" caption={avg == null ? tr("No reviews yet") : undefined} />
        <KpiTile label={tr("Reviews")} value={String(scope.length)} caption={tr("From horse owners")} />
        <KpiTile
          label={tr("Low ratings (1–2★)")}
          value={String(low)}
          accent={low > 0}
          caption={low > 0 ? tr("Click to read them") : tr("None")}
          onClick={low > 0 ? () => setRatingFilter((f) => (f === 2 ? 0 : 2)) : undefined}
          active={ratingFilter === 2}
        />
        <Card title={tr("Rating spread")} pad={16}>
          <ul className={styles.dist}>
            {dist.map(({ n, count }) => (
              <li key={n}>
                <button type="button" className={ratingFilter === n ? styles.distActive : styles.distBtn} onClick={() => setRatingFilter((f) => (f === n ? 0 : n))} aria-pressed={ratingFilter === n}>
                  <span>{n}★</span>
                  <span className={styles.bar}><i style={{ width: scope.length ? `${(100 * count) / scope.length}%` : 0 }} /></span>
                  <span>{count}</span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {isManager && (
        <Card title={tr("Trainers")} subtitle={tr("Click a trainer to see only their reviews.")} pad={0}>
          {!data ? (
            <SkeletonTable columns={5} rows={4} />
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>{tr("Trainer")}</th>
                    <th className={styles.num}>{tr("Active plans")}</th>
                    <th className={styles.num}>{tr("Completed plans")}</th>
                    <th>{tr("Rating")}</th>
                    <th className={styles.num}>{tr("Reviews")}</th>
                  </tr>
                </thead>
                <tbody>
                  {trainers.map((t) => (
                    <tr
                      key={t.id}
                      className={trainerFilter === t.id ? styles.selected : styles.clickRow}
                      onClick={() => setTrainerFilter((f) => (f === t.id ? "ALL" : t.id))}
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setTrainerFilter((f) => (f === t.id ? "ALL" : t.id)); } }}
                      aria-selected={trainerFilter === t.id}
                    >
                      <td>
                        <strong>{t.fullName}</strong>
                        <span className={styles.sub}>{t.email}</span>
                      </td>
                      <td className={styles.num}>{t.activePlans}</td>
                      <td className={styles.num}>{t.completedPlans}</td>
                      <td>{t.avgRating == null ? <span className={styles.sub}>{tr("No reviews yet")}</span> : <span className={styles.rating}><Stars value={t.avgRating} size="sm" /> {t.avgRating.toFixed(1)}</span>}</td>
                      <td className={styles.num}>{t.reviewCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      <Card
        title={tr("Latest reviews")}
        subtitle={trainerFilter !== "ALL" || ratingFilter ? tr("{{count}} review(s) match the filter", { count: shown.length }) : undefined}
        action={trainerFilter !== "ALL" || ratingFilter ? <Button size="sm" tone="secondary" onClick={() => { setTrainerFilter("ALL"); setRatingFilter(0); }}>{tr("Clear filters")}</Button> : undefined}
      >
        {!data ? (
          <SkeletonTable columns={3} rows={3} />
        ) : shown.length === 0 ? (
          <EmptyState
            title={tr("No reviews yet")}
            description={tr("Horse owners can rate the trainer on any active or completed training plan.")}
          />
        ) : (
          <ul className={styles.list}>
            {shown.map((r) => (
              <li key={r.id} className={r.rating <= 2 ? styles.itemLow : styles.item}>
                <div className={styles.itemHead}>
                  <Stars value={r.rating} size="sm" />
                  <span className={styles.sub}>
                    {r.owner.fullName} · <Link to={`/training/plans/${r.trainingPlan.id}`}>{r.trainingPlan.planCode ?? r.trainingPlan.phaseName}</Link> · {r.trainingPlan.horse.name}
                    {isManager && <> · {tr("Trainer")}: {r.trainer.fullName}</>}
                  </span>
                  <span className={styles.date}>{formatDate(r.updatedAt)}</span>
                </div>
                {r.comment ? <p className={styles.comment}>{r.comment}</p> : <p className={styles.sub}>{tr("No comment.")}</p>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
