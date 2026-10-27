# Teslim1 kimlik/iletişim ara kayıt — kabul değildir

Başlangıç main26e7091cd73482a623839266324b049d617fe9c2,212/64; uygulama taslağı212/65. Kullanıcı ilk satır eksiksiz bitmeden sonraki satıra geçilmemesini istedi; platform e-postalarında Resend kullanımını onayladı. Hosted veriye yazılmadı, yeni full/targeted CI istenmedi.

Yerel65 migration compile, mevcut149 yapısal test ve sentetik SQL current-name/confirmed-contact/unlink/guard kontrolleri geçti. Bunlar native proof veya hosted kabulü değildir. Native Docker yerelde yoktu; tek7dk/2vCPU nonpersistent Sandbox sbx_EJ6zMwVOGvhzEZrOgRZRDHi7hlrd kullanıldı ve420689ms sonunda durdu.

İlk dar native account-identity + mevcut p07-account-profile-merge:16test12pass4fail,89452.189731ms, shell exit1. İki gerçek problem: testin domain’de bulunmayan people inactive durumu istemesi (active/merged enumu korundu, reactivation özelliği uydurulmadı), alias native contact kopyalarının PersonView’de mükerrer görünmesi (physical geçmiş korunarak kind/value ve verified_at önceliğiyle current görünüm dedupe edildi). Eski finans/hak/tahsilat assertionları kaldırılmadı; verified canonical contact’ın org komutuyla silinememesi ayrıca istendi.

Düzeltilen kaynakta ikinci iki-suite:8test5pass3fail,21941.557894ms, shell exit1. Native own-name/current contact, unverified phone reddi, org reopen/unlink freeze, mapping lifecycle ve gerçek iki-client ters link-lock contention geçti; son rollback read ve eski profile suite boş HTTP503/content-type=null transport hatası verdi. Temiz native kabul yoktur. Son tek-suite tekrar komutu cmd_043bb2d0138645c08d3f6510bb3e için Sandbox durduğu için log alınamadı (410); sonucu bilinmiyor, başarıya çevrilmedi.

Bağımsız inceleme reopen catch-up, stale mapping, ters link/person row lockları ve inactive mapping cleanup mutex dalını buldu. Bunlar düzeltildi; kaybeden try-lock transaction TEMPORARY_FAILURE ile rollback olur. Native ters ön-kilit testi ilk fanout beklerken ikincinin tamP0001/TEMPORARY_FAILURE aldığını, rollback sonrası ilk commit+retry’yi doğruladı (ilk91.211ms, son56.700ms). Son kaynakta yeni somut bloklayıcı bildirilmedi fakat exact-tree/final kabul verilmedi.

Resend eklentisi domain/key metadata’yı okudu: doğrulanmış fethiyetango.com, sending enabled, SPF/DKIMverified, open/clicktracking kapalı. Key secret okunmadı/oluşturulmadı, mail gönderilmedi. Mevcut key adları/hassas değerler kayda konmadı. Hosted public native Auth: Google=false, phone=false, email=true, mailer_autoconfirm=false, phone_autoconfirm=false. TOTP public endpointten doğrulanmadı.

SMTP tasarımı native Supabase Auth→Resend custom SMTP; ikinci token/proof motoru yok. Gerçek yönetim yapılandırması, restricted sender-key güvenli yerleştirme, Google OAuth client/native giriş ve SMS sağlayıcısı açık. İletişim request/proof lifecycle/old-channel notification ve global başlangıç adı tutarlılığı tamamlanmadan ilk satır kapanmaz; production-queue aktif kayıt otoritesidir.

## Kritik kaynak hash’leri

- database/account-identity-projection.sql: `5b30e7964129669bbe2f6433fb0fd592a94a052a7c103a9cb22f473fde0100de`
- supabase/migrations/20261026003615_account_identity_projection.sql: `5b30e7964129669bbe2f6433fb0fd592a94a052a7c103a9cb22f473fde0100de`
- tests/account-identity-acceptance.mjs: `e278a85cf353975e720f1d444b283012b5f2f9a3e3f82bbe23bc8cb1f1e3a57e`
- tests/p07-account-profile-merge-acceptance.mjs: `16554f2be1595ba902363211ce32a9cec6249986e25a7c02adcc4bc506ba394e`

## 26 Ekim04:26 — SMTP sağlayıcı teslim kanıtı

Yukarıdaki sağlayıcı kurulmadı/mail gönderilmedi notları ilk taslak anına aittir. Kullanıcı tarayıcı fallback ve sender hesabını onayladı. Resend eklentisiyle domain-scoped sending-only SMTP anahtarı oluşturuldu; kullanıcı Supabase password girişini ve kaydı tamamladı. Reload sonrası SMTP enabled, smtp.resend.com:465, FtkSaaS/hesap@fethiyetango.com ve stored-password durumu doğrulandı. Anahtar değeri bu kayda eklenmedi.

