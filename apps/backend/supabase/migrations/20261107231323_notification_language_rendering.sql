begin;
-- Only the closed, server-derived notification titles can become email copy.
-- Unknown/unavailable languages use the accepted Turkish fallback as a whole.
create function private.notification_email_copy(requested_language text,source_title text) returns jsonb language sql immutable security invoker set search_path='' as $$
 select jsonb_build_object('language',case when requested_language='en' then 'en' else 'tr' end,
  'title',case when requested_language='en' then english else turkish end,
  'text',case when requested_language='en' then 'View your new notification in the application: ' else 'Yeni işlem bildiriminizi uygulamadan görüntüleyebilirsiniz: ' end)
 from (values
  ('Rezervasyon sonucu','Reservation update'),
  ('Ders talebi sonucu','Lesson request update'),
  ('Ders iptali','Lesson cancellation'),
  ('Ders değişikliği','Lesson update'),
  ('Yer teklifi sonucu','Seat offer update'),
  ('Tahsilat sonucu','Payment update'),
  ('İade sonucu','Refund update'),
  ('Erişim değişikliği','Access update'),
  ('Ders hatırlatması','Lesson reminder'),
  ('Etkinlik hatırlatması','Event reminder'),
  ('Paket bitişi hatırlatması','Package expiry reminder'),
  ('Ödeme vadesi hatırlatması','Payment due reminder')
 ) copy(turkish,english) where turkish=source_title
$$;
create function private.notification_email_payload(n core.notifications,sender text,recipient text,app_origin text) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare copy jsonb;org_name text;
begin
 copy:=private.notification_email_copy(private.organization_regional_defaults(n.org_id)->>'notification_language',private.transactional_email_context(n)->>'title');
 if copy is null then perform private.fail('NOTIFICATION_UNAVAILABLE');end if;
 select left(regexp_replace(name,'[\r\n]',' ','g'),100) into org_name from core.organizations where id=n.org_id;
 return jsonb_build_object('from',sender,'to',jsonb_build_array(recipient),'subject','['||org_name||'] '||(copy->>'title'),'text',(copy->>'text')||app_origin);
end$$;
do $patch$
declare body text;anchor text;
begin
 body:=pg_get_functiondef('private.transactional_email_worker(jsonb,jsonb)'::regprocedure);
 anchor:=$anchor$jsonb_build_object('from',cfg.from_email,'to',jsonb_build_array(resolved_recipient->>'email'),'subject','['||left(regexp_replace((select name from core.organizations where id=j.org_id),'[\r\n]',' ','g'),100)||'] '||(private.transactional_email_context(n)->>'title'),'text','Yeni işlem bildiriminizi uygulamadan görüntüleyebilirsiniz: '||cfg.app_origin)$anchor$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Notification language payload anchor drift';end if;
 -- Keep the surrounding coalesce(s.payload,...) fence: retries must never
 -- change payload bytes under an existing provider idempotency key.
 execute replace(body,anchor,$replacement$private.notification_email_payload(n,cfg.from_email,resolved_recipient->>'email',cfg.app_origin)$replacement$);
end$patch$;
revoke all on function private.notification_email_copy(text,text),private.notification_email_payload(core.notifications,text,text,text) from public,anon,authenticated;
grant execute on function private.notification_email_copy(text,text),private.notification_email_payload(core.notifications,text,text,text) to service_role;
commit;
