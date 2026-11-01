// Development/testing PostgreSQL engine. Production always uses pg + DATABASE_URL.
const {PGlite}=require('@electric-sql/pglite');
async function localPool(directory){
 const db=new PGlite(directory);await db.waitReady;let tail=Promise.resolve();
 async function acquire(){let release;const next=new Promise(r=>release=r);const previous=tail;tail=next;await previous;return release}
 const query=(sql,args)=>!args&&sql.includes('CREATE TABLE')?db.exec(sql):db.query(sql,args);
 return {async query(sql,args){const release=await acquire();try{return await query(sql,args)}finally{release()}},async connect(){const release=await acquire();return {query,release}},end:()=>db.close()};
}
module.exports={localPool};
