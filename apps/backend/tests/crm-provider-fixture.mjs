import pg from 'pg';
import {randomBytes} from 'node:crypto';
import {authUser,fixturePlatform,must,context} from './api-client.mjs';
import {connect} from '../scripts/db.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';
import {submitProviderApplication} from '../scripts/crm-provider-intake.mjs';
import {providerFormConfigurationSQL} from '../scripts/crm-provider-form-config.mjs';
export async function providerFixture(t){
 const db=await connect(),clients=[];let role,org;
 t.after(async()=>{try{for(const client of clients)await client.end();if(role){await db.query('delete from private.crm_provider_receiver_scopes where db_role=$1',[role]);await db.query(`drop role "${role}"`);}}finally{await db.end();}});
 const {platform,plan}=await fixturePlatform(),owner=await authUser('crm-provider');
 const account=await must(owner,'account_get_v1');
 org=(await must(platform,'organization_create_v1',{verified_account_id:account.id,name:'Synthetic provider intake',initial_plan_id:plan},key())).primary_id;
 const center=(await must(owner,'center_create_v1',{org_id:org,name:'Provider center',timezone:'UTC'},key())).primary_id;
 const person=(await db.query('select owner_person_id from core.organizations where id=$1',[org])).rows[0].owner_person_id;
 await must(owner,'center_manager_assign_v1',{org_id:org,center_id:center,person_id:person},key());
 const payment=(await must(owner,'saas_payment_submit_v1',{org_id:org,amount_minor:'1000',currency:'TRY',reference:'Synthetic provider',occurred_at:new Date().toISOString()},key())).primary_id;
 await must(platform,'saas_payment_verify_v1',{org_id:org,payment_id:payment,accepted:true},key());
 const external=()=>String(BigInt('0x'+key().replaceAll('-','').slice(12,28))%9223372036854775807n+1n),page=external(),metaForm=key(),googleForm=key(),metaExternal=external(),googleExternal=external();
 role='crm_receiver_'+key().replaceAll('-','');const password=randomBytes(24).toString('hex');
 await db.query(`create role "${role}" login password '${password}'`);await db.query(`grant ftk_crm_ingress_worker to "${role}"`);
 for(const [id,channel,externalForm,externalPage] of [[metaForm,'meta',metaExternal,page],[googleForm,'google_ads',googleExternal,null]])await db.query(providerFormConfigurationSQL({id,org_id:org,center_id:center,channel,form_key:channel,source_url:'https://example.invalid/provider',enabled:true,external_form_id:externalForm,external_page_id:externalPage,db_role:role}));
 const worker=async()=>{const url=new URL(context().env.DB_URL);url.username=role;url.password=password;const client=new pg.Client({connectionString:url.href});await client.connect();clients.push(client);return client;};
 const client=await worker(),intake={display_name:'Synthetic provider candidate',phone:'+905550000002',email:'synthetic+provider@ftksaas.invalid',consents:[{purpose:'privacy',accepted:true,version:'synthetic-notice-v1',occurred_at:'2026-01-01T00:00:00Z'},{purpose:'marketing',accepted:false,version:'synthetic-marketing-v1',occurred_at:'2026-01-01T00:00:00Z'}]};
 const meta={provider:'meta',external_page_id:page,external_form_id:metaExternal,external_lead_id:external(),submitted_at:'2026-01-01T00:00:00Z',is_test:null,attribution:{ad_id:external()},intake};
 const google={provider:'google_ads',external_page_id:null,external_form_id:googleExternal,external_lead_id:key(),submitted_at:null,is_test:true,attribution:{campaign_id:external()},intake};
 const submit=(value=meta,c=client)=>submitProviderApplication(c,value),count=async()=>Number((await db.query('select count(*) n from core.public_applications where org_id=$1',[org])).rows[0].n);
 return {db,org,owner,plan,center,role,metaForm,googleForm,meta,google,client,worker,submit,count};
}

