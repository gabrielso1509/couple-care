const assert=require('node:assert/strict');const handler=require('../api/pluggy/connect-token');
(async()=>{process.env.PLUGGY_ENV='production';process.env.PLUGGY_CLIENT_ID='test';process.env.PLUGGY_CLIENT_SECRET='secret';const original=global.fetch;
async function call(method,authorization){const res={headers:{},setHeader(k,v){this.headers[k]=v},status(c){this.code=c;return this},json(b){this.body=b;return this}};await handler({method,headers:{authorization},body:{clientUserId:'forged'}},res);return res}
let calls=[];global.fetch=async(url,opts)=>{calls.push({url,opts});return {ok:true,status:200,json:async()=>url.includes('/auth/v1/')?{id:'real-user'}:url.endsWith('/auth')?{apiKey:'server-key'}:{accessToken:'temporary-token'}}};
assert.equal((await call('GET','')).code,405);assert.equal((await call('POST','')).code,401);assert.equal(calls.length,0);
const res=await call('POST','Bearer session');assert.equal(res.code,200);assert.deepEqual(res.body,{accessToken:'temporary-token',sandbox:false});assert.equal(JSON.parse(calls[2].opts.body).options.clientUserId,'real-user');assert.equal(JSON.stringify(res.body).includes('secret'),false);
process.env.PLUGGY_ENV='sandbox';assert.equal((await call('POST','Bearer session')).body.sandbox,true);
global.fetch=async()=>({ok:false,status:401});assert.equal((await call('POST','Bearer invalid')).code,401);global.fetch=original;console.log('PASS: método, autenticação, identidade e resposta sem segredo.');})().catch(e=>{console.error(e);process.exit(1)});

