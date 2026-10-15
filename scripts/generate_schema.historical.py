"""Generate a private, deny-by-default physical baseline; business RPCs are separate work."""
import json,re
from pathlib import Path
R=Path(__file__).resolve().parents[1];p=json.loads((R/'contracts/08-FtkSaaS-tip-ve-operasyon-sozlesmesi.json').read_text());d=p['$defs'];baseline=next((R/'supabase/migrations').glob('*_discipline_uuidv7_baseline.sql')).read_text();baseline_names=set(re.findall(r'create table core."([^"]+)"',baseline));tables=[t for t in p['x-contract']['tables'] if t['name'] in baseline_names];tm={t['name']:t for t in tables}
def q(v):return '"'+v+'"'
def unwrap(s):
 if 'anyOf' in s:s=next(x for x in s['anyOf'] if x.get('type')!='null')
 return s
# API integer money strings map to database bigint, UUID stays uuid.
def sqltype(s,seen=()):
 s=unwrap(s)
 if '$ref' in s:
  n=s['$ref'].split('/')[-1]
  if n in ['Uuid','FtkUuid','ProviderUuid','FtkGeneratedUuidV7']:return 'uuid'
  if n in ['Money','PositiveMoney','Int','Count','PositiveInt']:return 'bigint'
  if n=='Instant':return 'timestamptz'
  if n=='Date':return 'date'
  if n=='Time':return 'time'
  if n in seen: return 'jsonb'
  return sqltype(d[n],(*seen,n))
 if 'enum' in s:return 'text' if isinstance(s['enum'][0],str) else 'bigint'
 t=s.get('type')
 if t=='array':
  item=sqltype(s['items']);return item+'[]' if item!='jsonb' else 'jsonb'
 return {'string':'text','boolean':'boolean','integer':'bigint','number':'numeric','object':'jsonb'}.get(t,'jsonb')
sql=['-- Generated baseline. No business endpoint is enabled by this migration.', 'begin;', 'create schema if not exists core;', 'create schema if not exists api_v1;', 'create schema if not exists private;', 'revoke all on schema core, private from public, anon, authenticated;', 'revoke all on schema api_v1 from public, anon, authenticated;', 'alter default privileges in schema core revoke all on tables from public, anon, authenticated;', 'alter default privileges in schema private revoke execute on functions from public;', '''create function private.new_uuid_v7() returns uuid language plpgsql volatile security invoker set search_path = '' as $$
declare result uuid;
begin
 if pg_catalog.to_regprocedure('pg_catalog.uuidv7(interval)') is not null then
   execute 'select pg_catalog.uuidv7()' into result;
 elsif pg_catalog.to_regprocedure('extensions.uuid_generate_v7()') is not null then
   execute 'select extensions.uuid_generate_v7()' into result;
 else
   raise exception using errcode='0A000', message='UUIDV7_GENERATOR_UNAVAILABLE';
 end if;
 return result;
end $$;''', 'revoke all on function private.new_uuid_v7() from public, anon, authenticated;']
for t in tables:
 n=t['name'];s=d['Table_'+n];cols=[]
 for col,shape in s['properties'].items():
  typ=sqltype(shape);default=''
  if col=='id':default=' default private.new_uuid_v7() primary key'
  elif col=='created_at':default=' default transaction_timestamp()'
  elif col=='version':default=' default 1'
  required=col in s['required'] and not any(a.get('type')=='null' for a in shape.get('anyOf',[])); cols.append(f'  {q(col)} {typ}{default}'+(' not null' if required and col!='id' else ''))
 if 'org_id' in s['properties']:cols.append('  unique (org_id,id)')
 if t['scope']=='C':cols.append('  unique (org_id,center_id,id)')
 sql.append('create table core.'+q(n)+' (\n'+',\n'.join(cols)+'\n);')
 sql.append(f'alter table core.{q(n)} enable row level security;')
 sql.append(f'revoke all on core.{q(n)} from public, anon, authenticated;')
# Create foreign keys after all tables exist, so circular organization-owner relationship is representable.
fk_count=0
for t in tables:
 n=t['name'];props=d['Table_'+n]['properties'];fks=list(t['foreign_keys'])
 if 'org_id' in props and n!='organizations':fks.append({'column':'org_id','target':'organizations','same_tenant':False})
 if 'center_id' in props and n!='centers':fks.append({'column':'center_id','target':'centers','same_tenant':True})
 seen=set()
 for f in fks:
  col=f['column'];target=f['target'];tp=d['Table_'+target]['properties']
  if (col,target) in seen:continue
  seen.add((col,target));src=[col];dst=['id']
  if f['same_tenant'] and 'org_id' in props and 'org_id' in tp and col!='org_id':
   src=['org_id',col];dst=['org_id','id']
   # Local source/target references must also agree on center. Catalog sale/pool links remain cross-center.
   crosscenter=(n in ['product_scopes','entitlement_accounts','entitlement_movements','entitlement_allocations','credit_deficits','quota_buckets','freezes'] or col in ['source_sale_id','settled_sale_id','previous_sale_id'])
   if tm[target]['scope']=='C' and t['scope']=='C' and col!='center_id' and not crosscenter:src=['org_id','center_id',col];dst=['org_id','center_id','id']
  constraint='fk_'+n+'_'+col
  sql.append(f'alter table core.{q(n)} add constraint {q(constraint)} foreign key ({",".join(map(q,src))}) references core.{q(target)} ({",".join(map(q,dst))}) deferrable initially deferred;')
  sql.append(f'create index {q("ix_"+str(fk_count)+"_"+n[:24])} on core.{q(n)} ({",".join(map(q,src))});');fk_count+=1
