import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolvePersonAvatar } from '../../src/shared/utils/personAvatar.ts';

test('people use bundled human portraits consistently, never horse presets', () => {
  for (const name of ['Groom Nam', 'Trainer Mai', 'Vet An', 'Owner Minh']) {
    const url = resolvePersonAvatar(name);
    assert.match(url, /^\/images\/people\/person-\d{2}\.jpg$/);
    assert.equal(resolvePersonAvatar(name), url);
    assert.ok(existsSync(new URL(`../../public${url}`, import.meta.url)));
  }
});

test('uploaded profile photos take priority over the sample portrait', () => {
  assert.equal(resolvePersonAvatar('Groom Nam', 'data:image/jpeg;base64,YWJj'), 'data:image/jpeg;base64,YWJj');
});
