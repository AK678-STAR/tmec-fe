import { DemoDataChatPanel } from "@/features/demo-data/DemoDataChatPanel";
import { useAuth } from "@/shared/components/layout/AuthProvider";
import { useState, useEffect } from "react";
import { Icon } from "@/shared/components/ui/Icon";
import { getDemoDate, setDemoDate, clubParts } from "@/features/training/api";
import { login } from "@/shared/lib/auth";
import styles from "./DemoMagicToolkit.module.css";

function realTodayClub(): string {
  return clubParts(new Date().toISOString()).date;
}

function addDaysToYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const DEMO_ACCOUNTS = [
  {
    role: "Quản lý CLB",
    roleKey: "CLUB_MANAGER",
    name: "Trần Quang Minh",
    email: "manager@gmail.com",
    icon: "shield",
    defaultPath: "/dashboard",
  },
  {
    role: "HLV Trưởng",
    roleKey: "HEAD_TRAINER",
    name: "Nguyễn Văn Tuấn",
    email: "trainer@gmail.com",
    icon: "activity",
    defaultPath: "/training/plans",
  },
  {
    role: "Bác sĩ Thú y",
    roleKey: "VETERINARIAN",
    name: "BS. Phạm Minh Trí",
    email: "vet@gmail.com",
    icon: "heart",
    defaultPath: "/records",
  },
  {
    role: "Chăm sóc (Groom)",
    roleKey: "GROOM",
    name: "Phạm Văn Chăm",
    email: "groom@gmail.com",
    icon: "user",
    defaultPath: "/stable/my-shift",
  },
  {
    role: "Chủ ngựa",
    roleKey: "HORSE_OWNER",
    name: "Trịnh Bích Ngọc",
    email: "owner@gmail.com",
    icon: "file",
    defaultPath: "/financial-reports",
  },
];

const DEMO_SCENARIOS = [
  {
    id: "payos-qr",
    title: "1. Chủ ngựa Quét PayOS / VietQR (2.000đ)",
    desc: "Mở Hóa đơn để demo quét QR thanh toán thật qua app ngân hàng hoặc giả lập.",
    run: async (
      switchAccount: (email: string, path: string) => Promise<void>,
    ) => {
      localStorage.setItem("equiflow_demo_pay_amount", "2000");
      setDemoDate(null);
      await switchAccount("owner@gmail.com", "/financial-reports");
    },
  },
  {
    id: "overdue-debt",
    title: "2. Tình huống Quá hạn & Khóa Nợ (isDebtImpounded)",
    desc: "Tua +15 ngày (quá hạn 7 ngày): kích hoạt phong tỏa ngựa, chỉ tính phí lưu chuồng.",
    run: async (
      switchAccount: (email: string, path: string) => Promise<void>,
    ) => {
      const futureDate = addDaysToYmd(realTodayClub(), 15);
      setDemoDate(futureDate);
      await switchAccount("owner@gmail.com", "/financial-reports");
    },
  },
  {
    id: "head-trainer-groom",
    title: "3. Phối hợp Lịch HLV Trưởng & Groom",
    desc: "Vào Ma trận Lịch tuần: HLV Trưởng phân bài tập khớp ca trực chuồng của Groom.",
    run: async (
      switchAccount: (email: string, path: string) => Promise<void>,
    ) => {
      await switchAccount("trainer@gmail.com", "/staff/schedule");
    },
  },
  {
    id: "vet-medical-lock",
    title: "4. Bác sĩ Thú y Khóa Y tế & Bệnh án",
    desc: "Mở Bệnh án & Khóa y tế: BS khám, kê đơn thuốc và khóa huấn luyện để dưỡng thương.",
    run: async (
      switchAccount: (email: string, path: string) => Promise<void>,
    ) => {
      await switchAccount("vet@gmail.com", "/records");
    },
  },
];