Native /auth/v1/recover HTTP200 döndü. Resend eklentisinde mesaj01a175d0-9e56-72ba-974f-753a819bd761, konu Reset your password, sent2026-10-26T01:26:08.908Z, status delivered görüldü. Gerçek SMTP→sağlayıcı→alıcı sunucu teslimi doğrulandı; inbox/spam yerleşimi, proof completion veya parola değişikliği kabulü değildir. Kurtarma bağlantısı açılmadı.

Hosted MFA dashboard TOTP Enabled, maximum factors10 ve AAL1 session duration limit enabled gösteriyor. Ayarlar değiştirilmedi; gerçek hosted enrollment/challenge/verify/strong access/removal kabulü açık. Google/Phone provider disabled ve manual linking off gözlemlendi. İlk teslim1 hâlâ açıktır; yeni full clean veya sonraki satır başlatılmadı.

## 26 Ekim — tek profil başlangıcı ve hosted güvenlik kabulü

Yeni başlangıç profil kaynağı backfill + core.accounts AFTER INSERT initialize ile donduruldu; mevcut explicit profil korunur. Raw native metadata değişimi artık ikinci canlı ad kaynağı değildir. Yeni native regression senaryosu eklendi fakat henüz native yeniden koşulmadı. PGlite65 migration compile ve sentetik yeni/bağlı hesap metadata değişimi, guard, confirmed-contact ve unlink davranışı geçti. npm run verify149/149 (103+46) geçti. Dar bağımsız kaynak incelemesinde ek bloklayıcı bildirilmedi; final exact-tree kabulü değildir.

Hosted kabul mevcut yayımlanmış main26e7091cd73482a623839266324b049d617fe9c2/64 migration üzerindedir; yerel65 taslağının kimlik yayılımı kabulü değildir. Tek disposable Auth hesabı normal native signup ile oluşturuldu; Resend01a175d4-a3b9-720a-95a1-f7bd497ca54f delivered; gerçek mail token_hash native verify ile doğrulandı. Aynı proof yeniden kullanımı reddedildi; Auth→Edge account_get başarılı. SQL ile auth.confirmed alanı veya MFA proof yazılmadı.

Gerçek native TOTP enroll→yanlış-code reddi→doğru challenge/verify→aal2 Edge account_get→kendi güvenlik geçmişinde tek totp_enabled geçti. Eski aal1 JWT backend erişimi reddedildi. Hem eski aal1 hem doğrudan güçlü native DELETE reddedildi; yalnız account_totp_remove_v1 güncel güçlü reauth ile başarılı. Tekrar kaldırma removed=true, verified factor yokluğu, geçmişte tek totp_disabled ve secret bulunmaması doğrulandı. Bu hosted TOTP ana lifecycle kabulünü kapatır; yeni65 trigger/restore ve final kaynak CI kabulü ayrı kalır.

Test hesabı global logout yapıldı; önceki refresh token ve eski güçlü JWT ile Edge erişimi reddedildi. Geçici parola/token/TOTP secret dosyası kaldırıldı. Sentetik hesap kaydı ve güvenlik geçmişi korundu; gerçek kullanıcı hesabının parolası/faktörü değiştirilmedi.

## Google sağlayıcısı kullanıcı kurulumu sonrası

Gerçek Web OAuth Client ID/Secret kullanıcı tarafından dashboard’a girilip kaydedildi. Google Enabled, Save disabled; nonce atlama ve e-postasız kullanıcı istisnası kapalı. Secret reveal edilmedi. Native authorize Google temel ad/profil/e-posta izin ekranına ulaştı. Kullanıcı consent ve callback/token exchange tamamlanmadı; sağlayıcı tam başarılı kabul edilmedi. Bağımsız Gmail girişi farklı Hotmail hesabıyla otomatik hesap birleştirme değildir.

## Google gerçek giriş→Edge kabulü

Kullanıcı Google temel profil/e-posta consent adımını tamamladı. Native OAuth callback access token üretti; token doğrudan backend-v1/account_get_v1 üzerinde HTTP200/ok=true ile doğrulandı. SQL Google native identity, email_confirmed_at ve canlı Auth session’ı doğruladı; core.account UUID01a175e9-3433-71fc-8724-ddd4c5f96c6a. last_sign_in_at2026-10-26T01:51:55.156Z. Secret reveal edilmedi, access/refresh token rapora veya kaynak dosyasına yazılmadı. Test session için local logout istendi; callback token içeren geçici tarayıcı sekmesi kapatıldı.

