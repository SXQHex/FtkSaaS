"""One-time, reproducible D01-D09/U01-U08 transfer from supplied v2.2 sources."""
import json, copy
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
source=ROOT/'contracts/source-v2.2/08-FtkSaaS-tip-ve-operasyon-sozlesmesi.json'
p=json.loads(source.read_text()); d=p['$defs']; c=p['x-contract']
def ref(n):return {'$ref':'#/$defs/'+n}
def nullable(n):return {'anyOf':[ref(n),{'type':'null'}]}
def obj(props,req=None):return {'type':'object','properties':props,'required':list(props) if req is None else req,'additionalProperties':False}
def add(n,k,t,required=True):
 d[n]['properties'][k]=ref(t)
 if required and k not in d[n]['required']:d[n]['required'].append(k)
def fk(table,col,target):
 t=next(t for t in c['tables'] if t['name']==table)
 if not any(f['column']==col for f in t['foreign_keys']):t['foreign_keys'].append({'column':col,'target':target,'same_tenant':True})
# Keep input acceptance distinct from generation. Existing and provider UUIDs are not rekeyed.
d['FtkUuid']={**ref('Uuid'),'description':'Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.','x-uuid-origin':'ftksaas','x-generator':'uuidv7'}
d['ProviderUuid']={**ref('Uuid'),'description':'Provider-owned UUID; preserve version and value.','x-uuid-origin':'provider'}
# Annotate every UUID occurrence, including array items and nullable branches, without narrowing input acceptance.
def walk(x,path):
 if isinstance(x,dict):
  if x.get('$ref')=='#/$defs/Uuid':
   provider=path.endswith('/auth_user_id')
   x['$ref']='#/$defs/ProviderUuid' if provider else '#/$defs/FtkUuid'
  for k,v in list(x.items()):walk(v,path+'/'+k)
 elif isinstance(x,list):
  for i,v in enumerate(x):walk(v,path+'/'+str(i))
for name,s in list(d.items()):
 if name not in ['Uuid','FtkUuid','ProviderUuid']:walk(s,name)
# nullable provider property is explicitly classified (walk path has anyOf suffix).
d['Table_accounts']['properties']['auth_user_id']=nullable('ProviderUuid')
for n,s in d.items():
 props=s.get('properties',{})
 for k in ['operation_key','client_request_key']:
  if k in props:props[k]=ref('FtkUuid')
 if n=='Request_operation_status_get':props['key']=ref('FtkUuid')
# Repair source collision: lesson target request_id overwrote transport request_id.
for n,schema in d.items():
 if n.startswith('Request_lesson_request_') and schema.get('required',[]).count('request_id')>1:
  schema['required']=list(dict.fromkeys(schema['required']))
  schema['properties']['lesson_request_id']=ref('FtkUuid')
  schema['required'].append('lesson_request_id')
# Replace free-text discipline selectors everywhere; keep name only in discipline definition.
for n,s in d.items():
 props=s.get('properties',{})
 if 'discipline' in props:
  old=props.pop('discipline');props['discipline_id']=nullable('FtkUuid') if 'anyOf' in old else ref('FtkUuid')
  s['required']=[('discipline_id' if a=='discipline' else a) for a in s['required']]
for n in ['Table_sessions','Table_lesson_requests','Table_instructor_agreements','SessionCreate','SessionView','Request_lesson_request_create','Request_instructor_agreement_publish']:
 add(n,'discipline_id','FtkUuid')
for n in ['Table_credit_deficits','Table_negative_limit_overrides']:
 add(n,'center_id','FtkUuid'); add(n,'discipline_id','FtkUuid')
 next(t for t in c['tables'] if t['name']==n[6:])['scope']='C'
for n in ['EligibilitySnapshot','Request_negative_limit_set','Request_negcredit_valuation_set']:
 add(n,'center_id','FtkUuid'); add(n,'discipline_id','FtkUuid')
