# Ayar ve hesap API tüketicileri

Güncel kabul/hosted durum [00 devirde](../apps/backend/docs/00-FtkSaaS-yeni-sohbet-devir.md), ortak/backend açık alanlar [proje backlog’unda](../apps/backend/docs/remaining-work.md#ertelenmiş-ve-kapsam-dışı), frontend FD tüketimi [WEB-S12’de](../apps/web/docs/todo.md#web-s12) tutulur. 69 davranış grubunun normatif sahibi [02 sözleşmedir](contracts/02-FtkSaaS-teknik-sozlesme.md#ayarlar-sozlesmesi-ve-davranis-sprinti); bu belge gerçek typed alan ve tüketici eşlemesidir. Starter FD07 başlangıcı [teknik sözleşmeden](contracts/02-FtkSaaS-teknik-sozlesme.md#starter-başlangıç-ayarları-ve-selfpublic) okunur.

## İşlemler

### ST-03 — Starter tüketici kapsamı

Kullanıcı Starter'da izinli FD01–FD12 alanlarının tamamını seçti; marka/medya, kişisel takvim ve paylaşım bu kapsamdan çıkarılmaz. Pro/Business'a kapalı F12/F17/F20–F24/F27/F29 yolları bu teslimle açılmaz. Backend davranışı, hazır istemci tüketimi ve gerçek sağlayıcı/ekran kabulü ayrı kanıtlardır. Aşağıdaki eşleme desteklenmeyen alanları kaydedilmiş gibi göstermez; backend açık kabulü [ortak backlog](../apps/backend/docs/remaining-work.md) ve [00 devir](../apps/backend/docs/00-FtkSaaS-yeni-sohbet-devir.md), frontend alan kabulü [WEB-S12](../apps/web/docs/todo.md#web-s12) sahibindedir.

| FD | Starter tüketicisi ve mevcut sınır |
|---|---|
| FD01 | Dil/format/timezone/tema/ölçek alanları typed; gerçek görüntüleme ve cihaz çözümü istemci kabulüdür, iş timezone'u değişmez. |
| FD02 | Organizasyon üç isteğe bağlı #RRGGBB rengi kullanır; null sistem defaultudur. Hazır renk/font kataloğu gereksinimi kaldırıldı; aşağıdaki logo hattı korunur. |
| FD03 | Native Auth, Google/TOTP/session/kimlik zinciri kabul edildi; fotoğraf/medya tüketicisi ve izinli paylaşımı aşağıda eşlenir. |
| FD04 | in_app amaç tercihleri ve zorunlu teslim mevcut; aşağıdaki typed kullanılabilirlik kataloğu ve desteklenmeyen kanal koruması uygulanır. Starter'a F27 hatırlatma veya dış kanal açılmaz. |
| FD05 | Kesin gelecek/devam eden ortak ders kitlesinde canlı profil/iletişim/fotoğraf ve kişisel takvim aşağıda eşlenir. İlgi filtresi ve opt-in geçmiş sırası mevcut yetkili takvim okumasında aşağıda eşlenir. |
| FD06 | İş timezone/availability/pencereler mevcut domain API'lerinde. Program süresi ve availability hazırlıkları aşağıdaki kopya/önizleme tüketicilerine bağlıdır; gece aşan kesintisiz availability aşağıdaki açık günlük aralık birleşimiyle denetlenir. Saat adımı ve liste/görünüm cihaz/istemci tarafında tüketilir. |
| FD07 | Yeni Starter'ın üç politikası ve plan kapıları kabul edildi; paket hazırlık şablonları ve manuel ödeme yöntemi/reference aşağıda gerçek domain komutlarına bağlanır. |
| FD08 | Belge/yayın/etki/onay mevcut domain zincirinde; medya ve açık public alan seçimi aşağıda eşlenir. |
| FD09 | Genel CRM Starter'a kapalı; dar ders başvurusu korunur. P08 telefon/ortak form kapsamı buraya taşınmaz. |
| FD10 | Rapor/import motoru ST-02 ile kabul edildi. ImportMapping.delimiter virgül/noktalı virgül seçimini gerçek parser'a bağlar; private/ortak şablon çözümü aşağıda mevcut rapor/import isteklerini hazırlar. Otomasyon Starter'a açılmaz. |
| FD11 | Scope/sürüm/replay/reset/history mevcut. Yeni alanlarda kaynak/miras ve gerçek tüketici ayrı test edilir; genel yeni ikinci onay yoktur. |
| FD12 | Mevcut hesap/org lifecycle ve abonelik komutları korunur; desteklenmeyen sağlayıcı/gerçek imha tamamlandı gösterilmez. |

### Program süresi hazırlık tüketicisi

`program_duration_minutes` organization/center kapalı integer alanıdır; minimum1, üst sınır mevcut Postgres integer temsilidir (2147483647), sistem önerisi FD06 gereği60. Org Owner/OM kapsamı ve merkezde canlı CM şartı mevcut settings kapılarından gelir. Yeni merkez, orgun o anki değeri ve sürümünü bir kez kopyalar; mevcut merkez ve programlar backfill edilmez. Sonraki org değişimi eski merkeze canlı miras değildir. Merkez `SettingsView.program_duration_source` system_default/organization_copy/center_local bilgisini, kopyada organization_version değerini döndürür. Kaynak bilgisi yazılabilir ayar değildir.

Yeni program preview isteğinde duration_minutes gönderilmişse açık değer üstündür; gönderilmemişse o merkezin hazırlık değeri kullanılır ve açık preview/program spec snapshot'ına alınır. Ayarı değiştirmek mevcut programı veya onay bekleyen preview'nun yakaladığı süreyi değiştirmez. Seçili reset sistem60'a döner; güncel org şablonuna dönme olarak sunulmaz. Diğer değerler, kişisel izinler ve geçmiş snapshot'lar korunur. Bu alan katalogv3 ile başladı; istemci güncel katalog sürümünü okur. Bu tüketici ikinci politika motoru kurmaz; kaynak/ortam kabulü güncel kabul kaydında izlenir.

| İşlem | İstek/sonuç |
|---|---|
| settings_catalog_get_v1 | scope; izinli alan/group/consumer/writable, kaynak defaultları, açık destek sınırı. |
| settings_get_v1 | scope; version, values, overridden_fields, as_of. |
| settings_update_v1 | scope, expected_version, operation_key, kapalı patch; opsiyonel reason. Gönderilmeyen alana dokunmaz. |
| settings_reset_preview_v1 | scope + açık fields; aktöre/scope/sürüme bağlı id/token, before/after ve son kullanım. |
| settings_reset_apply_v1 | scope, expected_version, operation_key, preview{id,token}; güncel yetki tekrar kontrolü. |
| settings_history_get_v1 | scope + isteğe bağlı cursor; 50'lik kararlı sayfalarla settings komutlarının önce/sonra/aktör/zaman/gerekçesi. Legacy bildirim komutlarının kendi audit yolu korunur. Cursor scope ve ilk as_of sınırına bağlıdır; user/member scope anahtarı ayrıca hesabı içerir. Her sayfada güncel okuma yetkisi tekrar denetlenir. |
| settings_template_resolve_v1 | kind:report/import, org_id, isteğe bağlı center_id, açık template scope/key/version ve typed overrides; yetkili hazırlanmış request snapshot'ı. İş/preview/apply başlatmaz. |

### Katılımcı paylaşım tüketicisi

`session_get_v1` sonucundaki `shared_participants`, salt okunur `SharedLessonParticipant[]` alanıdır. Varsayılan boş; iki tarafın da aynı planned ve bitmemiş derste active kesin rezervasyonu, hedefin aktif kişi/hesap ve doğrulanmış canlı org bağlantısı gerekir. Başvuru/bekleme kaydı yetmez. `profile_visible` yalnız display_name, `email_visible`/`phone_visible` yalnız native doğrulanmış güncel iletişim alanını ayrı açar. `photo_visible` yalnız mevcut fotoğrafın MediaAsset metadata'sını açar; byte okuması da aynı kitle/tercih denetimini tekrar yapar. Kapalı alan hiç dönmez; pending veya doğrulanmamış iletişim, hukuki ad/soyad ve finans taşınmaz. Açık ve mevcut hiçbir alanı olmayan kişi listede de görünmez.

Her okuma canlı tercihi/kayıtları tekrar değerlendirir; kapatma, iptal, bitiş veya unlink sonraki okumada görünürlüğü kaldırır. Katılımcı olmayan CM/personelin aynı session'ı okuyabilmesi bu alandan paylaşım yetkisi üretmez; personelin mevcut operasyonel kişi okuması ayrı kalır. İstemci önceki görünür kopyasını yenilenen sonuçla temizler; dış kopyaların silindiği iddia edilmez. Bu alan org üye dizini veya public profil değildir.

Scope anahtarı UUID'nin harf büyüklüğünden bağımsızdır; lock, belge, reset, history ve consumer aynı kanonik UUID'ye bağlanır. Eski farklı yazım belgeleri göçte değişmez private snapshot'ta korunur. Privacy çatışmasında eski görünümlerden herhangi birinde kapalı olan seçim kapalı kalır; farklı non-privacy değerler sessizce seçilmez, göç `AMBIGUOUS_LEGACY_SETTINGS_SCOPE` ile atomik durur ve açık kapsam çözümü gerekir. Birleşen belgenin sürümü ilerler, eski reset preview'su kapanır; tarihsel ayar kayıtları değiştirilmeden kanonik scope altında okunur.

Scope user/platform organizasyonsuz; member/organization için org_id; center için org_id+center_id. account_id/person_id/actor/rol seçicisi kabul edilmez. Tüm istemci alanları ek alanlara kapalı typed Request/Response ile üretilir. Giriş POST backend-v1; named RPC service-only, canlı session/account/link/yetki her retry öncesi tekrar kontrol edilir.

## Yetki ve ilk alanlar

| Scope | Yetki | Alanlar |
|---|---|---|
| user (20) | Kendi aktif global hesabı | `honorific`, `language`, `date_format`, `time_format`, `number_format`, `week_start`, `timezone_mode`, `theme`, `contrast`, `motion`, `remember_context`, `calendar_view`, `show_weekends`, `marketing_in_app`, `ad_personalization`, `ad_measurement`, `optional_analytics`, `timezone_name`, `font_scale`, `startup_context` |
| member (11) | O orgdaki kendi aktif doğrulanmış hesap bağlantısı; admin başkasının tercihini yazamaz | `profile_visible`, `photo_visible`, `email_visible`, `phone_visible`, `history_recommendations`, `interest_center_ids`, `interest_discipline_ids`, `in_app_reminders`, `in_app_marketing`, `report_templates`, `import_templates` |
| center (12) | Tam merkezde canlı CM; Owner/OM tek başına merkez işletim yetkisi vermez | `description`, `address`, `contact_phone`, `contact_email`, `program_duration_minutes`, `report_templates`, `import_templates`, `public_profile_enabled`, `public_fields`, `public_hours`, `availability_templates`, `package_templates` |
| organization (20) | Canlı Owner/OM; billing_* yalnız Owner | `description`, `address`, `contact_phone`, `contact_email`, `theme_package_id`, `font_package_id`, `primary_color`, `secondary_color`, `accent_color`, `billing_name`, `billing_address`, `billing_email`, `program_duration_minutes`, `report_templates`, `import_templates`, `public_profile_enabled`, `public_fields`, `public_hours`, `availability_templates`, `package_templates` |
| platform (4) | Canlı private.platform_operators kaydı | `application_name`, `support_email`, `support_url`, `maintenance_message` |

`theme_package_id`/`font_package_id` yalnız null kabul eden salt okunur yer tutucular olarak korunur. Organizasyonun `primary_color`, `secondary_color`, `accent_color` alanları null veya tam #RRGGBB (altı hex hane, büyük/küçük harf) kabul eder; boş tercih null gönderilir ve sistem varsayılanını kullanır. Boş metin/geçersiz biçim reddedilir. Canlı Owner/OM, expected_version, idempotency, bağımsız reset ve immutable değişiklik geçmişi mevcut settings API zincirinde korunur. Center override yoktur. Açık/koyu tema, kontrast, işlevsel durum renkleri ve fontlar sistem tarafından yönetilir; kişisel erişilebilirlik tercihleri korunur. Bu karar önceki hazır renk/font kataloğu gereksiniminin yerini alır.

## Özel fotoğraf ve logo tüketicisi

Profilde `account_profile_update_v1.photo`, organizasyonda `settings_update_v1.logo_image` opsiyonel `SettingsImageUpload|null` alanıdır. Göndermemek korur, null açık kaldırmadır. İlk resim yoktur; kaldırmada organizasyon adı/sistem simgesi veya kişisel sistem görseli fallback'i kullanılır. Fotoğrafta mevcut profil sürümü `management_state_get_v1` ile okunur; account_get sonucu profil write sürümü yerine kullanılmaz. Logoda mevcut organization settings version gerekir. Yalnız logo değişirken patch:{} geçerlidir; başka scope/boş komutta bu istisna yoktur. Owner/OM org yazma kapısı, self profil kapısı ve canlı replay denetimleri korunur.

Yükleme kapalı `{mime,data_base64,checksum}` nesnesidir: PNG/JPEG/WebP, en fazla1MiB; checksum küçük harf SHA256. Bu sınır mevcut2MiB JSON ingress içinde base64 taşımak için teknik byte tavanıdır, ticari plan limiti değildir. Edge gerçek byte MIME zarfını/hash/boyutu denetler; raster codec veya transcoder iddiası yoktur. SVG/HTML, serbest URL/path, keyfi MIME ve public bucket yoktur. Küçük byte kayıtları private DB'de, metadata/güncel pointer/immutable değişim geçmişiyle atomiktir. Ham resim receipt/audit/tracking context'e kopyalanmaz.

Okuma `media_get_v1` ile authenticated POST'tur; cache-control private,no-store. `scope:user` yalnız kendi güncel photo asset_id'sini; `scope:organization` ilgili canlı üyenin güncel org logosunu; `scope:lesson_participant` org_id/session_id/person_id ile o an açık photo_visible ve kesin ortak katılımı denetler. Sonuç `{asset:SettingsMediaAsset,data_base64}`; istemci Blob üretir. Resim bytes'ı genel account/settings/session listesine eklenmez. AccountView.photo, SettingsView.logo, OrganizationView.logo ve CenterView.organization_logo yalnız metadata/null taşır. Merkez logosu override edilmez; org logosunu canlı okur.

Eski asset ID, kaldırılmış/değişmiş pointer veya kapanmış izin NOT_FOUND verir; imzalı eski URL ile kapıyı aşma yolu yoktur. Kaldırma yeni okumayı keser; fiziksel imha ve dış kopyanın silinmesi sayılmaz. settings_history'de media_change önceki/yeni asset ID'sini gösterir; byte/sır taşımaz. Logo/fotoğraf genel tercih resetine gizlice eklenmez, açık null komutuyla kaldırılır. Public logo gösterimi ayrıca yayımlanmış org bağlamı ve seçili public alan tüketicisine bağlıdır; authenticated logo okuması tek başına public kabulü değildir.

## Rapor ve import şablon tüketicisi

Katalogv4 member/center/organization kapsamlarında kapalı `report_templates` ve `import_templates` dizilerini ekler; default[] ve otomatik iş yoktur. Member yalnız oluşturan hesabın org tercihidir. Center'a açık yazma CM, organization'a açık yazma Owner/OM ortak paylaşımıdır; mevcut yetki dışında veriye veya import çalıştırmaya izin vermez. Ortak şablon canlı seçilir, merkeze otomatik kopyalanmaz. Seçili dizi reseti default[]'a döner; başka scope, diğer alan veya mevcut job/preview değişmez.

`settings_catalog_get_v1(scope:member)` isteğinde opsiyonel template_center_id ile `work_templates` alınır. Yanıt kendi member, seçili center ve org ortak kayıtlarından yalnız o an gerçek report/import consumer yetkisine uyanları içerir. Yetkisiz, kapalı plan veya kapanmış erişimde ortak içerik dönmez. Genel organization settings yetkisi gerektirmeden yalnız bu beyaz liste projection'ı verilir; fatura/başka üyelerin tercihleri okunmaz. Her kayıtta source:{scope,key,version,center_id?} vardır. Version scope belgesinin opak sürümüdür; ilgisiz aynı-belge değişimi de refetch gerektirebilir. Center source kendi center_id'sini taşır; farklı merkez/actor seçicisi yoktur.

`settings_template_resolve_v1` seçilen kaynağı ve sürümünü canlı okuyup typed overrides ile hazır `{kind,source,request}` döndürür. Report request mevcut report_get/report_export_start çağrısına, import request mevcut import_preview çağrısına eklenir; caller org_id, request_id ve gereken operation_key/file_id/page/format alanlarını açık sağlar. Resolve salt okunur; receipt, job, finans/hak veya preview yaratmaz. Çalıştırma/worker/indirme kendi canlı domain yetkisini tekrar kontrol eder. Yeni sürüm VERSION_CONFLICT, bilinmeyen scope/key NOT_FOUND ve kayıp çalışma yetkisi FORBIDDEN'dir. Önceden hazırlanmış tam request ile başlamış job/preview, sonraki şablon değişikliği/resetinden değer almaz.

İlk rapor şablonları gerçek Starter collections_debts/lesson_attendance türleridir. Filtre aralığı/merkezleri şablonda açık seçilir; hareketli tarih varsayımı yoktur. İzinli sütun listesi, group_key asc/desc sırası ve person/center/total gruplama gerçek report/CSV tüketicisine gider. Grup/tutarlar para birimi bazında kalır ve para string olarak toplanır. Satırda seçilmemiş alanlar çıkarılır; group_key yapısal kimlik olarak korunur. Totals bütün yetkili filtre sonucudur. Export yalnız seçili sütunları sırayla yazar, aynı CSV formula/byte/erişim tavanları korunur. Diğer Pro raporları için yeni center/total gruplama ilan edilmez.

Import şablonu yalnız explicit center_id/source_namespace ve sütun eşlemesidir; delimiter virgül/noktalı virgül seçimi şablonda zorunludur. Eski templatesiz virgül davranışı korunur. Şablon source_key/display_name hedefini ve tekil kaynak sütunlarını ister; email/phone dışında tekrarlanan hedef reddedilir. Borç/hak/para/izin değeri, kişi birleştirme veya auto apply defaultu yoktur. Org yönetimi ortak mapping hazırlayabilir; resolve/preview/apply için ayrıca canlı import yetkisi gerekir. Başka kullanıcı yetkili ortak projection'ı kendi member dizisine farklı key ile kopyalayabilir; paylaşılmış kaynağı değiştirmiş sayılmaz.100 şablon/dizi teknik JSON hazırlık tavanıdır, Starter ticari kotası değildir.

## Availability hazırlığı ve canlı sürüm okuması

`management_state_get_v1` içinde `operation:availability_save_v1` ve aynı işlemli `selector` gerçek kaynağın kapalı `resource` ve opsiyonel `rule_id` seçimini okur. Yalnız o an ilgili merkezde canlı CM ve F02 yetkisiyle; organization/center/resource sınırı asıl availability komutuyla aynıdır. Sonuç güncel typed kural, ilgili availability_rules sürümü ve mevcut created_at_asc/cursor sayfalamasıdır. Yabancı kaynak NOT_FOUND; kayıp CM FORBIDDEN; farklı actor/selector kapsamındaki cursor VALIDATION_FAILED olur. Okuma receipt/audit veya availability kaydı oluşturmaz.

Şablon resolve sonucu kendi başına güncelleme sürümü değildir. İstemci bu okumadan aldığı expected_version ile mevcut availability_save_v1 komutunu çalıştırır; arada değişiklik varsa sürüm çatışması korunur. Sadece generic settings JSON saklama veya merkez sürümünü kural sürümü yerine kullanma kabul değildir. Bu okuma yeni bir endpoint veya yazma yetkisi açmaz; mevcut typed yönetim seçicisini tamamlar.

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

## Google bağlama hazırlığı

account_google_link_prepare_v1 isteği client_api_version/request_id/reauth/google_id_token içerir. Reauth mevcut aynı native session’dan taze sign-in tokenıdır; MFA varsa signed+live aal2 gerekir. Önce Google Identity Services/Expo sağlayıcısından Google ID token alınır. Backend tokenın sub alanını yalnız hedef kısıtı olarak alır; bu parse imza doğrulaması veya bağlama başarısı değildir. Yanıt {provider:google,status:ready,expires_in:10}; ardından native Auth ID-token grant/link_identity=true aynı Google token ve gerekli nonce ile tamamlanır. Native imza/issuer/audience/nonce kontrolleri atlanmaz. Yetki yalnız exact Google subject/hesap/session/süre içindir; farklı subject, eski session, ban/silinme ve süresi dolmuş niyet reddedilir. Son kullanılabilir yöntem silinmez. Redirect URL üreten eski taslak kullanılmaz. Token/nonce/reauth receipt, audit veya log’a yazılmaz.

Hesap iletişimi için e-posta/telefon request/resend/verify native Auth SDK’sındadır; ilk e-posta/parola kaydı aşağıdaki kayıt tüketicisini kullanır. account_get_v1.identity doğrulanmış güncel ve pending alanları ayırır; pending org kayıtlarına yayılmaz. E-posta değişiminde çift doğrulama ve eski proof/expiry kapıları native sağlayıcıda kalır. Native email değişimi oturum tokenını yenilerse dönen oturum kullanılmalıdır; eski tokenla tekrar denenmez. SMS sağlayıcı kabulü ayrı ortam işidir; numara kaydı gerçek SMS teslimi olarak gösterilmez.

### E-posta parola kayıt tüketicisi

`account_signup_request_v1` (H, anonim, `auth.signup`) için typed request: `client_api_version`, `request_id`, `email`, `password`; opsiyonel `email_redirect_to`, birlikte verilen `code_challenge`/`code_challenge_method: "s256"`, native CAPTCHA açıksa `captcha_token`. PKCE verifier istemcide kalır; callback’te native `exchangeCodeForSession` akışı kullanılır. Redirect izin listesini native Auth uygular. Provider user/session yanıtı bu operasyondan dönmez; metadata, hesap veya rol alanı gönderilmez.

| Typed sonuç | İstemci davranışı |
|---|---|
| `ok:true, data.status:"account_exists"` | [XREQ-001 ürün kuralındaki](contracts/02-FtkSaaS-teknik-sozlesme.md#kayıtta-mevcut-adres-xreq-001) mesajı göster; giriş/Google/parola yenileme seçeneklerini sun. Otomatik resend veya ikinci native signup yapma. |
| `ok:true, data.status:"confirmation_required"` | Native e-posta doğrulamasına yönlendir; oturum açılmış sayma. |
| `WEAK_PASSWORD` / `BOT_VERIFICATION_FAILED` | Native parola kuralına uygun yeni parola veya taze native CAPTCHA ile kullanıcı yeniden deneyebilir. |
| `RATE_LIMITED` | Backend IP sınırı; bekle ve kullanıcı denemesiyle sürdür. |
| `RESULT_NOT_CONFIRMED` | Sonuç belirsiz; otomatik tekrar/native fallback yok. Giriş/kurtarma seçenekleri ve gerektiğinde destek. `operation_status_get_v1` bu Auth dispatch’inin takip API’si değildir. |

Tarayıcı secret taşımaz. Backend’in [Vercel transport’u](../apps/backend/transports/account-signup-gateway.mjs) frontend sunucu route’una bağlanır; platformun üzerine yazdığı bağlantı IP’si, tam body/path/time HMAC imzasına katılır. `FTK_SIGNUP_HOSTNAME`, `FTK_PUBLIC_BACKEND_ORIGIN`, `FTK_PUBLIC_ANON_KEY`, sunucuda `FTK_PUBLIC_INGRESS_SECRET` gerekir. Edge aynı ingress secret ve `FTK_PUBLIC_HASH_SECRET` kullanır; hosted native gönderim `FTK_P07_AUTH_DELIVERY_ENABLED=true` ile açık olmalıdır. Native Auth’ta e-posta kaydı ve e-posta doğrulaması açık olmalıdır; sağlayıcı ayarı uygun değilse kapalı kalır. Native CAPTCHA tokenı yalnız Auth’a bir kez gider; ayrıca Turnstile zorunluluğu getirilmez. Frontend route’u ve gerçek hosted ekran/provider kabulü ayrı entegrasyon işidir.

Doğrulanmamış telefon account_profile_update_v1.unverified_phone ile E.164 biçiminde kaydedilir; null yalnız bu doğrulanmamış kaydı temizler, alanın gönderilmemesi mevcut değeri korur. account_get_v1.identity.unverified_phone ayrı döner; identity.phone/phone_verified_at yalnız native doğrulama kaynağındandır. Aynı numaranın doğrulanmış native değer olması halinde doğrulanmamış kopya gösterilmez. Org canonical iletişimlerine otomatik yayılmaz, giriş/sahiplik kanıtı değildir. Native SMS pending_phone ile aynı alan değildir. Sürüm/receipt/profile audit mevcut yol üzerinden korunur. Kaynak ve ortam kabulü güncel kabul kaydında izlenir.


Native Auth CAPTCHA/token seçenekleri sağlayıcı yapılandırmasına göre kullanılır; public Turnstile ile karıştırılmaz. Kurtarmada mevcut native oturum korunur, istemci zorunlu global signOut/ikinci completion RPC çağırmaz. Gerçek SMS kapalı/erteli olduğunda numara kaydı doğrulama başarısı olarak gösterilmez.

## Public işletme alanları tüketicisi

Katalogv5 organization/center `public_profile_enabled:false`, `public_fields:[]`, `public_hours:[]` ekler. Org Owner/OM ve merkezde canlı CM mevcut yazma/sürüm/replay/history kapısını kullanır. Başka scope veya serbest alan yazılamaz. Her scope seçimi yereldir, otomatik miras/kopya yoktur; seçili reset yalnız o alanı sistem defaultuna döndürür. Org public_profile_enabled yayın üst kapısıdır; center ayrıca kendi açık yayınını ve alanlarını ister. Varsayılanlar isim dahil tanıtımı açmaz.

`public_calendar_get_v1` aynı takvim items/pagination yanına nullable `organization_profile` ve `center_profile` ekler. Org UUID slug veya mevcut yayımlanmış slug bağlamında yalnız canlı F25 ve normal/grace erişimde tanıtım döner. center_profile yalnız istekte açık center_id ve aynı orgda erişilebilir merkez içindir. Bilinmeyen/yayımlanmamış bağlam null verir. Takvim publications kendi açık published kararını kullanır; tanıtımı kapatmak mevcut seans yayınına müdahale etmez. Public HTTP yanıtı no-store'dur; istemci kapanan alanları sonraki okumada temizler, dış kopyanın silindiği iddia edilmez.

Alan beyaz listesi name/description/logo/address/contact/hours'tur. Billing, kişisel hesap iletişimi, roller, kaynak uygunluğu ve iç ayar belgesi açılmaz. contact yalnız işletmenin açık contact_phone/contact_email alanıdır. Logo güncel private org pointer'ından `{asset,data_base64}` döner; kaldırma/değişim bir sonraki okumaya yansır, asset ID ile tarihsel public okuma yoktur. Center aynı org logosunu ancak org public_fields.logo da açıkken kullanabilir; merkez marka override yoktur.

public_hours açık tanıtım saatleri dizisidir; her satır ISO1–7 weekdays, HH:mm:ss local_start/local_end ve geçerli IANA timezone ister. Gece aşımı desteklenir; eşit başlangıç/bitiş reddedilir. Default[] saat ilan etmez.100 satır mevcut yapılandırılmış JSON dizi tavanıdır, plan kotası değildir. Bu bilgi oda/eğitmen availability veya rezervasyon kapısı yerine geçmez; iş takvimi değişikliği kendi domain komutudur. UTC seanslar, mevcut program ve ücret snapshotları değiştirilmez.

## Manuel tahsilat yöntemi

`collection_record_v1.payment` opsiyonel kapalı ManualCollectionPayment nesnesidir: method cash/bank_transfer/card_pos, reference opsiyonel string|null. Banka ve kart/POS için boş olmayan reference zorunludur; yalnız whitespace geçerli referans değildir. Nakit referansı isteğe bağlıdır; gönderilirse aynı biçim koşulu geçerlidir. Eski payment göndermeyen istemci/kayıtta değer null (belirtilmemiş) kalır; tarihsel tahsilata nakit yöntemi atanmaz. Yeni istemci açık seçilen yöntemi gönderir, otomatik tahsilat/ödeme sağlayıcısı açılmaz.

Snapshot gerçek cash_movements INSERT'i ile mevcut borç dağıtımı/öğrenci alacağı/receipt transaction'ında saklanır. Retry yeni hareket yaratmaz. SQL CHECK aynı kapalı nesne ve whitespace denetimini uygular. finance_get_v1.movements.items[].payment yalnız mevcut canlı finans read yetkisiyle okunur; kişisel paylaşım/public takvimde yoktur. Geçmiş kayıt ve düzeltmeler yöntemi değiştirmez; payment:null bilinmeyendir, cash değildir. Tutar, currency, finans yetkisi ve bağımsız iade/düzeltme komutları korunur.

## Kişisel takvim bağlantısı

Gerçek korumalı `/organizasyon/{org_id}/seans/{session_id}` route’u kaynakta vardır. FTK_CALENDAR_SESSION_URL_TEMPLATE, development host ve GET/HEAD→Edge→SQL→ICS→yetkili seans ekranı zincirinin gerçek ortam kabulü, rotate/revoke/erişim kaybıyla birlikte ST-03 kapsamında izlenir. Route varlığı hosted template/config kabulü değildir; açık işin tek sahibi [backlog](../apps/backend/docs/remaining-work.md).

Yeni own-account API'leri calendar_links_get_v1, calendar_link_create_v1, calendar_link_rotate_v1 ve calendar_link_revoke_v1'dir. Otomatik bağlantı yoktur. Oluşturma explicit organization_scope:{org_id} ve boş olmayan unique kinds:[lessons,duties] seçimi ister; bu global hesap kaynağına başka actor/account/person seçicisi eklenmez. Starter event/F29 açılmaz. Ders kesin active kendi reservation, görev active kendi instructor/assistant ataması ve canlı rol ile gelir; aynı seans iki yoldan uygunsa tek item'dır. Merkez, Starter scope_required ve selected session read guard'ları korunur. Gelecek/devam eden planned seanslar okunur; intent/waitlist/başka katılımcı veya finans kaydı yoktur.

Liste kendi bağlantı metadata'sını (link.id/org_id/kinds/state/version/created_at) ve standart sayfayı döndürür. service_ready yalnız teknik origin/route-template/key hazırlığıdır, seçili org yetkisi veya gerçek hosted servis kanıtı değildir. supported_kinds iki Starter türüdür. Create/rotate sonucu global receipt.primary_id olarak kendi account ID'sini, ayrıca link metadata'sını ve Edge tarafından eklenen subscription_url'yi taşır. Komutlar hesap credential lifecycle/auth sınıfındadır; iş kaydı düzenlemez. Rotate/revoke expected_version olarak link.version ister; client artırmaz. Ayrı read path calendar_links_get'tir. Kayıp org üyeliği/kapalı abonelikte kendi revoke işlemi mümkündür; Native Auth/global hesabın aktifliği korunur.

Link secret256bit, teknik yönetilen HMAC key + native auth ID + org + komut + operation_key bağlamına bağlıdır. Aynı retry aynı URL'yi üretir; DB yalnız hash'i saklar. Ham URL/secret receipt, context, immutable metadata history veya log'a yazılmaz. Hash ve canlı pointer olduktan sonra önceki create/rotate key replay'i eski URL'yi yeniden açmaz. Rotate eski URL'yi, revoke ilgili URL'yi sonraki erişimde kapatır. Yönetilen signing key değişirse mevcut hash tabanlı URL'ler kendiliğinden iptal olmaz; eski komutun yeni key ile retry'si kapalı kalır, yeni rotate gerekir. Şüpheli credential açık revoke/rotate ile kapatılır. Harici istemcinin önceden kopyaladığı veri silinmiş sayılmaz.

Public calendar_feed_get_v1 yalnız opaque token taşır; public Supabase JWT gate'i korunur. Edge tokenı hash'ler, service-only RPC'ye ham token göndermez. Feed her fetch'te native user/account, verified link/aktif kişi, org/plan F08, merkez ve kendi kesin rezervasyon/görev yetkisini yeniden okur. Account→org→link kilit düzeni write/revoke yarışlarıyla uyumludur. Sorgu seçili/izinli current title/time/place projeksiyonudur; UTC instants kullanıcı gösterim timezone'undan etkilenmez. İptal/bitiş/katılım veya görev/rol kaybı sonraki snapshot'tan item'ı kaldırır; org/account/link kaybı feed'i kapatır. URL bir rezervasyon/yoklama/yazma yetkisi vermez.

RFC5545 ICS üreticisi stable org+session UID, sequence, UTC DTSTART/DTEND, başlık/yer ve açık uygulama linkini kullanır. Text escape ve UTF-8 karakter sınırını bölmeyen75 octet folding uygulanır. İç not/ATTENDEE/borç/ödeme/başka iletişim/hatırlatma aktarılmaz.2MiB byte tavanı mevcut taşıma zarfından gelen teknik sınırdır; aşımda sessiz truncation yapılmaz. Harici takvim polling/hatırlatması sağlayıcının davranışıdır, anlık senkron veya dış kopya silme garantisi değildir.

Takvim uygulamaları custom JWT header gönderemediğinden backend HTTP adapter `pnpm --filter @ftksaas/backend calendar:proxy` normal GET/HEAD /calendar/{secret}.ics isteğini public anon JWT ile Edge POST'a çevirir; service_role içermez. SUPABASE_URL, public SUPABASE_ANON_KEY, PORT ve gerektiğinde HOST ile ayrı development host'a kurulur. Varsayılan listen host loopback'tir; production dağıtımı yapılmış sayılmaz. Tüm yanıtlar private,no-store; kapalı/unknown credential404, teknik hata503 verir; request URL'si loglanmaz. Supabase verify_jwt kapısı bu ihtiyaç için kapatılmaz.

Edge yönetilen config: FTK_CALENDAR_ORIGIN adapter'ın root HTTPS origin'i; FTK_CALENDAR_SESSION_URL_TEMPLATE frontend'in gerçek, org_id/session_id placeholder'lı tam route şablonu; FTK_CALENDAR_SIGNING_KEY32byte küçük harf hex secret. Route veya hostname uydurulmaz; alanlar tanımsızken service_ready:false ve create/rotate SERVICE_UNAVAILABLE, mevcut metadata/revoke kullanılabilir. Native CI yalnız loopback adapter origin'i, sentetik uygulama route'u ve ephemeral key üretir; hosted secret/deploy değildir. Native test gerçek HTTP GET→Edge→SQL→ICS üzerinden koşar; provider/gerçek frontend route kabulü ayrı kalır.

### Availability ve paket hazırlıkları

Organization/center `availability_templates` ve `package_templates` default boş dizidir. Hazırlıklar resource availability, ürün, satış veya hak oluşturmaz. Yeni merkez, açık org dizisini ve org belge sürümünü bir kez kopyalar; mevcut merkezler backfill edilmez, sonraki org değişimi eski merkezi değiştirmez. `SettingsView.preparation_sources` her alan için system_default/organization_copy/center_local ve kopyada organization_version döndürür. Eşit değerin açık yerel yazımı da center_local olur. Seçili reset sistem boş dizisine döner; güncel org şablonunu, uygulanan availability kaydını, ürünü veya satışı değiştirmez.

`settings_catalog_get_v1` center bağlamında `preparation_templates` ile o merkezde canlı CM'ye center/org hazırlık adaylarını gösterir; hedef merkez-disiplin ve Starter uygunluğunu resolver ayrıca denetler. Owner/OM org hazırlığını yazabilir; ilgili merkeze CM atanmadan domain uygulama yetkisi kazanmaz. `settings_preparation_resolve_v1` açık kind, destination center ve source:{scope,key,version,center_id?} ile güncel yetkiyi kaynak sürümünden önce denetler. Kaynak değişmişse VERSION_CONFLICT; çözüm mevcut kaydı değiştirmez. Her dizi için100 satır mevcut yapılandırılmış JSON teknik sınırıdır; ticari kota değildir.

Availability hazırlığı resource seçimini içermez. İstemci açık resource ve rule_index verir; sonuç mevcut `availability_save_v1` için resource/rule snapshot'ıdır. Haftalık günler, sıkı00–23 başlangıç saati,00–23 veya yalnız24:00:00 bitiş değeri ve geçerlilik tarihleri typed'dır; ters/eşit saat veya tarih reddedilir. İstemci yeni kuralı kaydeder veya mevcut kuralı `management_state_get_v1` sürümüyle günceller; gerçek program preview aynı kaynak uygunluğu denetimini kullanır. Çok aralık ayrı kurallardır; gece yarısı aşağıdaki açık24:00/00:00 sınırıyla bölünür.

Paket hazırlığı açık disiplin, terms ve başlangıç/bitiş tarihlerini ister. Starter terms kredili veya süreli; freeze kapalı, refund.method açık seçimdir. Eksik refund none sayılmaz; kredi için pozitif PG integer, parasal tutar için mevcut bigint ve quota için mevcut güvenli sayı sınırı korunur. `preparation_templates.package_currency_suggestion` yeni taslak için TRY'dir; eksik fiyat/hak/geçerlilik türetilmez. Çözüm hedef merkez+disiplin ve lesson kullanım kapsamıyla `product_publish_v1` terms snapshot'ı ve açık sale_dates döndürür. Öğrenci veya satış seçmez; gerçek publish→sale_preview→sale_apply zinciri kendi güncel yetki ve uygunluk kontrollerini tekrar yapar. Sonraki şablon/reset yayınlanmış ürünü veya satış koşulunu değiştirmez.

### Bildirim kullanılabilirliği

`SettingsCatalog.notification_delivery` salt okunur `NotificationDeliverySupport` nesnesidir; kanal/provider açma ayarı değildir. Şu an in_app hazır; email/push uygulama teslim kanalı hazır değildir. `notification_preferences_set_v1` desteklenmeyen kanalı SERVICE_UNAVAILABLE ile receipt replay'inden önce reddeder; email isteği in_app tercihini değiştiremez. Native Auth doğrulama/kurtarma e-postası bu uygulama kanalından ayrıdır. Zorunlu transactional in_app kapatılamaz.

Katalog güvenlik, rezervasyon/talep sonucu, iptal/değişiklik, yer teklifi, tahsilat/iade ve erişim değişimini mandatory_when_available listesinde açıklar. İlk in_app teslimi sessiz saat veya özete ertelenmez; timing/quiet-hours/digest controls_available false'tur. Katalogdaki24saat ders,7gün paket,3gün vade; instant/daily18/weeklySunday18 ve quiet-hours defaultoff değerleri kabul edilmiş seçenek/default bilgisidir, çalışan zamanlama mekanizması değildir. F27 lisansı ayrıca reminders.feature_licensed olarak döner; Starter false'tur. Desteklenmeyen kontrolün kaydedilmiş veya dış tesliminin yapılmış olduğu gösterilmez; yeni member/platform marketing default kapalıdır.


### Üye ilgi filtresi ve geçmiş takvim sırası

Mevcut authenticated `calendar_get_v1` isteğinde opsiyonel `interest_filter:true`, yalnız kendi member interest_center_ids/interest_discipline_ids seçimlerini uygular. İki boş olmayan boyut kesişir; boş boyut sınırlamaz. İstek verilmezse açık ilgi dahi genel takvimi değiştirmez. UUID yazım büyüklüğü kimliği değiştirmez. Filtre, zaten o an okuyabildiği takvim kayıtlarını daraltır; yeni session/katılımcı/başka merkez yetkisi vermez. Starter'da event türü açılmaz.

`page.sort:recommendation_desc` aynı yetkili kayıtları, yalnız o orgda history_recommendations açıksa kendi tamamlanmış, kapanmış, occurred ve attended derslerinin disiplin başına sayısına göre azalan sıralar. no_show/blocked, başkasının geçmişi ve okunamayan merkez/kapsam dahil edilmez. Merge edilmiş kendi kişi geçmişi mevcut P07 alias çözümüyle korunur. Eşitlikte starts_at/id/type kararlı sıradır; geçmiş kullanımı kapalıysa bütün skorlar0 ve normal kronolojik sıra vardır. Default sort starts_at_asc, geçmiş açık olsa da davranışa göre sıralamaz. Öneri sırası rezervasyon uygunluğu veya pazarlama izni değildir; yeni iş/receipt/kuyruk oluşturmaz.

Aktör/context backend tarafından bağlanır; account/person veya iç skor seçicisi isteğe eklenemez. İç geçmiş/skor yanıta açılmaz. Cursor request/aktör/effective preference sürümü ve kullanılan geçmiş sayımlarına bağlıdır; tercih, opt-out veya geçmiş düzeltmesi eski sayfayı VALIDATION_FAILED ile kapatır ve yeniden okuma gerekir. Seçili reset ilgi dizilerini boşaltır, geçmiş kullanımını kapatır; gerçek attendance/iş geçmişini silmez.

### Kesintisiz günlük availability sınırları

`AvailabilityRule` ve hazırlık karşılığı günlük başlangıçta00:00:00–23:59:59, bitişte buna ek yalnız24:00:00 kabul eder. Gece22:00–02:00 açıkça ilk gün22:00–24:00 ve ertesi gün00:00–02:00 olarak kaydedilir; weekday ve valid_from/valid_until her günlük parçaya aittir, valid_until exclusive kalır. Public tanıtım saatleri ayrı bilgi alanıdır.

Gerçek session/program/reservation kaynak uygunluğu bütün UTC [start,end) aralığının günlük pencerelerin birleşimince kapsanmasını ister. Bitişik aralıklar birleşir; tek saniyelik boşluk dahi RESOURCE_CONFLICT'tir. Yapılandırılmamış kaynak POLICY_NOT_CONFIGURED, açık kapanış/istisna RESOURCE_CONFLICT kalır. Eksik çalışma saati uydurulmaz; mevcut UTC seans/satış/yoklama snapshot'ı yeniden yazılmaz.

Her günlük sınır mevcut schedule_local_instant ile çözümlenir. Olmayan veya iki anı olan sınır için offset seçilmez; o pencere kullanılmaz ve başka açık pencere tam kapsamıyorsa uygunluk reddedilir.00–04 gibi sınırları belirsiz olmayan pencere DST günündeki gerçek3/5saati kapsayabilir. Resource-usage raporunun availability paydası da aynı pencereleri ve explicit exceptions farkını kullanır; Starter'a kapalı rapor özelliği açılmaz ve eski üretilmiş rapor yeniden hesaplanmaz. Gerçek native DST/availability kabulü kaynağından ayrıca doğrulanır.
