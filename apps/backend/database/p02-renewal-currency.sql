-- Final source review: independent renewal currency and unambiguous source-sale binding.
begin;
do $dependency$
declare b text:=pg_get_functiondef('private.p02_dependencies(uuid,uuid,uuid,uuid)'::regprocedure);old text:='declare hashes jsonb:';
begin
 if strpos(b,old)=0 then raise exception 'P02 dependency declaration anchor missing';end if;
 execute replace(b,old,E'#variable_conflict use_variable\ndeclare hashes jsonb:');
end$dependency$;
do $patch$
declare b text:=pg_get_functiondef('private.p02_sale(text,jsonb,uuid,uuid,uuid,uuid,uuid,uuid[],jsonb,uuid,uuid)'::regprocedure);old text;
begin
 old:=$p$if target_product.currency<>s.currency then perform private.fail('VALIDATION_FAILED');end if;$p$;
 if strpos(b,old)=0 then raise exception 'P02 renewal currency anchor missing';end if;
 execute replace(b,old,$p$if is_change and target_product.currency<>s.currency then perform private.fail('CURRENCY_MISMATCH');end if;$p$);
end$patch$;
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on all functions in schema private to service_role;
commit;
