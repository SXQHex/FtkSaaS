-- Preserve a followup's factual deadline when native completion changes its kind.
-- Completed legacy activities without evidence are never relabelled as followups.
begin;
alter table core.crm_activities add column if not exists followup_due_at timestamptz;
update core.crm_activities set followup_due_at=due_at where kind='followup' and due_at is not null;
create function private.crm_keep_followup_origin() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if TG_OP='UPDATE' then new.followup_due_at:=old.followup_due_at;else new.followup_due_at:=null;end if;
 if new.kind='followup' and new.due_at is not null then new.followup_due_at:=new.due_at;end if;
 return new;
end$$;
create trigger crm_followup_origin before insert or update on core.crm_activities for each row execute function private.crm_keep_followup_origin();
create index crm_followup_directory on core.crm_activities(org_id,center_id,followup_due_at,id) where followup_due_at is not null;
create function private.crm_followup_rows(p_org uuid,p_center uuid,p_actor uuid)
returns table(id uuid,created_at timestamptz,version bigint,due_at timestamptz,completed_at timestamptz,assigned_to uuid,item jsonb)
language sql stable security invoker set search_path='' as $$
 select a.id,a.created_at,a.version,a.followup_due_at,a.completed_at,l.assigned_person_id,
 jsonb_build_object('kind','followup','activity_id',a.id,'lead_id',l.id,'person_id',l.person_id,'display_name',p.display_name,
  'assigned_to',l.assigned_person_id,'assigned_name',(select n.display_name from core.people n where n.org_id=p_org and n.id=private.p07_person_root(p_org,l.assigned_person_id)),
  'due_at',a.followup_due_at,'completed_at',a.completed_at,'note',a.note)
 from core.crm_activities a join core.leads l on l.org_id=a.org_id and l.id=a.lead_id and l.center_id=a.center_id
 join core.people p on p.org_id=l.org_id and p.id=private.p07_person_root(p_org,l.person_id)
 where a.org_id=p_org and a.center_id=p_center and a.followup_due_at is not null and private.center_accessible(p_org,p_center)
 and coalesce(private.p04_can_lead(p_org,p_center,p_actor,l.assigned_person_id),false)
$$;
create function private.crm_trial_policy_state(p_org uuid,p_center uuid,p_lead uuid) returns text
language plpgsql security invoker set search_path='' as $$
declare l core.leads;
begin
 select * into l from core.leads where org_id=p_org and center_id=p_center and id=p_lead;
 if l.id is null or l.state<>'open' then return 'lead_unavailable';end if;
 perform private.p04_trial_limit(p_org,p_center,l.person_id);return 'available';
exception when sqlstate 'P0001' then
 if sqlerrm='POLICY_NOT_CONFIGURED' then return 'policy_not_configured';elsif sqlerrm='QUOTA_EXCEEDED' then return 'quota_exceeded';else raise;end if;
