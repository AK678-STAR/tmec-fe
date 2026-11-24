import { useState, useEffect } from "react";
import { Icon } from "@/shared/components/ui/Icon";
import { getDemoDate, setDemoDate, clubParts } from "@/features/training/api";
import styles from "./DemoMagicToolkit.module.css";

function realTodayClub(): string {
  return clubParts(new Date().toISOString()).date;
}

function addDaysToYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function DemoMagicToolkit() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeDate, setActiveDate] = useState<string>(() => getDemoDate() || realTodayClub());
  const [customInputDate, setCustomInputDate] = useState<string>(() => getDemoDate() || realTodayClub());
  const [demoAmount, setDemoAmount] = useState<string>(() => {
    return localStorage.getItem("equiflow_demo_pay_amount") || "2000";
  });

  const realToday = realTodayClub();
  const isTimeShifted = Boolean(getDemoDate() && getDemoDate() !== realToday);

  useEffect(() => {
    const handleToggle = () => setIsOpen((prev) => !prev);
    const handleOpen = () => setIsOpen(true);
    const handleDateChange = () => {
      const current = getDemoDate() || realTodayClub();
      setActiveDate(current);
      setCustomInputDate(current);
    };

    window.addEventListener("equiflow_toggle_magic_toolkit", handleToggle);
    window.addEventListener("equiflow_open_magic_toolkit", handleOpen);
    window.addEventListener("equiflow_date_changed", handleDateChange);

    return () => {
      window.removeEventListener("equiflow_toggle_magic_toolkit", handleToggle);
      window.removeEventListener("equiflow_open_magic_toolkit", handleOpen);
      window.removeEventListener("equiflow_date_changed", handleDateChange);
    };
  }, []);

  const handleApplyDate = (targetDate: string | null) => {
    if (targetDate === null || targetDate === realToday) {
      setDemoDate(null);
      setActiveDate(realToday);
      setCustomInputDate(realToday);
    } else {
      setDemoDate(targetDate);
      setActiveDate(targetDate);
      setCustomInputDate(targetDate);
    }
    // Reload page to ensure all APIs, dashboards, and calculations cleanly reflect the new date
    window.location.reload();
  };

  const handleSelectAmount = (val: string) => {
    setDemoAmount(val);
    localStorage.setItem("equiflow_demo_pay_amount", val);
    window.dispatchEvent(new CustomEvent("equiflow_amount_changed", { detail: { amount: val } }));
  };

  const handleResetAll = () => {
    setDemoDate(null);
    localStorage.removeItem("equiflow_demo_pay_amount");
    setDemoAmount("2000");
    setActiveDate(realToday);
    setCustomInputDate(realToday);
    window.location.reload();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Click outside backdrop to close */}
      <div
        className={styles.backdrop}
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
      />

      {/* Control Panel */}
      <div className={styles.panel} role="dialog" aria-modal="true">
        <div className={styles.panelHeader}>
          <div className={styles.headerTitleGroup}>
            <span className={styles.headerIcon}>
              <Icon name="wrench" size={16} />
            </span>
            <h3 className={styles.headerTitle}>Nút Thần Thánh — Demo Toolkit</h3>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={() => setIsOpen(false)}
            aria-label="Đóng bảng điều khiển"
          >
            ✕
          </button>
        </div>

        <div className={styles.panelBody}>
          {/* Section 1: Time Travel */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>1. Điều chỉnh Ngày Giờ (Time Travel)</span>
              <span
                className={`${styles.currentIndicator} ${
                  isTimeShifted ? styles.currentIndicatorWarning : ""
                }`}
              >
                {isTimeShifted ? `Mô phỏng: ${activeDate}` : `Hôm nay: ${activeDate}`}
              </span>
            </div>

            <div className={styles.presetGrid}>
              <button
                type="button"
                className={`${styles.presetButton} ${!isTimeShifted ? styles.presetButtonActive : ""}`}
                onClick={() => handleApplyDate(null)}
              >
                Hôm nay (Thực tế)
              </button>
              <button
                type="button"
                className={`${styles.presetButton} ${activeDate === addDaysToYmd(realToday, 3) ? styles.presetButtonActive : ""}`}
                onClick={() => handleApplyDate(addDaysToYmd(realToday, 3))}
              >
                +3 ngày (Sắp tới giờ)
              </button>
              <button
                type="button"
                className={`${styles.presetButton} ${activeDate === addDaysToYmd(realToday, 7) ? styles.presetButtonActive : ""}`}
                onClick={() => handleApplyDate(addDaysToYmd(realToday, 7))}
              >
                +7 ngày (Chu kỳ mới)
              </button>
              <button
                type="button"
                className={`${styles.presetButton} ${activeDate === addDaysToYmd(realToday, 15) ? styles.presetButtonActive : ""}`}
                onClick={() => handleApplyDate(addDaysToYmd(realToday, 15))}
              >
                +15 ngày (Quá hạn/Nợ)
              </button>
            </div>

            <div className={styles.customDateRow}>
              <input
                type="date"
                className={styles.dateInput}
                value={customInputDate}
                onChange={(e) => setCustomInputDate(e.target.value)}
              />
              <button
                type="button"
                className={styles.applyButton}
                onClick={() => handleApplyDate(customInputDate)}
              >
                Áp dụng
              </button>
            </div>
          </div>

          {/* Section 2: PayOS Payment Amount */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>2. Số tiền Thanh toán Demo (PayOS/VietQR)</span>
              <span className={styles.currentIndicator}>
                {demoAmount === "0" ? "Gốc hóa đơn" : `${Number(demoAmount).toLocaleString("vi-VN")} đ`}
              </span>
            </div>

            <div className={styles.amountGrid}>
              <button
                type="button"
                className={`${styles.amountButton} ${demoAmount === "2000" ? styles.amountButtonActive : ""}`}
                onClick={() => handleSelectAmount("2000")}
              >
                2.000 đ (Quét App thật)
              </button>
              <button
                type="button"
                className={`${styles.amountButton} ${demoAmount === "5000" ? styles.amountButtonActive : ""}`}
                onClick={() => handleSelectAmount("5000")}
              >
                5.000 đ
              </button>
              <button
                type="button"
                className={`${styles.amountButton} ${demoAmount === "10000" ? styles.amountButtonActive : ""}`}
                onClick={() => handleSelectAmount("10000")}
              >
                10.000 đ
              </button>
              <button
                type="button"
                className={`${styles.amountButton} ${demoAmount === "0" ? styles.amountButtonActive : ""}`}
                onClick={() => handleSelectAmount("0")}
              >
                Số tiền gốc hóa đơn
              </button>
            </div>

            <div className={styles.customAmountRow}>
              <input
                type="number"
                min="1000"
                step="1000"
                className={styles.customAmountInput}
                placeholder="Nhập số tiền tùy chỉnh (VNĐ)..."
                value={demoAmount === "0" ? "" : demoAmount}
                onChange={(e) => handleSelectAmount(e.target.value || "0")}
              />
              <span className={styles.currencyUnit}>VNĐ</span>
            </div>
          </div>
        </div>

        <div className={styles.panelFooter}>
          <span>Phục vụ buổi bảo vệ & sát hạch</span>
          <button type="button" className={styles.resetAllLink} onClick={handleResetAll}>
            Khôi phục mặc định
          </button>
        </div>
      </div>
    </>
  );
}
