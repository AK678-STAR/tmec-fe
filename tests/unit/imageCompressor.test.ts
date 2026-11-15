import test from 'node:test';
import assert from 'node:assert/strict';
import { compressImageFile } from '../../src/shared/utils/imageCompressor.ts';

test('non-image MIME types fail before browser APIs are used', async () => {
  await assert.rejects(compressImageFile(new File(['pdf'], 'report.pdf', { type: 'application/pdf' })), /image/i);
});

test('invalid compression dimensions and quality are rejected', async () => {
  const file = new File(['image'], 'horse.jpg', { type: 'image/jpeg' });
  for (const options of [{ maxWidth: 0 }, { maxHeight: NaN }, { quality: 2 }]) {
    await assert.rejects(compressImageFile(file, options), /options/i);
  }
});

test('unreadable images reject and release the object URL', async (t) => {
  let revoked = false;
  t.mock.method(URL, 'createObjectURL', () => 'blob:broken');
  t.mock.method(URL, 'revokeObjectURL', () => { revoked = true; });
  t.after(() => { Reflect.deleteProperty(globalThis, 'Image'); });
  Object.defineProperty(globalThis, 'Image', { configurable: true, value: class {
    onerror: (() => void) | null = null;
    set src(_value: string) { queueMicrotask(() => this.onerror?.()); }
  }});
  await assert.rejects(compressImageFile(new File(['broken'], 'horse.jpg', { type: 'image/jpeg' })), /read this image/);
  assert.ok(revoked);
});

test('compression resizes proportionally, limits encoded size and releases the object URL', async (t) => {
  let revoked = false;
  const qualities: number[] = [];
  const canvas = {
    width: 0, height: 0,
    getContext: () => ({ fillStyle: '', fillRect() {}, drawImage() {} }),
    toDataURL: (_type: string, quality: number) => {
      qualities.push(quality);
      return 'data:image/jpeg;base64,' + 'a'.repeat(quality > 0.6 ? 70000 : 1000);
    },
  };
  t.mock.method(URL, 'createObjectURL', () => 'blob:test');
  t.mock.method(URL, 'revokeObjectURL', () => { revoked = true; });
  t.after(() => { Reflect.deleteProperty(globalThis, 'Image'); Reflect.deleteProperty(globalThis, 'document'); });
  Object.defineProperty(globalThis, 'Image', { configurable: true, value: class {
    naturalWidth = 1600; naturalHeight = 800;
    onload: (() => void) | null = null;
    set src(_value: string) { queueMicrotask(() => this.onload?.()); }
  }});
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => canvas } });
  const result = await compressImageFile(new File(['image'], 'horse.jpg', { type: 'image/jpeg' }));
  assert.equal(canvas.width, 400);
  assert.equal(canvas.height, 200);
  assert.equal(qualities[0], 0.8);
  assert.ok(result.length <= 50 * 1024);
  assert.ok(revoked);
});
