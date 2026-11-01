(function(){
'use strict';
let database,bundle,online=false,authNeeded=false,working=false,error='';
const initial=()=>({user:null,base:FarmDomain.fresh(),revision:0,pending:[]});
const request=r=>new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
async function openDB(){const r=indexedDB.open('farm-manager-shared-v2',1);r.onupgradeneeded=()=>r.result.createObjectStore('state');database=await request(r)}
async function read(){return await request(database.transaction('state').objectStore('state').get('workspace'))||initial()}
async function write(value){await new Promise((resolve,reject)=>{const tx=database.transaction('state','readwrite');tx.objectStore('state').put(value,'workspace');tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error||Error('Could not save records.'));tx.onerror=()=>reject(tx.error)});bundle=value}
async function lock(fn){if(!navigator.locks)throw Error('Please update your browser to save and sync records safely.');return navigator.locks.request('farm-manager-records',fn)}
async function api(path,data){let res;try{res=await fetch('/api/'+path,{method:data===undefined?'GET':'POST',headers:data===undefined?{}:{'Content-Type':'application/json','X-Farm-Request':'1'},body:data===undefined?undefined:JSON.stringify(data),signal:AbortSignal.timeout(15000)})}catch{online=false;throw Error('Cannot reach the server. Records are kept on this device.')}let b;try{b=await res.json()}catch{online=false;throw Error('Server is starting or unavailable. Try again shortly.')}online=true;if(!res.ok){const e=Error(b.error||'Request failed.');e.status=res.status;if(res.status===401)authNeeded=true;throw e}return b}
function projected(){let data=structuredClone(bundle?.base||FarmDomain.fresh()),conflict=null;for(const op of bundle?.pending||[]){try{data=FarmDomain.apply(data,op)}catch(e){conflict={id:op.id,message:e.message,type:op.type};break}}return {data,conflict}}
function notify(){dispatchEvent(new Event('farmchange'));channel?.postMessage('changed')}
const channel=typeof BroadcastChannel==='function'?new BroadcastChannel('farm-manager-changes'):null;
if(channel)channel.onmessage=async()=>{bundle=await read();dispatchEvent(new Event('farmchange'))};
async function init(){await openDB();bundle=await read();try{const r=await api('me');if(bundle.user&&bundle.user.id!==r.user.id){if(bundle.pending.length)throw Error('Pending records belong to another account. Sign in to that account first.');bundle=initial()}bundle.user=r.user;await write(bundle);authNeeded=false;await sync()}catch(e){if(e.status===401)authNeeded=true;else error=e.message}return view()}
function view(){return {...projected(),user:bundle?.user,pending:bundle?.pending||[],revision:bundle?.revision||0,online,authNeeded,working,error}}
async function authenticate(type,data){return lock(async()=>{bundle=await read();if(bundle.user&&bundle.pending.length&&bundle.user.email!==data.email.trim().toLowerCase())throw Error('Sync pending records with the previous account before switching accounts.');const r=await api(type,data);if(!bundle.user||bundle.user.id!==r.user.id)bundle=initial();bundle.user=r.user;await write(bundle);authNeeded=false;error='';notify();return r.user})}
async function enqueue(op){await lock(async()=>{bundle=await read();if(!bundle.user)throw Error('Sign in first.');const p=projected();if(p.conflict)throw Error('Resolve the pending conflict before adding another entry.');FarmDomain.apply(p.data,op);const next=structuredClone(bundle);next.pending.push(op);await write(next);error='';notify()});void sync()}
async function sync(){if(working||!bundle?.user)return;working=true;dispatchEvent(new Event('farmchange'));try{await lock(async()=>{bundle=await read();const me=await api('me');if(me.user.id!==bundle.user?.id)throw Error('Sign in with the account that saved these pending records.');authNeeded=false;
 const snapshot=await api('state');await write({...bundle,base:snapshot.state,revision:snapshot.revision});
 while(bundle.pending.length){const op=bundle.pending[0];let result;try{result=await api('operations',op)}catch(e){if(e.status===409){error=e.message;break}throw e}
  await write({...bundle,base:result.state,revision:result.revision,pending:bundle.pending.slice(1)});error='';
 }
 if(!bundle.pending.length)error='';notify();
})}catch(e){error=e.message}finally{working=false;dispatchEvent(new Event('farmchange'))}}
async function discard(id){await lock(async()=>{bundle=await read();if(bundle.pending[0]?.id!==id)throw Error('The queue changed. Please review it again.');await write({...bundle,pending:bundle.pending.slice(1)});error='';notify()});await sync()}
async function logout(){await lock(async()=>{bundle=await read();if(bundle.pending.length)throw Error('Sync or resolve pending entries before signing out.');await api('logout',{});await write(initial());authNeeded=true;error='';notify()})}
async function restore(data){return lock(async()=>{bundle=await read();if(bundle.pending.length)throw Error('Sync pending entries before restoring.');const snapshot=await api('restore',data);await write({...bundle,base:snapshot.state,revision:snapshot.revision});notify()})}
async function invitation(){return api('invite',{})}
async function config(){return api('config')}
async function changePassword(data){return api('password',data)}
async function backup(){return {...await read(),format:'farm-manager-shared-v2',exportedAt:new Date().toISOString()}}
window.FarmSync={init,view,enqueue,sync,authenticate,logout,invitation,config,changePassword,discard,backup,restore};
addEventListener('online',()=>void sync());setInterval(()=>{if(document.visibilityState==='visible')void sync()},30000);addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void sync()});
})();
