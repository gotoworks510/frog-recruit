// Real HTTP/Auth.js checks; never completes OAuth or uses a real user's credentials.
import assert from 'node:assert/strict';
import http from 'node:http';
import https from 'node:https';
const base=new URL(process.env.SALES_TEST_ORIGIN || 'http://127.0.0.1:3006');
if(!['127.0.0.1','localhost','sales.frog-school.com'].includes(base.hostname))throw Error('Unexpected test target');
function request(path,{host='sales.frog-school.com',method='GET',cookie='',body=''}={}){
  return new Promise((resolve,reject)=>{
    const req=(base.protocol==='https:'?https:http).request(new URL(path,base),{method,headers:{Host:host,'X-Forwarded-Proto':'https',Origin:'https://'+host,Cookie:cookie,'Content-Type':'application/x-www-form-urlencoded','X-Auth-Return-Redirect':'1'}},res=>{
      let text='';res.setEncoding('utf8');res.on('data',c=>text+=c);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,text}));
    });req.on('error',reject);req.end(body);
  });
}
const providers=await request('/api/auth/providers');
assert.equal(providers.status,200);
const available=JSON.parse(providers.text);
assert.deepEqual(Object.keys(available),['google']);
assert.equal(available.google.callbackUrl,'https://sales.frog-school.com/api/auth/callback/google');
const csrf=await request('/api/auth/csrf');
const csrfToken=JSON.parse(csrf.text).csrfToken;assert.ok(csrfToken);
const cookies=csrf.headers['set-cookie'];assert.ok(cookies.length);
for(const cookie of cookies){assert.match(cookie,/; Secure/i);assert.match(cookie,/; HttpOnly/i);assert.ok(!/; Domain=/i.test(cookie));}
const cookie=cookies.map(c=>c.split(';')[0]).join('; ');
const begin=await request('/api/auth/signin/google',{method:'POST',cookie,body:new URLSearchParams({csrfToken,callbackUrl:'https://sales.frog-school.com/admin/sales'}).toString()});
const google=new URL(JSON.parse(begin.text).url);
assert.equal(google.hostname,'accounts.google.com');
assert.equal(google.searchParams.get('redirect_uri'),'https://sales.frog-school.com/api/auth/callback/google');
assert.ok(google.searchParams.get('code_challenge'));
const invalid=await request('/api/auth/signin/google',{method:'POST',body:'csrfToken=invalid'});
assert.ok(!invalid.text.includes('accounts.google.com'));
for(const path of ['/admin/sales','/admin/sales/nonexistent','/admin/job-inbox']) {
  const denied=await request(path);assert.ok([302,307].includes(denied.status));assert.match(denied.headers['cache-control'],/no-store/);
}
assert.equal((await request('/api/desk/job-leads',{method:'POST'})).status,404);
if(base.protocol==='http:'){
  const recruit=await request('/api/auth/providers',{host:'127.0.0.1:3006'});
  assert.deepEqual(Object.keys(JSON.parse(recruit.text)).sort(),['credentials','google']);
}
console.log('PASS real Auth.js HTTP: sales Google-only, exact callback, host-only Secure HttpOnly cookies, PKCE, invalid CSRF rejected, anonymous sales/Inbox denied, capture route isolated. OAuth login completion is NOT tested.');
