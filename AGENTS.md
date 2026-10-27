# FtkSaaS çalışma kuralları

## Başlangıç ve kaynak önceliği

Önce bu belgeyi, [kaynak indeksini](docs/source-index.md), [güncel kabulü](docs/contracts/00-FtkSaaS-yeni-sohbet-devir.md), [açık işleri](docs/remaining-work.md) ve [aktif sırayı](docs/production-queue.md) oku. Ardından yalnız görevle ilgili normatif sözleşme/karar ve entegrasyon belgesini oku. Tam başlangıç SHA’sını ve aynı SHA’nın gerçek CI sonucunu doğrula. Eski başarı yeni kaynağa taşınmaz.

Son açık kullanıcı kararı üstündür; kabul edilmiş D01–D09/U01–U08/Q-D01/Q-E02/Q-E03 ve FD01–FD12 hükümleri korunur. Bilinmeyen ürün, fiyat, politika veya config değeri uydurulmaz. Karar, uygulama, test, merge ve hosted kabulü ayrı durumlardır.

## Tek kaynak ve dosya sahipliği

[Belge haritası](docs/documentation-map.md) her yaşayan Markdown dosyasının sahibini/rolünü gösterir. Güncel SHA/envanter/CI/CD yalnız 00 devirde; açık iş yalnız remaining-work’te; sıra yalnız production-queue’da tutulur. Diğer belgeler bu kaynaklara bağlanır, durum metnini kopyalamaz. Tarihsel docs/history/ içeriği yeniden yazılmaz; taşınmış kaynakların commit/yol/hash izi docs/history/manifest.json içinde tutulur. Üretilmiş katalog/tipler üreticiden güncellenir; ikinci sözleşme ağacı kurulmaz.

SXQHex/FtkSaaS tek geliştirme reposudur. Kullanıcının 28 Ekim kararıyla diğer repolar bağlam dışıdır; frontend apps/web ve packages/ui içinde yeni geliştirilir. Önce shadcn/ui ve ondan türetilen hazır bloklar kullanılır; kaynak/lisans izi korunur. Vitest/Testing Library/MSW ve Playwright/axe altyapısı başlangıçtan itibaren hazır tutulur. [Frontend geliştirme devri](docs/frontend-development.md) ve paket kapsamındaki AGENTS ayrıca okunur.

Frontend görevi apps/backend ve mevcut backend CI/kabul kaynaklarını değiştirme yetkisi vermez. Frontend/backend test komutları ve tetiklemeleri ayrıdır. Backend sahibinin yapması gereken karşılıklı tetikleme/kabul değişiklikleri [CI devrinde](docs/frontend-backend-ci-handover.md) tutulur; uygulanmamış devir tamamlandı sayılmaz.

Backend kod/test/CI araçlarının tek sahibi apps/backend'dir. Root package.json yalnız workspace yönetir. packages/api-contracts/schema/contract.json tek makine kaynağı, aynı paketin src/ dizini üretilmiş tip sahibidir. Ortak TS sürümü katalogdan kullanılır; backend araçları frontend uyumluluğu için değiştirilmez. Yeni runtime çıktısı .artifacts altında, private backend yerel durumu apps/backend/.dev altında kalır.

## Güvenlik ve ortamlar

Uygulanmış migration değiştirilmez. Secrets/token/parola/kişisel veri kaynaklara ve raporlara yazılmaz. Yeni istemci Supabase native Auth ve Edge backend-v1 kullanır; core/private tablo veya service-only RPC erişimi yoktur. JWT doğrulaması açık kalır. Bariz güvenlik/fonksiyon açığı yoksa sağlayıcı davranışını tekrar eden bakım katmanı eklenmez.

Kullanıcının 27 Ekim seçimi: frontend gerçek API entegrasyonu mevcut geliştirme Supabase’ine bağlanır. Yerel/CI reset ve seed yalnız loopback izole DB’de çalışır. Hosted veriye reset/clean/seed uygulanmaz. Production dağıtımı/DNS veya eski studiosaas uygulamasının değiştirilmesi bu taşımanın yetkisi değildir. Platform Auth/Resend kurulumu önceki kabul kapsamındadır; yeni marketing/dış gönderim yetkisi yoktur. Gerçek widget/provider/ekran/yük/restore kabulünü mock ile kapatma.

## Geliştirme ve teslim

Ayrı branch + Draft PR kullan. İlgili kod/sözleşme/üreteç/açık iş/entegrasyon belgesini aynı PR’da güncelle. Frontend dosyalarını taşırken TSX/CSS davranış değişikliğini ayrıca gerekçelendir. Bağımsız inceleme son kaynakta yapılır; test assertion’ları veya güvenlik kapıları sonucu yeşile çevirmek için gevşetilmez.

[CI politikası](docs/ci-policy.md): geliştirmede birikimli hedefli doğrulama; runtime/CI son adayda açık ci:full-clean; merge sonrası aynı main’de tam kabul. Güvenli yalnız-belge kabulü incelenmiş tam yol listesine bağlıdır; Markdown uzantısı yeterli değildir. Kaynak/head/base/merge-tree kapısı ve dört API shard korunur. CI politika değişimi trusted-base sınırını kaldırmaz; exact-source kurulum yetkisi gerektiren aday otomatik merge edilemez. Required-check/strict-base yönetim ayarı kanıtsız uygulanmış sayılmaz; bypass/sahte status yoktur.

Kendi commit SHA’sını belge içine yazmak veya sırf yeni run bağlantısı için sonsuz belge commit’i oluşturmak gerekmez. Sonuç bir sonraki doğal belge değişikliğinde tek durum kaynağına işlenir.

## Full clean sırasında kullanıcıya devir

Aday/main full clean başlayınca run URL/ID, PR, head/base/tested merge SHA, sıra ve sonraki adımı paylaş; turu bitir. Yanıtta run URL yoksa workflow ve tetikleme zamanını kaydet; run aramak için bekleme. Kullanıcı dönene kadar polling/log takibi/sleep döngüsü/watch/arka plan izleyici/otomasyon yoktur; aynı clean tekrar tetiklenmez.

Kullanıcı döndüğünde gerçek sonuç ve güncel kaynak bir kez doğrulanır. Hâlâ çalışıyorsa yeniden durulur. Başarısızsa kaynak bağlı dar düzeltme yapılır; başarı ve mevcut yetki varsa merge edilir. Main clean başlayınca tekrar devir yapılır. Aynı main kabulü ve development CD doğrulanmadan teslim kapatılmaz. CI çalışır; duran ajan izlemesidir.
