import assert from 'node:assert/strict';
import {context,must} from './api-client.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';

const fields=['profile_visible','photo_visible','email_visible','phone_visible'];
export async function publishSyntheticSharingNotices(owner,org){
 assert(['127.0.0.1','localhost'].includes(new URL(context().env.API_URL).hostname));
 const q={scope:'organization',org_id:org},before=await must(owner,'settings_get_v1',q);
 const sharing_notices=fields.map(field=>({field,content:{name:'Synthetic '+field,language:'en',template_id:field,template_version:'native-fixture-v1',text:'Synthetic explicit participant '+field+' notice; not production legal text.'}}));
 return must(owner,'settings_update_v1',{...q,expected_version:before.version,patch:{sharing_notices}},key());
}
export async function explicitSharingConsentInputs(actor,org,patch){
 const selected=fields.filter(field=>patch[field]===true);if(selected.length===0)return {};
 const view=await must(actor,'settings_get_v1',{scope:'member',org_id:org});
 return {sharing_consents:selected.map(field=>{const n=view.sharing_notices.find(x=>x.field===field);assert(n,'Native fixture must publish the displayed notice before affirmative sharing');return {field,notice_hash:n.notice_hash,notice_revision:n.notice_revision};})};
}
