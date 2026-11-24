import { CareBillingSettingsPanel } from "../components/CareBillingSettingsPanel";
import { MedicalUsageAppendix } from "../components/MedicalUsageAppendix";
import { PayOSCheckoutModal } from "../components/PayOSCheckoutModal";
import { formatCurrency, formatVND } from "@/shared/lib/format";
import { useTranslation as useScreenTranslation } from "react-i18next";
import { Icon } from "@/shared/components/ui/Icon";
import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "@/shared/components/layout/PageHeader";
import styles from "./OwnerFinancialReportsPage.module.css";
import { Card } from "@/shared/components/ui/Card";
import { Badge } from "@/shared/components/ui/Badge";
import { Alert } from "@/shared/components/ui/Alert";
import { Button } from "@/shared/components/ui/Button";
import { Modal } from "@/shared/components/ui/Modal";
import { ConfirmModal } from "@/shared/components/ui/ConfirmModal";
import { SearchSelect } from "@/shared/components/form/SearchSelect";
import { useToast } from "@/shared/components/ui/Toast";
import { KpiTile } from "@/shared/components/ui/KpiTile";
import { EmptyState } from "@/shared/components/ui/EmptyState";
import { Pagination } from "@/shared/components/ui/Pagination";
import { SkeletonTable } from "@/shared/components/ui/Skeleton";
import { Tabs, type TabItem } from "@/shared/components/ui/Tabs";
import { useCurrentUser } from "@/shared/components/layout/AuthProvider";
import { tr } from "@/shared/i18n/tr";
import { useAppLanguage } from "@/shared/lib/language";
import { messageFor } from "@/shared/lib/messages";
import { getHorses } from "@/features/horses/api";
import type { Horse } from "@/features/horses/types";
import {
  SingleInvoiceModal,
  defaultClosedMonth,
} from "../components/SingleInvoiceModal";
import {
  fetchOwnerSummary,
  changeInvoiceStatus,
  generateMonthlyInvoices,
  payInvoice,
} from "../api";
import type {
  FinancialInvoice,
  InvoiceStatus,
  OwnerSummaryResponse,
} from "../types";
import { exportStatementXlsx, printStatement } from "../statementExport";
import { invoiceStatusLabel } from "../invoiceStatus";
import { FinanceInsights } from "../components/FinanceInsights";

import { InvoiceReminderButton } from "../components/InvoiceReminderButton";

const PAGE_SIZE = 10;
const STATUS_FILTER_OPTIONS: readonly InvoiceStatus[] = [
  "DRAFT",
  "SENT",
  "PAID",
  "OVERDUE",
  "CANCELLED",
];
// Bộ lọc nhanh khi bấm thẻ số liệu.
const FOCUS = {
  UNPAID: (i: FinancialInvoice) =>
    (i.status === "SENT" || i.status === "OVERDUE") && i.netAmount > 0,
  OVERDUE: (i: FinancialInvoice) => i.status === "OVERDUE" && i.netAmount > 0,
  PAID: (i: FinancialInvoice) => i.status === "PAID" && i.netAmount > 0,
  PAYOUT: (i: FinancialInvoice) => i.status !== "CANCELLED" && i.netAmount < 0,
  PRIZE: (i: FinancialInvoice) => i.status !== "CANCELLED" && i.prizeCredit > 0,
};
type FocusKey = keyof typeof FOCUS;

