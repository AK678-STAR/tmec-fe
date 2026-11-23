import { useEffect, useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { PageHeader } from "@/shared/components/layout/PageHeader";
import { useCurrentUser } from "@/shared/components/layout/AuthProvider";
import { Input } from "@/shared/components/form/Input";
import { Select } from "@/shared/components/form/Select";
import { Button } from "@/shared/components/ui/Button";
import { Badge } from "@/shared/components/ui/Badge";
import { Icon } from "@/shared/components/ui/Icon";
import { Modal } from "@/shared/components/ui/Modal";
import { useToast } from "@/shared/components/ui/Toast";
import { tr } from "@/shared/i18n/tr";
import { formatDateTime } from "@/shared/lib/format";
import { getAdmissions, cancelAdmission } from "../services/admissionService";
import type {
  HorseAdmissionRecord,
  AdmissionStatus,
} from "../types/admission.types";
import { AdmissionInspectionModal } from "../components/AdmissionInspectionModal";
import { AdmissionScheduleModal } from "../components/AdmissionScheduleModal";
import { AdmissionHistoryTimeline } from "../components/AdmissionHistoryTimeline";
import styles from "./HorseAdmissionListPage.module.css";

const getStatusOptions = (): Array<{ value: AdmissionStatus | "ALL"; label: string }> => [
  { value: "ALL", label: tr("All statuses") },
  { value: "PENDING_VERIFICATION", label: tr("Pending Verification") },
  { value: "APPOINTED", label: tr("Appointed") },
  { value: "INSPECTION_IN_PROGRESS", label: tr("Inspection in Progress") },
  { value: "APPROVED", label: tr("Approved") },
  { value: "REJECTED", label: tr("Rejected") },
  { value: "CANCELLED", label: tr("Cancelled") },
];

const STATUS_BADGES: Record<
  AdmissionStatus,
  { label: string; tone: "ok" | "warn" | "danger" | "info" | "neutral" }
> = {
  PENDING_VERIFICATION: { label: "Pending Verification", tone: "info" },
  APPOINTED: { label: "Appointed", tone: "warn" },
  INSPECTION_IN_PROGRESS: { label: "Inspection in Progress", tone: "info" },
  APPROVED: { label: "Approved", tone: "ok" },
  REJECTED: { label: "Rejected", tone: "danger" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
};

export default function HorseAdmissionListPage() {
  useTranslation();
  const toast = useToast();
  const currentUser = useCurrentUser();
  const isManager = currentUser?.role === "CLUB_MANAGER";
  const isVet = currentUser?.role === "VETERINARIAN";

  // Filter & Search states
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<AdmissionStatus | "ALL">("ALL");
  const [recent7Days, setRecent7Days] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);

  // Data states
  const [records, setRecords] = useState<HorseAdmissionRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [inspectingRecord, setInspectingRecord] = useState<HorseAdmissionRecord | null>(null);
  const [schedulingRecord, setSchedulingRecord] = useState<HorseAdmissionRecord | null>(null);
  const [historyRecord, setHistoryRecord] = useState<HorseAdmissionRecord | null>(null);
  const [cancellingRecord, setCancellingRecord] = useState<HorseAdmissionRecord | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  // Debounce search
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const handleSearchChange = (val: string) => {
    setSearchInput(val);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearch(val);
      setPage(1);
    }, 350);
  };

  const [reloadTrigger, setReloadTrigger] = useState(0);

  const fetchAdmissions = useCallback(() => {
    setLoading(true);
    setReloadTrigger((n) => n + 1);
  }, []);

  useEffect(() => {
    let active = true;
    getAdmissions({
      search: debouncedSearch,
      status: statusFilter,
      recent7Days,
      page,
      pageSize,
    })
      .then((res) => {
        if (active) {
          setRecords(res.data || []);
          setTotal(res.total || 0);
          setTotalPages(res.totalPages || Math.ceil((res.total || 0) / (res.pageSize || pageSize)) || 1);
          setError(null);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          const msg = err instanceof Error ? err.message : "Lỗi tải danh sách tiếp nhận";
          setError(msg);
          setLoading(false);
          toast.show(msg, "danger");
        }
      });

    return () => {
      active = false;
    };
  }, [debouncedSearch, statusFilter, recent7Days, page, pageSize, reloadTrigger, toast]);

  const handleToggle7Days = () => {
    setRecent7Days((prev) => !prev);
    setPage(1);
  };

  const handleConfirmCancel = async () => {
    if (!cancellingRecord) return;
    try {
      setCancelling(true);
      await cancelAdmission(cancellingRecord.id, {
        reason: cancelReason.trim() || undefined,
      });
      toast.show(tr("Admission record cancelled successfully"), "ok");
      setCancellingRecord(null);
      setCancelReason("");
      fetchAdmissions();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : tr("Failed to cancel admission record");
      toast.show(msg, "danger");
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className={styles.page}>
      <PageHeader
        title={tr("Horse Admissions & Verification")}
        description={tr("Manage identity verification, ISO microchip matching, and veterinary screening")}
      />

      {/* Toolbar */}
      <div className={styles.toolbarCard}>
        <div className={styles.toolbarRow}>
          {/* 1-click toggle recent 7 days */}
          <button
            type="button"
            className={`${styles.toggle7DaysBtn} ${recent7Days ? styles.toggle7DaysActive : ""}`}
            onClick={handleToggle7Days}
            title={tr("Horses admitted in last 7 days")}
          >
            <span>🟢</span>
            <span>{tr("Horses admitted in last 7 days")}</span>
            {recent7Days && <Icon name="check" size={14} />}
          </button>

          {/* Debounced Search */}
          <div className={styles.searchWrap}>
            <Input
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder={tr("Search by horse name, microchip, admission code, owner...")}
              icon="search"
            />
          </div>

          {/* Status Dropdown */}
          <div style={{ minWidth: "180px" }}>
            <Select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as AdmissionStatus | "ALL");
                setPage(1);
              }}
              options={getStatusOptions()}
            />
          </div>

          <Button tone="secondary" onClick={() => fetchAdmissions()} title={tr("Refresh")}>
            <Icon name="refresh" size={16} />
            {tr("Refresh")}
          </Button>
        </div>
      </div>

      {/* Table & Content */}
      <div className={styles.tableWrap}>
        {loading ? (
          <div style={{ padding: "40px", textAlign: "center", color: "var(--color-text-muted)" }}>
            <Icon name="refresh" size={24} style={{ margin: "0 auto 8px auto", animation: "spin 1s linear infinite" }} />
            <p>{tr("Loading admission records...")}</p>
          </div>
        ) : error ? (
          <div style={{ padding: "32px", textAlign: "center", color: "var(--color-danger, #b91c1c)" }}>
            <p>{error}</p>
            <Button tone="secondary" onClick={() => fetchAdmissions()}>{tr("Try again")}</Button>
          </div>
        ) : records.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--color-text-muted)" }}>
            <Icon name="clipboard" size={36} style={{ margin: "0 auto 12px auto", opacity: 0.5 }} />
            <h3 style={{ margin: "0 0 6px 0", fontSize: "16px", color: "var(--color-text)" }}>
              {tr("No admission records found")}
            </h3>
            <p style={{ margin: 0, fontSize: "13px" }}>
              {tr(
                recent7Days || debouncedSearch || statusFilter !== "ALL"
                  ? "Try adjusting your search terms or clearing filters."
                  : "No horse registration requests in the system yet."
              )}
            </p>
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{tr("Admission Code")}</th>
                <th>{tr("Horse Name")}</th>
                <th>{tr("Microchip No.")}</th>
                <th>{tr("Owner")}</th>
                <th>{tr("Appointment Date")}</th>
                <th>{tr("Examining Vet")}</th>
                <th>{tr("Status")}</th>
                <th style={{ textAlign: "right" }}>{tr("Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {records.map((rec) => {
                const badge = STATUS_BADGES[rec.status] || { label: rec.status, tone: "neutral" };
                const isPending = rec.status === "PENDING_VERIFICATION";
                const isAppointed = rec.status === "APPOINTED";
                const isInInspection = rec.status === "INSPECTION_IN_PROGRESS";
                const canInspect = (isAppointed || isInInspection) && (isManager || isVet);
                const canSchedule = (isPending || isAppointed) && isManager;
                const isOwnerSelf = currentUser?.id === rec.ownerId;
                const isOverdue3Days =
                  !!rec.appointmentDate &&
                  Date.now() - new Date(rec.appointmentDate).getTime() >= 3 * 24 * 60 * 60 * 1000;
                const canCancel = isManager
                  ? isAppointed && isOverdue3Days
                  : isOwnerSelf && (isPending || isAppointed);

                return (
                  <tr
                    key={rec.id}
                    className={styles.tableRow}
                    onClick={() => setHistoryRecord(rec)}
                    title={tr("Click row to view admission audit trail")}
                  >
                    <td className={styles.codeCell}>
                      {rec.admissionCode}
                    </td>
                    <td>
                      <div className={styles.horseCell}>
                        <span className={styles.horseName}>{rec.horse?.name || "—"}</span>
                        {rec.horse?.breed && <span className={styles.horseMeta}>{rec.horse.breed}</span>}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontFamily: "monospace" }}>
                          {rec.scannedMicrochip || rec.declaredMicrochip || rec.horse?.microchip || tr("None")}
                        </span>
                        {rec.microchipVerified && (
                          <span title={tr("Microchip verified")} style={{ color: "#16a34a" }}>
                            <Icon name="checkCircle" size={14} />
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div>
                        <span style={{ fontWeight: 500 }}>{rec.owner?.fullName || "—"}</span>
                        {rec.owner?.email && (
                          <div style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>
                            {rec.owner.email}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      {rec.appointmentDate ? (
                        formatDateTime(rec.appointmentDate)
                      ) : (
                        <span style={{ color: "var(--color-text-muted)" }}>{tr("Not scheduled")}</span>
                      )}
                    </td>
                    <td>
                      {rec.veterinarian?.fullName ? (
                        <span>{rec.veterinarian.fullName}</span>
                      ) : (
                        <span style={{ color: "var(--color-text-muted)" }}>{tr("Unassigned")}</span>
                      )}
                    </td>
                    <td>
                      <Badge tone={badge.tone}>{tr(badge.label)}</Badge>
                    </td>
                    <td style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                      <div className={styles.actionsCell} style={{ justifyContent: "flex-end" }}>
                        {canInspect && (
                          <Button
                            size="sm"
                            tone="primary"
                            onClick={() => setInspectingRecord(rec)}
                            title={tr("Inspect")}
                          >
                            <Icon name="shield" size={14} />
                            {tr("Inspect")}
                          </Button>
                        )}
                        {canSchedule && (
                          <Button
                            size="sm"
                            tone="secondary"
                            onClick={() => setSchedulingRecord(rec)}
                            title={tr("Schedule")}
                          >
                            <Icon name="calendar" size={14} />
                            {tr("Schedule")}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          tone="ghost"
                          onClick={() => setHistoryRecord(rec)}
                          title={tr("Click row to view admission audit trail")}
                        >
                          <Icon name="history" size={14} />
                        </Button>
                        {canCancel && (
                          <Button
                            size="sm"
                            tone="danger"
                            onClick={() => setCancellingRecord(rec)}
                            title={tr("Cancel admission")}
                          >
                            <Icon name="ban" size={14} />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Pagination bar */}
        {!loading && total > 0 && (
          <div className={styles.paginationWrap}>
            <span>
              {tr("Hiển thị {{count}} trên tổng số {{total}} hồ sơ", { count: records.length, total }) !== "Hiển thị " + records.length + " trên tổng số " + total + " hồ sơ"
                ? tr("Hiển thị {{count}} trên tổng số {{total}} hồ sơ", { count: records.length, total })
                : (tr("Showing {{count}} of {{total}} records", { count: records.length, total }))}
            </span>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <Button
                size="sm"
                tone="secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
              >
                {tr("Previous")}
              </Button>
              <span>
                {tr("Page {{page}} of {{total}}", { page, total: totalPages })}
              </span>
              <Button
                size="sm"
                tone="secondary"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              >
                {tr("Next")}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ADM-05 Modal Thẩm định Vi mạch & Pháp lý & Sức khỏe */}
      {inspectingRecord && (
        <AdmissionInspectionModal
          record={inspectingRecord}
          onClose={() => setInspectingRecord(null)}
          onSuccess={() => {
            fetchAdmissions();
          }}
        />
      )}

      {/* Modal Xếp lịch hẹn */}
      {schedulingRecord && (
        <AdmissionScheduleModal
          record={schedulingRecord}
          onClose={() => setSchedulingRecord(null)}
          onSuccess={() => {
            fetchAdmissions();
          }}
        />
      )}

      {/* Modal Xem lịch sử (Audit Log Timeline) */}
      {historyRecord && (
        <Modal
          title={tr("Admission Audit Trail — {{code}}", { code: historyRecord.admissionCode })}
          subtitle={`${tr("Horse Name")}: ${historyRecord.horse?.name || ""} · ${tr("Owner")}: ${historyRecord.owner?.fullName || ""}`}
          width={560}
          onClose={() => setHistoryRecord(null)}
        >
          <AdmissionHistoryTimeline
            admissionId={historyRecord.id}
            admissionCode={historyRecord.admissionCode}
            horseName={historyRecord.horse?.name}
          />
        </Modal>
      )}

      {/* Modal Hủy hồ sơ tiếp nhận */}
      {cancellingRecord && (
        <Modal
          title={tr("Cancel Admission Record")}
          subtitle={`${tr("Horse Name")}: ${cancellingRecord.horse?.name || ""} — ${cancellingRecord.admissionCode}`}
          tone="danger"
          width={440}
          onClose={() => !cancelling && setCancellingRecord(null)}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <p style={{ margin: 0, fontSize: "14px", color: "var(--color-text)" }}>
              {tr("Are you sure you want to cancel this admission record?")}
            </p>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 500, marginBottom: "4px" }}>
                {tr("Cancellation reason (optional)")}
              </label>
              <Input
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder={tr("e.g. Owner requested withdrawal or unable to attend appointment...")}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", paddingTop: "12px", borderTop: "1px solid var(--color-border-subtle, #e5e7eb)" }}>
              <Button tone="secondary" onClick={() => setCancellingRecord(null)} disabled={cancelling}>
                {tr("Close")}
              </Button>
              <Button tone="danger" onClick={handleConfirmCancel} disabled={cancelling}>
                {cancelling ? tr("Cancelling...") : tr("Confirm Cancel")}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
