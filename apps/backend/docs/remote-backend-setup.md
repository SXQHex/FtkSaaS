# Backend işletim rehberi

Bu belge kurulum, dağıtım, worker ve restore prosedürünün sahibidir. Kaynak/ortam kabulü [güncel kabul kaydında](00-FtkSaaS-yeni-sohbet-devir.md), açık işler [backlog’da](remaining-work.md), ürün davranışı [ortak iş akışlarında](../../../docs/workflows.md) tutulur. Geçmiş denemeler canlı talimat olarak burada yinelenmez.

## Native parola güvenliği (XREQ-002)

Native Auth'ın mevcut parola kontrolü ve güvenlik e-postası [tek tüketici sözleşmesine](../../../docs/settings.md#parola-değişimi-ve-güvenlik-bildirimi) göre yapılandırılır. Kaynak [auth-password-security.mjs](../scripts/auth-password-security.mjs), ileti [native şablondur](../supabase/templates/password_changed_notification.html). Yalnız mevcut development projesi desteklenir. Kabul edilmiş kaynakta, backend dizininden:

```sh
node scripts/auth-password-security.mjs --plan
node scripts/auth-password-security.mjs --check gwyprhenabtpkbojephw
node scripts/auth-password-security.mjs --apply gwyprhenabtpkbojephw
```

Check/apply `SUPABASE_ACCESS_TOKEN` ortam değişkenini kullanır; secret komut satırına/yazıya konmaz. Plan ağ çağrısı yapmaz, check yalnız okur. Apply yalnız mevcut-parola/nonce, password_changed etkinlik/konu/şablon ve native e-posta OTP süresi alanlarını Management API ile yazar; sonra bağımsız GET ile birebir doğrular. SMTP/anahtar/Google/JWT/redirect izin listesi değiştirilmez; tam config veya credential çıktı verilmez. Auth SiteURL HTTPS kök origin olmalıdır; gerçek `/forgot-password` ve mevcut `/auth/callback?next=/reset-password` redirect izinleri önceden doğrulanır. Bu ayrı işletim adımıdır; SQL/Edge CD veya config.toml hosted ayarları otomatik uygulamaz.

CLI 2.122.0 native runtime `security_update_password_require_current_password` ayarını sunmaz; `content_path` verilirse desteklenmeyen template serving nedeniyle stack başlangıcını reddeder. Bu yüzden yerel TOML yalnız bildirim etkinliği/konusunu taşır; özel HTML hosted config aracından ve izole Auth testinin template endpoint'inden uygulanır. `secure_password_change=true` native nonce reauthentication'ı açar; mevcut-parola kontrolü ayrıca açılır. İki native kontrol birbirinin yerine geçmez. Gerçek kabul testi CLI'nin çalışan Auth binary'sini exact loopback DB/SMTP üzerinden bulur; aynı binary'yi ayrı geçici loopback portta, desteklenen native ayarlarla ve yalnız testin HTML endpoint'iyle başlatır. Binary sürümü/hash'i güvenli test tanısında kaydedilir. CLI süreçlerine, bağımlılıklara veya ortak stack ayarına müdahale etmez. Linux `/proc` gereklidir; destek yoksa test atlanmaz, başarısız olur. Süreç ve geçici özel dosyalar test sonunda temizlenir. Bu gerçek Auth/SMTP sink testidir; hosted config, dış posta veya tarayıcı/PKCE kabulünün yerine geçmez.

Hosted kabul: eksik/yanlış mevcut parola reddi; 24 saatten yeni/eski oturum, refresh sonrası eski oturumun nonce zorunluluğu, yanlış/süresi dolmuş/tüketilmiş nonce ve doğru mevcut parola + nonce ile değişim; yalnız kayıtlı ana adrese bildirim; gerçek bağlantıdan recovery/PKCE ve yeni parola; eski/yanlış/süresi dolmuş/tekrarlanmış proof reddi; diğer session refresh ve Edge erişiminin reddi, current recovery session'ın korunması. Parola tekrar eşleşmesi frontend kabulündedir. Native bildirim gönderimi best effort'tür: SMTP başarısızlığı parolayı geri almaz; Auth/provider logları kişisel veri/sırlar dışarı çıkarılmadan kontrol edilir. Production dağıtımı bu komutun kapsamı değildir.

## Ortam ve dağıtım

