import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Modal } from "@/shared/components/ui/Modal";
import { Badge } from "@/shared/components/ui/Badge";
import { Alert } from "@/shared/components/ui/Alert";
import { HealthBadge } from "@/shared/components/ui/HealthBadge";
import { HEALTH_STATUS } from "@/shared/lib/status";
import type { HealthStatus } from "@/shared/types/enums";
import { capitalize, formatDate, formatVND } from "@/shared/lib/format";
import { tr } from "@/shared/i18n/tr";
import type { HorseTransferRequest } from "../types";

const DAY = 86_400_000;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ marginTop: 18 }}>
      <h3 style={{ margin: "0 0 8px", fontSize: "var(--fs-body)" }}>{title}</h3>
      {children}
    </section>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <small style={{ color: "var(--muted)" }}>{label}</small>
      <div>{children}</div>
    </div>
  );
}

/** Danh sách gọn: mỗi dòng trái là nội dung, phải là ngày / trạng thái. */
function Rows({ items, empty }: { items: Array<{ key: string; main: ReactNode; side: ReactNode }>; empty: string }) {
  if (!items.length) return <p style={{ margin: 0, color: "var(--muted)" }}>{empty}</p>;
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
      {items.map((it) => (
        <li
          key={it.key}
          style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 10px", border: "1px solid var(--border)", borderRadius: "var(--r-sm, 6px)" }}
        >
          <div style={{ minWidth: 0, overflowWrap: "anywhere" }}>{it.main}</div>
          <div style={{ flexShrink: 0, textAlign: "right", color: "var(--muted)", fontSize: "var(--fs-caption)" }}>{it.side}</div>
        </li>
      ))}
    </ul>
  );
}

const sev = (s?: string | null) => (s ? tr(capitalize(s)) : "—");

