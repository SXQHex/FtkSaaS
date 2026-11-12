import {explicitSharingConsentInputs} from './sharing-consent-fixture.mjs';
import {authUser,fixturePlatform,must as nativeMust} from './api-client.mjs';
import {connect} from '../scripts/db.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';

// Each acceptance root owns a tenant and only the prerequisites it consumes.
export async function preparationFixture({schedule=false,templates=false,studentUser=false,studentMembership=false,session=false,roomOnly=false,workCalendar}={}){
 const started=performance.now();
 const {platform,plan}=await fixturePlatform(),owner=await authUser('st03-owner');
 const student=studentUser?await authUser('st03-student'):undefined;
 const db=await connect(),rows=async(sql,args=[])=>(await db.query(sql,args)).rows;
 let org,center,room,discipline,person,studentPerson,roomRule,initialPreparationOrgVersion,packageTemplate,classId,account;
 const versions=new Map();
 // Versions come only from real reads and successful writes, never guessed increments.
 const observe=(scope,result)=>{versions.set(scope,result.version);return result;};
 const must=async(user,operation,body={},operationKey)=>{
  const result=await nativeMust(user,operation,body,operationKey);
  if(user===owner&&(operation==='settings_get_v1'||(['settings_update_v1','settings_reset_apply_v1'].includes(operation)&&!result.replayed)))observe(body.scope,result);
  return result;
 };
 const scoped=b=>({org_id:org,center_id:center,...b}),api=(op,b={},u=owner,k=key())=>must(u,op,scoped(b),k);
 const q=scope=>({scope,org_id:org,...(scope==='center'?{center_id:center}:{})});
 const read=scope=>must(owner,'settings_get_v1',q(scope));
 const change=async(scope,patch)=>{
  if(!versions.has(scope))await read(scope);
  return must(owner,'settings_update_v1',{...q(scope),expected_version:versions.get(scope),patch,...(scope==='member'?await explicitSharingConsentInputs(owner,org,patch):{})},key());
 };
 const day=n=>new Date(Date.now()+n*86400000).toISOString().slice(0,10);
 const availabilityTemplate={key:'weekday',name:'Explicit weekly preparation',rules:[{weekdays:[1,2,3,4,5,6,7],local_start:'08:00:00',local_end:'19:00:00',valid_from:'2020-01-01'}]};
 const preview=hour=>api('program_preview_v1',{class_id:classId,schedule:{room_id:room,weekdays:[1,2,3,4,5,6,7],local_start:hour+':00:00',starts_on:day(1),ends_on:day(2),assignments:[{person_id:person,duty:'instructor'}],capacity:{total:10}}});
 try{
  await db.query("update core.saas_plan_versions set name='starter' where id=$1",[plan]);account=await must(owner,'account_get_v1');
  org=(await must(platform,'organization_create_v1',{verified_account_id:account.id,name:'Synthetic ST03 defaults',initial_plan_id:plan},key())).primary_id;
  const pay=await api('saas_payment_submit_v1',{amount_minor:'1000',currency:'TRY',reference:'SYNTHETIC ST03',occurred_at:new Date().toISOString()});await api('saas_payment_verify_v1',{payment_id:pay.primary_id,accepted:true},platform);
  if(schedule||templates)discipline=(await must(owner,'discipline_save_v1',{org_id:org,name:'Yoga',state:'active'},key())).primary_id;
  const patch={program_duration_minutes:45};
  if(workCalendar!==undefined)patch.work_calendar=workCalendar;
  if(templates){
   packageTemplate={key:'credit',name:'Explicit credits preparation',discipline_id:discipline,terms:{name:'Yoga · prepared credits',kind:'credits',booking_mode:'flexible',credits:4,price_minor:'400',currency:'TRY',freeze:{enabled:false,extends_validity:false},refund:{method:'credit_ratio'},quota:null},start_date:day(1),end_date:day(61)};
   Object.assign(patch,{availability_templates:[availabilityTemplate],package_templates:[packageTemplate]});
  }
  await must(owner,'settings_update_v1',{scope:'organization',org_id:org.toUpperCase(),expected_version:0,patch},key());initialPreparationOrgVersion=(await read('organization')).version;
  center=(await api('center_create_v1',{name:'Copied preparation',timezone:'UTC'})).primary_id;
  person=(await rows('select owner_person_id from core.organizations where id=$1',[org]))[0].owner_person_id;
  await api('center_manager_assign_v1',{person_id:person});
  if(discipline)await api('center_discipline_set_v1',{discipline_id:discipline,state:'active'});
  if(schedule||roomOnly)room=(await api('room_save_v1',{name:'Only room',capacity:10})).primary_id;
  if(schedule){
   await api('role_assign_v1',{person_id:person,role:'instructor',scope:{center_id:center}});
   for(const resource of [{kind:'room',id:room},{kind:'person',id:person}]){const saved=await api('availability_save_v1',{resource,rule:{weekdays:[1,2,3,4,5,6,7],local_start:'00:00:00',local_end:'23:59:59',valid_from:'2020-01-01'}});if(resource.kind==='room')roomRule=saved.primary_id;}
   classId=(await api('class_save_v1',{name:'Preparation Yoga',discipline_id:discipline,external_open:false})).primary_id;
  }
  if(studentMembership){
   const member=await must(student,'account_get_v1');studentPerson=(await api('person_create_v1',{display_name:'Synthetic ST03 member',contacts:[]})).primary_id;await api('student_activate_v1',{person_id:studentPerson});
   await db.query("insert into core.account_links(id,org_id,account_id,person_id,state,verified_at) values($1,$2,$3,$4,'active',now())",[key(),org,member.id,studentPerson]);
  }
  if(session){const p=await preview('09');await api('program_apply_v1',{preview:{id:p.id,token:p.token}});}
  return {platform,plan,owner,student,db,rows,org,center,room,discipline,person,studentPerson,roomRule,initialPreparationOrgVersion,packageTemplate,account,scoped,api,q,read,change,day,availabilityTemplate,classId,preview,must,observe,setup_ms:performance.now()-started};
 }catch(error){await db.end();throw error;}
}