Callback sonrasındaki ftksaas.vercel.app adresi404 DEPLOYMENT_NOT_FOUND gösterir; mevcut frontend deploy yokluğu Google/native Auth→Edge kabulünü geçersiz kılmaz ve bu backend işinde frontend deploy yapılmadı. Bağımsız Gmail girişi farklı Hotmail hesabına bağlanmadı. Authenticated Google bağlama/son kullanılabilir giriş yöntemi koruması ve yeni65 kimlik kaynağı kabulü hâlâ açık; ilk satır tamamlandı değildir.

Yeni yerel native-security trigger ve last-usable unlink guard farkı: npm verify149 ve65 migration compile geçti; native lifecycle testler henüz koşmadı. Google ikinci identity SQL fixture yalnız unlink guard sınar, gerçek OAuth proof sayılmaz. Eski-kanal bildirim sağlayıcı ayarları/kabulü hâlâ açık.

## Son kaynak213/65 ve dar runtime durumu

Yeni Google prepare API’si exact subject/aynı fresh session/10sn ile sınırlandı; redirect niyeti kaynak incelemesinde bulunan bypass’lar nedeniyle kaldırıldı. Native signature/audience/issuer/nonce doğrulaması son link adımında zorunlu. Bağımsız izole SQL negatifleri geçti; final kabul yok. npm verify149 ve65 compile geçti.

İlk10dk Sandbox sbx_YeB9BAOck5bLv0MZA586sTSVGOnd süre sınırında kapandı. İlk startup bundle212/DB65 uyuşmazlığı sonrası213 regenerate+restart yapıldı. İki-suite13node5pass8fail; email autoconfirm nedeniyle double-confirm testi yanlış ortamda koşuyordu, confirmations true olarak sıkılaştırıldı. Sonraki email lifecycle adımı geçti; unlink ve ardından oturum/phone fixture kaynaklı hatalar sürdü, P07alias suite boş503 transport ile durdu. Son kısa native test de exit1; temiz kabul yok. Bu ortamdan görülebilen sonuçlar başarıya çevrilmedi.

Yerel native start root kısıtı giderilerek daemon uid1 ile denendi; gerekli Supabase PostgreSQL artefaktları github.com ve alternatif artifact host DNS ETIMEOUT nedeniyle indirilemedi. Hosted reset yapılmadı. Yalnız dar kimlik suite’i için tek ek5dk Sandbox sbx_Re96FkP4Cc1RyZJVsjpqdhWJsqyZ açıldı; çalışırken kapsam genişletilmedi.

## Son dar native sonuç — temiz kapsam ayrımı

5dk sbx_Re96FkP4Cc1RyZJVsjpqdhWJsqyZ: ilk10node4pass6fail sonrasında Native Auth logu synthetic Google identity.created_at=null Scan error gösterdi. Fixture created_at/updated_at/last_sign_in_at dolduruldu; assertionlar korunarak aynı suite10/10, exit0,26420.528ms geçti. Tam native log /workspace/scratch/69a55cf39471/identity-native-accepted.log olarak süre dolmadan korundu; SHA256 aşağıdadır. Bu native email expired/replaced/resend/double-confirm/collision, current identity/link mapping/try-lock/rollback ve unlink guard kabulüdür. Google ID-token hazırlık API’sinin gerçek sağlayıcı uçtan uca kabulü ayrıca açık.

Mevcut p07-account-profile-merge suite’i9node7pass2fail,75987.728ms, exit1: person_merge_approve_v1 boş HTTP503/content-type null/bytes0; parent fail. Bu temiz native kabul değildir. Retry eklenmedi, assertion/timeout gevşetilmedi. İkinci Sandbox da süre sınırlıdır; yeni ortam açılarak kota tüketilmez. Yerel native artefakt indirmesi iki hostta DNS ETIMEOUT ile engellidir.

Yeni private.account_google_link_intents restore/purge envanterine dahil edilmelidir. Hosted7 native security email notification toggle reload sonrası checked/save-disabled doğrulandı; eski-kanala gerçek değişim bildirimi teslimi henüz sınanmadı. Hosted SMS sağlayıcısı yok; gerçek telefon teslimi veya Google manual-ID-token binding kabulü tamamlandı gösterilmez. Full/main/production dağıtımı başlatılmadı.

Native log SHA256: `411cd358c94db24ea3e8d55c15a4e63732052e57e3ab70ab7502cc962bdcb742`.

