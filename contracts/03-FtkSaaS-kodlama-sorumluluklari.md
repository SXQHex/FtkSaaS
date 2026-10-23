> 23 Ekim 2026 güncel durum: P01–P07 kod/main/geliştirme-test kabulü kapandı; yayımlanmış kapsam **200 API / 0 contract_only / 59 migration / 90 core tablo / Edge8**. P07 runtime kaynağı `4cfc9a55`; güncel belge tabanı `bfb8ccb2`. Beş Cron hattı aktif ve boş kuyrukta healthy/idle; fiziksel imha ve gerçek yük kabulü tamamlanmış değildir. Ayar davranış sprinti ve güncel entegrasyon sınırları [tek devir](00-FtkSaaS-yeni-sohbet-devir.md) ve [ayarlar sözleşmesinde](02-FtkSaaS-teknik-sozlesme.md#ayarlar-sozlesmesi-ve-davranis-sprinti). Eski tarih/CI/pending snapshotları yeni durum kanıtı değildir; ürün kuralları yalnız son açık kararla değişir.

# FtkSaaS — Kodlama sorumlulukları ve model yetki sınırları

## 23 Ekim 2026 yürürlükteki çalışma kararı

[AGENTS](../AGENTS.md), [settings sözleşmesi](02-FtkSaaS-teknik-sozlesme.md#ayarlar-sozlesmesi-ve-davranis-sprinti) ve [Claude talimatı](../docs/claude-handover.md) geçerlidir. P01–P07 kabulü kapandı; şimdi frontend başlangıcı için belge eşitlemesi ve davranış karar sprinti yürür. Yeni settings runtime geliştirmesi kullanıcı tarafından durduruldu. Belge onayı, UI tasarım kararı ve çalışan API ayrı teslimdir.

CI-02 otomasyonu kuruludur. Geliştirmede Draft/development ve birikimli hedefli doğrulama; runtime/CI son adayda kaynak bağlı full clean, merge sonrası aynı main full clean; incelenmiş güvenli yalnız-belge kaynağında ayrı belge kabulü. Mevcut kapı veya izin listesi bu görevle değiştirilmez. Önceden verilen somut yetki tekrar onaylatılmaz; genel üretim kuyruğu frontend/production/repository yönetim yetkisi vermez.

> **Güncel öncelik: Q-E02 · 0.2.0-rc.3.** Kullanıcının 16 Ekim 2026 son iptal kabulü önceki çelişen merkez iptali hükümlerinin yerine geçer. Güncel davranış/kanıt: docs/decisions/Q-E02.md, docs/claude-handover.md ve reports/qe02-verification.json. Aşağıdaki eski durum/test sayıları tarihsel kayıttır; teknik aktarım bekleyen işler tamamlandı sayılmaz.

> **Q-D01 durumu:** Etkinlik disiplin/kapsam matrisi ve negatif kredi yasağı kabul edilmiş ve runtime’a aktarılmıştır. İlk teknik aktarım raporları tarihsel kanıttır; güncel kaynak/kabul [tek devirde](00-FtkSaaS-yeni-sohbet-devir.md) ve işlem envanterindedir.

> **İlk aktarımın tarihsel sınırı:** 2.2-tech.1 döneminin iki migration ve kurulum bekleme notları bugünkü uygulama açığı değildir. D01–D09/U01–U08 aktarımı mevcuttur; bütün ürünün kabulü, hosted ve production durumu bundan çıkarılmaz.

> Güncel UUID üretim standardı: U01–U08, UUIDv7. Sağlayıcı kimlikleri korunur.

> Güncel ek: D01–D09 disiplin revizyonu kabul edilmiştir; aşağıdaki tarihsel teknik tamamlanma ifadeleri yeni kapsamı içermez. Kabul hükümleri belgenin sonundadır; güncel kalan uygulama listesi docs/remaining-work.md üzerinden okunur.

Tarih: 15 Ekim 2026 · Sürüm: 1.0 · Durum: Çalışma düzeni kabul edildi; belirli kodlama/merge/üretim işlemi başlatılmadı

## 1. Sorumluluk ve dosya sahipliği

FtkSaaS bağımsız yeni projedir. Eski studioSaaS kodu/tablosu/kuralları incelenmez, devralınmaz, karşılaştırılmaz veya yamalanmaz. Tek güncel repository SXQHex/FtkSaaS, kaynak dalı main’dir. İlk istemci mobil öncelikli web/PWA, sonra platform istemcileri ortak backend sözleşmesini kullanır.

| Alan | Sorumlu |
|---|---|
| İş modeli, veri/API/yetki sözleşmesi | ChatGPT; ürün davranışını değiştiren kararları kullanıcı kabul eder. |
| Supabase şema, migration, RPC, Edge Functions, backend testleri | ChatGPT |
| Frontend tasarım, ekran, görsel dil, kullanıcı akışı, istemci kodu ve frontend testleri | Claude; ChatGPT bu tasarım/koda müdahale etmez. |
| Ortak API tipleri | Backend sözleşmesinden üretilir; modeller ayrı elle tip kopyaları oluşturmaz. Mevcut üretilmiş paket packages/contracts yolundadır; packages/api-contracts reorganizasyon hedefi uygulanmış dosya yolu gibi kullanılmaz. |
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

## 6. Güncelleme kaydı

- 0.2 — 15 Ekim 2026: İş bölümü/frontend sınırı kabul, çalışma ayrıntıları taslaktı.
- 1.0 — 15 Ekim 2026: Tek repository, alan sahipliği, branch/PR, ortak tip üretimi, mock, test, secret ayrımı, migration/merge/üretim yetkileri ve değişiklik/teslim süreci açık kullanıcı kabulleriyle kesinleştirildi. Repository adresi, framework/hosting ve somut CI/hesap kurulumları henüz seçilmedi.

## 15 Ekim 2026 — D01–D09 disiplin revizyonu (kabul edildi)

Belge paketi revizyonu: 2.1. Bu bölüm önceki çelişen disiplin, paket kapsamı ve negatif kredi hükümlerinin yerini alır. Önceki sürüm numaraları ve denetim sayıları tarihsel tabanı gösterir.

**D01.** Disiplin organizasyon düzeyinde tanımlanır; merkezler sundukları disiplinleri kullanıma açar. Aynı organizasyonun merkezleri aynı disiplin kimliğini kullanır.

**D02.** Eğitmen birden fazla merkez/disiplinde görev alabilir. Öğrenci birden fazla merkez/disipline kayıt olabilir; organizasyon kişi kaydı çoğaltılmaz. Öğrenci eğitmenin alt kaydı değildir; eğitmen değişimi öğrencinin kimliğini veya haklarını değiştirmez.

**D03.** Normal ders/seansın merkezi ve disiplini belirgindir. Merkezlerin program, fiyat ve eğitmen anlaşmaları ayrı kalır. Disiplin ilişkisi yeni uygulama rolü veya operasyon yetkisi vermez.

**D04.** Paket kullanım kapsamları: merkez+disiplin; merkezin bütün disiplinleri; organizasyonun bütün merkezlerinde belirli disiplin; organizasyonun bütün merkez ve disiplinleri. Organizasyon sınırı aşılamaz; mevcut SaaS plan/merkez erişim sınırları korunur.

**D05.** Ders/etkinlik uygunluğu kullanım kapsamından ayrı belirtilir. Organizasyon genelinde etkinlik paketi bütün normal derslerde kendiliğinden geçmez. Geniş kapsam kapalı sınıf, kapasite, tarih ve diğer uygunluk kurallarını aşmaz.

**D06.** Dar kapsamlı disiplin hakları başka disiplinde kullanılamaz; başka disipline ait paket, kapsam dışındaki kredi açığını kapatamaz. Birden fazla disiplinde geçerli 10 kredilik paket toplam 10 kredi sağlar; disiplin başına ayrı 10 kredi oluşmaz.

**D07.** Negatif kredi sınırı öğrenci için merkez–disiplin bazında uygulanır. Aynı kapsamdaki ayrılmış ve tüketilmiş açık birlikte sayılır; mevcut rezervasyon iki kez sayılmaz. Bir disiplindeki kredi açığı diğer disiplinin katılımını engellemez. Organizasyon geneli kişi açığı üzerinden tek katılım sınırı uygulayan eski hükümler bu kararla değiştirilmiştir.

**D08.** Geniş kapsamlı paket, uygun olduğu merkez/disiplinlerdeki açıkları mevcut kapatma sırasıyla karşılayabilir: önce geçmiş tüketilmiş açık, sonra gelecek rezervasyon açığı. Uygun hak seçiminde en erken bitiş, eşitlikte önce satın alma ve mevcut kararlı eşitlik çözümü korunur. Paket kapsamı uygunluk filtresidir.

**D09.** Seans başlangıcındaki limit kontrolü ve sonradan ödemenin geçmiş katılım/hakedişi değiştirmemesi korunur; kontrol artık ilgili merkez–disiplin kapsamındadır. Para borcu ile kredi açığı ayrı kavramlardır.

**Teknik aktarım durumu:** D01–D09 kapsamı şema, API, izin ve ortak tiplerde mevcuttur; Q-D01 etkinlik kapsamı/negatif kredi ve ortak hak akışı uygulanmıştır. İlk aktarım tarihindeki açık listesi güncel iş listesi değildir; bugün kalanlar docs/remaining-work.md ve kaynak bağlı kabul kayıtlarında izlenir.

Güncel kullanıcı görevi ve AGENTS çalışma sınırı esastır. Bu belge teslimi runtime/migration/istemci değişikliği başlatmaz. Claude frontend, ChatGPT backend sorumluluğu korunur.

## 15 Ekim 2026 — U01–U08 UUIDv7 standardı (kabul edildi)

Paket revizyonu: 2.2. D01–D09 disiplin kararları korunur. Bu bölüm önceki çelişen UUID üretim önerilerinin yerini alır.

**U01.** FtkSaaS tarafından üretilen bütün UUID değerleri için UUIDv7 zorunlu standarttır. Domain kayıtları, işlem/idempotency anahtarları, request/trace kimlikleri ve geçici teknik UUID değerleri bu kapsamdadır. UUIDv1/v4/v5 üretimi için önceki öneriler yürürlükte değildir; istisna yeni açık karar gerektirir.

**U02.** Domain kayıt kimlikleri varsayılan olarak backend tarafından üretilir. UUID üretmesi gereken istemci, test verisi, seed, worker, Edge veya diğer FtkSaaS bileşeni de UUIDv7 kullanır. Bu karar istemciye yeni kayıt oluşturma veya operasyon yetkisi vermez.

**U03.** Supabase Auth ve diğer dış sağlayıcıların ürettiği kimlikler aynen korunur; yeniden UUIDv7 yapılmaz. Üretim standardı ile dış kimlik kabulü ayrıdır. Mevcut UUID değerleri sırf sürümü farklı diye yeniden yazılmaz; FK ve dış referanslar bozulmaz.

**U04.** Aynı kişinin farklı organizasyonlardaki kişi kayıtları bağımsız UUIDv7 alır. E-posta/telefon/isimden deterministik kimlik türetilmez; disiplin kayıtları için de aynı üretim standardı geçerlidir.

**U05.** UUIDv7 RFC 9562 uyumlu, güvenli rastgelelik kullanan doğrulanmış üreticiyle üretilir; timestamp eklenmiş özel UUID algoritması yazılmaz. Seçilen Supabase/PostgreSQL ortamındaki yerleşik üretim desteği teknik kurulumda doğrulanır; yoksa denetlenmiş uyumlu üretici seçilir, v4 fallback yapılmaz. Üretici yoksa ilgili üretim açılmaz.

**U06.** UUIDv7 yaklaşık üretim zamanını açığa çıkarabilir. created_at, seans zamanı ve audit zamanı ayrı alanlardır; UUID kesin küresel işlem sırası, iş tarihi veya yetki kanıtı sayılmaz. Sıralama ve eşzamanlılık kuralları açık iş alanlarına dayanır.

**U07.** Davet, hesap erişimi ve benzeri bearer token değerleri UUID kimliği değildir; güvenli rastgele token standardı korunur. Tokenlar UUIDv7 ile değiştirilmez. operation_key UUIDv7 olsa da retry aynı anahtarı yeniden kullanır; her denemede yeni UUID üretmek idempotency kuralını bozar.

**U08.** PostgreSQL alan tipi uuid olarak kalır. UUIDv7 üretim standardı bütün dış UUID girişlerini v7 diye reddetmek anlamına gelmez. FtkSaaS üretimi olan alanlarla sağlayıcı kimliği alanlarının şema/DTO eşlemesi teknik sohbette tamamlanır; yetki ve tenant kontrolü UUID sürümünden bağımsız uygulanır.

**Güncel teknik durum:** UUIDv7 üretim politikası ortak tip, backend üreticisi ve migration/çalışma zamanı yollarına aktarılmıştır. PostgreSQL default üreticisinin kapalı olması doğrulanmış backend UUIDv7 üretimini yok saydırmaz; v4 fallback yoktur. İlk aktarım tarihinin kurulum bekleme notları tarihsel kayıttır. Güncel CI/hosted/production kabulü tek devirde ayrı izlenir.

