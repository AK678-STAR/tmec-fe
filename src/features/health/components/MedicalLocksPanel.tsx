import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/shared/lib/api';
import { messageFor } from '@/shared/lib/messages';
import { useCurrentUser } from '@/shared/components/layout/AuthProvider';
import { Card } from '@/shared/components/ui/Card';
import { Alert } from '@/shared/components/ui/Alert';
import { Button } from '@/shared/components/ui/Button';
import { tr } from '@/shared/i18n/tr';
import { applyTrainingLock, extendTrainingLock, releaseTrainingLock } from '../api';
import { TrainingLockModal } from './TrainingLockModal';

interface Lock {
  id: string; lockCode?: string; source?: string; medicalRecordId?: string;
  isLocked: boolean; lockReason: string; unlockConditions?: string;
  recheckDate?: string; lockedAt: string; veterinarian?: {fullName:string}|null;
}
export function MedicalLocksPanel({horseId,horseName,recordId,refreshKey,onChanged,onCloseTreatment}:{
  horseId:string;horseName:string;recordId?:string;refreshKey?:string;
  onChanged?:()=>void;onCloseTreatment?:()=>void;
}) {
  const user=useCurrentUser();
  const [locks,setLocks]=useState<Lock[]>([]);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const [version,setVersion]=useState(0);
  const [mode,setMode]=useState<'place'|'lift'|'extend'|null>(null);
  const [selected,setSelected]=useState<Lock|null>(null);
  useEffect(()=>{
    let current=true; setLoading(true);setError('');
    api<{data:Lock[]}>('GET',`/medical/locks?horseId=${encodeURIComponent(horseId)}&tab=ACTIVE&limit=100`).then(res=>{if(current)setLocks(res.data);}).catch(e=>{if(current)setError(messageFor(e));}).finally(()=>{if(current)setLoading(false);});
    return()=>{current=false;};
  },[horseId,refreshKey,version]);
  const changed=()=>{setMode(null);setSelected(null);setVersion(v=>v+1);onChanged?.();};
  return <Card title={tr('Medical protection')}>
    {loading ? <p role="status">{tr('Loading...')}</p> : error ? <Alert tone="danger">{error}<Button tone="ghost" onClick={()=>setVersion(v=>v+1)}>{tr('Try again')}</Button></Alert> : <>
      {!locks.length && <p>{tr('No active medical protection.')}</p>}
      {locks.map(lock=><div key={lock.id} style={{padding:'12px 0',borderBottom:'1px solid var(--border)'}}>
        <strong>{lock.lockCode || lock.id}</strong><p>{lock.lockReason}</p>
        <p>{lock.veterinarian?.fullName || tr('Automatic safety protection — awaiting veterinary review')}</p>
        <p>{tr('Review date')}: {lock.recheckDate ? new Date(lock.recheckDate).toLocaleDateString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}) : '—'}</p>
        {lock.unlockConditions && <p>{lock.unlockConditions}</p>}
        {lock.medicalRecordId && lock.medicalRecordId!==recordId && <Link to={`/medical/records/${lock.medicalRecordId}`}>{tr('View linked medical record')}</Link>}
        {user.role==='VETERINARIAN' && <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <Button tone="secondary" onClick={()=>{setSelected(lock);setMode('extend');}}>{tr('Extend protection')}</Button>
          {lock.medicalRecordId===recordId && onCloseTreatment ? <Button tone="secondary" onClick={onCloseTreatment}>{tr('Conclude treatment and review release')}</Button> : !lock.medicalRecordId && lock.source!=='INCIDENT_AUTO' ? <Button tone="secondary" onClick={()=>{setSelected(lock);setMode('lift');}}>{tr('Release protection')}</Button> : null}
        </div>}
      </div>)}
      {recordId && user.role==='VETERINARIAN' && !locks.some(l=>l.medicalRecordId===recordId) && <Button tone="secondary" onClick={()=>setMode('place')}>{tr('Place protection for this record')}</Button>}
    </>}
    {mode && <TrainingLockModal mode={mode} horseId={horseId} horseName={horseName} currentReviewDate={selected?.recheckDate} onClose={()=>setMode(null)}
      onPlaceLock={async dto=>{await applyTrainingLock(horseId,{medicalRecordId:recordId,appliedMedicalStatus:dto.appliedStatus,lockReason:dto.reason,reviewDate:dto.reviewDate,unlockConditions:dto.unlockConditions});changed();}}
      onExtendLock={async dto=>{if(!selected)return;await extendTrainingLock(selected.id,{newReviewDate:dto.newReviewDate,reason:dto.reason});changed();}}
      onLiftLock={async dto=>{if(!selected)return;await releaseTrainingLock(selected.id,{releaseReason:dto.reason,targetStatus:dto.restoreStatus,horseId});changed();}}
    />}
  </Card>;
}
