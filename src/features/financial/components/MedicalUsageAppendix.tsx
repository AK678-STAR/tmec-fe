import {medicalUsageHeaders,medicalUsageRows} from '../medicalUsageAppendix';
import type {FinancialInvoice} from '../types';
import {tr} from '@/shared/i18n/tr';
export function MedicalUsageAppendix({invoice}:{invoice:FinancialInvoice}){
  if(invoice.billingMethod!=='ACTUAL_USAGE')return <p>{tr('This statement retains legacy package billing.')}</p>;
  const rows=medicalUsageRows([invoice]);
  return <section aria-label={tr('Medical usage appendix')}><h3>{tr('Medical usage appendix')}</h3><p>{tr('Usage and unit prices are immutable invoice snapshots. Prescribed and performed dates are shown separately.')}</p>{rows.length?<div style={{overflowX:'auto'}}><table><thead><tr>{medicalUsageHeaders.map(header=><th key={header} scope="col">{tr(header)}</th>)}</tr></thead><tbody>{rows.map((row,index)=><tr key={invoice.lineItems?.[index]?.id??index}>{row.map((value,column)=><td key={column} style={{padding:8,overflowWrap:'anywhere'}}>{value}</td>)}</tr>)}</tbody></table></div>:<p>{tr('No billable medical usage was recorded for this statement.')}</p>}</section>;
}
