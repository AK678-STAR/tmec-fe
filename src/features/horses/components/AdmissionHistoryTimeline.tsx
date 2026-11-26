import { useEffect, useState } from "react";
import { getAdmissionHistory } from "../services/admissionService";
import type { AdmissionHistoryLog, AdmissionStatus } from "../types/admission.types";
import { Badge } from "@/shared/components/ui/Badge";
import { formatDateTime } from "@/shared/lib/format";
import { messageFor } from "@/shared/lib/messages";
import { tr } from "@/shared/i18n/tr";
import design from "./AdmissionDesign.module.css";
import styles from "./AdmissionInspectionModal.module.css";

interface Props { admissionId: string; admissionCode?: string; horseName?: string }
const STATUSES: Record<AdmissionStatus, { label: string; tone: "ok" | "warn" | "danger" | "info" | "neutral" }> = {
  PENDING_VERIFICATION: { label: "Pending Verification", tone: "info" },
  APPOINTED: { label: "Appointed", tone: "warn" },
  INSPECTION_IN_PROGRESS: { label: "Inspection in Progress", tone: "info" },
  APPROVED: { label: "Approved", tone: "ok" },
  REJECTED: { label: "Rejected", tone: "danger" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
};

export function AdmissionHistoryTimeline({ admissionId, admissionCode, horseName }: Props) {
  const [logs, setLogs] = useState<AdmissionHistoryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    getAdmissionHistory(admissionId)
      .then((data) => { if (active) setLogs(data); })
      .catch((err: unknown) => { if (active) setError(messageFor(err)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [admissionId]);
  if (loading) return <p role="status" className={design.helper}>{tr("Loading history logs...")}</p>;
  if (error) return <p role="alert" className={design.error}>{error}</p>;
  if (!logs.length) return <p className={design.helper}>{tr("No history logs recorded yet")}</p>;
  return <div className={design.form}>
    {(admissionCode || horseName) && <p className={design.helper}>{[admissionCode, horseName].filter(Boolean).join(" · ")}</p>}
    <ol className={styles.timeline}>
      {logs.map((log) => {
        const to = STATUSES[log.toStatus];
        const from = log.fromStatus ? STATUSES[log.fromStatus] : null;
        return <li key={log.id}>
          <div className={styles.timelineMeta}>
            <div>{from && <span className={design.helper}>{tr(from.label)} → </span>}
              <Badge tone={to?.tone ?? "neutral"}>{tr(to?.label ?? log.toStatus)}</Badge></div>
            <time dateTime={log.createdAt} className={design.helper}>{formatDateTime(log.createdAt)}</time>
          </div>
          <strong>{log.actorName || tr("System")}</strong>
          {log.note && <p>{log.note}</p>}
        </li>;
      })}
    </ol>
  </div>;
}
