# Güncel kaynak ve kabul

31 Ekim 2026 kaynak kontrolü. Bu kayıt yalnız doğrulandığı kaynağı anlatır; sonraki çalışma başında canlı main ve aynı SHA’nın gerçek sonuçları yeniden okunur. Eski bir run yeni head’e taşınmaz. Açık iş [backlog](remaining-work.md), sıra [kuyruk](production-queue.md), ürün/iş akışı [kaynak indeksi](../../../docs/source-index.md) sahibindedir.

## Kaynak tabanı

Repo SXQHex/FtkSaaS; uygulama tabanı main `65d64aed54716a53cda14963b1438a3523451afa`, tree `eb207fffe4c762a977abc4e90afc25a655f3a55e`. PR94 normal iki ebeveynli merge ile main'e alındı; PR100 frontend hesap formu/telefon kaynakları aynen korunarak PR99 bu tabanla eşitlendi. Bu main'in [kaynak kanıtı](https://github.com/SXQHex/FtkSaaS/actions/runs/41043771480) ve [merge kanıtı](https://github.com/SXQHex/FtkSaaS/actions/runs/41043771460) başarılı; [development teslimi](https://github.com/SXQHex/FtkSaaS/actions/runs/41043811463) başarılı. Main binding, aday run/attempt/head/base/merge tree ile gerçek merge commit'ini bağlıyor; development deploy ve şema/dokümantasyon doğrulama adımları başarılı. Main kabulü gerçek aday kaynağını yeniden kullanır; bu başarı PR99'un yeni head'inin kabulü değildir.

PR94'ün [41039459740](https://github.com/SXQHex/FtkSaaS/actions/runs/41039459740) adayında core ve dört API shard'ının tamamı başarılıdır; required `ftksaas/merge-clean` aynı head/base/merge tree için başarılıdır. Run 10:15:52–10:39:46 UTC aralığında 23:54 sürdü; önceki başarılı adaylar 29:19–33:36 idi. Bu tek koşunun süre karşılaştırması tekrarlı A/B ölçümü değildir. `per_worker` politikası, her istekte canlı Auth/session/tenant denetimi ve dört bağımsız API runtime/DB'si korunur.

Mevcut revizyon 218 implemented operasyon ve 85 migration içerir. Son kullanıcı kararı native Auth içinde kalmak ve yalnız `account_exists` altyapısı sunmaktır. Yeni e-posta ön kontrolü, native Auth endpointlerini kaldıran kaldırma migration’ı hazırdır; önceki PR99 test başarısı bu değişikliğe taşınmaz. Son native-only kaynakta yerel verify başarılı: 146 sözleşme/güvenlik/restore ve 81 CI politika testi (227), ayrıca 6 hedefli Auth kontrolü geçti. İmzalı ingress koşulunu ters çeviren mutation reddedildi ve kaynak geri yüklendi. Bağımsız kaynak incelemesinde engelleyici bulgu yok; gerçek DB/Auth/SMTP için yeni exact-source aday full clean gerekir.

## Kabul edilmiş kapsamın sınırı

- Backend P01–P07, Starter kapıları, hesap/native Auth ve settings tüketicileri kaynakta vardır; gerçek consumer sınırları ortak WF/settings rehberlerindedir. Native Auth SMTP/Google/TOTP geçmiş kabulü uygulama davet/marketing/SMS teslimi değildir.
- PR80 süre ölçümünü advisory yaptı; gerçek core/dört API testleri ve exact-source kabul kapıları korunur. Bu konu tekrar açık optimizasyon blokajı değildir.
- PR83 report worker bounded backlog/retry/kesinti/rebind ve export expiry diliminin kaynak/development kabulü kayıtlıdır. Beş lane genel iş yükü, fiziksel privacy purge, legal hold, tam restore ve RPO/RTO kabulü bundan çıkmaz.
- PR84 JSON restore guard, imzalı sicil ve guarded callback araçlarını ekler. Hosted SQL yükleyiciye entegrasyon veya tamamlanmış DB/Auth/Storage purge sağlamaz.
- PR89 öğrenci arama/detay/kişi yazma/öğrencilik/davet işi takibini içerir. Frontend CI sonucu gerçek yetkili hesapla hosted bütün ekran/yazma/teslim kabulünün yerine geçmez. Ekran davranışının sahibi [web geliştirme rehberi](../../web/docs/development.md).

## XREQ-001 / XREQ-002 teslim sınırı

Son kapsam: `account_signup_check_v1` yalnız e-posta kabul edip `account_exists / available` döndürür. Ana/bağlı Google adresi ve doğrulanmamış kayıt denetlenir; hesap/posta yan etkisi yoktur. `available` anlık sonuçtur, native signup ile atomik değildir. Frontend mevcut adreste durur; yeni adreste native SDK signup çağırır. Route ve ekran tüketimi frontend sahibindedir; bu görev frontend kodunu değiştirmez.

Google link/unlink ve MFA kaldırma için özel intent/fence katmanları, kullanılmayan app recovery gateway’i ve signup dispatch claim’i yeni migration ile kaldırılır. Hesap iletişim projeksiyonu/güvenlik geçmişi, canlı session/MFA/tenant/rol denetimi ve yıkıcı hesap yaşam döngüsü doğrulamaları korunur. Kullanıcının son açık kararıyla Google prepare/TOTP remove/password challenge API’leri de tamamen kaldırılır; uyumluluk adapter’ı yoktur. Frontend native SDK adaptasyonunu kendi alanında yapar.

Parola mevcut-parola/24 saat nonce kontrolleri, güvenlik bildirim şablonu ve development config/readback aracı native kalır. İkinci native Auth süreç harness’i kaldırılır; uygulama entegrasyon testleri ve config/şablon testleri korunur. 30 Ekim panel readback’inde iki parola güvenliği ayarı açık, OTP 3600 saniye/8 hane görüldü. Bu readback gerçek dış posta/PKCE veya frontend nonce/tekrar alanı kabulü değildir. Yerel PostgreSQL UID/chown kısıtı nedeniyle DB/Auth/SMTP kabulü aday CI’da, hosted config/gerçek teslim kabulü hedef ortamda doğrulanır.

Ayrı branch `fix/backend-existing-signup-account`, PR99; kullanıcı PR94 ve PR99 için açık merge yetkisi verdi. Sıra: birleşik kaynağın yerel doğrulaması ve bağımsız incelemesi → aday full clean → güncel kaynakta başarılı sonuçla normal merge → main/development kanıtı. Bu revizyon henüz merge/development kabulü değildir. Full clean başlayınca kök AGENTS devir kuralına göre kullanıcıya run/head/base/tested merge bilgisi verilir ve kullanıcı dönene kadar takip yapılmaz.

## Alanlar arası koordinasyon

Backend sohbet devri bu dosyada; frontend sohbet devri [kendi uygulamasında](../../web/docs/handover.md) yürütülür. Somut talep, karşı tarafın değerlendirmesi/onayı ve teslim kabulü yalnız [ortak talep kaydında](../../../docs/requests.md) tutulur; kendi iş planı talep kimliğine bağlanır. Bu devir frontend planını veya ortak ürün sözleşmesini ilerleme kaydı olarak güncelleme yetkisi vermez.

## Yönetim kanıtı ve geçmiş

Son kayıtlı main ruleset `26040398`: active, strict-status, GitHub Actions required check ve bypass boş; PR71/72 başarısız/stale negatif kabulü kayıtlıdır. Bu revizyonda ayarlar yeniden okunmadı. Politikanın sahibi [CI politikası](../../../docs/ci-policy.md); kaynak kanıtı [sabit önceki yönetim kaydı](https://github.com/SXQHex/FtkSaaS/blob/fe650618503be24eb117297dc412c4ae6fd8018c/docs/ci-policy.md).

Önceki teslimlerin SHA/run/attempt ayrıntıları [sabit devir sürümünde](https://github.com/SXQHex/FtkSaaS/blob/fe650618503be24eb117297dc412c4ae6fd8018c/apps/backend/docs/00-FtkSaaS-yeni-sohbet-devir.md) korunur. Tarihsel belgeden bugünün iş listesi, izin veya kabulü türetilmez. Bu dosya kronoloji biriktirmez; sonraki doğal güncellemede mevcut snapshot değiştirilir.
