import { api } from '@/shared/lib/api';
import { resolveContext, type SimulationMode } from './model';
import { getHorseById } from '@/features/horses/api';

export async function loadSimulationContext(sessionId: string, mode: SimulationMode) {
  const raw = await api<unknown>('GET', `/simulator/sessions/${encodeURIComponent(sessionId)}/context`);
  return resolveContext(sessionId, mode, raw, getHorseById);
}
