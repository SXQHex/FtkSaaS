import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as validators from '../supabase/functions/backend-v1/validators.js';
import {newUuidV7 as key} from '../scripts/uuid.mjs';

test('discipline presentation is explicit, closed and keeps legacy requests valid',()=>{
 const base={client_api_version:1,request_id:key(),org_id:key(),operation_key:key(),name:'Salsa',state:'active'};
 const valid=validators.request_discipline_save_v1;
 assert(valid(base));
 assert(valid({...base,presentation:{description:'Dance',color:'#123aBc',icon:'music',display_order:3,public_visible:true,allow_center_description:true}}));
 for(const presentation of [null,{color:''},{color:'red'},{color:'#12345678'},{icon:'<svg>'},{icon:'https://example.invalid/icon'},{display_order:-1},{display_order:0.5},{display_order:2147483648},{description:'x'.repeat(2001)},{public_visible:null},{role:'owner'}])assert.equal(valid({...base,presentation}),false);
 const local={...base,center_id:key(),discipline_id:key()};delete local.name;
 assert(validators.request_center_discipline_set_v1({...local,presentation:{description:null,public_visible:false}}));
 assert.equal(validators.request_center_discipline_set_v1({...local,presentation:{color:'#123456'}}),false);
 assert(validators.request_disciplines_list_v1({client_api_version:1,request_id:key(),org_id:base.org_id,page:{},include_presentation:true,center_id:local.center_id}));
 assert(validators.request_public_calendar_get_v1({client_api_version:1,request_id:key(),slug:base.org_id,interval:{starts_at:'2030-01-01T00:00:00Z',ends_at:'2030-01-02T00:00:00Z'},page:{},include_disciplines:true}));
});

test('projection UUID classifications identify actual paths without stale or duplicate entries',()=>{
 const contract=JSON.parse(fs.readFileSync(new URL('../../../packages/api-contracts/schema/contract.json',import.meta.url)));
 const paths=[];
 function walk(value,path){
  if(!value||typeof value!=='object')return;
  if(['#/$defs/FtkUuid','#/$defs/ProviderUuid','#/$defs/FtkGeneratedUuidV7'].includes(value.$ref))paths.push(path);
  for(const [key,item] of Object.entries(value))walk(item,path+'/'+key);
 }
 walk(contract.$defs,'#/$defs');
 assert.deepEqual(contract['x-contract'].uuid_field_map.map(x=>x.path).sort(),paths.sort());
});
