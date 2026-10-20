> **Güncel kaynak sınırı:** Bu dosyanın eski teslim sayıları kendi kaynak snapshot’ıdır. Güncel main 7577b2f1873c6b1fcf83390bfa94a34374c44082, 199/118/81 ve 34 migration; kaynak/CI [tek devirde](../contracts/00-FtkSaaS-yeni-sohbet-devir.md), güncel açık işler [kalan işlerde](remaining-work.md) izlenir.

# Merkezler arası hesaplaşma — üçüncü teslim

Başlangıç main `bd4b6335904047f071556e5df35a982a71012c6e`; önceki temiz CI 364 test/28 migration idi. Bu teslim 29. migration ve dokuz API ekler: 199 toplam / 104 çağrılabilir / 95 yalnız sözleşme. Son head incelemesi ve temiz CI, ardından aynı merge SHA CI sonucu PR üzerinde ayrıca doğrulanır. Geliştirmedeki odaklı kabul final kaynak kabulünün yerine geçmez.

## Ekonomik kaynak ve atomiklik

Kredili A satışıyla B'de gerçekleşmiş ve hak tüketilmiş dersin kapanışı A→B payını üretir. Gerçek satış neti ve orijinal kredi sayısı kullanılır; tahsilat beklenmez, B eğitmen maliyetinden türetilmez. Süreli, aynı merkez, serbest hak ve kaynak paketsiz ilk negatif katılım pay üretmez. Uygun sonraki satış geçmiş tüketilmiş açığı kapatınca pay oluşur; eğitmenin eski değerlemesi değişmez. Dersin gerçekleşme beyanı kapanışın değişmez earnings snapshot'ından alınır.

Kuruş dağılımı sabit satış kredi dilimleriyle yapılır: taban pay ve kalan kuruşlar en küçük dilim indekslerine atanır. Yerel/etkinlik kullanımı aynı dilimleri işgal eder; başka merkez kullanımı kalan kuruşları yeniden kazanamaz. Dilim seçimi paket kredi sayısına göre tarama yapmaz, işgal edilmiş dilim ve istenen miktarla sınırlıdır. Serbest bırakılan dilim yeniden kullanılabilir; geçmiş ledger tutarı değişmez. Migration yalnız mevcut allocation dilimlerini hazırlar, tarihsel hesaplaşma üretmez.

Kredi iadesi özgün payın tam tutarına bağlı reversal ekler. Açık kısım kapatılır, önceden ödenmiş kısım ters yönde iade/mahsup bakiyesi olur. Eski ödeme silinmez. Yeniden tüketim yeni accrual üretir; eski ters kayıt korunur. Kapanış, düzeltme ve satış kaynak etkileri domain, audit/outbox ve receipt ile aynı transaction içindedir.

## Dokuz API ve canlı yetki

- `settlement_authority_get_v1`: dar idari projeksiyon ve organizasyon yetki aggregate sürümü. Owner hedefleri, delege OM CM hedeflerini, CM kendi merkez yetkilerini okur; finans defteri açılmaz.
- `settlement_delegation_set_v1`: yalnız Owner, aktif OM'ye devretme izni verir/geri alır.
- `settlement_authority_set_v1`: Owner veya açık canlı delege OM, tam merkezde aktif CM'ye hesaplaşma grantı verir/geri alır. Beklenen organizasyon aggregate sürümü zorunludur.
- `settlement_movements_list_v1`, `settlement_requests_list_v1`, `settlement_request_get_v1`: seçilen merkezin canlı CM rolü ve açık grantı gerekir. Cursor aktör, merkez, işlem ve filtreye bağlıdır.
- `settlement_request_submit_v1`: A merkezinde açık yetkili CM değişmez ödeme/mahsup/bağlı düzeltme önerisi açar; bakiye değişmez.
- `settlement_request_withdraw_v1`: başlatan, güncel A yetkisiyle yalnız pending başvuruyu geri çeker.
- `settlement_request_decide_v1`: B saklanan `to_center_id` üzerinden bağımsız doğrulanır. Aynı hesap iki merkezde yetkiliyse iki adımı yapabilir; istemci merkez seçimi yetki değildir. Onay kayıt/dağıtım/bakiye/request/audit/outbox/receipt'i atomik kesinleştirir. Ret gerekçesi A'ya uygulama içi gider; bakiye değişmez.

Owner/OM rolü veya idari grant yönetimi operasyon yetkisi yaratmaz. Organizasyon kilidi canlı rol/grant geri alma ve finansal işlemleri sıralar; eski oturum, pending başvuru ve receipt yetkiyi korumaz. B onayında özgün A rol/grant sürümü de doğrulanır. Başvuruda abonelik kimliği, plan sürümü, plan/state geçiş sayacı, erişim modu ve A/B erişimi dondurulur. Planın değiştirilip eski sürüme döndürülmesi de başvuruyu stale yapar; yalnız ödeme muhasebesinin abonelik sürümünü artırması yapmaz. İlgisiz yeni ders başvuruyu stale yapmaz; seçilen hareket/record/allocation değişikliği yeni onay gerektirir.

Ödeme seçili açık hareket toplamına eşittir. Mahsup açıkça seçilen aynı para birimindeki karşıt iki toplamı eşit azaltır. Bağlı düzeltme özgün record ve allocation kimlik/sürüm/kalan terslenebilir tutarını ister; dağıtım varsayılmaz. Ödeme geçmişi korunur, yeni nakit teslimi veya otomatik netleme yapılmaz. Saklanan çok satırlı kapsamın UUID ihtiyacı DB'de yetki kontrolünden sonra hesaplanır; Edge bu güvenilir boyutla receipt yazılmadan tekrarlar.

## Doğrulanmış kaynak kabulü

`3aa5effa0fe48ab7dc4c8d4ca97754b5392fa0ad` için [tam temiz CI](https://github.com/SXQHex/FtkSaaS/actions/runs/39198323012) başarılı: **394 test (95 yapısal/sözleşme + 27 DB + 272 Auth/API)**, 29 migration, sentetik seed, Auth/REST sağlık ve advisors başarılı; atlanan test yok. Hesaplaşma dosyasında 29 gerçek Auth → Edge → RPC senaryosu vardır. Bu kanıt belirtilen SHA içindir; sonraki belge/metaveri commit'i ve merge main CI ayrıca doğrulanır.

## Kabul ve sınırlar

`tests/cross-center-settlement.test.mjs` gerçek Auth → Edge → RPC testidir; büyük kapsam testindeki sentetik ledger fixture'ı tahakkuk üretim kanıtı değildir, onay kapasitesi testidir. Ayrı ders/satış testleri gerçek tahakkuk ve terslemeyi doğrular. Yapısal governance/AJV/enum kontrolleri davranış kabulü değildir. Nihai kaynak kabulü tam `npm run test:clean` ve son head bağımsız incelemesiyle bağlanır.

Eğitmen ödeme API'leri, satış kapsam değişimi/backdate yönetim akışı, diğer hak koruma tüketicileri, frontend gerçek entegrasyonu ve yük/restore ayrı açık işlerdir. Hosted eski smoke ne bu teslimin 104 işlem snapshot’ının ne P01 sonrası 118 işlemin uzaktan kabulüdür. Dış e-posta ertelendi; Resend başlatılmaz. Production dağıtımı yapılmaz.

