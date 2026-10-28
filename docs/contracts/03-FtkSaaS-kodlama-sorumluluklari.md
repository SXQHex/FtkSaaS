# Kodlama ve değişiklik sorumlulukları

Çalışma/CI/ortam kurallarının sahibi [AGENTS](../../AGENTS.md); güncel kabulün sahibi [00 devir](00-FtkSaaS-yeni-sohbet-devir.md). D01–D09/U01–U08 normatif hükümleri [01 ürün](01-FtkSaaS-urun-kapsam-sozlesmesi.md) ve [02 teknik](02-FtkSaaS-teknik-sozlesme.md) içindedir; burada yeniden kopyalanmaz.

## 1. Sorumluluk ve dosya sahipliği

Tek kaynak SXQHex/FtkSaaS main’dir. Kullanıcının son görevi repo hazırlığı ve sonrasında saaspt frontend göçüdür; eski studioSaaS uygulaması bu göçün kaynağı değildir. Frontend tasarımı/etkileşimleri korunur; repo/araç/ortak tip taşıması yetkili görevdir.

| Alan | Sorumlu |
|---|---|
| İş modeli, veri/API/yetki sözleşmesi | ChatGPT; ürün davranışını değiştiren kararları kullanıcı kabul eder. |
| Supabase şema, migration, RPC, Edge Functions, backend testleri | ChatGPT |
| Frontend tasarım, ekran, görsel dil, kullanıcı akışı, istemci kodu ve frontend testleri | Claude; Repo hazırlığı/göç görevinde dosya taşıma kullanıcı yetkisindedir; tasarım değişikliği bu yetkiden türetilmez. |
| Ortak API tipleri | Backend sözleşmesinden üretilir; modeller ayrı elle tip kopyaları oluşturmaz. Tek paket packages/api-contracts; makine sözleşmesinden üretilir. |
| Uçtan uca kabul | Gerçek test backend’iyle ayrıca doğrulanır; yalnız alan testleri veya mock yeterli değildir. |

Modeller birbirinin alanını doğrudan değiştirmez; eksik/değişiklik ihtiyacını sözleşme üzerinden bildirir. ChatGPT API/kabul senaryosu ve entegrasyon etkisini sağlar, Claude tanımlı API’yi kullanır ve eksiklik bildirir. Frontend kontrolü backend yetkisini veya bütünlük kuralını ikame etmez. Model adları sorumluluk etiketidir; kendiliğinden ortam/hafıza/erişim paylaşımı varsayılmaz.

## 2. Branch, PR ve sözleşme koordinasyonu

Her çalışma ayrı branch’te yürür, PR üzerinden birleştirilir. Ortak sözleşmeler aynı anda koordinasyonsuz değiştirilmez. API/iş modeli eksikliği kalıcı yeni alan/durum/hata/ürün kuralı icat etme izni değildir; değişiklik önerisi açılır. Kabul edilmiş davranışı koruyan gerekli teknik ayrıntılar sözleşmeye işlenir. Şema/API değişimi tek taraflı ürün kapsamı değişikliği olamaz.

## 3. Mock ve gerçek entegrasyon

Claude yalnız yayımlanmış API sözleşmesine uyan mock ile ilerleyebilir; istek/yanıt tipleri, durum ve hata kodları ortak sözleşmedendir. Mock eksik kuralı doldurmaz. Mock çalışan özellik entegrasyon bekliyor sayılır; gerçek backend yetki/plan/eşzamanlılık/hata senaryoları doğrulanmadan tamamlandı değildir. Üretimde mock/sahte başarıya otomatik geçiş yoktur. Sözleşme değişince tipler yeniden üretilir, uyumsuzluk entegrasyon kontrolünde yakalanır. Test verisi sentetiktir; gerçek öğrenci/finans verisi geliştirmeye kopyalanmaz.

## 4. Merge, migration ve dağıtım yetkileri

| İşlem | Yetki |
|---|---|
| Kendi alanında kod/test/PR hazırlama | İlgili model, verilmiş görev kapsamında |
| İzole geliştirme/test migration ve dağıtımı | İlgili model, verilmiş görev kapsamında ve dosya sahipliğini koruyarak |
| Ana branch’e merge | Zorunlu kontroller sonrası kullanıcı açık onayı |
| Üretim migration/dağıtım | Etki ve doğrulama sonucu hazırlandıktan sonra kullanıcı açık onayı |
| Üretim veri silme, şema sıfırlama, geri döndürülemez dönüşüm | Kapsamı belirtilmiş ayrı kullanıcı açık onayı |

Tek onay açıkça belirtilmiş PR/sürüm için merge + migration + dağıtımı birlikte kapsayabilir; aynı kapsam tekrar onaylatılmaz. Somut işlem kapsamı dışındaki genel kabul üretim izni değildir. Önce incelemeye hazır sonuç hazırlanır, onay son adımdır. Üretim öncesi migration testte denenir; yedek/kurtarma doğrulanır. Uygulanmış migration dosyası değiştirilmez, yeni düzeltme migration’ı yazılır. Kod sürümüne dönüş veritabanını otomatik geri almaz; ikisi kurtarma planında ayrı ele alınır.

Geliştirme/test ve üretim kimlik bilgileri ayrılır. Gizli anahtar repository veya frontend’e konmaz. İlk kurulumun bu eski notu tarihsel durumdur; güncel bağlantı/CI ve eksik ortam işleri yaşayan devirden okunur, hosted/production kurulumu varsayılmaz.

## 5. Kabul edilmiş değişiklik ve teslim süreci

1. Öneri: Kural değişikliği gerekçe/etkilenen alanlarla yazılır.
2. Kabul: Ürün davranışı değişikliğini kullanıcı onaylar; aynı davranışı koruyan teknik düzeltme yeni ürün kararı gerektirmez.
3. Belge: Kabul önce ilgili sözleşmeye işlenir; öneri ile yürürlükteki hüküm ayrılır.
4. Kod: Alan sahibi uygular; API değişiyorsa ortak tip/entegrasyon örnekleri güncellenir.
5. Doğrulama: Backend ChatGPT, frontend Claude; uçtan uca gerçek test backend’iyle ayrıca kontrol edilir.
6. Teslim: PR’da değişiklik, kontrol sonucu ve eksikler yazılır; merge/üretim onayı bölüm 4’e göre alınır.

İlgili kabul senaryoları doğrulanmadan özellik tamamlandı değildir. Mock, eksik entegrasyon ve çalıştırılmamış test açıkça belirtilir. Bu çalışma düzeni sözleşme hazırlığından kendiliğinden kodlama görevine geçirmez.

