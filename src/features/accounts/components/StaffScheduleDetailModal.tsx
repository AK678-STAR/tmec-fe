import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Modal } from "@/shared/components/ui/Modal";
import { Button } from "@/shared/components/ui/Button";
import { Badge } from "@/shared/components/ui/Badge";
import { Avatar } from "@/shared/components/ui/Avatar";
import { Icon } from "@/shared/components/ui/Icon";
import { Alert } from "@/shared/components/ui/Alert";
import { tr } from "@/shared/i18n/tr";
import { useAppLanguage } from "@/shared/lib/language";
import { ROLE_LABEL } from "@/shared/lib/permissions";
import { getActiveAssignments, type ActiveAssignmentsResponse } from "../api";
import type { PublicAccount } from "@/shared/types/auth";
import styles from "./StaffScheduleDetailModal.module.css";

interface StaffScheduleDetailModalProps {
  account: PublicAccount;
  onClose: () => void;
}

export function StaffScheduleDetailModal({ account, onClose }: StaffScheduleDetailModalProps) {
  const { isVietnamese } = useAppLanguage();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ActiveAssignmentsResponse | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    getActiveAssignments(account.id)
      .then((res) => {
        if (active) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err?.message || (isVietnamese ? "Không thể tải dữ liệu phân công." : "Could not load assignments."));
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [account.id, isVietnamese]);

  const isGroom = account.role === "GROOM";
  const isTrainer = account.role === "HEAD_TRAINER";
  const isVet = account.role === "VETERINARIAN";

  const hasAnyData =
    (data?.stalls.length ?? 0) > 0 ||
    (data?.workouts.length ?? 0) > 0 ||
    (data?.shifts.length ?? 0) > 0 ||
    (data?.plans.length ?? 0) > 0;

  return (
    <Modal
      title={isVietnamese ? `Lịch làm việc: ${account.fullName}` : `Work Schedule: ${account.fullName}`}
      subtitle={`${tr(ROLE_LABEL[account.role])} · ${account.email}`}
      width={640}
      onClose={onClose}
      foot={
        <>
          <Button tone="ghost" onClick={onClose}>
            {tr("Close")}
          </Button>
          <Button
            tone="primary"
            icon="calendar"
            onClick={() => {
              onClose();
              navigate("/staff/schedule");
            }}
          >
            {isVietnamese ? "Mở ma trận tuần đầy đủ ↗" : "Open Full Schedule Matrix ↗"}
          </Button>
        </>
      }
    >
      <div className={styles.container}>
        {/* Profile Card Summary */}
        <div className={styles.profileCard}>
          <div className={styles.profileInfo}>
            <Avatar name={account.fullName} url={account.avatarUrl} size={40} />
            <div className={styles.profileText}>
              <div className={styles.profileName}>{account.fullName}</div>
              <div className={styles.profileMeta}>
                {tr(ROLE_LABEL[account.role])} {account.phone ? `· ${account.phone}` : ""}
              </div>
            </div>
          </div>
          <Badge tone={account.status === "ACTIVE" ? "ok" : "neutral"}>
            {account.status === "ACTIVE"
              ? isVietnamese
                ? "Đang hoạt động"
                : "Active"
              : account.status}
          </Badge>
        </div>

        {error && (
          <Alert tone="danger">
            {error}
          </Alert>
        )}

        {loading ? (
          <div className={styles.loadingBox}>
            <Icon name="spinner" className={styles.spinIcon} inline size={18} />
            <span>{isVietnamese ? "Đang tải lịch làm việc & phân công..." : "Loading assignments..."}</span>
          </div>
        ) : !hasAnyData ? (
          <div className={styles.emptyAll}>
            <Icon name="calendar" size={36} />
            <div style={{ fontWeight: 600, fontSize: "14px" }}>
              {isVietnamese ? "Chưa có phân công hoặc ca trực sắp tới" : "No active assignments or upcoming shifts"}
            </div>
            <div style={{ fontSize: "12px" }}>
              {isVietnamese
                ? "Nhân sự này hiện không có ô chuồng, giáo án hay ca trực nào cần xử lý dở dang."
                : "This staff member has no active stalls, training plans, or scheduled shifts."}
            </div>
          </div>
        ) : (
          <>
            {/* Phân hệ GROOM: Ô chuồng phụ trách */}
            {isGroom && (
              <div className={styles.sectionGroup}>
                <div className={styles.sectionHeader}>
                  <h4 className={styles.sectionTitle}>
                    <Icon name="home" size={14} />
                    {isVietnamese ? "Ô chuồng phụ trách" : "Assigned Stalls"} ({data?.stalls.length ?? 0}/6)
                  </h4>
                  <span className={styles.badgeSmall}>
                    {data?.stalls.length ?? 0}/6 {isVietnamese ? "ô chuồng" : "stalls"}
                  </span>
                </div>
                {(data?.stalls.length ?? 0) === 0 ? (
                  <div className={styles.emptySection}>
                    {isVietnamese ? "Chưa được gán phụ trách ô chuồng nào." : "No stalls assigned."}
                  </div>
                ) : (
                  <div className={styles.cardsGrid}>
                    {data?.stalls.map((s) => (
                      <div key={s.id} className={styles.itemCard}>
                        <div className={styles.itemMain}>
                          <span>{s.horse?.name || (isVietnamese ? "Ô trống" : "Empty stall")}</span>
                          <span className={styles.badgeZone}>{s.stall?.code || "—"}</span>
                        </div>
                        <div className={styles.itemSub}>
                          <span>{s.stall?.zone || "Barn"}</span>
                          {s.horse?.horseCode && <span>· {s.horse.horseCode}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Phân hệ GROOM: Ca trực sắp tới */}
            {isGroom && (
              <div className={styles.sectionGroup}>
                <div className={styles.sectionHeader}>
                  <h4 className={styles.sectionTitle}>
                    <Icon name="clock" size={14} />
                    {isVietnamese ? "Ca trực sắp tới (7 ngày tới)" : "Upcoming Shifts"} ({data?.shifts.length ?? 0})
                  </h4>
                </div>
                {(data?.shifts.length ?? 0) === 0 ? (
                  <div className={styles.emptySection}>
                    {isVietnamese ? "Chưa có ca trực nào trong 7 ngày tới." : "No upcoming shifts in the next 7 days."}
                  </div>
                ) : (
                  <div className={styles.cardsGrid}>
                    {data?.shifts.map((sh) => {
                      const dateObj = new Date(sh.date);
                      const d = String(dateObj.getDate()).padStart(2, "0");
                      const m = String(dateObj.getMonth() + 1).padStart(2, "0");
                      const y = dateObj.getFullYear();
                      const dateStr = `${d}/${m}/${y}`;
                      const timeStr = sh.shift?.startTime && sh.shift?.endTime
                        ? `${sh.shift.startTime.slice(0, 5)} - ${sh.shift.endTime.slice(0, 5)}`
                        : "";
                      return (
                        <div key={sh.id} className={styles.itemCard}>
                          <div className={styles.itemMain}>
                            <span>{sh.shift?.name || (isVietnamese ? "Ca trực" : "Shift")}</span>
                            <span className={styles.badgeZone}>{sh.zone?.name || "Barn"}</span>
                          </div>
                          <div className={styles.itemSub}>
                            <span>📅 {dateStr}</span>
                            {timeStr && <span>· ⏰ {timeStr}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Phân hệ HUẤN LUYỆN VIÊN: Giáo án đang phụ trách */}
            {isTrainer && (
              <div className={styles.sectionGroup}>
                <div className={styles.sectionHeader}>
                  <h4 className={styles.sectionTitle}>
                    <Icon name="file" size={14} />
                    {isVietnamese ? "Giáo án đang phụ trách" : "Active Training Plans"} ({data?.plans.length ?? 0}/6)
                  </h4>
                  <span className={styles.badgeSmall}>
                    {data?.plans.length ?? 0}/6 {isVietnamese ? "ngựa" : "horses"}
                  </span>
                </div>
                {(data?.plans.length ?? 0) === 0 ? (
                  <div className={styles.emptySection}>
                    {isVietnamese ? "Chưa có giáo án đang hoạt động." : "No active training plans."}
                  </div>
                ) : (
                  <div className={styles.cardsGrid}>
                    {data?.plans.map((p) => (
                      <div key={p.id} className={styles.itemCard}>
                        <div className={styles.itemMain}>
                          <span>{p.horse?.name || (isVietnamese ? "Chiến mã" : "Horse")}</span>
                          <span className={styles.badgeZone}>{p.planCode || "DRAFT"}</span>
                        </div>
                        <div className={styles.itemSub}>
                          <span>{p.phaseName}</span>
                          {p.horse?.id && <span>· Mã: {p.horse.id.slice(0, 8)}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Phân hệ HUẤN LUYỆN VIÊN: Buổi tập sắp tới */}
            {isTrainer && (
              <div className={styles.sectionGroup}>
                <div className={styles.sectionHeader}>
                  <h4 className={styles.sectionTitle}>
                    <Icon name="calendar" size={14} />
                    {isVietnamese ? "Buổi tập sắp diễn ra" : "Upcoming Workouts"} ({data?.workouts.length ?? 0})
                  </h4>
                </div>
                {(data?.workouts.length ?? 0) === 0 ? (
                  <div className={styles.emptySection}>
                    {isVietnamese ? "Chưa có buổi tập nào được lên lịch." : "No scheduled workouts."}
                  </div>
                ) : (
                  <div className={styles.cardsGrid}>
                    {data?.workouts.map((w) => {
                      const dt = new Date(w.scheduledDate);
                      const d = String(dt.getDate()).padStart(2, "0");
                      const m = String(dt.getMonth() + 1).padStart(2, "0");
                      const h = String(dt.getHours()).padStart(2, "0");
                      const min = String(dt.getMinutes()).padStart(2, "0");
                      return (
                        <div key={w.id} className={styles.itemCard}>
                          <div className={styles.itemMain}>
                            <span>{w.workoutType} · {w.horse?.name}</span>
                            <span className={styles.badgeSmall}>{w.intensity}</span>
                          </div>
                          <div className={styles.itemSub}>
                            <span>⏰ {h}:{min} {d}/{m}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Phân hệ BÁC SĨ THÚ Y (nếu có ca trực) */}
            {isVet && (data?.shifts.length ?? 0) > 0 && (
              <div className={styles.sectionGroup}>
                <div className={styles.sectionHeader}>
                  <h4 className={styles.sectionTitle}>
                    <Icon name="clock" size={14} />
                    {isVietnamese ? "Ca trực y tế sắp tới" : "Upcoming Medical Shifts"}
                  </h4>
                </div>
                <div className={styles.cardsGrid}>
                  {data?.shifts.map((sh) => (
                    <div key={sh.id} className={styles.itemCard}>
                      <div className={styles.itemMain}>
                        <span>{sh.shift?.name}</span>
                        <span className={styles.badgeZone}>{sh.zone?.name}</span>
                      </div>
                      <div className={styles.itemSub}>
                        <span>📅 {new Date(sh.date).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
