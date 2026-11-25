import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCurrentUser } from '@/shared/components/layout/AuthProvider';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { Button } from '@/shared/components/ui/Button';
import { Card } from '@/shared/components/ui/Card';
import { Badge } from '@/shared/components/ui/Badge';
import { Alert } from '@/shared/components/ui/Alert';
import { Modal } from '@/shared/components/ui/Modal';
import { Field } from '@/shared/components/form/Field';
import { Input } from '@/shared/components/form/Input';
import { Select } from '@/shared/components/form/Select';
import { useToast } from '@/shared/components/ui/Toast';
import { messageFor } from '@/shared/lib/messages';
import { createStaffWork, getWorkOverview, updateStaffWorkStatus, type WorkEvent, type WorkOverview } from '../workApi';
import styles from './WorkOverviewPage.module.css';

const roleLabel: Record<string, string> = { CLUB_MANAGER: 'Quản lý', VETERINARIAN: 'Bác sĩ thú y', GROOM: 'Nhân viên chăm sóc' };
const kindLabel: Record<string, string> = { ADMISSION: 'Thẩm định chung', SHIFT: 'Ca trực Groom', CARE: 'Nhiệm vụ chăm sóc', PREVENTIVE: 'Chăm sóc phòng ngừa', MEDICAL: 'Khám / bệnh án', OTHER: 'Công việc khác' };
const stateLabel: Record<string, string> = { PENDING: 'Chờ cập nhật', IN_PROGRESS: 'Đang thực hiện', COMPLETED: 'Đã hoàn thành' };
const clubDay = (value = new Date()) => new Date(value.getTime() + 7 * 3600000).toISOString().slice(0, 10);
const shiftDay = (day: string, offset: number) => new Date(new Date(`${day}T00:00:00Z`).getTime() + offset * 86400000).toISOString().slice(0, 10);
const clock = (date: string) => new Date(date).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' });
const isOverdue = (e: WorkEvent) => e.kind !== 'SHIFT' && e.status !== 'COMPLETED' && Date.parse(e.endsAt) < Date.now();
const isUnassigned = (e: WorkEvent) => !e.userIds.length || (e.kind === 'ADMISSION' && e.userIds.length < 2);