Geliştirme hedefi `gwyprhenabtpkbojephw` FtkSaaS Supabase projesinin production adlı branch’idir; bu ad müşteri production kabulü değildir. Gerçek kurulum verisi vardır. Reset/clean/seed yalnız izole loopback ortamında çalışır. Git SQL/Edge kaynağını taşır; çalışma verisini, sağlayıcı ayarını, secret’ı veya Storage baytlarını geri getirmez.

[Development CD](../../../.github/workflows/cd-development.yml) yalnız [CI politikasındaki](../../../docs/ci-policy.md) exact source/run/attempt/job kabulünden dağıtır. Her yazmadan önce current main ve kaynak eşdeğerliği yeniden denetlenir. Belge/frontend değişiklikleri backend girdilerini değiştirmiyorsa kabul edilen backend kaynağı ile expected_main ayrı kaydedilir; backend/shared/bilinmeyen fark eski kabulü geçersiz kılar. Başarılı aynı kaynak receipt’i ve canlı Edge hash/version/ACTIVE/JWT eşleşmesi tekrar deploy’u önleyebilir.

Migration içeriği manifest ve uzak migration geçmişiyle karşılaştırılır; bilinmeyen, sapmış veya yinelenmiş sürümde durulur. Otomatik history repair, reset veya seed yoktur. Uygulanan migration geri yazılmaz. Kabul edilen kaynak ilerletilir; önceki kod sürümüne dönmek DB’yi geri almaz. Edge dependency-complete bundle ve `verify_jwt=true` ile yayımlanır. Yerel config hosted provider aktivasyonu sayılmaz.

Smoke, dış e-posta göndermeyen sentetik native kullanıcıyla Auth→Edge→RPC, tenant/RPC/JWT/session, RLS/ACL ve fixture cleanup doğrular. Kullanıcının UUID’sine bağlı dar temizlik hata halinde de uygulanır. Smoke tüm workflow/sağlayıcı/restore kabulü değildir. CD metadata/DB-tip artifact’ının kapsam ve sınırı [dokümantasyon rehberindedir](documentation-development.md).

## Kimlik bilgileri ve sağlayıcı ayarları

Actions secret adları `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`; değerler log/rapor/kaynağa yazılmaz. Token yalnız gerekli proje/işlem yetkisine sahip olmalı, expiry ve rotasyonu operatör izlemelidir. `SUPABASE_NATIVE_DEPLOY_DISABLED=true` küçük harfle tutulur; native ve Actions dağıtıcıları aynı projeye birlikte yazmamalıdır. Variable, dashboard ayarının bağımsız kanıtı değildir. Environment main sınırı gerçek yönetim readback’iyle doğrulanır.

Native Auth ayarlarının hedefi teknik sözleşmenin S04/S05 hükümleridir; provider readback ve gerçek mail/Google/TOTP kabulü kaynak kaydında ayrı izlenir. Auth SMTP, uygulama davet/outbox göndericisi değildir. `deliver-dev-invitations.mjs` yalnız loopback Mailpit teslimidir; hosted davet teslimi olarak raporlanamaz. Yerel SMS test OTP’si hosted’a taşınmaz. Eski özel recovery harness’i yeni istemcinin yolu değildir; native kurtarma için özel reset trigger/ikinci completion eklenmez.

