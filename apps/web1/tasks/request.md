# Web1 · Backend talepleri

18 Kasım 2026 · Frontend talep kaydı. Bu dosya backend ihtiyaçlarının ve karşılanma durumlarının ayrıntı sahibidir. Ekran sırası, uygulama ilerlemesi ve frontend kabulü [TODO](todo.md) içinde kalır. **41 talebin kaynak desteği karşılandı. W1-BE-42 backend development’a teslim edildi ve Web1 adayında doğrulandı. Yayımlı Web1 kabulü açık. W1-BE-43–49 backend değerlendirmesi için açık.** W1-BE-36’nın sağlayıcı kontrolleri TODO’da izlenir. W1-BE-35’in aynı kaynaklı development teslimi başarılı.

İncelenen main `b219f2be822338b40460f1bb981e00d07b6be70e`. PR328’in kurtarma aracı [W1-BE-36](#w1-be-36--native-auth-recovery-kabul-aracının-callback-kaynağı) kaydında, önceki yönetici rolü keşfi W1-BE-35 kaydındadır. [Aynı SHA'nın Main proof sonucu](https://github.com/SXQHex/FtkSaaS/actions/runs/44192177548) başarılı.

PR322–324 ve PR327 tüketici dalına birleştirildi; kanonik üreticiden yerel typed snapshot güncellendi. Frontend tüketimi ve ekran kabulü TODO sahibindedir. Backend kaynak desteği; development dağıtımı, frontend tüketimi, ekran kabulü veya gerçek hosted/provider kabulü değildir. Ekran durumu yalnız [TODO](todo.md) sahibindedir.

| Kimlik   | Ekran / işlev             | İhtiyaç                                                                          | Frontend tarafından bilinen durum                                                                                                                                                                                                         |
| -------- | ------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| W1-BE-01 | E13 · P04                 | Merkez öğrencilik durumuna göre cursor’lı kişi filtresi                          | Backend karşılandı (PR311); tüketici kabulü TODO/E13 sahibinde.                                                                                                                                                                           |
| W1-BE-02 | E13 · P04                 | Görünür kişi sayfası için hak, para birimine göre borç ve en yakın ders özeti    | Backend karşılandı (PR311); tüketici kabulü TODO/E13 sahibinde.                                                                                                                                                                           |
| W1-BE-03 | E15 · P04.3               | Merkez geneli davet/hesap bağlantısı keşfi, filtreler ve sayaçlar                | PR313 kişi dizini düzeltmesi mevcut; önceki503 tarihsel gözlemdir, güncel hosted tekrar kabulü yapılmadı.                                                                                                                                 |
| W1-BE-04 | E16 · P04.4               | Birleştirme gerekçesi, öneri/geçmiş keşfi ve kalıcı kopya-değil kararı           | Backend karşılandı (PR312); tüketici kabulü TODO/E16 sahibinde.                                                                                                                                                                           |
| W1-BE-05 | E12 · P03.3               | Son uygunluk kuralını kapatma ve mevcut kapanışı iptal etme                      | Backend karşılandı (PR312); tüketici kabulü TODO/E12 sahibinde.                                                                                                                                                                           |
| W1-BE-06 | E17 · P06                 | Sabit grup öğrenci üyeliğinin keşif ve ekle/çıkar native eşlemesi                | PR313 eşlemesi mevcut: sabit grup seans priority rezervasyonlarıdır; E17 tüketimi tamam; ekran kabulünün sahibi TODO/E17.                                                                                                                 |
| W1-BE-07 | E17 · P06.3/.4            | Seans düzenleme ve kalıcı telafi bağı için native okuma eşlemesi                 | PR313 typed düzenleme/telafi projeksiyonları mevcut; E17 tüketimi tamam; ekran kabulünün sahibi TODO/E17.                                                                                                                                 |
| W1-BE-08 | E17 · aynı-key kurtarma   | Native telafi komutu receipt okumasının typed request ile doğrulanması           | PR313 native capacity/receipt recovery düzeltmesi ve otomatik backend kabul testi mevcut; E17 tüketimi tamam; ekran kabulünün sahibi TODO/E17.                                                                                            |
| W1-BE-09 | E19 · P07                 | Paket yönetimi durum/arama/özet/geçmiş ve satışa kapatma/arşiv eşlemesi          | Backend karşılandı (PR313); yönetim/durum/geçmiş tüketiliyor, kabul sahibi TODO/E19.                                                                                                                                                      |
| W1-BE-10 | E20 · P08                 | Merkez geneli finans hareket/borç/alacak keşfi ve para birimine ayrılmış özetler | Backend karşılandı (PR313): finance_directory_get_v1 mevcut; frontend tüketimi TODO/E20 sahibinde.                                                                                                                                        |
| W1-BE-11 | E14 · P04/P07             | Üyelik başlangıcı ve hak hareket defteri                                         | Backend karşılandı (PR313): üyelik tarihi ve native satış ledger sayfası E14’e bağlı; ekran kabulü TODO/E14 sahibinde.                                                                                                                    |
| W1-BE-12 | E14 · P07.2               | Yetkili indirimli native satış                                                   | PR313 sale.discount + sale_discount_percent_upper eşlemesi mevcut; açık yetki/politika gerekir, otomatik grant yok.                                                                                                                       |
| W1-BE-13 | E14 · P09                 | Başlangıca göre rezervasyon zaman filtresi                                       | Backend karşılandı (PR314): time_filter sunucu/cursor kapsamında; E14 filtre bağlantısı ve yerel kabulü tamam.                                                                                                                            |
| W1-BE-14 | E14 · P07.4               | Planlanmış dondurmayı tamamen iptal etme                                         | Backend karşılandı (PR314): ayrı cancel preview/apply E14’e bağlı; ekran kabulünün sahibi TODO/E14.                                                                                                                                       |
| W1-BE-15 | E18 · P10/WF19            | Seans geneli bekleme listesi ve teklif geçmişi keşfi                             | Backend karşılandı (PR315): seans entries/offers dizini mevcut; E18 tüketiyor; kabul sahibi TODO/E18.                                                                                                                                     |
| W1-BE-16 | E18 · P09/WF06            | Rezervasyona bağlı gerçek paket/hak özeti                                        | Backend karşılandı (PR315): include_source_summary gerçek kaynak/hak özetini sağlar; E18 tüketiyor; kabul sahibi TODO/E18.                                                                                                                |
| W1-BE-17 | E21 · P06.5/WF06          | Özel ders taleplerinin native durum filtresi ve merkez sayaçları                 | PR316 main/development teslimi doğrulandı; frontend tüketimi ve yerel kabulü TODO/E21’de tamamlandı.                                                                                                                                      |
| W1-BE-18 | E24–E26 · P11.2/WF03/WF07 | Atanmış seansın eğitmene görünür salon etiketi                                   | Backend karşılandı (PR317): opt-in room_labels yalnız canlı atanmış seanslarda; tüketici kabulü TODO/E24–E26 sahibinde.                                                                                                                   |
| W1-BE-19 | E27 · P10/P11.2           | Kendi geçerli anlaşma/ödeme keşfi ve dönem toplamları                            | Backend karşılandı (PR321): self earnings tüm dönem/ay satırları tüketiliyor; E27 otomatik kabulü tamam, ekran kaydı TODO/E27 sahibinde.                                                                                                  |
| W1-BE-20 | E28/E29 · P09/P11.1       | Üye ders keşfi, güvenli ders etiketleri ve iptal politikası                      | Backend karşılandı (PR318): E28/E29 native keşif/politika tüketimi tamam; ekran kabulleri TODO sahibinde.                                                                                                                                 |
| W1-BE-21 | E29 · P09/P11.1           | Öğrencinin kendi merkezindeki bekleme/teklif keşfi                               | Backend karşılandı (PR320): native self waitlist/offer dizini tüketiliyor; E29 otomatik kabulü tamam, kayıt TODO/E29 sahibinde.                                                                                                           |
| W1-BE-22 | E30 · P07/P08/P11.1       | Satın alınan paket bilgisi ve ödeme para birimi keşfi                            | Backend karşılandı (PR320): immutable purchase_summary ve self finans para birimleri tüketiliyor; E30 otomatik kabulü tamam, kayıt TODO/E30 sahibinde.                                                                                    |
| W1-BE-23 | E32 · P05                 | Kendi hesabının gerekli belgelerini gerçek işlem bağlamlarıyla keşfetme          | Backend karşılandı (PR320): aktif işlem/açık satın alma belge bağlamı keşfi tüketiliyor; E32 otomatik kabulü tamam, kayıt TODO/E32 sahibinde.                                                                                             |
| W1-BE-24 | E33 · P12                 | CRM özet/filtre, merkez takipleri, sorumlu ve geçmiş deneme teklifi keşfi        | Backend karşılandı (PR322): lead filtre/özet, sorumlu/takip ve deneme geçmişi/ürün keşfi mevcut. Frontend tüketimi ve E33 otomatik kabulü tamam; ekran kaydı TODO/E33 sahibinde.                                                          |
| W1-BE-25 | E34–36 · P12.5/WF09       | Public program türü/filtre, görünür doluluk ve başvuru/yayın durumu              | Backend karşılandı (PR322): public detay/filtre, ayrı kapalı görünürlük izinleri ve açık form/onay kaynağı keşfi mevcut. E34–36 tüketimi/kabulü bekliyor.                                                                                 |
| W1-BE-26 | E37 · P13/WF15            | Etkinlik arama/durum filtresi, görünür kayıt sayısı ve merkez özetleri           | Backend karşılandı (PR319): native query/status, filtre geneli summary ve active_registration_count mevcut; E37 tüketimi ve otomatik kabulü tamam; ekran kaydı TODO/E37 sahibinde.                                                        |
| W1-BE-27 | E38 · P13/WF15            | Hazırlıksız oluşmuş etkinlik kaydının gerçek borç/ödeme bağı                     | Backend karşılandı (PR319): event_get_v1(include_payment_summary:true) gerçek kayıt bedeli/borç/bakiye bağını sağlar; E38 tüketimi ve otomatik kabulü tamam; ekran kaydı TODO/E38 sahibinde.                                              |
| W1-BE-28 | E39 · P14/WF11            | Kendi inbox arama/iş durumu, toplu/ters okundu ve kaynak eylemi eşlemesi         | Backend karşılandı (PR321): arama, gerçek kaynak durumu/selector, kapsam sayaçları ve atomik tersinir seçili okuma var. Frontend tüketimi ve E39 otomatik kabulü tamam; ekran kaydı TODO/E39 sahibinde.                                   |
| W1-BE-29 | E40 · P14.4/WF16          | Çizimin segment, tetikleme, eylem ve son işler eşlemesi                          | Backend karşılandı (PR321): native segment eşleşme/kullanım ve kapsam işi keşfi/özetleri var; kabul edilen dar WF16 sınırı korunuyor. Frontend tüketimi ve E40 otomatik kabulü tamam; ekran kaydı TODO/E40 sahibinde.                     |
| W1-BE-30 | E41 · P16/WF10            | Çizimin satış/doluluk/hakediş raporu ve import görünür alanları                  | Backend karşılandı (PR323): yeni rapor kırılımları, import dizini/limitleri ve dosya geneli satır filtreleri mevcut; native destek sınırları aşağıda. E41 tüketimi/kabulü açık.                                                           |
| W1-BE-31 | E22 · P15/WF11            | Merkez belge/sürüm dizini, kabul durumu ve özetler                               | Kaynak karşılandı (PR324): document_directory_get_v1 belge/taslak, sürüm, güncel gereksinim ve tarihsel kabul keşfini; aktif işlem/unexpired preview kitlesinin tekil kişi özetini sağlar. Development başarılı; E22 tüketim/kabulü açık. |
| W1-BE-32 | E11 · P02                 | Merkez geneli yetkili bekleyen yönetim işleri keşfi                              | Backend karşılandı (PR322): seçili merkezin beş gerçek kaynak türünden yetkili yönetim işi kuyruğu ve özetleri mevcut. E11 tüketimi ve otomatik kabulü tamam; ekran kaydı TODO/E11 sahibinde.                                             |
| W1-BE-33 | E23 · P10/WF14            | Yönetici hakediş/ödeme keşfi, dönemler ve güvenli özetler                        | Backend karşılandı (PR323): instructor_finance_directory_get_v1 üç görünüm, tüm dönem keşfi ve para birimine göre özet sağlar. Not/avans desteği yok; frontend ekran durumu TODO/E23 sahibinde.                                           |
| W1-BE-34 | E43 · WF00/P02/P14/P16    | Merkez denetim/işlem keşfi, filtreler ve dışa aktarma eşlemesi                   | Backend karşılandı (PR323): merkez audit keşfi ve kendi tracking_directory_get_v1 dizini mevcut. Ret logu/audit export/genel tekrar çalıştırma yok; E43 tüketimi/kabulü açık.                                                             |

| W1-BE-35 | E42 · WF02/P17 | Yönetici rollerini filtreli ve cursor kapsamlı keşif | Kaynak/main/development karşılandı (PR327): native role/state filtreleri var; frontend kabulü TODO/E42 sahibinde. |
| W1-BE-36 | P01 / G-PRO · WF01 | Native recovery kabul aracının doğru frontend callback kaynağı | Kaynak desteği karşılandı: PR328, zorunlu callback pini ve iki CLI modu. Sağlayıcı kontrolü P01.4’te. |
| W1-BE-37 | P01.4 · WF01 | Native parola değişikliği postasının kurtarma yolu | Karşılandı (PR329). Development postasında tam kurtarma adresi doğrulandı. |
| W1-BE-38 | P15.4 · WF11/WF15 | Yönetici kayıt işlemi öncesi üyenin kendi etkinlik belgesini keşfi | Karşılandı (PR329). Üye kendi ilk kayıt önizlemesi üzerinden belgeyi keşfedebilir. |
| W1-BE-39 | P09.2 · WF06 | Borç politikasından kaynaklanan rezervasyon reddinin ayırt edilmesi | Karşılandı (PR330). Yetkili rezervasyonda `DEBT_BOOKING_BLOCKED` ayrımı var. |
| W1-BE-40 | P14.1 · WF11/WF12 | Ders değişikliğinde etkilenen öğrenciye uygulama içi bildirim | Karşılandı (PR330). Etkilenen aktif rezervasyon sahibine ders değişikliği bildirimi gider. |
| W1-BE-41 | P01.4 · WF01 | Native ilk parola için izole kabul | Karşılandı (PR330). Native CI parolasız Google kimliğine ilk parolayı doğruladı. |
| W1-BE-42 | S04 / G-STARTER · WF02 | Starter oturumunun kendi yönetim kapsamını keşfetmesi | Açık. Starter2’de kendi rol okuması plan reddi veriyor, yayımlı Web1 yönetim menüsünü kuramıyor. |
| W1-BE-43 | E47 · WF02 | Hesaptan ilk stüdyo kurulumuna yetkili geçiş | Açık. Organizasyonu olmayan hesabın kuruluma nasıl alınacağı ve ilk merkezden sonra yönetim yetkisinin nasıl açılacağı için backend sözleşmesi gerekiyor. |
| W1-BE-44 | E31 · WF06 | Özel ders talebinde öğrencinin isteğe bağlı notu | [Açık](#w1-be-44--özel-ders-talebinde-öğrencinin-notu). |
| W1-BE-45 | E27 · WF14 | Kendi hakediş satırının tarihsel seans ve anlaşma bağlamı | [Açık](#w1-be-45--eğitmenin-hakedişinde-tarihsel-seans-ve-anlaşma-bağlamı). |
| W1-BE-46 | E10 · WF09 | Yetkili yönetici için stüdyo programı ICS aboneliği | [Açık](#w1-be-46--yetkili-yönetici-için-stüdyo-programı-ics-aboneliği). |
| W1-BE-47 | E48 · WF11 | Üye gelen kutusunda tümünü okundu yapma | [Açık](#w1-be-47--üye-gelen-kutusunda-tümünü-okundu-yapma). |
| W1-BE-48 | E48 · WF11 | Ders değişikliği bildiriminde yetkili kaynak merkezi | [Açık](#w1-be-48--ders-değişikliği-bildiriminde-yetkili-kaynak-merkezi). |
| W1-BE-49 | V03.3/E26 · WF07 | Eğitmen yoklama zaman sınırı ve düzeltme isteği | [Açık](#w1-be-49--eğitmen-yoklama-zaman-sınırı-ve-düzeltme-isteği). |

## Bütün talepler için ortak sınır

- Mevcut native Supabase Auth, JWT/AAL, plan/abonelik ve canlı organizasyon/merkez/kişi izinleri korunmalı. Yeni bir okuma mevcut görünürlüğü genişletmemeli.
- Native hesap kimliği, JWT, davet token’ı/URL’si, secret veya ihtiyaç dışı kişisel veri istenmiyor. Mevcut onay akışının kendine özgü capability token’ı yalnız yetkili işleme hizmet etmeli; başlatanın apply token’ı başka yöneticiye paylaşılmamalı.
- DTO/selector/yazar desteği tek [makine sözleşmesinden](../../../packages/api-contracts/schema/contract.json) üretilmeli. Yeni endpoint, alan veya durum adı bu talep kaydıyla icat edilmiş sayılmaz; mevcut işlemi genişletme veya yeni typed okuma kararını backend sahibi verir.
- Sayfalama filtre/arama/aktör/kapsama bağlı olmalı; sürüm, idempotency, hata/kurtarma ve yazı sonrası okuma kuralları korunmalı. Backend çakışma veya finans kuralı frontend’e taşınmamalı.
- Teslimde ilgili [WF](../../../docs/workflows.md), generated tipler ve gerçek development desteğinin durumu belirtilmeli. Kaynak, test, merge/development dağıtımı ve frontend kabulü ayrı kanıtlardır. Bu kayıt production dağıtımı, veri dönüşümü veya shared dosya değişikliği onayı vermez.

## W1-BE-01 · Merkez öğrencilik durumu filtresi

**Karşılandı:** `people_list_v1.student_status` açık merkezde active/inactive filtresi sağlar; cursor kapsamına dahildir. Öğrencilik bulunmaması pasif sayılmaz. WF04 ve generated tipler bu eşlemeyi taşır; frontend uygulama/kabulü TODO/E13 sahibindedir.

**Talep açılırken kaynak:** `RequestPeopleList` yalnız query/relationship/page ve org/center kapsamı taşır; kişi satırındaki ilişkiler durum gösterir. Liste isteğinde merkez öğrenciliği için active/inactive filtresi yoktur. [Typed kaynak](../src/lib/api-contracts/generated.ts), [istemci okuyucu](../src/features/people/people.ts), [WF04](../../../docs/workflows.md#wf04).

**İhtiyaç:** Seçili merkezin öğrencilik durumunu filtreleyen typed liste girdisi. Durum filtresi cursor’ın kapsamına dahil olmalı ve aramayla birlikte çalışmalı. Öğrencilik ilişkisi olmayan kişi ile pasif öğrenci birbirine karıştırılmamalı; hangi durumların seçilebildiği backend sözleşmesinde açık olmalı. Mevcut kişi listesi ve diğer tüketiciler korunmalı.

**Neden istemcide çözülmüyor:** Yalnız dönen20 satırı süzmek, sonraki cursor sayfalarındaki uygun kişileri atlar ve yanlış boş sonuç üretir. Bütün organizasyonu taramak da doğru liste sözleşmesi değildir.

**Doğrulama beklentisi:** Birden fazla sayfaya yayılan aktif/pasif öğrenciler; başka merkezdeki farklı durum; öğrenciliği olmayan kişi; arama+durum birleşimi; farklı filtreyle eski cursor kullanımı; izin veya kapsam kaybı. Sonuçlar yetkili backend kümesiyle eşleşmeli.

## W1-BE-02 · Kişi sayfası özetleri

**Karşılandı:** `include_member_summary:true` yalnız dönen kişi sayfasına ayrı rights/debt/next_lesson durumları ve as_of ekler. Available/restricted/not_enabled ayrıdır; kredi ve minor tutarlar ondalık string, borç para birimine göre ayrıdır. Frontend gösterimi ve kabulü TODO/E13 sahibindedir.

**Talep açılırken kaynak:** `PersonSummary` hak, borç veya sıradaki dersi taşımıyor. `finance_get_v1` kişi+para birimi ister; `ReservationView` ders başlangıcını taşımaz. [Typed kaynak](../src/lib/api-contracts/generated.ts), [mevcut tablo tüketicisi](../src/features/people/people-page.tsx).

**İhtiyaç:** Görünür cursor sayfasındaki kişiler için mevcut hak/finans/rezervasyon yetkilerini ayrı ayrı koruyan typed özet. Hak türü ve kullanılabilirliği, borcun gerçek para birimi ve en yakın dersin gerçek başlangıcı/kapsamı anlaşılır olmalı. Yetkisiz veya okunamayan alan, gerçek sıfır/borç yok/gelecek ders yok sonucundan ayrılmalı. Süreli/sınırsız hak sayısal krediye çevrilmemeli; farklı para birimleri tek tutarda toplanmamalı. Kesin özet alanları ve uygun en yakın ders seçimi backend sözleşmesinden gelmeli.

**Neden istemcide çözülmüyor:** TRY veya başka para birimi varsaymak, bütün rezervasyon geçmişlerini taramak ve kişi başına sınırsız finans/hak sorgusu üretmek yanlış sonuç veya kontrolsüz fanout yaratır.

**Doğrulama beklentisi:** Sıfır ve pozitif hak/borç; süreli/sınırsız hak; birden çok para birimi; uygun gelecek ders yokluğu; iptal/geçmiş ders; farklı merkez ve kısmi yetki; cursor sayfası dışındaki kişilerin verisinin açılmaması. E13 tablo/özet ve sonraki ilgili kişi tüketicileri aynı kanonik anlamı kullanmalı.

## W1-BE-03 · Merkez geneli davet ve hesap bağlantısı keşfi

**Karşılandı:** PR311/312 `management_state_get_v1` üzerinden merkez geneli invitation/person-account discovery, durum/arama/cursor, güvenli access_detail/access_summary ve yeniden gönderilebilirlik sağlar. Native hesap kimliği veya davet token’ı paylaşılmaz; görünürlük ve yetki korunur. Çağrı eşlemesinin sahibi [WF04](../../../docs/workflows.md#wf04).

**PR313 düzeltmesi:** `account-person-directory-query.sql` kişi/hesap dizininin canonical kök/bağ sorgusunu düzeltti. Önceki15 Kasım native owner okumasındaki iki503/TEMPORARY_FAILURE ve açık yeniden deneme bulgusu `.tmp/access-hosted-result.json` içinde korunur. Bu eski gözlem yeni kaynakta tekrar edilmiş veya hâlâ sürüyor sayılmaz. Güncel hosted tekrar kontrolü kullanıcı kararıyla TODO/POST-PRO.PEOPLE sahibindedir; frontend yerel kabulü TODO/E15’tedir.

## W1-BE-04 · Birleştirme gerekçesi ve çizimdeki keşif/karar akışı

**Karşılandı (PR312):** Preview gerekçesi sabitlenir, apply/audit sonucuna taşınır. Merkez review directory suggested/completed/not_duplicate durumlarını ve sayaçlarını keşfeder. Kesin normalize e-posta/telefon adayları iletişim görünürlüğüyle sınırlıdır; kopya-değil kararı mevcut preview → açık onay → apply yolundadır. Seçili iki kişiye `person_get_v1(include_member_summary:true)` projeksiyonu desteklenir. Frontend uygulaması, yerel kabulü ve Pro sonrası gerçek kontrollerin tek sahibi [TODO/E16](todo.md#sayfa-kabulu); burada ikinci bir ekran kabul durumu tutulmaz.

**Talep açılırken kaynak:** `person_merge_preview_v1` açık source_id/target_id ile çalışır; approve/apply girdileri preview capability ve operation_key kullanır, gerekçe alanı taşımaz. Merkez `person_merge_approve_v1` discovery’si güncel onaylanabilir preview’ları verir; otomatik kopya önerisi veya tüm tamamlanan birleşimler değildir. [WF04](../../../docs/workflows.md#wf04), [merge adaptörleri](../src/features/people/merge.ts), [ekran](../src/features/people/merge-view.tsx).

**İhtiyaç ve değerlendirme:**

- Çizimin zorunlu gerekçesinin yetkili native merge akışında kabul edilip doğru işlem geçmişine kaydedilmesi; geriye uyumluluk ve aynı operation_key ile değişen payload kurallarının korunması.
- Merkezde görünür kayıt çiftlerini keşfetme ve tamamlanan birleşim sonuçlarını typed/cursor’lı okuma. Açık ve tamamlanan durumlarının tanımı, sayaçların kapsamı, arama ve seçili çiftin güvenli alanları sözleşmede açıklanmalı.
- “Kopya değil” kararının kalıcı kaydı ve tekrar önerilmemesi hedefinin backend tarafından değerlendirilmesi; açık kullanıcı kararı, mevcut kişi/merkez yetkisi ve güvenli tekrar/yeniden okuma davranışı.
- Karşılaştırma alanlarının, birleşim etkisinin ve gerekli merkez onaylarının güvenli projeksiyonu. Hak/borç gibi ortak özet ihtiyacı W1-BE-02 ile birlikte ele alınabilir; doğrulanmış veri yoksa sıfır veya yerel hesaplama kullanılmaz.

Güncel backend kapsamı WF04’te tanımlıdır: aynı normalize iletişimden aday önerilir, ad benzerliği/skor kullanılmaz ve elle çift seçimi korunur. Öneri kimlik kanıtı veya otomatik birleştirme değildir. Normalizasyon ve görünürlük backend sahibidir; frontend ikinci eşleştirme algoritması kurmaz.

**Korunacak davranış:** Geçmiş kimlikleri ve merkez sahipliği bağlantılı korunur. Fiziksel silme, borçları istemcide toplama, çakışan rezervasyonu otomatik tekilleştirip hak iade etme varsayılmaz. Başlatanın apply token’ı ile diğer merkezin onay capability’si ayrıdır. Mevcut hesap/rezervasyon/kaynak blocker’ları, canlı yetki, scope hash ve preview süresi aşılmaz.

**Doğrulama beklentisi:** Gerekçenin doğru audit/işleme bağlanması; eksik/değişmiş gerekçe ve aynı key davranışı; başka merkezin yetkisiz onayı; süresi dolmuş/değişmiş preview; çok merkez onayları; cursor kapsamı; tekrar eden kopya-değil kararı; kabul sonrası canonical kişi ve bağlantılı geçmiş okuması. E16/P04.4 ancak yeni kaynağın tüketimi ve frontend kabulüyle kapanır.

## W1-BE-05 · Uygunluk ve kapanış yaşam döngüsü

**Karşılandı (PR312):** `availability_save_v1(action:retire,rule_id,resource,expected_version,reason)` gerçek kural row version’ıyla; `availability_exception_save_v1(action:cancel,exception_id,resource,expected_version,reason)` gerçek merkez aggregate sürümüyle çalışır. Reader active/inactive ve active/cancelled durumlarını verir. Eski saat/hafta/tarih veya gizli gerekçe açılmaz; seanslara otomatik yan etki yoktur. Frontend uygulaması, yerel kabulü ve Pro sonrası gerçek kontrollerin tek sahibi [TODO/E12](todo.md#sayfa-kabulu); burada ikinci bir ekran kabul durumu tutulmaz.

**Talep açılırken kaynak:** Haftalık uygunluk ekleme/sürümlü güncelleme ve merkez aggregate version ile kapanış append destekleniyor. Son kalıcı uygunluk kuralını kapatma ve mevcut kapanışı iptal etme komutu mevcut tüketim sözleşmesinde yok. [Uygunluk adaptörü](../src/features/studio/availability-edit.ts), [kapanış adaptörü](../src/features/studio/closure.ts), [WF02](../../../docs/workflows.md#wf02)/[WF03](../../../docs/workflows.md#wf03).

**İhtiyaç:** Bu iki çizim eylemi için güvenli typed yaşam döngüsü desteği veya bu sürümde açıklamalı salt okunur bırakılacaklarına dair ürün/kapsam kararı. Uygulama yapılacaksa gerçek kayıt kimliği ve yetkili sürüm okuması, ayrı açık kullanıcı eylemi, gerekçe gereksinimi, idempotent yazı ve son durum okuması belirtilmeli. Son kural boş weekdays veya sahte tarih aralığıyla kapatılmayacak; mevcut gizli gerekçe okuyucuya açılmayacak.

**Doğrulama beklentisi:** Yalnız seçili kaynak/kayıt etkilenmeli; diğer kurallar/kapanışlar ve sürümleri korunmalı; stale version/yanlış merkez reddedilmeli. Kapanış değişikliği mevcut seansları otomatik iptal etmemeli. Desteklenmeyen silme/reset veya private tablo/RPC kullanılmayacak.

## W1-BE-06 · Programdaki sabit grup üyeliğinin native eşlemesi

**Frontend talebi:** E17 çizimindeki sabit grup üyesi listesi, kişi ekleme/çıkarma ve sonraki program oluşumlarına etkisi için mevcut doğru native akışın/sözleşmenin belirtilmesi veya eksik typed desteğin tamamlanması gerekiyor. `class_assignment_set_v1` eğitmen/asistan duty’sidir; öğrenci üyeliği değildir. `reservation_create_v1` gerçek session_id/person_id/source_sale_id ve priority/flexible mode ister; tekil rezervasyonları kalıcı sınıf üyeliği olarak göstermeyeceğiz.

**Karşılanan kaynak (PR313):** [WF03](../../../docs/workflows.md#wf03) sabit grubu ayrı kalıcı üyelik yerine priority rezervasyonları olarak tanımlar. `management_state_get_v1` içinde `reservation_cancel_v1`, `directory:class`, class_id/interval ve opsiyonel program/status/query ile kişi kökünde cursor keşfi; `group_student.reservations` alt kayıtlarında gerçek rezervasyon/seans/satış kimliği ve sürüm bulunur. Ekleme seçilen somut seans ve satışla normal `reservation_create_v1`, çıkarma alt rezervasyonla `reservation_cancel_v1` üzerinden ayrı açık onaylarla yapılır. Henüz oluşmamış derslere otomatik üyelik veya atomik toplu komut yoktur. E17 tüketimi tamam; ekran kabulünün sahibi TODO’dur.

## W1-BE-07 · Mevcut seansın düzenleme ve telafi bağı kaynağı

**Frontend talebi:** `management_state_get_v1(operation:session_change_preview_v1,selector:{operation:session_change_preview_v1,key:{session_id,scope:single}},page:{limit:1})` için mevcut doğru native okuma eşlemesini belirtin veya eksik runtime desteğini tamamlayın. Typed selector/projeksiyon mevcut; gerçek development CM okuması `POLICY_NOT_CONFIGURED` dönüyor. Bu kodun hangi gerçek config’i istediği de bilinemediğinden frontend kullanıcıya ayar değeri uydurmayacak.

**Karşılanan kaynak (PR313):** [WF03](../../../docs/workflows.md#wf03), `session-management-reads.sql` ve kanonik management selector/projection tipleri. `session_change_preview_v1` yönetim okuması current.values.patch içinde gerçek UTC aralığı/kaynak/public kapasiteyi ve sessions sürümünü döndürür; single/this_and_future korunur. `replacement_session_create_v1` selector.key.replaces_id ile kalıcı telafi bağını cursor’lı okur. Kaynak okuması preview/onay/apply yetkisi değildir. Önceki POLICY_NOT_CONFIGURED gözlemi PR313 öncesine aittir (`.tmp/e17-owned-replacement-read-probe.json`); yeni kaynak aynı hatayı veriyor sayılmaz, hosted tekrar kabulü yapılmadı. E17 tüketimi tamam; ekran kabulü TODO’dadır.

## W1-BE-08 · Native telafi komutu receipt okuması

**Frontend ihtiyacı:** ACK almış telafi komutunun typed `operation_status_get_v1(operation,key,org_id)` okumasıyla yeni writer üretmeden güvenli kurtarılması.

**Karşılanan kaynak (PR313):** `apps/backend/database/capacity-recovery.sql` ve `native-capacity-recovery-acceptance.mjs`; session_create/replacement_session_create/session_capacity_set için eski normalize capacity içeren native ACK bağlamları yeniden yetkilendirilir, public request’e private alan eklenmez. Test gerçek izole DB fixture’ını ve kanonik request/success validator’larını kullanır; telafi ACK recovery sonucunu ayrıca assertion ile doğrular. Önceki VALIDATION_FAILED gözlemi PR313 öncesindendir; güncel hosted tekrar kabulü sayılmaz. `.tmp/e17-owned-cancel-replacement-private.json` içindeki ACK’li writer’lar yeniden oynatılmaz. E17 tüketimi tamam; ekran kabulü TODO’dadır.

## W1-BE-09 · Paket yönetimi keşfi, durum ve geçmiş

**Frontend ihtiyacı:** E19 çizimindeki Paketler tablosu (arama, Tümü/Satışta/Kapalı/Arşiv, cursor, aktif hak sütunu), dört merkez özeti (satışta paket, son30 gün satış/ciro, aktif hak sahibi), paket sürüm/satış geçmişi ve satışa kapatma/arşiv akışı için mevcut doğru native okuma/yazı eşlemesini belirtin; yoksa mevcut yetki/plan sınırlarını koruyan typed destek sağlayın. Para birimleri ayrı korunmalı; ciro farklı para birimleri toplanarak üretilmemeli. Sayaçlar mevcut cursor sayfasının uzunluğundan hesaplanmayacak. Yeni bir endpoint veya alan adı bu kayıtla önerilmiş/kararlaştırılmış değildir.

**Karşılanan kaynak:** PR313/main `158feaeeb3edadb3ab78c2c89d74c02d8d1f1dfb`; `docs/workflows.md#WF05`, kanonik `RequestProductsManagementList`, `ProductManagementEntry`, `ProductManagementTotals` ve `RequestProductStateSet`. Typed snapshot byte/hash kontrolüyle alındı. Yönetim okuyucusu products/versions/sales, query/status/cursor ve merkez toplamlarını; durum yazıcısı gerekçe ve products.version ile open/close/archive destekler. Yeni taslak, sürüm notu veya ürün-genel geçerlilik alanı talep karşılığı olarak uydurulmaz.

**Frontend eşlemesi:** İstenen native keşif/durum/geçmiş kaynakları tüketildi; ekran uygulaması ve yerel kabulünün tek sahibi [E19](todo.md#sayfa-kabulu). Bu kayıt hosted başarı iddiası veya backend adına yeni onay değildir.

## W1-BE-10 · Merkez geneli finans keşfi ve özetler

**İhtiyaç:** E20 çizimindeki Hareketler/Açık borçlar/Alacaklar listeleri için seçili merkezde izinli native keşif, kişi arama/işlem türü/yöntem filtresi ve cursor; dönem satış/tahsilat ile güncel borç/alacak toplamları ve kişi sayaçlarının güvenli kaynağı gerekiyor. Mevcut doğru eşlemeyi belirtin; yoksa typed desteği backend sahibi tanımlasın. Her para birimi ayrı kalmalı, görünür cursor sayfası merkez toplamı sayılmamalı; finans yetkisi ve ilgili plan/merkez sınırları korunmalı.

**Karşılanan kaynak (PR313):** [WF08](../../../docs/workflows.md#wf08), `RequestFinanceDirectoryGet` ve `FinanceDirectoryView`; `finance_directory_get_v1(center_id,view:movements|debts|credits,interval,page)` query/kind/method ile sunucuda filtreler. Kaynak entity/sürüm, kişi ve varsa satış/immutable ürün adı taşınır; merkez toplamları gerçek para birimine ayrıdır. Öğrencinin öz okuması veya finance.collect merkez finance.read yetkisi yaratmaz. Ayrı report/settlement veya tüm kişileri tarama gerekmez. E20 tüketimi TODO’dadır.

## W1-BE-11 · Üye profili üyelik tarihi ve hak hareketleri kaynağı

**Frontend ihtiyacı:** E14 çizimindeki “Üye: tarih” ve “Hak hareketleri” için bilinen person_id/sale_id kapsamında mevcut doğru native okuma eşlemesini belirtin; yoksa mevcut kişi/hak görünürlüğü, merkez ve plan sınırlarını koruyan typed kaynak gerekiyor. Üyelik tarihinin kişi oluşturma, hesap açma veya öğrenci etkinleştirme tarihi olduğu varsayılmayacak; doğru iş anlamını backend sahibi açıklamalı. Hak hareketlerinde tarih, miktar/yön, işlem türü ve ilişkili kaynak izlenmeli; mevcut bakiye geçmiş hareket dizisi olarak sunulmayacak. Hesap kimliği/token veya private/core tablo erişimi istenmiyor.

**Karşılanan kaynak (PR313):** [WF04](../../../docs/workflows.md#wf04) `person_get_v1(include_membership_date:true)` → seçili merkezde canonical alias/pasif geçmiş dahil ilk kayıtlı öğrenci ilişkisinin `membership_started_at` değeri (yoksa null). Hesap oluşturma veya son aktivasyon tarihi değildir. [WF05](../../../docs/workflows.md#wf05) `entitlements_get_v1(ledger_sale_id,ledger_page)` → zaten görünür satışın typed `movements` sayfası; append-only kaynak/tür/miktar/balance_delta/previous_id ve cursor kapsamı korunur. Audit okuma yetkisi eklenmez; süreli hakkın mevcut opt-in/plan kapısı sürer. E14 tüketimi TODO’dadır.

## W1-BE-12 · P07.2 indirimli native satış desteği

**Frontend ihtiyacı:** P07.2 yetkili kullanıcının liste fiyatından farklı net satış bedelini native preview/onay/apply ile kaydetmesini ister. `Request_sale_preview.net_minor` mevcut typed alanıdır; bu alan için geçerli yetki/politika eşlemesini belirtin. Hedef davranış desteklenecekse preview borcu, satışın gerçek net bedeli, borç ve sonraki hak/iade/hakediş hesaplarının aynı onaylanan bedeli kullanması backend sahibinde tamamlanmalı. Yeni yetki veya indirim politikası frontend'de icat edilmeyecek; mevcut rol/plan/merkez, belge kapıları ve stale/aynı-key güvenliği korunmalı.

**Karşılanan kaynak (PR313):** [WF05](../../../docs/workflows.md#wf05) ve `sale-discount.sql`/`sale-discount-acceptance.mjs`. Liste altı net için sale.write yanında aynı merkezde açık `sale.discount` override ve organizasyonda `sale_discount_percent_upper` IntegerPolicy gerekir. Varsayılan oran/grant yoktur; normal liste tutarı ek yetki istemez. Yetki veya sınır reddi FORBIDDEN; açık yetkide politika yoksa POLICY_NOT_CONFIGURED; negatif/liste üstü tutar VALIDATION_FAILED. Preview/sale/debt aynı onaylı neti kullanır, apply canlı yetki/politikayı yeniden denetler. Önceki FORBIDDEN gözlemi güncel ortamda yetki/politikanın varlığını kanıtlamaz; konfigürasyon kendiliğinden değiştirilmez. E14 tüketimi ve kalan gerçek kontrol TODO’dadır.

## W1-BE-13 · Üye profili rezervasyon zaman filtresi

**İhtiyaç:** E14 çizimindeki Tümü/Yaklaşan/Geçmiş için bilinen kişi ve merkez kapsamındaki rezervasyon dizininde, ders başlangıcına göre ayrımı cursor kapsamına bağlayan doğru typed eşlemeyi belirtin; yoksa backend sahibi desteği tanımlasın. Görünür sayfayı istemcide süzmek veya bütün kişinin geçmişini taramak eksik/masraflı sonuç üretir. Aktör/kişi/merkez görünürlüğü korunmalı.

**Karşılandı (PR314):** [WF06](../../../docs/workflows.md#wf06) `reservation_list_v1.time_filter:all|upcoming|past` ders başlangıcına göre sunucuda ve cursor öncesinde ayrım yapar. İlk sunucu `as_of` sınırı cursor zincirinde sabittir; devam eden seans yalnız past içindedir. Filtre değişiminde cursor ve birikmiş sayfalar bırakılır; mevcut interval kesişimi ayrı korunur. Canlı görünürlük ve plan sınırları her sayfada uygulanır. Tümü için yapay tarih aralığı veya geçmiş taraması gerekmez. E14 filtre tüketimi ve yerel kabulü tamam; kanıtın sahibi TODO’dur. Bu alt iş bütün E14 ekranının kapanışı sayılmaz.

## W1-BE-14 · Planlanmış dondurmayı tamamen iptal etme

**İhtiyaç:** E14 çizimindeki henüz başlamamış dondurmayı iptal et eylemi için doğru native eşlemeyi belirtin; yoksa yetki/plan, preview/onay, stale ve aynı-key kuralları korunan typed destek sağlayın. İptalde hiç başlamamış aralık yeni rezervasyon uygunluğunu kısıtlamamalı; varsa eklenen geçerlilik ve mevcut kesin rezervasyon etkisi backend’den gelmeli.

**Karşılandı (PR314):** [WF05](../../../docs/workflows.md#wf05) gerçek hak okumasındaki freeze_id → `freeze_cancel_preview_v1(freeze_id,reason)` → native geçerlilik/rezervasyon etkisini açık onay → `freeze_cancel_apply_v1(preview,operation_key)` → hak/satış ve rezervasyon yeniden okuması. Yalnız henüz başlamamış scheduled kayıt iptal edilir; özgün tarihler ve kesin rezervasyonlar korunur. Kaldırılan uzatma günleri ve bitişler preview’dan gelir; bağımsız uzatma korunur. Başlangıç geçerse/stale bağımlılıkta yeni preview gerekir. Aynı-key ve canlı CM/entitlement.correct/F17/satış sınırları korunur. Erken bitiş iptal yerine kullanılmaz. Frontend cancel tüketimi ve yerel dilim doğrulaması tamam; E14 ekranının kalan kabulü TODO sahibindedir. Bu, yeni hosted kabulü veya backend adına onay değildir.

## W1-BE-15 · Seans geneli bekleme listesi ve teklif keşfi

**İhtiyaç:** E18 çizimindeki bekleyenler ve sonuçlanan teklifler için seçili merkez/seans kapsamlı typed cursor okumasının doğru native eşlemesini belirtin; yoksa yetkili keşif desteğini backend sahibi tanımlasın. FIFO sırası, katılımcının güvenli görünen adı, giriş zamanı, kayıt durumu/sürümü ve görünür tekliflerin durumu/son geçerliliği gerekiyor. Gerçek sayaç veya sıra sağlanmıyorsa cursor sayfasından merkez/seans toplamı ya da global FIFO sırası üretilmeyecek.

**Mevcut kaynak:** `ManagementSelectorWaitlistJoinV1` kişi+seans, leave entry_id, offer accept/reject offer_id ister. `p01-waitlist-workers.sql` içindeki `p01_wait_context` kişi bağlamını zorunlu çözer; `p01_wait_page` hem session_id hem person_id ile filtreler. `ManagementStateView.waitlist_detail` bilinen kişinin kayıt/tekliflerini taşır; bu seans geneli keşif değildir. Bütün kişileri taramak veya private/core tablolara erişmek çözüm olarak kullanılmaz.

**Sınır:** Mevcut WF19/üst plan, canlı merkez ve rezervasyon görünürlüğü korunmalı; worker issue/expire insan istemciye açılmaz. Yönetici üye kabul/ret işlemini taklit etmez. Frontend kompozisyonu hazırdır; API ve kabulünün tek sahibi [E18](todo.md#sayfa-kabulu) kalır. Bu talep backend uygulama/onayı değildir.

**Karşılanan kaynak (PR315):** Seans geneli keşif eksikliği doğrulandı; ayrı endpoint veya worker/üye komutu açmak gerekmiyor. Mevcut management_state_get_v1, waitlist_join_v1 selector’ünde directory:session, session_id ve view:entries|offers ile genişletildi. Entries worker ile aynı joined_at/id FIFO sırasını, offers ayrı created_at/id cursor’ıyla gerçek teklif geçmişini verir. Kaynak durum/sürüm, güvenli waitlist_display_name, giriş ve expires_at typed alanlardadır; totals/global sıra numarası sağlanmaz. Entries içine teklif geçmişi gömülmez; offers satırında yalnız o teklif vardır. Eski kişi+seans selector’ü korunur. Kesin çağrı, filtre ve canlı yetki sınırları [WF19](../../../docs/workflows.md#wf19), kaynak/test/CI/development durumları [backend devrinde](../../backend/docs/00-FtkSaaS-yeni-sohbet-devir.md#seans-kesif-hak) tutulur. PR315 main’e alındı ve aynı kaynağın development teslimi doğrulandı; bu destek E18 frontend kabulü değildir.

## W1-BE-16 · Rezervasyona bağlı paket/hak sütunu eşlemesi

**İhtiyaç:** E18 katılımcı tablosunun Hak sütunu için görünür rezervasyonun gerçek kaynak satışına ve izinli güncel paket/hak özetine giden mevcut typed eşlemeyi belirtin. Yoksa yalnız görünür seans/rezervasyon satırları için mevcut kişi/merkez/plan/hak görünürlüğünü koruyan typed destek gerekir. Native hesap kimliği veya private/core erişimi istenmez.

**Kaynak:** `ReservationView` id/session/person/state/mode/version/category taşır, source_sale_id taşımaz. Kişinin `entitlements_get_v1(session_id,booking_mode)` sonucu uygun hakları seçme kaynağıdır; önceden oluşmuş rezervasyonun hangi satışa bağlı olduğunu tek başına kanıtlamaz. `GroupStudentView` yalnız priority sınıf rezervasyonlarını kapsar. Bütün satış defterlerini tarayarak ters bağ kurulmaz; güncel uygun ilk paket, atanmış kaynak veya kişi hak toplamı diye sunulmaz. Bu bir eşleme/destek talebidir; backend eksiği ya da yeni endpoint kararı olarak kabul edilmez.

**Karşılanan kaynak (PR315):** Görünür rezervasyondan gerçek kaynağa genel typed bağlantı eksikliği doğrulandı. Ayrı endpoint, bütün kişi/satış geçmişini tarama veya yeni hak hesabı gerekmiyor. reservation_list_v1(include_source_summary:true) yalnız görünür cursor sayfasına gerçek kaynak satış ve izinli güncel hak özetini ekler. available/restricted/not_enabled/unassigned ayrıdır; gizli kaynak kimliği açılmaz. Satın alınmış ürün sürümünün immutable adı, satış/hak durumu ve sürümü korunur; tükenmiş/sona ermiş kaynak uygun başka paketle değiştirilmez. Süreli paketin available_credits alanı null’dır. Mevcut entitlements_get_v1(session_id,booking_mode) **yeni rezervasyonun uygun hak seçimi** için doğru yoldur; GroupStudentView **priority sınıf alt rezervasyonunun bilinen bağı** için kullanılabilir. Bunlar E18’in genel kaynak sütununun yerine geçmez. Kesin tüketim [WF06](../../../docs/workflows.md#wf06), kaynak/test/CI/development durumu [backend devrinde](../../backend/docs/00-FtkSaaS-yeni-sohbet-devir.md#seans-kesif-hak) tutulur. PR315 main’e alındı ve aynı kaynağın development teslimi doğrulandı; bu destek E18 frontend kabulü değildir.

## W1-BE-17 · Özel ders talepleri durum filtresi ve özet

**Mevcut kaynak:** `management_state_get_v1(operation:lesson_request_create_v1,selector.key:{})` merkez genelindeki yetkili talepleri cursor ile keşfeder. `ManagementSelectorLessonRequestCreateV1` kişi/eğitmen/disiplin ve seçim kataloğu alanları taşır; durum filtresi yoktur. `ManagementStatePage` talep sayaçlarını taşımaz; `p01_requests_page` de durumla filtrelemez. Mevcut rapor türlerinde özel ders talep özeti bulunmuyor.

**İhtiyaç:** E21 çiziminin Bekleyen / Alternatif önerildi / Sonuçlanan / Tümü filtrelerini cursor kapsamına alan typed okuma eşlemesi ve merkez genelindeki pending / alternative_offered / approved / rejected sayaçları. Sonuçlanan kümesi için approved/rejected/withdrawn/expired yaşam döngülerinin doğru eşlemesini backend sahibi belirtmeli. Mevcut uygun çözüm varsa onu belirtin; yeni alan veya endpoint kararını frontend vermiyor.

**Sınır:** Canlı merkez/kişi görünürlüğü, request yetkileri ve plan kapıları korunmalı. Görünür sayfa istemcide filtrelenmeyecek, sayfa uzunluğu toplam sayılmayacak ve bütün geçmiş sayaç için taranmayacak. Onay/ret/alternatif yazarları, worker süre dolumu ve kişinin kendi withdraw/accept yetkileri genişletilmeyecek. Frontend kompozisyonu bağımsız ilerliyor; ekran kabulünün sahibi [TODO/E21](todo.md#sayfa-kabulu).

**Backend değerlendirmesi / kaynak adayı — 16 Kasım 2026:** Yeni endpoint veya rapor gerekmiyor. Mevcut management_state_get_v1 lesson_request_create_v1 selector.key alanına isteğe bağlı status:all|pending|alternative_offered|resolved ve include_summary:true eklendi. Sonuçlanan approved/rejected/withdrawn/expired kümesidir; resolved yeni kayıt durumu değildir. lesson_request_summary dört gerçek sayacı aynı native görünür kapsamda, durum/cursor/limit öncesinde sunucuda hesaplar. CM merkez genelini, öz okuma yalnız kendi görünür kayıtlarını sayar. Status indeksi üzerinden scoped aggregate kullanılır; istemcide geçmiş taraması gerekmez. Sayaçlar yalnız belirtilen dört durumdur; approved+rejected değeri Sonuçlanan toplamı diye gösterilmez. Filtre veya özet opt-in değişince eski cursor bırakılır. Eski çağrılar aynı kalır; seçim katalogları status/summary ile karıştırılmaz. Kesin çağrı ve sınırların sahibi [WF06](../../../docs/workflows.md#wf06), kaynak/test/CI/development durumlarının sahibi [backend devridir](../../backend/docs/00-FtkSaaS-yeni-sohbet-devir.md#ozel-ders-durum-ozet). Kaynak adayı main/development teslimi veya E21 frontend kabulü değildir.

## W1-BE-18 · Atanmış seansın salon etiketi

**İhtiyaç:** Eğitmenin kendi gün/program/seans çizimindeki salon adı için mevcut güvenli typed okuma eşlemesini belirtin. Yoksa yalnız zaten görünür atanmış seanslara, mevcut canlı yetki/merkez sınırlarıyla salon görüntüleme etiketi eklenmesi gerekir. Yeni endpoint veya oda yönetimi yetkisi istenmiyor; kaynak biçimini backend sahibi belirler.

**Tüketici kaynağı:** PR317 typed snapshot’ı yerel üreticiden güncellendi. `ResourceRef` kimliği ada çevrilmez; oda yönetimi selector’ü çağrılmaz. Frontend tüketimi ve ekran kabulünün tek sahibi [TODO/E24–E26](todo.md#sayfa-kabulu) kaydıdır.

**Backend kaynak karşılığı:** Mevcut `calendar_get_v1(resource:{kind:person,id:gerçek_self_person},include_room_labels:true)` ve `session_get_v1(session_id,include_room_labels:true)` çağrılarına isteğe bağlı typed `room_labels:[{room_id,name}]` eklendi. Alan yalnız görünür seansın çağırana ait canlı seans/sınıf ataması ve canlı eğitmen/asistan rolü varsa döner. Güncel ad aynı organizasyon/merkezdeki aktif salon rezervasyonundan okunur. Uygun atanmış seansta salon yoksa `[]`; alan yoksa bilinmiyor olarak korunur. Eski çağrılar, `ResourceRef` ve yazma alanları değişmez; event salonu veya oda yönetimi keşfi açılmaz. Filtre/opt-in değişince cursor bırakılır. Kesin tüketim [WF03](../../../docs/workflows.md#wf03), kaynak/CI/main/development durumu [backend devrinde](../../backend/docs/00-FtkSaaS-yeni-sohbet-devir.md#atanmis-seans-salon) tutulur. Bu kaynak desteği frontend E24 ekran kabulünü veya henüz doğrulanmamış CI/dağıtım aşamasını kapatmaz.

## W1-BE-19 · Eğitmenin kendi hakediş özeti ve ödeme keşfi

**Durum:** Backend kapsamı PR318 çekirdeği ve PR321 tüm dönem satır desteğiyle karşılandı. Main/merge/development kanıtı üst kayıtta; yeni dilimin frontend tüketimi ve E27 otomatik kabulü tamam; ekran kanıtının sahibi [TODO](todo.md#sayfa-kabulu).

**Karşılanan ek ihtiyaç:** `instructor_account_get_v1(view:earnings)` aynı gerçek self eğitmen için native hakediş/seans satırlarını döndürür; interval atlanınca tüm dönemlerdir. Kök/düzeltme, basis, para birimi ve güncel paid/remaining alanları korunur; yapay başlangıç/bitiş veya ay ay tarama gerekmez. Eski `earnings_list_v1` interval zorunluluğu değişmedi. Anlaşma/ödeme keşfi ve yöntem desteği mevcut yollarında kalır; yöneticiye başkası adına okuma/yazma yetkisi açılmaz, W1-BE-33 bu talepten ayrıdır.

Kesin cursor/dönem/bakiye ve canlı self yetki sözleşmesi [WF14](https://github.com/SXQHex/FtkSaaS/blob/2b36e190ecc121c431d24b7c472715c2a565f9f8/docs/workflows.md#wf14), backend değerlendirmesi [XREQ-053](https://github.com/SXQHex/FtkSaaS/blob/2b36e190ecc121c431d24b7c472715c2a565f9f8/docs/requests.md#xreq-053) sahibindedir. Kaynak/native test kanıtının sahibi [backend devri](https://github.com/SXQHex/FtkSaaS/blob/2b36e190ecc121c431d24b7c472715c2a565f9f8/apps/backend/docs/00-FtkSaaS-yeni-sohbet-devir.md#web1-ledger-inbox-automation); bu dosya frontend kabulü vermez.

## W1-BE-20 · Öğrencinin rezervasyon yapabileceği ders keşfi

**Durum:** Backend karşılandı: PR318 main’de. Kaynak/CI/development üst kayıtta doğrulandı; E28 native keşif/politika tüketimi bağlı ve otomatik çekirdek kabulü geçti. E28’in kalan frontend belge kabulü ve E29 uyarlamasının sahibi TODO’dur.

**Backend kaynak karşılığı:** `calendar_get_v1(member_discovery:true)` seçili merkez ve aralıkta native aktif öğrencinin görünür grup/özel derslerini cursor ile keşfeder. `member_lesson` güvenli etiketler, gerçek seans/sürüm/kapasite, kayıt penceresi, güncel iptal koşulu ve kendi mevcut rezervasyonuna sabit koşulu ayrı verir. Kapasite/hak/belge ve canlı plan/merkez/sınıf sınırları writer’da yeniden denetlenir; discovery rezervasyon garantisi değildir. Kesin tüketim [WF06](../../../docs/workflows.md#wf06), backend değerlendirmesi [XREQ-054](../../../docs/requests.md#xreq-054) sahibindedir. Bu seansa bağlı kendi waitlist/offer bilgisi W1-BE-21’in merkez genelinde bilinmeyen kayıt keşfi yerine geçmez. Frontend kabulünün sahibi [TODO/E28–E29](todo.md#sayfa-kabulu).

## W1-BE-21 · Öğrencinin kendi bekleme ve teklif keşfi

**Durum:** Backend kaynak desteği PR320 ile main’de; aynı kaynağın CI/development durumu üst kayıttadır. Frontend tüketimi ve ekran kabulü [TODO/E29](todo.md#sayfa-kabulu) sahibindedir.

**Backend kaynak karşılığı:** `management_state_get_v1(operation:waitlist_join_v1,center_id,selector:{operation:waitlist_join_v1,key:{directory:self,view:entries|offers,status?}},page)` bilinen kişi/seans/kayıt gerektirmeden kendi bekleme ve tekliflerini keşfeder. Native `waitlist_detail`, teklif sürümü/sona erme zamanı ve güvenli `waitlist_session` başlık/aralık/saat dilimi/durum/sürümünü verir. Filtre limitten önce uygulanır; cursor hesap/aktör, merkez, görünüm ve filtreye bağlıdır. Aktif öğrencilik, F12/plan ve canlı merkez sınırı korunur; global sıra veya kabul garantisi üretilmez. Mevcut leave/accept/reject ve receipt akışı korunur. Kesin tüketim [WF19](../../../docs/workflows.md#wf19), backend değerlendirmesi [XREQ-057](../../../docs/requests.md#xreq-057) sahibindedir.

## W1-BE-22 · Öğrencinin satın alınan paket bilgisi ve ödeme para birimleri

**Durum:** Backend kaynak desteği PR320 ile main’de; aynı kaynağın CI/development durumu üst kayıttadır. Frontend tüketimi ve ekran kabulü [TODO/E30](todo.md#sayfa-kabulu) sahibindedir.

**Backend kaynak karşılığı:** `entitlements_get_v1(include_purchase_summary:true)` kendi görünür haklarına satın alınan gerçek sürümün immutable `product_name` ve `initial_credits` bilgisini ekler; süreli hakta başlangıç kredisi null kalır. `member_finance_currencies_get_v1(center_id)` kendi gerçek borç/nakit/alacak hareketlerinin tekil para birimlerini, sıfırlanmış borç ve geçmiş hareketler dahil keşfeder. Her para biriminin ayrıntısı mevcut `finance_get_v1(person_id,currency,page)` yolundan okunur; varsayılan para birimi veya birleştirilmiş toplam yoktur. Native self/aktif öğrencilik, merkez ve plan sınırları korunur. Kesin tüketim [WF05](../../../docs/workflows.md#wf05)/[WF08](../../../docs/workflows.md#wf08), backend değerlendirmesi [XREQ-058](../../../docs/requests.md#xreq-058) sahibindedir.

## W1-BE-23 · Öğrenci hesabındaki gerekli belge listesi

**Durum:** Backend kaynak desteği PR320 ile main’de; aynı kaynağın CI/development durumu üst kayıttadır. Frontend tüketimi ve ekran kabulü [TODO/E32](todo.md#sayfa-kabulu) sahibindedir.

**Backend kaynak karşılığı:** `member_document_contexts_get_v1(center_id,page)` kendi aktif işlemlerini ve süresi dolmamış, current ve henüz satışta kullanılmamış satın alma önizlemelerini `{context,requirements}` satırlarıyla keşfeder. Tamamlanmış/iptal/terminal geçmiş kart kapsamına girmez; mevcut kabul kanıtları korunur. Gereksinimsiz bağlamlar limitten önce elenir; cursor hesap/aktör ve merkez kapsamına bağlıdır. Keşif render, snapshot veya kabul üretmez. Dönen gerçek context ile mevcut requirements → içerik → açık accept → yeniden okuma yolu kullanılır; kabul başka işleme kopyalanmaz. Native self, F30, merkez ve Starter kaynak sınırları korunur; capability token veya sahte genel kişi subject’i açılmaz. Kesin bağlam kümesi ve tüketim [WF11](../../../docs/workflows.md#wf11), backend değerlendirmesi [XREQ-059](../../../docs/requests.md#xreq-059) sahibindedir.

## W1-BE-24 · Aday panosunun güvenli keşif okumaları

**Durum:** Backend desteği PR322 ile main/development üzerinde karşılandı; aynı kaynak kanıtları üst kayıtta. Frontend tüketimi ve E33 otomatik kabulü tamam; ekran kaydı [TODO/E33](todo.md#sayfa-kabulu) sahibindedir.

**Tüketim:** `leads_list_v1` aşama/sorumlu filtrelerini cursor kapsamına alır; `include_details/include_summary` gerçek gösterim ve kapsam özetini sağlar. Mevcut management selector’larında `lead_save_v1/directory:assignees`, `crm_activity_save_v1/directory:followups` ve `trial_offer_create_v1/directory:history|products` atanabilir sorumluları, manuel takipleri ve gerçek deneme geçmişi/konfigürasyonunu keşfeder. Başvuruda gerçek `received_at` okunur. Kesin DTO/rol/plan/cursor ve sonuç anlamları [WF16](https://github.com/SXQHex/FtkSaaS/blob/c1b00a1af28446ed71ba1cabd092bba65f63485a/docs/workflows.md#wf16), backend değerlendirmesi [XREQ-062](https://github.com/SXQHex/FtkSaaS/blob/c1b00a1af28446ed71ba1cabd092bba65f63485a/docs/requests.md#xreq-062) sahibindedir.

**Sınır:** Bütün kişi/geçmiş taranmaz; sayfa satırları merkez toplamı değildir. Kazanıldı aşaması öğrencilik dönüşümü sayılmaz. Teklif uygunluğu rezervasyon, hak veya kapasite kabulü değildir; eski native create/confirm/convert komutları ve başarı sonrası yeniden okuma korunur.

## W1-BE-25 · Public program sunumu ve başvuru hedefi

**Durum:** Backend desteği PR322 ile main/development üzerinde karşılandı; aynı kaynak kanıtları üst kayıtta. Frontend tüketimi ve ekran kabulünün sahibi TODO/E34–36’dır.

**Tüketim:** Worker POST `/api/public/calendar` → `public_calendar_get_v1(include_details:true,discipline_id?)` gerçek tür/saat dilimi, filtre ve yayın durumunu verir. `publication_set_v1.public_details.show_occupancy/show_instructors` birbirinden bağımsız ve varsayılan kapalıdır; eski yayınlar kendiliğinden açılmaz. Genel başvuru yalnız açıkça bağlanan etkin `public_application_form` ve yayımlanmış gerçek onay kaynağı üzerinden keşfedilir; özel form veya metin tahmin edilmez. Kesin durum/DTO/izin/onay eşlemesi [WF09](https://github.com/SXQHex/FtkSaaS/blob/c1b00a1af28446ed71ba1cabd092bba65f63485a/docs/workflows.md#wf09), backend değerlendirmesi [XREQ-063](https://github.com/SXQHex/FtkSaaS/blob/c1b00a1af28446ed71ba1cabd092bba65f63485a/docs/requests.md#xreq-063) sahibindedir.

**Sınır:** Anonim istemci Auth JWT/apikey göndermez; private okuyucuya fallback yoktur. `application.state` open/closed/unavailable ayrımı korunur; boş program kapalı yayın diye tahmin edilmez. Doluluk rezervasyon uygunluğu vaadi değildir. Native CAPTCHA/HMAC/rate/replay ve açık hukuki kabul korunur; gerçek widget/provider/hosted kabulü bu kaynak teslimiyle verilmez.

## W1-BE-26 · Etkinlik listesi filtreleri ve özetleri

**Durum:** Backend kaynak desteği PR319 ile main’de; aynı SHA’nın CI/development durumu üst kayıttadır. Frontend tüketimi ve ekran kabulü [TODO/E37](todo.md#sayfa-kabulu) sahibindedir.

**Backend kaynak karşılığı:** `event_list_v1(center_id,interval,discipline_id?,query?,status?,include_summary:true,page)` kırpılmış, büyük/küçük harfsiz literal başlık araması ve all/published/draft/occurred/cancelled durum filtresini cursor/limit öncesinde uygular. Filtre/özet seçimi cursor kapsamına bağlıdır; değişince ilk sayfaya dönülür. `summary` yetkili merkez/aralık/disiplin/başlık kümesinde seçili durumdan ve sayfadan bağımsız native durum sayaçlarını, published etkinliklerin aktif kayıt sayısını ve para birimine göre bağlı kalan borçları verir. Yönetim satırındaki `active_registration_count` gerçek sayıdır; `unresolved_payment_registrations` bilinmeyen borç bağını sıfıra çevirmez. Kesinleşmemiş ödeme hazırlıkları bu kayıt toplamına dahil değildir. Öz/atanmış eğitmen veya salt tahsilat yetkisi yönetim özetini açmaz. Kesin çağrı ve yetki sınırı [WF15](../../../docs/workflows.md#wf15), backend değerlendirmesi [XREQ-055](../../../docs/requests.md#xreq-055) sahibindedir.

**Sınır:** Tüm etkinlikleri/katılımcıları/finans geçmişini tarayıp istemci toplamı üretilmez; cursor sayfasında arama/durum süzülmez. Para birimi tahmin edilmez veya farklı para birimleri toplanmaz. Mevcut kayıt/kapasite/ödeme yetkileri genişletilmez. Taslak oluşturma/düzenleme ve native tekil detay gibi bağımsız işlemler mevcut kaynakla sürdürülecek; E37’nin kaynak/entegrasyon/kabul durumu TODO sahibindedir.

## W1-BE-27 · Etkinlik kaydının gerçek ödeme/borç kaynağı

**Durum:** Backend kaynak desteği PR319 ile main’de; aynı SHA’nın CI/development durumu üst kayıttadır. Frontend tüketimi ve ekran kabulü [TODO/E38](todo.md#sayfa-kabulu) sahibindedir.

**Backend kaynak karşılığı:** `event_get_v1(event_id,include_payment_summary:true)` zaten görünür kayıtlara `payment_summary` ekler. `amount_minor/currency` kaydın değişmez bedeli; `debts` gerçek borç kimliği/sürümü, varsa gerçek preparation_id ve net/paid/remaining/credited/cancelled bakiyeleridir. Hazırlıksız kaydın borcunu keşfetmek için yeni hazırlık yaratılmaz. `available` gerçek borcu, `no_cash_due` sıfır nakit bedelli borçsuz kaydı, `missing` pozitif bedelin eksik borç bağını, `restricted` ödeme okuma yetkisinin yokluğunu ayırır. Son iki durumda bilinmeyen bakiyeler null ve borç listesi boş kalır; missing değişmez kayıt bedelini korur. Mevcut debt_ids hedefli tahsilat ve native iptal/öğrenci alacağı yazarları korunur. Kesin çağrı ve yetki sınırı [WF15](../../../docs/workflows.md#wf15), backend değerlendirmesi [XREQ-056](../../../docs/requests.md#xreq-056) sahibindedir.

**Sınır:** Etkinliğin güncel terms.fee_minor değeri geçmiş kaydın ücreti veya borcu değildir. Kişinin borçları sıraya/kimlik benzerliğine göre etkinliğe bağlanmaz; yeni hazırlık/borç yaratarak keşif yapılmaz. Finans/kişi/merkez yetkileri ve native debt_ids hedefli tahsilat korunur. Görünen bütün kişilerin finans geçmişini tarama istenmiyor. Hazırlıklı yeni kayıtlar ve bağımsız yayın/katılım işlemleri mevcut native kaynakla sürdürülecek; frontend kabulü TODO/E38 sahibindedir.

## W1-BE-28 · Kendi gelen kutusunun kalan çizim eşlemesi

**Durum:** Backend desteği PR321 ile karşılandı; kaynak/main/development kanıtı üst kayıtta. Yeni alanlar frontend tarafından tüketiliyor; E39 kapanış kabulü [TODO](todo.md#sayfa-kabulu) sahibindedir.

**Karşılanan kapsam:** `notifications_list_v1` kendi organizasyon inbox’ında literal arama, gerçek kaynak iş durumu, native kaynak selector/merkez ve filtre geneli sayaçları opt-in sunar. `center_id` merkez filtresi değildir. `notifications_read_set_v1` açık seçilmiş1–100 kendi bildirimine gerçek sürümleriyle atomik okundu/okunmadı uygular; eski tekil mark-read korunur. Bütün sorguyu işaretleme komutu yoktur. Stale/yabancı tek kayıt bütün seçimi geri alır; aynı-key kurtarma ve işlem sonrası liste/sayaç yeniden okuması native kalır.

**Korunan kullanıcı kararı:** Okundu bilgisi kaynak işin tamamlanması değildir; bağımsız görev tamamlama veya ileti yanıtı eklenmez. Bildirim, yazma aksiyonu seçmez. Dönen güvenli selector ile önce gerçek kaynak ayrıntısı/sürümü okunur; izinli ret/onay/alternatif/geri çekme gibi eylem kendi ekranında açıkça seçilir. Son düzeltme resolve-only personelin tekil native talep okuyucusunu kullanır; salt okuma yazma yetkisi vermez. Erişilemeyen kaynağın selector/merkezi null kalır; tüm kişi/bildirim geçmişi taranmaz. Bu kendi inbox desteği W1-BE-32 merkez yönetim kuyruğunun karşılığı değildir.

Kesin filtre/cursor/sürüm ve kaynak görünürlüğü [WF11](https://github.com/SXQHex/FtkSaaS/blob/2b36e190ecc121c431d24b7c472715c2a565f9f8/docs/workflows.md#wf11) ve [WF06](https://github.com/SXQHex/FtkSaaS/blob/2b36e190ecc121c431d24b7c472715c2a565f9f8/docs/workflows.md#wf06), backend değerlendirmesi [XREQ-060](https://github.com/SXQHex/FtkSaaS/blob/2b36e190ecc121c431d24b7c472715c2a565f9f8/docs/requests.md#xreq-060) sahibindedir; native kaynak/test kaydı [backend devrindedir](https://github.com/SXQHex/FtkSaaS/blob/2b36e190ecc121c431d24b7c472715c2a565f9f8/apps/backend/docs/00-FtkSaaS-yeni-sohbet-devir.md#web1-ledger-inbox-automation).

## W1-BE-29 · Otomasyon çiziminin kalan native eşlemesi

**Durum:** Kullanıcının seçtiği dar native WF16 kapsamı PR321 ile karşılandı; kaynak/main/development kanıtı üst kayıtta. Frontend tüketimi tamam; E40 kapanış kabulü [TODO](todo.md#sayfa-kabulu) sahibindedir.

**Karşılanan kapsam:** Mevcut management okuyucusunun segment selector’ü açık execution_center_id ile kayıtlı native koşulların eşleşme/sayı/örneklerini ve kullanan yetkili otomasyonları keşfeder. Otomasyon selector’ünün jobs keşfi gerçek kapsam işlerini cursor ile, güvenli zaman/config/durum/sonuç/retry ve sayfadan bağımsız native sayaçlarıyla verir. Canlı yetki, merkez, tanım sürümü ve cursor sınırları korunur; bütün kişi/borç/iş geçmişleri istemcide taranmaz. Eşleşme worker çalıştırma veya tetiklenme garantisi değildir.

**Korunan kullanıcı kararı ve destek sınırı:** Haftalık/segmente giriş tetikleme, elle çalıştırma, silme ve yeni kayan segment koşulları eklenmedi. Mevcut save/disable/başarısız iş retry yolları kullanılır; worker istemciden çağrılmaz. configuration_creator_person_id mevcut config sahibidir, tarihsel elle çalıştıran kişi değildir; initiator_kind automation’dır. Gerçek notification/followup sonuçları teslim kanıtı sayılmaz; email_delivery açıkça not_supported’dır. Disabled tanım silinmiş veya elle çalıştırılabilir gösterilmez.

Kesin keşif/özet/rol/plan ve sonuç anlamları [WF16](https://github.com/SXQHex/FtkSaaS/blob/2b36e190ecc121c431d24b7c472715c2a565f9f8/docs/workflows.md#wf16), backend değerlendirmesi [XREQ-061](https://github.com/SXQHex/FtkSaaS/blob/2b36e190ecc121c431d24b7c472715c2a565f9f8/docs/requests.md#xreq-061) sahibindedir; kaynak/native test kanıtı [backend devrindedir](https://github.com/SXQHex/FtkSaaS/blob/2b36e190ecc121c431d24b7c472715c2a565f9f8/apps/backend/docs/00-FtkSaaS-yeni-sohbet-devir.md#web1-ledger-inbox-automation).

## W1-BE-30 · Rapor çiziminin kalan native eşlemesi

**Durum:** Backend desteği ve açıklanan native sınırlar PR323 ile main/development üzerinde karşılandı; aynı kaynak kanıtları üst kayıtta. Frontend tüketimi ve ekran kabulünün sahibi TODO/E41’dir.

**Tüketim:** `report_get_v1` ve mevcut worker/export zinciri `sales`, `session_metrics`, `collection_breakdown`, `instructor_balances` türlerini destekler. Satış; kaydedilmiş gerçek tutarı, merkez saat diliminde ISO haftayı, değişmez ürün sürümünü veya canonical kişiyi kullanır; iptal/iade varsayılan toplamdan düşülmez. Seans ölçümleri gerçek kayıt/kapasite ve kapalı yoklama pay/paydasını; tahsilat kırılımı gerçek kök neti/borç tahsislerini; hakediş raporu dönem ve bağlı kök bakiye anlamlarını verir. Toplamlar cursor öncesi ve para birimi ayrıdır. Aynı tahsilatın birden çok grupta görünmesi global adedi çoğaltmaz. Güvenli ad/ürün/seans/hafta kolonları açık export seçimiyle kullanılabilir; ACK gerçek dosya başarısı değildir.

`import_directory_get_v1` kendi hesabının aynı merkezdeki yetkili import işlerini ve gerçek max_bytes/max_rows limitlerini keşfeder. Config yoksa limit null’dır. `import_rows_list_v1` durum ve aramayı bütün dosyada cursor öncesi uygular; `include_details` sınırlı student_preview ad/iletişim alanları ile gerçek mükerrer uyarılarını açar. Upload → complete → preview/worker → açık apply → job/satır/domain yeniden okuma yolu korunur.

**Sınır:** Rapor interval’i zorunlu, yarı açık ve en çok366 gündür; sınırsız tüm dönem raporu için tarih uydurulmaz. Tahsilatı eğitmene dağıtan native parasal bağ yoktur; görevlendirmeden pay türetilmez. Para birimleri, grup adetleri veya sayfa satırları global toplam gibi birleştirilmez. Config’siz upload, self/başka hesap, CRM/import ve finans yetki sınırları korunur; import merge, pazarlama izni veya sahte başarı üretmez. Kesin tüketim [WF10](https://github.com/SXQHex/FtkSaaS/blob/3fdd825fe2656e9ae7077adbdd4d297017a69e9a/docs/workflows.md#wf10), backend değerlendirmesi [XREQ-065](https://github.com/SXQHex/FtkSaaS/blob/3fdd825fe2656e9ae7077adbdd4d297017a69e9a/docs/requests.md#xreq-065) sahibindedir; ekran kabulü [TODO/E41](todo.md#sayfa-kabulu) sahibindedir.

## W1-BE-31 · Belge yönetimi dizini ve kabul özeti

**Durum:** Backend kaynak desteği PR324 ile main’e birleşti; aynı kaynak/main/development kanıtları üst kayıtta. Frontend tüketimi ve ekran kabulünün sahibi TODO/E22’dir.

**Tüketim:** `document_directory_get_v1(center_id,view:documents|versions|acceptances,page,scope?,document_id?,version_id?,acceptance_filter?,query?)` F30 ve native belge konfigürasyon yetkisini korur. Versions/acceptances gerçek document_id ister; pending yalnız eksik güncel gereksinimdir. Belge/sürüm/arama kapsamının sayfa öncesi özeti published_documents/unpublished_files/last_publication/acceptance_records ve canonical pending_members/total_members verir. Kitle aktif gerçek işlemler ve süresi dolmamış/current/unused satın alma önizlemelerindeki gereksinim sahipleridir; tarihsel kabuller paydaya eklenmez.

**Sınır:** Başka yükleyicinin taslağı read_only, expired_upload kullanılabilir taslak sayacının dışındadır. Center dizininde organizasyon belgesini yalnız gerçek güncel gereksinim açar; konfigürasyon yetkisi yoksa metadata salt okunur ve requirements/version_count/acceptance_records null’dır; versions reddedilir, acceptances history_available=false ile yalnız güncel gereksinim döner. Güncel valid gereksinim, evidence_matches_version ve tarihsel recorded/invalidated farklı anlam taşır; renewed_acceptance=false eski kanıtı geçerli tutabilir. İçerik/hash/token veya başkası adına kabul açılmaz; upload/complete/publication preview/publish ve kendi bağlamlı kabul yolları korunur. Cursor VERSION_CONFLICT sonrası ilk sayfa yeniden okunur.

Kesin kaynak/yetki ve DTO [WF11](https://github.com/SXQHex/FtkSaaS/blob/2045b942998c2d0bf765978f25024b7d66ea6fd6/docs/workflows.md#wf11), backend değerlendirmesi [XREQ-068](https://github.com/SXQHex/FtkSaaS/blob/2045b942998c2d0bf765978f25024b7d66ea6fd6/docs/requests.md#xreq-068), ekran kabulü [TODO/E22](todo.md#sayfa-kabulu) sahibindedir.

## W1-BE-32 · Genel bakışta bekleyen yönetim işleri

**Durum:** Backend desteği PR322 ile main/development üzerinde karşılandı; aynı kaynak kanıtları üst kayıtta. E11 tüketimi ve otomatik kabulü tamam; ekran kaydı [TODO/E11](todo.md#sayfa-kabulu) sahibindedir.

**Tüketim:** `management_work_list_v1` seçili merkezin aktöre yetkili bütün bekleyen işlerini keşfeder: ders talebi, ders yoklaması, etkinlik yoklaması, CRM takibi ve başvuru incelemesi. Gerçek kimlik/sürüm/tarih, güvenli başlık/kişi ve typed native ayrıntı hedefi sunulur; cursor/sıra ve kapsam özetleri backend’den gelir. Kesin çağrı/yetki/plan/sayaç anlamları [WF16](https://github.com/SXQHex/FtkSaaS/blob/c1b00a1af28446ed71ba1cabd092bba65f63485a/docs/workflows.md#wf16), backend değerlendirmesi [XREQ-064](https://github.com/SXQHex/FtkSaaS/blob/c1b00a1af28446ed71ba1cabd092bba65f63485a/docs/requests.md#xreq-064) sahibindedir.

**Sınır:** Kullanıcı kararı gereği yalnız kişiye atanmış işler değil, seçili merkezin bütün yetkili işleri gösterilir. Kuyruk yeni görev/yanıt/tamamlama motoru değildir; önce kaynak ayrıntısı/sürümü okunur, ardından mevcut açık native komut seçilir ve kuyruk yenilenir. Eksik kurulum, borç veya geçen saatten yeni iş üretilmez; gerçek son tarih yerine ders saati kullanılmaz. Bütün kişi/geçmiş taranmaz; native kişi/merkez/rol/plan görünürlüğü korunur.

## W1-BE-33 · Yönetici hakediş ve ödeme keşfi

**Durum:** Backend desteği ve açıklanan native sınırlar PR323 ile main/development üzerinde karşılandı; aynı kaynak kanıtları üst kayıtta. Frontend tüketimi ve ekran kabulünün sahibi TODO/E23’tür.

**Tüketim:** `instructor_finance_directory_get_v1(org_id,center_id,view:instructors|earnings|payments,page,person_id?,interval?)` mevcut earnings.read yönetim kapsamı, erişilebilir merkez ve F20 ile çalışır. Interval atlanınca bütün dönemler gelir. Eğitmen görünümü tarihsel anlaşma/hakediş/ödeme sahiplerini güncel görev yokluğunda kaybetmez; gerçek agreement_ids/current_agreement_ids ve dönem özetlerini verir. Satırlar gerçek seans/etkinlik adı ve hakedişin değişmez anlaşma sürümünü; ödemeler gerçek kök/düzeltme bağı, sürüm, yöntem/reference ve düzeltme gerekçesini taşır. Para birimine göre earned/paid/remaining/overpaid ve tekil kapalı ders sayısı cursor öncesi gelir; earned oluşum, paid gerçekleşme dönemi, kalan ise seçili köklerin güncel bağlı bakiyesidir.

**Sınır:** Self eğitmen okuyucusu yönetici adına kullanılmaz. Native cursor tam sonuç/aktör/filtreye bağlıdır; canlı değişimde VERSION_CONFLICT ilk sayfadan okumayı gerektirir. İlk ödemede bağımsız Not yazımı ve fazla ödeme/avans yoktur; reference nota dönüştürülmez. Seçili earning_ids, gerçek yöntem ve kök expected_version ile mevcut ödeme/düzeltme komutları kullanılır; belirsiz sonuç aynı key ile kurtarılır ve ilgili görünümler yeniden okunur. Kesin tüketim [WF14](https://github.com/SXQHex/FtkSaaS/blob/3fdd825fe2656e9ae7077adbdd4d297017a69e9a/docs/workflows.md#wf14), backend değerlendirmesi [XREQ-066](https://github.com/SXQHex/FtkSaaS/blob/3fdd825fe2656e9ae7077adbdd4d297017a69e9a/docs/requests.md#xreq-066) sahibindedir; ekran kabulü [TODO/E23](todo.md#sayfa-kabulu) sahibindedir.

## W1-BE-34 · Denetim ve işlem durumu ekranı

**Durum:** Backend desteği ve açıklanan native sınırlar PR323 ile main/development üzerinde karşılandı; aynı kaynak kanıtları üst kayıtta. Frontend tüketimi ve ekran kabulünün sahibi TODO/E43’tür.

**Tüketim:** `audit_list_v1` subject atlanınca açık merkezde güvenli denetim keşfi, arama/modül/recorded filtresi ve isteğe bağlı dönem sunar; eski tek nesne yolu korunur. Her satır özgün nesne yetkisiyle, finans satırları ayrıca finance.read ile denetlenir. `tracking_directory_get_v1` yalnız kendi hesabının aynı merkezdeki yetkili receipt/preview ve rapor/import işlerini kind/state/query/interval ve cursor ile keşfeder. Gerçek ilerleme, nullable payda, güvenli hata ve yalnız uygun durumda next_attempt_at gelir. Sayaçlar yetkili query/interval kümesinde cursor/kind/state öncesidir; aynı akışın ayrı native kayıtları birleştirilmez. Kaynak eylemi kendi WF/getter/writer yolunda açıkça seçilir; başarı/yetki değişiminde dizin yeniden okunur.

**Sınır:** Audit sonucu yalnız kesinleşmiş `recorded` kaydıdır; başarısız/ret logu, merkez audit export API’si veya sınırsız worker dizini yoktur. İşlem dizini başka hesabın kaydını, token/operation_key/onay/lease/request veya Auth kimliğini açmaz. Genel tekrar çalıştırma, başkası adına onay veya yerel ilerleme animasyonu üretilmez. Süresi dolan preview yeni kaynak/önizleme ister; kayıtlı başarı ile sonucun saklama süresinin dolması ayrıdır. Sahte tarih aralığı, cihaz veya saklama süresi uydurulmaz. Kesin tüketim [WF00](https://github.com/SXQHex/FtkSaaS/blob/3fdd825fe2656e9ae7077adbdd4d297017a69e9a/docs/workflows.md#wf00), sayaç kararı [FD10](https://github.com/SXQHex/FtkSaaS/blob/3fdd825fe2656e9ae7077adbdd4d297017a69e9a/docs/contracts/02-FtkSaaS-teknik-sozlesme.md#fd10--iş-otomasyonu-rapor-import-kabul-edildi), backend değerlendirmesi [XREQ-067](https://github.com/SXQHex/FtkSaaS/blob/3fdd825fe2656e9ae7077adbdd4d297017a69e9a/docs/requests.md#xreq-067) sahibindedir; ekran kabulü [TODO/E43](todo.md#sayfa-kabulu) sahibindedir.

## W1-BE-35 · Ekipte yönetici rolü keşfi

**Durum:** Kaynak/main/development karşılandı; [PR327](https://github.com/SXQHex/FtkSaaS/pull/327), `3b4eaf28f469eef3f66be82aaa3dc65759313ac7`. Aynı kaynağın CI/ortam durumu üst kayıttadır. Frontend tüketimi ve kabulü [TODO/E42](todo.md#sayfa-kabulu) sahibindedir.

**Tüketim:** `roles_list_v1` mevcut `Role` ve `RecordState` değerleriyle isteğe bağlı `role`/`state` filtreleri alır; atlanan filtre o boyutu sınırlamaz. Filtreler kişi/merkez koşullarıyla limitten önce uygulanır; cursor aktör/hesap/istek kapsamına bağlıdır. Değişen filtrede ilk sayfaya dönülür; canlı yetki/plan her sayfada yeniden denetlenir.

OM için organizasyon okuyucusu `center_id` atlar ve `role=org_manager` kullanır. Açık merkez yalnız kendi atamalarını döndürür; OM atamasını içermez. CM, merkez atlandığında dahi yalnız mevcut yetkili/erişilebilir merkezleri görür; filtre org erişimi veya writer yetkisi açmaz. Sahiplik organizasyon kaynağındadır; `owner` filtresi için sahte atama üretilmez. Mevcut kişi/rol referansı ilgili native ayrıntı/atama/geri alma yoluna bağlanır; Auth/hesap kimliği veya token açılmaz. Kesin sözleşme [WF02](https://github.com/SXQHex/FtkSaaS/blob/3b4eaf28f469eef3f66be82aaa3dc65759313ac7/docs/workflows.md#wf02) ve aynı SHA’daki makine şemasıdır.

## W1-BE-36 · Native Auth recovery kabul aracının callback kaynağı

**Karşılandı:** [PR328](https://github.com/SXQHex/FtkSaaS/pull/328) main `b219f2be822338b40460f1bb981e00d07b6be70e` üzerinde native ve expired modlarına zorunlu origin/path/next pini ile stdin girdisi ekledi. Native Auth sözleşmesi korunuyor. Aynı SHA’da [Main proof](https://github.com/SXQHex/FtkSaaS/actions/runs/44192177548), [Merge proof](https://github.com/SXQHex/FtkSaaS/actions/runs/44192177737) ve [Development delivery](https://github.com/SXQHex/FtkSaaS/actions/runs/44192271441) başarılı.

Kullanım ve kaynak sınırı [backend çalışma rehberinde](../../backend/docs/remote-backend-setup.md#pinlenmiş-callback-ile-native-recovery-kabulü). Google-only ilk parola, doğal süre dolumu ve güvenlik postasının eylem hedefi dahil frontend kabulünün sahibi [P01.4](todo.md#p01--kimlik-hesap-ve-güvenlik-kapalı).

## W1-BE-37 · Native güvenlik postasının kurtarma yolu

**Karşılandı.** [PR329](https://github.com/SXQHex/FtkSaaS/pull/329) development Auth şablonunda kurtarma hedefini tam `https://app.fethiyetango.com/forgot-password` olarak üretti. Özgün parola korunarak alınan iki gerçek postanın HTML eylemi ve diğer Auth ayarlarının korunduğu backend kabulünde doğrulandı. [Main kabulü](https://github.com/SXQHex/FtkSaaS/actions/runs/44210183795) · [Development teslimi](https://github.com/SXQHex/FtkSaaS/actions/runs/44210267029).

## W1-BE-38 · Etkinlik kaydı öncesi üyenin kendi belge bağlamını keşfi

**Karşılandı.** PR329 mevcut `event_registration_preview_v1` önizlemesine bağlı keşfi `member_document_contexts_get_v1` içinde yayımladı. Üyenin kendi bağlamında `event_registration_preview_id` ve varsa gerçek ürün sürümü bulunur. Native kabul üyenin onayı sonrası yöneticinin ilk kaydı tamamladığını doğruladı. [WF11](../../../docs/workflows.md#wf11) · [Native kabul](https://github.com/SXQHex/FtkSaaS/actions/runs/44206547572).

## W1-BE-39 · Borç nedeniyle rezervasyon reddinin güvenli nedeni

**Karşılandı.** [PR330](https://github.com/SXQHex/FtkSaaS/pull/330) yetkili rezervasyonda `DEBT_BOOKING_BLOCKED` döndürüyor. Yetkisiz aktörün genel reddi ve yazısız sonuç native testte doğrulandı. [WF06](../../../docs/workflows.md#wf06) · [Aday kabulü](https://github.com/SXQHex/FtkSaaS/actions/runs/44218399421) · [Main kabulü](https://github.com/SXQHex/FtkSaaS/actions/runs/44221816510) · [Development teslimi](https://github.com/SXQHex/FtkSaaS/actions/runs/44221924497).

## W1-BE-40 · Ders değişikliğinde etkilenen öğrenci bildirimi

**Karşılandı.** PR330 başarılı ders değişikliğinde aynı seansın aktif rezervasyon sahiplerine uygulama içi bildirim gönderiyor. Stale/başarısız yazıda veya aynı anahtarın tekrarında ek bildirim oluşmadığı native testte doğrulandı. [WF11](../../../docs/workflows.md#wf11).

## W1-BE-41 · Native ilk parola kabulü

**Karşılandı.** PR330’un native CI senaryosu sentetik Google-only hesabın parolasız durumunu doğruladı, gerçek yerel native oturumdan ilk parolayı yazdı ve parola girişinde aynı Auth ve Edge hesabını okudu. Etkileşimli Google rızası P01.3 kapsamındaki ayrı kontroldür. [Native test](../../backend/tests/account-identity-acceptance.mjs) · [Aday kabulü](https://github.com/SXQHex/FtkSaaS/actions/runs/44218399421).

## W1-BE-42 · Starter oturumunun kendi yönetim kapsamını keşfetmesi

**Kaynak ve development doğrulandı. Yayımlı Web1 kabulü açık.** Backend [PR334](https://github.com/SXQHex/FtkSaaS/pull/334) main `eb51ac41f89211955fbc72f36670545912f7d29e` üzerinde yayımlandı. [Main kabulü](https://github.com/SXQHex/FtkSaaS/actions/runs/44297628952) ve [development teslimi](https://github.com/SXQHex/FtkSaaS/actions/runs/44297716964) aynı kaynakta başarılı. Web1, `organizations_list_v1(include_self_management_scope:true)` yanıtını canlı yönetim kapsamı için kullanıyor. Yerel üretim derlemesi gerçek development üzerinde Starter2 sahibine Stüdyo’yu açtı, öğrenciye yönetim bağlantısı göstermedi ve F05 rol dizini reddini korudu. İki test oturumu kapatıldı. [Web1 adayı](https://github.com/SXQHex/FtkSaaS/pull/335) · [Tarayıcı kanıtı](../.tmp/goal-1309-w1-be-42-live-browser.json).

İlk bulgu. 18 Kasım’da yayımlı Web1, sentetik Starter2 sahibiyle gerçek development Auth girişini tamamladı. Hesap, organizasyon ve erişilebilir tek merkez HTTP 200 ile okundu. Kendi kanonik `person_id` değeriyle `roles_list_v1` HTTP 200 zarfında `PLAN_FEATURE_UNAVAILABLE` döndürdü. Merkez filtresi olmadan açık `role=owner`, `state=active` isteği de aynı sonucu verdi. Web1 yönetim bağlantılarını kuramadı. Hesap ekranı açıldı ve test oturumu kapatıldı. [Web1 çağrı kaynağı](../src/features/workspace/workspace.ts) · [Güvenli hosted kanıtı](../.tmp/starter-hosted-web1-readback.json).

Web1’in yalnız oturumun kendi etkin yönetim rolünü ve erişilebilir merkez kapsamını yayımlanmış bir okuyucudan edinmesi gerekiyor. İzinli Starter owner ve merkez yöneticisi durumlarını, rol geri alımını ve plan geçişini doğrula. Öğrencide ve kapsam dışı kişide yönetim kapsamı dönmemeli. Başka kişilerin rol dizini ve bağımsız personel yönetimi için F05 kapısı korunmalı. WF02’nin mevcut eğitmen ataması seçicisi kayıtlı eğitmen rolünü doğruluyor. Yönetici gezinmesi için gerekli kendi yönetim rolünü bu seçici sağlamıyor. [WF02](../../../docs/workflows.md#wf02).

## W1-BE-43 · Hesaptan ilk stüdyo kurulumuna yetkili geçiş

**Açık · backend değerlendirmesi.** v67 ilk kurulum ekranı yeni hesabın stüdyo, ilk salon ve ders türü adımlarını sunuyor. Web1’in native kayıt akışı hesap oluşturuyor. WF02’de `organization_create_v1` platform sahibine ayrılmış. `center_create_v1` var olan organizasyonda `org.manage` istiyor. Salon ve merkez disiplini yazıları etkin merkez ve ayrı canlı `center.manage` yetkisi gerektiriyor. Sahiplik kendiliğinden bu merkez yetkisini vermiyor. [API kataloğu](../../../docs/functions.md) · [WF02](../../../docs/workflows.md#wf02).

Organizasyonu olmayan doğrulanmış stüdyo hesabının yetkili kurulum girişini, organizasyonu hazırlayan aktörü ve ilk merkez oluşturulduktan sonra merkez yönetim kapsamının hangi doğrulanmış kaynaktan açılacağını belirleyin. Mevcut platform sınırı, Starter limitleri ve yeniden denemede tek sonuç korunmalı. Sahipliği veya merkez yönetimini dolaylı varsaydıran bir istemci kuralı eklenmemeli. Mevcut destekle Web1, yetkili hazır organizasyonda gerçek ilk merkezi oluşturuyor; canlı merkez yöneticisine eksik salon/disiplin için mevcut ayar akışlarını sunuyor. [E47](todo.md#e47-ilk-kurulum).

## W1-BE-44 · Özel ders talebinde öğrencinin notu

**Açık · backend değerlendirmesi.** Güncel çizimde öğrenci yeni özel ders talebine isteğe bağlı not ekleyebiliyor. `lesson_request_create_v1` öğrenci notu almıyor ve `LessonRequestView` öğrenci notu döndürmüyor. Bu nedenle Web1 talep formunda not alanını göstermiyor. [v67 arşivinde çizim](../design-reference/revisions/2026-11-18/app.js#L4336) · [WF06](../../../docs/workflows.md#wf06).

Notun yazma ve geri okuma sözleşmesini, metin sınırlarını ve talep sahibi ile inceleyen yetkililerin okuma kapsamını değerlendirin. Notlu ve notsuz talep, yetki reddi ve aynı-key yeniden deneme mevcut talep davranışıyla birlikte doğrulanmalı. [E31](todo.md#sayfa-kabulu).

## W1-BE-45 · Eğitmenin hakedişinde tarihsel seans ve anlaşma bağlamı

**Açık · backend değerlendirmesi.** Çizimde eğitmen, kapanmış seansın adı, süresi, katılımcı sayısı ve hakediş hesaplanırken kullanılan anlaşma sürümünü kendi satırında görüyor. `instructor_account_get_v1(view:earnings)` seans ve anlaşma referanslarını, hesaplama türünü ve miktarını döndürüyor. Seans etiketi, süre, katılımcı sayısı ve hesaplamaya bağlı sürüm bu yanıtta yok. Hesaplama miktarının anlamı basis türüne bağlıdır. [v67 çizimi](../design-reference/revisions/2026-11-18/app.js#L3955) · [WF14](../../../docs/workflows.md#wf14).

Satır bağlamının kendi hakediş okumasında güvenle dönmesini değerlendirin. Düzeltme, anlaşma sürümü değişikliği ve güncel atama kalktıktan sonraki tarihsel kayıtlar için kaynak anlamı korunmalı. Var olan self, merkez, plan ve cursor sınırlarıyla birlikte doğrulanmalı. [W1-BE-19](#w1-be-19--eğitmenin-kendi-hakediş-özeti-ve-ödeme-keşfi) mevcut okumanın sahibidir.

## W1-BE-46 · Yetkili yönetici için stüdyo programı ICS aboneliği

**Açık · backend değerlendirmesi.** Çizim, yöneticiye stüdyo programının takvim aboneliğini sunuyor. Yayımlanmış kişisel ICS sözleşmesinde `lessons` yalnız hesabın kendi aktif rezervasyonlarını, `duties` kendi aktif atamalarını içerir. Yönetici rolü program geneli aboneliği açmaz. [v67 çizimi](../design-reference/revisions/2026-11-18/app.js#L7187) · [WF09](../../../docs/workflows.md#wf09).

Program aboneliğinin yetkili rol ve merkez kapsamını, plan kapısını, çıktıda paylaşılacak asgari alanları ve yetki geri alındığında mevcut bağlantının davranışını belirleyin. Abonelik bağlantısı yalnız yetkili oluşturma ve yenileme cevabında açılmalı. Başkasının bağlantısı ve kişisel bilgileri yöneticiye verilmemeli. Eğitmen ataması olan yönetici kendi atamalarına ait kişisel `duties` bağlantısını kullanabilir.

## W1-BE-47 · Üye gelen kutusunda tümünü okundu yapma

**Açık · backend değerlendirmesi.** Üye çizimi, gelen kutusunun tamamını tek eylemle okundu yapıyor. `notifications_read_set_v1` yalnız açıkça seçilen 1–100 kimlik ve sürümü güncelliyor. Web1 üye kabuğunda mevcut seçili iletileri okundu yapma akışı çalışıyor. [v67 çizimi](../design-reference/revisions/2026-11-18/index.html#L1498) · [WF11](../../../docs/workflows.md#wf11).

Gelen kutusu kapsamının tamamını okundu yapacak işlem için canlı alıcı ve organizasyon sınırlarını, aynı anahtarla yeniden denemeyi ve işlem sırasında gelen yeni bildirimlerin davranışını değerlendirin. İlk sayfayı güncellemek bütün kutunun tamamlandığı anlamına gelmemeli. Okundu durumu kaynak işi kapatmamalı. [E48](todo.md#e48--üye-bildirim-merkezi).

## W1-BE-48 · Ders değişikliği bildiriminde yetkili kaynak merkezi

**Açık · backend değerlendirmesi.** Kendi organizasyon gelen kutusundaki `session_changed_for_participant` bildirimi seans kimliğini taşıyor. Bilgilendirme satırında seansın yetkili kaynak merkezi ve seans seçicisi yayımlanmıyor. Web1, seçili merkezdeki kendi rezervasyonunu seans kimliğiyle doğrulayabildiğinde hedef bağlantısını sunuyor. Başka bir merkezdeki seans, kaynak merkezi yayımlanana kadar o merkez seçildiğinde açılabiliyor. [WF11](../../../docs/workflows.md#wf11).

Canlı rezervasyon, öğrenci ve merkez yetkisi geçerliyken bildirimin gerçek kaynak merkezini döndürmeyi değerlendirin. İptal edilmiş, silinmiş ya da erişim dışı kayıtta hedef kapalı kalmalı. Diğer bildirimlerin organizasyon kapsamı ve bilgilendirme durumu korunmalı. [E48](todo.md#e48--üye-bildirim-merkezi).

## W1-BE-49 · Eğitmen yoklama zaman sınırı ve düzeltme isteği

**Açık · backend değerlendirmesi.** Eğitmen çizimi, seans için yoklamanın ne zaman açılacağını ve kapanmış yoklamaya gerekçeli düzeltme isteği vermeyi gösteriyor. `attendance_get_v1` fiilî başlangıç, kapanış durumu, revizyon ve kayıtları sağlıyor. Yayımlanmış okuma sözleşmesinde seansa özel açma veya kapatma zaman sınırı bulunmuyor. `attendance_correct_preview_v1` ve `attendance_correct_apply_v1` düzeltme yetkisi olan operatörün işlemleri. Eğitmenin yöneticiye ilettiği ayrı isteği oluşturma ve durumunu okuma desteği bulunmuyor. [Güncel çizim](../read-only/tasarim-v2/app.js#L3885) · [WF07](../../../docs/workflows.md#wf07).

Yoklama için izinli zaman aralığı varsa bu aralığın canlı politika ve yetkiyle nasıl okunacağını değerlendirin. Kapanmış yoklamada yalnız atanmış eğitmenin, seans ve kapanış revizyonuna bağlı gerekçeli isteği gönderebilmesi ve durumunu okuyabilmesi ayrı değerlendirme gerektiriyor. İsteğin kendisi yoklamayı, hakkı veya hakedişi değiştirmemeli. Yetki kaybı, değişen kapanış sürümü ve aynı anahtarla tekrar deneme doğrulanmalı.
