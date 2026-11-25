begin;
create function private.account_identity_payload(native_user auth.users,names private.account_identity_names)
returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
 'given_name',names.given_name,'family_name',names.family_name,
 'email',case when native_user.email_confirmed_at is not null then nullif(native_user.email,'') end,
 'phone',case when native_user.phone_confirmed_at is not null then nullif(native_user.phone,'') end,
 'unverified_phone',case when native_user.phone_confirmed_at is not null
  and ltrim(names.unverified_phone,'+')=ltrim(native_user.phone,'+') then null else names.unverified_phone end,
 'email_verified_at',native_user.email_confirmed_at,'phone_verified_at',native_user.phone_confirmed_at,
 'pending_email',nullif(native_user.email_change,''),'pending_phone',nullif(native_user.phone_change,''))
$$;
revoke all on function private.account_identity_payload(auth.users,private.account_identity_names)
 from public,anon,authenticated;
grant execute on function private.account_identity_payload(auth.users,private.account_identity_names) to service_role;

create or replace function private.account_identity_view(account uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
 select private.account_identity_payload(u,n)
 from core.accounts a join auth.users u on u.id=a.auth_user_id
 left join private.account_identity_names n on n.account_id=a.id where a.id=account
$$;

do $patch$
declare body text; anchor text;
begin
 body:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 anchor:=$old$  out:=jsonb_build_object('id',actor.id,'state',actor.state,'display_name',coalesce((
   select private.account_display_label(p,n,usr,true)
   from core.accounts a left join private.p07_profiles p on p.account_id=a.id
   left join private.account_identity_names n on n.account_id=a.id where a.id=actor.id
  ),''),'profile_notices',private.p07_profile_inbox(actor.id),'identity',private.account_identity_view(actor.id));$old$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Account read projection anchor drift';end if;
 execute replace(body,anchor,$new$  select jsonb_build_object('id',actor.id,'state',actor.state,
    'display_name',coalesce(private.account_display_label(p,n,usr,true),''),
    'profile_notices',private.p07_profile_inbox(actor.id),
    'identity',case when u.id is not null then private.account_identity_payload(u,n) end)
  into out from (values(actor.id,actor.auth_user_id)) as a(id,auth_user_id)
  left join private.p07_profiles p on p.account_id=a.id
  left join private.account_identity_names n on n.account_id=a.id
  left join auth.users u on u.id=a.auth_user_id;$new$);

 body:=pg_get_functiondef('private.p07_profile_management(jsonb,uuid)'::regprocedure);
 anchor:='declare data jsonb;ver bigint;';
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Account profile data declaration drift';end if;
 body:=replace(body,anchor,anchor||'identity jsonb;');
 anchor:=' select version into ver from core.accounts where id=account;';
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Account profile version anchor drift';end if;
 body:=replace(body,anchor,anchor||E'\n identity:=private.account_identity_view(account);');
 anchor:='private.account_identity_view(account)->';
 if array_length(string_to_array(body,anchor),1)<>4 then raise exception 'Account profile identity fields drift';end if;
 execute replace(body,anchor,'identity->');
end$patch$;
commit;
