> Güncel öncelik: [DS-2026-10-17](../docs/decisions/DS-2026-10-17.md). Çelişen eski hükümler yalnız belirtilen kapsamda yürürlükten kalkmıştır. [Hedef sözleşme/runtime ayrımı](../docs/decision-sprint-handover.md).

> **Güncel ek: Q-E03.** Parasal iptal sınırı planlanan başlangıçtır (eşitlik dahil sonrası). Q-E02 merkez iptali korunur. Teknik durum: docs/decisions/Q-E03.md; test/CI kanıtı ayrıca doğrulanır.

# FtkSaaS — Teknik sözleşme

> **Güncel öncelik: Q-E02 · 0.2.0-rc.3.** Kullanıcının 16 Ekim 2026 son iptal kabulü önceki çelişen merkez iptali hükümlerinin yerine geçer. Güncel davranış/kanıt: docs/decisions/Q-E02.md, docs/claude-handover.md ve reports/qe02-verification.json. Aşağıdaki eski durum/test sayıları tarihsel kayıttır; teknik aktarım bekleyen işler tamamlandı sayılmaz.

> **Güncel 2.2-tech.2 / Q-D01:** Etkinlik 0/1/çok disiplin etiketini destekler. Tek etikette etkinliğe uygun dar/geniş paket, 0/çok etikette yalnız uygun geniş paket; etkinliklerde negatif kredi yok. Q-D01 ürün kararı kapalı; ilk aktarım durumları tarihsel, güncel runtime/kabul envanter ve CI’dadır. Güncel durum 11-FtkSaaS-Q-D01-teknik-aktarim-raporu.md.

> **Güncel teknik uygulama kaydı — 2.2-tech.1, 15 Ekim 2026:** D01–D09/U01–U08, 04–08 kataloglarına ve ortak tiplere aktarıldı. İki migration izole geliştirme DB’sinde uygulandı. Aşağıdaki eski “kod/kurulum yapılmadı” ve “teknik aktarım bekliyor” ifadeleri tarihsel kayıt olarak okunur. İş RPC’leri, ayrıntılı izin RLS politikaları ve gerçek iş akışı kabul testleri açık; Bu ilk aktarım notu tarihsel; Q-D01 kapalıdır. Güncel durum 09 teknik aktarım raporundadır.

> Güncel UUID üretim standardı: U01–U08, UUIDv7. Sağlayıcı kimlikleri korunur.

> Güncel ek: D01–D09 disiplin revizyonu kabul edilmiştir; aşağıdaki tarihsel teknik tamamlanma ifadeleri yeni kapsamı içermez. Ayrıntı ve açık teknik aktarım listesi belgenin sonundadır.

Tarih: 17 Ekim 2026 · Sürüm: DS-2026-10-17 aktarımı · Durum: İş kararları ve O4 yazılı teknik sözleşmesi tamamlandı; uygulama/üretim ve hukuki doğrulama açık

## 1. Bağlayıcılık, kaynak ve sınır

Ürün kapsamının kaynağı 01-FtkSaaS-urun-kapsam-sozlesmesi.md; çalışma sorumluluklarının kaynağı 03-FtkSaaS-kodlama-sorumluluklari.md dosyasıdır. Bu sürüm, 15 Ekim 2026 görüşmesindeki açık kabulleri ve son kullanıcı düzeltmelerini birleştirir. Konuşmada terk edilmiş seçenekler yürürlükte değildir.

FtkSaaS bağımsız yeni projedir. Eski studioSaaS kodu, tabloları, frontendleri, iş kuralları, garantileri ve geliştirme modeli kaynak alınmaz. Eski sistem incelemesi, karşılaştırması, migration veya yama çalışması yapılmaz.

14 modül/33 özellik ve Starter/Pro/Business dağılımı, ürün sözleşmesindeki açık revizyonlarla korunur. Modüller ayrı servis zorunluluğu değildir. Kabul edilen sözleşme, özelliğin uygulanmış veya test edilmiş olduğu anlamına gelmez. Fiziksel şema, tam API kataloğu ve kodlama/dağıtım izni bu belgeyle kendiliğinden oluşmaz.

## 2. Kabul edilmiş teknik kararlar: T01–T12

| ID | Kabul edilen hüküm |
|---|---|
| T01 | Supabase üzerinde tek modüler backend. Başlangıçta Supabase Free hedeflenir; Auth, PostgreSQL ve ihtiyaç oldukça Storage/Edge Functions kullanılır. Ayrı mikroservis veya bağımsız uygulama sunucusu zorunlu değildir. |
| T02 | Mimari baştan multi-frontend: web/PWA, Android, iOS, macOS ve Windows aynı sürümlü veri/işlem sözleşmelerini kullanır. Mobil öncelikli web/PWA yalnızca ilk istemcidir; sonraki istemciler için iş modeli yeniden kurulmaz. |
| T03 | Okumalar tanımlı, yetkilendirilmiş API yüzeylerinden yapılır. Supabase Data API üzerinden doğrudan okuma mümkündür; fiziksel tabloların tamamı API sayılmaz. Açık şema, görünüm/fonksiyon erişimi, alan görünürlüğü, grants ve RLS tasarlanır. |
| T04 | İş verisi yazmaları adlandırılmış ortak backend operasyonlarından, ağırlıkla PostgreSQL RPC üzerinden geçer. Edge Functions dış servis, gizli anahtar ve gerekli sunucu işleri içindir; her RPC önüne zorunlu Edge Function konulmaz. Auth ve dosya yükleme kendi güvenli API'lerini kullanır. Kurallar frontend veya web sunucusuna bağlanmaz; SQL ve Edge içinde aynı iş kuralı çoğaltılmaz. |
| T05 | Organizasyona ait kişi kaydı ile organizasyonlar arasında kullanılabilen ortak oturum hesabı ayrıdır. Aynı kişi farklı organizasyonlarda farklı kişi ID'leri alır. Aynı organizasyonda aday/öğrenci/eğitmen/personel ilişkileri için kişi çoğaltılmaz. |
| T06 | Kesin rezervasyonda hak ayrılır; tüketim değildir. Katılımın taslak yoklaması hakkı ayrılmış tutar. Yoklama kapatıldığında katıldı/noShow ve geçerli politikaya göre tüketim veya serbest bırakma kesinleşir. Rezervasyon iptalinde kendi politikası uygulanır. |
| T07 | Rezervasyon, gerekli kontenjan/kaynak kontrolü ve hak ayırma tek atomik işlemde tamamlanır. Eşzamanlı istekler geçerli nominal/maksimum kontenjan veya kredi açığı sınırını aşamaz. Yöneticinin birden fazla operasyon adımından oluşan bütün iş akışı tek işlem olmak zorunda değildir. |
| T08 | Kritik işlemlerde aynı işlem anahtarı + aynı içerik aynı sonucu döndürür; aynı anahtar + farklı içerik reddedilir. Farklı anahtarlarla yinelenen aynı rezervasyon da iş kurallarıyla engellenir. Anahtar kapsamı ve saklama davranışı bölüm 21’de kabul edilmiştir. |
| T09 | Kesinleşmiş para/kredi ve bunlara bağlı hakediş düzeltmeleri önceki kayda bağlantılı hareketlerle yapılır; geçmiş silinmez. Basit profil alanı değişikliği için gereksiz hareket sistemi kurulmaz. |
| T10 | Gerekli bildirim işi iş işlemiyle birlikte kalıcı kaydedilir; gönderim ayrı yürür. Teslimat hatası başarılı işi geri almaz, yeniden deneme izlenir. |
| T11 | Operasyonların tam tipli istek/yanıtları, sabit hata kodları ve sürüm uyumu tanımlanır. Frontend yerelleştirilmiş hata metnini ayrıştırmaz. Eski istemciyi bozan değişiklik sessizce yapılmaz. |
| T12 | Hak kapsamı/geçerliliği dersin gerçekleşeceği tarih/saat için değerlendirilir. Tarih değişiminde uygunluk tekrar kontrol edilir; mevcut rezervasyon otomatik iptal edilmez. İşletme iptali nedeniyle kullanılamayan hak yöneticiye gösterilir; yetkili yönetici süre uzatabilir, sistem kendiliğinden uzatmaz. |

Free plan limitlerinin güncel rakamları değişebilir; kalıcı iş kuralı olarak sabitlenmez. Ücretli altyapıya geçiş mimariyi değiştirmez. FtkSaaS'ın Starter/Pro/Business planları ile Supabase altyapı planı farklı kavramlardır. Tek yeni repository ve dosya sahipliği 03 sözleşmesinde kabul edilmiştir. Repository adresi, frontend frameworkü ve frontend hosting seçimi henüz belirlenmemiştir.

## 3. Kimlik, davet ve erişim yaşam döngüsü

- Kişi kaydı organizasyona aittir ve birden fazla merkezle ilişkilenebilir. Ortak hesap, her organizasyondaki ayrı kişi kaydına doğrulanmış bağlantıyla erişir. Organizasyonlar birbirinin verisini göremez.
- Hesabı olmayan kişi merkez tarafından kaydedilebilir; paket, ödeme ve rezervasyonları hesap açmasını beklemez.
- Yetkili merkez, belirli kişi kaydına ve hedef e-postaya bağlı, süreli/tek kullanımlık davet başlatır. Yeni kullanıcı için davet bekleyen hesap oluşturulur; kullanıcı geçerli e-posta bağlantısıyla şifresini belirler, hesabını etkinleştirir ve kişi kaydına bağlanır. E-postanın gönderilmiş olması tek başına doğrulama değildir.
- Mevcut hesapta ikinci hesap veya yeniden şifre oluşturulmaz; giriş yapılıp organizasyon bağlantısı kabul edilir. Davet hedefi doğrulanmış hesap adresiyle eşleşmelidir. Aynı e-posta/telefon kendi başına eşleştirme veya erişim hakkı vermez.
- Ortak uygulamada backend erişilebilen organizasyonları döndürür. Tek organizasyonda seçimin atlanması kabul edilmiş istemci davranışıdır; birden fazlasında organizasyon değiştirilebilir. Sıfır organizasyonlu hesap yönetimi ve davet kabulü bölüm 21’de tanımlıdır. Frontend tasarımı ChatGPT'nin alanı değildir.
- Merkez görevi kaldırıldığında yalnızca ilgili yetkiler kalkar. Hesap–kişi bağlantısı kaldırıldığında o organizasyon kaydına erişim biter; diğer organizasyonlar, roller ve geçmiş silinmez. Yanlış bağlantı kaldırılıp doğru hesaba yeni davet verilebilir.
- Backend her işlemde güncel rol/bağlantı durumunu kontrol eder. Açık oturum veya eski bağlantı kaldırılmış yetkiyi sürdürmez. Değişiklikler yapan kişi ve zamanla kaydedilir.

### Mükerrer kişi birleştirme

Aynı organizasyondaki mükerrer kayıtlar otomatik değil, yetkili yönetici işlemiyle birleştirilir. Hesap bağlantıları, rezervasyonlar, kullanım hakları ve finans kayıtları önceden kontrol edilir; geçmiş ve merkez aidiyeti korunur. Organizasyonlar arası birleştirme yoktur.

İşlemi yapan kişi bütün etkilenen merkezlerde yöneticiyse tamamlayabilir. Yönetici olmadığı her etkilenen merkezden bir yetkili merkez yöneticisinin aynı kapsama onayı gerekir. Kapsam değişirse onay yenilenir. Gerekli onaylar tamamlanmadan kayıtlar değişmez; başlatan ve onaylayan kişiler izlenir. Hesap çatışması ACCOUNT_LINK_CONFLICT, ilgili sürüm değişimi VERSION_CONFLICT/PREVIEW_STALE;05/06/08 sözleşmesi uygulanır.

## 4. Rol ve kapsam matrisi

Tek aktif owner bulunur; atama/kaldırma yalnız FtkSaaS platform yetkisidir. Diğer roller birden fazla kişiye atanabilir; bir kişi farklı kapsamlarla birden fazla rol taşıyabilir. Yetki, rol + kapsam + işlem iznidir; genel bir üst rol operasyon kapsamını otomatik aşmaz.

