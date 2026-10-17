# Kalan backend işleri

## Starter yoklama/koruma teslimi — güncel kapsam

[Starter devri](starter-attendance-protection-handover.md) zorunlu bağımlılıkları ve kalan tüketicileri tanımlar. 198 işlem / 89 canlı / 109 contract-only; 90 core tablo / 26 migration. Starter program → rezervasyon → etki/onay → korunan katılım → kapanış → gerekçeli düzeltme uygulanır. Ücretli finansal kapanış açıkça kapalı; başlangıç/belge ve diğer hak değişikliği tüketicileri pending. Son SHA’nın kanıtı PR’dedir; eski başarı taşınmaz.

Güncel geliştirme kapsamı: **89 çağrılabilir / 109 yalnız sözleşme**, 26 migration. [Takvim/seans/rezervasyon okuma devri](schedule-read-handover.md) üç okumanın yetki, UTC filtre ve cursor sınırlarını belirtir. Ürün okuması katalog sözleşmesiyle uygun satın alınmış hak seçimini karşılamaz; seans/kişi/sale bağlamı ve DTO aktarımı ayrı teslimdir. [Program/seans devri](program-session-handover.md) uygulanmış akış ve kalan anlaşma/entegrasyon sınırlarını açıklar. Son head CI bağımsız doğrulanır. Aşağıdaki PR #8 başlangıcı tarihsel kanıttır.

## Doğrulanmış başlangıç — 17 Ekim 2026

