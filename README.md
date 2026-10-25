# FtkSaaS backend

## 25 Ekim — PR45 kapasite ve main ayarları uzlaştırması

Başlangıç main `3456050a3061d7bf5dc2ce8898b82c5cfe84e773`: **206 callable API / 60 migration**; PR46 ayarları birleşti, aynı main clean [40200716603](https://github.com/SXQHex/FtkSaaS/actions/runs/40200716603) ve development CD [40202862244](https://github.com/SXQHex/FtkSaaS/actions/runs/40202862244) başarılı. Bu PR45 birleşim adayı kapasite işlemini ekler: **207 callable API / 61 migration**. Altı ayar işlemi ve kapasite davranışı birlikte korunur. Henüz uygulanmamış kapasite migration’ı main’deki ayar migration’ından sonra sıralandı; SQL içeriği ve mevcut 60 migration değişmedi. Önceki PR45 clean yalnız eski tabana aittir; bu birleşik kaynak için bağımsız inceleme ve yeni aday/main clean gerekir. Kapasite henüz main/hosted kabulü değildir.

[Alanlar, API'ler ve kesin destek sınırı](docs/frontend-settings-handover.md). Teknik SQL/worker yönetimi erteli; beş ekranın bütün 69 davranış grubu tamamlandı denmez. Hazır renk/font/logo, native provider/MFA/oturum ve diğer özel yaşam döngüsü açıkları bu genel tercihlere dönüştürülmez.


25 Ekim: FD kararları tamamlandı; giriş e-posta/parola + Google (uygulama/provider kabulü ayrı), Apple/Instagram login kapsam dışı. [Güncel karar/kaynak tablosu](contracts/00-FtkSaaS-yeni-sohbet-devir.md) yayımlanmış main200/59 ile henüz merge edilmemiş PR45 kapasite adayını201/60 ayırır. Nominal/maksimum ürün modeli kaldırıldı; mevcut main DTO'ları PR45 merge edilmeden değiştirilmiş sayılmaz.

Güncel kaynak merkezi [SXQHex/FtkSaaS main](https://github.com/SXQHex/FtkSaaS). Önce [AGENTS](AGENTS.md), [kaynak indeksi](docs/source-index.md) ve [güncel devir](contracts/00-FtkSaaS-yeni-sohbet-devir.md) okunur.

## Frontend için başlangıç

- [Settings sözleşmesi ve davranış sprinti](contracts/02-FtkSaaS-teknik-sozlesme.md#ayarlar-sozlesmesi-ve-davranis-sprinti): kabul edilmiş 69 ana grup, tamamlanan FD01–FD12 frontend seçimleri ve backend/frontend ayrımı.
- [İstemci entegrasyon devri](docs/claude-handover.md): hangi alan/API mevcut, hangi davranış henüz uygulama gerektiriyor; Auth, hata, erişim ve sağlayıcı sınırları.
- [Makine sözleşmesi](contracts/08-FtkSaaS-tip-ve-operasyon-sozlesmesi.json), [TypeScript API](packages/contracts/src/operations.ts), [endpoint envanteri](docs/endpoint-inventory.json): yalnız yayımlanmış200 operasyonun çağrı sözleşmesi.
- [Kalan işler](docs/remaining-work.md) ve [üretim kuyruğu](docs/production-queue.md): P08 abone numarası/ortak CRM ve diğer bağımlılıklar.

## Doğrulanmış durum

P01–P07/PR40 kod/main/geliştirme-test kabulü kapalı:200 sözleşme/200 runtime/0 contract_only,59 migration,90 core tablo/Edge8. Runtime main `4cfc9a55`; son belge tabanı `7020638` (PR42). PR41 yalnız belge kabulüdür; yeni runtime tam test veya deploy değildir. Tam run/source zinciri güncel devirdedir.

Beş hosted Cron aktif; temel heartbeat/idle kontrolü geçti. Fiziksel imha, gerçek yük/restore, dış e-posta ve frontend uçtan uca kabulü ayrıdır. Yeni settings API taslağı yayımlanmadı; 69 ana grup ve FD01–FD12 alan kararları kabul edildi; gerçek DTO/yetki/API matrisi ve uygulama kabulü ayrı. Standart yeni org negatif limiti 0; mevcut kulüp −2 korunur. Bu belge kapanışı yeni kod geliştirmesi başlatmaz. Arayüz tasarımı bu belge tesliminin dışında kalır.

## Geliştirme ve CI

Node24.19.0 ve sabit lockfile ile:

```bash
npm ci
npm run generate
npm run verify
npm run dev:start
npm run test:clean
npm run dev:stop
```

`test:clean` yalnız izole loopback DB'sini sıfırlar; hosted gerçek veriyi reset etme. Geliştirmede birikimli hedefli, runtime/CI son aday ve aynı main'de full clean; incelenmiş güvenli yalnız-belge farkında ayrı kaynak bağlı belge kabulü. [CI politikası](docs/ci-policy.md) ve full-clean kullanıcıya devir kuralı geçerlidir.

[Hosted kurulum](docs/remote-backend-setup.md) geliştirme/test içindir. Production dağıtımı, frontend tasarımı veya dış e-posta/Resend kurulumu bu görevle yetkilendirilmez. Eski raporlar tarihsel kaynak snapshotlarıdır.
