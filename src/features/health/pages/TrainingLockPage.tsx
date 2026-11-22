import { useTranslation as useScreenTranslation } from "react-i18next";
import { useState, useEffect, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/shared/components/ui/Button";
import { EmptyState } from "@/shared/components/ui/EmptyState";
import { Badge } from "@/shared/components/ui/Badge";
import { Alert } from "@/shared/components/ui/Alert";
import { Card } from "@/shared/components/ui/Card";
import { DataTable, type Column } from "@/shared/components/ui/DataTable";
import { Pagination } from "@/shared/components/ui/Pagination";
import { HealthBadge } from "@/shared/components/ui/HealthBadge";
import { Tabs } from "@/shared/components/ui/Tabs";
import { Input } from "@/shared/components/form/Input";
import { PageHeader } from "@/shared/components/layout/PageHeader";
import styles from "./TrainingLockPage.module.css";
import { formatDate } from "@/shared/lib/format";
import type { HealthStatus } from "@/shared/types/enums";
import { useAuth } from "@/shared/components/layout/AuthProvider";
import { useToast } from "@/shared/components/ui/Toast";
import { healthApi } from "../api";
import { TrainingLockModal } from "../components/TrainingLockModal";
import type { TrainingLockHistoryItem } from "../types";
import { getHorses } from "@/features/horses/api";
import { HEALTH_STATUS } from "@/shared/lib/status";

import { tr } from "@/shared/i18n/tr";
export default function TrainingLockPage() {
  useScreenTranslation();
  const { user } = useAuth();
  const toast = useToast();
  const isVet = user?.role === "VETERINARIAN";
  const [searchParams] = useSearchParams();
  const urlHorseId = searchParams.get("horseId");
  const urlAction = searchParams.get("action");
  const highlightId = searchParams.get("highlight");

  const [activeTab, setActiveTab] = useState<string>("ACTIVE");
  const [locks, setLocks] = useState<TrainingLockHistoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState(false);
  const [horsesError, setHorsesError] = useState(false);
  const [horsesLoading, setHorsesLoading] = useState(true);
  const [search, setSearch] = useState<string>("");
  const [page, setPage] = useState(1);
  const [selectedLock, setSelectedLock] = useState<TrainingLockHistoryItem | null>(null);
  const [modalMode, setModalMode] = useState<"place" | "extend" | "lift" | null>(null);

  const [horses, setHorses] = useState<any[]>([]);

  useEffect(() => {
    if (urlAction === "place" && isVet) {
      setModalMode("place");
    }
  }, [urlAction, isVet]);

  const loadHorses = useCallback(async () => {
    setHorsesLoading(true);
    try {
      const res = await getHorses({ limit: 100 });
      setHorses(res.items || []);
      setHorsesError(false);
    } catch {
      setHorsesError(true);
    } finally {
      setHorsesLoading(false);
    }
  }, []);

  useEffect(() => { void loadHorses(); }, [loadHorses]);

  const loadLocks = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(false);
      const data = await healthApi.getLocks();
      setLocks(Array.isArray(data) ? data : []);
    } catch {
      setLocks([]);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLocks();
  }, [loadLocks]);

  useEffect(() => {
    const handleSync = () => {
      void loadLocks();
    };
    window.addEventListener("horsesUpdated", handleSync);
    window.addEventListener("storage", handleSync);
    return () => {
      window.removeEventListener("horsesUpdated", handleSync);
      window.removeEventListener("storage", handleSync);
    };
  }, [loadLocks]);

  const safeLocks = Array.isArray(locks) ? locks : [];

  const filteredLocks = safeLocks.filter((item) => {
    const matchesTab = activeTab === "ALL" ? true : item.status === activeTab;
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      item.horseId?.toLowerCase().includes(q) ||
      (item.horseName && item.horseName.toLowerCase().includes(q)) ||
      (item.lockReason && item.lockReason.toLowerCase().includes(q)) ||
      (item.lockCode && item.lockCode.toLowerCase().includes(q));
    return matchesTab && matchesSearch;
  });

  const counts = {
    ACTIVE: safeLocks.filter((l) => l.status === "ACTIVE").length,
    RELEASED: safeLocks.filter((l) => l.status === "RELEASED").length,
    ALL: safeLocks.length,
  };
  const pageSize = 10;

  useEffect(() => {
    if (!highlightId || safeLocks.length === 0) return;
    const target = safeLocks.find(
      (l) => l.id === highlightId || l.lockCode === highlightId || l.horseId === highlightId || l.horseCode === highlightId
    );
    if (!target) return;
    if (activeTab !== "ALL" && target.status !== activeTab) {
      setActiveTab("ALL");
    }
    const matching = safeLocks.filter((l) => (activeTab === "ALL" || target.status === activeTab ? true : l.status === target.status));
    const idx = matching.findIndex((l) => l.id === target.id);
    if (idx >= 0) {
      setPage(Math.floor(idx / pageSize) + 1);
    }
  }, [highlightId, safeLocks]);

  const currentPage = Math.min(page, Math.max(1, Math.ceil(filteredLocks.length / pageSize)));
  const visibleLocks = filteredLocks.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const columns: Column<TrainingLockHistoryItem>[] = [
    {
      key: "lockCode",
      header: tr("Lock code"),
      render: (lock) => <span className="num">{lock.lockCode}</span>,
    },
    {
      key: "horse",
      header: tr("Horse"),
      render: (lock) => (
        <Link to={`/medical/horses/${lock.horseId}`} style={{ fontWeight: 600, color: "var(--text)" }}>
          {lock.horseName || lock.horseId}
        </Link>
      ),
    },
    {
      key: "reason",
      header: tr("Reason"),
      // Không đặt % cho cột: tổng % + cột Thao tác 200px vượt 100% làm cột Lý do co còn ~57px, chữ vỡ từng ký tự (BUG-MAN-12).
      render: (lock) => (
        <div className={styles.reason}>
          <span className={styles.reasonText} title={lock.lockReason}>{lock.lockReason}</span>
          <span style={{ fontSize: "var(--fs-caption)", lineHeight: "16px", color: "var(--muted)", wordBreak: "break-word" }}>
            {tr("Vet:")} {lock.lockedBy}
          </span>
        </div>
      ),
    },
    {
      key: "period",
      header: tr("Review by"),
      render: (lock) => (
        <div style={{ display: "grid" }}>
          <span className="num nowrap">{formatDate(lock.reviewDate)}</span>
          <span className="num nowrap" style={{ fontSize: "var(--fs-caption)", color: "var(--muted)" }}>
            {tr("Locked")} {formatDate(lock.lockedAt)}
          </span>
        </div>
      ),
    },
    {
      key: "status",
      header: tr("Status"),
      // Trạng thái khóa + trạng thái y tế áp dụng chung một ô (bớt cột để Thao tác không bị cắt).
      render: (lock) => (
        <div style={{ display: "grid", gap: 6, justifyItems: "start" }}>
          {lock.status === "ACTIVE" ? (
            <Badge tone="danger" icon="lock">
              {tr("Active")}
            </Badge>
          ) : (
            <Badge tone="neutral" icon="unlock">
              {tr("Released")}
            </Badge>
          )}
          {lock.appliedMedicalStatus in HEALTH_STATUS ? (
            <HealthBadge status={lock.appliedMedicalStatus as HealthStatus} />
          ) : (
            <Badge tone="danger">{lock.appliedMedicalStatus}</Badge>
          )}
        </div>
      ),
    },
    ...(isVet
      ? [
        {
          key: "actions",
          header: tr("Actions"),
          align: "right" as const,
          render: (lock: TrainingLockHistoryItem) =>
            lock.status === "ACTIVE" ? (
              <div className={styles.rowActions}>
                <Button
                  tone="secondary"
                  size="sm"
                  onClick={() => {
                    setSelectedLock(lock);
                    setModalMode("extend");
                  }}
                >
                  {tr("Extend")}
                </Button>
                <Button
                  tone="secondary"
                  size="sm"
                  icon="unlock"
                  data-testid="training-lock-lift-btn"
                  onClick={() => {
                    setSelectedLock(lock);
                    setModalMode("lift");
                  }}
                >
                  {tr("Lift lock")}
                </Button>
              </div>
            ) : (
              <span className={styles.release}>
                {tr("Released")}{" "}{lock.releasedAt ? formatDate(lock.releasedAt) : "—"} · {lock.releaseReason || "—"}
              </span>
            ),
        },
      ]
      : []),
  ];

  return (
    <div className={styles.page}>
      <PageHeader
        title={tr("Training Locks")}
        description={tr("Heavy workouts and trial runs are blocked while a horse has an active medical lock.")}
        action={
          isVet && (
            <Button
              icon="lock"
              disabled={horsesLoading || horsesError || loading || loadError}
              onClick={() => {
                setSelectedLock(null);
                setModalMode("place");
              }}
            >
              {tr("Place Training Lock")}
            </Button>
          )
        }
      />

      {horsesError && <Alert tone="danger" title={tr("Could not load horses")}
        action={<Button size="sm" tone="secondary" onClick={() => void loadHorses()}>{tr("Try again")}</Button>}>
        {tr("Check your connection and try again.")}
      </Alert>}

      <Card pad={0}>
        {loadError ? <Alert tone="danger" title={tr("Failed to load training locks")}
          action={<Button size="sm" tone="secondary" onClick={() => void loadLocks()}>{tr("Try again")}</Button>}>
          {tr("Check your connection and try again.")}
        </Alert> : <>
        <div className={styles.toolbar}>
          <Tabs
            label={tr("Filter by lock status")}
            items={[
              { id: "ACTIVE", label: tr("Active"), count: loading ? undefined : counts.ACTIVE },
              { id: "RELEASED", label: tr("Released"), count: loading ? undefined : counts.RELEASED },
              { id: "ALL", label: tr("All"), count: loading ? undefined : counts.ALL },
            ]}
            active={activeTab}
            onChange={(value) => { setActiveTab(value); setPage(1); }}
          />
          <div className={styles.search}>
            <Input
              icon="search"
              aria-label={tr("Search locks")}
              placeholder={tr("Lock code, horse or reason")}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
        </div>
        <DataTable
          caption={tr("Training locks")}
          columns={columns}
          stackOnNarrow
          rows={visibleLocks}
          rowKey={(lock) => lock.id || lock.lockCode}
          loading={loading}
          empty={
            <EmptyState
              icon="lock"
              title={tr(search ? "No locks match this search" : activeTab === "ACTIVE" ? "No active Training Locks" : activeTab === "RELEASED" ? "No released Training Locks" : "No Training Locks yet")}
              description={tr(
                search
                  ? "Try a lock code, a horse name or part of the reason."
                  : "When the Veterinarian places a lock on an injured horse, it appears here."
              )}
            />
          }
        />
        {!loading && filteredLocks.length > 0 && (
          <div style={{ borderTop: "1px solid var(--border)" }}>
            <Pagination page={currentPage} pageSize={pageSize} total={filteredLocks.length} noun="locks" onPage={setPage} />
          </div>
        )}
        </>}
      </Card>

      {/* Lock Modals */}
      {modalMode && (modalMode !== "place" || (!horsesLoading && !horsesError && !loading && !loadError)) && (() => {
        const activeLockHorseIds = new Set(
          safeLocks.filter((l) => l.status === "ACTIVE").map((l) => l.horseId),
        );
        const eligibleHorsesForLock = horses.filter(
          (h) => !h.isMedicalLocked && !activeLockHorseIds.has(h.id) && h.status !== "RETIRED",
        );
        const targetHorseFromUrl = urlHorseId ? horses.find((h) => h.id === urlHorseId) : undefined;
        const defaultHorse = targetHorseFromUrl;
        const effectiveHorseId = selectedLock?.horseId || defaultHorse?.id || "";

        return (
          <TrainingLockModal
            key={`${modalMode}-${effectiveHorseId}-${horses.length}`}
            horseName={
              selectedLock
                ? selectedLock.horseName
                  ? `${selectedLock.horseName} (${selectedLock.horseCode || selectedLock.horseId})`
                  : selectedLock.horseId
                : defaultHorse
                  ? `${defaultHorse.name} (${defaultHorse.horseCode || defaultHorse.microchip || defaultHorse.microchipRfid || ""})`
                  : "Horse"
            }
            horseId={effectiveHorseId}
            horseOptions={eligibleHorsesForLock.map((h) => ({
              value: h.id,
              label: `${h.name} (${h.horseCode || h.microchip || h.microchipRfid || ""}) - ${h.status || ""}`,
            }))}
            currentReviewDate={selectedLock?.reviewDate}
            mode={modalMode}
            onClose={() => {
              setModalMode(null);
              setSelectedLock(null);
            }}
            onPlaceLock={async (dto) => {
              const targetHorseId = dto.horseId || effectiveHorseId;
              if (!targetHorseId) {
                toast.show(tr("No eligible horses available to place a training lock."), "danger");
                return;
              }
              const targetHorse = horses.find((h) => h.id === targetHorseId);
              const horseLabel = targetHorse?.name || tr("Horse");

              const placed = await healthApi.applyTrainingLock(targetHorseId, {
                appliedMedicalStatus: dto.appliedStatus,
                lockReason: dto.reason,
                reviewDate: dto.reviewDate,
                unlockConditions: dto.unlockConditions,
              });
              toast.show(tr("Training lock placed for {{horse}}", { horse: horseLabel }), "danger");
              if (placed?.impactAssessment?.notificationFailed) toast.show(tr("Some care notifications could not be sent."), "warn");
            if (placed?.impactAssessment?.careSyncFailed) toast.show(tr("Care checklist could not be updated."), "warn");
            const withdrawal = placed?.impactAssessment?.raceWithdrawal;
              if (withdrawal?.failed) {
                toast.show(tr("Lock placed, but race entries could not be withdrawn automatically. Ask the club manager to scratch them."), "danger");
              } else if (withdrawal && withdrawal.scratched > 0) {
                toast.show(tr("{{count}} upcoming race entries were withdrawn.", { count: withdrawal.scratched }), "warn");
              }
              setModalMode(null);
              setSelectedLock(null);
              void loadLocks();
            }}
            onLiftLock={async (dto) => {
              if (!selectedLock) return;
              const released = await healthApi.releaseTrainingLock(selectedLock.id, {
                targetStatus: dto.restoreStatus,
                releaseReason: dto.reason,
                horseId: selectedLock.horseId,
              });
            if (released?.notificationFailed) toast.show(tr("Some care notifications could not be sent."), "warn");
            if (released?.careSyncFailed) toast.show(tr("Care checklist could not be updated."), "warn");
              toast.show(
                tr("Training lock lifted successfully. Horse status: {{status}}", {
                  status: HEALTH_STATUS[dto.restoreStatus as keyof typeof HEALTH_STATUS]?.label
                    ? tr(HEALTH_STATUS[dto.restoreStatus as keyof typeof HEALTH_STATUS].label)
                    : dto.restoreStatus,
                }),
                "ok",
              );
              setModalMode(null);
              setSelectedLock(null);
              void loadLocks();
            }}
            onExtendLock={async (dto) => {
              if (!selectedLock) return;
              const extended = await healthApi.extendTrainingLock(selectedLock.id, {
                newReviewDate: dto.newReviewDate,
                reason: dto.reason,
                horseId: selectedLock.horseId,
              });
            if (extended?.notificationFailed) toast.show(tr("Some care notifications could not be sent."), "warn");
              toast.show(tr("Training lock review date extended to {{date}}", { date: dto.newReviewDate }), "ok");
              setModalMode(null);
              setSelectedLock(null);
              void loadLocks();
            }}
          />
        );
      })()}
    </div>
  );
}
