# P01 — talep, rezervasyon ve bekleme devri

## P01-B ilk hedefli kabul hatası ve odaklı düzeltme

Kaynak `7ef51f2b3c6b791eec27acbfb648b7c23b6e2b74` / [run 39317251796](https://github.com/SXQHex/FtkSaaS/actions/runs/39317251796) başarısızdır. 31 migration uygulandı, 120 yapı/politika ve 27 DB testi geçti; P01-A 10 test düğümü geçti. P01-B hazırlığı discipline_save_v1 isteğine merkez kapsamı eklediği için kapalı DTO VALIDATION_FAILED döndürdü; talep davranış alt vakalarına ulaşılmadı. Organizasyon disiplini fixture'ı açık org-only istek kullanacak şekilde düzeltildi. Runtime/DTO gevşetilmedi.

P01-A'nın aynı pg.Client üzerindeki Promise.all sayaç sorguları pg istemci deprecation uyarısı üretiyordu; sayaç okumaları sırayla await edilir. Gerçek yarış API istekleri paralel kalır. Yeni kaynağın hedefli runtime kabulü bekler. P01-C yedi API/worker açık; ara full clean/merge yoktur.


## B uygulama dilimi — runtime kabulü bekliyor

A için b8d9adcff3607d7e055c5c71a9d4f8d5ca3a6013 kaynaklı hedefli 39303865804 ve aday 39304797200 başarılıdır. Main 24007212005d07938fb1265a9f42891f18d7fa09; PR #22 draft tutulur. Son kullanıcı kararına göre P01 bütünü aynı feature dalında tamamlanır; ara clean/merge yok, commit başına hedefli test vardır. A clean'i B kaynağını doğrulamaz.

199 sözleşme / 111 geliştirme ortamında çağrılabilir / 88 contract_only / 31 migration. Altı lesson_request komutu create/withdraw/reject/offer_alternative/accept_alternative/approve uygulandı. Yeni ebeveyn/alternatif görünümü management_state_get_v1 selector'larıyla alınır; yeni liste API'si eklenmedi. Yerel generation/TypeScript ve 120 yapı/politika testi geçti; yeni runtime kabulü bekliyor.

- Bütün komutlar açık merkez kapsamı ister. Create dışındakiler ebeveyn lesson_request_id ve expected_version ister; alternatif seçimi ayrıca alternative_id alır. Okuma request_detail ve alternatives içinde sürümleri verir; cursor aktör/filtre/sort kapsamına bağlıdır. Canlı CM veya açık request.write/request.resolve staff yetkisi ilgili komuta göre denetlenir; öğrenci yalnız kendi talebini yazar.
- Talep ve alternatifler yer/kaynak/hak ayırmaz. Aynı açık talep yeni işlem anahtarıyla çoğaltılamaz. Alternatif seçmek kesin kayıt veya merkez onayı değildir. Değişiklikler ebeveyn satırı kilidi ve sürümüyle yarışır; eski sürüm reddedilir.
- Merkez onayı mevcut tam eşleşen özel seansa veya istenen zaman/disiplin için yeni özel seansa bağlanır. Mevcut session_create/reservation_create yazarları kullanılır; plan, kaynak, kapasite, pencere, katılım ve hak guardları yeniden çalışır. Başarılı rezervasyon ve talep durumu atomiktir; geç hata yeni seans, kaynak, hak, receipt/audit dahil bütün iç adımları geri alır.
- Dar P05 bağımlılığı mevcut yayımlanmış reservation belge gerekliliklerini ve hedef kişinin kabul kanıtını tüketir. Belge yükleme/yayımlama/kabul API'leri P05'te açıktır; bu dilimde tamamlanmış sayılmaz.
- Sayısal talep TTL'i uydurulmadı. expires_at doluysa geç onay/alternatif yazması reddedilir; otomatik expiry/worker P01-C'de açıktır. C: waitlist_join/leave, seat_offer_accept/reject/issue/expire, request_expire ve gerçek dar sistem kimliği/claim/lease/tekrar yolu.

Kaynak kabulü: tests/p01-lesson-requests.test.mjs. SQL çalışma zamanı henüz GitHub hedefli kabulü bekler; static testler runtime passed değildir. Hosted güncelleme, frontend veya production dağıtımı yapılmadı.

## Önceki A uygulama ve teşhis kayıtları

# P01-A — katalog ve seans bağlamında satın alınmış hak okuması

Başlangıç main: 9ce0a5639417f959111b11f70157156733e3de18. Aynı SHA [main clean 39252687560](https://github.com/SXQHex/FtkSaaS/actions/runs/39252687560) başarılı; PR #21 kabul kurtarması kapalıdır. Eski PR #20'nin belge istisnası runtime'a taşınmadı. Bu başarı yeni kaynak kabulü değildir.

Güncel kabul tabanı: main 24007212005d07938fb1265a9f42891f18d7fa09 ve [main clean 39298247595](https://github.com/SXQHex/FtkSaaS/actions/runs/39298247595) başarılı: 409 test, sıfır annotation warning/error ve merged-candidate relation. PR #23 Node24 Action bakımı kapalıdır. Eski P01 head 580239075b16f6ac6893d5ac01975d32133d0757 / run 39281409902 119 yapı/politika + 27 DB + 51 API geçti; ilk hata-kodu ve ortak saat bağımlı kota fixture hataları o kaynakta kapanmıştır. Mevcut PR #22 aynı main ile birleştirilir; yeni kaynak kabulü yeniden doğrulanır.
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

## İlk geliştirme CI sonucu ve düzeltme

PR #22 head 635e148651b2a85b18f5d40fe1fdea938ea94bf2 için run 39270054878 başarısızdır. 30 migration, yapı/DB ve diğer runtime vakaları geçti; P01-A'nın sekiz alt vakası geçti, son Auth oturum geri alma vakası mevcut Edge AUTH_REQUIRED döndürürken SESSION_REVOKED bekledi. Bu sonuç P01-A'nın tüm kabulü değildir.

Test iki reddi ayırır: aktif Auth altında uygulama hesabı deletion_pending olduğunda RPC SESSION_REVOKED verir; Auth oturumu silindiğinde provider'ın erken AUTH_REQUIRED reddi veya RPC'nin SESSION_REVOKED reddi kabul edilir, başarı asla kabul edilmez. Uygulama davranışı değiştirilmedi. [Teşhis](../reports/p01-a-targeted-diagnosis.json).

Aynı doğal düzeltme diliminde seçici kaynak farkı kanıtıyla bu modülü ve ortak regresyonu seçer (13 dosya yerine 2); yeni modül önce çalışır. Bilinmeyen/paylaşılan değişiklikler ve aday/main full clean korunur. Yeni head'in runtime sonucu bekleniyor; gerçek hızlanma henüz ölçülmedi. P01'in diğer 13 API'si açık kalır.

## İkinci geliştirme log kanıtı — saat bağımlı ortak fixture

Kaynak 85e25ec48cfc8f204392a757d333e284b02b6149, run [39278529991](https://github.com/SXQHex/FtkSaaS/actions/runs/39278529991), job 118148506287 logları: P01 10/10, DB 27/27, yapısal 96+23 geçti. Ortak API suite 41 düğümden 39 başarılı/2 başarısız (parent+child, tek assertion): weekly quota testinde ikinci kayıt beklenmedik şekilde kabul edildi. Logun sonu exit 1 ve cleanup içerirken run metadata hâlâ in_progress gösterdi; kuyruk/runner durumu tek başına test sonucu kabul edilmez.

Kök neden genel Date.now/slot fixture'ının 14 ve 15'inci slotlarının Europe/Istanbul'da 30 Eylül gecesi ile 1 Ekim başına düşmesi; 1 Ocak satış başlangıcına bağlı ayrı yedi günlük kotalarda ikisinin kabulü doğrudur. Ortak test aynı ilk kota haftasında 2 Ocak 09:00/11:00 UTC zamanlarına sabitlendi; 9 Ocak'ta bağımsız kota kabulü de kontrol edilir. Kota/runtime/sözleşme değişmedi. Yeni head runtime kabulü, son aday ve main clean hâlâ bekliyor. Kullanıcının yeniden tetiklemesi için gönderilen 09c9cc3 boş commit'i aynı kaynak tree'sidir; onun metadata'sı da önceki kaynağa yeni kabul sağlamaz. Aynı tree'nin run 39280209729 / job 118152807472 logu da 15:44:08–15:49:07 UTC arasında yaklaşık 4:59 yürütme ve aynı tek kota assertion hatasını doğrular; P01 10/10 geçmiştir.
