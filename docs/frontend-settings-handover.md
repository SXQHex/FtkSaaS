> Alan devri: teknik tüketim ve kaynağına bağlı eski kabul kayıtları. Güncel kaynak/CI/hosted durum [00 devirde](../contracts/00-FtkSaaS-yeni-sohbet-devir.md), açık iş [tek backlog’da](remaining-work.md) tutulur. Eski aday/pending ifadeleri yeni görev veya güncel durum değildir.

# Ayar ve hesap API tüketicileri

Güncel kabul/hosted durum [00 devirde](../contracts/00-FtkSaaS-yeni-sohbet-devir.md), açık alanlar [tek backlog’da](remaining-work.md#ertelenmiş-ve-kapsam-dışı) tutulur.69 davranış grubunun normatif sahibi [02 sözleşmedir](../contracts/02-FtkSaaS-teknik-sozlesme.md#ayarlar-sozlesmesi-ve-davranis-sprinti); bu belge gerçek typed alan ve tüketici eşlemesidir. Starter FD07 başlangıcı [teknik sözleşmeden](../contracts/02-FtkSaaS-teknik-sozlesme.md#starter-başlangıç-ayarları-ve-selfpublic) okunur.

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

## Kullanici gorunum baslangic 20261026

| Alan | Wire/default | Frontend tüketimi ve sınır |
|---|---|---|
| font_scale | number0.75–2 veya null; default null | null cihaz/OS ölçeğini izler; açık değer uygulama yazı ölçeği tercihidir. S08 kapsamında hesaplar/cihazlar arası okunur; OS ses/titreşim izni veya marka font kataloğu değildir. Büyütmede düğme/içerik korunması frontend kabulünde ayrıca doğrulanır. |
| startup_context | null veya kapalı {org_id:FtkUuid,center_id:FtkUuid\|null,discipline_id:FtkUuid\|null}; default null | remember_context=true: son bağlam cihazdadır; sabit tercih açılış yönlendirmesini değiştirmez. false: geçerli sabit bağlam kullanılır; null ise erişim açıklamayan seçim ekranı. Deep link bu tercihi yazmaz. |

Üst seçim değişirken istemci uyumsuz alt seçimleri null göndermelidir; üç alan tek atomik nesnedir, yarım merkez/disiplin seçimi saklanmaz. org_id zorunlu; disiplinde merkez zorunlu. Ek actor/account/role/route/alan kabul edilmez. Geçersiz biçim VALIDATION_FAILED; bilinmeyen, başka tenant, aktif/doğrulanmış linki olmayan, kapalı org, erişimsiz merkez veya merkezde etkin olmayan disiplin NOT_FOUND verir. Bu kod varlık keşfi için ayırt edilmez. Başlangıç merkezinde mevcut centers_list yetki kitlesi ve plan erişimi korunur.

settings_get_v1 her okumada bağlamı canlı denetler; kayıp erişimde startup_context:null döndürür. Saklanan tercihi silmez veya version artırmaz; erişim yeniden gelirse tercih tekrar okunabilir. overridden_fields seçimin yerel saklandığını gösterebilir; org/merkez/disiplin adları bu API’den dönmez. Gerçek sayfa/veri/komut her zaman kendi güncel yetkisini kontrol eder. Tercih rol veya rezervasyon yetkisi vermez. Diğer user alanları (örneğin görünüm/pazarlama geri alma) bu geçersiz bağlam nedeniyle engellenmez.

Aynı operation_key+payload için startup_context yazma retry’si de güncel kapsamı yeniden denetler; erişim kaybında eski başarı tekrar verilmez. font_scale ve startup_context ayrı ayrı reset edilir; diğer ayarlar ve privacy seçimleri korunur. Reset preview15 dakika, expected_version ve aynı kullanıcı/scope/token davranışı değişmedi. Katalog sürümü2 ve üretilmiş UserSettingsValues/SettingsFieldKeys/descriptor tipleri iki alanı taşır. Yeni endpoint, genel JSON/serbest CSS/route veya rol seçici eklenmedi. Başlangıç ekranı/rolü ve S10 kayıtlı filtreler sonraki typed teslimdir.


## Hesap oturum ve TOTP API devri

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

## Hesap kimligi iletisim 20261026

account_profile_update_v1 mevcut display_name ve expected_version/operation_key sözleşmesini korur; given_name/family_name nullable1–100 karakter optional alanları eklenir. Gönderilmeyen alan korunur; null açık temizlemedir. account_get_v1.identity yalnız kendi given_name/family_name, doğrulanmış email/phone ve verified_at, native pending_email/pending_phone değerini döndürür. Pending, kullanılabilir güncel iletişim değildir; native Auth proof’u olmadan confirmed olamaz. PersonSummary/View mevcut güncel ad alanlarının yanında given_name/family_name taşıyabilir; UUIDv7/person ilişkisi değişmez.

Aktif/doğrulanmış link ve aktif kişi/org için güncel display/name ve canonical native verified contacts materyalize edilir. Unlink sonrası eski org kaydı dondurulur; sonraki güncellemeler gitmez. Org reopen catch-up yapar. Alias/link move eski current-authority mapping’ini kaldırır, tarihsel contact kaydını silmez. Aktif linked kişinin global kimlik/verified contact alanı org komutuyla ezilemez; diğer org contacts ayrı korunur. Kontenjan/rol/borç/plan yetkisi bu yayılımdan doğmaz.

Başlangıç görünen adı bir kez profil kaynağına alınır; raw native user_metadata güncellemesi hesap/org adını değiştirmez. Ad/soyad değişimi account_profile_update_v1 üzerinden sürüm/receipt ve yayılımla yapılır.

## Teslim1 Google bağlama hazırlığı

account_google_link_prepare_v1 isteği client_api_version/request_id/reauth/google_id_token içerir. Reauth mevcut aynı native session’dan taze sign-in tokenıdır; MFA varsa signed+live aal2 gerekir. Önce Google Identity Services/Expo sağlayıcısından Google ID token alınır. Backend tokenın sub alanını yalnız hedef kısıtı olarak alır; bu parse imza doğrulaması veya bağlama başarısı değildir. Yanıt {provider:google,status:ready,expires_in:10}; ardından native Auth ID-token grant/link_identity=true aynı Google token ve gerekli nonce ile tamamlanır. Native imza/issuer/audience/nonce kontrolleri atlanmaz. Yetki yalnız exact Google subject/hesap/session/süre içindir; farklı subject, eski session, ban/silinme ve süresi dolmuş niyet reddedilir. Son kullanılabilir yöntem silinmez. Redirect URL üreten eski taslak kullanılmaz. Token/nonce/reauth receipt, audit veya log’a yazılmaz.

E-posta/telefon request/resend/verify native Auth SDK’sındadır. account_get_v1.identity doğrulanmış güncel ve pending alanları ayırır; pending org kayıtlarına yayılmaz. E-posta değişiminde çift doğrulama ve eski proof/expiry kapıları native sağlayıcıda kalır. Native email değişimi oturum tokenını yenilerse dönen oturum kullanılmalıdır; eski tokenla tekrar denenmez. Şimdiki hosted phone provider disabled: gerçek SMS teslimi hazır gösterilmez.

Doğrulanmamış telefon account_profile_update_v1.unverified_phone ile E.164 biçiminde kaydedilir; null yalnız bu doğrulanmamış kaydı temizler, alanın gönderilmemesi mevcut değeri korur. account_get_v1.identity.unverified_phone ayrı döner; identity.phone/phone_verified_at yalnız native doğrulama kaynağındandır. Aynı numaranın doğrulanmış native değer olması halinde doğrulanmamış kopya gösterilmez. Org canonical iletişimlerine otomatik yayılmaz, giriş/sahiplik kanıtı değildir. Native SMS pending_phone ile aynı alan değildir. Sürüm/receipt/profile audit mevcut yol üzerinden korunur. Yerel149 yapısal kontrol geçti; eklenen native regression henüz koşulmadı, önceki10/10 sonucu bu yeni alana taşınmaz.


Native Auth CAPTCHA/token seçenekleri sağlayıcı yapılandırmasına göre kullanılır; public Turnstile ile karıştırılmaz. Kurtarmada mevcut native oturum korunur, istemci zorunlu global signOut/ikinci completion RPC çağırmaz. Gerçek SMS kapalı/erteli olduğunda numara kaydı doğrulama başarısı olarak gösterilmez.
