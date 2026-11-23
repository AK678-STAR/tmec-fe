import { useState, useId } from "react";
import { Modal } from "@/shared/components/ui/Modal";
import { Button } from "@/shared/components/ui/Button";
import { Textarea } from "@/shared/components/form/Textarea";
import { useToast } from "@/shared/components/ui/Toast";
import { tr } from "@/shared/i18n/tr";
import { scheduleAdmission } from "../services/admissionService";
import type { HorseAdmissionRecord } from "../types/admission.types";

interface AdmissionScheduleModalProps {
  record: HorseAdmissionRecord;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * Chuyển Date hoặc chuỗi ISO từ backend thành định dạng "YYYY-MM-DDTHH:mm" theo GIỜ ĐỊA PHƯƠNG
 * để gán vào input type="datetime-local" mà không bị lệch múi giờ (không dùng toISOString().slice).
 */
function toLocalDatetimeInputValue(dateOrIso?: string | Date | null): string {
  if (!dateOrIso) return "";
  const d = typeof dateOrIso === "string" ? new Date(dateOrIso) : dateOrIso;
  if (Number.isNaN(d.getTime())) return "";

  const pad = (n: number) => String(n).padStart(2, "0");
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Chuyển giá trị "YYYY-MM-DDTHH:mm" từ input type="datetime-local" thành chuỗi ISO chuẩn
 * đại diện cho chính xác thời điểm giờ địa phương mà người dùng nhìn thấy trên màn hình.
 */
function localInputValueToIso(localValue: string): string {
  const [datePart, timePart] = localValue.split("T");
  if (!datePart || !timePart) {
    return new Date(localValue).toISOString();
  }
  const [year, month, day] = datePart.split("-").map(Number);
  const [hours, minutes] = timePart.split(":").map(Number);
  const d = new Date(year, month - 1, day, hours, minutes, 0, 0);
  return d.toISOString();
}

export function AdmissionScheduleModal({
  record,
  onClose,
  onSuccess,
}: AdmissionScheduleModalProps) {
  const toast = useToast();
  const [appointmentDate, setAppointmentDate] = useState(() => {
    if (record.appointmentDate) {
      const localStr = toLocalDatetimeInputValue(record.appointmentDate);
      if (localStr) return localStr;
    }
    // Default to tomorrow 09:00 in local time
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    return toLocalDatetimeInputValue(tomorrow);
  });
  const [appointmentNotes, setAppointmentNotes] = useState(
    record.appointmentNotes || "Trạm kiểm định Cổng A — CLB Đua Ngựa EquiFlow. Vui lòng mang theo ngựa và giấy tờ gốc.",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const dateId = useId();
  const notesId = useId();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appointmentDate) {
      setError("Vui lòng chọn ngày giờ hẹn tiếp nhận.");
      return;
    }
    try {
      setLoading(true);
      setError("");
      const isoDate = localInputValueToIso(appointmentDate);
      await scheduleAdmission(record.id, {
        appointmentDate: isoDate,
        appointmentNotes: appointmentNotes.trim() || undefined,
      });
      toast.show(tr("Scheduled appointment successfully"), "ok");
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : tr("Failed to schedule admission appointment");
      setError(msg);
      toast.show(msg, "danger");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={tr("Schedule Admission Appointment — {{code}}", { code: record.admissionCode })}
      subtitle={`${tr("Horse Name")}: ${record.horse?.name || ""} · ${tr("Owner")}: ${record.owner?.fullName || ""}`}
      width={480}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div>
          <label htmlFor={dateId} style={{ display: "block", fontSize: "13px", fontWeight: 500, marginBottom: "4px" }}>
            {tr("Appointment Date & Time *")}
          </label>
          <input
            id={dateId}
            type="datetime-local"
            value={appointmentDate}
            onChange={(e) => setAppointmentDate(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px",
              border: "1px solid var(--color-border-subtle, #d1d5db)",
              borderRadius: "6px",
              fontSize: "14px",
              background: "var(--color-surface, #ffffff)",
              color: "var(--color-text, #111827)",
            }}
            required
          />
        </div>

        <div>
          <label htmlFor={notesId} style={{ display: "block", fontSize: "13px", fontWeight: 500, marginBottom: "4px" }}>
            {tr("Reception & Document Guidance")}
          </label>
          <Textarea
            id={notesId}
            value={appointmentNotes}
            onChange={(e) => setAppointmentNotes(e.target.value)}
            placeholder={tr("e.g. Gate A reception, arrival 15 mins prior, required documents...")}
            rows={3}
          />
        </div>

        {error && (
          <div style={{ color: "#dc2626", fontSize: "13px" }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", paddingTop: "12px", borderTop: "1px solid var(--color-border-subtle, #e5e7eb)" }}>
          <Button tone="secondary" onClick={onClose} disabled={loading} type="button">
            {tr("Cancel")}
          </Button>
          <Button tone="primary" type="submit" disabled={loading}>
            {loading ? tr("Scheduling...") : tr("Confirm Schedule")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
