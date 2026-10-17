# FtkSaaS — güncel başlangıç

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
