-- Versioned catalog labels. Existing financial/entitlement snapshots retain their product version.
begin;
alter table core.product_versions add column if not exists published_name text;
-- The pre-migration catalog persisted only this name. Do not invent older labels.
update core.product_versions v set published_name=p.name from core.products p where p.org_id=v.org_id and p.id=v.product_id;
alter table core.product_versions alter column published_name set not null;
create function private.product_version_name_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='UPDATE' then
  if new.published_name is distinct from old.published_name then perform private.fail('INVALID_STATE_TRANSITION');end if;
 else
  if new.published_name is null then select p.name into new.published_name from core.products p where p.org_id=new.org_id and p.id=new.product_id;end if;
 end if;
 return new;
end$$;
create trigger product_version_name before insert or update on core.product_versions for each row execute function private.product_version_name_guard();
-- Existing ProductTerms.name now reads from the selected immutable version.
do $patch$
declare b text:=pg_get_functiondef('private.catalog_terms(uuid,uuid,uuid)'::regprocedure);a text:=$a$'name',p.name$a$;
begin
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Studio catalog name anchor drift';end if;
 execute replace(b,a,$a$'name',v.published_name$a$);
end$patch$;
-- The same publication command creates a new version; no rename mutation rewrites old versions.
do $patch$
declare b text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);a text;
begin
 a:='insert into core.product_versions(id,org_id,center_id,product_id,kind,';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Studio publication columns anchor drift';end if;
 b:=replace(b,a,'insert into core.product_versions(id,org_id,center_id,product_id,published_name,kind,');
 a:=$a$values(record_id,org,center,selected,terms->>'kind'$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Studio publication name anchor drift';end if;
 b:=replace(b,a,$a$values(record_id,org,center,selected,case when private.current_plan_name(org)='starter' then terms->>'name' else (select name from core.products where org_id=org and id=selected) end,terms->>'kind'$a$);
 -- Only the live Starter catalog label changes. Other plans retain their existing master-label semantics.
 a:=$a$idx:=idx+1;
  end loop;subject:='product_versions';$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Studio publication completion anchor drift';end if;
 b:=replace(b,a,$a$idx:=idx+1;
  end loop;
  if private.current_plan_name(org)='starter' then update core.products set name=terms->>'name',version=version+1 where org_id=org and id=selected and name is distinct from terms->>'name';end if;
  subject:='product_versions';$a$);
 execute b;
end$patch$;
-- Current discipline prefix gates new sales/publications; already-purchased rights still use frozen scope.
do $patch$
declare b text:=pg_get_functiondef('private.starter_product_allowed(uuid,uuid)'::regprocedure);a text:='left(z.name,length(d.name))=d.name';
begin
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Studio version eligibility anchor drift';end if;
 execute replace(b,a,'left(p.published_name,length(d.name))=d.name');
end$patch$;
do $patch$
declare b text:=pg_get_functiondef('private.starter_request_guard(text,jsonb,uuid)'::regprocedure);a text:=$a$  if r->>'product_id' is not null and exists(select 1 from core.products p where p.org_id=org and p.id=(r->>'product_id')::uuid and left(p.name,length(prefix))<>prefix) then perform private.fail('PLAN_FEATURE_UNAVAILABLE');end if;$a$;
begin
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Studio rename publication anchor drift';end if;
 execute replace(b,a,'  -- A valid new publication may repair the current label; prior versions stay immutable.');
end$patch$;
revoke all on function private.product_version_name_guard() from public,anon,authenticated;
grant execute on function private.product_version_name_guard() to service_role;
notify pgrst,'reload schema';
commit;
