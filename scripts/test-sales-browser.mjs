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
const base=process.env.SALES_TEST_BASE_URL || 'http://127.0.0.1:3005';
if (!['127.0.0.1','localhost'].includes(new URL(base).hostname)) throw Error('Local server only.');
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
  let mutation;
  page.on('request',req=>{if(req.method()==='POST'&&req.headers()['next-action']) mutation={url:req.url(),headers:{'next-action':req.headers()['next-action'],'content-type':req.headers()['content-type']},data:req.postData()};});
  const privateMarker='PRIVATE_SALES_NOT_FOR_EMPLOYERS';
  const denied=await context.request.get(`${base}/admin/sales`,{maxRedirects:0});assert.equal(denied.status(),307);assert.ok(denied.headers().location.includes('/login'));
  const token=await encode({token:{sub:userId,email,id:userId,role:'admin',status:'approved',termsAcceptedAt:stamp},secret:process.env.AUTH_SECRET,salt:'authjs.session-token',maxAge:600});
  await context.addCookies([{name:'authjs.session-token',value:token,url:base,httpOnly:true,sameSite:'Lax'}]);
  await page.goto(`${base}/admin/sales`);
  await page.locator(".sales-heading a").click();
  assert.equal(await page.locator("#new-prospect").evaluate(el=>el.open),true);
  await page.getByLabel('企業名 *',{exact:true}).fill('Local Example Labs');
  await page.getByLabel('企業ドメイン *（例 example.com）').fill(domain);
  await page.getByLabel('担当者',{exact:true}).fill('Example Hiring');
  await page.getByLabel('連絡先の出典URL').fill(`https://${domain}/contact`);
  await page.getByLabel('連絡経路・送信根拠・確認日').fill('Synthetic local UI test only');
  await page.getByLabel('冒頭の英文1文（求人との確認済みの関連）').fill('I saw your engineering opening.');
  await page.getByLabel('求人ニーズ・確認事項（給与、勤務地、就労資格、必須経験、採用時期、未確認事項）').fill(privateMarker+'; Canada remote backend role; authorization to confirm.');
  await page.getByRole('button',{name:'保存する',exact:true}).click();
  await page.waitForURL(/\/admin\/sales\/[^/?]+$/);
  prospectId=page.url().split('/').pop();
  await page.locator('.sales-next a').click();
  assert.equal(await page.locator('#edit-prospect').evaluate(el=>el.open),true);
  await page.locator('#edit-prospect > summary').click();
  assert.ok(await page.getByRole('heading',{name:'Local Example Labs'}).isVisible());
  await page.getByText('英文下書き・追送文を確認',{exact:true}).click();
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
  await page.getByText('英文下書き・追送文を確認',{exact:true}).click();
  await activity('sent','Synthetic sent record — no email sent');
  let record=await db.prepare('SELECT * FROM sales_prospects WHERE id=?').bind(prospectId).first();assert.equal(record.stage,'contacted');assert.ok(record.due_date);
  await activity('needs','Synthetic job received','role_received');
  record=await db.prepare('SELECT * FROM sales_prospects WHERE id=?').bind(prospectId).first();assert.equal(record.stage,'needs_received');assert.equal(record.due_date,null);
  await page.locator('summary').filter({hasText:'受領した求人を登録'}).click();
  const job=page.locator('form').filter({has:page.getByRole('heading',{name:'受領した求人を登録'})});
  await job.locator('[name="title"]').fill('Backend Engineer');await job.locator('[name="sharedDescription"]').fill('Approved public backend role');await job.locator('[name="shareApproved"]').check();await job.getByRole('button',{name:'保存する',exact:true}).click();
  await page.getByText('受領したニーズを求人として登録: Backend Engineer',{exact:true}).waitFor();
  await activity('note','<img src=x onerror=window.salesXss=1>');
  assert.equal(await page.evaluate(()=>window.salesXss),undefined);
  await activity('stop','Synthetic stop request','unsubscribe');
  await page.getByRole('status').filter({hasText:'連絡停止中'}).waitFor();
  record=await db.prepare('SELECT * FROM sales_prospects WHERE id=?').bind(prospectId).first();assert.equal(record.stopped,1);assert.equal(record.due_date,null);
  await page.screenshot({path:path.resolve('tmp/sales-live-detail-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.resolve('tmp/sales-live-detail-mobile.png'),fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
  await page.setViewportSize({width:1440,height:1000});await page.goto(`${base}/admin/sales`);await page.getByText('活動の振り返り · 過去28日',{exact:true}).click();assert.match(await page.getByText('その企業からの返信',{exact:true}).locator('..').innerText(),/1/);await page.screenshot({path:path.resolve('tmp/sales-live-list.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:path.resolve("tmp/sales-live-list-mobile.png"),fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
  const search=page.getByLabel('企業・ドメイン・担当者で検索');await search.fill(privateMarker);assert.ok(!page.url().includes(privateMarker));await search.fill('');
  assert.ok(await page.locator('header img[alt="Frog"]').getAttribute('src').then(src=>src.includes('corporate')));
  const headers=(await context.request.get(`${base}/admin/sales/${prospectId}`)).headers();assert.match(headers['cache-control'],/no-store/);assert.equal(headers['referrer-policy'],'no-referrer');
  assert.ok(mutation);
  const before=await db.prepare('SELECT count(*) n FROM sales_activities WHERE prospect_id=?').bind(prospectId).first();
  const cross=await context.request.post(mutation.url,{headers:{...mutation.headers,origin:'https://untrusted.example'},data:mutation.data});assert.ok(cross.status()>=400);
  await db.prepare("UPDATE users SET status='rejected' WHERE id=?").bind(userId).run();
  assert.equal((await context.request.get(`${base}/admin/sales/${prospectId}`,{maxRedirects:0})).status(),307);
  await db.prepare("UPDATE users SET status='approved', employer_company_id=? WHERE id=?").bind(record.company_id,userId).run();
  // An authenticated non-admin must still be denied by the real page guard.
  await db.prepare("UPDATE users SET role='employer' WHERE id=?").bind(userId).run();
  const forbidden=await context.request.get(`${base}/admin/sales`,{maxRedirects:0});assert.equal(forbidden.status(),307);assert.ok(forbidden.headers().location.includes('/portal'));
  for(const target of ['/admin/sales/'+prospectId,'/admin/sales?view=today','/admin/job-inbox/'+prospectId,'/admin/companies','/admin/grants']) {
    const response=await context.request.get(base+target,{maxRedirects:0});assert.equal(response.status(),307);assert.ok(!(await response.text()).includes(privateMarker));
  }
  const roles=await context.request.get(base+'/portal/roles');const html=await roles.text();assert.ok(html.includes('Approved public backend role'));assert.ok(!html.includes(privateMarker));
  for(const role of ['employer','candidate','anonymous']) {
    if(role==='candidate')await db.prepare("UPDATE users SET role='candidate' WHERE id=?").bind(userId).run();
    if(role==='anonymous')await context.clearCookies();
    const rejected=await context.request.post(mutation.url,{headers:{...mutation.headers,origin:base},data:mutation.data,maxRedirects:0});assert.ok(!(await rejected.text()).includes(privateMarker));assert.ok(rejected.status()===303||rejected.status()===307||rejected.headers()['x-action-redirect']);
    const api=await context.request.post(base+'/api/desk/job-leads',{headers:{authorization:'Bearer local-test-only'},data:{sourceUrl:'https://example.test/jobs'}});assert.equal(api.status(),401);
    assert.equal((await context.request.get(base+'/admin/sales/'+prospectId,{maxRedirects:0})).status(),307);
  }
  const after=await db.prepare('SELECT count(*) n FROM sales_activities WHERE prospect_id=?').bind(prospectId).first();assert.equal(after.n,before.n);
  console.log('PASS security: real unauthenticated/employer ID reads and mutation replays denied; disabled admin denied; cross-origin rejected; private caches; escaped XSS; employer page excludes internal notes.');
  console.log('PASS real Next UI: anonymous/non-admin denied; create, draft, manual-send record, needs, canonical job, stop, desktop/mobile. No email sent.');
} finally {
  // Only this run's synthetic records are removed from the local database.
  if(!prospectId) prospectId=(await db.prepare('SELECT id FROM sales_prospects WHERE domain=?').bind(domain).first())?.id;
  if(prospectId){const p=await db.prepare('SELECT company_id FROM sales_prospects WHERE id=?').bind(prospectId).first();await db.prepare('DELETE FROM sales_activities WHERE prospect_id=?').bind(prospectId).run();await db.prepare('DELETE FROM sales_prospects WHERE id=?').bind(prospectId).run();if(p){await db.prepare('DELETE FROM jobs WHERE company_id=?').bind(p.company_id).run();await db.prepare('DELETE FROM companies WHERE id=?').bind(p.company_id).run();}}
  await db.prepare('DELETE FROM users WHERE id=?').bind(userId).run();
  await browser.close();await proxy.dispose();
}
