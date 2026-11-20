import formLayout from "@/shared/components/form/FormLayout.module.css";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Field } from "@/shared/components/form/Field";
import { Input } from "@/shared/components/form/Input";
import { Select } from "@/shared/components/form/Select";
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

const UNIT_OPTIONS = [
  { value: "ml", label: "ml" },
  { value: "mg", label: "mg" },
  { value: "g", label: "g" },
  { value: "kg", label: "kg" },
  { value: "tablets", label: "tablets" },
  { value: "vials", label: "vials" },
  { value: "sachets", label: "sachets" },
  { value: "doses", label: "doses" },
  { value: "bottles", label: "bottles" },
];

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
    if (!medicationName.trim()) {
      setError(isVi ? "Vui lòng nhập tên thuốc." : "Please enter medication name.");
      return;
    }
    if (Number(dosage) <= 0 || Number(frequencyPerDay) <= 0 || Number(daysCount) <= 0) {
      setError(isVi ? "Liều lượng, số lần/ngày và số ngày phải lớn hơn 0." : "Dose, frequency, and treatment days must be greater than 0.");
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
          label={isVi ? "Tên thuốc / Hoạt chất *" : "Medication Name *"}
          hint={
            supplyId
              ? (isVi ? "Đang liên kết với kho y tế" : "Linked to pharmacy stock catalog")
              : (isVi ? "Mặc định: Thuốc mua ngoài (tự do nhập theo chỉ định bác sĩ)" : "Default: External medication (freely entered as prescribed)")
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div style={{ flex: 1 }}>
                <Input
                  value={medicationName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setMedicationName(val);
                    // Khi người dùng tự gõ/sửa tên thuốc: mặc định là thuốc mua ngoài (supplyId = null)
                    const matched = suppliesCatalog.find(
                      (s) => s.name.trim().toLowerCase() === val.trim().toLowerCase(),
                    );
                    if (matched) {
                      setSupplyId(matched.id);
                      if (matched.unit) {
                        setUnit(normalizePrescriptionUnit(matched.unit));
                      }
                      if (matched.withdrawalDays != null && !withdrawalDays) {
                        setWithdrawalDays(String(matched.withdrawalDays));
                      }
                    } else {
                      setSupplyId(null);
                    }
                  }}
                  placeholder={isVi ? "Nhập tên thuốc hoặc hoạt chất mua ngoài..." : "Enter external medication name or active ingredient..."}
                  required
                  autoFocus
                />
              </div>

              {suppliesCatalog.length > 0 && (
                <div style={{ minWidth: 210 }}>
                  <Select
                    aria-label={isVi ? "Chọn thuốc từ kho y tế" : "Select from pharmacy stock"}
                    value={supplyId || ""}
                    onChange={(e) => {
                      const id = e.target.value;
                      if (!id) {
                        setSupplyId(null);
                        return;
                      }
                      const found = suppliesCatalog.find((s) => s.id === id);
                      if (found) {
                        setSupplyId(found.id);
                        setMedicationName(found.name);
                        if (found.unit) {
                          setUnit(normalizePrescriptionUnit(found.unit));
                        }
                        if (found.withdrawalDays != null) {
                          setWithdrawalDays(String(found.withdrawalDays));
                        }
                      }
                    }}
                    options={[
                      { value: "", label: isVi ? "— Hoặc chọn từ kho —" : "— Or pick from stock —" },
                      ...suppliesCatalog.map((s) => {
                        const stock = stockMap[s.id];
                        const stockText = stock != null ? ` (${isVi ? "Tồn" : "Stock"}: ${stock})` : "";
                        return {
                          value: s.id,
                          label: `${s.name}${stockText}`,
                        };
                      }),
                    ]}
                  />
                </div>
              )}
            </div>

            {/* Badge Indicator */}
            {medicationName.trim() && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {supplyId ? (
                  <Badge tone={selectedStock != null && selectedStock > 0 ? "ok" : "warn"}>
                    {selectedStock != null
                      ? `${isVi ? "Kho có sẵn" : "Available in stock"}: ${selectedStock} ${formatPrescriptionUnit(unit, isVi)}`
                      : (isVi ? "Thuốc trong danh mục kho" : "Catalog medication")}
                  </Badge>
                ) : (
                  <Badge tone="warn">
                    {isVi ? "Thuốc mua ngoài / Chưa nhập kho" : "External / Non-inventory Medication"}
                  </Badge>
                )}

                {supplyId && (
                  <Button
                    type="button"
                    size="sm"
                    tone="ghost"
                    onClick={() => {
                      setSupplyId(null);
                    }}
                  >
                    {isVi ? "Đổi sang thuốc mua ngoài" : "Switch to external"}
                  </Button>
                )}
              </div>
            )}
          </div>
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1.2fr 1.5fr", gap: 10 }}>
          <Field label={tr("Dose per Intake *")}>
            <Input
              type="number"
              step="any"
              min={0.1}
              value={dosage}
              onChange={(e) => setDosage(e.target.value)}
              required
            />
          </Field>
          <Field label={tr("Unit *")}>
            <Select
              required
              options={[
                { value: "", label: tr("Select unit"), disabled: true },
                ...UNIT_OPTIONS.map((opt) => ({
                  value: opt.value,
                  label: formatPrescriptionUnit(opt.value, isVi),
                })),
              ]}
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
            />
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
