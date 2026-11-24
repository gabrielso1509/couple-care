import {createHmac,timingSafeEqual} from 'node:crypto';
// Compara assinaturas sem reconstruir o JSON original.
export function validSignature(bytes,header,secrets,now=Date.now()){
 if(typeof header!=='string'||header.length>512)return false;
 const parts=header.split(',').map(function(p){return p.trim().split('=')});
 if(parts.length!==2||parts.some(function(p){return p.length!==2}))return false;
 const fields=Object.fromEntries(parts);if(!/^\d{1,12}$/.test(fields.t||'')||!/^[a-f0-9]{64}$/.test(fields.v1||''))return false;
 if(Math.abs(Number(fields.t)-Math.floor(now/1000))>300)return false;
 const supplied=Buffer.from(fields.v1,'hex');
 return secrets.some(function(secret){const hmac=createHmac('sha256',secret);hmac.update(fields.t+'.');hmac.update(bytes);return timingSafeEqual(supplied,hmac.digest());});
}
