import { api } from '@/shared/lib/api';

export interface WorkMember { id: string; fullName: string; role: string }
export interface WorkEvent {
  id: string; sourceId?: string; title: string; kind: string; userIds: string[];
  startsAt: string; endsAt: string; allDay: boolean; status: string; location: string; link: string; notes?: string;
}
export interface WorkOverview {
  members: WorkMember[]; events: WorkEvent[]; openIncidents: number;
  summary: { total: number; completed: number; inProgress: number; overdue: number; unassigned: number };
}
export const getWorkMembers = () => api<WorkMember[]>('GET', '/staff-work/members');
export const getWorkOverview = (from: string, to: string) => api<WorkOverview>('GET', `/staff-work?from=${from}&to=${to}`);
export const createStaffWork = (body: { title: string; userId: string; startsAt: string; endsAt: string; location?: string; notes?: string }) => api('POST', '/staff-work', body);
export const updateStaffWorkStatus = (id: string, status: string) => api('PATCH', `/staff-work/${id}/status`, { status });
