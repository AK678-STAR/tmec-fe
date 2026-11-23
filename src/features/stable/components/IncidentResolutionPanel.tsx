import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/shared/lib/api';
import { messageFor } from '@/shared/lib/messages';
import { Alert } from '@/shared/components/ui/Alert';
import { Button } from '@/shared/components/ui/Button';
import { Checkbox } from '@/shared/components/form/Checkbox';
import { tr } from '@/shared/i18n/tr';
import type { IncidentReport } from '../types/incidents';

export function IncidentResolutionPanel({incident,onUpdated}:{incident:IncidentReport;onUpdated:(row:IncidentReport)=>void}) {
  const [candidates,setCandidates]=useState<IncidentReport[]>([]);
  const [selected,setSelected]=useState<string[]>([]);
  const [confirmed,setConfirmed]=useState(false);
  const [ready,setReady]=useState(false);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [version,setVersion]=useState(0);
  useEffect(()=>{
    let active=true;setLoading(true);setReady(false);setSelected([]);setConfirmed(false);setError('');
    Promise.all([
      api<IncidentReport[]>('GET',`/incidents/${incident.id}/duplicate-candidates`),
      incident.medicalRecordId ? api<{status:string;treatmentResult?:string}>('GET',`/medical/records/${incident.medicalRecordId}`) : Promise.resolve(null),
    ]).then(([rows,record])=>{if(active){setCandidates(rows);setReady(record?.status==='CLOSED' && record.treatmentResult==='RECOVERED');}}).catch(e=>{if(active)setError(messageFor(e));}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[incident.id,incident.medicalRecordId,version]);
  async function resolve() {
    if(!ready || !confirmed || busy || !incident.medicalRecordId)return;
    setBusy(true);setError('');
    try {
      const result=await api<IncidentReport>('POST',`/incidents/${incident.id}/resolve`,{medicalRecordId:incident.medicalRecordId,duplicateIncidentIds:selected,recoveryConfirmed:true});
      onUpdated({...incident,...result});setVersion(v=>v+1);
    }catch(e){setError(messageFor(e));}finally{setBusy(false);}
  }
  return <section aria-label={tr('Treatment resolution')} style={{borderTop:'1px solid var(--border)',paddingTop:16}}>
    <h3>{tr('Resolve reports from the same treatment episode')}</h3>
    <p>{tr('Reports within 48 hours are candidates, not confirmed duplicates. Select only reports assessed in this treatment.')}</p>
    {loading ? <p role="status">{tr('Loading...')}</p> : <>
      {error && <Alert tone="danger">{error}</Alert>}
      <Button tone="ghost" disabled={busy} onClick={()=>setVersion(v=>v+1)}>{tr('Reload treatment status')}</Button>
      {!ready && <p>{tr('Close the linked medical record with confirmed recovery before resolving these reports.')}</p>}
      {incident.medicalRecordId && <Link to={`/medical/records/${incident.medicalRecordId}`}>{tr('Open linked medical record')}</Link>}
      {candidates.filter(row=>!row.medicalRecordId || row.medicalRecordId===incident.medicalRecordId).map(row=><div key={row.id} style={{padding:'12px 0'}}>
        <Checkbox disabled={busy || !ready} checked={selected.includes(row.id)} onChange={checked=>setSelected(ids=>checked?[...ids,row.id]:ids.filter(id=>id!==row.id))} label={`${row.incidentNumber || row.id} — ${new Date(row.createdAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})} — ${row.severity}`} />
        <details><summary>{tr('Read observation')}</summary><p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{row.description}</p></details>
      </div>)}
      <Checkbox disabled={!ready || busy} checked={confirmed} onChange={setConfirmed} label={tr('I confirm recovery and that the selected reports belong to this treatment episode.')} />
      <Button tone="primary" disabled={!ready || !confirmed || busy || !!error} onClick={()=>void resolve()}>{busy?tr('Saving…'):tr('Resolve and merge selected reports')}</Button>
    </>}
  </section>;
}
