# Güncel kaynak ve kabul

31 Ekim 2026 kaynak kontrolü. Bu kayıt yalnız doğrulandığı kaynağı anlatır; sonraki çalışma başında canlı main ve aynı SHA’nın gerçek sonuçları yeniden okunur. Eski bir run yeni head’e taşınmaz. Açık iş [backlog](remaining-work.md), sıra [kuyruk](production-queue.md), ürün/iş akışı [kaynak indeksi](../../../docs/source-index.md) sahibindedir.

## Kaynak tabanı

Repo SXQHex/FtkSaaS; uygulama tabanı main `65d64aed54716a53cda14963b1438a3523451afa`, tree `eb207fffe4c762a977abc4e90afc25a655f3a55e`. PR94 normal iki ebeveynli merge ile main'e alındı; PR100 frontend hesap formu/telefon kaynakları aynen korunarak PR99 bu tabanla eşitlendi. Bu main'in [kaynak kanıtı](https://github.com/SXQHex/FtkSaaS/actions/runs/41043771480) ve [merge kanıtı](https://github.com/SXQHex/FtkSaaS/actions/runs/41043771460) başarılı; [development teslimi](https://github.com/SXQHex/FtkSaaS/actions/runs/41043811463) başarılı. Main binding, aday run/attempt/head/base/merge tree ile gerçek merge commit'ini bağlıyor; development deploy ve şema/dokümantasyon doğrulama adımları başarılı. Main kabulü gerçek aday kaynağını yeniden kullanır; bu başarı PR99'un yeni head'inin kabulü değildir.

PR94'ün [41039459740](https://github.com/SXQHex/FtkSaaS/actions/runs/41039459740) adayında core ve dört API shard'ının tamamı başarılıdır; required `ftksaas/merge-clean` aynı head/base/merge tree için başarılıdır. Run 10:15:52–10:39:46 UTC aralığında 23:54 sürdü; önceki başarılı adaylar 29:19–33:36 idi. Bu tek koşunun süre karşılaştırması tekrarlı A/B ölçümü değildir. `per_worker` politikası, her istekte canlı Auth/session/tenant denetimi ve dört bağımsız API runtime/DB'si korunur.

Mevcut XREQ-001/XREQ-002 revizyonu 222 implemented operasyon ve 84 migration içerir. Kayıt adapter/gateway yanında native mevcut parola ayarı, Türkçe güvenlik bildirimi, tokensız kurtarma girişi, development config/readback aracı ve gerçek Auth/SMTP kabul kaynağı vardır. XREQ-002 yeni uygulama Auth endpoint'i veya migration eklemez. Yerel backend verify başarılı: 152 sözleşme/güvenlik/restore ve 81 CI politika testi (toplam 233). XREQ-001 mevcut hesap kontrolünü bozan mutation testi başarısız oldu ve kaynak geri yüklendi. Yerel native stack çalışma ortamının PostgreSQL UID/chown kısıtında durdu; gerçek DB/Auth/SMTP sonucu aday CI’da doğrulanacak. CLI native config açığı nedeniyle parola testleri aynı CLI Auth binary'sini ayrı loopback süreçte çalıştırır; sınır ve işletim yolu runbook'tadır. Yazılmış test geçilmiş test sayılmaz; bu kayıt hosted sürüm veya frontend ekran kabulü iddiası değildir.

## Kabul edilmiş kapsamın sınırı

- Backend P01–P07, Starter kapıları, hesap/native Auth ve settings tüketicileri kaynakta vardır; gerçek consumer sınırları ortak WF/settings rehberlerindedir. Native Auth SMTP/Google/TOTP geçmiş kabulü uygulama davet/marketing/SMS teslimi değildir.
- PR80 süre ölçümünü advisory yaptı; gerçek core/dört API testleri ve exact-source kabul kapıları korunur. Bu konu tekrar açık optimizasyon blokajı değildir.
- PR83 report worker bounded backlog/retry/kesinti/rebind ve export expiry diliminin kaynak/development kabulü kayıtlıdır. Beş lane genel iş yükü, fiziksel privacy purge, legal hold, tam restore ve RPO/RTO kabulü bundan çıkmaz.
- PR84 JSON restore guard, imzalı sicil ve guarded callback araçlarını ekler. Hosted SQL yükleyiciye entegrasyon veya tamamlanmış DB/Auth/Storage purge sağlamaz.
- PR89 öğrenci arama/detay/kişi yazma/öğrencilik/davet işi takibini içerir. Frontend CI sonucu gerçek yetkili hesapla hosted bütün ekran/yazma/teslim kabulünün yerine geçmez. Ekran davranışının sahibi [web geliştirme rehberi](../../web/docs/development.md).

## XREQ-001 / XREQ-002 teslim sınırı

Kullanıcı “tamamla” ile backend uygulamasını istedi. `account_signup_request_v1`, ana/Google e-postası için yalnız varlık sonucunu verir; mevcut adreste native signup çağrılmaz. Yeni adreste native Auth parola/PKCE/doğrulama korunur; belirsiz dispatch otomatik yinelenmez. Ortak WF/typed tüketici ve backend işletim kurtarması aynı revizyondadır. Frontend kodu değiştirilmedi; route/consumer ve gerçek hosted kabul ayrı bağımlılıktır.

Kullanıcı XREQ-002’yi aynı PR99’a eklemeyi ve ardından süresiz bildirim girişi → istek anında yeni recovery e-postası akışını onayladı. Bir saatlik kanıt parola değişiminde önceden üretilmez. Son kullanıcı kararıyla native current-password ve 24 saatten eski mevcut oturum için nonce reauthentication birlikte zorunludur. Kayıtlı ana adrese best-effort bildirim ve tek kullanımlık/süreli native recovery sözleşmesi eklendi; eski parola geri yüklenmez. İstisnalar ve oturum iptali gerçek test kaynağıyla eşlenmiştir. Kullanıcı iki native güvenlik ayarını panelde açtı. 30 Ekim panel kontrolünde Secure password change ve Require current password when updating açık, OTP süresi 3600 saniye ve uzunluğu 8 hane görüldü; panelde ek yazma yapılmadı. PR yapılandırma aracı reauthentication açık kalacak biçimde eşitlendi. Bu dar readback bildirim etkinliği/şablonu, gerçek dış teslim/PKCE veya frontend nonce/tekrar alanı kabulü değildir.

PR99 head `1e7150293dc533361dfa4552352cc02dd5dbe6a3`, tested merge `ca22d49d0c65bc9e7e3ff666dc2242fbc08197f1` için [41058640765](https://github.com/SXQHex/FtkSaaS/actions/runs/41058640765) API-3 XREQ-002 hazırlığında durdu. Auth sağlık isteği başarılıydı; tanı `auth_executables=0`, `matches=0` verdi. Core/API-1 başarılı; API-2/4 runner shutdown sinyaliyle kesildi ve başarılı sayılmaz. Native parola alt senaryoları bu koşuda çalışmadı.

Kök neden gerçek pinned release arşivinde doğrulandı: slim-services `auth-v2.197.0-r0` paketindeki `bin/auth`, `.auth-wrapped` ELF'ine `exec` yapar. Arşiv SHA-256 `bd8f59ed1a817014afe71288c2275ad0396630f016f8cb5ab5129388860ec49b` CLI manifest'iyle eşleşir; aynı tag'in `nix/packages.nix` runtime assembly kaynağı bu wrapper'ı üretir. Yalnız `auth`/`gotrue` arayan seçici gerçek süreci isim aşamasında eliyordu. Seçiciye yalnız `.auth-wrapped` tam adı eklendi; loopback DB/SMTP, geçerli iç port, sağlık hazırlığı ve tek süreç şartları korunur. Shell→ELF `/proc` regresyonu eski seçicide aynı hatayı üretti, düzeltmeyle geçti; yabancı DB/SMTP ve çoklu süreç reddi de korunur. Bu fixture gerçek native parola kabulünün yerine geçmez. Güvenlik ayarları, native kabul assertion'ları ve CI politikası değişmedi.

Yerel paket indirmesi sabit kaynak/hash doğrulamasını koruyan geçici loopback aktarımıyla aşılabildi; izole PostgreSQL hazırlığı bu kez çalışma ortamının UID/chown kısıtında durdu. Gerçek Auth/SMTP kabulü henüz tamamlanmış sayılmaz; yeni exact-source aday CI gerekir. Geçici aktarım repo/CI kaynağına eklenmez.

Ayrı branch `fix/backend-existing-signup-account`, PR99; kullanıcı PR94 ve PR99 için açık merge yetkisi verdi. Sıra: birleşik kaynağın yerel doğrulaması ve bağımsız incelemesi → aday full clean → güncel kaynakta başarılı sonuçla normal merge → main/development kanıtı. Bu revizyon henüz merge/development kabulü değildir. Full clean başlayınca kök AGENTS devir kuralına göre kullanıcıya run/head/base/tested merge bilgisi verilir ve kullanıcı dönene kadar takip yapılmaz.

## Alanlar arası koordinasyon

Backend sohbet devri bu dosyada; frontend sohbet devri [kendi uygulamasında](../../web/docs/handover.md) yürütülür. Somut talep, karşı tarafın değerlendirmesi/onayı ve teslim kabulü yalnız [ortak talep kaydında](../../../docs/requests.md) tutulur; kendi iş planı talep kimliğine bağlanır. Bu devir frontend planını veya ortak ürün sözleşmesini ilerleme kaydı olarak güncelleme yetkisi vermez.

## Yönetim kanıtı ve geçmiş

Son kayıtlı main ruleset `26040398`: active, strict-status, GitHub Actions required check ve bypass boş; PR71/72 başarısız/stale negatif kabulü kayıtlıdır. Bu revizyonda ayarlar yeniden okunmadı. Politikanın sahibi [CI politikası](../../../docs/ci-policy.md); kaynak kanıtı [sabit önceki yönetim kaydı](https://github.com/SXQHex/FtkSaaS/blob/fe650618503be24eb117297dc412c4ae6fd8018c/docs/ci-policy.md).

Önceki teslimlerin SHA/run/attempt ayrıntıları [sabit devir sürümünde](https://github.com/SXQHex/FtkSaaS/blob/fe650618503be24eb117297dc412c4ae6fd8018c/apps/backend/docs/00-FtkSaaS-yeni-sohbet-devir.md) korunur. Tarihsel belgeden bugünün iş listesi, izin veya kabulü türetilmez. Bu dosya kronoloji biriktirmez; sonraki doğal güncellemede mevcut snapshot değiştirilir.
