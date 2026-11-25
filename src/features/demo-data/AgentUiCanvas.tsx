import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/shared/components/ui/Button";
import { Icon } from "@/shared/components/ui/Icon";
import { login } from "@/shared/lib/auth";
import type {
  AgentRoleKey,
  AgentUiBlock,
  DemoContext,
  DemoReceipt,
  DemoScenario,
} from "./demo-data.types";
import styles from "./AgentUiCanvas.module.css";

const ROLE_SWITCH_META: Record<
  AgentRoleKey,
  { label: string; email: string; path: string; icon: string }
> = {
  CLUB_MANAGER: {
    label: "Quản lý CLB",
    email: "manager@gmail.com",
    path: "/dashboard",
    icon: "shield",
  },
  HEAD_TRAINER: {
    label: "HLV Trưởng",
    email: "trainer@gmail.com",
    path: "/training/plans",
    icon: "activity",
  },
  VETERINARIAN: {
    label: "Bác sĩ Thú y",
    email: "vet@gmail.com",
    path: "/records",
    icon: "heart",
  },
  GROOM: {
    label: "Chăm sóc (Groom)",
    email: "groom@gmail.com",
    path: "/stable/my-shift",
    icon: "user",
  },
  HORSE_OWNER: {
    label: "Chủ ngựa",
    email: "owner@gmail.com",
    path: "/financial-reports",
    icon: "file",
  },
};

const RECORD_LABELS: Record<string, string> = {
  Horse: "Chiến mã",
  HorseAdmissionRecord: "Hồ sơ tiếp nhận",
  AdmissionHistoryLog: "Nhật ký tiếp nhận",
  StallAllocation: "Phân bổ ô chuồng",
  TrainingPlan: "Giáo án mẫu",
  WorkoutSession: "Buổi tập hoàn thành",
  MedicalRecord: "Bệnh án đã đóng",
  InjuryLog: "Nhật ký chấn thương đã lành",
  MedicalLock: "Khóa y tế đã gỡ",
  Tournament: "Giải đấu mở đăng ký",
};

