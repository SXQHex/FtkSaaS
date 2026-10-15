# FtkSaaS — Q-D01 kabul kararı

Tarih: 15 Ekim 2026. Durum: Kullanıcı tarafından kabul edildi; teknik aktarım bekliyor.
Dayanak: v2.2 D01–D09 ve U01–U08; 2.2-tech.1 paketindeki Q-D01 açığı.

## Kabul edilen davranış

1. Etkinlik tek disiplinli, çok disiplinli veya disiplinsiz olabilir. Disiplin etiketleri tanıtım ve filtreleme içindir; tek başına paket kullanım yetkisi oluşturmaz.
2. Paketle katılımda ders/etkinlik uygunluğu ayrıca açıkça tanımlanır. Etkinliğin Salsa etiketi taşıması, Salsa paketini kendiliğinden geçerli yapmaz.
3. Tek disiplinli etkinlikte, etkinliğe uygun ve ilgili merkez/disiplini kapsayan dar paketler kullanılabilir. Etkinliğe uygun geniş paketler de mevcut kapsam kurallarına göre kullanılabilir.
4. Çok disiplinli veya disiplinsiz etkinlikte yalnız etkinliğe uygun merkezin tamamı (center_all_disciplines) veya organization_all kapsamlı paketler kullanılabilir. center_discipline ve organization_discipline kapsamları kullanılamaz.
5. Etkinliklerde negatif kredi kullanılmaz. Paketle katılımda yeterli kullanılabilir hak bulunmalıdır; aynı hak eşzamanlı işlemlerde ikinci kez kullanılamaz.
6. Manuel ödeme ve etkinliğe özel satış kuralları korunur. Bu karar tahsilat ile kredi üretimini birleştirmez ve yeni bir ödeme zorunluluğu tanımlamaz.
7. Organizasyon izolasyonu, merkez erişimi, kapasite, geçerlilik ve mevcut katılım/iptal/kapanış koşulları korunur. Geniş kapsamlı paket toplam ortak havuzunu kullanır; disiplin başına hak çoğaltılmaz.

## Teknik sohbete aktarılacak işler

- Etkinlik–disiplin ilişkisini sıfır/bir/çok disiplin destekleyecek şekilde fiziksel şema, API ve okuma/yazma tiplerine aktar.
- Disiplin kimliklerinin aynı organizasyona ait olduğunu doğrula.
- Paket uygunluğunu etkinliğin disiplin sayısı ve yukarıdaki kapsam matrisiyle eşleştir; etiket eşleşmesini tek başına izin sayma.
- Etkinlik kayıt/önizleme/uygunluk yollarında negatif kredi üretimini engelle; yetersiz hakkı mevcut hata sözleşmesiyle uyumlu biçimde reddet.
- Q-D01'i ürün kararı açısından kapat; migration, API, tip ve gerçek backend testleri bitene kadar teknik aktarımını açık tut.
- Güncellenen ana sözleşmelere ve makine sözleşmesine bu kararı işle. Bu ek belge, mevcut dosyaların veya çalışan backend'in güncellendiği anlamına gelmez.

## Kabul senaryoları

| Senaryo | Beklenen sonuç |
|---|---|
| Tek disiplinli Salsa etkinliği + Salsa kapsamlı, etkinliğe uygun paket | Diğer koşullar ve yeterli hak sağlanırsa kullanılabilir. |
| Tek disiplinli Salsa etkinliği + yalnız normal derse uygun Salsa paketi | Kullanılamaz. |
| Salsa–Tango etkinliği + dar Salsa paketi | Kullanılamaz. |
| Salsa–Tango etkinliği + etkinliğe uygun center_all_disciplines paketi | Merkez ve diğer koşullar uygunsa kullanılabilir. |
| Disiplinsiz etkinlik + etkinliğe uygun organization_all paketi | Diğer koşullar uygunsa kullanılabilir. |
| Etkinlik + yetersiz hak + normal dersler için izinli negatif limit | Negatif krediyle kayıt yapılamaz. |
| Son ortak hak için eşzamanlı iki etkinlik kaydı | Hak ikinci kez ayrılamaz. |
| Başka organizasyona ait disiplin kimliği | Reddedilir. |

Frontend tasarım kararı alınmadı. Şema/API/RPC uygulaması bu belgede yapılmadı.
