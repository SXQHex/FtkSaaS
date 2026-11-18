begin;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('ftksaas-invoices','ftksaas-invoices',false,2097152,array['application/pdf','application/zip']);
create table private.platform_invoices(
 id uuid primary key,
 org_id uuid not null references core.organizations(id),
 invoice_number text not null check(length(btrim(invoice_number)) between 1 and 128),
 issued_on date not null,
 mime text not null check(mime in ('application/pdf','application/zip')),
 bytes int not null check(bytes between 1 and 2097152),
 checksum text not null check(checksum ~ '^[a-f0-9]{64}$'),
 published_at timestamptz
);
create unique index platform_invoice_number on private.platform_invoices(org_id,invoice_number) where published_at is not null;
create index platform_invoices_page on private.platform_invoices(org_id,published_at,id) where published_at is not null;
alter table private.platform_invoices enable row level security;
revoke all on private.platform_invoices from public,anon,authenticated;
grant select,insert,update on private.platform_invoices to service_role;

create function private.platform_invoice_view(x private.platform_invoices) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('id',x.id,'invoice_number',x.invoice_number,'issued_on',x.issued_on,
  'mime',x.mime,'bytes',x.bytes,'published_at',x.published_at)
$$;

create function private.platform_invoice_storage(p_org uuid,p_id uuid,published_only boolean) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare x private.platform_invoices;
begin
 select * into x from private.platform_invoices where org_id=p_org and id=p_id;
 if not found or (published_only and x.published_at is null) then perform private.fail('NOT_FOUND');end if;
 return jsonb_build_object('object_key',p_org||'/'||p_id,'bytes',x.bytes,'mime',x.mime,
  'checksum',x.checksum,'published',x.published_at is not null);
end$$;

