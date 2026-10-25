# Frontend ayar API uygulama devri

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
