import { useState, useEffect } from "react";
import { Icon } from "@/shared/components/ui/Icon";
import { useCurrentUser } from "@/shared/components/layout/AuthProvider";
import { AssistantChat } from "@/shared/components/mascot/AssistantChat";
import { ENABLE_AI_ASSISTANT } from "@/shared/lib/featureFlags";
import { tr } from "@/shared/i18n/tr";
import styles from "./CustomerCareWidget.module.css";

type TabKey = "zalo" | "phone" | "email" | "ai";

const HOTLINE_DISPLAY = "0983.989.059";
const HOTLINE_TEL = "tel:0983989059";
const ZALO_URL = "https://zalo.me/0983989059";
const EMAIL_SUPPORT = "support@tmec.site";
const EMAIL_MAILTO = "mailto:support@tmec.site";

export function CustomerCareWidget() {
  const currentUser = useCurrentUser();
  const [isOpen, setIsOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("zalo");

  // Track scroll position to show/hide ScrollToTop button (> 300px)
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Initial check

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const handleScrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <>
      {/* Floating Action Buttons (FAB Cluster) */}
      <div className={styles.fabCluster} aria-label="Customer Care & Support">
        {/* Nút cuộn về đầu trang (ScrollToTop) */}
        {showScrollTop && (
          <button
            type="button"
            className={styles.scrollTopBtn}
            onClick={handleScrollToTop}
            aria-label={tr("Scroll to top")}
            title={tr("Scroll to top")}
          >
            <Icon name="chevronUp" size={20} />
          </button>
        )}

        {/* Nút kích hoạt hỗ trợ (CustomerCareToggle) */}
        <div className={styles.careToggleWrapper}>
          {!isOpen && <div className={styles.pingWave} aria-hidden="true" />}
          <button
            type="button"
            className={`${styles.careToggleBtn} ${isOpen ? styles.careToggleBtnOpen : ""}`}
            onClick={() => setIsOpen((prev) => !prev)}
            aria-expanded={isOpen}
            aria-label={isOpen ? tr("Close support") : tr("Open support channels")}
            title={isOpen ? tr("Close support") : tr("Contact TMEC Club Support")}
          >
            {isOpen ? <Icon name="x" size={22} /> : <Icon name="phone" size={22} />}
          </button>
        </div>
      </div>

      {/* Floating Contact Card (Hộp thoại Hỗ trợ Đa kênh) */}
      {isOpen && (
        <div
          className={styles.contactCard}
          role="dialog"
          aria-modal="false"
          aria-labelledby="customer-care-title"
        >
          {/* Header */}
          <div className={styles.cardHeader}>
            <div>
              <h2 id="customer-care-title" className={styles.cardTitle}>
                {tr("Contact TMEC Club Support")}
              </h2>
              <div className={styles.cardSubtitle}>
                {tr("Online 24/7 · Owner Support & Horse Admission")}
              </div>
            </div>
            <button
              type="button"
              className={styles.closeBtn}
              onClick={() => setIsOpen(false)}
              aria-label={tr("Close")}
            >
              <Icon name="x" size={16} />
            </button>
          </div>

          {/* Body: 3 Departments or AI view */}
          {ENABLE_AI_ASSISTANT && activeTab === "ai" ? (
            <div className={styles.aiContainer}>
              {currentUser ? (
                <AssistantChat
                  role={currentUser.role || "HORSE_OWNER"}
                  variant="panel"
                />
              ) : (
                <div style={{ padding: "32px 20px", textAlign: "center", color: "var(--color-text-muted)" }}>
                  <Icon name="sparkles" size={32} style={{ margin: "0 auto 12px auto", color: "#0088cc" }} />
                  <p style={{ margin: "0 0 8px 0", fontWeight: 600, color: "var(--color-text)" }}>
                    {tr("AI Assistant")}
                  </p>
                  <p style={{ fontSize: "13px", margin: 0 }}>
                    {tr("Online 24/7 · Owner Support & Horse Admission")}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className={styles.cardBody}>
              {/* 3 Departments */}
              <div className={styles.departmentsList}>
                <div className={styles.deptItem}>
                  <div className={styles.deptIcon}>
                    <Icon name="shield" size={18} />
                  </div>
                  <div className={styles.deptContent}>
                    <span className={styles.deptName}>{tr("Admission & Legal Department")}</span>
                    <span className={styles.deptDesc}>
                      {tr("Guidance on admission, ISO microchip check, rescheduling Gate A appointments.")}
                    </span>
                  </div>
                </div>

                <div className={styles.deptItem}>
                  <div className={styles.deptIcon}>
                    <Icon name="stethoscope" size={18} />
                  </div>
                  <div className={styles.deptContent}>
                    <span className={styles.deptName}>{tr("Veterinary & Health Department")}</span>
                    <span className={styles.deptDesc}>
                      {tr("Mandatory vaccination advice, quarantine check, medical lock inquiries.")}
                    </span>
                  </div>
                </div>

                <div className={styles.deptItem}>
                  <div className={styles.deptIcon}>
                    <Icon name="grid" size={18} />
                  </div>
                  <div className={styles.deptContent}>
                    <span className={styles.deptName}>{tr("Training & Barn Stabling Department")}</span>
                    <span className={styles.deptDesc}>
                      {tr("Zone selection (Zone A, B, C), nutrition plans, workout schedules upon admission.")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Standardized Contact Info */}
              <div className={styles.contactOverview}>
                <div className={styles.contactOverviewItem}>
                  <span className={styles.contactOverviewLabel}>{tr("Hotline / Zalo")}</span>
                  <span className={styles.contactOverviewValue}>{HOTLINE_DISPLAY}</span>
                </div>
                <div className={styles.contactOverviewItem}>
                  <span className={styles.contactOverviewLabel}>{tr("Support Email")}</span>
                  <span className={styles.contactOverviewValue}>{EMAIL_SUPPORT}</span>
                </div>
              </div>
            </div>
          )}

          {/* Tab content action panel (for non-AI tabs) */}
          {activeTab !== "ai" && (
            <div className={styles.tabContentPanel}>
              {activeTab === "zalo" && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
                  <div style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
                    {tr("Message directly via Zalo to TMEC Admission Team:")}
                  </div>
                  <a
                    href={ZALO_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${styles.actionButton} ${styles.actionButtonPrimary}`}
                  >
                    <Icon name="send" size={14} />
                    {tr("Message via Zalo")}
                  </a>
                </div>
              )}

              {activeTab === "phone" && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text)" }}>
                    {tr("Direct hotline:")} {HOTLINE_DISPLAY}
                  </div>
                  <a
                    href={HOTLINE_TEL}
                    className={`${styles.actionButton} ${styles.actionButtonSuccess}`}
                  >
                    <Icon name="phone" size={14} />
                    {tr("Call Now")}
                  </a>
                </div>
              )}

              {activeTab === "email" && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
                  <div style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
                    {tr("Send support request to {{email}}:", { email: EMAIL_SUPPORT })}
                  </div>
                  <a
                    href={EMAIL_MAILTO}
                    className={`${styles.actionButton} ${styles.actionButtonDark}`}
                  >
                    <Icon name="mail" size={14} />
                    {tr("Send Email")}
                  </a>
                </div>
              )}
            </div>
          )}

          {/* 4-Tab Quick Action Switcher */}
          <div className={styles.tabSwitcher} role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "zalo"}
              className={`${styles.tabBtn} ${activeTab === "zalo" ? styles.tabBtnActive : ""}`}
              onClick={() => setActiveTab("zalo")}
            >
              <Icon name="send" size={16} />
              <span>Zalo</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "phone"}
              className={`${styles.tabBtn} ${activeTab === "phone" ? styles.tabBtnActive : ""}`}
              onClick={() => setActiveTab("phone")}
            >
              <Icon name="phone" size={16} />
              <span>{tr("Phone")}</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "email"}
              className={`${styles.tabBtn} ${activeTab === "email" ? styles.tabBtnActive : ""}`}
              onClick={() => setActiveTab("email")}
            >
              <Icon name="mail" size={16} />
              <span>Email</span>
            </button>

            {ENABLE_AI_ASSISTANT && (
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "ai"}
                className={`${styles.tabBtn} ${activeTab === "ai" ? styles.tabBtnActive : ""}`}
                onClick={() => setActiveTab("ai")}
              >
                <Icon name="sparkles" size={16} />
                <span>{tr("AI Assistant")}</span>
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
