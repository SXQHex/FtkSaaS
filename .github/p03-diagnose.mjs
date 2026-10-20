import {connect} from '../scripts/db.mjs';
const db=await connect();
try {
 if(process.argv.includes('--read')){
  console.log(JSON.stringify((await db.query('select * from private.p03_diagnostics')).rows,null,2));
 }else{
 await db.query('create table private.p03_diagnostics(operation text,state text,message text,detail text,context text)');
 const {rows}=await db.query("select pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure) body");
 let body=rows[0].body;
 body=body.replace('state_name:=SQLERRM;', "GET STACKED DIAGNOSTICS state_name = PG_EXCEPTION_CONTEXT;\n insert into private.p03_diagnostics values(p_operation,SQLSTATE,SQLERRM,null,state_name);\n state_name:=SQLERRM;");
 await db.query(body);
 }
}finally{await db.end();}
