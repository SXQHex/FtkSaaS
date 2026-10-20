# Kalan backend işleri

CI-02 geliştirmesi `ci/ci02-source-bound-shards` dalında: başlangıç main `d544efe9f88f34edd7d6ce3055ed46d291a55f2c`, main run 39408606736 kaynak kanıtı adımında başarısız; test çalışmadı. P01 done kalır. Dar belge sınıflandırması/PR24 renderer AST kanıtı, ayrı belge kabulü ve koşullu cleanup uygulandı; yeni kaynak hedefli/uzak kabulü ve güvenilir politika kurulumu bekliyor. Dört shard henüz bu dilimde uygulanmadı; P02 başlamaz.

Güncel kaynak main `7577b2f1873c6b1fcf83390bfa94a34374c44082`: **199 işlem / 118 çağrılabilir / 81 yalnız sözleşme / 34 migration**. [Tek devir](../contracts/00-FtkSaaS-yeni-sohbet-devir.md) gerçek hedefli/aday ve aynı main completed/success sonuçlarını gösterir. P01 PR #22 birleşti; eski A/B/C runtime ve merge bekleme notları güncel açık değildir. P01 main kabulü tamamlandı; sonraki CI-02 kaynağı ayrıca doğrulanacaktır.

## Aktif seri üretim

Önce **CI-02**, ardından P02–P07. [Tek kuyruk](production-queue.md) sıralama ve prompt kaynağıdır; [CI-2026-10-20](decisions/CI-2026-10-20.md) dört izole shard, Draft/development ve belge-only kabulünün henüz uygulanmamış olduğunu belirtir. Belge-only merge/main clean istisnası workflow'a aktarılmadan etkin sayılmaz.

[P01 devri](p01-handover.md): katalog/hak okuması, talep/alternatif/onay, bekleme/teklif/expiry ve gerçek dar worker döngüsü uygulandı. Genel belge upload/yayın/kabul ve bildirim API'leri P05'te açıktır; mevcut yayımlanmış rezervasyon gerekliliklerinin dar tüketicisi bunları kapatmaz. Hosted worker provisioning/işletim kabulü CI'daki gerçek CLI/loop testinden ayrıdır.

## DS öncelikli teslim sırası

1. Karar/DTO/izin/guard/sürüm-okuma aktarımı ve F01–F33 yapısal denetimleri korundu; gerçek davranış kanıtı ayrı izlenir.
2. Starter yoklama/hak kapanışı, politika/kişisel limit etkisi/onayı uygulandı. Otomatik başlangıç, belge ve diğer hak değişikliği tüketicileri açık.
3. Immutable anlaşma/hakediş ve dar gerçek başlangıç yolu uygulandı; son kaynak kabulü/inceleme/CI PR kanıtıyla değerlendirilir. Ödeme komutları açık.
4. Ayrı merkezler arası ledger, Owner/delege OM grant zinciri ve B onayında atomik ödeme/mahsup/bağlı düzeltme kesinleştirmesi. DS-OPEN-01 karar düzeyinde kapalı; DS-OPEN-02 son merkez yetki kararıyla karar düzeyinde kapalı; aynı hesap A/B yetkileri ayrı doğrulanarak iki adımı yapabilir. Fiziksel depolama, dokuz RPC/read ve adım kapsamlı audit uygulandı; [hesaplaşma devri](settlement-handover.md) ve son head temiz CI kabulü esas alınır.
5. Satış kapsam snapshot/değişim, gerekçeli backdate ve geçmiş açık kapatma; yeni ürün davranışı uydurulmadan uçtan uca kabul.

Kalan delivery_gaps ve vaka bazlı durumlar [08 makine sözleşmesi](../contracts/08-FtkSaaS-tip-ve-operasyon-sozlesmesi.json) ile [üretilmiş F01–F33 haritasından](feature-delivery.md) okunur; yapısal test başarısı davranış kabulü değildir. [Main koruması](branch-protection-review.md) klasik API 403 nedeniyle doğrulanamıyor; gerekli yönetici ayarları teslim edilir, uygulanmış sayılmaz.

## Bağımlılık sırası

1. Uygunluk/politika dört API uygulandı; tüketici sınırları ve eksik iş akışları Claude devrindeki güncel bölümde açıkça ayrılır. Son PR SHA kabulü CI ile ayrıca doğrulanır.
2. Ürün kataloğu, seans bağlamında uygun satın alınmış hak seçimi ve talep–bekleme–yer teklifi yaşam döngüleri P01 PR #22 ile uygulandı; program/seans yedi komutu PR #12 ile, Starter uyarlaması PR #14 ve anlaşma yayını PR #15 ile uygulandı; kalan tüketiciler ilgili devirlerde belirtilir. Üç program okuması uygulandı; sınırlar okuma devrindedir.
3. Starter ve Pro/Business yoklama/kapanış/bağlı düzeltme ile ücretli anlaşma/hakediş uygulandı. Otomatik başlangıç gözlemi, belge ve diğer hak değişikliği koruma tüketicileri açık.
4. Paket dondurma/uzatma/değişim/yenileme/sonlandırma ve finans düzeltme/iade önizleme–uygulama çiftleri.
5. Hesap erişimi geri alma, hesap/organizasyon kapanış/silme ve kişi birleştirme.
6. CRM, bildirim tercihleri, belgeler, raporlar, import ve worker işlemleri.

Her yeni runtime/CI grubu: sözleşme/izin incelemesi → gerekli yeni migration → geliştirmede hedefli gerçek Auth/API kabulü (sınır, yetki, tekrar, yarış, rollback) → son inceleme → açık aday full clean → merge → main full clean. Güvenli yalnız-belge kabul yolu CI-02 içinde ayrıca uygulanacaktır. Ürün kararında boşluk varsa teknik varsayımla yeni kural eklenmez.

## Yalnız sözleşme envanteri — güncel 81 işlem

| Modül | Kalan işlem |
|---|---:|
| M01 | 5 |
| M02 | 7 |
| M03 | 3 |
| M04 | 2 |
| M05 | 3 |
| M06 | 12 |
| M07 | 5 |
| M08 | 2 |
| M09 | 11 |
| M10 | 3 |
| M11 | 3 |
| M12 | 5 |
| M14 | 5 |
| X | 15 |

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

[P01 devri](p01-handover.md): uygulama main’de; gerçek main sonucu ve hosted worker işletim sınırı güncel devirde ayrıdır.

