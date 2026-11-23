import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/shared/lib/api';
import { messageFor } from '@/shared/lib/messages';
import { Modal } from '@/shared/components/ui/Modal';
import { Button } from '@/shared/components/ui/Button';
import { Alert } from '@/shared/components/ui/Alert';
import { Select } from '@/shared/components/form/Select';
import { Field } from '@/shared/components/form/Field';
import { useToast } from '@/shared/components/ui/Toast';
import { tr } from '@/shared/i18n/tr';

export function AssignAllocationGroomModal({allocationId,horseName,onClose,onDone}:{allocationId:string;horseName:string;onClose:()=>void;onDone:()=>void}) {
  const [candidates,setCandidates]=useState<Array<{id:string;fullName:string}>>([]);
  const [groomId,setGroomId]=useState('');const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [version,setVersion]=useState(0);
  const toast=useToast();
  useEffect(()=>{
    let current=true;setLoading(true);setError('');setGroomId('');
    api<Array<{id:string;fullName:string}>>('GET',`/stalls/allocations/${allocationId}/groom-candidates`).then(rows=>{if(current)setCandidates(rows);}).catch(e=>{if(current)setError(messageFor(e));}).finally(()=>{if(current)setLoading(false);});
    return()=>{current=false;};
  },[allocationId,version]);
  async function submit(e:React.FormEvent){e.preventDefault();if(busy||!groomId||loading)return;setBusy(true);setError('');
    try{const result=await api<{careSyncFailed?:boolean;notificationFailed?:boolean}>('PATCH',`/stalls/allocations/${allocationId}/groom`,{groomUserId:groomId});
      toast.show(result.careSyncFailed||result.notificationFailed?tr('Assignment saved. Checklist or notification needs a refresh.'):tr('Groom assigned successfully.'),result.careSyncFailed||result.notificationFailed?'warn':'ok');onDone();
    }catch(e){setError(messageFor(e));}finally{setBusy(false);}}
  return <Modal title={`${tr('Assign care Groom')} — ${horseName}`} onClose={busy?undefined:onClose} foot={<Button tone="primary" type="submit" form="allocation-groom-form" disabled={busy||loading||!groomId}>{busy?tr('Saving…'):tr('Assign Groom')}</Button>}>
    <form id="allocation-groom-form" onSubmit={submit}>
      {error&&<Alert tone="danger">{error}</Alert>}
      <p>{tr('Only active Grooms currently on duty in this barn zone can be selected.')}</p>
      {loading?<p role="status">{tr('Loading...')}</p>:candidates.length?<Field label={tr('On-duty Groom')}><Select value={groomId} onChange={e=>setGroomId(e.target.value)} options={[{value:'',label:tr('Select Groom')},...candidates.map(g=>({value:g.id,label:g.fullName}))]} /></Field>:<Alert tone="warn">{tr('No eligible Groom is on duty.')} <Link to="/stable/shifts">{tr('Open shift roster')}</Link></Alert>}
      <Button tone="ghost" disabled={busy} onClick={()=>setVersion(v=>v+1)}>{tr('Reload candidates')}</Button>
    </form>
  </Modal>;
}