Doğrulanmamış telefon yerel65 adayında account_profile_update_v1.unverified_phone ile E.164 biçiminde kaydedilir; null yalnız bu doğrulanmamış kaydı temizler, alanın gönderilmemesi mevcut değeri korur. account_get_v1.identity.unverified_phone ayrı döner; identity.phone/phone_verified_at yalnız native doğrulama kaynağındandır. Aynı numaranın doğrulanmış native değer olması halinde doğrulanmamış kopya gösterilmez. Org canonical iletişimlerine otomatik yayılmaz, giriş/sahiplik kanıtı değildir. Native SMS pending_phone ile aynı alan değildir. Sürüm/receipt/profile audit mevcut yol üzerinden korunur. Yerel149 yapısal kontrol geçti; eklenen native regression henüz koşulmadı, önceki10/10 sonucu bu yeni alana taşınmaz.

Yeni telefon alanı için SQL compile tekrarı başlatılamadı: önceki scratch /tmp PGlite yardımcı dosyası artık yok. Compile geçti iddiası yok;149 yapısal kontrol ve JS syntax kontrolü ayrı kanıttır.

Son telefon düzeltmesi: strict ManagementProjection_account_profile_update_v1.values DTO’suna unverified_phone eklendi; management_state_get üzerinden alanın gerçek dönüşü native regression’a dahil edildi. Nullable yeni alan bile eski strict DTO’da başarısız olduğundan bu kaynak boşluğu kapatıldı.65 migration compile ve SQL profil-yazma/okuma doğrulanmamış kalma, native digits/+ eşdeğer numaranın doğrulanınca draft kopyasının gizlenmesi kontrolleri geçti.149 yapısal kontrol geçti.

## Hosted eski-kanal mail teslimi ve eager native denemesi

Kontrollü eski test hesabına native OTP maili gönderildi, gerçek proof native verify ile kullanıldı. E-posta değişimi için eski ve yeni adrese ayrı gerçek mail/proof gönderildi ve her ikisi native verify ile kabul edildi. Sonrasında Resend01a17758-31f2-784c-bbea-09349d5d0e87, konu Your email address was changed, eski adrese delivered; sent2026-10-26T08:33:51.232Z. Eski-kanal gerçek güvenlik bildirimi teslimi mevcut hosted64 kaynak üzerinde doğrulandı. Bu yeni65 yayılım kaynak kabulünün yerine geçmez. Test hesabı session cleanup yapıldı; token/proof dosyaları kaynaklara eklenmedi.

Yerel native çalıştırma daemon uid1 ile root kısıtını aştı fakat github/alternatif artefakt hostları native downloader DNS ETIMEOUT nedeniyle açılamadı. Proxy üzerinden curl manifest200 döndü, ancak CLI download yolu yine başarısız; eager deneyi yerelde çalışmadı. Zorunlu dar test için sbx_p9ppXPPIaNxV6xFI62CQdCOonBfS nonpersistent2vCPU açıldı; son management DTO düzeltmesi sonrası kaynak213/65 generate edilip --eager ile yeniden başlatıldı. Son iki-suite20node18pass2fail,106667.935ms; kimlik suite11/11 geçti. Eski profil/alias suite’inde person_get_v1 boş HTTP503/content-type null/bytes0 nedeniyle financial-rights child ve parent başarısız. --eager tek başına503’ü çözmedi; idle-stop kesin neden diye kaydedilmez, scripts/start-dev değiştirilmedi. Tam iki koşu logu süre dolmadan /workspace/scratch/69a55cf39471/eager-current-native.log ve eager-native.log olarak korundu; Sandbox356125ms sonunda açıkça durduruldu. Retry/assertion/timeout gevşetilmedi, full clean başlatılmadı.

## 26 Ekim09:08 UTC — son dar native kabul

Main18a151adf3f1519395dc1c539beacd6bf003ada3 ile uzlaştırılmış213 API/65 migration çalışma kaynağında account-identity-acceptance ve p07-account-profile-merge-acceptance birlikte22/22,0fail/skip/cancel,132472.878ms geçti. Kaynak dosyası hashleri aşağıdadır; bu çalışma ağacı testi aday/full/main/CD kabulü değildir.

Telefon için local SMS confirmations=true ve yalnız ayrılmış sentetik numarada test OTP kullanıldı. Yanlış kod reddi, doğru kodla native doğrulama, doğrulanmamış draft ayrımı ve confirmed-only organizasyon yayılımı geçti. Gerçek SMS gönderilmedi; hosted test kodu/provider ayarı uygulanmadı. Alias merge/rebind sonrası retired canonical fiziksel geçmişi korunur, güncel projeksiyona sızmaz. Kullanıcı aynı eski adresi açıkça yeniden eklerse yeni ve doğrulanmamış iletişim oluşturulur; eski doğrulama diriltilmez. İlgili native regresyonlar geçti.

