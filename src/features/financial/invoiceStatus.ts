import { tr } from '@/shared/i18n/tr';
import { isVietnamese } from '@/shared/lib/language';
import type { InvoiceStatus } from './types';

const LABELS: Record<InvoiceStatus, string> = {
  DRAFT: 'Unsent',
  SENT: 'Sent',
  PAID: 'Paid',
  OVERDUE: 'Overdue',
  CANCELLED: 'Cancelled',
};

export function invoiceStatusLabel(status: InvoiceStatus, isOwner: boolean = false): string {
  if (status === 'SENT') {
    if (isOwner) {
      return isVietnamese() ? 'Đã nhận' : 'Received';
    }
    return isVietnamese() ? 'Đã gửi' : 'Sent';
  }
  return tr(LABELS[status]);
}
