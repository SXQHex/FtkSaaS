# FtkSaaS sıralı üretim kuyruğu

## Şimdi yapılacak iş — 20 Ekim 2026

P01 PR #22 main `7577b2f1873c6b1fcf83390bfa94a34374c44082` ile birleşti. Son hedefli ve aday clean başarılıdır; main clean yalnız bu belge eşitlemesinde kullanıcı kararıyla başarılı varsayılır, gerçek sonuç/hata takibi BackendCoder'dadır. [Kaynak ve kanıt](../contracts/00-FtkSaaS-yeni-sohbet-devir.md), [P01 devri](p01-handover.md).

Güncel envanter **199 / 118 çağrılabilir / 81 contract_only / 34 migration**. Başlangıçtaki 95 sözleşme-only işlemin 14'ü P01 ile uygulandı; kalan P02–P07 toplamı 81'dir. Sayılar ürün tamamlanma yüzdesi değildir.

| Sıra | Teslim | İşlem | Durum | Kanıt / sonraki adım |
|---|---|---:|---|---|
| P00 | İlk CI ayrımı | — | done | #19; sonraki Action bakımı #23 kapalı |
| P01 | Talep, rezervasyon ve bekleme | 14 | merged_main_acceptance_assumed | #22; aday 39327134872 başarılı; main 39401570751 kullanıcı varsayımı, doğrulanmış başarı değil |
| CI-02 | Dört shard, bölüm/Draft/development, yalnız-belge kabulü | — | queued | Sıradaki iş; [karar ve kabul](decisions/CI-2026-10-20.md); uygulama BackendCoder |
| P02 | Paket ve seans yaşam döngüsü | 15 | queued | CI-02 kabulü ve P01 gerçek hata kontrolünden sonra |
| P03 | Finans ve eğitmen ödemeleri | 7 | queued | P02 sonrası |
| P04 | CRM ve public başvuru | 11 | queued | P03 sonrası |
| P05 | Belge, bildirim ve otomasyon | 13 | queued | P04 sonrası |
| P06 | Rapor, import ve işlem izleme | 13 | queued | P05 sonrası |
| P07 | Hesap, organizasyon ve abonelik yaşam döngüsü | 22 | queued | P06 sonrası |

## Ajanın kuyruk bakımı

1. Başlangıçta bu dosyayı, kaynak indeksini, güncel devir/kalan işleri ve envanteri oku. İlk açık satırı al; kapanmış promptu yeniden çalıştırma. Aynı teslimin ikinci branch/PR'sini mükerrer açma.
2. Başlarken durum/PR/head ve gerçek teknik engeli güncelle. Sözleşme adı var diye uygulanmış varsayma.
3. Durumlar: queued → in_progress → awaiting_candidate_clean → awaiting_main_clean → done. P01 için yalnız bu belge eşitlemesinde merged_main_acceptance_assumed kullanılır; gerçek başarılı sonuç veya hata BackendCoder tarafından sonraki doğal commit’te eşitlenir. Aynı SHA/run completed/success ise P01 done yapılır ve geçici kabul-varsayımı ifadeleri güncel durumdan çıkarılır; yeni clean tetiklenmez. blocked gerçek bağımlılık için; failed test başarısızlığı için. Clean başlatıldığında aşağıdaki devir kuralıyla turu bitir.
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

Aşağıdaki kurallarla sıradaki açık teslimi uygula; kullanıcı her teslim için yeniden “devam” demek zorunda değildir. **Full clean bekleme noktasında kullanıcıya devir bunun açık istisnasıdır.**

- Bölümün Draft/development, açık son aday ve yalnız-belge kuralları için CI-2026-10-20 kararını uygula; otomasyonun henüz kurulmadığını kontrol et.
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

14 API ve dar sistem worker zinciri PR #22 ile main'e alındı. Hedefli 39325878582 ve aday 39327134872 başarılıdır. Main 39401570751 bu belge görevinde kullanıcı kararıyla başarılı varsayılmıştır; gerçek sonuç BackendCoder sorumluluğundadır. Aktif uygulama promptu kaldırıldı; eski prompt Git geçmişindedir. Hosted/production worker işletimi ve P05 genel belge/bildirim işleri kapanmadı.

### CI-02 — sıradaki üretim promptu

[CI-2026-10-20](decisions/CI-2026-10-20.md) kararını, [CI politikasındaki](ci-policy.md) uygulama farklarını ve mevcut PR'leri kontrol et; mükerrer dal açma. P01 gerçek main sonucunu bir kez doğrula; hata varsa önce çöz. Ayrı CI PR'sinde dört izole shard, eksiksiz envanter ve kaynak bağlı sonuç toplayıcıyı; Draft/development engeli ve açık aday tetiklemesini; güvenli yalnız-belge PR/main kabulünü uygula. Runtime/CI karma farkı, bilinmeyen yol, rename/silme, head/base değişimi ve eksik/skipped/başarısız shard negatiflerini doğrula. Aynı kaynak seri/parçalı kapsamı ve gerçek süre/runner dakikasını ölç. Güvenilir workflow kurulumu ve normal kapı korunur; repository yönetim ayarı yetkisi varsayılmaz. Yaşayan belgeleri her biten dilimde eşitle. Son aday/main full clean başlayınca kullanıcıya devret; polling yapma. CI-02 kapanmadan P02'ye geçme. Frontend/production/Resend yok.

