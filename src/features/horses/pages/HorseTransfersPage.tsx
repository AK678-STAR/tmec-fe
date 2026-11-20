import { useTranslation as useScreenTranslation } from "react-i18next";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/shared/components/layout/PageHeader";
import { useCurrentUser } from "@/shared/components/layout/AuthProvider";
import { Card } from "@/shared/components/ui/Card";
import { Badge } from "@/shared/components/ui/Badge";
import { Button } from "@/shared/components/ui/Button";
import { Modal } from "@/shared/components/ui/Modal";
import { Alert } from "@/shared/components/ui/Alert";
import { DataTable } from "@/shared/components/ui/DataTable";
import type { Column } from "@/shared/components/ui/DataTable";
import { EmptyState } from "@/shared/components/ui/EmptyState";
import { Field } from "@/shared/components/form/Field";
import { Textarea } from "@/shared/components/form/Textarea";
import { useToast } from "@/shared/components/ui/Toast";
import { formatDate, formatDateTime } from "@/shared/lib/format";
import { HealthBadge } from "@/shared/components/ui/HealthBadge";
import { HEALTH_STATUS } from "@/shared/lib/status";
import type { HealthStatus } from "@/shared/types/enums";
import { messageFor } from "@/shared/lib/messages";
import { tr } from "@/shared/i18n/tr";
import { cancelHorseTransfer, getHorseTransfers, respondHorseTransfer } from "../api";
import type { HorseTransferRequest } from "../types";

