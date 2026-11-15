import { tr } from '@/shared/i18n/tr';
import { isVietnamese } from '@/shared/lib/language';
import type { InvoiceStatus } from './types';

const LABELS: Record<InvoiceStatus, string> = {
  DRAFT: 'Unsent',
  SENT: 'Received',
  PAID: 'Paid',
  OVERDUE: 'Overdue',
  CANCELLED: 'Cancelled',
};

export function invoiceStatusLabel(status: InvoiceStatus): string {
  if (status === 'SENT') {
    return isVietnamese() ? 'Đã nhận' : 'Received';
  }
  return tr(LABELS[status]);
}
