-- A system-created followup can belong to an existing student without inventing a CRM lead.
begin;
alter table core.crm_activities add column if not exists person_id uuid;
alter table core.crm_activities alter column lead_id drop not null;
alter table core.crm_activities add constraint p05_activity_person foreign key(org_id,person_id) references core.people(org_id,id);
alter table core.crm_activities add constraint p05_activity_target check(lead_id is not null or person_id is not null);
create unique index p05_lead_person on core.leads(org_id,center_id,id,person_id);
alter table core.crm_activities add constraint p05_activity_lead_person foreign key(org_id,center_id,lead_id,person_id) references core.leads(org_id,center_id,id,person_id);
create table private.p05_automation_activities(activity_id uuid primary key references core.crm_activities(id),automation_id uuid not null references core.automations(id),run_id uuid not null references core.automation_runs(id));
alter table private.p05_automation_activities enable row level security;
revoke all on private.p05_automation_activities from public,anon,authenticated;
grant all on private.p05_automation_activities to service_role;
create function private.p05_person_activity_access(org uuid,center uuid,actor uuid,r jsonb) returns void language plpgsql stable security invoker set search_path='' as $$
begin
 if center is null or r->>'lead_id' is not null then perform private.fail('VALIDATION_FAILED');end if;
 if not private.is_manager(org,actor,center) then perform private.fail('FORBIDDEN');end if;
 if not exists(select 1 from core.people p join core.center_relationships x on x.org_id=p.org_id and x.person_id=p.id where p.org_id=org and p.id=(r->>'person_id')::uuid and p.state='active' and x.center_id=center and x.state='active') then perform private.fail('NOT_FOUND');end if;
end$$;
create function private.p05_person_activity(r jsonb,org uuid,center uuid,actor uuid,operation uuid,ids uuid[]) returns jsonb language plpgsql security invoker set search_path='' as $$
declare aid uuid:=private.new_id(ids,2);ver bigint:=1;
begin
 perform private.p05_person_activity_access(org,center,actor,r);
 if r->>'activity_id' is null then
  if r->>'expected_version' is not null then perform private.fail('VALIDATION_FAILED');end if;
  insert into core.crm_activities(id,org_id,center_id,person_id,kind,due_at,outcome,note,completed_at) values(aid,org,center,(r->>'person_id')::uuid,r->>'kind',(r->>'due_at')::timestamptz,r->>'outcome',r->>'note',case when r->>'kind' in ('contact','outcome') then clock_timestamp() end);
 else
  update core.crm_activities set kind=r->>'kind',due_at=(r->>'due_at')::timestamptz,outcome=r->>'outcome',note=r->>'note',completed_at=case when r->>'kind' in ('contact','outcome') then clock_timestamp() end,version=version+1 where org_id=org and center_id=center and id=(r->>'activity_id')::uuid and person_id=(r->>'person_id')::uuid and lead_id is null and version=(r->>'expected_version')::bigint returning id,version into aid,ver;
  if not found then perform private.fail('VERSION_CONFLICT');end if;
 end if;
 return jsonb_build_object('primary_id',aid,'subject','crm_activities','version',ver,'data',jsonb_build_object('operation_id',operation,'primary_id',aid,'version',ver,'replayed',false,'related','[]'::jsonb));
