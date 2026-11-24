import { useState, type FormEvent } from "react";
import { Modal } from "@/shared/components/ui/Modal";
import { Button } from "@/shared/components/ui/Button";
import { Field } from "@/shared/components/form/Field";
import { Input } from "@/shared/components/form/Input";
import { Textarea } from "@/shared/components/form/Textarea";
import { useToast } from "@/shared/components/ui/Toast";
import { tr } from "@/shared/i18n/tr";
import { messageFor } from "@/shared/lib/messages";
import { scheduleAdmission } from "../services/admissionService";
import type { HorseAdmissionRecord } from "../types/admission.types";
import design from "./AdmissionDesign.module.css";

interface Props { record: HorseAdmissionRecord; onClose: () => void; onSuccess: () => void }

function localInputValue(date: Date): string {
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function AdmissionScheduleModal({ record, onClose, onSuccess }: Props) {
  const toast = useToast();
  const [appointmentDate, setAppointmentDate] = useState(() => {
    if (record.appointmentDate) {
      const value = localInputValue(new Date(record.appointmentDate));
      if (value) return value;
    }
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    return localInputValue(tomorrow);
  });
  const [notes, setNotes] = useState(record.appointmentNotes || tr("Gate A inspection station. Please bring the horse and original documents."));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    if (!appointmentDate) { setError(tr("Select an admission appointment date and time.")); return; }
    setLoading(true);
    setError("");
    try {
      // datetime-local represents the same local time the user sees, not a UTC date fragment.
      const [day, time] = appointmentDate.split("T");
      const [year, month, date] = day.split("-").map(Number);
      const [hours, minutes] = time.split(":").map(Number);
      await scheduleAdmission(record.id, {
        appointmentDate: new Date(year, month - 1, date, hours, minutes).toISOString(),
        appointmentNotes: notes.trim() || undefined,
      });
      toast.show(tr("Scheduled appointment successfully"), "ok");
      onSuccess();
      onClose();
    } catch (err) { setError(messageFor(err)); }
    finally { setLoading(false); }
  }

  return <Modal title={tr("Schedule Admission Appointment — {{code}}", { code: record.admissionCode })}
    subtitle={`${record.horse.name} · ${record.owner.fullName}`} width={560} dialogClassName={design.dialog} overlayClassName={design.overlay} onClose={onClose}>
    <form className={design.form} onSubmit={submit}>
      <p className={design.helper}>{tr("Arrange the horse's arrival before identity and veterinary checks.")}</p>
      <Field label={tr("Appointment Date & Time *")}>
        <Input nativePicker type="datetime-local" value={appointmentDate} disabled={loading}
          onChange={(e) => setAppointmentDate(e.target.value)} required />
      </Field>
      <Field label={tr("Reception & Document Guidance")}>
        <Textarea value={notes} disabled={loading} onChange={(e) => setNotes(e.target.value)} rows={4}
          placeholder={tr("e.g. Gate A reception, arrival 15 mins prior, required documents...")} />
      </Field>
      {error && <p role="alert" className={design.error}>{error}</p>}
      <div className={design.actions}>
        <Button tone="secondary" className={design.secondary} onClick={onClose} disabled={loading}>{tr("Cancel")}</Button>
        <Button type="submit" tone="primary" className={design.primary} disabled={loading}>{tr(loading ? "Scheduling..." : "Confirm Schedule")}</Button>
      </div>
    </form>
  </Modal>;
}
