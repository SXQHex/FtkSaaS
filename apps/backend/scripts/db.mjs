import {execFileSync} from 'node:child_process';
import pg from 'pg';
export function stackStatus() {
 const raw=execFileSync('node_modules/.bin/supabase',['status','--output-format','json'],{encoding:'utf8'});
 return JSON.parse(raw);
}
export async function connect() {
 const status=stackStatus(); const url=status.env?.DB_URL;
 if(!url || !['localhost','127.0.0.1'].includes(new URL(url).hostname)) throw new Error('LOCAL_DB_REQUIRED');
 const client=new pg.Client({connectionString:url}); await client.connect(); return client;
}
