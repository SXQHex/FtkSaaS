# P08 — kabul edilmiş kapsam ve kurulum kararları

## Organizasyon bazında sabit abone numarası

23 Ekim kullanıcı kararı: organizasyonun ekran/arama/rapor ve tarihsel takip anahtarı abone numarasıdır; platform UUID kimliği ve ilişkileri korunur. Numara organizasyon içinde benzersiz, değişmez ve yeniden kullanılmaz. Aynı kişinin başka organizasyondaki numarası farklı olabilir; global izleme numarası değildir. Ad veya doğrulanmış iletişim değişikliği numarayı, üyeliği, hakları veya finans bağlantılarını değiştirmez. Numara tek başına kimlik doğrulama/erişim yetkisi sağlamaz.

Format, başlangıç, adaya hangi aşamada tahsis, mevcut kayıt aktarımı ve kişi birleşiminde geçerli/eski numara alias davranışı uygulamadan önce netleştirilir. Eşzamanlı tekillik, idempotent tahsis, tenant izolasyonu, silme/yeniden katılımda yeniden kullanmama ve tarihsel izlenebilirlik kabul edilir. Bu yalnız P08 kaydıdır; migration/API/canlı veri değişmez.


22 Ekim kullanıcı kararı: mevcut kurulum mevcut API’lerle ilerler; aşağıdaki genişletmeler P08 kapsamındadır, şimdi uygulanmaz ve P07’ye eklenmez. API sayısı/DTO/runtime/migration bu kayıtla değişmez.

## Çok kaynaklı ortak CRM başvuru toplama — 23 Ekim 2026 kullanıcı kararı

- Farklı formlar için ayrı başvuru tabloları açılmaz; birden çok form aynı ortak başvuru tablosuna alınır. Organizasyon/merkez kapsamı korunur; Fethiye Tango Kulübü kayıtları yalnız kendi CRM yetkililerine görünür. Mevcut public_applications modelinin genişletilmesi veya ortak modele taşınması uygulama bağımlılık incelemesinde seçilir; ikinci paralel başvuru deposu kurulmaz.
- Ortak alanlar kullanılır ve zorunlu bir kaynak sütunu ile kaydın hangi form/kanaldan geldiği izlenir. İlk kaynaklar: fethiyetango.com/tr/iletisim, fethiyetango.com/tr/kayit, Instagram, Facebook ve Google reklam formları. Kanal ile belirli formun kimliği karıştırılmaz; sağlayıcı/form kimliği ve mevcutsa kampanya/reklam kimliği, UTM ve sayfa adresi kaynak ayrıntısı olarak korunur. Kaynak bilgisi güvenilir entegrasyon eşlemesinden gelir; istemcinin gönderdiği organizasyon/kaynak beyanı tek başına yetki sağlamaz.
- Web formları curl ile HTTP 200 ve istemci JavaScript üzerinden incelendi: iletişim POST /api/contact ile name/phone/level/consent/marketingConsent gönderir; kayıt POST /api/kayit ile fullName/phone/level/mode/partnerName/consent/marketingConsent gönderir. Kayıt formunda partnerli seçimde partner adı vardır. İkisinde e-posta ve serbest mesaj alanı yoktur. Ad, normalize telefon, seviye ve ayrı zorunlu onay/pazarlama izni ortak modele eşlenir; partner ve kayıt biçimi gibi forma özgü alanlar kaybolmadan saklanır. Nihai şema/DTO adları bu kuyruk kaydıyla belirlenmiş sayılmaz.
- Kullanıcı mevcut sitede Upstash'ın hız sınırlama yaptığını doğruladı. Mevcut site sunucu uç noktaları ve Upstash koruması korunarak FtkSaaS başvuru API'sine bağlantı planlanır. Mevcut ayrı Supabase projesi fethiyetango (tycmjtboljppdwvgqagy) erişilebilir; ancak tabloları, sunucu handler'ları ve mevcut verinin aktarım ihtiyacı henüz incelenmedi. Eski kayıtlar kendiliğinden taşınmaz veya silinmez.
- Instagram/Facebook/Google reklamlarındaki yerel formlardan da aynı tabloya alım desteklenmeli. Her sağlayıcı için gerekli hesap erişimi, webhook veya çekme yolu, doğrulanmış gönderici, izin kapsamı ve alan eşlemesi ayrıca doğrulanır; entegrasyonların bugün kurulmuş olduğu varsayılmaz. Reklamdan web formuna yönlendirme ile sağlayıcının kendi formundan alım ayrı giriş yollarıdır.
- Mevcut public_application_submit_v1 yayın kimliği ve e-posta ister; bu telefon tabanlı genel CRM başvurusunu bugün karşılamaz. Genel başvuru kabulü, yetkili inbox/liste/inceleme ve mevcut kişi/aday eşlemesi birlikte ele alınır. Başvuru otomatik öğrenci, kullanıcı hesabı, satış, rezervasyon veya pazarlama onayı üretmez.
- Kabul: tenant/merkez izolasyonu, yetkisiz doğrudan tablo/RPC yazımının reddi, web hız/bot koruması ve sağlayıcı doğrulaması, aynı dış başvuru/form gönderiminin tekrarında tek kayıt, aynı kişinin farklı gerçek başvurularının kaynak geçmişini kaybetmemesi, telefon normalizasyonu, ayrı onayların sürüm/zaman/kaynak kanıtı, webhook tekrarları ve geç hata rollback'i. Genel kişi eşleme politikası doğrulanmış iletişim/izin kapılarını aşmaz.
- Bu madde P08 plan kaydıdır: kod, migration, DTO/envanter, site tasarımı, canlı entegrasyon veya veri aktarımı şimdi değiştirilmez; CI/CD tetiklenmez.



