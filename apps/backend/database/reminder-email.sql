begin;
alter table private.transactional_email_jobs add column purpose text not null default 'transactional' check(purpose in ('transactional','reminder'));
alter table private.transactional_email_jobs add column reminder_source_version text;
create function private.reminder_email_ready(org uuid) returns boolean language plpgsql stable security invoker set search_path='' as $$
begin
 if not private.transactional_email_ready(org) then return false;end if;perform private.require_feature(org,'F27');return true;
exception when sqlstate 'P0001' then if sqlerrm='PLAN_FEATURE_UNAVAILABLE' then return false;end if;raise;
end$$;
create function private.reminder_email_not_before(n core.notifications) returns timestamptz language plpgsql stable security invoker set search_path='' as $$
declare account uuid;settings jsonb;ctx jsonb;quiet timestamptz;
begin
 if n.kind<>'reminder' then return clock_timestamp();end if;
 ctx:=private.transactional_email_context(n);if ctx is null then return null;end if;
 select l.account_id into account from core.account_links l where l.org_id=n.org_id and l.person_id=n.recipient_person_id and l.state='active' and l.verified_at is not null order by l.created_at,l.id limit 1;
 select private.frontend_settings_defaults('user')||coalesce((select values from private.frontend_settings where scope_key='user:'||account),'{}') into settings;
 quiet:=private.reminder_quiet_until(settings,greatest(clock_timestamp(),(ctx->>'due_at')::timestamptz));
 if quiet is null or quiet>=(ctx->>'expires_at')::timestamptz then return null;end if;return quiet;
end$$;
do $patch$
declare b text;a text;
begin
 b:=pg_get_functiondef('private.transactional_email_context(core.notifications)'::regprocedure);
 a:=' title:=case';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Reminder email context anchor drift';end if;
 execute replace(b,a,$a$ if n.kind='reminder' then
  if n.payload->>'template_key' not in ('p05.lesson','p05.entitlement','p05.event','p05.payment') or n.payload->>'reminder_center_id' is null then return null;end if;
  return private.reminder_context(n.org_id,(n.payload->>'reminder_center_id')::uuid,n.recipient_person_id,substr(n.payload->>'template_key',5),n.subject_id);
 end if;
$a$||a);
 b:=pg_get_functiondef('private.transactional_email_enqueue()'::regprocedure);
 b:=replace(b,'declare ctx jsonb;','declare ctx jsonb;delivery_purpose text:=case when new.kind=''reminder'' then ''reminder'' else ''transactional'' end;');
 a:=' if not private.transactional_email_ready(new.org_id)';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Reminder enqueue readiness drift';end if;
 b:=replace(b,a,' if (delivery_purpose=''reminder'' and not private.reminder_email_ready(new.org_id)) or not private.transactional_email_ready(new.org_id)');
 a:='p.purpose=''transactional''';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Reminder opt-in enqueue drift';end if;b:=replace(b,a,'p.purpose=delivery_purpose');
 a:='values(new.id,new.org_id,(ctx->>''center_id'')::uuid,(ctx->>''version'')::bigint);';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Reminder queue metadata drift';end if;
 b:=replace(b,'(job_id,org_id,center_id,subject_version)', '(job_id,org_id,center_id,subject_version,purpose,reminder_source_version)');
 b:=replace(b,a,'values(new.id,new.org_id,(ctx->>''center_id'')::uuid,(ctx->>''version'')::bigint,delivery_purpose,ctx->>''source_version'');');execute b;
 b:=pg_get_functiondef('private.transactional_email_allowed(core.outbox_jobs,private.transactional_email_jobs)'::regprocedure);
 a:=' return coalesce(';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Reminder email authorization drift';end if;
 b:=replace(b,a,$a$ if s.purpose='reminder' and (not private.reminder_email_ready(j.org_id) or ctx->>'source_version' is distinct from s.reminder_source_version or ctx->>'source_version' is distinct from n.payload->>'reminder_source_version' or private.reminder_email_not_before(n) is null) then return false;end if;
$a$||a);b:=replace(b,'p.purpose=''transactional''','p.purpose=s.purpose');execute b;
 b:=pg_get_functiondef('private.transactional_email_worker(jsonb,jsonb)'::regprocedure);
 a:='ok boolean;';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Reminder worker variable drift';end if;b:=replace(b,a,a||'not_before timestamptz;');
 a:='  select * into cfg from private.invitation_sender_config';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Quiet preclaim anchor drift';end if;
 b:=replace(b,a,$a$  select * into n from core.notifications where org_id=j.org_id and id=j.notification_id;
  not_before:=private.reminder_email_not_before(n);
  if s.purpose='reminder' and not_before>clock_timestamp() then
   update core.outbox_jobs set state='pending',lease_until=null,next_attempt_at=not_before,version=version+1 where id=j.id;
   return jsonb_build_object('_internal_invitation',null);
  end if;
$a$||a);
 a:='if phase=''authorize'' then return jsonb_build_object(''authorized'',ok);end if;';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Quiet final authorization drift';end if;
 b:=replace(b,a,$a$select * into n from core.notifications where org_id=j.org_id and id=j.notification_id;
 not_before:=private.reminder_email_not_before(n);
 if phase='authorize' then return jsonb_build_object('authorized',ok and (s.purpose<>'reminder' or not_before<=clock_timestamp()));end if;
 if ok and s.purpose='reminder' and not_before>clock_timestamp() and aux->>'provider_reference' is null then
  update core.outbox_jobs set state='retry_wait',attempts=greatest(attempts-1,0),lease_until=null,next_attempt_at=not_before,version=version+1 where id=j.id;
  return jsonb_build_object('state','retry_wait');
 end if;$a$);execute b;
 b:=pg_get_functiondef('private.notification_channel_guard(jsonb)'::regprocedure);
 a:='r->>''purpose''<>''transactional''';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Reminder email preference availability drift';end if;
 execute replace(b,a,'(r->>''purpose'' not in (''transactional'',''reminder'') or (r->>''purpose''=''reminder'' and not private.reminder_email_ready((r->>''org_id'')::uuid)))');
 b:=pg_get_functiondef('private.p05_notification_page(jsonb,uuid,uuid)'::regprocedure);
 a:='''email_preference'',jsonb_build_object';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Reminder preference read drift';end if;
 execute replace(b,a,$a$'reminder_email_preference',jsonb_build_object('enabled',coalesce((select p.enabled from core.notification_preferences p where p.org_id=org and p.person_id=actor and p.channel='email' and p.purpose='reminder'),false),'version',coalesce((select p.version from core.notification_preferences p where p.org_id=org and p.person_id=actor and p.channel='email' and p.purpose='reminder'),1),'available',private.reminder_email_ready(org)),$a$||a);
end$patch$;
revoke all on function private.reminder_email_ready(uuid),private.reminder_email_not_before(core.notifications) from public,anon,authenticated;
grant execute on function private.reminder_email_ready(uuid),private.reminder_email_not_before(core.notifications) to service_role;
commit;
