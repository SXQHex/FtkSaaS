-- Register the effective gates in the same explicit form used by the source audit.
-- The preceding local-applied migration remains immutable.
begin;
insert into private.runtime_operations(name,permission,billing_class,features) values('sale_change_preview_v1','entitlement.correct','new',array['F17']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
insert into private.runtime_operations(name,permission,billing_class,features) values('sale_change_apply_v1','entitlement.correct','new',array['F17']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
notify pgrst,'reload schema';
commit;
