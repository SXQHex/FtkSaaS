# Kalan backend işleri

Dal adayı: oda kaydı/güncelleme ve rol listesi eklendi (`room_save_v1`, `roles_list_v1`). Dalda 65 endpoint yapılandırılmıştır; aşağıdaki 63/121 sayıları son doğrulanmış main temelini gösterir. Yeni iki işlem gerçek Auth/API kabulü ve CI bitene kadar doğrulanmış sayılmaz. Kanıt: `reports/room-role-verification.json`.

Makine sözleşmesindeki 184 işlemden 63 işlem geliştirme ortamında çağrılabilir; 121 işlem yalnız sözleşmedir. Çağrılabilir envanteri üretim kabulü anlamına gelmez. Son doğrulama kanıtı `reports/registry-verification.json` içindedir.

## Bağımlılık sırası

1. Merkez odaları/uygunluk, politika yayınlama/okuma ve rol okumaları.
2. Takvim/seans/rezervasyon okumaları, program önizleme/uygulama ve talep–bekleme–yer teklifi yaşam döngüleri.
3. Ders yoklaması, kapanış/düzeltme, blocked katılım ve eğitmen anlaşması/hakediş.
4. Paket dondurma/uzatma/değişim/yenileme/sonlandırma ve finans düzeltme/iade önizleme–uygulama çiftleri.
5. Hesap erişimi geri alma, hesap/organizasyon kapanış/silme ve kişi birleştirme.
6. CRM, bildirim tercihleri, belgeler, raporlar, import ve worker işlemleri.

Her yeni grup: sözleşme/izin incelemesi → yeni migration → gerçek Auth/API kabulü (sınır, yetki, tekrar, yarış, rollback) → inceleme → temiz CI → main CI. Ürün kararında boşluk varsa teknik varsayımla yeni kural eklenmez.

## Yalnız sözleşme envanteri

| Modül | Kalan işlem |
|---|---:|
| M01 | 10 |
| M02 | 8 |
| M03 | 3 |
| M04 | 22 |
| M05 | 9 |
| M06 | 15 |
| M07 | 5 |
| M08 | 4 |
| M09 | 11 |
| M10 | 3 |
| M11 | 3 |
| M12 | 5 |
| M14 | 5 |
| X | 18 |

