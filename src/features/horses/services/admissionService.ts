import { api } from "@/shared/lib/api";
import type {
  HorseAdmissionRecord,
  AdmissionHistoryLog,
  AdmissionListFilter,
  AdmissionListResponse,
  ScheduleAdmissionDto,
  InspectAdmissionDto,
  RejectAdmissionDto,
  CancelAdmissionDto,
} from "../types/admission.types";

/**
 * Lấy danh sách hồ sơ tiếp nhận ngựa với bộ lọc: status, search, recent7Days, page, pageSize.
 */
export async function getAdmissions(filter?: AdmissionListFilter): Promise<AdmissionListResponse> {
  const params = new URLSearchParams();
  if (filter?.status && filter.status !== "ALL") {
    params.set("status", filter.status);
  }
  if (filter?.search && filter.search.trim()) {
    params.set("search", filter.search.trim());
  }
  if (filter?.recent7Days) {
    params.set("recent7Days", "true");
  }
  if (filter?.page) {
    params.set("page", String(filter.page));
  }
  if (filter?.pageSize) {
    params.set("pageSize", String(filter.pageSize));
  }

  const query = params.toString() ? `?${params.toString()}` : "";
  const res = await api<AdmissionListResponse | HorseAdmissionRecord[]>("GET", `/horses/admissions${query}`);

  if (Array.isArray(res)) {
    return {
      data: res,
      total: res.length,
      page: filter?.page || 1,
      pageSize: filter?.pageSize || res.length || 20,
      totalPages: 1,
    };
  }

  return res;
}

/**
 * Xếp lịch hẹn mang ngựa đến trung tâm tiếp nhận Cổng A (CLUB_MANAGER).
 */
export async function scheduleAdmission(
  id: string,
  dto: ScheduleAdmissionDto,
): Promise<HorseAdmissionRecord> {
  return await api<HorseAdmissionRecord>("POST", `/horses/admissions/${id}/schedule`, dto);
}

/**
 * Thẩm định vi mạch, pháp lý và khám sàng lọc thú y tại trạm (CLUB_MANAGER + VETERINARIAN).
 */
export async function inspectAdmission(
  id: string,
  dto: InspectAdmissionDto,
): Promise<HorseAdmissionRecord> {
  return await api<HorseAdmissionRecord>("PATCH", `/horses/admissions/${id}/inspect`, dto);
}

/**
 * Club Manager phê duyệt tiếp nhận ngựa chính thức vào CLB (chuyển trạng thái sang APPROVED).
 */
export async function approveAdmission(id: string): Promise<HorseAdmissionRecord> {
  return await api<HorseAdmissionRecord>("POST", `/horses/admissions/${id}/approve`);
}

/**
 * Club Manager từ chối tiếp nhận ngựa (bắt buộc kèm lý do từ 10 - 500 ký tự).
 */
export async function rejectAdmission(
  id: string,
  dto: RejectAdmissionDto,
): Promise<HorseAdmissionRecord> {
  return await api<HorseAdmissionRecord>("POST", `/horses/admissions/${id}/reject`, dto);
}

/**
 * Hủy hồ sơ tiếp nhận (CLUB_MANAGER hoặc HORSE_OWNER).
 */
export async function cancelAdmission(
  id: string,
  dto?: CancelAdmissionDto,
): Promise<HorseAdmissionRecord> {
  return await api<HorseAdmissionRecord>("POST", `/horses/admissions/${id}/cancel`, dto ?? {});
}

/**
 * Xem toàn bộ dòng thời gian lịch sử các bước của hồ sơ tiếp nhận (Audit Trail).
 */
export async function getAdmissionHistory(id: string): Promise<AdmissionHistoryLog[]> {
  // BE trả { admission, history } (horses.service.getAdmissionHistory) — đọc đúng field.
  const res = await api<{ admission: HorseAdmissionRecord; history: AdmissionHistoryLog[] }>(
    "GET",
    `/horses/admissions/${id}/history`,
  );
  return res?.history ?? [];
}