/** Hồ sơ ngựa cho bên nhận chuyển nhượng: tình trạng hiện tại + lịch sử y tế, huấn luyện, thi đấu. */
export function TransferHorseDossier({ request, canOpenProfile, onClose }: { request: HorseTransferRequest; canOpenProfile: boolean; onClose: () => void }) {
  const h = request.horse;
  const age = h.dob ? Math.floor((Date.now() - Date.parse(h.dob)) / (365.25 * DAY)) : null;
  const stall = h.stallAllocations?.[0];
  const lock = h.medicalLocks?.[0];
  const results = (h.tournamentRegistrations ?? []).filter((r) => r.result);
  const prize = results.reduce((sum, r) => sum + Number(r.result?.prizeMoneyWon ?? 0), 0);
  const best = results.length ? Math.min(...results.map((r) => r.result!.finalRank)) : null;
  const overdueCare = h._count?.preventiveSchedules ?? 0;

  return (
    <Modal onClose={onClose} title={h.horseCode ? `${h.name} (${h.horseCode})` : h.name} subtitle={tr("Horse summary before transfer")} width={720}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "10px 16px", fontSize: "var(--fs-body)" }}>
        <Fact label={tr("Current status")}>
          {h.status && h.status in HEALTH_STATUS ? <HealthBadge status={h.status as HealthStatus} /> : h.status ?? "—"}
        </Fact>
        <Fact label={tr("Training Lock")}>
          {lock ? <Badge tone="danger" icon="lock">{tr("Locked")}</Badge> : tr("None")}
        </Fact>
        <Fact label={tr("Breed")}>{h.breed ? tr(h.breed) : "—"}</Fact>
        <Fact label={tr("Gender")}>{h.gender ? tr(h.gender) : "—"}</Fact>
        <Fact label={tr("Age")}>{age == null ? "—" : tr("{{age}} years ({{dob}})", { age: String(age), dob: formatDate(h.dob!) })}</Fact>
        <Fact label={tr("Color")}>{h.color ? tr(h.color) : "—"}</Fact>
        <Fact label={tr("Weight")}>{h.weightKg ? `${h.weightKg} kg` : "—"}</Fact>
        <Fact label={tr("Stall")}>{stall ? `${stall.stall.code} · ${stall.stall.zone}` : tr("No stall")}</Fact>
        <Fact label={tr("In the club since")}>{h.createdAt ? formatDate(h.createdAt) : "—"}</Fact>
      </div>

      {lock && (
        <div style={{ marginTop: 12 }}>
          <Alert tone="danger" title={tr("Under a Training Lock since {{date}}", { date: formatDate(lock.lockedAt) })}>
            {lock.lockReason}
            {lock.recheckDate ? ` · ${tr("Recheck {{date}}", { date: formatDate(lock.recheckDate) })}` : ""}
          </Alert>
        </div>
      )}
      {h.isDebtImpounded && (
        <div style={{ marginTop: 12 }}>
          <Alert tone="warn" title={tr("This horse is held for unpaid fees")}>{tr("Outstanding fees must be settled before the horse can train or race.")}</Alert>
        </div>
      )}
      {overdueCare > 0 && (
        <div style={{ marginTop: 12 }}>
          <Alert tone="warn" title={tr("{{count}} preventive care item(s) overdue", { count: overdueCare })}>{tr("Vaccination, deworming, hoof or dental care is past due.")}</Alert>
        </div>
      )}

      <Section title={tr("Lifecycle so far")}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 8 }}>
          {([
            ["Medical records", h._count?.medicalRecords],
            ["Injuries", h._count?.injuryLogs],
            ["Incidents", h._count?.incidents],
            ["Workouts", h._count?.workoutSessions],
            ["Race entries", h._count?.tournamentRegistrations],
          ] as const).map(([label, n]) => (
            <div key={label} style={{ padding: "8px 10px", border: "1px solid var(--border)", borderRadius: "var(--r-sm, 6px)" }}>
              <div style={{ fontSize: "1.25rem", fontWeight: 700 }}>{n ?? 0}</div>
              <small style={{ color: "var(--muted)" }}>{tr(label)}</small>
            </div>
          ))}
        </div>
      </Section>

      <Section title={tr("Recent medical records")}>
        <Rows
          empty={tr("No medical records.")}
          items={(h.medicalRecords ?? []).map((m, i) => ({
            key: m.recordNumber ?? String(i),
            main: <><strong>{m.clinicalDiagnosis || "—"}</strong> <small style={{ color: "var(--muted)" }}>{m.recordNumber}</small></>,
            side: <>{formatDate(m.examinationDate)}<br />{sev(m.severity)} · {m.status === "CLOSED" ? tr("Closed") : m.status === "OPEN" ? tr("In Treatment") : tr("Draft")}</>,
          }))}
        />
      </Section>

      <Section title={tr("Injuries")}>
        <Rows
          empty={tr("No injuries recorded.")}
          items={(h.injuryLogs ?? []).map((inj, i) => ({
            key: String(i),
            main: <><strong>{tr(inj.injuryType)}</strong> · {tr(inj.anatomicalZone)}</>,
            side: <>{formatDate(inj.discoveryDate)}<br />{sev(inj.severity)} · {tr(capitalize(inj.status))}</>,
          }))}
        />
      </Section>

      <Section title={tr("Training plans")}>
        <Rows
          empty={tr("No training plans yet.")}
          items={(h.trainingPlans ?? []).map((p, i) => ({
            key: p.planCode ?? String(i),
            main: <><strong>{p.phaseName}</strong> <small style={{ color: "var(--muted)" }}>{p.planCode}</small><br /><small>{tr("Trainer:")} {p.trainer?.fullName ?? "—"}</small></>,
            side: <>{formatDate(p.startDate)} – {formatDate(p.endDate)}<br />{tr(capitalize(p.status))}</>,
          }))}
        />
      </Section>

      <Section title={tr("Race results")}>
        {results.length > 0 && (
          <p style={{ margin: "0 0 8px" }}>
            {tr("Best finish: #{{rank}} · Prize money won: {{prize}}", { rank: String(best), prize: formatVND(prize) })}
          </p>
        )}
        <Rows
          empty={tr("No race results yet.")}
          items={results.map((r, i) => ({
            key: String(i),
            main: <><strong>#{r.result!.finalRank}</strong> · {r.tournament.name}</>,
            side: <>{formatDate(r.tournament.raceDate)}<br />{formatVND(Number(r.result!.prizeMoneyWon))}</>,
          }))}
        />
      </Section>

      <Section title={tr("Recent incidents")}>
        <Rows
          empty={tr("No incidents reported.")}
          items={(h.incidents ?? []).map((inc, i) => ({
            key: inc.incidentNumber ?? String(i),
            main: <strong>{inc.incidentNumber ?? tr("Incident")}</strong>,
            side: <>{formatDate(inc.createdAt)}<br />{sev(inc.severity)}</>,
          }))}
        />
      </Section>

      {canOpenProfile && (
        <div style={{ marginTop: 16 }}><Link to={`/horses/${request.horseId}`}>{tr("Open full horse profile")}</Link></div>
      )}
    </Modal>
  );
}
