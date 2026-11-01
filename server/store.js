const {createHash}=require('node:crypto');
const {fresh,apply}=require('../dist/domain.js');
class Store {
 constructor(pool){this.pool=pool}
 async init(){await this.pool.query(`
 CREATE TABLE IF NOT EXISTS farm (id int PRIMARY KEY CHECK(id=1), state jsonb NOT NULL, revision int NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS users (id uuid PRIMARY KEY, email text UNIQUE NOT NULL, name text NOT NULL, password text NOT NULL, role text NOT NULL CHECK(role IN ('owner','member')));
 CREATE TABLE IF NOT EXISTS sessions (hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), expires timestamptz NOT NULL);
 CREATE TABLE IF NOT EXISTS invites (hash text PRIMARY KEY, expires timestamptz NOT NULL, used boolean NOT NULL DEFAULT false);
 CREATE TABLE IF NOT EXISTS operations (id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), fingerprint text NOT NULL, revision int NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
 CREATE TABLE IF NOT EXISTS auth_limits (key text PRIMARY KEY, count int NOT NULL, expires timestamptz NOT NULL);
 `);await this.pool.query('INSERT INTO farm (id,state) VALUES (1,$1) ON CONFLICT DO NOTHING',[JSON.stringify(fresh())])}
 async tx(fn){const c=await this.pool.connect();try{await c.query('BEGIN');const v=await fn(c);await c.query('COMMIT');return v}catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}}
 async snapshot(){return (await this.pool.query('SELECT state,revision FROM farm WHERE id=1')).rows[0]}
 async operation(user,op){return this.tx(async c=>{
  const current=(await c.query('SELECT state,revision FROM farm WHERE id=1 FOR UPDATE')).rows[0];
  const fingerprint=createHash('sha256').update(JSON.stringify(op)).digest('hex');
  const old=(await c.query('SELECT * FROM operations WHERE id=$1',[op.id])).rows[0];
  if(old){if(old.user_id!==user.id||old.fingerprint!==fingerprint)throw Object.assign(new Error('Operation identifier already used.'),{status:409});return current}
  let state;try{state=apply(current.state,op)}catch(e){e.status=409;throw e}
  const revision=current.revision+1;
  await c.query('UPDATE farm SET state=$1,revision=$2 WHERE id=1',[JSON.stringify(state),revision]);
  await c.query('INSERT INTO operations (id,user_id,fingerprint,revision) VALUES ($1,$2,$3,$4)',[op.id,user.id,fingerprint,revision]);return {state,revision};
 })}
 async limit(key){const r=await this.pool.query(`INSERT INTO auth_limits (key,count,expires) VALUES ($1,1,now()+interval '15 minutes') ON CONFLICT (key) DO UPDATE SET count=CASE WHEN auth_limits.expires<now() THEN 1 ELSE auth_limits.count+1 END, expires=CASE WHEN auth_limits.expires<now() THEN now()+interval '15 minutes' ELSE auth_limits.expires END RETURNING count`,[key]);return r.rows[0].count<=15}
}
module.exports={Store};
