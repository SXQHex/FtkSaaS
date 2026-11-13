-- P10: additive preview warning only; no merge, write or new authority.
begin;
create function private.crm_import_email_matches(org uuid,c uuid,actor uuid,email text) returns jsonb language sql stable security invoker set search_path='' as $$
 with candidates as (
  select p.id,p.display_name from core.people p where p.org_id=org and p.state='active'
   and exists(select 1 from core.person_contacts pc where pc.org_id=org and pc.person_id=p.id and pc.kind='email' and lower(btrim(pc.value))=lower(btrim(email)))
   and (private.is_org_reader(org,actor) or exists(select 1 from core.center_relationships rel where rel.org_id=org and rel.center_id=c and rel.person_id=p.id and rel.state='active') or (exists(select 1 from private.person_origins po where po.org_id=org and po.center_id=c and po.person_id=p.id) and not exists(select 1 from core.center_relationships rel where rel.org_id=org and rel.person_id=p.id)))
  order by p.id limit 51
 ), first_page as (select * from candidates order by id limit 50)
 select jsonb_build_object('email_matches',coalesce((select jsonb_agg(jsonb_build_object('person_id',id,'display_name',display_name) order by id) from first_page),'[]'),
  'email_matches_truncated',(select count(*)>50 from candidates))
$$;
create or replace function private.crm_import_row_view(row_id uuid,actor uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare x core.import_rows;j core.import_jobs;body jsonb;
begin
 select * into x from core.import_rows where id=row_id;select * into j from core.import_jobs where id=x.job_id;
 if j.mapping->>'kind' is distinct from 'crm_applications' or x.state not in ('valid','applied') then return null;end if;
 perform private.crm_import_access(x.org_id,x.center_id,actor,false);body:=private.crm_import_body(x.payload);
 return jsonb_build_object('intake',body,'source',private.crm_import_source(x.id))||private.crm_phone_matches(x.org_id,x.center_id,actor,body->>'phone')||private.crm_import_email_matches(x.org_id,x.center_id,actor,body->>'email');
end$$;
revoke all on function private.crm_import_email_matches(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function private.crm_import_email_matches(uuid,uuid,uuid,text) to service_role;
commit;
