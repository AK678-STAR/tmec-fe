import { useEffect, useState } from "react";
import { Alert } from "@/shared/components/ui/Alert";
import { Badge } from "@/shared/components/ui/Badge";
import { EmptyState } from "@/shared/components/ui/EmptyState";
import { Icon } from "@/shared/components/ui/Icon";
import { formatDate, formatDateTime } from "@/shared/lib/format";
import { messageFor } from "@/shared/lib/messages";
import { localizeServerText, tr } from "@/shared/i18n/tr";
import { getMedicationLog } from "../api";
import type { MedicationLogItem } from "../api";
import styles from "../pages/MedicalRecordPage.module.css";

const STATUS = {
  DONE: { label: "Given", tone: "ok" },
  MISSED: { label: "Missed", tone: "danger" },
  UPCOMING: { label: "Upcoming", tone: "neutral" },
} as const;

/** #13: đối chiếu từng liều thuốc với việc Groom đã làm (ai cho, lúc nào), để xác minh quá trình điều trị. */
export function MedicationLog({ recordId }: { recordId: string }) {
  const [items, setItems] = useState<MedicationLogItem[] | null>(null);
  const [summary, setSummary] = useState({ done: 0, missed: 0, upcoming: 0 });
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getMedicationLog(recordId)
      .then((res) => {
        if (!active) return;
        setItems(res.items);
        setSummary(res.summary);
      })
      .catch((e) => active && setError(messageFor(e)));
    return () => {
      active = false;
    };
  }, [recordId]);

  return (
    <div className={styles.tabContent}>
      <div className={styles.sectionCard}>
        <h2 className={styles.sectionTitle}>
          <Icon name="clipboard" size={18} />
          {tr("Medication log")}
        </h2>
        <p style={{ color: "var(--ink-muted)", marginTop: 0 }}>
          {tr("Each dose is a care task for the groom. Completing it records who gave it and when, and takes the medicine out of zone stock.")}
        </p>
        {error && <Alert tone="danger">{error}</Alert>}
        {summary.missed > 0 && (
          <Alert tone="warn" title={tr("{{count}} dose(s) missed", { count: summary.missed })}>
            {tr("Check with the groom before closing this record.")}
          </Alert>
        )}
        {items && items.length === 0 ? (
          <EmptyState title={tr("No medication doses scheduled yet")} />
        ) : items ? (
          <>
            <div style={{ display: "flex", gap: 8, margin: "8px 0" }}>
              <Badge tone="ok">{tr("Given")}: {summary.done}</Badge>
              <Badge tone="danger">{tr("Missed")}: {summary.missed}</Badge>
              <Badge tone="neutral">{tr("Upcoming")}: {summary.upcoming}</Badge>
            </div>
            <div className={styles.tableContainer}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>{tr("Date")}</th>
                    <th>{tr("Time")}</th>
                    <th>{tr("Dose")}</th>
                    <th>{tr("Given by")}</th>
                    <th>{tr("Status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((t) => (
                    <tr key={t.id}>
                      <td>{formatDate(t.date)}</td>
                      <td>{t.scheduledTime ?? "—"}</td>
                      <td>{localizeServerText(t.title)}</td>
                      <td>
                        {t.completedBy
                          ? `${t.completedBy.fullName} · ${formatDateTime(t.completedAt ?? t.date)}`
                          : t.assignedGroom
                            ? tr("Assigned to {{name}}", { name: t.assignedGroom.fullName })
                            : "—"}
                      </td>
                      <td>
                        <Badge tone={STATUS[t.status].tone}>{tr(STATUS[t.status].label)}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