| Rol | Kabul edilmiş yetkiler ve sınırlar |
|---|---|
| Owner | Uygulama nezdinde nihai yetkili/ana muhatap; organizasyon kapatma, SaaS aboneliği, organizasyon yöneticisi atama/kaldırma. Organizasyon kuralları ile tüm merkezlerde görüntüleme/raporlama yetkisi var. Merkez operasyonu için ayrıca ilgili merkezde yönetici atanmalıdır. Owner rolünü verme/kaldırma yalnız FtkSaaS’a aittir; müşteri doğrudan owner devredemez. Owner merkez oluşturup kendisini/başkasını merkez yöneticisi atayabilir, kendi merkez yöneticiliğini owner yetkisiyle kaldırabilir. Canlı organizasyon ownersız bırakılamaz. |
| Organizasyon yöneticisi | Organizasyon kurallarını ve zorunlu/tavsiye sınırlarını yönetir; bütün merkezlerin verilerini görür, raporlar. Yönetici atanmadığı merkezde operasyonel değişiklik yapamaz. Kendisini merkeze yetkili atayabilir; atama/kaldırma izlenir. Başka organizasyon yöneticisi atama/kaldırma owner'a aittir. |
| Merkez yöneticisi | Atandığı merkezde oda/sınıf/seans/kontenjan, görevlendirme, rezervasyon/talep/iptal, yoklama kapatma/düzeltme, katalog/fiyat, paket satışı, kredi düzeltme, süre uzatma, kişisel negatif limit, tahsilat/iade, eğitmen anlaşması/hakedişi, yerel CRM/rapor ve personel/asistan yetkilendirmesi. Organizasyonun zorunlu sınırlarını aşamaz; diğer merkezler, owner, organizasyon yöneticiliği ve SaaS üzerinde yetki doğmaz. Hassas düzeltmeler gerekçeli/izlenebilir olur; organizasyon tutar/miktar sınırları koyabilir. |
| Operasyon personeli | Merkez yöneticisi kişi kaydı, rezervasyon, açık yoklama, paket satışı ve tahsilat izinlerini ayrı ayrı verir. İade, kredi düzeltme, süre/negatif limit değişikliği, fiyat/anlaşma değiştirme veya yetki dağıtma yoktur. Günlük CRM aşağıdaki dar kapsamla ayrıca verilebilir. Yoklama kapatma yetkisi bu role verilmemiştir. |
| Eğitmen | Kendi programı, gerekli katılımcı bilgileri ve kendi hakedişlerini okur; görevlendirildiği seansların açık yoklamasını düzenler ve kapatabilir. Seans iptali/saat değişikliği, rezervasyon, finans ve kredi düzeltmesi yapmaz; merkeze değişiklik talebi iletir. |
| Eğitmen asistanı | Sınıf veya seans bazlı atama; ilgili katılımcıların gerekli bilgilerini görür, açık yoklamada katıldı/gelmedi kaydeder ve düzeltir. Yoklamayı kapatamaz; kapalı yoklamayı değiştiremez. Rezervasyon, iptal, paket, finans, CRM ve hakediş yönetimi yoktur. |
| Öğrenci | Kendi rezervasyon/yoklama/paket/kredi/borç/ödeme geçmişini görür. Plan, paket, sınıf, kontenjan ve politika uygunsa kendi rezervasyon/iptal işlemini yapar. Özel ders talebi ve bekleyen talebi geri çekme mümkündür; kesin onayı merkez verir. Kendi yoklama/kredi/borç/ödeme kaydını doğrudan değiştiremez; başkalarının özel kayıtlarına erişemez. |

Asistan, öğrenci olarak katıldığı seansa atanamaz. Ters yönde de asistan ataması kaldırılmadan öğrenci kaydı yapılamaz. Sınıf düzeyindeki atama bu seans kontrolünü aşmaz. Aynı kural etkinlik katılımcısı/görevli asistan için geçerlidir.

CRM yönetimi yöneticide kalır; operasyon personeline merkez ve atanmış aday kapsamında aday oluşturma/güncelleme, kaynak/ilgi, takip/görüşme/sonuç ve önceden tanımlı sabit koşullarla deneme teklifi izinleri verilebilir. İndirim/fiyat değiştirme verilmez. Toplu dışa aktarım, segment ve otomasyon yönetimi verilmez. CRM izni satış/tahsilat izni doğurmaz; Pro/Business sınırları korunur.

Rapor ve dışa aktarım güncel veri/alan/merkez yetkilerine tabidir. Sınırlı işlem izni rapor üzerinden tam finans/kişisel veri erişimi vermez. Owner/organizasyon yöneticisi tüm merkezleri raporlar; çok merkezli özelliklerin ticari plan erişimi ayrıca uygulanır. Kayıt kapsamına etkisi olmayan organizasyon politikası yönetimi, geçmiş merkez kayıtlarını değiştirme yetkisi değildir.

## 5. Sınıf, paket, seans ve kontenjan

Sınıfın dış katılıma açık/kapalı olması ile paketin öncelikli/esnek olması ayrı boyutlardır. Aynı açık sınıf düzenli ve esnek katılımcıları birlikte barındırabilir. Kapalı sınıfa, o sınıfa erişim vermeyen paketle kredi olsa da kayıt yapılamaz.

- Öncelikli paket başlangıcından itibaren tanımlı kredileri ilgili seanslara topluca ayırır. Kalan kredi başka programa serbest kredi varsayılmaz; ayrılmış ve kullanılabilir ayrıdır.
- Esnek paket, uygun seansa tek tek kesin kayıtla hak ayırır.
- Satış/kesin kayıtta kapsanan seanslardan biri maksimum doluysa engel yöneticiye gösterilir; eksik rezervasyonla sessizce kesinleşmez, yönetici çözer.
- Oda teknik kapasitesi varsayılan sağlar. Yönetici oda–seans atamasında seans biçimine uygun nominal ve maksimum kontenjan belirler. Rezervasyon oda tablosunun değil seans kontenjanının hesabını kullanır. Nominal maksimumdan büyük olamaz; kişi birimi esas alınır, çift dengesi ayrı karardır.

| İşlem | Kabul sınırı |
|---|---|
| Esnek/tekli kayıt veya yeni yer teklifi | Toplam yer ayırma nominalin altındaysa |
| Öncelikli kayıt | Toplam yer ayırma maksimumun altındaysa |

Bunlar ayrı havuz değildir. Kesin rezervasyonlar ve süresi dolmamış teklifler toplam yer tutar. Nominal 10/maksimum 12 için toplam 11 iken yeni esnek kayıt alınmaz, öncelikli kayıt alınabilir. Bir iptalle toplam 10'a inerse esnek yer hâlâ sıfırdır. Yönetici kontenjanı düşürdüğünde mevcut rezervasyonlar otomatik iptal edilmez; yeni işlemler güncel sınırlara göre kontrol edilir. Bilinçli yönetici kapasite değişikliği ile yetkisiz eşzamanlı kontenjan aşımı farklıdır.

## 6. Kullanım hakları ve paket yaşam döngüsü

### Ürünün bağımsız boyutları

1. Hak türü: kredili veya süreli/sınırsız; varsa dönemsel kullanım sınırı.
2. Rezervasyon biçimi: öncelikli veya esnek.
3. Ticari koşul: kullanım taahhüdü, iadeli/iadesiz ve iadeli ise hesap yöntemi.

Paket adındaki “4 hafta” hak türünü belirlemez. Haftada bir seans/4 kredi tanımlı kur kredili üründür; aylık süreli ürün dönemle sınırlıdır. Taahhütlü paket indirimli çok ders/dönem satın alımıdır; tek ders veya kullanım kredisiyle aynı iade koşulu varsayılmaz. Esneklik otomatik iade hakkı, öncelik otomatik iadesizlik değildir. Satış koşulları sürümlenir; sonraki katalog değişikliği geçmiş satışı yeniden fiyatlandırmaz.

### Hak seçimi ve kredi açığı

Öncelikli rezervasyon kaynak paketine bağlıdır. Esnek rezervasyonda ders tarihinde kapsam/merkez/sınıf bakımından uygun paketlerin kullanılabilir hakları arasından önce en erken süresi dolacak paket, eşitlikte önce satın alınan kullanılır. Başka rezervasyona ayrılmış hak tekrar kullanılamaz. Bitişi olmayan hak sıralamada en son; tam eşitlikte satın alınma anı ve değişmez UUID kullanılır.

Uygun kullanılabilir hak yoksa geçerli negatif kredi limiti değerlendirilir. Kişiye özel limit varsa organizasyon varsayılanının yerine geçer, toplanmaz; organizasyonun zorunlu üst sınırı korunur. Kullanılmış açık ve rezervasyonlara ayrılmış açık birlikte sayılır; farklı ders/gruplarda limit çoğaltılmaz. Negatif kredi para borcu değildir.

Yeni uygun paket önce mevcut kredi açığını kapatır. Gelecek rezervasyon açığı hak ayrılarak, sonuçlanmış hak tüketen ders açığı hak tüketilerek kapatılır. İlgisiz ürün/merkez kredisi düşülmez. Örnek: uygun 8 kredilik satın alım, 2 kredilik açığı kapattıktan sonra 6 kullanılabilir hak bırakır; ayrıca para borcu oluşturmaz. Sonuçlanmış geçmiş açığın yeni paketle kapatılması, geçmiş derse yeni rezervasyon açmak değildir; tarih/kapsam eşlemesi21 ve23 bölümleriyle04/08’de tanımlıdır.

### İptal, sonuçlandırma ve borçlu katılım

- Katılımda taslak yoklama tüketim üretmez. Kapanışta katıldı/noShow sonucuna göre politika uygulanır. Öğrenci iptalinde kimin/ne zaman iptal ettiği ve rezervasyona bağlı koşullar değerlendirilir. Özel dersin başlangıç 12 saat kuralı grup/etkinliğe kopyalanmaz.
- İşletme seansı iptal ettiğinde ilgili rezervasyon kapanır, ayrılmış kredi kullanılabilir olur. Ayrı telafi bakiyesi veya otomatik başka seans arama/öteleme yoktur. Yönetici yeni seansı/katılımcıları hazırlar. Geçerli negatif limit varsa eski iptalden önce yeni kayıt açabilir; eski hak serbest kaldığında geçici açık kapanır. Her adım kendi kurallarına tabidir.
- İşletme iptalinde kredinin geçerlilik sorunu yöneticiye gösterilir; yönetici uzatabilir. Süreli ürünün dönemi kendiliğinden uzamaz; dönem sonrasına hak üretilmez.
- Borçlu öğrencinin yeni rezervasyon ve katılımı ayrı politikadır. Para borcu ve negatif kredi ayrı kontrol edilir; yeni kayıt engeli mevcut rezervasyonu otomatik iptal etmez.
- Borç/kredi nedeniyle engel ayrı blocked sonucudur, otomatik noShow değildir; kredi etkisi açık politikaya bağlıdır. DS onayıyla korunan kesin rezervasyonlar hariç, seans başlangıcında izinli negatif kredi sınırını aşan katılım engellenir ve bu öğrenciden yüzde/kişi hakedişi doğmaz; geç ödeme geçmiş sonucu değiştirmez.

### Dondurma ve sonlandırma

Dondurma başlangıçta kapalıdır. İzin verilen plan ve ürün koşullarında yalnız merkez yöneticisi uygular; etkilenen kayıt/tarihler önceden gösterilir. Süre uzatma satış koşuluna bağlıdır. DS hedefinde finansal olmayan hak değişikliğinde kesin rezervasyonlar etki onayıyla korunur. Açık merkez rezervasyon iptali ayrıca seçilmiş/gerekçeli müdahaledir; o durumda hak/yer/açık serbest kalır. Dondurma sonrasında otomatik rezervasyon yapılmaz. Erken bitirme/değişim/yenileme davranışları bölüm 17’de kabul edilmiştir.

Para iadesi tek başına hak değiştirmez. Paket sonlandırmada kullanılmamış serbest haklar kapatılır, geçmiş ve korunan yükümlülükler korunur. Rezervasyon iptali ayrıca açık merkez müdahalesi olarak onaylanır; sonlandırma tek başına sessiz iptal değildir. Kullanılmamış hak kendiliğinden iade alacağı doğurmaz, kalan para borcu otomatik silinmez. İade/borç indirimi satış koşuluna göre ayrı ve gerekçeli yetkili işlemidir. İadeli ürünün hesabı satışta seçilir; bölüm17’deki üç yöntem kabul edilmiştir. Bunlardan biri bütün ürünlere evrensel varsayılan değildir.

## 7. Durumlar ve zaman yönetimi

