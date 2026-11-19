begin;

alter table private.platform_invoices
 add column created_at timestamptz not null default statement_timestamp();
create index platform_invoice_directory_page on private.platform_invoices(org_id,created_at,id);

do $patch$
declare
 body text:=pg_get_functiondef('private.platform_directory(jsonb,uuid)'::regprocedure);
 anchor text;
begin
 anchor:=$a$'organizations','owners','payments','verified_accounts','initial_plans','operators'$a$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Platform directory view inventory drift';end if;
 body:=replace(body,anchor,anchor||$a$,'invoices'$a$);

 anchor:=$a$  or (view_name in ('initial_plans','operators') and r?'scope')$a$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Platform directory scope drift';end if;
 body:=replace(body,anchor,anchor||E'\n'||$a$  or (view_name='invoices' and org_filter is null)$a$);

 anchor:=$a$   union all
   select a.created_at,a.id,jsonb_build_object('kind','verified_account'$a$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Platform directory invoice projection drift';end if;
 execute replace(body,anchor,$a$   union all
   select x.created_at,x.id,private.platform_invoice_view(x)||jsonb_build_object('kind','invoice','checksum',x.checksum)
   from private.platform_invoices x
   where view_name='invoices' and x.org_id=org_filter
    and (x.published_at<=as_of or exists (
     select 1 from storage.objects o
     where o.bucket_id='ftksaas-invoices' and o.name=x.org_id||'/'||x.id and o.created_at<=as_of
    ))
$a$||anchor);
end$patch$;

commit;
