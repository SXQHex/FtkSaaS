# P01-A — katalog ve seans bağlamında satın alınmış hak okuması

Başlangıç main: 9ce0a5639417f959111b11f70157156733e3de18. Aynı SHA [main clean 39252687560](https://github.com/SXQHex/FtkSaaS/actions/runs/39252687560) başarılı; PR #21 kabul kurtarması kapalıdır. Eski PR #20'nin belge istisnası runtime'a taşınmadı. Bu başarı yeni kaynak kabulü değildir.

P01 üç inceleme dilimiyle ilerler: A katalog/hak okuma bağımlılığı; B talep/alternatif/onay ve sürüm okumaları; C bekleme/yer teklifi ve gerçek worker işletimi. A geliştirme kapsamı 199 sözleşme / 105 çağrılabilir / 94 contract_only / 30 migration'dır. Yeni kaynak hedefli doğrulama, bağımsız son-head incelemesi ve aday/main kabulü bekler. P01 bütünü tamamlanmadı.

- products_list_v1 yalnız katalogdur: yetkili satış merkezlerinin aktif ürünleri, backend zamanında etkin son sürüm, created_at/id sırası, aktör/filtre/sort bağlı cursor. F15 temel kapı; include_timed_products:true ayrıca F16 ister. Varsayılan kredili ürünlerdir.
- entitlements_get_v1 optional session_id, booking_mode ve include_timed_rights alır. session_id verildiğinde istenen merkez seansla eşleşir; seans anında geçerlilik, lesson_scope_matches ve available_for kullanılır. Sıra valid_until (null en son), created_at, id; reserve_right yazma sırasıyla aynıdır.
- Katalog ProductView.version_id ürün sürümüdür, rezervasyon source_sale_id değildir. Hak okumasındaki sale_id gerçek kaynak satıştır. available_at_session yalnız seans bağlamında bulunur; süreli sınırsızda 1 kernel uygunluk göstergesidir, sayısal kredi bakiyesi değildir. Pool scope başına çoğaltılmaz.
- Öğrenci kendi haklarını okur. Başkası için seans bağlamında Owner/OM veya hedef kişinin hizmet merkezi ilişkisiyle canlı CM/reservation.write staff yetkisi gerekir. Seanssız CM okuması başka merkez satış/deficit toplamlarını açmaz. Çıplak staff ve pasif öğrenci katalog yetkisi kazanmaz; canlı rol/bağlantı/oturum geri alması uygulanır.
- Okuma rezervasyon kabul önizlemesi değildir. Kapasite, belge, canlı katılım/borç, plan, sınıf ve kaynak koşulları yazma anında yeniden denetlenir; okuma yer/hak/receipt/audit/outbox oluşturmaz. Eşzamanlı tüketim sonucu eskitebilir.
- include_timed_rights:true ayrıca F16 ister; varsayılan kredili haklardır. booking_mode filtresi session_id ister. Cancelled/occurred seans için yeni hak seçimi dönmez.
- Hosted backend güncellenmiş sayılmaz. Kalan 13 P01 komutu, gerçek worker claim/lease/scheduler, belge kabul tüketicileri ve tam talep/bekleme akışı açıktır. Yeni ürün davranışı veya sayısal politika değeri eklenmedi.

Kaynak testleri: tests/p01-catalog-entitlement-reads.test.mjs. Geliştirme testleri ve son kaynak kabulü ayrı raporlanır; pending doğrulama passed değildir.

Katalog adı mevcut products.name kimlik alanından gelir. Mevcut product_publish güncellemesi farklı bir terms.name saklamaz; yeni okuma bunu yeniden adlandırma yetkisine dönüştürmez. Fiyat/hak/kapsam etkin sürümden gelir; satışın sürüm bağı değişmez.

Altyapı sınırı: Upstash Box aylık compute kotası doldu (5 CPU-saat); checkpoint alındı ve aynı kaynak yerelde yeniden kuruldu. Yerel Supabase bileşen indirmesi DNS/ağ hatası nedeniyle başlatılamadı. 110 yapısal test geçti; Auth/API davranış testleri GitHub geliştirme doğrulamasında bekliyor. Tam aday clean tetiklenmedi.