end$$;
create function private.p05_activity_page(r jsonb,org uuid,center uuid,actor uuid,management boolean default false) returns jsonb language plpgsql stable security invoker set search_path='' as $$
#variable_conflict use_column
declare lim int:=coalesce((r#>>'{page,limit}')::int,50);sorting text:=coalesce(r#>>'{page,sort}',case when management then 'created_at_asc' else 'due_at_asc' end);cur jsonb;last_at timestamptz;last_id uuid;asof timestamptz:=clock_timestamp();token text;items jsonb;k jsonb:=coalesce(r#>'{selector,key}','{}');h text:=md5(jsonb_build_object('actor',actor,'request',r-'request_id'-'page','sort',sorting)::text);
begin
 if lim<1 or lim>200 or sorting not in ('created_at_asc','due_at_asc') then perform private.fail('VALIDATION_FAILED');end if;
 if management then perform private.p05_person_activity_access(org,center,actor,r||k);end if;
 if r#>>'{page,cursor}' is not null then
  begin cur:=convert_from(decode(r#>>'{page,cursor}','hex'),'UTF8')::jsonb;last_at:=(cur->>'at')::timestamptz;last_id:=(cur->>'id')::uuid;asof:=(cur->>'as_of')::timestamptz;
   if cur->>'scope' is distinct from h or last_at is null or last_id is null or asof is null or not isfinite(asof) or asof>clock_timestamp() then perform private.fail('VALIDATION_FAILED');end if;
  exception when others then perform private.fail('VALIDATION_FAILED');end;
 end if;
 with rows as(select a.*,coalesce(a.person_id,l.person_id) target,l.assigned_person_id,case when sorting='created_at_asc' then a.created_at else coalesce(a.due_at,a.created_at) end at
 from core.crm_activities a left join core.leads l on l.org_id=a.org_id and l.id=a.lead_id where a.org_id=org and (center is null or a.center_id=center) and a.created_at<=asof and private.center_accessible(org,a.center_id)
 and (private.is_manager(org,actor,a.center_id) or (l.assigned_person_id=actor and private.staff_grant(org,actor,a.center_id,'crm.daily')))
 and ((management and a.lead_id is null and a.person_id=(k->>'person_id')::uuid and (k->>'activity_id' is null or a.id=(k->>'activity_id')::uuid)) or (not management and a.kind='followup' and a.completed_at is null and exists(select 1 from private.p05_automation_activities generated where generated.activity_id=a.id)))
 and (r->'interval' is null or r->'interval'='null'::jsonb or (a.due_at>=(r#>>'{interval,starts_at}')::timestamptz and a.due_at<(r#>>'{interval,ends_at}')::timestamptz))),
 page as(select * from rows where cur is null or (at,id)>(last_at,last_id) order by at,id limit lim+1)
 select coalesce(jsonb_agg(case when management then jsonb_build_object('operation','crm_activity_save_v1','entity',jsonb_build_object('type','crm_activities','id',id),'exists',true,'state',case when completed_at is null then 'open' else 'completed' end,'versions',jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type','crm_activities','id',id),'version',version)),'as_of',asof,'current',jsonb_build_object('operation','crm_activity_save_v1','values',jsonb_build_object('person_id',person_id,'lead_id',lead_id,'activity_id',id,'kind',kind,'due_at',due_at,'outcome',outcome,'note',note)),'_at',at)
 else jsonb_build_object('id',id,'person_id',target,'center_id',center_id,'lead_id',lead_id,'assigned_to',assigned_person_id,'kind','automation_followup','due_at',coalesce(due_at,created_at),'_at',at) end order by at,id),'[]'::jsonb) into items from page;
 if jsonb_array_length(items)>lim then items:=items-lim;token:=encode(convert_to(jsonb_build_object('scope',h,'at',items->-1->'_at','id',case when management then (items->-1)#>'{entity,id}' else items->-1->'id' end,'as_of',asof)::text,'UTF8'),'hex');end if;
 select coalesce(jsonb_agg(x-'_at' order by n),'[]'::jsonb) into items from jsonb_array_elements(items) with ordinality a(x,n);
 return jsonb_build_object('items',items,'next_cursor',token,'as_of',asof);
end$$;
do $patch$
declare b text;old text;
begin
 b:=pg_get_functiondef('private.p04_center(text,jsonb,uuid)'::regprocedure);old:=$a$ if op in ('lead_save_v1','leads_list_v1','crm_followup_list_v1')$a$;
 if strpos(b,old)=0 then raise exception 'P05 person activity center anchor missing';end if;
 execute replace(b,old,$a$ if op='crm_activity_save_v1' and r->>'person_id' is not null then if c is null then perform private.fail('VALIDATION_FAILED');end if;return c;end if;
$a$||old);
 b:=pg_get_functiondef('private.p04_access(text,jsonb,uuid,uuid,uuid)'::regprocedure);old:=$a$ if op='publication_set_v1' then$a$;
 if strpos(b,old)=0 then raise exception 'P05 person activity access anchor missing';end if;
 execute replace(b,old,$a$ if op='crm_activity_save_v1' and r->>'person_id' is not null then perform private.p05_person_activity_access(org,center,actor,r);return;end if;
$a$||old);
 b:=pg_get_functiondef('private.p04_command(text,jsonb,uuid,uuid,uuid,uuid,uuid,uuid[])'::regprocedure);old:=$a$ if op='crm_followup_list_v1' then$a$;
 if strpos(b,old)=0 then raise exception 'P05 person activity command anchor missing';end if;
 execute replace(b,old,$a$ if op='crm_activity_save_v1' and r->>'person_id' is not null then return private.p05_person_activity(r,org,center,actor,operation,ids);end if;
$a$||old);
 b:=pg_get_functiondef('private.p04_management(jsonb,uuid,uuid,uuid)'::regprocedure);old:=$a$ if r#>>'{selector,operation}' is distinct from op$a$;
 if strpos(b,old)=0 then raise exception 'P05 person activity read anchor missing';end if;
 execute replace(b,old,$a$ if op='crm_activity_save_v1' and k->>'person_id' is not null then return jsonb_build_object('data',private.p05_activity_page(r,org,center,actor,true),'primary_id',center,'subject','centers');end if;
$a$||old);
 b:=pg_get_functiondef('private.p04_followups_page(jsonb,uuid,uuid,uuid)'::regprocedure);old:=$a$ if lim<1 or lim>200$a$;
 if strpos(b,old)=0 then raise exception 'P05 person followup read anchor missing';end if;
 execute replace(b,old,$a$ if r->>'kind'='automation_followup' then return private.p05_activity_page(r,org,center,actor);end if;
$a$||old);
end$patch$;
commit;