export default function OwnerFinancialReportsPage() {
  useScreenTranslation();
  const { isVietnamese } = useAppLanguage();
  const locale = isVietnamese ? "vi-VN" : "en-US";
  const user = useCurrentUser();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get("highlight");
  const isClubManager = user.role === "CLUB_MANAGER";
  const isOwner = user.role === "HORSE_OWNER";

  const [summary, setSummary] = useState<OwnerSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState<string>("ALL");
  const pickedLatest = useRef(false);
  const [horseFilter, setHorseFilter] = useState("ALL");
  const [ownerFilter, setOwnerFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "ALL">(
    "ALL",
  );
  const [focus, setFocus] = useState<FocusKey | null>(null);
  const [page, setPage] = useState(1);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [updatingInvoice, setUpdatingInvoice] = useState<string | null>(null);
  const [paymentRefInput, setPaymentRefInput] = useState("");

  // Generate monthly invoices modal state
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [billingPeriodInput, setBillingPeriodInput] =
    useState(defaultClosedMonth);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Create single statement modal + confirm status modal
  const [isCreateSingleOpen, setIsCreateSingleOpen] = useState(false);
  const [horses, setHorses] = useState<Horse[]>([]);
  const [horsesLoading, setHorsesLoading] = useState(false);
  const [pendingTransition, setPendingTransition] = useState<{
    invoice: FinancialInvoice;
    targetStatus: "PAID" | "CANCELLED";
  } | null>(null);

  // Statement details modal state
  const [selectedInvoice, setSelectedInvoice] =
    useState<FinancialInvoice | null>(null);
  const [payOSInvoice, setPayOSInvoice] =
    useState<FinancialInvoice | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setLoadError("");
    setSummary(null);
    try {
      const data = await fetchOwnerSummary();
      setSummary(data);
      setSelectedPeriod((period) =>
        period === "ALL" ||
        data.invoices.some((invoice) => invoice.billingPeriod === period)
          ? period
          : "ALL",
      );
    } catch (err) {
      setLoadError(messageFor(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(id: string, newStatus: InvoiceStatus) {
    if (updatingInvoice) return;
    setUpdatingInvoice(id);
    setActionError("");
    setStatusMessage(null);
    try {
      await changeInvoiceStatus(id, newStatus);
      setStatusMessage(
        tr("Invoice status updated to {{status}}", {
          status: invoiceStatusLabel(newStatus, isOwner),
        }),
      );
      await loadData();
    } catch (err) {
      setActionError(messageFor(err));
    } finally {
      setUpdatingInvoice(null);
    }
  }

  async function handlePayInvoice() {
    if (
      !selectedInvoice ||
      updatingInvoice ||
      user.role !== "HORSE_OWNER" ||
      selectedInvoice.ownerId !== user.id ||
      selectedInvoice.netAmount <= 0 ||
      (selectedInvoice.status !== "SENT" &&
        selectedInvoice.status !== "OVERDUE")
    )
      return;
    const id = selectedInvoice.id;
    setUpdatingInvoice(id);
    setActionError("");
    setStatusMessage(null);
    try {
      const reported = await payInvoice(id, {
        paymentMethod: "BANK_TRANSFER",
        transactionRef: paymentRefInput.trim() || undefined,
      });
      setSelectedInvoice((current) =>
        current?.id === id ? { ...current, ...reported } : current,
      );
      setPaymentRefInput("");
      const msg = tr(
        "Transfer reported. The club will confirm once the money arrives.",
      );
      toast.show(msg, "ok");
      setStatusMessage(msg);
      await loadData();
    } catch (err) {
      setActionError(messageFor(err));
    } finally {
      setUpdatingInvoice(null);
    }
  }

  function handleOpenGenerate() {
    setGenerateError(null);
    setIsGenerateOpen(true);
  }

  async function handleOpenCreateSingle() {
    setIsCreateSingleOpen(true);
    if (horses.length > 0 || horsesLoading) return;
    setHorsesLoading(true);
    try {
      const all: Horse[] = [];
      for (let nextPage = 1; ; nextPage += 1) {
        const res = await getHorses({ page: nextPage, limit: 100 });
        all.push(...res.items);
        if (nextPage >= res.totalPages) break;
      }
      setHorses(all);
    } catch (err) {
      toast.show(messageFor(err), "danger");
    } finally {
      setHorsesLoading(false);
    }
  }

  async function handleConfirmTransition() {
    if (!pendingTransition || updatingInvoice) return;
    const { invoice, targetStatus } = pendingTransition;
    setUpdatingInvoice(invoice.id);
    setActionError("");
    setStatusMessage(null);
    try {
      await changeInvoiceStatus(invoice.id, targetStatus);
      const msg =
        targetStatus === "PAID"
          ? tr("Statement marked as paid.")
          : tr("Statement cancelled.");
      setStatusMessage(msg);
      toast.show(msg, "ok");
      setPendingTransition(null);
      await loadData();
    } catch (err) {
      setActionError(messageFor(err));
      setPendingTransition(null);
    } finally {
      setUpdatingInvoice(null);
    }
  }

  async function handleConfirmGenerate() {
    if (!billingPeriodInput.match(/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/)) {
      setGenerateError(
        tr(
          "Please enter a valid billing period in YYYY-MM format (e.g. 2026-11)",
        ),
      );
      return;
    }
    setGenerating(true);
    setGenerateError(null);
    try {
      const res = await generateMonthlyInvoices(billingPeriodInput);
      setStatusMessage(
        tr("Generated {{count}} unissued statements for period {{period}}", {
          count: res.createdCount,
          period: res.billingPeriod,
        }),
      );
      setIsGenerateOpen(false);
      await loadData();
    } catch (err: any) {
      setGenerateError(messageFor(err));
    } finally {
      setGenerating(false);
    }
  }

  function handleOpenStatement(invoice: FinancialInvoice) {
    setActionError("");
    setSelectedInvoice(invoice);
  }

  const invoices = summary?.invoices ?? [];
  const periods = Array.from(new Set(invoices.map((i) => i.billingPeriod)))
    .sort()
    .reverse();

  useEffect(() => {
    if (pickedLatest.current || !periods[0] || highlightId) return;
    pickedLatest.current = true;
    setSelectedPeriod(periods[0]);
  }, [periods, highlightId]);

  const uniqueHorses = Array.from(
    new Map(invoices.map((i) => [i.horse.id, i.horse])).values(),
  );
  const uniqueOwners = Array.from(
    new Map(
      invoices.filter((i) => i.owner).map((i) => [i.owner.id, i.owner]),
    ).values(),
  );
  const horseOptions = [
    { value: "ALL", label: tr("All Horses") },
    ...uniqueHorses.map((h) => ({
      value: h.id,
      label: `${h.name} (${h.horseCode || "—"})`,
    })),
  ];
  const ownerOptions = [
    { value: "ALL", label: tr("All Owners") },
    ...uniqueOwners.map((o) => ({
      value: o.id,
      label: `${o.fullName} (${o.email || ""})`,
    })),
  ];
  const statusScopedInvoices = invoices.filter(
    (i) =>
      (selectedPeriod === "ALL" || i.billingPeriod === selectedPeriod) &&
      (horseFilter === "ALL" || i.horseId === horseFilter) &&
      (!isClubManager || ownerFilter === "ALL" || i.ownerId === ownerFilter),
  );
  const statusTabItems: TabItem<InvoiceStatus | "ALL">[] = [
    { id: "ALL", label: "All", count: statusScopedInvoices.length },
    ...(["DRAFT", "SENT", "OVERDUE", "PAID", "CANCELLED"] as const).map(
      (st) => ({
        id: st,
        label: invoiceStatusLabel(st, isOwner),
        count: statusScopedInvoices.filter((i) => i.status === st).length,
      }),
    ),
  ];
  const filteredInvoices = invoices.filter((i) => {
    if (i.id === highlightId) return true;
    if (!isClubManager && i.status === "DRAFT") return false;
    const matchPeriod =
      selectedPeriod === "ALL" || i.billingPeriod === selectedPeriod;
    const matchStatus =
      (statusFilter === "ALL" || i.status === statusFilter) &&
      (!focus || FOCUS[focus](i));
    const matchHorse = horseFilter === "ALL" || i.horseId === horseFilter;
    const matchOwner =
      !isClubManager || ownerFilter === "ALL" || i.ownerId === ownerFilter;
    return matchPeriod && matchStatus && matchHorse && matchOwner;
  });
  const highlightedIndex = highlightId
    ? filteredInvoices.findIndex((i) => i.id === highlightId)
    : -1;
  const highlightPage =
    highlightedIndex < 0 ? null : Math.floor(highlightedIndex / PAGE_SIZE) + 1;

  useEffect(() => {
    if (highlightPage !== null && page !== highlightPage) {
      setPage(highlightPage);
    }
  }, [highlightPage, page]);
  const hasFilters =
    selectedPeriod !== "ALL" ||
    statusFilter !== "ALL" ||
    focus !== null ||
    horseFilter !== "ALL" ||
    (isClubManager && ownerFilter !== "ALL");

  function resetFilters() {
    setSelectedPeriod("ALL");
    setStatusFilter("ALL");
    setFocus(null);
    setHorseFilter("ALL");
    setOwnerFilter("ALL");
    setPage(1);
  }
  const currentPage = Math.min(
    page,
    Math.max(1, Math.ceil(filteredInvoices.length / PAGE_SIZE)),
  );

  // Phiếu tính số liệu: bỏ phiếu hủy (và nháp với chủ ngựa); lọc ngựa / chủ ngựa nhưng không lọc kỳ.
  const countable = (i: FinancialInvoice) =>
    i.status !== "CANCELLED" && (isClubManager || i.status !== "DRAFT");
  const trendInvoices = invoices.filter(
    (i) =>
      countable(i) &&
      (horseFilter === "ALL" || i.horseId === horseFilter) &&
      (!isClubManager || ownerFilter === "ALL" || i.ownerId === ownerFilter),
  );
  const kpiInvoices = statusScopedInvoices.filter(countable);
  const sum = (
    list: FinancialInvoice[],
    pick: (i: FinancialInvoice) => number,
  ) => list.reduce((t, i) => t + pick(i), 0);
  const open = kpiInvoices.filter(FOCUS.UNPAID);
  const overdue = kpiInvoices.filter(FOCUS.OVERDUE);
  const paid = kpiInvoices.filter(FOCUS.PAID);
  const computeKpi = (list: FinancialInvoice[]) => ({
    toCollect: sum(list.filter(FOCUS.UNPAID), (i) => i.netAmount),
    overdue: sum(list.filter(FOCUS.OVERDUE), (i) => i.netAmount),
    collected: sum(list.filter(FOCUS.PAID), (i) => i.netAmount),
    payout: sum(list.filter(FOCUS.PAYOUT), (i) => -i.netAmount),
    boarding: sum(list, (i) => i.boardingFee),
    medical: sum(list, (i) => i.medicalFee),
    training: sum(list, (i) => i.trainingFee),
    prize: sum(list, (i) => i.prizeCredit),
    cost: sum(list, (i) => i.boardingFee + i.medicalFee + i.trainingFee),
  });
  const kpi = computeKpi(kpiInvoices);
  // So với kỳ liền trước (chỉ khi đang xem một kỳ).
  const prevPeriod =
    selectedPeriod === "ALL"
      ? undefined
      : periods[periods.indexOf(selectedPeriod) + 1];
  const prevKpi = prevPeriod
    ? computeKpi(trendInvoices.filter((i) => i.billingPeriod === prevPeriod))
    : null;
  const trendOf = (key: keyof typeof kpi, upIsBad = false) => {
    if (!prevKpi || prevKpi[key] === 0) return undefined;
    const pct = Math.round((100 * (kpi[key] - prevKpi[key])) / prevKpi[key]);
    if (pct === 0) return undefined;
    return {
      dir: pct > 0 ? ("up" as const) : ("down" as const),
      value: `${pct > 0 ? "+" : ""}${pct}%`,
      bad: upIsBad ? pct > 0 : pct < 0,
    };
  };
  const tileProps = (key: FocusKey) => ({
    active: focus === key,
    onClick: () => {
      setFocus((f) => (f === key ? null : key));
      setStatusFilter("ALL");
      setPage(1);
      document
        .getElementById("statement-table")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
  });
  const kpiScope =
    selectedPeriod === "ALL"
      ? tr("All billing periods")
      : tr("Billing period {{period}}", { period: selectedPeriod });
  const periodLabel = selectedPeriod === "ALL" ? "all-periods" : selectedPeriod;
  const ownerName = isClubManager ? undefined : invoices[0]?.owner.fullName;

  return (
    <div className={styles.report}>
      <PageHeader
        title={
          isClubManager
            ? tr("Financial Reports")
            : isVietnamese
              ? "Báo cáo chi phí nuôi dưỡng, y tế & tiền thưởng định kỳ"
              : tr("Periodic Cost & Prize Report")
        }
        description={
          isClubManager
            ? tr(
                "Monthly statements for boarding, veterinary care, training fees, and prize deductions.",
              )
            : isVietnamese
              ? "Báo cáo tổng hợp chi phí nuôi dưỡng, y tế, dịch vụ huấn luyện và đối trừ doanh thu tiền thưởng định kỳ của các chiến mã thuộc sở hữu."
              : tr(
                  "Periodic summary statement for boarding, veterinary care, training fees, and tournament prize deductions for owned horses.",
                )
        }
        action={
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <Button
              tone="secondary"
              icon="file"
              disabled={filteredInvoices.length === 0}
              onClick={() =>
                printStatement(filteredInvoices, periodLabel, ownerName)
              }
            >
              {tr("Export PDF")}
            </Button>
            <Button
              tone="secondary"
              icon="download"
              disabled={filteredInvoices.length === 0}
              onClick={() => exportStatementXlsx(filteredInvoices, periodLabel)}
            >
              {tr("Export Excel")}
            </Button>
            {isClubManager && (
              <>
                <Button
                  tone="secondary"
                  icon="plus"
                  onClick={handleOpenCreateSingle}
                >
                  {tr("Create single statement")}
                </Button>
                <Button tone="primary" onClick={handleOpenGenerate}>
                  + {tr("Create monthly statements")}
                </Button>
              </>
            )}
          </div>
        }
      />

      {isClubManager && <CareBillingSettingsPanel />}

      {statusMessage && (
        <Alert tone="ok" onDismiss={() => setStatusMessage(null)}>
          {statusMessage}
        </Alert>
      )}
      {actionError && (
        <Alert
          tone="danger"
          title={tr("Failed to update invoice status")}
          onDismiss={() => setActionError("")}
        >
          {actionError}
        </Alert>
      )}

      {summary && (
        <div role="status">
          <Badge tone={summary.outstandingDebt > 0 ? "danger" : "ok"}>
            {tr("Outstanding balance")}:{" "}
            {summary.outstandingDebt == null
              ? "—"
              : formatCurrency(summary.outstandingDebt) + " VND"}
          </Badge>
        </div>
      )}

      {/* KPI Tiles: theo bộ lọc hiện tại */}
      <p className={styles.filterHelp} style={{ margin: 0 }}>
        <strong>{kpiScope}</strong> ·{" "}
        {tr("{{count}} statement(s)", { count: kpiInvoices.length })}
      </p>
      <div className={styles.metrics}>
        {isClubManager ? (
          <>
            <KpiTile
              label={tr("To collect")}
              value={summary ? formatCurrency(kpi.toCollect) : "—"}
              unit="VND"
              caption={tr("{{count}} statement(s) sent, not paid yet", {
                count: open.length,
              })}
              trend={trendOf("toCollect", true)}
              {...tileProps("UNPAID")}
            />
            <KpiTile
              label={tr("Overdue")}
              value={summary ? formatCurrency(kpi.overdue) : "—"}
              unit="VND"
              caption={
                overdue.length > 0
                  ? tr("{{count}} statement(s) past the deadline", {
                      count: overdue.length,
                    })
                  : tr("Nothing overdue")
              }
              accent={overdue.length > 0}
              trend={trendOf("overdue", true)}
              {...tileProps("OVERDUE")}
            />
            <KpiTile
              label={tr("Collected")}
              value={summary ? formatCurrency(kpi.collected) : "—"}
              unit="VND"
              caption={tr("{{count}} statement(s) paid", {
                count: paid.length,
              })}
              trend={trendOf("collected")}
              {...tileProps("PAID")}
            />
            <KpiTile
              label={tr("Prize payouts to owners")}
              value={summary ? formatCurrency(kpi.payout) : "—"}
              unit="VND"
              caption={tr(
                "Prize credit larger than the costs: the club pays the owner",
              )}
              trend={trendOf("payout", true)}
              {...tileProps("PAYOUT")}
            />
          </>
        ) : (
          <>
            <KpiTile
              label={tr("Amount due")}
              value={summary ? formatCurrency(kpi.toCollect) : "—"}
              unit="VND"
              caption={
                overdue.length > 0
                  ? tr("{{count}} statement(s) past the deadline", {
                      count: overdue.length,
                    })
                  : tr("Nothing overdue")
              }
              accent={overdue.length > 0}
              trend={trendOf("toCollect", true)}
              {...tileProps("UNPAID")}
            />
            <KpiTile
              label={tr("Care costs")}
              value={summary ? formatCurrency(kpi.cost) : "—"}
              unit="VND"
              caption={tr("Boarding {{b}} · Medical {{m}} · Training {{t}}", {
                b: formatCurrency(kpi.boarding),
                m: formatCurrency(kpi.medical),
                t: formatCurrency(kpi.training),
              })}
              trend={trendOf("cost", true)}
            />
            <KpiTile
              label={tr("Prize credits")}
              value={summary ? `+${formatCurrency(kpi.prize)}` : "—"}
              unit="VND"
              caption={tr("85% of race prizes, deducted from costs")}
              accent={kpi.prize > 0}
              trend={trendOf("prize")}
              {...tileProps("PRIZE")}
            />
            <KpiTile
              label={tr("Paid")}
              value={summary ? formatCurrency(kpi.collected) : "—"}
              unit="VND"
              caption={
                kpi.payout > 0
                  ? tr("Club pays you {{amount}} VND in prize surplus", {
                      amount: formatCurrency(kpi.payout),
                    })
                  : tr("{{count}} statement(s) paid", { count: paid.length })
              }
              trend={trendOf("collected")}
              {...tileProps("PAID")}
            />
          </>
        )}
      </div>
      {prevPeriod && (
        <p className={styles.filterHelp} style={{ margin: 0 }}>
          {tr(
            "% compared with billing period {{period}}. Click a tile to list its statements.",
            { period: prevPeriod },
          )}
        </p>
      )}

      {summary && trendInvoices.length > 0 && (
        <FinanceInsights
          invoices={trendInvoices}
          scoped={kpiInvoices}
          selectedPeriod={selectedPeriod}
          onPickPeriod={(period) => {
            setSelectedPeriod(period);
            setPage(1);
          }}
        />
      )}

      {/* Billing period & status workflow filter */}
      <Card pad={0}>
        {isClubManager && (
          <div className={styles.statusTabsWrap}>
            <Tabs
              items={statusTabItems}
              active={statusFilter}
              onChange={(next) => {
                setStatusFilter(next);
                setFocus(null);
                setPage(1);
              }}
              label="Invoice workflow status"
            />
          </div>
        )}
        <div style={{ padding: 16 }}>
          <div className={styles.billingFilter}>
            <div className={styles.searchField}>
              <label htmlFor="invoice-horse" className={styles.filterLabel}>
                {tr("Horse")}
              </label>
              <SearchSelect
                id="invoice-horse"
                options={horseOptions}
                value={horseFilter}
                onChange={(value) => {
                  setHorseFilter(value);
                  setPage(1);
                }}
              />
            </div>
            {isClubManager && (
              <div className={styles.searchField}>
                <label htmlFor="invoice-owner" className={styles.filterLabel}>
                  {tr("Owner")}
                </label>
                <SearchSelect
                  id="invoice-owner"
                  options={ownerOptions}
                  value={ownerFilter}
                  onChange={(value) => {
                    setOwnerFilter(value);
                    setPage(1);
                  }}
                />
              </div>
            )}
            <div className={styles.filterField}>
              <label htmlFor="invoice-status" className={styles.filterLabel}>
                {tr("Status")}
              </label>
              <select
                id="invoice-status"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as InvoiceStatus | "ALL");
                  setFocus(null);
                  setPage(1);
                }}
                className={styles.periodSelect}
              >
                <option value="ALL">{tr("All statuses")}</option>
                {(isClubManager
                  ? STATUS_FILTER_OPTIONS
                  : (["SENT", "PAID", "OVERDUE"] as const)
                ).map((status) => (
                  <option key={status} value={status}>
                    {invoiceStatusLabel(status, isOwner)}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.filterField}>
              <label htmlFor="billing-period" className={styles.filterLabel}>
                {tr("Billing Period:")}
              </label>
              <select
                id="billing-period"
                value={summary ? selectedPeriod : "ALL"}
                disabled={!summary}
                onChange={(e) => {
                  setSelectedPeriod(e.target.value);
                  setPage(1);
                }}
                className={styles.periodSelect}
              >
                <option value="ALL">{tr("All Billing Periods")}</option>
                {periods.map((period) => (
                  <option key={period} value={period}>
                    {period}
                  </option>
                ))}
              </select>
            </div>
            {hasFilters && (
              <Button tone="secondary" onClick={resetFilters}>
                {tr("Clear filters")}
              </Button>
            )}
          </div>
          <p className={styles.filterHelp}>
            {tr("Filters apply to the totals, the table and exports.")}
          </p>
        </div>
      </Card>

      {/* Invoices List Table */}
      <span id="statement-table" style={{ scrollMarginTop: 80 }} />
      {loading ? (
        <SkeletonTable columns={6} rows={6} />
      ) : loadError ? (
        <Alert
          tone="danger"
          title={tr("Could not load data")}
          action={
            <Button tone="secondary" onClick={() => void loadData()}>
              {tr("Try again")}
            </Button>
          }
        >
          {loadError}
        </Alert>
      ) : filteredInvoices.length === 0 ? (
        <Card pad={32}>
          <EmptyState
            title={tr("No Financial Statements Found")}
            description={tr(
              hasFilters
                ? "No statements match the current filters."
                : "Monthly billing statements and tournament earnings credits will appear here.",
            )}
            action={
              hasFilters ? (
                <Button tone="secondary" onClick={resetFilters}>
                  {tr("Clear filters")}
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <Card pad={20}>
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <caption className="sr-only">{tr("Billing Statements")}</caption>
              <thead>
                <tr
                  style={{
                    borderBottom: "2px solid var(--border)",
                    textAlign: "left",
                    color: "var(--muted)",
                  }}
                >
                  <th style={{ padding: "0.75rem 0.5rem" }}>{tr("Period")}</th>
                  <th style={{ padding: "0.75rem 0.5rem" }}>{tr("Horse")}</th>
                  <th style={{ padding: "0.75rem 0.5rem", textAlign: "right" }}>
                    {tr("Costs")}
                  </th>
                  <th style={{ padding: "0.75rem 0.5rem", textAlign: "right" }}>
                    {tr("Prize Credit")}
                  </th>
                  <th style={{ padding: "0.75rem 0.5rem", textAlign: "right" }}>
                    {tr("Net Amount")}
                  </th>
                  <th style={{ padding: "0.75rem 0.5rem" }}>
                    {tr("Payment deadline")}
                  </th>
                  <th style={{ padding: "0.75rem 0.5rem" }}>{tr("Status")}</th>
                  <th style={{ padding: "0.75rem 0.5rem" }}>{tr("Actions")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices
                  .slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
                  .map((inv) => {
                    const isCredit = inv.netAmount < 0;
                    return (
                      <tr
                        key={inv.id}
                        data-highlight-id={inv.id}
                        className={
                          inv.id === highlightId
                            ? "highlight-target-attention"
                            : undefined
                        }
                        style={{ borderBottom: "1px solid var(--border)" }}
                      >
                        <td
                          style={{
                            padding: "0.75rem 0.5rem",
                            fontWeight: 700,
                            color: "var(--ink)",
                          }}
                        >
                          {inv.billingPeriod}
                        </td>
                        <td style={{ padding: "0.75rem 0.5rem" }}>
                          <strong style={{ color: "var(--ink)" }}>
                            {inv.horse.name}
                          </strong>
                          {isClubManager && (
                            <span
                              style={{
                                fontSize: "var(--fs-xs)",
                                color: "var(--muted)",
                                display: "block",
                              }}
                            >
                              {inv.owner?.fullName || "—"}
                            </span>
                          )}
                        </td>
                        <td
                          style={{
                            padding: "0.75rem 0.5rem",
                            textAlign: "right",
                            whiteSpace: "nowrap",
                          }}
                          title={tr(
                            "Boarding {{b}} · Medical {{m}} · Training {{t}}",
                            {
                              b: formatCurrency(inv.boardingFee),
                              m: formatCurrency(inv.medicalFee),
                              t: formatCurrency(inv.trainingFee),
                            },
                          )}
                        >
                          {formatVND(
                            inv.boardingFee + inv.medicalFee + inv.trainingFee,
                          )}
                        </td>
                        <td
                          style={{
                            padding: "0.75rem 0.5rem",
                            color: "var(--brand-700)",
                            fontWeight: 700,
                            textAlign: "right",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {inv.prizeCredit > 0
                            ? `+${formatVND(inv.prizeCredit)}`
                            : "—"}
                        </td>
                        <td
                          style={{
                            padding: "0.75rem 0.5rem",
                            fontWeight: 800,
                            textAlign: "right",
                            whiteSpace: "nowrap",
                            color: isCredit ? "var(--ok)" : "var(--ink)",
                          }}
                        >
                          {isCredit
                            ? `${tr("Payout:")} ${formatVND(Math.abs(inv.netAmount))}`
                            : formatVND(inv.netAmount)}
                        </td>
                        <td style={{ padding: "0.75rem 0.5rem" }}>
                          {inv.dueAt
                            ? new Date(inv.dueAt).toLocaleDateString(locale, {
                                timeZone: "Asia/Ho_Chi_Minh",
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                              })
                            : "—"}
                        </td>
                        <td style={{ padding: "0.75rem 0.5rem" }}>
                          <Badge
                            tone={
                              inv.status === "PAID"
                                ? "ok"
                                : inv.status === "SENT"
                                  ? "warn"
                                  : inv.status === "OVERDUE"
                                    ? "danger"
                                    : "neutral"
                            }
                          >
                            {invoiceStatusLabel(inv.status, isOwner)}
                          </Badge>
                          {inv.paymentReportedAt &&
                            (inv.status === "SENT" ||
                              inv.status === "OVERDUE") && (
                              <div style={{ marginTop: 4 }}>
                                <Badge tone="info">
                                  {tr("Awaiting reconciliation")}
                                </Badge>
                              </div>
                            )}
                        </td>
                        <td style={{ padding: "0.75rem 0.5rem" }}>
                          <div className={styles.rowActions}>
                            {/* Quản lý CLB: Nhắc nhở/Phát hành theo ngữ cảnh trạng thái */}
                            {isClubManager &&
                              inv.netAmount > 0 &&
                              (inv.status === "SENT" ||
                                inv.status === "OVERDUE") && (
                                <InvoiceReminderButton
                                  id={inv.id}
                                  status={inv.status}
                                />
                              )}
                            {isClubManager && inv.status === "DRAFT" && (
                              <Button
                                tone="secondary"
                                size="sm"
                                icon="send"
                                className={styles.rowActionBtn}
                                title={
                                  isVietnamese
                                    ? "Phát hành hóa đơn gửi tới chủ ngựa (kích hoạt hạn thanh toán)"
                                    : tr("Send statement to owner")
                                }
                                disabled={updatingInvoice !== null}
                                onClick={() =>
                                  handleStatusChange(inv.id, "SENT")
                                }
                              >
                                {isVietnamese ? "Phát hành" : tr("Send")}
                              </Button>
                            )}
                            {isClubManager &&
                              (inv.status === "SENT" ||
                                inv.status === "OVERDUE") && (
                                <Button
                                  tone="primary"
                                  size="sm"
                                  icon="check"
                                  className={styles.rowActionBtn}
                                  title={
                                    inv.status === "OVERDUE"
                                      ? isVietnamese
                                        ? "Xác nhận thu nợ quá hạn và giải tỏa lệnh giữ ngựa"
                                        : tr("Mark Paid & Release")
                                      : isVietnamese
                                        ? "Xác nhận đã nhận đủ tiền hóa đơn"
                                        : tr("Mark Paid")
                                  }
                                  disabled={updatingInvoice !== null}
                                  onClick={() =>
                                    setPendingTransition({
                                      invoice: inv,
                                      targetStatus: "PAID",
                                    })
                                  }
                                >
                                  {inv.status === "OVERDUE"
                                    ? isVietnamese
                                      ? "Thu nợ"
                                      : tr("Collect Debt")
                                    : isVietnamese
                                      ? "Đã thu"
                                      : tr("Mark Paid")}
                                </Button>
                              )}
                            {isClubManager &&
                              (inv.status === "DRAFT" ||
                                inv.status === "SENT" ||
                                inv.status === "OVERDUE") && (
                                <Button
                                  tone="danger"
                                  size="sm"
                                  icon="ban"
                                  className={styles.rowActionBtn}
                                  title={
                                    inv.status === "OVERDUE"
                                      ? isVietnamese
                                        ? "Hủy hóa đơn nợ quá hạn & giải tỏa lệnh giữ ngựa"
                                        : tr("Cancel statement")
                                      : isVietnamese
                                        ? "Hủy hóa đơn"
                                        : tr("Cancel statement")
                                  }
                                  disabled={updatingInvoice !== null}
                                  onClick={() =>
                                    setPendingTransition({
                                      invoice: inv,
                                      targetStatus: "CANCELLED",
                                    })
                                  }
                                >
                                  {isVietnamese ? "Hủy" : tr("Cancel")}
                                </Button>
                              )}
                            {inv.status === "PAID" && (
                              <span className={styles.settledTag}>
                                <Icon name="check" inline size={13} />{" "}
                                {tr("Settled")}
                              </span>
                            )}
                            {!isClubManager &&
                              (inv.status === "SENT" ||
                                inv.status === "OVERDUE") &&
                              inv.netAmount > 0 && (
                                <>
                                  <Button
                                    tone={
                                      inv.status === "OVERDUE"
                                        ? "danger"
                                        : "primary"
                                    }
                                    size="sm"
                                    icon="creditCard"
                                    className={styles.rowActionBtn}
                                    title={
                                      inv.status === "OVERDUE"
                                        ? isVietnamese
                                          ? "Quét VietQR / PayOS thanh toán nợ quá hạn để mở khóa ngựa"
                                          : "Pay overdue debt via PayOS"
                                        : "Quét VietQR / PayOS"
                                    }
                                    onClick={() => setPayOSInvoice(inv)}
                                  >
                                    {inv.status === "OVERDUE"
                                      ? isVietnamese
                                        ? "Trả nợ (PayOS)"
                                        : "Pay Debt"
                                      : isVietnamese
                                        ? "Quét PayOS"
                                        : "PayOS"}
                                  </Button>
                                  <Button
                                    tone="secondary"
                                    size="sm"
                                    icon="check"
                                    className={styles.rowActionBtn}
                                    title={
                                      isVietnamese
                                        ? "Báo đã chuyển khoản để quản lý đối soát"
                                        : tr("Report Transfer")
                                    }
                                    disabled={updatingInvoice !== null}
                                    onClick={() => {
                                      setActionError("");
                                      setSelectedInvoice(inv);
                                    }}
                                  >
                                    {isVietnamese ? "Báo chuyển" : tr("Report")}
                                  </Button>
                                </>
                              )}
                            <Button
                              tone="secondary"
                              size="sm"
                              icon="eye"
                              className={styles.rowActionBtn}
                              title={
                                isVietnamese
                                  ? "Xem bảng kê chi tiết"
                                  : tr("View statement")
                              }
                              onClick={() => handleOpenStatement(inv)}
                            >
                              {isVietnamese ? "Chi tiết" : tr("Statement")}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          {filteredInvoices.length > PAGE_SIZE && (
            <Pagination
              page={currentPage}
              pageSize={PAGE_SIZE}
              total={filteredInvoices.length}
              noun="statements"
              onPage={setPage}
            />
          )}
        </Card>
      )}

      {/* Generate Monthly Invoices Modal */}
      {isGenerateOpen && (
        <Modal
          title={tr("Create monthly statements")}
          subtitle={tr(
            "Create unissued statements for a completed billing month",
          )}
          width={540}
          onClose={generating ? undefined : () => setIsGenerateOpen(false)}
          foot={
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "0.75rem",
                width: "100%",
              }}
            >
              <Button
                tone="secondary"
                onClick={() => setIsGenerateOpen(false)}
                disabled={generating}
              >
                {tr("Cancel")}
              </Button>
              <Button
                tone="primary"
                onClick={handleConfirmGenerate}
                disabled={generating}
              >
                {generating ? tr("Generating...") : tr("Create statements")}
              </Button>
            </div>
          }
        >
          <div
            style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
          >
            {generateError && (
              <div
                id="draft-period-error"
                role="alert"
                style={{
                  padding: "0.75rem 1rem",
                  background: "var(--danger-bg, #fef2f2)",
                  color: "var(--danger, #dc2626)",
                  borderRadius: "var(--r-sm, 6px)",
                  fontSize: "var(--fs-sm)",
                  border: "1px solid var(--danger-border, #fecaca)",
                }}
              >
                {generateError}
              </div>
            )}

            <div>
              <label
                htmlFor="draft-period"
                style={{
                  display: "block",
                  fontSize: "var(--fs-sm)",
                  fontWeight: 600,
                  marginBottom: "0.375rem",
                }}
              >
                {tr("Billing Period (YYYY-MM)")} *
              </label>
              <input
                id="draft-period"
                type="month"
                max={defaultClosedMonth()}
                required
                disabled={generating}
                aria-describedby={
                  generateError
                    ? "draft-period-help draft-period-error"
                    : "draft-period-help"
                }
                value={billingPeriodInput}
                onChange={(e) => setBillingPeriodInput(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.625rem 0.875rem",
                  borderRadius: "var(--r-sm, 6px)",
                  border: "1px solid var(--border)",
                  background: "var(--surface)",
                  color: "var(--ink)",
                  fontSize: "var(--fs-body)",
                }}
              />
              <p
                id="draft-period-help"
                style={{
                  margin: "0.375rem 0 0",
                  fontSize: "var(--fs-xs)",
                  color: "var(--muted)",
                }}
              >
                {tr(
                  "Statements are created for horses with recorded stays in a completed month. Existing statements are kept.",
                )}
              </p>
            </div>

            {/* Parameter & Ledger Explanation */}
            <div
              style={{
                padding: "0.875rem 1rem",
                background: "var(--surface-sunken, #f8fafc)",
                borderRadius: "var(--r-sm, 6px)",
                border: "1px solid var(--border)",
                fontSize: "var(--fs-xs)",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              <strong style={{ color: "var(--ink)", fontSize: "var(--fs-sm)" }}>
                <Icon name="clipboard" inline size={14} />{" "}
                {tr("Monthly Statement Calculation Rule:")}
              </strong>
              <div>
                • <strong>{tr("Total Upkeep Expenses:")}</strong>{" "}
                {tr(
                  "Boarding is 6,000,000 VND per calendar month, prorated by actual stay days. Each month is billed separately.",
                )}
              </div>
              <div>
                • <strong>{tr("Tournament Prize Credits:")}</strong>{" "}
                {tr("Prize credits on new statements start at zero.")}
              </div>
              <div>
                • <strong>{tr("Net Settlement Balance:")}</strong>{" "}
                {tr(
                  "Upkeep Expenses minus Prize Credits. Generates a clear payable statement for the horse owner.",
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Statement details */}
      {selectedInvoice && (
        <Modal
          title={
            isVietnamese
              ? "Chi tiết bảng kê & Quyết toán"
              : tr("Statement details")
          }
          subtitle={tr("Period {{period}} — Horse: {{horse}}", {
            period: selectedInvoice.billingPeriod,
            horse: selectedInvoice.horse.name,
          })}
          width={580}
          onClose={updatingInvoice ? undefined : () => setSelectedInvoice(null)}
          foot={
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "0.75rem",
                width: "100%",
                alignItems: "center",
              }}
            >
              <Button
                tone="secondary"
                icon="file"
                onClick={() =>
                  printStatement(
                    [selectedInvoice],
                    selectedInvoice.billingPeriod,
                    selectedInvoice.owner.fullName,
                  )
                }
              >
                {tr("Export PDF")}
              </Button>
              <Button
                tone="secondary"
                icon="download"
                onClick={() =>
                  exportStatementXlsx(
                    [selectedInvoice],
                    selectedInvoice.billingPeriod,
                  )
                }
              >
                {tr("Export Excel")}
              </Button>
              <Button
                tone="secondary"
                disabled={updatingInvoice !== null}
                onClick={() => setSelectedInvoice(null)}
              >
                {tr("Close")}
              </Button>
            </div>
          }
        >
          <div
            style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
          >
            {actionError && <Alert tone="danger">{actionError}</Alert>}
            <div>
              <Badge
                tone={
                  selectedInvoice.status === "PAID"
                    ? "ok"
                    : selectedInvoice.status === "OVERDUE"
                      ? "danger"
                      : selectedInvoice.status === "SENT"
                        ? "warn"
                        : "neutral"
                }
              >
                {invoiceStatusLabel(selectedInvoice.status, isOwner)}
              </Badge>
            </div>
            {isClubManager && (
              <div>
                {tr("Owner")}: {selectedInvoice.owner?.fullName || "—"}
              </div>
            )}
            <div>
              {tr("Payment deadline")}:{" "}
              {selectedInvoice.dueAt
                ? new Date(selectedInvoice.dueAt).toLocaleString(locale, {
                    timeZone: "Asia/Ho_Chi_Minh",
                    dateStyle: "short",
                    timeStyle: "short",
                  })
                : tr("No payment deadline")}
            </div>
            {selectedInvoice.boardingDays != null && (
              <div>
                {tr("Boarding days: {{count}}", {
                  count: selectedInvoice.boardingDays,
                })}
              </div>
            )}
            {selectedInvoice.boardingMonthlyRate != null && (
              <div>
                {tr("Monthly boarding rate")}:{" "}
                {formatCurrency(selectedInvoice.boardingMonthlyRate)} VND
              </div>
            )}
            <section
              aria-label={
                isVietnamese
                  ? "Cấn trừ chi phí và thưởng"
                  : "Expense and prize offset"
              }
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 12,
                alignItems: "center",
                padding: 16,
                background: "var(--surface-sunken)",
                borderRadius: "var(--r-sm)",
              }}
            >
              <div>
                {tr("Total Expenses")}
                <br />
                <strong>
                  {formatVND(
                    selectedInvoice.boardingFee +
                      selectedInvoice.medicalFee +
                      selectedInvoice.trainingFee,
                  )}
                </strong>
              </div>
              <span aria-hidden="true">−</span>
              <div>
                {isVietnamese
                  ? "Thưởng thực nhận (đã chia 85%)"
                  : "Owner prize credit (85% share already applied)"}
                <br />
                <strong>{formatVND(selectedInvoice.prizeCredit)}</strong>
              </div>
              <span aria-hidden="true">=</span>
              <div>
                {selectedInvoice.netAmount < 0
                  ? isVietnamese
                    ? "CLB cần hoàn"
                    : "Club payout due"
                  : tr("Net Amount")}
                <br />
                <strong>
                  {formatVND(Math.abs(selectedInvoice.netAmount))}
                </strong>
              </div>
            </section>
            {/* Bill Summary */}
            <div
              style={{
                padding: "0.875rem 1rem",
                background: "var(--surface-sunken, #f8fafc)",
                borderRadius: "var(--r-sm, 6px)",
                border: "1px solid var(--border)",
                display: "flex",
                flexDirection: "column",
                gap: "0.375rem",
                fontSize: "var(--fs-sm)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted)" }}>
                  {tr("Stall Boarding:")}
                </span>
                <strong>{formatVND(selectedInvoice.boardingFee)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted)" }}>
                  {tr("Medical & Veterinary:")}
                </span>
                <strong>{formatVND(selectedInvoice.medicalFee)}</strong>
              </div>
              <MedicalUsageAppendix invoice={selectedInvoice} />
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted)" }}>
                  {tr("Conditioning & Training:")}
                </span>
                <strong>{formatVND(selectedInvoice.trainingFee)}</strong>
              </div>
              {selectedInvoice.prizeCredit > 0 && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    color: "var(--brand-700)",
                  }}
                >
                  <span>{tr("Tournament Prize Credits:")}</span>
                  <strong>-{formatVND(selectedInvoice.prizeCredit)}</strong>
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  paddingTop: "0.5rem",
                  marginTop: "0.25rem",
                  borderTop: "1px dashed var(--border)",
                  fontSize: "var(--fs-base, 1rem)",
                  fontWeight: 800,
                  color: "var(--ink)",
                }}
              >
                <span>{tr("Net Amount")}</span>
                <span style={{ color: "var(--brand-700)" }}>
                  {formatVND(selectedInvoice.netAmount)}
                </span>
              </div>
            </div>

            {user.role === "HORSE_OWNER" &&
              selectedInvoice.ownerId === user.id &&
              (selectedInvoice.status === "SENT" ||
                selectedInvoice.status === "OVERDUE") &&
              selectedInvoice.netAmount > 0 && (
                <div
                  style={{
                    padding: "0.875rem 1rem",
                    background: "var(--surface-sunken, #f8fafc)",
                    borderRadius: "var(--r-sm, 6px)",
                    border: "1px solid var(--border)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                  }}
                >
                  <div
                    style={{
                      fontSize: "var(--fs-sm)",
                      color: "var(--ink)",
                      fontWeight: 600,
                    }}
                  >
                    {tr("Report bank transfer")}
                    <Button
                      tone="secondary"
                      disabled
                      title={
                        isVietnamese
                          ? "Chưa cấu hình tài khoản ngân hàng"
                          : "Bank account is not configured"
                      }
                    >
                      VietQR · {isVietnamese ? "Chưa khả dụng" : "Unavailable"}
                    </Button>
                    <p style={{ fontWeight: 400 }}>
                      {isVietnamese
                        ? "VietQR chưa khả dụng: CLB chưa cấu hình tài khoản nhận tiền. Liên hệ CLB để lấy thông tin chuyển khoản."
                        : "VietQR unavailable: the club has not configured a receiving bank account. Contact the club for transfer details."}
                    </p>
                  </div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "var(--fs-xs)",
                      color: "var(--muted)",
                    }}
                  >
                    {selectedInvoice.paymentReportedAt
                      ? tr(
                          "You reported a transfer on {{date}}. The statement stays unpaid until the club confirms the money arrived.",
                          {
                            date: new Date(
                              selectedInvoice.paymentReportedAt,
                            ).toLocaleString(locale, {
                              timeZone: "Asia/Ho_Chi_Minh",
                            }),
                          },
                        )
                      : tr(
                          "After transferring, enter the bank reference so the club can match it. The statement becomes paid only after the club confirms.",
                        )}
                  </p>
                  <input
                    aria-label={tr("Bank transfer reference")}
                    placeholder={tr("Bank transfer reference")}
                    maxLength={100}
                    value={paymentRefInput}
                    disabled={updatingInvoice !== null}
                    onChange={(e) => setPaymentRefInput(e.target.value)}
                    style={{
                      padding: "0.5rem 0.75rem",
                      borderRadius: "var(--r-sm, 6px)",
                      border: "1px solid var(--border)",
                      font: "inherit",
                    }}
                  />
                  <div
                    style={{
                      display: "flex",
                      gap: "0.5rem",
                      marginTop: "0.25rem",
                      flexWrap: "wrap",
                    }}
                  >
                    <Button
                      tone="primary"
                      icon="creditCard"
                      onClick={() => setPayOSInvoice(selectedInvoice)}
                    >
                      {isVietnamese ? "⚡ Quét VietQR / PayOS" : tr("Pay with VietQR / PayOS")}
                    </Button>
                    <Button
                      tone="secondary"
                      icon="check"
                      disabled={updatingInvoice !== null}
                      onClick={handlePayInvoice}
                    >
                      {updatingInvoice === selectedInvoice.id
                        ? isVietnamese
                          ? "Đang xử lý..."
                          : tr("Processing...")
                        : selectedInvoice.paymentReportedAt
                          ? tr("Update report")
                          : tr("I have transferred")}
                    </Button>
                  </div>
                </div>
              )}

            {isClubManager &&
              selectedInvoice.paymentReportedAt &&
              (selectedInvoice.status === "SENT" ||
                selectedInvoice.status === "OVERDUE") && (
                <div
                  style={{
                    padding: "0.75rem 1rem",
                    borderRadius: "var(--r-sm, 6px)",
                    border: "1px solid var(--border)",
                    fontSize: "var(--fs-sm)",
                  }}
                >
                  <Badge tone="info">{tr("Awaiting reconciliation")}</Badge>{" "}
                  {tr(
                    "Owner reported {{method}} on {{date}}, reference: {{ref}}. Check the bank statement, then use Mark Paid.",
                    {
                      method: selectedInvoice.paymentMethod ?? "BANK_TRANSFER",
                      date: new Date(
                        selectedInvoice.paymentReportedAt,
                      ).toLocaleString(locale, {
                        timeZone: "Asia/Ho_Chi_Minh",
                      }),
                      ref: selectedInvoice.paymentRef || "—",
                    },
                  )}
                </div>
              )}

            {selectedInvoice.status === "PAID" && (
              <div
                style={{
                  padding: "0.75rem 1rem",
                  background: "var(--surface-sunken, #f8fafc)",
                  borderRadius: "var(--r-sm, 6px)",
                  border: "1px solid var(--border)",
                  color: "var(--brand-700, #15803d)",
                  fontSize: "var(--fs-sm)",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                <Icon name="check" size={16} />
                <span>
                  {isVietnamese
                    ? "Bảng kê này đã được quyết toán và thanh toán đầy đủ."
                    : tr("This statement has been fully settled and paid.")}
                </span>
              </div>
            )}
          </div>
        </Modal>
      )}

      <SingleInvoiceModal
        open={isCreateSingleOpen}
        defaultPeriod={billingPeriodInput}
        horses={horses}
        horsesLoading={horsesLoading}
        onClose={() => setIsCreateSingleOpen(false)}
        onCreated={async () => {
          setIsCreateSingleOpen(false);
          const msg = tr("Statement created.");
          toast.show(msg, "ok");
          setStatusMessage(msg);
          await loadData();
        }}
      />

      {pendingTransition && (
        <ConfirmModal
          title={
            pendingTransition.targetStatus === "PAID"
              ? tr("Confirm payment receipt")
              : tr("Cancel statement?")
          }
          subtitle={`${pendingTransition.invoice.horse.name} · ${pendingTransition.invoice.billingPeriod}`}
          tone={
            pendingTransition.targetStatus === "CANCELLED" ? "danger" : "info"
          }
          confirmLabel={
            pendingTransition.targetStatus === "PAID"
              ? tr("Confirm settlement")
              : tr("Confirm cancel")
          }
          cancelLabel={tr("Back")}
          confirmIcon={
            pendingTransition.targetStatus === "PAID" ? "check" : undefined
          }
          busy={updatingInvoice !== null}
          onConfirm={() => void handleConfirmTransition()}
          onCancel={() => setPendingTransition(null)}
        >
          <p>
            <strong>
              {tr("Net Amount")}:{" "}
              {formatVND(pendingTransition.invoice.netAmount)}
            </strong>
          </p>
          {pendingTransition.targetStatus === "CANCELLED" ? (
            <p>
              {tr(
                "This statement will be voided and excluded from collectible club revenue.",
              )}
            </p>
          ) : null}
          {pendingTransition.invoice.status === "OVERDUE" && (
            <Alert
              tone={
                pendingTransition.targetStatus === "CANCELLED" ? "warn" : "info"
              }
            >
              {pendingTransition.targetStatus === "CANCELLED"
                ? tr(
                    "Cancelling an OVERDUE statement will automatically re-check and release debt sanctions if no other overdue invoices remain.",
                  )
                : tr(
                    "Marking an OVERDUE statement as PAID will automatically release debt impound locks if all overdue statements are settled.",
                  )}
            </Alert>
          )}
        </ConfirmModal>
      )}

      {payOSInvoice && (
        <PayOSCheckoutModal
          invoice={payOSInvoice}
          onClose={() => setPayOSInvoice(null)}
          onSuccess={async (updated) => {
            setPayOSInvoice(null);
            if (updated && selectedInvoice?.id === updated.id) {
              setSelectedInvoice(updated);
            }
            await loadData();
          }}
        />
      )}
    </div>
  );
}