export function AgentUiCanvas({
  blocks,
  context,
  receipt,
  ownerId,
  onSelectOwner,
  activeDate,
  realToday,
  busy,
  onQuickTimeJump,
  onSubmitHorseForm,
  onReloadPage,
}: {
  blocks: AgentUiBlock[];
  context: DemoContext | null;
  receipt: DemoReceipt | null;
  ownerId: string;
  onSelectOwner: (id: string) => void;
  activeDate: string | null;
  realToday: string;
  busy: boolean;
  onQuickTimeJump: (days: number | null) => void;
  onSubmitHorseForm: (scenario: DemoScenario, horseName: string) => void;
  onReloadPage: () => void;
}) {
  const [formScenario, setFormScenario] =
    useState<DemoScenario>("ADMISSION_PENDING");
  const [formHorseName, setFormHorseName] = useState("");
  const [switchingRole, setSwitchingRole] = useState<string | null>(null);

  const handleRoleSwitch = async (roleKey: AgentRoleKey) => {
    const meta = ROLE_SWITCH_META[roleKey];
    try {
      setSwitchingRole(roleKey);
      await login(meta.email, "EquiFlow@2026", true);
      window.location.href = meta.path;
    } catch {
      setSwitchingRole(null);
    }
  };

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!formHorseName.trim() || !ownerId || busy) return;
    onSubmitHorseForm(formScenario, formHorseName.trim());
  };

  if (blocks.length === 0 && !receipt) {
    return (
      <div className={styles.canvasEmpty}>
        <div className={styles.canvasEmptyIcon}>
          <Icon name="sparkles" size={20} />
        </div>
        <h5 className={styles.canvasEmptyTitle}>
          Agent UI Canvas (Tạo dữ liệu &amp; Thời gian)
        </h5>
        <p className={styles.canvasEmptyDesc}>
          Hãy trò chuyện ở cột bên trái. AI sẽ thực thi hành động và tự dựng
          các thẻ giao diện tương tác ở đây (thẻ tua ngày, form tạo ngựa, biên
          nhận &amp; chuyển vai nhanh).
        </p>
        <div className={styles.canvasQuickSummary}>
          <span>
            <Icon name="calendar" size={13} />{" "}
            {activeDate ? `Đang giả lập: ${activeDate}` : `Hôm nay: ${realToday}`}
          </span>
          <span>
            <Icon name="home" size={13} /> Ô chuồng trống:{" "}
            {context?.availableStalls ?? "—"}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.canvasStack}>
      {blocks.map((block, index) => {
        if (block.type === "TIME_TRAVEL") {
          return (
            <section key={`tt-${index}`} className={styles.canvasCard}>
              <div className={styles.canvasCardHead}>
                <span className={styles.canvasCardTitle}>
                  <Icon name="clock" size={14} />
                  {block.title}
                </span>
                <span className={styles.canvasPill}>
                  {activeDate ? `Giả lập: ${activeDate}` : `Thực tế: ${realToday}`}
                </span>
              </div>
              {block.note && (
                <p className={styles.canvasCardNote}>{block.note}</p>
              )}
              <div className={styles.canvasBtnRow}>
                <Button
                  size="sm"
                  tone="secondary"
                  onClick={() => onQuickTimeJump(null)}
                >
                  Hôm nay
                </Button>
                <Button
                  size="sm"
                  tone="secondary"
                  onClick={() => onQuickTimeJump(3)}
                >
                  +3 ngày
                </Button>
                <Button
                  size="sm"
                  tone="secondary"
                  onClick={() => onQuickTimeJump(7)}
                >
                  +7 ngày
                </Button>
                <Button
                  size="sm"
                  tone="secondary"
                  onClick={() => onQuickTimeJump(15)}
                >
                  +15 ngày
                </Button>
                <Button
                  size="sm"
                  tone="secondary"
                  onClick={() => onQuickTimeJump(30)}
                >
                  +30 ngày
                </Button>
                <Button size="sm" onClick={onReloadPage}>
                  Tải lại màn hình
                </Button>
              </div>
            </section>
          );
        }

        if (block.type === "HORSE_FORM") {
          return (
            <section key={`hf-${index}`} className={styles.canvasCard}>
              <div className={styles.canvasCardHead}>
                <span className={styles.canvasCardTitle}>
                  <Icon name="plus" size={14} />
                  {block.title}
                </span>
              </div>
              {block.note && (
                <p className={styles.canvasCardNote}>{block.note}</p>
              )}
              <form onSubmit={handleFormSubmit} className={styles.canvasForm}>
                <select
                  className={styles.canvasInput}
                  value={ownerId}
                  onChange={(e) => onSelectOwner(e.target.value)}
                  disabled={busy}
                >
                  <option value="">Chọn chủ ngựa đang hoạt động</option>
                  {context?.owners.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.fullName}
                    </option>
                  ))}
                </select>
                <select
                  className={styles.canvasInput}
                  value={formScenario}
                  onChange={(e) =>
                    setFormScenario(e.target.value as DemoScenario)
                  }
                  disabled={busy}
                >
                  <option value="ADMISSION_PENDING">
                    Ngựa chờ tiếp nhận (ADMISSION_PENDING)
                  </option>
                  <option value="RACE_READY">
                    Ngựa sẵn sàng thi đấu (RACE_READY)
                  </option>
                </select>
                <input
                  type="text"
                  className={styles.canvasInput}
                  placeholder="Nhập tên chiến mã (vd: Bạch Phong)"
                  value={formHorseName}
                  onChange={(e) => setFormHorseName(e.target.value)}
                  disabled={busy}
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={busy || !ownerId || formHorseName.trim().length < 2}
                >
                  Tạo bộ mẫu ngay
                </Button>
              </form>
            </section>
          );
        }

        if (block.type === "RECEIPT" && receipt) {
          return (
            <section key={`rc-${index}`} className={styles.canvasReceipt}>
              <div className={styles.canvasCardHead}>
                <span className={styles.canvasCardTitle}>
                  <Icon name="checkCircle" size={14} />
                  {block.title}
                </span>
                <span className={styles.canvasPill}>{receipt.scenario}</span>
              </div>
              <small className={styles.canvasCode}>
                Mã: {receipt.generationId}
              </small>
              <ul className={styles.canvasList}>
                {receipt.records.map((record) => (
                  <li key={record.entity}>
                    {RECORD_LABELS[record.entity] ?? record.entity}:{" "}
                    {record.ids.length} bản ghi
                  </li>
                ))}
              </ul>
              <div className={styles.canvasBtnRow}>
                {receipt.links
                  .filter((link) =>
                    /^\/(horses(\/[a-z0-9-]+)?|races)$/i.test(link.path),
                  )
                  .map((link) => (
                    <Link
                      key={link.path}
                      to={link.path}
                      className={styles.canvasLinkBtn}
                    >
                      {link.label} <Icon name="arrowRight" size={13} />
                    </Link>
                  ))}
              </div>
            </section>
          );
        }

        if (block.type === "QUICK_SWITCH") {
          return (
            <section key={`qs-${index}`} className={styles.canvasCard}>
              <div className={styles.canvasCardHead}>
                <span className={styles.canvasCardTitle}>
                  <Icon name="users" size={14} />
                  {block.title}
                </span>
              </div>
              {block.note && (
                <p className={styles.canvasCardNote}>{block.note}</p>
              )}
              <div className={styles.canvasBtnRow}>
                {block.roles.map((rKey) => {
                  const meta = ROLE_SWITCH_META[rKey];
                  if (!meta) return null;
                  return (
                    <Button
                      key={rKey}
                      size="sm"
                      tone="secondary"
                      disabled={Boolean(switchingRole)}
                      onClick={() => void handleRoleSwitch(rKey)}
                    >
                      <Icon name={meta.icon} size={13} /> {meta.label}
                    </Button>
                  );
                })}
              </div>
            </section>
          );
        }

        if (block.type === "NOTICE") {
          return (
            <section
              key={`nt-${index}`}
              className={
                block.tone === "warn"
                  ? styles.canvasNoticeWarn
                  : styles.canvasNotice
              }
            >
              <strong>{block.title}</strong>
              <p className={styles.canvasCardNote}>{block.message}</p>
            </section>
          );
        }

        return null;
      })}
    </div>
  );
}
