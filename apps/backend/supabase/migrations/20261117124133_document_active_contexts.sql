-- Shared factual enumeration; callers retain native target/context authorization.
begin;
create function private.document_active_contexts(p_org uuid,p_center uuid,p_person uuid default null)
returns table(person_id uuid,created_at timestamptz,row_key text,context jsonb)
language sql stable security invoker set search_path='' as $$
 with contexts as (
 select s.person_id,s.created_at at_time,'sales'::text typ,s.id,'sale'::text gate,null::uuid purchase from core.sales s
 where s.org_id=p_org and s.center_id=p_center and (p_person is null or private.p07_same_person(p_org,s.person_id,p_person)) and s.state='active'
 union all
 select v.person_id,v.created_at,'reservations',v.id,g.gate,null from core.reservations v join core.sessions s on s.org_id=p_org and s.center_id=p_center and s.id=v.session_id
 cross join (values('reservation'),('attendance')) g(gate)
 where v.org_id=p_org and v.center_id=p_center and (p_person is null or private.p07_same_person(p_org,v.person_id,p_person)) and v.state='active' and s.state in ('planned','occurred')
 and (g.gate='reservation' and s.state='planned' or g.gate='attendance' and s.attendance_state='open')
 union all
 select v.person_id,v.created_at,'lesson_requests',v.id,'reservation',null from core.lesson_requests v where v.org_id=p_org and v.center_id=p_center and (p_person is null or private.p07_same_person(p_org,v.person_id,p_person)) and v.state in ('pending','alternative_offered')
 union all
 select v.person_id,v.created_at,'event_registrations',v.id,g.gate,null from core.event_registrations v join core.events e on e.org_id=p_org and e.center_id=p_center and e.id=v.event_id
 cross join (values('event_registration'),('attendance')) g(gate)
 where v.org_id=p_org and v.center_id=p_center and (p_person is null or private.p07_same_person(p_org,v.person_id,p_person)) and v.state='active' and e.state in ('published','occurred')
 and (g.gate='event_registration' and e.state='published' or g.gate='attendance' and e.attendance_state='open')
 union all
 select private.p07_person_root(p_org,w.person_id),min(w.created_at),'sessions',s.id,'reservation',null from core.waitlist_entries w join core.sessions s on s.org_id=p_org and s.center_id=p_center and s.id=w.session_id
 where w.org_id=p_org and w.center_id=p_center and (p_person is null or private.p07_same_person(p_org,w.person_id,p_person)) and w.state in ('waiting','offered') and s.state='planned' group by s.id,private.p07_person_root(p_org,w.person_id)
 union all
 select p.person_id,v.created_at,'product_versions',p.product_version_id,'sale',p.preview_id from private.purchase_documents p
 join core.previews v on v.org_id=p_org and v.id=p.preview_id and v.operation='sale_apply_v1' and v.state='current'
 join private.preview_payloads x on x.preview_id=v.id and x.expires_at>statement_timestamp()
 where p.org_id=p_org and p.center_id=p_center and (p_person is null or private.p07_same_person(p_org,p.person_id,p_person)) and not exists(select 1 from private.purchase_document_uses u where u.purchase_preview_id=p.preview_id)
 )select private.p07_person_root(p_org,c.person_id),at_time,typ||'/'||id::text||'/'||gate||'/'||coalesce(purchase::text,''),
 jsonb_build_object('gate',gate,'subject',jsonb_build_object('type',typ,'id',id))||case when purchase is null then '{}'::jsonb else jsonb_build_object('purchase_preview_id',purchase) end from contexts c
$$;
do $patch$ declare b text:=pg_get_functiondef('private.member_document_directory(jsonb,uuid,uuid,uuid,uuid)'::regprocedure);a int;z int;begin
 a:=strpos(b,'  with contexts as (');z:=strpos(b,' loop'||chr(10)||'  requirements:=');
 if a=0 or z=0 then raise exception 'Member document context enumeration drift';end if;
 execute substring(b from 1 for a-1)||'  select created_at at_time,row_key,context ctx from private.document_active_contexts(org,center,actor) where last_key is null or (created_at,row_key)>(last_at,last_key) order by created_at,row_key'||chr(10)||substring(b from z);
end$patch$;
revoke all on function private.document_active_contexts(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function private.document_active_contexts(uuid,uuid,uuid) to service_role;
commit;
