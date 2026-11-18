-- Module labels are a versioned projection of the canonical operation catalogue.
begin;
create function private.tracking_operation_module(op text) returns text language sql immutable security invoker set search_path='' as $$select '{"account_get_v1":"M02","account_profile_update_v1":"M02","account_delete_preview_v1":"M02","account_delete_apply_v1":"M02","organizations_list_v1":"M02","organization_create_v1":"M01","organization_get_v1":"M01","organization_update_v1":"M01","organization_close_preview_v1":"M01","organization_close_apply_v1":"M01","organization_reopen_v1":"M01","organization_delete_preview_v1":"M01","organization_delete_apply_v1":"M01","centers_list_v1":"M01","center_create_v1":"M01","center_update_v1":"M01","room_save_v1":"M01","availability_save_v1":"M01","availability_exception_save_v1":"M01","policies_get_v1":"M01","policy_publish_v1":"M01","roles_list_v1":"M02","role_assign_v1":"M02","role_revoke_v1":"M02","permission_set_v1":"M02","org_manager_assign_v1":"M02","org_manager_revoke_v1":"M02","manager_self_assign_center_v1":"M02","account_access_send_v1":"M02","account_access_revoke_v1":"M02","account_access_accept_v1":"M02","account_link_remove_v1":"M02","people_list_v1":"M03","person_get_v1":"M03","person_create_v1":"M03","person_update_v1":"M03","student_activate_v1":"M03","student_deactivate_v1":"M03","person_merge_preview_v1":"M03","person_merge_approve_v1":"M03","person_merge_apply_v1":"M03","calendar_get_v1":"M04","class_save_v1":"M04","program_preview_v1":"M04","program_apply_v1":"M04","session_create_v1":"M04","session_get_v1":"M04","session_change_preview_v1":"M04","session_change_apply_v1":"M04","session_capacity_set_v1":"M04","session_cancel_preview_v1":"M05","session_cancel_apply_v1":"M05","replacement_session_create_v1":"M05","session_assignment_set_v1":"M04","lesson_request_create_v1":"M04","lesson_request_withdraw_v1":"M04","lesson_request_reject_v1":"M04","lesson_request_offer_alternative_v1":"M04","lesson_request_accept_alternative_v1":"M04","lesson_request_approve_v1":"M04","reservation_create_v1":"M04","reservation_cancel_v1":"M04","reservation_list_v1":"M04","waitlist_join_v1":"M04","waitlist_leave_v1":"M04","seat_offer_accept_v1":"M04","seat_offer_reject_v1":"M04","attendance_get_v1":"M05","attendance_mark_v1":"M05","attendance_close_v1":"M05","attendance_correct_preview_v1":"M05","attendance_correction_request_v1":"M05","attendance_correct_apply_v1":"M05","products_list_v1":"M06","product_publish_v1":"M06","sale_preview_v1":"M06","sale_apply_v1":"M06","entitlements_get_v1":"M06","entitlement_extend_v1":"M06","credit_adjust_v1":"M06","negative_limit_set_v1":"M06","freeze_preview_v1":"M06","freeze_apply_v1":"M06","freeze_end_preview_v1":"M06","freeze_end_apply_v1":"M06","sale_terminate_preview_v1":"M06","sale_terminate_apply_v1":"M06","sale_refund_preview_v1":"M07","sale_refund_apply_v1":"M07","sale_change_preview_v1":"M06","sale_change_apply_v1":"M06","sale_renew_preview_v1":"M06","sale_renew_apply_v1":"M06","finance_get_v1":"M07","collection_record_v1":"M07","collection_correct_preview_v1":"M07","collection_correct_apply_v1":"M07","student_credit_refund_v1":"M07","student_credit_offset_v1":"M07","debt_adjust_v1":"M07","instructor_agreement_publish_v1":"M08","earnings_list_v1":"M08","instructor_payment_record_v1":"M08","instructor_payment_correct_v1":"M08","leads_list_v1":"M09","lead_save_v1":"M09","crm_activity_save_v1":"M09","trial_offer_create_v1":"M09","trial_registration_confirm_v1":"M09","lead_convert_v1":"M09","crm_followup_list_v1":"M09","segment_save_v1":"M09","automation_save_v1":"M09","notifications_list_v1":"M10","notification_mark_read_v1":"M10","notification_preferences_set_v1":"M10","report_get_v1":"M11","report_export_start_v1":"M11","report_file_get_v1":"M11","import_upload_prepare_v1":"X","import_preview_v1":"X","import_apply_v1":"X","import_rows_list_v1":"X","subscription_get_v1":"M12","subscription_upgrade_quote_v1":"M12","subscription_downgrade_request_v1":"M12","subscription_change_cancel_v1":"M12","subscription_renewal_set_v1":"M12","saas_payment_submit_v1":"M12","saas_payment_verify_v1":"M12","organization_billing_tax_set_v1":"M12","saas_grace_extend_v1":"M12","event_save_v1":"M13","event_publish_v1":"M13","event_register_v1":"M13","event_registration_cancel_v1":"M13","event_complete_v1":"M13","event_duty_verify_v1":"M13","event_cancel_preview_v1":"M13","event_cancel_apply_v1":"M13","event_list_v1":"M13","document_upload_prepare_v1":"M14","document_version_publish_v1":"M14","document_requirements_get_v1":"M14","document_accept_v1":"M14","publication_set_v1":"M04","public_calendar_get_v1":"M04","public_application_submit_v1":"M09","public_application_review_v1":"M09","operation_status_get_v1":"X","preview_get_v1":"X","job_status_get_v1":"X","audit_list_v1":"X","seat_offer_issue_v1":"X","seat_offer_expire_v1":"X","request_expire_v1":"X","outbox_deliver_v1":"X","reminder_schedule_v1":"X","automation_run_v1":"X","import_rows_process_v1":"X","report_build_v1":"X","privacy_execute_v1":"X","subscription_boundary_apply_v1":"X","class_assignment_set_v1":"M04","event_attendance_mark_v1":"M13","platform_owner_set_v1":"M02","platform_organization_suspension_set_v1":"M01","platform_owner_remove_v1":"M02","center_manager_assign_v1":"M02","center_manager_revoke_v1":"M02","attendance_block_v1":"M05","event_attendance_close_v1":"M13","event_attendance_correct_v1":"M13","file_upload_complete_v1":"M14","negcredit_valuation_set_v1":"M06","disciplines_list_v1":"M01","discipline_save_v1":"M01","center_discipline_set_v1":"M01","person_discipline_set_v1":"M03","event_get_v1":"M13","event_registration_preview_v1":"M13","event_payment_prepare_v1":"M13","event_payment_get_v1":"M13","event_actual_start_record_v1":"M13","event_actual_start_correct_v1":"M13","management_state_get_v1":"X","instructor_agreements_list_v1":"M08","reservation_impact_preview_v1":"M06","reservation_impact_apply_v1":"M06","settlement_movements_list_v1":"M07","settlement_requests_list_v1":"M07","settlement_request_get_v1":"M07","settlement_request_submit_v1":"M07","settlement_request_withdraw_v1":"M07","settlement_request_decide_v1":"M07","settlement_authority_get_v1":"M07","settlement_delegation_set_v1":"M07","settlement_authority_set_v1":"M07","negative_limits_get_v1":"M06","attendance_start_v1":"M05","document_publication_preview_v1":"M14","settings_catalog_get_v1":"M02","settings_get_v1":"M02","settings_update_v1":"M02","settings_reset_preview_v1":"M02","settings_reset_apply_v1":"M02","settings_history_get_v1":"M02","reservation_capacity_override_v1":"M04","account_sessions_list_v1":"M02","account_session_label_v1":"M02","account_sessions_revoke_v1":"M02","account_security_history_get_v1":"M02","media_get_v1":"M02","settings_template_resolve_v1":"M02","calendar_links_get_v1":"M02","calendar_link_create_v1":"M02","calendar_link_rotate_v1":"M02","calendar_link_revoke_v1":"M02","calendar_feed_get_v1":"M02","settings_preparation_resolve_v1":"M02","account_signup_check_v1":"M02","role_revoke_preview_v1":"M02","subscription_period_change_request_v1":"M12","instructor_agreement_get_v1":"M08","instructor_agreement_accept_v1":"M08","content_catalog_get_v1":"M14","content_catalog_save_v1":"M14","finance_directory_get_v1":"M07","products_management_list_v1":"M06","product_state_set_v1":"M06","freeze_cancel_preview_v1":"M06","freeze_cancel_apply_v1":"M06","instructor_account_get_v1":"M08","member_finance_currencies_get_v1":"M07","member_document_contexts_get_v1":"M14","notifications_read_set_v1":"M10","management_work_list_v1":"M09","instructor_finance_directory_get_v1":"M08"}'::jsonb->>op$$;
create index audit_center_discovery on core.audit_events(org_id,created_at,id);
create index tracking_own_contexts on private.p06_contexts(org_id,account_id,receipt_id);
create index tracking_own_previews on private.p06_previews(org_id,account_id,preview_id);
create function private.audit_discovery_allowed(r jsonb,p_org uuid,p_center uuid,p_actor uuid) returns boolean language plpgsql security invoker set search_path='' as $$
begin
 if r#>>'{subject,type}'='organizations' then return false;end if;
 perform private.p06_audit_scope(r,p_org,p_center,p_actor);return true;
