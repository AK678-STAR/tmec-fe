import { useState, useEffect, useRef } from "react";
import { Modal } from "@/shared/components/ui/Modal";
import { Button } from "@/shared/components/ui/Button";
import { useToast } from "@/shared/components/ui/Toast";
import { formatNumber } from "@/shared/lib/format";
import {
  createPayOSLink,
  checkPayOSStatus,
  simulatePayOSPaid,
  type PayOSLinkResponse,
} from "../api";
import type { FinancialInvoice } from "../types";
import styles from "./PayOSCheckoutModal.module.css";

interface PayOSCheckoutModalProps {
  invoice: FinancialInvoice;
  onClose: () => void;
  onSuccess: (updatedInvoice?: FinancialInvoice) => void;
}

export function PayOSCheckoutModal({
  invoice,
  onClose,
  onSuccess,
}: PayOSCheckoutModalProps) {
  const toast = useToast();
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const rawOriginalAmount = Number(invoice.netAmount);
  const storedDemoAmount =
    typeof window !== "undefined"
      ? localStorage.getItem("equiflow_demo_pay_amount")
      : null;
  const initialUseDemo = storedDemoAmount && storedDemoAmount !== "0";

  const [useDemoAmount, setUseDemoAmount] = useState<boolean>(Boolean(initialUseDemo));
  const [demoAmountValue, setDemoAmountValue] = useState<number>(() => {
    if (storedDemoAmount && Number(storedDemoAmount) > 0) {
      return Number(storedDemoAmount);
    }
    return 2000;
  });

  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [payLinkData, setPayLinkData] = useState<PayOSLinkResponse | null>(null);
  const [isPaidSuccess, setIsPaidSuccess] = useState(false);

  const activeAmount = useDemoAmount ? demoAmountValue : rawOriginalAmount;

  // Tải dữ liệu QR PayOS khi mở modal hoặc khi đổi chế độ tiền
  const loadPaymentLink = async (amountToUse?: number) => {
    try {
      setLoading(true);
      const res = await createPayOSLink(invoice.id, amountToUse);
      setPayLinkData(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Không thể tạo link thanh toán PayOS";
      toast.show(msg, "danger");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const amountToPass = useDemoAmount ? demoAmountValue : undefined;
    void loadPaymentLink(amountToPass);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useDemoAmount, demoAmountValue]);

  // Polling tự động tra cứu trạng thái thanh toán mỗi 3.5 giây khi orderCode có sẵn
  useEffect(() => {
    if (!payLinkData?.orderCode || isPaidSuccess) return;

    const interval = setInterval(async () => {
      try {
        const check = await checkPayOSStatus(invoice.id, payLinkData.orderCode);
        if (check.paid) {
          setIsPaidSuccess(true);
          toast.show("Thanh toán thành công! Sổ công nợ và hạn chế đã được giải tỏa.", "ok");
          clearInterval(interval);
          onSuccess(check.invoice);
        }
      } catch {
        // im lặng bỏ qua lỗi kết nối polling
      }
    }, 3500);

    pollingRef.current = interval;
    return () => clearInterval(interval);
  }, [payLinkData?.orderCode, isPaidSuccess, invoice.id, onSuccess, toast]);

  const handleManualCheck = async () => {
    if (!payLinkData?.orderCode) return;
    try {
      setChecking(true);
      const check = await checkPayOSStatus(invoice.id, payLinkData.orderCode);
      if (check.paid) {
        setIsPaidSuccess(true);
        toast.show("Thanh toán thành công!", "ok");
        onSuccess(check.invoice);
      } else {
        toast.show("Hệ thống chưa nhận được tiền từ ngân hàng. Vui lòng thử lại sau vài giây.", "info");
      }
    } catch (err: unknown) {
      toast.show(err instanceof Error ? err.message : "Lỗi kiểm tra thanh toán", "danger");
    } finally {
      setChecking(false);
    }
  };

  const handleSimulateInstantSuccess = async () => {
    try {
      setChecking(true);
      const updated = await simulatePayOSPaid(invoice.id);
      setIsPaidSuccess(true);
      toast.show("⚡ Giả lập thanh toán thành công! Hóa đơn đã chốt PAID.", "ok");
      onSuccess(updated);
    } catch (err: unknown) {
      toast.show(err instanceof Error ? err.message : "Giả lập thanh toán thất bại", "danger");
    } finally {
      setChecking(false);
    }
  };

  const copyText = (txt: string, label: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(txt);
      toast.show(`Đã sao chép ${label}: ${txt}`, "ok");
    }
  };

  return (
    <Modal
      title={isPaidSuccess ? "Thanh toán Thành Công" : "Thanh toán VietQR / PayOS"}
      subtitle={`Hóa đơn ${invoice.billingPeriod} · Ngựa ${invoice.horse?.name ?? "—"}`}
      width={480}
      onClose={onClose}
    >
      {isPaidSuccess ? (
        <div className={styles.successContainer}>
          <div className={styles.successIconBadge}>✓</div>
          <h3 className={styles.successTitle}>Xác Nhận Đã Thanh Toán</h3>
          <p className={styles.successDesc}>
            Hóa đơn kỳ <strong>{invoice.billingPeriod}</strong> đã được đối soát thành công.
            Mọi lệnh phong tỏa công nợ đã tự động giải phóng.
          </p>
          <Button tone="primary" onClick={() => { onSuccess(); onClose(); }}>
            Hoàn tất & Đóng
          </Button>
        </div>
      ) : (
        <div className={styles.modalOverlay}>
          {/* Amount Box with Demo Switcher */}
          <div className={styles.amountBanner}>
            <div className={styles.amountInfo}>
              <span className={styles.amountLabel}>Số tiền thanh toán</span>
              <span className={styles.amountValue}>
                {formatNumber(activeAmount)}
                <small>VNĐ</small>
              </span>
            </div>

            <div className={styles.amountToggleGroup}>
              <button
                type="button"
                className={`${styles.toggleBtn} ${useDemoAmount ? styles.toggleBtnActive : ""}`}
                onClick={() => setUseDemoAmount(true)}
                title="Sử dụng số tiền nhỏ để quét thử bằng app ngân hàng thật"
              >
                Demo ({demoAmountValue.toLocaleString("vi-VN")}đ)
              </button>
              <button
                type="button"
                className={`${styles.toggleBtn} ${!useDemoAmount ? styles.toggleBtnActive : ""}`}
                onClick={() => setUseDemoAmount(false)}
                title="Sử dụng số tiền gốc của hóa đơn"
              >
                Gốc
              </button>
            </div>
          </div>

          {/* QR Code Presentation */}
          <div className={styles.qrWrapper}>
            <div className={styles.qrImageFrame}>
              {loading || !payLinkData ? (
                <div className={styles.qrLoading}>
                  <span>Đang tạo mã VietQR…</span>
                </div>
              ) : (
                <img
                  src={payLinkData.qrCode}
                  alt="Mã QR thanh toán PayOS / VietQR"
                  className={styles.qrImage}
                />
              )}
            </div>
            <p className={styles.qrTip}>
              Quét mã bằng app Mobile Banking hoặc ví điện tử bất kỳ để chuyển tiền tức thì.
            </p>
            {payLinkData?.checkoutUrl && (
              <a
                href={payLinkData.checkoutUrl}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: "12px", color: "#2563eb", fontWeight: 600, textDecoration: "underline" }}
              >
                Mở cổng thanh toán PayOS trực tiếp ↗
              </a>
            )}
          </div>

          {/* Bank Account Info */}
          {payLinkData && (
            <div className={styles.bankDetailsCard}>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Ngân hàng</span>
                <span style={{ fontWeight: 600 }}>{payLinkData.bankName}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Số tài khoản</span>
                <div className={styles.detailValueGroup}>
                  <span>{payLinkData.accountNumber}</span>
                  <button
                    type="button"
                    className={styles.copyBtn}
                    onClick={() => copyText(payLinkData.accountNumber, "Số tài khoản")}
                  >
                    Sao chép
                  </button>
                </div>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Chủ tài khoản</span>
                <span style={{ fontWeight: 600 }}>{payLinkData.accountName}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Nội dung</span>
                <div className={styles.detailValueGroup}>
                  <span style={{ color: "#d97706" }}>{payLinkData.description}</span>
                  <button
                    type="button"
                    className={styles.copyBtn}
                    onClick={() => copyText(payLinkData.description, "Nội dung")}
                  >
                    Sao chép
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className={styles.actionFooter}>
            <button
              type="button"
              className={styles.demoSimulateBtn}
              onClick={handleSimulateInstantSuccess}
              disabled={checking}
              title="Nhấn để giả lập thanh toán thành công ngay lập tức phục vụ demo"
            >
              ⚡ Giả lập thành công (Demo)
            </button>

            <button
              type="button"
              className={styles.checkStatusBtn}
              onClick={handleManualCheck}
              disabled={checking || loading}
            >
              {checking ? "Đang kiểm tra…" : "Kiểm tra thanh toán"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
