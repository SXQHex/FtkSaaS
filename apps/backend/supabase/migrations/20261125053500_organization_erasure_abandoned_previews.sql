begin;

do $patch$
declare body text;anchor text;
begin
 body:=pg_get_functiondef('private.organization_erasure_scrub_intake(uuid,uuid,uuid)'::regprocedure);
 anchor:=$q$ if audit_row.reason is null then return 'completed';end if;$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Organization abandoned preview intake anchor mismatch';end if;
 execute replace(body,anchor,$q$ if exists(
  select 1 from private.p07_lifecycle_previews v join core.retention_holds h on h.subject_id=v.id
  where v.org_id=target_org and v.operation='organization_delete_apply_v1' and not v.used
 ) then return 'held';end if;
 if j.lease_until<=clock_timestamp() then perform private.fail('OPERATION_IN_PROGRESS');end if;
 delete from private.p07_lifecycle_previews v where v.org_id=target_org
  and v.operation='organization_delete_apply_v1' and not v.used and v.payload-'reason'=expected_payload
  and jsonb_typeof(v.payload->'reason')='string';
$q$||anchor);
end$patch$;

commit;
