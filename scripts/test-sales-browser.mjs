/** Run against a locally started Next dev server with RECRUIT_LOCAL_D1=1.
 * Uses synthetic *.example contacts; never sends mail or calls a remote D1.
 * AUTH_SECRET must match that local server. No auth bypass is added to the app.
 */
import assert from 'node:assert/strict';
import { encode } from '@auth/core/jwt';
import { chromium } from 'playwright-core';
import { getPlatformProxy } from 'wrangler';
import path from 'node:path';
if(process.env.RECRUIT_LOCAL_D1!=='1' || !process.env.AUTH_SECRET) throw Error('Set RECRUIT_LOCAL_D1=1 and the local AUTH_SECRET.');
const base='http://127.0.0.1:3005';
const proxy=await getPlatformProxy({envFiles:[],remoteBindings:false});
const db=proxy.env.DB;
const stamp=Date.now(), domain=`sales-ui-${stamp}.example`, userId=`sales-ui-${stamp}`, email=`${userId}@example.test`;
await db.prepare("INSERT INTO users(id,email,name,role,status,auth_provider,terms_accepted_at,created_at) VALUES(?,?,?,'admin','approved','google',?,?)").bind(userId,email,'Local sales UI test',Math.floor(stamp/1000),Math.floor(stamp/1000)).run();
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
let prospectId;
try {
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.route('**/*',route=>['localhost','127.0.0.1'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
  const page=await context.newPage();page.setDefaultTimeout(30000);
  const denied=await context.request.get(`${base}/admin/sales`,{maxRedirects:0});assert.equal(denied.status(),307);assert.ok(denied.headers().location.includes('/login'));
  const token=await encode({token:{sub:userId,email,id:userId,role:'admin',status:'approved',termsAcceptedAt:stamp},secret:process.env.AUTH_SECRET,salt:'authjs.session-token',maxAge:600});
  await context.addCookies([{name:'authjs.session-token',value:token,url:base,httpOnly:true,sameSite:'Lax'}]);
  await page.goto(`${base}/admin/sales`);
  await page.getByText('見込み企業を登録（ログインアカウントは発行しません）').click();
  await page.getByLabel('企業名 *',{exact:true}).fill('Local Example Labs');
  await page.getByLabel('企業ドメイン *（例 example.com）').fill(domain);
  await page.getByLabel('担当者',{exact:true}).fill('Example Hiring');
  await page.getByLabel('連絡先の出典URL').fill(`https://${domain}/contact`);
  await page.getByLabel('連絡経路・送信根拠・確認日').fill('Synthetic local UI test only');
  await page.getByLabel('冒頭の英文1文（求人との確認済みの関連）').fill('I saw your engineering opening.');
  await page.getByLabel('求人ニーズ・確認事項（給与、勤務地、就労資格、必須経験、採用時期、未確認事項）').fill('Canada remote backend role; authorization to confirm.');
  await page.getByRole('button',{name:'保存する',exact:true}).click();
  await page.waitForURL(/\/admin\/sales\/[^/?]+$/);
  prospectId=page.url().split('/').pop();
  assert.ok(await page.getByRole('heading',{name:'Local Example Labs'}).isVisible());
  assert.ok((await page.getByLabel('初回英文下書き').inputValue()).includes('https://en.frogagent.com/stories/'));
  async function activity(kind,summary,reason='') {
    const form=page.locator('form').filter({has:page.locator('select[name="kind"]')});
    await form.locator('[name="kind"]').selectOption(kind);
    await form.locator('[name="summary"]').fill(summary);
    await form.locator('[name="sourceUrl"]').fill(`https://${domain}/thread`);
    await form.locator('[name="reason"]').selectOption(reason);
    await form.locator('[name="approved"]').check();
    await form.getByRole('button',{name:'保存する',exact:true}).click();
    await page.getByText(summary,{exact:true}).first().waitFor();
  }
  await activity('sent','Synthetic sent record — no email sent');
  let record=await db.prepare('SELECT * FROM sales_prospects WHERE id=?').bind(prospectId).first();assert.equal(record.stage,'contacted');assert.ok(record.due_date);
  await activity('needs','Synthetic job received','role_received');
  record=await db.prepare('SELECT * FROM sales_prospects WHERE id=?').bind(prospectId).first();assert.equal(record.stage,'needs_received');assert.equal(record.due_date,null);
  const job=page.locator('form').filter({has:page.getByRole('heading',{name:'受領した求人を登録'})});
  await job.locator('[name="title"]').fill('Backend Engineer');await job.getByRole('button',{name:'保存する',exact:true}).click();
  await page.getByText('受領したニーズを求人として登録: Backend Engineer',{exact:true}).waitFor();
  await activity('stop','Synthetic stop request','unsubscribe');
  await page.getByRole('status').filter({hasText:'連絡停止中'}).waitFor();
  record=await db.prepare('SELECT * FROM sales_prospects WHERE id=?').bind(prospectId).first();assert.equal(record.stopped,1);assert.equal(record.due_date,null);
  await page.screenshot({path:path.resolve('tmp/sales-live-detail-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.resolve('tmp/sales-live-detail-mobile.png'),fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
  await page.setViewportSize({width:1440,height:1000});await page.goto(`${base}/admin/sales`);assert.match(await page.getByText('その企業からの返信',{exact:true}).locator('..').innerText(),/1/);await page.screenshot({path:path.resolve('tmp/sales-live-list.png'),fullPage:true});
  // An authenticated non-admin must still be denied by the real page guard.
  await db.prepare("UPDATE users SET role='employer' WHERE id=?").bind(userId).run();
  const forbidden=await context.request.get(`${base}/admin/sales`,{maxRedirects:0});assert.equal(forbidden.status(),307);assert.ok(forbidden.headers().location.includes('/portal'));
  console.log('PASS real Next UI: anonymous/non-admin denied; create, draft, manual-send record, needs, canonical job, stop, desktop/mobile. No email sent.');
} finally {
  // Only this run's synthetic records are removed from the local database.
  if(prospectId){const p=await db.prepare('SELECT company_id FROM sales_prospects WHERE id=?').bind(prospectId).first();await db.prepare('DELETE FROM sales_activities WHERE prospect_id=?').bind(prospectId).run();await db.prepare('DELETE FROM sales_prospects WHERE id=?').bind(prospectId).run();if(p){await db.prepare('DELETE FROM jobs WHERE company_id=?').bind(p.company_id).run();await db.prepare('DELETE FROM companies WHERE id=?').bind(p.company_id).run();}}
  await db.prepare('DELETE FROM users WHERE id=?').bind(userId).run();
  await browser.close();await proxy.dispose();
}
