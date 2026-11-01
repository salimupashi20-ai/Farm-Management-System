/* Shared validation and operations. The server is authoritative. */
(function(root){
'use strict';
const fresh=()=>({stock:[],sales:[],health:[],expenses:[],workers:[],movements:[]});
const round=n=>Math.round((n+Number.EPSILON)*100)/100;
const fail=m=>{throw new Error(m)};
const text=(v,label,max=200)=>typeof v==='string'&&v.trim().length&&v.length<=max?v.trim():fail('Enter a valid '+label+'.');
const num=(v,label,positive=false)=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1e9&&(!positive||v>0)&&Math.abs(round(v)-v)<1e-7?v:fail('Enter a valid '+label+' (up to two decimal places).');
const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v?v:fail('Enter a valid date.');
const id=v=>typeof v==='string'&&/^[a-f0-9-]{36}$/i.test(v)?v:fail('Invalid record identifier.');
const find=(a,k)=>a.find(x=>x.id===k)||fail('The referenced record no longer exists.');
function apply(state,op){
 const n=structuredClone(state),r=op.data||{},action=op.type;id(op.id);const key=op.id;
 const amt=k=>num(r[k],k),str=k=>text(r[k],k),dt=()=>date(r.date);
 if(action==='stock'){
  const name=str('name');if(n.stock.some(s=>s.name.toLowerCase()===name.toLowerCase()))fail('This stock item already exists. Use a stock movement.');
  n.stock.push({id:key,name,category:str('category'),unit:str('unit'),qty:amt('qty'),min:amt('min')});
 }else if(action==='sale'){
  const s=find(n.stock,id(r.stock)),qty=num(r.qty,'quantity',true),price=amt('price'),paid=amt('paid'),total=round(qty*price);
  if(qty>s.qty)fail('Not enough stock. Only '+s.qty+' '+s.unit+' of '+s.name+' remain.');
  if(total>1e9||paid>total)fail('Payment cannot exceed the sale value.');s.qty=round(s.qty-qty);
  n.sales.push({id:key,date:dt(),stock:s.id,product:s.name,qty,price,total,paid,customer:str('customer')});
 }else if(action==='movement'){
  const s=find(n.stock,id(r.stock)),qty=num(r.qty,'quantity',true);if(!['Received','Used','Spoiled'].includes(r.direction))fail('Invalid stock movement.');
  if(r.direction!=='Received'&&qty>s.qty)fail('Not enough stock for this movement.');s.qty=round(s.qty+(r.direction==='Received'?qty:-qty));
  n.movements.push({id:key,stock:s.id,qty,direction:r.direction,reason:str('reason'),date:dt()});
 }else if(action==='expense'||action==='wage'){
  const amount=num(r.amount,'amount',true),paid=amt('paid');if(paid>amount)fail('Payment cannot exceed the expense.');
  const record={id:key,date:dt(),description:str('description'),category:action==='wage'?'Wages':str('category'),amount,paid};
  if(action==='wage')record.worker=find(n.workers,id(op.target)).id;n.expenses.push(record);
 }else if(action==='health'){
  if(!['Goat','Sheep','Chicken','Duck','Turkey','Cattle'].includes(r.species))fail('Choose a valid species.');
  n.health.push({id:key,date:dt(),animal:str('animal'),species:r.species,treatment:str('treatment'),notes:r.notes?text(r.notes,'notes',2000):'',due:r.due?date(r.due):'',done:false});
 }else if(action==='worker'){
  n.workers.push({id:key,name:str('name'),role:str('role'),phone:r.phone?text(r.phone,'phone',60):'',task:r.task?text(r.task,'task',500):'',attendance:[]});
 }else if(action==='task'){
  const w=find(n.workers,id(op.target));if(w.task!==(op.previous??''))fail('Another device updated this task. Review the latest task before changing it.');w.task=text(r.task,'task',500);
 }else if(action==='attend'){
  const w=find(n.workers,id(op.target)),d=dt();if(!w.attendance.includes(d))w.attendance.push(d);
 }else if(action==='done'){find(n.health,id(op.target)).done=true;
 }else if(action==='payment'||action==='expayment'){
  const x=find(action==='payment'?n.sales:n.expenses,id(op.target)),paid=num(r.paid,'payment',true),total=action==='payment'?x.total:x.amount;
  if(paid>round(total-x.paid))fail('Payment exceeds the current outstanding balance.');x.paid=round(x.paid+paid);x.payments=x.payments||[];x.payments.push({id:key,date:dt(),amount:paid});
 }else fail('Unknown operation.');
 return n;
}
const api={fresh,apply,round};if(typeof module!=='undefined')module.exports=api;else root.FarmDomain=api;
})(typeof window!=='undefined'?window:globalThis);
