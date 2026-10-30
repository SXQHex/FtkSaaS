-- Metadata only. Never select application, Auth, Storage or configuration rows.
-- app-owned schemas; provider-owned public/auth/storage are separate acceptance.
with app_relations as (
 select c.oid,n.nspname as schema,c.relname as name,c.relkind,c.relrowsecurity,c.relforcerowsecurity
 from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname in ('core','private','api_v1') and c.relkind in ('r','p','v','m','S')
), app_functions as (
 select p.oid,n.nspname as schema,p.proname as name,
 pg_get_function_identity_arguments(p.oid) as arguments,
 pg_get_function_result(p.oid) as result,p.prosecdef as security_definer,
 p.provolatile as volatility,p.proconfig as config,
 md5(pg_get_functiondef(p.oid)) as definition_hash
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in ('core','private','api_v1') and p.prokind in ('f','p')
)
select jsonb_build_object(
 'format',1,
 'relations',coalesce((select jsonb_agg(jsonb_build_object(
  'schema',r.schema,'name',r.name,'kind',r.relkind,'rls',r.relrowsecurity,'force_rls',r.relforcerowsecurity,'view_hash',case when r.relkind in ('v','m') then md5(pg_get_viewdef(r.oid,true)) else null end,
  'columns',(select coalesce(jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,'identity',a.attidentity,'generated',a.attgenerated,'default_hash',(select md5(pg_get_expr(d.adbin,d.adrelid)) from pg_attrdef d where d.adrelid=a.attrelid and d.adnum=a.attnum)) order by a.attnum),'[]'::jsonb) from pg_attribute a where a.attrelid=r.oid and a.attnum>0 and not a.attisdropped),
  'constraints',(select coalesce(jsonb_agg(jsonb_build_object('name',c.conname,'definition',pg_get_constraintdef(c.oid,true)) order by c.conname),'[]'::jsonb) from pg_constraint c where c.conrelid=r.oid),
  'indexes',(select coalesce(jsonb_agg(pg_get_indexdef(i.indexrelid) order by pg_get_indexdef(i.indexrelid)),'[]'::jsonb) from pg_index i where i.indrelid=r.oid)
 ) order by r.schema,r.name) from app_relations r),'[]'::jsonb),
 'functions',coalesce((select jsonb_agg(to_jsonb(f)-'oid' order by f.schema,f.name,f.arguments) from app_functions f),'[]'::jsonb),
 'policies',coalesce((select jsonb_agg(jsonb_build_object('schema',schemaname,'table',tablename,'name',policyname,'permissive',permissive,'roles',roles,'command',cmd,'using',qual,'check',with_check) order by schemaname,tablename,policyname) from pg_policies where schemaname in ('core','private','api_v1')),'[]'::jsonb),
 'types',coalesce((select jsonb_agg(jsonb_build_object('schema',n.nspname,'name',t.typname,'kind',t.typtype,'base',format_type(t.typbasetype,t.typtypmod),'not_null',t.typnotnull,'default_hash',md5(t.typdefault),'labels',(select jsonb_agg(e.enumlabel order by e.enumsortorder) from pg_enum e where e.enumtypid=t.oid),'constraints',(select jsonb_agg(pg_get_constraintdef(c.oid,true) order by c.conname) from pg_constraint c where c.contypid=t.oid)) order by n.nspname,t.typname) from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname in ('core','private','api_v1') and t.typtype in ('e','d')),'[]'::jsonb),
 'triggers',coalesce((select jsonb_agg(jsonb_build_object('schema',r.schema,'table',r.name,'name',t.tgname,'enabled',t.tgenabled,'definition_hash',md5(pg_get_triggerdef(t.oid,true))) order by r.schema,r.name,t.tgname) from pg_trigger t join app_relations r on r.oid=t.tgrelid where not t.tgisinternal),'[]'::jsonb),
 'grants',jsonb_build_object(
  'relations',coalesce((select jsonb_agg(jsonb_build_object('schema',r.schema,'name',r.name,'grantee',case when a.grantee=0 then 'PUBLIC' else g.rolname end,'privilege',a.privilege_type,'grantable',a.is_grantable) order by r.schema,r.name,a.grantee,a.privilege_type) from app_relations r join pg_class c on c.oid=r.oid cross join lateral aclexplode(coalesce(c.relacl,acldefault(case when c.relkind='S' then 'S'::"char" else 'r'::"char" end,c.relowner))) a left join pg_roles g on g.oid=a.grantee),'[]'::jsonb),
  'functions',coalesce((select jsonb_agg(jsonb_build_object('schema',f.schema,'name',f.name,'arguments',f.arguments,'grantee',case when a.grantee=0 then 'PUBLIC' else g.rolname end,'privilege',a.privilege_type,'grantable',a.is_grantable) order by f.schema,f.name,f.arguments,a.grantee,a.privilege_type) from app_functions f join pg_proc p on p.oid=f.oid cross join lateral aclexplode(coalesce(p.proacl,acldefault('f'::"char",p.proowner))) a left join pg_roles g on g.oid=a.grantee),'[]'::jsonb)
 )
) as catalog;