# Scope is discriminated and target eligibility is orthogonal. class/event selectors keep existing AND semantics.
d['PackageScopeKind']={'enum':['center_discipline','center_all_disciplines','organization_discipline','organization_all']}
d['UsageTarget']={'enum':['lesson','event']}
scprops={'scope_kind':ref('PackageScopeKind'),'center_id':nullable('FtkUuid'),'discipline_id':nullable('FtkUuid'),'class_id':nullable('FtkUuid'),'event_id':nullable('FtkUuid'),'usage_targets':{'type':'array','items':ref('UsageTarget'),'minItems':1,'uniqueItems':True}}
scope=obj(scprops,['scope_kind','center_id','discipline_id','usage_targets'])
scope['allOf']=[]
for kind,hascenter,hasdiscipline in [('center_discipline',1,1),('center_all_disciplines',1,0),('organization_discipline',0,1),('organization_all',0,0)]:
 scope['allOf'].append({'if':{'properties':{'scope_kind':{'const':kind}},'required':['scope_kind']},'then':{'properties':{'center_id':ref('FtkUuid') if hascenter else {'type':'null'},'discipline_id':ref('FtkUuid') if hasdiscipline else {'type':'null'}}}})
scope['allOf'] += [
 {'if':{'properties':{'class_id':{'type':'string'}},'required':['class_id']},'then':{'properties':{'event_id':{'type':'null'},'usage_targets':{'contains':{'const':'lesson'}}}}},
 {'if':{'properties':{'event_id':{'type':'string'}},'required':['event_id']},'then':{'properties':{'class_id':{'type':'null'},'usage_targets':{'contains':{'const':'event'}}}}}]
scope['x-invariant']='Rows OR; dimensions AND. Same organization; plan/current center access and class/date/capacity gates remain mandatory. No pool per scope. Discipline-target event matching blocked pending Q-D01.'
d['ProductScope']=scope
s=d['Table_product_scopes']; base={k:v for k,v in s['properties'].items() if k in ['id','org_id','created_at','version','product_version_id']}
s['properties']={**base,**copy.deepcopy(scprops)};s['required']=['id','created_at','org_id','product_version_id',*scope['required']];s['allOf']=copy.deepcopy(scope['allOf'])
t=next(t for t in c['tables'] if t['name']=='product_scopes');t['foreign_keys']=[f for f in t['foreign_keys'] if f['column']!='usable_center_id'];fk('product_scopes','center_id','centers');fk('product_scopes','discipline_id','disciplines')
d['ProductTerms']['properties']['scopes']['minItems']=1
add('Table_credit_deficits','session_id','FtkUuid'); fk('credit_deficits','session_id','sessions')
# Context in read DTOs. Calendar event classification remains unspecified; no fake discipline inferred.
d['CalendarItem']['properties']['discipline_id']=nullable('FtkUuid')
d['CalendarItem']['allOf']=[{'if':{'properties':{'type':{'const':'session'}},'required':['type']},'then':{'required':['discipline_id'],'properties':{'discipline_id':ref('FtkUuid')}}}]
d['DeficitScopeView']=obj({'center_id':ref('FtkUuid'),'discipline_id':ref('FtkUuid'),'reserved':ref('Count'),'consumed':ref('Count')})
add('EntitlementView','deficit_scopes','DeficitScopeView',False)
d['EntitlementView']['properties']['deficit_scopes']={'type':'array','items':ref('DeficitScopeView')};d['EntitlementView']['required'].append('deficit_scopes')
d['EntitlementView']['x-invariant']='available/reserved/consumed are sale pool totals, never duplicated by discipline. deficit aggregate is display-only; limits use deficit_scopes.'
# New physical relationships do not carry login grants.
def table(name,module,scope,props,invariant,fks):
 common={'id':ref('FtkUuid'),'created_at':ref('Instant'),'version':ref('PositiveInt'),'org_id':ref('FtkUuid')}
 if scope=='C':common['center_id']=ref('FtkUuid')
 d['Table_'+name]=obj({**common,**props})
 c['tables'].append({'name':name,'module':module,'scope':scope,'schema':ref('Table_'+name),'foreign_keys':[{'column':a,'target':b,'same_tenant':True} for a,b in fks],'invariants':invariant})
table('disciplines','M01','O',{'name':ref('Text'),'state':ref('RecordState')},'Org identity shared across centers; no role grant.',[])
table('center_disciplines','M01','C',{'discipline_id':ref('FtkUuid'),'state':ref('RecordState')},'UQ(org,center,discipline); activation does not grant plan or operational access.',[('discipline_id','disciplines')])
d['DisciplineRelationshipKind']={'enum':['student','instructor']}
table('person_disciplines','M03','C',{'person_id':ref('FtkUuid'),'discipline_id':ref('FtkUuid'),'kind':ref('DisciplineRelationshipKind'),'state':ref('RelationshipState')},'UQ active(org,center,discipline,person,kind); one org person may have many relationships; no login grant; student activation/deactivation uses existing org distinct-person/open-operation rules.',[('person_id','people'),('discipline_id','disciplines')])
for t in ['room_capacities','classes','sessions','lesson_requests','instructor_agreements','credit_deficits','negative_limit_overrides']:
 fk(t,'discipline_id','disciplines')
 if t in ['credit_deficits','negative_limit_overrides']:fk(t,'center_id','centers')