Önceki boş503 bu koşuda tekrarlanmadı; kesin kök neden kanıtlanmış değildir. Tanılama response/retry davranışını değiştirmedi; cgroup OOM/kill sayacı0. Assertion, timeout ve full/main kapsamı gevşetilmedi. Tam log accepted-alias-native.log SHA256: 7d6e679d11b396869269e839948d483c0aa9bee20ad133d727665252177cf4f4. Sandbox sbx_LcQ5DDiiBp0AsvFptA9XEF5FQX25 kanıt korunduktan sonra açıkça durduruldu (313935ms). Final kaynak incelemesi, aday/main clean/CD ve yayımlanan yeni API üzerinden gerçek Google bağlama açık. Kullanıcının sağladığı kullanılmamış Google kimliği bağımsız signup yapılmadan bağlama kabulüne ayrıldı.

- database/account-identity-projection.sql: `a04d73dca3c04b224c287447fd1f6639604a5a4c9caa76571b7348f271c9fe21`
- supabase/migrations/20261026003615_account_identity_projection.sql: `a04d73dca3c04b224c287447fd1f6639604a5a4c9caa76571b7348f271c9fe21`
- tests/account-identity-acceptance.mjs: `997442224f0d525eeb627c83670251a1e48ab7c628db7d407954c454e5a0e584`
- tests/p07-account-profile-merge-acceptance.mjs: `e97690938b3e4f8ecaf9eac705d75853e9997c9b2ab3f9dc2dd315fbea05318f`
- supabase/config.toml: `1fe4208ab8de92846fc7d9ce1505067b87d3c69dc23a9929bcfeb6cbed9c995f`

## PR52 ilk aday clean — fixture uyumsuzluğu teşhisi

Aday40298563663, head df091c72d25cfd703c5c586515e420f5d372ed2b/base18a151adf3f1519395dc1c539beacd6bf003ada3/mergea0890a0ba0568735b01163e22bbfd7e95e0cfc11 başarısız. Core/API1/API2 geçti. API3 ilk hata permission_set_v1 VERSION_CONFLICT: verified account link global ad yayılımıyla kişi sürümünü2 yaparken eski P03 fixture1 gönderiyordu. Child erken kesildiği için correction çalışmadı ve sonraki credit arithmetic negatif testi farklı başlangıç bakiyesiyle başarısız oldu. API4 eski yerel adla arama ve canonical native verified_at doğrudan yazımı beklentileri yeni global-current-name/contact guard ile çelişiyordu. Tam iki job logu scratch ortamında korundu; başarısız kabul merge edilmedi.

Test-only düzeltme: P03 kişi okumasından gerçek2 assert edilir, stale1 VERSION_CONFLICT negatif kontrolü eklenir ve canlı sürüm kullanılır. Person fixture kullanıcı kendi profil adını linkten önce açıkça belirler; arama/pagination/privacy assertionları korunur. Organizasyon-owned bağımsız kişi üzerinde contact verification-preservation, new evidence clearing, idempotency, concurrency ve geç audit rollback aynı assertionlarla sürer. Linked canonical rename FORBIDDEN ve kendi tam profilinin değişmemesi kontrolleri eklenir. Runtime/migration/timeout/CI kapsamı değiştirilmez. Bağımsız dar diff incelemesinde bloklayıcı veya assertion gevşetmesi bulunmadı; final kaynak bağı ayrıca bekler.

Dar native ilk tekrar: P03 linked finance7/7,109246.893ms geçti. Person setup account_get DTO’sunda olmayan version alanını okuduğu için VALIDATION_FAILED oldu; bu test hazırlık hatası mevcut fixture SQL okuma yoluyla core.accounts.version alınarak düzeltildi. Yalnız person parent aynı sandbox’ta yeniden koşuluyor; henüz temiz person kabulü iddiası yok. npm verify149/149 ve55file/369link belge kontrolü geçti.

- İlk job121490590013 log SHA256: `26417d7e529c6f9aeef5292a114628a3e67f1f96a368b45f205e08108cddc140`.

- İlk job121490590038 log SHA256: `13d618c888c8668f567bc7d5972a6ec658418638ea8b20ffe48439b75540b0d3`.