| Kayıt | Kabul edilmiş durumlar |
|---|---|
| Özel ders talebi | Bekliyor; alternatif sunuldu; onaylandı; reddedildi; geri çekildi; süresi doldu |
| Kesin rezervasyon | Aktif; iptal edildi; sonuçlandı |
| Seans | Planlandı; gerçekleşti; iptal edildi |
| Yoklama | Henüz işaretlenmedi; katıldı; gelmedi; katılım engellendi |
| Yoklama kapanışı | Açık; kapalı |
| Bekleme listesi kaydı | Bekliyor; teklif verildi; rezervasyona dönüştü; ayrıldı; kapandı |
| Yer teklifi | Aktif; kabul edildi; reddedildi; süresi doldu; geri çekildi |

İş anlamları bu bölümde, kesin API kod adları06/08’dedir. İptal/katılım engel gerekçesi ayrı tutulur, yoklama yerine cancel yazılmaz.

Özel ders talebi ve bekleme listesine giriş yer/kredi tutmaz. Talep onayında uygunluk ve kaynaklar kontrol edilip kesin rezervasyon oluşur. Zamanın geçmesi seansı otomatik gerçekleştirmez veya kişiyi noShow saymaz. İptal rezervasyonu yeniden açılmaz; güncel kontrollerle eskiye bağlantılı yeni kayıt oluşturulur.

Yoklama kapanabilmesi için iptal edilmemiş bütün rezervasyonların sonucu girilmelidir. Eğitmen/merkez yöneticisi kapatır, asistan kapatamaz. Açıkken atanmış eğitmen/asistan ve izinli operasyon personeli düzenleyebilir. Kapalı düzeltmeyi yalnız merkez yöneticisi gerekçeyle yapar; bağlı kredi/hakediş düzeltmesi geçmişi silmez. İşaretlenmemiş yoklama eksik işlem olarak kalır.

### Bekleme listesi

Teklif yalnız nominalde boş yer varsa verilir; süre boyunca yeri tutar, hak tutmaz. Başlangıç sıra listeye giriş zamanı, eşitlikte kararlı sıra; teklif başlangıç süresi 30 dakika, kayıt kapanışı/ders başlangıcını aşamaz. Kabul, mevcut yer tutmayı rezervasyona dönüştürür; hak, erişim, belge ve koşullar tekrar kontrol edilir. Geçici hata süreyi bitirmez; kalan sürede yeniden denenebilir.

Ret/süre dolumunda yer serbest kalır, önceki kişinin liste kaydı kapanır, sıradaki uyguna geçilir. Yeniden katılım sıranın sonundandır. Otomatik kesin kayıt yoktur. Seans iptalinde teklifler geri çekilir ve liste kayıtları kapanır. Kabul ve süre dolumu yarışında tek sonuç geçerlidir.

### Takvim ve kayıt pencereleri

Her merkezin saat dilimi vardır; tekrarlayan program merkez yerel saatiyle oluşturulur. Tek seans değişikliği kalan programı değiştirmez. “Yalnız bu seans” ve “bu seans ve sonrası” ayrı kapsamlardır; geçmiş/sonuçlanmış seanslar korunur. Erteleme aynı seansın tarih/saat değişikliğidir; geçmiş değerler izlenir.

Gelecek seanslarda kaynak ve hak uygunluğu kontrol edilir; çakışmalar çözülmeden değişiklik kesinleşmez, rezervasyonlar otomatik iptal edilmez. Esnek rezervasyon, öğrenci iptali ve özel ders talebinin açılış/kapanış ayarları ayrıdır; backend merkez saat dilimini uygular. Yönetici süre dışı işlemleri ayrıca yetkilendirilip kaydedilir. Geçersiz yerel saat sessiz kaydırılmaz; çift saat açık offset doğrulaması ister. Saat dilimi ve tarih normalizasyonu04/08 teknik sözleşmesindedir.

## 8. Finans, tahsilat, alacak ve iade

Bütün öğrenci tahsilatını merkez yapar; eğitmenin doğrudan tahsil ettiği model yoktur. Öğrenci kendi ödeme geçmişinin tamamına erişir. Öğrenci–merkez hesabı ve merkez–eğitmen hesabı ayrıdır. Fazla tahsilat kalan borcu eksi yapmaz, ayrı öğrenci alacağıdır.

- Seçilmiş borç varsa tahsilat ona uygulanır. Seçim yoksa aynı merkez/para biriminde en eski vadeli borçtan başlanır. Başka merkeze otomatik aktarılmaz. Açık aynı merkez/para birimi borçları due_at artan sırada (gelecek vadeliler dahil), eşitlikte değişmez ID ile dağıtılır.
- Kullanılabilir öğrenci alacağı kısmen/tamamen iade edilebilir. Yetkili merkez yöneticisi yapar; operasyon personeli yapamaz. Alacak aşılamaz; tutar/tarih/gerekçe/yapan kişi saklanır. Eski tahsilat silinmez, yeni borç veya hak değişikliği oluşmaz.
- Alacak aynı merkez/para birimindeki borca yetkili personelin açık mahsup işlemiyle uygulanır. Otomatik harcanmaz, yeni nakit tahsilat sayılmaz; kapatılan borca bağlanır.
- Para iadesi ile paket sonlandırma ayrıdır. İadesiz ürünün kullanılmamış kredisi iade gerekçesi değildir; şartlara göre yönetici istisnası gerekçeli izlenir. Paket sonlandırma kalan borcu otomatik kaldırmaz.
- Merkezler arası tahsilat/kullanım aidiyeti korunur. DS-2026-10-17 kapsamındaki kredili A→B kullanım payı ve onaylı hesaplaşma kabul edilmiştir; otomatik para transferi yoktur, runtime ayrı teslimdir.

## 9. Eğitmen anlaşmaları, hakediş ve ödeme

Katalog/fiyat ve eğitmen ücret anlaşmaları merkezindir; organizasyon ortak oran dayatmaz, bütün koşulları/sonuçları denetler. Aynı eğitmen merkez, ders biçimi ve geçerlilik dönemine göre farklı anlaşma taşıyabilir. Oran kimin payı, hangi taban üzerinden ve varsa salon bedeliyle hangi sırada hesaplanacağı açık olmalıdır. Salon kullanım bedeli ücretsiz, sabit veya yüzdelik olabilir; aynı kesinti iki kez yapılmaz, öğrenciye kendiliğinden ek borç yaratılmaz.

| Model | İşleyiş |
|---|---|
| Yüzde | Hakedişe esas satılmış ders bedeli üzerinden anlaşılmış pay |
| Seans sabiti | Gerçekleştirilen seans için sabit ücret |
| Kişi başı | Hesaba dahil kişi başına sabit ücret |
| Sabit + kişi başı | Seans sabiti ve kişi başı bileşen |
| Açık karma koşul | Katılım/ürün grubuna göre anlaşmada açıkça farklı hesap; otomatik varsayılan değil |

Tahsilat sorumluluğu/risk merkezindir. Eğitmenin gerçekleştirdiği işin hakedişi öğrencinin ödeyip ödememesine bağlı değildir. Kredili paketin ders bedeli öğrencinin satış fiyatından gelir; güncel katalog fiyatı kullanılmaz. Gelmeyen/iptal eden öğrencinin bedeli satış/iptal koşuluyla korunmuşsa ve eğitmen seansı gerçekleştirmişse tabana dahil edilir, aynı bedel iki kez sayılmaz. Kişi başı hesapta da bedeli korunan sonuçlar dikkate alınır.

Süreli/sınırsız üyeliğin seans satış bedeli belirsizdir. Sistem bu üyeliği kendiliğinden yüzde dışına atıp kişi başına geçmez. İlgili üyeliği karşılayan açık anlaşma koşulu bulunmalıdır; eksiklik sıfır ücret sayılmaz, ürün ilgili derse açılmadan merkez tamamlar. “Krediliye yüzde, süreliye kişi başı” mümkün bir karma modeldir, evrensel kural değildir.

Bedelsiz denemeler kişi başı/yüzdelik hakedişe girmez; seans sabitini değiştirmez. Ücretliye dönüşüm geçmiş denemeye hakediş üretmez.

Hakediş yoklama kapanışında oluşur. Seansı fiilen gerçekleştiren eğitmenin merkez/ders biçimi için seans tarihinde geçerli anlaşması uygulanır. İlk planlanan eğitmene otomatik hakediş yoktur. Starter F14 yoklama/hak tüketimi için anlaşma istemez ve hakediş üretmez. Pro/Business ücretli görevlendirme/hakediş için geçerli açık anlaşma gerekir; eksik tutara otomatik ücret atanmaz. Gerçekleşmeden iptal edilen seans hakediş üretmez; iptal ücreti istisnası yoktur. Sonraki düzeltme önceki hakedişe bağlıdır.

Hakediş ile ödeme ayrıdır; kısmi ödeme ve kalan tutar izlenir. Ödeme aynı merkez/para biriminde seçilmiş hakedişlere dağıtılır. Sonraki hakediş düzeltmesi eski ödemeyi silmez; fark sonraki hesaplaşma için ayrıca izlenir.

## 10. Etkinlik

Etkinlik ortak kişi, kontenjan/rezervasyon, finans, belge ve hakediş altyapısını kullanır; ayrı takvim/para sistemi kurulmaz. Etkinlikten sorumlu merkez yetki/tahsilat/rapor sahibidir; fiziksel mekân merkez odası veya harici yer olabilir. Harici mekân için ad/adres/konum ve saat dilimi tutulur, yeni merkez açılması gerekmez. İç oda kullanılmıyorsa oda ataması zorunlu değildir.

En az bir eğitmen veya asistan görevlendirilir; eğitmen bulunması şart değildir. Görevli zaman çakışması kontrol edilir. Aynı etkinlikte katılımcı olan kişi asistan olarak görev alamaz.

Görev ücreti etkinlik oluşturulurken kişi bazında açıkça ücretsiz veya tutar olarak tanımlanır; boş değer ücretsiz sayılmaz, ders anlaşması otomatik uygulanmaz. Ücretli görev hakedişi etkinlik gerçekleştikten ve merkez yöneticisi görevin yapıldığını doğruladıktan sonra oluşur. İptal veya yapılmayan görev hakediş üretmez; ödeme ortak altyapıdadır.

Etkinlik kaydı ve ödeme ayrıdır. Kesin kayıt yer kullanır; tam ödeme gerekip gerekmediği, ücret, paket uygunluğu ve katılımcı/işletme iptal-iade koşulu kayda açılmadan tanımlanır. Kısmi ödeme desteklenir; eksik ödeme kaydı otomatik iptal etmez. Ders/paket koşulları otomatik kopyalanmaz.

Etkinlik katılımcısı aktif öğrenci ilişkisi gerektirir ve SaaS öğrenci limitine dahildir. Açık etkinlik kaydı pasife almayı engeller; aday deneme istisnası buraya genişletilmez.

## 11. Öğrenci aktifliği ve SaaS limit sayımı

Aktif öğrenci ilişkisi esas alınır; oturum hesabı olması şart değildir. Aynı organizasyon kişisi birçok merkezde aktif olsa da organizasyon limitinde bir kez sayılır; merkez raporları yerel aktif ilişkileri gösterir. Yalnız eğitmen/personel olan kişiler ve adaylar sayılmaz.

Limit aşımında veri silinmez veya mevcut öğrenciler rastgele kapatılmaz; yeni öğrenci ilişkisi ve yeniden aktifleştirme engellenir. Pasif öğrenci adına talep/bekleme/rezervasyon/etkinlik kaydı öncesinde aktifleştirme ve limit kontrolü gerekir.

Açık işlem bulunan öğrenci pasife alınamaz: bekleyen talep/alternatif yanıtı, aktif rezervasyon, açık bekleme/yer teklifi ve etkinlik kaydı dahildir. Borç veya kullanılmamış hak bakiyesi tek başına engel değildir; silinmez. Liste örnekleri kapalı bir API kataloğu değildir; sonuçlanmamış diğer işlem türleri durum kataloğunda eşlenir.

Adayın deneme başvurusu/katılımı aday ilişkisiyle yürür, öğrenci limitine girmez. Ücretli öğrenciye dönüşümde aktif ilişki/limit kontrol edilir. Deneme tekrarı kişi ve organizasyon bazında sınırlanır; sayısal sınır henüz belirlenmiş değildir. Bu istisna etkinlik kullanımına kaçış yolu değildir.

## 12. SaaS abonelik yaşam döngüsü

### Plan düşürme

Owner'ın bilinçli talebi ödenmiş dönem sonunda uygulanır; açık operasyonlar geçişi engellemez. Yalnız yeni planın özellik/limitleri sunulur, plan dışı özellikler açık işlem gerekçesiyle sürdürülmez. Veri silinmez/dönüştürülmez; uygun üst plana dönülünce eski verilere aynen erişilir. Arada çalışmamış otomasyon/bildirimler geriye dönük kendiliğinden çalışmaz.

