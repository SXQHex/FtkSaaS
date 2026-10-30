# Güncel kaynak ve kabul

30 Ekim 2026 kaynak kontrolü. Bu kayıt yalnız doğrulandığı kaynağı anlatır; sonraki çalışma başında canlı main ve aynı SHA’nın gerçek sonuçları yeniden okunur. Eski bir run yeni head’e taşınmaz. Açık iş [backlog](remaining-work.md), sıra [kuyruk](production-queue.md), ürün/iş akışı [kaynak indeksi](../../../docs/source-index.md) sahibindedir.

## Kaynak tabanı

Repo SXQHex/FtkSaaS; uygulama tabanı main `17ee1ebcf7b900b8e420d44903b589a9ebd22830`, tree `96440bc185aacd4370ae47e58c7853d7bb09081a`. PR97 XREQ-001 talebini kaydetti; sonraki PR98 frontend parola/saat dilimi değişikliğini ve XREQ-002 talebini ekledi. Backend runtime değişmedi. Bu main’in [kaynak kanıtı](https://github.com/SXQHex/FtkSaaS/actions/runs/41029219526), [merge kanıtı](https://github.com/SXQHex/FtkSaaS/actions/runs/41029219505) ve [development teslimi](https://github.com/SXQHex/FtkSaaS/actions/runs/41029271073) başarılı; backend kaynak değişmediği için development deploy atlandı. Önceki başarı yeni uygulama head’inin kabulü değildir.

Mevcut XREQ-001/XREQ-002 revizyonu 222 implemented operasyon ve 84 migration içerir. Kayıt adapter/gateway yanında native mevcut parola ayarı, Türkçe güvenlik bildirimi, tokensız kurtarma girişi, development config/readback aracı ve gerçek Auth/SMTP kabul kaynağı vardır. XREQ-002 yeni uygulama Auth endpoint'i veya migration eklemez. Yerel backend verify başarılı: 151 sözleşme/güvenlik/restore ve 81 CI politika testi (toplam 232). XREQ-001 mevcut hesap kontrolünü bozan mutation testi başarısız oldu ve kaynak geri yüklendi. Yerel native stack PostgreSQL paketini ağ kısıtı nedeniyle indiremedi; gerçek DB/Auth/SMTP sonucu aday CI’da doğrulanacak. CLI native config açığı nedeniyle parola testleri aynı CLI Auth binary'sini ayrı loopback süreçte çalıştırır; sınır ve işletim yolu runbook'tadır. Yazılmış test geçilmiş test sayılmaz; bu kayıt hosted sürüm veya frontend ekran kabulü iddiası değildir.

## Kabul edilmiş kapsamın sınırı

- Backend P01–P07, Starter kapıları, hesap/native Auth ve settings tüketicileri kaynakta vardır; gerçek consumer sınırları ortak WF/settings rehberlerindedir. Native Auth SMTP/Google/TOTP geçmiş kabulü uygulama davet/marketing/SMS teslimi değildir.
- PR80 süre ölçümünü advisory yaptı; gerçek core/dört API testleri ve exact-source kabul kapıları korunur. Bu konu tekrar açık optimizasyon blokajı değildir.
- PR83 report worker bounded backlog/retry/kesinti/rebind ve export expiry diliminin kaynak/development kabulü kayıtlıdır. Beş lane genel iş yükü, fiziksel privacy purge, legal hold, tam restore ve RPO/RTO kabulü bundan çıkmaz.
- PR84 JSON restore guard, imzalı sicil ve guarded callback araçlarını ekler. Hosted SQL yükleyiciye entegrasyon veya tamamlanmış DB/Auth/Storage purge sağlamaz.
- PR89 öğrenci arama/detay/kişi yazma/öğrencilik/davet işi takibini içerir. Frontend CI sonucu gerçek yetkili hesapla hosted bütün ekran/yazma/teslim kabulünün yerine geçmez. Ekran davranışının sahibi [web geliştirme rehberi](../../web/docs/development.md).

## XREQ-001 / XREQ-002 teslim sınırı

Kullanıcı “tamamla” ile backend uygulamasını istedi. `account_signup_request_v1`, ana/Google e-postası için yalnız varlık sonucunu verir; mevcut adreste native signup çağrılmaz. Yeni adreste native Auth parola/PKCE/doğrulama korunur; belirsiz dispatch otomatik yinelenmez. Ortak WF/typed tüketici ve backend işletim kurtarması aynı revizyondadır. Frontend kodu değiştirilmedi; route/consumer ve gerçek hosted kabul ayrı bağımlılıktır.

Kullanıcı XREQ-002’yi aynı PR99’a eklemeyi istedi. Native current-password zorunluluğu, kayıtlı ana adrese best-effort bildirim ve tek kullanımlık/süreli native recovery sözleşmesi eklendi; eski parola geri yüklenmez. İstisnalar ve oturum iptali gerçek test kaynağıyla eşlenmiştir. Development Auth ayarı henüz uygulanıp readback ile doğrulanmadı; gerçek dış teslim/PKCE ve frontend tekrar alanı kabulü ayrıca gerekiyor.

Ayrı branch `fix/backend-existing-signup-account`, Draft PR99; son kaynak bağımsız incelemesinde kalan zorunlu bulgu yok; exact-source aday full clean gerekir. Bu revizyon henüz merge/development kabulü değildir. Önceki PR97 merge yetkisi bu uygulamanın merge onayı olarak kullanılmaz. Full clean başlayınca kök AGENTS devir kuralına göre kullanıcıya run/head/base/tested merge bilgisi verilir ve kullanıcı dönene kadar takip yapılmaz.

## Alanlar arası koordinasyon

Backend sohbet devri bu dosyada; frontend sohbet devri [kendi uygulamasında](../../web/docs/handover.md) yürütülür. Somut talep, karşı tarafın değerlendirmesi/onayı ve teslim kabulü yalnız [ortak talep kaydında](../../../docs/requests.md) tutulur; kendi iş planı talep kimliğine bağlanır. Bu devir frontend planını veya ortak ürün sözleşmesini ilerleme kaydı olarak güncelleme yetkisi vermez.

## Yönetim kanıtı ve geçmiş

Son kayıtlı main ruleset `26040398`: active, strict-status, GitHub Actions required check ve bypass boş; PR71/72 başarısız/stale negatif kabulü kayıtlıdır. Bu revizyonda ayarlar yeniden okunmadı. Politikanın sahibi [CI politikası](../../../docs/ci-policy.md); kaynak kanıtı [sabit önceki yönetim kaydı](https://github.com/SXQHex/FtkSaaS/blob/fe650618503be24eb117297dc412c4ae6fd8018c/docs/ci-policy.md).

Önceki teslimlerin SHA/run/attempt ayrıntıları [sabit devir sürümünde](https://github.com/SXQHex/FtkSaaS/blob/fe650618503be24eb117297dc412c4ae6fd8018c/apps/backend/docs/00-FtkSaaS-yeni-sohbet-devir.md) korunur. Tarihsel belgeden bugünün iş listesi, izin veya kabulü türetilmez. Bu dosya kronoloji biriktirmez; sonraki doğal güncellemede mevcut snapshot değiştirilir.
