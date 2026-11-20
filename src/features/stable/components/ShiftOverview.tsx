import { useEffect, useState } from "react";
import { Card } from "@/shared/components/ui/Card";
import { Badge } from "@/shared/components/ui/Badge";
import { Alert } from "@/shared/components/ui/Alert";
import { Button } from "@/shared/components/ui/Button";
import { Modal } from "@/shared/components/ui/Modal";
import { useAppLanguage } from "@/shared/lib/language";
import { messageFor } from "@/shared/lib/messages";
import { tr } from "@/shared/i18n/tr";
import { getShiftOverview } from "../api/shiftRosterApi";
import type { ShiftOverview as Overview } from "../types/shiftRoster";
import { getLocalizedShiftName, getLocalizedZoneName } from "../utils/shiftLocalization";

type Groom = Overview["zones"][number]["shifts"][number]["grooms"][number];

const cell = { padding: "0.55rem 0.75rem", borderBottom: "1px solid var(--line)", textAlign: "left" as const, verticalAlign: "top" as const };
const nameBtn = { background: "none", border: 0, padding: 0, font: "inherit", color: "var(--accent, inherit)", textDecoration: "underline dotted", cursor: "pointer" };

/** #2: Club Manager xem hôm nay ai trực khu nào, ca nào, việc chăm sóc xong tới đâu. */
export function ShiftOverview() {
  const { isVietnamese: isVi } = useAppLanguage();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [personId, setPersonId] = useState("");
  const [open, setOpen] = useState<Groom | null>(null);

  useEffect(() => {
    getShiftOverview()
      .then(setData)
      .catch((e) => setError(messageFor(e)));
  }, []);

  if (error) return <Alert tone="danger">{error}</Alert>;
  if (!data) return null;
  const shifts = data.zones[0]?.shifts ?? [];

  // Mọi nhân viên chăm sóc trực hôm nay (mỗi người một lần) để lọc theo người.
  const people = new Map<string, Groom>();
  for (const z of data.zones) for (const s of z.shifts) for (const g of s.grooms) people.set(g.id, g);
  const onDuty = (z: Overview["zones"][number], id: string) => z.shifts.some((s) => s.grooms.some((g) => g.id === id));
  const zones = personId ? data.zones.filter((z) => onDuty(z, personId)) : data.zones;
  // Các ô trực của người đang mở popup.
  const duties = open
    ? data.zones.flatMap((z) => z.shifts.filter((s) => s.grooms.some((g) => g.id === open.id)).map((s) => ({ z, s })))
    : [];

  return (
    <Card
      title={tr("Today on duty")}
      subtitle={tr("Each stall zone is one unit of responsibility: the groom on duty feeds, cleans and reports for every horse in that zone, and works only there.")}
      action={
        <select aria-label={tr("Filter by person")} value={personId} onChange={(e) => setPersonId(e.target.value)}>
          <option value="">{tr("Everyone ({{count}})", { count: people.size })}</option>
          {[...people.values()]
            .sort((a, b) => a.fullName.localeCompare(b.fullName))
            .map((g) => (
              <option key={g.id} value={g.id}>
                {g.fullName}
              </option>
            ))}
        </select>
      }
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
            {zones.map((z) => (
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
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        {s.grooms.map((g) => (
                          <button
                            key={g.id}
                            type="button"
                            title={tr("View details")}
                            onClick={() => setOpen(g)}
                            style={{ ...nameBtn, textAlign: "left", opacity: personId && g.id !== personId ? 0.4 : 1, fontWeight: g.id === personId ? 700 : 400 }}
                          >
                            {g.fullName}
                          </button>
                        ))}
                      </div>
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

      {open && (
        <Modal
          title={open.fullName}
          subtitle={tr("Groom · on duty today")}
          width={420}
          onClose={() => setOpen(null)}
          foot={
            <Button
              tone="secondary"
              size="sm"
              onClick={() => {
                setPersonId(open.id);
                setOpen(null);
              }}
            >
              {tr("Show only this person")}
            </Button>
          }
        >
          <div style={{ display: "grid", gap: 6, fontSize: 14 }}>
            <div>
              {tr("Email")}: <a href={`mailto:${open.email}`}>{open.email}</a>
            </div>
            <div>
              {tr("Phone")}: {open.phoneNumber ? <a href={`tel:${open.phoneNumber}`}>{open.phoneNumber}</a> : "—"}
            </div>
            <strong style={{ marginTop: 8 }}>{tr("Duties today")}</strong>
            {duties.map(({ z, s }) => (
              <div key={z.id + s.id} style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                <span>
                  {getLocalizedZoneName(z, isVi)} · {getLocalizedShiftName(s, isVi, true)}
                </span>
                <Badge tone="neutral">{tr("{{count}} horse(s)", { count: z.horses })}</Badge>
                {s.tasksTotal > 0 && (
                  <Badge tone={s.tasksDone === s.tasksTotal ? "ok" : "neutral"}>
                    {tr("Tasks {{done}}/{{total}}", { done: s.tasksDone, total: s.tasksTotal })}
                  </Badge>
                )}
                {z.openIncidents > 0 && (
                  <Badge tone="warn">{tr("{{count}} open incident(s)", { count: z.openIncidents })}</Badge>
                )}
              </div>
            ))}
          </div>
        </Modal>
      )}
    </Card>
  );
}
