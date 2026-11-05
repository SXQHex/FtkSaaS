// Short-lived native LOGIN connections. Never use a human JWT or service role.
import pg from 'pg';
export const DB_LIMITS=Object.freeze({connect_ms:1000,statement_ms:2000,lock_ms:500,query_ms:3000,lifetime_ms:5000});
export function createNativeReceiverClient(databaseUrl,{Client=pg.Client}={}){
 let url;try{url=new URL(databaseUrl);}catch{throw Error('HOST_DATABASE_CONFIG');}
 const local=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
 if(!['postgres:','postgresql:'].includes(url.protocol)||!url.username||!url.password||url.search||url.hash||url.pathname.length<2)throw Error('HOST_DATABASE_CONFIG');
 const active=new Set();let stopped=false;
 return {abort(){stopped=true;for(const client of active)void client.end().catch(()=>undefined);},async query(sql,args){
  if(stopped)throw Error('HOST_DATABASE_UNAVAILABLE');
  const client=new Client({connectionString:url.href,ssl:local?false:{rejectUnauthorized:true},connectionTimeoutMillis:DB_LIMITS.connect_ms,statement_timeout:DB_LIMITS.statement_ms,lock_timeout:DB_LIMITS.lock_ms,query_timeout:DB_LIMITS.query_ms,application_name:'ftksaas-crm-provider'});active.add(client);
  client.on('error',()=>{ /* Network failures are returned through sanitized query errors. */ });
  const timer=setTimeout(()=>{void client.end().catch(()=>undefined);},DB_LIMITS.lifetime_ms);
  try{
   await client.connect();if(stopped)throw Error();
   const role=(await client.query("select current_user=session_user as same_role,pg_has_role(session_user,'ftk_crm_ingress_worker','member') as ingress,rolsuper,rolbypassrls,rolcreaterole,rolcreatedb,rolreplication from pg_roles where rolname=session_user")).rows[0];
   if(!role?.same_role||role.ingress!==true||['rolsuper','rolbypassrls','rolcreaterole','rolcreatedb','rolreplication'].some(k=>role[k]!==false)||stopped)throw Error();
   return await client.query(sql,args);
  }catch{throw Error('HOST_DATABASE_UNAVAILABLE');}
  finally{clearTimeout(timer);active.delete(client);await client.end().catch(()=>undefined);}
 }};
}
