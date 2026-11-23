import { useEffect, useState } from "react";
import { getAdmissionHistory } from "../services/admissionService";
import type { AdmissionHistoryLog, AdmissionStatus } from "../types/admission.types";
import { Badge } from "@/shared/components/ui/Badge";
import { Icon } from "@/shared/components/ui/Icon";
import { formatDateTime } from "@/shared/lib/format";
import { tr } from "@/shared/i18n/tr";

interface AdmissionHistoryTimelineProps {
  admissionId: string;
  admissionCode?: string;
  horseName?: string;
}

const STATUS_LABELS: Record<AdmissionStatus, { label: string; tone: "ok" | "warn" | "danger" | "info" | "neutral" }> = {
  PENDING_VERIFICATION: { label: "Pending Verification", tone: "info" },
  APPOINTED: { label: "Appointed", tone: "warn" },
  INSPECTION_IN_PROGRESS: { label: "Inspection in Progress", tone: "info" },
  APPROVED: { label: "Approved", tone: "ok" },
  REJECTED: { label: "Rejected", tone: "danger" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
};

export function AdmissionHistoryTimeline({ admissionId, admissionCode, horseName }: AdmissionHistoryTimelineProps) {
  const [logs, setLogs] = useState<AdmissionHistoryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getAdmissionHistory(admissionId)
      .then((data) => {
        if (active) {
          // Sort newest first or chronological
          setLogs(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err?.message || tr("Failed to load admission history"));
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [admissionId]);

  if (loading) {
    return (
      <div style={{ padding: "24px", textAlign: "center", color: "var(--color-text-muted)" }}>
        <Icon name="refresh" size={24} style={{ margin: "0 auto 8px auto", animation: "spin 1s linear infinite" }} />
        <p>{tr("Loading history logs...")}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "16px", background: "var(--color-danger-subtle, #fee2e2)", color: "var(--color-danger, #b91c1c)", borderRadius: "8px" }}>
        {error}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div style={{ padding: "24px", textAlign: "center", color: "var(--color-text-muted)" }}>
        {tr("No history logs recorded yet")}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {(admissionCode || horseName) && (
        <div style={{ paddingBottom: "12px", borderBottom: "1px solid var(--color-border-subtle, #e5e7eb)" }}>
          <span style={{ fontSize: "14px", color: "var(--color-text-muted)" }}>
            {tr("Admission Code")}: <strong style={{ color: "var(--color-text)" }}>{admissionCode}</strong>
            {horseName && ` · ${tr("Horse Name")}: ${horseName}`}
          </span>
        </div>
      )}

      <div style={{ position: "relative", paddingLeft: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
        {/* Vertical line connecting nodes */}
        <div
          style={{
            position: "absolute",
            left: "7px",
            top: "8px",
            bottom: "8px",
            width: "2px",
            background: "var(--color-border-subtle, #e5e7eb)",
          }}
        />

        {logs.map((log) => {
          const targetStatus = STATUS_LABELS[log.toStatus] || { label: log.toStatus, tone: "neutral" };
          const fromStatus = log.fromStatus ? STATUS_LABELS[log.fromStatus]?.label || log.fromStatus : null;

          return (
            <div key={log.id} style={{ position: "relative" }}>
              {/* Timeline marker */}
              <div
                style={{
                  position: "absolute",
                  left: "-24px",
                  top: "4px",
                  width: "16px",
                  height: "16px",
                  borderRadius: "50%",
                  background: log.toStatus === "APPROVED" ? "#16a34a" : log.toStatus === "REJECTED" ? "#dc2626" : "#2563eb",
                  border: "3px solid #ffffff",
                  boxShadow: "0 0 0 1px var(--color-border-subtle, #e5e7eb)",
                }}
              />

              <div
                style={{
                  background: "var(--color-surface, #ffffff)",
                  border: "1px solid var(--color-border-subtle, #e5e7eb)",
                  borderRadius: "8px",
                  padding: "12px 16px",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px", flexWrap: "wrap", gap: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {fromStatus && (
                      <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
                        {tr(fromStatus)} →
                      </span>
                    )}
                    <Badge tone={targetStatus.tone}>{tr(targetStatus.label)}</Badge>
                  </div>
                  <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
                    {formatDateTime(log.createdAt)}
                  </span>
                </div>

                <div style={{ fontSize: "13px", color: "var(--color-text)" }}>
                  {log.actorName ? (
                    <span style={{ fontWeight: 500 }}>{log.actorName}</span>
                  ) : (
                    <span style={{ color: "var(--color-text-muted)" }}>{tr("System")}</span>
                  )}
                  {log.note && (
                    <p style={{ margin: "6px 0 0 0", color: "var(--color-text-secondary, #4b5563)", whiteSpace: "pre-wrap" }}>
                      {log.note}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