| İşlem | İzin |
|---|---|
| `account_profile_update_v1` | `account.self` |
| `account_password_change_v1` | `account.self` |
| `account_password_reset_request_v1` | `auth.recover` |
| `account_delete_preview_v1` | `account.self` |
| `account_delete_apply_v1` | `account.self` |
| `organization_close_preview_v1` | `org.owner` |
| `organization_close_apply_v1` | `org.owner` |
| `organization_reopen_v1` | `org.owner` |
| `organization_delete_preview_v1` | `org.owner` |
| `organization_delete_apply_v1` | `org.owner` |
| `room_save_v1` | `center.manage` |
| `availability_save_v1` | `center.manage` |
| `availability_exception_save_v1` | `center.manage` |
| `policies_get_v1` | `org.read` |
| `policy_publish_v1` | `policy.manage` |
| `roles_list_v1` | `org.read` |
| `account_access_revoke_v1` | `invite.student` |
| `account_link_remove_v1` | `center.manage` |
| `person_merge_preview_v1` | `person.merge` |
| `person_merge_approve_v1` | `person.merge` |
| `person_merge_apply_v1` | `person.merge` |
| `calendar_get_v1` | `schedule.read` |
| `program_preview_v1` | `schedule.manage` |
| `program_apply_v1` | `schedule.manage` |
| `session_get_v1` | `schedule.read` |
| `session_change_preview_v1` | `schedule.manage` |
| `session_change_apply_v1` | `schedule.manage` |
| `session_capacity_set_v1` | `schedule.manage` |
| `session_cancel_preview_v1` | `schedule.manage` |
| `session_cancel_apply_v1` | `schedule.manage` |
| `replacement_session_create_v1` | `schedule.manage` |
| `session_assignment_set_v1` | `schedule.manage` |
| `lesson_request_create_v1` | `request.write` |
| `lesson_request_withdraw_v1` | `request.write` |
| `lesson_request_reject_v1` | `request.resolve` |
| `lesson_request_offer_alternative_v1` | `request.resolve` |
| `lesson_request_accept_alternative_v1` | `request.write` |
| `lesson_request_approve_v1` | `request.resolve` |
| `reservation_list_v1` | `schedule.read` |
| `waitlist_join_v1` | `reservation.write` |
| `waitlist_leave_v1` | `reservation.write` |
| `seat_offer_accept_v1` | `reservation.write` |
| `seat_offer_reject_v1` | `reservation.write` |
| `attendance_get_v1` | `attendance.draft` |
| `attendance_mark_v1` | `attendance.draft` |
| `attendance_close_v1` | `attendance.close` |
| `attendance_correct_preview_v1` | `attendance.correct` |
| `attendance_correct_apply_v1` | `attendance.correct` |
| `products_list_v1` | `person.read` |
| `entitlement_extend_v1` | `entitlement.correct` |
| `credit_adjust_v1` | `entitlement.correct` |
| `negative_limit_set_v1` | `entitlement.correct` |
| `freeze_preview_v1` | `entitlement.correct` |
| `freeze_apply_v1` | `entitlement.correct` |
| `freeze_end_preview_v1` | `entitlement.correct` |
| `freeze_end_apply_v1` | `entitlement.correct` |
| `sale_terminate_preview_v1` | `entitlement.correct` |
| `sale_terminate_apply_v1` | `entitlement.correct` |
| `sale_refund_preview_v1` | `finance.refund` |
| `sale_refund_apply_v1` | `finance.refund` |
| `sale_change_preview_v1` | `entitlement.correct` |
| `sale_change_apply_v1` | `entitlement.correct` |
| `sale_renew_preview_v1` | `sale.write` |
| `sale_renew_apply_v1` | `sale.write` |
| `finance_get_v1` | `finance.read` |
| `collection_correct_preview_v1` | `finance.refund` |
| `collection_correct_apply_v1` | `finance.refund` |
| `instructor_agreement_publish_v1` | `earnings.manage` |
| `earnings_list_v1` | `earnings.read` |
| `instructor_payment_record_v1` | `earnings.manage` |
| `instructor_payment_correct_v1` | `earnings.manage` |
| `leads_list_v1` | `crm.daily` |
| `lead_save_v1` | `crm.daily` |
| `crm_activity_save_v1` | `crm.daily` |
| `trial_offer_create_v1` | `crm.daily` |
| `trial_registration_confirm_v1` | `crm.daily` |
| `lead_convert_v1` | `crm.daily` |
| `crm_followup_list_v1` | `crm.daily` |
| `segment_save_v1` | `crm.manage` |
| `automation_save_v1` | `crm.manage` |
| `notifications_list_v1` | `notification.self` |
| `notification_mark_read_v1` | `notification.self` |
| `notification_preferences_set_v1` | `notification.self` |
| `report_get_v1` | `report.read` |
| `report_export_start_v1` | `report.export` |
| `report_file_get_v1` | `report.export` |
| `import_upload_prepare_v1` | `import.execute` |
| `import_preview_v1` | `import.execute` |
| `import_apply_v1` | `import.execute` |
| `import_rows_list_v1` | `import.execute` |
| `subscription_upgrade_quote_v1` | `subscription.owner` |
| `subscription_downgrade_request_v1` | `subscription.owner` |
| `subscription_change_cancel_v1` | `subscription.owner` |
| `subscription_renewal_set_v1` | `subscription.owner` |
| `saas_grace_extend_v1` | `saas.operator` |
| `document_upload_prepare_v1` | `document.manage` |
| `document_version_publish_v1` | `document.manage` |
| `document_requirements_get_v1` | `person.read` |
| `document_accept_v1` | `document.accept` |
| `publication_set_v1` | `schedule.manage` |
| `public_calendar_get_v1` | `public.apply` |
| `public_application_submit_v1` | `public.apply` |
| `public_application_review_v1` | `crm.daily` |
| `operation_status_get_v1` | `account.self` |
| `preview_get_v1` | `account.self` |
| `job_status_get_v1` | `account.self` |
| `audit_list_v1` | `report.read` |
| `seat_offer_issue_v1` | `system.worker` |
| `seat_offer_expire_v1` | `system.worker` |
| `request_expire_v1` | `system.worker` |
| `outbox_deliver_v1` | `system.worker` |
| `reminder_schedule_v1` | `system.worker` |
| `automation_run_v1` | `system.worker` |
| `import_rows_process_v1` | `system.worker` |
| `report_build_v1` | `system.worker` |
| `privacy_execute_v1` | `system.worker` |
| `subscription_boundary_apply_v1` | `system.worker` |
| `class_assignment_set_v1` | `schedule.manage` |
| `attendance_block_v1` | `attendance.block` |
| `file_upload_complete_v1` | `account.self` |
| `negcredit_valuation_set_v1` | `product.manage` |

## Operasyonel kabul işleri

- Kalıcı ortak test backend’i ve frontend’in gerçek bağlantı kabulü.
- Dış e-posta sağlayıcısı/teslimi (yerel Mailpit kabulü vardır).
- Yük, yedek ve geri yükleme doğrulaması.
- Production hazırlığı ve ayrı dağıtım yetkisi. Main merge production izni değildir.

Bu maddeler ve yalnız sözleşme işlemleri kapanmış sayılmaz. Frontend tasarımı ayrı alan sahibindedir.