Business'tan tek merkeze geçiş talebi, owner aktif kalacak merkezi seçmeden tamamlanmaz. Seçim yürürlük tarihine kadar değiştirilebilir. Diğer merkezlerin erişimi kapanır, verileri korunur; Business'a dönüşte yeniden açılır.

### Ödeme gecikmesi

Plan kendiliğinden düşürülmez. Son kabul edilen politika, önceki “7 gün bütün yönetim açık” önerisinin yerini alır:

| Dönem | Davranış |
|---|---|
| Gecikmeden itibaren ilk 7 takvim günü | Owner/yönetim işlemlerinde kısıtlar başlar; aynı kapalı işlem operasyon personeli üzerinden aşılamaz. Öğrenci mevcut haklarıyla normal rezervasyon/iptal/görüntüleme yapar. Mevcut seans iptali ve yoklama gibi zorunlu işlemler sürer. Owner SaaS ödeme/abonelik işlemlerine erişir. |
| Süre sonu, ödeme tamamlanmamış | Organizasyon hizmet erişimi bütün roller için kapanır. Owner yalnız ödeme/abonelik yönetimine erişir. Veri korunur; diğer organizasyonlar etkilenmez. Öğrenciye borç açıklanmaz, hizmetin geçici kullanılamadığı belirtilir. |
| Ödeme tamamlanır | Abonelik erişimi yeniden açılır. |

İlk aşamada yeni satış/program, fiyat/ayar ve personel yönetimi kısıtlanır; işlem grupları21’de, API eşlemesi05/08’dedir. Öğrencinin açık bırakılan işlemleri ile onları destekleyen zorunlu operasyonlar listede birlikte kontrol edilir. Bilinçli hata veya tutarsızlık üretilmez.

Ek süre yenileme tarihini uzatmaz, kısmi ödeme yeniden başlatmaz. İstisnai uzatma yalnız SaaS yönetiminindir. Yedi gün sonrasında öğrencinin de etkilenmesi kabul edilmiştir.

### Yükseltme ve yenilemeyi durdurma

Yükseltme, ödeme doğrulanıp gecikmiş SaaS borcu kapatıldığında hemen açılır. Fiyat farkı kalan dönem oranıyla hesaplanır: (yeni dönem fiyatı − mevcut dönem fiyatı) × kalan dönem oranı. Dönem zamanları esas alınır; yenileme tarihi korunur. Sonraki yenilemede yeni tam bedel alınır. Teklif süreli korunur, ödeme anında sessizce değişmez. İlk kapsam aynı faturalama dönemi içindeki plan değişimleridir; aylık/yıllık dönüşüm ayrıca karardır.

Owner yenilemeyi durdurursa ödenmiş dönem sonuna kadar kullanım sürer; sonra organizasyon hizmeti kapanır, veri korunur. Gönüllü iptale ödeme gecikmesi ek süresi uygulanmaz. Dönem bitmeden talep geri çekilebilir; yeni abonelik/ek ücret oluşmaz. Dönem bittikten sonraki dönüş yeni abonelik başlangıcıdır; seçilen plan kapsamında eski verilere erişim açılır.

## 13. Belge, paylaşım, aktarım ve bildirim

- Gerekli belge, işlem noktası ve sürüm tanımlıdır; kabul eden kişi/zaman/işlem bağlantısı saklanır. Yeni sürüm eski onayı silmez; yeniden kabul şartı ayrıca belirtilir. Eksik onay mevcut rezervasyonu otomatik iptal etmez; işlem/katılım tanımlı kuralla engellenir. Hukuki yeterlilik taahhüdü verilmez.
- Herkese açık takvim/kayıt yalnız yayımlanmış ders/etkinlik, ücret/koşulları sunar. Katılımcı listeleri, iletişim, borç/kredi ve iç notlar açılmaz. Hesapsız başvuru alınabilir; kullanıcının kendi kesin rezervasyonu doğrulanmış hesap–kişi bağı gerektirir. Merkezin hesapsız kişi adına işlem yapması engellenmez.
- Aktarım önizleme, doğrulama, alan eşleme ve satır sonucu içerir. Kişi/açılış kredisi/açılış borcu ilgili modüllerde izlenebilir oluşturulur. Tekrar çalışma mükerrer kayıt oluşturmaz; başarılı satırlar yeniden işlenmez, hatalılar gerekçeli raporlanır. Merkez kapsamlı özel içe aktarma izni gerekir; sıradan kişi ekleme izni yeterli değildir.
- Rapor/dışa aktarım yetkili ve filtrelenmiş bütün sonucu kapsar; yalnız açık sayfa değildir. Kaynak modül yerine para/kredi/hakediş üretmez.
- Gerekli işlem bildirimlerinin uygulama içinde görünmesi pazarlama tercihine bağlı değildir. İsteğe bağlı hatırlatma/pazarlama ve dış kanallar kendi izin/tercihlerine tabidir. Dış kanal/sağlayıcı/maliyeti seçilmemiştir; kabul edilmiş e-posta davet ihtiyacı için sağlayıcı kurulumu ayrıca yapılacaktır.

## 14. Operasyon sözleşmesi ve doğrulama

Her operasyon frontend entegrasyonuna hazır sayılmadan şunları tanımlar:

1. Ad, sürüm, modül sahibi ve ürün özelliği.
2. Tam tipli istek/yanıt, zorunluluk/doğrulama, okuma alanları ve sayfalama.
3. Hesap, organizasyon, merkez, rol/izin ve plan kapsamı.
4. Ön koşul, başlangıç/sonuç durumu, geçerli politika/anlaşma sürümü.
5. Atomik kayıtlar, değişmez kurallar, kilitleme/eşzamanlılık.
6. İşlem anahtarı kapsamı/süresi, belirsiz sonuç sorgulama ve tekrar davranışı.
7. Sabit hata kodları, tekrar denenebilirlik ve anlamı.
8. Denetim, bildirim/arka plan işleri, onay gereksinimi.
9. Kabul/başarısızlık senaryoları ve doğrulama kanıtı.

Kesin teknik hata/izin/durum ve tip sözlüğü06/08’dedir; işlem bazlı eşleme08 operations/errors alanındadır.

Asgari doğrulama konuları:

- Tenant/merkez izolasyonu; owner/organizasyon yöneticisi merkez ataması olmadan operasyon yapamaz.
- Kaldırılmış rol/bağlantı açık oturumla çalışmaz; asistan–katılımcı çakışması iki yönde engellenir.
- Son nominal/maksimum yer ve son hak/açık limiti yarışlarında fazla ayırma oluşmaz.
- Teklif kabul/süre dolumu tek sonuç verir; teklif yeri ikinci kez sayılmaz.
- İşlem tekrarı çift tahsilat/iptal/kredi/hakediş üretmez; taslak yoklama tüketmez.
- Öğrenci alacağı iade/mahsup yarışında bakiye aşılamaz, mahsup nakit sayılmaz.
- Kişi birleştirmede gerekli merkez onayları tamamlanmadan değişiklik yapılmaz.
- Dondurma/sonlandırma önizlemesi ile onay kapsamı tutarlıdır; geçmiş korunur.
- Yükseltme/düşürme/gecikme/iptal sınır anları doğru uygulanır; diğer organizasyon etkilenmez.
- Aktif öğrenci tekil sayılır; deneme istisnası etkinliğe taşınmaz; açık işlem pasife almayı engeller.
- Bildirim hatası işi geri almaz; politika/anlaşma değişikliği geçmişi yeniden hesaplamaz.

Bunlar henüz çalıştırılmış testler değildir.

## 15. Güncel tamamlanma ve açık doğrulama listesi

| Alan | Yazılı karar/sözleşme | Kalan |
|---|---|---|
| O1 — Paket yaşam döngüsü | Kabul edildi;17,23 ve04–08 | Gerçek uygulama/kabul testleri |
| O2 — Veri yaşam döngüsü | Hesap/organizasyon/imha ayrımı kabul;18–19 | Hukuki uzman saklama teyidi, sözleşme, gerçek imha/yedek testi |
| O3 — İşletim | Pilot hedefler kabul;20 | Yedek/sorumlu/kanal kurulumu, restore/load testi, ücretli üretim hedefi |
| O4 — Teknik sözleşme |04–08 v1.0 yazılı şema/tip/API/durum/hata/izin/atomiklik/guard/kabul envanteri tamamlandı | SQL/RLS/RPC/Edge uygulaması ve gerçek doğrulama; yazılı tamamlama uygulanmış garanti değildir |

İki son iş tercihi de kabul: ilk ödeme doğrulamasında hizmet/dönem başlangıcı ve ücretsiz deneme olmaması; org belge/segment/automation Owner/OM konfigürasyonu, yerel CM kapsamı ve ayrı operasyon yetkisi. K01–K16’nın karar/teknik kapanışı07’de; K06 hukuki inceleme daha önce ertelendiği statüde kalır. Yeni varsayılmış ürün kararı yoktur; son kullanıcı düzeltmeleri eski hükmün üstündedir.

Fiyatlar, kesin ticari öğrenci/eğitmen/merkez sayıları, deneme tekrar sayısı, gerekli diğer politika değerleri, aylık/yıllık SaaS dönüşümü, dış kanal/provider-maliyeti, repository adresi ve ortam/CI/secrets seçimleri yapılandırma/sonraki kapsam işidir. Gerekli değer yokken ilgili operasyon açılmaz, keyfî izin/ret icat edilmez. Pilot yük sayıları ticari plan limitleri değildir. Merkezler arası kullanım payı/hesaplaşma DS-2026-10-17 ile kabul edildi; otomatik para transferi veya kur dönüşümü yoktur.

03’teki çalışma düzeni kabul edilmiştir. Bu belge somut repository oluşturma, kodlama, merge veya üretim dağıtımı emri değildir.

## 16. Sürüm ve terk edilmiş yaklaşımlar

| Sürüm | Tarih | İçerik |
|---|---|---|
| 0.1 | 15 Ekim 2026 | Kabul edilmiş temeller ve henüz kabul edilmemiş T01–T12 taslağı. |
| 1.0 | 15 Ekim 2026 | T01–T12 ve görüşmede kabul edilen kimlik, rol, kapasite, durum, kredi, finans, hakediş, etkinlik, abonelik, aktif öğrenci ve dondurma kuralları derlendi. Açıklar O1–O4 olarak toplandı. |

Artık geçerli olmayanlar: sınırsız öncelikli kontenjan aşımı; otomatik seans/hak öteleme; ayrı süresiz telafi kredi ürünü; CRM'in yalnız yöneticiye açık olması; eşit organizasyon yöneticilerinin birbirini görevden alması; owner'ın merkez operasyonunu atamasız yapabilmesi; süreli üyelikte otomatik kişi başı hakediş; etkinlik katılımcısını öğrenci limitinden çıkarma; gecikmede 7 gün bütün yönetim yetkilerinin açık kalması. Bunlar yeniden öneri sayılarak sessizce uygulanamaz.


## 17. 15 Ekim 2026 — Kabul edilen O1 kararları

Bu bölüm önceki sürümde açık gösterilen O1 hükümlerini tamamlar.

### Dondurmayı erken bitirme

Yalnız merkez yöneticisi sonuç önizlemesiyle yapar. Süre uzatan üründe yalnız fiilen kullanılan dondurma süresi kadar uzatma korunur; süre uzatmayan üründe bitiş değişmez. İptal edilmiş rezervasyonlar geri açılmaz; yeni kayıt güncel kontenjan/hak kontrolüne tabidir. Geçmişe dönük erken bitirme yoktur; hatalı kayıt gerekçeli düzeltmeyle ele alınır.

### Paket/ürün değişimi

Eski satış sonlandırılır, bağlantılı yeni satış oluşturulur. Kullanım ve hareket geçmişi korunur. Kalan hak otomatik yeni ürün kredisine dönüşmez; eski satış koşuluyla parasal hesaplaşma çıkarılır. Oluşan alacak yeni satışa açık mahsupla uygulanabilir. Eski paketin gelecek rezervasyonları önizlenir; yönetici seçimiyle yeni ürünün uygun olduğu kayıtlar yer kaybetmeden atomik olarak yeni hakka bağlanır. Yeni ürünün karşılamadığı rezervasyonlar açıkça iptal edilmeden değişim tamamlanmaz. Fark borç/alacak olarak izlenir, otomatik nakit iade yapılmaz.

### Yenileme

