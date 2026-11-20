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
import { formatDateTime } from "@/shared/lib/format";
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
    { key: "horse", header: "Horse", render: (r) => <Link to={`/horses/${r.horseId}`}><strong>{r.horse.name}</strong></Link> },
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
