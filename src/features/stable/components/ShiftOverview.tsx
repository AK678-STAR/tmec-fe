import { useEffect, useState } from "react";
import { Card } from "@/shared/components/ui/Card";
import { Badge } from "@/shared/components/ui/Badge";
import { Alert } from "@/shared/components/ui/Alert";
import { useAppLanguage } from "@/shared/lib/language";
import { messageFor } from "@/shared/lib/messages";
import { tr } from "@/shared/i18n/tr";
import { getShiftOverview } from "../api/shiftRosterApi";
import type { ShiftOverview as Overview } from "../types/shiftRoster";
import { getLocalizedShiftName, getLocalizedZoneName } from "../utils/shiftLocalization";

const cell = { padding: "0.55rem 0.75rem", borderBottom: "1px solid var(--line)", textAlign: "left" as const, verticalAlign: "top" as const };

/** #2: Club Manager xem hôm nay ai trực khu nào, ca nào, việc chăm sóc xong tới đâu. */
export function ShiftOverview() {
  const { isVietnamese: isVi } = useAppLanguage();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getShiftOverview()
      .then(setData)
      .catch((e) => setError(messageFor(e)));
  }, []);

  if (error) return <Alert tone="danger">{error}</Alert>;
  if (!data) return null;
  const shifts = data.zones[0]?.shifts ?? [];

  return (
    <Card
      title={tr("Today on duty")}
      subtitle={tr("Each stall zone is one unit of responsibility: the groom on duty feeds, cleans and reports for every horse in that zone, and works only there.")}
    >
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
          <thead>
            <tr>
              <th style={cell}>{tr("Zone")}</th>
              {shifts.map((s) => (
                <th key={s.id} style={cell}>
                  {getLocalizedShiftName(s, isVi, true)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.zones.map((z) => (
              <tr key={z.id}>
                <td style={cell}>
                  <strong>{getLocalizedZoneName(z, isVi)}</strong>
                  <div style={{ color: "var(--text-muted)" }}>
                    {tr("{{count}} horse(s)", { count: z.horses })}
                  </div>
                  {z.openIncidents > 0 && (
                    <Badge tone="warn">{tr("{{count}} open incident(s)", { count: z.openIncidents })}</Badge>
                  )}
                </td>
                {z.shifts.map((s) => (
                  <td key={s.id} style={cell}>
                    {s.grooms.length > 0 ? (
                      <div>{s.grooms.map((g) => g.fullName).join(", ")}</div>
                    ) : z.horses > 0 ? (
                      <Badge tone="danger">{tr("No one on duty")}</Badge>
                    ) : (
                      <span style={{ color: "var(--text-muted)" }}>—</span>
                    )}
                    {s.tasksTotal > 0 && (
                      <div style={{ marginTop: 4 }}>
                        <Badge tone={s.tasksDone === s.tasksTotal ? "ok" : "neutral"}>
                          {tr("Tasks {{done}}/{{total}}", { done: s.tasksDone, total: s.tasksTotal })}
                        </Badge>
                      </div>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