Eski pakete bağlı yeni satış oluşturulur. Eski kullanılabilir kredi kendi süresinde geçerli kalır; otomatik taşıma, uzatma veya süresi dolmuş hakkı canlandırma yoktur. Yetkili gerekçeli süre uzatma ayrıdır. Süreli üründe kullanılmayan gün/dönem kotası devretmez. Rezervasyon kaynak pakette kalır, mükerrer rezervasyon oluşmaz. Yeni paket eski dönem sonundan veya açık seçilen tarihten başlar; örtüşme önceden gösterilir. Yeni uygun hak mevcut kredi açığını kapatma kuralına tabidir.

### Dönem sınırları

Satış başlangıç ve bitiş sınırı tarihleri açıkça girilir. Her ikisi satış merkezinin snapshot saat diliminde00:00 olarak yorumlanır, UTC karşılığı saklanır. Başlangıç dahil/bitiş hariç:15Şubat→15Mart,15Mart00:00 başlayan dersi kapsamaz. Bitiş son kullanım günü değildir. Takvim ayına sabitleme, ayrı takvim aylık ürün biçimi veya satış bitişini ay aritmetiğiyle otomatik üretme yoktur. Bu FtkSaaS standart davranışıdır; organizasyon tarafından kabul edilir, organizasyon değiştiremez. Seansın başlangıcı esas, bitişinin dönem dışına taşması tek başına engel değil. Yenilemede de girilen kesin tarihler esastır; sistem boşluk/örtüşmeyi önizlemede gösterir, otomatik tarihle karar vermez.

### İadeli ürünlerde kesin yöntem kataloğu

- Kredi oranında: net satış bedeli × kullanılmamış kredi / satılan toplam kredi.
- Kullanılanları yeniden fiyatlandırma: en az sıfır olacak şekilde net satış bedeli − tüketilmiş kredi × satışta belirlenmiş tek ders bedeli.
- Süre oranında: net satış bedeli × kullanılmamış ücretli süre / toplam ücretli süre.

Yöntem/değerler satışta sabitlenir. Politika gereği tüketen noShow/geç iptal kullanılmış sayılır; sonlandırmada serbest bırakılan gelecek hak kullanılmamıştır. Ücretsiz dondurma uzatması iade bedelini artırmaz. Hesaplanan tutar önce aynı satışın kalan borcunu azaltır, fazlası öğrenci alacağıdır; tahsil edilmemiş para iade edilmez. Nakit iade ayrı yetkili işlemdir. Standart dışı yönetici istisnası gerekçeli kaydedilir. İadesiz ürün ayrı seçenektir. Bunlar yazılım hesap yöntemleridir; emredici tüketici haklarını ortadan kaldırmaz.

## 18. 15 Ekim 2026 — Kabul edilen O2 yaşam döngüsü

### Hesap silme

Ortak hesabın silinmesi bütün oturum/davet ve organizasyon hesap bağlantılarını geçersizleştirir. İşletmenin kişi, ders, hak, borç ve ödeme kayıtları ayrı saklama/silme politikasına tabidir; hesap silme borcu/alacağı kaldırmaz. Aktif owner, FtkSaaS tarafından owner değişimi tamamlanmadan veya organizasyon kapatma süreci tamamlanmadan hesabını silemez; müşteri kendi owner rolünü kaldırmaz. Aynı e-postayla yeni hesap eski bağları canlandırmaz; yeniden doğrulanmış davet gerekir.

### Organizasyon kapatma ve geri dönüş

Yenilememe dönem sonunda hizmeti kapatır; yeni abonelik plan kapsamında geri erişim sağlar. Owner’ın organizasyonu kapatma işlemi hizmeti hemen kapatır, yeni işlem/yenilemeyi durdurur; yeniden açma açık owner işlemi ve geçerli abonelik ister. Veri her iki durumda saklama politikasına tabidir. Kalıcı tüm veri silme ayrı işlemdir; tamamlanınca eski organizasyon geri açılamaz, yeni kuruluş yeni kimlik alır. Kapatma öncesi açık ders/talep/rezervasyon, borç/alacak ve dışa aktarım imkânı gösterilir; kapatma bunları gerçekleşmiş/iade edilmiş/borcu silinmiş saymaz. Yeniden açmada kaçırılmış ders/bildirim/otomasyon geriye çalışmaz; çözülmemiş işler yöneticiye gösterilir.

### Kalıcı silme kapsamı

Yalnız owner yeniden kimlik doğrulaması ve açık kapsam onayıyla başlatır. Erişim, davet, paylaşım bağlantıları, bildirimler ve otomasyonlar devre dışıdır. Veritabanı, yüklenen dosyalar, üretilmiş raporlar ve geçici kopyalar kapsanır; diğer organizasyon etkilenmez. Ayrı hukuki gerekçeyle saklanan kayıtlar sınırlı arşivdedir; uygulamaya veya yeni organizasyona geri bağlanmaz. Yedek geri yükleme silinmiş veriyi kullanıma açamaz. Bütün ilgili sistemlerde doğrulanmadan tamamlandı denmez; hatalı adımlar izlenir/yeniden denenir. Aynı e-posta, işletme adı veya yeni abonelik eski veriyi canlandırmaz.

## 19. Geçici uzun saklama varsayılanları — hukuk incelemesi açık

Kullanıcı 15 Ekim 2026’da uzun saklama varsayılanları belirlenmesini, hukuki uzman incelemesini daha sonra kendisinin yaptıracağını belirtti. Aşağıdaki sayılar bütün veri türleri için kanunun izin verdiği kesin azami süreler değildir. Kanuni süre, zamanaşımı ve ürün politika üst sınırı ayrıdır. Hukuki amaç/gerekçe bulunmayan verinin sırf tabloda süre var diye tutulmasına izin vermez. Hukuki inceleme bu bölümün ayrı açık işidir; mevcut yazılım uygulaması veya mevzuata uygunluk onayı değildir.

| Veri grubu | Geçici varsayılan | Süre başlangıcı / kapsam |
|---|---|---|
| FtkSaaS’ın kendi ticari/mali belgeleri | 10 yıl | TTK m.82 kapsamındaki belge için ilgili takvim yılı sonu. VUK’un 5 yıllık süresi ayrıca izlenir; aynı belgeye daha uzun uygulanabilir yükümlülük esas alınır. |
| Satış, tahsilat/iade, kredi hareketi, hakediş ve hizmet ifasının gerekli kanıtları | 10 yıl | İlgili işlem/hizmet ilişkisinin tamamlanması; zamanaşımı başlangıcı ve özel hükümler hukuk incelemesinde kesinleştirilir. Müşteri işletme verilerinde veri sorumlusunun sözleşmeli talimatı ve saklama amacı gerekir; sağlayıcının kendi faturasıyla aynı kapsam sayılmaz. |
| Sözleşme ve sürümlü belge kabul kanıtları, kritik yetki/değişiklik denetimi | 10 yıl | İlgili sözleşmenin/ilişkinin sona ermesi veya ilgili işlem; yalnız kanıt için gerekli alanlar. Genel profilin tamamını arşivleme gerekçesi değildir. |
| Satışa dönüşmemiş aday ve takip kayıtları | 2 yıl | Son anlamlı temas; sırf otomatik mesajla süre yenilenmez. Kanuni azami değil geçici ürün politikasıdır. |
| Bağımsız profil, iletişim ve serbest operasyon notları | İhtiyaç sürdüğü müddetçe; sona erince en fazla 2 yıl | İlişkinin bitişi. Daha uzun saklanan bir kanıtın zorunlu alanları ayrı arşivlenir; tüm profil 10 yıla taşınmaz. Geçerli silme talebi/amaç yokluğu daha erken imha gerektirebilir. |
| Güvenlik/erişim logları | 2 yıl | Kayıt anı; genel bir 5651 yükümlülüğü varsayılmaz. Önceki 90 gün önerisinin yerine geçen geçici politika; gereklilik/orantılılık hukuk incelemesinde değerlendirilecek. Parola/token kaydedilmez. |
| Bildirim gönderim/teslim teknik kayıtları | 1 yıl | Kayıt anı. İspat için zorunlu içerik ilgili kanıt sınıfına ayrılır; pazarlama onayı ve ileti mevzuatı ayrıca incelenir. |
| Silme/imha işlem kanıtları | 3 yıl | İşlem anı; yönetmelikte asgari 3 yıldır, kanuni azami diye etiketlenmez. Silinen içeriğin kopyası tutulmaz. |
| Geçici dışa aktarım dosyaları | 7 gün | Oluşturulma anı; kaynak kayıt süresini değiştirmez. |
| Yedek kopyalar | 30 gün döngü hedefi | Yedek oluşturulma anı; O3’te altyapı ve geri yükleme koşulları doğrulanacak. Hukuki arşiv yedek rotasyonu değildir. |

Kalıcı silme isteği, yukarıdaki operasyon saklama varsayılanlarından önceliklidir; yalnız belgelenmiş hukuki saklama gerekçesi bulunan gerekli kayıtlar istisnadır. Erişim hemen kapanır; hukuki saklama istisnası dışındaki veriler için operasyonel silme hedefi 30 gündür. Yedekler de bu süreyi aşmayacak biçimde O3’te doğrulanmalıdır; tamamlanma bilgisi gerçek imha durumuna göre verilir. Somut uyuşmazlık/resmî yükümlülükte yalnız ilgili kayıtlar gerekçeli saklama blokajına alınır. Yeni hukuki değerlendirme süresi dolmuş veriyi kendiliğinden geri getiremez. Süreler kayıt sınıfına göre sürümlü, merkezi yapılandırma olarak yönetilir; satış/paket ayarı değildir.

### Resmî kaynaklar ve sınır

- KVKK Silme/Yok Etme/Anonimleştirme Yönetmeliği, m.7, 11–12: https://www.kvkk.gov.tr/Icerik/5441/KISISEL-VERILERIN-SILINMESI-YOK-EDILMESI-VEYA-ANONIM-HALE-GETIRILMESI-HAKKINDA-YONETMELIK
- KVKK 2021/847: Belirli fatura/adres kayıtları için on yıllık süre değerlendirmesi; tüm verilere genel saklama izni değildir: https://www.kvkk.gov.tr/Icerik/7140/2021-847
- TTK m.82, Ticaret Bakanlığı metni: https://mugla.ticaret.gov.tr/data/5f46170213b8760fa8ff967a/TTK.pdf
- VUK saklama özeti, GİB: https://gib.gov.tr/vergi-konulari/2_isletme_ve_girisimci/13_mukelleflerin_ise_baslama_ve_isi_birakma_odevleri/13

1.1 — 15 Ekim 2026 (önceki güncelleme): Bu görüşmede kabul edilmiş O1 ve O2 yaşam döngüsü kararları işlendi; uzun saklama varsayılanları kullanıcı talimatıyla geçici belirlendi. Hukuki uzman incelemesi, yedek/O3 ve API/O4 ayrıntıları açık tutuldu. 00/01/03 dosyaları bu işlemde değiştirilmedi; önceki O1/O2 açık listeleri bakımından bu teknik sözleşmenin yeni sürümü esas alınır.


## 20. Kabul edilmiş O3 pilot işletim hedefleri

### Yedekleme ve kurtarma

- Pilot RPO en fazla 24 saat, RTO olayın tespitinden itibaren 8 saattir. Bunlar testle kanıtlanacak tasarım hedefidir; mevcut garanti/SLA değildir. Ücretli üretim için ayrıca değerlendirilecektir.
- Her gün veritabanı ve dosyalar birbiriyle tutarlı kurtarma noktası oluşturacak biçimde yedeklenir; canlı projeden bağımsız, şifreli, erişimi sınırlı 30 günlük döngü tutulur. Veritabanı yedeği Storage nesnelerinin içeriğini tek başına kapsamaz.
- Üretim öncesinde ve sonrasında ayda bir izole geri yükleme testi yapılır. Kimlik/erişim, veri bütünlüğü, kod/yapılandırma ile dosya eşleşmesi ve silinen verinin açılmaması doğrulanır. Gerekli kapsamın tam envanteri uygulama öncesi hazırlanır.
- Başarısız/gecikmiş yedek otomatik alarm üretir. RPO, yalnız işin zamanlanmasıyla değil son kullanılabilir kurtarma noktasıyla değerlendirilir.
- Geri yükleme sonrası erişimden önce bütünlük, silme kayıtları ve bekleyen işler denetlenir; eski bildirimler topluca yeniden gönderilmez.
- Yedek yaşı döngüsü ile kalıcı silme talebinden itibaren imha son tarihi aynı şey değildir. Bölüm 19’daki 30 günlük silme hedefinin bütün yedeklerde sağlanması tasarım/test gereğidir; 30 günlük rotasyon bunu tek başına kanıtlamaz.