end$$;
create function private.crm_discovery_page(r jsonb,p_org uuid,p_center uuid,p_actor uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare op text:=r->>'operation';k jsonb:=r#>'{selector,key}';directory text:=k->>'directory';lim int:=coalesce((r#>>'{page,limit}')::int,50);
 sorting text:=coalesce(r#>>'{page,sort}','created_at_asc');stamp timestamptz:=statement_timestamp();cur jsonb;last_at timestamptz;last_id uuid;h text;items jsonb;token text;
 feature text;zone text;day_start timestamptz;day_end timestamptz;policy_state text;
begin
 if p_center is null or not private.center_accessible(p_org,p_center) then perform private.fail('NOT_FOUND');end if;
 if r#>>'{selector,operation}' is distinct from op or lim<1 or lim>200 or (r->'entity' is not null and r->'entity'<>'null'::jsonb)
  or sorting not in ('created_at_asc','created_at_desc','due_at_asc') or (sorting='due_at_asc' and directory<>'followups')
  or not ((op='lead_save_v1' and directory='assignees') or (op='crm_activity_save_v1' and directory='followups') or (op='trial_offer_create_v1' and directory in ('history','products'))) then perform private.fail('VALIDATION_FAILED');end if;
 perform private.p04_access(op,r||k,p_org,p_center,p_actor);
 for feature in select unnest(features) from private.runtime_operations where name=op loop perform private.require_feature(p_org,feature);end loop;
 h:=encode(extensions.digest(jsonb_build_object('actor',p_actor,'request',r-'request_id'-'page','sort',sorting)::text,'sha256'),'hex');
 if r#>>'{page,cursor}' is not null then
  begin cur:=convert_from(decode(r#>>'{page,cursor}','hex'),'utf8')::jsonb;
   if cur->>'scope' is distinct from h or cur->>'at' is null or cur->>'id' is null or cur->>'as_of' is null then perform private.fail('VALIDATION_FAILED');end if;
   last_at:=(cur->>'at')::timestamptz;last_id:=(cur->>'id')::uuid;stamp:=(cur->>'as_of')::timestamptz;
   if not isfinite(last_at) or not isfinite(stamp) or stamp>statement_timestamp() then perform private.fail('VALIDATION_FAILED');end if;
  exception when others then perform private.fail('VALIDATION_FAILED');end;
 end if;
 select timezone into zone from core.centers where org_id=p_org and id=p_center;
 day_start:=date_trunc('day',stamp at time zone zone) at time zone zone;day_end:=(date_trunc('day',stamp at time zone zone)+interval '1 day') at time zone zone;
 if k?'interval' and (k#>>'{interval,starts_at}')::timestamptz>=(k#>>'{interval,ends_at}')::timestamptz then perform private.fail('VALIDATION_FAILED');end if;
 if directory='products' then policy_state:=private.crm_trial_policy_state(p_org,p_center,(k->>'lead_id')::uuid);end if;
 with rows as (
  select p.id,p.created_at,p.version,'people'::text subject,'active'::text state,p.created_at at,
   jsonb_build_object('kind','assignee','person_id',p.id,'display_name',p.display_name) detail
  from core.people p where directory='assignees' and p.org_id=p_org and p.state='active'
   and (private.is_manager(p_org,p.id,p_center) or private.staff_grant(p_org,p.id,p_center,'crm.daily'))
   and (private.is_manager(p_org,p_actor,p_center) or p.id=p_actor)
  union all
  select f.id,f.created_at,f.version,'crm_activities',case when f.completed_at is null then 'open' else 'completed' end,
   case when sorting='due_at_asc' then f.due_at else f.created_at end,f.item
  from private.crm_followup_rows(p_org,p_center,p_actor) f where directory='followups'
   and (not k?'assigned_to' or f.assigned_to is not distinct from (k->>'assigned_to')::uuid)
   and (not k?'interval' or (f.due_at>=(k#>>'{interval,starts_at}')::timestamptz and f.due_at<(k#>>'{interval,ends_at}')::timestamptz))
   and (coalesce(k->>'state','all')='all' or k->>'state'='pending' and f.completed_at is null or k->>'state'='completed' and f.completed_at is not null
    or k->>'state'='overdue' and f.completed_at is null and f.due_at<stamp or k->>'state'='today' and f.completed_at is null and f.due_at>=day_start and f.due_at<day_end)
  union all
  select o.id,o.created_at,o.version,'trial_offers',case when o.state='active' and o.expires_at<=statement_timestamp() then 'expired' else o.state end,o.created_at,
   jsonb_build_object('kind','trial_offer','offer_id',o.id,'created_at',o.created_at,'product_version_id',o.product_version_id,'session_id',o.session_id,'expires_at',o.expires_at,
    'state',case when o.state='active' and o.expires_at<=statement_timestamp() then 'expired' else o.state end,
    'registration_id',(select v.id from core.reservations v where v.org_id=p_org and v.trial_offer_id=o.id order by v.created_at,v.id limit 1),
    'price_minor',o.terms_snapshot->'price_minor','currency',o.terms_snapshot->'currency')
  from core.trial_offers o where directory='history' and o.org_id=p_org and o.center_id=p_center and o.lead_id=(k->>'lead_id')::uuid
  union all
  select v.id,v.created_at,v.version,'product_versions','active',v.created_at,
   jsonb_build_object('kind','trial_product','product_version_id',v.id,'product_name',v.published_name,'offer_minutes',cfg.offer_minutes,'price_minor',v.price_minor::text,'currency',v.currency,
    'offer_policy_state',policy_state,'confirmation_requires_session',true,'confirmation_requires_paid_entitlement',v.price_minor>0)
  from private.p04_trial_configuration cfg join core.product_versions v on v.org_id=cfg.org_id and v.center_id=cfg.center_id and v.id=cfg.product_version_id
  join core.products p on p.org_id=v.org_id and p.id=v.product_id
  where directory='products' and cfg.org_id=p_org and cfg.center_id=p_center and cfg.enabled and v.effective_at<=statement_timestamp() and p.state='active'
 ),page as (
  select * from rows where created_at<=stamp and (last_id is null or sorting<>'created_at_desc' and (at,id)>(last_at,last_id) or sorting='created_at_desc' and (at,id)<(last_at,last_id))
  order by case when sorting<>'created_at_desc' then at end,case when sorting='created_at_desc' then at end desc,
   case when sorting<>'created_at_desc' then id end,case when sorting='created_at_desc' then id end desc limit lim+1
 ) select coalesce(jsonb_agg(jsonb_build_object('operation',op,'entity',jsonb_build_object('type',subject,'id',id),'exists',true,'state',state,
  'versions',jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type',subject,'id',id),'version',version)),
  'as_of',stamp,'current',null,'crm_discovery',detail,'_at',at) order by case when sorting<>'created_at_desc' then at end,case when sorting='created_at_desc' then at end desc,
  case when sorting<>'created_at_desc' then id end,case when sorting='created_at_desc' then id end desc),'[]') into items from page;
 if jsonb_array_length(items)>lim then items:=items-lim;token:=encode(convert_to(jsonb_build_object('scope',h,'at',items->-1->'_at','id',items->-1#>'{entity,id}','as_of',stamp)::text,'utf8'),'hex');end if;
 select coalesce(jsonb_agg(x-'_at' order by n),'[]') into items from jsonb_array_elements(items) with ordinality a(x,n);
 return jsonb_build_object('items',items,'next_cursor',token,'as_of',stamp);
end$$;
do $patch$
declare b text;a text;
begin
 b:=pg_get_functiondef('private.p04_center(text,jsonb,uuid)'::regprocedure);a:=' if op in (''lead_save_v1''';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'CRM directory center anchor drift';end if;
 execute replace(b,a,$a$ if op='crm_activity_save_v1' and r->>'directory'='followups' then return c;end if;
$a$||a);
 b:=pg_get_functiondef('private.p04_management(jsonb,uuid,uuid,uuid)'::regprocedure);a:=' if r#>>''{selector,operation}''';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'CRM directory dispatch anchor drift';end if;
 execute replace(b,a,$a$ if r#>>'{selector,key,directory}' is not null then
  return jsonb_build_object('data',private.crm_discovery_page(r,org,center,actor),'primary_id',center,'subject','centers');
 end if;
$a$||a);
 b:=pg_get_functiondef('private.crm_application_page(jsonb,uuid,uuid,uuid)'::regprocedure);a:=$a$jsonb_build_object('application_id',a.id,'person_id',a.person_id,'contact',a.target_contact)$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'CRM application received timestamp drift';end if;
 execute replace(b,a,$a$jsonb_build_object('application_id',a.id,'person_id',a.person_id,'contact',a.target_contact,'received_at',a.created_at)$a$);
end$patch$;
revoke all on function private.crm_keep_followup_origin(),private.crm_followup_rows(uuid,uuid,uuid),private.crm_trial_policy_state(uuid,uuid,uuid),private.crm_discovery_page(jsonb,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function private.crm_keep_followup_origin(),private.crm_followup_rows(uuid,uuid,uuid),private.crm_trial_policy_state(uuid,uuid,uuid),private.crm_discovery_page(jsonb,uuid,uuid,uuid) to service_role;
commit;