for t in c['tables']:
 if t['name']=='credit_deficits':t['invariants']='D07: org/person/center/discipline reserved+consumed remaining quantity; own reservation once; source session scope immutable; settlement D08 past consumed before future reserved; never money debt.'
 if t['name']=='negative_limit_overrides':t['invariants']='UQ(org,center,discipline,person); override replaces default; mandatory upper preserved. Only this center manager.'
 if t['name']=='product_scopes':t['invariants']=scope['x-invariant']
 if t['name']=='instructor_agreements':t['invariants']+=' Agreement selection includes org/center/discipline/person/format/valid interval; no cross-discipline fallback.'
# Add typed CRUD contracts under existing permissions, not new product roles.
d['DisciplineView']=obj({'id':ref('FtkUuid'),'name':ref('Text'),'state':ref('RecordState'),'version':ref('PositiveInt')})
d['DisciplinePage']=obj({'items':{'type':'array','items':ref('DisciplineView')},'next_cursor':nullable('Text')})
baseop=copy.deepcopy(next(o for o in c['operations'] if o['name']=='class_save_v1'))
def operation(name,module,permission,props,required,read=False,result='Mutation'):
 short=name.removesuffix('_v1');head={'client_api_version':{'const':1},'request_id':ref('FtkUuid'),'org_id':ref('FtkUuid')}
 if not read:head['operation_key']=ref('FtkUuid')
 d['Request_'+short]=obj({**head,**props},[*head,*required])
 d['Success_'+short]=obj({'ok':{'const':True},'data':ref(result),'trace_id':ref('FtkUuid')})
 o=copy.deepcopy(baseop);o.update(name=name,module=module,permission=permission,features=['F01'] if module=='M01' else ['F07'],transport='R' if read else 'W',billing_class='read' if read else 'config',request=ref('Request_'+short),success=ref('Success_'+short),transaction_class='read' if read else 'org_limit',audit=not read,transition={'effect':'read_only_business' if read else 'scoped_configuration','from':[],'to':[]},semantic_guards=['live_actor_and_scope','plan_capabilities_from_features','same_org_discipline','relationship_never_grants_login','expected_version_on_update'],acceptance_scenario_ids=['D-A01','D-A11','A01','A02','A03'])
 o['implementation_status']='contract_only';c['operations'].append(o)
operation('disciplines_list_v1','M01','org.read',{'page':ref('Page')},['page'],True,'DisciplinePage')
operation('discipline_save_v1','M01','org.manage',{'discipline_id':nullable('FtkUuid'),'name':ref('Text'),'state':ref('RecordState'),'expected_version':ref('PositiveInt')},['name','state'])
operation('center_discipline_set_v1','M01','center.manage',{'center_id':ref('FtkUuid'),'discipline_id':ref('FtkUuid'),'state':ref('RecordState'),'expected_version':ref('PositiveInt')},['center_id','discipline_id','state'])
operation('person_discipline_set_v1','M03','person.manage',{'center_id':ref('FtkUuid'),'person_id':ref('FtkUuid'),'discipline_id':ref('FtkUuid'),'kind':ref('DisciplineRelationshipKind'),'state':ref('RelationshipState'),'expected_version':ref('PositiveInt')},['center_id','person_id','discipline_id','kind','state'])
# Explicit machine guards for all affected paths, including workers and request approval.
for o in c['operations']:
 o.setdefault('implementation_status','contract_only')
 if any(x in o['name'] for x in ['reservation','sale_','entitlement','credit_','negative_limit','attendance','lesson_request','seat_offer','product_','session_','class_','instructor_agreement','event_register','import_']):
  o['semantic_guards']=list(dict.fromkeys(o['semantic_guards']+['same_org_center_discipline','scope_filter_before_entitlement_order','single_sale_pool_lock_across_disciplines','negative_limit_by_person_center_discipline','start_snapshot_no_retroactive_earning']))
  o['acceptance_scenario_ids']=list(dict.fromkeys(o['acceptance_scenario_ids']+['D-A02','D-A07','D-A09','D-A12']))
 if o['name'].startswith('event_'):o['semantic_guards']+=['Q-D01_event_discipline_matching_unresolved_no_inference']

