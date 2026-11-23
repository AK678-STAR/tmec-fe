import { useState } from "react";
import { Button } from "@/shared/components/ui/Button";
import { useToast } from "@/shared/components/ui/Toast";
import { useAppLanguage } from "@/shared/lib/language";
import { messageFor } from "@/shared/lib/messages";
import { remindInvoice } from "../api";
export function InvoiceReminderButton({ id }: { id: string }) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const { isVietnamese: vi } = useAppLanguage();
  async function send() {
    setBusy(true);
    try {
      const result = await remindInvoice(id);
      toast.show(
        result.sent
          ? vi
            ? "Đã xử lý yêu cầu nhắc nợ. Chưa xác nhận thư đến hộp thư."
            : "Reminder processed. Inbox delivery is not confirmed."
          : vi
            ? "Chưa gửi nhắc nợ. Hãy kiểm tra trạng thái hóa đơn hoặc thử lại sau."
            : "Reminder not sent. Check invoice status or try again later.",
        result.sent ? "ok" : "warn",
      );
    } catch (error) {
      toast.show(messageFor(error), "danger");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button
      size="sm"
      tone="secondary"
      disabled={busy}
      onClick={() => void send()}
    >
      {busy ? "…" : vi ? "Nhắc nợ" : "Remind"}
    </Button>
  );
}
