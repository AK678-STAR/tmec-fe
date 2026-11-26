import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/shared/lib/api';
import { messageFor } from '@/shared/lib/messages';
import { Modal } from '@/shared/components/ui/Modal';
import { Button } from '@/shared/components/ui/Button';
import { Icon } from '@/shared/components/ui/Icon';
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
      toast.show(result.careSyncFailed||result.notificationFailed?'Đã lưu phân công. Danh sách công việc hoặc thông báo cần làm mới.':'Đã phân công Groom chăm sóc thành công!',result.careSyncFailed||result.notificationFailed?'warn':'ok');onDone();
    }catch(e){setError(messageFor(e));}finally{setBusy(false);}}
  return <Modal title={`Phân công Groom chăm sóc — ${horseName}`} onClose={busy?undefined:onClose} foot={<Button tone="primary" type="submit" form="allocation-groom-form" disabled={busy||loading||!groomId}>{busy?'Đang lưu…':'Lưu phân công'}</Button>}>
    <form id="allocation-groom-form" onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
      {error&&<Alert tone="danger">{error}</Alert>}
      <p style={{ margin: 0, color: 'var(--text-2)' }}>Chỉ những nhân viên Groom đang trong ca trực hoạt động tại phân khu này và còn định mức (dưới 6 ô chuồng) mới có thể được chọn.</p>
      {loading?<p role="status">Đang tải danh sách Groom...</p>:candidates.length?<Field label="Nhân viên Groom phụ trách"><Select value={groomId} onChange={e=>setGroomId(e.target.value)} options={[{value:'',label:'-- Chọn nhân viên Groom --'},...candidates.map(g=>({value:g.id,label:g.fullName}))]} /></Field>:<Alert tone="warn">Hiện không có Groom nào đủ điều kiện đang trực tại phân khu này. <Link to="/stable/shifts">Mở lịch trực ca</Link></Alert>}
      <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
        <Button tone="ghost" size="sm" disabled={busy} onClick={()=>setVersion(v=>v+1)}><Icon name="refresh" size={14} inline /> Tải lại danh sách</Button>
      </div>
    </form>
  </Modal>;
}