export default function WorkOverviewPage() {
  const user = useCurrentUser();
  const manager = user.role === 'CLUB_MANAGER';
  const toast = useToast();
  const [date, setDate] = useState(() => clubDay());
  const [view, setView] = useState<'day' | 'week'>('day');
  const [role, setRole] = useState('');
  const [person, setPerson] = useState('');
  const [location, setLocation] = useState('');
  const [status, setStatus] = useState('');
  const [kind, setKind] = useState('');
  const [attention, setAttention] = useState(false);
  const [data, setData] = useState<WorkOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState('');
  const [assignee, setAssignee] = useState(user.id);
  const [startsAt, setStartsAt] = useState(() => `${shiftDay(clubDay(), 1)}T09:00`);
  const [endsAt, setEndsAt] = useState(() => `${shiftDay(clubDay(), 1)}T10:00`);
  const [workLocation, setWorkLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  const from = view === 'day' ? date : shiftDay(date, -((weekday + 6) % 7));
  const to = view === 'day' ? date : shiftDay(from, 6);
  const days = Array.from({ length: view === 'day' ? 1 : 7 }, (_, i) => shiftDay(from, i));

  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    getWorkOverview(from, to).then(result => { if (active) setData(result); })
      .catch(err => { if (active) { setError(messageFor(err)); setData(null); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [from, to, version]);

  const conflicts = useMemo(() => {
    const result = new Set<string>();
    const timed = (data?.events ?? []).filter(e => !e.allDay && e.kind !== 'SHIFT' && e.status !== 'COMPLETED');
    for (let i = 0; i < timed.length; i++) for (let j = i + 1; j < timed.length; j++) {
      const a = timed[i], b = timed[j];
      if (a.userIds.some(id => b.userIds.includes(id)) && a.startsAt < b.endsAt && b.startsAt < a.endsAt) {
        result.add(a.id); result.add(b.id);
      }
    }
    return result;
  }, [data]);
  const members = data?.members ?? [];
  const events = (data?.events ?? []).filter(e =>
    (!person || e.userIds.includes(person)) && (!role || e.userIds.some(id => members.some(m => m.id === id && m.role === role))) &&
    (!location || e.location === location) && (!status || e.status === status) && (!kind || e.kind === kind) &&
    (!attention || isOverdue(e) || isUnassigned(e) || conflicts.has(e.id)));

  async function saveWork(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim() || !assignee || endsAt <= startsAt) { setFormError('Nhập tên việc, người phụ trách và khoảng giờ hợp lệ.'); return; }
    setBusy(true); setFormError('');
    try {
      await createStaffWork({ title: title.trim(), userId: assignee, startsAt: new Date(`${startsAt}:00+07:00`).toISOString(), endsAt: new Date(`${endsAt}:00+07:00`).toISOString(), location: workLocation.trim(), notes: notes.trim() });
      setCreating(false); setTitle(''); setNotes(''); setVersion(v => v + 1); toast.show('Đã thêm công việc.', 'ok');
    } catch (err) { setFormError(messageFor(err)); } finally { setBusy(false); }
  }
  async function changeStatus(event: WorkEvent, next: string) {
    if (!event.sourceId) return;
    if (next === 'CANCELLED' && !window.confirm('Hủy công việc này và giải phóng khoảng giờ đã đặt?')) return;
    setBusy(true);
    try { await updateStaffWorkStatus(event.sourceId, next); setVersion(v => v + 1); }
    catch (err) { toast.show(messageFor(err), 'danger'); } finally { setBusy(false); }
  }
  function renderEvent(e: WorkEvent) {
    const closed = e.status === 'COMPLETED';
    return <article key={e.id} className={styles.event}>
      <div className={styles.eventHead}><Badge tone={closed ? 'ok' : isOverdue(e) ? 'danger' : 'info'}>{stateLabel[e.status] ?? e.status}</Badge><span>{kindLabel[e.kind]}</span></div>
      <Link to={e.link} className={styles.eventTitle}>{e.title}</Link>
      <p>{e.allDay ? 'Trong ngày · chưa có khung giờ cụ thể' : `${clock(e.startsAt)} – ${clock(e.endsAt)}`} {e.location && `· ${e.location}`}</p>
      <p>{e.userIds.map(id => members.find(m => m.id === id)?.fullName).filter(Boolean).join(' · ') || 'Chưa phân công'}</p>
      {e.notes && <p>{e.notes}</p>}
      {isUnassigned(e) && <Badge tone="warn">Thiếu người phụ trách</Badge>}
      {isOverdue(e) && <Badge tone="danger">Quá hạn cập nhật</Badge>}
      {conflicts.has(e.id) && <Badge tone="danger">Trùng lịch</Badge>}
      {e.kind === 'SHIFT' && <Link className={styles.eventLink} to="/stable/shifts">Mở lịch trực Groom ↗</Link>}
      {e.kind === 'OTHER' && !closed && <div className={styles.actions}>
        {e.status === 'PENDING' && <Button size="sm" tone="secondary" disabled={busy} onClick={() => void changeStatus(e, 'IN_PROGRESS')}>Bắt đầu</Button>}
        <Button size="sm" tone="secondary" disabled={busy} onClick={() => void changeStatus(e, 'COMPLETED')}>Hoàn thành</Button>
        {manager && <Button size="sm" tone="ghost" disabled={busy} onClick={() => void changeStatus(e, 'CANCELLED')}>Hủy</Button>}
      </div>}
    </article>;
  }

  return <div className={styles.page}>
    <PageHeader title={manager ? 'Lịch & công việc nhân viên' : 'Lịch công việc của tôi'} description="Xem chung ca trực Groom, nhiệm vụ chăm sóc và lịch nghiệp vụ. Dùng Lịch trực Groom để phân ca hoặc đổi ca. Giờ CLB: UTC+7."
      action={<div className={styles.actions}><Button tone="secondary" disabled={loading} onClick={() => setVersion(v => v + 1)}>Làm mới</Button><Link to="/stable/shifts" className={styles.rosterLink}>Mở Lịch trực Groom</Link>{manager && <Button onClick={() => { setFormError(''); setCreating(true); }}>Thêm công việc</Button>}</div>} />
    <Card><div className={styles.filters}>
      <Field label="Ngày"><Input type="date" value={date} required onChange={e => { if (e.target.value) setDate(e.target.value); }} /></Field>
      <Field label="Chế độ"><Select value={view} onChange={e => setView(e.target.value as 'day' | 'week')} options={[{ value: 'day', label: 'Theo ngày' }, { value: 'week', label: 'Theo tuần' }]} /></Field>
      <Field label="Loại lịch"><Select value={kind} onChange={e => setKind(e.target.value)} options={[{ value: '', label: 'Tất cả lịch' }, { value: 'SHIFT', label: 'Ca trực Groom' }, { value: 'CARE', label: 'Nhiệm vụ chăm sóc' }, { value: 'ADMISSION', label: 'Thẩm định' }, { value: 'MEDICAL', label: 'Khám / bệnh án' }, { value: 'PREVENTIVE', label: 'Chăm sóc phòng ngừa' }, { value: 'OTHER', label: 'Công việc khác' }]} /></Field>
      {manager && <><Field label="Vai trò"><Select value={role} onChange={e => { setRole(e.target.value); setPerson(''); }} options={[{ value: '', label: 'Tất cả' }, ...Object.entries(roleLabel).map(([value, label]) => ({ value, label }))]} /></Field>
        <Field label="Nhân viên"><Select value={person} onChange={e => setPerson(e.target.value)} options={[{ value: '', label: 'Tất cả' }, ...members.filter(m => !role || m.role === role).map(m => ({ value: m.id, label: m.fullName }))]} /></Field></>}
      <Field label="Khu / địa điểm"><Select value={location} onChange={e => setLocation(e.target.value)} options={[{ value: '', label: 'Tất cả' }, ...[...new Set((data?.events ?? []).map(e => e.location).filter(Boolean))].map(value => ({ value, label: value }))]} /></Field>
      <Field label="Trạng thái"><Select value={status} onChange={e => setStatus(e.target.value)} options={[{ value: '', label: 'Tất cả' }, ...Object.entries(stateLabel).map(([value, label]) => ({ value, label }))]} /></Field>
    </div></Card>
    {error && <Alert tone="danger" action={<Button tone="secondary" onClick={() => setVersion(v => v + 1)}>Thử lại</Button>}>{error}</Alert>}
    {loading ? <p role="status">Đang tải công việc…</p> : data && <>
      <div className={styles.metrics}>{[
        ['Tổng mục lịch', events.length], ['Ca trực Groom', events.filter(e => e.kind === 'SHIFT').length],
        ['Đã hoàn thành', events.filter(e => e.status === 'COMPLETED').length], ['Quá hạn cập nhật', events.filter(isOverdue).length], ['Thiếu phân công', events.filter(isUnassigned).length],
      ].map(([label, count]) => <div key={label} className={styles.metric}><strong>{count}</strong><span>{label}</span></div>)}</div>
      <Card title="Lịch trực Groom"><p className={styles.hint}>Ca trực hiển thị cùng công việc để tiện theo dõi. Sửa phân ca, sao chép tuần và xử lý đổi ca tại màn quản lý Lịch trực.</p><Link className={styles.eventLink} to="/stable/shifts">Mở bảng phân ca Groom ↗</Link></Card>
      <Card title="Cần chú ý"><div className={styles.actions}>
        <Button tone={attention ? 'primary' : 'secondary'} aria-pressed={attention} onClick={() => setAttention(v => !v)}>{attention ? 'Hiện tất cả công việc' : 'Lọc thiếu người / quá hạn / trùng lịch'}</Button>
        {manager && <Link to="/incidents">Sự cố chưa kết thúc: {data.openIncidents}</Link>}
      </div><p className={styles.hint}>Quá hạn cập nhật không đồng nghĩa nhân viên chưa làm. Ca trực và nhiệm vụ chăm sóc là hai loại mục riêng; không dùng số lượng để xếp hạng nhân viên.</p></Card>
      {manager && <Card title="Theo nhân viên"><div className={styles.tableScroll}><table className={styles.table}><thead><tr><th>Nhân viên</th><th>Vai trò</th><th>Ca trực</th><th>Nhiệm vụ</th><th>Hoàn thành</th><th>Cần chú ý</th></tr></thead><tbody>
        {members.filter(m => (!role || m.role === role) && (!person || person === m.id)).map(m => {
          const own = events.filter(e => e.userIds.includes(m.id));
          return <tr key={m.id}><td><button className={styles.person} onClick={() => setPerson(m.id)}>{m.fullName}</button></td><td>{roleLabel[m.role]}</td><td>{own.filter(e => e.kind === 'SHIFT').length}</td><td>{own.filter(e => e.kind !== 'SHIFT').length}</td><td>{own.filter(e => e.status === 'COMPLETED').length}/{own.length}</td><td>{own.filter(e => isOverdue(e) || conflicts.has(e.id)).length}</td></tr>;
        })}
      </tbody></table></div><p className={styles.hint}>Lịch thẩm định chung chỉ được đếm một lần trong tổng lịch, nhưng xuất hiện ở cả hai người tham gia.</p></Card>}
      <section aria-label="Lịch công việc" className={view === 'week' ? styles.week : styles.day}>
        {days.map(day => { const items = events.filter(e => clubDay(new Date(e.startsAt)) <= day && clubDay(new Date(Date.parse(e.endsAt) - 1)) >= day); return <div className={styles.dayColumn} key={day}>
          <h2>{new Date(`${day}T12:00:00+07:00`).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', weekday: 'short', day: '2-digit', month: '2-digit' })} <span>({items.length})</span></h2>
          {items.length ? items.map(renderEvent) : <p className={styles.hint}>Không có công việc theo bộ lọc.</p>}
        </div>; })}
      </section>
    </>}
    {creating && <Modal title="Thêm công việc" subtitle="Kiểm tra chuồng/cơ sở vật chất hoặc công việc khác. Hệ thống kiểm tra trùng lịch khi lưu." width={560} onClose={busy ? undefined : () => setCreating(false)}>
      <form className={styles.form} onSubmit={event => void saveWork(event)}>
        {formError && <Alert tone="danger">{formError}</Alert>}
        <Field label="Tên công việc *"><Input required minLength={2} maxLength={150} value={title} onChange={e => setTitle(e.target.value)} /></Field>
        <Field label="Người phụ trách *"><Select required value={assignee} onChange={e => setAssignee(e.target.value)} options={[{ value: '', label: 'Chọn nhân viên' }, ...members.map(m => ({ value: m.id, label: `${m.fullName} · ${roleLabel[m.role]}` }))]} /></Field>
        <Field label="Bắt đầu (UTC+7) *"><Input required type="datetime-local" value={startsAt} onChange={e => setStartsAt(e.target.value)} /></Field>
        <Field label="Kết thúc (UTC+7) *"><Input required type="datetime-local" value={endsAt} onChange={e => setEndsAt(e.target.value)} /></Field>
        <Field label="Địa điểm"><Input maxLength={200} value={workLocation} onChange={e => setWorkLocation(e.target.value)} /></Field>
        <Field label="Ghi chú"><Input maxLength={1000} value={notes} onChange={e => setNotes(e.target.value)} /></Field>
        <div className={styles.actions}><Button tone="secondary" disabled={busy} onClick={() => setCreating(false)}>Đóng</Button><Button type="submit" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu công việc'}</Button></div>
      </form>
    </Modal>}
  </div>;
}
