begin;

-- The native users DELETE cascades to one_time_tokens. Apply the existing
-- exact-record hold both when preparing the permit and inside that DELETE.
do $patch$
declare body text;anchor text;
begin
 body:=pg_get_functiondef('private.account_auth_erasure_readiness(uuid,name)'::regprocedure);
 anchor:=' -- Native ownership is a blocker';
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Auth token hold readiness anchor mismatch';end if;
 execute replace(body,anchor,$a$ if exists(
  select 1
  from auth.one_time_tokens t
  join core.retention_holds h on h.subject_id=t.id
  where t.user_id=a.auth_user_id and h.subject_table in ('one_time_tokens','auth.one_time_tokens')
 ) then
  return jsonb_build_object('state','held');
 end if;
$a$||anchor);

 body:=pg_get_functiondef('private.account_native_delete_proof()'::regprocedure);
 anchor:='  or exists(select 1 from auth.refresh_tokens t where t.user_id=OLD.id::text)';
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Auth token erasure proof anchor mismatch';end if;
 execute replace(body,anchor,anchor||$a$
  or exists(select 1 from auth.one_time_tokens t where t.user_id=OLD.id)$a$);
end$patch$;

commit;
