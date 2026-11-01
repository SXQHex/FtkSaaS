# Backend geliştirme yol haritası — görev ve kabul ölçütleri

Bu dosya **Starter, Pro ve Business’ın tamamı için backend görevlerinin tek sahibidir**. [Sıra ve kontrol noktaları](production-queue.md), [kaynak/test/hosted kabulü](00-FtkSaaS-yeni-sohbet-devir.md), [ürün kapsamı](../../../docs/contracts/01-FtkSaaS-urun-kapsam-sozlesmesi.md), [domain davranışı](../../../docs/contracts/02-FtkSaaS-teknik-sozlesme.md) ve [P08](../../../docs/decisions/P08-accepted-scope.md) kendi sahiplerinde tutulur. Buradaki ölçülebilir kabul senaryoları yeni ürün kuralı değildir. F01–F33/14 modül kapsamı korunur; mevcut sağlam kod yeniden yazılmaz.

## Takip ve tamamlanma kuralı

- K: yeni/değişen backend işlevi. D: mevcut kaynak/kanıtı incele, yalnız gerçek boşluğu düzelt. H: gerçek ortam kabulü. D işinde eksik kanıt bütün modülün kodunun yok olduğu anlamına gelmez.
- Karar, kaynak uygulaması, test ve hosted kabul ayrı durumdur. Görev ancak kendisine uygulanabilir katmanlar kanıtlıysa kapanır. Kaynak/SHA/run/attempt bilgisi burada kopyalanmaz; devir kaydına bağlanır. 218 operasyon veya boş feature evidence listesi tamamlanma yüzdesi değildir.
- Görev dosya alanları başlangıç incelemesi içindir. Her dilim bir kullanıcı/backend akışını doğrular; bağımsız alt sistemler tek uygulama oturumuna yığılmaz. Büyük çıkan iş aynı kimliğin alt adımlarına bölünür. PR sınırı tek fonksiyon değil tamamlanan anlamlı modüldür.
- Sorumlu backend’dir. Frontend ekran/tasarım/kabulü bu planın işi değildir; yalnız gerçek API tüketicisi gerektiren bağımlılık [ortak taleple](../../../docs/requests.md) izlenir. Backend frontend adına kapanış vermez.
- Test/doğrulama yöntemi [aşağıda](#doğrulama-ve-kayıt); saf belge işi DB/API çalıştırmayı gerektirmez. Hosted reset/seed, yeni dış gönderim, production dağıtımı veya canlı veri aktarımı bu planın yazılmasıyla başlamaz.

## Eski iş kimliklerinin tek görev karşılığı

Bu tablo yalnız izdir; eski kabul metinleri ikinci kez tutulmaz.

| Önceki kayıt | Ayrıntı sahibi |
|---|---|
| XREQ-001 / XREQ-002 | [S08](#s08); ortak talebin teslim/kabul durumu yalnız docs/requests.md |
| XREQ-003 | [S06](#s06), [S07](#s07) |
| DOCS-01 | [A01](#a01), [A02](#a02), [A03](#a03); metadata kanıtı devirde |
| WEB-01 | Yalnız gerçek tüketici bağımlılığı: S08/S14/S15 ve G kabulü; frontend aktif sıra sahibi değişmez |
| PUBLIC-01 / ST-03 | [S14](#s14), [S15](#s15), [S10](#s10), [P15](#p15) |
| OPS-01 / REL-01 | [O01](#o01)–[O10](#o10) |
| FIN-01 | [P04](#p04) |
| CI-SPLIT / CI-SIGNAL | [A03](#a03); güncel CI kanıt kapsamını doğrula, yeni süreç kapanışında olay/PID/host kanıtı ara; kök neden uydurma, süre optimizasyonuyla ürün işini durdurma |


## Karar aktarımı ve kanıt uzlaştırması

<a id="a01"></a>
### A01 — Onayları tek sözleşme sahiplerine aktar

- [x] **Tür:** K · **Plan:** Tümü · **Özellik:** F01–F33
- **Bağımlılık:** —
- **Kabul:** Onaylı kararlar mevcut normatif sahiplerine aktarıldı; ayrı spec/roadmap ağacı kurulmadı.
- **Sınır/olumsuz durum:** Eski zıt hüküm kaldırılır; aynı kural iki yerde kopyalanmaz.
- **Doğrulama senaryosu:** Bu PR belge kontrolleri ve incelemesi; kaynak/merge kabulü yalnız devir kaydından okunur.
- **Kaynak alanı:** docs/contracts/01 ve 02; docs/decisions/P08-accepted-scope.md

<a id="a02"></a>
### A02 — Kaynak ve teslim kayıtlarını uzlaştır

- [x] **Tür:** D · **Plan:** Tümü · **Özellik:** F33
- **Bağımlılık:** A01
- **Kabul:** Başlangıç main kanıtı ve PR99 sonrası durum devirde uzlaştırıldı; XREQ-003 backend değerlendirmesi kaydedildi.
- **Sınır/olumsuz durum:** Frontend/hosted kabulü adına kapanış yok; CI-SIGNAL teşhisi fonksiyon teslimini sebepsiz bloke etmez.
- **Doğrulama senaryosu:** Başlangıç SHA/run ilişkisi devirde; hosted ve frontend kabulü ayrı açık tutulur.
- **Kaynak alanı:** apps/backend/docs: devir, remaining-work, production-queue; docs/requests.md backend alanı

<a id="a03"></a>
### A03 — 33 özellik için kanıt ve boşluk eşlemesi

- [ ] **Tür:** D · **Plan:** Tümü · **Özellik:** F01–F33
- **Bağımlılık:** A02
- **Kabul:** Her özellik karar, kaynak, test, hosted ve plan erişimiyle eşleşir.
- **Sınır/olumsuz durum:** Boş evidence bütün özelliği yok saymaz; metadata düzeltmesi kod kabulü değildir.
- **Doğrulama senaryosu:** Her F kimliğine en az bir görev ve gerçek mevcut test/kanıt bağını denetle; sahipsiz operasyon bırakma.
- **Kaynak alanı:** contract.json x-contract; workflows.json; backend backlog

**Uygulama alt adımları:**

- [x] A03.1 — Her F01–F33 için normatif karar/plan kapsamını mevcut operasyon ve WF kaynaklarıyla eşleştir; metadata eksikliğini runtime eksikliğinden ayır.
- [ ] A03.2 — Bağlı gerçek testleri ve kaynak/run/ortam kanıtını incele; doğrulanmamış, eksik veya uygulanamaz katmanı gerekçesiyle ayır. Sırf test dosyası bulunması başarı kanıtı değildir.
- [ ] A03.3 — Her gerçek boşluğu mevcut görev kimliğine bağla; sahipsiz operasyon veya çelişen kabul bırakma. Makine metadata'sını yalnız doğrulanmış kanıtla güncelle; mevcut sağlam işlevi yeniden yazma.

**Dilim kabulü:** 33 özelliğin her birinde karar→kaynak→test→ortam→plan izi ve açık boşluğun görev sahibi bulunur. İncelenmemiş katman tamamlandı gösterilmez; yeni bir kanıt/roadmap dosyası açılmaz.

## Starter ve ortak ürün temeli

<a id="s01"></a>
### S01 — Oda yönetim okumalarını tamamla

- [ ] **Tür:** K/D · **Plan:** Tümü · **Özellik:** F01,F03
- **Bağımlılık:** A03
- **Kabul:** Mevcut odalar listelenir, ayrıntı ve düzenleme sürümü okunur.
- **Sınır/olumsuz durum:** Tenant/merkez scope ve Starter tek oda kuralı korunur.
- **Doğrulama senaryosu:** Oluştur→yeniden oku→sürümle güncelle; eski sürüm ve başka merkez reddi.
- **Kaynak alanı:** database oda/management kaynakları; room-role-registry.test.mjs; contract.json

**Uygulama alt adımları:**

- [x] S01.1 — Mevcut oda yazma ve yönetim okuma kaynaklarını incele; liste, ayrıntı, selector ve düzenleme sürümü boşluklarını belirle. Desteklenen alanları mevcut DTO/yetki sözleşmesinden al.
- [x] S01.2 — Eksik okumaları mevcut mimari içinde tamamla; merkez/tenant scope, desteklenen filtre ve sayfalama davranışını sözleşme/üretilmiş tiplerle birlikte sun.
- [ ] S01.3 — Gerçek Auth→Edge→RPC yolunda oluştur→yeni oturumdan bul→ayrıntı/sürüm oku→güncelle→yeniden oku zincirini doğrula; mevcut oda/rol suite'ini kullan.

**Dilim kabulü:** Eski sürümle yazma, başka tenant/izinsiz merkez erişimi ve yetki kaybı reddedilir. Starter ikinci aktif oda açamaz; mevcut kapasite ve tek mantıksal oda kuralları korunur. Backend okuma teslimi frontend ekran kabulü diye kapatılmaz.

<a id="s02"></a>
### S02 — Sınıf ve program yönetim okumaları

- [ ] **Tür:** K/D · **Plan:** Tümü · **Özellik:** F08,F10
- **Bağımlılık:** S01
- **Kabul:** Mevcut sınıf/program düzenleme için gerekli selector, alan ve sürümü döndürür.
- **Sınır/olumsuz durum:** Yazma var diye okuma tamam sayılmaz; sayfalama ve yetki uygulanır.
- **Doğrulama senaryosu:** Kayıtlı programı yeni oturumdan bul/düzenle; çakışma ve stale sürüm; frontend B01 bağı kapanır.
- **Kaynak alanı:** database program/management; program-session-lifecycle.test.mjs; contract.json

**Uygulama alt adımları:**

- [ ] S02.1 — Mevcut sınıf/program yazmalarının ihtiyaç duyduğu kimlik, selector, alan ve sürüm okumalarını incele; oda okumasını S01'den tüket, ikinci kaynak kurma.
- [ ] S02.2 — Kayıtlı sınıf/programın liste/ayrıntı ve düzenleme okumalarını desteklenen scope/filtre/sayfalama ile tamamla; DTO ve hata sözleşmesini eşitle.
- [ ] S02.3 — Programı bir oturumda oluşturup yeni oturumda bul/düzenle/yeniden oku; stale sürüm, yetki kaybı ve kaynak çakışmasını mevcut program/session suite'inde doğrula.

**Dilim kabulü:** İstemci önceki oluşturma yanıtını saklamadan düzenlenecek kaydı bulabilir. Yetkisiz kapsam ve eski sürüm reddedilir; oda/eğitmen çakışması ile Starter tek kaynak sınırları gevşemez. Frontend B01'in yalnız bu okumalarla ilgili backend bağımlılığı teslim edilir; ekran kabulü kendi sahibinde kalır.

<a id="s03"></a>
### S03 — Abone No tahsis ve arama

- [ ] **Tür:** K · **Plan:** Tümü · **Özellik:** F07
- **Bağımlılık:** A01
- **Kabul:** İlk öğrencilikte org bazlı 1001+ numara tahsis edilir; No ile kişi bulunur.
- **Sınır/olumsuz durum:** Hesap gerektirmez; tekrar istek ve eşzamanlı aktivasyon yeni/çift numara yaratmaz; tenant sızmaz.
- **Doğrulama senaryosu:** Aynı kişiye paralel aktivasyon, iki org, pasifleştir/aktifleştir ve hesap bağlama testleri.
- **Kaynak alanı:** database kişi ilişkileri; yeni migration; person-registry.test.mjs; contract.json

**Uygulama alt adımları:**

- [ ] S03.1 — [P08 kararına](../../../docs/decisions/P08-accepted-scope.md#organizasyon-bazında-sabit-abone-numarası) göre ilk öğrencilik/tahsis sınırını mevcut kişi yaşam döngüsüne bağla; hesap şartı koyma. Yalnız aday/eğitmen/personel olmanın numara üretmediğini doğrula.
- [ ] S03.2 — Yeni migration ve domain işlemiyle org bazlı tekil tahsisi atomik kur; değişmezlik ve tekrar güvenliğini mevcut komut/replay mekanizmasına bağla. No araması mevcut yetkili kişi çözümlemesini kullanır.
- [ ] S03.3 — Aynı kişiye paralel aktivasyon, farklı kişilere eşzamanlı tahsis, aynı komutun tekrarı ve iki organizasyonu gerçek kişi registry suite'inde sınayarak tahsis/arama sonucunu doğrula.

**Dilim kabulü:** İlk öğrencilikte 1001'den başlayan org numarası alınır; pasifleştir/aktifleştir, iletişim değişimi ve hesap bağlama yeni numara üretmez. Boşluksuz sıra vaadi verilmez; numara yeniden kullanılmaz veya yetki kanıtı sayılmaz. Tenant dışından No ile çözümleme reddedilir.

<a id="s04"></a>
### S04 — Abone No ilk aktarımı ve birleşim

- [ ] **Tür:** K · **Plan:** Tümü · **Özellik:** F07,F31
- **Bağımlılık:** S03
- **Kabul:** Aktif/pasif öğrenciler ilk ilişki tarihi/UUID sırasıyla numaralanır; eski numarayla birleşik kişi bulunur.
- **Sınır/olumsuz durum:** Numara tekrar kullanılmaz; tekrar aktarım mevcut numarayı değiştirmez, aynı kişi farklı merkezde çoğalmaz.
- **Doğrulama senaryosu:** İki numaralı/tek numaralı merge, alias zinciri, paralel yeni öğrenci ve aktarımın yeniden çalışması.
- **Kaynak alanı:** kişi merge/aktarım kaynakları; yeni migration; ilgili acceptance testi

**Uygulama alt adımları:**

- [ ] S04.1 — Mevcut aktif/pasif öğrencileri ilk öğrenci ilişkisi tarihi, eşitlikte kişi UUID'siyle sıralayan tekrar güvenli ilk aktarımı hazırla; çok merkez ilişkisini org içinde tek kişi olarak ele al.
- [ ] S04.2 — Mevcut merge akışına P08 numara koruma ve alias davranışını bağla: iki numarada ilk tahsis edileni, tek numarada mevcut olanı koru; eski numaralar aynı canonical kişiye ulaşsın.
- [ ] S04.3 — İlk aktarımı tekrar çalıştır; aktarım ile yeni öğrencilik yarışını, tek/iki numaralı birleşimi ve alias zincirini izole kabulde doğrula. Canlı veri aktarımı bu planın yetkisi değildir.

**Dilim kabulü:** Verilmiş numaralar yeniden numaralanmaz; alias başka kişiye tahsis edilmez. Birleşim hak/borç/satış geçmişini ve mevcut onay/yetki kapılarını korur. Geçmiş makbuz ve dış listeler yeniden yazılmaz; retry ve geç hata atomikliği mevcut akışla doğrulanır.

<a id="s05"></a>
### S05 — Abone No operasyon projeksiyonları

- [ ] **Tür:** K · **Plan:** Tümü · **Özellik:** F07,F28,F31
- **Bağımlılık:** S04
- **Kabul:** Operasyonun kişi referansı gereken arama, liste ve raporlarında No bulunur.
- **Sınır/olumsuz durum:** UUID teknik ilişki olarak kalır; No ile yetkisiz çözümleme yok; geçmiş dış belgeler yeniden yazılmaz.
- **Doğrulama senaryosu:** No ile bul→UUID komut→raporda No; alias araması ve yetki kaybı; frontend sözleşme devri.
- **Kaynak alanı:** kişi/list/report/export projeksiyonları; contract.json; ilgili test

**Uygulama alt adımları:**

- [ ] S05.1 — Kişi referansı kullanan mevcut arama/liste/rapor/export projeksiyonlarını envanterden tara; Abone No gereken yüzeyleri ve mevcut izin kapsamlarını belirle.
- [ ] S05.2 — Gerekli DTO/projeksiyonlara No'yu taşı; komut ve ilişkilerde UUID'yi koru. Değişen makine sözleşmesinden tip/katalogları üret; ilgili WF/API eşlemesini incele.
- [ ] S05.3 — No ile bul→UUID komut→yeniden oku→rapor/export zincirini doğrula; alias araması, scope ve yetki kaybını sınayarak frontend'e sözleşme devrini yap.

**Dilim kabulü:** Aynı kişi izinli operasyon yüzeylerinde tutarlı numarayla görünür. Numara kişisel/finans verisine ek erişim sağlamaz; yeni export mevcut yetkiyi uygular. Önceden üretilmiş dış belge değişmez; frontend'in ekran uyarlaması/kabulü backend adına kapatılmaz.

<a id="s06"></a>
### S06 — Davet işi takibindeki kopukluk

- [ ] **Tür:** K/D · **Plan:** Tümü · **Özellik:** F04,F06,F26
- **Bağımlılık:** A03
- **Kabul:** XREQ-003 dönen iş kimliği doğru yetkiyle okunur; attempts/sonuç tutarlı görünür.
- **Sınır/olumsuz durum:** Outbox/p06 ayrımı gerçek kaynakta teşhis edilir; NOT_FOUND’u gizleyen sahte başarı yok.
- **Doğrulama senaryosu:** Auth→Edge→komut→job okuma; başka hesap/tenant reddi, iş tekrarında tek sonuç.
- **Kaynak alanı:** account-access/job-status SQL; worker; ilgili API testi

<a id="s07"></a>
### S07 — Davet teslim yaşam döngüsü

- [ ] **Tür:** K/D · **Plan:** Tümü · **Özellik:** F04,F26
- **Bağımlılık:** S06
- **Kabul:** Claim→geçerli davet→teslim sonucu→hesap kabulü izlenebilir.
- **Sınır/olumsuz durum:** İptal/eski/expired davet gönderilmez; belirsiz sağlayıcı sonucu kör tekrar edilmez.
- **Doğrulama senaryosu:** Kesinti/retry ve yanlış alıcı; yerel teslim testi ile yetkili gerçek alıcı kabulü ayrı kaydedilir.
- **Kaynak alanı:** davet worker/adaptör; ilgili teslim acceptance testi

<a id="s08"></a>
### S08 — Native hesap ve güvenlik kapanışı

- [ ] **Tür:** D/H · **Plan:** Tümü · **Özellik:** F04,F06
- **Bağımlılık:** A02
- **Kabul:** XREQ-001/002 mevcut hesap, Google, parola/nonce ve recovery gerçek tüketiciyle kapanır.
- **Sınır/olumsuz durum:** Yeni özel Auth katmanı kurulmaz; ön kontrol hesap/e-posta üretmez; eski harness/secret temizliği ayrıca doğrulanır.
- **Doğrulama senaryosu:** Mevcut/yeni/doğrulanmamış/Google adresi; gerçek PKCE/nonce ekranı frontend sahibinde; kaynak teslimi tekrar yapılmaz.
- **Kaynak alanı:** native Auth config/readback; mevcut hesap acceptance; runbook

<a id="s09"></a>
### S09 — Starter günlük ders ve hak akışı

- [ ] **Tür:** D · **Plan:** Starter ve miras alanlar · **Özellik:** F02,F08,F09,F10,F11,F13,F14,F15,F16,F19
- **Bağımlılık:** S02,S03
- **Kabul:** Program→paket→manuel tahsilat→self rezervasyon→yoklama→düzeltme zinciri çalışır.
- **Sınır/olumsuz durum:** Tek oda/disiplin/eğitmen, borç/hak/kapasite korunur; Starter hakediş üretmez.
- **Doğrulama senaryosu:** Son yer/son hak yarışı; iptal-telafi ve tekrar kapanış; mevcut güçlü testleri yeniden yazmadan eksik akışı tamamla.
- **Kaynak alanı:** mevcut Starter, schedule, reservation, attendance, entitlement testleri

<a id="s10"></a>
### S10 — Ayar ve eylem yetkisi tüketicileri

- [ ] **Tür:** D · **Plan:** Tümü; ilk kabul Starter · **Özellik:** F02,F03,F04,F06
- **Bağımlılık:** A03
- **Kabul:** Kabul edilmiş 69 grup alan, varsayılan/miras, yetki ve gerçek davranışla eşlenir.
- **Sınır/olumsuz durum:** Unsupported alan etkin gösterilmez; availability okuması zaten var; kalıcı yeni ayar uydurulmaz.
- **Doğrulama senaryosu:** Owner/merkez/personel/self ve plan kapıları; değişiklik→yeniden okuma→etkilenen işlem; Pro bildirim alanları P14/P15 ile kapanır. Hatırlatma/quiet-hours hedefi P15, mevcut availability okuması kaynakta mevcuttur.
- **Kaynak alanı:** docs/settings.md; typed settings/management SQL; ilgili test

<a id="s11"></a>
### S11 — Rapor ve güvenli indirme

- [ ] **Tür:** D/H · **Plan:** Tümü · **Özellik:** F28
- **Bağımlılık:** S05
- **Kabul:** Yetkili kullanıcı rapor üretir, işi takip eder, gerçek dosyayı indirir.
- **Sınır/olumsuz durum:** Kaynak toplamlarıyla mutabakat, scope ve expiry; boş worker başarı sayılmaz.
- **Doğrulama senaryosu:** Gerçek payload/filtre/tarih/No, yetki kaybı/eski URL; PR83 değişmeyen kanıtı tekrar üretme.
- **Kaynak alanı:** p06 rapor worker/projeksiyon; mevcut p06 acceptance

<a id="s12"></a>
### S12 — Öğrenci/kredi/borç importu

- [ ] **Tür:** D/H · **Plan:** Tümü · **Özellik:** F31,F07,F19
- **Bağımlılık:** S04
- **Kabul:** Önizleme ve onayla kişi, kalan hak ve borç doğru içe alınır.
- **Sınır/olumsuz durum:** Retry çift öğrenci/hak/borç üretmez; Abone No ve Starter kotası uygulanır; Pro/Business yeni sınır kabulü P01’de tamamlanır.
- **Doğrulama senaryosu:** Kısmi hata, yinelenen dosya, kota sınırı ve kaynak-sonuç mutabakatı; gerçek iş çıktısı.
- **Kaynak alanı:** p06 import kaynakları; mevcut acceptance

<a id="s13"></a>
### S13 — Sürümlü belge ve onay akışı

- [ ] **Tür:** D/H · **Plan:** Tümü · **Özellik:** F30
- **Bağımlılık:** A03
- **Kabul:** Dosya yüklenir, sürümlenir, işlem bağlamında gerekli onay alınır ve yetkili indirilir.
- **Sınır/olumsuz durum:** Hash/bayt/sürüm ve tenant korunur; bağlamsız kişi özeti otomatik gereksinim değildir.
- **Doğrulama senaryosu:** Yanlış sürüm, yetkisiz/eski download ve required belge eksikliği; gerçek Storage bayt kabulü.
- **Kaynak alanı:** p05 document/private Storage; mevcut acceptance

<a id="s14"></a>
### S14 — Temel public başvuru kabulü

- [ ] **Tür:** D/H · **Plan:** Tümü; Starter dar kapsam · **Özellik:** F25
- **Bağımlılık:** S06
- **Kabul:** Gerçek ders yayını başvurusu tek merkeze düşer ve yetkili inceler.
- **Sınır/olumsuz durum:** Başvuru hesap/satış/rezervasyon/pazarlama izni yaratmaz; genel CRM Starter kapalı.
- **Doğrulama senaryosu:** Gerçek token/action/hostname, replay ve rate testi; public→inbox→inceleme; frontend PUBLIC-01 bağı.
- **Kaynak alanı:** public ingress/review; provider config; runbook

<a id="s15"></a>
### S15 — Gerçek takvim aboneliği

- [ ] **Tür:** D/H · **Plan:** Tümü · **Özellik:** F08,F25
- **Bağımlılık:** S02
- **Kabul:** Gerçek GET/HEAD host üzerinden ICS ve yetkili seans route çalışır.
- **Sınır/olumsuz durum:** Rotate/revoke ve erişim kaybında eski credential kapanır.
- **Doğrulama senaryosu:** Abonelik URL→ICS→gerçek seans ekranı; sentetik template/login yönlendirmesi yeterli değil; ST-03 bağı.
- **Kaynak alanı:** transports/calendar-proxy.mjs; calendar kaynak/test; config

<a id="s16"></a>
### S16 — SaaS aylık-yıllık bekleyen talep

- [ ] **Tür:** K · **Plan:** Tümü · **Özellik:** F32
- **Bağımlılık:** A01
- **Kabul:** Tek bekleyen talep dönem sonunda yürür; iptal/değişiklik ve kabul edilmiş fiyat/tarih görünür.
- **Sınır/olumsuz durum:** Talep ödeme değildir; mevcut ödenmiş dönem değişmez; öğrenci paketine veya plan değişimine karışmaz.
- **Doğrulama senaryosu:** Aylık→yıllık/yıllık→aylık, dönem sınırı yarışı, iptal/yenileme ve ödenmemiş yeni dönem; tekrar worker tek sonuç.
- **Kaynak alanı:** p07 subscription SQL; contract.json; subscription acceptance

## Pro işlevleri

<a id="p01"></a>
### P01 — Ticari limitleri atomik uygula

- [ ] **Tür:** K · **Plan:** Pro/Business ve Starter regresyon · **Özellik:** F01,F07,F32
- **Bağımlılık:** A01,S12
- **Kabul:** Pro 250, Business org 1250; oda/eğitmen açık sınırsız modeliyle tutarlı okunur/uygulanır.
- **Sınır/olumsuz durum:** Business 5 merkez, Starter 100/1/1/1 korunur; aktif kişi org bazında bir sayılır.
- **Doğrulama senaryosu:** 249→250→251 ve 1249→1250→1251 paralel aktivasyon, import/merge/yeniden aktivasyon; 5→6 merkez reddi.
- **Kaynak alanı:** plan-limit/runtime gate; contract.json; yeni migration/test

<a id="p02"></a>
### P02 — Çoklu kaynak ve operasyon personeli

- [ ] **Tür:** D · **Plan:** Pro/Business · **Özellik:** F01,F02,F03,F05,F08,F13
- **Bağımlılık:** P01,S10
- **Kabul:** Çok oda/disiplin/eğitmen programı ve izinli resepsiyon işlemleri çalışır.
- **Sınır/olumsuz durum:** Fiziksel oda ve eğitmen çakışması; izinli personel yönetici/indirim yetkisini kazanmaz.
- **Doğrulama senaryosu:** Eşzamanlı iki farklı oda ve aynı eğitmen; izin değişikliği sonrası capability/komut reddi.
- **Kaynak alanı:** room/role/availability/schedule SQL; ilgili testler

<a id="p03"></a>
### P03 — İleri rezervasyon ve paket yaşam döngüsü

- [ ] **Tür:** D · **Plan:** Pro/Business · **Özellik:** F09,F12,F17
- **Bağımlılık:** P02,S09
- **Kabul:** Bekleme teklifi ve kabul/ret; özel ders alternatifi; dondurma/değişim/sonlandırma çalışır.
- **Sınır/olumsuz durum:** Teklif zamanı/son hak yarışı; geçmiş hak ve kesin kayıt koruması.
- **Doğrulama senaryosu:** Expiry ile kabul yarışı, teklif reddi, paket değişimi sonrası uygunluk; kaynak boşluğu bulunursa ayrı dar düzeltme.
- **Kaynak alanı:** p01 lesson/waitlist; paket lifecycle; mevcut test

<a id="p04"></a>
### P04 — Eğitmen anlaşma ve hakediş kapanışı

- [ ] **Tür:** D · **Plan:** Pro/Business · **Özellik:** F13,F20,F19
- **Bağımlılık:** P02,S09
- **Kabul:** Geçerli anlaşma→görevlendirme→gerçek ders→hakediş→ödeme tutarlı.
- **Sınır/olumsuz durum:** İleri yürürlük geçmiş hakedişi değiştirmez; FIN-01 trailing earning_ids dar kontrolü.
- **Doğrulama senaryosu:** Sürüm/anlaşma değişimi, kapanmış ders düzeltmesi ve yanlış merkez/earning id; mevcut kabul korunur.
- **Kaynak alanı:** instructor-earnings SQL/test; ödeme okuması

<a id="p05"></a>
### P05 — Telefon temelli ortak başvuru modeli

- [ ] **Tür:** K · **Plan:** Pro/Business; Starter sınır regresyon · **Özellik:** F07,F21,F25
- **Bağımlılık:** S03,A01
- **Kabul:** Telefon, form/kaynak/kampanya ve ayrı onay kanıtı tek ortak modelde tutulur.
- **Sınır/olumsuz durum:** İkinci paralel kişi/başvuru deposu yok; telefon doğrulanmış Auth iletişimi sayılmaz.
- **Doğrulama senaryosu:** Web iletişim/kayıt alanları kayıpsız eşlenir; aynı teslim dedupe, farklı gerçek başvurular ayrı kalır.
- **Kaynak alanı:** public_application/CRM SQL; contract.json; yeni migration/test

<a id="p06"></a>
### P06 — Başvuru inceleme ve kişi eşleme

- [ ] **Tür:** K · **Plan:** Pro/Business · **Özellik:** F07,F21
- **Bağımlılık:** P05
- **Kabul:** Yetkili telefon eşleşme önerisini görüp mevcut kişiye bağlar veya yeni kişi oluşturur.
- **Sınır/olumsuz durum:** Otomatik merge yok; yeni öğrencilik yalnız açık dönüşümle, No ve kota denetimiyle oluşur.
- **Doğrulama senaryosu:** Ortak telefonlu iki kişi, kaynak geçmişi, tekrar inceleme ve sürüm çakışması.
- **Kaynak alanı:** CRM inbox/review/convert SQL; ilgili test

<a id="p07"></a>
### P07 — Web formlarını ortak alıma bağla

- [ ] **Tür:** K/H · **Plan:** Pro/Business · **Özellik:** F21,F25
- **Bağımlılık:** P05,P06
- **Kabul:** Mevcut contact/kayit sunucu akışları ortak modele güvenilir biçimde bağlanabilir.
- **Sınır/olumsuz durum:** Mevcut site koruması korunur; istemci org/source beyanı yetki değildir; başka repo kendiliğinden değiştirilmez.
- **Doğrulama senaryosu:** Gerçek form→backend→inbox; partnerName/mode ve ayrı onayların kaybolmaması; site sahibiyle sınır devri.
- **Kaynak alanı:** backend ingress/adapter config; docs/requests backend devri

<a id="p08"></a>
### P08 — Meta yerel reklam formu alımı

- [ ] **Tür:** K/H · **Plan:** Pro/Business · **Özellik:** F21,F25
- **Bağımlılık:** P05,P06
- **Kabul:** Instagram/Facebook yerel form başvurusu ortak inboxa alınır.
- **Sınır/olumsuz durum:** Sosyal login değildir; provider/form org eşlemesi güvenilir, tokenlar gizli.
- **Doğrulama senaryosu:** Resmi erişim/yöntem uygulama anında doğrulanır; imza/izin, replay/retry ve alan eşleme; gerçek provider kanıtı.
- **Kaynak alanı:** sağlayıcı adapter/credential eşleme; ilgili test

<a id="p09"></a>
### P09 — Google yerel reklam formu alımı

- [ ] **Tür:** K/H · **Plan:** Pro/Business · **Özellik:** F21,F25
- **Bağımlılık:** P05,P06
- **Kabul:** Google yerel reklam formu ortak kaynağa alınır.
- **Sınır/olumsuz durum:** Web forma yönlendirme ile native form ayrıdır; Meta kabulü Google kanıtı değildir.
- **Doğrulama senaryosu:** Güncel resmi erişim/yöntem incelemesi, gönderici doğrulama, dedupe/geri doldurma ve gerçek sağlayıcı kabulü.
- **Kaynak alanı:** Google adapter/config; ilgili test

<a id="p10"></a>
### P10 — Eski başvuru kontrollü aktarımı

- [ ] **Tür:** K/H · **Plan:** Pro/Business · **Özellik:** F21,F31
- **Bağımlılık:** P05,P06
- **Kabul:** Alan/mükerrer/onay önizlemesinden seçilen kayıtlar yetkili onayıyla taşınır.
- **Sınır/olumsuz durum:** Kaynak silinmez; kanıtsız pazarlama izni üretilemez; gerçek veri fixture olmaz.
- **Doğrulama senaryosu:** Örnek veriyle tekrar/rollback/mutabakat; gerçek aktarım için ayrı somut önizleme ve kullanıcı yetkisi.
- **Kaynak alanı:** import preview/CRM mapping; aktarım runbook/test

<a id="p11"></a>
### P11 — Deneme, takip ve segment tam akışı

- [ ] **Tür:** D/K · **Plan:** Pro/Business · **Özellik:** F22,F23,F24
- **Bağımlılık:** P06
- **Kabul:** Lead→deneme→takip→öğrenci dönüşümü; yenileme/hareketsizlik listesi ve segment yönetimi tamamdır.
- **Sınır/olumsuz durum:** Segment liste/detail kaynakta var; baştan icat edilmez; otomatik pazarlama gönderimi kapalı.
- **Doğrulama senaryosu:** Tenant config süre/tekrar, kontrollü indirim, segment sonucu ve tekrar çalışmada çift görev olmaması.
- **Kaynak alanı:** p04 CRM/p05 segment-automation; mevcut acceptance

<a id="p12"></a>
### P12 — Etkinlik kapasitesi modeli

- [ ] **Tür:** K · **Plan:** Pro/Business · **Özellik:** F29
- **Bağımlılık:** P02
- **Kabul:** Odaya bağlı etkinlik sonlu ve oda tavanı içinde; odasızda sonlu/sınırsız seçim.
- **Sınır/olumsuz durum:** 0/büyük sayı sentinel yok; sınırsıza oda bağlama ve kapasite düşürmede mevcut kesin kayıt korunur.
- **Doğrulama senaryosu:** Son yer yarışı; oda tavanı; uyumsuz oda bağlama açık ret/çözüm; mevcut iptal/iade regresyonu.
- **Kaynak alanı:** event/capacity SQL; contract.json; migration; event test

<a id="p13"></a>
### P13 — Kredi tüketmeyen paketli Pratik

- [ ] **Tür:** K · **Plan:** Pro/Business · **Özellik:** F15,F16,F17,F29,F14
- **Bağımlılık:** P12,P03
- **Kabul:** Geçerli/pozitif kullanılabilir hakla kayıt; yalnız etkinlik yeri ayrılır, ders bakiyesi değişmez.
- **Sınır/olumsuz durum:** Sonradan uygunsuz kayıt silinmez; katılım tekrar kontrol, uygunsuz fiilî katılım gerçeği kaydedilir.
- **Doğrulama senaryosu:** Son ders tüketimiyle kayıt/katılım yarışı, dondurma/iade/yeni paket, borç; öncesi-sonrası kredi ledger eşitliği.
- **Kaynak alanı:** event eligibility/register/attendance SQL; contract.json; ilgili test

<a id="p14"></a>
### P14 — İşlemsel e-posta teslimi

- [ ] **Tür:** K/H · **Plan:** Pro/Business · **Özellik:** F26,F24
- **Bağımlılık:** S07,P01
- **Kabul:** İşlemsel e-posta oluşturma, teslim sonucu ve hata gözlenir; in_app korunur.
- **Sınır/olumsuz durum:** Starter dış kanal kapalı; Native Auth ayrı; pazarlama/özet/SMS/push kapalı.
- **Doğrulama senaryosu:** Timeout/unknown, retry/bounce ve iptal edilen olay; provider dedupe sınırları açık; gerçek teslim ayrıca yetkili kanıt.
- **Kaynak alanı:** p05 notification/worker/adaptör; contract.json; teslim testleri

<a id="p15"></a>
### P15 — Hatırlatma planlama ve sessiz saat

- [ ] **Tür:** K · **Plan:** Pro/Business · **Özellik:** F27,F03,F24
- **Bağımlılık:** P14,S10
- **Kabul:** Ders/paket ayarları ve Business miras; merkez olay zamanı, kullanıcının sessiz saatine uygun gönderim.
- **Sınır/olumsuz durum:** Geçersiz hatırlatma atlanır; işlemsel/in_app/Auth ertelenmez; digest kullanılabilir değildir. Önceden kabul edilmiş seçenek/defaultlar FD04’ten alınır; bu plan yeni default seçmez.
- **Doğrulama senaryosu:** Geceyi aşan aralık, yaz/kış saati, ders değişimi/iptali, preference değişimi ve kuyruk gecikmesi; son anda tekrar uygunluk.
- **Kaynak alanı:** notification preferences/scheduler; contract.json; ilgili test

<a id="p16"></a>
### P16 — Otomasyon sonuç ve hata akışı

- [ ] **Tür:** D/K · **Plan:** Pro/Business · **Özellik:** F23,F24,F26,F27
- **Bağımlılık:** P11,P15
- **Kabul:** Desteklenen trigger/action görev veya hizmet hatırlatması üretir; sonuç/hata ve disable/retry görünür.
- **Sınır/olumsuz durum:** Kampanya/indirim/geri kazanım maili açılmaz; tekrar iş aynı domain sonucu üretir.
- **Doğrulama senaryosu:** Segment değişimi, yetki/plan kaybı, worker kesintisi ve işlem öncesi koşul denetimi.
- **Kaynak alanı:** p05 automation worker/management; mevcut acceptance

## Business işlevleri

<a id="b01"></a>
### B01 — Business merkez ve birleşik kişi yetkisi

- [ ] **Tür:** D/K · **Plan:** Business · **Özellik:** F01,F03,F04,F05,F07
- **Bağımlılık:** P01,P02,S05
- **Kabul:** Beş merkeze kadar günlük yönetim; aynı öğrenci No ve org kotasında tek sayılır.
- **Sınır/olumsuz durum:** Merkez yöneticisi başka merkez kişisel/finans verisini göremez; org yetkisi ayrı.
- **Doğrulama senaryosu:** A/B merkez rollerini aynı kişiyle değiştir; birleşik okuma ve komut reddi; kapanan merkez eski kayıt koruması.
- **Kaynak alanı:** center lifecycle/role/person SQL; mevcut scope testleri

<a id="b02"></a>
### B02 — Başvuru yönlendirme ve ortak gelen kutusu

- [ ] **Tür:** K · **Plan:** Business · **Özellik:** F21,F25
- **Bağımlılık:** P06,B01
- **Kabul:** Merkezli form ilgili merkeze, genel form org inboxa; yetkili atar/aktarır.
- **Sınır/olumsuz durum:** Aktarım kopya üretmez; merkez personeli atanmamışı/başka merkezdekini göremez.
- **Doğrulama senaryosu:** İki yöneticinin eşzamanlı ataması, geçmiş/onay korunumu, aktarım sonrası önceki scope erişimi.
- **Kaynak alanı:** CRM assignment/inbox SQL; contract.json; ilgili test

<a id="b03"></a>
### B03 — Merkezler arası kullanım ve hesaplaşma

- [ ] **Tür:** D · **Plan:** Business · **Özellik:** F18,F19,F20
- **Bağımlılık:** B01,P04,P13
- **Kabul:** A talep→B onay/ret→kullanım→satış bedeli payı→mutabakat zinciri tamamdır.
- **Sınır/olumsuz durum:** Kaynak kabulü mevcut; finans yeniden tasarlanmaz, merkezler arası işlem tek yanlı kaçırılamaz.
- **Doğrulama senaryosu:** Onay/ret/iptal/düzeltme ve retry; iki tarafın yetkili tutarlarının aynı ledger ile mutabakatı.
- **Kaynak alanı:** cross-center-settlement kaynak/test; mevcut ledger

<a id="b04"></a>
### B04 — Birleşik rapor ve CRM kapsamı

- [ ] **Tür:** D/K · **Plan:** Business · **Özellik:** F21,F23,F24,F28
- **Bağımlılık:** B02,B03,S11,P16
- **Kabul:** Org yöneticisi birleşik, merkez yöneticisi yetkili merkez raporunu görür.
- **Sınır/olumsuz durum:** Öğrenci toplamı mükerrer sayılmaz; finans tutarları kör toplanmaz; export aynı yetkiye bağlı.
- **Doğrulama senaryosu:** A/B/Org filtreleri, No, cross-center tutar ve yetki kaybı sonrası indirme; kaynakla mutabakat.
- **Kaynak alanı:** report/CRM scope projeksiyonları; ilgili test

<a id="b05"></a>
### B05 — Özel teklif ve limit geçişleri

- [ ] **Tür:** K/D · **Plan:** Business/plan geçişleri · **Özellik:** F32,F01,F07
- **Bağımlılık:** P01,S16,B01
- **Kabul:** Standart üzeri merkez/öğrenci için sürümlü kabul edilmiş özel limit okunur/uygulanır.
- **Sınır/olumsuz durum:** Genel bypass veya sınırsız merkez yok; kota düşüşü mevcut hak/borcu silmez, yeni aktivasyonu sınırlar.
- **Doğrulama senaryosu:** Özel→standart, Business→Pro→Starter mevcut seçim kuralları; limit aşımı/sürüm çakışması ve dönem talebi birlikte.
- **Kaynak alanı:** subscription/plan limit SQL; contract.json; ilgili test

## Ortak üretim işletimi

<a id="o01"></a>
### O01 — Gerçek worker yükü ve tekrar güvenliği

- [ ] **Tür:** D/H · **Plan:** Tümü; lane bazlı · **Özellik:** F12,F24,F26,F28,F31,F33
- **Bağımlılık:** A03
- **Kabul:** Her uygulanabilir lane en az bir gerçek iş ve sonuçla doğrulanır.
- **Sınır/olumsuz durum:** Report-worker kapanmış dilim yeniden yapılmaz; idle/claim0 tam kabul değildir.
- **Doğrulama senaryosu:** Lease kaybı, kesinti, retry, disable/rebind/restart; yanlış binding reddi; P14/P16 sonrası e-posta yükü eklenir.
- **Kaynak alanı:** worker p01/p05/p06/p07/privacy; mevcut ops test/runbook

<a id="o02"></a>
### O02 — Alarm ve müdahale kabulü

- [ ] **Tür:** K/D/H · **Plan:** Tümü · **Özellik:** F33
- **Bağımlılık:** O01
- **Kabul:** Takılmış iş, teslim hatası, stale heartbeat ve backup gecikmesi gözlenip sorumluya ulaşır.
- **Sınır/olumsuz durum:** Logda secret/kişisel veri yok; kapalı worker ile sağlıksız worker ayrılır.
- **Doğrulama senaryosu:** Hata enjeksiyonu→alarm→müdahale→toparlanma; alıcı/kanal ortam girdisi seçilmeden hazır sayılmaz.
- **Kaynak alanı:** mevcut diagnostics/monitoring/config; runbook

<a id="o03"></a>
### O03 — Saklama ve imha kapsamı

- [ ] **Tür:** D/K · **Plan:** Tümü · **Özellik:** F33
- **Bağımlılık:** A03
- **Kabul:** DB/Auth/Storage/export/geçici kopya ve backup kapsamı, hold ve korunan iş kayıtları eşlenir.
- **Sınır/olumsuz durum:** Salt manifest fiziksel imha değildir; kabul edilmemiş süre/hukuki taahhüt uydurulmaz.
- **Doğrulama senaryosu:** Her veri yüzeyi için sahip/retention/hold/imha kanıtı; eksik config açık blocker kaydı.
- **Kaynak alanı:** privacy/retention/hold model; runbook; test

<a id="o04"></a>
### O04 — DB ve Auth fiziksel imha

- [ ] **Tür:** K/D/H · **Plan:** Tümü · **Özellik:** F33
- **Bağımlılık:** O03
- **Kabul:** Yetkili imha gerçek profil/Auth yüzeyini hedef sırada kaldırır.
- **Sınır/olumsuz durum:** Hold/korunan finans verisi keyfî silinmez; yarım iş completed olmaz.
- **Doğrulama senaryosu:** Kesinti ve yeniden devam, kalan referans kontrolü, giriş/erişim reddi; yalnız izole/onaylı hedef.
- **Kaynak alanı:** privacy executor/DB/Auth; ilgili acceptance

<a id="o05"></a>
### O05 — Storage ve export fiziksel imha

- [ ] **Tür:** K/D/H · **Plan:** Tümü · **Özellik:** F30,F28,F33
- **Bağımlılık:** O03
- **Kabul:** Hedef baytlar ve geçici/export kopyaları gerçekten kaldırılır.
- **Sınır/olumsuz durum:** Metadata silmek bayt silmek değildir; izinli hold ve retry sınırları korunur.
- **Doğrulama senaryosu:** Dosya/download kalıntısı, kesinti/retry ve expiry; checksum/envanter ile kanıt.
- **Kaynak alanı:** Storage/export/temp executor; ilgili acceptance

<a id="o06"></a>
### O06 — Bağımsız imha sicili

- [ ] **Tür:** K/D/H · **Plan:** Tümü · **Özellik:** F33
- **Bağımlılık:** O04,O05
- **Kabul:** İmzalı sicil gerçek imha sonucuna ve bağımsız güncel checkpoint/trust kaynağına bağlıdır.
- **Sınır/olumsuz durum:** Sicil ve trust aynı eski backup ile geriye alınamaz; tamamlanmamış imha başarı yazmaz.
- **Doğrulama senaryosu:** Eski/eksik/sahte kayıt ve replay; anahtar erişim/rotasyon/kalıcılık işletim kanıtı.
- **Kaynak alanı:** erasure-register/guard kaynakları; restore test

<a id="o07"></a>
### O07 — Guard ile gerçek restore yükleyicisi

- [ ] **Tür:** K/D/H · **Plan:** Tümü · **Özellik:** F33
- **Bağımlılık:** O06
- **Kabul:** Guard reddi yüklemeyi, loader hatası hizmete erişim açılmasını engeller.
- **Sınır/olumsuz durum:** Kod rollback DB restore değildir; production reset/seed yok.
- **Doğrulama senaryosu:** Gerçek izole yükleyicide ret/yarım yük/başarı; erişim kapısı ve geri dönüş denemesi.
- **Kaynak alanı:** guarded-restore/loader/runbook; restore-guard.test.mjs

<a id="o08"></a>
### O08 — DB/Auth/Storage tam geri dönüş

- [ ] **Tür:** H · **Plan:** Tümü · **Özellik:** F33,F30
- **Bağımlılık:** O07
- **Kabul:** DB/migration/ACL/RLS, Auth UUID/giriş ve Storage bayt/izinleri aynı snapshotla geri döner.
- **Sınır/olumsuz durum:** Tek SQL veya dosya restore bütün kabul değildir; kaynak hedef ayrıdır.
- **Doğrulama senaryosu:** DB mutabakatı, gerçek giriş, Storage checksum; Edge/config/secret envanteri ve worker binding doğrulaması.
- **Kaynak alanı:** restore runbook ve mevcut araçlar

<a id="o09"></a>
### O09 — Backup non-resurrection kabulü

- [ ] **Tür:** H · **Plan:** Tümü · **Özellik:** F33
- **Bağımlılık:** O08
- **Kabul:** Silme öncesi backup restore edilince silinmiş kişi/org erişime dönmez.
- **Sınır/olumsuz durum:** Eski trust+ledger veya eksik sicil erişim açamaz.
- **Doğrulama senaryosu:** Güncel bağımsız sicille olumlu/olumsuz restore; veri erişimi açılmadan imha tekrar uygulanır.
- **Kaynak alanı:** restore/erasure entegrasyon kabulü

<a id="o10"></a>
### O10 — Yük ve kurtarma hedeflerini ölç

- [ ] **Tür:** D/H · **Plan:** Tümü · **Özellik:** F01,F08,F19,F28,F33
- **Bağımlılık:** O02,O08
- **Kabul:** Starter100/Pro250/Business1250 veri profilleri ve olay yoğunluğu altında gecikme/queue/finans doğruluğu ölçülür.
- **Sınır/olumsuz durum:** Öğrenci sayısı eşzamanlı kullanıcı sayısı değildir; onaylanmamış SLA/eşik uydurulmaz.
- **Doğrulama senaryosu:** Yük profili ve eşikler koşudan önce kaydedilir; pilot RPO≤24saat/RTO≤8saat hedefleri ölçülür, ticari SLA sayılmaz.
- **Kaynak alanı:** yük senaryoları; query/worker ölçümleri; runbook

## Plan bazlı son kabul

<a id="g01"></a>
### G01 — Starter bütün ürün kabulü

- [ ] **Tür:** D/H · **Plan:** Starter · **Özellik:** Starter erişimli F01–F33
- **Bağımlılık:** S01–S16; uygulanabilir O01–O10; ortak P01 değişikliği teslim edilmişse Starter regresyonu
- **Kabul:** Hesapsız öğrenci/No→paket/tahsilat→program/self→yoklama/düzeltme→rapor/import/belge çalışır.
- **Sınır/olumsuz durum:** Pro CRM/etkinlik/personel/hakediş/hatırlatma kapalı; teknik hazır ile gerçek ekran kabulü ayrılır.
- **Doğrulama senaryosu:** 100 sınırı ve tek kaynak; public/ICS/hesap gerçek ortam kanıtları; açık blocker kalmadan Starter hazır denir.
- **Kaynak alanı:** backend kabul matrisi; frontend talep referansları

<a id="g02"></a>
### G02 — Pro bütün ürün kabulü

- [ ] **Tür:** D/H · **Plan:** Pro · **Özellik:** Pro erişimli F01–F33
- **Bağımlılık:** S01–S16,P01–P16; uygulanabilir O01–O10
- **Kabul:** Çok kaynaklı operasyon+CRM/reklam→dönüşüm→ders/etkinlik/Pratik→hakediş→bildirim zinciri tamam.
- **Sınır/olumsuz durum:** 250 öğrenci/tek lokasyon, merkezler arası kullanım kapalı; provider pending varken Pro tam denmez.
- **Doğrulama senaryosu:** Gerçek e-posta/sağlayıcı kabulü ve yetki/finans/kapasite yarışları; erteli özellikler açık etiketli.
- **Kaynak alanı:** backend kabul matrisi; frontend bağımlılıkları

<a id="g03"></a>
### G03 — Business ve toplam backend kapanışı

- [ ] **Tür:** D/H · **Plan:** Business/Tümü · **Özellik:** F01–F33
- **Bağımlılık:** G01,G02,B01–B05; O01–O10
- **Kabul:** 5 merkez/1250, ortak CRM, org raporu ve hesaplaşma uçtan uca; 33 özellik izlenebilir.
- **Sınır/olumsuz durum:** Her plan kendi kapısını taşır; genel güvenlik/retention özel teklifle kapatılamaz.
- **Doğrulama senaryosu:** A/B merkez+org rolleri, özel teklif, restore ve yük kanıtı; bütün uygulanabilir K/T/H tamam, son kaynak incelemesi.
- **Kaynak alanı:** backend kabul matrisi; devir/backlog/kuyruk

## F01–F33 kapsama izi

A03 incelemesi mevcut 218 operasyonun tamamını tek WF sahibine bağladı: 211 operasyonun F01–F33 ve normatif plan izi vardır; `features=[]` olan yedi ortak ayar/medya operasyonu WF12 üzerinden S10 kapsamındadır. Ortak altyapıya yapay F etiketi atanmadı. Aşağıdaki akışların kaynak/test bağları `docs/workflows.json`, okunabilir görünümü [API haritası](../../../docs/functions.md) sahibindedir. Eksik WF test bağları mevcut gerçek test/SQL fixture kaynaklarıyla tamamlandı; yeni runtime başarısı iddia edilmez. Abonelik yükseltme/iptal testlerinin SQL dispatcher kabulü gerçek HTTP kabulünden ayrılır; grace uzatmanın negatif yetki kontrolü olumlu uzatma kabulü değildir. Bu eksikler S16 ve O10 kapsamında kalır. Her özelliğin hosted/plan bütünlük kabulü ilgili S/P/B/O ve G görevlerinde açık kalır; aday kaynağın test/ortam sonucu yalnız devirde tutulur.

A03 ve G03 genel iz/kabul kapılarıdır. Aşağıdaki tablo görev navigasyonudur; ikinci durum veya plan erişimi matrisi değildir. Plan erişimi yalnız ürün sözleşmesinden alınır.

| Özellik | Ad | Görevler | Kaynak/test akışı |
|---|---|---|---|
| F01 | İşletme, merkez, oda ve kaynak tanımı | S01, P01, P02, B01, B05 | [WF02](../../../docs/workflows.md#wf02), [WF17](../../../docs/workflows.md#wf17) |
| F02 | Çalışma saatleri, izin ve uygunluk | S09, S10, P02 | [WF03](../../../docs/workflows.md#wf03), [WF12](../../../docs/workflows.md#wf12) |
| F03 | İşletme kuralları ve merkez istisnaları | S01, S10, P15, B01 | [WF03](../../../docs/workflows.md#wf03) |
| F04 | Hesap eşleştirme, çoklu rol, kapsamlı yetkilendirme | S06–S08, S10, B01 | [WF00](../../../docs/workflows.md#wf00), [WF02](../../../docs/workflows.md#wf02), [WF04](../../../docs/workflows.md#wf04), [WF17](../../../docs/workflows.md#wf17), [WF18](../../../docs/workflows.md#wf18) |
| F05 | Resepsiyon/operasyon personeli izinleri | P02, B01 | [WF02](../../../docs/workflows.md#wf02) |
| F06 | Öğrenci/eğitmen panelleri, profil ve şifre işlemleri | S06–S08, S10 | [WF00](../../../docs/workflows.md#wf00), [WF01](../../../docs/workflows.md#wf01), [WF04](../../../docs/workflows.md#wf04), [WF05](../../../docs/workflows.md#wf05), [WF06](../../../docs/workflows.md#wf06), [WF08](../../../docs/workflows.md#wf08), [WF10](../../../docs/workflows.md#wf10), [WF17](../../../docs/workflows.md#wf17), [WF20](../../../docs/workflows.md#wf20) |
| F07 | Tek kişi kaydı, adaydan öğrenciye dönüşüm | S03–S05, S12, P01, P05, P06, B01 | [WF04](../../../docs/workflows.md#wf04), [WF10](../../../docs/workflows.md#wf10), [WF16](../../../docs/workflows.md#wf16), [WF20](../../../docs/workflows.md#wf20) |
| F08 | Birleşik takvim ve kaynak çakışma kontrolü | S02, S09, S15, P02 | [WF03](../../../docs/workflows.md#wf03), [WF09](../../../docs/workflows.md#wf09) |
| F09 | Özel ders talep, onay, ret ve alternatif saat | S09, P03 | [WF00](../../../docs/workflows.md#wf00), [WF03](../../../docs/workflows.md#wf03), [WF06](../../../docs/workflows.md#wf06), [WF20](../../../docs/workflows.md#wf20) |
| F10 | Tekrarlayan grup programı ve sabit gruba kayıt | S02, S09 | [WF03](../../../docs/workflows.md#wf03), [WF05](../../../docs/workflows.md#wf05), [WF06](../../../docs/workflows.md#wf06) |
| F11 | Kontenjanlı açık grup dersine öğrencinin kaydolması | S09 | [WF03](../../../docs/workflows.md#wf03), [WF06](../../../docs/workflows.md#wf06) |
| F12 | Bekleme listesi ve süreli yer teklifi | P03, O01 | [WF00](../../../docs/workflows.md#wf00), [WF19](../../../docs/workflows.md#wf19), [WF20](../../../docs/workflows.md#wf20) |
| F13 | Eğitmen değişikliği | S09, P02, P04 | [WF03](../../../docs/workflows.md#wf03) |
| F14 | Yoklama, gelmeme, iptal, erteleme ve yerine seans düzenleme | S09, P13 | [WF03](../../../docs/workflows.md#wf03), [WF06](../../../docs/workflows.md#wf06), [WF07](../../../docs/workflows.md#wf07) |
| F15 | Ders sayılı paket, geçerlilik ve kredi hareketleri | S09, P13 | [WF05](../../../docs/workflows.md#wf05), [WF06](../../../docs/workflows.md#wf06), [WF10](../../../docs/workflows.md#wf10), [WF12](../../../docs/workflows.md#wf12), [WF14](../../../docs/workflows.md#wf14), [WF20](../../../docs/workflows.md#wf20) |
| F16 | Süreli/sınırsız üyelik, dönemsel kullanım sınırı | S09, P13 | [WF05](../../../docs/workflows.md#wf05), [WF12](../../../docs/workflows.md#wf12) |
| F17 | Üyelik/paket dondurma ve plan değişimi | P03, P13 | [WF05](../../../docs/workflows.md#wf05) |
| F18 | Merkezler arasında kullanım hakkı ve onaylı hesaplaşma | B03 | [WF05](../../../docs/workflows.md#wf05), [WF10](../../../docs/workflows.md#wf10), [WF18](../../../docs/workflows.md#wf18), [WF20](../../../docs/workflows.md#wf20) |
| F19 | Manuel tahsilat, kısmi ödeme, iade/düzeltme ve alacak | S09, S12, P04, B03 | [WF05](../../../docs/workflows.md#wf05), [WF08](../../../docs/workflows.md#wf08), [WF10](../../../docs/workflows.md#wf10), [WF20](../../../docs/workflows.md#wf20) |
| F20 | Eğitmen hakedişi ve ödeme takibi | P04, B03 | [WF07](../../../docs/workflows.md#wf07), [WF10](../../../docs/workflows.md#wf10), [WF14](../../../docs/workflows.md#wf14), [WF15](../../../docs/workflows.md#wf15), [WF20](../../../docs/workflows.md#wf20) |
| F21 | Aday, kaynak, ilgi, takip ve dönüşüm | P05–P11, B02, B04 | [WF09](../../../docs/workflows.md#wf09), [WF10](../../../docs/workflows.md#wf10), [WF16](../../../docs/workflows.md#wf16), [WF20](../../../docs/workflows.md#wf20) |
| F22 | Deneme teklifi ve kontrollü indirim | P11 | [WF16](../../../docs/workflows.md#wf16) |
| F23 | Yenileme ve hareketsiz öğrenci takip listeleri | P11, P16, B04 | [WF16](../../../docs/workflows.md#wf16) |
| F24 | Davranışa dayalı segmentler ve takip otomasyonu | P11, P14–P16, B04 | [WF16](../../../docs/workflows.md#wf16), [WF20](../../../docs/workflows.md#wf20) |
| F25 | Paylaşılabilir işletme takvimi ve başvuru/kayıt sayfası | S14, S15, P05, P07–P09, B02 | [WF09](../../../docs/workflows.md#wf09), [WF15](../../../docs/workflows.md#wf15) |
| F26 | Talep sonucu, ders değişikliği ve benzeri işlemsel bildirimler | S06, S07, P14, P16 | [WF11](../../../docs/workflows.md#wf11), [WF12](../../../docs/workflows.md#wf12), [WF20](../../../docs/workflows.md#wf20) |
| F27 | Otomatik yaklaşan ders/paket bitiş hatırlatmaları | P15, P16 | [WF12](../../../docs/workflows.md#wf12), [WF20](../../../docs/workflows.md#wf20) |
| F28 | Operasyon ve finans raporları, tarih filtresi, dışa aktarım | S05, S11, B04, O05 | [WF00](../../../docs/workflows.md#wf00), [WF10](../../../docs/workflows.md#wf10), [WF12](../../../docs/workflows.md#wf12), [WF20](../../../docs/workflows.md#wf20) |
| F29 | Atölye/etkinlik, kontenjan, kayıt ve katılım | P12, P13 | [WF15](../../../docs/workflows.md#wf15) |
| F30 | Temel form ve sürümlü belge onayı | S13, O05, O08 | [WF10](../../../docs/workflows.md#wf10), [WF11](../../../docs/workflows.md#wf11) |
| F31 | Öğrenci, kalan kredi ve borç için veri içe aktarma | S04, S12, P10 | [WF00](../../../docs/workflows.md#wf00), [WF10](../../../docs/workflows.md#wf10), [WF12](../../../docs/workflows.md#wf12), [WF20](../../../docs/workflows.md#wf20) |
| F32 | İşletme aboneliği, erişim ve kullanım limitleri | S16, P01, B05 | [WF02](../../../docs/workflows.md#wf02), [WF04](../../../docs/workflows.md#wf04), [WF13](../../../docs/workflows.md#wf13), [WF17](../../../docs/workflows.md#wf17), [WF20](../../../docs/workflows.md#wf20) |
| F33 | Denetlenebilir geçmiş ve yinelenen işlem koruması | A02, O01–O10 | [WF00](../../../docs/workflows.md#wf00), [WF05](../../../docs/workflows.md#wf05), [WF08](../../../docs/workflows.md#wf08), [WF14](../../../docs/workflows.md#wf14), [WF17](../../../docs/workflows.md#wf17), [WF20](../../../docs/workflows.md#wf20) |

## Doğrulama ve kayıt

Repo kökünden `pnpm --filter @ftksaas/backend verify`; dar belge kontrolü için `node apps/backend/scripts/ci/docs-check.mjs apps/backend/docs/remaining-work.md`. İkinci komut yaşayan bütün Markdown bağlantılarını ve generated drift’i de kontrol eder. Komutların ayrıntılı tek sahibi [dokümantasyon rehberidir](documentation-development.md); kaynak değişimi varsa uygun test envanteri ve gerçek akış ayrıca incelenir.

Backend dizininden mevcut örnek odak testleri: `node --test tests/room-role-registry.test.mjs tests/program-session-lifecycle.test.mjs`, `node --test tests/person-registry.test.mjs`, `node --test tests/p01-lesson-requests.test.mjs tests/p01-waitlist-workers.test.mjs`, `node --test tests/event-payment.test.mjs tests/event-cancellation.test.mjs`, `node --test tests/instructor-earnings.test.mjs tests/cross-center-settlement.test.mjs`, `node --test tests/restore-guard.test.mjs`. Bunlar ilgili izole servis önkoşullarıyla, yalnız değişen davranışa uygun seçilir. `*-acceptance.mjs` yardımcıları standalone test gibi çağrılmaz; mevcut harness/suite sahibi kullanılır. Yeni testler mevcut suite/shard envanterinde eksiksiz yer alır.

Her görev için karar bağlantısı, kaynak uygulaması, test senaryosu/sonucu, gerçek ortam bağımlılığı ve açık blocker izlenir. Tam SHA/run/attempt ve ortam sonuçlarının tek kaydı [devir](00-FtkSaaS-yeni-sohbet-devir.md); frontend onayı [ortak talep](../../../docs/requests.md) sahibindedir. CI, rerun, kaynak kanıtı ve full-clean sırasında turu bitirme kuralları [CI politikası](../../../docs/ci-policy.md) ve [AGENTS](../../../AGENTS.md) üzerinden uygulanır; burada ikinci politika kurulmaz.

## Uygulama sırasında tamamlanacak ortam girdileri

İlk sürüm ürün tercihleri kapatılmıştır; bütün teknik/operasyonel girdilerin hazır olduğu iddia edilmez. Sağlayıcı erişimi/form kimliği, hostname/config, gerçek alıcı yetkisi ve eski veri içeriği ilgili dilimde doğrulanır. Provider resmi belgeleri uygulama anında okunur; genel teslim veya Resend kurulum yetkisi varsayılmaz. Eksik erişim ilgili hosted kabulü bekletir, bağımsız kaynak işini değil.

Hatırlatma seçenek/defaultları FD04 sahibinden alınır. Alarm alıcısı/kanalı, yük profili/eşikleri ve production işletim sorumlusu ortam kabulünden önce kaydedilir. Öğrenci kotası eşzamanlı kullanıcı sayısı değildir. Pilot RPO/RTO ticari SLA yapılmaz. Saklama/hold değerleri sözleşmeden doğrulanır; belirsiz hukuk/config değeri uydurulmaz. Teknik incelemede yeni gerçek ürün çelişkisi bulunursa yalnız o karar sorulur.

<a id="ertelenmiş-ve-kapsam-dışı"></a>
## Ertelenmiş ve kapsam dışı işleri ele alma

İlk sürüm/sonraki aşama özellik listesi burada tekrar edilmez; tek sahibi [ürün kapsamının ilgili bölümü](../../../docs/contracts/01-FtkSaaS-urun-kapsam-sozlesmesi.md#ilk-tam-sürüm-ve-sonraki-aşama-sınırı) ve [kapsam dışı tablosudur](../../../docs/contracts/01-FtkSaaS-urun-kapsam-sozlesmesi.md#sonraki-aşama-ve-kapsam-dışı). Rol dengesi/kombine bilet için P03/P12/P13, pazarlama/kanal/özet genişlemeleri için P11/P14–P16 temel olur; ayrı spec olmadan ilk sürüme eklenmez.

Eski özel recovery harness/deployment/Preview secret/share-link temizliği S08 kapsamındadır; native Auth kabulü kendiliğinden temizlik kanıtı değildir. Kalıcı dummy/pilot kurulum görevi iptaldir; mevcut sentetik veri tekrar kullanılabilir. SQL/Cron/DB teknik yönetim ekranı ertelidir. Free-plan parola koruması uyarısı ve belgeli ops_run search_path istisnası tekrar açık hata ilan edilmez. Tenant kurulum değerleri ve eski site girdileri yalnız [işletim kaydında](remote-backend-setup.md#p08-kurulum-kaydı) tutulur.
