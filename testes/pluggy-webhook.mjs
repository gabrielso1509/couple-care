import assert from 'node:assert/strict';import {createHmac} from 'node:crypto';import handler from '../api/pluggy/webhook.mjs';
const secret='whsec_'+'ab'.repeat(32);process.env.PLUGGY_WEBHOOK_SECRET=secret;process.env.SUPABASE_SERVICE_ROLE_KEY='server-only';const original=globalThis.fetch;let records=[];
globalThis.fetch=async function(_,options){records.push(JSON.parse(options.body));return new Response(null,{status:201});};
function request(body,signature,time=Math.floor(Date.now()/1000),key=secret){const raw=typeof body==='string'?body:JSON.stringify(body);const sig=signature??'t='+time+',v1='+createHmac('sha256',key).update(time+'.'+raw).digest('hex');return new Request('https://example.com/api/pluggy/webhook',{method:'POST',headers:{'Content-Type':'application/json','X-Pluggy-Signature':sig},body:raw});}
const event={event:'item/updated',itemId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',private_data:'must-not-be-saved'};
assert.equal((await handler.fetch(request(event))).status,200);assert.equal(records.length,1);assert.equal(records[0].private_data,undefined);assert.deepEqual(Object.keys(records[0]).sort(),['event_hash','event_type','item_id']);
assert.equal((await handler.fetch(request(event))).status,200);assert.equal(records[0].event_hash,records[1].event_hash);
assert.equal((await handler.fetch(request(event,''))).status,401);assert.equal((await handler.fetch(request(event,undefined,Math.floor(Date.now()/1000)-301))).status,401);assert.equal((await handler.fetch(request(event,undefined,Math.floor(Date.now()/1000),'forged'))).status,401);
assert.equal((await handler.fetch(request('{'))).status,400);assert.equal((await handler.fetch(request({event:'test'}))).status,200);
assert.equal((await handler.fetch(new Request('https://x',{method:'GET'}))).status,200);
globalThis.fetch=async()=>new Response(null,{status:500});assert.equal((await handler.fetch(request(event))).status,503);
delete process.env.PLUGGY_WEBHOOK_SECRET;assert.equal((await handler.fetch(request(event))).status,503);globalThis.fetch=original;console.log('PASS: assinatura, expiração, JSON, metadados mínimos, repetição e falha recuperável.');
