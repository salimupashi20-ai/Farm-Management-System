const http=require('node:http');const fs=require('node:fs/promises');const path=require('node:path');const {randomUUID}=require('node:crypto');
const {Store}=require('./store');const {hash,token,passwordHash,verify}=require('./auth');
const publicUser=u=>({id:u.id,email:u.email,name:u.name,role:u.role});
const bad=(message,status=400)=>{throw Object.assign(new Error(message),{status})};
async function body(req){let s='';for await(const chunk of req){s+=chunk;if(Buffer.byteLength(s)>2*1024*1024)bad('Request too large.',413)}try{return JSON.parse(s||'{}')}catch{bad('Invalid JSON.')}}
function createApp(store,config={}){
 const production=config.production??process.env.NODE_ENV==='production',setupKey=config.setupKey??process.env.SETUP_KEY;
 const cookie=(res,value,seconds)=>res.setHeader('Set-Cookie',`farm_session=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${seconds}${production?'; Secure':''}`);
 async function session(req){const raw=String(req.headers.cookie||'').match(/(?:^|; )farm_session=([^;]+)/)?.[1];if(!raw)return null;return (await store.pool.query('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.hash=$1 AND s.expires>now()',[hash(raw)])).rows[0]||null}
 async function login(res,u){const value=token();await store.pool.query("INSERT INTO sessions(hash,user_id,expires) VALUES($1,$2,now()+interval '7 days')",[hash(value),u.id]);cookie(res,value,604800)}
 return http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  const send=(data,status=200)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data))};
  try{
   const url=new URL(req.url,'http://localhost'),route=url.pathname;
   if(route==='/healthz'){await store.pool.query('SELECT 1');return send({ok:true})}
   if(route.startsWith('/api/')){
    if(!['GET','POST'].includes(req.method))bad('Method not allowed.',405);
    if(req.method==='POST'){
     const origin=req.headers.origin,expected=config.origin||process.env.APP_ORIGIN||`${production?'https':'http'}://${req.headers.host}`;
     if(origin!==expected||req.headers['x-farm-request']!=='1'||!String(req.headers['content-type']).startsWith('application/json'))bad('Request origin not allowed.',403);
    }
    if(route==='/api/config'&&req.method==='GET'){const r=await store.pool.query('SELECT count(*) FROM users');return send({setupRequired:Number(r.rows[0].count)===0})}
    if(['/api/login','/api/setup','/api/join'].includes(route)&&req.method==='POST'){
     const b=await body(req),email=String(b.email||'').trim().toLowerCase();
     if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)bad('Enter a valid email address.');
     if(!await store.limit('email:'+hash(email)))bad('Too many attempts. Try again in 15 minutes.',429);
     // One deployment-wide budget limits attempts across many email addresses.
     if(!await store.limit('global:'+Math.floor(Date.now()/60000)))bad('Too many attempts. Try again shortly.',429);
     let u;
     if(route==='/api/login'){
      u=(await store.pool.query('SELECT * FROM users WHERE email=$1',[email])).rows[0];
      const fallback='unused:'+('00'.repeat(64));const ok=await verify(b.password,u?.password||fallback);if(!u||!ok)bad('Email or password is incorrect.',401);
     }else{
      const name=String(b.name||'').trim();if(!name||name.length>120)bad('Enter your name.');const password=await passwordHash(b.password);
      u=await store.tx(async c=>{
       await c.query('SELECT id FROM farm WHERE id=1 FOR UPDATE');
       if(route==='/api/setup'){
        if(!setupKey||typeof b.code!=='string'||hash(b.code)!==hash(setupKey))bad('Setup key is incorrect.',403);
        if(Number((await c.query('SELECT count(*) FROM users')).rows[0].count)>0)bad('The owner account is already set up.',409);
       }else{
        if(typeof b.code!=='string'||b.code.length>128)bad('Invitation is invalid.',403);
        const invite=(await c.query('SELECT * FROM invites WHERE hash=$1 AND expires>now() AND used=false FOR UPDATE',[hash(b.code)])).rows[0];if(!invite)bad('Invitation is invalid, expired or already used.',403);
        await c.query('UPDATE invites SET used=true WHERE hash=$1',[hash(b.code)]);
       }
       const user={id:randomUUID(),name,email,role:route==='/api/setup'?'owner':'member'};
       try{await c.query('INSERT INTO users (id,email,name,password,role) VALUES($1,$2,$3,$4,$5)',[user.id,email,name,password,user.role])}catch(e){if(e.code==='23505')bad('An account already uses this email.',409);throw e}return user;
      });
     }
     await login(res,u);return send({user:publicUser(u)});
    }
    const u=await session(req);if(!u)bad('Sign in to sync your records.',401);
    if(route==='/api/me'&&req.method==='GET')return send({user:publicUser(u)});
    if(route==='/api/state'&&req.method==='GET')return send(await store.snapshot());
    if(route==='/api/operations'&&req.method==='POST'){const op=await body(req);if(!/^[a-f0-9-]{36}$/i.test(op.id||''))bad('Invalid operation identifier.');return send(await store.operation(u,op))}
    if(route==='/api/restore'&&req.method==='POST'){
     if(u.role!=='owner')bad('Only the owner can restore a backup.',403);
     const input=await body(req);let restored;try{restored=require('./backup').validateBackup(input)}catch(e){bad(e.message)}
     const value=await store.tx(async c=>{const current=(await c.query('SELECT state,revision FROM farm WHERE id=1 FOR UPDATE')).rows[0];if(current.revision!==0)bad('Restore is only allowed into an empty farm. Existing shared records will not be replaced.',409);await c.query('UPDATE farm SET state=$1,revision=1 WHERE id=1',[JSON.stringify(restored)]);return {state:restored,revision:1}});return send(value);
    }
    if(route==='/api/logout'&&req.method==='POST'){const raw=String(req.headers.cookie||'').match(/(?:^|; )farm_session=([^;]+)/)?.[1];await store.pool.query('DELETE FROM sessions WHERE hash=$1',[hash(raw||'')]);cookie(res,'',0);return send({ok:true})}
    if(route==='/api/invite'&&req.method==='POST'){if(u.role!=='owner')bad('Only the farm owner can invite family members.',403);const code=token();await store.pool.query("INSERT INTO invites(hash,expires) VALUES($1,now()+interval '24 hours')",[hash(code)]);return send({code,expiresInHours:24})}
    if(route==='/api/password'&&req.method==='POST'){const b=await body(req);if(!await store.limit('password:'+u.id))bad('Try again in 15 minutes.',429);if(!await verify(b.current,u.password))bad('Current password is incorrect.',403);const p=await passwordHash(b.password);await store.tx(async c=>{await c.query('UPDATE users SET password=$1 WHERE id=$2',[p,u.id]);await c.query('DELETE FROM sessions WHERE user_id=$1',[u.id])});await login(res,u);return send({ok:true})}
    bad('Not found.',404);
   }
   if(req.method!=='GET'&&req.method!=='HEAD')bad('Method not allowed.',405);
   const files={'/':'index.html','/index.html':'index.html','/app.js':'app.js','/domain.js':'domain.js','/sync.js':'sync.js','/style.css':'style.css','/sw.js':'sw.js','/manifest.json':'manifest.json','/icon.svg':'icon.svg'};
   if(!files[route])bad('Not found.',404);const data=await fs.readFile(path.join(__dirname,'../dist',files[route]));
   const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml'};
   res.writeHead(200,{'Content-Type':types[path.extname(files[route])],'Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:data);
  }catch(e){const status=e.status||500;if(status===500)console.error('Request failed:',e.code||e.name);send({error:status===500?'Server unavailable. Your pending records remain on this device.':e.message},status)}
 });
}
async function start(){if(!process.env.DATABASE_URL)throw new Error('Set DATABASE_URL before starting.');if(process.env.NODE_ENV==='production'&&(!process.env.SETUP_KEY||process.env.SETUP_KEY.length<32))throw new Error('SETUP_KEY must have at least 32 characters.');const {Pool}=require('pg');const pool=new Pool({connectionString:process.env.DATABASE_URL,max:5});const store=new Store(pool);await store.init();const server=createApp(store);server.listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log('Farm Manager is listening.'));const close=()=>server.close(()=>pool.end());process.on('SIGTERM',close);process.on('SIGINT',close)}
if(require.main===module)start().catch(e=>{console.error(e.message);process.exit(1)});module.exports={createApp};
