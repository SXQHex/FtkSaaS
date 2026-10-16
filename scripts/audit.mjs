import fs from 'node:fs';import assert from 'node:assert/strict';import Ajv from 'ajv/dist/2020.js';import addFormats from 'ajv-formats';
const p=JSON.parse(fs.readFileSync('contracts/08-FtkSaaS-tip-ve-operasyon-sozlesmesi.json'));const d=p.$defs,c=p['x-contract'];const results=[];let refs=0;
const check=(name,fn)=>{fn();results.push({name,status:'passed'});};
const walk=(x,fn,path='')=>{if(x&&typeof x==='object'){fn(x,path);for(const [k,v] of Object.entries(x))walk(v,fn,path+'/'+k);}};
const ajv=new Ajv({strict:false,allErrors:true});addFormats(ajv);
check('JSON Schema 2020-12 meta-schema',()=>assert(ajv.validateSchema(p),JSON.stringify(ajv.errors)));
ajv.addSchema(p,'contract');
check('all definition validators compile',()=>{for(const name of Object.keys(d))assert(ajv.getSchema('contract#/$defs/'+name),name);});
check('reference closure',()=>walk(p,x=>{if(x.$ref){refs++;assert(x.$ref.startsWith('#/$defs/'));assert(d[x.$ref.slice(8)],x.$ref);}}));
check('closed objects and required fields',()=>walk(d,x=>{if(x.type==='object')assert.equal(x.additionalProperties,false);if(x.properties)for(const k of x.required??[])assert(k in x.properties,k);}));
check('unique operations / known permissions',()=>{assert.equal(new Set(c.operations.map(o=>o.name)).size,c.operations.length);for(const o of c.operations)assert(c.permissions[o.permission],o.name);});
check('operation error code closure',()=>{for(const o of c.operations)for(const code of o.errors)assert(d.SafeError.properties.code.enum.includes(code),o.name+':'+code);});
check('foreign key column / target closure',()=>{for(const t of c.tables)for(const f of t.foreign_keys){assert(d['Table_'+t.name].properties[f.column],t.name+':'+f.column);assert(d['Table_'+f.target],f.target);}});
check('no free-text discipline selector',()=>walk(d,x=>{if(x.properties)assert(!('discipline' in x.properties));}));
check('all UUID paths classified',()=>{let count=0;walk(d,(x,path)=>{if(x.$ref==='#/$defs/Uuid')assert(['/FtkUuid','/ProviderUuid'].some(y=>path.startsWith(y)),path);if(['#/$defs/FtkUuid','#/$defs/ProviderUuid','#/$defs/FtkGeneratedUuidV7'].includes(x.$ref))count++;});assert.equal(count,c.uuid_field_map.length);});
check('provider UUID not narrowed',()=>assert.equal(d.Table_accounts.properties.auth_user_id.anyOf[0].$ref,'#/$defs/ProviderUuid'));
check('deficit and override scope',()=>{for(const n of ['Table_credit_deficits','Table_negative_limit_overrides','EligibilitySnapshot','Request_negative_limit_set'])for(const k of ['center_id','discipline_id'])assert(d[n].required.includes(k));});
check('bearer token semantics retained',()=>{assert.notEqual(d.Secret?.$ref,'#/$defs/FtkUuid');assert(c.uuid_generation_policy.bearer_tokens.includes('not_uuid'));});
check('lesson target / trace identity separated',()=>{for(const n of ['withdraw','reject','offer_alternative','approve']){const s=d['Request_lesson_request_'+n];assert(s.required.includes('lesson_request_id'));assert.equal(s.required.filter(x=>x==='request_id').length,1);}});
check('feature and module coverage preserved',()=>{assert.equal(new Set(c.operations.flatMap(o=>o.features)).size,33);assert.equal(new Set(c.tables.map(t=>t.module).filter(n=>n!=='X')).size,14);});
check('no new role or discipline role',()=>assert.deepEqual(d.Role.enum,['owner','org_manager','center_manager','staff','instructor','assistant','student']));
const sql=fs.readdirSync('supabase/migrations').sort().map(x=>fs.readFileSync('supabase/migrations/'+x,'utf8')).join('\n');
check('physical table/column coverage',()=>{for(const t of c.tables){const part=sql.split('create table core."'+t.name+'" (')[1]?.split('\n);')[0];assert(part,t.name);for(const col of Object.keys(d['Table_'+t.name].properties))assert(part.includes('"'+col+'" ') || sql.includes('alter table core.'+t.name+' add column if not exists '+col+' '),t.name+'.'+col);}});
check('private baseline grants / RLS',()=>{for(const t of c.tables)assert(sql.includes('alter table core."'+t.name+'" enable row level security;'));assert(!/gen_random_uuid|uuid_generate_v4|uuid_generate_v5/i.test(sql));});
check('Q-D01 product accepted and tags typed',()=>{assert(!c.open_product_decisions.some(x=>x.id==='Q-D01')); assert.equal(c.accepted_product_decisions.find(x=>x.id==='Q-D01').product_status,'accepted_closed');for(const n of ['Request_event_save','EventView'])assert(d[n].required.includes('discipline_ids'));assert(d.EventDisciplineIds.uniqueItems);assert(c.operations.find(o=>o.name==='event_register_v1').semantic_guards.includes('Q_D01_no_event_negative_credit'));});
check('EntityType covers physical tables exactly',()=>assert.deepEqual(new Set(d.EntityType.enum),new Set(c.tables.map(t=>t.name))));
check('Q-E01 accepted decision / preparation finance / typed terminal outcome',()=>{
 assert(!c.open_product_decisions.some(x=>x.id==='Q-E01'));
 assert.equal(c.accepted_product_decisions.find(x=>x.id==='Q-E01').product_status,'accepted_closed');
 assert(d.Request_event_register.properties.preparation_id);
 assert(d.Table_event_payment_preparations.properties.debt_id);
 assert(d.Table_student_credit_movements.properties.source_debt_id);
 assert.equal(d.EventCapacityClosed.properties.outcome.const,'capacity_closed');
 assert(d.Success_event_register.properties.data.$ref.endsWith('/EventRegistrationResult'));
 for(const example of JSON.parse(fs.readFileSync('examples/runtime-requests.json')).examples){
  const op=c.operations.find(o=>o.name===example.operation);assert(op,example.operation);
  const validate=ajv.getSchema('contract'+op.request.$ref);assert(validate(example.request),example.operation+': '+JSON.stringify(validate.errors));
 }

 for(const example of JSON.parse(fs.readFileSync('examples/event-payment-results.json')).examples){
  const op=c.operations.find(o=>o.name===example.operation);const validate=ajv.getSchema('contract'+op.success.$ref);
  assert(validate(example.response),example.operation+': '+JSON.stringify(validate.errors));
 }

});
check('Q-E03 planned boundary evidence / no client time override',()=>{
 assert(d.ParticipantCancellationBasis.required.includes('planned_starts_at'));
 assert(d.ParticipantCancellationBasis.required.includes('cancelled_at'));
 assert.equal(d.ParticipantCancellationBasis.properties.rule.const,'planned_start_v1');
 assert(d.Table_event_registrations.properties.participant_cancellation);
 assert(d.EventRegistrationView.properties.participant_cancellation);
 for(const field of ['cancelled_at','actual_starts_at','participant_cancellation'])assert(!d.Request_event_registration_cancel.properties[field]);
 assert(c.operations.find(o=>o.name==='event_registration_cancel_v1').semantic_guards.includes('Q_E03_planned_start_inclusive_immutable_backend_cancellation_basis'));
});
const report={contract:c.version,tables:c.tables.length,operations:c.operations.length,definitions:Object.keys(d).length,uuid_paths:c.uuid_field_map.length,references:refs,checks:results,scope:'static contract + physical source coverage; NOT Auth/RLS business/race/load/restore acceptance'};
fs.writeFileSync('reports/consistency.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({checks:results.length,tables:report.tables,operations:report.operations,definitions:report.definitions,status:'passed'}));
