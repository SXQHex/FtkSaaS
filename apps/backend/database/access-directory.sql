begin;
-- No historical timestamp is invented. Capture future provider acknowledgements
-- at the native job transition; existing successful jobs keep an unknown date.
alter table private.invitation_delivery_state add column provider_accepted_at timestamptz;
create function private.invitation_accepted_stamp() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.kind='account_invitation' and new.state='succeeded' and new.provider_reference is not null
  and (old.state is distinct from new.state or old.provider_reference is distinct from new.provider_reference) then
  update private.invitation_delivery_state set provider_accepted_at=coalesce(provider_accepted_at,clock_timestamp()) where job_id=new.id;
 end if;return new;
end$$;
create trigger invitation_accepted_stamp after update of state,provider_reference on core.outbox_jobs for each row execute function private.invitation_accepted_stamp();
create function private.directory_resend_allowed(org uuid,center uuid,actor uuid,pid uuid) returns boolean
language plpgsql stable security invoker set search_path='' as $$
declare members uuid[]:=private.p07_person_members(org,pid);
begin
 return private.access_mode(org) in ('normal','grace') and not private.starter_scope_required(org) and private.can_invite(org,actor,center,pid)
  and private.member_summary_enabled(org,array['account_access_send_v1'],jsonb_build_object('org_id',org,'center_id',center,'person_id',pid))
  and exists(select 1 from core.people p where p.org_id=org and p.id=pid)
  and exists(select 1 from core.person_contacts c where c.org_id=org and c.person_id=pid and c.kind='email' and not c.account_projection_retired)
  and not exists(select 1 from core.account_links l where l.org_id=org and l.person_id=any(members) and l.state='active');
end$$;
-- Invitation/link metadata authority is not a grant to read a person's name.
create function private.directory_person_name(org uuid,center uuid,actor uuid,pid uuid) returns text
language plpgsql stable security invoker set search_path='' as $$
begin
 if not (private.p07_same_person(org,actor,pid) or private.is_org_reader(org,actor) or private.person_operational_access(org,actor,center,pid) or private.person_assigned_access(org,actor,center,pid))
  or not private.member_summary_enabled(org,array['person_get_v1'],jsonb_build_object('org_id',org,'center_id',center,'person_id',pid)) then return null;end if;
 return (select p.display_name from core.people p where p.org_id=org and p.id=private.p07_person_root(org,pid));
end$$;
create function private.access_directory_item(op text,org uuid,center uuid,actor uuid,account uuid,id uuid,asof timestamptz) returns jsonb
language plpgsql security invoker set search_path='' as $$
#variable_conflict use_variable
declare i core.invitations;l core.account_links;detail jsonb;vals jsonb;state text;version bigint;pid uuid;actionable boolean:=false;kind text;delivery jsonb;job core.outbox_jobs;stamp timestamptz;
begin
 if op='account_access_revoke_v1' then
  select x.* into i from core.invitations x where x.org_id=org and x.center_id=center and x.id=id;
  pid:=i.person_id;version:=i.version;kind:='invitations';state:=case when i.state='pending' and i.expires_at<=asof then 'expired' else i.state end;
  actionable:=i.state='pending' and i.expires_at>asof;
  delivery:='{"visibility":"restricted"}';
  -- Match job_status_get: only the original sender may inspect delivery facts.
  if i.inviter_account_id=account and private.invitation_features(org) then
   select j.* into job from private.invitation_deliveries d join core.outbox_jobs j on j.id=d.job_id and j.org_id=i.org_id and j.kind='account_invitation' where d.invitation_id=i.id;
   select x.provider_accepted_at into stamp from private.invitation_delivery_state x where x.job_id=job.id;
   delivery:=jsonb_build_object('visibility','available','state',job.state,'sent_at',case when job.state='succeeded' and job.provider_reference is not null then stamp end);
  end if;
  detail:=jsonb_build_object('kind','invitation','created_at',i.created_at,'expires_at',i.expires_at,'can_resend',private.directory_resend_allowed(org,center,actor,pid),'delivery',delivery);
  vals:=jsonb_build_object('person_id',pid,'invitation_id',id,'center_id',center,'expires_at',i.expires_at,'actionable',actionable);
 else
  select x.* into l from core.account_links x where x.org_id=org and x.id=id;
  pid:=l.person_id;version:=l.version;kind:='account_links';state:=l.state;
  begin
   perform private.p07_revoke_access(op,jsonb_build_object('link_id',id),org,center,actor);
   actionable:=l.state='active' and not exists(select 1 from core.organizations o where o.id=org and o.owner_person_id=pid);
  exception when sqlstate 'P0001' then if sqlerrm not in ('FORBIDDEN','BILLING_OPERATION_RESTRICTED') then raise;end if;end;
  detail:=jsonb_build_object('kind','account_link','created_at',l.created_at);
  vals:=jsonb_build_object('person_id',pid,'link_id',id,'actionable',actionable);
 end if;
 detail:=detail||jsonb_build_object('display_name',private.directory_person_name(org,center,actor,pid));
 return jsonb_build_object('operation',op,'entity',jsonb_build_object('type',kind,'id',id),'exists',true,'state',state,'versions',jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type',kind,'id',id),'version',version)),
  'as_of',asof,'current',jsonb_build_object('operation',op,'values',vals),'access_detail',detail);
