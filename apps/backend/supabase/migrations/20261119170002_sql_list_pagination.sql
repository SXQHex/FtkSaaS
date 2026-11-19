-- Apply the cursor window to typed rows before building the response objects.
begin;

create type private.offset_page_cursor as (
 page_limit integer,
 page_offset integer,
 scope text,
 has_cursor boolean,
 fingerprint text,
 legacy boolean
);

create function private.offset_page_bounds(page jsonb,scope text) returns private.offset_page_cursor
language plpgsql immutable security invoker set search_path='' as $$
declare
 bounds private.offset_page_cursor:=row(coalesce((page->>'limit')::int,50),0,scope,page->>'cursor' is not null,null,false);
 decoded jsonb;
begin
 if bounds.page_limit<1 or bounds.page_limit>200 or coalesce(page->>'sort','created_at_asc')<>'created_at_asc' then
  perform private.fail('VALIDATION_FAILED');
 end if;
 if bounds.has_cursor then
  begin
   decoded:=convert_from(decode(page->>'cursor','hex'),'UTF8')::jsonb;
   bounds.page_offset:=(decoded->>'offset')::int;
   if decoded->>'scope' is distinct from scope or bounds.page_offset is null or bounds.page_offset<0 then
    perform private.fail('VALIDATION_FAILED');
   end if;
   bounds.fingerprint:=decoded->>'fingerprint';
   bounds.legacy:=not coalesce(starts_with(bounds.fingerprint,'v2:'),false);
  exception when SQLSTATE 'P0001' then raise;when others then perform private.fail('VALIDATION_FAILED');end;
 end if;
 return bounds;
end$$;

create function private.offset_page_result(
 items jsonb,bounds private.offset_page_cursor,total bigint,fingerprint text,legacy_fingerprint text,as_of timestamptz
) returns jsonb language plpgsql immutable security invoker set search_path='' as $$
declare next_offset bigint:=bounds.page_offset::bigint+bounds.page_limit;next_cursor text;
begin
 if bounds.page_offset>total then perform private.fail('VALIDATION_FAILED');end if;
 if bounds.has_cursor and bounds.fingerprint is distinct from
    (case when bounds.legacy then legacy_fingerprint else fingerprint end) then
  perform private.fail('VERSION_CONFLICT');
 end if;
 if next_offset<total then
  next_cursor:=encode(convert_to(jsonb_build_object(
   'offset',next_offset,'scope',bounds.scope,'fingerprint',fingerprint)::text,'UTF8'),'hex');
 end if;
 return jsonb_build_object('items',items,'next_cursor',next_cursor,'as_of',as_of);
end$$;

create function private.studio_setup_view(s private.studio_setup_requests) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('id',s.id,'account_id',s.account_id,'name',s.name,'created_at',s.created_at,
  'state',case when s.organization_id is null then 'pending' else 'fulfilled' end,'organization_id',s.organization_id)
$$;

create or replace function private.studio_setup_list(r jsonb,account uuid,platform boolean) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare
 queue boolean:=coalesce((r->>'platform_queue')::boolean,false);
 bounds private.offset_page_cursor;
 result jsonb;
begin
 if queue and not platform then perform private.fail('FORBIDDEN');end if;
 bounds:=private.offset_page_bounds(r->'page','studio-setup:'||account||':'||queue);
 with eligible as materialized (
  select s
  from private.studio_setup_requests s
  where (queue and s.organization_id is null and exists(
    select 1 from core.accounts a join auth.users u on u.id=a.auth_user_id
    where a.id=s.account_id and a.state='active' and u.email_confirmed_at is not null and u.deleted_at is null
     and (u.banned_until is null or u.banned_until<statement_timestamp())
   ) and not exists(select 1 from core.account_links l where l.account_id=s.account_id and l.state='active'))
   or (not queue and s.account_id=account)
 ), size as (select count(*) n from eligible),
 selected as (
  select s from eligible order by (s).created_at,(s).id limit bounds.page_limit offset bounds.page_offset
 )
 select private.offset_page_result(
  (select coalesce(jsonb_agg(private.studio_setup_view(p.s) order by (p.s).created_at,(p.s).id),'[]') from selected p),
  bounds,size.n,
  case when (bounds.has_cursor and not bounds.legacy) or bounds.page_offset::bigint+bounds.page_limit<size.n then
   (select 'v2:'||encode(sha256(coalesce(string_agg(sha256(pg_catalog.record_send(row(
     (e.s).id,(e.s).account_id,(e.s).name,(e.s).created_at,(e.s).organization_id))),
     ''::bytea order by (e.s).created_at,(e.s).id),''::bytea)),'hex') from eligible e)
  end,
  case when bounds.legacy and bounds.page_offset<=size.n then
   (select md5(coalesce(jsonb_agg(private.studio_setup_view(e.s) order by (e.s).created_at,(e.s).id),'[]')::text) from eligible e)
  end,statement_timestamp())
 into result from size;
 return result;
