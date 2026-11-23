import formLayout from "@/shared/components/form/FormLayout.module.css";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Field } from "@/shared/components/form/Field";
import { Input } from "@/shared/components/form/Input";
import { Select } from "@/shared/components/form/Select";
import { SearchSelect } from "@/shared/components/form/SearchSelect";
import { Textarea } from "@/shared/components/form/Textarea";
import { Button } from "@/shared/components/ui/Button";
import { Badge } from "@/shared/components/ui/Badge";
import { Modal } from "@/shared/components/ui/Modal";
import type { PrescriptionInput } from "../types";
import { formatDate } from "@/shared/lib/format";
import { getSupplies } from "@/features/master-data/api/suppliesApi";
import type { SupplyCatalogItem } from "@/features/master-data/types/supplies";
import { inventoryApi } from "@/features/stable/api/inventoryApi";
import {
  formatPrescriptionRoute,
  formatPrescriptionUnit,
  normalizePrescriptionUnit,
} from "../utils/prescriptionFormat";

import { isVietnamese as checkIsVi, localizeServerText, tr } from "@/shared/i18n/tr";
import { todayClub } from "@/features/training/api";

const ROUTE_OPTIONS = [
  { value: "Oral", label: "Oral (PO)" },
  { value: "Intramuscular", label: "Intramuscular (IM)" },
  { value: "Intravenous", label: "Intravenous (IV)" },
  { value: "Subcutaneous", label: "Subcutaneous (SC)" },
  { value: "Topical", label: "Topical" },
  { value: "Ophthalmic", label: "Ophthalmic" },
  { value: "Inhalation", label: "Inhalation" },
];

interface AddPrescriptionModalProps {
  onClose: () => void;
  onSubmit: (input: PrescriptionInput) => Promise<void>;
}

