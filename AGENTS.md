# FtkSaaS çalışma kuralları

## Başlangıç ve kaynak önceliği

Önce bu belgeyi, [kaynak indeksini](docs/source-index.md), [güncel kabulü](apps/backend/docs/00-FtkSaaS-yeni-sohbet-devir.md), [açık işleri](docs/remaining-work.md) ve [aktif sırayı](docs/production-queue.md) oku. Ardından yalnız görevle ilgili normatif sözleşme/karar ve entegrasyon belgesini oku. Tam başlangıç SHA’sını ve aynı SHA’nın gerçek CI sonucunu doğrula. Eski başarı yeni kaynağa taşınmaz.

Son açık kullanıcı kararı üstündür; kabul edilmiş D01–D09/U01–U08/Q-D01/Q-E02/Q-E03 ve FD01–FD12 hükümleri korunur. Bilinmeyen ürün, fiyat, politika veya config değeri uydurulmaz. Karar, uygulama, test, merge ve hosted kabulü ayrı durumlardır.

## Tek kaynak ve dosya sahipliği

[Belge haritası](docs/documentation-map.md) her yaşayan Markdown dosyasının sahibini/rolünü gösterir. Güncel SHA/envanter/CI/CD yalnız 00 devirde; açık iş yalnız remaining-work’te; sıra yalnız production-queue’da tutulur. Diğer belgeler bu kaynaklara bağlanır, durum metnini kopyalamaz. Tarihsel docs/history/ içeriği yeniden yazılmaz; taşınmış kaynakların commit/yol/hash izi docs/history/manifest.json içinde tutulur. Üretilmiş katalog/tipler üreticiden güncellenir; ikinci sözleşme ağacı kurulmaz.

SXQHex/FtkSaaS tek geliştirme reposudur; diğer repolar bağlam dışıdır. Frontend uygulaması apps/web, ortak hazır bileşenler packages/ui içindedir. Güncel tasarım/geliştirme rehberi apps/web/docs/development.md, açık kapsam ortak backlog sahibindedir. Geçmiş geri alma/göç notundan yeni runtime görevi türetilmez. apps/backend backend kod/test/CI araçlarının tek sahibidir; Frontend çalışması backend runtime veya mevcut kabul kapılarını değiştirme yetkisi vermez. Root package.json yalnız workspace yönetir. packages/api-contracts/schema/contract.json tek makine kaynağı, aynı paketin src/ dizini üretilmiş tip sahibidir. Ortak TS ayarı packages/typescript-config içindedir; yeni runtime çıktısı .artifacts altında, private yerel durum apps/backend/.dev altında kalır.