### İzleme

| Durum | Kabul edilmiş davranış |
|---|---|
| Hizmete erişilemiyor | 5 dakikada bir dış kontrol; art arda 2 başarısızlıkta alarm. |
| Yedek başarısız / kurtarma noktası 24 saatten eski | Beklemeden alarm. |
| Tahsilat/kredi/rezervasyon bütünlük ihlali | Tek olayda kritik alarm; ilgili işlem güvenli biçimde durur. |
| Bildirim/arka plan işi başarısız | Sınırlı otomatik tekrar; denemeler tükenince alarm. İş türü sayıları katalogda belirlenecek. |
| Beklenmeyen backend hatası | Merkezi kayıt, işlem/izleme kimliği; hassas içerik loglanmaz. |

Alarmlar SaaS işletim sorumlusunadır; müşteri owner’ına teknik müdahale yükümlülüğü verilmez. Sorumlu kişi/kanal seçimi açıktır. Alarmın oluşması müdahale edildiğini göstermez; 7/24 insan desteği taahhüt edilmemiştir. RTO hedefinin işletim kapasitesiyle sağlanması test ve üretim değerlendirmesinde ele alınır.

### Performans

| İşlem | İsteklerin %95’i için backend hedefi |
|---|---|
| Sayfalı liste / kişi-paket detayı | 1 saniye |
| Merkezin bir haftalık takvimi | 2 saniye |
| Rezervasyon/iptal/tahsilat/yoklama kapatma | 2 saniye |
| Büyük rapor/dışa aktarım/toplu içe aktarma | Arka plan; başlatma yanıtı 2 saniye |

Ölçüm backend’e varıştan yanıt çıkışına kadardır; istemci interneti ve ekran çizimi dahil değildir. Geçici pilot yük profili 10 organizasyon × organizasyon başına 500 aktif öğrenci, toplam 50 eşzamanlı kullanıcıdır; ticari plan limiti değildir. Gerçek istek karışımı ve veri hacmi yük testinde belgelenecek. Hız için bütünlük gevşetilmez; doğru ret geçerli sonuçtur. Büyük işler ilerleme/sonuç durumuyla sorgulanır, bağlantı kopması işi yeniden başlatmaz. Sağlanmazsa sorgu/indeks/işlem tasarımı iyileştirilir, gerekirse altyapı yükseltilir.

Resmî dayanak (15 Ekim 2026’da kontrol edildi): https://supabase.com/docs/guides/platform/backups — Free için düzenli dışa aktarım ve bağımsız yedek önerilir; Storage içeriği ayrıca yedeklenir. Bu doküman bizim RPO/RTO hedefimizi kendiliğinden garanti etmez.

## 21. Kabul edilmiş O4 davranış kararları

### İşlem tekrarı ve çoklu istemci

Kritik işlemlerde istemci işlem anahtarı üretir, tekrar aynı anahtarla yapılır. Kapsam organizasyon + işlemi yapan hesap + operasyondur; merkez ve diğer istek alanları içeriktedir. Aynı anahtar/aynı içerik tamamlanmış sonucu döndürür; farklı içerik reddedilir. Sürüyorsa ikinci kez çalıştırılmaz, durum sorgulanır. Tam sonuç 30 gün tutulur, sonra anahtarın kullanılmış olduğuna ilişkin asgari kayıt ilgili iş kaydının saklama süresince korunur; eski anahtar yeni iş başlatmaz. Sonucu okumak güncel erişim kontrolüne tabidir. Anahtar kaydı kişisel veri silme/saklama politikasını aşan istisna değildir.

Farklı anahtarlarla aynı öğrenci/seans için iki aktif rezervasyon atomik iş kuralıyla engellenir; ikinci istek yetkisi kapsamında zaten rezervasyon bulunduğu sonucunu alır. Aynı/farklı frontend veya eşzamanlılık bu kuralı değiştirmez; ikinci yer/hak ayrılmaz. Aynı öğrenci/tutarlı iki tahsilat gerçek ayrı ödeme olabileceğinden salt tutar eşitliğiyle mükerrer sayılmaz.

### Sürüm desteği

Uyumlu yeni alan eklenebilir; mevcut alan anlamı sessizce değişmez. Bozucu değişiklik yeni ana API sürümüdür. Önceki ana sürüm yenisinin yayımlanmasından itibaren en az 90 gün desteklenir; kapanış tarihi sorgulanabilir sözleşmede yayımlanır. Kritik güvenlik/bütünlük sorunu erken engelleme gerekçesidir; gerekçe/asgari sürüm bildirilir. Desteklenmeyen istemci hiçbir iş kaydı üretmeden sabit güncelleme-gerekli hatası alır. Her sürüm güncel rol/plan/bütünlük kontrollerine tabidir.

### Davet ve sıfır organizasyon

Davet 7 gün geçerli, tek kullanımlık, hedef e-postaya bağlıdır. Aynı kişi/hedef adres için tek aktif davet vardır; yeniden gönderim eskisini geçersizleştirir, yeni 7 günlük süre başlar. Süre dolumu kişi/paket/rezervasyonu silmez. Kabulde güncel organizasyon erişimi ve başlatanın ilgili yetki/kapsamı kontrol edilir; kaldırılmış yetki veya kapalı hizmet erişim kazandırmaz. Gecikmenin ilk 7 günündeki açık davet istisnası aşağıdaki matrise tabidir.

| Rol | Davet kapsamı |
|---|---|
| Merkez yöneticisi | Kendi merkezindeki kişi kayıtları; mevcut rol/bağlantı sınırları korunur. |
| Operasyon personeli | Yetkili merkezde mevcut öğrenci hesabı daveti varsayılan açık; merkez yöneticisi kapatabilir. |
| Eğitmen | Varsayılan kapalı, yönetici izniyle yalnız görevlendirildiği sınıf/seans öğrencileri. |
| Asistan | Yok. |

Öğrenci daveti rol/yöneticilik veya iletişim değiştirme yetkisi vermez. Eğitmen kayıtlı adrese gönderebilir, adresi değiştiremez; tamamını görmesi gerekmez. Gönderen/öğrenci/zaman izlenir. Yetki kalktıysa yönetici yeni davet başlatır. Hesap erişimi mevcut kişiye, ilk kabulde öğrenci self erişimidir. Ayrıcalıklı login rolü yalnız aktif hesap bağı kurulduktan sonra yetkili atamasıyla verilir. Offline görev/ilişki kaydı rol grantı değildir; otomatik ayrıcalık açmaz.

Sıfır organizasyonlu hesap açık kalabilir, hesap yönetimi/davet kabulü yapabilir, organizasyon verisine erişemez. Hesap açmak organizasyon yaratmaz; yeni organizasyon oluşturma ayrı işlemdir.

### SaaS ödeme gecikmesinin ilk 7 günü

| İşlem grubu | Durum |
|---|---|
| Öğrencinin mevcut hakla rezervasyon/iptal/talep/görüntülemesi | Açık |
| Mevcut programda talepleri sonuçlandırma, rezervasyon/iptal, yer teklifi kabulü | Açık |
| Mevcut seansın yoklaması/kapanışı ve gerekçeli düzeltme | Açık |
| Mevcut seans iptali, zorunlu saat/oda/eğitmen değişikliği | Açık |
| Mevcut öğrenci borcu tahsilatı, gerekli iade/mahsup | Açık |
| Mevcut öğrenci hesabı daveti gönderme/kabul | Açık |
| Yeni öğrenci aktifleştirme, paket satışı/yenileme, yeni program/seans/etkinlik | Kapalı |
| Fiyat/katalog/politika/personel/yetki yönetimi | Kapalı |
| Yeni CRM kampanyası/otomasyonu ve toplu içe aktarma | Kapalı |
| Yetkili mevcut kayıt okuma/dışa aktarım | Açık |
| Owner SaaS ödeme/abonelik işlemleri | Açık |

Açık işlem rol yetkisini genişletmez. Düzeltme/başka personel hesabıyla kapalı işlem aşılamaz. Yedi gün sonunda hizmet bütün rollere kapanır, owner yalnız ödeme/abonelik yönetimine erişir. Özel ders talebi mevcut uygun seansa bağlanabiliyorsa onaylanır; yeni seans gerektiriyorsa gecikme kısıtı nedeniyle bekler, reddedilebilir/geri çekilebilir. Mevcut seans değişimi/kopyalama yeni ders yasağını aşamaz.

### Merkezler arası hak kullanımı

Yalnız paketin izin verdiği merkezlerde, ortak bakiye atomik kontrolüyle mümkündür. Satış/borç/tahsilat/iade satış merkezinde kalır; her kullanımda satış ve hizmet merkezi ayrı izlenir. Fiilî dersin hakedişi hizmet merkezinin anlaşmasıyla o merkezde oluşur; yüzdelik hesap kaynak paketin satış bedeline dayanır. Süreli ürünün açık anlaşma koşulu zorunluluğu korunur. DS-2026-10-17: uygun kredili tüketimde gerçek satış bedeli payı A→B alacağını oluşturur; süreli/sınırsız için transfer yoktur. Kapanış/tüketim veya sonradan uygun kredili paketle geçmiş açık kapatma tetikler; ilgili iade bağlı ters kayıt üretir. Otomatik para transferi yoktur; çift onay ve ayrı yetkili ödeme/mahsup kaydı gerekir.

### Halka açık başvuru koruması

Hesapsız başvuru yalnız talep oluşturur; yer/hak ayırmaz, hesap-kişi bağlantısı/rol vermez. İlk kabulde bot doğrulaması zorunludur. IP/hedef adres/organizasyon sınırları birlikte uygulanır, IP kimlik sayılmaz. Başlangıç: IP başına 15 dakikada 5, aynı organizasyon/hedef adrese saatte 3 başarılı başvuru. Bunlar ayarlanabilir güvenlik değeridir. Aynı hedef/ders-etkinlik için açık başvuruda ikinci kayıt oluşmaz. Yanıt adresin öğrenci veya hesap olduğunu açıklamaz; iletişim doğrulanmamıştır, eski kişi bilgisi otomatik değiştirilmez. Hizmeti kapalı organizasyonda veri toplamadan kullanılamadığı bildirilir. Açık başvuru öğrenci limitini veya etkinlikte aktif öğrenci koşulunu aşmaz.

### Para, zaman ve sıra

Para biriminin en küçük biriminde tam sayı kullanılır; kayan noktalı para hesabı yoktur. Para birimi zorunlu, farklı para birimi mahsup/otomatik kur dönüşümü yoktur. Ara hesap hassastır; sonuç en küçük birime, yarım değerler sıfırdan uzağa yuvarlanır. Satır dağıtım toplamı kaynağa eşittir; fark en büyük küsurata, eşitlikte kararlı sıraya dağıtılır. Düzeltme/iade önceki hareketin kayıtlı tutarını esas alır; yeniden yuvarlamayla fark üretmez.

Gerçekleşen an UTC, takvim merkez saat dilimidir. Takvim günü ve 24 saat ayrı tanımlanır. Eşit iş zamanında değişmez kayıt kimliği kararlı sıra sağlar. API tipleri ve yaz saati doğrulaması04–08’de; desteklenen para birimi/exponent allowlist’i kurulumda sürümlenir, unsupported para birimi işleme açılmaz.

### Eşzamanlı düzenleme ve önizleme

Düzenlenebilir kayıt sürüm taşır; istemci okuduğu sürümle yazar. Arada değişmişse sabit sürüm-çatışması hatasıyla ret, güncel kayıt okuma ve yeniden değerlendirme gerekir; eski değişiklik otomatik tekrarlanmaz. Yetki/kontenjan/bakiye kontrolleri ayrıca sürer. Finans/kredi geçmişi değiştirilmez, bağlı düzeltme eklenir. Önizlemede ilgili kayıt değişmişse eski kapsam/onay uygulanmaz, yeni önizleme gerekir. İlgisiz değişikliklerle tüm işlemleri gereksiz kilitlememek için bağımlılık kapsamı katalogda tanımlanacak.

### Yeni paketle geçmiş kredi açığı kapatma

