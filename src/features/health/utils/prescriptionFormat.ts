import { isVietnamese as checkIsVi } from "@/shared/i18n/tr";

export const PRESCRIPTION_UNITS_VI: Record<string, string> = {
  mg: "mg",
  ml: "ml",
  g: "g",
  kg: "kg",
  tablets: "viên",
  tablet: "viên",
  sachets: "gói",
  sachet: "gói",
  doses: "liều",
  dose: "liều",
  vials: "lọ/ống",
  vial: "lọ/ống",
  pill: "viên",
  pills: "viên",
  packet: "gói",
  packets: "gói",
  bottle: "chai",
  bottles: "chai",
};

export const PRESCRIPTION_UNITS_EN: Record<string, string> = {
  viên: "tablets",
  gói: "sachets",
  liều: "doses",
  "lọ/ống": "vials",
  chai: "bottles",
  lọ: "vials",
  ống: "vials",
};

export const PRESCRIPTION_ROUTES_VI: Record<string, string> = {
  Oral: "Đường uống (PO)",
  "Oral (PO)": "Đường uống (PO)",
  "PO": "Đường uống (PO)",
  Intramuscular: "Tiêm bắp (IM)",
  "Intramuscular (IM)": "Tiêm bắp (IM)",
  "IM": "Tiêm bắp (IM)",
  Intravenous: "Tiêm tĩnh mạch (IV)",
  "Intravenous (IV)": "Tiêm tĩnh mạch (IV)",
  "IV": "Tiêm tĩnh mạch (IV)",
  Subcutaneous: "Tiêm dưới da (SC)",
  "Subcutaneous (SC)": "Tiêm dưới da (SC)",
  "SC": "Tiêm dưới da (SC)",
  Topical: "Bôi ngoài da",
  Ophthalmic: "Nhỏ mắt",
  Inhalation: "Xông khí dung",
};

export const PRESCRIPTION_ROUTES_EN: Record<string, string> = {
  "Đường uống": "Oral (PO)",
  "Đường uống (PO)": "Oral (PO)",
  "Uống": "Oral (PO)",
  "Tiêm bắp": "Intramuscular (IM)",
  "Tiêm bắp (IM)": "Intramuscular (IM)",
  "Tiêm tĩnh mạch": "Intravenous (IV)",
  "Tiêm tĩnh mạch (IV)": "Intravenous (IV)",
  "Tiêm dưới da": "Subcutaneous (SC)",
  "Tiêm dưới da (SC)": "Subcutaneous (SC)",
  "Bôi ngoài da": "Topical",
  "Nhỏ mắt": "Ophthalmic",
  "Xông khí dung": "Inhalation",
};

export function formatPrescriptionUnit(unit?: string, isVi?: boolean): string {
  if (!unit) return "";
  const isVn = isVi ?? checkIsVi();
  const raw = unit.trim();
  const lower = raw.toLowerCase();

  if (isVn) {
    return PRESCRIPTION_UNITS_VI[lower] || PRESCRIPTION_UNITS_VI[raw] || raw;
  }
  return PRESCRIPTION_UNITS_EN[lower] || PRESCRIPTION_UNITS_EN[raw] || raw;
}

export function formatPrescriptionRoute(route?: string, isVi?: boolean): string {
  if (!route) return "";
  const isVn = isVi ?? checkIsVi();
  const raw = route.trim();

  if (isVn) {
    return PRESCRIPTION_ROUTES_VI[raw] || PRESCRIPTION_ROUTES_VI[raw.replace(/\s+/g, " ")] || raw;
  }
  return PRESCRIPTION_ROUTES_EN[raw] || raw;
}

export function formatPreventiveCategory(category?: string, isVi?: boolean): string {
  if (!category) return "";
  const isVn = isVi ?? checkIsVi();
  const cat = category.toUpperCase().trim();
  if (cat === "VACCINATION") {
    return isVn ? "Tiêm phòng" : "Vaccination";
  }
  if (cat === "DEWORMING") {
    return isVn ? "Tẩy giun sán" : "Deworming";
  }
  if (cat === "FARRIER" || cat === "FARRIER_HOOF_CARE") {
    return isVn ? "Chăm sóc & Đóng móng" : "Farrier Care";
  }
  if (cat === "DENTAL") {
    return isVn ? "Nha khoa" : "Dental Care";
  }
  if (cat === "GENERAL" || cat === "PHYSICAL_EXAM") {
    return isVn ? "Khám định kỳ" : "Routine Checkup";
  }
  return category;
}

export function normalizePrescriptionUnit(raw?: string): string {
  if (!raw) return "";
  const u = raw.trim().toLowerCase();
  if (u === "vial" || u === "vials" || u === "lọ" || u === "ống" || u === "lọ/ống") return "vials";
  if (u === "pill" || u === "pills" || u === "tablet" || u === "tablets" || u === "viên") return "tablets";
  if (u === "packet" || u === "packets" || u === "sachet" || u === "sachets" || u === "gói") return "sachets";
  if (u === "bottle" || u === "bottles" || u === "chai") return "bottles";
  if (u === "dose" || u === "doses" || u === "liều") return "doses";
  if (u === "ml") return "ml";
  if (u === "liter" || u === "l") return "l";
  if (u === "mg") return "mg";
  if (u === "g") return "g";
  if (u === "kg") return "kg";
  return u;
}


