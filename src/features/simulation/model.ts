import { createRun, createRace, stepRun, stepRace, completeCooldown, standings, INTENSITY_PACE, type HorseProfile, type Race, type RunState, type Surface } from './engine/engine.ts';
import { toHorseProfile } from './engine/horseMapper.ts';
import { examFinishedPacket, raceFinishedPacket, workoutFinishedPacket } from './engine/packets.ts';

export type SimulationMode = 'EXAM' | 'WORKOUT' | 'RACE';
export interface ContextHorse {
  id: string; name: string; status: string; isMedicalLocked: boolean;
  weightKg?: number | null; [key: string]: unknown;
}
export interface SimulationContext {
  type: SimulationMode;
  sessionId: string;
  status: 'PENDING' | 'RUNNING';
  horse: ContextHorse;
  workout?: { id: string; distanceMeters: number; intensity: string; trackSurface: string; workoutType?: string };
  entries?: Array<{ lane: number; registrationId: string; horse: ContextHorse }>;
  distanceMeters?: number;
  tournamentName?: string;
  surface?: string;
}

export function canSimulate(role: string, mode: SimulationMode): boolean {
  return (role === 'VETERINARIAN' && mode === 'EXAM') || (role === 'HEAD_TRAINER' && mode === 'WORKOUT') || (role === 'CLUB_MANAGER' && mode === 'RACE');
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_SIMULATOR_CONTEXT');
  return value as Record<string, unknown>;
}
function validateHorse(value: unknown) {
  const h = object(value);
  if (typeof h.id !== 'string' || !h.id.trim() || typeof h.name !== 'string' || typeof h.isMedicalLocked !== 'boolean' || typeof h.status !== 'string') throw new Error('INVALID_SIMULATOR_CONTEXT');
}
function distance(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 100000) throw new Error('INVALID_SIMULATOR_CONTEXT');
}
export function validateContext(sessionId: string, mode: SimulationMode, raw: unknown): SimulationContext {
  const ctx = object(raw);
  if (!sessionId.trim() || ctx.sessionId !== sessionId || ctx.type !== mode) throw new Error('INVALID_SIMULATOR_CONTEXT');
  if (ctx.status !== 'PENDING' && ctx.status !== 'RUNNING') throw new Error('SIMULATION_ALREADY_FINISHED');
  validateHorse(ctx.horse);
  if (mode === 'WORKOUT') {
    const w = object(ctx.workout);
    distance(w.distanceMeters);
    if (typeof w.id !== 'string' || !['LIGHT', 'MEDIUM', 'MODERATE', 'HEAVY'].includes(String(w.intensity))) throw new Error('INVALID_SIMULATOR_CONTEXT');
  }
  if (mode === 'RACE') {
    distance(ctx.distanceMeters);
    if (!Array.isArray(ctx.entries) || ctx.entries.length < 2) throw new Error('INVALID_SIMULATOR_CONTEXT');
    const ids = new Set(), lanes = new Set();
    for (const item of ctx.entries) {
      const e = object(item); validateHorse(e.horse);
      const id = object(e.horse).id;
      if (!Number.isInteger(e.lane) || Number(e.lane) < 1 || ids.has(id) || lanes.has(e.lane)) throw new Error('INVALID_SIMULATOR_CONTEXT');
      ids.add(id); lanes.add(e.lane);
    }
  }
  return raw as SimulationContext;
}

export async function resolveContext(sessionId: string, mode: SimulationMode, raw: unknown, loadHorse: (id: string) => Promise<unknown>): Promise<SimulationContext> {
  const ctx = object(raw);
  if (ctx.sessionId !== sessionId || ctx.type !== mode) throw new Error('INVALID_SIMULATOR_CONTEXT');
  if (ctx.status !== 'PENDING' && ctx.status !== 'RUNNING') throw new Error('SIMULATION_ALREADY_FINISHED');
  if (mode !== 'RACE' || !Array.isArray(ctx.entries)) return validateContext(sessionId, mode, raw);
  // Race contexts omit medical-lock fields; fetch current authoritative profiles before starting.
  const entries = await Promise.all(ctx.entries.map(async item => {
    const entry = object(item), partial = object(entry.horse);
    if (typeof partial.id !== 'string' || !partial.id.trim()) throw new Error('INVALID_SIMULATOR_CONTEXT');
    const horse = object(await loadHorse(partial.id));
    if (horse.id !== partial.id) throw new Error('INVALID_SIMULATOR_CONTEXT');
    return { ...entry, horse };
  }));
  return validateContext(sessionId, mode, { ...ctx, entries, horse: entries[0]?.horse });
}

