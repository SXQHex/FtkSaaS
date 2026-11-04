import {authUser,fixturePlatform,must,context} from '../api-client.mjs';
import {connect} from '../../scripts/db.mjs';
import {newUuidV7 as key} from '../../scripts/uuid.mjs';
import {assertLocalServices} from '../../scripts/ci/v2/safety.mjs';

// Each root owns its tenant and connection; no previous test output is reused.
export async function roomFixture(t){
 assertLocalServices(context().env);
 const db=await connect();
 t.after(()=>db.end());
 const {platform,plan}=await fixturePlatform();
 const owner=await authUser('v2-room-owner');
 const account=await must(owner,'account_get_v1');
 const org=(await must(platform,'organization_create_v1',{
  verified_account_id:account.id,name:'CI v2 room '+key(),initial_plan_id:plan
 },key())).primary_id;
 const center=(await must(owner,'center_create_v1',{org_id:org,name:'Room pilot',timezone:'Europe/Istanbul'},key())).primary_id;
 const scope=body=>({org_id:org,center_id:center,...body});
 const ownerPerson=(await db.query('select owner_person_id from core.organizations where id=$1',[org])).rows[0].owner_person_id;
 await must(owner,'center_manager_assign_v1',scope({person_id:ownerPerson}),key());
 const payment=await must(owner,'saas_payment_submit_v1',scope({
  amount_minor:'1000',currency:'TRY',reference:'synthetic CI v2',occurred_at:new Date().toISOString()
 }),key());
 await must(platform,'saas_payment_verify_v1',scope({payment_id:payment.primary_id,accepted:true}),key());
 const save=(body,operationKey=key())=>must(owner,'room_save_v1',scope(body),operationKey);
 const read=(roomId)=>must(owner,'management_state_get_v1',scope({
  operation:'room_save_v1',selector:{operation:'room_save_v1',key:roomId?{room_id:roomId}:{}},page:{}
 }));
 return {db,owner,org,center,scope,save,read};
}