# Emit an actual TS discriminated union from schema, rather than relying on ignored if/then codegen.
branches=[]
for suffix,kind,hascenter,hasdiscipline in [('CenterDiscipline','center_discipline',True,True),('CenterAllDisciplines','center_all_disciplines',True,False),('OrganizationDiscipline','organization_discipline',False,True),('OrganizationAll','organization_all',False,False)]:
 branch=copy.deepcopy(scope)
 branch['properties']['scope_kind']={'const':kind}
 branch['properties']['center_id']=ref('FtkUuid') if hascenter else {'type':'null'}
 branch['properties']['discipline_id']=ref('FtkUuid') if hasdiscipline else {'type':'null'}
 branch['allOf']=branch['allOf'][4:]
 d['PackageScope'+suffix]=branch;branches.append(ref('PackageScope'+suffix))
d['ProductScope']={'oneOf':branches,'description':scope['x-invariant']}
d['DisciplineRelationshipView']=obj({'center_id':ref('FtkUuid'),'discipline_id':ref('FtkUuid'),'kind':ref('DisciplineRelationshipKind'),'state':ref('RelationshipState')})
d['PersonView']['properties']['discipline_relationships']={'type':'array','items':ref('DisciplineRelationshipView')}
d['PersonView']['required'].append('discipline_relationships')
c['uuid_generation_policy']['selected_backend_generator']='uuid@14.0.3 v7(), crypto-backed; production wrapper accepts no randomness/time overrides'
c['uuid_generation_policy']['selected_database_generator']='capability-gated native uuidv7 or audited extension; unavailable in tested PG17, defaults fail closed'


# Q-D01 accepted: labels are not grants; events never use negative credit.
d['EventDisciplineIds']={'type':'array','items':ref('FtkUuid'),'uniqueItems':True,'description':'Zero/one/many org-owned labels. No entitlement or role grant.'}
for n in ['Request_event_save','EventView']:
 d[n]['properties']['discipline_ids']=ref('EventDisciplineIds');d[n]['required'].append('discipline_ids')
d['Request_event_list']['properties']['discipline_id']=nullable('FtkUuid')
d['CalendarItem']['properties']['discipline_ids']=ref('EventDisciplineIds')
d['CalendarItem']['allOf'].append({'if':{'properties':{'type':{'const':'event'}},'required':['type']},'then':{'required':['discipline_ids'],'properties':{'discipline_id':{'type':'null'},'discipline_ids':ref('EventDisciplineIds')}}})
d['PublicCalendarItem']['properties']['discipline_ids']=ref('EventDisciplineIds');d['PublicCalendarItem']['required'].append('discipline_ids')
table('event_disciplines','M13','C',{'event_id':ref('FtkUuid'),'discipline_id':ref('FtkUuid')},
 'Q-D01: zero/one/many labels; UQ(org,event,discipline); same org, no access grant. Exactly one label allows matching narrow scope with explicit event eligibility; zero/many only broad scopes. No event negative credit.',
 [('event_id','events'),('discipline_id','disciplines')])
for schema in d.values():
 for key in ['x-invariant','description']:
  if isinstance(schema,dict) and key in schema:
   schema[key]=schema[key].replace('Discipline-target event matching blocked pending Q-D01.','Q-D01: narrow event scope requires exactly one matching label and explicit event eligibility; no event negative credit.')
for t in c['tables']:
 t['invariants']=t['invariants'].replace('Discipline-target event matching blocked pending Q-D01.','Q-D01: narrow event scope requires exactly one matching label and explicit event eligibility; no event negative credit.')
