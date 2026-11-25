const P=require('../../lib/pluggy');
function paymentMethod(transaction, account) {
 const method = transaction.paymentData?.paymentMethod;
 const operation = transaction.operationType;
 const transfers = {PIX:'pix', TED:'ted', DOC:'doc', BOLETO:'boleto'};
 if (Object.hasOwn(transfers, method)) return transfers[method];
 if (Object.hasOwn(transfers, operation)) return transfers[operation];
 if (transaction.paymentData?.boletoMetadata) return 'boleto';
 if (operation === 'PAGAMENTO_FATURA') return null;
 if (account.type === 'CREDIT' || transaction.creditCardMetadata) return 'credit';
 if (operation === 'CARTAO' && account.type === 'BANK') return 'debit';
 return null;
}
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
  const datePattern=/^\d{4}-\d{2}-\d{2}$/;
  if(!datePattern.test(body.dateFrom||'')||!datePattern.test(body.dateTo||'')||body.dateTo<body.dateFrom)P.fail(400,'Escolha um intervalo de datas válido.');
  const from=new Date(body.dateFrom+'T00:00:00Z'),to=new Date(body.dateTo+'T00:00:00Z');
  if(Number.isNaN(from.getTime())||Number.isNaN(to.getTime())||from.toISOString().slice(0,10)!==body.dateFrom||to.toISOString().slice(0,10)!==body.dateTo||to-from>366*86400000)P.fail(400,'O intervalo pode ter até 366 dias.');
  let path='/v2/transactions?'+new URLSearchParams({accountId:body.accountId,dateFrom:body.dateFrom,dateTo:body.dateTo});
  if(body.cursor){if(typeof body.cursor!=='string'||body.cursor.length>8192)P.fail(400,'Página inválida.');const cursor=new URLSearchParams(body.cursor.replace(/^\?/,''));const after=cursor.get('after');if(!after)P.fail(400,'Página inválida.');path+='&'+new URLSearchParams({after});}
  const data=await P.api(path,key);return {next:data.next||null,transactions:(data.results||[]).map(t=>({id:t.id,description:t.description,date:t.date,amount:t.amount,type:t.type,status:t.status,currency:t.currencyCode||account.currencyCode||'BRL',category:t.category,paymentMethod:paymentMethod(t,account),billPayment:t.operationType==='PAGAMENTO_FATURA'}))};
 }
 P.fail(400,'Ação inválida.');
});

