/* eslint-disable @typescript-eslint/no-require-imports -- CJS hooks load TS fixtures without emitting files. */
/* Local-only integration tests. In-memory SQLite, no credentials or network. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const Module = require('node:module');
const ts = require('typescript');
const { DatabaseSync } = require('node:sqlite');
const root = path.resolve(__dirname, '..');
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (name, ...args) { return originalResolve.call(this, name.startsWith('@/') ? path.join(root,'src',name.slice(2)) : name, ...args); };
for (const ext of ['.ts','.tsx']) require.extensions[ext] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'), { compilerOptions: {module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2022, jsx:ts.JsxEmit.ReactJSX, esModuleInterop:true} }).outputText, filename);
const sqlite = new DatabaseSync(':memory:');
sqlite.exec('PRAGMA foreign_keys=ON');
for (const file of ['0001_init.sql','0005_job_leads.sql','0006_job_leads_currency.sql','0010_sales_desk.sql']) sqlite.exec(fs.readFileSync(path.join(root,'scripts/migrations',file),'utf8'));
class Statement {
  constructor(query,values=[]) { this.query=query;this.values=values; }
  bind(...values) { return new Statement(this.query, values); }
  execute() { const stmt=sqlite.prepare(this.query); const results=stmt.all(...this.values); return {results,success:true,meta:{changes:Number(sqlite.prepare('SELECT changes() AS n').get().n)}}; }
  async all() {return this.execute();}
  async run() {return this.execute();}
  async raw() {
    // Give each selected expression a unique alias (Node 22.12 lacks returnArrays).
    const query=this.query.replace(/^select (.*?) from /is,(_,fields)=>'select '+fields.split(',').map((f,i)=>f.replace(/\s+as\s+"[^"]+"$/i,'')+` AS "test_col_${i}"`).join(',')+' from ');
    return sqlite.prepare(query).all(...this.values).map(Object.values);
  }
  async first() {return this.execute().results[0]??null;}
}
const d1={prepare:query=>new Statement(query),batch:async statements=>{sqlite.exec('BEGIN');try {const r=statements.map(s=>s.execute());sqlite.exec('COMMIT');return r;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
const { drizzle }=require('drizzle-orm/d1');
const db=drizzle(d1);
const service=require('../src/lib/sales/service.ts');
const model=require('../src/lib/sales/model.ts');
const base={companyName:'Example Labs',companyId:'',domain:'https://www.example.com/jobs',jobId:'',jobUrl:'https://example.com/jobs',contactName:'Test Hiring',contactRole:'Hiring lead',contactEmail:'hiring@example.com',contactSourceUrl:'https://example.com/contact',contactBasis:'Fixture: manual review',stage:'research',owner:'Test staff',nextAction:'Review initial draft',dueDate:'2026-09-28',openingLine:'I saw your engineering opening.',needs:'Backend role; Canada remote; work authorization to confirm.'};
const event={kind:'sent',summary:'Manually sent fixture',sourceUrl:'https://mail.example.com/thread/1',reason:'',templateVersion:model.TEMPLATE_VERSION,minutes:12,occurredOn:'2026-09-21',approved:true};
let count=0;
async function check(name,fn){await fn();count++;console.log(`PASS ${name}`);}
async function main(){
  let id;
  await check('create prospect without account/grant/mail',async()=>{id=await service.createProspect(db,base,'test-admin');assert.equal(sqlite.prepare('SELECT count(*) n FROM users').get().n,0);assert.equal(sqlite.prepare('SELECT count(*) n FROM access_grants').get().n,0);});
  await check('domain normalization and dedup preserve stopped/history records',async()=>{assert.equal(await service.createProspect(db,{...base,domain:'example.com'},'test-admin'),id);assert.equal(sqlite.prepare('SELECT count(*) n FROM companies').get().n,1);});
  await check('initial send requires manual approval and evidence',async()=>{await assert.rejects(()=>service.recordActivity(db,id,0,{...event,approved:false},'test-admin'));await service.recordActivity(db,id,0,event,'test-admin');assert.equal((await service.getProspect(db,id)).dueDate,'2026-09-28');});
  await check('stale tab cannot overwrite changes',async()=>{await assert.rejects(()=>service.recordActivity(db,id,0,{...event,kind:'note'},'test-admin'));});
  await check('followup too early rejected',async()=>{await assert.rejects(()=>service.recordActivity(db,id,1,{...event,kind:'followup',occurredOn:'2026-09-22'},'test-admin'));});
  await check('single followup only',async()=>{await service.recordActivity(db,id,1,{...event,kind:'followup',occurredOn:'2026-09-28'},'test-admin');await assert.rejects(()=>service.recordActivity(db,id,2,{...event,kind:'followup',occurredOn:'2026-10-02'},'test-admin'));});
  await check('reply clears followup date and action',async()=>{await service.recordActivity(db,id,2,{...event,kind:'reply',reason:'interested'},'test-admin');const r=await service.getProspect(db,id);assert.equal(r.dueDate,null);assert.equal(r.nextAction,'');});
  await check('stop prevents further contact; preserves reason',async()=>{await service.recordActivity(db,id,3,{...event,kind:'stop',reason:'unsubscribe',summary:'Do not contact'},'test-admin');const r=await service.getProspect(db,id);assert.equal(r.stopped,true);await assert.rejects(()=>service.recordActivity(db,id,4,event,'test-admin'));await assert.rejects(()=>service.updateProspect(db,id,4,{...base,companyId:r.companyId,domain:r.domain},'test-admin'));});
  await check('cannot reopen without original request and approval',async()=>{await assert.rejects(()=>service.recordActivity(db,id,4,{...event,kind:'reopen',sourceUrl:''},'test-admin'));await service.recordActivity(db,id,4,{...event,kind:'reopen'},'test-admin');});
  await check('safe URLs and invalid dates rejected',async()=>{assert.equal(model.safeUrl.safeParse('javascript:alert(1)').success,false);assert.equal(model.dateOnly.safeParse('2026-99-01').success,false);assert.equal(model.dateOnly.safeParse('2026-02-30').success,false);});
  await check('foreign-company job cannot be linked',async()=>{const r=await service.getProspect(db,id);await assert.rejects(()=>service.updateProspect(db,id,5,{...base,domain:r.domain,companyId:r.companyId,jobId:'foreign-job'},'test-admin'));});
  await check('received needs become canonical job without candidate sharing',async()=>{await service.createSalesJob(db,id,5,'Backend Engineer','test-admin');const r=await service.getProspect(db,id);assert.ok(r.jobId);await service.recordActivity(db,id,6,{...event,kind:'handoff'},'test-admin');assert.equal((await service.getProspect(db,id)).stage,'introduction');assert.equal(sqlite.prepare('SELECT count(*) n FROM access_grants').get().n,0);});
  await check('edit keeps company/job ownership and logs next action',async()=>{const r=await service.getProspect(db,id);await service.updateProspect(db,id,7,{...base,companyId:r.companyId,domain:r.domain,jobId:r.jobId,stage:'introduction'},'test-admin');assert.equal((await service.getProspect(db,id)).version,8);});
  await check('converted Inbox evidence cannot be deleted',async()=>{sqlite.exec("INSERT INTO job_leads(id,source_url,captured_at,updated_at,converted_job_id) VALUES('fixture-lead','https://example.com/job',0,0,'fixture-job')");assert.throws(()=>sqlite.exec("DELETE FROM job_leads WHERE id='fixture-lead'"));});
  await check('draft has correct URLs, pricing, and no hiring guarantee',async()=>{const draft=model.storyDraft(base.openingLine);assert.ok(draft.includes(model.STORIES_URL));assert.ok(draft.includes(model.VIDEO_URL));assert.ok(draft.includes('5%'));assert.ok(draft.includes('12 months'));assert.ok(!draft.includes('guarantee'));});
  await check('Inbox conversion reuses chosen company, retains source, and is idempotent',async()=>{
    const load=Module._load;process.env.JOB_INBOX_ENABLED='1';
    Module._load=function(name,...args){if(name==='@/lib/auth/helpers')return {requireAdmin:async()=>({user:{id:'test-admin'}})};if(name==='@/lib/db/client')return {getD1Db:async()=>db};if(name==='next/cache')return {revalidatePath(){}};if(name==='next/navigation')return {redirect:url=>{throw Error(`redirect:${url}`);}};return load.call(this,name,...args);};
    try {
      const {convertJobLead}=require('../src/lib/job-inbox/actions.ts');
      sqlite.exec("INSERT INTO job_leads(id,source_url,company_name_raw,title_raw,captured_at,updated_at) VALUES('convert-fixture','https://example.com/jobs/new','Example Labs','Engineer',0,0)");
      const row=await service.getProspect(db,id), form=new FormData();form.set('id','convert-fixture');form.set('companyId',row.companyId);
      await assert.rejects(()=>convertJobLead(form),/redirect:/);await assert.rejects(()=>convertJobLead(form),/redirect:/);
      assert.equal(sqlite.prepare('SELECT count(*) n FROM companies').get().n,1);
      assert.equal(sqlite.prepare("SELECT count(*) n FROM jobs WHERE id='inbox-job-convert-fixture'").get().n,1);
      assert.equal(sqlite.prepare("SELECT status FROM job_leads WHERE id='convert-fixture'").get().status,'converted');
    } finally {Module._load=load;}
  });
  await check('server actions reject before touching the database when unauthorized',async()=>{
    const load=Module._load;Module._load=function(name,...args){if(name==='@/lib/auth/helpers')return {requireAdmin:async()=>{throw Error('denied');}};if(name==='@/lib/db/client')return {getD1Db:async()=>{throw Error('database should not be reached');}};if(name==='next/cache')return {revalidatePath(){}};return load.call(this,name,...args);};
    try {const actions=require('../src/lib/sales/actions.ts');for(const name of ['createSales','saveSales','addSalesActivity','addSalesJob'])await assert.rejects(()=>actions[name]({},new FormData()),/denied/);}finally{Module._load=load;}
  });
  if(process.argv.includes('--ui')) await renderUI(id);
  console.log(`${count} integration checks passed; in-memory database only.`);
}
async function renderUI(id){
  const React=require('react'); const {renderToString}=require('react-dom/server');
  const originalLoad=Module._load;
  Module._load=function(name,parent,...args){
    if(name==='next/navigation')return {useRouter:()=>({push(){},refresh(){}}),notFound:()=>{throw Error('not found');}};
    if(name==='next/link')return {__esModule:true,default:({children,...props})=>React.createElement('a',props,children)};
    if(name==='@/lib/auth/helpers')return {requireAdmin:async()=>({user:{id:'test-admin'}})};
    if(name==='@/lib/db/client')return {getD1Db:async()=>db};
    if(name==='@/lib/sales/actions')return Object.fromEntries(['createSales','saveSales','addSalesActivity','addSalesJob'].map(n=>[n,async()=>({saved:true})]));
    return originalLoad.call(this,name,parent,...args);
  };
  const List=require('../src/app/(admin)/admin/sales/page.tsx').default;
  const Detail=require('../src/app/(admin)/admin/sales/[id]/page.tsx').default;
  const list=renderToString(await List({searchParams:Promise.resolve({})}));
  const detail=renderToString(await Detail({params:Promise.resolve({id})}));
  assert.ok(list.includes('Example Labs'));assert.ok(detail.includes('Do not contact'));assert.ok(detail.includes(model.VIDEO_URL));
  const cssFiles=[]; function walk(p){if(!fs.existsSync(p))return;for(const f of fs.readdirSync(p,{withFileTypes:true})){const full=path.join(p,f.name);if(f.isDirectory())walk(full);else if(f.name.endsWith('.css'))cssFiles.push(full);}}
  walk(path.join(root,'.next/static/css'));
  const css=cssFiles.map(f=>fs.readFileSync(f,'utf8')).join('\n');
  const http=require('node:http');
  const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(`<html lang="ja"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><body><main class="max-w-7xl mx-auto p-4"><div class="sales-desk space-y-6 p-5">${req.url==='/detail'?detail:list}</div></main></body></html>`);});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const {chromium}=require('playwright-core');
  const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  try {
    const page=await browser.newPage({viewport:{width:1440,height:1000}});
    await page.goto(`http://127.0.0.1:${server.address().port}`);await page.screenshot({path:path.join(root,'tmp/sales-list-desktop.png'),fullPage:true});
    await page.getByText('見込み企業を登録（ログインアカウントは発行しません）').click();assert.ok(await page.getByLabel('企業名 *',{exact:true}).isVisible());
    await page.goto(`http://127.0.0.1:${server.address().port}/detail`);await page.screenshot({path:path.join(root,'tmp/sales-detail-desktop.png'),fullPage:true});
    await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(root,'tmp/sales-detail-mobile.png'),fullPage:true});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
    console.log('PASS UI: rendered real page components, desktop/mobile, no horizontal overflow (fixture renderer; actions tested separately)');
  } finally {await browser.close();server.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
