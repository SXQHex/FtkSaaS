begin;
create function private.content_languages(org uuid,person uuid,purpose text) returns text[] language sql stable set search_path='' as $$
 select array_remove(array[nullif((select s.values->>'language' from core.account_links l join core.accounts a on a.id=l.account_id and a.state='active'
 join private.frontend_settings s on s.scope_key='user:'||a.id where l.org_id=$1 and l.person_id=$2 and l.state='active' and l.verified_at is not null order by l.created_at,l.id limit 1),'auto'),
 private.organization_regional_defaults($1)->>case when $3='document' then 'document_language' else 'notification_language' end,
 case when $3<>'document' then private.frontend_settings_defaults('organization')#>>'{regional_defaults,notification_language}' end],null)
$$;
create function private.notification_content_code(n core.notifications) returns text language sql immutable set search_path='' as $$
 select 'notification.'||case
 when n.kind in ('reservation_create_v1','reservation_cancel_v1','reservation_impact_apply_v1') then 'reservation'
 when n.kind in ('lesson_request_reject_v1','lesson_request_offer_alternative_v1','lesson_request_accept_alternative_v1','lesson_request_approve_v1') then 'lesson_request'
 when n.kind in ('session_cancelled_by_center','session_cancel_apply_v1') then 'cancellation'
 when n.kind='session_change_apply_v1' then 'session_change'
 when n.kind in ('seat_offer','seat_offer_accept_v1','seat_offer_reject_v1','p01_expired') then 'seat_offer'
 when n.kind in ('collection_record_v1','collection_correct_apply_v1') then 'collection'
 when n.kind in ('sale_refund_apply_v1','student_credit_refund_v1') then 'refund'
 when n.kind in ('role_assign_v1','role_revoke_v1') then 'access'
 when n.kind='reminder' and n.payload->>'template_key' in ('p05.lesson','p05.entitlement','p05.event','p05.payment') then substr(n.payload->>'template_key',5)
 else 'generic' end
$$;
alter table private.transactional_email_jobs add column content_template_id uuid references private.content_templates(id),add column content_language text,add column content_version bigint;
create function private.notification_email_selection(n core.notifications,sender text,recipient text,app_origin text) returns jsonb language plpgsql stable set search_path='' as $$
declare t private.content_templates;copy jsonb;org_name text;
begin
 t:=private.content_pick('platform',private.notification_content_code(n),'email',private.content_languages(n.org_id,n.recipient_person_id,'notification'));
 copy:=private.content_render(t,jsonb_build_object('app_url',app_origin));
 select left(regexp_replace(name,'[\r\n]',' ','g'),100) into org_name from core.organizations where id=n.org_id;
 return jsonb_build_object('template_id',t.id,'language',t.language,'version',t.version,'payload',jsonb_build_object('from',sender,'to',jsonb_build_array(recipient),'subject','['||org_name||'] '||(copy->>'title'),'text',copy->>'text'));
end$$;
create or replace function private.notification_email_payload(n core.notifications,sender text,recipient text,app_origin text) returns jsonb language sql stable security invoker set search_path='' as $$
 select private.notification_email_selection($1,$2,$3,$4)->'payload'
$$;
-- Existing key-only in_app notices gain backend-rendered copy without copying user text.
alter function private.p05_notification_payload(core.notifications) rename to p05_notification_payload_keys;
create function private.p05_notification_payload(n core.notifications) returns jsonb language plpgsql stable set search_path='' as $$
declare t private.content_templates;copy jsonb;
begin
 t:=private.content_pick('platform',private.notification_content_code(n),'in_app',private.content_languages(n.org_id,n.recipient_person_id,'notification'));
 copy:=private.content_render(t,'{}');
 return private.p05_notification_payload_keys(n)||jsonb_build_object('title',copy->'title','body',copy->'text')||jsonb_build_object('language',t.language,'content_template_id',t.id,'content_version',t.version);
end$$;
alter table private.invitation_delivery_state add column content_template_id uuid references private.content_templates(id),add column content_language text,add column content_version bigint,add column content_template jsonb;
create function private.invitation_content(job uuid,org uuid,person uuid) returns jsonb language plpgsql set search_path='' as $$
declare s private.invitation_delivery_state;t private.content_templates;preferred text;
begin
 select * into s from private.invitation_delivery_state where job_id=job for update;
 if s.content_template is null then
  -- An in-flight pre-catalog job already used the original Turkish v1 copy.
  if s.first_attempt_at is not null then
   select * into t from private.content_templates c where c.scope_key='platform' and c.code='account.invitation' and c.channel='email' and c.language='tr' and c.version=1;
  else
   -- Language only: a confirmed native recipient may have an account before
   -- this organization is allowed to establish its account_link.
   select nullif(p.values->>'language','auto') into preferred from private.invitation_deliveries d join auth.users u on lower(btrim(u.email))=lower(btrim(d.recipient)) and u.email_confirmed_at is not null and u.deleted_at is null and (u.banned_until is null or u.banned_until<clock_timestamp())
   join core.accounts a on a.auth_user_id=u.id and a.state='active' join private.frontend_settings p on p.scope_key='user:'||a.id where d.job_id=job;
   t:=private.content_pick('platform','account.invitation','email',array_prepend(preferred,private.content_languages(org,person,'notification')));
  end if;
  if t.id is null then perform private.fail('POLICY_NOT_CONFIGURED');end if;
  update private.invitation_delivery_state set content_template_id=t.id,content_language=t.language,content_version=t.version,content_template=t.content where job_id=job returning * into s;
 end if;
 return jsonb_build_object('id',s.content_template_id,'language',s.content_language,'version',s.content_version,'content',s.content_template);
end$$;
-- Keep existing lease, source, opt-out, quiet hour and retry fences exactly in place.
do $patch$
declare b text;a text;
begin
 b:=pg_get_functiondef('private.transactional_email_worker(jsonb,jsonb)'::regprocedure);
 a:='ok boolean;';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Catalog mail declaration drift';end if;b:=replace(b,a,a||'rendered jsonb;');
 a:='  update private.transactional_email_jobs set lease_hash=';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Catalog mail freeze drift';end if;
 b:=replace(b,a,$a$  if s.payload is null then
   begin rendered:=private.notification_email_selection(n,cfg.from_email,resolved_recipient->>'email',cfg.app_origin);
   exception when sqlstate 'P0001' then
    if sqlerrm<>'POLICY_NOT_CONFIGURED' then raise;end if;
    update core.outbox_jobs set state='failed',lease_until=null,version=version+1 where id=j.id;
    update private.transactional_email_jobs set safe_error_code='POLICY_NOT_CONFIGURED' where job_id=j.id;
    return jsonb_build_object('_internal_invitation',null);
   end;
   update private.transactional_email_jobs set content_template_id=(rendered->>'template_id')::uuid,content_language=rendered->>'language',content_version=(rendered->>'version')::bigint where job_id=j.id;
  end if;
$a$||a);
 a:=$a$private.notification_email_payload(n,cfg.from_email,resolved_recipient->>'email',cfg.app_origin)$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Catalog mail payload drift';end if;execute replace(b,a,$a$rendered->'payload'$a$);
 b:=pg_get_functiondef('private.transactional_email_status(uuid)'::regprocedure);
 a:='''email_delivery'',private.email_delivery_status(j.provider_reference)';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Catalog delivery status drift';end if;execute replace(b,a,a||',''content_language'',s.content_language,''content_template_id'',s.content_template_id,''content_version'',s.content_version');
 b:=pg_get_functiondef('private.invitation_worker(jsonb,jsonb)'::regprocedure);
 a:='  token:=encode(extensions.gen_random_bytes(32),''hex'');';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Catalog invitation freeze drift';end if;
 b:=replace(b,a,$a$  begin perform private.invitation_content(q.id,q.org_id,i.person_id);
  exception when sqlstate 'P0001' then
   if sqlerrm<>'POLICY_NOT_CONFIGURED' then raise;end if;
   update core.outbox_jobs set state='failed',lease_until=null,version=version+1 where id=q.id;
   update private.invitation_delivery_state set safe_error_code='POLICY_NOT_CONFIGURED' where job_id=q.id;
   return jsonb_build_object('_internal_invitation',null);
  end;
$a$||a);
 a:='''api_key'',api_key));';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Catalog invitation projection drift';end if;
 b:=replace(b,a,'''api_key'',api_key,''catalog'',private.invitation_content(q.id,q.org_id,i.person_id)));');execute b;
end$patch$;
create function private.invitation_content_scrub() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.kind='account_invitation' and new.state in ('succeeded','failed','cancelled') then update private.invitation_delivery_state set content_template=null where job_id=new.id;end if;return new;
end$$;
create trigger invitation_content_scrub after update of state on core.outbox_jobs for each row execute function private.invitation_content_scrub();
-- CSV headings are stable machine field names in every language; use catalog data.
do $patch$
declare b text;a text;
begin
 b:=pg_get_functiondef('private.p06_worker_execute(text,jsonb,uuid[])'::regprocedure);
 a:=$a$body:='group_key,center_id,person_id,currency,count,amount_minor,credits,basis_count,ratio_bps,subscriber_number'||E'\r\n';$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Catalog report heading drift';end if;
 execute replace(b,a,$a$body:=(private.content_render(private.content_pick('platform','report.headers','report',private.content_languages(org,c.person_id,'notification')),'{}')->>'text')||E'\r\n';$a$);
end$patch$;
revoke all on function private.content_languages(uuid,uuid,text),private.notification_content_code(core.notifications),private.notification_email_selection(core.notifications,text,text,text),private.p05_notification_payload(core.notifications),private.invitation_content(uuid,uuid,uuid),private.invitation_content_scrub() from public,anon,authenticated;
grant execute on function private.content_languages(uuid,uuid,text),private.notification_content_code(core.notifications),private.notification_email_selection(core.notifications,text,text,text),private.p05_notification_payload(core.notifications),private.invitation_content(uuid,uuid,uuid) to service_role;
commit;
begin;
-- Compatibility for the former SQL helper; the runtime selects by stable code.
create or replace function private.notification_email_copy(requested_language text,source_title text) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('language',t.language,'title',t.content->'title','text',replace(t.content->>'text','{{app_url}}',''))
 from (select code from private.content_templates where scope_key='platform' and channel='email' and language='tr' and version=1 and code like 'notification.%' and content->>'title'=$2 limit 1) c
 cross join lateral private.content_pick('platform',c.code,'email',array[$1,'tr']) t where t.id is not null
$$;
commit;
