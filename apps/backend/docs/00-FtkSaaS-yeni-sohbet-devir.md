# Güncel kaynak ve kabul

31 Ekim 2026 kaynak kontrolü. Bu kayıt yalnız doğrulandığı kaynağı anlatır; sonraki çalışma başında canlı main ve aynı SHA’nın gerçek sonuçları yeniden okunur. Eski bir run yeni head’e taşınmaz. Açık iş [backlog](remaining-work.md), sıra [kuyruk](production-queue.md), ürün/iş akışı [kaynak indeksi](../../../docs/source-index.md) sahibindedir.

## Kaynak tabanı

Repo SXQHex/FtkSaaS; güncel main `1d6bcfd253bce84d71a6bd2a1dc662a21dd1f099`, tree `4f0c89539fd18429bd096584ecb597de3df741d2`. PR102’nin [aday full clean’i](https://github.com/SXQHex/FtkSaaS/actions/runs/41205071604), [main kabulü](https://github.com/SXQHex/FtkSaaS/actions/runs/41208760448), [merge doğrulaması](https://github.com/SXQHex/FtkSaaS/actions/runs/41208760437) ve [development teslimi](https://github.com/SXQHex/FtkSaaS/actions/runs/41208788983) başarılıdır. Kullanıcı bu test edilmiş kaynak için tek seferlik yönetici kurulumunu açıkça onayladı; yalnız PR üzerinden bypass kullanıldı, merge’den hemen sonra kaldırıldı. Ruleset `26040398` active, strict required `ftksaas/merge-clean` (GitHub Actions) ve boş bypass listesiyle önceki durumuna döndü; kurallar ve hedef kapsamı birebir doğrulandı. Bu onay başka PR/politika değişikliğine taşınmaz.

PR102 aynı run ve sabit kaynakta GitHub’ın koruduğu başarılı job’ların failed-job rerun kabulünü düzeltmiştir. Güncel başarısız/eksik/iptal işi eski başarı kapatmaz. V2 kaynak çözümleme ve kabul denemesi ayrımı, core baseline ve main/CD kanıtı korunur. Bu teslim runner kapanışının kök nedenini kapatmaz.

PR99 `fix/backend-existing-signup-account` dalı bu main ile güncellendi. 218 implemented operasyon ve 85 migration içerir. Son kullanıcı kararı native Auth içinde kalmak ve yalnız `account_exists` altyapısı sunmaktır. Frontend kaynakları değiştirilmez; kendi native SDK adaptasyonu frontend sahibindedir. Önceki PR99 test başarıları bu yeni birleşik kaynağın CI kabulü değildir.

## Kabul edilmiş kapsamın sınırı

- Backend P01–P07, Starter kapıları, hesap/native Auth ve settings tüketicileri kaynakta vardır; gerçek consumer sınırları ortak WF/settings rehberlerindedir. Native Auth SMTP/Google/TOTP geçmiş kabulü uygulama davet/marketing/SMS teslimi değildir.
- PR80 süre ölçümünü advisory yaptı; gerçek core/dört API testleri ve exact-source kabul kapıları korunur. Bu konu tekrar açık optimizasyon blokajı değildir.
- PR83 report worker bounded backlog/retry/kesinti/rebind ve export expiry diliminin kaynak/development kabulü kayıtlıdır. Beş lane genel iş yükü, fiziksel privacy purge, legal hold, tam restore ve RPO/RTO kabulü bundan çıkmaz.
- PR84 JSON restore guard, imzalı sicil ve guarded callback araçlarını ekler. Hosted SQL yükleyiciye entegrasyon veya tamamlanmış DB/Auth/Storage purge sağlamaz.
- PR89 öğrenci arama/detay/kişi yazma/öğrencilik/davet işi takibini içerir. Frontend CI sonucu gerçek yetkili hesapla hosted bütün ekran/yazma/teslim kabulünün yerine geçmez. Ekran davranışının sahibi [web geliştirme rehberi](../../web/docs/development.md).

## PR99 süreç kapanışı incelemesi

PR99’un önceki base→head farkı ile PR102’den gelen CI değişiklikleri ayrı incelendi. PR99 `test-clean.mjs`, `start-dev.mjs`, `ci/cleanup.mjs`, `p07-diagnostics.mjs`, `request-diagnostics.mjs` veya workflow süreç yönetimini değiştirmiyor. Yeni Auth config/gateway/Edge zaman aşımı sinyalleri HTTP isteğini sınırlar; OS sinyali göndermez. Diagnostics `pg.close` yalnız ilgili bağlantı soketini kapatır. Mevcut worker kabulündeki `child.kill('SIGTERM')` yalnız kendi `spawn()` sonucunu hedefler; cleanup test adımından sonra mevcut izole Supabase stack’ini durdurur. PR99’da Runner.Listener/Runner.Worker, üst PID, sıfır/negatif PID veya process grubu hedefleyen yeni kapatma yolu bulunmadı. Bu kaynak incelemesi dış süreç/host/OOM ihtimallerini dışlamaz.

Somut dar kusur: yeni `account-signup-acceptance.mjs` içindeki Mailpit okuma, native signup ve yetkisiz RPC çağrıları HTTP timeout taşımıyordu; ret yanıtı da tüketilmiyordu. İzole loopback deneyinde node:test 200 ms’de timeout bildirirken ham fetch bulunan child 900 ms sonunda hâlâ yaşıyordu. AbortSignal ile aynı gecikme istek hatasına dönüp child sonlanabildi. Dört kayıt testi HTTP yolu mevcut `request-diagnostics.timedFetch` yardımcısına bağlandı: mevcut RPC 15 saniye sınırını korur, diğerleri ortak 60 saniye sınırını ve başlangıç/hata logunu alır. Ret yanıtı tüketilir; assertion, Auth/tenant güvenliği, test kapsamı ve runner ayarları değişmez. Bu deney geçmiş runner SIGTERM’inin göndericisini saptamaz.

Erişilebilir geçmişte aynı shutdown mesajının en eski kaydı [PR94 ilk aday API-4](https://github.com/SXQHex/FtkSaaS/actions/runs/41001187314/job/123885755133), 30 Ekim 2026 07:12:08.736 Türkiye saatidir; PR94 merge’inden öncedir. 1.550 run ve 350 hatalı/iptal job log taramasının erişim sınırları [PR102 devir kaydında](https://github.com/SXQHex/FtkSaaS/blob/1d6bcfd253bce84d71a6bd2a1dc662a21dd1f099/apps/backend/docs/00-FtkSaaS-yeni-sohbet-devir.md) korunur. Kayıp loglar nedeniyle mutlak ilk olay iddiası yoktur; `per_worker` veya PR99 kök neden olarak ilan edilmez.

Birleşik kaynakta `pnpm --filter @ftksaas/backend verify` başarılıdır: üreteç/doküman drift, migration bütünlüğü, audit/governance, TypeScript ve 146 contract/governance/restore + 90 CI politika testi geçti. Hedefli signup/native Auth/parola config testleri 6/6 geçti. Bağımsız süreç kapanışı incelemesinde timeout düzeltmesinden sonra açık P1/P2 bulgu kalmadı. Gerçek DB/Auth/SMTP ve dört API shard kabulü yeni aday full clean ile doğrulanmalıdır; yerel sonuç merge/development kabulü değildir.

## XREQ-001 / XREQ-002 teslim sınırı

Son kapsam: `account_signup_check_v1` yalnız e-posta kabul edip `account_exists / available` döndürür. Ana/bağlı Google adresi ve doğrulanmamış kayıt denetlenir; hesap/posta yan etkisi yoktur. `available` anlık sonuçtur, native signup ile atomik değildir. Frontend mevcut adreste durur; yeni adreste native SDK signup çağırır. Route ve ekran tüketimi frontend sahibindedir; bu görev frontend kodunu değiştirmez.

Google link/unlink ve MFA kaldırma için özel intent/fence katmanları, kullanılmayan app recovery gateway’i ve signup dispatch claim’i yeni migration ile kaldırılır. Hesap iletişim projeksiyonu/güvenlik geçmişi, canlı session/MFA/tenant/rol denetimi ve yıkıcı hesap yaşam döngüsü doğrulamaları korunur. Kullanıcının son açık kararıyla Google prepare/TOTP remove/password challenge API’leri de tamamen kaldırılır; uyumluluk adapter’ı yoktur. Frontend native SDK adaptasyonunu kendi alanında yapar.

Parola mevcut-parola/24 saat nonce kontrolleri, güvenlik bildirim şablonu ve development config/readback aracı native kalır. İkinci native Auth süreç harness’i kaldırılır; uygulama entegrasyon testleri ve config/şablon testleri korunur. 30 Ekim panel readback’inde iki parola güvenliği ayarı açık, OTP 3600 saniye/8 hane görüldü. Bu readback gerçek dış posta/PKCE veya frontend nonce/tekrar alanı kabulü değildir. Yerel PostgreSQL UID/chown kısıtı nedeniyle DB/Auth/SMTP kabulü aday CI’da, hosted config/gerçek teslim kabulü hedef ortamda doğrulanır.

Sıra: birleşik kaynağın yerel doğrulaması ve bağımsız incelemesi → aday full clean → güncel kaynakta başarılı sonuçla normal merge → main/development kanıtı. Full clean başlayınca kök AGENTS devir kuralına göre run/head/base/tested merge bilgisi paylaşılır; kullanıcı dönene kadar takip yapılmaz.

## Alanlar arası koordinasyon

Backend sohbet devri bu dosyada; frontend sohbet devri [kendi uygulamasında](../../web/docs/handover.md) yürütülür. Somut talep, karşı tarafın değerlendirmesi/onayı ve teslim kabulü yalnız [ortak talep kaydında](../../../docs/requests.md) tutulur; kendi iş planı talep kimliğine bağlanır. Bu devir frontend planını veya ortak ürün sözleşmesini ilerleme kaydı olarak güncelleme yetkisi vermez.

## Yönetim kanıtı ve geçmiş

Politikanın sahibi [CI politikası](../../../docs/ci-policy.md). PR102 kurulumu dışındaki kapılar korunur. Önceki kaynak/test ayrıntıları [sabit PR99 devir sürümünde](https://github.com/SXQHex/FtkSaaS/blob/35efd9b35ce2f47bf79728c2ee5b6585f525b368/apps/backend/docs/00-FtkSaaS-yeni-sohbet-devir.md) korunur. Tarihsel belgeden bugünün iş listesi, izin veya kabulü türetilmez. Bu dosya kronoloji biriktirmez; sonraki doğal güncellemede mevcut snapshot değiştirilir.