create function private.platform_invoices_page(r jsonb,p_org uuid,p_account uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select private.p06_page(
  coalesce(jsonb_agg(private.platform_invoice_view(x) order by x.published_at,x.id),'[]'),r->'page',
  encode(extensions.digest(jsonb_build_object('org',p_org,'account',p_account,'view','platform_invoices')::text,'sha256'),'hex'),
  statement_timestamp())
 from private.platform_invoices x where org_id=p_org and published_at is not null
$$;

create function private.platform_invoice_publish(p_org uuid,p_id uuid,aux jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare x private.platform_invoices;
begin
 select * into x from private.platform_invoices where org_id=p_org and id=p_id for update;
 if not found then perform private.fail('NOT_FOUND');end if;
 if x.published_at is not null or exists(select 1 from private.platform_invoices
  where org_id=p_org and invoice_number=x.invoice_number and published_at is not null)
 then perform private.fail('VERSION_CONFLICT');end if;
 if aux->'invoice_verified' is distinct from 'true'::jsonb
  or aux->>'checksum' is distinct from x.checksum then perform private.fail('VALIDATION_FAILED');end if;
 update private.platform_invoices set published_at=clock_timestamp() where id=p_id returning * into x;
 return private.platform_invoice_view(x);
end$$;

do $patch$
declare body text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);anchor text;
begin
 -- Owner billing reads follow the existing subscription read boundary, including platform suspension.
 anchor:=$a$'subscription_get_v1','saas_payment_submit_v1'$a$;
 if array_length(string_to_array(body,anchor),1)<4 then raise exception 'Platform invoice billing gate drift';end if;
 body:=replace(body,anchor,anchor||$a$,'organization_invoices_list_v1','organization_invoice_file_get_v1'$a$);
 anchor:=$a$'subscription_get_v1','subscription_change_cancel_v1','saas_grace_extend_v1'$a$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Platform invoice subscription due gate drift';end if;
 body:=replace(body,anchor,anchor||$a$,'organization_invoices_list_v1','organization_invoice_file_get_v1','platform_invoice_upload_prepare_v1','platform_invoice_publish_v1'$a$);

 anchor:=' -- DOMAIN_CASES';
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Platform invoice dispatch drift';end if;
 body:=replace(body,anchor,$a$
 when 'platform_invoice_upload_prepare_v1' then
  if exists(select 1 from private.platform_invoices where org_id=org and invoice_number=btrim(r->>'invoice_number') and published_at is not null)
  then perform private.fail('VERSION_CONFLICT');end if;
  insert into private.platform_invoices(id,org_id,invoice_number,issued_on,mime,bytes,checksum)
   values(record_id,org,btrim(r->>'invoice_number'),(r->>'issued_on')::date,r->>'mime',(r->>'bytes')::int,r->>'checksum');
  out:=jsonb_build_object('invoice_id',record_id,'upload_url',org||'/'||record_id);
  audit_delta:=jsonb_build_object('invoice_id',record_id);
  record_id:=org;subject:='organizations';
 when 'platform_invoice_publish_v1' then
  out:=private.platform_invoice_publish(org,(r->>'invoice_id')::uuid,p_aux);
  audit_delta:=jsonb_build_object('invoice_id',r->>'invoice_id');
  record_id:=org;subject:='organizations';
 when 'organization_invoices_list_v1' then
  return jsonb_build_object('ok',true,'data',private.platform_invoices_page(r,org,actor.id),'trace_id',trace);
 when 'organization_invoice_file_get_v1' then
  if p_aux->>'phase'='invoice_download' then
   return jsonb_build_object('_internal_invoice',private.platform_invoice_storage(org,(r->>'invoice_id')::uuid,true));
  end if;
  out:=private.platform_invoice_view((select x from private.platform_invoices x
   where x.org_id=org and x.id=(r->>'invoice_id')::uuid and x.published_at is not null));
  if out->>'id' is null then perform private.fail('NOT_FOUND');end if;
$a$||anchor);
 anchor:=$a$ if mutable then
  payload_digest:=$a$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Platform invoice preflight drift';end if;
 execute replace(body,anchor,$a$ if p_operation='platform_invoice_publish_v1' and p_aux->>'phase'='invoice_upload_context' then
  return jsonb_build_object('_internal_invoice',private.platform_invoice_storage(org,(r->>'invoice_id')::uuid,false));
 end if;
$a$||anchor);
end$patch$;

do $patch$
declare body text:=pg_get_functiondef('private.tracking_operation_module(text)'::regprocedure);
 anchor text:='"organization_billing_tax_set_v1":"M12"';
begin
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Platform invoice audit module drift';end if;
 execute replace(body,anchor,anchor||',"platform_invoice_upload_prepare_v1":"M12","platform_invoice_publish_v1":"M12"');
end$patch$;

revoke all on function private.platform_invoice_view(private.platform_invoices),private.platform_invoice_storage(uuid,uuid,boolean),
 private.platform_invoices_page(jsonb,uuid,uuid),private.platform_invoice_publish(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function private.platform_invoice_view(private.platform_invoices),private.platform_invoice_storage(uuid,uuid,boolean),
 private.platform_invoices_page(jsonb,uuid,uuid),private.platform_invoice_publish(uuid,uuid,jsonb) to service_role;

insert into private.runtime_operations(name,permission,billing_class,features) values('platform_invoice_upload_prepare_v1','platform.owner','exempt',array[]::text[]);
create function api_v1.platform_invoice_upload_prepare_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null)
 returns jsonb language sql security invoker set search_path='' as $$
 select private.execute_operation('platform_invoice_upload_prepare_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)
$$;
revoke all on function api_v1.platform_invoice_upload_prepare_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.platform_invoice_upload_prepare_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;

insert into private.runtime_operations(name,permission,billing_class,features) values('platform_invoice_publish_v1','platform.owner','exempt',array[]::text[]);
create function api_v1.platform_invoice_publish_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null)
 returns jsonb language sql security invoker set search_path='' as $$
 select private.execute_operation('platform_invoice_publish_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)
$$;
revoke all on function api_v1.platform_invoice_publish_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.platform_invoice_publish_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;

insert into private.runtime_operations(name,permission,billing_class,features) values('organization_invoices_list_v1','org.owner','read',array[]::text[]);
create function api_v1.organization_invoices_list_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null)
 returns jsonb language sql security invoker set search_path='' as $$
 select private.execute_operation('organization_invoices_list_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)
$$;
revoke all on function api_v1.organization_invoices_list_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.organization_invoices_list_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;

insert into private.runtime_operations(name,permission,billing_class,features) values('organization_invoice_file_get_v1','org.owner','read',array[]::text[]);
create function api_v1.organization_invoice_file_get_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null)
 returns jsonb language sql security invoker set search_path='' as $$
 select private.execute_operation('organization_invoice_file_get_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)
$$;
revoke all on function api_v1.organization_invoice_file_get_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.organization_invoice_file_get_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;

commit;