exception when sqlstate 'P0001' then
 if sqlerrm in ('FORBIDDEN','NOT_FOUND') then return false;end if;raise;
end$$;
create function private.audit_discovery(r jsonb,p_org uuid,p_center uuid,p_actor uuid,p_account uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare items jsonb;
begin
 if p_center is null then perform private.fail('VALIDATION_FAILED');end if;
 perform private.assert_center(p_org,p_center);
 if not private.is_org_reader(p_org,p_actor) and not private.is_manager(p_org,p_actor,p_center) and not private.p06_granted(p_org,p_actor,p_center,'report.read') then perform private.fail('FORBIDDEN');end if;
 if r?'interval' and (r#>>'{interval,starts_at}')::timestamptz>=(r#>>'{interval,ends_at}')::timestamptz then perform private.fail('VALIDATION_FAILED');end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'action',a.action,'subject',jsonb_build_object('type',a.subject_table,'id',a.subject_id),
 'actor_display',coalesce(p.display_name,'System'),'created_at',a.created_at,'reason',null,'diff',case when changes.v is not null then jsonb_build_object('changes',changes.v) end,
 'module',private.tracking_operation_module(a.action),'result','recorded','operation_id',a.operation_id,
 'subject_title',coalesce(label.title,a.subject_table),'operation_state',receipt.state) order by a.created_at,a.id),'[]') into items
 from core.audit_events a left join core.people p on p.org_id=a.org_id and p.id=private.p07_person_root(p_org,a.actor_person_id)
 left join core.operation_receipts receipt on receipt.org_id=a.org_id and receipt.id=a.operation_id
 left join lateral(select case a.subject_table
  when 'people' then (select display_name from core.people where org_id=p_org and id=private.p07_person_root(p_org,a.subject_id))
  when 'centers' then (select name from core.centers where org_id=p_org and id=a.subject_id)
  when 'rooms' then (select name from core.rooms where org_id=p_org and id=a.subject_id)
  when 'classes' then (select name from core.classes where org_id=p_org and id=a.subject_id)
  when 'events' then (select name from core.events where org_id=p_org and id=a.subject_id)
  when 'product_versions' then (select published_name from core.product_versions where org_id=p_org and id=a.subject_id)
  end title) label on true
 left join lateral(select jsonb_agg(jsonb_build_object('field',k,'old_value',null,'new_value',v) order by k) v from jsonb_each(coalesce(a.diff,'{}')) d(k,v)
  where k in ('state','version','progress_count','total_count') and jsonb_typeof(v) in ('string','number','boolean','null')) changes on true
 where a.org_id=p_org and exists(select 1 from private.runtime_operations o where o.name=a.action)
 and private.audit_discovery_allowed(jsonb_build_object('subject',jsonb_build_object('type',a.subject_table,'id',a.subject_id)),p_org,p_center,p_actor)
 and (not r?'interval' or a.created_at>=(r#>>'{interval,starts_at}')::timestamptz and a.created_at<(r#>>'{interval,ends_at}')::timestamptz)
 and (r->>'module' is null or private.tracking_operation_module(a.action)=r->>'module')
 and (r->>'query' is null or a.action ilike '%'||(r->>'query')||'%' or p.display_name ilike '%'||(r->>'query')||'%' or label.title ilike '%'||(r->>'query')||'%' or a.subject_table ilike '%'||(r->>'query')||'%' or a.subject_id::text=r->>'query');
 return private.p06_page(items,r->'page',encode(extensions.digest(jsonb_build_object('account',p_account,'actor',p_actor,'request',r-'page'-'request_id')::text,'sha256'),'hex'),statement_timestamp());
end$$;
create function private.tracking_original_allowed(op text,r jsonb,p_auth uuid,p_session uuid,ids uuid[]) returns boolean language plpgsql security invoker set search_path='' as $$
begin
 perform private.p06_original_authorize(op,r,p_auth,p_session,ids);return true;
exception when sqlstate 'P0001' then
 if sqlerrm in ('FORBIDDEN','NOT_FOUND','SESSION_REVOKED','SERVICE_UNAVAILABLE','PLAN_FEATURE_UNAVAILABLE','PLAN_LIMIT_REACHED','SUBSCRIPTION_NOT_STARTED','BILLING_OPERATION_RESTRICTED') then return false;end if;raise;
end$$;
create function private.tracking_directory(r jsonb,p_org uuid,p_center uuid,p_actor uuid,p_account uuid,p_auth uuid,p_session uuid,ids uuid[]) returns jsonb language plpgsql security invoker set search_path='' as $$
declare items jsonb;summary jsonb;data jsonb;stamp timestamptz:=statement_timestamp();
begin
 if p_center is null then perform private.fail('VALIDATION_FAILED');end if;perform private.assert_center(p_org,p_center);
 if r?'interval' and (r#>>'{interval,starts_at}')::timestamptz>=(r#>>'{interval,ends_at}')::timestamptz then perform private.fail('VALIDATION_FAILED');end if;
 with entries as (
  select q.id,q.created_at,'operation'::text kind,q.operation,
   case when q.result_expires_at<=stamp then 'result_expired' else q.state end state,q.state native_state,
   jsonb_build_object('kind','operation','id',q.id,'created_at',q.created_at,'operation',q.operation,'state',case when q.result_expires_at<=stamp then 'result_expired' else q.state end,
   'expires_at',q.result_expires_at,'progress_count',null,'total_count',null,'safe_error_code',null,'next_attempt_at',null,
   'result_reference',case when q.business_reference is not null and q.result_expires_at>stamp then jsonb_build_object('type',c.subject,'id',q.business_reference) end) item
  from private.p06_contexts c join core.operation_receipts q on q.id=c.receipt_id and q.org_id=c.org_id
  where c.org_id=p_org and c.account_id=p_account and q.actor_account_id=p_account and (c.request->>'center_id')::uuid=p_center
   and private.tracking_original_allowed(c.operation,c.request,p_auth,p_session,ids)
  union all
  select p.id,p.created_at,'preview',c.operation,case when p.state='current' and c.expires_at<=stamp then 'expired' else p.state end,p.state,
   jsonb_build_object('kind','preview','id',p.id,'created_at',p.created_at,'operation',c.operation,'state',case when p.state='current' and c.expires_at<=stamp then 'expired' else p.state end,
   'expires_at',c.expires_at,'progress_count',null,'total_count',null,'safe_error_code',null,'next_attempt_at',null,'result_reference',null)
  from private.p06_previews c join core.previews p on p.org_id=c.org_id and p.id=c.preview_id
  where c.org_id=p_org and c.account_id=p_account and p.actor_account_id=p_account and (c.request->>'center_id')::uuid=p_center
   and private.tracking_original_allowed(c.operation,c.request,p_auth,p_session,ids)
  union all
  select q.id,q.created_at,'job',c.operation,q.state,q.state,
   jsonb_build_object('kind','job','id',q.id,'created_at',q.created_at,'operation',c.operation,'state',q.state,'expires_at',null,
   'progress_count',c.progress_count,'total_count',c.total_count,'safe_error_code',c.safe_error_code,'next_attempt_at',case when q.state in ('pending','retry_wait') then q.next_attempt_at end,'result_reference',c.result_reference)
  from private.p06_jobs c join core.outbox_jobs q on q.org_id=c.org_id and q.id=c.job_id
  where c.org_id=p_org and c.account_id=p_account and c.center_id=p_center
   and private.import_discovery_job_allowed(jsonb_build_object('job_id',c.job_id),p_org,p_center,p_actor,p_account)
 ),visible as (
  select * from entries where (not r?'interval' or created_at>=(r#>>'{interval,starts_at}')::timestamptz and created_at<(r#>>'{interval,ends_at}')::timestamptz)
   and (r->>'query' is null or operation ilike '%'||(r->>'query')||'%' or id::text=r->>'query')
 )select coalesce(jsonb_agg(item order by created_at,id,kind) filter(where (coalesce(r->>'kind','all')='all' or kind=r->>'kind') and (r->>'state' is null or state=r->>'state')),'[]'),
  jsonb_build_object('total',count(*),'previews',count(*) filter(where kind='preview'),'operations',count(*) filter(where kind='operation'),'jobs',count(*) filter(where kind='job'),
  'attention',count(*) filter(where kind='preview' and state='current'),'running',count(*) filter(where kind='job' and state in ('pending','running')),
  'retry',count(*) filter(where kind='job' and state='retry_wait'),'completed',count(*) filter(where kind in ('operation','job') and native_state='succeeded' or kind='preview' and native_state='applied'))
 into items,summary from visible;
 data:=private.p06_page(items,r->'page',encode(extensions.digest(jsonb_build_object('account',p_account,'actor',p_actor,'request',r-'page'-'request_id')::text,'sha256'),'hex'),stamp);
 return data||jsonb_build_object('summary',summary);
end$$;
do $patch$ declare b text;a text;begin
 b:=pg_get_functiondef('private.p06_tracking(text,jsonb,uuid,uuid,uuid,uuid,uuid,uuid,uuid[])'::regprocedure);a:='  perform private.p06_audit_scope(r,org,center,actor);';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Audit native discovery drift';end if;
 execute replace(b,a,$a$  if not r?'subject' then return jsonb_build_object('data',private.audit_discovery(r,org,center,actor,account),'primary_id',center,'subject','centers');end if;
$a$||a);
 b:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);a:=' elsif perm_code=''invite.student'' then';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Tracking directory permission drift';end if;
 b:=replace(b,a,$a$ elsif p_operation='tracking_directory_get_v1' then null; -- every item authorizes the original native context below
$a$||a);
 a:=' -- DOMAIN_CASES';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Tracking directory dispatch drift';end if;
 execute replace(b,a,$a$ when 'tracking_directory_get_v1' then out:=private.tracking_directory(r,org,center,person,actor.id,p_actor_auth_id,p_session_id,p_ids);
$a$||a);
end$patch$;
insert into private.runtime_operations(name,permission,billing_class,features) values('tracking_directory_get_v1','report.read','read',array[]::text[]);
create function api_v1.tracking_directory_get_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('tracking_directory_get_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.tracking_directory_get_v1(jsonb,uuid,uuid,uuid[],jsonb),private.tracking_operation_module(text),private.audit_discovery_allowed(jsonb,uuid,uuid,uuid),private.audit_discovery(jsonb,uuid,uuid,uuid,uuid),private.tracking_original_allowed(text,jsonb,uuid,uuid,uuid[]),private.tracking_directory(jsonb,uuid,uuid,uuid,uuid,uuid,uuid,uuid[]) from public,anon,authenticated;
grant execute on function api_v1.tracking_directory_get_v1(jsonb,uuid,uuid,uuid[],jsonb),private.tracking_operation_module(text),private.audit_discovery_allowed(jsonb,uuid,uuid,uuid),private.audit_discovery(jsonb,uuid,uuid,uuid,uuid),private.tracking_original_allowed(text,jsonb,uuid,uuid,uuid[]),private.tracking_directory(jsonb,uuid,uuid,uuid,uuid,uuid,uuid,uuid[]) to service_role;
commit;