Kaynak main `b9bd9c110f0cf4a121eac6ef0752945de99b10ac`; [PR #8](https://github.com/SXQHex/FtkSaaS/pull/8) birleşmiş; [aynı SHA’nın main CI’ı](https://github.com/SXQHex/FtkSaaS/actions/runs/38993548576) başarılı. 22 migration, 181 test (12 sözleşme + 27 DB + 142 Auth/API); 184 operasyonun 65’i çalışan geliştirme uygulaması, 119’u yalnız sözleşme. Bu kanıt belirtilen kaynak içindir; sonraki commit’in CI sonucu ayrıca doğrulanır.

Uzak geliştirme/test Auth → Edge → RPC smoke [ayrı rapordadır](../reports/remote-backend-verification.json); 181 testin uzak projede tekrarı değildir. Geçici fixture temizlendi; ortak tenant/kullanıcı girişi sağlanmadı. Dış e-posta ertelendi; Resend entegrasyonu başlatılmayacak. Yük/restore ve frontend gerçek entegrasyon kabulü açık; production dağıtımı yok.

## DS öncelikli teslim sırası

1. Karar/DTO/izin/guard/sürüm-okuma aktarımı ve F01–F33 yapısal denetimleri korundu; gerçek davranış kanıtı ayrı izlenir.
2. Starter yoklama/hak kapanışı, politika/kişisel limit etkisi/onayı uygulandı. Otomatik başlangıç, belge ve diğer hak değişikliği tüketicileri açık.
3. Immutable anlaşma zinciri, yürürlük/başlamış seans snapshot’ı, ürün kimliği override ve mükerrer olmayan hakediş; gerçek Auth→Edge→RPC kabul.
4. Ayrı merkezler arası ledger, Owner/delege OM grant zinciri ve B onayında atomik ödeme/mahsup/bağlı düzeltme kesinleştirmesi. DS-OPEN-01 karar düzeyinde kapalı; DS-OPEN-02 son merkez yetki kararıyla karar düzeyinde kapalı; aynı hesap A/B yetkileri ayrı doğrulanarak iki adımı yapabilir. Fiziksel depolama/RPC/read/izolasyon ve adım kapsamlı audit bağımlılıkları açık.
5. Satış kapsam snapshot/değişim, gerekçeli backdate ve geçmiş açık kapatma; yeni ürün davranışı uydurulmadan uçtan uca kabul.

Hedef plan/koruma/anlaşma farkları 08 delivery_gaps içinde açıktır. [38 DS davranış senaryosu: 1 kanıtlı Starter, 37 pending](decision-sprint-handover.md) statik testten geçmiş kabul edilmez. [Main koruması](branch-protection-review.md) klasik API 403 nedeniyle doğrulanamıyor; gerekli yönetici ayarları teslim edilir, uygulanmış sayılmaz.

## Bağımlılık sırası

1. Uygunluk/politika dört API uygulandı; tüketici sınırları ve eksik iş akışları Claude devrindeki güncel bölümde açıkça ayrılır. Son PR SHA kabulü CI ile ayrıca doğrulanır.
2. Ürün kataloğu ile uygun satın alınmış paket/hak seçimi bağımlılık aktarımı; talep–bekleme–yer teklifi yaşam döngüleri; program/seans yedi komutu PR #12 ile uygulandı; DS uyarlaması ayrı açık teslimdir, anlaşma yayını ayrı bağımlılıktır. Üç program okuması uygulandı; sınırlar okuma devrindedir.
3. Starter yoklama/kapanış/düzeltme/blocked dar akışı uygulandı; otomatik başlangıç/belge tüketicisi, ücretli anlaşma/hakediş kapanışı açık.
4. Paket dondurma/uzatma/değişim/yenileme/sonlandırma ve finans düzeltme/iade önizleme–uygulama çiftleri.
5. Hesap erişimi geri alma, hesap/organizasyon kapanış/silme ve kişi birleştirme.
6. CRM, bildirim tercihleri, belgeler, raporlar, import ve worker işlemleri.

Her yeni grup: sözleşme/izin incelemesi → yeni migration → gerçek Auth/API kabulü (sınır, yetki, tekrar, yarış, rollback) → inceleme → temiz CI → main CI. Ürün kararında boşluk varsa teknik varsayımla yeni kural eklenmez.

## Yalnız sözleşme envanteri — güncel 109 işlem

| Modül | Kalan işlem |
|---|---:|
| M01 | 5 |
| M02 | 7 |
| M03 | 3 |
| M04 | 12 |
| M05 | 3 |
| M06 | 14 |
| M07 | 14 |
| M08 | 5 |
| M09 | 11 |
| M10 | 3 |
| M11 | 3 |
| M12 | 5 |
| M14 | 5 |
| X | 19 |

| İşlem | İzin |
|---|---|
| account_profile_update_v1 | account.self |
| account_password_change_v1 | account.self |
| account_password_reset_request_v1 | auth.recover |
| account_delete_preview_v1 | account.self |
| account_delete_apply_v1 | account.self |
| organization_close_preview_v1 | org.owner |
| organization_close_apply_v1 | org.owner |
| organization_reopen_v1 | org.owner |
| organization_delete_preview_v1 | org.owner |
| organization_delete_apply_v1 | org.owner |
| account_access_revoke_v1 | invite.student |
| account_link_remove_v1 | center.manage |
| person_merge_preview_v1 | person.merge |
| person_merge_approve_v1 | person.merge |
| person_merge_apply_v1 | person.merge |
| session_cancel_preview_v1 | schedule.manage |
| session_cancel_apply_v1 | schedule.manage |
| replacement_session_create_v1 | schedule.manage |
| lesson_request_create_v1 | request.write |
| lesson_request_withdraw_v1 | request.write |
| lesson_request_reject_v1 | request.resolve |
| lesson_request_offer_alternative_v1 | request.resolve |
| lesson_request_accept_alternative_v1 | request.write |
| lesson_request_approve_v1 | request.resolve |
| waitlist_join_v1 | reservation.write |
| waitlist_leave_v1 | reservation.write |
| seat_offer_accept_v1 | reservation.write |
| seat_offer_reject_v1 | reservation.write |
| products_list_v1 | person.read |
| entitlement_extend_v1 | entitlement.correct |
| credit_adjust_v1 | entitlement.correct |
| freeze_preview_v1 | entitlement.correct |
| freeze_apply_v1 | entitlement.correct |
| freeze_end_preview_v1 | entitlement.correct |
| freeze_end_apply_v1 | entitlement.correct |
| sale_terminate_preview_v1 | entitlement.correct |
| sale_terminate_apply_v1 | entitlement.correct |
| sale_refund_preview_v1 | finance.refund |
| sale_refund_apply_v1 | finance.refund |
| sale_change_preview_v1 | entitlement.correct |
| sale_change_apply_v1 | entitlement.correct |
| sale_renew_preview_v1 | sale.write |
| sale_renew_apply_v1 | sale.write |
| finance_get_v1 | finance.read |
| collection_correct_preview_v1 | finance.refund |
| collection_correct_apply_v1 | finance.refund |
| instructor_agreement_publish_v1 | earnings.manage |
| earnings_list_v1 | earnings.read |
| instructor_payment_record_v1 | earnings.manage |
| instructor_payment_correct_v1 | earnings.manage |
| leads_list_v1 | crm.daily |
| lead_save_v1 | crm.daily |
| crm_activity_save_v1 | crm.daily |
| trial_offer_create_v1 | crm.daily |
| trial_registration_confirm_v1 | crm.daily |
| lead_convert_v1 | crm.daily |
| crm_followup_list_v1 | crm.daily |
| segment_save_v1 | crm.manage |
| automation_save_v1 | crm.manage |
| notifications_list_v1 | notification.self |
| notification_mark_read_v1 | notification.self |
| notification_preferences_set_v1 | notification.self |
| report_get_v1 | report.read |
| report_export_start_v1 | report.export |
| report_file_get_v1 | report.export |
| import_upload_prepare_v1 | import.execute |
| import_preview_v1 | import.execute |
| import_apply_v1 | import.execute |
| import_rows_list_v1 | import.execute |
| subscription_upgrade_quote_v1 | subscription.owner |
| subscription_downgrade_request_v1 | subscription.owner |
| subscription_change_cancel_v1 | subscription.owner |
| subscription_renewal_set_v1 | subscription.owner |
| saas_grace_extend_v1 | saas.operator |
| document_upload_prepare_v1 | document.manage |
| document_version_publish_v1 | document.manage |
| document_requirements_get_v1 | person.read |
| document_accept_v1 | document.accept |
| publication_set_v1 | schedule.manage |
| public_calendar_get_v1 | public.apply |
| public_application_submit_v1 | public.apply |
| public_application_review_v1 | crm.daily |
| operation_status_get_v1 | account.self |
| preview_get_v1 | account.self |
| job_status_get_v1 | account.self |
| audit_list_v1 | report.read |
| seat_offer_issue_v1 | system.worker |
| seat_offer_expire_v1 | system.worker |
| request_expire_v1 | system.worker |
| outbox_deliver_v1 | system.worker |
| reminder_schedule_v1 | system.worker |
| automation_run_v1 | system.worker |
| import_rows_process_v1 | system.worker |
| report_build_v1 | system.worker |
| privacy_execute_v1 | system.worker |
| subscription_boundary_apply_v1 | system.worker |
| file_upload_complete_v1 | account.self |
| negcredit_valuation_set_v1 | product.manage |
| management_state_get_v1 | management.inspect |
| instructor_agreements_list_v1 | earnings.manage |
| settlement_movements_list_v1 | settlement.read |
| settlement_requests_list_v1 | settlement.read |
| settlement_request_get_v1 | settlement.read |
| settlement_request_submit_v1 | settlement.request |
| settlement_request_withdraw_v1 | settlement.request |
| settlement_request_decide_v1 | settlement.decide |
| settlement_authority_get_v1 | settlement.authority.inspect |
| settlement_delegation_set_v1 | settlement.delegation.manage |
| settlement_authority_set_v1 | settlement.authority.manage |

## Operasyonel kabul işleri

- Ortak test backend’i kuruldu; frontend’in gerçek bağlantı/iş akışı kabulü açık.
- Dış e-posta ertelendi; uygulanmış değildir, Resend entegrasyonu başlatılmayacak. Yerel Mailpit kabulü dış teslim kanıtı değildir.
- Yük, yedek ve geri yükleme doğrulaması.
- Production hazırlığı ve ayrı dağıtım yetkisi. Main merge production izni değildir.

Bu maddeler ve yalnız sözleşme işlemleri kapanmış sayılmaz. Frontend tasarımı ayrı alan sahibindedir.
