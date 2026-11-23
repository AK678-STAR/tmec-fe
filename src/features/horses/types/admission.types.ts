export type AdmissionStatus =
  | "PENDING_VERIFICATION"
  | "APPOINTED"
  | "INSPECTION_IN_PROGRESS"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";

export interface HorseAdmissionRecord {
  id: string;
  admissionCode: string; // e.g. ADM-2026-001
  horseId: string;
  horse: {
    id?: string;
    name: string;
    microchip?: string | null;
    microchipRfid?: string | null;
    breed?: string | null;
    dob?: string | null;
    gender?: string | null;
    color?: string | null;
  };
  ownerId: string;
  owner: {
    id?: string;
    fullName: string;
    email: string;
    phone?: string | null;
  };
  status: AdmissionStatus;

  // Mục 1: Lịch hẹn thẩm định
  appointmentDate?: string | null;
  appointmentNotes?: string | null;

  // Mục 2: Thẩm định Pháp lý & Vi mạch (Club Manager)
  declaredMicrochip?: string | null;
  scannedMicrochip?: string | null;
  microchipVerified: boolean;
  legalDocumentsNote?: string | null;
  documentsUrl?: string | null;
  legalVerified: boolean;

  // Mục 3: Khám sàng lọc ban đầu (Veterinarian)
  isHealthEligible?: boolean | null;
  healthCheckNotes?: string | null;
  veterinarianUserId?: string | null;
  veterinarian?: {
    id?: string;
    fullName: string;
    email?: string;
  } | null;

  // Mục 4: Quyết định tiếp nhận chính thức (Club Manager)
  approvedByUserId?: string | null;
  approvedBy?: {
    id?: string;
    fullName: string;
    email?: string;
  } | null;
  admittedAt?: string | null;
  rejectionReason?: string | null;

  history?: AdmissionHistoryLog[];
  createdAt: string;
  updatedAt: string;
}

export interface AdmissionHistoryLog {
  id: string;
  admissionId: string;
  fromStatus: AdmissionStatus | null;
  toStatus: AdmissionStatus;
  actorUserId: string;
  actorName?: string | null;
  note?: string | null;
  createdAt: string;
}

export interface ScheduleAdmissionDto {
  appointmentDate: string;
  appointmentNotes?: string;
}

export interface InspectAdmissionDto {
  scannedMicrochip?: string;
  legalVerified?: boolean;
  legalDocumentsNote?: string;
  documentsUrl?: string;
  isHealthEligible?: boolean;
  healthCheckNotes?: string;
}

export interface RejectAdmissionDto {
  rejectionReason: string;
  note?: string;
}

export interface CancelAdmissionDto {
  reason?: string;
}

export interface AdmissionListFilter {
  status?: AdmissionStatus | "ALL";
  search?: string;
  recent7Days?: boolean;
  page?: number;
  pageSize?: number;
}

export interface AdmissionListResponse {
  data: HorseAdmissionRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages?: number;
}
