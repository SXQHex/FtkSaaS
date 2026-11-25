import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {call,must} from './api-client.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';
import {sha256} from '../scripts/restore-guard.mjs';

const images=JSON.parse(readFileSync(new URL('./fixtures/settings-images.json',import.meta.url),'utf8'));
const image=(format)=>{
 const data_base64=images[format],bytes=Buffer.from(data_base64,'base64');
 return {mime:'image/'+format,data_base64,checksum:sha256(bytes)};
};

export async function seedOrganizationMedia({owner,org,read,q}){
 const png=image('png'),webp=image('webp');
 const managed=await must(owner,'management_state_get_v1',{
  operation:'account_profile_update_v1',selector:{operation:'account_profile_update_v1',key:{}}
 });
 const [profile]=managed.items;
 await must(owner,'account_profile_update_v1',{expected_version:profile.versions[0].version,
  display_name:profile.current.values.display_name,photo:png},key());
 const account=await must(owner,'account_get_v1');
 const setLogo=async logoImage=>{
  const current=await read('organization');
  await must(owner,'settings_update_v1',{...q('organization'),expected_version:current.version,patch:{},logo_image:logoImage},key());
  return (await read('organization')).logo;
 };
 const older=await setLogo(png),current=await setLogo(webp);
 assert.notEqual(older.id,current.id);
 const orgImage=await must(owner,'media_get_v1',{scope:'organization',org_id:org,asset_id:current.id});
 assert.equal(sha256(Buffer.from(orgImage.data_base64,'base64')),webp.checksum);
 const userImage=await must(owner,'media_get_v1',{scope:'user',asset_id:account.photo.id});
 assert.equal(sha256(Buffer.from(userImage.data_base64,'base64')),png.checksum);
 return {oldId:older.id,currentId:current.id,accountId:account.id,avatarId:account.photo.id,avatarSha256:png.checksum};
}

export async function verifyOrganizationMediaErasure({db,org,owner,jobId,requestId,request,claim,execute,media}){
 const rows=async(sql,args=[])=>(await db.query(sql,args)).rows;
 const orgScope='organization:'+org,userScope='user:'+media.accountId,assetIds=[media.oldId,media.currentId].sort();
 const observe=async()=> {
  const [state]=await rows(`select
    (select count(*)::int from private.settings_media_assets where scope_key=$1) assets,
    (select count(*)::int from private.settings_media_current where scope_key=$1) pointers,
    (select count(*)::int from private.settings_media_history where scope_key=$1) history,
    (select count(*)::int from private.settings_media_assets where scope_key=$2 and id=$3) avatar`,
  [orgScope,userScope,media.avatarId]);
  return state;
 };
 const [expected]=await rows(`select sum(octet_length(body))::int bytes,
    encode(extensions.digest(jsonb_agg(jsonb_build_array(id,octet_length(body),checksum) order by id)::text,'sha256'),'hex') sources_sha256
    from private.settings_media_assets where scope_key=$1`,[orgScope]);
 assert.deepEqual(await observe(),{assets:2,pointers:1,history:2,avatar:1});
 await assert.rejects(db.query('delete from private.settings_media_assets where id=$1',[media.oldId]),/INTEGRITY_VIOLATION/);

 const hold=key();
 await db.query(`insert into core.retention_holds(id,org_id,subject_table,subject_id,reason,authority_reference,review_at)
  values($1,$2,'private.settings_media_assets',$3,'Synthetic historical-logo hold','synthetic',clock_timestamp()-interval '1 day')`,[hold,org,media.oldId]);
 const inventory=async()=>{
  const [m]=await rows("select scopes#>'{exports,managed_file_erasure,inventory}' as inventory from private.p07_privacy_manifests where request_id=$1",[requestId]);
  return m.inventory;
 };
 try{
  await execute(request);
  const held=await inventory();
  assert.equal(held.organization_media.state,'held');
  assert.equal(held.live_org_media,5);
  assert.deepEqual(await observe(),{assets:2,pointers:1,history:2,avatar:1});
 }finally{await db.query('delete from core.retention_holds where id=$1',[hold]);}

 const claimAgain=async()=>{
  await db.query("update private.p07_privacy_jobs set next_attempt_at=clock_timestamp()-interval '1 second' where id=$1",[jobId]);
  return claim(org,jobId);
 };
 await execute(await claimAgain());
 const [proof]=await rows(`select erased_asset_ids,asset_bytes::int,history_rows::int,pointer_rows::int,
  sources_sha256,completed_at is not null and permit_transaction is null as settled
  from private.organization_media_erasures where request_id=$1`,[requestId]);
 assert.deepEqual(proof,{erased_asset_ids:assetIds,asset_bytes:expected.bytes,history_rows:2,pointer_rows:1,sources_sha256:expected.sources_sha256,settled:true});
 assert.deepEqual(await observe(),{assets:0,pointers:0,history:0,avatar:1});
 const fileInventory=await inventory();
 assert.equal(fileInventory.live_org_media,0);
 assert.equal(fileInventory.organization_media.sources_sha256,expected.sources_sha256);
 await execute(await claimAgain());
 assert.deepEqual((await inventory()).organization_media,fileInventory.organization_media);
 const former=await call(owner,'media_get_v1',{scope:'organization',org_id:org,asset_id:media.currentId});
 assert.equal(former.result.ok,false);
 const avatar=await must(owner,'media_get_v1',{scope:'user',asset_id:media.avatarId});
 assert.equal(sha256(Buffer.from(avatar.data_base64,'base64')),media.avatarSha256);
 return {media_source_purge:true,erased_media_assets:assetIds.length,
  erased_media_bytes:proof.asset_bytes,media_sources_sha256:proof.sources_sha256};
}