const STATUS: Record<HorseTransferRequest["status"], { label: string; tone: "warn" | "ok" | "danger" | "neutral" }> = {
  PENDING: { label: "Waiting for confirmation", tone: "warn" },
  APPROVED: { label: "Transferred", tone: "ok" },
  REJECTED: { label: "Declined", tone: "danger" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
};

/** Chuyển nhượng ngựa: CM tạo yêu cầu ở hồ sơ ngựa; chủ cũ và chủ mới cùng xác nhận tại đây. */
export default function HorseTransfersPage() {
  useScreenTranslation();
  const user = useCurrentUser();
  const toast = useToast();
  const isOwner = user.role === "HORSE_OWNER";
  const [rows, setRows] = useState<HorseTransferRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [declining, setDeclining] = useState<HorseTransferRequest | null>(null);
  const [note, setNote] = useState("");
  const [viewing, setViewing] = useState<HorseTransferRequest | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    getHorseTransfers()
      .then((r) => {
        setRows(r);
        setError("");
      })
      .catch((e) => setError(messageFor(e)))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  async function run(id: string, action: () => Promise<HorseTransferRequest>, done: string) {
    setBusyId(id);
    try {
      const res = await action();
      toast.show(tr(res.status === "APPROVED" ? "Both owners confirmed. The horse has been transferred." : done), "ok");
      load();
    } catch (e) {
      toast.show(messageFor(e), "danger");
    } finally {
      setBusyId("");
    }
  }

  // Bên này đã xác nhận chưa (chủ cũ hoặc chủ mới).
  const myConfirm = (r: HorseTransferRequest) =>
    r.fromOwnerId === user.id ? r.fromConfirmedAt : r.toOwnerId === user.id ? r.toConfirmedAt : null;
  const sideLabel = (at: string | null | undefined, needed = true) =>
    !needed ? tr("Not needed") : at ? tr("Confirmed {{date}}", { date: formatDateTime(at) }) : tr("Waiting");

  const columns: Column<HorseTransferRequest>[] = [
    {
      key: "horse",
      header: "Horse",
      // Chủ mới chưa sở hữu nên không mở được hồ sơ: xem tóm tắt ngay tại đây.
      render: (r) => (
        <Button tone="ghost" size="sm" onClick={() => setViewing(r)}>
          <strong>{r.horse.name}</strong>
        </Button>
      ),
    },
    {
      key: "from",
      header: "Current owner",
      render: (r) => (
        <div>
          <div>{r.fromOwner?.fullName ?? tr("Unassigned")}</div>
          <small style={{ color: "var(--ink-muted)" }}>{sideLabel(r.fromConfirmedAt, !!r.fromOwnerId)}</small>
        </div>
      ),
    },
    {
      key: "to",
      header: "New owner",
      render: (r) => (
        <div>
          <div>{r.toOwner.fullName}</div>
          <small style={{ color: "var(--ink-muted)" }}>{sideLabel(r.toConfirmedAt)}</small>
        </div>
      ),
    },
    { key: "reason", header: "Reason", hideOnNarrow: true, render: (r) => [r.reason, r.rejectReason && `${tr("Declined:")} ${r.rejectReason}`].filter(Boolean).join(" · ") || "—" },
    { key: "at", header: "Requested", hideOnNarrow: true, render: (r) => formatDateTime(r.createdAt) },
    { key: "status", header: "Status", render: (r) => <Badge tone={STATUS[r.status].tone}>{tr(STATUS[r.status].label)}</Badge> },
    {
      key: "actions",
      header: "",
      render: (r) => {
        if (r.status !== "PENDING") return null;
        const busy = busyId === r.id;
        if (!isOwner) {
          return (
            <Button tone="ghost" disabled={busy} onClick={() => void run(r.id, () => cancelHorseTransfer(r.id), "Transfer request cancelled.")}>
              {tr("Cancel request")}
            </Button>
          );
        }
        if (myConfirm(r)) return <small>{tr("Waiting for the other owner")}</small>;
        return (
          <div style={{ display: "flex", gap: 8 }}>
            <Button tone="primary" disabled={busy} onClick={() => void run(r.id, () => respondHorseTransfer(r.id, true), "You confirmed the transfer.")}>
              {tr("Confirm")}
            </Button>
            <Button tone="ghost" disabled={busy} onClick={() => { setNote(""); setDeclining(r); }}>
              {tr("Decline")}
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        title={tr("Horse transfers")}
        description={tr(
          isOwner
            ? "Ownership changes only after both the current and the new owner confirm."
            : "Transfers you request take effect only after both owners confirm.",
        )}
      />
      {error && <Alert tone="danger" title={tr("Could not load transfer requests")}>{error}</Alert>}
      <Card pad={0}>
        <DataTable
          caption={tr("Horse transfer requests")}
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          loading={loading}
          empty={<EmptyState icon="users" title="No transfer requests yet." />}
        />
      </Card>

      {viewing && (
        <Modal onClose={() => setViewing(null)} title={viewing.horse.name} subtitle={tr("Horse summary before transfer")} width={520}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 16px", fontSize: "var(--fs-body)" }}>
            <div><small style={{ color: "var(--muted)" }}>{tr("Current status")}</small><div>
              {viewing.horse.status && viewing.horse.status in HEALTH_STATUS ? <HealthBadge status={viewing.horse.status as HealthStatus} /> : viewing.horse.status ?? "—"}
            </div></div>
            <div><small style={{ color: "var(--muted)" }}>{tr("Training Lock")}</small><div>
              {viewing.horse.isMedicalLocked ? <Badge tone="danger" icon="lock">{tr("Locked")}</Badge> : tr("None")}
            </div></div>
            <div><small style={{ color: "var(--muted)" }}>{tr("Breed")}</small><div>{viewing.horse.breed ? tr(viewing.horse.breed) : "—"}</div></div>
            <div><small style={{ color: "var(--muted)" }}>{tr("Gender")}</small><div>{viewing.horse.gender ? tr(viewing.horse.gender) : "—"}</div></div>
            <div><small style={{ color: "var(--muted)" }}>{tr("Date of birth")}</small><div>{viewing.horse.dob ? formatDate(viewing.horse.dob) : "—"}</div></div>
            <div><small style={{ color: "var(--muted)" }}>{tr("In the club since")}</small><div>{viewing.horse.createdAt ? formatDate(viewing.horse.createdAt) : "—"}</div></div>
          </div>
          {viewing.horse.isDebtImpounded && (
            <Alert tone="warn" title={tr("This horse is held for unpaid fees")}>{tr("Outstanding fees must be settled before the horse can train or race.")}</Alert>
          )}
          <h3 style={{ margin: "16px 0 8px", fontSize: "var(--fs-body)" }}>{tr("Lifecycle so far")}</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 8 }}>
            {([
              ["Medical records", viewing.horse._count?.medicalRecords],
              ["Injuries", viewing.horse._count?.injuryLogs],
              ["Incidents", viewing.horse._count?.incidents],
              ["Workouts", viewing.horse._count?.workoutSessions],
              ["Race entries", viewing.horse._count?.tournamentRegistrations],
            ] as const).map(([label, n]) => (
              <div key={label} style={{ padding: "8px 10px", border: "1px solid var(--border)", borderRadius: "var(--r-sm, 6px)" }}>
                <div style={{ fontSize: "1.25rem", fontWeight: 700 }}>{n ?? 0}</div>
                <small style={{ color: "var(--muted)" }}>{tr(label)}</small>
              </div>
            ))}
          </div>
          {!isOwner && (
            <div style={{ marginTop: 16 }}><Link to={`/horses/${viewing.horseId}`}>{tr("Open full horse profile")}</Link></div>
          )}
        </Modal>
      )}

      {declining && (
        <Modal onClose={() => setDeclining(null)} title={tr("Decline transfer: {{name}}", { name: declining.horse.name })}>
          <Field label={tr("Reason (optional)")}>
            <Textarea rows={3} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 16 }}>
            <Button tone="ghost" onClick={() => setDeclining(null)}>{tr("Back")}</Button>
            <Button
              tone="danger"
              disabled={busyId === declining.id}
              onClick={() => {
                const r = declining;
                setDeclining(null);
                void run(r.id, () => respondHorseTransfer(r.id, false, note.trim() || undefined), "You declined the transfer.");
              }}
            >
              {tr("Decline transfer")}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
