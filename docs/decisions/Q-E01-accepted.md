# FtkSaaS — Q-E01 kabul kararı

Tarih: 16 Ekim 2026. Durum: Kullanıcı tarafından kabul edildi; ana sözleşme ve teknik aktarım bekliyor.

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

## Teknik aktarım ve doğrulama görevleri

1. Ödeme hazırlığı, etkinlik borcu, tahsilat dağıtımı ve kesin kayıt bağlantısını fiziksel şema/API/ortak tiplere aktar. Mevcut finans modülünü kullan; paralel ödeme sistemi oluşturma.
2. Tam ödeme koşulunu istemci beyanından değil etkinliğe bağlı güncel finans kayıtlarından doğrula.
3. Kapasite ve ödeme kontrollerini kesin kayıtla atomik yürüt. Aynı hazırlık/ödeme ikinci kesin kaydı finanse etmesin; retry ikinci borç, tahsilat, kayıt veya alacak üretmesin.
4. Kontenjan doluluğunda hazırlığın kapanması, borcun ters kaydı ve öğrenci alacağının oluşmasını tutarlı, izlenebilir işlemle uygula. Başarısız kesin kayıt nedeniyle finansal düzeltmelerin yanlışlıkla rollback edilmediğini doğrula.
5. İşletme iptalini mevcut önizleme/uygulama akışına bağla. Önizlemede kalan borç, oluşacak alacak ve serbest bırakılacak haklar görünür olsun; değişen bağımlılıklarda yeniden önizleme gereksinimini koru.
6. Kısmi/tam ödeme, yanlış borca dağıtılmış ödeme, son kontenjan yarışı, yinelenen istek, önceki iade/indirim, paket hak serbest bırakma, tenant ve merkez yetkisi senaryolarını gerçek backend üzerinde test et.
7. Ana sözleşmeler ve makine sözleşmesinin güncellenmesi ile gerçek testler bitmeden teknik aktarımı tamamlandı sayma.

Q-D01 etkinliklerde negatif kredi yasağı korunur. Frontend tasarımı bu kararın kapsamında değildir. Bu ek belge çalışan backend'in veya önceki paket dosyalarının güncellendiği anlamına gelmez.
