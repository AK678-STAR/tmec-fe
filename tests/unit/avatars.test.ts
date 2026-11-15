import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { HORSE_AVATAR_PRESETS, DEFAULT_HORSE_AVATAR, resolveHorseAvatar } from '../../src/features/horses/constants/avatars.ts';

test('19 unique presets have bundled portraits', () => {
  assert.equal(HORSE_AVATAR_PRESETS.length, 19);
  assert.equal(new Set(HORSE_AVATAR_PRESETS.map(p => p.horseCode)).size, 19);
  HORSE_AVATAR_PRESETS.forEach(p => assert.ok(existsSync(new URL(`../../public${p.url}`, import.meta.url))));
});
test('custom avatar takes priority over a preset', () => {
  assert.equal(resolveHorseAvatar('data:image/jpeg;base64,abc', 'HR-000001'), 'data:image/jpeg;base64,abc');
});
test('missing custom avatar resolves by horse code', () => {
  assert.equal(resolveHorseAvatar(null, 'HR-000001'), '/images/horses/horse-01.jpg');
  assert.equal(resolveHorseAvatar('', 'HR-000019'), '/images/horses/horse-19.jpg');
});
test('unknown or absent code resolves to SVG', () => {
  assert.equal(resolveHorseAvatar(undefined, 'unknown'), DEFAULT_HORSE_AVATAR);
  assert.equal(resolveHorseAvatar(), DEFAULT_HORSE_AVATAR);
  assert.ok(DEFAULT_HORSE_AVATAR.startsWith('data:image/svg+xml,'));
});
