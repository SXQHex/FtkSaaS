# FtkSaaS sıralı üretim kuyruğu

P04 kod kabulü kapandı: PR35/main `7b96d8866abb2c056d1b59a96afee0696a1187d6`, aday39630534660/main39633243405/CD39635569033 attempt2 success;52 migration/151 runtime/Edge5. Aktif dar takip CD migration transport düzeltmesidir; yeni kaynak kabulü bekler. Bot/deneme hedefi henüz yok: kullanıcı21 Ekim'de kurulumları hedef oluşana kadar erteledi. Aşağıdaki eski geliştirme snapshot'ları bu kapanışı değiştirmez. P05 başlamadı.

CD-01 **done**: PR32 kurulum + PR33 test fixture düzeltmesi sonrası kabul edilmiş main `0fabf3a4a605dd6be5a1d358c660021f59406e20`. [Main39588975421](https://github.com/SXQHex/FtkSaaS/actions/runs/39588975421) ve [ilk canlı CD39590690817/attempt2](https://github.com/SXQHex/FtkSaaS/actions/runs/39590690817/attempts/2) completed/success. CD receipt aynı source/main/run kabulünü bağlar;17 kontrol başarılı,49 migration içerik eşleşmesi,90 core tablo/RLS, anon/authenticated EXECUTE0, Edge backend-v1 v4 ACTIVE/verify_jwt=true. Gerçek Auth→Edge→RPC, oturum reddi ve fixture temizliği geçti; ayrıca uzak son0 hesap/0 Auth kullanıcısı/0 organizasyon doğrulandı. Envanter199/140 runtime/59 contract_only değişmedi. P04 CRM/public başvuru queued; başlamadı. Hosted worker işletimi, frontend, dış e-posta ve yük/restore bu kapanışla tamamlanmaz.

P03 **done**: [PR #30](https://github.com/SXQHex/FtkSaaS/pull/30), kabul edilmiş main `10710ffa90747a7e35c452c4c07ba59522f50ce3`. Son head2526347 / basece95a9d / tested merge1768fc2 / tree9ac328b aynı kaynak zinciridir. Bağımsız kaynak incelemesi PR review5594023911 içinde kayıtlı; [aday39527260056](https://github.com/SXQHex/FtkSaaS/actions/runs/39527260056) ve [aynı main39529992556](https://github.com/SXQHex/FtkSaaS/actions/runs/39529992556) completed/success.96 yapı +37 CI politika +27 DB +316 API =476 test düğümü; fail/skipped0,49 migration. Main13:18; aday13:34. Envanter199 sözleşme/140 runtime/59 contract_only,90 core tablo. Geliştirme/test Supabase aynı49 migration/Edge3 kaynağına eşitlendi; ayrı dokuz kontrollü Auth→Edge→RPC smoke ve fixture temizliği başarılı. P04 queued, başlamadı.

P02 **done**: [PR #28](https://github.com/SXQHex/FtkSaaS/pull/28), kabul edilmiş main `cc4878d09e45204dbc13ccfe1324b38b14548167`. Envanter **199 sözleşme / 133 runtime / 66 contract_only / 40 migration / 90 core tablo**. Son head `35816cc30a9b28e273e94e6cef86e8b402dbaad0` bağımsız incelemeden geçti; [hedefli39448566998](https://github.com/SXQHex/FtkSaaS/actions/runs/39448566998), [aday39455462417](https://github.com/SXQHex/FtkSaaS/actions/runs/39455462417) ve [aynı main39461804543](https://github.com/SXQHex/FtkSaaS/actions/runs/39461804543) completed/success. Full kapsam:96 sözleşme/yönetişim +37 CI politika +27 DB +309 API =469 test düğümü; fail/skipped0. Core, dört izole API shard, toplayıcı,40 migration, seed/health/advisors geçti. Main clean14:43; önceki43:33 hedefli koşu seri tüm-suite fallback kullandı, aynı çalışma profili değildir. Eski başarı yeni kaynağa taşınmaz.

Geliştirme/test Supabase `gwyprhenabtpkbojephw`, kabul edilmiş main `10710ffa90747a7e35c452c4c07ba59522f50ce3` kaynağına eşitlendi:49 migration, Edge backend-v1 sürüm3, verify_jwt=true,140 runtime API. Uzak smoke ve geçici fixture temizliği başarılı; ayrıntılar docs/remote-backend-setup.md içindedir. Hosted worker zamanlayıcısı, ortak tenant/kullanıcı kurulumu, frontend gerçek entegrasyonu, yük/restore, dış e-posta ve production kabulü ayrı açık kalır.

| Sıra | Teslim | İşlem | Durum | Kanıt / sonraki adım |
|---|---|---:|---|---|
| P00 | İlk CI ayrımı | — | done | #19; sonraki Action bakımı #23 kapalı |
| P01 | Talep, rezervasyon ve bekleme | 14 | done | #22; aday 39327134872 ve aynı main 39401570751 completed/success doğrulandı |
| CI-02 | Dört shard, bölüm/Draft/development, yalnız-belge kabulü | — | done | #25/#26; main0ade787 / 39425915555 completed/success; 462 test, 34 migration |
| P02 | Paket ve seans yaşam döngüsü | 15 | done | #28; main cc4878d /39461804543 completed/success;469 test,40 migration; hosted Edge2 eşitlendi |
| P03 | Finans ve eğitmen ödemeleri | 7 | done | #30; main10710ffa /39529992556 completed/success;476 test,49 migration; hosted Edge3 ve ayrı smoke başarılı |
| CD-01 | Geliştirme/test Supabase CD | — | done | PR32+33; main0fabf3a /39588975421 success; CD39590690817 attempt2 success,49 migration/Edge4/17 kontrol, fixture temiz |
| P04 | CRM ve public başvuru | 11 | done | PR35; main7b96d88, aday39630534660/main39633243405/CD39635569033 attempt2 success; hedef gerektiren kurulumlar kullanıcı kararıyla ertelendi |
| P05 | Belge, bildirim ve otomasyon | 13 | queued | P04 sonrası |
| P06 | Rapor, import ve işlem izleme | 13 | queued | P05 sonrası |
| P07 | Hesap, organizasyon ve abonelik yaşam döngüsü | 22 | queued | P06 sonrası |

## Ajanın kuyruk bakımı

1. Başlangıçta bu dosyayı, kaynak indeksini, güncel devir/kalan işleri ve envanteri oku. İlk açık satırı al; kapanmış promptu yeniden çalıştırma. Aynı teslimin ikinci branch/PR'sini mükerrer açma.
2. Başlarken durum/PR/head ve gerçek teknik engeli güncelle. Sözleşme adı var diye uygulanmış varsayma.
3. Durumlar: queued → in_progress → awaiting_candidate_clean → awaiting_main_clean → done. blocked gerçek bağımlılık için; failed test başarısızlığı için. Clean başlatıldığında aşağıdaki devir kuralıyla turu bitir.
4. Kaynak dondurulmadan önce kuyruk değişikliğini ilgili uygulama PR'sine dahil et. Çalışan clean'in head'ini sırf durum yazmak için değiştirme; run/head/base/sonraki eylemi sohbet kapanışında kaydet. Kullanıcı döndüğünde bu kanıtı kullan.
5. Uygulama PR'si incelemeye hazır olduğunda biten alt promptları kısa “uygulandı, main kabulü bekliyor” notuna indir; kalan API/görevleri aktif bırak. Kabul tamamlanmadan done veya promptun bütünü silindi durumu verme.
6. Merge ve aynı main kabulü doğrulanınca bitiren ajan aktif prompt gövdesini kaldırır, tabloyu done yapar; yalnız PR, kaynak/main SHA, CI ve kalan istisnaların kısa kapanış kaydını tutar. Bunu sonraki doğal kuyruk/uygulama commit'inde yapabilir; sırf kanıt yazmak için sonsuz belge commit/clean döngüsü kurma. Aradaki doğrulanmış kapanışı sohbette bildir; sonraki ajan kanıttan teyit edip kuyruğu eşitler.
7. Kısmi grupta tamamlananları çıkar, kalanları açık bırak. Başka gruptan zorunlu işlem öne alındıysa sahibini/kanıtını göster; sonraki grupta ikinci kez sayma.
8. Bitirilen promptun eski hali Git geçmişindedir. Tarihsel reports/ dosyalarını yeniden yazma. Bu sıra yeni ürün davranışı icat etme yetkisi değildir.

## Full clean sırasında kullanıcıya devir — 19 Ekim 2026 son talimatı

Bu kural önceki otomatik devam/CI izleme talimatlarını yalnız bekleme davranışı bakımından değiştirir; merge için başarılı kabul şartını kaldırmaz.

- Aday veya main full clean tetiklendiği/çalışmaya başladığı doğrulanınca run URL/ID, head SHA, base SHA ve test edilen merge SHA (uygunsa), PR, kuyruk adımı ve sonraki eylemi son durum mesajında paylaş; turu bitir.
- Full clean bitene kadar polling, sleep/wait döngüsü, log takibi, gh run watch, tarayıcı yenileme, hatırlatıcı/otomasyon veya arka planda izleyici başlatma. Aynı clean'i tekrar tetikleme. Kullanıcı sonucu getirene kadar üretim/merge devamını durdur.
- Tetikleme yanıtında run URL henüz yoksa workflow/PR/head ve tetikleme zamanını kaydet; bekleyerek run arama. Kullanıcı dönüşünde eşleştir.
- Kullanıcı “clean bitti/başarılı” dediğinde yeniden çalışmaya başla; bildirimi tek başına başarı kanıtı sayma. GitHub'dan o run'ın durumunu/sonucunu, güncel head/base ve kaynak bağlı kabulü bir kez doğrula.
- Run hâlâ çalışıyorsa yeniden izlemeye geçme; durumunu bildir ve turu bitir. Başarısızsa ilgili hatayı incele, odaklı düzeltme yap; kaynak değişince eski clean'i yeni kaynağa taşıma.
- Aday kabulü ve inceleme geçerliyse mevcut yetki kapsamında merge et. Main clean başlarsa yeniden aynı kullanıcıya devir kuralını uygula; main kabulü doğrulanmadan işi tamamlandı sayma.
- CI kendi kendine çalışmaya devam eder; duracak olan Work ajanının aktif izlemesidir. Bu talimat workflow iptal etme veya testleri atlama talimatı değildir.


## Ortak üretim promptu

20 Ekim son kullanıcı talimatı: her main birleşmesinin aynı kaynak kabulü doğrulandıktan sonra `gwyprhenabtpkbojephw` FtkSaaS **geliştirme/test** ortamını da o main ile eşitle. Önce migration geçmişi ve içerik eşleşmesini doğrula; yalnız eksik migration’ları sırasıyla uygula, değişen Edge bundle’ını yayımla, JWT/izin kapılarını koru; aynı içerik varsa yeniden kurulum yapmadan eşleşmeyi kaydet. Ardından uzak Auth→Edge→RPC smoke, RLS/EXECUTE ve advisors doğrulaması yap; kaynak SHA/migration/Edge sürümü/sonucu kaydet. Bu, ajanın teslim kapanış adımıdır; otomatik CD workflow’u kurulduğu anlamına gelmez. Production yetkisi değildir. Testler yalnız ayrılmış sentetik verilerle yapılır; mevcut gerçek veriyi reset etme. `npm run test:clean` loopback kabulünde kalır; hosted smoke onun yerine geçmez. Full clean çalışırken izleme/yayın devamı durur; kullanıcı dönüşünde gerçek main kabulü sonrası bu adıma geçilir.


Aşağıdaki kurallarla sıradaki açık teslimi uygula; kullanıcı her teslim için yeniden “devam” demek zorunda değildir. **Full clean bekleme noktasında kullanıcıya devir bunun açık istisnasıdır.**

- Bölümün Draft/development, açık son aday ve yalnız-belge kuralları için CI-2026-10-20 kararını uygula; kurulmuş otomasyonun güncel kaynakta bu kuralları koruduğunu doğrula.
- AGENTS.md ve docs/source-index.md okuma sırasını izle; güncel main SHA/CI, PR, ilgili sözleşme/DS kararları ve envanteri doğrula. Kaynak durumunu önceki sohbetten varsayma.
- Bağımlılık incelemesi → uygulama → hedefli test → bağımsız inceleme → açık son aday full clean → kullanıcıya devir → doğrulanmış merge → main clean → kullanıcıya devir → doğrulanmış kapanış.
- Rutin teknik karar/uygulama hatasını bağımsız çöz. Yalnız gerçek yeni ürün belirsizliğini somut senaryo/seçenek/etkiyle bildir; clean bekleme dışında bağımsız işleri sürdürebilirsin.
- Dar zorunlu bağımlılıkları gerekçeyle öne al; başka teslimin tamamını sessizce ekleme. Okuma/alan görünürlüğü/sürüm yolları olmadan yazmayı tamamlandı sayma.
- Worker dar sistem yetkisi/claim/lease/tekrar/sınırlı hata yolu kullansın. Kullanıcı aktöründen worker yetkisi türetme.
- Tenant/merkez/plan/rol, canlı yetki geri alma, idempotency, sürüm/stale preview, yarış ve geç hata rollback'i gerçek Auth→Edge→RPC ile doğrulansın.
- Önizleme/taslak iş sonucunu kesinleştirmesin; hak/para/hakediş geçmişi bağlı ters/fark hareketiyle korunsun.
- Yapısal test/mevcut regresyon/yeni davranış kabulü ayrı raporlansın. Yapılmayan runtime/pending vakayı passed yapma.
- Etkilenen sözleşme, üretilmiş tip/katalog/envanter, F01–F33, kalan işler, devir ve bu kuyruk aynı PR'de güncellensin; tarihsel raporlar korunur.
- Kullanıcının yedi teslim için branch/PR ve son aday inceleme/CI başarılıysa koşullu merge yetkisi geçerlidir. Yeni ürün kapsamı, repository yönetimi, frontend, production veya Resend yetkisi verilmez. Başarısız main kabulünde sonraki teslimi ilerletmeden çöz.
- İncelemeye sığmayan teslimi bağlantılı PR'lere böl; kısmi sonucu bütün grup tamamlandı diye sunma.

## Sıralı teslim promptları

### P01 — kapanış kaydı

14 API ve dar sistem worker zinciri PR #22 ile main'e alındı. Hedefli 39325878582 ve aday 39327134872 başarılıdır. Aynı main clean 39401570751 completed/success doğrulandı; P01 done, geçici kabul varsayımı kaldırıldı. Aktif uygulama promptu kaldırıldı; eski prompt Git geçmişindedir. Hosted/production worker işletimi ve P05 genel belge/bildirim işleri kapanmadı.

### CI-02 — kapanış kaydı

PR25 dört izole shard/belge kabulü/Draft-development politikasını kurdu; PR26 skipped optional serial ölçüm hatasını kapattı. Kaynak bazlı bağımsız incelemeler ve açık kurulum onayları alındı. Son aday39423719153 başarılı; aynı actual main0ade7877cc16fc121095decbc276f2fbc868607e / [39425915555](https://github.com/SXQHex/FtkSaaS/actions/runs/39425915555) completed/success: gerçek merge kanıtı, core/dört shard/toplayıcı ve 462 test, 34 migration, seed/health/advisors. CI-02 done; aktif uygulama promptu kaldırıldı. [Devir](ci02-handover.md), [ölçüm](ci-performance.md). Repository yönetim ayarları, production/Resend/frontend/yük-restore ve P02 geliştirmesi bu kapanışa dahil değildir.

### P02 — kapanış kaydı

15 API PR #28 ile kabul edilmiş main cc4878d09e45204dbc13ccfe1324b38b14548167 kaynağına birleşti. Son-head bağımsız inceleme, hedefli39448566998, tek son aday39455462417 ve aynı main39461804543 completed/success doğrulandı;469 test düğümü,40 migration, seed/health/advisors. Hosted geliştirme/test ortamı aynı migration/Edge kaynağına eşitlendi; uzak smoke ayrı geçti. P02 done; aktif prompt kaldırıldı, eski prompt Git geçmişindedir. P03 genel iadesinde immutable private.p02_sale_settlements ve önceki borç/alacak hareketleri zorunlu bağımlılıktır. Hosted worker işletimi, frontend, dış e-posta ve yük/restore kapanmadı.

### P03 — kapanış kaydı

Yedi API PR30 ile main10710ffa90747a7e35c452c4c07ba59522f50ce3 kaynağına alındı. Son head2526347 bağımsız incelemesi review5594023911 içinde kayıtlıdır; aday39527260056 ve aynı main39529992556 completed/success.476 test düğümü,49 migration, dört izole API shard ve kaynak bağlı toplayıcı geçti. Geliştirme/test Supabase49/49 migration içerik eşleşmesi,140 runtime API, Edge3/JWT ve ayrı dokuz kontrollü Auth→Edge→RPC smoke ile eşitlendi; sentetik fixture temizlendi. Aktif P03 promptu kaldırıldı; eski metin Git geçmişindedir. Bloklayıcı olmayan seçili hakediş doğrulama takip notu remaining-work.md içinde açık kalır. P04 queued; frontend, hosted worker işletimi, dış e-posta, yük/restore ve production açık kalır.

### P04 — kapanış kaydı ve operasyonel takip

11 API PR35 ile main7b96d8866abb2c056d1b59a96afee0696a1187d6 kaynağında kabul edildi; son inceleme, aday39630534660 ve aynı main39633243405 başarılı. CD39635569033 attempt2:52 migration, Edge5/JWT ve17 kontrol başarılı; sentetik fixture temiz. Aktif P04 ürün promptu kaldırıldı; eski metin Git geçmişindedir.

21 Ekim kullanıcı kararı: henüz başvuru alan adı/tenant/ürün/config hedefi yok; bot/gateway ve gerçek deneme kurulumu hedef oluşana kadar ertelenir, kapılar gevşetilmez. Kurulum yordamı p04-handover.md'dedir. Aktif dar takip CD migration transport düzeltmesidir; kaynak incelemesi, aday/main clean, exact-source trusted kurulum izni ve gerçek CD kabulü bekler. P05 bu takip kapanmadan başlatılmadı.

### P05 — Belge, bildirim ve otomasyon

Ortak üretim promptunu uygula. Durum: queued.

**Mevcut sözleşme API'leri (13):**

- `document_upload_prepare_v1`
- `document_version_publish_v1`
- `document_requirements_get_v1`
- `document_accept_v1`
- `file_upload_complete_v1`
- `notifications_list_v1`
- `notification_mark_read_v1`
- `notification_preferences_set_v1`
- `segment_save_v1`
- `automation_save_v1`
- `outbox_deliver_v1`
- `reminder_schedule_v1`
- `automation_run_v1`

**Görev ve kabul:**

Sürümlü belgeler işlem kapılarında uygulansın; uygulama içi bildirim ve izinli otomasyon gerçek worker yolunda çalışsın.
Upload hazırlığı hazır dosya değildir; dosya tamamlama/erişim kontrollerini bağla. Belge sürüm/kişi/zaman/işlem kanıtı korunsun; eski onay silinmesin, yeniden kabul noktası açık olsun. Rezervasyon/katılım tüketicilerini bağlamadan tamamlandı sayma.
İşlemsel bildirim ile isteğe bağlı hatırlatma/pazarlamayı ayır. Teslim hatası kesinleşmiş domain işini geri almasın; tekrar mükerrer kullanıcı sonucu üretmesin.
Org tanımı merkez operasyon yetkisi vermez; executor canlı rol/plan/merkez/zorunlu politika sınırlarını aşamaz. Business dışına otomasyon açma.
Dış e-posta/Resend yok. Dosya/bildirim/worker altyapısındaki eksik zorunlu bağımlılığı açık bildir.
Kabul: dosya→belge→onay→işlem kapısı; domain→outbox→inbox; hatırlatma/otomasyon tekrar/lease/hata kurtarma.

### P06 — Rapor, import ve işlem izleme

Ortak üretim promptunu uygula. Durum: queued.

**Mevcut sözleşme API'leri (13):**

- `report_get_v1`
- `report_export_start_v1`
- `report_file_get_v1`
- `import_upload_prepare_v1`
- `import_preview_v1`
- `import_apply_v1`
- `import_rows_list_v1`
- `import_rows_process_v1`
- `report_build_v1`
- `operation_status_get_v1`
- `preview_get_v1`
- `job_status_get_v1`
- `audit_list_v1`

**Görev ve kabul:**

Yetkili kullanıcı veri içe/dışa aktarabilsin; uzun veya sonucu belirsiz işi yeniden üretmeden izlesin.
Önceki teslim için zorunlu olup öne alınmış status/preview/job okumalarını yeniden geliştirme; gerçek durumunu doğrula.
Rapor/export güncel alan/merkez/plan yetkisine tabi olsun ve bütün yetkili filtreli sonucu kapsasın. Dosya linki yetki yerine geçmesin; audit hassas/başka tenant verisi açmasın.
Import eşleme/önizleme/doğrulama/satır hatasını tamamla; kişi ve açılış kredi/borçları ilgili modülde izlenebilir oluştur. Aynı kaynak/satır çift kayıt üretmesin, başarılı satırlar yeniden işlenmesin.
Worker dar yetki/claim/lease/sınırlı retry kullansın. Bağlantı kopması yeni iş başlatmasın. Sonuç okuması özgün işlemin güncel scope yetkisini denetlesin.
Kabul: upload→preview→apply→satır sonucu; rapor→worker→yetkili indirme; tekrar/hata kurtarma/ilgili iptal ve yetki geri alma.

### P07 — Hesap, organizasyon ve abonelik yaşam döngüsü

Ortak üretim promptunu uygula. Durum: queued.

**Mevcut sözleşme API'leri (22):**

- `account_profile_update_v1`
- `account_password_change_v1`
- `account_password_reset_request_v1`
- `account_access_revoke_v1`
- `account_link_remove_v1`
- `person_merge_preview_v1`
- `person_merge_approve_v1`
- `person_merge_apply_v1`
- `subscription_upgrade_quote_v1`
- `subscription_downgrade_request_v1`
- `subscription_change_cancel_v1`
- `subscription_renewal_set_v1`
- `saas_grace_extend_v1`
- `subscription_boundary_apply_v1`
- `account_delete_preview_v1`
- `account_delete_apply_v1`
- `organization_close_preview_v1`
- `organization_close_apply_v1`
- `organization_reopen_v1`
- `organization_delete_preview_v1`
- `organization_delete_apply_v1`
- `privacy_execute_v1`

**Görev ve kabul:**

Bu grubu bağımlılık sıralı üç PR'ye ayır.
A: account_profile_update/password_change/password_reset_request, account_access_revoke, account_link_remove, person_merge_preview/approve/apply. Canlı geri alma/oturum, yeniden bağlamada eski grantın canlanmaması ve etkilenen merkez onayları. Profil değişimi rol/iletişim yetkisini aşmasın.
B: subscription_upgrade_quote/downgrade_request/change_cancel/renewal_set, saas_grace_extend, subscription_boundary_apply. Kabul edilmiş fiyat farkı/dönem sonu düşürme/merkez seçimi/yenilememe/gecikme ayrımı; sayısal değer icat etme, aylık-yıllık dönüşüm ekleme, kaçırılmış otomasyonu topluca çalıştırma.
C: account_delete_preview/apply, organization_close_preview/apply/reopen/delete_preview/delete_apply, privacy_execute. Hesap silme, org kapatma, abonelik bitişi ve imha ayrı kalsın. Owner engelleri, reauth ve kapsam onayı uygulansın; borç/alacak/hukuki kanıt kendiliğinden silinmesin.
Saklama süreleri geçici/hukuk teyidi açık kalır. DB/dosya/rapor/geçici kopya/yedek gerçek imhası doğrulanmadan completed verme; eksik altyapıda partial/pending açık kalsın.
Dış e-posta sağlayıcısı gerektiren parola sıfırlama akışında erteleme sınırını aşma; mevcut güvenli test yolu ile dış teslim kanıtını ayır.
Kabul: eski oturumun reddi; abonelik sınır anları; kapatma/izinli geri dönüş; silme sonrası yeniden canlanmama/tenant izolasyonu.


