-- Preserve applied migration 26; redact financial reasons and support legacy draft metadata.
begin;
do $patch$
declare b text;before_b text;
begin
 b:=pg_get_functiondef('private.lesson_view(uuid,uuid,boolean)'::regprocedure);before_b:=b;
 b:=replace(b,$old$'blocked_reason',a.blocked_reason$old$,$new$'blocked_reason',case when financial then a.blocked_reason end$new$);
 if b=before_b then raise exception 'LESSON_VIEW_PATCH_SOURCE_MISMATCH';end if;execute b;
 b:=pg_get_functiondef('private.lesson_dispatch(text,jsonb,uuid,uuid,uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);before_b:=b;
 b:=replace(b,$old$    if a.consumes_on_close is null then perform private.fail('POLICY_NOT_CONFIGURED');end if;$old$,$new$    if a.consumes_on_close is null then
     -- Legacy draft metadata absence is not a new blanket closure gate.
     terms:=coalesce(a.policy_snapshot,private.lesson_terms(org,v.id));
     consumes:=private.lesson_consumes(org,v.id,a.result,terms);
     update core.attendance_entries set consumes_on_close=consumes,policy_snapshot=terms,version=version+1 where org_id=org and id=a.id;
     a.consumes_on_close:=consumes;a.policy_snapshot:=terms;
    end if;$new$);
 if b=before_b then raise exception 'LESSON_LEGACY_PATCH_SOURCE_MISMATCH';end if;execute b;
end$patch$;
commit;