Önce geçmiş tüketilmiş açıklar ders tarihi sırasıyla, sonra gelecek rezervasyon açıkları seans tarihi sırasıyla kapatılır. Geçmiş tüketilmiş açık için yeni paketin başlangıcının eski dersi kapsaması aranmaz; ders/sınıf/merkez uygunluğu korunur. Yeni geçmiş rezervasyon yaratılmaz, eski açık hareketine bağlı kapatma kaydı oluşur. Gelecek açıkta paketin seans tarihinde geçerliliği zorunludur. Eski yoklama/satış koşulları/oluşmuş hakediş kendiliğinden yeniden hesaplanmaz. Yeni para borcu yalnız yeni satıştan doğar; kapatma ek borç yaratmaz. Kaynak satışsız negatif kredi katılımında yüzdelik hakediş tabanı merkezce tanımlanır ve rezervasyonda sabitlenir; sonraki paket/ödeme geçmişi yeniden fiyatlandırmaz veya ayrıca para borcu üretmez.

### Hata ve tekrar deneme

Kontenjan/hak/yetki/politika engellerinde otomatik tekrar yoktur. Sürüm çatışmasında güncel kayıt alınır, eski değişiklik otomatik uygulanmaz. Bağlantı kopması/zaman aşımı başarısızlık kanıtı değildir; aynı işlem anahtarıyla sorgu/tekrar gerekir. Backend tekrar denenebilir dediğinde geçici hatada artan aralıklarla en fazla 3 otomatik yeniden deneme vardır. Hız sınırında bildirilen bekleme süresi uygulanır. Sonuç hâlâ belirsizse doğrulanamadı denir; yeni anahtarla ikinci iş başlatılmaz. Hata sabit kod/tekrar bilgisi/izleme kimliği taşır; teknik sır ve başka organizasyon verisi açılmaz.

1.2 — 15 Ekim 2026: O3 ve O4 davranış kararları, personelde varsayılan açık davet ve kabul edilmiş çalışma düzeniyle kaynak ilişkileri işlendi. O4 teknik katalogları, hukuki inceleme, üretim hedefleri ve gerçek doğrulamalar açık kaldı. Bu sürüm 00/01/03 belgeleriyle eşzamanlı güncellenmiştir; önceki 1.1’deki dosyalar değiştirilmedi notu yalnız o tarihsel güncellemeye aittir.


## 22. O4 yazılı teknik sözleşmesi —15 Ekim2026

04 veri şeması,05 API,06 durum/hata/izin,07 denetim/kabul ve08 JSON tip/operasyon sözleşmesi v1.0’dır.85 tablo adayı,174 operasyon,665 tip/şema tanımı ve55 kabul/başarısızlık senaryosu envanteri vardır. Sayılar mimari servis veya modül zorunluluğu değildir.08 JSON’da her operasyona request/response/error/permission/transition/transaction/semantic guard ve senaryo referansları bağlıdır; her typed snapshot kapalı alan şemasıdır. Uygulama bu kuralları gerçekleştirecek, yalnız JSON doğrulaması semantic guardları ispatlamaz.

Belge kontrolleri: referans hedefleri, kapalı nesneler, required alanları, FK adları, feature coverage ve izin/hata eşlemeleri; örnek olumlu/olumsuz payloadlar. Bu yerel alt-küme doğrulaması harici tam dialect validator veya backend testi değildir. RLS/race/Auth/provider/load/restore testleri çalıştırılmadı. Kod/migration dağıtılmadı. FtkSaaS production hazır/SLA iddiası yoktur.

## 23. Son açık kullanıcı kararları —önceki çelişen hükümleri değiştirir

### Owner ve hesap erişimi

Owner rolünü yalnız FtkSaaS doğrulanmış hesaba organizasyon kapsamında atar/kaldırır. Müşteri owner devir/kendi owner rolünü kaldırma yapamaz. Canlı org ownersız bırakılamaz; platform değişimde yeni owner atomik atanır. Owner merkez oluşturur, kendisini CM atar, sonra CM operasyon yetkisiyle hesap erişimi gönderir. Başka CM atayıp kendi CM rolünü owner yetkisiyle kaldırabilir. OM’nin önce kabul edilmiş kendi merkezine atanma hakkı korunur; bu owner rolü verme yetkisi değildir. CM/staff diğer CM/OM/owner atayamaz.

Hesap erişimi bağlantısı organizasyonda mevcut kişi/öğrenci kaydı içindir; orgda olmayan kişiyi çağırma ayrı yeni özellik olarak eklenmez. İlk bağ öğrenci self erişimiyle, rol ataması sonra yetkili tarafından yapılır. Aktif öğrenci ilişkisi ve SaaS sayımı ayrı, hesap erişimi yeni öğrenci kaydı çoğaltmaz. Offline eğitmen/personel/görev kaydı login grantı değildir. Owner CM değilse hesap erişimi gönderemez. Personelde mevcut öğrenci erişimi varsayılan açık, eğitmende izinle kendi öğrencileri, asistanda yok. Yanlış bağ kaldırılıp yeniden kurulması eski grantı otomatik canlandırmaz.

### Negatif kredi, başlangıç kapısı ve hakediş

İzinli negatif limitte/tam sınırda katılım planın izin verdiği koşullarla mümkündür. DS etki onayıyla korunan kesin rezervasyon sırf sonraki limit/politika/hak değişikliği nedeniyle engellenmez; diğer kayıtların sınır aşımı engellenir. Ayrılmış+tüketilmiş açık ortak hesaptır, mevcut rezervasyonun ayrılmış açığı ikinci kez sayılmaz. Seans başlangıcından önce ödeme ve ilgili hak işlemi açığı izinli seviyeye getirmiş olmalıdır; tahsilat tek başına kredi üretmez. DS koruması dışındaki başlangıç limit aşımı blocked sonucudur, CM kaydeder; I/A hassas finans detayı görmez. Sonraki ödeme veya yeni paket geçmiş blocked katılımdan hakediş doğurmaz. Bu kalıcı kayıp öğrenci/pasiflik değildir. Kredi consume/release satıştaki açık blocked politikasındandır.

Blocked kişi yüzde/kişi hakedişine dahil değildir. Diğerleriyle gerçekleşen seans sabiti korunur; hiç gerçekleşmeyen özel ders hakediş oluşturmaz. Kaynak satışsız fakat limite uygun negatif krediyle katılımda merkez hakediş değerleme bedelini rezervasyonda sabitler.500TRY/%40→200TRY, sonraki paket bu tutarı değiştirmez; ayrıca öğrenci para borcu yaratmaz. Bu yalnız kaynak satışı bulunmayan negatif yüzdelik için açık gerçek-satış-bedeli istisnasıdır.

### Süreli kota

Hafta/ay kota üyelik başlangıcına bağlıdır; hafta7 yerel gün. Aylık quota sınırı başlangıç gününden üretilir, olmayan gün o ay sonuna sıkışır; sonraki sınır ilk gün çıpasından, satış end_date değişmeden. Son kısa pencere tam kota, devir yok. Rezervasyon quota ayırır; yoklama/iptal koşuluna göre consume/release. Bu satış geçerliliğini otomatik aylık hesaplamak değildir.

### Kuruluş ve abonelik

Platform doğrulanmış hesaba owner atar. Owner ilk merkez/self-CM kurabilir. Öğrenci, satış ve ders operasyonu ilk abonelik ödemesi doğrulandığında açılır; dönem o anda başlar. İlk ödeme öncesine7gün grace uygulanmaz, ücretsiz trial yoktur. Kuruluş taslağı ödeme öncesi sadece bu bootstrap/abonelik yetkilerine sahiptir. Yenileme gecikmesinin mevcut kabul edilmiş7gün modeli sürer.

### Org konfigürasyonu ve otomasyon

Ortak belge yayını, org segment/automation tanımı Owner/OM; CM kendi merkez kapsamını yönetir. Org tanım yetkisi merkez operasyonu vermez. Automation tanımı execute center scope ve güncel operasyon yetkisi gerektirir; rol/plan/zorunlu kuralı aşamaz. Gönderim sağlayıcısı seçimi/kullanım maliyeti ayrıca yapılandırılır.

### Etkinlik kapanışı

Atanmış I/A mark edebilir, kapanış yalnız sorumlu CM’dedir; iptal edilmemiş bütün katılımların sonucu girilmiş olmalı. Paket reserve consume/release kayıt sırasında kabul edilen etkinlik koşuluyla kapanışta atomik sonuçlanır. Saatin geçmesi auto attendance/no_show değildir. Görev ücreti event gerçekleşme+CM görev doğrulamasında, katılımcı sayısı/eksik tahsilat fee’yi kendiliğinden değiştirmez. CM gerekçeli kapalı düzeltmesi bağlı hak hareketleriyle geçmişi korur.

2.0 —15 Ekim2026: Son kullanıcı düzeltmeleri ve son iki kabul işlendi. O4 yazılı katalogları/tip/operasyon eşlemeleri tamamlandı. Hukuki teyit, sayısal kurulum ve gerçek uygulama/üretim doğrulamaları açık tutuldu.

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

**Teknik aktarım durumu:** Ürün kararı kabul edildi; kaynak karar sohbetinde kurulum, fiziksel tablo/API dönüşümü veya kodlama yapılmamıştı. Kaynak v2.2 katalogları o tarihte bu revizyonu bütünüyle temsil etmiyordu; güncel aktarım 09 raporundadır. Disiplin kimlikleri/merkez ilişkileri, öğrenci-eğitmen disiplin ilişkileri, paket kapsam tipleri, kredi açığı anahtarı, işlem izinleri ve ortak tiplerin dönüşümü ayrı teknik sohbette tamamlanıp doğrulanacaktır. Önceki 31 kontrol ve 55 senaryo bu yeni revizyonun geçtiği testler değildir. Disiplin revizyonu için O4 teknik katalog kapanışı yeniden açıktır.

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

**Durum:** Belge ve makine sözleşmesine üretim politikası işlendi. Ortam/üretici seçimi, alan bazlı ortak tip aktarımı, migration ve gerçek üretim/yarış testleri ayrı teknik sohbette yapılacaktır. Kodlama, kurulum veya dağıtım yapılmadı.


## Q-D01 — 15 Ekim 2026 kabul edilen etkinlik kuralı

1. Etkinlik tek disiplinli, çok disiplinli veya disiplinsiz olabilir. Disiplin etiketleri tanıtım ve filtreleme içindir; tek başına paket kullanım yetkisi oluşturmaz.
2. Paketle katılımda ders/etkinlik uygunluğu ayrıca açıkça tanımlanır. Etkinliğin Salsa etiketi taşıması, Salsa paketini kendiliğinden geçerli yapmaz.
3. Tek disiplinli etkinlikte, etkinliğe uygun ve ilgili merkez/disiplini kapsayan dar paketler kullanılabilir. Etkinliğe uygun geniş paketler de mevcut kapsam kurallarına göre kullanılabilir.
4. Çok disiplinli veya disiplinsiz etkinlikte yalnız etkinliğe uygun merkezin tamamı (center_all_disciplines) veya organization_all kapsamlı paketler kullanılabilir. center_discipline ve organization_discipline kapsamları kullanılamaz.
5. Etkinliklerde negatif kredi kullanılmaz. Paketle katılımda yeterli kullanılabilir hak bulunmalıdır; aynı hak eşzamanlı işlemlerde ikinci kez kullanılamaz.
6. Manuel ödeme ve etkinliğe özel satış kuralları korunur. Bu karar tahsilat ile kredi üretimini birleştirmez ve yeni bir ödeme zorunluluğu tanımlamaz.
7. Organizasyon izolasyonu, merkez erişimi, kapasite, geçerlilik ve mevcut katılım/iptal/kapanış koşulları korunur. Geniş kapsamlı paket toplam ortak havuzunu kullanır; disiplin başına hak çoğaltılmaz.

Ürün kararı kapalıdır. Teknik aktarımın güncel kanıtı 11 raporundadır; tam kayıt/RPC ve son ortak kredi yarışı henüz tamamlanmadı.


## Q-E01 — Kabul edilmiş etkinlik ödeme ve işletme iptali eki

## 1. Paketsiz, ücretli ve tam ödeme şartlı etkinlik

- Öğrenci adına etkinliğe bağlı ödeme hazırlık kaydı ve borç oluşturulur. Hazırlık kesin kayıt değildir ve kontenjan tutmaz.
- Merkez manuel tahsilatı özellikle bu borca bağlar. Başka borca dağıtılmış ödeme bu etkinliğin ödeme şartını karşılamaz.
- Kesin kayıt sırasında tam ödeme, kapasite ve mevcut diğer uygunluk koşulları yeniden kontrol edilir. Koşullar uygunsa kesin kayıt tamamlanır.
- Ödeme alınmış ancak kontenjan dolmuşsa kesin kayıt oluşmaz. Hazırlık kapatılır, borç ters kayıtla kaldırılır; ödenen tutar öğrenci alacağına dönüşür. Nakit iade veya başka borca mahsup ayrı ve açık işlemdir.
- Kısmi ödeme kesin kayıt oluşturmaz; ödeme geçmişi korunur.

