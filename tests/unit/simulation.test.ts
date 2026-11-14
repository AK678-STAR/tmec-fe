import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canSimulate, validateContext, createSessionModel, stepSession, sessionPacket, resolveContext, snapshot, isSafeRecovery } from '../../src/features/simulation/model.ts';

const horse = { id: 'h1', name: 'Atlas', status: 'ACTIVE', isMedicalLocked: false, weightKg: 480 };
const context = { type: 'WORKOUT', sessionId: 's1', status: 'PENDING', horse, workout: { id: 'w1', distanceMeters: 800, intensity: 'HEAVY', trackSurface: 'TURF' } };
test('only the corresponding role can simulate each mode', () => {
  for (const role of ['VETERINARIAN', 'HEAD_TRAINER', 'CLUB_MANAGER', 'GROOM', 'HORSE_OWNER']) {
    for (const mode of ['EXAM', 'WORKOUT', 'RACE'] as const) {
      assert.equal(canSimulate(role, mode), ({ VETERINARIAN: 'EXAM', HEAD_TRAINER: 'WORKOUT', CLUB_MANAGER: 'RACE' } as Record<string, string>)[role] === mode);
    }
  }
});
test('reject wrong session, mode, completed status and invalid distance', () => {
  assert.throws(() => validateContext('other', 'WORKOUT', context));
  assert.throws(() => validateContext('s1', 'EXAM', context));
  assert.throws(() => validateContext('s1', 'WORKOUT', { ...context, status: 'COMPLETED' }));
  assert.throws(() => validateContext('s1', 'WORKOUT', { ...context, workout: { ...context.workout, distanceMeters: 0 } }));
});
test('locked horses cannot start heavy work or races', () => {
  assert.throws(() => createSessionModel(validateContext('s1', 'WORKOUT', { ...context, horse: { ...horse, isMedicalLocked: true } })));
});
test('seeded workout reaches completion and keeps stable packet identity', () => {
  const valid = validateContext('s1', 'WORKOUT', context);
  const a = createSessionModel(valid, 42), b = createSessionModel(valid, 42);
  for (let i = 0; i < 25000 && !a.done; i++) { stepSession(a, 0.05); stepSession(b, 0.05); }
  assert.ok(a.done);
  assert.deepEqual(sessionPacket(a), sessionPacket(b));
  assert.equal(sessionPacket(a).session_id, 's1');
  assert.equal(sessionPacket(a).packet_id, 'fin-s1-h1');
});
test('real backend MEDIUM intensity uses the moderate engine pace', () => {
  const model = createSessionModel(validateContext('s1', 'WORKOUT', { ...context, workout: { ...context.workout, intensity: 'MEDIUM' } }));
  assert.equal(model.runs[0].pace, 0.7);
});
test('default workout computes ten-minute recovery before the server five-minute lifetime', () => {
  const model = createSessionModel(validateContext('s1', 'WORKOUT', context));
  let elapsed = 0;
  while (!model.done && elapsed < 300) { stepSession(model, 0.05); elapsed += 0.05; }
  assert.ok(model.done);
  assert.ok(model.runs[0].hrRecovery10m !== null);
});
test('explicit light recovery remains permitted for a medically locked injured horse', () => {
  const ctx = validateContext('s1', 'WORKOUT', { ...context, horse: { ...horse, status: 'INJURED', isMedicalLocked: true }, workout: { ...context.workout, intensity: 'LIGHT', workoutType: 'WALK' } });
  assert.equal(isSafeRecovery(ctx), true);
  assert.doesNotThrow(() => createSessionModel(ctx));
});
test('race context missing lock fields hydrates real horse profiles and rejects locked entries', async () => {
  const partialHorse = { id: 'h1', name: 'Atlas', status: 'ACTIVE' };
  const raw = { type: 'RACE', sessionId: 'r1', status: 'PENDING', horse: partialHorse, distanceMeters: 1200, surface: 'GRASS', entries: [{ lane: 2, horse: partialHorse }, { lane: 5, horse: { ...partialHorse, id: 'h2' } }] };
  const calls: string[] = [];
  const ctx = await resolveContext('r1', 'RACE', raw, async id => { calls.push(id); return { ...horse, id }; });
  assert.deepEqual(calls, ['h1', 'h2']);
  assert.deepEqual(createSessionModel(ctx).race!.entries.map(e => e.lane), [2, 5]);
  const locked = await resolveContext('r1', 'RACE', raw, async id => ({ ...horse, id, isMedicalLocked: true }));
  assert.throws(() => createSessionModel(locked));
  await assert.rejects(resolveContext('wrong', 'RACE', raw, async () => { throw new Error('must not fetch'); }), /INVALID_SIMULATOR_CONTEXT/);
});
test('displayed race rankings match engine finish-time order when every horse reached the finish', async () => {
  const ctx = await resolveContext('r1', 'RACE', { type: 'RACE', sessionId: 'r1', status: 'PENDING', horse, distanceMeters: 800, entries: [{ lane: 1, horse }, { lane: 2, horse: { ...horse, id: 'h2' } }] }, async id => ({ ...horse, id }));
  const model = createSessionModel(ctx);
  model.race!.entries[0].run.finishTime = 60;
  model.race!.entries[1].run.finishTime = 50;
  model.runs.forEach(r => { r.distance = r.targetM; });
  assert.deepEqual(snapshot(model).runners.map(r => r.id), ['h2', 'h1']);
});
