import test from 'node:test';
import assert from 'node:assert/strict';
import {lifecycleFixture} from './crm-lifecycle-fixture.mjs';
import {authUser,must} from './api-client.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';

test('XREQ-079 previews staff access loss and hands over live CRM work atomically',{timeout:300000},async t=>{
 const {db,org,center,api,denied,person,ownerPerson}=await lifecycleFixture(t);
 const staff=await authUser('staff-revocation');
 const staffPerson=await person('Synthetic staff');
 const account=await must(staff,'account_get_v1');
 await db.query("insert into core.account_links(id,org_id,account_id,person_id,state,verified_at) values($1,$2,$3,$4,'active',now())",[key(),org,account.id,staffPerson]);
 const grant=(role='staff')=>api('role_assign_v1',{person_id:staffPerson,role,scope:{center_id:center}});
 const permission=async (permission,enabled)=>api('permission_set_v1',{person_id:staffPerson,permission,enabled,
  expected_version:Number((await db.query('select version from core.people where id=$1',[staffPerson])).rows[0].version)});
 const assignment=await grant();
 await permission('crm.daily',true);
 await permission('invite.student',false);
 const target=await person('Synthetic CRM candidate');
 const other=await person('Synthetic ineligible recipient');
 const lead=await api('lead_save_v1',{person_id:target,source:'phone',interest:'Synthetic callback',assigned_to:staffPerson});
 const followup=()=>api('crm_activity_save_v1',{lead_id:lead.primary_id,kind:'followup',due_at:new Date().toISOString()});
 const activity=await followup();
 const command={assignment_id:assignment.primary_id,expected_version:assignment.version};
 const revoke={...command,reason:'Synthetic staff role removal'};
 const preview=()=>api('role_revoke_preview_v1',command);
 const approve=p=>({id:p.id,token:p.token});
 const owned=async()=> (await db.query('select assigned_person_id,version from core.leads where id=$1',[lead.primary_id])).rows[0];
 const before=await owned();

 await denied('role_revoke_preview_v1',{...command,expected_version:command.expected_version+1},'VERSION_CONFLICT');
 await denied('role_revoke_preview_v1',{...command,center_id:key()},'NOT_FOUND');
 await denied('role_revoke_preview_v1',command,'FORBIDDEN',key(),staff);
 const original=await preview();
 assert.deepEqual(original.sessions,[]);
 assert.deepEqual(original.staff_impact.lost_permissions,['crm.daily']);
 assert.equal(original.staff_impact.handover_required,true);
 assert.deepEqual(original.staff_impact.open_leads.map(x=>x.lead_id),[lead.primary_id]);
 assert.deepEqual(original.staff_impact.open_leads[0].followups.map(x=>x.activity_id),[activity.primary_id]);
 assert.deepEqual(original.staff_impact.recipients.map(x=>x.person_id),[ownerPerson]);

 await denied('role_revoke_v1',revoke,'PREVIEW_STALE');
 await denied('role_revoke_v1',{...revoke,impact_approval:approve(original)},'OPEN_OPERATIONS_EXIST');
 await denied('role_revoke_v1',{...revoke,impact_approval:approve(original),handover_person_id:other},'FORBIDDEN');

 await followup();
 await denied('role_revoke_v1',{...revoke,impact_approval:approve(original),handover_person_id:ownerPerson},'PREVIEW_STALE');
 assert.deepEqual(await owned(),before);
 const fresh=await preview();
 const apply={...revoke,impact_approval:approve(fresh),handover_person_id:ownerPerson};
 const operationKey=key();
 const fault='xreq079_'+key().replaceAll('-','');
 await db.query(`create function private.${fault}() returns trigger language plpgsql as $$begin
  raise exception 'INTEGRITY_VIOLATION';
 end$$`);
 try{
  await db.query(`create trigger ${fault} before insert on core.audit_events for each row
   when (new.org_id='${org}'::uuid and new.action='role_revoke_v1') execute function private.${fault}()`);
  await denied('role_revoke_v1',apply,'INTEGRITY_VIOLATION',operationKey);
  assert.deepEqual(await owned(),before);
  assert.equal((await db.query('select state from core.role_assignments where id=$1',[assignment.primary_id])).rows[0].state,'active');
 }finally{
  await db.query(`drop trigger if exists ${fault} on core.audit_events`);
  await db.query(`drop function private.${fault}()`);
 }
 const revoked=await api('role_revoke_v1',apply,operationKey);
 assert.equal(revoked.primary_id,assignment.primary_id);
 assert.equal((await api('role_revoke_v1',apply,operationKey)).replayed,true);
 assert.deepEqual(await owned(),{assigned_person_id:ownerPerson,version:String(Number(before.version)+1)});
 assert.equal((await api('leads_list_v1',{assigned_to:ownerPerson,page:{}})).items[0].id,lead.primary_id);
 await denied('crm_activity_save_v1',{lead_id:lead.primary_id,kind:'followup',due_at:new Date().toISOString()},'FORBIDDEN',key(),staff);

 const next=await grant();
 await api('center_manager_assign_v1',{person_id:staffPerson});
 const retained=await api('role_revoke_preview_v1',{assignment_id:next.primary_id,expected_version:next.version});
 assert.deepEqual(retained.staff_impact.lost_permissions,[]);
 assert.deepEqual(retained.staff_impact.open_leads,[]);
 assert.deepEqual(retained.staff_impact.recipients,[]);
 assert.equal(retained.staff_impact.handover_required,false);
});
