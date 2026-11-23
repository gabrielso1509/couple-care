const P=require('../../lib/pluggy');
module.exports=P.handler(async function(s,body){
 const key=await P.key();const item=await P.own(body.itemId,key,s.user);
 if(body.action==='register'){await P.store(s,'?on_conflict=user_id,item_id',{method:'POST',body:JSON.stringify({user_id:s.user.id,item_id:item.id})});return {saved:true};}
 if(body.action==='disconnect'){await P.api('/items/'+item.id,key,{method:'DELETE'});await P.store(s,'?item_id=eq.'+item.id,{method:'DELETE'});return {deleted:true};}
 if(body.action==='accounts'){
  const list=await P.api('/accounts?itemId='+item.id,key);
  return {status:item.status,updatedAt:item.lastUpdatedAt,bank:item.connector?.name||'Instituição conectada',accounts:(list.results||[]).map(a=>({id:a.id,name:a.name,type:a.type,currency:a.currencyCode||'BRL',balance:a.balance}))};
 }
 if(body.action==='transactions'){
  P.id(body.accountId);const account=await P.api('/accounts/'+body.accountId,key);if(account.itemId!==item.id)P.fail(403,'Conta não pertence à conexão.');
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(body.month||''))P.fail(400,'Escolha um mês válido.');
  const [year,month]=body.month.split('-').map(Number);if(year<1900||year>2100)P.fail(400,'Ano inválido.');const last=new Date(Date.UTC(year,month,0)).getUTCDate();
  let path='/v2/transactions?'+new URLSearchParams({accountId:body.accountId,dateFrom:body.month+'-01',dateTo:body.month+'-'+last});
  if(body.cursor){if(typeof body.cursor!=='string'||body.cursor.length>8192)P.fail(400,'Página inválida.');const cursor=new URLSearchParams(body.cursor.replace(/^\?/,''));const after=cursor.get('after');if(!after)P.fail(400,'Página inválida.');path+='&'+new URLSearchParams({after});}
  const data=await P.api(path,key);return {next:data.next||null,transactions:(data.results||[]).map(t=>({id:t.id,description:t.description,date:t.date,amount:t.amount,type:t.type,status:t.status,currency:t.currencyCode||account.currencyCode||'BRL',category:t.category}))};
 }
 P.fail(400,'Ação inválida.');
});
