# Kalan backend işleri

P04 **done (kod ve kaynak kabulü)**: [PR35](https://github.com/SXQHex/FtkSaaS/pull/35), kabul edilmiş main `7b96d8866abb2c056d1b59a96afee0696a1187d6`;199 sözleşme/151 runtime/48 contract_only,52 migration/90 core tablo. Son head55c23dd, base920cdbb, tested merge901c64a, treee2011a6 kaynak zinciri; bağımsız son kaynak incelemesi ve [aday39630534660](https://github.com/SXQHex/FtkSaaS/actions/runs/39630534660) ile [aynı main39633243405](https://github.com/SXQHex/FtkSaaS/actions/runs/39633243405) completed/success doğrulandı. [CD39635569033 attempt2](https://github.com/SXQHex/FtkSaaS/actions/runs/39635569033/attempts/2) success:52/52 içerik eşleşmesi, Edge5 ACTIVE/verify_jwt=true,17 kontrol ve sentetik fixture temizliği. İlk CD'deki CLI migration hatası aşağıdaki operasyonel takipten ayrıdır; ikinci denemede eksik migration kalmadığı için o yol sınanmadı.

21 Ekim operasyonel takip: kullanıcı henüz bot/deneme hedefi olmadığını seçti; alan adı/tenant/ürün/süre/tekrar limiti uydurulmaz, bu kurulumlar ve gerçek sağlayıcı kabulü hedef oluşana kadar ertelendi. Signed ingress yardımcısı ve açık değerli deneme SQL hazırlayıcısı kaynakta var; canlı sağlayıcı/gateway kurulu diye sunulmaz. CD için atomik Management API migration yolu ve kalıcı iz bırakmayan gerçek SQL/history/rollback probe'u hazırlanıyor; yeni aday/main/CD kabulü ve exact-source trusted kurulum yetkisi henüz yoktur. P05 başlamadı. [P04 devri](p04-handover.md) kurulum sınırını açıklar. Aşağıdaki P03/CD-01 kayıtları tarihsel snapshot'tır.

CD-01 **done**: PR32 kurulum + PR33 test fixture düzeltmesi sonrası kabul edilmiş main `0fabf3a4a605dd6be5a1d358c660021f59406e20`. [Main39588975421](https://github.com/SXQHex/FtkSaaS/actions/runs/39588975421) ve [ilk canlı CD39590690817/attempt2](https://github.com/SXQHex/FtkSaaS/actions/runs/39590690817/attempts/2) completed/success. CD receipt aynı source/main/run kabulünü bağlar;17 kontrol başarılı,49 migration içerik eşleşmesi,90 core tablo/RLS, anon/authenticated EXECUTE0, Edge backend-v1 v4 ACTIVE/verify_jwt=true. Gerçek Auth→Edge→RPC, oturum reddi ve fixture temizliği geçti; ayrıca uzak son0 hesap/0 Auth kullanıcısı/0 organizasyon doğrulandı. Envanter199/140 runtime/59 contract_only değişmedi. P04 CRM/public başvuru queued; başlamadı. Hosted worker işletimi, frontend, dış e-posta ve yük/restore bu kapanışla tamamlanmaz.

P03 **done**: [PR #30](https://github.com/SXQHex/FtkSaaS/pull/30), kabul edilmiş main `10710ffa90747a7e35c452c4c07ba59522f50ce3`. Son head2526347 / basece95a9d / tested merge1768fc2 / tree9ac328b aynı kaynak zinciridir. Bağımsız kaynak incelemesi PR review5594023911 içinde kayıtlı; [aday39527260056](https://github.com/SXQHex/FtkSaaS/actions/runs/39527260056) ve [aynı main39529992556](https://github.com/SXQHex/FtkSaaS/actions/runs/39529992556) completed/success.96 yapı +37 CI politika +27 DB +316 API =476 test düğümü; fail/skipped0,49 migration. Main13:18; aday13:34. Envanter199 sözleşme/140 runtime/59 contract_only,90 core tablo. Geliştirme/test Supabase aynı49 migration/Edge3 kaynağına eşitlendi; ayrı dokuz kontrollü Auth→Edge→RPC smoke ve fixture temizliği başarılı. P04 queued, başlamadı.

P02 **done**: [PR #28](https://github.com/SXQHex/FtkSaaS/pull/28), kabul edilmiş main `cc4878d09e45204dbc13ccfe1324b38b14548167`. Envanter **199 sözleşme / 133 runtime / 66 contract_only / 40 migration / 90 core tablo**. Son head `35816cc30a9b28e273e94e6cef86e8b402dbaad0` bağımsız incelemeden geçti; [hedefli39448566998](https://github.com/SXQHex/FtkSaaS/actions/runs/39448566998), [aday39455462417](https://github.com/SXQHex/FtkSaaS/actions/runs/39455462417) ve [aynı main39461804543](https://github.com/SXQHex/FtkSaaS/actions/runs/39461804543) completed/success. Full kapsam:96 sözleşme/yönetişim +37 CI politika +27 DB +309 API =469 test düğümü; fail/skipped0. Core, dört izole API shard, toplayıcı,40 migration, seed/health/advisors geçti. Main clean14:43; önceki43:33 hedefli koşu seri tüm-suite fallback kullandı, aynı çalışma profili değildir. Eski başarı yeni kaynağa taşınmaz.

Geliştirme/test Supabase `gwyprhenabtpkbojephw`, kabul edilmiş main `0fabf3a4a605dd6be5a1d358c660021f59406e20` kaynağına otomatik CD ile eşitlendi:49 migration, Edge backend-v1 sürüm4, verify_jwt=true,140 runtime API. Uzak smoke ve geçici fixture temizliği başarılı; ayrıntılar docs/remote-backend-setup.md içindedir. Hosted worker zamanlayıcısı, ortak tenant/kullanıcı kurulumu, frontend gerçek entegrasyonu, yük/restore, dış e-posta ve production kabulü ayrı açık kalır.

## Aktif seri üretim

**P01, CI-02, P02, P03 ve P04 kod kabulü kapandı.** P04 PR35 aynı main clean ve uzak eşitlemeyle tamamlandı. Aktif dar takip CD migration transport düzeltmesidir; P04 canlı bot/deneme kurulumu kullanıcı hedefi oluşana kadar ertelendi. P05–P07 toplam48 contract_only işlem sırada. [Tek kuyruk](production-queue.md) sıralama ve prompt kaynağıdır; [CI-2026-10-20](decisions/CI-2026-10-20.md) dört izole shard, Draft/development ve belge-only kabulünün gerçek main kabulünü ve kapanış kanıtlarını belirtir. Belge-only yolu main’e kuruldu; yeni kaynak kabulünün yerine eski başarı taşınmaz.

[P01 devri](p01-handover.md): katalog/hak okuması, talep/alternatif/onay, bekleme/teklif/expiry ve gerçek dar worker döngüsü uygulandı. Genel belge upload/yayın/kabul ve bildirim API'leri P05'te açıktır; mevcut yayımlanmış rezervasyon gerekliliklerinin dar tüketicisi bunları kapatmaz. Hosted worker provisioning/işletim kabulü CI'daki gerçek CLI/loop testinden ayrıdır.

## DS öncelikli teslim sırası

1. Karar/DTO/izin/guard/sürüm-okuma aktarımı ve F01–F33 yapısal denetimleri korundu; gerçek davranış kanıtı ayrı izlenir.
2. Starter yoklama/hak kapanışı, politika/kişisel limit etkisi/onayı uygulandı. Otomatik başlangıç, belge ve diğer hak değişikliği tüketicileri açık.
3. Immutable anlaşma/hakediş ve dar gerçek başlangıç yolu uygulandı; son kaynak kabulü/inceleme/CI PR kanıtıyla değerlendirilir. P03 ödeme komutları PR30 ve aynı main39529992556 kabulüyle tamamlandı.
4. Ayrı merkezler arası ledger, Owner/delege OM grant zinciri ve B onayında atomik ödeme/mahsup/bağlı düzeltme kesinleştirmesi. DS-OPEN-01 karar düzeyinde kapalı; DS-OPEN-02 son merkez yetki kararıyla karar düzeyinde kapalı; aynı hesap A/B yetkileri ayrı doğrulanarak iki adımı yapabilir. Fiziksel depolama, dokuz RPC/read ve adım kapsamlı audit uygulandı; [hesaplaşma devri](settlement-handover.md) ve son head temiz CI kabulü esas alınır.
5. Satış kapsam snapshot/değişim, gerekçeli backdate ve geçmiş açık kapatma; yeni ürün davranışı uydurulmadan uçtan uca kabul.

Kalan delivery_gaps ve vaka bazlı durumlar [08 makine sözleşmesi](../contracts/08-FtkSaaS-tip-ve-operasyon-sozlesmesi.json) ile [üretilmiş F01–F33 haritasından](feature-delivery.md) okunur; yapısal test başarısı davranış kabulü değildir. [Main koruması](branch-protection-review.md) klasik API 403 nedeniyle doğrulanamıyor; gerekli yönetici ayarları teslim edilir, uygulanmış sayılmaz.

## Bağımlılık sırası

1. Uygunluk/politika dört API uygulandı; tüketici sınırları ve eksik iş akışları Claude devrindeki güncel bölümde açıkça ayrılır. Son PR SHA kabulü CI ile ayrıca doğrulanır.
2. Ürün kataloğu, seans bağlamında uygun satın alınmış hak seçimi ve talep–bekleme–yer teklifi yaşam döngüleri P01 PR #22 ile uygulandı; program/seans yedi komutu PR #12 ile, Starter uyarlaması PR #14 ve anlaşma yayını PR #15 ile uygulandı; kalan tüketiciler ilgili devirlerde belirtilir. Üç program okuması uygulandı; sınırlar okuma devrindedir.
3. Starter ve Pro/Business yoklama/kapanış/bağlı düzeltme ile ücretli anlaşma/hakediş uygulandı. Otomatik başlangıç gözlemi, belge ve diğer hak değişikliği koruma tüketicileri açık.
4. P02 paket dondurma/uzatma/değişim/yenileme/sonlandırma tamamlandı; P03 finans düzeltme/iade çiftleri tamamlandı; genel iade private.p02_sale_settlements ve önceki borç/alacak hareketlerini tüketerek çift alacağı engelliyor.
5. Hesap erişimi geri alma, hesap/organizasyon kapanış/silme ve kişi birleştirme.
6. CRM, bildirim tercihleri, belgeler, raporlar, import ve worker işlemleri.

Her yeni runtime/CI grubu: sözleşme/izin incelemesi → gerekli yeni migration → geliştirmede hedefli gerçek Auth/API kabulü (sınır, yetki, tekrar, yarış, rollback) → son inceleme → açık aday full clean → merge → main full clean. Güvenli yalnız-belge kabul yolu CI-02 ile kuruldu; full clean’den ayrı kaynak bağlı kabul kullanır. Ürün kararında boşluk varsa teknik varsayımla yeni kural eklenmez.

## P03 bağımsız inceleme takip notu

Bloklayıcı sayılmayan doğrulama iyileştirmesi: instructor_payment_record_v1 tutarı karşılandıktan sonra kullanılmayan trailing earning_ids satırlarının kişi/merkez/para birimi kontrolü atlanabiliyor. Fiilen yazılan allocation’lar kapsamlıdır; inceleme başka kapsama yazma veya para sızıntısı bulmadı. Tüm seçili listeyi allocation’dan önce doğrula ve karışık kapsamlı kullanılmayan son ID regresyonu ekle. Kaynak review5594023911; P03 kabulünü veya diğer59 contract_only API’yi değiştirmez. Henüz düzeltilmiş sayılmaz.

## Yalnız sözleşme envanteri — 48 işlem

Kabul edilmiş main snapshot’ı140/59’dur; bu geliştirme dalı151 runtime/48 contract_only taşır. Aşağıdaki liste yalnız P05–P07 işlemleridir; P04 kabulü bekler.

| Teslim | Kalan işlem |
|---|---:|
| P04 | 0 (CI kabulü bekler) |
| P05 | 13 |
| P06 | 13 |
| P07 | 22 |

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


## Geliştirme CI süresi

P02 kaynak modülleri hedefli profil haritasında tanımlı olmadığı için39448566998 güvenli fallback ile15 API suite’inin tamamını seri çalıştırdı (43:33). Dar ve kanıtlı P02 seçici profili ayrı CI bakımı olarak açıktır; güvenilir politika kurulumu için önceki tek seferlik izinler yeniden kullanılamaz. Test kapsamını azaltmak veya hosted smoke’u full clean yerine geçirmek çözüm değildir.
