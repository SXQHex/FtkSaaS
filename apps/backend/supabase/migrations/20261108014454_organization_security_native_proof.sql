begin;
-- Keep Auth factor rows behind the existing service-only native MFA boundary.
-- A mandatory organization policy additionally requires an enrolled factor.
do $patch$
declare body text;anchor text;
begin
 body:=pg_get_functiondef('private.account_mfa_assert(uuid,uuid,jsonb)'::regprocedure);
 anchor:=$a$ if exists(select 1 from auth.mfa_factors f where f.user_id=auth_id and f.status::text='verified')$a$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Mandatory native MFA proof drift';end if;
 execute replace(body,anchor,$a$ if aux->>'mfa_required'='true' and not exists(select 1 from auth.mfa_factors f where f.user_id=auth_id and f.status::text='verified') then perform private.fail('AUTH_REQUIRED');end if;
$a$||anchor);
 body:=pg_get_functiondef('private.organization_security_assert(text,jsonb,uuid,uuid,uuid,uuid,jsonb)'::regprocedure);
 anchor:=$a$  if aux->>'verified_aal' is distinct from 'aal2' or not exists(select 1 from auth.mfa_factors f where f.user_id=auth_id and f.status::text='verified') or
   not exists(select 1 from auth.sessions s where s.id=session and s.user_id=auth_id and to_jsonb(s)->>'aal'='aal2') then perform private.fail('AUTH_REQUIRED');end if;$a$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Organization native MFA boundary drift';end if;
 execute replace(body,anchor,$a$  perform private.account_mfa_assert(auth_id,session,coalesce(aux,'{}'::jsonb)||jsonb_build_object('mfa_required',true));$a$);
end$patch$;
commit;
