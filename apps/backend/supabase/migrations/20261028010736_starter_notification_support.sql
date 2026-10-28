begin;
create function private.notification_channel_ready(channel text) returns boolean language sql immutable security invoker set search_path='' as $$select coalesce($1='in_app',false)$$;
create function private.notification_channel_guard(r jsonb) returns void language plpgsql immutable security invoker set search_path='' as $$
begin
 if not private.notification_channel_ready(r->>'channel') then perform private.fail('SERVICE_UNAVAILABLE');end if;
end$$;
create function private.notification_delivery_support(org uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare reminders boolean:=false;
begin
 if org is not null then
  begin perform private.require_feature(org,'F27');reminders:=true;exception when SQLSTATE 'P0001' then if SQLERRM<>'PLAN_FEATURE_UNAVAILABLE' then raise;end if;end;
 end if;
 return jsonb_build_object(
  'channels',jsonb_build_object('in_app',private.notification_channel_ready('in_app'),'email',private.notification_channel_ready('email'),'push',private.notification_channel_ready('push')),
  'mandatory_when_available',jsonb_build_array('security','reservation_result','request_result','cancellation','change','seat_offer','collection','refund','access_change'),
  'transactional_in_app_required',true,'in_app_delayed_by_quiet_hours',false,'in_app_in_digest',false,
  'new_member_marketing_default_enabled',false,'platform_marketing_default_enabled',false,
  'reminders',jsonb_build_object('feature_licensed',reminders,'timing_controls_available',false,'new_member_default_enabled',true,'lesson_hours',jsonb_build_array(1,3,24),'default_lesson_hours',24,'package_expiry_days',jsonb_build_array(3,7,14),'default_package_expiry_days',7,'payment_due_days',jsonb_build_array(1,3,7),'default_payment_due_days',3),
  'digest',jsonb_build_object('controls_available',false,'choices',jsonb_build_array('instant','daily','weekly'),'default_frequency','instant','daily_local_time','18:00:00','weekly_weekday',7,'weekly_local_time','18:00:00','timezone_source','user_display_timezone'),
  'quiet_hours',jsonb_build_object('controls_available',false,'new_user_default_enabled',false,'exceptions',jsonb_build_array('security','center_cancellation','near_24h_change','expiring_seat_offer'))
 );
end$$;
do $patch$
declare b text;a text;
begin
 b:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 a:=' -- Central permission mapping; no user_metadata or request actor/role can grant access.';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Notification channel replay guard anchor drift';end if;
 execute replace(b,a,a||E'\n'||$a$ if p_operation='notification_preferences_set_v1' then perform private.notification_channel_guard(r);end if;$a$);
 b:=pg_get_functiondef('private.p05_notifications(text,jsonb,uuid,uuid,uuid,uuid,uuid[])'::regprocedure);
 a:=$a$ elsif op='notification_preferences_set_v1' then$a$;if array_length(string_to_array(b,a),1)<>2 then raise exception 'Notification preference channel anchor drift';end if;
 execute replace(b,a,a||E'\n'||'  perform private.notification_channel_guard(r);');
 b:=pg_get_functiondef('private.frontend_settings_execute(text,jsonb,uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);
 a:='''brand_packages'',''[]''::jsonb';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Notification support catalog anchor drift';end if;
 execute replace(b,a,'''notification_delivery'',private.notification_delivery_support(org),'||a);
end$patch$;
revoke all on function private.notification_channel_ready(text),private.notification_channel_guard(jsonb),private.notification_delivery_support(uuid) from public,anon,authenticated;
grant execute on function private.notification_channel_ready(text),private.notification_channel_guard(jsonb),private.notification_delivery_support(uuid) to service_role;
commit;
