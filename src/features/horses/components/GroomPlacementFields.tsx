import { useEffect, useState } from 'react';
import { getPlacementOptions } from '../services/admissionService';
import type { AdmissionPlacement, PlacementOptions } from '../types/admission.types';
import design from './AdmissionDesign.module.css';

export function GroomPlacementFields({ value, onChange, fixedStallId, allocationId, disabled = false }: { value: AdmissionPlacement; onChange: (v: AdmissionPlacement) => void; fixedStallId?: string; allocationId?: string; disabled?: boolean }) {
  const [options, setOptions] = useState<PlacementOptions | null>(null);
  const [error, setError] = useState('');
  const stallId = fixedStallId ?? value.stallId;
  useEffect(() => {
    let active = true;
    setOptions(null); setError('');
    getPlacementOptions(stallId, allocationId).then(result => { if (active) setOptions(result); }).catch(err => { if (active) setError(err instanceof Error ? err.message : 'Không tải được danh sách bố trí chuồng.'); });
    return () => { active = false; };
  }, [stallId, allocationId]);
  const selectStyle = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', font: 'inherit', color: 'inherit' };
  return <div className={design.form}>
    {error && <p role="alert" className={design.error}>{error}</p>}
    {!options && !error && <p role="status">Đang kiểm tra ô chuồng và lịch trực…</p>}
    {fixedStallId === undefined && <label>Ô chuồng tiếp nhận
      <select aria-label="Ô chuồng tiếp nhận" style={selectStyle} disabled={disabled || !options} value={stallId} onChange={e => onChange({ stallId: e.target.value, assignedGroomUserId: '', receivingGroomUserId: '' })}>
        <option value="">Chọn ô chuồng trống</option>
        {options?.stalls.map(s => <option key={s.id} value={s.id}>{s.code} — {s.zoneRef?.name}</option>)}
      </select>
    </label>}
    <label>Groom chăm sóc chính
      <select aria-label="Groom chăm sóc chính" style={selectStyle} disabled={disabled || !options || !stallId} value={value.assignedGroomUserId} onChange={e => onChange({ ...value, stallId, assignedGroomUserId: e.target.value })}>
        <option value="">Chọn nhân viên chăm sóc chính</option>
        {options?.grooms.map(g => <option key={g.id} value={g.id} disabled={!g.eligible}>{g.fullName} — {g.count}/{g.max} ô{!g.eligible ? ' (đủ định mức hoặc khác khu)' : ''}</option>)}
      </select>
    </label>
    <label>Groom đang trực nhận bàn giao
      <select aria-label="Groom đang trực nhận bàn giao" style={selectStyle} disabled={disabled || !options || !stallId} value={value.receivingGroomUserId} onChange={e => onChange({ ...value, stallId, receivingGroomUserId: e.target.value })}>
        <option value="">Chọn người đang trực tại khu này</option>
        {options?.receivingGrooms.map(g => <option key={g.id} value={g.id}>{g.fullName}</option>)}
      </select>
    </label>
    {options && stallId && !options.receivingGrooms.length && <p role="status">Chưa có Groom đang trực đủ định mức tại khu này. Quản lý cần bố trí ca chăm sóc trước khi tiếp nhận hoặc chuyển chuồng.</p>}
    <p className={design.helper}>Groom chính phụ trách tối đa 6 ô trong cùng khu. Người nhận bàn giao phải đang trực chăm sóc; có thể là Groom khác.</p>
  </div>;
}
