## Starter başlangıç ayarları ve self/public — backend adayı

Son kabul edilmiş taban PR60/main `6c7587b63681cc9f89d14483eaca71e520a074af` (213 API/67 migration); bu uygulama Draft PR61’de213 API/68 migration’dır. Önceki67 migration değişmez. Son aday/main/CD kabulü tamamlanmadan yeni kaynak yayımlanmış sayılmaz.

| Alan | API ve gerçek tüketici |
|---|---|
| FD07 başlangıcı | Yeni Starter organization_create_v1 aynı transaction’da org scope’lu sürüm1 negative_default=0, debt_booking=true, debt_participation=true üretir. Oluşum audit’i politika kimliklerini taşır; receipt replay yeni sürüm üretmez. Mevcut org/merkez/kişi/politika kayıtlarına backfill yok. |
| Miras ve yetki | policies_get_v1 ile merkezden org politikası okunur; policy_at/lesson_limits/rezervasyon/yoklama tüketir. Starter merkez override’ı açılmaz; org yöneticisinin mevcut policy_publish/impact yolları kullanılır. Genel settings patch’i bu iş politikalarının yerine geçmez. |
| Eksik yapılandırma | Merkez timezone’u açık seçilir. Oda/eğitmen uygunluğu, pencere, iptal/no-show, ürün hak/fiyat/süre/iade şartları açık domain komutlarıyla kurulur. Tanımsız değer, sahte çalışma saati veya ücretsiz hak üretilmez. Otomatik public yayın yok; publication_set_v1 açık hedef ve public_details ister. |
| Public başlangıç | Public takvim yalnız yayın allowlist’ini verir. Geçerli hizmet+imza+bot bağlamında submit yalnız intent üretir. CM review ile kişi/aday oluşturur/eşler; Starter genel CRM lead’i, satış, rezervasyon veya yönetim rolü oluşturmaz. |
| Öğrenciye geçiş | student_activate_v1, account_access_send_v1/accept_v1 ve doğrulanmış native hesap bağı; sonra ayrı sale/collection ve kendi reservation_create_v1. Yanlış hesap daveti alamaz; borç engeli yeni rezervasyonda gerçekten uygulanır. |

Frontend tasarımı/işleyişi, studiosaas dağıtımı ve DNS değişmedi. Hedef uye.fethiyetango.com; mevcut managed widget’a yalnız bu alan eklendi, eski alanlar/mode korundu. Gerçek istemcinin widget tokenı/siteverify kabulü bu backend/native bağlam testiyle kapanmış sayılmaz.

Public server adapter api/public-application.js, scripts/public-application-gateway.mjs ve mevcut signer’ı kullanır. Web Request/Response POST; exact HTTPS host/origin; Vercel’in overwrite ettiği tek x-vercel-forwarded-for IP’si; sabit Edge submit path;64KiB istek/yanıt; caller imza/auth/cookie’leri taşınmaz. Upstream yalnız kapalı accepted veya SafeError allowlist envelope’uyla döner; bozuk/taşan yanıt503, bozuk istemci JSON/UTF8 girdisi400’dür. Kodlar kanonik08 sözleşmesinden okunur; server dağıtımı bu sözleşme dosyasını da içermelidir. Bu adapter mevcut frontend’e dağıtılmadı.

Sunucu config’i: FTK_PUBLIC_APPLICATION_HOSTNAME, FTK_PUBLIC_INGRESS_SECRET (en az32bayt), FTK_PUBLIC_ANON_KEY (legacy anon JWT); isteğe bağlı FTK_PUBLIC_BACKEND_ORIGIN yalnız sunucuda HTTPS origin’dir, default mevcut geliştirme Supabase’idir. Edge’de FTK_PUBLIC_INGRESS_SECRET/FTK_PUBLIC_HASH_SECRET/FTK_TURNSTILE_SECRET gerekir. Public hostname FTK_PUBLIC_APPLICATION_HOSTNAME, yoksa legacy FTK_TURNSTILE_HOSTNAME olur. Handler erken kapısı ve siteverify aynı resolver’ı kullanır; recovery action legacy hostname’inde kalır. Sırlar istemciye/kaynağa/rapora yazılmaz.

Kabul kapsamı: native Auth→Edge→RPC yönetim/davet/self rezervasyon; public submit’in DB aşamasında yalnız yerel testte Edge-owned doğrulanmış bağlam emülasyonu; ayrıca tam handler signed ingress→preflight→mock siteverify→submit ve gateway adversarial sözleşme testleri. Bunlar gerçek Turnstile tokenı, dış SMTP veya frontend E2E kabulü değildir. Son kaynak/sonuçlar [PR61 backend raporundadır](../reports/starter-onboarding-20261027.md):151 yerel doğrulama, temiz native9+19=28/28 ve advisors exit0 geçti. Son aday/main/CD kabulü ayrıca bekler.

