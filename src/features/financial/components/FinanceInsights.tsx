import { useState } from "react";
import { Card } from "@/shared/components/ui/Card";
import { formatCurrency } from "@/shared/lib/format";
import { tr } from "@/shared/i18n/tr";
import type { FinancialInvoice } from "../types";
import styles from "./FinanceInsights.module.css";

const costOf = (i: FinancialInvoice) => i.boardingFee + i.medicalFee + i.trainingFee;
const short = (v: number) => (v >= 1e9 ? `${(v / 1e9).toFixed(1)}B` : v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${Math.round(v / 1e3)}K` : String(v));

const SERIES = [
  { key: "collected", label: "Collected", color: "var(--ok, #2f855a)" },
  { key: "costs", label: "Costs billed", color: "var(--brand-500, #d69e2e)" },
  { key: "payout", label: "Prize payouts", color: "var(--info, #3182ce)" },
] as const;
type SeriesKey = (typeof SERIES)[number]["key"];

interface Props {
  /** Bảng kê theo bộ lọc ngựa / chủ ngựa, mọi kỳ (đã bỏ phiếu hủy). */
  invoices: FinancialInvoice[];
  /** Bảng kê của kỳ đang xem (cho tỉ trọng chi phí và top ngựa). */
  scoped: FinancialInvoice[];
  selectedPeriod: string;
  onPickPeriod: (period: string) => void;
}

/** Xu hướng 12 kỳ gần nhất + cơ cấu chi phí + ngựa chi phí / thưởng cao nhất. */
export function FinanceInsights({ invoices, scoped, selectedPeriod, onPickPeriod }: Props) {
  const [showTable, setShowTable] = useState(false);

  const periods = Array.from(new Set(invoices.map((i) => i.billingPeriod))).sort().slice(-12);
  const rows = periods.map((period) => {
    const list = invoices.filter((i) => i.billingPeriod === period);
    return {
      period,
      collected: list.filter((i) => i.status === "PAID" && i.netAmount > 0).reduce((t, i) => t + i.netAmount, 0),
      costs: list.reduce((t, i) => t + costOf(i), 0),
      payout: list.filter((i) => i.netAmount < 0).reduce((t, i) => t - i.netAmount, 0),
    };
  });
  const max = Math.max(1, ...rows.flatMap((r) => SERIES.map((s) => r[s.key])));

  // Cơ cấu chi phí kỳ đang xem.
  const parts = [
    { label: tr("Boarding"), value: scoped.reduce((t, i) => t + i.boardingFee, 0), color: "var(--brand-500, #d69e2e)" },
    { label: tr("Medical"), value: scoped.reduce((t, i) => t + i.medicalFee, 0), color: "var(--danger, #c53030)" },
    { label: tr("Training"), value: scoped.reduce((t, i) => t + i.trainingFee, 0), color: "var(--info, #3182ce)" },
  ];
  const totalCost = parts.reduce((t, p) => t + p.value, 0);

  // Top 5 ngựa theo chi phí trong kỳ đang xem.
  const byHorse = new Map<string, { name: string; cost: number; prize: number }>();
  for (const i of scoped) {
    const h = byHorse.get(i.horseId) ?? { name: i.horse.name, cost: 0, prize: 0 };
    h.cost += costOf(i);
    h.prize += i.prizeCredit;
    byHorse.set(i.horseId, h);
  }
  const top = [...byHorse.values()].sort((a, b) => b.cost - a.cost).slice(0, 5);

  const W = 720;
  const H = 200;
  const pad = { l: 44, b: 26, t: 10 };
  const groupW = (W - pad.l) / Math.max(1, rows.length);
  const barW = Math.min(16, (groupW - 10) / SERIES.length);
  const y = (v: number) => H - pad.b - ((H - pad.b - pad.t) * v) / max;

  return (
    <div className={styles.grid}>
      <Card title={tr("Last {{count}} billing periods", { count: rows.length })} subtitle={tr("Click a period to see its numbers.")}>
        <div className={styles.legend}>
          {SERIES.map((s) => (
            <span key={s.key}>
              <i style={{ background: s.color }} /> {tr(s.label)}
            </span>
          ))}
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className={styles.chart} role="img" aria-label={tr("Collected, costs and prize payouts per billing period")}>
          {[0, 0.5, 1].map((f) => (
            <g key={f}>
              <line x1={pad.l} x2={W} y1={y(max * f)} y2={y(max * f)} className={styles.gridLine} />
              <text x={pad.l - 6} y={y(max * f) + 4} textAnchor="end" className={styles.axis}>
                {short(max * f)}
              </text>
            </g>
          ))}
          {rows.map((r, gi) => {
            const x0 = pad.l + gi * groupW + (groupW - barW * SERIES.length) / 2;
            const selected = r.period === selectedPeriod;
            return (
              <g key={r.period} className={styles.group} onClick={() => onPickPeriod(r.period)}>
                <rect x={pad.l + gi * groupW} y={pad.t} width={groupW} height={H - pad.b - pad.t} className={selected ? styles.selected : styles.hit} />
                {SERIES.map((s, si) => (
                  <rect key={s.key} x={x0 + si * barW} y={y(r[s.key as SeriesKey])} width={barW - 2} height={H - pad.b - y(r[s.key as SeriesKey])} fill={s.color} rx={2}>
                    <title>{`${r.period} · ${tr(s.label)}: ${formatCurrency(r[s.key as SeriesKey])} VND`}</title>
                  </rect>
                ))}
                <text x={pad.l + gi * groupW + groupW / 2} y={H - 8} textAnchor="middle" className={selected ? styles.axisStrong : styles.axis}>
                  {r.period.slice(2)}
                </text>
              </g>
            );
          })}
        </svg>
        <button type="button" className={styles.linkBtn} onClick={() => setShowTable((v) => !v)} aria-expanded={showTable}>
          {showTable ? tr("Hide data table") : tr("View data table")}
        </button>
        {showTable && (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{tr("Period")}</th>
                {SERIES.map((s) => (
                  <th key={s.key}>{tr(s.label)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.period}>
                  <td>{r.period}</td>
                  {SERIES.map((s) => (
                    <td key={s.key}>{formatCurrency(r[s.key as SeriesKey])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title={tr("Cost breakdown")} subtitle={tr("Share of care costs in the selected scope.")}>
        {totalCost === 0 ? (
          <p className={styles.muted}>{tr("No costs in this scope.")}</p>
        ) : (
          <>
            <div className={styles.stack} aria-hidden="true">
              {parts.map((p) => (
                <span key={p.label} style={{ width: `${(100 * p.value) / totalCost}%`, background: p.color }} />
              ))}
            </div>
            <ul className={styles.parts}>
              {parts.map((p) => (
                <li key={p.label}>
                  <i style={{ background: p.color }} />
                  <span>{p.label}</span>
                  <strong>{formatCurrency(p.value)}</strong>
                  <em>{Math.round((100 * p.value) / totalCost)}%</em>
                </li>
              ))}
            </ul>
            <h3 className={styles.sub}>{tr("Highest-cost horses")}</h3>
            <ol className={styles.top}>
              {top.map((h) => (
                <li key={h.name}>
                  <span>{h.name}</span>
                  <strong>{formatCurrency(h.cost)}</strong>
                  {h.prize > 0 && <em>+{formatCurrency(h.prize)}</em>}
                </li>
              ))}
            </ol>
          </>
        )}
      </Card>
    </div>
  );
}
