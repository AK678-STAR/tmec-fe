import {useEffect,useState} from 'react';
import {api} from '@/shared/lib/api';
import {messageFor} from '@/shared/lib/messages';
import {Button} from '@/shared/components/ui/Button';
import {Alert} from '@/shared/components/ui/Alert';
import {ConfirmModal} from '@/shared/components/ui/ConfirmModal';
import {tr} from '@/shared/i18n/tr';
export function MedicalExamCharge({recordId}:{recordId:string}){
  const [price,setPrice]=useState<number|null>(null);const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);const [confirm,setConfirm]=useState(false);const [error,setError]=useState('');const [notice,setNotice]=useState('');
  useEffect(()=>{let current=true;api<{examUnitPrice?:number|string}|null>('GET','/invoices/care-billing-policy').then(policy=>{if(current)setPrice(policy?.examUnitPrice?Number(policy.examUnitPrice):null);}).catch(e=>{if(current)setError(messageFor(e));}).finally(()=>{if(current)setLoading(false);});return()=>{current=false;};},[]);
  async function charge(){if(busy)return;setBusy(true);setError('');try{const result=await api<{amount:number|string}>('POST',`/invoices/medical-records/${recordId}/exam-charge`,{});setNotice(`${tr('Examination charge recorded')}: ${Number(result.amount).toLocaleString('vi-VN')} VND`);setConfirm(false);}catch(e){setError(messageFor(e));}finally{setBusy(false);}}
  return <div>{error&&<Alert tone="danger">{error}</Alert>}{notice?<Alert tone="ok">{notice}</Alert>:<Button tone="secondary" disabled={loading||busy||!price} onClick={()=>setConfirm(true)}>{tr('Record examination charge')}{price?` · ${price.toLocaleString('vi-VN')} VND`:''}</Button>}{!loading&&!price&&<p>{tr('Configure an examination tariff in Financial Reports before recording a charge.')}</p>}
    {confirm&&<ConfirmModal title={tr('Record examination charge')} cancelLabel={tr('Back')} confirmLabel={tr('Record charge')} onCancel={()=>setConfirm(false)} onConfirm={charge} busy={busy}><p>{tr('Record this examination as a billable service at the configured tariff. Repeating this action will not create another charge for the same record.')}</p><strong>{price?.toLocaleString('vi-VN')} VND</strong></ConfirmModal>}
  </div>;
}