for o in c['operations']:
 o['semantic_guards']=[g for g in o['semantic_guards'] if g!='Q-D01_event_discipline_matching_unresolved_no_inference']
 if o['name'].startswith('event_'):
  o['semantic_guards']=[g for g in o['semantic_guards'] if g not in ['same_org_center_discipline','negative_limit_by_person_center_discipline','start_snapshot_no_retroactive_earning']]
  o['semantic_guards']+=['Q_D01_event_labels_same_org_not_grants']
  if o['name'] in ['event_register_v1','event_attendance_close_v1','event_attendance_correct_v1']:
   o['semantic_guards']+=['Q_D01_no_event_negative_credit']
  if o['name']=='event_register_v1':
   o['semantic_guards']+=['Q_D01_single_label_narrow_or_broad_zero_many_broad_only','atomic_single_pool_available_entitlement_reservation']
  o['acceptance_scenario_ids']=list(dict.fromkeys(o['acceptance_scenario_ids']+['Q-D01-A01','Q-D01-A02','Q-D01-A03','Q-D01-A04','Q-D01-A05','Q-D01-A06','Q-D01-A07','Q-D01-A08']))
  if o['name']=='event_register_v1':
   o['semantic_guards']=[g for g in o['semantic_guards'] if g not in ['negative_limit_by_person_center_discipline','start_snapshot_no_retroactive_earning']]
   for error in ['CLASS_ACCESS_DENIED','ENTITLEMENT_UNAVAILABLE']:
    if error not in o['errors']:o['errors'].append(error)

d['EntityType']['enum']=list(dict.fromkeys(d['EntityType']['enum']+[t['name'] for t in c['tables']]))
# Exact UUID field map for DTOs/table columns, including nested/nullable UUIDs.
fields=[]
def classify(x,path):
 if isinstance(x,dict):
  if x.get('$ref') in ['#/$defs/FtkUuid','#/$defs/ProviderUuid','#/$defs/FtkGeneratedUuidV7']:
   fields.append({'path':path,'origin':'provider' if x['$ref'].endswith('ProviderUuid') else 'ftksaas','acceptance':'generic_uuid' if not x['$ref'].endswith('FtkGeneratedUuidV7') else 'uuidv7','generation':'preserve' if x['$ref'].endswith('ProviderUuid') else 'uuidv7'})
  for k,v in x.items():classify(v,path+'/'+k)
 elif isinstance(x,list):
  for i,v in enumerate(x):classify(v,path+'/'+str(i))
for n,s in d.items():classify(s,'#/$defs/'+n)
c['uuid_field_map']=fields;c['uuid_generation_policy']['field_by_field_schema_alignment']='completed_in_2.2-tech.1';c['uuid_generation_policy']['field_map']='x-contract.uuid_field_map'
c['version']='2.2-tech.2';c['status']='technical_transfer_verified_runtime_acceptance_pending'
c['production_gates']=[g for g in c['production_gates'] if not g.startswith('D01')]+['Q-D01_event_discipline_scope_decision','complete_business_RPC_RLS_Auth_tests','verify_uuidv7_generator_in_selected_runtime']
for a in c['amendments']:
 a['status']='technical_contract_transferred_runtime_tests_pending';a['technical_catalog_ready']=True
 if 'required_followup' in a:a['required_followup']=['runtime_D_acceptance_and_concurrency_tests','Q-D01_event_discipline_classification']
c['open_product_decisions']=[]
c['production_gates']=[g for g in c['production_gates'] if g!='Q-D01_event_discipline_scope_decision']
for a in c['amendments']:
 if 'required_followup' in a:a['required_followup']=[g for g in a['required_followup'] if g!='Q-D01_event_discipline_classification']
c['accepted_product_decisions']=[{'id':'Q-D01','source':'10-FtkSaaS-Q-D01-kabul-karari.md','product_status':'accepted_closed','technical_status':'schema_api_types_scope_kernel_verified_full_event_integration_pending','event_labels':'zero_one_many_same_org_not_grants','single_label':'explicit_event_eligibility_and_matching_narrow_or_broad_scope','zero_or_many_labels':'explicit_event_eligibility_and_broad_scope_only','negative_credit':'never_for_events','required_followup':['complete_authorized_event_register_preview_close_cancel_paths','last_shared_credit_concurrency_acceptance']}]
c['private_components']=[{'function':'private.event_package_scope_matches','kind':'read_only_scope_filter','does_not_replace':['actor','plan','center_access','validity','capacity','available_entitlement','event_terms']},{'function':'private.require_event_available_credit','kind':'positive_available_credit_gate','does_not_replace':['authoritative_balance_computation','pool_lock','atomic_allocation']}]

(ROOT/'contracts/08-FtkSaaS-tip-ve-operasyon-sozlesmesi.json').write_text(json.dumps(p,ensure_ascii=False,indent=2)+'\n')
print('transferred',len(c['tables']),'tables',len(c['operations']),'operations',len(d),'defs',len(fields),'UUID paths')
