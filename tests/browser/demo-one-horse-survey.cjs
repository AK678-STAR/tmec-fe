const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(root, 'src/shared/components/DemoMagicToolkit.tsx'), 'utf8');
const password = source.match(/await login\(email, "([^"]+)"/)?.[1];
assert.ok(password, 'Demo login credentials must be available in the existing Toolkit');
const base = 'http://localhost:5173';
const out = path.resolve(root, '../tmp/demo-one-horse-browser-evidence.json');
(async () => {
 const browser = await chromium.launch({ headless: false });
 const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'vi-VN' });
 const page = await context.newPage();
 const evidence = { checkedAt: new Date().toISOString(), mode:'read-only UI survey; login and account switches only', browser:'headed Chromium via Playwright; agent-browser daemon failed on Windows', screens:[], errors:[] };
 page.on('pageerror', err => evidence.errors.push(err.message));
 page.on('response', res => { if(res.status() >= 400) evidence.errors.push(`${res.status()} ${new URL(res.url()).pathname}`); });
 async function capture(role, route) {
  await page.goto(base + route, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading').first().waitFor({ state:'visible', timeout:20000 });
  await page.getByRole('status').filter({hasText:/Đang tải|Loading/}).waitFor({state:'hidden',timeout:10000}).catch(()=>{});
  const headings = await page.getByRole('heading').allTextContents();
  const buttons = await page.getByRole('button').allTextContents();
  evidence.screens.push({role, requestedRoute:route, actualPath:new URL(page.url()).pathname, headings,buttons,text:(await page.locator('body').innerText()).slice(0,18000)});
  fs.writeFileSync(out, JSON.stringify(evidence,null,2));
  console.log(`UI ${role}: ${route} -> ${new URL(page.url()).pathname}; ${headings.join(' | ')}`);
 }
 async function switchRole(email) {
  await page.getByRole('button',{name:'Nút Thần Thánh',exact:true}).click();
  const dialog = page.getByRole('dialog');
  await Promise.all([page.waitForEvent('framenavigated',{predicate:f=>f===page.mainFrame(),timeout:20000}), dialog.getByRole('button').filter({hasText:`(${email.split('@')[0]})`}).click()]);
  await page.getByRole('button',{name:'Nút Thần Thánh',exact:true}).waitFor({state:'visible',timeout:15000});
 }
 try {
  await page.goto(base+'/login');
  await page.getByRole('textbox',{name:'Email',exact:true}).fill('owner@gmail.com');
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();
  await page.waitForURL(url=>!url.pathname.includes('/login'),{timeout:20000});
  await capture('HORSE_OWNER','/horses/new');
  await capture('HORSE_OWNER','/financial-reports');
  await page.getByRole('button',{name:'Nút Thần Thánh',exact:true}).click();
  evidence.toolkitText = await page.getByRole('dialog').innerText();
  await page.getByRole('button',{name:'Đóng bảng điều khiển',exact:true}).click();
  await switchRole('manager@gmail.com');
  await capture('CLUB_MANAGER','/horses/admissions');
  await capture('CLUB_MANAGER','/stable/shifts');
  await capture('CLUB_MANAGER','/races');
  await switchRole('trainer@gmail.com');
  await capture('HEAD_TRAINER','/training/plans');
  await capture('HEAD_TRAINER','/training/plans/new');
  await capture('HEAD_TRAINER','/training');
  await capture('HEAD_TRAINER','/races');
  await switchRole('vet@gmail.com');
  await capture('VETERINARIAN','/medical/admissions');
  await capture('VETERINARIAN','/records');
  await capture('VETERINARIAN','/locks');
  console.log(`Saved evidence: ${out}; ${evidence.screens.length} screens; no business records created or changed.`);
 } catch (error) { evidence.blocker = error.message; console.error(error.message); process.exitCode=1; }
 finally { fs.writeFileSync(out,JSON.stringify(evidence,null,2)); await browser.close(); }
})();
