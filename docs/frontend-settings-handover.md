# Frontend ayar API uygulama devri

25 Ekim 2026 uygulama adayı; main7020638 / 200 API /59 migration üstüne 6 işlem ve yeni 20261025091433 migration. Kaynak aday206/60; bu sayı ayrı PR45 kapasite adayı201/60 ile birleştirilmez. Frontend tasarım/istemci Claude alanıdır. Gerçek Auth→Edge→RPC ve bağımsız CI kabulü bekler.

## İşlemler

| İşlem | İstek/sonuç |
|---|---|
| settings_catalog_get_v1 | scope; izinli alan/group/consumer/writable, kaynak defaultları, açık destek sınırı. |
| settings_get_v1 | scope; version, values, overridden_fields, as_of. |
| settings_update_v1 | scope, expected_version, operation_key, kapalı patch; opsiyonel reason. Gönderilmeyen alana dokunmaz. |
| settings_reset_preview_v1 | scope + açık fields; aktöre/scope/sürüme bağlı id/token, before/after ve son kullanım. |
| settings_reset_apply_v1 | scope, expected_version, operation_key, preview{id,token}; güncel yetki tekrar kontrolü. |
| settings_history_get_v1 | scope + isteğe bağlı cursor; 50'lik kararlı sayfalarla settings komutlarının önce/sonra/aktör/zaman/gerekçesi. Legacy bildirim komutlarının kendi audit yolu korunur. Cursor actor/scope ve ilk as_of sınırına bağlıdır. |

Scope user/platform organizasyonsuz; member/organization için org_id; center için org_id+center_id. account_id/person_id/actor/rol seçicisi kabul edilmez. Tüm istemci alanları ek alanlara kapalı typed Request/Response ile üretilir. Giriş POST backend-v1; named RPC service-only, canlı session/account/link/yetki her retry öncesi tekrar kontrol edilir.

## Yetki ve ilk alanlar

| Scope | Yetki | Alanlar |
|---|---|---|
| user (18) | Kendi aktif global hesabı | `honorific`, `language`, `date_format`, `time_format`, `number_format`, `week_start`, `timezone_mode`, `theme`, `contrast`, `motion`, `remember_context`, `calendar_view`, `show_weekends`, `marketing_in_app`, `ad_personalization`, `ad_measurement`, `optional_analytics`, `timezone_name` |
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

Bu paket 69 grubun tamamı değildir. Hazır renk/font paket yönetimi ve public marka okuması; PNG/JPEG/WebP avatar/logo Storage hattı; global ad/doğrulanmış e-posta/telefon yayılımı; Google/native MFA/session cihaz akışları; takvim aboneliği; sessiz saat/olay bazlı reminder zamanları ve özet consumerları; kayıtlı ekran filtreleri/bağlam; yetkili görünürlük kitle projeksiyonu; alan bazlı canlı miras/şablon ve platform default yayınlama; mevcut özel program/paket/belge/CRM/rapor/import/abonelik alanlarının eksik DTO/consumer eşlemesi ayrı açık kalır. Provider/secrets veya ertelenmiş SQL/Cron yönetimi genel preference patch'iyle etkinleştirilmez.

## Doğrulama sınırı

Yerel izole PGlite üzerinde bütün migration zinciri ve yeni SQL davranışları kontrol edildi; sentetik Auth tablo fixture'ları native Auth değildir, E2E kabulü sayılmaz. Native Auth→Edge→RPC suite tests/frontend-settings-acceptance.mjs mevcut registry shardına eklidir; full/main clean kapsamı azaltılmadı. Eski P05 negatif teslim fixture'ı yeni FD04 açık defaultu nedeniyle açıkça opt-out yapar; sıfır teslim assertionı aynen korunur. Gerçek CI sonuçları kaynak head'ine bağlı doğrulanacaktır.
