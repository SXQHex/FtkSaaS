# Kalan backend işleri

Hedefli39444715078 P02-A testini geçirdi; B/C iki hata yakaladı: etki işleminden önceki özgün yetki kapısı yeni credit/validity türlerini henüz tanımıyordu; kaynak fingerprint listesinde fiziksel olmayan collections adı vardı. Yeni39. migration özgün CM yetkisini ekliyor, cash_movements ve bağlı event/attendance kaynaklarını hashliyor. Eski35–37 migration değişmedi. Bütün15 API uygulama adayıdır; 133/66/39; yeni hedefli sonucu ve son inceleme bekliyor, passed/done değildir.


P02-D uygulaması eklendi; hedefli runtime kabulü bekliyor: sale_terminate/change/renew preview/apply. Sonlandırma serbest hakları kapatır; mevcut rezervasyon ve borç/finans geçmişi korunur. Değişimde bütün gelecek rezervasyonlar açık keep/cancel seçimiyle kapsanır; yeni hak yeterliliği rollback-only simülasyonla önizlenir. Sabit eski iade yöntemi önce borcu azaltır, tahsil edilmiş kalan öğrenci alacağına geçer; offset_minor açık mahsup, nakit iade yok. Immutable private.p02_sale_settlements alacağı ikinci kez üretmeyi engeller; P03 iadesi bunu ve debt/claim hareketlerini hesaba katmalıdır. Yenileme linked yeni satıştır; eski süre/kredi/kayıt taşınmaz, gap/overlap gösterilir, mevcut consumed→reserved deficit kapatma yolu yeniden kullanılır. 133 runtime / 66 contract_only / 38 migration; uygulama listesi15/15, hedefli test ve son inceleme açık. Draft/development korunuyor; aday full clean henüz yok.


P02-C uygulandı; hedefli runtime kabulü bekliyor: freeze_preview/apply ve freeze_end_preview/apply. Satış saat dilimindeki açık aralık, plan/ürün/max_days/çakışma/bağımlılık kontrolleri; eski rezervasyonlar aynı allocation ile korunur, dondurulan tarihte yeni hak kullanılamaz. Erken bitirme gerekçeli ve ileri tarihli; yalnız fiilî yerel günler kadar ücretsiz uzatma kalır, paid_days değişmez. 127 runtime / 72 contract_only / 37 migration. Kalan6 satış API açık; aday clean henüz yok.


P02-B uygulandı; hedefli runtime doğrulaması bekliyor: credit_adjust/entitlement_extend tam etki tokeniyle, actor/center/reason/change/dependency ve bütün etkilenen kayıt onayıyla atomik çalışır. reservation_impact_apply alternatif tek tüketim yoludur. Kredi düşüşü mevcut allocation/rezervasyonu iptal etmez; kullanılabilir yeni hak negatife düşse de yeni kayıt açılmaz. Uzatma açık ileri tarihli00:00 ve entitlement account sürümü ister; tarihi yoklama/hakediş üretmez. entitlements_get account/sale sürümü ve freeze okuması taşır. 123 runtime / 76 contract_only / 36 migration; kalan10 P02 API açık.


P02-A uygulaması PR #28 Draft/development dalında: session_cancel_preview/apply ve replacement_session_create eklendi (121 runtime / 78 contract_only / 35 migration). Önizleme aktör/merkez/token/bağımlılıkları; açık seans iptali hak serbest bırakma, bekleme/teklif kapama ve uygulama içi bildirimle atomiktir. Yerine seans yalnız linked yeni kayıttır. Yeni Auth→Edge→RPC negatif/replay/yarış/rollback testleri eklendi; runtime sonucu henüz doğrulanmadı. Kalan12 P02 API açık; bütün P02 bitmeden aday clean/merge yok.


P02 başladı: `feature/p02-package-session-lifecycle`, tek Draft/development PR. Başlangıç main f6afef4bdc4ef1bcbf37697ae771fef04a9fb455 / belge kabulü39440690219 başarılı; runtime tam kabulü0ade787 / 39425915555 ayrı kanıttır. Kuyruktaki15 API tamamlanmadan aday full clean/merge yok; geliştirme commitleri birikimli hedefli doğrulanır. Seans iptali/yerine seans → hak/koruma → dondurma/erken bitirme → sonlandırma/değişim/yenileme sırası; kabul edilmemiş ürün varsayımı yok. Uygulama ve yeni runtime kabulü henüz tamamlanmadı.

CI-02 tamamlandı: PR25 ve dar ölçüm düzeltmesi PR26, açık kaynak bazlı kurulum onaylarıyla main’e alındı. Tam kabul kaynağı `0ade7877cc16fc121095decbc276f2fbc868607e`; [main39425915555](https://github.com/SXQHex/FtkSaaS/actions/runs/39425915555) completed/success: gerçek merge ilişkisi + core + dört API shard + toplayıcı, 462 test düğümü (96 yapı + 37 CI politika + 27 DB + 302 API), sıfır fail/skipped; 34 migration, seed/health/advisors geçti. Main-binding artifact12266003219 source/run/attempt kanıtıdır. P01 ve CI-02 done; P02 son kullanıcı talimatıyla Draft/development olarak başladı. Yeni kaynak kabulü ayrıca doğrulanır.

P01 runtime kabul kaynağı main `7577b2f1873c6b1fcf83390bfa94a34374c44082`: **199 işlem / 118 çağrılabilir / 81 yalnız sözleşme / 34 migration**. [Tek devir](../contracts/00-FtkSaaS-yeni-sohbet-devir.md) gerçek hedefli/aday ve aynı main completed/success sonuçlarını gösterir. P01 PR #22 birleşti; eski A/B/C runtime ve merge bekleme notları güncel açık değildir. P01 ve CI-02 main kabulü tamamlandı; sonraki kaynak ayrıca doğrulanır.

## Aktif seri üretim

**CI-02 kapandı.** P02–P07 sırada; P02 Draft/development geliştirmesinde. [Tek kuyruk](production-queue.md) sıralama ve prompt kaynağıdır; [CI-2026-10-20](decisions/CI-2026-10-20.md) dört izole shard, Draft/development ve belge-only kabulünün gerçek main kabulünü ve kapanış kanıtlarını belirtir. Belge-only yolu main’e kuruldu; yeni kaynak kabulünün yerine eski başarı taşınmaz.

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

