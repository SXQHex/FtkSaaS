import {connect} from './db.mjs';import fs from 'node:fs';
const db=await connect();
try {
 const version=(await db.query('select version(), current_setting(\'server_version_num\') as version_num')).rows[0];
 const ext=(await db.query("select name,default_version from pg_available_extensions where name like '%uuid%' or name='pg_jsonschema'")).rows;
 const native=(await db.query("select to_regprocedure('pg_catalog.uuidv7(interval)')::text as native")).rows[0];
 const result={version,extensions:ext,native};fs.writeFileSync('reports/db-probe.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await db.end();}