export function isSafeRecovery(context: SimulationContext): boolean {
  return context.type === 'WORKOUT' && context.workout?.intensity === 'LIGHT' && ['WALK', 'SWIM', 'RECOVERY_SWIM'].includes(context.workout?.workoutType || '');
}

export interface SessionModel {
  context: SimulationContext;
  horses: HorseProfile[];
  runs: RunState[];
  race: Race | null;
  done: boolean;
}
function surface(value?: string): Surface {
  return value === 'SAND' || value === 'DIRT' ? 'SAND' : value === 'MIXED' || value === 'SYNTHETIC' ? 'MIXED' : 'GRASS';
}
export function createSessionModel(context: SimulationContext, seed = 42): SessionModel {
  const rawHorses = context.type === 'RACE' ? context.entries!.map(e => e.horse) : [context.horse];
  const horses = rawHorses.map(toHorseProfile);
  if (context.type !== 'EXAM' && !isSafeRecovery(context) && horses.some(h => h.health === 'INJURED' || h.health === 'ISOLATED' || h.medicalLock)) throw new Error('MEDICAL_LOCK_ACTIVE');
  if (context.type === 'RACE') {
    const race = createRace(horses, context.distanceMeters!, surface(context.surface), seed);
    race.entries.forEach((e, i) => { e.lane = context.entries![i].lane; });
    return { context, horses, runs: race.entries.map(e => e.run), race, done: false };
  }
  const intensity = context.workout?.intensity === 'MEDIUM' ? 'MODERATE' : context.workout?.intensity;
  const run = createRun(horses[0], { surface: surface(context.workout?.trackSurface), distanceM: context.workout?.distanceMeters ?? 1, pace: INTENSITY_PACE[intensity as keyof typeof INTENSITY_PACE] ?? INTENSITY_PACE.LIGHT }, seed);
  return { context, horses, runs: [run], race: null, done: false };
}
export function stepSession(model: SessionModel, dt: number) {
  if (model.done) return;
  if (model.context.type === 'EXAM') { model.done = true; return; }
  if (model.race) { stepRace(model.race, dt); model.done = model.race.done; }
  else {
    stepRun(model.runs[0], model.horses[0], dt);
    // Compute ten-minute recovery immediately; the gateway expires a live session after five real minutes.
    finishRecovery(model);
    model.done = ['FINISHED', 'ABORTED_INJURY'].includes(model.runs[0].status);
  }
}
export function finishRecovery(model: SessionModel) {
  if (model.context.type === 'WORKOUT' && model.runs[0].status === 'COOLDOWN') {
    completeCooldown(model.runs[0], model.horses[0]); model.done = true;
  }
}
export function sessionPacket(model: SessionModel): Record<string, unknown> {
  const id = model.context.sessionId;
  if (model.context.type === 'EXAM') return examFinishedPacket(id, model.horses[0]);
  return model.race ? raceFinishedPacket(id, model.race) : workoutFinishedPacket(id, model.horses[0], model.runs[0]);
}

export interface VisualFrame {
  time: number;
  runners: Array<{ id: string; name: string; lane: number; distance: number; speed: number; hr: number; stamina: number; finished: boolean }>;
}
export function snapshot(model: SessionModel): VisualFrame {
  const entries = model.race ? standings(model.race) : [{ horse: model.horses[0], run: model.runs[0], lane: 1 }];
  return { time: model.race?.t ?? model.runs[0].t, runners: entries.map(({ horse: h, run, lane }) => ({
    id: h.id, name: h.name, lane,
    distance: Math.min(run.distance, run.targetM), speed: run.v * 3.6,
    hr: run.hr, stamina: run.stamina, finished: run.finishTime !== null,
  })) };
}

