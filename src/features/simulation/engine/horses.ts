// Nhãn và kiểm tra điều kiện từ Simulator; danh mục ngựa mẫu đã được loại khỏi bản nhúng.
import { type Coat, type HorseProfile, type Lifecycle, type StallHealth, type Strategy } from "./engine.ts";

export const COAT_LABEL: Record<Coat, string> = {
  BAY: "Hạt dẻ (Bay)",
  CHESTNUT: "Hồng mã (Chestnut)",
  BLACK: "Hắc mã (Black)",
  GRAY: "Bạch mã (Gray)",
  ROAN: "Xám muối tiêu (Roan)",
};

export const LIFECYCLE_LABEL: Record<Lifecycle, string> = {
  SAN_SANG_THI_DAU: "Sẵn sàng thi đấu",
  DANG_TAP_LUYEN: "Đang tập luyện",
  CAN_THEO_DOI: "Cần theo dõi",
  CHAN_THUONG: "Chấn thương",
  CACH_LY: "Cách ly",
  NGHI_NGOI: "Nghỉ ngơi",
};

export const HEALTH_LABEL: Record<StallHealth, string> = {
  FIT: "Đủ điều kiện",
  WATCH: "Cần theo dõi",
  INJURED: "Chấn thương",
  ISOLATED: "Cách ly",
};

export const STRATEGY_LABEL: Record<Strategy, string> = {
  FRONT: "Dẫn đầu",
  STALKER: "Bám đuổi",
  CLOSER: "Nước rút",
};

/** Ngựa không được xuất phát bài nặng/đua: Medical Lock, chấn thương, cách ly (RULE-MED-01). */
export function blockReason(h: HorseProfile): string | null {
  if (h.medicalLock) return "Đang bị Medical Lock";
  if (h.lifecycle === "CHAN_THUONG") return "Đang chấn thương";
  if (h.lifecycle === "CACH_LY") return "Đang cách ly";
  return null;
}