Son dar person tekrarı: ilk4 child (scope/self, search/cursor, discipline scope ve instructor privacy/revocation) geçti; canonicalBefore okumasında empty HTTP503 nedeniyle parent başarısız,5node4pass1fail/93.240sn. Son üç org-local mutation child bu tekrarda çalışmadı; temiz native person kabulü yoktur. Native functions log connection aborted kaydını aynı503 zamanında gösterdi; cgroup OOM/kill0. Kesin altyapı kök nedeni veya ürün başarısı iddia edilmez. Retry/assertion/timeout eklenmedi. Native test+functions+gateway logları pr52-native-fix-evidence.json olarak korundu, Sandbox401744ms sonunda durduruldu. P03 tam7/7 kabulü ayrı geçerlidir. Kaynaklı ilk fixture hataları teşhis edildi/düzeltildi; bu kaynak için tam aday CI yeni kabul olacaktır, eski başarısız clean devralınmaz.

- Dar native evidence SHA256: `4b5d1bbf74639128cf9ba8ea7385b8f827b4978f9522415217970f7bc4dec44d`.
- tests/person-registry.test.mjs: `8cf345171a565ea44b84a0e28458a39435ab251979cf867e30fdf147e2b0a429`.
- tests/event-payment.test.mjs: `b2969e4ec6cbb8e7b2963f16fc6bac139de7548f7eda351a5466be91f407a942`.

## 26 Ekim — PR52 main kabulü ve CD cleanup düzeltmesi

PR52 main043347e8e23e671059285f5f20d86f1c0fafe9ad: aday40302913868 ve aynı main40309879942 full clean başarılı;213 API/65 migration. CD40312648189 migration65 ve Edgev12’yi uyguladı; Auth→Edge→RPC, tenant/direct-RPC/JWT/session kontrolleri geçti fakat synthetic_fixture_removed başarısız. Yeni otomatik p07_profiles FK’si CD’nin eski hesap temizliğini engelledi; CD başarılı sayılmaz. Yalnız CD fixture UUID’sine bağlı profil+hesap temizliğini atomik yapan dar script/test düzeltmesi hazırlanıyor; kalıcı FK/retention/ürün API davranışı değiştirilmez. Gerçek Google bağlama ve başarılı CD kabulü hâlâ açık; birinci satır kapanmadı. Ayrıntı account-identity-progress-20261026 raporundadır.

CD receipt65 migration/all contents match, Edgeactive verify_jwt=true/version12, core90/missingRLS0/exposedRPC0; son tek başarısız kontrol fixture temizliğidir. Advisors aşamasına ulaşılmadı. Doğrudan okunan hosted65/Edge12 durumu receipt ile eşleşir; ayrı advisor okumaları hata incelemesi içindir ve CD başarısı yerine geçmez.

Düzeltme yalnız hostedSmoke finally SQL temizliğidir: aynı authId ile private.p07_profiles → core.accounts anonim transaction bloğu; native Auth DELETE girişimi ve fixture yokluk doğrulaması korunur. Domain/desen bazında veri silme yok. Node hostedSmoke regression hem başarılı akışta hem erken assertion hatasında exact-ID ve temizleme sırası denetler. Scratch PGlite actual hostedSmoke-generated SQL ile unrelated profil korunması, exact fixture temizliği ve parent FK engelinde profil temizliğinin rollback’i geçti. npm verify149/149 geçti. Ürün runtime/migration değişmedi; yeni CI altyapısı kurulmadı, cleanup kabulü veya assertionları kaldırılmadı.

Başarısız40312648189 koşusunun tek sentetik fixture’ı exact UUID+beklenen sentetik email+organizasyon link yokluğu doğrulandıktan sonra tek transaction’da profile/account/Auth sırasıyla temizlendi. Readback accounts0/users0. Diğer veriler silinmedi; bu tek seferlik temizlik başarılı yeni CD koşusu yerine sayılmaz. Kaynak incelemesi, yeni aday/main clean ve CD kabulü açık.

## PR53 sonrası gerçek sağlayıcı ve S04 checkpoint

Main7086d7e00c142b9049e3d76cb8ac2f587fdaa5b6 için main40318033261 ve development CD40320789568 başarılı. Gerçek Google bağlama13 kontrol (prepare yokluğu/yanlış nonce retleri, gerçek native imza/issuer/audience/nonce kabulü, değişmez account UUID, ikinci account yokluğu) ve Resend identity-linked delivered olayıyla kabul edildi. Kabul testinin native session/refresh kayıtları sıfırlandı; bağlı kimlik korunur. Geçici kabul projesi ve Google test origin temizliği ayrıca izlenir.

S04 kaynak incelemesi native UpdatePassword'ın recovery current session'ı koruduğunu gösterdi. İstemcinin isteğe bağlı follow-up completion API'si bu boşluğu kapatmadığından uygulanmadı. Yeni66 migration adayı native hash-update→LogoutAllExceptMe transaction'ında server AMR recovery session UUID snapshot'ı ve statement/deferred trigger kullanır; parola/OTP/hash/payload audit'e konmaz. Rehash ve ordinary/recovery ayrımı, zero-row logout, rollback ve concurrency kabulü bitmeden kapalı sayılmaz. İlk izole66 compile ve recovery/ordinary SQL kontrolleri geçti; native ve final review henüz açık.

