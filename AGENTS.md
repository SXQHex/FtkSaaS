# FtkSaaS çalışma kuralları

Kod yazmadan önce [CONSTRAINTS.md](CONSTRAINTS.md) kalite sözleşmesini oku; bir değişikliği geçirmek için zayıflatma.

## Başlangıç ve kaynak önceliği

Önce bu belgeyi, [kaynak indeksini](docs/source-index.md) ve görevin alanındaki README/AGENTS dosyalarını oku. Alanın planı, kabulü ve devri kendi `apps/backend/docs` veya `apps/web/docs` klasöründen alınır; diğer alan yalnız ilgili sözleşme/bağımlılık için okunur. Ardından belge haritasından tek konu sahibini ve ilgili WF/typed consumer kaynağını seç. Varsayılan belge aramasında `docs/history/**` ve eski Git sürümlerini dışla. Arşiv yalnız açık tarihsel soru için okunur; güncel kural, iş veya kabul kanıtı olamaz. Tam başlangıç SHA’sını ve aynı SHA’nın gerçek CI sonucunu doğrula. Eski başarı yeni kaynağa taşınmaz.

Son açık kullanıcı kararı üstündür; kabul edilmiş D01–D09/U01–U08/Q-D01/Q-E02/Q-E03 ve FD01–FD12 hükümleri korunur. Bilinmeyen ürün, fiyat, politika veya config değeri uydurulmaz. Karar, uygulama, test, merge ve hosted kabulü ayrı durumlardır.

## Belge yazma sınırı

**Yalnız görevinle ilgili, yetkili olduğun dosya ve bölümleri güncelle. Okuma gerekliliği yazma yetkisi vermez.**

| Alan | Yazma sınırı |
|---|---|
| Frontend | Plan, ilerleme, test/kabul ve sohbet devri `apps/web/docs`; gerekiyorsa kendi README’si. Backend belgeleri ve ortak sözleşmeler salt okunur. |
| Backend | İlerleme, backlog, sıra, test/kabul ve sohbet devri `apps/backend/docs`; gerekiyorsa kendi README’si. Kök `/docs` yalnız görevde değişen ortak ürün/API/iş akışı sözleşmesi ve gerekli teknik referans için güncellenir. Frontend belgeleri salt okunur. |
| Ortak talepler | Her iki alan [docs/requests.md](docs/requests.md) içinde yalnız kendi talep/değerlendirme/onay alanını yazar. Karşı taraf adına onay vermez; diğer alanın todo veya devrini değiştirmez. |

- `/docs` ortak iş/makine kuralları ve sözleşmeler içindir; geliştirme durumu veya sohbet devri buraya yazılmaz. Tek takip istisnası ortak talep dosyasıdır.
- Kapsam dışı değişiklik gerekiyorsa veya yetki belirsizse **hangi dosya/bölümü neden değiştireceğini açıklayıp kullanıcıdan onay iste; onaydan önce o değişikliği yapma.** Yetkili alanındaki bağımsız işe devam et. Aynı görev için verilmiş açık yetkiyi tekrar sorma.
- “İlgili belgeleri güncelle”, generator, CI hatası veya tutarlılık düzeltmesi kapsamı genişletmez. AGENTS, ortak sahiplik kayıtları ve CI politikası değişikliği görevde açıkça yetkilendirilmiş olmalıdır.
- Commit/PR öncesi yeni dosyalar ve taşımanın iki ucu dahil bütün farkı kontrol et. Kendi kapsam dışı değişikliğini teslim etme; başkasının veya main’den gelen değişikliği geri alma. Talep kaydı tek başına uygulama/merge yetkisi değildir.

## Tek kaynak ve dosya sahipliği

**SSoT kesin ilkedir:** Her karar, görev, sıra ve kabul bilgisinin tek sahibi vardır. Başka belgede aynı hükmü veya güncellenen iş listesini kopyalama; sahibine bağlantı ver. Yeni roadmap/todo/özet dosyası açmadan mevcut sahibini kullan. Gereksiz dosyanın eşsiz hükmü varsa önce sahibine taşı; sonra dosyayı ve artık referanslarını kaldır. Tarihsel kanıtı silme; eski yaşayan anlatımı Git geçmişinde bırak. Onaylanan hedef davranış ile mevcut makine sözleşmesi/runtime desteğini aynı şey gibi yazma.


[Belge haritası](docs/documentation-map.md) her yaşayan dosyanın rolünü ve tek konu sahibini gösterir. Backend durum kaydı 00 devir, açık işi remaining-work, sırası production-queue; frontend plan/kabulü todo, sohbet devri handover sahibindedir. Başka dosyalar durumu kopyalamaz, sahibine bağlanır. Tarihsel `docs/history` byte’ları korunur; kaynak/commit/hash izi manifesttedir. Üretilmiş katalog/tipler üreticiden güncellenir; ikinci sözleşme ağacı kurulmaz.

