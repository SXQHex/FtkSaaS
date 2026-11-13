-- F17 package changes require a paid feature on every preview, apply and replay.
-- Keep ordinary termination and renewal on their existing permission/plan rules.
begin;
update private.runtime_operations set features=array['F17']::text[]
where name in ('sale_change_preview_v1','sale_change_apply_v1');
notify pgrst,'reload schema';
commit;