end$$;

create or replace function private.platform_invoices_page(r jsonb,p_org uuid,p_account uuid) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare
 bounds private.offset_page_cursor:=private.offset_page_bounds(r->'page',
  encode(extensions.digest(jsonb_build_object('org',p_org,'account',p_account,'view','platform_invoices')::text,'sha256'),'hex'));
 result jsonb;
begin
 with eligible as materialized (
  select x from private.platform_invoices x where x.org_id=p_org and x.published_at is not null
 ), size as (select count(*) n from eligible),
 selected as (
  select x from eligible order by (x).published_at,(x).id limit bounds.page_limit offset bounds.page_offset
 )
 select private.offset_page_result(
  (select coalesce(jsonb_agg(private.platform_invoice_view(s.x) order by (s.x).published_at,(s.x).id),'[]') from selected s),
  bounds,size.n,
  case when (bounds.has_cursor and not bounds.legacy) or bounds.page_offset::bigint+bounds.page_limit<size.n then
   (select 'v2:'||encode(sha256(coalesce(string_agg(sha256(pg_catalog.record_send(row(
    (e.x).id,(e.x).invoice_number,(e.x).issued_on,(e.x).mime,(e.x).bytes,(e.x).published_at))),
    ''::bytea order by (e.x).published_at,(e.x).id),''::bytea)),'hex') from eligible e)
  end,
  case when bounds.legacy and bounds.page_offset<=size.n then
   (select md5(coalesce(jsonb_agg(private.platform_invoice_view(e.x) order by (e.x).published_at,(e.x).id),'[]')::text) from eligible e)
  end,statement_timestamp())
 into result from size;
 return result;
end$$;

-- The platform invoice directory already uses a keyset cursor. Limit its branch before projecting invoices.
do $patch$
declare
 body text:=pg_get_functiondef('private.platform_directory(jsonb,uuid)'::regprocedure);
 old text:=$old$   from private.platform_invoices x
   where view_name='invoices' and x.org_id=org_filter
    and (x.published_at<=as_of or exists (
     select 1 from storage.objects o
     where o.bucket_id='ftksaas-invoices' and o.name=x.org_id||'/'||x.id and o.created_at<=as_of
    ))$old$;
begin
 if cardinality(string_to_array(body,old))<>2 then raise exception 'Invoice directory projection anchor changed';end if;
 execute replace(body,old,$new$   from (
    select i.* from private.platform_invoices i
    where view_name='invoices' and i.org_id=org_filter
     and i.created_at<=as_of and (after_id is null or (i.created_at,i.id)>(after_at,after_id))
     and (i.published_at<=as_of or exists (
      select 1 from storage.objects o
      where o.bucket_id='ftksaas-invoices' and o.name=i.org_id||'/'||i.id and o.created_at<=as_of
     ))
    order by i.created_at,i.id limit take+1
   ) x$new$);
end$patch$;

revoke all on function private.offset_page_bounds(jsonb,text),private.studio_setup_view(private.studio_setup_requests),
 private.offset_page_result(jsonb,private.offset_page_cursor,bigint,text,text,timestamptz) from public,anon,authenticated;
grant execute on function private.offset_page_bounds(jsonb,text),private.studio_setup_view(private.studio_setup_requests),
 private.offset_page_result(jsonb,private.offset_page_cursor,bigint,text,text,timestamptz) to service_role;

commit;
