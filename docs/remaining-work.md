# Kalan backend işleri

Güncel kaynak ve CI: [doğrulanmış devir](../contracts/00-FtkSaaS-yeni-sohbet-devir.md). **199 işlem: 111 çağrılabilir, 88 yalnız sözleşme; 31 migration.** Önceki teslimlerde kapanmış işler burada yeniden açık ilan edilmez. Uygulama kapsamı [Starter](starter-attendance-protection-handover.md) ve [anlaşma/hakediş](instructor-earnings-handover.md) devirlerindedir.

[P01 devri](p01-handover.md): A katalog/hak okuması b8d9adc kaynağında hedefli/adayı geçti, merge edilmedi. B altı talep komutu ve sürüm/alternatif okuması uygulandı; yeni runtime kabulü bekliyor. Kalan C yedi API ve gerçek worker işletimidir. P01 aynı feature dalı/PR #22 içinde tamamlanır; commit başına hedefli test, bütün P01 sonunda toplu clean/merge. Main 24007212005d07938fb1265a9f42891f18d7fa09 / clean 39298247595 başarılıdır. Hosted eski smoke yeni kaynak kabulü değildir.

## Aktif seri üretim

[Üretim kuyruğu](production-queue.md), aşağıdaki mevcut envanteri P01–P07 sırasıyla gruplar ve ajan promptlarını taşır. İlk önkoşul P00 CI kabulüdür. Tamamlayan ajan kuyruktaki aktif promptu kısaltır/kaldırır ve bu envanterle eşitler. Full clean başladıktan sonra ajan izlemeyi bırakıp run/head/sonraki adımla kullanıcıya devreder; kullanıcı sonucunu getirince doğrular ve devam eder.

## DS öncelikli teslim sırası

1. Karar/DTO/izin/guard/sürüm-okuma aktarımı ve F01–F33 yapısal denetimleri korundu; gerçek davranış kanıtı ayrı izlenir.
2. Starter yoklama/hak kapanışı, politika/kişisel limit etkisi/onayı uygulandı. Otomatik başlangıç, belge ve diğer hak değişikliği tüketicileri açık.
3. Immutable anlaşma/hakediş ve dar gerçek başlangıç yolu uygulandı; son kaynak kabulü/inceleme/CI PR kanıtıyla değerlendirilir. Ödeme komutları açık.
4. Ayrı merkezler arası ledger, Owner/delege OM grant zinciri ve B onayında atomik ödeme/mahsup/bağlı düzeltme kesinleştirmesi. DS-OPEN-01 karar düzeyinde kapalı; DS-OPEN-02 son merkez yetki kararıyla karar düzeyinde kapalı; aynı hesap A/B yetkileri ayrı doğrulanarak iki adımı yapabilir. Fiziksel depolama, dokuz RPC/read ve adım kapsamlı audit uygulandı; [hesaplaşma devri](settlement-handover.md) ve son head temiz CI kabulü esas alınır.
5. Satış kapsam snapshot/değişim, gerekçeli backdate ve geçmiş açık kapatma; yeni ürün davranışı uydurulmadan uçtan uca kabul.

Kalan delivery_gaps ve vaka bazlı durumlar [08 makine sözleşmesi](../contracts/08-FtkSaaS-tip-ve-operasyon-sozlesmesi.json) ile [üretilmiş F01–F33 haritasından](feature-delivery.md) okunur; yapısal test başarısı davranış kabulü değildir. [Main koruması](branch-protection-review.md) klasik API 403 nedeniyle doğrulanamıyor; gerekli yönetici ayarları teslim edilir, uygulanmış sayılmaz.

## Bağımlılık sırası

1. Uygunluk/politika dört API uygulandı; tüketici sınırları ve eksik iş akışları Claude devrindeki güncel bölümde açıkça ayrılır. Son PR SHA kabulü CI ile ayrıca doğrulanır.
2. Ürün kataloğu ile uygun satın alınmış paket/hak seçimi bağımlılık aktarımı; talep–bekleme–yer teklifi yaşam döngüleri; program/seans yedi komutu PR #12 ile, Starter uyarlaması PR #14 ve anlaşma yayını PR #15 ile uygulandı; kalan tüketiciler ilgili devirlerde belirtilir. Üç program okuması uygulandı; sınırlar okuma devrindedir.
3. Starter ve Pro/Business yoklama/kapanış/bağlı düzeltme ile ücretli anlaşma/hakediş uygulandı. Otomatik başlangıç gözlemi, belge ve diğer hak değişikliği koruma tüketicileri açık.
4. Paket dondurma/uzatma/değişim/yenileme/sonlandırma ve finans düzeltme/iade önizleme–uygulama çiftleri.
5. Hesap erişimi geri alma, hesap/organizasyon kapanış/silme ve kişi birleştirme.
6. CRM, bildirim tercihleri, belgeler, raporlar, import ve worker işlemleri.

Her yeni grup: sözleşme/izin incelemesi → yeni migration → gerçek Auth/API kabulü (sınır, yetki, tekrar, yarış, rollback) → inceleme → temiz CI → main CI. Ürün kararında boşluk varsa teknik varsayımla yeni kural eklenmez.

## Yalnız sözleşme envanteri — güncel 88 işlem

| Modül | Kalan işlem |
|---|---:|
| M01 | 5 |
| M02 | 7 |
| M03 | 3 |
| M04 | 6 |
| M05 | 3 |
| M06 | 12 |
| M07 | 5 |
| M08 | 2 |
| M09 | 11 |
| M10 | 3 |
| M11 | 3 |
| M12 | 5 |
| M14 | 5 |
| X | 18 |

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
| waitlist_join_v1 | reservation.write |
| waitlist_leave_v1 | reservation.write |
| seat_offer_accept_v1 | reservation.write |
| seat_offer_reject_v1 | reservation.write |
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

## Operasyonel kabul işleri

- Ortak test backend’i kuruldu; frontend’in gerçek bağlantı/iş akışı kabulü açık.
- Dış e-posta ertelendi; uygulanmış değildir, Resend entegrasyonu başlatılmayacak. Yerel Mailpit kabulü dış teslim kanıtı değildir.
- Yük, yedek ve geri yükleme doğrulaması.
- Production hazırlığı ve ayrı dağıtım yetkisi. Main merge production izni değildir.

Bu maddeler ve yalnız sözleşme işlemleri kapanmış sayılmaz. Frontend tasarımı ayrı alan sahibindedir.

[P01-A devri](p01-handover.md): katalog/seans bağlamlı satın alınmış hak okuması; yeni kaynak kabulü ve kalan talep/bekleme/worker akışı açık.