Kısa nonpersistent Sandbox sbx_XsmvV1NRvlQ1Nt69xdbZ9Gz62eIy420333ms sonunda kapandı; test sonucu elde edilemedi, başarılı sayılmaz. İkinci sınırlı ortamda nativev2.197.0-r0 startup readiness başarısızlığı açık teşhis edildi; dar recovery testi ayrıca başlatıldı. Hiçbir hosted reset yapılmadı.

Native teşhis: ikinci Sandbox'ta gerçek Auth healthv2.197.0 HTTP200 ve syntheticfixturecreate200; Edge runtimev1.77.8-r0 başlatılırken `/lib64/libm.so.6: GLIBC_2.35 not found` nedeniyle account_get502. Testlerbusinessassertionlara ulaşamadı; kabul değil. Tam log aktarımı connector'ın2000karakter binary response truncation'ı nedeniyle başarısız oldu; yalnız görünür hata excerpt'i korunabildi, tam log saklandı iddiası yok. İki ortam kapatıldı. Native kaynak `IsRecovery` OTP/magiclink/recovery AMR'lerini recovery-capable sayıyor; implicit recoveryPOSTverify OTP üretir. Taslak snapshot buna eşitlendi; yalnız literal recovery yeterli değildir.

Approved hosted recovery config900/10/3 kaydedildi ve readback alındı; bu feature-enable/ingress/siteverify/gerçek mail kapısı kabulü değildir.

## S04 son dar native kabul — 26 Ekim16:05UTC

Yeni66 migration kaynağı SHA256 `e73bb3f3872c64227d5bdceaa437496b4be96429e2b7da85cd9e80e6a413e61b`; kimlik test dosyası SHA256 `ca573974667926bf6b0aecdd84199e02a07e0488ee05e46d3b22331e5f2963bc`. Ubuntu universal image (GLIBC2.43), Node24.22.1, Native Authv2.197.0 üzerinde Auth→Edge→RPC hazırlandı. Yalnız yeni recovery parent son hali8/8pass,0fail/skip/cancel,20.624826sn geçti. Normal nativePUT caller korunması/oldrecovery kapanması; recovery directPUT tüm JWT+refresh reddi ve yeniden giriş; current-only0row logout; late history failure hash+session rollback ve once-only retry; unknown0row logout rollback; private marker/function client+service ACL; hash-only maintenance/commit marker cleanup doğrulandı. Ham log SHA256 `26f9e37a6bdd1565cfcae7f5deeb4b5945255ceb62f6f6f96199fe68fb8ad487`; sıkıştırılmış iki/üç parçalı aktarım ve hash readback ile korundu. İlk6/6 kanıt yeniiki sınır case'i kapsamıyordu; son8/8 bunları içerir. Sandbox sbx_rewKuvicpy5EmISntDSgVCE7B3Fc kanıt alınır alınmaz durduruldu.

Bu yalnız dar native kabulüdür; mevcut kimlik suite'inin tamamı/aday/mainclean veya hosted66deployment kabulü değildir. Bağımsız source incelemesinde somut bloklayıcı kalmadı; exactcommit/tree kaydı sıradaki kapanışta bağlanır. Güvence doğrulanan GoTrue2.197 UpdatePassword→LogoutAllExceptMe SQL sırasına bağlıdır: bilinmeyen DELETEshape recovery survivor bırakırsa rollback edilir. Provider gelecekte logoutDELETE'i bütünüyle kaldırırsa noDELETE hash-maintenance ayrımı aynı olmaz; provider upgrade'inde native regresyon zorunludur, evrensel gelecek failclosed iddiası yoktur.

## Turnstile oluşturma ve server adaptörü

Kullanıcı domain kaydını açıkça onayladı. Cloudflare connector'ıyla FtkSaaS account recovery acceptance managed widget `0x4AAAAAAFm2HIz08p6Kjde1` oluşturuldu. Domainler localhost/127.0.0.1/ftk-auth-acceptance-4xebjsko8-erkinkunbuk-4818.vercel.app,clearance no_clearance; ayrı GET list readback eşleşti. Secret oluşturuldu bilgisi dışında değer döndürülmedi veya depolanmadı. Gerçek siteverify/replay/SMTP kabulü henüz yoktur. Supabase Edge secret yönetimi connector'da bulunmadığından mevcut dashboard formu5name/2publicvalue ile hazırlanıp üç secret girişinin kullanıcı tarafından yapılması beklenir; save çalıştırılmadı.