## 2. İşletmenin etkinliği gerçekleşmeden tamamen iptali

- Etkinlik bedeli tamamen geri alınır. Katılımcının iadesiz koşulu bu işletme iptaline uygulanmaz.
- Etkinliğin kalan borcu kaldırılır; ödenmiş tutar öğrenci alacağına dönüşür. Otomatik nakit iade yapılmaz.
- Önceki iade ve borç indirimleri hesaba katılır; aynı tutar ikinci kez iade edilmez veya alacaklaştırılmaz.
- Başka borçlar değişmez. Mahsup ve nakit iade mevcut yetki, merkez, para birimi ve bakiye sınırlarıyla ayrı açık işlemlerdir.
- Paketle katılımda ayrılmış hak serbest bırakılır; ayrıca etkinlik bedeli kadar parasal alacak üretilmez.
- Bu karar başlamış veya kısmen gerçekleşmiş etkinlik için oransal hesap tanımlamaz. Böyle bir durum için varsayım yapılmaz; gereken ürün kararı ayrıca belirtilir.

| Etkinlik bedeli | Ödenen | Gerçekleşmeden işletme iptali |
|---|---:|---|
| 1.000 TL | 0 TL | 1.000 TL kalan borç kaldırılır. |
| 1.000 TL | 400 TL | 600 TL kalan borç kaldırılır; 400 TL öğrenci alacağı oluşur. |
| 1.000 TL | 1.000 TL | Kalan borç yoktur; 1.000 TL öğrenci alacağı oluşur. |

Örnekler önceki iade/indirim bulunmadığı varsayımıyladır.


Teknik karşılık: event_payment_preparations, mevcut debts/debt_allocations/debt_adjustments/student_credit_movements; güncel API/tipler 08 sözleşmesinde. Kanıt: reports/qe01-verification.json. Başlamış veya kısmen gerçekleşmiş etkinliğin parasal iptal hesabı bu kararda tanımlı değildir.

## Q-E02 — 16 Ekim 2026 son kabul (önceki çelişen hükümlerin yerine)

**E02-01.** Katılımcının başlama sonrası kendi kaydını iptali/ayrılması parasal iade, borç indirimi veya öğrenci alacağı üretmez. Mevcut paket iptal koşulları aynen korunur.

**E02-02.** Merkez iptali her aşamada etkinliğe bağlı ücret yükümlülüğünü tamamen kaldırır; kalan borç sıfır, tahsilatın daha önce alacaklaştırılmamış tamamı öğrenci alacağıdır. Nakit iade/mahsup ayrı açık yetkili işlem; otomatik nakit çıkışı yok.

**E02-03.** Merkez iptali tüm ayrılmış hakları serbest bırakır, tüketilmiş hakları previous_id bağlı ters hareketle tamamen geri verir; kısmi tüketim ve paket hakkı için parasal alacak yok.

**E02-04.** Önceki alacak/iade/mahsup/hak dönüşü tekrar üretilmez. Yalnız iptal edilen etkinliğe bağlı kayıtlar; başka borç/geçmiş değişmez. Önizleme+apply sürüm/finans bağımlılıkları, canlı yetki ve tek transaction audit/outbox/receipt ile korunur.

**E02-05.** Etkinlik fiilî başlangıç kaydı/düzeltmesi güncel runtime’da vardır; saat geçmesi tek başına gerçekleşme değildir. Ders anlaşmasının başlangıçta sabitlenmesi DS teknik teslimidir. Merkez iptalinin aşamadan bağımsız sonucu bu tanıma ihtiyaç duymaz; mevcut occurred/attendance evidence korunur.

Teknik aktarım ve test durumu: docs/decisions/Q-E02.md ve reports/qe02-verification.json. Tarihsel test sayıları bu değişikliğin kanıtı değildir.


## Q-E03 — Planlanan başlangıç ve iptalin parasal sınırı · 16 Ekim 2026

**E03-01.** Katılımcı iptalinin parasal sınırı planlanan başlangıçtır. Başlangıç anı dahil sonrasında iade, borç indirimi veya öğrenci alacağı oluşmaz. Öncesindeki iptaller mevcut kabul edilmiş koşullara tabidir.

**E03-02.** Fiilî başlangıcın gecikmesi, sonradan kaydı veya düzeltmesi tamamlanmış katılımcı iptalini yeniden sınıflandırmaz; finansal yeniden hesaplama yapılmaz. Plan 21.00, iptal 21.15, fiilî başlangıç 21.30 başlangıç sonrası iptaldir.

**E03-03.** Planlanan saatin gelmesi tek başına yoklama, hak tüketimi, gerçekleşme veya hakediş oluşturmaz. Katılımcı paket iptal koşulları korunur.

**E03-04.** Merkez iptalinde Q-E02 aynen geçerlidir; ertesi gün kaydı veya aşama tam borç kaldırma ve bağlı para/hak dönüşlerini değiştirmez.

**E03-05.** Başarılı katılımcı iptalinde backend karar zamanı, o andaki planlanan başlangıç ve parasal sınıflandırma participant_cancellation kaydında atomik sabitlenir. Önceki kayıtlara zaman kanıtı uydurulmaz; eski ve merkez iptallerinde alan null kalabilir. İstemci zaman veya sınıflandırma gönderemez.


## Fiilî başlangıç kayıt/düzeltme aktarımı

**AS-01.** Merkez yöneticisi fiilî başlangıcı expected_version ile kaydeder/düzeltir; aktör ve kayıt zamanı backend, gerçek zaman Instant olarak açık girilir. Gelecek fiilî başlangıç reddedilir. İlk kayıt bir kez; düzeltme gerekçeli audit diff ile geçmişi korur, yanlış bilginin kaldırılması null düzeltmesiyle mümkündür.

**AS-02.** Bu kayıt yalnız operasyonel kanıttır; draft kabul edilmez, published/occurred/cancelled durumları değişmeden korunur. Katılımcı iptalinin Q-E03 parasal sınıflandırması, Q-E02 merkez hesaplaşması, yoklama, hak ve hakediş kendiliğinden değişmez.

**AS-03.** İptalden sonra geriye dönük kayıt/düzeltme mümkündür; iptal yeniden açılmaz. Etkinlik sürümü artar; eski önizleme geçersizleşir. event_get mevcut actual_started_at değerini; yönetici/organizasyon okuyucusuna append-only actual_start_history geçmişini döndürür.

Teknik kanıt: docs/actual-start-handover.md, PR son commit CI. Bu aktarım kısmi gerçekleşmeye bağlı yeni parasal veya hak kuralı üretmez.


## Program/seans teknik aktarımı — 17 Ekim 2026

Yeni ürün kuralı eklemeden mevcut program/saat/kaynak/kapasite/görev kuralları sonlu materialize edilmiş oluşumlara aktarılır. Ayrıntılı DTO, bağımlılık, miras/override ve hata davranışı [program/seans devrindedir](../docs/program-session-handover.md). Yerel tarihler [başlangıç,bitiş), DST çift saatinde açık date/offset_minutes; gap reddi. this_and_future aynı programın gelecekteki planned/open oluşumlarını kapsar; geçmiş/sonuçlanmış korunur. Mevcut rezervasyon/hak kimliği kapasite indirimiyle iptal edilmez; saat değişikliği mevcut sabit hakkı geçersiz kılıyorsa transaction reddedilir. DS hedefi: Starter kapanışı/hak tüketimi anlaşmasız ve hakedişsizdir; Pro/Business ücretli görev açık anlaşma gerektirir. Starter’ın gereksiz anlaşma bağımlılığı giderildi. Ücretli anlaşma sürüm/başlangıç/hakediş motoru ve ücretli finansal kapanış ayrı açık teslimdir.

Sınıf atama güncellemesi hedef atama satır sürümünü, seans kapasite/görev güncellemesi seans sürümünü ister. Inactive açık görev kaldırmasıdır; sınıf varsayılanı açık oluşum override'ını geri getirmez. Önizleme dependency değişimi PREVIEW_STALE, komut sürüm yarışı VERSION_CONFLICT, kaynak/uygunluk çakışması RESOURCE_CONFLICT, eksik yapılandırma POLICY_NOT_CONFIGURED üretir. Yetki geri alınması receipt replay öncesinde denetlenir. İptal/yerine seans/bekleme/yoklama/paket seçimi bu aktarımın kapsamı değildir.

## Son hesaplaşma revizyonu — DS-2026-10-17

[Yetki ve iki taraflı kesinleştirme kararı](../docs/decisions/DS-2026-10-17-settlement-revision.md) geçerlidir. Owner → OM devretme izni → belirli merkez CM hesaplaşma grantı zinciri uygulanacak hedeftir; Owner CM'ye doğrudan da grant verebilir. OM/CM rolü ve Owner'ın grant yönetimi tek başına merkez finansal operasyon yetkisi değildir. CM yetki devredemez.

A'nın açık yetkili CM'si gerçekleşen ödeme veya önerilen mahsup başvurusu açar; bakiye değişmez. B merkezinde ayrı doğrulanmış güncel CM rolü ve açık hesaplaşma yetkisi olan kişi (başlatanla aynı hesap olabilir) onayı kayıt, seçili bakiye, request, audit/outbox/receipt'i atomik kesinleştirir. Gerekçeli ret bakiye değiştirmez, A'ya uygulama içi gider. Ayrı OM ödeme/mahsup kayıt aşaması yoktur; onay banka transferi değildir. Kısmi, aynı para birimli karşılıklı mahsup ve geçmişi koruyan bağlı düzeltme aynı başvuru/onay zincirindedir. İlgili sürüm değişimi yeni onay ister, alakasız dersler stale yapmaz. Farklı kişi/hesap veya kendi başvurusunu onaylama yasağı yoktur. A’da başvuru ve dondurulmuş B merkezinde onay yetkisi ayrı aranır; istemci center seçimi yetki değildir. Audit her adımın hesap/merkez/CM rol/grant kapsamını kaydeder. Aynı hesap kullanımı çift kapama/sürüm/yarış korumasını aşmaz; receipt replay ve commit dahil canlı yetki aranır.

DS-OPEN-01 karar düzeyinde kapalıdır; runtime pending. [Son merkez yetki düzeltmesi](../docs/decisions/DS-2026-10-17-settlement-center-scope.md) farklı hesap şartını kaldırır; DS-OPEN-02 karar düzeyinde kapalıdır, ayrı istisna/fallback yolu yoktur. Yeni idari grant/read/version/audit scope DTO’ları ve 38 gerçek kabul senaryosu 08’de izlenir: DS-PLAN-01 gerçek Starter testine bağlıdır, kalan 37 vaka pending_runtime; hesaplaşma bütünü yalnız sözleşmedir. Main koruması ayrı yönetici işidir. PR #13 için verilmiş tarihsel merge yetkisi bu yeni teslimi kapsamaz; production dağıtım yetkisi yoktur.

## Starter yoklama/koruma runtime aktarımı

[Starter devri](../docs/starter-attendance-protection-handover.md) kabul edilmiş kararları değiştirmeden dar runtime kapsamını belirtir. Starter F14 kapanışı ve bağlı düzeltme hak hareketi + audit/outbox/receipt ile atomiktir; hakediş üretmez. Ücretli finansal kapanış anlaşma/hakediş motoruna kadar POLICY_NOT_CONFIGURED ile domain yazmadan reddedilir. Koruma yalnız yeni olumsuz etkiye bağlıdır; bağımsız engelleri veya yeni rezervasyon koşullarını kaldırmaz. Taslak başlangıç kanıtı değildir; başlangıç/belge ve diğer hak değişikliği tüketicileri pending. 198 işlem/89 canlı/109 contract-only özellik tamamlama oranı değildir.

## Eğitmen anlaşması/hakediş teknik aktarımı

Kabul edilmiş ücret kuralları immutable zincir, açık fiilî başlangıç kimlik snapshot'ı ve ücretli kapanışa aktarılmıştır. Yeni ürün ücreti/politika değeri türetilmedi. CM yayımlar; canlı görevlendirilmiş eğitmen/CM gerçek başlangıcı açıkça kaydeder. Kapanış gerçekleşme ve fiilî görev beyanını ister; saat tek başına hakediş değildir. Gerekçeli düzeltme sabit eski koşuldan bağlı fark üretir, ödemeyi silmez. Uygulama/kabul sınırları: [güncel devir](../docs/instructor-earnings-handover.md).
