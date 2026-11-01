# P08 — Abone No, ortak başvuru ve etkinlik davranışı

Bu dosya bu üç ürün davranışının tek normatif sahibidir. Plan erişimi/ticari limitler [ürün kapsamında](../contracts/01-FtkSaaS-urun-kapsam-sozlesmesi.md), bildirim ve SaaS dönem davranışı [teknik sözleşmede](../contracts/02-FtkSaaS-teknik-sozlesme.md), uygulama işleri [backend backlog’da](../../apps/backend/docs/remaining-work.md), tenant kurulum girdileri [işletim kaydında](../../apps/backend/docs/remote-backend-setup.md#p08-kurulum-kaydı) tutulur. Kabul edilmiş karar; uygulanmış DTO/migration, test veya canlı kabul demek değildir.

## Organizasyon bazında sabit abone numarası

- UUID teknik kimlik ve ilişkiler için korunur; fiziksel operasyonun arama/liste/ekran/rapor kimliği **Abone No**’dur. No üzerinden bulunan kişiyle komutlar yine UUID/yetki denetimiyle yürür. Numara kimlik doğrulama veya erişim yetkisi değildir.
- Kişi organizasyonda ilk kez öğrenci olduğunda hesabı bulunmasa da otomatik tahsis edilir. Yalnız aday/eğitmen/personel olmak tahsis nedeni değildir; öğrenci ilişkisi açılırsa tahsis edilir. Hesap bağlama tahsis ön koşulu değildir.
- Organizasyon içinde 1001’den başlayan artan, ön eksiz sayı; benzersiz/değişmez ve yeniden kullanılmaz. Boşluklar doldurulmaz, kesintisiz sıra garantisi yoktur. Ad/iletişim/merkez ve aktiflik değişimi numarayı değiştirmez. Başka organizasyonda aynı kişinin numarası bağımsızdır.
- Mevcut aktif/pasif öğrenciler ilk öğrenci ilişkisinin oluşturulma tarihine, eşitlikte kişi UUID’sine göre sıralanarak tahsis edilir. Bir kişinin birden çok merkez ilişkisi ayrı numara üretmez. Yeniden çalıştırma verilmiş numarayı değiştirmez; yeni tahsisle yarış atomik korunur.
- Kişi birleşiminde iki numara varsa ilk tahsis edilen korunur; diğeri aynı birleşik kişiye arama sağlayan eski numara/alias olur. Yalnız bir kayıtta numara varsa o korunur. Alias yeniden tahsis edilmez; geçmiş makbuz/listeler yeniden yazılmaz.
- Eşzamanlı tekillik, idempotent tahsis, tenant izolasyonu, silme/yeniden katılımda numarayı başka kişiye vermeme ve tarihsel izlenebilirlik korunur. Hukuki imha/saklama kuralları numara gerekçesiyle gevşetilmez.

## Çok kaynaklı ortak CRM başvuru toplama — 23 Ekim 2026 kullanıcı kararı

- Farklı formlar için ayrı başvuru tabloları açılmaz; birden çok form aynı ortak başvuru tablosuna alınır. Organizasyon/merkez kapsamı korunur; Fethiye Tango Kulübü kayıtları yalnız kendi CRM yetkililerine görünür. Mevcut public_applications modelinin genişletilmesi veya ortak modele taşınması uygulama bağımlılık incelemesinde seçilir; ikinci paralel başvuru deposu kurulmaz.
- Ortak alanlar kullanılır ve zorunlu bir kaynak sütunu ile kaydın hangi form/kanaldan geldiği izlenir. İlk kaynaklar: fethiyetango.com/tr/iletisim, fethiyetango.com/tr/kayit, Instagram, Facebook ve Google reklam formları. Kanal ile belirli formun kimliği karıştırılmaz; sağlayıcı/form kimliği ve mevcutsa kampanya/reklam kimliği, UTM ve sayfa adresi kaynak ayrıntısı olarak korunur. Kaynak bilgisi güvenilir entegrasyon eşlemesinden gelir; istemcinin gönderdiği organizasyon/kaynak beyanı tek başına yetki sağlamaz.
- Instagram/Facebook/Google reklamlarındaki yerel formlardan da aynı tabloya alım desteklenmeli. Her sağlayıcı için gerekli hesap erişimi, webhook veya çekme yolu, doğrulanmış gönderici, izin kapsamı ve alan eşlemesi ayrıca doğrulanır; entegrasyonların bugün kurulmuş olduğu varsayılmaz. Reklamdan web formuna yönlendirme ile sağlayıcının kendi formundan alım ayrı giriş yollarıdır.
- Kabul: tenant/merkez izolasyonu, yetkisiz doğrudan tablo/RPC yazımının reddi, web hız/bot koruması ve sağlayıcı doğrulaması, aynı dış başvuru/form gönderiminin tekrarında tek kayıt, aynı kişinin farklı gerçek başvurularının kaynak geçmişini kaybetmemesi, telefon normalizasyonu, ayrı onayların sürüm/zaman/kaynak kanıtı, webhook tekrarları ve geç hata rollback'i. Genel kişi eşleme politikası doğrulanmış iletişim/izin kapılarını aşmaz.

Başvuru otomatik öğrenci, kullanıcı hesabı, satış, rezervasyon veya pazarlama onayı üretmez; bunlar ayrı yetkili işlemlerdir.

### Telefon eşleme ve başvuru tekilliği

Aynı dış gönderimin tekrar teslimi tek başvurudur; aynı telefonla farklı gerçek başvurular ayrı kaynak geçmişi taşır. Telefon normalizasyonu sonrası mevcut kişi eşleşmesi yalnız öneridir; otomatik kişi birleşimi veya doğrulanmış hesap bağlantısı üretmez. Yetkili kişi mevcut kayda bağlar veya ayrı kişi oluşturur. Genel kişi eşleme/izin kapıları korunur.

### Merkeze yönlendirme

Merkeze bağlı form/reklam güvenilir eşlemesindeki merkeze düşer. Merkez seçilmemiş genel form organizasyon gelen kutusuna düşer; organizasyon yöneticisi atar. Merkez personeli yalnız kendi merkezine atanmış başvuruları, yetkili organizasyon yöneticisi tamamını görür. Merkezler arası aktarım kopya yaratmaz; kaynak, onay ve işlem geçmişi korunur. Tek merkezli planlar kendi merkezine yönlenir; Starter’ın temel ders başvurusu sınırı genel CRM/reklam yetkisi vermez.

### Geçmiş kayıtların aktarımı

Eski kayıtlar otomatik taşınmaz. Alan eşlemesi, mükerrerlik ve onay kanıtlarını gösteren önizlemeden seçilen kayıtlar yetkili onayıyla aktarılır. Kaynak veri silinmez. Kanıtı bulunmayan pazarlama izni verilmiş sayılmaz. Aktarım tekrarları yeni kişi/başvuru üretmez; farklı gerçek başvuruların geçmişi kaybolmaz. Bu karar canlı aktarım çalıştırma yetkisi değildir.

## Etkinlik kapasitesi

Odaya bağlı etkinlikte **sınırsız seçilemez**; sayısal kontenjan zorunludur ve oda fiziksel kapasitesini aşamaz. Odaya bağlı olmayan etkinlikte sayısal veya sınırsız kapasite seçilebilir. Sınırsızlık açık temsil edilir; 0 veya büyük sayı ile taklit edilmez. Sınırsız etkinliğe sonradan oda bağlanacaksa geçerli sayısal kapasite gerekir. Mevcut kesin kayıtlar sessizce iptal edilmez; doluluğa aykırı kapasite/oda değişimi açık çözüm olmadan uygulanmaz. Ders kategori kontenjanı kararı değiştirilmez.

## Pakete bağlı kredi tüketmeyen etkinlik katılımı

“Pratik” etkinlik adıdır, ayrı modül değildir; mevcut etkinlik modeli kullanılır. Paket, kapsamındaki etkinlik tarihinde geçerli **ve kullanılabilir ders hakkına sahip** olmalıdır. Süre veya kullanılabilir hak hangisi önce biterse uygunluk kapanır. Kayıt yalnız etkinlik kontenjanında yer ayırır; ders kredisini reserve/consume etmez, ayrı etkinlik hak sayacı zorunlu değildir. Yoklama ders bakiyesini değiştirmez. Tenant paket ders sayısı/süresi genel default değildir.

Uygunluk güncel paket/kapsam/bakiye/geçerlilikten hesaplanır; her paket hareketinde bütün kayıtlara durum kopyalanmaz. Kayıt ve katılım kapılarında atomik tekrar kontrol yapılır. Tüketim/iade, süre değişimi, dondurma/sonlandırma ve yeni uygun paket sonucu etkiler.

Kayıttan sonra uygunluk kaybedilirse kesin kayıt ve yer otomatik iptal edilmez; **Katılım koşulu sağlanmıyor** uyarısı gösterilir. Katılım anında uygun paket yoksa ücretsiz katılım onaylanmaz. Koşul yeniden sağlanınca katılım mümkün olur. Gerçekte katılmış kişinin yoklama gerçeği silinmez; uygunsuz katılım ayrıca işaretlenir. Mevcut borç/negatif kredi ve iptal/iade kuralları korunur.

Süresiz program veya “sonraki hafta” ek Pratik süresi bu kapsamın gereksinimi değildir. Instagram/Facebook/Google reklam alımı sosyal login değildir; Instagram ile giriş/kayıt/hesap bağlama kapsam dışı kalır.