export function DemoMagicToolkit() {
  const { user } = useAuth();
  const [chatOpen, setChatOpen] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState<string | null>(null);
  const [activeDate, setActiveDate] = useState<string>(
    () => getDemoDate() || realTodayClub(),
  );
  const [customInputDate, setCustomInputDate] = useState<string>(
    () => getDemoDate() || realTodayClub(),
  );
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
    window.dispatchEvent(
      new CustomEvent("equiflow_amount_changed", { detail: { amount: val } }),
    );
  };

  const handleResetAll = () => {
    setDemoDate(null);
    localStorage.removeItem("equiflow_demo_pay_amount");
    setDemoAmount("2000");
    setActiveDate(realToday);
    setCustomInputDate(realToday);
    window.location.reload();
  };

  const handleSwitchAccount = async (email: string, targetPath: string) => {
    try {
      setIsSwitching(email);
      await login(email, "EquiFlow@2026", true);
      window.location.href = targetPath;
    } catch (err: unknown) {
      alert(
        "Đăng nhập chuyển vai trò thất bại: " +
          (err instanceof Error ? err.message : String(err)),
      );
      setIsSwitching(null);
    }
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
            <h3 className={styles.headerTitle}>
              Nút Thần Thánh — Demo Toolkit
            </h3>
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
          {import.meta.env.DEV && user?.role === "CLUB_MANAGER" && (
            <div className={styles.section}>
              <button
                type="button"
                className={styles.presetButton}
                aria-expanded={chatOpen}
                onClick={() => setChatOpen((value) => !value)}
              >
                Trợ lý tạo dữ liệu mẫu
              </button>
              {chatOpen && (
                <DemoDataChatPanel
                  key={user.id}
                  actorId={user.id}
                  timeShifted={isTimeShifted}
                />
              )}
            </div>
          )}
          {/* Section 1: Time Travel */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>
                1. Điều chỉnh Ngày Giờ (Time Travel)
              </span>
              <span
                className={`${styles.currentIndicator} ${
                  isTimeShifted ? styles.currentIndicatorWarning : ""
                }`}
              >
                {isTimeShifted
                  ? `Mô phỏng: ${activeDate}`
                  : `Hôm nay: ${activeDate}`}
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
              <span className={styles.sectionTitle}>
                2. Số tiền Thanh toán Demo (PayOS/VietQR)
              </span>
              <span className={styles.currentIndicator}>
                {demoAmount === "0"
                  ? "Gốc hóa đơn"
                  : `${Number(demoAmount).toLocaleString("vi-VN")} đ`}
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

          {/* Section 3: Quick Role Switcher */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>
                3. Đổi Nhanh Vai Trò (1-Click Switch Role)
              </span>
              <span className={styles.currentIndicator}>
                {isSwitching
                  ? `Đang vào: ${isSwitching}…`
                  : "5 tài khoản chuẩn"}
              </span>
            </div>

            <div className={styles.accountGrid}>
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  className={styles.accountButton}
                  onClick={() =>
                    handleSwitchAccount(acc.email, acc.defaultPath)
                  }
                  disabled={Boolean(isSwitching)}
                >
                  <span className={styles.accountRole}>
                    <Icon name={acc.icon} size={13} />
                    {acc.role}
                  </span>
                  <span className={styles.accountName}>
                    {acc.name} ({acc.email.split("@")[0]})
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Section 4: Use Case Scenarios */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>
                4. Kịch Bản Usecase Tình Huống (1-Click Demo)
              </span>
              <span className={styles.currentIndicator}>Chuẩn bị sẵn</span>
            </div>

            <div className={styles.usecaseList}>
              {DEMO_SCENARIOS.map((sc) => (
                <button
                  key={sc.id}
                  type="button"
                  className={styles.usecaseCard}
                  onClick={() => sc.run(handleSwitchAccount)}
                  disabled={Boolean(isSwitching)}
                >
                  <div className={styles.usecaseTextGroup}>
                    <span className={styles.usecaseTitle}>{sc.title}</span>
                    <span className={styles.usecaseDesc}>{sc.desc}</span>
                  </div>
                  <span className={styles.usecaseArrow}>→</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.panelFooter}>
          <span>Phục vụ buổi bảo vệ & sát hạch</span>
          <button
            type="button"
            className={styles.resetAllLink}
            onClick={handleResetAll}
          >
            Khôi phục mặc định
          </button>
        </div>
      </div>
    </>
  );
}
