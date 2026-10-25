# P01 — talep, rezervasyon ve bekleme devri

25 Ekim güncel ürün hedefi: [tek oda/seans/kategori kapasitesi ve ayrı kontrollü aşım](../contracts/02-FtkSaaS-teknik-sozlesme.md#oda-seans-kapasite-karari). Yayımlanmış main200/59 DTO'ları ile PR45 adayı201/60 ayrıdır. PR45 bağımsız inceleme ve aday40164825351 başarılı; merge/main/CD bekler. Bu modülün eski test/alan adları kendi tarihsel runtime kaydını anlatır, yeni ürün kuralı değildir.

23 Ekim: P01 tamamlanmıştır. Toplam yayımlanmış kapsam 200 API/59 migration; P01 dedicated worker kurulumu ve gerçek organizasyona scope bağlama tamamlandı, boş kuyrukta idle heartbeat doğrulandı. Gerçek talep/teklif iş yükü ve ölçek kabulü bu kurulumdan çıkarılmaz. Kaynak kanıtı [güncel devirde](../contracts/00-FtkSaaS-yeni-sohbet-devir.md).

## 20 Ekim 2026 — P01 kaynak kabul kaydı

Uygulama kaynağı main `7577b2f1873c6b1fcf83390bfa94a34374c44082`, [PR #22](https://github.com/SXQHex/FtkSaaS/pull/22); aday head `97f0b46d2277791339398aa47a1882630787dba9`. Envanter **199 sözleşme / 118 çağrılabilir / 81 yalnız sözleşme; 34 migration**. Çağrılabilirlik bütün ürün/hosted/production kabulü değildir.

- [Son head hedefli CI 39325878582](https://github.com/SXQHex/FtkSaaS/actions/runs/39325878582): başarılı; 218 test düğümü (120 yapı/politika + 27 DB + 71 API); bu dağılım hedefli koşuya aittir.
- [Bütün P01 aday full clean 39327134872](https://github.com/SXQHex/FtkSaaS/actions/runs/39327134872): GitHub sonucu completed/success. [Aday kapısı 39327135216](https://github.com/SXQHex/FtkSaaS/actions/runs/39327135216): başarılı. PR son-head bağımsız inceleme kaydı aday hazırlığını onaylar; geliştirici/inceleme beyanı ile CI ayrı kanıtlardır.
- [Main clean 39401570751](https://github.com/SXQHex/FtkSaaS/actions/runs/39401570751) aynı main SHA’sında completed/success olarak doğrulandı; main-clean job’u ve Verify merged candidate relation adımı başarılıdır. Job süresi 39:00, test:clean adımı 38:37; run zaman aralığı 39:04’tür. P01 done; geçici kabul varsayımı kaldırıldı. Bu başarı sonraki kaynak SHA’sına taşınmaz.

P01'in talep→alternatif→merkez onayı→rezervasyon ve bekleme→FIFO yer teklifi→kabul/ret/expiry zinciri main'e alındı. Request-window/CM gerekçeli istisna, canlı worker merkez/plan erişimi, fenced lease/crash kurtarma ve yarış düzeltmeleri son hedefli kaynakta kabul edildi. Eski A/B/C “runtime bekliyor / merge edilmedi” ifadeleri aşağıda veya Git geçmişinde tarihsel teşhistir; güncel açık iş değildir.

Sıradaki iş **CI-02: dört bağımsız shard + Draft/development + yalnız-belge kabulü**, ardından P02. Yeni politika karar düzeyinde kabul edildi, workflow/merge kapısı uygulaması bekliyor. P01 için hosted worker kurulumu, frontend gerçek entegrasyonu, dış e-posta, yük/restore ve production kapsamı tamamlanmış sayılmaz.

[CI-02 kararı](decisions/CI-2026-10-20.md). Aşağıdaki kayıtlar kaynak tarihine göre okunur; son hedefli/aday kabulü geçmiş pending notlarını kapatmıştır.

<details>
<summary>P01 teknik uygulama ayrıntıları ve önceki teşhisler — tarihsel kaynak sırası</summary>

## 20 Ekim 2026 — son kapsam incelemesi düzeltmeleri

Kaynak `c62106b77717d6c1b1129fe7fa8eca6060d05826` / [hedefli CI 39323812801](https://github.com/SXQHex/FtkSaaS/actions/runs/39323812801) başarılıdır: 120 yapı/politika + 27 DB + 67 API test düğümü (P01 26, ortak 41), toplam 214. Worker CLI/loop, minimal DB yetkileri ve üç denemelik hata yolu bu kaynakta geçti; önceki Auth transport hatası kapandı. Bu başarı yeni kaynağa taşınmaz.

Bütün P01 son incelemesi iki sözleşme eksiği buldu; yeni append-only migration34 ile düzeltildi: ayrı request_window tüketicisi ve worker'ın canlı merkez erişimi. Yeni hedefli runtime kabulü bekliyor; full clean/merge/main kabulü yapılmadı. Güncel geliştirme envanteri 199 / 118 çağrılabilir / 81 contract_only / 34 migration.

Talep oluşturma, alternatif sunma ve alternatif kabulü etkin org/merkez request_window politikasını private.policy_at ile okur; eksik yapılandırma kapalıdır, açılış dahil/kapanış hariçtir. Mevcut kabul edilmiş yönetici süre istisnasının DTO karşılığı window_exception:true ve nonempty reason'dır: politika manager_exception izni + canlı CM yetkisi + açık seçim/gerekçe birlikte gerekir. Sırf CM olmak veya politika bayrağı tek başına bypass değildir; gerekçe mevcut audit'te tutulur, CM yetkisi receipt replay öncesi tekrar denetlenir. Rezervasyon onayı kendi reservation_window kapısını korur; geri çekme/ret gibi temizleme bu yeni niyet kapısından bağımsızdır. Yeni sayısal politika veya ürün yetkisi eklenmedi.

Worker yeni teklif için merkez erişimini discovery limitinden önce ve executor/replay'de yeniden denetler; kapalı/plan dışında merkezde yeni hold/bildirim oluşmaz. Expiry temizliği açık kalır. Claim sonrası merkez kapanırsa runner NOT_FOUND için o fenced lease'i bounded reclaim'e bırakıp diğer merkezleri işlemeye devam eder; gerçek worker yetkisi iptalinde durur. Testler ayrıca çökmüş running lease geri alma ve kabulden sonra geç gelen expiry sırasını, önceki expiry-kazanır vakasına ekler.


## P01-C worker transport düzeltmesi — hedefli kabul bekliyor

Kaynak `4e3c5f11bd70e0e99885beffa41849727f170379` / [run 39322550067](https://github.com/SXQHex/FtkSaaS/actions/runs/39322550067) başarısızdır. 32 migration ve 120 yapı/politika + 27 DB + önceki A/B'nin 17 API test düğümü geçti. C'nin sekiz alt vakası aynı worker giriş hatasında kırıldı: genel execute_operation fonksiyonunun auth.users türünü içeren DECLARE bölümü, worker yönlendirmesinden önce derlenir; dar DB worker rolünün Auth şema erişimi yoktur. Bu, C davranış kabulü değildir.

Runner ve worker kabul testleri doğrudan mevcut private.p01_worker_execute(operation,request,ids) girişini kullanır; parametreler bound SQL'dir. Mevcut org/rol/job/op/lease/payload ve replay kontrolleri korunur. Yeni append-only migration 33 worker'ın gereksiz insan dispatcher/named API wrapper EXECUTE ve core USAGE yetkilerini kaldırır. Auth erişimi veya tablo DML yetkisi verilmez; uygulanmış önceki migration'lar değişmez. Negatif privilege testi Auth/core/human dispatcher erişiminin kapalı kaldığını, gerçek CLI/loop testleri doğru yolu doğrular. Doğrudan private helper yetki hataları SQL exception'dır; insan Edge zarfıyla karıştırılmaz.

Envanter 199 / 118 çağrılabilir / 81 contract_only / 33 migration; üretilmiş katalogdaki worker transport açıklaması eşitlendi. Yeni runtime kabulü bekler; P01 son bağımsız inceleme ve toplu aday/main clean henüz yapılmadı.


## C uygulaması — yeni runtime kabulü bekliyor

P01-B kaynak `78d68653e903d9764264f1fe8d73dfb9d9de7f49` için [hedefli CI 39319195689](https://github.com/SXQHex/FtkSaaS/actions/runs/39319195689) başarılı: 120 yapı/politika + 27 DB + 58 API test düğümü (A/B 17, ortak 41); pg concurrent-query uyarısı logda yok. Bu sonuç yeni C kaynağına taşınmaz. P01-C yedi API, kapsamlı okuma ve gerçek worker runner uygulandı; yeni runtime kabulü bekliyor. Geliştirme envanteri 199 sözleşme / 118 çağrılabilir / 81 contract_only / 32 migration. P01 merge/main kabulü yok; bütün P01 sonunda toplu clean alınır.

- Bekleme girişi yer/hak ayırmaz; aynı açık kişi/seans kaydı farklı anahtarla çoğalmaz. Ayrılma ve teklif kabul/ret açık merkez, canlı kişi/CM veya reservation.write staff yetkisi ve expected_version ister. management_state_get_v1 waitlist/offer selector'ları kişi/seans kapsamında entry/offer sürümlerini döndürür; sayfa/cursor aktör ve filtreye bağlıdır.
- Worker FIFO joined_at/id sırasıyla nominal boş yer kadar teklif verir; aktif rezervasyon + süresi dolmamış teklifler ortak kapasitedir. Teklif hak ayırmaz. Kabul, aynı kilitte tutulan yeri mevcut reservation_create ile atomik değiştirir; plan/kaynak/pencere/katılım/hak ve mevcut belge kapısı yeniden çalışır. Geç hata teklif süresini değiştirmeden bütün iç sonucu geri alır.
- P01 ilk runtime'ında teklif süresi etkin waitlist_offer_minutes, yoksa eski30dk fallback'inden geliyordu. FD06 güncel ürün hedefinde açık kurulum zorunludur; bu belge/code baseline değişimi o hedefi uygulanmış yapmaz. Mevcut kulüp3600sn ayrı kurulumdur. Kayıt kapanışını ve seans başlangıcını aşmaz. Ret/expiry eski entry'yi kapatır; yeniden giriş yeni FIFO sonundadır. Seans iptali aktif teklifleri geri çeker ve yalnız bekleyen kayıtları da kapatır. Yeni seans iptal API'si P02'de kalır; temizlik mevcut cancelled durumunu tüketir.
- Request expiry yalnız kayıtlı expires_at veya talebin artık gerçekleştirilemeyecek istenen başlangıcı üzerinden çalışır; geçerli gelecek alternatif varken özgün saatin geçmiş olması tek başına kapatmaz. Yeni sayısal talep TTL'i türetilmedi; elapsed time yoklama/hak tüketimi değildir.
- Worker insan Auth/CM grantından türemez. `ftk_p01_worker` NOLOGIN rolü yalnız sınırlı RPC/private girişlerini çalıştırır; core/private tablo DML yetkisi yoktur. Ayrı LOGIN ve `private.p01_worker_scopes(db_role,org_id)` bağı yalnız güvenilir DB işletimiyle sağlanır. SECURITY DEFINER yalnız private, sabit search_path'li ve session_user + rol üyeliği + canlı org kaydı doğrulayan bounded iş kodundadır. API claim wrapper invoker'dır. İnsan Edge/service_role aktörü worker yetkisi kazanmaz.
- `scripts/p01-worker.mjs`: P01_WORKER_DATABASE_URL, P01_WORKER_ORG_ID ile çalışır; yönetici/service_role hesabını reddeder. `--loop` planlı tarama yapar; tek sefer yolu yalnız tanı/testtir. Varsayılan 5 saniye teknik tick, 60 saniye lease, her seferde tek claim, en fazla üç deneme; sonrasında failed. P01_WORKER_INTERVAL_MS test/işletim sıklığıdır, ürün süresi değildir. Sonradan gelen iş ve kontrollü duruş gerçek süreç testiyle hedeflenir; production kurulumu yapılmadı.
- Claim discovery bounded'dır, dedupe elemesi limitten önce yapılır. Açık kayıt penceresi ve toplam/kategori boşluğu aranır; mevcut politika fingerprint'e dahildir. İşin op/target'ı değişmez; lease hash ve işlem anahtarı bağlanır, eski token fencing uygulanır. Domain/worker receipt/audit/inbox/job sonucu atomiktir; hata domain'i geri alıp retry_wait/failed iş durumunu ayrı kaydeder. Scope iptali replay'de de geçerlidir. Failed işler kendiliğinden sonsuz yeniden üretilmez; kök neden düzeldikten sonra yetkili DB işletim incelemesi gerekir.

Yeni davranış kaynağı `tests/p01-waitlist-workers.test.mjs`: gerçek Auth→Edge→RPC ve ayrı DB worker kimliği, CLI/loop, FIFO, hak reddi rollback, reject/expiry/rejoin, scope/lease/replay, üç denemelik geç hata, iptal temizliği, 51 dolu ön ek ve pencere açılışı. Yapısal başarı runtime kabulü değildir. C hedefli test geçmeden P01 uygulama kabulü tamamlanmış sayılmaz; ardından son-head incelemesi/full clean/main kabulü gerekir. F01–F33 generated haritası özellik kabulünü pending tutar.

## Önceki dilim ve teşhis kayıtları


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


</details>

Kapasite incelemesi: worker no-offer işinin ardından oda fiziksel kapasitesinin yapılandırılması veya toplamı değiştirmeyen kategori doluluğu değişimi yeni keşif anahtarı üretir. İlk kaynak P2 bulgusu ve düzeltme testi [inceleme raporundadır](../reports/session-capacity-independent-review.md); önceki clean sonucu yeni kaynağa taşınmaz.
