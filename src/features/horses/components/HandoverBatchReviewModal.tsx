import { useState } from "react";
import { Modal } from "@/shared/components/ui/Modal";
import { Button } from "@/shared/components/ui/Button";
import { Badge } from "@/shared/components/ui/Badge";
import { Alert } from "@/shared/components/ui/Alert";
import { Icon } from "@/shared/components/ui/Icon";
import { HorseAvatar } from "@/features/horses/components/HorseAvatar";
import { respondHandover } from "@/features/horses/api";
import { formatDate } from "@/shared/lib/format";

interface HandoverBatchReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  handovers: Array<{
    id: string;
    token: string;
    notes?: string;
    horse: {
      id: string;
      name: string;
      horseCode: string;
      avatarUrl?: string;
      breed: string;
      gender: string;
      stallAllocations?: Array<{
        stall?: { code: string; zone?: string };
      }>;
      trainingPlans?: Array<{
        id: string;
        planCode: string;
        phaseName?: string | null;
        objective?: string | null;
        targetDistance?: number | null;
        status?: string;
        workoutSessions?: Array<{
          id: string;
          scheduledDate: string;
          workoutType?: string | null;
          distanceMeters?: number | null;
          status: string;
        }>;
      }>;
    };
    fromManager?: { id: string; fullName: string; email: string };
  }>;
  onSuccess: () => void;
}

export function HandoverBatchReviewModal({
  isOpen,
  onClose,
  handovers,
  onSuccess,
}: HandoverBatchReviewModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen || handovers.length === 0) return null;

  async function handleAcceptAll() {
    setSubmitting(true);
    setError("");
    try {
      // Xác nhận tiếp nhận toàn bộ các chiến mã được bàn giao
      await Promise.all(
        handovers.map((item) =>
          respondHandover({
            token: item.token,
            action: "ACCEPT",
          })
        )
      );

      alert(
        `✓ Đã tiếp nhận bàn giao thành công ${handovers.length} chiến mã! Bạn đã kế thừa toàn bộ giáo án và lịch tập từ 00:00 ngày mai.`
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || "Không thể hoàn tất xác nhận bàn giao.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title={`Xác Nhận Tiếp Nhận Bàn Giao Chiến Mã (${handovers.length})`}
      subtitle="Đọc và xác nhận tiếp nhận giáo án huấn luyện từ Huấn luyện viên tiền nhiệm"
      width={740}
      onClose={onClose}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {error && <Alert tone="danger">{error}</Alert>}

        <Alert tone="warn" title="Nguyên Tắc Bàn Giao & An Toàn Vận Hành">
          Các buổi tập trong ngày hôm nay vẫn do Huấn luyện viên cũ phụ trách hoàn thành. 
          Quyền điều hành giáo án và các buổi tập của bạn sẽ chính thức có hiệu lực từ <strong>00:00 ngày mai</strong>.
        </Alert>

        <div style={{ display: "flex", flexDirection: "column", gap: "14px", maxHeight: "460px", overflowY: "auto", paddingRight: "4px" }}>
          {handovers.map((req, idx) => {
            const h = req.horse;
            const stall = h.stallAllocations?.[0]?.stall;
            const plan = h.trainingPlans?.[0];
            const workouts = plan?.workoutSessions || [];

            return (
              <div
                key={req.id}
                style={{
                  border: "1px solid var(--border, #cbd5e1)",
                  borderRadius: "10px",
                  padding: "16px",
                  background: "var(--surface, #ffffff)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                {/* Header Thẻ Ngựa */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <HorseAvatar url={h.avatarUrl} name={h.name} size={46} />
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 600 }}>#{idx + 1}</span>
                        <strong style={{ fontSize: "16px", color: "var(--ink)" }}>{h.name}</strong>
                        <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>({h.horseCode})</span>
                      </div>
                      <div style={{ fontSize: "12.5px", color: "var(--brand, #2563eb)", marginTop: "2px" }}>
                        Ô chuồng: <strong>{stall?.code || "Chưa xếp"}</strong> {stall?.zone ? `· ${stall.zone}` : ""}
                        {req.fromManager && (
                          <span style={{ color: "var(--text-muted)", marginLeft: "8px" }}>
                            · Quản lý phân công: {req.fromManager.fullName}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Badge tone="ok">Chờ tiếp nhận</Badge>
                </div>

                {/* Khối Đọc Tóm Tắt Giáo Án (Plan Preview Box) */}
                <div
                  style={{
                    background: "var(--surface-sunken, #f8fafc)",
                    border: "1px solid var(--border-subtle, #e2e8f0)",
                    borderRadius: "8px",
                    padding: "12px 14px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <Icon name="file-text" size={16} />
                      <strong style={{ fontSize: "13.5px", color: "var(--ink)" }}>
                        {plan ? `${plan.planCode}: ${plan.objective || plan.phaseName}` : "Chưa có giáo án đang áp dụng"}
                      </strong>
                    </div>
                    {plan?.phaseName && (
                      <Badge tone="info">Giai đoạn: {plan.phaseName}</Badge>
                    )}
                  </div>

                  {plan && (
                    <div style={{ display: "flex", gap: "16px", fontSize: "12.5px", color: "var(--text-muted)", flexWrap: "wrap" }}>
                      <span>Cự ly mục tiêu: <strong>{plan.targetDistance ? `${plan.targetDistance.toLocaleString()} m/tuần` : "Theo bài tập"}</strong></span>
                      <span>Tần suất dự kiến: <strong>{workouts.length > 0 ? `${workouts.length} buổi sắp tới` : "3 buổi/tuần"}</strong></span>
                    </div>
                  )}

                  {/* Lịch tập dự kiến từ ngày mai */}
                  {workouts.length > 0 ? (
                    <div style={{ marginTop: "4px" }}>
                      <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-2)", marginBottom: "4px" }}>
                        Các buổi tập sắp tới từ ngày mai:
                      </div>
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                        {workouts.map((w) => (
                          <span
                            key={w.id}
                            style={{
                              fontSize: "11.5px",
                              padding: "3px 8px",
                              borderRadius: "4px",
                              background: "rgba(37, 99, 235, 0.08)",
                              color: "var(--brand, #2563eb)",
                              border: "1px solid rgba(37, 99, 235, 0.2)",
                            }}
                          >
                            📅 {formatDate(w.scheduledDate)}: {w.workoutType || "Bài tập"} {w.distanceMeters ? `(${w.distanceMeters}m)` : ""}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: "12px", color: "var(--text-muted)", fontStyle: "italic" }}>
                      Chưa có lịch tập trong những ngày tới. Bạn sẽ lập lịch tập mới sau khi tiếp nhận.
                    </div>
                  )}
                </div>

                {req.notes && (
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", fontStyle: "italic" }}>
                    💬 Ghi chú bàn giao: "{req.notes}"
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Action Button - Duy nhất 1 nút xác nhận, không có nút từ chối theo quy định */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px" }}>
          <Button
            tone="primary"
            size="lg"
            block
            onClick={handleAcceptAll}
            disabled={submitting}
          >
            <Icon name="check-circle" size={18} />
            {submitting
              ? "Đang hoàn tất tiếp nhận..."
              : `✓ Tôi đã đọc giáo án & Xác nhận tiếp nhận ${handovers.length} chiến mã`}
          </Button>
          <div style={{ textAlign: "center", fontSize: "12px", color: "var(--text-muted)" }}>
            Thao tác này là nghĩa vụ bàn giao hành chính bắt buộc của Huấn luyện viên trưởng trong Barn.
          </div>
        </div>
      </div>
    </Modal>
  );
}