Backend/frontend test tetiklemeleri [CI kaynak sınırına](docs/ci-policy.md#ci-split--frontendbackend-kaynak-sınırı) göre ayrıdır. Backend/shared pozitif yollar ve incelenmiş belgeler `apps/backend/scripts/ci/scope.json` ile workflow listelerinde birlikte tutulur. Frontend kendi test yapısının sahibidir. Saf belge değişikliğinde backend DB/API/full clean yoktur; karma ve ortak kaynakta gerekli backend kapsamı korunur. Backend verify yalnız `@ftksaas/backend...` Turbo grafiğini çalıştırır. Frontend kapsam status'u frontend test kabulü yerine geçmez.

## Güvenlik ve ortamlar

Uygulanmış migration değiştirilmez. Secrets/token/parola/kişisel veri kaynaklara ve raporlara yazılmaz. Yeni istemci Supabase native Auth ve Edge backend-v1 kullanır; core/private tablo veya service-only RPC erişimi yoktur. JWT doğrulaması açık kalır. Bariz güvenlik/fonksiyon açığı yoksa sağlayıcı davranışını tekrar eden bakım katmanı eklenmez.

Kullanıcının 27 Ekim seçimi: frontend gerçek API entegrasyonu mevcut geliştirme Supabase’ine bağlanır. Yerel/CI reset ve seed yalnız loopback izole DB’de çalışır. Hosted veriye reset/clean/seed uygulanmaz. Production dağıtımı/DNS veya eski studiosaas uygulamasının değiştirilmesi bu taşımanın yetkisi değildir. Platform Auth/Resend kurulumu önceki kabul kapsamındadır; yeni marketing/dış gönderim yetkisi yoktur. Gerçek widget/provider/ekran/yük/restore kabulünü mock ile kapatma.

## Geliştirme ve teslim

Ayrı branch + Draft PR kullan. İlgili kod/sözleşme/üreteç/açık iş/entegrasyon belgesini aynı PR’da güncelle. Frontend dosyalarını taşırken TSX/CSS davranış değişikliğini ayrıca gerekçelendir. Bağımsız inceleme son kaynakta yapılır; test assertion’ları veya güvenlik kapıları sonucu yeşile çevirmek için gevşetilmez.

[CI politikası](docs/ci-policy.md): main tabanlı açık PR’de otomatik kapsam seçimi; backend/shared değişimde gerçek merge ağacında core+dört API shard full clean, saf belgede tek hafif kabul, frontend-only kaynakta backend testi yoktur. Draft test edilebilir fakat merge edilemez. Targeted yalnız main’den tam base/head SHA aralığı için manuel tanıdır; kabul yerine geçmez. Main testleri tekrarlamadan adayın kaynak/run/attempt/job kanıtını doğrular. API süre dengesi yalnız uyarı/ölçümdür; süre farkı veya eksik ölçüm başarılı fonksiyon/kaynak kabulünü engellemez. Core/dört API gerçek test başarısı ve kaynak/run/attempt güvenliği zorunludur. Bütün workflow’lar trusted politika yüzeyidir; kaynak/head/base/merge-tree, dört shard ve exact-source kurulum yetkisi korunur. Required-check/strict-base/bypass kanıtsız uygulanmış sayılmaz; sahte status veya bypass yoktur.

Kendi commit SHA’sını belge içine yazmak veya sırf yeni run bağlantısı için sonsuz belge commit’i oluşturmak gerekmez. Sonuç bir sonraki doğal belge değişikliğinde tek durum kaynağına işlenir.

## Full clean sırasında kullanıcıya devir

Aday/main full clean başlayınca run URL/ID, PR, head/base/tested merge SHA, sıra ve sonraki adımı paylaş; turu bitir. Yanıtta run URL yoksa workflow ve tetikleme zamanını kaydet; run aramak için bekleme. Kullanıcı dönene kadar polling/log takibi/sleep döngüsü/watch/arka plan izleyici/otomasyon yoktur; aynı clean tekrar tetiklenmez.

Kullanıcı döndüğünde gerçek sonuç ve güncel kaynak bir kez doğrulanır. Hâlâ çalışıyorsa yeniden durulur. Başarısızsa kaynak bağlı dar düzeltme yapılır; başarı ve mevcut yetki varsa merge edilir. Yeni full clean başlarsa tekrar devir yapılır. Aynı main kanıt kabulü ve gerekli development CD doğrulanmadan teslim kapatılmaz. CI çalışır; duran ajan izlemesidir.

## Ortak iş akışı ve belge sahipliği

Son kullanıcı kararı: backend liderliğinde tanımlanan iş akışı projenin iş akışıdır. Normatif sözleşmeler, kabul edilmiş ürün kararları, entegrasyon protokolü ve WF rehberleri kök `docs` altında kalır. Backend sohbet devri/geliştirme/operasyon notları `apps/backend/docs`, frontend çalışma/tasarım notları `apps/web/docs` altındadır; kök README/AGENTS yalnız giriş ve kuralları taşır. Tarihsel ortak denetim arşivi kaynak/hash bağlamıyla korunur.

Backend ve frontend önce [iş akışlarını](docs/workflows.md) ve ilgili [API eşlemesini](docs/functions.md) okur. Backend değişen davranışın rehberini, makine sözleşmesini, test eşlemesini ve alan devrini aynı PR'de günceller. Frontend PR'si ilgili WF kimliğini, gerçek API sırasını, yetki/plan sınırını, hata/kurtarma ve başarı sonrası yeniden okumayı açıklar; desteklenmeyen selector/okuma ürün kuralı tahminiyle doldurulmaz. Bütün API'leri çağırmak değil gerekli kullanıcı akışını tamamlamak hedeflenir.

`docs/workflows.json` incelenen kaynak/test bağlarını ve inceleme parmak izini taşır; çalıştırılabilir CI girdisidir ve Markdown muafiyeti almaz. [Dokümantasyon çalışma rehberi](apps/backend/docs/documentation-development.md) üretim, inceleme ve CD kapsamını açıklar. CI bağlantı/kapsam/üretim eskimesini yakalar; anlatım doğruluğunu veya gerçek hosted kabulünü kendiliğinden kanıtlamaz. CD yeni ürün anlatımı üretip main'e push yapmaz.