SXQHex/FtkSaaS tek geliştirme reposudur; diğer repolar bağlam dışıdır. Frontend uygulaması apps/web, ortak hazır bileşenler packages/ui içindedir. Güncel tasarım/geliştirme rehberi apps/web/docs/development.md, frontend açık kapsam ve bölüm kabulü apps/web/docs/todo.md sahibindedir. Geçmiş geri alma/göç notundan yeni runtime görevi türetilmez. apps/backend backend kod/test/CI araçlarının tek sahibidir; Frontend çalışması backend runtime veya mevcut kabul kapılarını değiştirme yetkisi vermez. Root package.json yalnız workspace yönetir. packages/api-contracts/schema/contract.json tek makine kaynağı, aynı paketin src/ dizini üretilmiş tip sahibidir. Ortak TS ayarı packages/typescript-config içindedir; yeni runtime çıktısı .artifacts altında, private yerel durum apps/backend/.dev altında kalır.

Backend/frontend test tetiklemeleri [CI kaynak sınırına](docs/ci-policy.md#ci-split--frontendbackend-kaynak-sınırı) göre ayrıdır. Backend/shared pozitif yollar ve incelenmiş belgeler `apps/backend/scripts/ci/scope.json` ile workflow listelerinde birlikte tutulur. Frontend kendi test yapısının sahibidir. Saf belge değişikliğinde backend DB/API/full clean yoktur; karma ve ortak kaynakta gerekli backend kapsamı korunur. Backend verify yalnız `@ftksaas/backend...` Turbo grafiğini çalıştırır. Frontend kapsam status'u frontend test kabulü yerine geçmez.

## Güvenlik ve ortamlar

Uygulanmış migration değiştirilmez. Secrets/token/parola/kişisel veri kaynaklara ve raporlara yazılmaz. Yeni istemci Supabase native Auth ve Edge backend-v1 kullanır; core/private tablo veya service-only RPC erişimi yoktur. JWT doğrulaması açık kalır. Bariz güvenlik/fonksiyon açığı yoksa sağlayıcı davranışını tekrar eden bakım katmanı eklenmez.

Kullanıcının 27 Ekim seçimi: frontend gerçek API entegrasyonu mevcut geliştirme Supabase’ine bağlanır. Yerel/CI reset ve seed yalnız loopback izole DB’de çalışır. Hosted veriye reset/clean/seed uygulanmaz. Production dağıtımı/DNS veya eski studiosaas uygulamasının değiştirilmesi bu taşımanın yetkisi değildir. Platform Auth/Resend kurulumu önceki kabul kapsamındadır; yeni marketing/dış gönderim yetkisi yoktur. Gerçek widget/provider/ekran/yük/restore kabulünü mock ile kapatma.

## Geliştirme ve teslim

Ayrı branch + Draft PR kullan. Yalnız görevin yazma kapsamında olan kod ve belge sahiplerinde, değişen davranışla doğrudan ilgili bölümleri aynı PR’da güncelle. Bu yükümlülük belge yazma sınırlarını genişletmez; bütün okunan belgeleri eşitleme görevi değildir. Frontend dosyalarını taşırken TSX/CSS davranış değişikliğini ayrıca gerekçelendir. Bağımsız inceleme son kaynakta yapılır; test assertion’ları veya güvenlik kapıları sonucu yeşile çevirmek için gevşetilmez.

[CI politikası](docs/ci-policy.md): main tabanlı açık PR’de otomatik kapsam seçimi; backend/shared değişimde gerçek merge ağacında core+dört API shard full clean, saf belgede tek hafif kabul, frontend-only kaynakta backend testi yoktur. Draft test edilebilir fakat merge edilemez. Targeted yalnız main’den tam base/head SHA aralığı için manuel tanıdır; kabul yerine geçmez. Main testleri tekrarlamadan adayın kaynak/run/attempt/job kanıtını doğrular. API süre dengesi yalnız uyarı/ölçümdür; süre farkı veya eksik ölçüm başarılı fonksiyon/kaynak kabulünü engellemez. Core/dört API gerçek test başarısı ve kaynak/run/attempt güvenliği zorunludur. Bütün workflow’lar trusted politika yüzeyidir; kaynak/head/base/merge-tree, dört shard ve exact-source kurulum yetkisi korunur. Required-check/strict-base/bypass kanıtsız uygulanmış sayılmaz; sahte status veya bypass yoktur.

Kendi commit SHA’sını belge içine yazmak veya sırf yeni run bağlantısı için sonsuz belge commit’i oluşturmak gerekmez. Sonuç bir sonraki doğal belge değişikliğinde tek durum kaynağına işlenir.

## Full clean sırasında kullanıcıya devir

Aday/main full clean başlayınca run URL/ID, PR, head/base/tested merge SHA, sıra ve sonraki adımı paylaş; turu bitir. Yanıtta run URL yoksa workflow ve tetikleme zamanını kaydet; run aramak için bekleme. Kullanıcı dönene kadar polling/log takibi/sleep döngüsü/watch/arka plan izleyici/otomasyon yoktur; aynı clean tekrar tetiklenmez.

Kullanıcı döndüğünde gerçek sonuç ve güncel kaynak bir kez doğrulanır. Hâlâ çalışıyorsa yeniden durulur. Başarısızsa kaynak bağlı dar düzeltme yapılır; başarı ve mevcut yetki varsa merge edilir. Yeni full clean başlarsa tekrar devir yapılır. Aynı main kanıt kabulü ve gerekli development CD doğrulanmadan teslim kapatılmaz. CI çalışır; duran ajan izlemesidir.

## Ortak iş akışı ve belge sahipliği

Son kullanıcı kararı: backend liderliğinde tanımlanan iş akışı projenin iş akışıdır. Normatif sözleşmeler, kabul edilmiş ürün kararları, entegrasyon protokolü ve WF rehberleri kök `docs` altında kalır. Backend sohbet devri/geliştirme/operasyon notları `apps/backend/docs`, frontend çalışma/tasarım notları `apps/web/docs` altındadır; kök README/AGENTS yalnız giriş ve kuralları taşır. Tarihsel ortak denetim arşivi kaynak/hash bağlamıyla korunur.

Backend ve frontend önce [iş akışlarını](docs/workflows.md) ve ilgili [API eşlemesini](docs/functions.md) okur. Backend değişen davranışın rehberini, makine sözleşmesini, test eşlemesini ve alan devrini aynı PR'de günceller. Frontend PR'si ilgili WF kimliğini, gerçek API sırasını, yetki/plan sınırını, hata/kurtarma ve başarı sonrası yeniden okumayı açıklar; desteklenmeyen selector/okuma ürün kuralı tahminiyle doldurulmaz. Bütün API'leri çağırmak değil gerekli kullanıcı akışını tamamlamak hedeflenir.

`docs/workflows.json` incelenen kaynak/test bağlarını ve inceleme parmak izini taşır; çalıştırılabilir CI girdisidir ve Markdown muafiyeti almaz. [Dokümantasyon çalışma rehberi](apps/backend/docs/documentation-development.md) üretim, inceleme ve CD kapsamını açıklar. CI bağlantı/kapsam/üretim eskimesini yakalar; anlatım doğruluğunu veya gerçek hosted kabulünü kendiliğinden kanıtlamaz. CD yeni ürün anlatımı üretip main'e push yapmaz.

## Karar ve alan koordinasyonu

Backend ajanı ürün/veri/API/yetki sözleşmesi, SQL/migration/RPC/Edge ve backend kabulünün; frontend ajanı tasarım/ekran/istemci ve frontend testlerinin sahibidir. Ürün davranışını kullanıcı kabul eder. Model adı örtük ortak hafıza veya erişim sağlamaz. API/iş kuralı boşluğu kalıcı yeni alan/durum/izin icat etme yetkisi değildir; ihtiyaç kendi alanının tek plan/backlog sahibinde belirtilir. Ortak sözleşmeler koordinasyonsuz iki yerde değiştirilmez.

Mock yayımlanmış DTO/izin/hata sözleşmesine uyar; üretimde sahte başarı fallback’i yoktur. Gerçek kişisel/finans verisi fixture yapılmaz. Merge ve production migration/dağıtımı, zorunlu kontroller ve hazır inceleme sonucu sonrasında kullanıcının kapsamı açık yetkisini gerektirir; aynı kapsam tekrar onaylatılmaz. Production veri silme/reset/geri döndürülemez dönüşüm ayrı açık yetki ister. Kod rollback’i DB restore değildir.

Bir karar değişince kendi yetkili bölümünü değiştir; eski hükmün üstüne yeni tarihli zıt paragraf ekleme. Aynı karar ikinci dosyada kopyalanmaz; diğer roller bağlantı verir. Yerine geçen dokümanın eşsiz hükümlerini sahibine taşı, dosyayı sil ve emekli yol kaydını güncelle. `docs/documentation.json` yaşayan belge/konu sahipliğinin makine kaynağıdır; üretilmiş belge haritası elle değişmez. Kabul/devri güncellerken eski checkpoint’leri biriktirme; geçmiş Git’te korunur.
