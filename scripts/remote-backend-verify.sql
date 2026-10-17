-- Read-only verification after installing the reviewed development backend.
select count(*) as core_tables,
       count(*) filter (where not c.relrowsecurity) as core_tables_without_rls
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='core' and c.relkind='r';
select count(*) as rpc_wrappers,
       count(*) filter (where has_function_privilege('anon',p.oid,'EXECUTE')) as anon_executable,
       count(*) filter (where has_function_privilege('authenticated',p.oid,'EXECUTE')) as authenticated_executable,
       count(*) filter (where has_function_privilege('service_role',p.oid,'EXECUTE')) as service_executable
from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='api_v1';
select has_schema_privilege('anon','core','USAGE') as anon_core,
       has_schema_privilege('authenticated','core','USAGE') as authenticated_core,
       has_schema_privilege('anon','private','USAGE') as anon_private,
       has_schema_privilege('authenticated','private','USAGE') as authenticated_private;
select count(*) as configured_operations from private.runtime_operations;
select version,name from supabase_migrations.schema_migrations order by version;
