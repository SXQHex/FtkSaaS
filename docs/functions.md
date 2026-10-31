# API ve iş akışı haritası

Üretilmiştir: `node apps/backend/scripts/update-docs.mjs --write`. Elle düzenleme. Kaynak içerik özeti: `8fe95514631551945ed0d3a829164dba077acb6f473c2286e6397673baef39f2`. Bu özet CI/hosted kabulü değildir; dağıtılan SHA ve ortam CD artifact'ında bulunur.

DTO/izin/hata/yan etkiler [üretilmiş API kataloğu](contracts/05-FtkSaaS-O4-API-katalogu.md) ve [makine sözleşmesinden](../packages/api-contracts/schema/contract.json) gelir. Edge kodu [backend-v1](../apps/backend/supabase/functions/backend-v1/index.ts) altındadır; SQL domain davranışını Edge dosyasından tek başına çıkarma. `implemented.json` içindeki varlık tüm selector/provider/ürün kabulünün tamamlandığı anlamına gelmez. Backend-only satırları tarayıcı endpoint önerisi değildir.

| API | Çağrılabilir envanter | Faz | İzin | Akış / kapsam |
|---|---|---|---|---|
| `account_get_v1` | runtime (sınırları oku) | read | account.self | [WF01](workflows.md#wf01) / starter |
| `account_profile_update_v1` | runtime (sınırları oku) | command | account.self | [WF01](workflows.md#wf01) / starter |
| `account_delete_preview_v1` | runtime (sınırları oku) | preview | account.self | [WF17](workflows.md#wf17) / restricted |
| `account_delete_apply_v1` | runtime (sınırları oku) | apply | account.self | [WF17](workflows.md#wf17) / restricted |
| `organizations_list_v1` | runtime (sınırları oku) | read | account.self | [WF02](workflows.md#wf02) / starter |
| `organization_create_v1` | runtime (sınırları oku) | command | platform.owner | [WF02](workflows.md#wf02) / starter |
| `organization_get_v1` | runtime (sınırları oku) | read | org.read | [WF02](workflows.md#wf02) / starter |
| `organization_update_v1` | runtime (sınırları oku) | command | org.manage | [WF02](workflows.md#wf02) / starter |
| `organization_close_preview_v1` | runtime (sınırları oku) | preview | org.owner | [WF17](workflows.md#wf17) / restricted |
| `organization_close_apply_v1` | runtime (sınırları oku) | apply | org.owner | [WF17](workflows.md#wf17) / restricted |
| `organization_reopen_v1` | runtime (sınırları oku) | command | org.owner | [WF17](workflows.md#wf17) / restricted |
| `organization_delete_preview_v1` | runtime (sınırları oku) | preview | org.owner | [WF17](workflows.md#wf17) / restricted |
| `organization_delete_apply_v1` | runtime (sınırları oku) | apply | org.owner | [WF17](workflows.md#wf17) / restricted |
| `centers_list_v1` | runtime (sınırları oku) | read | org.read | [WF02](workflows.md#wf02) / starter |
| `center_create_v1` | runtime (sınırları oku) | command | org.manage | [WF02](workflows.md#wf02) / starter |
| `center_update_v1` | runtime (sınırları oku) | command | center.manage | [WF02](workflows.md#wf02) / starter |
| `room_save_v1` | runtime (sınırları oku) | command | center.manage | [WF02](workflows.md#wf02) / starter |
| `availability_save_v1` | runtime (sınırları oku) | command | center.manage | [WF03](workflows.md#wf03) / starter |
| `availability_exception_save_v1` | runtime (sınırları oku) | command | center.manage | [WF03](workflows.md#wf03) / starter |
| `policies_get_v1` | runtime (sınırları oku) | read | org.read | [WF03](workflows.md#wf03) / starter |
| `policy_publish_v1` | runtime (sınırları oku) | command | policy.manage | [WF03](workflows.md#wf03) / starter |
| `roles_list_v1` | runtime (sınırları oku) | read | org.read | [WF02](workflows.md#wf02) / starter |
| `role_assign_v1` | runtime (sınırları oku) | command | center.manage | [WF02](workflows.md#wf02) / starter |
| `role_revoke_v1` | runtime (sınırları oku) | command | center.manage | [WF02](workflows.md#wf02) / starter |
| `permission_set_v1` | runtime (sınırları oku) | command | center.manage | [WF02](workflows.md#wf02) / starter |
| `org_manager_assign_v1` | runtime (sınırları oku) | command | org.owner | [WF02](workflows.md#wf02) / starter |
| `org_manager_revoke_v1` | runtime (sınırları oku) | command | org.owner | [WF02](workflows.md#wf02) / starter |
| `manager_self_assign_center_v1` | runtime (sınırları oku) | command | org.manage | [WF02](workflows.md#wf02) / starter |
| `account_access_send_v1` | runtime (sınırları oku) | command | invite.student | [WF04](workflows.md#wf04) / starter |
| `account_access_revoke_v1` | runtime (sınırları oku) | command | invite.student | [WF04](workflows.md#wf04) / starter |
| `account_access_accept_v1` | runtime (sınırları oku) | command | invite.accept | [WF04](workflows.md#wf04) / starter |
| `account_link_remove_v1` | runtime (sınırları oku) | command | center.manage | [WF04](workflows.md#wf04) / starter |
| `people_list_v1` | runtime (sınırları oku) | read | person.read | [WF04](workflows.md#wf04) / starter |
| `person_get_v1` | runtime (sınırları oku) | read | person.read | [WF04](workflows.md#wf04) / starter |
| `person_create_v1` | runtime (sınırları oku) | command | person.manage | [WF04](workflows.md#wf04) / starter |
| `person_update_v1` | runtime (sınırları oku) | command | person.manage | [WF04](workflows.md#wf04) / starter |
| `student_activate_v1` | runtime (sınırları oku) | command | person.activate | [WF04](workflows.md#wf04) / starter |
| `student_deactivate_v1` | runtime (sınırları oku) | command | person.activate | [WF04](workflows.md#wf04) / starter |
| `person_merge_preview_v1` | runtime (sınırları oku) | preview | person.merge | [WF04](workflows.md#wf04) / starter |
| `person_merge_approve_v1` | runtime (sınırları oku) | command | person.merge | [WF04](workflows.md#wf04) / starter |
| `person_merge_apply_v1` | runtime (sınırları oku) | apply | person.merge | [WF04](workflows.md#wf04) / starter |
| `calendar_get_v1` | runtime (sınırları oku) | read | schedule.read | [WF03](workflows.md#wf03) / starter |
| `class_save_v1` | runtime (sınırları oku) | command | schedule.manage | [WF03](workflows.md#wf03) / starter |
| `program_preview_v1` | runtime (sınırları oku) | preview | schedule.manage | [WF03](workflows.md#wf03) / starter |
| `program_apply_v1` | runtime (sınırları oku) | apply | schedule.manage | [WF03](workflows.md#wf03) / starter |
| `session_create_v1` | runtime (sınırları oku) | command | schedule.manage | [WF03](workflows.md#wf03) / starter |
| `session_get_v1` | runtime (sınırları oku) | read | schedule.read | [WF03](workflows.md#wf03) / starter |
| `session_change_preview_v1` | runtime (sınırları oku) | preview | schedule.manage | [WF03](workflows.md#wf03) / starter |
| `session_change_apply_v1` | runtime (sınırları oku) | apply | schedule.manage | [WF03](workflows.md#wf03) / starter |
| `session_capacity_set_v1` | runtime (sınırları oku) | command | schedule.manage | [WF03](workflows.md#wf03) / starter |
| `session_cancel_preview_v1` | runtime (sınırları oku) | preview | schedule.manage | [WF03](workflows.md#wf03) / starter |
| `session_cancel_apply_v1` | runtime (sınırları oku) | apply | schedule.manage | [WF03](workflows.md#wf03) / starter |
| `replacement_session_create_v1` | runtime (sınırları oku) | command | schedule.manage | [WF03](workflows.md#wf03) / starter |
| `session_assignment_set_v1` | runtime (sınırları oku) | command | schedule.manage | [WF03](workflows.md#wf03) / starter |
| `lesson_request_create_v1` | runtime (sınırları oku) | command | request.write | [WF06](workflows.md#wf06) / starter |
| `lesson_request_withdraw_v1` | runtime (sınırları oku) | command | request.write | [WF06](workflows.md#wf06) / starter |
| `lesson_request_reject_v1` | runtime (sınırları oku) | command | request.resolve | [WF06](workflows.md#wf06) / starter |
| `lesson_request_offer_alternative_v1` | runtime (sınırları oku) | command | request.resolve | [WF06](workflows.md#wf06) / starter |
| `lesson_request_accept_alternative_v1` | runtime (sınırları oku) | command | request.write | [WF06](workflows.md#wf06) / starter |
| `lesson_request_approve_v1` | runtime (sınırları oku) | command | request.resolve | [WF06](workflows.md#wf06) / starter |
| `reservation_create_v1` | runtime (sınırları oku) | command | reservation.write | [WF06](workflows.md#wf06) / starter |
| `reservation_cancel_v1` | runtime (sınırları oku) | command | reservation.write | [WF06](workflows.md#wf06) / starter |
| `reservation_list_v1` | runtime (sınırları oku) | read | schedule.read | [WF06](workflows.md#wf06) / starter |
| `waitlist_join_v1` | runtime (sınırları oku) | command | reservation.write | [WF19](workflows.md#wf19) / upper-plan |
| `waitlist_leave_v1` | runtime (sınırları oku) | command | reservation.write | [WF19](workflows.md#wf19) / upper-plan |
| `seat_offer_accept_v1` | runtime (sınırları oku) | command | reservation.write | [WF19](workflows.md#wf19) / upper-plan |
| `seat_offer_reject_v1` | runtime (sınırları oku) | command | reservation.write | [WF19](workflows.md#wf19) / upper-plan |
| `attendance_get_v1` | runtime (sınırları oku) | read | attendance.draft | [WF07](workflows.md#wf07) / starter |
| `attendance_mark_v1` | runtime (sınırları oku) | draft | attendance.draft | [WF07](workflows.md#wf07) / starter |
| `attendance_close_v1` | runtime (sınırları oku) | closure | attendance.close | [WF07](workflows.md#wf07) / starter |
| `attendance_correct_preview_v1` | runtime (sınırları oku) | preview | attendance.correct | [WF07](workflows.md#wf07) / starter |
| `attendance_correct_apply_v1` | runtime (sınırları oku) | correction | attendance.correct | [WF07](workflows.md#wf07) / starter |
| `products_list_v1` | runtime (sınırları oku) | read | person.read | [WF05](workflows.md#wf05) / starter |
| `product_publish_v1` | runtime (sınırları oku) | command | product.manage | [WF05](workflows.md#wf05) / starter |
| `sale_preview_v1` | runtime (sınırları oku) | preview | sale.write | [WF05](workflows.md#wf05) / starter |
| `sale_apply_v1` | runtime (sınırları oku) | apply | sale.write | [WF05](workflows.md#wf05) / starter |
| `entitlements_get_v1` | runtime (sınırları oku) | read | person.read | [WF05](workflows.md#wf05) / starter |
| `entitlement_extend_v1` | runtime (sınırları oku) | command | entitlement.correct | [WF05](workflows.md#wf05) / starter |
| `credit_adjust_v1` | runtime (sınırları oku) | command | entitlement.correct | [WF05](workflows.md#wf05) / starter |
| `negative_limit_set_v1` | runtime (sınırları oku) | command | entitlement.correct | [WF05](workflows.md#wf05) / starter |
| `freeze_preview_v1` | runtime (sınırları oku) | preview | entitlement.correct | [WF05](workflows.md#wf05) / starter |
| `freeze_apply_v1` | runtime (sınırları oku) | apply | entitlement.correct | [WF05](workflows.md#wf05) / starter |
| `freeze_end_preview_v1` | runtime (sınırları oku) | preview | entitlement.correct | [WF05](workflows.md#wf05) / starter |
| `freeze_end_apply_v1` | runtime (sınırları oku) | apply | entitlement.correct | [WF05](workflows.md#wf05) / starter |
| `sale_terminate_preview_v1` | runtime (sınırları oku) | preview | entitlement.correct | [WF05](workflows.md#wf05) / starter |
| `sale_terminate_apply_v1` | runtime (sınırları oku) | apply | entitlement.correct | [WF05](workflows.md#wf05) / starter |
| `sale_refund_preview_v1` | runtime (sınırları oku) | preview | finance.refund | [WF05](workflows.md#wf05) / starter |
| `sale_refund_apply_v1` | runtime (sınırları oku) | apply | finance.refund | [WF05](workflows.md#wf05) / starter |
| `sale_change_preview_v1` | runtime (sınırları oku) | preview | entitlement.correct | [WF05](workflows.md#wf05) / starter |
| `sale_change_apply_v1` | runtime (sınırları oku) | apply | entitlement.correct | [WF05](workflows.md#wf05) / starter |
| `sale_renew_preview_v1` | runtime (sınırları oku) | preview | sale.write | [WF05](workflows.md#wf05) / starter |
| `sale_renew_apply_v1` | runtime (sınırları oku) | apply | sale.write | [WF05](workflows.md#wf05) / starter |
| `finance_get_v1` | runtime (sınırları oku) | read | finance.read | [WF08](workflows.md#wf08) / starter |
| `collection_record_v1` | runtime (sınırları oku) | command | finance.collect | [WF08](workflows.md#wf08) / starter |
| `collection_correct_preview_v1` | runtime (sınırları oku) | preview | finance.refund | [WF08](workflows.md#wf08) / starter |
| `collection_correct_apply_v1` | runtime (sınırları oku) | correction | finance.refund | [WF08](workflows.md#wf08) / starter |
| `student_credit_refund_v1` | runtime (sınırları oku) | command | finance.refund | [WF08](workflows.md#wf08) / starter |
| `student_credit_offset_v1` | runtime (sınırları oku) | command | finance.collect | [WF08](workflows.md#wf08) / starter |
| `debt_adjust_v1` | runtime (sınırları oku) | command | finance.refund | [WF08](workflows.md#wf08) / starter |
| `instructor_agreement_publish_v1` | runtime (sınırları oku) | command | earnings.manage | [WF14](workflows.md#wf14) / upper-plan |
| `earnings_list_v1` | runtime (sınırları oku) | read | earnings.read | [WF14](workflows.md#wf14) / upper-plan |
| `instructor_payment_record_v1` | runtime (sınırları oku) | command | earnings.manage | [WF14](workflows.md#wf14) / upper-plan |
| `instructor_payment_correct_v1` | runtime (sınırları oku) | correction | earnings.manage | [WF14](workflows.md#wf14) / upper-plan |
| `leads_list_v1` | runtime (sınırları oku) | read | crm.daily | [WF16](workflows.md#wf16) / upper-plan |
| `lead_save_v1` | runtime (sınırları oku) | command | crm.daily | [WF16](workflows.md#wf16) / upper-plan |
| `crm_activity_save_v1` | runtime (sınırları oku) | command | crm.daily | [WF16](workflows.md#wf16) / upper-plan |
| `trial_offer_create_v1` | runtime (sınırları oku) | command | crm.daily | [WF16](workflows.md#wf16) / upper-plan |
| `trial_registration_confirm_v1` | runtime (sınırları oku) | command | crm.daily | [WF16](workflows.md#wf16) / upper-plan |
| `lead_convert_v1` | runtime (sınırları oku) | command | crm.daily | [WF16](workflows.md#wf16) / upper-plan |
| `crm_followup_list_v1` | runtime (sınırları oku) | read | crm.daily | [WF16](workflows.md#wf16) / upper-plan |
| `segment_save_v1` | runtime (sınırları oku) | command | crm.manage | [WF16](workflows.md#wf16) / upper-plan |
| `automation_save_v1` | runtime (sınırları oku) | command | crm.manage | [WF16](workflows.md#wf16) / upper-plan |
| `notifications_list_v1` | runtime (sınırları oku) | read | notification.self | [WF11](workflows.md#wf11) / starter |
| `notification_mark_read_v1` | runtime (sınırları oku) | command | notification.self | [WF11](workflows.md#wf11) / starter |
| `notification_preferences_set_v1` | runtime (sınırları oku) | command | notification.self | [WF12](workflows.md#wf12) / starter |
| `report_get_v1` | runtime (sınırları oku) | read | report.read | [WF10](workflows.md#wf10) / starter |
| `report_export_start_v1` | runtime (sınırları oku) | command | report.export | [WF10](workflows.md#wf10) / starter |
| `report_file_get_v1` | runtime (sınırları oku) | read | report.export | [WF10](workflows.md#wf10) / starter |
| `import_upload_prepare_v1` | runtime (sınırları oku) | command | import.execute | [WF10](workflows.md#wf10) / starter |
| `import_preview_v1` | runtime (sınırları oku) | preview | import.execute | [WF10](workflows.md#wf10) / starter |
| `import_apply_v1` | runtime (sınırları oku) | apply | import.execute | [WF10](workflows.md#wf10) / starter |
| `import_rows_list_v1` | runtime (sınırları oku) | read | import.execute | [WF10](workflows.md#wf10) / starter |
| `subscription_get_v1` | runtime (sınırları oku) | read | subscription.owner | [WF13](workflows.md#wf13) / starter |
| `subscription_upgrade_quote_v1` | runtime (sınırları oku) | command | subscription.owner | [WF13](workflows.md#wf13) / starter |
| `subscription_downgrade_request_v1` | runtime (sınırları oku) | command | subscription.owner | [WF13](workflows.md#wf13) / starter |
| `subscription_change_cancel_v1` | runtime (sınırları oku) | command | subscription.owner | [WF13](workflows.md#wf13) / starter |
| `subscription_renewal_set_v1` | runtime (sınırları oku) | command | subscription.owner | [WF13](workflows.md#wf13) / starter |
| `saas_payment_submit_v1` | runtime (sınırları oku) | command | subscription.owner | [WF13](workflows.md#wf13) / starter |
| `saas_payment_verify_v1` | runtime (sınırları oku) | command | saas.operator | [WF17](workflows.md#wf17) / restricted |
| `saas_grace_extend_v1` | runtime (sınırları oku) | command | saas.operator | [WF17](workflows.md#wf17) / restricted |
| `event_save_v1` | runtime (sınırları oku) | command | event.manage | [WF15](workflows.md#wf15) / upper-plan |
| `event_publish_v1` | runtime (sınırları oku) | command | event.manage | [WF15](workflows.md#wf15) / upper-plan |
| `event_register_v1` | runtime (sınırları oku) | command | event.register | [WF15](workflows.md#wf15) / upper-plan |
| `event_registration_cancel_v1` | runtime (sınırları oku) | command | event.register | [WF15](workflows.md#wf15) / upper-plan |
| `event_complete_v1` | runtime (sınırları oku) | command | event.manage | [WF15](workflows.md#wf15) / upper-plan |
| `event_duty_verify_v1` | runtime (sınırları oku) | command | event.manage | [WF15](workflows.md#wf15) / upper-plan |
| `event_cancel_preview_v1` | runtime (sınırları oku) | preview | event.manage | [WF15](workflows.md#wf15) / upper-plan |
| `event_cancel_apply_v1` | runtime (sınırları oku) | apply | event.manage | [WF15](workflows.md#wf15) / upper-plan |
| `event_list_v1` | runtime (sınırları oku) | read | schedule.read | [WF15](workflows.md#wf15) / upper-plan |
| `document_upload_prepare_v1` | runtime (sınırları oku) | command | document.manage | [WF11](workflows.md#wf11) / starter |
| `document_version_publish_v1` | runtime (sınırları oku) | command | document.manage | [WF11](workflows.md#wf11) / starter |
| `document_requirements_get_v1` | runtime (sınırları oku) | read | person.read | [WF11](workflows.md#wf11) / starter |
| `document_accept_v1` | runtime (sınırları oku) | command | document.accept | [WF11](workflows.md#wf11) / starter |
| `publication_set_v1` | runtime (sınırları oku) | command | schedule.manage | [WF09](workflows.md#wf09) / starter |
| `public_calendar_get_v1` | runtime (sınırları oku) | read | public.apply | [WF09](workflows.md#wf09) / starter |
| `public_application_submit_v1` | runtime (sınırları oku) | command | public.apply | [WF09](workflows.md#wf09) / starter |
| `public_application_review_v1` | runtime (sınırları oku) | command | crm.daily | [WF09](workflows.md#wf09) / starter |
| `operation_status_get_v1` | runtime (sınırları oku) | read | account.self | [WF00](workflows.md#wf00) / common |
| `preview_get_v1` | runtime (sınırları oku) | read | account.self | [WF00](workflows.md#wf00) / common |
| `job_status_get_v1` | runtime (sınırları oku) | read | account.self | [WF00](workflows.md#wf00) / common |
| `audit_list_v1` | runtime (sınırları oku) | read | report.read | [WF00](workflows.md#wf00) / common |
| `seat_offer_issue_v1` | runtime (sınırları oku) | worker | system.worker | [WF20](workflows.md#wf20) / backend-only |
| `seat_offer_expire_v1` | runtime (sınırları oku) | worker | system.worker | [WF20](workflows.md#wf20) / backend-only |
| `request_expire_v1` | runtime (sınırları oku) | worker | system.worker | [WF20](workflows.md#wf20) / backend-only |
| `outbox_deliver_v1` | runtime (sınırları oku) | worker | system.worker | [WF20](workflows.md#wf20) / backend-only |
| `reminder_schedule_v1` | runtime (sınırları oku) | worker | system.worker | [WF20](workflows.md#wf20) / backend-only |
| `automation_run_v1` | runtime (sınırları oku) | worker | system.worker | [WF20](workflows.md#wf20) / backend-only |
| `import_rows_process_v1` | runtime (sınırları oku) | worker | system.worker | [WF20](workflows.md#wf20) / backend-only |
| `report_build_v1` | runtime (sınırları oku) | worker | system.worker | [WF20](workflows.md#wf20) / backend-only |
| `privacy_execute_v1` | runtime (sınırları oku) | worker | system.worker | [WF20](workflows.md#wf20) / backend-only |
| `subscription_boundary_apply_v1` | runtime (sınırları oku) | worker | system.worker | [WF20](workflows.md#wf20) / backend-only |
| `class_assignment_set_v1` | runtime (sınırları oku) | command | schedule.manage | [WF03](workflows.md#wf03) / starter |
| `event_attendance_mark_v1` | runtime (sınırları oku) | draft | event.attendance | [WF15](workflows.md#wf15) / upper-plan |
| `platform_owner_set_v1` | runtime (sınırları oku) | command | platform.owner | [WF17](workflows.md#wf17) / restricted |
| `platform_owner_remove_v1` | runtime (sınırları oku) | command | platform.owner | [WF17](workflows.md#wf17) / restricted |
| `center_manager_assign_v1` | runtime (sınırları oku) | command | center.manager.assign | [WF02](workflows.md#wf02) / starter |
| `center_manager_revoke_v1` | runtime (sınırları oku) | command | center.manager.assign | [WF02](workflows.md#wf02) / starter |
| `attendance_block_v1` | runtime (sınırları oku) | command | attendance.block | [WF07](workflows.md#wf07) / starter |
| `event_attendance_close_v1` | runtime (sınırları oku) | closure | event.close | [WF15](workflows.md#wf15) / upper-plan |
| `event_attendance_correct_v1` | runtime (sınırları oku) | correction | event.close | [WF15](workflows.md#wf15) / upper-plan |
| `file_upload_complete_v1` | runtime (sınırları oku) | command | account.self | [WF10](workflows.md#wf10) / starter |
| `negcredit_valuation_set_v1` | runtime (sınırları oku) | command | product.manage | [WF14](workflows.md#wf14) / upper-plan |
| `disciplines_list_v1` | runtime (sınırları oku) | read | org.read | [WF02](workflows.md#wf02) / starter |
| `discipline_save_v1` | runtime (sınırları oku) | command | org.manage | [WF02](workflows.md#wf02) / starter |
| `center_discipline_set_v1` | runtime (sınırları oku) | command | center.manage | [WF02](workflows.md#wf02) / starter |
| `person_discipline_set_v1` | runtime (sınırları oku) | command | person.manage | [WF04](workflows.md#wf04) / starter |
| `event_get_v1` | runtime (sınırları oku) | read | person.read | [WF15](workflows.md#wf15) / upper-plan |
| `event_registration_preview_v1` | runtime (sınırları oku) | preview | event.register | [WF15](workflows.md#wf15) / upper-plan |
| `event_payment_prepare_v1` | runtime (sınırları oku) | command | event.register | [WF15](workflows.md#wf15) / upper-plan |
| `event_payment_get_v1` | runtime (sınırları oku) | read | person.read | [WF15](workflows.md#wf15) / upper-plan |
| `event_actual_start_record_v1` | runtime (sınırları oku) | command | event.manage | [WF15](workflows.md#wf15) / upper-plan |
| `event_actual_start_correct_v1` | runtime (sınırları oku) | correction | event.manage | [WF15](workflows.md#wf15) / upper-plan |
| `management_state_get_v1` | runtime (sınırları oku) | read | management.inspect | [WF00](workflows.md#wf00) / common |
| `instructor_agreements_list_v1` | runtime (sınırları oku) | read | earnings.manage | [WF14](workflows.md#wf14) / upper-plan |
| `reservation_impact_preview_v1` | runtime (sınırları oku) | preview | reservation.protection.manage | [WF05](workflows.md#wf05) / starter |
| `reservation_impact_apply_v1` | runtime (sınırları oku) | apply | reservation.protection.manage | [WF05](workflows.md#wf05) / starter |
| `settlement_movements_list_v1` | runtime (sınırları oku) | read | settlement.read | [WF18](workflows.md#wf18) / upper-plan |
| `settlement_requests_list_v1` | runtime (sınırları oku) | read | settlement.read | [WF18](workflows.md#wf18) / upper-plan |
| `settlement_request_get_v1` | runtime (sınırları oku) | read | settlement.read | [WF18](workflows.md#wf18) / upper-plan |
| `settlement_request_submit_v1` | runtime (sınırları oku) | command | settlement.request | [WF18](workflows.md#wf18) / upper-plan |
| `settlement_request_withdraw_v1` | runtime (sınırları oku) | command | settlement.request | [WF18](workflows.md#wf18) / upper-plan |
| `settlement_request_decide_v1` | runtime (sınırları oku) | command | settlement.decide | [WF18](workflows.md#wf18) / upper-plan |
| `settlement_authority_get_v1` | runtime (sınırları oku) | read | settlement.authority.inspect | [WF18](workflows.md#wf18) / upper-plan |
| `settlement_delegation_set_v1` | runtime (sınırları oku) | command | settlement.delegation.manage | [WF18](workflows.md#wf18) / upper-plan |
| `settlement_authority_set_v1` | runtime (sınırları oku) | command | settlement.authority.manage | [WF18](workflows.md#wf18) / upper-plan |
| `negative_limits_get_v1` | runtime (sınırları oku) | read | entitlement.correct | [WF05](workflows.md#wf05) / starter |
| `attendance_start_v1` | runtime (sınırları oku) | command | attendance.close | [WF07](workflows.md#wf07) / starter |
| `document_publication_preview_v1` | runtime (sınırları oku) | preview | document.manage | [WF11](workflows.md#wf11) / starter |
| `settings_catalog_get_v1` | runtime (sınırları oku) | read | settings.access | [WF12](workflows.md#wf12) / starter |
| `settings_get_v1` | runtime (sınırları oku) | read | settings.access | [WF12](workflows.md#wf12) / starter |
| `settings_update_v1` | runtime (sınırları oku) | command | settings.access | [WF12](workflows.md#wf12) / starter |
| `settings_reset_preview_v1` | runtime (sınırları oku) | preview | settings.access | [WF12](workflows.md#wf12) / starter |
| `settings_reset_apply_v1` | runtime (sınırları oku) | command | settings.access | [WF12](workflows.md#wf12) / starter |
| `settings_history_get_v1` | runtime (sınırları oku) | read | settings.access | [WF12](workflows.md#wf12) / starter |
| `reservation_capacity_override_v1` | runtime (sınırları oku) | command | reservation.capacity_override | [WF06](workflows.md#wf06) / starter |
| `account_sessions_list_v1` | runtime (sınırları oku) | read | account.self | [WF01](workflows.md#wf01) / starter |
| `account_session_label_v1` | runtime (sınırları oku) | auth | account.self | [WF01](workflows.md#wf01) / starter |
| `account_sessions_revoke_v1` | runtime (sınırları oku) | auth | account.self | [WF01](workflows.md#wf01) / starter |
| `account_security_history_get_v1` | runtime (sınırları oku) | read | account.self | [WF01](workflows.md#wf01) / starter |
| `media_get_v1` | runtime (sınırları oku) | read | media.read | [WF12](workflows.md#wf12) / starter |
| `settings_template_resolve_v1` | runtime (sınırları oku) | read | templates.resolve | [WF12](workflows.md#wf12) / starter |
| `calendar_links_get_v1` | runtime (sınırları oku) | read | calendar.self | [WF09](workflows.md#wf09) / starter |
| `calendar_link_create_v1` | runtime (sınırları oku) | auth | calendar.self | [WF09](workflows.md#wf09) / starter |
| `calendar_link_rotate_v1` | runtime (sınırları oku) | auth | calendar.self | [WF09](workflows.md#wf09) / starter |
| `calendar_link_revoke_v1` | runtime (sınırları oku) | auth | calendar.self | [WF09](workflows.md#wf09) / starter |
| `calendar_feed_get_v1` | runtime (sınırları oku) | read | calendar.feed | [WF09](workflows.md#wf09) / starter |
| `settings_preparation_resolve_v1` | runtime (sınırları oku) | read | preparation.resolve | [WF12](workflows.md#wf12) / starter |
| `account_signup_check_v1` | runtime (sınırları oku) | auth | auth.signup | [WF01](workflows.md#wf01) / starter |

## Akış kanıt kaynakları

Test dosyası bağlantısı çalıştırılmış test başarısı değildir. Kaynak bağlı CI/hosted sonuçları güncel kabul belgesinin sahibidir.

- [WF00 — Ortak istemci protokolü](workflows.md#wf00): [alan devri](client-integration.md); [contract.test.mjs](../apps/backend/tests/contract.test.mjs), [api-acceptance.test.mjs](../apps/backend/tests/api-acceptance.test.mjs)
- [WF01 — Kimlik ve hesap güvenliği](workflows.md#wf01): [alan devri](settings.md); [account-identity-acceptance.mjs](../apps/backend/tests/account-identity-acceptance.mjs), [account-session-management-acceptance.mjs](../apps/backend/tests/account-session-management-acceptance.mjs), [account-mfa-acceptance.mjs](../apps/backend/tests/account-mfa-acceptance.mjs), [account-signup-adapter.mjs](../apps/backend/tests/account-signup-adapter.mjs), [account-signup-acceptance.mjs](../apps/backend/tests/account-signup-acceptance.mjs), [auth-password-security-unit.mjs](../apps/backend/tests/auth-password-security-unit.mjs)
- [WF02 — Stüdyo kurulumu ve yetki](workflows.md#wf02): [alan devri](workflows.md); [registry.test.mjs](../apps/backend/tests/registry.test.mjs), [room-role-registry.test.mjs](../apps/backend/tests/room-role-registry.test.mjs), [starter-plan-gates-acceptance.mjs](../apps/backend/tests/starter-plan-gates-acceptance.mjs)
- [WF03 — Program ve seans yaşam döngüsü](workflows.md#wf03): [alan devri](workflows.md); [program-session-lifecycle.test.mjs](../apps/backend/tests/program-session-lifecycle.test.mjs), [schedule-reads.test.mjs](../apps/backend/tests/schedule-reads.test.mjs), [availability-policies.test.mjs](../apps/backend/tests/availability-policies.test.mjs)
- [WF04 — Kişi ve öğrencilik](workflows.md#wf04): [alan devri](client-integration.md); [person-registry.test.mjs](../apps/backend/tests/person-registry.test.mjs)
- [WF05 — Ürün, satış ve hak](workflows.md#wf05): [alan devri](workflows.md); [p01-catalog-entitlement-reads.test.mjs](../apps/backend/tests/p01-catalog-entitlement-reads.test.mjs), [starter-studio-acceptance.mjs](../apps/backend/tests/starter-studio-acceptance.mjs)
- [WF06 — Rezervasyon ve özel ders talebi](workflows.md#wf06): [alan devri](workflows.md); [p01-lesson-requests.test.mjs](../apps/backend/tests/p01-lesson-requests.test.mjs), [p01-catalog-entitlement-reads.test.mjs](../apps/backend/tests/p01-catalog-entitlement-reads.test.mjs)
- [WF07 — Yoklama ve hak tüketimi](workflows.md#wf07): [alan devri](workflows.md); [starter-attendance-protection.test.mjs](../apps/backend/tests/starter-attendance-protection.test.mjs)
- [WF08 — Borç, tahsilat ve öğrenci alacağı](workflows.md#wf08): [alan devri](workflows.md); [api-acceptance.test.mjs](../apps/backend/tests/api-acceptance.test.mjs), [starter-operations-acceptance.mjs](../apps/backend/tests/starter-operations-acceptance.mjs)
- [WF09 — Public başvuru ve kişisel takvim](workflows.md#wf09): [alan devri](workflows.md); [personal-calendar-acceptance.mjs](../apps/backend/tests/personal-calendar-acceptance.mjs), [calendar-feed-unit.mjs](../apps/backend/tests/calendar-feed-unit.mjs)
- [WF10 — Rapor ve import](workflows.md#wf10): [alan devri](workflows.md); [p06-acceptance.mjs](../apps/backend/tests/p06-acceptance.mjs), [p06-parser.mjs](../apps/backend/tests/p06-parser.mjs), [starter-operations-acceptance.mjs](../apps/backend/tests/starter-operations-acceptance.mjs)
- [WF11 — Belgeler ve işlemsel inbox](workflows.md#wf11): [alan devri](workflows.md); [p05-acceptance.mjs](../apps/backend/tests/p05-acceptance.mjs), [starter-operations-acceptance.mjs](../apps/backend/tests/starter-operations-acceptance.mjs)
- [WF12 — Ayarlar ve medya](workflows.md#wf12): [alan devri](settings.md); [frontend-settings-acceptance.mjs](../apps/backend/tests/frontend-settings-acceptance.mjs), [starter-preparation-acceptance.mjs](../apps/backend/tests/starter-preparation-acceptance.mjs)
- [WF13 — Abonelik ve plan erişimi](workflows.md#wf13): [alan devri](workflows.md); [p07-subscription-lifecycle-acceptance.mjs](../apps/backend/tests/p07-subscription-lifecycle-acceptance.mjs), [starter-plan-gates-acceptance.mjs](../apps/backend/tests/starter-plan-gates-acceptance.mjs)
- [WF14 — Anlaşma, hakediş ve eğitmen ödemesi](workflows.md#wf14): [alan devri](workflows.md); [instructor-earnings.test.mjs](../apps/backend/tests/instructor-earnings.test.mjs)
- [WF15 — Etkinlik kayıt, ödeme ve iptal](workflows.md#wf15): [alan devri](workflows.md); [event-payment.test.mjs](../apps/backend/tests/event-payment.test.mjs), [event-cancellation.test.mjs](../apps/backend/tests/event-cancellation.test.mjs)
- [WF16 — Genel CRM ve otomasyon](workflows.md#wf16): [alan devri](workflows.md); [p05-acceptance.mjs](../apps/backend/tests/p05-acceptance.mjs)
- [WF17 — Kapatma, silme ve platform yönetimi](workflows.md#wf17): [alan devri](workflows.md); [p07-lifecycle-acceptance.mjs](../apps/backend/tests/p07-lifecycle-acceptance.mjs), [p07-account-revocation-acceptance.mjs](../apps/backend/tests/p07-account-revocation-acceptance.mjs), [restore-guard.test.mjs](../apps/backend/tests/restore-guard.test.mjs)
- [WF18 — Merkezler arası hesaplaşma](workflows.md#wf18): [alan devri](workflows.md); [cross-center-settlement.test.mjs](../apps/backend/tests/cross-center-settlement.test.mjs)
- [WF19 — Bekleme listesi ve yer teklifi](workflows.md#wf19): [alan devri](workflows.md); [p01-waitlist-workers.test.mjs](../apps/backend/tests/p01-waitlist-workers.test.mjs)
- [WF20 — Worker ve işletim](workflows.md#wf20): [alan devri](workflows.md); [ops-hosted-acceptance.mjs](../apps/backend/tests/ops-hosted-acceptance.mjs), [p01-waitlist-workers.test.mjs](../apps/backend/tests/p01-waitlist-workers.test.mjs)
