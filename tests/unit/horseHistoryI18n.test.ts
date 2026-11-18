import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// Load the actual dictionary and translator without browser-only i18next initialization.
function load(relative: string, imports: Record<string, unknown> = {}) {
  const source = readFileSync(new URL(`../../src/shared/i18n/${relative}.ts`, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} as Record<string, any> };
  runInNewContext(code, { module, exports: module.exports, require: (name: string) => {
    assert.ok(name in imports, `Unexpected import ${name}`);
    return imports[name];
  } });
  return module.exports;
}

const server = load('server-text');
const dictionary = load('vi-text', { './server-text': server });
const language = { language: 'vi' };
const { localizeServerText } = load('tr', { './index': language, './vi-text': dictionary });

test('horse timeline translates system sentences and registration codes while preserving names', () => {
  const examples = [
    ['Moved into stall STALL-H01', 'Chuyển vào ô chuồng STALL-H01'],
    ['Left stall STALL-B10', 'Rời ô chuồng STALL-B10'],
    ['Zone H. Groom: Đinh Công Thành.', 'Khu H. Nhân viên chăm sóc: Đinh Công Thành.'],
    ['Zone B.', 'Khu B.'],
    ['Horse profile created', 'Đã tạo hồ sơ ngựa'],
    ['Registered as Dạ Nguyệt (HR-000017), breed Appaloosa.', 'Đăng ký tên Dạ Nguyệt (HR-000017), giống Ngựa Appaloosa.'],
    ['Race registration: Cúp Quốc Gia 2026', 'Đăng ký thi đấu: Cúp Quốc Gia 2026'],
    ['Registration status: DISQUALIFIED.', 'Trạng thái đăng ký: Bị loại.'],
    ['Status changed from ACTIVE to RESTING', 'Trạng thái đổi từ Đang hoạt động sang Nghỉ ngơi'],
    ['Training plan created: Giáo án sức bền', 'Đã tạo giáo án: Giáo án sức bền'],
    ['Medical examination: Viêm gân', 'Khám thú y: Viêm gân'],
    ['Symptoms: Sưng chân trước.', 'Triệu chứng: Sưng chân trước.'],
  ];
  for (const [en, vi] of examples) assert.equal(localizeServerText(en), vi, en);
});

test('English mode retains original history and names; unknown user text is not rewritten', () => {
  language.language = 'en';
  assert.equal(localizeServerText('Race registration: Cúp Quốc Gia 2026'), 'Race registration: Cúp Quốc Gia 2026');
  assert.equal(localizeServerText('Dạ Nguyệt'), 'Dạ Nguyệt');
  assert.equal(localizeServerText('Khu H. Nhân viên chăm sóc: Đinh Công Thành.'), 'Zone H. Groom: Đinh Công Thành.');
  language.language = 'vi';
  assert.equal(localizeServerText('Bác sĩ dặn theo dõi chân trái.'), 'Bác sĩ dặn theo dõi chân trái.');
  assert.equal(localizeServerText(undefined), '');
});
