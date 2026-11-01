if(process.env.NODE_ENV==='production')throw Error('Use npm start for production.');
const {localPool}=require('./local-pool');const {Store}=require('./store');const {createApp}=require('./index');const {token}=require('./auth');const fs=require('node:fs/promises');
(async()=>{
 await fs.mkdir('.local-data',{recursive:true});let setupKey;try{setupKey=await fs.readFile('.local-data/setup-key','utf8')}catch{setupKey=token();await fs.writeFile('.local-data/setup-key',setupKey,{mode:0o600})}
 const pool=await localPool('.local-data/database'),store=new Store(pool);await store.init();const server=createApp(store,{production:false,setupKey});const port=Number(process.env.PORT)||3000;
 server.listen(port,'127.0.0.1',()=>console.log(`Local Farm Manager: http://127.0.0.1:${port}\nFirst-time setup key is in .local-data/setup-key (keep private).`));
 for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.close(()=>pool.end()));
})().catch(e=>{console.error(e.message);process.exit(1)});