end$$;
alter function private.p07_revoke_management(jsonb,uuid,uuid,uuid) rename to p07_revoke_management_person;
create function private.p07_revoke_management(r jsonb,org uuid,center uuid,actor uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
#variable_conflict use_variable
declare op text:=r->>'operation';k jsonb:=r#>'{selector,key}';lim int:=coalesce((r#>>'{page,limit}')::int,50);cur jsonb;last_at timestamptz;last_id uuid;asof timestamptz:=clock_timestamp();read_at timestamptz:=asof;account uuid;
 h text;result jsonb;items jsonb;summary jsonb;token text;last_item jsonb;
begin
 if k->>'directory' is distinct from 'center' then return private.p07_revoke_management_person(r,org,center,actor);end if;
 if center is null or r#>>'{selector,operation}' is distinct from op or op not in ('account_access_revoke_v1','account_link_remove_v1') or r->'entity' is not null and r->'entity'<>'null'::jsonb then perform private.fail('VALIDATION_FAILED');end if;
 if lim<1 or lim>200 or coalesce(r#>>'{page,sort}','created_at_asc')<>'created_at_asc' then perform private.fail('VALIDATION_FAILED');end if;
 perform private.assert_center(org,center);
 if op='account_link_remove_v1' and not private.is_manager(org,actor,center) then perform private.fail('FORBIDDEN');end if;
 if op='account_access_revoke_v1' and not (private.is_manager(org,actor,center) or private.staff_grant(org,actor,center,'invite.student') or private.has_role(org,actor,'instructor',center) or private.staff_grant(org,actor,center,'person.manage')) then
  -- Default native student invitation staff grant has no explicit override row.
  if not private.has_role(org,actor,'staff',center) then perform private.fail('FORBIDDEN');end if;
 end if;
 if private.access_mode(org)='bootstrap' then perform private.fail('SUBSCRIPTION_NOT_STARTED');end if;
 if private.access_mode(org)='closed' then perform private.fail('SERVICE_UNAVAILABLE');end if;
 select l.account_id into account from core.account_links l where l.org_id=org and l.person_id=actor and l.state='active' and l.verified_at is not null;
 h:=encode(extensions.digest(jsonb_build_object('account',account,'request',r-'request_id'-'page')::text,'sha256'),'hex');
 if r#>>'{page,cursor}' is not null then
  begin cur:=convert_from(decode(r#>>'{page,cursor}','hex'),'utf8')::jsonb;last_at:=(cur->>'at')::timestamptz;last_id:=(cur->>'id')::uuid;asof:=(cur->>'as_of')::timestamptz;
   if cur->>'scope' is distinct from h or last_at is null or last_id is null or asof is null or not isfinite(last_at) or not isfinite(asof) or asof>clock_timestamp() then perform private.fail('VALIDATION_FAILED');end if;
  exception when others then perform private.fail('VALIDATION_FAILED');end;
 end if;
 with eligible as materialized(
  select i.id,i.created_at,case when i.state='pending' and i.expires_at<=read_at then 'expired' else i.state end state,private.directory_person_name(org,center,actor,i.person_id) display_name
   from core.invitations i join core.people p on p.org_id=i.org_id and p.id=private.p07_person_root(org,i.person_id)
   where op='account_access_revoke_v1' and i.org_id=org and i.center_id=center and i.created_at<=asof and private.can_invite(org,actor,center,i.person_id)
    and (k->>'query' is null or strpos(lower(private.directory_person_name(org,center,actor,i.person_id)),lower(k->>'query'))>0)
  union all
  select l.id,l.created_at,l.state,private.directory_person_name(org,center,actor,l.person_id) display_name from core.account_links l join core.people p on p.org_id=l.org_id and p.id=private.p07_person_root(org,l.person_id)
   where op='account_link_remove_v1' and l.org_id=org and l.created_at<=asof
    and (exists(select 1 from private.person_center_relationships x where x.org_id=org and x.center_id=center and private.p07_same_person(org,x.person_id,l.person_id))
     or exists(select 1 from core.invitations x where x.org_id=org and x.center_id=center and private.p07_same_person(org,x.person_id,l.person_id))
     or exists(select 1 from core.role_assignments x where x.org_id=org and private.p07_same_person(org,x.person_id,l.person_id) and (x.scope_center_id=center or x.scope_center_id is null)))
    and (k->>'query' is null or strpos(lower(private.directory_person_name(org,center,actor,l.person_id)),lower(k->>'query'))>0)
 ), counts as(select state,count(*) n from eligible group by state),matched as materialized(select * from eligible where k->>'status' is null or state=k->>'status'),
 bounded as materialized(select * from matched where cur is null or (created_at,id)>(last_at,last_id) order by created_at,id limit lim+1),
 page as(select * from bounded order by created_at,id limit lim)
 select coalesce((select jsonb_agg(private.access_directory_item(op,org,center,actor,account,p.id,read_at)||jsonb_build_object('_at',p.created_at) order by p.created_at,p.id) from page p),'[]'::jsonb),
  jsonb_build_object('total',(select count(*) from eligible),'filtered',(select count(*) from matched),'by_state',coalesce((select jsonb_agg(jsonb_build_object('state',state,'count',n) order by state) from counts),'[]'::jsonb)),
  case when (select count(*) from bounded)>lim then 'more' end into items,summary,token;
 if token is not null then last_item:=items->-1;token:=encode(convert_to(jsonb_build_object('scope',h,'at',last_item->'_at','id',last_item#>'{entity,id}','as_of',asof)::text,'utf8'),'hex');end if;
 select coalesce(jsonb_agg(x-'_at' order by n),'[]'::jsonb) into items from jsonb_array_elements(items) with ordinality a(x,n);
 result:=jsonb_build_object('items',items,'next_cursor',token,'as_of',read_at,'access_summary',summary);
 return jsonb_build_object('data',result,'subject','people');
end$$;
revoke all on function private.invitation_accepted_stamp() from public,anon,authenticated,service_role;
revoke all on function private.directory_person_name(uuid,uuid,uuid,uuid),private.directory_resend_allowed(uuid,uuid,uuid,uuid),private.access_directory_item(text,uuid,uuid,uuid,uuid,uuid,timestamptz),private.p07_revoke_management(jsonb,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function private.directory_person_name(uuid,uuid,uuid,uuid),private.directory_resend_allowed(uuid,uuid,uuid,uuid),private.access_directory_item(text,uuid,uuid,uuid,uuid,uuid,timestamptz),private.p07_revoke_management(jsonb,uuid,uuid,uuid) to service_role;
notify pgrst,'reload schema';
commit;
