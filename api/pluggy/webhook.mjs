import {createHash} from 'node:crypto';
import {validSignature} from '../../lib/pluggy-signature.mjs';
const LIMIT=1024*1024;
function reply(status,body){return Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
function configuration(){const secret=process.env.PLUGGY_WEBHOOK_SECRET;const dbKey=process.env.SUPABASE_SERVICE_ROLE_KEY;return secret&&/^whsec_[a-f0-9]{64}$/i.test(secret)&&dbKey;}
export default {
 async fetch(request){
  if(!['POST','GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:{Allow:'POST, GET, HEAD'}});
  if(!configuration())return reply(503,{error:'Webhook aguardando configuração do servidor.'});
  if(request.method==='HEAD')return new Response(null,{status:200});
  if(request.method==='GET')return reply(200,{status:'online',message:'Endpoint de eventos Pluggy. Envios exigem assinatura válida.'});
  try{
   if(Number(request.headers.get('content-length'))>LIMIT)return reply(413,{error:'Payload excede o limite.'});
   // Leitura limitada do corpo bruto: necessário para validar o HMAC.
   const reader=request.body?.getReader();if(!reader)return reply(400,{error:'Corpo ausente.'});
   const chunks=[];let size=0;
   while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>LIMIT){await reader.cancel();return reply(413,{error:'Payload excede o limite.'})}chunks.push(Buffer.from(part.value));}
   const raw=Buffer.concat(chunks);
   const secrets=[process.env.PLUGGY_WEBHOOK_SECRET,process.env.PLUGGY_WEBHOOK_SECRET_PREVIOUS].filter(Boolean);
   if(!validSignature(raw,request.headers.get('x-pluggy-signature'),secrets))return reply(401,{error:'Assinatura inválida ou expirada.'});
   let payload;try{payload=JSON.parse(raw.toString('utf8'))}catch(_){return reply(400,{error:'JSON inválido.'})}
   if(!payload||typeof payload!=='object'||Array.isArray(payload))return reply(400,{error:'Evento inválido.'});
   const event=payload.event||'test';
   if(typeof event!=='string'||!/^[a-z_]+(?:\/[a-z_]+)?$/i.test(event)||event.length>100)return reply(400,{error:'Tipo de evento inválido.'});
   const item=payload.itemId;
   if(item!==undefined&&(typeof item!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(item)))return reply(400,{error:'Referência inválida.'});
   // Só metadados: nenhuma senha, token, descrição de gasto ou payload financeiro.
   const record={event_hash:createHash('sha256').update(raw).digest('hex'),event_type:event,item_id:item||null};
   const saved=await fetch('https://cwsmavsxeudwjocqakhh.supabase.co/rest/v1/pluggy_webhook_receipts?on_conflict=event_hash',{method:'POST',headers:{apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+process.env.SUPABASE_SERVICE_ROLE_KEY,'Content-Type':'application/json',Prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify(record),signal:AbortSignal.timeout(6000)});
   if(!saved.ok)return reply(503,{error:'Recebimento indisponível. Tente novamente.'});
   return reply(200,{received:true});
  }catch(_){return reply(503,{error:'Recebimento temporariamente indisponível.'});}
 }
};
