# Backend geliştirme yol haritası — görev ve kabul ölçütleri

Bu dosya **Starter, Pro ve Business’ın tamamı için backend görevlerinin tek sahibidir**. [Sıra ve kontrol noktaları](production-queue.md), [kaynak/test/hosted kabulü](00-FtkSaaS-yeni-sohbet-devir.md), [ürün kapsamı](../../../docs/contracts/01-FtkSaaS-urun-kapsam-sozlesmesi.md), [domain davranışı](../../../docs/contracts/02-FtkSaaS-teknik-sozlesme.md) ve [P08](../../../docs/decisions/P08-accepted-scope.md) kendi sahiplerinde tutulur. Buradaki ölçülebilir kabul senaryoları yeni ürün kuralı değildir. F01–F33/14 modül kapsamı korunur; mevcut sağlam kod yeniden yazılmaz.

## Takip ve tamamlanma kuralı

- K: yeni/değişen backend işlevi. D: mevcut kaynak/kanıtı incele, yalnız gerçek boşluğu düzelt. H: gerçek ortam kabulü. D işinde eksik kanıt bütün modülün kodunun yok olduğu anlamına gelmez.
- Karar, kaynak uygulaması, test ve hosted kabul ayrı durumdur. Görev ancak kendisine uygulanabilir katmanlar kanıtlıysa kapanır. Kaynak/SHA/run/attempt bilgisi burada kopyalanmaz; devir kaydına bağlanır. Operasyon sayısı veya boş feature evidence listesi tamamlanma yüzdesi değildir.
- Görev dosya alanları başlangıç incelemesi içindir. Her dilim bir kullanıcı/backend akışını doğrular; bağımsız alt sistemler tek uygulama oturumuna yığılmaz. Büyük çıkan iş aynı kimliğin alt adımlarına bölünür. PR sınırı tek fonksiyon değil tamamlanan anlamlı modüldür.
- Sorumlu backend’dir. Frontend ekran/tasarım/kabulü bu planın işi değildir; yalnız gerçek API tüketicisi gerektiren bağımlılık [ortak taleple](../../../docs/requests.md) izlenir. Backend frontend adına kapanış vermez.
- Test/doğrulama yöntemi [aşağıda](#doğrulama-ve-kayıt); saf belge işi DB/API çalıştırmayı gerektirmez. Hosted reset/seed, yeni dış gönderim, production dağıtımı veya canlı veri aktarımı bu planın yazılmasıyla başlamaz.

**ST-02 kabul onarımı tamamlandı:** PR192 aday/main/development kabulü doğrulandı; [kaynak kanıtı](00-FtkSaaS-yeni-sohbet-devir.md#st-02-bağımsız-rapor-kabul-kökleri). PR190 güncel main ile senkronize edilerek yeni birleşik kaynak kabulüne gider. P08–P11 ürün/sağlayıcı işleri kendi alt adımlarında açık kalır.

## Eski iş kimliklerinin tek görev karşılığı

Bu tablo yalnız izdir; eski kabul metinleri ikinci kez tutulmaz.

| Önceki kayıt | Ayrıntı sahibi |
|---|---|
| XREQ-001 / XREQ-002 | [S08](#s08); ortak talebin teslim/kabul durumu yalnız docs/requests.md |
| XREQ-003 | [S06](#s06), [S07](#s07) |
| XREQ-007 / XREQ-008 | [S01](#s01) ek Starter yapılandırma okumaları; talep/teslim durumu yalnız [ortak kayıt](../../../docs/requests.md) |
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

- [x] A03.4 — Otomatik API süre referansı üretimi ve sonraki adayda 91/91 ölçümün otomatik kullanımı PR197/PR198 aday/main kabulüyle doğrulandı. Kaynak/run/inceleme kanıtı devir sahibindedir.

## Starter ve ortak ürün temeli

<a id="s01"></a>
### S01 — Oda yönetim okumalarını tamamla

- [x] **Tür:** K/D · **Plan:** Tümü · **Özellik:** F01,F03
- **Bağımlılık:** A03.1; kullanıcının ayrı S01–S02 teslim önceliğiyle A03.2/A03.3 bağımsız açık
- **Kabul:** Mevcut odalar listelenir, ayrıntı ve düzenleme sürümü okunur.
- **Sınır/olumsuz durum:** Tenant/merkez scope ve Starter tek oda kuralı korunur.
- **Doğrulama senaryosu:** Oluştur→yeniden oku→sürümle güncelle; eski sürüm ve başka merkez reddi.
- **Kaynak alanı:** database oda/management kaynakları; room-role-registry.test.mjs; contract.json

**Tamamlanan alt adımlar:**

- [x] S01.1–S01.3 — Mevcut oda liste/ayrıntı/sürüm okuması, sözleşme devri ve gerçek Auth→Edge→RPC regresyonları tamamlandı. Kaynak/run/ortam kanıtı [devirde](00-FtkSaaS-yeni-sohbet-devir.md#s01s02-backend-kabulü).

**Dilim kabulü:** Eski sürümle yazma, başka tenant/izinsiz merkez erişimi ve yetki kaybı reddedilir. Starter ikinci aktif oda açamaz; mevcut kapasite ve tek mantıksal oda kuralları korunur. Backend okuma teslimi frontend ekran kabulü diye kapatılmaz.

- [x] S01.4 — XREQ-007/008 ek yapılandırma okumalarının backend teslimi tamamlandı; kaynak/run/ortam kanıtı [devirde](00-FtkSaaS-yeni-sohbet-devir.md#starter-yapılandırma-okumaları-kabulü). Frontend gerçek tüketici kabulü ortak talep sahibinde kalır.

- [x] S01.5 — XREQ-009 dar eğitmen yönetimi backend teslimi tamamlandı; [aday/main/development kanıtı](00-FtkSaaS-yeni-sohbet-devir.md#s015-eğitmen-yönetimi-kabulü). Frontend ekran kabulü ortak talepte kalır.
- [x] S01.6 — XREQ-011 tek rol kaynağına geçiş, offline keşif/kota/kaldırma, seans koruması ve merkez izolasyonu PR143 ile teslim edildi; [aday/main/development kanıtı](00-FtkSaaS-yeni-sohbet-devir.md#merkez-eğitmen-yaşam-döngüsü-kabulü). Frontend işlevsel kabulü ortak talep sahibinde tamamdır; sonraki veri/kod temizliği S01.7’dir.

**S01.7 / XREQ-012 — veri ve legacy kod temizliği:** [Kullanıcının son talebi](../../../docs/requests.md#xreq-012) doğrultusunda kanonik rol aktarım kontrolü → eski instructor ilişki satırlarını yeni migration ile silme → tekrar yazımı fiziksel CHECK ile engelleme → çift kaynaklı kota/fallback dallarını kaldırma uygulandı. Diğer ilişki türleri, rol/seans/finans/audit geçmişi ve hesap erişim sınırları korunur. Yerel gerçek migration/API testlerinde eksik aktarımda atomik ret ve sıfır eski satır kabulü geçti. Kullanıcı talimatıyla [backend uygulama kapanış kaydı](../../../docs/requests.md#xreq-012) yazıldı ve dar kalite kaydı onaylandı; PR145 aday/main/development kabulüyle S01.7 backend teslimi kapandı; [tam kaynak ve ortam kanıtı](00-FtkSaaS-yeni-sohbet-devir.md#temizlik-ve-starter-kişi-projeksiyonları-kabulü). XREQ-011’in tamamlanmış frontend kabulü yeniden açılmaz.

<a id="s02"></a>
### S02 — Sınıf ve program yönetim okumaları

- [x] **Tür:** K/D · **Plan:** Tümü · **Özellik:** F08,F10
- **Bağımlılık:** S01
- **Kabul:** Mevcut sınıf/program düzenleme için gerekli selector, alan ve sürümü döndürür.
- **Sınır/olumsuz durum:** Yazma var diye okuma tamam sayılmaz; sayfalama ve yetki uygulanır.
- **Doğrulama senaryosu:** Kayıtlı programı yeni oturumdan bul/düzenle; çakışma ve stale sürüm; frontend B01 bağı kapanır.
- **Kaynak alanı:** database program/management; program-session-lifecycle.test.mjs; contract.json

**Tamamlanan alt adımlar:**

- [x] S02.1–S02.3 — Sınıf/program selector ve değer/sürüm okumaları, üretilmiş sözleşme/WF devri ve yeni oturumdan gerçek API kabulü tamamlandı. Kaynak/run/ortam kanıtı [devirde](00-FtkSaaS-yeni-sohbet-devir.md#s01s02-backend-kabulü).

**Dilim kabulü:** İstemci önceki oluşturma yanıtını saklamadan düzenlenecek kaydı bulabilir. Yetkisiz kapsam ve eski sürüm reddedilir; oda/eğitmen çakışması ile Starter tek kaynak sınırları gevşemez. Frontend B01'in yalnız bu okumalarla ilgili backend bağımlılığı teslim edilir; ekran kabulü kendi sahibinde kalır.

<a id="s03"></a>
### S03 — Abone No tahsis ve arama

- [x] **Tür:** K · **Plan:** Tümü · **Özellik:** F07
- **Bağımlılık:** A01
- **Kabul:** İlk öğrencilikte org bazlı 1001+ numara tahsis edilir; No ile kişi bulunur.
- **Sınır/olumsuz durum:** Hesap gerektirmez; tekrar istek ve eşzamanlı aktivasyon yeni/çift numara yaratmaz; tenant sızmaz.
- **Doğrulama senaryosu:** Aynı kişiye paralel aktivasyon, iki org, pasifleştir/aktifleştir ve hesap bağlama testleri.
- **Kaynak alanı:** database kişi ilişkileri; yeni migration; person-registry.test.mjs; contract.json

**Uygulama alt adımları:**

- [x] S03.1 — [P08 kararına](../../../docs/decisions/P08-accepted-scope.md#organizasyon-bazında-sabit-abone-numarası) göre ilk öğrencilik/tahsis sınırını mevcut kişi yaşam döngüsüne bağla; hesap şartı koyma. Yalnız aday/eğitmen/personel olmanın numara üretmediğini doğrula.
- [x] S03.2 — Yeni migration ve domain işlemiyle org bazlı tekil tahsisi atomik kur; değişmezlik ve tekrar güvenliğini mevcut komut/replay mekanizmasına bağla. No araması mevcut yetkili kişi çözümlemesini kullanır.
- [x] S03.3 — Aynı kişiye paralel aktivasyon, farklı kişilere eşzamanlı tahsis, aynı komutun tekrarı ve iki organizasyonu gerçek kişi registry suite'inde sınayarak tahsis/arama sonucunu doğrula.

**Teslim durumu:** S03/S04 ve S05 kişi/rapor/CSV temeli PR135 ile kabul edildi; kaynak/run/ortam kanıtı [devirde](00-FtkSaaS-yeni-sohbet-devir.md#abone-no-yeni-aday-kapsamı). Diğer operasyon projeksiyonları açık.

**Dilim kabulü:** İlk öğrencilikte 1001'den başlayan org numarası alınır; pasifleştir/aktifleştir, iletişim değişimi ve hesap bağlama yeni numara üretmez. Boşluksuz sıra vaadi verilmez; numara yeniden kullanılmaz veya yetki kanıtı sayılmaz. Tenant dışından No ile çözümleme reddedilir.

<a id="s04"></a>
### S04 — Abone No ilk aktarımı ve birleşim

- [x] **Tür:** K · **Plan:** Tümü · **Özellik:** F07,F31
- **Bağımlılık:** S03
- **Kabul:** Aktif/pasif öğrenciler ilk ilişki tarihi/UUID sırasıyla numaralanır; eski numarayla birleşik kişi bulunur.
- **Sınır/olumsuz durum:** Numara tekrar kullanılmaz; tekrar aktarım mevcut numarayı değiştirmez, aynı kişi farklı merkezde çoğalmaz.
- **Doğrulama senaryosu:** İki numaralı/tek numaralı merge, alias zinciri, paralel yeni öğrenci ve aktarımın yeniden çalışması.
- **Kaynak alanı:** kişi merge/aktarım kaynakları; yeni migration; ilgili acceptance testi

**Uygulama alt adımları:**

- [x] S04.1 — Mevcut aktif/pasif öğrencileri ilk öğrenci ilişkisi tarihi, eşitlikte kişi UUID'siyle sıralayan tekrar güvenli ilk aktarımı hazırla; çok merkez ilişkisini org içinde tek kişi olarak ele al.
- [x] S04.2 — Mevcut merge akışına P08 numara koruma ve alias davranışını bağla: iki numarada ilk tahsis edileni, tek numarada mevcut olanı koru; eski numaralar aynı canonical kişiye ulaşsın.
- [x] S04.3 — İlk aktarımı tekrar çalıştır; aktarım ile yeni öğrencilik yarışını, tek/iki numaralı birleşimi ve alias zincirini izole kabulde doğrula. Canlı veri aktarımı bu planın yetkisi değildir.

**Teslim durumu:** PR135 aday/main/development kabulü tamamlandı; kanıt [devirde](00-FtkSaaS-yeni-sohbet-devir.md#abone-no-yeni-aday-kapsamı). Hosted canlı veri aktarımı bu çalışma kapsamında çalıştırılmadı.

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

**İncelenen yüzeyler:** PersonSummary/PersonView ile ReportRow ve yeni CSV kaynakları teslim edildi. ReservationView, AttendanceEntryView, EntitlementView, FinanceView ve NegativeLimitsView PR139 ile teslim edildi; [aday/main/development kabulü](00-FtkSaaS-yeni-sohbet-devir.md#s05-operasyon-projeksiyonları-kabulü) tamamlandı. ClassAssignmentView, ProtectedObligationView ve LessonRequestView kalan Starter yüzeyleri olarak PR145 ile teslim edildi; üst-plan RoleView/SeatOfferView/WaitlistEntryView de aynı nullable projeksiyonu taşır. Genel rol listesi ve F12 Starter’da kapalı kalır; [PR145 kaynak/ortam kanıtı](00-FtkSaaS-yeni-sohbet-devir.md#temizlik-ve-starter-kişi-projeksiyonları-kabulü). EarningView, LeadView, EventRegistrationView, EventDutyView, EventPaymentPreparationView, AgreementVersionView, SettlementAuthorityView ve CrmFollowupView üst-plan dilimlerinde mevcut plan/izin sınırlarıyla ele alınacak. Starter projeksiyon alt teslimi kapalıdır; üst-plan yüzeyleri ve genel S05 kabulü açık kalır.

**Dilim kabulü:** Aynı kişi izinli operasyon yüzeylerinde tutarlı numarayla görünür. Numara kişisel/finans verisine ek erişim sağlamaz; yeni export mevcut yetkiyi uygular. Önceden üretilmiş dış belge değişmez; frontend'in ekran uyarlaması/kabulü backend adına kapatılmaz.

<a id="s06"></a>
### S06 — Davet işi takibindeki kopukluk

- [x] **Tür:** K/D · **Plan:** Tümü · **Özellik:** F04,F06,F26
- **Bağımlılık:** XREQ-003 önceki bağımsız teslimi; A03 genel kanıt uzlaştırması açık
- **Kabul:** XREQ-003 dönen iş kimliği doğru yetkiyle okunur; attempts/sonuç tutarlı görünür.
- **Sınır/olumsuz durum:** Outbox/p06 ayrımı gerçek kaynakta teşhis edilir; NOT_FOUND’u gizleyen sahte başarı yok.
- **Doğrulama senaryosu:** Auth→Edge→komut→job okuma; başka hesap/tenant reddi, iş tekrarında tek sonuç.
- **Kaynak alanı:** account-access/job-status SQL; worker; ilgili API testi

**Teslim durumu:** XREQ-003 backend iş takibi kabulü tamamlandı; [kaynak/CI ve hosted kanıt](00-FtkSaaS-yeni-sohbet-devir.md#xreq-003-operasyonel-kabulü). Gönderenin aynı işi okuması ve hesap/tenant/merkez olumsuz kontrolleri doğrulandı. Frontend ekranından daveti kabul etme bu kapanışa dahil değildir.

<a id="s07"></a>
### S07 — Davet teslim yaşam döngüsü

- [ ] **Tür:** K/D · **Plan:** Tümü · **Özellik:** F04,F26
- **Bağımlılık:** S06
- **Kabul:** Claim→geçerli davet→teslim sonucu→hesap kabulü izlenebilir.
- **Sınır/olumsuz durum:** İptal/eski/expired davet gönderilmez; belirsiz sağlayıcı sonucu kör tekrar edilmez.
- **Doğrulama senaryosu:** Kesinti/retry ve yanlış alıcı; yerel teslim testi ile yetkili gerçek alıcı kabulü ayrı kaydedilir.
- **Kaynak alanı:** davet worker/adaptör; ilgili teslim acceptance testi

**Tamamlanan dilim:** XREQ-003 backend worker/sağlayıcı teslimi, iş takibi ve yetkili gerçek alıcı kutusu kabulü tamamlandı; [kanıt](00-FtkSaaS-yeni-sohbet-devir.md#xreq-003-operasyonel-kabulü). Native hesap kabulü ve yanlış hesap/expired/revoked/link çakışması kaynak testleri gerçek frontend bağlantı kabulünden ayrıdır.

**Kabul ayrımı:** Gerçek parola/Google/MFA dönüşü, doğru hesapla kabul, aynı anahtarla replay ve farklı anahtarla kullanılmış/geçersiz davet reddi frontend kabul kaydında tamamlandı. Yanlış hesap, gerçek expiry/revoke ve link çakışması kabulü frontend sahibinde açık kalır; [XREQ-004](../../../docs/requests.md#xreq-004-giriş-boyunca-davet-fragmentini-koruma) ile koordine edilir. S07 bu bağımlılık nedeniyle açık; tamamlanan teslim hattı yeniden kurulmaz.

<a id="s08"></a>
### S08 — Native hesap ve güvenlik kapanışı

- [ ] **Tür:** D/H · **Plan:** Tümü · **Özellik:** F04,F06
- **Bağımlılık:** A02
- **Kabul:** XREQ-001/002 mevcut hesap, Google, parola/nonce ve recovery gerçek tüketiciyle kapanır.
- **Sınır/olumsuz durum:** Yeni özel Auth katmanı kurulmaz; ön kontrol hesap/e-posta üretmez; eski harness/secret temizliği ayrıca doğrulanır.
- **Doğrulama senaryosu:** Mevcut/yeni/doğrulanmamış/Google adresi; gerçek PKCE/nonce ekranı frontend sahibinde; kaynak teslimi tekrar yapılmaz.
- **Kaynak alanı:** native Auth config/readback; mevcut hesap acceptance; runbook

**Tamamlanan native telefon backend dilimi:** PR183 ile iki izole yerel test numarası kullanılarak ilk doğrulama, yanlış kod, authenticated yeniden kod üretimi, tüketilmiş istek, doğrulanmış numara değişikliği, numara çakışmasında hesap izolasyonu ve güvenlik geçmişi kaynak/aday/main/development kabulü tamamlandı; [kanıt](00-FtkSaaS-yeni-sohbet-devir.md#native-telefon-test-numarası-dilimi). Descope köprüsü veya hosted sabit OTP kurulmadı. [XREQ-017](../../../docs/requests.md#xreq-017) consumer düzeltmesi PR184'te; frontend ekran kabulü kendi sahibinde açık kalır. Gerçek +90 teslimatı ve expiry/kod rotasyonu bu dilimin kabulü değildir; genel S08 kapanmadı.

**Bu paketin backend dilimi:** Mevcut hesap-oturum harness’inde native parola değişimi sonrası işlem yapılan oturumun korunması, diğer native session’ın silinmesi, henüz süresi dolmamış JWT ve refresh isteğinin reddi eklendi. Bu kaynak testi hosted mevcut-parola/24 saat nonce, gerçek PKCE/recovery/posta veya eski ortamların fiziksel temizliği kabulü değildir; S08 bu dış kabul sınırlarıyla açık kalır. Yeni sağlayıcı harness’i/özel Auth katmanı kurulmadı. Gerçek çalışma sonucu ve aday/main/ortam aşaması [devirde](00-FtkSaaS-yeni-sohbet-devir.md#s07s10-kabul-paketi).

<a id="s09"></a>
### S09 — Starter günlük ders ve hak akışı

**Ek talep — XREQ-021:** Dar katalog main/development teslim edildi. Bağlı öğrencinin katalog öncesi people_list zaman aşımı, ölçülmüş alias/yetki taraması kaynağına bağlıdır. İndeksli self keşfi/alias bileşeni ve10k kişi regresyonu yeni adayda; native/main/development ve hosted tekrar açık. [Tüketim devri](../../../docs/requests.md#xreq-021), [kaynak/ortam kanıtı](00-FtkSaaS-yeni-sohbet-devir.md).

- [x] **Tür:** D · **Plan:** Starter ve miras alanlar · **Özellik:** F02,F08,F09,F10,F11,F13,F14,F15,F16,F19
- **Bağımlılık:** S02,S03
- **Kabul:** Program→paket→manuel tahsilat→self rezervasyon→yoklama→düzeltme zinciri çalışır.
- **Sınır/olumsuz durum:** Tek oda/disiplin/eğitmen, borç/hak/kapasite korunur; Starter hakediş üretmez.
- **Doğrulama senaryosu:** Son yer/son hak yarışı; iptal-telafi ve tekrar kapanış; mevcut güçlü testleri yeniden yazmadan eksik akışı tamamla.
- **Kaynak alanı:** mevcut Starter, schedule, reservation, attendance, entitlement testleri

**Ek kabul — XREQ-020:** Normal satışın typed borç/hak/deficit-rezervasyon projeksiyonu, geniş source snapshot ve apply stale/belge kapıları migration113 ile kaynakta uygulandı. Üç ürün biçimi, geçmiş/gelecek tarih, ilk yetersiz deficit, belge ve yetki/plan/policy değişimi native senaryoları PR210 aday/main/development kabulünü geçti. Tüketim devri [ortak talepte](../../../docs/requests.md#xreq-020); önceki günlük zincir kabulü veya backend kaynak teslimi frontend S05 kabulü değildir.

**Bu paketin backend dilimi:** Mevcut Starter harness’ine sonlu program→bir kredili paket→borca gerçek manuel tahsilat/replay→iki öğrencinin son yer yarışı→aynı öğrencinin son hak yarışı→atanmış eğitmenin taslağı→CM kapanışı/replay→gerekçeli düzeltme/replay→öğrencinin iptali zinciri eklendi. Kişisel sıfır negatif limit açık fixture seçimidir; merkez varsayımı veya mevcut iki kredili testin değişikliği değildir. Mali geçmişin korunması, negatif bakiye ve Starter hakedişi oluşmaması denetlenir. Mevcut iptal/telafi ve atomiklik testleri korunur; PR150 aday/main/development kabulüyle backend günlük zincir teslimi kapalıdır; [kaynak/ortam kanıtı](00-FtkSaaS-yeni-sohbet-devir.md#s07s10-kabul-paketi). Frontend ekran veya genel Starter kabulü değildir.

<a id="s10"></a>
### S10 — Ayar ve eylem yetkisi tüketicileri

- [ ] **Tür:** D · **Plan:** Tümü; ilk kabul Starter · **Özellik:** F02,F03,F04,F06
- **Bağımlılık:** A03
- **Kabul:** Kabul edilmiş 69 davranış grubu, varsayılan/miras, yetki ve gerçek davranışla eşlenir; bu gruplar typed katalogdaki alan sayısı değildir.
- **Sınır/olumsuz durum:** Unsupported alan etkin gösterilmez; availability okuması zaten var; kalıcı yeni ayar uydurulmaz.
- **Doğrulama senaryosu:** Owner/merkez/personel/self ve plan kapıları; değişiklik→yeniden okuma→etkilenen işlem; Pro bildirim alanları P14/P15 ile kapanır. Hatırlatma/quiet-hours hedefi P15, mevcut availability okuması kaynakta mevcuttur.
- **Kaynak alanı:** docs/settings.md; typed settings/management SQL; ilgili test

**İncelenen kapsam:** 69 normatif davranış grubu ile mevcut 67 typed alan aynı sayım değildir. Beş scope’un katalog/typed round-trip, yetki, sürüm/reset/replay testleri frontend-settings-acceptance; org kopyası/merkez seçimi, program süresi, availability, paket, medya/paylaşım/public ve tahsilat tüketicileri starter-preparation-acceptance içindedir. Mevcut çalışan testler tekrar yazılmaz; bu pakette kaynak/gerçek koşu kanıtı uzlaştırılır. Bunlardan bütün 69 grubun, gerçek frontend/hosted davranışının veya Pro bildirim/zamanlama kabulünün kapandığı sonucu çıkarılmaz; P14/P15 ve gerekli ortam kabulleri açık kalır. [Kaynak/ortam kaydı](00-FtkSaaS-yeni-sohbet-devir.md#s07s10-kabul-paketi).

<a id="s11"></a>
### S11 — Rapor ve güvenli indirme

- [ ] **Tür:** D/H · **Plan:** Tümü · **Özellik:** F28
- **Bağımlılık:** S05
- **Kabul:** Yetkili kullanıcı rapor üretir, işi takip eder, gerçek dosyayı indirir.
- **Sınır/olumsuz durum:** Kaynak toplamlarıyla mutabakat, scope ve expiry; boş worker başarı sayılmaz.
- **Doğrulama senaryosu:** Gerçek payload/filtre/tarih/No, yetki kaybı/eski URL; PR83 değişmeyen kanıtı tekrar üretme.
- **Kaynak alanı:** p06 rapor worker/projeksiyon; mevcut p06 acceptance

**Backend dilimi:** Mevcut gerçek Starter worker→rapor→authenticated CSV ve No/filtre/toplam kabulü korunur. Süresi dolan descriptor’ın aynı gerçek HTTP download yolunda da ret verdiği eklendi; içerik dönmez. PR83’ün değişmeyen lease/retention kanıtı yeniden üretilmedi. Backend diliminin aday/main/development teslimi tamamlandı; [kaynak ve ortam kanıtı](00-FtkSaaS-yeni-sohbet-devir.md#s11s13-dosya-ve-belge-kabulü). Gerçek hosted dosya/ekran tüketicisi kabulü açık kaldığından genel S11 kapanmadı.

<a id="s12"></a>
### S12 — Öğrenci/kredi/borç importu

- [ ] **Tür:** D/H · **Plan:** Tümü · **Özellik:** F31,F07,F19
- **Bağımlılık:** S04
- **Kabul:** Önizleme ve onayla kişi, kalan hak ve borç doğru içe alınır.
- **Sınır/olumsuz durum:** Retry çift öğrenci/hak/borç üretmez; Abone No ve Starter kotası uygulanır; Pro/Business yeni sınır kabulü P01’de tamamlanır.
- **Doğrulama senaryosu:** Kısmi hata, yinelenen dosya, kota sınırı ve kaynak-sonuç mutabakatı; gerçek iş çıktısı.
- **Kaynak alanı:** p06 import kaynakları; mevcut acceptance

**Backend dilimi:** Mevcut Starter private CSV→preview→açık apply→worker→kısmi sonuç, hak/borç ve 100 öğrenci sınırı korunur. Aynı kaynak tekrarı kişi/satış/borçla birlikte Abone No’yu da korur; son boş slot numara alır, taşan satırın kişi/borç/sayaç etkisi geri alınır. Yeni import motoru veya politika limiti eklenmedi. Backend diliminin aday/main/development teslimi tamamlandı; [kaynak ve ortam kanıtı](00-FtkSaaS-yeni-sohbet-devir.md#s11s13-dosya-ve-belge-kabulü). Gerçek hosted import tüketicisi ve Pro/Business limit kabulü açık kalır; genel S12 kapanmadı.

<a id="s13"></a>
### S13 — Sürümlü belge ve onay akışı

- [ ] **Tür:** D/H · **Plan:** Tümü · **Özellik:** F30
- **Bağımlılık:** A03
- **Kabul:** Dosya yüklenir, sürümlenir, işlem bağlamında gerekli onay alınır ve yetkili indirilir.
- **Sınır/olumsuz durum:** Hash/bayt/sürüm ve tenant korunur; bağlamsız kişi özeti otomatik gereksinim değildir.
- **Doğrulama senaryosu:** Yanlış sürüm, yetkisiz/eski download ve required belge eksikliği; gerçek Storage bayt kabulü.
- **Kaynak alanı:** p05 document/private Storage; mevcut acceptance

**Backend dilimi:** Mevcut registry harness’inde ayrı sınırlı Starter belge kökü eklendi. Gerçek native Auth ve private Storage baytları, iki farklı hash/sürüm, self onay olmadan ret, onay sonrası aynı komutla rezervasyon, eski rezervasyon/byte/onay geçmişinin korunması ve link kaybında içerik/replay reddi doğrulanır. Ürün davranışı, Storage grantları veya private dosya transport’u değişmedi. Backend diliminin aday/main/development teslimi tamamlandı; [kaynak ve ortam kanıtı](00-FtkSaaS-yeni-sohbet-devir.md#s11s13-dosya-ve-belge-kabulü). Gerçek hosted Storage/ekran tüketicisi kabulü açık kalır; yerel gerçek Storage ve CD şema doğrulaması bu kabul yerine geçmez, genel S13 kapanmadı.

<a id="s14"></a>
### S14 — Temel public başvuru kabulü

- [ ] **Tür:** D/H · **Plan:** Tümü; Starter dar kapsam · **Özellik:** F25
- **Bağımlılık:** S06
- **Kabul:** Gerçek ders yayını başvurusu tek merkeze düşer ve yetkili inceler.
- **Sınır/olumsuz durum:** Başvuru hesap/satış/rezervasyon/pazarlama izni yaratmaz; Starter'ın ayrı temel aday takibi P05 kapsamındadır, genel reklam/CRM yetkisi açılmaz.
- **Doğrulama senaryosu:** Gerçek token/action/hostname, replay ve rate testi; public→inbox→inceleme; frontend PUBLIC-01 bağı.
- **Kaynak alanı:** public ingress/review; provider config; runbook

**Backend kaynak dilimi:** Mevcut public intent→review→davet/hesap→ayrı satış/tahsilat→self rezervasyon zinciri incelendi ve mevcut Starter harness’inde doğrulandı; yeni public motoru kurulmadı. Yerel Edge-owned verified context gerçek widget/token/action/hostname veya frontend ekranı değildir; S14 bu hosted sınırıyla açık kalır. [Kaynak/ortam sonucu](00-FtkSaaS-yeni-sohbet-devir.md#s14s16-kaynak-paketi).

<a id="s15"></a>
### S15 — Gerçek takvim aboneliği

- [ ] **Tür:** D/H · **Plan:** Tümü · **Özellik:** F08,F25
- **Bağımlılık:** S02
- **Kabul:** Gerçek GET/HEAD host üzerinden ICS ve yetkili seans route çalışır.
- **Sınır/olumsuz durum:** Rotate/revoke ve erişim kaybında eski credential kapanır.
- **Doğrulama senaryosu:** Abonelik URL→ICS→gerçek seans ekranı; sentetik template/login yönlendirmesi yeterli değil; ST-03 bağı.
- **Kaynak alanı:** transports/calendar-proxy.mjs; calendar kaynak/test; config

**Backend kaynak dilimi:** Mevcut gerçek HTTP GET kabulüne native HEAD boş gövde/content-length/no-store kontrolü eklendi; rotate/revoke ve canlı erişim kaybı mevcut testte korundu. Loopback proxy ve sentetik route template’i gerçek takvim host’u/seans ekranı kabulünü kapatmaz; S15 açık. [Kaynak/ortam sonucu](00-FtkSaaS-yeni-sohbet-devir.md#s14s16-kaynak-paketi).

<a id="s16"></a>
### S16 — SaaS aylık-yıllık bekleyen talep

- [x] **Tür:** K · **Plan:** Tümü · **Özellik:** F32
- **Bağımlılık:** A01
- **Kabul:** Tek bekleyen talep dönem sonunda yürür; iptal/değişiklik ve kabul edilmiş fiyat/tarih görünür.
- **Sınır/olumsuz durum:** Talep ödeme değildir; mevcut ödenmiş dönem değişmez; öğrenci paketine veya plan değişimine karışmaz.
- **Doğrulama senaryosu:** Aylık→yıllık/yıllık→aylık, dönem sınırı yarışı, iptal/yenileme ve ödenmemiş yeni dönem; tekrar worker tek sonuç.
- **Kaynak alanı:** p07 subscription SQL; contract.json; subscription acceptance

**Uygulanan kaynak:** Tek `subscription_period_change_request_v1` owner komutu, `subscription_get_v1.billing` dönem/fiyat/seçenek/talep okuması ve gerçek abonelik sürümlü dar management selector eklendi. Mevcut `saas_change_requests` ve fon tahsis yolu kullanılır; aynı plan içinde geçiş ödenmiş dönem sonunda yeterli doğrulanmış fonla uygulanır. Yetersiz fonda normal grace, erken ödeme, iptal/değiştirme ve yarış/replay korumaları sürer. Güncel API sırası [WF13](../../../docs/workflows.md#wf13), yerel gerçek kaynak/test sonucu [devir](00-FtkSaaS-yeni-sohbet-devir.md#s14s16-kaynak-paketi) sahibindedir. PR156 aday/main/development kabulü doğrulandı; S16 backend teslimi kapalıdır. Genel Starter ve S14/S15 gerçek hosted/tüketici kabulü bundan çıkarılmaz.

## Pro işlevleri

<a id="p01"></a>
### P01 — Ticari limitleri atomik uygula

- [x] **Tür:** K · **Plan:** Pro/Business ve Starter regresyon · **Özellik:** F01,F07,F32
- **Bağımlılık:** A01,S12
- **Kabul:** Pro 250, Business org 1250; oda/eğitmen açık sınırsız modeliyle tutarlı okunur/uygulanır.
- **Sınır/olumsuz durum:** Business 5 merkez, Starter 100/1/1/1 korunur; aktif kişi org bazında bir sayılır.
- **Doğrulama senaryosu:** 249→250→251 ve 1249→1250→1251 paralel aktivasyon, import/merge/yeniden aktivasyon; 5→6 merkez reddi.
- **Kaynak alanı:** plan-limit/runtime gate; contract.json; yeni migration/test

**Backend teslimi:** PR164 aday/main/development kabulüyle tamamlandı; [tam kaynak/ortam kanıtı](00-FtkSaaS-yeni-sohbet-devir.md#p01-ticari-limit-kaynak-paketi) sahibindedir. Açık sınırsız DTO'nun frontend tüketici bağımlılığı [XREQ-014](../../../docs/requests.md#xreq-014) kendi sahibinde açık kalır.

<a id="p02"></a>
### P02 — Çoklu kaynak ve operasyon personeli

- [x] **Tür:** D · **Plan:** Pro/Business · **Özellik:** F01,F02,F03,F05,F08,F13
- **Bağımlılık:** P01,S10
- **Kabul:** Çok oda/disiplin/eğitmen programı ve izinli resepsiyon işlemleri çalışır.
- **Sınır/olumsuz durum:** Fiziksel oda ve eğitmen çakışması; izinli personel yönetici/indirim yetkisini kazanmaz.
- **Doğrulama senaryosu:** Eşzamanlı iki farklı oda ve aynı eğitmen; izin değişikliği sonrası capability/komut reddi.
- **Kaynak alanı:** room/role/availability/schedule SQL; ilgili testler

**Backend teslimi:** Mevcut çok kaynak/izin yollarının native regresyonu ve [XREQ-015](../../../docs/requests.md#xreq-015) tam class/person/duty yönetim okuması aynı pakette PR167 ile main'e alındı. Varsayılan sınıf görevi okuması yeni yetki veya anlaşma önkoşulu açmaz; kaynak/test/ortam durumu [devir](00-FtkSaaS-yeni-sohbet-devir.md#p02-native-kaynak-paketi) sahibindedir. Aday/main/development kabulü doğrulandı; P02 backend teslimi tamamlandı.

<a id="p03"></a>
### P03 — İleri rezervasyon ve paket yaşam döngüsü

- [x] **Tür:** D · **Plan:** Pro/Business · **Özellik:** F09,F12,F17
- **Bağımlılık:** P02,S09
- **Kabul:** Bekleme teklifi ve kabul/ret; özel ders alternatifi; dondurma/değişim/sonlandırma çalışır.
- **Sınır/olumsuz durum:** Teklif zamanı/son hak yarışı; geçmiş hak ve kesin kayıt koruması.
- **Doğrulama senaryosu:** Expiry ile kabul yarışı, teklif reddi, paket değişimi sonrası uygunluk; kaynak boşluğu bulunursa ayrı dar düzeltme.
- **Kaynak alanı:** p01 lesson/waitlist; paket lifecycle; mevcut test

**Backend teslimi:** PR168 ile Pro/Business bağlı paket/teklif, alternatif/onay, canlı hak ve korunan kesin kayıt senaryoları aday/main/development kabulünü geçti. [Kaynak ve ortam kanıtı](00-FtkSaaS-yeni-sohbet-devir.md#p03p04-paralel-kaynak-paketi) sahibindedir.

<a id="p04"></a>
### P04 — Eğitmen anlaşma ve hakediş kapanışı

- [x] **Tür:** D · **Plan:** Pro/Business · **Özellik:** F13,F20,F19
- **Bağımlılık:** P02,S09
- **Kabul:** Geçerli anlaşma→görevlendirme→gerçek ders→hakediş→ödeme tutarlı.
- **Sınır/olumsuz durum:** İleri yürürlük geçmiş hakedişi değiştirmez; FIN-01 trailing earning_ids dar kontrolü.
- **Doğrulama senaryosu:** Sürüm/anlaşma değişimi, kapanmış ders düzeltmesi ve yanlış merkez/earning id; mevcut kabul korunur.
- **Kaynak alanı:** instructor-earnings SQL/test; ödeme okuması

**Backend teslimi:** PR168 ile Pro/Business bağlı tahsilat/rezervasyon/gerçek başlangıç/hakediş/ödeme ve gerekçeli düzeltme senaryoları aday/main/development kabulünü geçti. Mevcut FIN-01 ve finans fixture'ları korundu; [kaynak ve ortam kanıtı](00-FtkSaaS-yeni-sohbet-devir.md#p03p04-paralel-kaynak-paketi) sahibindedir.

**XREQ-013 backend düzeltmesi:** [Ortak talep](../../../docs/requests.md#xreq-013) için native anlaşma çözümlemesinden üretilen typed preview önkoşul tanısı PR159'da uygulandı; [yerel kaynak/gerçek test kanıtı](00-FtkSaaS-yeni-sohbet-devir.md#xreq-013-backend-incelemesi) sahibindedir. Backend aday/main/development teslimi doğrulandı; özgün hosted Business/consumer tekrarı açık. Mevcut anlaşma okuma/yayımlama → yeni preview → açık onaylı apply kullanılır; ek kural/ücret varsayımı, istisna veya blocker bypass yoktur. Starter anlaşmasız kalır. Frontend yönlendirme/ekranının sahibi kendi alanıdır; bu dar düzeltme P04 genel kapanışı değildir.

<a id="p05"></a>
### P05 — Telefon temelli ortak başvuru modeli

**Backend teslimi:** Starter temel aday/not/takip PR177; telefon temelli ortak alım/geçmiş ve P06 inceleme/eşleme PR182 ile aday/main/development kabulünü geçti. [Kaynak/ortam kanıtı](00-FtkSaaS-yeni-sohbet-devir.md#p05p06-ortak-alım-ve-xreq-016-kaynak-paketi) sahibindedir. Gerçek web formu ve sağlayıcı kabulü P07–P09'da kalır; frontend ekran kabulü ayrı tutulur.

**Karar uyumu ve ilk teslim:** [CRM kararı](../../../docs/decisions/P08-accepted-scope.md) ile [plan kapsamını](../../../docs/contracts/01-FtkSaaS-urun-kapsam-sozlesmesi.md) mevcut kişi/CRM/API kaynaklarına eşleştir; ayrı karar sprinti veya paralel backlog açma. Var olan kodu koru. Mevcut aşama/plan/kimlik kuralları yeniden sorulmaz; yalnız karşılığı olmayan ürün davranışı kullanıcıya getirilir. Fiziksel tablo/indeks/webhook teknik seçimlerini backend çözer. Ayrı fırsat nesnesini ilk teslim için varsayma.

- [x] **F21 makine aktarımı:** Yeni dar Starter hedefini makine metadata’sı, ürün matrisinin F21 hücresi, gerekli runtime/plan kapıları ve üretilmiş görünümle birlikte uzlaştır. Belge kararı nedeniyle genel CRM bayrağını koşulsuz açma; kabul edilmiş hedef ile gerçek desteği ayrı kanıtla.
- [x] **Starter temel dilimi (F21):** Elle aday kaydı, not, takip tarihi ve bunların liste/ayrıntı üzerinden yeniden okunması; yetki/plan ve tarih/saat anlamları açık sözleşme. P11'in ileri deneme/segment kapsamı bu dilime taşınmaz.
- [x] **Frontend sözleşme devri:** Mevcut makine kaynağından üretilmiş DTO/tip; gerekli okuma/yazma ve seçim verileri; WF sırası; yetki/plan, doğrulama/hata, başarı sonrası yeniden okuma ve belirsiz sonuç/replay davranışı. Desteklenmeyen yüzey hazır gösterilmez; frontend adına kabul verilmez.
- [x] **Temel kabul:** Yetkisiz tenant/merkez/aktör ve plan erişimi, not/takip kalıcılığı, aynı komutun tekrarında tek kayıt, farklı gerçek başvuruda geçmiş koruma, belirsiz telefon eşleşmesi ve otomatik hesap/öğrenci/satış/izin oluşmaması. Runtime, aday ve hosted kanıt ayrı tutulur.

Değişen dilimin sözleşme, üretilmiş tip/envanter, WF/F01–F33 izi ve alan devri aynı PR'da güncellenir. İş sırası [kuyruktadır](production-queue.md); bu görev aktif paketi değiştirmez. Sağlayıcı resmi erişim/izin/alan eşlemesi ve gerçek teslim/retry kabulü P08/P09'a aittir; Starter dilimini engellemez.

- [x] **Tür:** K · **Plan:** Starter temel dilim; Pro/Business ortak alım · **Özellik:** F07,F21,F25
- **Bağımlılık:** S03,A01
- **Kabul:** Telefon, form/kaynak/kampanya ve ayrı onay kanıtı tek ortak modelde tutulur.
- **Sınır/olumsuz durum:** İkinci paralel kişi/başvuru deposu yok; telefon doğrulanmış Auth iletişimi sayılmaz.
- **Doğrulama senaryosu:** Web iletişim/kayıt alanları kayıpsız eşlenir; aynı teslim dedupe, farklı gerçek başvurular ayrı kalır.
- **Kaynak alanı:** public_application/CRM SQL; contract.json; yeni migration/test

<a id="p06"></a>
### P06 — Başvuru inceleme ve kişi eşleme

- [x] **Tür:** K · **Plan:** Pro/Business · **Özellik:** F07,F21
- **Bağımlılık:** P05
- **Kabul:** Yetkili telefon eşleşme önerisini görüp mevcut kişiye bağlar veya yeni kişi oluşturur.
- **Sınır/olumsuz durum:** Otomatik merge yok; yeni öğrencilik yalnız açık dönüşümle, No ve kota denetimiyle oluşur.
- **Doğrulama senaryosu:** Ortak telefonlu iki kişi, kaynak geçmişi, tekrar inceleme ve sürüm çakışması.
- **Kaynak alanı:** CRM inbox/review/convert SQL; ilgili test

**P06 backend teslimi:** PR182 ile ortak telefon önerisi/açık eşleme, sürüm/replay/canlı yetki ve routing geçmişi teslim edildi; [kanıt](00-FtkSaaS-yeni-sohbet-devir.md#p05p06-ortak-alım-ve-xreq-016-kaynak-paketi). Gerçek site tüketicisi P07'de kalır.

<a id="p07"></a>
### P07 — Web formlarını ortak alıma bağla

- [ ] **Tür:** K/H · **Plan:** Pro/Business · **Özellik:** F21,F25
- **Bağımlılık:** P05,P06
- **Kabul:** Mevcut contact/kayit sunucu akışları ortak modele güvenilir biçimde bağlanabilir.
- **Sınır/olumsuz durum:** Mevcut site koruması korunur; istemci org/source beyanı yetki değildir; başka repo kendiliğinden değiştirilmez.
- **Doğrulama senaryosu:** Gerçek form→backend→inbox; partnerName/mode ve ayrı onayların kaybolmaması; site sahibiyle sınır devri.
- **Kaynak alanı:** backend ingress/adapter config; docs/requests backend devri

**Alt adımlar:**

- [x] P07.1 — Backend adaptör kaynağı: mevcut contact/kayit alanlarını tek yayımlanmış CRM DTO'suna eşle; ayrı onay sürümleri, sabit gönderim anahtarı/zamanı, partner/mode ve istemci atfı korunsun. Bu işaret yerel kaynak dilimidir; aday teslimi [devirde](00-FtkSaaS-yeni-sohbet-devir.md#p07-web-formu-adaptörü).
- [ ] P07.2 — Site sahibi güncel handler/DTO, iki formun güvenilir form_id ve gerçek onay metni/sürümlerini doğrulasın; mevcut hız/validasyon korumasından sonra adaptöre bağlasın. [XREQ-018](../../../docs/requests.md#xreq-018) sınır devri; başka repo veya frontend bu dilimde değiştirilmez.
- [ ] P07.3 — Yetkili gerçek form→Turnstile→backend→CRM inbox kabulü: iki form, ayrı onaylar/partner/mode, aynı teslim retry, yeni gerçek başvuru, yetkili kaynak/merkez okuması. Sunucu zamanı kullanılarak tarihsel onay üretilmez; site handler'ı doğrulanmadan alan eşlemesi canlı uyumluluk sayılmaz.

<a id="p08"></a>
### P08 — Meta yerel reklam formu alımı

- [ ] **Tür:** K/H · **Plan:** Pro/Business · **Özellik:** F21,F25
- **Bağımlılık:** P05,P06
- **Kabul:** Instagram/Facebook yerel form başvurusu ortak inboxa alınır.
- **Sınır/olumsuz durum:** Sosyal login değildir; provider/form org eşlemesi güvenilir, tokenlar gizli.
- **Doğrulama senaryosu:** Resmi erişim/yöntem uygulama anında doğrulanır; imza/izin, replay/retry ve alan eşleme; gerçek provider kanıtı.
- **Kaynak alanı:** sağlayıcı adapter/credential eşleme; ilgili test

**Ortak veri hedefi:** Son kullanıcı talimatıyla Meta (öncelikle Instagram reklamları) ve Google Ads başvuruları mevcut `core.public_applications` tablosunda birleşir. Sağlayıcı başına başvuru/kişi tablosu kurulmaz; kaynak/form/dış başvuru kimliği ve provider atfı aynı başvurunun kanıtıdır. İmza/anahtar doğrulaması sağlayıcıya özel, kalıcı alım/inbox/eşleme/dönüşüm ortaktır. Mevcut web_form-only eşlemesinin provider desteğine genişletilmesi P08.2b/P09.2b kaynak işidir; bu ilk doğrulama katmanı henüz provider kayıtlarını yazmaz.

**Uygulama dilimleri (P08–P11 ortak PR):**

- [ ] P08.1 — Resmi güncel Meta yöntemi, uygulama/hesap/sayfa/form yetkileri ve örnek alan sözleşmesini doğrula. Token paylaşmadan erişim eksiklerini ayır; gerçek erişim yoksa canlı kabul kapalı kalsın. Kaynak alanı: sağlayıcı transport/config; doğrulama: resmi kaynak ve yetki/form readback'i.
- [ ] P08.2 — Doğrulanmış sağlayıcı bildirimi→güvenilir form/tenant eşlemesi→mevcut ortak başvuru zincirini uygula. Sağlayıcı başvuru kimliğinde tekillik, yeniden teslim, geç hata rollback'i, kaynak/onay kanıtı ve telefon önerisi korunsun; ikinci başvuru deposu kurulmasın. Küçük imza/eşleme testleri ve izole native alım suite'i kullan; invalid sender, yanlış form/tenant ve yarış negatif olsun.
- [ ] P08.2a — Instagram önceliğiyle Meta Page leadgen doğrulama kaynağının aday/main kabulü: exact challenge/token, ham gövde SHA256 imzası, tam dış kimlik ve batch/zaman ayrımı. Bu dilim endpoint/kalıcı alım değildir; [kaynak/kanıt](00-FtkSaaS-yeni-sohbet-devir.md#p08p09-sağlayıcı-doğrulama-kaynak-dilimi) sahibindedir.
- [ ] P08.2b.1 — Meta Graph sunucu okuma katmanının kaynak/native kabulü: sabit Graph hostu, açık sürüm/credential ve Page/form sınırı, lead/form/ad tutarlılığı, ayrı field_data/custom_disclaimer_responses kanıtı. HTTP/payload sınırları küçük unit suite ile doğrulanır; gerçek Page token/form erişimi ayrıca gerekir. Bu katman ortak inbox yazımı veya onay normalizasyonu değildir.
- [ ] P08.2b.2 — Ortak native kalıcı alımın kaynak/aday kabulü: güvenilir provider/form tek eşlemesi, gerçek receiver LOGIN/form scope’u, kilit altında canlı yetki/plan, aynı tabloya dış lead tekilliği ve kapalı kaynak/onay görünümü. Meta/Google aynı sınırı kullanır; iki küçük native kökte yarış/inbox ve iptal/plan/rollback doğrulanır. Kaynak hazırlanması gerçek CI/hosted/provider kabulü değildir.
- [ ] P08.2b — Güvenilir Page/form eşlemesiyle yetkili Graph lead verisini ve custom_disclaimer_responses yanıtlarını al; ardından aynı ortak başvuru modeline kalıcı dış kimlik tekilliğiyle yaz. Instagram platformunu Page nesnesinden tahmin etme; gerçek form/reklam kanıtıyla koru. Güvenilir token/yetki, native/gerçek sağlayıcı kabulü açık kalır.
- [ ] P08.2c — HTTP/mapping adapter aday kabulü: imza → gerçek native form admission → Graph → açık alan/checkbox eşlemesi → receipt → ACK; küçük unit ve ayrı native HTTP kökü. Bu kaynak handler’ı hosted mount değildir.
- [ ] P08.2d — Kalıcı minimal Meta bildirim batch’i → ACK ve tekil lease worker kaynak/native kabulü; commit prefix’ini yeniden okuyarak sonraki kayıtları host timeout’unda aç bırakma. Kaynak kuyruğu provider başvuru deposu değildir; tenant/form/merkez snapshot ve kalıcı nonce tekilliği korunur. Canlı mount için host/DB süre bütçesi, düzenli worker zamanlaması, biriken/yeniden denenemeyen kayıt gözlemi ve gerçek URL/credential/form/onay/tekrar kabulü ayrıca gerekir.
- [ ] P08.2e — Son kullanıcı kapsamıyla endpoint/süre sınırı/worker zamanlaması/izleme kaynak paketini tek push ile merge adayına getir. Backend Node host, gerçek HTTP/native LOGIN kabulü ve korumalı aggregate status aynı PR’dedir. Gerçek hosted yerleşim/TLS URL readback’i dağıtımda ayrıca doğrulanır; kaynak host implementasyonu yayında demek değildir.
- [ ] **Ertelenen sağlayıcı kabulü:** Kullanıcı kararıyla gerçek Meta/Google hesap/token/izin/form/alan-onay kurulumu ve gerçek teslim/tekrar testleri bu merge paketini bekletmez; tamamlandı işaretlenmez. Kuyruk metadata retention/temizleme ve gerçek yük/izleme alarmı eşikleri de kanıtsız kapatılmaz.
- [ ] P08.3 — Yetkili gerçek Meta formundan tek kayıt ve retry kabulünü doğrula; yetkili inbox yeniden okumasıyla bağla. Sentetik payload başarıları gerçek sağlayıcı erişimi/teslimi yerine geçmez. Hesap erişimi veya entegrasyon kurulumu gerektiğinde somut eksik üzerinden ilerle.

<a id="p09"></a>
### P09 — Google yerel reklam formu alımı

- [ ] **Tür:** K/H · **Plan:** Pro/Business · **Özellik:** F21,F25
- **Bağımlılık:** P05,P06
- **Kabul:** Google yerel reklam formu ortak kaynağa alınır.
- **Sınır/olumsuz durum:** Web forma yönlendirme ile native form ayrıdır; Meta kabulü Google kanıtı değildir.
- **Doğrulama senaryosu:** Güncel resmi erişim/yöntem incelemesi, gönderici doğrulama, dedupe/geri doldurma ve gerçek sağlayıcı kabulü.
- **Kaynak alanı:** Google adapter/config; ilgili test

**Uygulama dilimleri:**

- [ ] P09.1 — Güncel Google yerel lead formunun resmi teslim/yetkilendirme ve alan/kimlik sözleşmesini doğrula. Reklamdan web forma yönlendirmeyi bu yolla karıştırma; Meta token/yetki/alanlarını Google'a taşıma. Kaynak alanı: ayrı Google transport/config; doğrulama: resmi kaynak ve gerçek form erişimi.
- [ ] P09.2 — Doğrulanmış gönderici ve güvenilir form eşlemesiyle ortak alıma bağla; aynı dış kimlik retry tek kayıt, farklı gerçek başvurular ayrı geçmiş olsun. Sağlayıcı yeniden teslim/geri doldurma yolu varsa aynı tekillik kuralını uygula. Küçük doğrulama/alan testi ve izole native ortak alım kabulü; geçersiz kimlik, yanlış eşleme ve kısmi hata negatif olsun.
- [ ] P09.2a — Google anahtar/form doğrulama ve normalizasyon kaynağının aday/main kabulü: int64 hassasiyeti, column_id eşlemesi, test/zaman/atfın korunması. [Kaynak/kanıt](00-FtkSaaS-yeni-sohbet-devir.md#p08p09-sağlayıcı-doğrulama-kaynak-dilimi); endpoint veya inbox yazımı değildir.
- [ ] P09.2b.1 — P08.2b.2 ortak native alımını Google kaynak kimliği/test/zaman/atıf verisiyle doğrula; ayrı başvuru deposu kurulmaz. HTTP receiver/custom soru-onay eşlemesi ve gerçek Google teslimi ayrıca açık kalır.
- [ ] P09.2b — Güvenilir provider/form→tenant eşlemesi, kalıcı lead_id tekilliği, custom soru/onay alanları, test kayıtları ve HTTP retry/ack ile ortak alımı tamamla. Provider kaynağını web_form gibi gösterme; web CAPTCHA'yı sentetik proof/bot_verified ile aşma.
- [ ] P09.2c — Google HTTP200{} yalnız kalıcı receipt sonrası; kimlik/payload4xx ile geçici işlem5xx ayrımı, yalnız açık column_id alan/onay eşlemesi ve ortak native inbox readback kabulü. Gerçek form metni/sürümü/soru kimliği ve hosted URL doğrulanmadan live kapanış yoktur.
- [ ] P09.3 — Yetkili gerçek Google formu→inbox ve tekrar teslimini doğrula; Meta başarısını Google kabulü sayma. Gerçek erişim eksikse mevcut bağımsız kaynak/test dilimlerini durdurma, bu kabulü açık bırak.

<a id="p10"></a>
### P10 — Eski başvuru kontrollü aktarımı

- [ ] **Tür:** K/H · **Plan:** Pro/Business · **Özellik:** F21,F31
- **Bağımlılık:** P05,P06
- **Kabul:** Alan/mükerrer/onay önizlemesinden seçilen kayıtlar yetkili onayıyla taşınır.
- **Sınır/olumsuz durum:** Kaynak silinmez; kanıtsız pazarlama izni üretilemez; gerçek veri fixture olmaz.
- **Doğrulama senaryosu:** Örnek veriyle tekrar/rollback/mutabakat; gerçek aktarım için ayrı somut önizleme ve kullanıcı yetkisi.
- **Kaynak alanı:** import preview/CRM mapping; aktarım runbook/test

**Uygulama dilimleri:**

**Kaynak dilimi:** Mevcut CSV/Storage/import job/preview/apply/worker yeniden kullanılır; `mapping.kind=crm_applications` açık ayrımdır, kind yoksa öğrenci davranışı değişmez. CRM satırı yalnız ortak `public_applications` üretir; seçili set tek transaction, kalıcı source tür/kimliği ve canlı import+CRM scope’u korunur. P10.1/P10.2 kaynak/native aday, merge/main ve development teslimi doğrulandı; P10.3 gerçek veri aktarımı ayrı açık. Teknik sınırlar ve API sırası WF11 sahibindedir.

- [x] P10.1 — Mevcut import preview/apply altyapısını ve eski başvuru alanlarını incele; yalnız eksik CRM eşlemesini ekle. Önizleme kaynak kimliği, alan hatası, olası mükerrerlik, kaynak/onay kanıtı ve seçilebilir satırları göstermeli. Eksik onay sürümü/zamanı uydurulmasın; gerçek kişisel veri test fixture'ı yapılmasın. Kaynak alanı: mevcut import/CRM kaynakları ve ayrı küçük parser/preview testi.
- [x] P10.2 — Onaylanmış sabit önizleme/kaynak üzerinden yalnız seçilen kayıtları uygula; scope/plan/rol değişimini yeniden denetle. Aynı aktarım replay tek kayıt; değiştirilmiş snapshot/seçim ve geç hata reddi atomik olsun. İzole native preview→apply→readback, yarış/rollback ve sayım mutabakatı kullan.
- [ ] P10.3 — Gerçek kaynak için somut önizleme ve seçilecek satırlar kullanıcı tarafından onaylanmadan hosted aktarım yapma. Kaynağı silme/değiştirme; çıktı/rapora kişisel veri veya secret yazma. Bu PR kaynak uygulaması canlı aktarım yetkisi değildir.

<a id="p11"></a>
### P11 — Deneme, takip ve segment tam akışı

- [x] **Tür:** D/K · **Plan:** Pro/Business · **Özellik:** F22,F23,F24
- **Bağımlılık:** P06
- **Kabul:** Lead→deneme→takip→öğrenci dönüşümü; yenileme/hareketsizlik listesi ve segment yönetimi tamamdır.
- **Sınır/olumsuz durum:** Segment liste/detail kaynakta var; baştan icat edilmez; otomatik pazarlama gönderimi kapalı.
- **Doğrulama senaryosu:** Tenant config süre/tekrar, kontrollü indirim, segment sonucu ve tekrar çalışmada çift görev olmaması.
- **Kaynak alanı:** p04 CRM/p05 segment-automation; mevcut acceptance

**Uygulama dilimleri:**

**Kaynak incelemesi ve uygulama:** Mevcut P04 free/paid trial ve dönüşüm kaynakları korunur. Pro F24 worker plan uyumu migration110 ile düzeltilir; beş küçük bağımsız native kök; yetki/faaliyet, dönüşüm/kota/Abone No/rollback, yenileme/hareketsizlik projeksiyonu, canlı segment ve worker yetki/tekilliğini ayrı fixture ile sınar. P11.2/P11.3 aday/main kaynak kabulü ve PR204 sonrası gerçek development teslimi doğrulandı; backend P11 kapsamı tamamlandı. Kaynak/ortam kanıtı devir sahibindedir. Frontend ekran kabulü, gerçek Meta/Google ve P10.3 aktarımı bu kapanışa dahil değildir.

- [x] P11.1 — Mevcut lead/trial/activity/convert ve segment liste/detail/config/worker kodunu senaryo bazında eşle; kaynakta çalışan yolu yeniden yazma. Yalnız doğrulanmış sözleşme/runtime/kabul boşluklarını düzelt. Kaynak alanı: p04 CRM, p05 segment/automation ve mevcut kabul testleri; F22/F23/F24 izi aynı dilimde güncellensin.
- [x] P11.2 — Lead→deneme→sonuç/takip→açık öğrenci dönüşümü için tenant konfigürasyonu, süre/tekrar ve izinli indirim sınırlarını native testle doğrula. Başvuru tek başına öğrencilik/No/satış/rezervasyon açmasın; dönüşüm mevcut No/kota/kimlik kapılarını kullansın. Stale sürüm, canlı rol/plan kaybı, aynı komut replay ve geç hata negatif olsun.
- [x] P11.3 — Yenileme/hareketsizlik ve segment kapsamı ile tekrarlı çalışmada çift görev oluşmamasını doğrula. Var olan worker sınırını kullan; kampanya/pazarlama e-postası açma. P14–P16 bildirim teslimi/otomasyon genişletmesini bu kaynak kapanışına taşımadan bağımlılıklarını koru.

<a id="p12"></a>
### P12 — Etkinlik kapasitesi modeli

- [x] **Tür:** K · **Plan:** Pro/Business · **Özellik:** F29
- **Bağımlılık:** P02
- **Kabul:** Odaya bağlı etkinlik sonlu ve oda tavanı içinde; odasızda sonlu/sınırsız seçim.
- **Sınır/olumsuz durum:** 0/büyük sayı sentinel yok; sınırsıza oda bağlama ve kapasite düşürmede mevcut kesin kayıt korunur.
- **Doğrulama senaryosu:** Son yer yarışı; oda tavanı; uyumsuz oda bağlama açık ret/çözüm; mevcut iptal/iade regresyonu.
- **Kaynak alanı:** event/capacity SQL; contract.json; migration; event test

**Backend teslimi:** PR172 aday/main/development kabulüyle tamamlandı. Uygulama, kaynak/ortam kanıtı ve frontend kabul sınırı [P12/P13 devrindedir](00-FtkSaaS-yeni-sohbet-devir.md#p12p13-etkinlik-kaynak-paketi).

<a id="p13"></a>
### P13 — Kredi tüketmeyen paketli Pratik

- [x] **Tür:** K · **Plan:** Pro/Business · **Özellik:** F15,F16,F17,F29,F14
- **Bağımlılık:** P12,P03
- **Kabul:** Geçerli/pozitif kullanılabilir hakla kayıt; yalnız etkinlik yeri ayrılır, ders bakiyesi değişmez.
- **Sınır/olumsuz durum:** Sonradan uygunsuz kayıt silinmez; katılım tekrar kontrol, uygunsuz fiilî katılım gerçeği kaydedilir.
- **Doğrulama senaryosu:** Son ders tüketimiyle kayıt/katılım yarışı, dondurma/iade/yeni paket, borç; öncesi-sonrası kredi ledger eşitliği.
- **Kaynak alanı:** event eligibility/register/attendance SQL; contract.json; ilgili test

**Backend teslimi:** PR172 aday/main/development kabulüyle tamamlandı. Uygulama, kaynak/ortam kanıtı ve frontend kabul sınırı [P12/P13 devrindedir](00-FtkSaaS-yeni-sohbet-devir.md#p12p13-etkinlik-kaynak-paketi).

<a id="p14"></a>
### P14 — İşlemsel e-posta teslimi

- [x] **Tür:** K/H · **Plan:** Pro/Business · **Özellik:** F26,F24
- **Bağımlılık:** S07,P01
- **Kabul:** İşlemsel e-posta oluşturma, teslim sonucu ve hata gözlenir; in_app korunur.
- **Sınır/olumsuz durum:** Starter dış kanal kapalı; Native Auth ayrı; pazarlama/özet/SMS/push kapalı.
- **Doğrulama senaryosu:** Timeout/unknown, retry/bounce ve iptal edilen olay; provider dedupe sınırları açık; gerçek teslim ayrıca yetkili kanıt.
- **Kaynak alanı:** p05 notification/worker/adaptör; contract.json; teslim testleri

**Uygulama dilimleri:**

- [x] P14.1 — Mevcut Resend davet sağlayıcı çağrısını ortak tek-deneme transport'una taşı; accepted/rejected/retryable/unknown, aynı payload/idempotency ve sır sızdırmayan sonuçları doğrula. PR205 aday/main/development kabulüyle mevcut davet entegrasyonu ve ortak transport teslim edildi; genel email kuyruğu P14.2 sahibindedir.
- [x] P14.2 — Kalıcı genel email claim/authorize/finish, canlı plan/tercih/alıcı/kaynak, frozen payload/lease/retry ve terminal payload temizliği PR210 aday/main/development kabulüyle teslim edildi; gerçek alıcı kabulü P14.4'tedir.
- [x] P14.3 — İmzalı provider olayları, tekillik/sırasızlık, genel email ve davet teslim projeksiyonu ile bounded orphan temizliği PR210 kaynak/native/main/development kabulünü geçti. Canlı webhook kurulumu/gerçek teslim P14.4'tedir.
- [x] P14.4 — PR216 main/development sonrası gerçek Pro hesabında native Auth→tercih→rol işlemi→transactional_email kuyruğu→Resend→imzalı webhook→notifications_list teslim/hata görünürlüğü doğrulandı. Gerçek teslim, kalıcı sağlayıcı reddi, tekrar olay tekilliği, opt-out ve in_app korunması geçti; [kaynak/ortam kanıtı](00-FtkSaaS-yeni-sohbet-devir.md#p14-kaynak-ve-canlı-kabul-kapanışı). P15/P16 ayrı sıradadır.

<a id="p15"></a>
### P15 — Hatırlatma planlama ve sessiz saat

- [x] **Tür:** K · **Plan:** Pro/Business · **Özellik:** F27,F03,F24
- **Bağımlılık:** P14,S10
- **Kabul:** Ders/paket ayarları ve Business miras; merkez olay zamanı, kullanıcının sessiz saatine uygun gönderim.
- **Sınır/olumsuz durum:** Geçersiz hatırlatma atlanır; işlemsel/in_app/Auth ertelenmez; digest kullanılabilir değildir. Önceden kabul edilmiş seçenek/defaultlar FD04’ten alınır; bu plan yeni default seçmez.
- **Doğrulama senaryosu:** Geceyi aşan aralık, yaz/kış saati, ders değişimi/iptali, preference değişimi ve kuyruk gecikmesi; son anda tekrar uygunluk.
- **Kaynak alanı:** reminder-scheduling/workers/email SQL, settings catalog v11, contract.json ve reminder-scheduling/transactional-email acceptance.
- **Teslim durumu:** Kaynak/native/main/development ve gerçek Pro/Business kabulü tamamlandı. Business izin kapısı, merkez override, parent-version stale reset ve canlı miras; Pro sessiz saat/provider teslimi ile özgün ayar geri yüklemesi [devirde](00-FtkSaaS-yeni-sohbet-devir.md#p15-business-canlı-kabul-kapanışı--6-kasım-2026) kanıtlıdır. Frontend ekran kabulü kendi sahibindedir.

<a id="p16"></a>
### P16 — Otomasyon sonuç ve hata akışı

- [x] **Tür:** D/K · **Plan:** Pro/Business · **Özellik:** F23,F24,F26,F27
- **Bağımlılık:** P11,P15; backend kabulü tamamlandı.
- **Kabul:** Desteklenen trigger/action görev veya hizmet hatırlatması üretir; sonuç/hata ve disable/retry görünür.
- **Sınır/olumsuz durum:** Kampanya/indirim/geri kazanım maili açılmaz; tekrar iş aynı domain sonucu üretir.
- **Doğrulama senaryosu:** Segment değişimi, yetki/plan kaybı, worker kesintisi ve işlem öncesi koşul denetimi.
- **Kaynak alanı:** automation-results SQL, P05 worker/management ve automation-results acceptance.
- **Teslim durumu:** PR219 native/main/development teslimi tamamlandı. Son20 iş/güvenli hata/domain sonuç referansı, disable ve canlı denetimli sürümlü retry teslim edildi. Gerçek cron→API sonucu, tek takip, tamamlanmış işe retry reddi, sürüm çatışması ve disable sonrası yeni kaynakta çalışmama geçti. Native güvenli hata/lease/retry kanıtı korunur; gerçek kaynak/ortam sonuçları [devir kontrol noktasında](00-FtkSaaS-yeni-sohbet-devir.md#pr221-teslim-ve-6-kasım-canlı-kontrol-noktası) izlenir.

## Business işlevleri

<a id="b01"></a>
### B01 — Business merkez ve birleşik kişi yetkisi

- [x] **Tür:** D/K · **Plan:** Business · **Özellik:** F01,F03,F04,F05,F07
- **Bağımlılık:** P01,P02,S05
- **Kabul:** Beş merkeze kadar günlük yönetim; aynı öğrenci No ve org kotasında tek sayılır.
- **Sınır/olumsuz durum:** Merkez yöneticisi başka merkez kişisel/finans verisini göremez; org yetkisi ayrı.
- **Doğrulama senaryosu:** A/B merkez rollerini aynı kişiyle değiştir; birleşik okuma ve komut reddi; kapanan merkez eski kayıt koruması.
- **Kaynak alanı:** center lifecycle/role/person SQL; mevcut scope testleri

- **Teslim durumu:** Native standart kapasite/planla kapanan kapsam-geçmiş testleri ile gerçek iki merkez kota/Abone No ve sınırlı aktör okuma/yazma/yetki kaybı kabulü geçti; [kanıt](00-FtkSaaS-yeni-sohbet-devir.md#b01-gerçek-iki-merkez-ve-canlı-yetki). Hosted fiziksel merkez kapatma iddiası yoktur.

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
- **Bağımlılık:** G01,G02,B01–B04; O01–O10
- **Kabul:** 5 merkez/1250, ortak CRM, org raporu ve hesaplaşma uçtan uca; 33 özellik izlenebilir.
- **Sınır/olumsuz durum:** Her plan kendi kapısını taşır; genel güvenlik/retention kapıları korunur.
- **Doğrulama senaryosu:** A/B merkez+org rolleri, restore ve yük kanıtı; bütün uygulanabilir K/T/H tamam, son kaynak incelemesi.
- **Kaynak alanı:** backend kabul matrisi; devir/backlog/kuyruk

## F01–F33 kapsama izi

A03.1 operasyonları tek WF sahibine ve F01–F33 normatif plan izine bağladı; güncel eşleme ve operasyon envanteri [üretilmiş API haritasından](../../../docs/functions.md) okunur. `features=[]` olan ortak ayar/medya operasyonları WF12 üzerinden S10 kapsamındadır. Ortak altyapıya yapay F etiketi atanmadı. Aşağıdaki akışların kaynak/test bağları `docs/workflows.json`, okunabilir görünümü [API haritası](../../../docs/functions.md) sahibindedir. Eksik WF test bağları mevcut gerçek test/SQL fixture kaynaklarıyla tamamlandı; yeni runtime başarısı iddia edilmez. Abonelik yükseltme/iptal testlerinin SQL dispatcher kabulü gerçek HTTP kabulünden ayrılır; grace uzatmanın negatif yetki kontrolü olumlu uzatma kabulü değildir. Bu eksikler S16 ve O10 kapsamında kalır. Her özelliğin hosted/plan bütünlük kabulü ilgili S/P/B/O ve G görevlerinde açık kalır; aday kaynağın test/ortam sonucu yalnız devirde tutulur.

A03 ve G03 genel iz/kabul kapılarıdır. Aşağıdaki tablo görev navigasyonudur; ikinci durum veya plan erişimi matrisi değildir. Plan erişimi yalnız ürün sözleşmesinden alınır.

| Özellik | Ad | Görevler | Kaynak/test akışı |
|---|---|---|---|
| F01 | İşletme, merkez, oda ve kaynak tanımı | S01, P01, P02, B01 | [WF02](../../../docs/workflows.md#wf02), [WF17](../../../docs/workflows.md#wf17) |
| F02 | Çalışma saatleri, izin ve uygunluk | S09, S10, P02 | [WF03](../../../docs/workflows.md#wf03), [WF12](../../../docs/workflows.md#wf12) |
| F03 | İşletme kuralları ve merkez istisnaları | S01, S10, P15, B01 | [WF03](../../../docs/workflows.md#wf03) |
| F04 | Hesap eşleştirme, çoklu rol, kapsamlı yetkilendirme | S06–S08, S10, B01 | [WF00](../../../docs/workflows.md#wf00), [WF02](../../../docs/workflows.md#wf02), [WF04](../../../docs/workflows.md#wf04), [WF17](../../../docs/workflows.md#wf17), [WF18](../../../docs/workflows.md#wf18) |
| F05 | Resepsiyon/operasyon personeli izinleri | P02, B01 | [WF02](../../../docs/workflows.md#wf02) |
| F06 | Öğrenci/eğitmen panelleri, profil ve şifre işlemleri | S06–S08, S10 | [WF00](../../../docs/workflows.md#wf00), [WF01](../../../docs/workflows.md#wf01), [WF04](../../../docs/workflows.md#wf04), [WF05](../../../docs/workflows.md#wf05), [WF06](../../../docs/workflows.md#wf06), [WF08](../../../docs/workflows.md#wf08), [WF10](../../../docs/workflows.md#wf10), [WF17](../../../docs/workflows.md#wf17), [WF20](../../../docs/workflows.md#wf20) |
| F07 | Tek kişi kaydı, adaydan öğrenciye dönüşüm | S03–S05, S12, P01, P05, P06, B01 | [WF04](../../../docs/workflows.md#wf04), [WF10](../../../docs/workflows.md#wf10), [WF16](../../../docs/workflows.md#wf16), [WF20](../../../docs/workflows.md#wf20) |
| F08 | Birleşik takvim ve kaynak çakışma kontrolü | S02, S09, S15, P02 | [WF00](../../../docs/workflows.md#wf00), [WF03](../../../docs/workflows.md#wf03), [WF09](../../../docs/workflows.md#wf09) |
| F09 | Özel ders talep, onay, ret ve alternatif saat | S09, P03 | [WF00](../../../docs/workflows.md#wf00), [WF03](../../../docs/workflows.md#wf03), [WF06](../../../docs/workflows.md#wf06), [WF20](../../../docs/workflows.md#wf20) |
| F10 | Tekrarlayan grup programı ve sabit gruba kayıt | S02, S09 | [WF00](../../../docs/workflows.md#wf00), [WF03](../../../docs/workflows.md#wf03), [WF05](../../../docs/workflows.md#wf05), [WF06](../../../docs/workflows.md#wf06) |
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
| F21 | Aday, kaynak, ilgi, takip ve dönüşüm | P05 Starter temel; P05–P11, B02, B04 üst-plan | [WF09](../../../docs/workflows.md#wf09), [WF10](../../../docs/workflows.md#wf10), [WF16](../../../docs/workflows.md#wf16), [WF20](../../../docs/workflows.md#wf20) |
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
| F32 | İşletme aboneliği, erişim ve kullanım limitleri | S16, P01 | [WF02](../../../docs/workflows.md#wf02), [WF04](../../../docs/workflows.md#wf04), [WF13](../../../docs/workflows.md#wf13), [WF17](../../../docs/workflows.md#wf17), [WF20](../../../docs/workflows.md#wf20) |
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