export function AddPrescriptionModal({ onClose, onSubmit }: AddPrescriptionModalProps) {
  const isVi = checkIsVi();
  const [supplyId, setSupplyId] = useState<string | null>(null);
  const [medicationName, setMedicationName] = useState("");
  const [dosage, setDosage] = useState("");
  const [unit, setUnit] = useState("");
  const [route, setRoute] = useState("");
  const [frequencyPerDay, setFrequencyPerDay] = useState("");
  const [startDate, setStartDate] = useState(() => todayClub());
  const [daysCount, setDaysCount] = useState("");
  const [withdrawalDays, setWithdrawalDays] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [suppliesCatalog, setSuppliesCatalog] = useState<SupplyCatalogItem[]>([]);
  const [stockMap, setStockMap] = useState<Record<string, number>>({});
  const [, setLoadingSupplies] = useState(false);

  useEffect(() => {
    let active = true;
    const loadSupplies = async () => {
      setLoadingSupplies(true);
      try {
        const [supplies, stockRes] = await Promise.allSettled([
          getSupplies({ category: "MEDICINE" }),
          inventoryApi.listStock({ category: "MEDICINE" }),
        ]);

        if (!active) return;

        if (supplies.status === "fulfilled" && Array.isArray(supplies.value)) {
          setSuppliesCatalog(supplies.value);
        }

        if (stockRes.status === "fulfilled" && stockRes.value?.items) {
          const map: Record<string, number> = {};
          for (const item of stockRes.value.items) {
            map[item.supplyId] = (map[item.supplyId] || 0) + (Number(item.quantity) || 0);
          }
          setStockMap(map);
        }
      } catch {
        // Fallback gracefully
      } finally {
        if (active) setLoadingSupplies(false);
      }
    };
    loadSupplies();
    return () => {
      active = false;
    };
  }, []);

  const totalAmount = Number(dosage) * Number(frequencyPerDay) * Number(daysCount);

  // Calculate withdrawal clearance date
  const startD = new Date(startDate);
  const endD = new Date(startD.getTime() + (Number(daysCount) - 1) * 86400000);
  const withdrawalEndD = new Date(endD.getTime() + Number(withdrawalDays) * 86400000);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!supplyId) {
      setError(tr("Please choose a medicine from the stock catalog."));
      return;
    }
    const numDosage = Number(dosage);
    if (!Number.isInteger(numDosage) || numDosage <= 0) {
      setError(isVi ? "Liều dùng thuốc phải là số tự nhiên lớn hơn hoặc bằng 1." : "Medication dose must be a positive integer (natural number >= 1).");
      return;
    }
    if (Number(frequencyPerDay) <= 0 || Number(daysCount) <= 0) {
      setError(isVi ? "Số lần/ngày và số ngày phải lớn hơn 0." : "Frequency and treatment days must be greater than 0.");
      return;
    }
    if (Number(frequencyPerDay) > 3) {
      setError(isVi ? "Số lần dùng thuốc mỗi ngày tối đa là 3 lần." : "Medication frequency cannot exceed 3 times per day.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const calculatedEndDate = !isNaN(endD.getTime())
        ? endD.toISOString().split("T")[0]
        : startDate;
      await onSubmit({
        supplyId: supplyId || undefined,
        medicationName: medicationName.trim(),
        dosage: Number(dosage),
        unit,
        route,
        frequencyPerDay: Number(frequencyPerDay),
        startDate,
        endDate: calculatedEndDate,
        daysCount: Number(daysCount),
        withdrawalDays: Number(withdrawalDays || 0),
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? localizeServerText(err.message) : tr("Failed to record prescription."));
    } finally {
      setBusy(false);
    }
  }

  const selectedStock = supplyId ? stockMap[supplyId] : undefined;

  return (
    <Modal
      title={tr("Prescribe Medication")}
      subtitle={isVi ? "Quản lý liều dùng, đường dùng và tính toán tự động ngày hết dư lượng trước thi đấu." : "Manage dosage, administration route, and automated pre-race withdrawal clearance calculation."}
      width={580}
      onClose={busy ? undefined : onClose}
      foot={
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, width: "100%" }}>
          <Button tone="ghost" onClick={onClose} disabled={busy}>
            {tr("Cancel")}
          </Button>
          <Button tone="primary" type="submit" form="prescription-form" disabled={busy}>
            {isVi ? "Lưu đơn thuốc" : "Save Prescription"}
          </Button>
        </div>
      }
    >
      <form id="prescription-form" onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {error && (
          <div role="alert" style={{ color: "var(--danger)", fontSize: "var(--fs-body)", padding: "8px", background: "var(--danger-bg)", borderRadius: "var(--r)" }}>
            {tr(error)}
          </div>
        )}

        <Field
          label={tr("Medication (from pharmacy stock) *")}
          hint={tr("Only medicines in the stock catalog can be prescribed; the unit follows the product.")}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <SearchSelect
              aria-label={tr("Medication (from pharmacy stock) *")}
              value={supplyId || ""}
              placeholder={tr("— Choose a medicine —")}
              onChange={(id) => {
                const found = suppliesCatalog.find((s) => s.id === id);
                setSupplyId(found?.id ?? null);
                setMedicationName(found?.name ?? "");
                setUnit(found?.unit ? normalizePrescriptionUnit(found.unit) : "");
                if (found?.withdrawalDays != null) setWithdrawalDays(String(found.withdrawalDays));
              }}
              options={suppliesCatalog.map((s) => {
                const stock = stockMap[s.id];
                return { value: s.id, label: stock != null ? `${s.name} (${tr("Stock")}: ${stock})` : s.name };
              })}
            />
            {supplyId && (
              <Badge tone={selectedStock != null && selectedStock > 0 ? "ok" : "warn"}>
                {selectedStock != null
                  ? `${tr("Available in stock")}: ${selectedStock} ${formatPrescriptionUnit(unit, isVi)}`
                  : tr("Not stocked in any zone yet")}
              </Badge>
            )}
          </div>
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1.2fr 1.5fr", gap: 10 }}>
          <Field label={tr("Dose per Intake *")} hint={isVi ? "Số nguyên >= 1" : "Natural number >= 1"}>
            <Input
              type="number"
              step="1"
              min={1}
              value={dosage}
              onChange={(e) => {
                const clean = e.target.value.replace(/[^0-9]/g, "");
                setDosage(clean);
              }}
              required
            />
          </Field>
          <Field label={tr("Unit *")} hint={tr("Set by the chosen medicine (locked)")}>
            <Input value={unit ? formatPrescriptionUnit(unit, isVi) : "—"} disabled readOnly />
          </Field>
          <Field label={tr("Route *")}>
            <Select
              required
              options={[
                { value: "", label: tr("Select route"), disabled: true },
                ...ROUTE_OPTIONS.map((opt) => ({
                  value: opt.value,
                  label: formatPrescriptionRoute(opt.label, isVi),
                })),
              ]}
              value={route}
              onChange={(e) => setRoute(e.target.value)}
            />
          </Field>
        </div>

        <div className={formLayout.columns}>
          <Field label={isVi ? "Số lần / ngày (tối đa 3) *" : "Frequency (max 3/day) *"}>
            <Input
              type="number"
              min={1}
              max={3}
              value={frequencyPerDay}
              onChange={(e) => {
                const num = Number(e.target.value);
                if (num > 3) {
                  setFrequencyPerDay("3");
                } else if (num < 0) {
                  setFrequencyPerDay("1");
                } else {
                  setFrequencyPerDay(e.target.value);
                }
              }}
              required
            />
          </Field>
          <Field label={isVi ? "Ngày bắt đầu *" : "Start Date *"}>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
          </Field>
          <Field label={isVi ? "Số ngày dùng *" : "Duration (days) *"}>
            <Input
              type="number"
              min={1}
              max={90}
              value={daysCount}
              onChange={(e) => setDaysCount(e.target.value)}
              required
            />
          </Field>
        </div>

        <div
          style={{
            background: "var(--surface-2)",
            padding: "10px 14px",
            borderRadius: "var(--r-sm)",
            border: "1px solid var(--border)",
            fontSize: "var(--fs-body)",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span>
            {isVi ? "Tổng lượng thuốc cần dùng: " : "Total medication required: "}{" "}
            <strong>{dosage && frequencyPerDay && daysCount ? `${totalAmount} ${formatPrescriptionUnit(unit, isVi)}` : "—"}</strong>
          </span>
          <span>
            {isVi ? "Đến ngày: " : "Through: "}{" "}
            <strong>{Number(daysCount) > 0 ? formatDate(endD) : "—"}</strong>
          </span>
        </div>

        <Field
          label={(isVi ? "Thời gian ngưng thuốc trước đua (ngày)" : "Pre-Race Withdrawal Period (days)") + " *"}
          hint={isVi ? "Quy định kiểm soát doping; vi phạm sẽ kích hoạt cảnh báo khi đăng ký thi đấu." : "Anti-doping clearance protocol; triggers alerts upon race registration if violated."}
        >
          <div className={formLayout.columns}>
            <Input
              type="number"
              min={0}
              max={90}
              required
              value={withdrawalDays}
              onChange={(e) => setWithdrawalDays(e.target.value)}
            />
            <span style={{ fontSize: "var(--fs-caption)", color: "var(--muted)", alignSelf: "center" }}>
              {isVi ? "Ngày hết dư lượng: " : "Clearance date: "}{" "}
              <strong>{Number(daysCount) > 0 && withdrawalDays !== "" ? formatDate(withdrawalEndD) : "—"}</strong>
            </span>
          </div>
        </Field>

        <Field label={isVi ? "Chỉ dẫn sử dụng" : "Administration Instructions"} hint={isVi ? "Ghi chú dành cho nhân viên chăm sóc hoặc kỹ thuật viên chuồng" : "Notes for Groom or stable care technicians"}>
          <Textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={isVi ? "VD: Trộn vào khẩu phần cám sáng và tối sau khi ăn cỏ khô..." : "e.g., Mix into morning and evening grain rations after feeding..."}
          />
        </Field>
      </form>
    </Modal>
  );
}