- Ders kategori kontenjanı mevcut kapasite kararıyla uygulanmıştır; P08 bunu yeniden açmaz.
- Sınırsız etkinlik kapasitesinin açık temsili: sihirli büyük sayı veya0 ile taklit edilmemeli. Mevcut kurulumda etkinlik dahil sonlu kontenjan20 kullanılır.
- Pakete bağlı, ders kredisi tüketmeyen etkinlik katılımı: bu paket4 ders sağlar; etkinlik için ayrıca4 hak veya sayaç yoktur. İzin verilen “Pratik” etkinliğine ücretsiz katılım, etkinlik tarihinde paketin iki aylık geçerliliği VE kullanılabilir ders hakkı sürerken mümkündür; süre veya ders hakkı hangisi önce biterse uygunluk kapanır. Etkinlik kaydı yalnız etkinliğin kontenjanından yer ayırır; ders kredisini reserve/consume etmez. Etkinlik yoklaması alınabilir ve ders bakiyesini değiştirmez. Diğer paketler için ayrı etkinlik hak sayacı seçeneği ayrıca tartışılabilir; bu pakete zorunlu değildir. Mevcut event_register/reserve_right ortak havuzdan1 kredi ayırdığından bu davranış uygulanmış değildir. “Pratik” etkinliğin adıdır; mevcut core.events modeli kullanılır, yeni pratik modülü açılmaz.
- Uygunluk ve paket hareketleri: her harekette bütün etkinlik kayıtlarına durum kopyalamak yerine güncel paket/kapsam/bakiye/geçerlilikten uygunluk hesaplanmalı; kayıt ve katılım kapılarında atomik tekrar kontrolü/yarışlar doğrulanmalı. Hak tüketimi/iadesi, süre uzatma/kısaltma, dondurma/sonlandırma gibi değişiklikler hesabı etkiler. Geçmiş yoklama ve kesin kayıtlar sessizce silinmez/iptal edilmez; mevcut kesin rezervasyon koruması ve açık yönetici çözümü korunur. İlk kayıt, katılım anı ve önceden kesinleşmiş kayıtların korunması birlikte kabul senaryolarına bağlanmalı.
- Tartışılacak: Business için sınırsız öğrenci/eğitmen/merkez kullanımının uçtan uca temsili. Mevcut private.plan_limit unlimited=true okur; PlanLimit API sözleşmesi ise yalnız key/value kabul eder ve ek alanı reddeder. Sözleşme, okuma yanıtları, doğrulayıcılar ve limit kapılarının ortak modeli P08’de kararlaştırılacak; şimdi runtime değişikliği yapılmaz. Mevcut kurulum sonlu sınırlarla ilerler: aktif öğrenci1000, eğitmen50, merkez5. Bu geçici kurulum değerleri Business için genel sınırsızlık kararının yerine geçmez.
- İlk kurulumdaki doğrulanmış owner Auth hesabı ve Business planının fiyat/dönem/limit tanımı operasyonel ön koşullardır; yeni geliştirme gibi veya hazırmış gibi gösterilmez. Gerçek doğrulama/konfigürasyon olmadan hesap doğrulanmış, ödeme yapılmış veya ücretsiz Business planı var sayılmaz.

Mevcut kurulum kararı: sonlu100 haftalık tekrar, toplam kontenjan20, paket başına4 ders; paket geçerliliği2 ay; geçerli ve ders bakiyesi olan pakete bağlı ücretsiz Pratik katılımı (ayrı sayaç yok). Bu kurulumdaki ikinci paket henüz sipariş aşamasındadır; kendiliğinden ikinci satış/borç/hak değildir. Bu örnek mevcut borçlu satış kurallarını genel olarak kaldırmaz. Gerçek ödenmemiş borç katılımı engeller; ders için negatif hak alt sınırı−2, etkinlikte negatif kredi yasağı korunur. Kapalı grupta öğrenci iptali hak iadesi sağlamaz; fiilî yoklama gerçeği kaydedilir.

“Sonraki hafta” ek pratik süresi kaldırılmıştır ve açık iş değildir. Süresiz tekrar isteği mevcut kurulumda100 tekrar ile karşılanır; bu nedenle ayrıca süresiz program geliştirmesi açılmaz. Son kaynak incelemesi ve full/main clean kapıları hiçbir P08 maddesiyle gevşetilmez.


P07'nin sonraki tamamlanmış kaynak ve hosted temel kurulum kanıtı yukarıdaki kapanış kaydındadır. Gizlilik partial/pending ve fiziksel imha kanıtı sınırı sürer. 69 ana ayar davranışı tamamlandı. Sonraki adım tek alan/değer/yetki/API matrisi; yeni ayar API geliştirmesi bu kapanışla başlamaz.

Instagram ile giriş/kayıt/hesap bağlama kapsam dışıdır. Buradaki Instagram/Facebook/Google reklam başvuru kaynakları ayrı ortak CRM/P08 veri alımıdır; sosyal login yöntemi veya kurulmuş entegrasyon değildir.




Güncel uygulama durumu ve açık işler [tek backlog’dan](../remaining-work.md), geçmiş izinli operasyonel aktarım [hosted kaydından](../remote-backend-setup.md#p08-kurulum-kaydı) okunur. Bu karar kaydı veri aktarımı çalıştırma yetkisi değildir.