### P02 — Paket ve seans yaşam döngüsü

Ortak üretim promptunu uygula. Durum: queued.

**Mevcut sözleşme API'leri (15):**

- `session_cancel_preview_v1`
- `session_cancel_apply_v1`
- `replacement_session_create_v1`
- `entitlement_extend_v1`
- `credit_adjust_v1`
- `freeze_preview_v1`
- `freeze_apply_v1`
- `freeze_end_preview_v1`
- `freeze_end_apply_v1`
- `sale_terminate_preview_v1`
- `sale_terminate_apply_v1`
- `sale_change_preview_v1`
- `sale_change_apply_v1`
- `sale_renew_preview_v1`
- `sale_renew_apply_v1`

**Görev ve kabul:**

Yönetici paket ve seans değişikliklerini önizleyip geçmişi ve kesin rezervasyon korumasını bozmadan uygulayabilsin.
Son DS kararları eski çelişen hükümlerden üstündür. Korunan rezervasyonu, açık yönetici iptalini ve yeni kayıt koşullarını ayır. Eski freeze/terminate metninden sessiz otomatik iptal yetkisi çıkarma.
Uzatma, erken dondurma bitişi, bağlantılı yeni satışla değişim ve yenilemenin kabul edilmiş tarih/hak/hesaplaşma kurallarını uygula; otomatik geçmiş canlandırma/hak devri/yeniden rezervasyon üretme.
Merkez seans iptali öğrenci rezervasyon iptalinden ayrıdır. Yerine seans eskiye bağlı yeni kayıttır; otomatik katılımcı taşıma veya telafi kredisi icat etme.
Ürün değişiminin parasal hesabı için mevcut finans altyapısını kullan; P03'ün genel iade/tahsilat yönetimini zorunlu olmadıkça ekleme.
Kabul: önizleme→açık onay→atomik değişiklik→hak/rezervasyon sonucu; çift kullanım, eşzamanlı rezervasyon, stale ve geç hata rollback.

### P03 — Finans ve eğitmen ödemeleri

Ortak üretim promptunu uygula. Durum: queued.

**Mevcut sözleşme API'leri (7):**

- `finance_get_v1`
- `collection_correct_preview_v1`
- `collection_correct_apply_v1`
- `sale_refund_preview_v1`
- `sale_refund_apply_v1`
- `instructor_payment_record_v1`
- `instructor_payment_correct_v1`

**Görev ve kabul:**

Öğrenci finansı ve eğitmen ödeme hesabı yetkili kapsamda okunsun; iade/düzeltmeler geçmişi silmeden uygulansın.
Borç/alacak, nakit, hak ve eğitmen hesabı ayrı kalsın; aynı merkez/para birimi ve alan görünürlüğü korunsun.
Paket iadesi satışta sabitlenmiş yöntemle hesaplansın; hak değişimi/sonlandırma/nakit iade birbirinin yerine geçmesin; tutar iki kez iade/alacaklaştırılmasın.
Eğitmen ödemesi seçili hakedişlere dağıtılsın, kısmi ödeme/kalan okunsun; hakediş düzeltmesi eski ödemeyi silmesin.
Tahsilat düzeltmesinin etkinlik hazırlığına, borç dağıtımlarına ve öğrenci alacağına etkisini doğrula. Merkezler arası ledger'ı öğrenci finansı gibi değiştirme.
Kabul: okuma→önizleme→uygulama→bağlı hareket/bakiye; paralel iade/mahsup/ödeme, tekrar ve rollback.

### P04 — CRM ve public başvuru

Ortak üretim promptunu uygula. Durum: queued.

**Mevcut sözleşme API'leri (11):**

- `leads_list_v1`
- `lead_save_v1`
- `crm_activity_save_v1`
- `trial_offer_create_v1`
- `trial_registration_confirm_v1`
- `lead_convert_v1`
- `crm_followup_list_v1`
- `publication_set_v1`
- `public_calendar_get_v1`
- `public_application_submit_v1`
- `public_application_review_v1`

**Görev ve kabul:**

Public veya merkez adayı takip/deneme üzerinden ücretli öğrenciye dönüşebilsin.
Hazır CRM veya ikinci kişi modeli ekleme; mevcut kişi/öğrenci/satış/hak/rezervasyon altyapısını kullan.
Operasyon personeli merkez/atanmış aday sınırında kalsın; CRM izni indirim/fiyat/satış/tahsilat/export yetkisi vermesin.
Deneme koşulları ve tekrar sınırı açık yapılandırmadan gelsin; değer icat etme. Dönüşüm öğrenci limitine tabi olsun; geçmiş bedelsiz denemeye hakediş üretmesin.
Public başvuru yer/hak/hesap bağı oluşturmasın. Yalnız yayımlanmış alanlar açılsın; kişi/borç/kredi/iç not sızmasın. Bot/hız/mükerrer korumalarını uygula; eksik sağlayıcı için bypass açma, bağımlılığı bildir.
Kabul: başvuru→inceleme→takip→deneme→ücretli öğrenci; çift kişi/dönüşüm ve plan/rol sınırları. Segment/otomasyon P05'tedir.

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


