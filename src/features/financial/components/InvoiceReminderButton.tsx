import { useState } from "react";
import { Button } from "@/shared/components/ui/Button";
import { useToast } from "@/shared/components/ui/Toast";
import { useAppLanguage } from "@/shared/lib/language";
import { messageFor } from "@/shared/lib/messages";
import { remindInvoice } from "../api";
import type { InvoiceStatus } from "../types";

export function InvoiceReminderButton({
  id,
  status = "SENT",
}: {
  id: string;
  status?: InvoiceStatus;
}) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const { isVietnamese: vi } = useAppLanguage();
  const isOverdue = status === "OVERDUE";

  async function send() {
    setBusy(true);
    try {
      const result = await remindInvoice(id);
      if (isOverdue) {
        toast.show(
          result.sent
            ? vi
              ? "Đã gửi thông báo nhắc nợ quá hạn tới chủ ngựa."
              : "Overdue debt reminder processed."
            : vi
              ? "Chưa gửi được nhắc nợ. Hãy kiểm tra trạng thái hóa đơn hoặc thử lại sau."
              : "Debt notice not sent. Check invoice status or try again later.",
          result.sent ? "ok" : "warn",
        );
      } else {
        toast.show(
          result.sent
            ? vi
              ? "Đã gửi thông báo nhắc hạn thanh toán tới chủ ngựa."
              : "Payment reminder sent to owner."
            : vi
              ? "Chưa gửi được nhắc thanh toán. Hãy kiểm tra trạng thái hóa đơn hoặc thử lại sau."
              : "Payment reminder not sent. Check invoice status or try again later.",
          result.sent ? "ok" : "warn",
        );
      }
    } catch (error) {
      toast.show(messageFor(error), "danger");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      size="sm"
      tone={isOverdue ? "danger" : "secondary"}
      icon={isOverdue ? "alert" : "bell"}
      disabled={busy}
      title={
        isOverdue
          ? vi
            ? "Gửi thông báo nhắc nợ quá hạn (ngựa đang bị lưu giữ do nợ)"
            : "Send overdue debt reminder"
          : vi
            ? "Gửi thông báo nhắc hạn thanh toán hóa đơn"
            : "Send payment reminder"
      }
      onClick={() => void send()}
    >
      {busy
        ? "…"
        : isOverdue
          ? vi
            ? "Nhắc nợ"
            : "Debt Notice"
          : vi
            ? "Nhắc thanh toán"
            : "Remind"}
    </Button>
  );
}