Public submit gateway ayarları `FTK_PUBLIC_APPLICATION_HOSTNAME`, `FTK_PUBLIC_INGRESS_SECRET`, `FTK_PUBLIC_ANON_KEY` ve isteğe bağlı HTTPS `FTK_PUBLIC_BACKEND_ORIGIN` kullanır. Edge tarafında ayrı ingress/hash/Turnstile secret’ları bulunur. Gerçek action/hostname ve güvenilir IP zinciri [WF09](../../../docs/workflows.md#wf09) ile eşleştirilir. İstemciye imza anahtarı verilmez. Native Auth CAPTCHA ile public Turnstile ayrı kabul edilir.

## Worker işletimi

Kabul edilmiş migration/rol kaynakları kurulduktan sonra [ops-cron-install.sql](../scripts/ops-cron-install.sql) yönetici oturumunda atomik çalıştırılır. Aynı ad/rol yeniden kurulumda job güncellenir; mükerrer görev yaratılmaz. Geçici provisioning üyelikleri ve Cron erişimi işlem sonunda kaldırılır. Beş dedicated LOGIN yalnız kendi worker grubunu devralır; superuser/createdb/createrole/replication/bypassrls verilmez. Gerçek `session_user` kapısı SET ROLE ile aşılmaz.

Tenant binding ilgili p01/p05/p06/p07 scope tablosunda açık organizasyon ve lane LOGIN rolüne bağlanır; privacy global null kapsamı ayrıca açık seçilir. Tenant/config uydurulmaz. Lane sözleşmesi [WF20](../../../docs/workflows.md#wf20); sağlık sorgusu [ops-cron-health.sql](../scripts/ops-cron-health.sql). Job owner/schedule/active ve gerçek heartbeat birlikte okunur; idle/claim0 gerçek iş yükü başarısı değildir.

Bir lane için `private.ops_worker_health.enabled=false` yeni claim’i durdurur; sürmekteki işi iptal etmez. Yeniden başlatma true ile yapılır. Tam scheduler durdurma ilgili job için `cron.alter_job(..., active:=false)`; kaldırma yalnız ilgili job için `cron.unschedule` ile yapılır. Cron extension’ını drop etmek rollback yöntemi değildir. `CALL private.ops_run(...)` tek başına autocommit çalışır; claim COMMIT yolu transaction bloğuna sarılmaz. Binding/rol kaybı kapalı kalır; yeniden binding önce yetki ve canlı kaynak doğrulanır.

Kesinti denetimi lease expiry/reclaim, aynı işte tek domain sonuç, hata rollback, disable/rebind/restart ve expired export byte temizliğini ayrı sınar. Üç işlik bounded kabul yük SLA değildir. Privacy partial/retry_wait manifesti DB/Auth/Storage/export/backup fiziksel imha kanıtı değildir.

## Managed restore prosedürünün sınırı

Kaynak ve hedef ayrı ve açık tanımlanır; deneme hedefi izole olmalıdır. Managed Auth/Storage şema sahiplerini platform kurar. Uygulama şema/rol/owner/ACL/RLS/policy/fonksiyon güvenlik ayarları korunur; `--no-owner/--no-acl` ile güvenlik farkı gizlenmez. Aynı read-only snapshot’tan veri ve uygulama migration geçmişi alınır; sağlayıcının kendi migration tabloları hedef platforma bırakılır. Rol üyelikleri mevcut grant zinciriyle karşılaştırılır, gereksiz grant tekrarları yapılmaz. Worker parolası veya provider secret’ı SQL dump’tan geri gelmiş sayılmaz.

Restore doğrulaması tablo içerik checksum’ları, etkin ACL (NULL için acldefault), RLS/policy ve fonksiyon owner/security-definer/config/EXECUTE karşılaştırmasını kapsar. Native kullanıcı gerçek girişle ve aynı UUID ile denenir; eski access token’ın farklı projede geçerliliği varsayılmaz. Edge aynı kabul edilmiş kaynaktan kurulur. Storage metadata ve bütün nesne baytları ayrı taşınıp checksum/erişimle doğrulanır. Scheduler/binding, gerçek iş yükü ve kesinti toparlanması ayrıca sınanır. Tek dosya veya idle worker deneyi bütün envanter kabulü değildir.

`auth.mfa_factors` üzerindeki history/removal-fence ve kimlik projeksiyon trigger’ları, private identity/contact/Google-link-intent tabloları owner/ACL ve purge envanterine dahildir. Faktör secret/OTP/token loga veya uygulama audit’ine taşınmaz. Kaldırılmış özel account_password_transactions/reset trigger taslağı restore listesine eklenmez. RPO/RTO; hazırlık, veri, Auth, Edge, Storage, config ve worker geri dönüşünü kapsayan gerçek ölçüm ister.

## P08 kurulum kaydı

23 Ekim’deki izinli tekil kurulum/aktarımın immutable kaynağı [main üzerindeki tarihli kayıt](https://github.com/SXQHex/FtkSaaS/blob/fe650618503be24eb117297dc412c4ae6fd8018c/apps/backend/docs/remote-backend-setup.md#p08-kurulum-kaydı) içindedir. Bu geçmiş durum güncel veri readback’i veya yeniden yönetici aktarımı yetkisi değildir. Tenant’a özel fiyat, dönem, limit ve ders sayıları genel ürün defaultu değildir. Sipariş/satış/tahsilat/yoklama birbirine çevrilmez. Yeni kapsamın tek sahibi [P08 kararıdır](../../../docs/decisions/P08-accepted-scope.md).

## Restore ve yeniden canlanma engeli

`apps/backend/scripts/restore-guard.mjs` restore öncesinde silinmiş subject referanslarını denetler. Restore/purge yapmaz, erişim açmaz. Başarılı çıktı yalnız JSON referans taramasıdır; Storage, config, WAL/MVCC ve backup expiry ayrıca doğrulanır. Genel privacy orkestrasyonu ve hosted uçtan uca kabul açık kalır.

```sh
node apps/backend/scripts/restore-guard.mjs --snapshot /private/snapshot.json --ledger /independent/current-erasure-ledger.json --trust /independent/current-restore-trust.json
```

Trust dosyası yedekten alınmaz. Restore anındaki bağımsız sicilden güncel açık anahtar, ledger SHA256/sequence ve kaynak ref alınır; seçilen snapshot SHA256 ile bağlanır. Araç eski ama kendi içinde tutarlı trust/ledger çiftinin gerçekten güncel olduğunu dış servise bağlanmadan bilemez. Güncel bağımsız head'i elde etmek pipeline/operatör sorumluluğudur; eski trust ve ledger'ı birlikte geri yüklemek yasaktır. Özel anahtar istenmez.

Trust alanları: format=1, source_project_ref, snapshot_sha256, ledger_sha256, ledger_sequence, ledger_public_key_pem. Ledger alanları: format=1, source_project_ref, sequence, issued_at, erasures, signature. Girdiler request_id, kind(account/organization), subject_ids, completed_at içerir. Signature dışındaki payload anahtarları sıralanmış canonical JSON olarak Ed25519 ile imzalanır; timestamp UTC ISO milisaniye biçimindedir. Silme orkestrasyonu tüm silinmiş kök/bağlı subject kimliklerini sicile yazmalıdır; eksik sicil kapsamını bu araç keşfedemez.

Snapshot project_ref ve tables dizisi içerir; tablolar schema/table/rows biçimindedir. UUID referansları kök/foreign key/JSON değer ve anahtarlarında/metin içinde aranır. Eşleşmede bütün aday reddedilir; hukuki arşiv dahil hiçbir satır sessizce filtrelenmez. Digest/imza/sequence/proje/şema hatası başarısız çıkış üretir. Çıktı yalnız güvenli sayım/hash/kapsamdır; satır veya kimlik basılmaz. Bu kapı geçse bile diğer restore/non-resurrection kontrolleri tamamlanmadan hizmet erişimi açılmaz.


### Sicil adaptörü ve zorunlu doğrulama sınırı

`erasure-register.mjs` bağımsız dosya siciline imzalı kayıt ekler: caller beklenen önceki hash/sequence'i sağlamalıdır. Aynı kayıt tekrarı byte-identical replay'dir; aynı request_id/farklı içerik reddedilir. Tek writer lock, exclusive pending dosyası, fsync ve atomik rename kullanılır. Çökmeden kalan lock/pending otomatik silinmez: operatör önce yaşayan writer olmadığını, imzalı son head'i ve bağımsız checkpoint'i doğrular. Rename sonrası fsync hatasında commit sonucu belirsizdir; kör retry yerine head okunup CAS ile karşılaştırılır.

Bu modül hukuki onay veya purge kanıtı üretmez. İmzalama anahtarı yalnız doğrulanmış silme sonucunu kaydeden orkestratöre verilmelidir. Sicil dizini/anahtar ve rollback'i engelleyen güncel head checkpoint'i restore kapsamının dışında, ayrı yetki ve yedeklemeyle işletilmelidir. Yerel test dosyaları üretim sicili kurulumu değildir. Saklama/expiry, anahtar yönetimi ve bağımsız kalıcı depolama kabulü henüz açıktır.

`guarded-restore.mjs` aynı sicil kilidi altında guard'ı çalıştırır; adaptöre yalnız doğrulanmış ve recursive frozen snapshot'ı verir. Guard reddinde adaptör çağrılmaz; adaptör hatası yukarı taşınır. Son head yeniden kontrol edilir. Caller adaptörü transaction/rollback ve yeniden deneme sınırını kendisi sağlamalıdır; callback başarısı hizmet açma izni veya tüm DB/Auth/Storage restore kanıtı değildir. Mevcut hosted SQL yükleyicinin bu adaptöre bağlanması ve erişim kapısı entegrasyonu henüz tamamlanmadı.
## XREQ-001 kayıt transport’u ve belirsiz sonuç kurtarması

[WF01 kayıt tüketicisi](../../../docs/settings.md#e-posta-parola-kayıt-tüketicisi) için frontend sunucu route’u backend’in `handleAccountSignup` adapter’ına bağlanır. Vercel dışında `x-vercel-forwarded-for` güvenilir kabul edilmez; başka ingress için platformun doğruladığı bağlantı IP’sinden eşdeğer imza üreten adapter gerekir. Caller authorization/cookie/x-ftk başlıkları upstream’e geçirilmez. Host/origin, body boyutu, kapalı yanıt ve `no-store` korunur. Native fallback ve otomatik resend yoktur.

Gateway `FTK_SIGNUP_HOSTNAME`, `FTK_PUBLIC_BACKEND_ORIGIN`, `FTK_PUBLIC_ANON_KEY`, `FTK_PUBLIC_INGRESS_SECRET`; Edge aynı ingress secret, `FTK_PUBLIC_HASH_SECRET`, platformun `SUPABASE_ANON_KEY` ve service anahtarını kullanır. Hosted gönderim ayrıca mevcut `FTK_P07_AUTH_DELIVERY_ENABLED=true` anahtarını gerektirir. Secret’lar istemci bundle/log’una konmaz. `FTK_PUBLIC_HASH_SECRET`, açık dispatch kaydı varken plansız değiştirilmez: adres parmak izi değişirse eşzamanlılık koruması ayrışır. Native email signup + confirmation açık olmalıdır; `GET /auth/v1/settings` bu koşulu doğrulamadan proxy dispatch yapmaz. Native CAPTCHA yapılandırılmışsa token Auth’a bir kez iletilir.

`private.account_signup_claims` süresiz belirsiz dispatch tutar; bir süre geçti diye silinmez veya yeniden atanmaz. Native success + gerçek kullanıcı satırı birlikte görülürse normal tamamlanma claim’i siler. Kesin yan etki öncesi `weak_password` ve `captcha_failed` reddi de aynı deneme sahibinin claim’ini bırakır. 5xx, bağlantı kopması, bozuk yanıt veya sınıflandırılmamış native 429 sonrası `RESULT_NOT_CONFIRMED` döner. IP sayacı S04’te kabul edilmiş 30/5dk/IP sınırını yalnız proxy varlık sorgularına uygular; native sağlayıcı limitlerinin yerini almaz.

Destek incelemesinde hedef adres güvenli kanaldan alınır; aynı HMAC ile yalnız ilgili claim/deneme/zaman bulunur. Kullanıcıya hesap/kimlik/rol ayrıntısı verilmez. Auth’ta satır yokluğu, fetch abort veya geçen süre önceki çağrının sona erdiğinin kanıtı değildir. Claim ancak ilgili native isteğin kesin terminal reddi ya da artık commit edemeyeceğine ilişkin sağlayıcı/işletim kanıtı alındıktan sonra, hedef hash + beklenen attempt_id koşuluyla yetkili tek işlemde kaldırılabilir. Böyle bir kanıt yoksa fail-closed kalır; otomatik bakım/cron silmez. Native kullanıcı silme, başka hesaba bağlama veya parola değiştirme bu kurtarmanın parçası değildir. Gerçek hesap mevcutsa normal varlık yanıtı alınır; ayrı native giriş/kurtarma/manuel resend akışları kullanılabilir.

Yerel/CI kabulü gerçek Auth, service-only RPC, sentetik Google kimliği fixture’ı ve SMTP sink üzerinde dört ürün senaryosunu, eşzamanlı kayıtları, zayıf parola düzeltmesini ve gecikmiş native tamamlanmayı sınar. Sentetik kimlik gerçek Google OAuth/browser kanıtı değildir. Proxy dışı native yollar aynı claim’e katılmadığından eşzamanlı native oluşturma/kimlik değişimi için global posta göndermeme garantisi yoktur. Hosted route/config ve gerçek ekran/provider kabulü ayrıca doğrulanır.