# Explicit D constraints: centers reference org-wide discipline identity, never text or cloned person.
for n in ['room_capacities','classes','sessions','lesson_requests','instructor_agreements','person_disciplines','credit_deficits','negative_limit_overrides']:
 sql.append(f'alter table core.{q(n)} add constraint {q("cd_"+n)} foreign key (org_id,center_id,discipline_id) references core.center_disciplines (org_id,center_id,discipline_id) deferrable initially deferred;') if False else None
sql += ['alter table core.center_disciplines add unique (org_id,center_id,discipline_id);']
for n in ['room_capacities','classes','sessions','lesson_requests','instructor_agreements','person_disciplines','credit_deficits','negative_limit_overrides']:
 sql.append(f'alter table core.{q(n)} add constraint {q("cd_"+n)} foreign key (org_id,center_id,discipline_id) references core.center_disciplines (org_id,center_id,discipline_id) deferrable initially deferred;')
 sql.append(f'create index {q("ix_cd_"+n)} on core.{q(n)} (org_id,center_id,discipline_id);')
sql += [
 'alter table core.negative_limit_overrides add unique (org_id,center_id,discipline_id,person_id);',
 'alter table core.negative_limit_overrides add check (limit_count>=0);',
 'alter table core.room_capacities add unique (org_id,center_id,room_id,discipline_id);',
 "create unique index person_discipline_active on core.person_disciplines(org_id,center_id,discipline_id,person_id,kind) where state='active';",
 "alter table core.person_disciplines add check(kind in ('student','instructor'));",
 'alter table core.entitlement_accounts add unique (org_id,sale_id);',
 "create unique index active_reservation on core.reservations(org_id,session_id,person_id) where state='active';",
 'alter table core.sessions add unique(org_id,center_id,discipline_id,id);',
 'alter table core.reservations add unique(org_id,center_id,session_id,person_id,id);',
 'alter table core.credit_deficits add unique(org_id,reservation_id);',
 'alter table core.credit_deficits add foreign key (org_id,center_id,discipline_id,session_id) references core.sessions(org_id,center_id,discipline_id,id) deferrable initially deferred;',
 'alter table core.credit_deficits add foreign key (org_id,center_id,session_id,person_id,reservation_id) references core.reservations(org_id,center_id,session_id,person_id,id) deferrable initially deferred;',
 'create index ix_deficit_scope on core.credit_deficits(org_id,center_id,discipline_id,person_id,state,created_at,id);',
 'alter table core.credit_deficits add check(quantity>0);',
 "alter table core.product_scopes add check ((scope_kind='center_discipline' and center_id is not null and discipline_id is not null) or (scope_kind='center_all_disciplines' and center_id is not null and discipline_id is null) or (scope_kind='organization_discipline' and center_id is null and discipline_id is not null) or (scope_kind='organization_all' and center_id is null and discipline_id is null));",
 "alter table core.product_scopes add check (cardinality(usage_targets)>0 and usage_targets <@ array['lesson','event']::text[]);",
 "alter table core.product_scopes add check (not (class_id is not null and event_id is not null));",
 "alter table core.product_scopes add check ((class_id is null or 'lesson'=any(usage_targets)) and (event_id is null or 'event'=any(usage_targets)));",
]
# Basic scalar, enum and explicit base-domain constraints.
for t in tables:
 n=t['name'];s=d['Table_'+n];props=s['properties']
 for col,shape in props.items():
  raw=unwrap(shape);raw=d.get(raw.get('$ref','').split('/')[-1],raw)
  if 'enum' in raw:
   values=','.join("'"+str(x).replace("'","''")+"'" for x in raw['enum']);sql.append(f'alter table core.{q(n)} add check ({q(col)} in ({values}));')
  if sqltype(shape)=='bigint' and raw.get('minimum') is not None:sql.append(f'alter table core.{q(n)} add check ({q(col)}>={raw["minimum"]});')
 if 'nominal' in props and 'maximum' in props:sql.append(f'alter table core.{q(n)} add check(0<=nominal and nominal<=maximum);')
 if 'starts_at' in props and 'ends_at' in props:sql.append(f'alter table core.{q(n)} add check(starts_at<ends_at);')
# Org row must carry its own identity. All UUID types remain generic uuid for legacy/provider acceptance.
sql+=['alter table core.organizations add check(org_id=id);','alter table core.centers add check(center_id=id);','alter table core.accounts add unique(auth_user_id);','commit;']
out='\n'.join(sql)+'\n';paths=list((R/'supabase/migrations').glob('*_discipline_uuidv7_baseline.sql'));assert len(paths)==1;
if paths[0].read_text() != out:raise RuntimeError('Baseline is frozen; create a new Supabase migration for changes.')
print('Physical baseline',len(tables),'tables',fk_count,'catalog FKs; private deny-by-default; business RPCs pending')
