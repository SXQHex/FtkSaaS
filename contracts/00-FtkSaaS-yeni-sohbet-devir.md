# FtkSaaS — güncel devir

## 20 Ekim 2026 — P01 birleşti; belge senkronizasyonu

Uygulama kaynağı main `7577b2f1873c6b1fcf83390bfa94a34374c44082`, [PR #22](https://github.com/SXQHex/FtkSaaS/pull/22); aday head `97f0b46d2277791339398aa47a1882630787dba9`. Envanter **199 sözleşme / 118 çağrılabilir / 81 yalnız sözleşme; 34 migration**. Çağrılabilirlik bütün ürün/hosted/production kabulü değildir.

- [Son head hedefli CI 39325878582](https://github.com/SXQHex/FtkSaaS/actions/runs/39325878582): başarılı; 218 test düğümü (120 yapı/politika + 27 DB + 71 API); bu dağılım hedefli koşuya aittir.
- [Bütün P01 aday full clean 39327134872](https://github.com/SXQHex/FtkSaaS/actions/runs/39327134872): GitHub sonucu completed/success. [Aday kapısı 39327135216](https://github.com/SXQHex/FtkSaaS/actions/runs/39327135216): başarılı. PR son-head bağımsız inceleme kaydı aday hazırlığını onaylar; geliştirici/inceleme beyanı ile CI ayrı kanıtlardır.
- [Main clean 39401570751](https://github.com/SXQHex/FtkSaaS/actions/runs/39401570751) aynı main SHA’sında completed/success olarak doğrulandı; main-clean job’u ve Verify merged candidate relation adımı başarılıdır. Job süresi 39:00, test:clean adımı 38:37; run zaman aralığı 39:04’tür. P01 done; geçici kabul varsayımı kaldırıldı. Bu başarı sonraki kaynak SHA’sına taşınmaz.

P01'in talep→alternatif→merkez onayı→rezervasyon ve bekleme→FIFO yer teklifi→kabul/ret/expiry zinciri main'e alındı. Request-window/CM gerekçeli istisna, canlı worker merkez/plan erişimi, fenced lease/crash kurtarma ve yarış düzeltmeleri son hedefli kaynakta kabul edildi. Eski A/B/C “runtime bekliyor / merge edilmedi” ifadeleri aşağıda veya Git geçmişinde tarihsel teşhistir; güncel açık iş değildir.

Sıradaki iş **CI-02: dört bağımsız shard + Draft/development + yalnız-belge kabulü**, ardından P02. Yeni politika karar düzeyinde kabul edildi, workflow/merge kapısı uygulaması bekliyor. P01 için hosted worker kurulumu, frontend gerçek entegrasyonu, dış e-posta, yük/restore ve production kapsamı tamamlanmış sayılmaz.

[CI kararı](../docs/decisions/CI-2026-10-20.md), [CI politikası](../docs/ci-policy.md), [üretim kuyruğu](../docs/production-queue.md), [kalan işler](../docs/remaining-work.md), [P01 teknik devri](../docs/p01-handover.md).

<details>
<summary>Önceki uygulama ve teşhis kayıtları — tarihsel</summary>

## 20 Ekim 2026 — son kapsam incelemesi düzeltmeleri

Kaynak `c62106b77717d6c1b1129fe7fa8eca6060d05826` / [hedefli CI 39323812801](https://github.com/SXQHex/FtkSaaS/actions/runs/39323812801) başarılıdır: 120 yapı/politika + 27 DB + 67 API test düğümü (P01 26, ortak 41), toplam 214. Worker CLI/loop, minimal DB yetkileri ve üç denemelik hata yolu bu kaynakta geçti; önceki Auth transport hatası kapandı. Bu başarı yeni kaynağa taşınmaz.

Bütün P01 son incelemesi iki sözleşme eksiği buldu; yeni append-only migration34 ile düzeltildi: ayrı request_window tüketicisi ve worker'ın canlı merkez erişimi. Yeni hedefli runtime kabulü bekliyor; full clean/merge/main kabulü yapılmadı. Güncel geliştirme envanteri 199 / 118 çağrılabilir / 81 contract_only / 34 migration.

Talep oluşturma, alternatif sunma ve alternatif kabulü etkin org/merkez request_window politikasını private.policy_at ile okur; eksik yapılandırma kapalıdır, açılış dahil/kapanış hariçtir. Mevcut kabul edilmiş yönetici süre istisnasının DTO karşılığı window_exception:true ve nonempty reason'dır: politika manager_exception izni + canlı CM yetkisi + açık seçim/gerekçe birlikte gerekir. Sırf CM olmak veya politika bayrağı tek başına bypass değildir; gerekçe mevcut audit'te tutulur, CM yetkisi receipt replay öncesi tekrar denetlenir. Rezervasyon onayı kendi reservation_window kapısını korur; geri çekme/ret gibi temizleme bu yeni niyet kapısından bağımsızdır. Yeni sayısal politika veya ürün yetkisi eklenmedi.

Worker yeni teklif için merkez erişimini discovery limitinden önce ve executor/replay'de yeniden denetler; kapalı/plan dışında merkezde yeni hold/bildirim oluşmaz. Expiry temizliği açık kalır. Claim sonrası merkez kapanırsa runner NOT_FOUND için o fenced lease'i bounded reclaim'e bırakıp diğer merkezleri işlemeye devam eder; gerçek worker yetkisi iptalinde durur. Testler ayrıca çökmüş running lease geri alma ve kabulden sonra geç gelen expiry sırasını, önceki expiry-kazanır vakasına ekler.


## P01-C worker transport düzeltmesi — hedefli kabul bekliyor

Kaynak `4e3c5f11bd70e0e99885beffa41849727f170379` / [run 39322550067](https://github.com/SXQHex/FtkSaaS/actions/runs/39322550067) başarısızdır. 32 migration ve 120 yapı/politika + 27 DB + önceki A/B'nin 17 API test düğümü geçti. C'nin sekiz alt vakası aynı worker giriş hatasında kırıldı: genel execute_operation fonksiyonunun auth.users türünü içeren DECLARE bölümü, worker yönlendirmesinden önce derlenir; dar DB worker rolünün Auth şema erişimi yoktur. Bu, C davranış kabulü değildir.

Runner ve worker kabul testleri doğrudan mevcut private.p01_worker_execute(operation,request,ids) girişini kullanır; parametreler bound SQL'dir. Mevcut org/rol/job/op/lease/payload ve replay kontrolleri korunur. Yeni append-only migration 33 worker'ın gereksiz insan dispatcher/named API wrapper EXECUTE ve core USAGE yetkilerini kaldırır. Auth erişimi veya tablo DML yetkisi verilmez; uygulanmış önceki migration'lar değişmez. Negatif privilege testi Auth/core/human dispatcher erişiminin kapalı kaldığını, gerçek CLI/loop testleri doğru yolu doğrular. Doğrudan private helper yetki hataları SQL exception'dır; insan Edge zarfıyla karıştırılmaz.

Envanter 199 / 118 çağrılabilir / 81 contract_only / 33 migration; üretilmiş katalogdaki worker transport açıklaması eşitlendi. Yeni runtime kabulü bekler; P01 son bağımsız inceleme ve toplu aday/main clean henüz yapılmadı.


## P01-C uygulama dilimi — runtime kabulü bekliyor

P01-B kaynak `78d68653e903d9764264f1fe8d73dfb9d9de7f49` için [hedefli CI 39319195689](https://github.com/SXQHex/FtkSaaS/actions/runs/39319195689) başarılı: 120 yapı/politika + 27 DB + 58 API test düğümü (A/B 17, ortak 41); pg concurrent-query uyarısı logda yok. Bu sonuç yeni C kaynağına taşınmaz. P01-C yedi API, kapsamlı okuma ve gerçek worker runner uygulandı; yeni runtime kabulü bekliyor. Geliştirme envanteri 199 sözleşme / 118 çağrılabilir / 81 contract_only / 32 migration. P01 merge/main kabulü yok; bütün P01 sonunda toplu clean alınır.

Sistem worker DB kimliği/claim/lease/tekrar ve kabul sınırları [P01 devrinde](../docs/p01-handover.md); seri üretimin sonraki adımı [kuyruktadır](../docs/production-queue.md). Aşağıdaki eski pending/hata notları ait oldukları önceki kaynakların kayıtlarıdır.

P01-B son hedefli kaynak 7ef51f2b3c6b791eec27acbfb648b7c23b6e2b74 / run 39317251796 başarısızdır: organizasyon disiplini fixture'ının fazladan center_id alanı DTO reddi verdi; B davranış vakaları başlamadı. 31 migration, 120 yapı/politika ve 27 DB testi geçti. Fixture ve pg sayaç sorgusu uyarısı odaklı düzeltildi; yeni head hedefli kabulü bekler. Runtime sözleşmesi gevşetilmedi; [teşhis](../docs/p01-handover.md).

## 19 Ekim 2026 — P01 ayrı dalda bütün olarak geliştiriliyor

Main `24007212005d07938fb1265a9f42891f18d7fa09` ve main clean [39298247595](https://github.com/SXQHex/FtkSaaS/actions/runs/39298247595) başarılıdır. Mevcut ayrı dal `feature/p01-request-reservation-flow`, draft PR #22 korunur; mükerrer dal/PR açılmaz. P01-A head `b8d9adcff3607d7e055c5c71a9d4f8d5ca3a6013` hedefli [39303865804](https://github.com/SXQHex/FtkSaaS/actions/runs/39303865804) ve aday [39304797200](https://github.com/SXQHex/FtkSaaS/actions/runs/39304797200) başarılıdır; henüz merge edilmedi. Bu başarı sonraki kaynak değişikliklerine taşınmaz.

Son kullanıcı kararı: her commit hedefli doğrulanır; ara P01 dilimlerinde aday clean/merge yoktur. Bütün P01 bittiğinde son-head bağımsız incelemesi, toplu aday full clean ve merge; ardından aynı main kabulü gerekir. P01 done değildir.

P01-B altı talep komutu, ebeveyn sürüm okumaları ve dar rezervasyon-belge tüketicisi uygulandı; geliştirme kaynakları 199 sözleşme / 111 çağrılabilir / 88 contract_only / 31 migration içerir. Yerel generation/TypeScript ve 120 yapı/politika testi geçti; yeni Auth→Edge→RPC kabulü bekliyor. B'nin çalışma zamanı kabulü veya main kurulumu tamamlandı sayılmaz. Kalan P01-C yedi bekleme/teklif/expiry API'si ve gerçek worker işletimidir. [Ayrıntılı devir](../docs/p01-handover.md).


## 19 Ekim 2026 — CI bakımı kapalı, P01-A yeni aday

PR #23 tek seferlik güvenilir workflow kurulumu kullanıcı onayıyla normal merge yolundan 24007212005d07938fb1265a9f42891f18d7fa09 main SHA'sına alındı. [Aynı main clean 39298247595](https://github.com/SXQHex/FtkSaaS/actions/runs/39298247595) başarılı: 409 test (110 yapı/politika + 27 DB + 272 API), sıfır annotation warning/error; Verify merged candidate relation başarılı. Aday clean 39282766184 ile main tree 2b7a76e73ca1e2efd201b0d9a18bea4afe12007b ve iki parent ilişkisi doğrulandı. Repository ayarı, sahte başarı status'u veya required-check bypass yapılmadı; tek seferlik kurulum yetkisi sıradan P01 kabulüne taşınmaz.

Mevcut PR #22 aynı main ile birleştirilir; Node24 Action pinleri ve deterministik ortak kota fixture'ı korunur. P01 önceki head 580239075b16f6ac6893d5ac01975d32133d0757 / hedefli run 39281409902: 119 yapı/politika + 27 DB + 51 API geçti. Bu eski head kanıtıdır; yeni birleşik head hedefli/son inceleme/adayı ve main kabulü bekler. P01-A uygulanmış, P01-B/C 13 API açık; P01 done değildir.

## P01-A başlangıç ve önceki geliştirme kanıtları

Main 9ce0a5639417f959111b11f70157156733e3de18 ve [aynı SHA clean 39252687560](https://github.com/SXQHex/FtkSaaS/actions/runs/39252687560) başarılıdır. PR #21 kurtarması kapandı; PR #20'nin eski başarısızlığı yeni kabul yerine sunulmaz.

[P01-A devri](../docs/p01-handover.md): katalog ve seans bağlamında satın alınmış hak okuması uygulandı. 199 sözleşme / 105 çağrılabilir / 94 yalnız sözleşme; 30 migration. Yeni kaynak hedefli test/son inceleme/adayı ve main kabulü henüz bekliyor. P01'in 13 komutu, gerçek worker ve talep/bekleme uçtan uca kabulü açık.

PR #22 ilk head 635e148651b2a85b18f5d40fe1fdea938ea94bf2, run 39270054878: başarısız. Tek başarısız alt vaka Auth reddinin hata-kodu beklentisidir; test ve hedefli seçim düzeltiliyor. [Teşhis](../reports/p01-a-targeted-diagnosis.json), [CI politika düzeltmesi](../docs/ci-policy.md). Yeni kaynak runtime kabulü ve aday/main clean henüz yoktur.

İkinci koşu 39278529991 / head 85e25ec48cfc8f204392a757d333e284b02b6149 logunda P01 10/10, DB 27/27, yapı 96+23 geçti; ortak API weekly quota fixture assertion'ı başarısızdır. Logdaki yürütme yaklaşık 3:34; metadata durum gecikmesi ayrı engeldir. Aynı satış haftasını garanti eden fixture ve sonraki hafta bağımsız kota kontrolü uygulandı; runtime değişmedi. [Güncel teşhis](../docs/p01-handover.md). Yeni head hedefli kabul ve aday/main clean bekliyor.

P01 öncesi snapshot:

Üçüncü teslimin uygulama kapsamı: **199 sözleşme / 104 çağrılabilir / 95 yalnız sözleşme; 90 core tablo / 29 migration**. [Hesaplaşma devri](../docs/settlement-handover.md) çalışan akışı ve kabul sınırlarını tanımlar. Son head incelemesi ve tam temiz CI aynı SHA için ayrıca doğrulanır; işlem sayısı ürün tamamlanma yüzdesi değildir.

Başlangıç main: `bd4b6335904047f071556e5df35a982a71012c6e`; [aynı SHA CI](https://github.com/SXQHex/FtkSaaS/actions/runs/39055469993) başarılıydı: 364 test, 28 migration. Bu eski başarı yeni teslimin CI kanıtı değildir. Son PR head/merge kanıtı PR üzerinde bağlanır. Hesaplaşma kaynak SHA’sı `3aa5effa0fe48ab7dc4c8d4ca97754b5392fa0ad` için [temiz CI](https://github.com/SXQHex/FtkSaaS/actions/runs/39198323012) başarılı: 394 test (95 yapısal/sözleşme + 27 DB + 272 Auth/API), 29 migration, seed/sağlık/advisors. Sonraki commit ve merge main CI ayrıca doğrulanır.

Starter anlaşmasız program/yoklama/koruma ve Pro/Business immutable anlaşma, açık başlangıç, hakediş/bağlı düzeltme korunur. Üçüncü teslim ayrı hesaplaşma ledger'ı, dokuz API, Owner/delege OM/CM grant zinciri, A başvurusu/B onayı ve ders/satış tüketicilerini ekler. [Anlaşma/hakediş devri](../docs/instructor-earnings-handover.md), [kalan işler](../docs/remaining-work.md), [entegrasyon devri](../docs/claude-handover.md).

Eğitmen ödeme komutları; otomatik başlangıç gözlemi, belge ve diğer hak değişikliği koruma tüketicileri açıktır. Dış e-posta ertelendi; frontend gerçek entegrasyonu ve yük/restore kanıtsız kapatılmaz. Production dağıtımı yapılmaz. Son açık kullanıcı kararı ve AGENTS.md kuralları geçerlidir.

## Tarihsel devir kayıtları

Aşağıdaki önceki teslim metinleri yalnız ait oldukları kaynak snapshot'ını anlatır. İçlerindeki “güncel”, “açık” veya “merge yetkisi” ifadeleri bugünkü durum/yetki değildir. Güncel durum yukarıda, açık işler bağlantılı listededir; tarihsel reports/ dosyaları değiştirilmez.

<details>
<summary>Önceki devir metinleri (tarihsel)</summary>

# Eğitmen anlaşması ve hakediş — güncel geliştirme kapsamı

Başlangıç main: `ab3fca4af47b71b34a4a7b6d0df5211ad1e41141`; [aynı SHA CI](https://github.com/SXQHex/FtkSaaS/actions/runs/39042108296) başarılı: 27 migration, 341 test. Yeni kaynak için önceki başarı taşınmaz; son head inceleme/temiz CI ve merge main CI ayrıca doğrulanır.

199 sözleşme, 95 çağrılabilir, 104 contract-only; 90 core tablo, 28 append-only migration. [Güncel anlaşma/hakediş devri](../docs/instructor-earnings-handover.md) yeni akışı ve sınırları tanımlar. Eğitmen ödeme komutları ve merkezler arası hesaplaşma runtime'ı bu teslim değildir. Önceki snapshot sayıları aşağıda tarihsel bağlamdır.

# DS-2026-10-17 — güncel sözleşme ve CI devri

## Starter yoklama/koruma teslimi — güncel kapsam

[Starter devri](../docs/starter-attendance-protection-handover.md) zorunlu bağımlılıkları ve kalan tüketicileri tanımlar. 198 işlem / 89 canlı / 109 contract-only; 90 core tablo / 27 migration. Starter program → rezervasyon → etki/onay → korunan katılım → kapanış → gerekçeli düzeltme uygulanır. Ücretli finansal kapanış açıkça kapalı; başlangıç/belge ve diğer hak değişikliği tüketicileri pending. Son SHA’nın kanıtı PR’dedir; eski başarı taşınmaz.

Doğrulanmış başlangıç: main `5265a70a0d29f91b9081a1ecbc2a8f0ff78668ee`; [aynı SHA CI](https://github.com/SXQHex/FtkSaaS/actions/runs/39030586306) başarılı: 322 test, 25 migration. Bu teslim yeni Starter runtime ve 26–27. migration’ı ekler; 198 sözleşmeli işlem, 89 canlı / 109 yalnız sözleşme. Başlangıcın başarısı yeni head’e taşınmaz; son CI/inceleme PR üzerinde aynı tam SHA’ya bağlıdır.

[Karar sprinti devri](../docs/decision-sprint-handover.md), [kabul edilmiş kararlar](../docs/decisions/DS-2026-10-17.md), [F01–F33 haritası](../docs/feature-delivery.md), [main koruma denetimi](../docs/branch-protection-review.md). Yeni DS davranışları gerçek Auth → Edge → RPC kabulü bekler; sözleşme negatif testleri ve mevcut runtime regresyonu ayrı kanıttır. Son revizyon: docs/decisions/DS-2026-10-17-settlement-center-scope.md; kaynak/kanıt raporu: reports/settlement-center-scope-verification.json; son PR head inceleme ve tam temiz CI ayrıca doğrulanır.

Mevcut runtime anlaşma/plan/koruma farkları açıkça delivery_gaps olarak kaydedildi. DS-OPEN-01 grantor konusu son revizyonla karar düzeyinde kapalıdır: Owner delege OM iznini yönetir; Owner veya delege OM merkez CM grantını yönetir. B onayı kayıt/bakiyeyi atomik kesinleştirir; ayrı OM kayıt adımı kaldırıldı. DS-OPEN-02 son merkez yetki düzeltmesiyle karar düzeyinde kapalıdır: aynı hesap gerekli A/B merkez yetkileriyle iki adımı yapabilir; A-only yetki B onayı sağlamaz. Audit her adımın merkez/rol/grant kapsamını kaydeder, fallback yoktur. Runtime pending. Klasik main koruması API 403 nedeniyle doğrulanamıyor; rulesets boş, yönetim yazması yapılmadı. PR #13 tarihsel merge yetkisi bu yeni PR’yi kapsamaz; repository yönetimi ayrı iştir; frontend, production ve Resend'e müdahale edilmez.

---

Aşağıdaki önceki teslim kapsamları kendi kaynak snapshot’larıdır; güncel açık iş olarak yorumlanmaz.

# FtkSaaS — güncel başlangıç

Takvim/seans/rezervasyon okuma geliştirme kapsamı: **72/112**, 24 migration. [Okuma devri](../docs/schedule-read-handover.md); ürün kataloğu/uygun hak seçimi ayrı açık iştir. Son head CI ayrıca doğrulanır. Aşağıdaki 69/115 ve PR #8 sayıları tarihsel snapshot'tır.

Uygunluk/politika geliştirme kapsamı: **69/115**, 23 migration. [Güncel entegrasyon devri](../docs/claude-handover.md) bu dört işlemin sürüm/yetki/tüketici sınırlarını ve açık bağımlılıkları tanımlar. Bu yeni kaynak kabulü son PR/main SHA CI sonucundan ayrıca doğrulanır. Aşağıdaki PR #8 kanıtı tarihsel başlangıçtır.

Önce [kaynak indeksi](../docs/source-index.md), [AGENTS](../AGENTS.md), [kalan işler](../docs/remaining-work.md) ve [entegrasyon devrini](../docs/claude-handover.md) okuyun.

## Doğrulanmış başlangıç — 17 Ekim 2026

Kaynak main `b9bd9c110f0cf4a121eac6ef0752945de99b10ac`; [PR #8](https://github.com/SXQHex/FtkSaaS/pull/8) birleşmiş; [aynı SHA’nın main CI’ı](https://github.com/SXQHex/FtkSaaS/actions/runs/38993548576) başarılı. 22 migration, 181 test (12 sözleşme + 27 DB + 142 Auth/API); 184 operasyonun 65’i çalışan geliştirme uygulaması, 119’u yalnız sözleşme. Bu kanıt belirtilen kaynak içindir; sonraki commit’in CI sonucu ayrıca doğrulanır.

Uzak geliştirme/test Auth → Edge → RPC smoke [ayrı rapordadır](../reports/remote-backend-verification.json); 181 testin uzak projede tekrarı değildir. Geçici fixture temizlendi; ortak tenant/kullanıcı girişi sağlanmadı. Dış e-posta ertelendi; Resend entegrasyonu başlatılmayacak. Yük/restore ve frontend gerçek entegrasyon kabulü açık; production dağıtımı yok.

Q-D01 atomik kayıt/ortak hak yarışları ve fiilî başlangıç kayıt/düzeltme artık uygulanmıştır; aşağıdaki eski açık ifadeleri güncel açığa dönüştürmeyin. D01–D09, U01–U08, Q-D01, Q-E02, Q-E03 hükümleri korunur.

## Tarihsel devir ve kabul metinleri

Aşağıdaki metin önceki teslimlerden korunmuştur. “Güncel” başlıkları, eski sayılar ve kurulum/uygulama açıkları kendi tarihine aittir; bugünkü durum yukarıdaki kaynaklar ve yeni SHA’nın kanıtıyla belirlenir. Sonraki kabul yalnız çelişen hükümleri değiştirir.

> **Güncel ek: Q-E03.** Parasal iptal sınırı planlanan başlangıçtır (eşitlik dahil sonrası). Q-E02 merkez iptali korunur. Teknik durum: docs/decisions/Q-E03.md; test/CI kanıtı ayrıca doğrulanır.

# FtkSaaS —Yeni sohbet devir paketi

> **Güncel öncelik: Q-E02 · 0.2.0-rc.3.** Kullanıcının 16 Ekim 2026 son iptal kabulü önceki çelişen merkez iptali hükümlerinin yerine geçer. Güncel davranış/kanıt: docs/decisions/Q-E02.md, docs/claude-handover.md ve reports/qe02-verification.json. Aşağıdaki eski durum/test sayıları tarihsel kayıttır; teknik aktarım bekleyen işler tamamlandı sayılmaz.

> **Güncel 2.2-tech.2 / Q-D01:** Etkinlik 0/1/çok disiplin etiketini destekler. Tek etikette etkinliğe uygun dar/geniş paket, 0/çok etikette yalnız uygun geniş paket; etkinliklerde negatif kredi yok. Q-D01 ürün kararı kapalı, tam olay kayıt/RPC entegrasyonu ve son ortak kredi yarışı açık. Güncel durum 11-FtkSaaS-Q-D01-teknik-aktarim-raporu.md.

> **Güncel teknik uygulama kaydı — 2.2-tech.1, 15 Ekim 2026:** D01–D09/U01–U08, 04–08 kataloglarına ve ortak tiplere aktarıldı. İki migration izole geliştirme DB’sinde uygulandı. Aşağıdaki eski “kod/kurulum yapılmadı” ve “teknik aktarım bekliyor” ifadeleri tarihsel kayıt olarak okunur. İş RPC’leri, ayrıntılı izin RLS politikaları ve gerçek iş akışı kabul testleri açık; Q-D01 yeni ürün kararı bekliyor. Güncel durum 09 teknik aktarım raporundadır.

> Güncel UUID üretim standardı: U01–U08, UUIDv7. Sağlayıcı kimlikleri korunur.

> Güncel ek: D01–D09 disiplin revizyonu kabul edilmiştir; aşağıdaki tarihsel teknik tamamlanma ifadeleri yeni kapsamı içermez. Ayrıntı ve açık teknik aktarım listesi belgenin sonundadır.

15 Ekim2026 · v3.0 · Karar turu ve yazılı teknik sözleşme tamamlandı; kod/üretim uygulanmadı.

## Kaynaklar ve sıra

Kullanıcının son açık kararı üstündür.01 ürün kapsamı,02 kabul edilmiş iş/teknik davranışı,03 çalışma yetkisi,04–08 teknik sözleşme ve doğrulama envanteridir. Eski sohbete/eski studioSaaS’a ihtiyaç yoktur. Alt belgeler üst kabulü sessiz değiştiremez. Fiyat/limit bilinmiyorsa değer uydurulmaz.

| Dosya | Sürüm / rol |
|---|---|
|01-FtkSaaS-urun-kapsam-sozlesmesi.md |2.0;14 modül/33 özellik ve plan dağılımı, son ürün kararları |
|02-FtkSaaS-teknik-sozlesme.md |2.0;T01–T12 ve O1–O4 iş kararları;23 son düzeltmeler |
|03-FtkSaaS-kodlama-sorumluluklari.md |1.0;ChatGPT backend, Claude frontend; branch/PR/merge/üretim yetkileri |
|04-FtkSaaS-O4-veri-semasi.md |1.0;85 tablo tasarımı, alan/FK/kısıt/indeks/kilit/RLS hedefleri |
|05-FtkSaaS-O4-API-katalogu.md |1.0;174 operasyonun insan okunur indeksi/atomiklik/guardlar |
|06-FtkSaaS-O4-durum-hata-izin.md |1.0;durum, alan/rol ve sabit hata sözlüğü |
|07-FtkSaaS-O4-denetim-ve-aciklar.md |1.0;K bulguları kapanışı,31 belge/tip kontrolü,55 uygulanacak kabul senaryosu |
|08-FtkSaaS-tip-ve-operasyon-sozlesmesi.json |1.0;665 kapalı tip/şema,operation→request/response/error/permission/transition/transaction/guard/senaryo eşlemesi |

## Değişmez yön

FtkSaaS bağımsız yeni proje; eski studioSaaS repository/tablo/kod/kural/garantileri incelenmez, devralınmaz, karşılaştırılmaz, yamalanmaz. Supabase başlangıç Free hedefi; ortak multi-frontend backend, ilk istemci mobil web/PWA. RPC iş kuralları, Edge dış servis/gizli işler, her RPC’ye Edge zorunluluğu yok. Tek yeni repository; adres/framework/hosting henüz seçilmedi.

Frontend ekran/görsel/kullanıcı akışı/kod Claude; ChatGPT frontend’e müdahale etmez. Backend/sözleşme/izin/veri/RPC/Edge/test ChatGPT. Ortak tipler08’den üretilecek; mock gerçek entegrasyon değildir. Modeller ayrı branch/PR. Kod görevi verilince kendi alanında çalışabilir; somut merge/üretim kullanıcı onayı, destructive üretim ayrıca kapsamlı onay gerektirir. Mevcut belgelerin hazırlanması kodlama emri değildir.

## Son kararlarda kaçırılmaması gerekenler

- Hesap orglar arası ortak, kişi orga ait; e-posta identity değildir. Hesapsız kişi/görev/öğrenci kaydı işletilir. Mevcut kişiye hesap erişimi gönderilir, yeni org daveti ayrı özellik diye icat edilmez. İlk bağ student-self; privileged login grant ancak sonra. Offline görev otomatik login grant olmaz.
- Owner yalnız FtkSaaS atar/kaldırır. Owner CM değilse invite/tahsilat/rezervasyon yapamaz; merkez kurar/self-CM atar, sonra operasyon. Diğer CM atayıp öz CM rolünü owner yetkisiyle kaldırır. Müşteri owner devredemez. Org-manager eski self-center atama hakkı ve owner’ın org-manager yönetimi korunur.
- İlk ödeme doğrulaması dönem+operasyon başı; ödeme öncesi kuruluş/ödeme/center+self-CM, trial/ilk-payment grace yok. Yenileme gecikmesi ilk7gün matris, sonra bütün hizmet kapalı/owner subscription. Downgrade dönem sonu/veri korunur; Business merkez seçimi zorunlu.
- Reservation atomik yer+hak. Nominal esnek/offer, maksimum priority; ortak toplam. Allocation consume değil; taslak attendance consume etmez; close atomik hak+earning+outbox. Assistant-participant iki yönlü conflict.
- Negative izinli limit reserved+consumed ortak, kişisel override default yerine/mandatory upper. Başlangıç limit aşımı blocked, bu katılımdan yüzde/kişi earning yok; geç ödeme geçmişi değiştirmez. Gerçekleşen seans sabiti korunur; gerçekleşmeyen özel seans0. Kaynak satışsız izinli negative için merkez değeri reservation snapshot; yeni sale eski earning’i değiştirmez veya ek nakit borcu doğurmaz.
- Satış start/end tarihleri açık girilir, center00:00 snapshot→UTC, start dahil/end hariç. End son kullanım günü değildir; takvim aylık ürün/satış bitişi otomatik ay kaydırma yok. Quota week/month başlangıç çıpalı, son kısa dönem tam, carryyok.
- Business ortak hakta satış/para satış merkezinde, hizmet/earning hizmet merkezinde; rapor transfer/merkezler arası borç yaratmaz. Fiilî instructor ve açık agreement, timed için otomatik person-fee yok. Trial bedelsiz kişi/yüzdeye girmez. Event aktif öğrenci/limit istisnası değil, harici venue olabilir.
- Event duty I/A mark, CM full-results close; hak etkisi event kayıt koşulundan, sabit duty fee ayrı gerçekleşme+CM verify. Org belge/CRM configuration O/OM, yerel CM, automation execution ayrıca center operation yetkisi.
- Para borcu/credit ayrı, fazla tahsilat alacak. Offset cash değil. İade önce aynı satış borç indirimi, sonra alacak; cash refund ayrı. Append-only linked düzeltme, hukuki imha bundan ayrı.
- Hesap silme/org kapama/yenilememe/kalıcı silme ayrı. Kalıcı silmede yeni abonelik eski dataya bağlanamaz; minimal hukuki arşiv uygulamadan ayrı. Backup restore imha listesini uygulamadan veri açamaz.

## Tamamlanan ve açık kalan

Yazılı iş kararı turu kapandı; O4 yazılı kataloglar tamamlandı.31 belge/tip kontrolü geçti; bunlar gerçek backend/RLS/Auth/yük/restore testi değil.08 JSON standardı için yerel kullanılan alt-küme kontrolleri yapıldı, harici tam dialect validator iddiası yok.

Açık kapılar: kullanıcının hukuk uzmanı saklama teyidi; ticari fiyat/limit ve gerekli politika değerleri; repository/CI/ortam/provider/secrets kurulumu; kod/migration ve gerçek kabul/yarış/yük/restore testleri; ücretli üretim RPO/RTO değerlendirmesi ve somut deployment onayı. Pilot RPO24h/RTOtespitten8h/günlükDB+dosya/30gün/aylıkrestore hedef, SLA değil. Sayısal kurulum eksiği tüm yazılı modelin yeniden tartışılması değildir.

Yeni sohbet başlangıcı:

>00–08 güncel belgelerini oku.02 bölüm23 son kararlar esastır: owner yalnız FtkSaaS, hesabı bağlamadan ayrıcalık yok, tüm hak tarihleri center00:00, negative katılım başlangıç kapısı/late-payment no retro earning. Eski studioSaaS’a başvurma ve frontend tasarımına karışma. Yazılı sözleşme tamam; yeni iş kararı icat etme. Kullanıcının sonraki somut görevine göre08 manifestini ve55 kabul senaryosunu kullan. Kodlama/merge/üretim izni verilmiş gibi davranma. Hukuki/config/üretim doğrulama kapılarını açık göster.

3.0 —15 Ekim2026: Son kararlar ve O4 yazılı v1.0 tamamlandı; eski çok-rol-davet/owner-transfer/otomatik ay bitişi önerileri kaldırıldı. Yalnız belge teslimidir.

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

Yeni sohbet talimatı: Önce D01–D09 revizyonunu oku. Eski “yazılı kataloglar tamamlandı” ifadelerini 2.1 için kullanma. Kabul edilmiş davranışı teknik kataloglara aktar; yeni ürün kararı icat etme. Bu kabul kodlama/kurulum/dağıtım yetkisi değildir.

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


## Güncel backend devamı — 0.2.0-rc.2

Q-E01 kabul belgesi ana ürün/teknik sözleşmeye, fiziksel şema/API/ortak tiplere aktarıldı. Hazırlık kontenjan tutmaz; güncel borca bağlı tahsilatla kesin kayıt veya capacity_closed finansal düzeltmesi uygulanır. Gerçek kabulün yetkili güncel kaydı reports/qe01-verification.json, entegrasyon notu docs/claude-handover.md. 53 çağrılabilir işlem ve 129 yalnız sözleşme; üretim veya bütün ürün tamamlandı sayılmaz. Eski raporlar tarihsel snapshot olarak kalır.

## Q-E02 — 16 Ekim 2026 son kabul (önceki çelişen hükümlerin yerine)

**E02-01.** Katılımcının başlama sonrası kendi kaydını iptali/ayrılması parasal iade, borç indirimi veya öğrenci alacağı üretmez. Mevcut paket iptal koşulları aynen korunur.

**E02-02.** Merkez iptali her aşamada etkinliğe bağlı ücret yükümlülüğünü tamamen kaldırır; kalan borç sıfır, tahsilatın daha önce alacaklaştırılmamış tamamı öğrenci alacağıdır. Nakit iade/mahsup ayrı açık yetkili işlem; otomatik nakit çıkışı yok.

**E02-03.** Merkez iptali tüm ayrılmış hakları serbest bırakır, tüketilmiş hakları previous_id bağlı ters hareketle tamamen geri verir; kısmi tüketim ve paket hakkı için parasal alacak yok.

**E02-04.** Önceki alacak/iade/mahsup/hak dönüşü tekrar üretilmez. Yalnız iptal edilen etkinliğe bağlı kayıtlar; başka borç/geçmiş değişmez. Önizleme+apply sürüm/finans bağımlılıkları, canlı yetki ve tek transaction audit/outbox/receipt ile korunur.

**E02-05.** Fiilî başlangıç/kısmi gerçekleşme ayrı alan veya durum olarak tanımlı değildir; saat geçmesi tek başına gerçekleşme değildir. Bu tanım karar konusu olarak açık. Merkez iptalinin aşamadan bağımsız sonucu bu tanıma ihtiyaç duymaz; mevcut occurred/attendance evidence korunur.

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

</details>


</details>
