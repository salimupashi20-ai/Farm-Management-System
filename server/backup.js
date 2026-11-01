const {fresh,apply,round}=require('../dist/domain');
function validateBackup(input){
 const state=input?.version===1?input.data:input?.format==='farm-manager-shared-v2'?input.base:null;
 if(!state||!['stock','sales','health','expenses','workers'].every(k=>Array.isArray(state[k])))throw Error('Invalid Farm Manager backup.');
 if(input.pending?.length)throw Error('This backup contains pending entries. Sync them on the original device before restoring.');
 let result=fresh();const seen=new Set();
 const keep=(key,record,type,data,target)=>{
  if(seen.has(record.id))throw Error('Duplicate record identifier in backup.');seen.add(record.id);
  const next=apply(result,{id:record.id,type,data,target});result[key]=next[key];
 };
 for(const r of state.stock)keep('stock',r,'stock',r);
 for(const r of state.workers){keep('workers',r,'worker',r);for(const date of r.attendance||[])result=apply(result,{id:crypto.randomUUID(),type:'attend',target:r.id,data:{date}})}
 for(const r of state.health){keep('health',r,'health',r);if(r.done)result.health.at(-1).done=true}
 for(const r of state.expenses)keep('expenses',r,r.worker?'wage':'expense',r,r.worker);
 for(const r of state.sales){
  const stock=result.stock.find(s=>s.id===r.stock);if(!stock)throw Error('A sale references a missing stock item.');
  const qty=stock.qty;stock.qty=1e9;keep('sales',r,'sale',r);stock.qty=qty;
  if(r.total!==round(r.qty*r.price))throw Error('A sale has an incorrect total.');
 }
 // Quantity is the snapshot balance. Historical movements must not change it again.
 for(const r of state.movements||[]){
  const stock=result.stock.find(s=>s.id===r.stock);if(!stock)throw Error('A movement references a missing stock item.');
  const qty=stock.qty;stock.qty=r.direction==='Received'?0:1e9;keep('movements',r,'movement',r);stock.qty=qty;
 }
 return result;
}
module.exports={validateBackup};
