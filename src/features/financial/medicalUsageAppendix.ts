import type { FinancialInvoice } from './types';
export const medicalUsageHeaders=['Billing period','Horse','Medical record','Prescribed at','Used at','Veterinarian','Supply / service','Quantity','Unit','Unit price (VND)','Amount (VND)','Entry type'];
export const escapePrintText=(text:string)=>text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
export function medicalUsageRows(invoices:FinancialInvoice[]):Array<Array<string|number>>{
  const date=(value:string|null|undefined)=>value?new Date(value).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}):'—';
  return invoices.flatMap(invoice=>(invoice.lineItems??[]).map(line=>[invoice.billingPeriod,invoice.horse.name,line.recordNumber??'—',date(line.prescribedAt),date(line.performedAt),line.veterinarianName??'—',line.supplyName,Number(line.quantity),line.unit,Number(line.unitPrice),Number(line.amount),line.entryType]));
}
