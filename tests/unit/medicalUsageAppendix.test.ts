import test from 'node:test';
import assert from 'node:assert/strict';
import { medicalUsageRows, escapePrintText } from '../../src/features/financial/medicalUsageAppendix.ts';
import { buildXlsx } from '../../src/shared/lib/xlsx.ts';
test('actual medical appendix preserves usage/pricing snapshots and treats formula-like text as text',()=>{
  const invoices=[{billingPeriod:'2026-11',horse:{name:'=HYPERLINK("https://example.test")'},lineItems:[{recordNumber:'<script>bad()</script>',prescribedAt:'2026-11-01T00:00Z',performedAt:'2026-11-02T00:00Z',veterinarianName:'QA Vet',supplyName:'<img src=x onerror=bad()>',quantity:'0.125',unit:'PILL',unitPrice:'90000',amount:'11250',entryType:'CONSUMPTION'}]}];
  const rows=medicalUsageRows(invoices as any);
  assert.equal(rows[0][7],0.125);assert.equal(rows[0][9],90000);assert.equal(rows[0][10],11250);
  assert.notEqual(rows[0][3],rows[0][4]);
  const xml=new TextDecoder().decode(buildXlsx([{name:'Medical usage',rows}]));
  assert.ok(xml.includes('t="inlineStr"'));assert.ok(xml.includes('=HYPERLINK'));assert.ok(!xml.includes('<f>'));assert.ok(!xml.includes('<script>'));assert.ok(xml.includes('&lt;img'));
  assert.equal(escapePrintText('<script>bad()</script>'),'&lt;script&gt;bad()&lt;/script&gt;');
});