## 27 Ekim — Starter plan kapıları teslimi kapandı

[PR #56](https://github.com/SXQHex/FtkSaaS/pull/56) main `ed747324f7d008b24103d4fd2eba503791c70a93` üzerinde kabul edildi: **213 callable API / 0 contract_only / 66 migration / 90 core tablo**. [Aday full clean40419827224](https://github.com/SXQHex/FtkSaaS/actions/runs/40419827224), [aynı main full clean40422823564](https://github.com/SXQHex/FtkSaaS/actions/runs/40422823564) ve [development CD40425584520](https://github.com/SXQHex/FtkSaaS/actions/runs/40425584520) başarılı. CD gerçek deploy ve20/20 hosted kontrol içerir; backend-v1 Edge21 ACTIVE, `verify_jwt=true`. JWT doğrulaması son kullanıcı kararıyla açık kalır.

Starter limitleri **1 merkez / 1 aktif oda / 1 disiplin / 1 aktif eğitmen / 100 aktif öğrenci**; tek mantıksal oda, seçili merkez-disiplin paketi ve disiplin adı ön eki uygulanır. Genel CRM/etkinlik/personel/hakediş kapalı; yoklama anlaşmasız ve hakedişsiz çalışır. Canlı plan/kapsam kapıları eski receipt/preview/grant ve doğrudan RPC ile aşılamaz. Pro→Starter kapsam seçimi sürümlüdür; seçilmeyen operasyon kapanır, geçmiş seans/kesin rezervasyon/hak/finans kayıtları korunur. [DTO, kapsam ve kabul kanıtları](starter-plan-gates-handover.md).

Bu kapanış yalnız plan kapıları ve sürümlü kapsam düşürme teslimidir; bütün Starter dağıtım yol haritası, gerçek public hostname/Turnstile, Pro/Business ayrı limit/özel teklif veya production hazırlığı tamamlandı sayılmaz. Aşağıdaki önceki kaynaklara ait tarihli aday/bekleme/envanter notları tarihsel checkpointlerdir; güncel kabul veya açık iş olarak kullanılmaz. Tarihsel `reports/` dosyaları ve eski kaynak snapshotları korunur. Bu belge eşitlemesi yeni runtime testi veya deploy değildir.

## 26 Ekim son karar — native Auth davranışı ve bakım sınırı

Supabase Auth + yerleşik Turnstile ana yoldur. Parola sıfırlanınca mevcut kurtarma oturumu kalır, diğer native oturumlar kapanır; sırf yeniden giriş istemek için sağlayıcının iç SQL/sorgu sırasına bağlı bakım alınmaz. Belirgin güvenlik riski veya bağlayıcı ürün gereksinimi olmayan durumlarda aynı işi tekrar eden auth function/gateway eklenmez. Canlı oturum, MFA, tenant/rol/yetki denetimleri ve mevcut full/main clean kapsamı korunur.

Yayımlanmamış özel all-session-reset66 migration/trigger/marker ve yalnız bu davranışa ait yeni test/enum taslağı iptal edildi. Hosted migration66/table bulunmadığı SQL ile doğrulandı; yayımlanmış65 migration ve mevcut native test assertionları değiştirilmedi. Önceki8/8 native kanıt bu iptal edilmiş taslağın tarihsel kanıtıdır; yeni ürün davranışının kabulü değildir. Runtime213 API/65 migration'dır. Yayınlanmış API'ler bu kararla sessizce silinmez; mevcut istemciler için compatibility korunur, yeni Auth tüketicisi native SDK/endpoint kullanır.

Birinci satır açık kalır: native CAPTCHA/gerçek kurtarma sağlayıcı kabulü ve son kaynak/adayı/main/CD kanıtı tamamlanacaktır. Geçici özel kurtarma gateway'inin başarılı kabulü artık kapanış şartı değildir; bu yol için kullanıcıdan yeniden test istenmez. Önceki10/3 özel sayaçların native karşılığı uygulanmış sayılmaz; native rate-limit envanteriyle açık eşleme yapılır ve yalnız sayısal benzerlik için ek gateway kurulmaz. Aynı oturum URL'sinin gateway'de değişmesinden doğan mevcut public-ingress imza hatası ayrı bir uyumluluk düzeltmesidir; HMAC/route/bot/rate korumaları gevşetilmez.

Aşağıdaki66/özel gateway kabul notları önceki checkpointlerdir; bu son karar çelişen hükümlerinin yerine geçer.

## 26 Ekim — hesap güvenliği kabul sınırı

PR53 main7086d7e0 main clean/CD başarılı;213 API/65 migration yayımlandı. Gerçek Google bağlama13 kontrol ve güvenlik e-postası teslimiyle doğrulandı. Önceki manual-linking kapalı/pending kayıtları tarihsel checkpointtir. S04 son kararı native kurtarma oturumunu korur; özel66 taslağı iptal edilmiştir. Parola native Auth'a gönderilir; business API'ye veya tercih patch'ine eklenmez. Kurtarma tamamlanınca native mevcut oturum korunur; yeniden giriş zorunlu değildir. Normal parola değişimi current session'ı korur. Hosted uygulama kurtarma kapısı/real bot-proof kabulü henüz açıktır.

# Frontend ayar API uygulama devri

## 26 Ekim — SMS dış entegrasyon kararı (son kullanıcı kabulü)

Telefon numarası kaydedilebilir; gerçek SMS proof tamamlanmadıkça doğrulanmamış kalır. Numaranın kaydedilmesi, doğrulanmış iletişim yayılımı, hesap sahipliği kanıtı veya telefonla giriş yetkisi değildir. Ücretsiz geliştirme testlerinde yalnız izole yerel test OTP kodları kullanılabilir; bunlar gerçek SMS gönderimi/teslimi veya hosted provider kabulü sayılmaz. Sabit test kodları hosted ortama uygulanmaz.

E-posta/parola, gerçek Google giriş/bağlama ve doğrulayıcı uygulama TOTP ile ilerlenir. Gerçek SMS sağlayıcısı kurulumu ayrı dış entegrasyon statüsündedir; birinci satırın diğer backend işlerini ve backend kapanışını engellemez. SMS'in gerçek sağlayıcı kabulü tamamlandı işaretlenmez. Doğrulanmamış telefon kaydetme/okuma yolu ile yerel proof/test-code davranışının uygulama kabulü backend kapsamındadır; bu karar tek başına yeni alan/API'nin uygulanmış olduğu kanıtı değildir.


## 26 Ekim — PR50 hesap ve güvenlik teslim paketi

PR50 yerel kapsamı **212 callable API / 64 migration**,46 ayar alanı/44 writable; başlangıç main `a7569bbb11353dc342804eb5050800d77a31a8e9`. İlk207/63 iki alan adayı aşağıda tarihsel snapshot’tır. Yeni beş işlem kendi oturumlarını listeleme/etiketleme/kapatma, güvenlik geçmişi ve güçlü doğrulanmış TOTP kaldırmayı kapsar. Native TOTP enrollment/challenge/verify sağlayıcıda kalır; verified factor varsa uygulama ve SQL hem doğrulanmış JWT aal2 hem canlı native session aal2 ister. Genel tercih patch’i güvenlik işlemlerini değiştirmez.

Oturum/refresh iptali ve geç hata rollback’i dar native testte geçti. Native sağlayıcının eski aal1 token ile aynı-session factor kaldırmasını kabul ettiği görüldü; bu negatif assertion korunarak10 saniyelik, yalnız aynı faktöre ait güçlü yeniden doğrulanmış kaldırma niyeti ve transactional native DELETE koruması eklendi. Son koruma gerçek native Auth üzerinde4/4 geçti (23.229sn); resetin ilk üç özgün akışı4/4 (44.889sn), ayrılan başlangıç grubu2/2 (51.937sn) geçti. Bağımsız incelemede bloklayıcı bulgu kalmadı; son commit/tree bağı ve aday/main clean/CD bekler. Eski başarısız aday40237107409 bu genişleyen kaynağın kabulü değildir; yeni full clean başlatılmadı. Uygulanmış62 migration değişmez;63–64 henüz adaydır.

Bu paket beş ekranın/69 grubun tümü değildir. Global ad/doğrulanmış iletişim yayılımı, avatar/logo, gerçek Google sağlayıcısı, takvim bağlantısı ve diğer özel consumer açıkları korunur. Hosted TOTP yapılandırması, yeni Auth trigger’larıyla hosted restore ve aynı-main CD kabulü kanıtsız kapatılmaz. Ayrı dummy organizasyon veya yeni CI altyapısı kurulmaz.


## 26 Ekim — kullanıcı görünüm ve başlangıç ayarı adayı

Başlangıç main `a7569bbb11353dc342804eb5050800d77a31a8e9`: PR49 belge kabulü40235383940 ve development CD40235449919 başarılı; runtime kaynağı PR48/34aac276 için full clean40232332540 ve CD40234018404 kabulü korunur. Bu uygulama adayı **207 API/63 migration**,46 genel ayar alanı/44 writable içerir; kullanıcı alanı18’den20’ye çıkar. Aynı altı settings API’sine font_scale ve startup_context eklenir, katalog sürümü2’dir. Eski62 migration değiştirilmez; yeni migration20261025213014.

Yazı ölçeği ve sabit org/merkez/disiplin seçimi kullanıcı hesabına aittir; yetki/plan veya merkez iş timezone’u değişmez. Canlı erişim kaybında başlangıç bağlamı null döner, aynı yazma receipt’i yetki denetimini atlayamaz. UI tasarımı değiştirilmedi; ekran/rol başlangıcı, kayıtlı filtreler ve kalan69 grup bu iki alanla tamamlanmış sayılmaz. [Alanlar ve tüketici sınırı](frontend-settings-handover.md#kullanici-gorunum-baslangic-20261026). Son aday inceleme/full clean/main/CD kabulü henüz bekler.

25 Ekim 2026 uygulama adayı; main7020638 / 200 API /59 migration üstüne 6 işlem ve yeni 20261025091433 migration. Kaynak aday206/60; bu sayı ayrı PR45 kapasite adayı201/60 ile birleştirilmez. Frontend tasarım/istemci Claude alanıdır. Gerçek Auth→Edge→RPC ve bağımsız CI kabulü bekler.

## İşlemler

| İşlem | İstek/sonuç |
|---|---|
| settings_catalog_get_v1 | scope; izinli alan/group/consumer/writable, kaynak defaultları, açık destek sınırı. |
| settings_get_v1 | scope; version, values, overridden_fields, as_of. |
| settings_update_v1 | scope, expected_version, operation_key, kapalı patch; opsiyonel reason. Gönderilmeyen alana dokunmaz. |
| settings_reset_preview_v1 | scope + açık fields; aktöre/scope/sürüme bağlı id/token, before/after ve son kullanım. |
| settings_reset_apply_v1 | scope, expected_version, operation_key, preview{id,token}; güncel yetki tekrar kontrolü. |
| settings_history_get_v1 | scope + isteğe bağlı cursor; 50'lik kararlı sayfalarla settings komutlarının önce/sonra/aktör/zaman/gerekçesi. Legacy bildirim komutlarının kendi audit yolu korunur. Cursor scope ve ilk as_of sınırına bağlıdır; user/member scope anahtarı ayrıca hesabı içerir. Her sayfada güncel okuma yetkisi tekrar denetlenir. |

Scope user/platform organizasyonsuz; member/organization için org_id; center için org_id+center_id. account_id/person_id/actor/rol seçicisi kabul edilmez. Tüm istemci alanları ek alanlara kapalı typed Request/Response ile üretilir. Giriş POST backend-v1; named RPC service-only, canlı session/account/link/yetki her retry öncesi tekrar kontrol edilir.

## Yetki ve ilk alanlar

| Scope | Yetki | Alanlar |
|---|---|---|
| user (20) | Kendi aktif global hesabı | `honorific`, `language`, `date_format`, `time_format`, `number_format`, `week_start`, `timezone_mode`, `theme`, `contrast`, `motion`, `remember_context`, `calendar_view`, `show_weekends`, `marketing_in_app`, `ad_personalization`, `ad_measurement`, `optional_analytics`, `timezone_name`, `font_scale`, `startup_context` |
| member (9) | O orgdaki kendi aktif doğrulanmış hesap bağlantısı; admin başkasının tercihini yazamaz | `profile_visible`, `photo_visible`, `email_visible`, `phone_visible`, `history_recommendations`, `interest_center_ids`, `interest_discipline_ids`, `in_app_reminders`, `in_app_marketing` |
| center (4) | Tam merkezde canlı CM; Owner/OM tek başına merkez işletim yetkisi vermez | `description`, `address`, `contact_phone`, `contact_email` |
| organization (9) | Canlı Owner/OM; billing_* yalnız Owner | `description`, `address`, `contact_phone`, `contact_email`, `theme_package_id`, `font_package_id`, `billing_name`, `billing_address`, `billing_email` |
| platform (4) | Canlı private.platform_operators kaydı | `application_name`, `support_email`, `support_url`, `maintenance_message` |

theme_package_id/font_package_id şu anda salt okunur sistem fallback null değeridir; katalogda hazır paket yoktur. Seçilmiş/erişilebilirlik-dil/lisans kontrolü yapılmış assetler olmadan keyfi renk/font kabul edilmez. Logo hattı bu teslimde yoktur. Center marka override yoktur.

## Sürüm, reset ve bildirim uyumu

İlk saklanmamış belge version0; yazma bu değeri açık ister. Sürüm opaktır, istemci +1 hesaplamaz. Eski notification_preferences_set insert/update/delete tetikleyicisi member ayar sürümünü de ilerletir; genel yazma birden çok alt değişiklik nedeniyle birden fazla artırabilir. Katalogdaki scope alanları dışına veya özel finans/politika/yetki alanlarına yazma VALIDATION_FAILED olur. Sahiplik alanları aynı kalır.

Reset önizlemesi 15 dakika geçerlidir; yalnız seçilen alanları kaynak defaultuna döndürür. Reset ad_personalization/ad_measurement/optional_analytics için kapalı tercihi yeniden açmaz. Reklam/analitik tercihi hukuki rıza veya SDK etkinleşmesi değildir. Manual timezone geçerli IANA adı gerektirir. Unsupported/read-only marka alanı SERVICE_UNAVAILABLE; başka actor/scope, süresi dolmuş/uygulanmış/stale token PREVIEW_STALE; eski yazma sürümü VERSION_CONFLICT.

Member anahtarı org+hesaptır; UUID kişisi alias/merge sonrası ayrı kullanıcı hesabı yaratılmaz. Var olan in_app reminder/marketing satırları otoritedir ve settings okuyucusunda aynı değer görünür. Yeni üyelerde FD04 reminder açık/marketing kapalı. Migration öncesi aktif bağlı üyelerin eksik-preference=false davranışı özel snapshot ile korunur; açık seçim ezilmez. Teslim işçisi tercihi gönderim anında tekrar okur. in_app transactional zorunluluğu kapatılamaz. Kendi org tercihi/geri alma subscription kapalıyken de erişilebilir; bu istisna domain veya org/merkez yönetimini açmaz.

## Açık kalan gerçek teslimler

Bu paket 69 grubun tamamı değildir. Hazır renk/font paket yönetimi ve public marka okuması; PNG/JPEG/WebP avatar/logo Storage hattı; global ad/doğrulanmış e-posta/telefon yayılımı; gerçek Google sağlayıcısı, MFA hosted aktivasyonu ve ayrı güvenilen cihaz kaydı; takvim aboneliği; sessiz saat/olay bazlı reminder zamanları ve özet consumerları; kayıtlı ekran filtreleri/bağlam; yetkili görünürlük kitle projeksiyonu; alan bazlı canlı miras/şablon ve platform default yayınlama; mevcut özel program/paket/belge/CRM/rapor/import/abonelik alanlarının eksik DTO/consumer eşlemesi ayrı açık kalır. Provider/secrets veya ertelenmiş SQL/Cron yönetimi genel preference patch'iyle etkinleştirilmez.

## PR46 kabulü ve birleşim sınırı

PR46 head e98946adcbafb57d55e209f2284d1326d4488fb3 bağımsız inceleme ve aday40183389440 başarılıdır. Main3456050a3061d7bf5dc2ce8898b82c5cfe84e773 için main40200716603 ve development CD40202862244 başarılıdır. Bu PR45 birleşim adayı aynı altı API’yi korur; yeni birleşik kaynağa eski test kabulü taşınmaz.

## Doğrulama sınırı

Yerel izole PGlite üzerinde bütün migration zinciri ve yeni SQL davranışları kontrol edildi; sentetik Auth tablo fixture'ları native Auth değildir, E2E kabulü sayılmaz. Native Auth→Edge→RPC suite tests/frontend-settings-acceptance.mjs mevcut registry shardına eklidir; full/main clean kapsamı azaltılmadı. Eski P05 negatif teslim fixture'ı yeni FD04 açık defaultu nedeniyle açıkça opt-out yapar; sıfır teslim assertionı aynen korunur. Gerçek CI sonuçları kaynak head'ine bağlı doğrulanacaktır.

Bağımsız ilk inceleme, Owner→OM geçişinde billing_* eski update/reset receipt replay yolundaki alan yetkisi açığını buldu. Alan yetkisi artık receipt okumasından önce denetlenir; geçerli rol korunurken uygulanmış/süresi dolmuş resetin başarılı retry sonucu korunur. Native regresyon bu iki tarafı da kapsar; düzeltilmiş PR46 kaynağı bağımsız inceleme ve aday/main CI’dan geçti. Birleşik PR45 kaynağı ayrı kabul bekler.


## Kullanici gorunum baslangic 20261026

| Alan | Wire/default | Frontend tüketimi ve sınır |
|---|---|---|
| font_scale | number0.75–2 veya null; default null | null cihaz/OS ölçeğini izler; açık değer uygulama yazı ölçeği tercihidir. S08 kapsamında hesaplar/cihazlar arası okunur; OS ses/titreşim izni veya marka font kataloğu değildir. Büyütmede düğme/içerik korunması frontend kabulünde ayrıca doğrulanır. |
| startup_context | null veya kapalı {org_id:FtkUuid,center_id:FtkUuid\|null,discipline_id:FtkUuid\|null}; default null | remember_context=true: son bağlam cihazdadır; sabit tercih açılış yönlendirmesini değiştirmez. false: geçerli sabit bağlam kullanılır; null ise erişim açıklamayan seçim ekranı. Deep link bu tercihi yazmaz. |

Üst seçim değişirken istemci uyumsuz alt seçimleri null göndermelidir; üç alan tek atomik nesnedir, yarım merkez/disiplin seçimi saklanmaz. org_id zorunlu; disiplinde merkez zorunlu. Ek actor/account/role/route/alan kabul edilmez. Geçersiz biçim VALIDATION_FAILED; bilinmeyen, başka tenant, aktif/doğrulanmış linki olmayan, kapalı org, erişimsiz merkez veya merkezde etkin olmayan disiplin NOT_FOUND verir. Bu kod varlık keşfi için ayırt edilmez. Başlangıç merkezinde mevcut centers_list yetki kitlesi ve plan erişimi korunur.

settings_get_v1 her okumada bağlamı canlı denetler; kayıp erişimde startup_context:null döndürür. Saklanan tercihi silmez veya version artırmaz; erişim yeniden gelirse tercih tekrar okunabilir. overridden_fields seçimin yerel saklandığını gösterebilir; org/merkez/disiplin adları bu API’den dönmez. Gerçek sayfa/veri/komut her zaman kendi güncel yetkisini kontrol eder. Tercih rol veya rezervasyon yetkisi vermez. Diğer user alanları (örneğin görünüm/pazarlama geri alma) bu geçersiz bağlam nedeniyle engellenmez.

Aynı operation_key+payload için startup_context yazma retry’si de güncel kapsamı yeniden denetler; erişim kaybında eski başarı tekrar verilmez. font_scale ve startup_context ayrı ayrı reset edilir; diğer ayarlar ve privacy seçimleri korunur. Reset preview15 dakika, expected_version ve aynı kullanıcı/scope/token davranışı değişmedi. Katalog sürümü2 ve üretilmiş UserSettingsValues/SettingsFieldKeys/descriptor tipleri iki alanı taşır. Yeni endpoint, genel JSON/serbest CSS/route veya rol seçici eklenmedi. Başlangıç ekranı/rolü ve S10 kayıtlı filtreler sonraki typed teslimdir.


### Bu adayın dar doğrulaması

Aynı63-migration kaynağı Vercel’in tek izole native Supabase ortamında yalnız tests/frontend-settings-acceptance.mjs ile sınandı:11/11pass,0fail/skip/cancel,159134.234555ms, normal tamamlanma. Yeni iki alan/closed nested shape/font range; canlı üyelik, org kapanması ve replay engeli; resetin privacy ve diğer alanı koruması mevcut yarış/rollback/yetki/sayfalama/beş-scope testleriyle birlikte geçti. İlk denemede SettingsView kapsamlı overridden_fields ve SettingsCatalog kapsamlı version listeleri eski kaldığından Edge INTEGRITY_VIOLATION üretti; kapalı listeler ve tüm katalog varyantları eşitlendi, assertion gevşetilmedi. SQL/migration bu düzeltmede değişmedi.

Yerelde149 yapısal test,63 migration derlemesi ve sentetik SQL davranışı geçti; native doğrulama bunun yerine sayılmaz. Migration/DTO checker artık kapsamlı cevap field/version listelerini de eşitliyor. İşlem207, yeni suite/shard yok; mevcut registry suite’inin alt testleri genişledi. Full/main clean kapsamı ve assertionlar değişmedi. Makine sözleşmesi, validator, Edge bundle, yeni migration ve ilgili testin yerel ve native SHA256’ları eşleşti. Native ortam durduruldu; hosted veri değişmedi. Son bağımsız kaynak incelemesi ve aday/main clean/CD kabulü ayrıca gerekir.

## Hesap oturum ve TOTP API devri — PR50 adayı

Bütün beş işlem global kendi hesap kapsamındadır; org/center/account/actor seçicisi yoktur. `session_id` ve `factor_id` native ProviderUuid’dir, uygulama FtkUuid biçimine zorlanmaz. Diğer kullanıcının session/factor verisi okunamaz/değiştirilemez. Typed istek/sonuçlar contracts08 ve üretilen SDK’dan alınır.

| İşlem | İstek ve davranış |
|---|---|
| account_sessions_list_v1 | Opsiyonel cursor;50 canlı kendi native session, current/created_at/last_refreshed_at/expires_at/aal, sınırlandırılmış user_agent ve label/version. IP/konum/token yoktur. last_refreshed_at sağlayıcı yenilemesidir, her uygulama isteğinin aktivitesi değildir. |
| account_session_label_v1 | session_id, label:null veya1–80 karakter, expected_version, operation_key. İlk sürüm0; null etiketi temizler, sürüm ilerler. |
| account_sessions_revoke_v1 | operation_key ve kapalı mode:selected/current/others. selected session_id ister. others aynı bearer session’dan taze native giriş proof’u reauth ister; doğrulanmış factor varsa hem caller hem proof aal2 olmalıdır. Taze giriş benimsenip others çağrılır; bu session korunur. Replay daha sonra açılmış session’ları kapatmaz. current çıkışı zayıf token ile de mümkündür. |
| account_security_history_get_v1 | Opsiyonel cursor;50 kendi değişmez global olay, kararlı as_of. Faktör etkinleştirme/kaldırma olayları tek faktörün geçişidir, tüm MFA durumunun özeti değildir. Secret/code/reauth saklanmaz. |
| account_totp_remove_v1 | factor_id ve reauth; operation_key yoktur. Aynı taze, güçlü mevcut session proof’u exact own verified TOTP için10sn onay oluşturur. Edge native DELETE yapar; native silme, onay tüketimi ve geçmiş tek transaction’dır. Başarı yalnız completed onay+faktör yokluğuyla; tekrar aynı tamamlanan sonucu okur, yeni işlem yapmaz. |

Enrollment/challenge/verify native Supabase Auth SDK ile; yalnız doğrulanmış TOTP kaldırma Ftk API’sinden yapılır. Native doğrudan verified-factor unenroll, güçlü tokenla bile önceden backend onayı yoksa reddedilir. DB native isteğin JWT’sini görmediği için koruma istek-JWT bağlama iddiası taşımaz: güçlü onay yalnız exact factor/account, canlı aal2 session ve10sn sınırında tüketilir. Onay penceresinde başka istek ancak aynı onaylı kaldırmayı tamamlayabilir. Doğrulanmamış enrollment iptali native kalır. Yerleşik deletion_pending hesap imhası kendi güçlü onay yolundan geçer; bu istisna imha tamamlandı iddiası değildir.

Verified native factor varsa eski aal1 token session DB aal2 olsa bile uygulamaya erişemez. JWT assurance user_metadata’dan alınmaz; Edge native user doğrular ve SQL ayrıca canlı session/factor durumunu denetler. Geç history yazma hatası native silmeyi de geri alır; provider timeout/eksik commit başarıya çevrilmez. Rolün MFA zorunluluğu politikası, recovery kodu, güvenilen cihaz/passkey/SMS desteği bu paketle ilan edilmez. Hosted provider ayarları ayrı doğrulanır; local config CD’nin hosted Auth ayarını değiştirdiği anlamına gelmez.

## Hesap kimligi iletisim 20261026 — teslim1 taslağı

account_profile_update_v1 mevcut display_name ve expected_version/operation_key sözleşmesini korur; given_name/family_name nullable1–100 karakter optional alanları eklenir. Gönderilmeyen alan korunur; null açık temizlemedir. account_get_v1.identity yalnız kendi given_name/family_name, doğrulanmış email/phone ve verified_at, native pending_email/pending_phone değerini döndürür. Pending, kullanılabilir güncel iletişim değildir; native Auth proof’u olmadan confirmed olamaz. PersonSummary/View mevcut güncel ad alanlarının yanında given_name/family_name taşıyabilir; UUIDv7/person ilişkisi değişmez.

Aktif/doğrulanmış link ve aktif kişi/org için güncel display/name ve canonical native verified contacts materyalize edilir. Unlink sonrası eski org kaydı dondurulur; sonraki güncellemeler gitmez. Org reopen catch-up yapar. Alias/link move eski current-authority mapping’ini kaldırır, tarihsel contact kaydını silmez. Aktif linked kişinin global kimlik/verified contact alanı org komutuyla ezilemez; diğer org contacts ayrı korunur. Kontenjan/rol/borç/plan yetkisi bu yayılımdan doğmaz.

Resend platform Auth e-postaları için onaylandı; native Auth custom SMTP hedeflenir. Google ve phone hosted sağlayıcıları kapalı ölçüldü, TOTP hosted tam akış henüz ölçülmedi. Bu taslak full/main/CD veya gerçek email/SMS/Google provider kabulü değildir; sağlayıcı hazır değilken UI doğrulandı/gönderildi başarısı üretmez. [Aktif kabul](production-queue.md#teslim1-kimlik-iletisim).

26 Ekim teslim1 taslağı: başlangıç görünen adı bir kez profil kaynağına alınır; raw native user_metadata güncellenmesi hesap/org adını değiştirmez. Görünen ad ve given_name/family_name değişikliği account_profile_update_v1 üzerinden sürüm/receipt ve yayılımla yapılır. Yerel65 kaynağı henüz main/hosted kabulü değildir. Resend SMTP gerçek provider teslim kanıtı production-queue içinde ayrı tutulur.

## Teslim1 Google bağlama hazırlığı — yerel213 API/65 migration adayı

account_google_link_prepare_v1 isteği client_api_version/request_id/reauth/google_id_token içerir. Reauth mevcut aynı native session’dan taze sign-in tokenıdır; MFA varsa signed+live aal2 gerekir. Önce Google Identity Services/Expo sağlayıcısından Google ID token alınır. Backend tokenın sub alanını yalnız hedef kısıtı olarak alır; bu parse imza doğrulaması veya bağlama başarısı değildir. Yanıt {provider:google,status:ready,expires_in:10}; ardından native Auth ID-token grant/link_identity=true aynı Google token ve gerekli nonce ile tamamlanır. Native imza/issuer/audience/nonce kontrolleri atlanmaz. Yetki yalnız exact Google subject/hesap/session/süre içindir; farklı subject, eski session, ban/silinme ve süresi dolmuş niyet reddedilir. Son kullanılabilir yöntem silinmez. Redirect URL üreten eski taslak kullanılmaz. Token/nonce/reauth receipt, audit veya log’a yazılmaz.

E-posta/telefon request/resend/verify native Auth SDK’sındadır. account_get_v1.identity doğrulanmış güncel ve pending alanları ayırır; pending org kayıtlarına yayılmaz. E-posta değişiminde çift doğrulama ve eski proof/expiry kapıları native sağlayıcıda kalır. Native email değişimi oturum tokenını yenilerse dönen oturum kullanılmalıdır; eski tokenla tekrar denenmez. Şimdiki hosted phone provider disabled: gerçek SMS teslimi hazır gösterilmez.

Doğrulanmamış telefon yerel65 adayında account_profile_update_v1.unverified_phone ile E.164 biçiminde kaydedilir; null yalnız bu doğrulanmamış kaydı temizler, alanın gönderilmemesi mevcut değeri korur. account_get_v1.identity.unverified_phone ayrı döner; identity.phone/phone_verified_at yalnız native doğrulama kaynağındandır. Aynı numaranın doğrulanmış native değer olması halinde doğrulanmamış kopya gösterilmez. Org canonical iletişimlerine otomatik yayılmaz, giriş/sahiplik kanıtı değildir. Native SMS pending_phone ile aynı alan değildir. Sürüm/receipt/profile audit mevcut yol üzerinden korunur. Yerel149 yapısal kontrol geçti; eklenen native regression henüz koşulmadı, önceki10/10 sonucu bu yeni alana taşınmaz.

Son telefon düzeltmesi: strict ManagementProjection_account_profile_update_v1.values DTO’suna unverified_phone eklendi; management_state_get üzerinden alanın gerçek dönüşü native regression’a dahil edildi. Nullable yeni alan bile eski strict DTO’da başarısız olduğundan bu kaynak boşluğu kapatıldı.65 migration compile ve SQL profil-yazma/okuma doğrulanmamış kalma, native digits/+ eşdeğer numaranın doğrulanınca draft kopyasının gizlenmesi kontrolleri geçti.149 yapısal kontrol geçti.

Native Auth entegrasyonu: Supabase JS `auth.resetPasswordForEmail(email,{captchaToken,redirectTo})`, `auth.signInWithPassword({email,password,options:{captchaToken}})` ve e-posta kayıt akışındaki `options.captchaToken` kullanılır. Kanıt widget'tan o işlem için alınır; aynı tokenın tekrar kullanımı kabul edilmez. Native CAPTCHA açılması yalnız customEdgeenv kaydı değildir, Auth/provider ayarıdır. Varsayılan native reset tamamlanınca mevcut Auth session korunur; UI zorunlu global signOut/ikinci completionRPC çağırmaz. Korumalı ürün API'leri canlı session/MFA ve tenant/role denetimini sürdürür. Published legacyaccount_passwordreset/change endpointleri bu teslimde silinmez; yeni Authclient native yola geçer ve özel Vercel test URL'si kullanılmaz.
