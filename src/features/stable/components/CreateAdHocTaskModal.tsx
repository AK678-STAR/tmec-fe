import React, { useEffect, useState } from "react";
import { Modal } from "@/shared/components/ui/Modal";
import { Button } from "@/shared/components/ui/Button";
import { Alert } from "@/shared/components/ui/Alert";
import { Select } from "@/shared/components/form/Select";
import { Field } from "@/shared/components/form/Field";
import { Textarea } from "@/shared/components/form/Textarea";
import { useToast } from "@/shared/components/ui/Toast";
import { messageFor } from "@/shared/lib/messages";
import { dailyTasksApi } from "../api/dailyTasksApi";
import { getGrooms, type GroomOption } from "../api";
import type { Stall } from "../types";

const TASK_TYPE_OPTIONS = [
  { value: "CLEANING", label: "Vệ sinh ô chuồng / Thay rơm" },
  { value: "GROOMING", label: "Chải lông / Tắm mát" },
  { value: "FEEDING", label: "Bổ sung thức ăn / Cỏ tươi" },
  { value: "WALKING", label: "Dắt đi bộ / Thả lỏng nhẹ" },
  { value: "ICE_BOOT_REST", label: "Bọc ủng lạnh / Chườm đá" },
  { value: "PHYSICAL_THERAPY", label: "Vật lý trị liệu / Xoa bóp" },
  { value: "OTHER", label: "Công việc phát sinh khác" },
];

interface CreateAdHocTaskModalProps {
  stalls: Stall[];
  defaultHorseId?: string;
  onClose: () => void;
  onDone: () => void;
}

export function CreateAdHocTaskModal({
  stalls,
  defaultHorseId,
  onClose,
  onDone,
}: CreateAdHocTaskModalProps) {
  const toast = useToast();
  const [grooms, setGrooms] = useState<GroomOption[]>([]);
  const [horseId, setHorseId] = useState<string>(defaultHorseId || "");
  const [taskType, setTaskType] = useState<string>("CLEANING");
  const [title, setTitle] = useState<string>("");
  const [scheduledTime, setScheduledTime] = useState<string>("14:00");
  const [assignedGroomUserId, setAssignedGroomUserId] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Lấy danh sách ngựa từ các ô chuồng có ngựa
  const horseList = stalls
    .filter((s) => s.allocations && s.allocations.length > 0 && s.allocations[0]?.isActive)
    .map((s) => {
      const a = s.allocations[0]!;
      return {
        id: a.horse.id,
        name: a.horse.name,
        code: a.horse.horseCode,
        stallCode: s.code,
        groomId: a.assignedGroomUserId || "",
        groomName: a.assignedGroom?.fullName || "",
      };
    });

  // Khởi tạo ngựa mặc định nếu chưa chọn
  useEffect(() => {
    if (!horseId && horseList.length > 0) {
      setHorseId(horseList[0].id);
      if (horseList[0].groomId) {
        setAssignedGroomUserId(horseList[0].groomId);
      }
    }
  }, [horseId, horseList]);

  // Khi thay đổi ngựa, tự động cập nhật Groom đang phụ trách chuồng đó
  const handleHorseChange = (newHorseId: string) => {
    setHorseId(newHorseId);
    const found = horseList.find((h) => h.id === newHorseId);
    if (found?.groomId) {
      setAssignedGroomUserId(found.groomId);
    }
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    getGrooms()
      .then((data) => {
        if (!active) return;
        setGrooms(data);
      })
      .catch((err) => {
        if (!active) return;
        setError(messageFor(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!horseId || !title.trim() || busy) return;
    setBusy(true);
    setError("");

    try {
      await dailyTasksApi.createAdHoc({
        horseId,
        taskType,
        title: title.trim(),
        scheduledTime: scheduledTime || undefined,
        assignedGroomUserId: assignedGroomUserId || undefined,
        description: description.trim() || undefined,
      });
      toast.show(`Đã thêm công việc phát sinh "${title.trim()}" thành công!`, "ok");
      onDone();
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="➕ Thêm công việc phát sinh đột xuất"
      subtitle="Chỉ định nhiệm vụ chăm sóc ngoài lịch trình thường nhật cho Groom"
      width={560}
      onClose={busy ? undefined : onClose}
      foot={
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, width: "100%" }}>
          <Button tone="ghost" disabled={busy} onClick={onClose}>
            Hủy
          </Button>
          <Button tone="primary" type="submit" form="create-adhoc-task-form" disabled={busy || !horseId || !title.trim()}>
            {busy ? "Đang lưu..." : "Lưu công việc"}
          </Button>
        </div>
      }
    >
      <form id="create-adhoc-task-form" onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
        {error && <Alert tone="danger">{error}</Alert>}

        {horseList.length === 0 ? (
          <Alert tone="warn">Không có chiến mã nào đang ở trong phân khu này để giao việc.</Alert>
        ) : (
          <>
            <Field label="Chọn chiến mã thực hiện" required>
              <Select
                value={horseId}
                onChange={(e) => handleHorseChange(e.target.value)}
                options={horseList.map((h) => ({
                  value: h.id,
                  label: `${h.name} (${h.code}) · Ô ${h.stallCode}${h.groomName ? ` - Groom: ${h.groomName}` : ""}`,
                }))}
              />
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Phân loại công việc" required>
                <Select
                  value={taskType}
                  onChange={(e) => setTaskType(e.target.value)}
                  options={TASK_TYPE_OPTIONS}
                />
              </Field>

              <Field label="Khung giờ dự kiến (HH:mm)">
                <input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  style={{
                    width: "100%",
                    height: 38,
                    borderRadius: "var(--r)",
                    border: "1px solid var(--border)",
                    padding: "0 10px",
                    background: "var(--surface)",
                    color: "var(--text)",
                    fontSize: "var(--fs-body)",
                  }}
                />
              </Field>
            </div>

            <Field label="Tiêu đề công việc" required>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="VD: Thay rơm và làm sạch khay nước sau buổi tập..."
                maxLength={200}
                style={{
                  width: "100%",
                  height: 38,
                  borderRadius: "var(--r)",
                  border: "1px solid var(--border)",
                  padding: "0 10px",
                  background: "var(--surface)",
                  color: "var(--text)",
                  fontSize: "var(--fs-body)",
                }}
              />
            </Field>

            <Field label="Groom phụ trách (Mặc định: Groom quản lý ô chuồng)">
              <Select
                value={assignedGroomUserId}
                onChange={(e) => setAssignedGroomUserId(e.target.value)}
                options={[
                  { value: "", label: "-- Tự động gán cho Groom quản lý chuồng --" },
                  ...grooms.map((g) => ({
                    value: g.id,
                    label: `${g.fullName} (${g.horseCount}/6 ô chuồng)`,
                  })),
                ]}
              />
            </Field>

            <Field label="Mô tả / Yêu cầu chi tiết">
              <Textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ghi chú chi tiết cho Groom (VD: Chú ý chân sau bên phải, kiểm tra kỹ xem có bị sưng không...)"
                maxLength={500}
              />
            </Field>
          </>
        )}
      </form>
    </Modal>
  );
}
