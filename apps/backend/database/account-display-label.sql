begin;

alter table private.p07_profiles add column display_name_explicit boolean;

create function private.account_label_is_default(label text,email text,phone text,account_id uuid)
returns boolean language sql immutable security invoker set search_path='' as $$
 select label is null or label ~ '[^[:space:]@]+@[^[:space:]@]+'
  or lower(label) is not distinct from nullif(lower(split_part(btrim(email),'@',1)),'')
  or ltrim(label,'+') is not distinct from nullif(ltrim(btrim(phone),'+'),'')
  or label is not distinct from account_id::text
$$;

create function private.account_display_label(
 profile private.p07_profiles,names private.account_identity_names,native_user auth.users,allow_email boolean
) returns text language sql stable security invoker set search_path='' as $$
 with candidates as (
  select nullif(btrim(case when profile.account_id is not null then profile.display_name
    else native_user.raw_user_meta_data->>'display_name' end),'') chosen,
   nullif(concat_ws(' ',nullif(btrim(names.given_name),''),nullif(btrim(names.family_name),'')),'') full_name
 )
 select coalesce(
  case when coalesce(profile.display_name_explicit,
    not private.account_label_is_default(chosen,native_user.email,native_user.phone,profile.account_id))
    and (allow_email or chosen !~ '[^[:space:]@]+@[^[:space:]@]+') then chosen end,
  case when allow_email or full_name !~ '[^[:space:]@]+@[^[:space:]@]+' then full_name end,
  case when allow_email and native_user.email_confirmed_at is not null then nullif(btrim(native_user.email),'') end
 )
 from candidates
$$;

create or replace function private.account_identity_initialize() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 insert into private.p07_profiles(account_id,display_name,display_name_explicit)
  select new.id,coalesce(u.raw_user_meta_data->>'display_name',u.email,u.phone,new.id::text),
   not private.account_label_is_default(nullif(btrim(u.raw_user_meta_data->>'display_name'),''),
    u.email,u.phone,new.id)
  from auth.users u where u.id=new.auth_user_id
  on conflict(account_id) do nothing;
 return new;
end$$;

do $patch$
declare body text; anchor text;
begin
 body:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 anchor:=$old$'display_name',private.p07_profile(actor.id),'profile_notices'$old$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Own account display projection drift';end if;
 body:=replace(body,anchor,$new$'display_name',coalesce((
   select private.account_display_label(p,n,usr,true)
   from core.accounts a left join private.p07_profiles p on p.account_id=a.id
   left join private.account_identity_names n on n.account_id=a.id where a.id=actor.id
  ),''),'profile_notices'$new$);

 anchor:=$old$  insert into private.p07_profiles values(actor.id,r->>'display_name') on conflict(account_id) do update set display_name=excluded.display_name;$old$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Explicit display name writer drift';end if;
 execute replace(body,anchor,$new$  insert into private.p07_profiles as p(account_id,display_name,display_name_explicit)
   values(actor.id,r->>'display_name',true) on conflict(account_id) do update set
   display_name_explicit=case when p.display_name is distinct from excluded.display_name then true else p.display_name_explicit end,
   display_name=excluded.display_name;$new$);

 body:=pg_get_functiondef('private.platform_directory(jsonb,uuid)'::regprocedure);
 anchor:=$old$nullif(btrim(u.raw_user_meta_data->>'display_name'),'')$old$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Platform operator display projection drift';end if;
 body:=replace(body,anchor,'private.account_display_label(p,n,u,true)');
 anchor:=$old$left join core.accounts a on a.auth_user_id=m.auth_user_id where view_name='operators'$old$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Platform operator identity joins drift';end if;
 execute replace(body,anchor,$new$left join core.accounts a on a.auth_user_id=m.auth_user_id
   left join private.p07_profiles p on p.account_id=a.id
   left join private.account_identity_names n on n.account_id=a.id where view_name='operators'$new$);
end$patch$;

revoke all on function private.account_label_is_default(text,text,text,uuid),
 private.account_display_label(private.p07_profiles,private.account_identity_names,auth.users,boolean)
 from public,anon,authenticated;
grant execute on function private.account_label_is_default(text,text,text,uuid),
 private.account_display_label(private.p07_profiles,private.account_identity_names,auth.users,boolean) to service_role;

commit;