Mevcut server ingress adaptörüne kapalı recovery-path imzalayıcısı eklendi; public application imzası aynen korunur. IPv4/IPv6 ve route çapraz kullanımı retleriyle contract19/19 geçti. Yeni native kapsam açılmadı, SQL/native8/8 kaynağı değişmedi. Yeni fullclean başlatılmadı.

## Hosted secret kaydı ve mobil kabul sayfası

Kullanıcı kayıt sonrası beş customsecret adı ve digest readback doğrulandı. Hostname aynı projenin stablepreviewalias'ına çevrildi; digest10100e9e99848186c34be45f767bd3f673e414e40b8cba53fd7bdc2a3813b9ce eşleşti. Widget readback aynıstablehost+localhost+127.0.0.1,managed. Secretlar üretimöncesi yenilenir; değerler repo/loga yazılmaz.

Stagingtest deployment dpl_BBsyDkw5QMumw7w3rxV1JD5Ya9mW READY; mevcutgeçiciproje prj_8hDFgbUopkdTBUEXIA7yJbM17VRA, ürünfrontendunchanged. api/recover sourceSHA256891c221a3b4569a8665dfa9b45cb8a66fa18a30d3f3f3c9b191a10c4c3599d86, indexHTML3d00fd8778e0b964eb329106a981b3bfea8df7955083d5fd52d9f9f1e958a173. Independentreview kritikbulguyok; meaningfulharness4/4. CanlıGETreadytrue200, HTML veCFmanagedcheckboxgörünür. İnsan doğrulaması tıklanmadı, gerçekproof kullanılmadı; mail/replay/native66deployment/aday/main/CD kapıları açık. Kullanıcımobildenbilinentesthesabı+bilenmeyenadresakışını yürütecek. Kaynakta frontendürün değişikliği veya yeniCIaltyapısı yok; yeni fullcleanhenüz yok.

## Son kullanıcı kararı — native oturum davranışı kabul edildi

Kullanıcı kurtarma oturumunun sıfırlama sonrası açık kalmasını ve bariz güvenlik riski yaratmayan sağlayıcı varsayılanları için ekstra bakım alınmamasını kabul etti. S04 nativeSupabase davranışına eşitlendi. Özel66SQL/marker/trigger, yeni password_reset_completed enumu ve yalnız bu reddedilen davranışa ait yeni87test satırı taslaktan kaldırıldı. account-identity-acceptance ve signup/nativekimlik fixture'larının yayımlanmış main7086 kaynakları byte-identical korunur; mevcutfull/main assertionlarına dokunulmadı. HostedSQL66version=false, markerTable=false; rollbackmigration veya hosteddata silme yoktur. Privateall-sessionextension8/8 sonucu tarihsel olup bu son kararın kabulü değildir.

Mobilözelgateway4isteği16:51:54–16:52:22UTC400 aldı, ratefingerprint/hit0 ve Resendyenimailyok. Tek sabitnegativepathprobe16:57:04UTC external-signature400/TEMPORARY_FAILURE, internal-signature400/VALIDATION_FAILED döndürdü; canonicalpathrewrite köksebebi doğrulandı. Yeni regresyon düzeltmeden önce Hosted gateway removes external functions prefix assertionında düştü; iki exactroutecanonicalization sonrası contract19/19 ve verify149 geçti. Bot/rate/HMACatlama veya timeoutgevşetmesi yok. Bu uyumlulukfixi nativeflowtercihinden bağımsızP04 tüketicisini de korur. GeçiciGETdiagnostic kaldırılacaktır; nativeCaptchayapılandırması ve CDuyumluluğu hâlâ incelenecek.

Native-first CD uyumluluğu: resmi Authv2.197 middleware trustedadminAuthorization için CAPTCHA muafiyetini destekliyor; native password grant ayrı doğrulanır. YeniCDtaslağı publicwronglogin red, trustedwrongpassword red, correctpassword+matchingfixtureuser.id ve mevcutgerçekuserJWT Edge/RPC kontrollerini zorunlu tutar. Smoke'ıncaptcha açık/kapalı+success/earlyfailure durumları mock46/46 geçti; gerçekCDkaynağı/hostedcaptchaaktivasyonukabulü değildir. NativepublicCaptcha ayrıinsan/sağlayıcıkanıtı olarak kalır.

ÖzelVerceltest canonicalalias staticretired sayfaya taşındı; root200 veapi/recover404 readback alındı. Eskiimmutabledeploymentlar/Previewenv kayıtları henüz sağlayıcıdan silinmedi; cleanupcompleted denmedi. NoextraCAPTCHAuserretryistendi.
