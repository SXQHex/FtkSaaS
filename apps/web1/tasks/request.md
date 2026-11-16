# Web1 · Backend talepleri

16 Kasım 2026 · Frontend talep kaydı. Bu dosya backend ihtiyaçlarının ve karşılanma durumlarının ayrıntı sahibidir; ekran sırası, uygulama ilerlemesi ve frontend kabulü [TODO](todo.md) içinde kalır. W1-BE-01–16 için backend kaynak desteği karşılandı. Açık talepler W1-BE-17–23’dir; kapsamları aşağıdaki tabloda ve kendi bölümlerinde tutulur. E18 frontend tüketimi ve kabulünün tek sahibi [TODO](todo.md) kaydıdır. Talep açılması tek başına backend onayı veya uygulama kanıtı değildir; karşılanan talepler aşağıda kaynaklarıyla işaretlidir. Backend kodu, ortak sözleşmeler ve backend kabul kayıtları bu frontend çalışmasında değiştirilmez.

İncelenen main: `1df2e01c40fd625b0def974fe3347da65032fcfd` (PR315 dahil). Tüketici kaynak: `feat/web1-account-acceptance`, [PR308](https://github.com/SXQHex/FtkSaaS/pull/308). Aynı kaynak [Main proof](https://github.com/SXQHex/FtkSaaS/actions/runs/43863721918), [Merge proof](https://github.com/SXQHex/FtkSaaS/actions/runs/43863721867) ve [development teslimi](https://github.com/SXQHex/FtkSaaS/actions/runs/43863802374) başarılıdır. Kaynak desteği frontend tüketimi veya güncel hosted tekrar kabulü sayılmaz. Ekran durumu ve Pro teslim sonrası gerçek kontroller yalnız [TODO](todo.md) sahibindedir.

| Kimlik   | Ekran / işlev             | İhtiyaç                                                                          | Frontend tarafından bilinen durum                                                                                                              |
| -------- | ------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| W1-BE-01 | E13 · P04                 | Merkez öğrencilik durumuna göre cursor’lı kişi filtresi                          | Backend karşılandı (PR311); tüketici kabulü TODO/E13 sahibinde.                                                                                |
| W1-BE-02 | E13 · P04                 | Görünür kişi sayfası için hak, para birimine göre borç ve en yakın ders özeti    | Backend karşılandı (PR311); tüketici kabulü TODO/E13 sahibinde.                                                                                |
| W1-BE-03 | E15 · P04.3               | Merkez geneli davet/hesap bağlantısı keşfi, filtreler ve sayaçlar                | PR313 kişi dizini düzeltmesi mevcut; önceki503 tarihsel gözlemdir, güncel hosted tekrar kabulü yapılmadı.                                      |
| W1-BE-04 | E16 · P04.4               | Birleştirme gerekçesi, öneri/geçmiş keşfi ve kalıcı kopya-değil kararı           | Backend karşılandı (PR312); tüketici kabulü TODO/E16 sahibinde.                                                                                |
| W1-BE-05 | E12 · P03.3               | Son uygunluk kuralını kapatma ve mevcut kapanışı iptal etme                      | Backend karşılandı (PR312); tüketici kabulü TODO/E12 sahibinde.                                                                                |
| W1-BE-06 | E17 · P06                 | Sabit grup öğrenci üyeliğinin keşif ve ekle/çıkar native eşlemesi                | PR313 eşlemesi mevcut: sabit grup seans priority rezervasyonlarıdır; E17 tüketimi tamam; ekran kabulünün sahibi TODO/E17.                      |
| W1-BE-07 | E17 · P06.3/.4            | Seans düzenleme ve kalıcı telafi bağı için native okuma eşlemesi                 | PR313 typed düzenleme/telafi projeksiyonları mevcut; E17 tüketimi tamam; ekran kabulünün sahibi TODO/E17.                                      |
| W1-BE-08 | E17 · aynı-key kurtarma   | Native telafi komutu receipt okumasının typed request ile doğrulanması           | PR313 native capacity/receipt recovery düzeltmesi ve otomatik backend kabul testi mevcut; E17 tüketimi tamam; ekran kabulünün sahibi TODO/E17. |
| W1-BE-09 | E19 · P07                 | Paket yönetimi durum/arama/özet/geçmiş ve satışa kapatma/arşiv eşlemesi          | Backend karşılandı (PR313); yönetim/durum/geçmiş tüketiliyor, kabul sahibi TODO/E19.                                                           |
| W1-BE-10 | E20 · P08                 | Merkez geneli finans hareket/borç/alacak keşfi ve para birimine ayrılmış özetler | Backend karşılandı (PR313): finance_directory_get_v1 mevcut; frontend tüketimi TODO/E20 sahibinde.                                             |
| W1-BE-11 | E14 · P04/P07             | Üyelik başlangıcı ve hak hareket defteri                                         | Backend karşılandı (PR313): üyelik tarihi ve native satış ledger sayfası E14’e bağlı; ekran kabulü TODO/E14 sahibinde.                         |
| W1-BE-12 | E14 · P07.2               | Yetkili indirimli native satış                                                   | PR313 sale.discount + sale_discount_percent_upper eşlemesi mevcut; açık yetki/politika gerekir, otomatik grant yok.                            |
| W1-BE-13 | E14 · P09                 | Başlangıca göre rezervasyon zaman filtresi                                       | Backend karşılandı (PR314): time_filter sunucu/cursor kapsamında; E14 filtre bağlantısı ve yerel kabulü tamam.                                 |
| W1-BE-14 | E14 · P07.4               | Planlanmış dondurmayı tamamen iptal etme                                         | Backend karşılandı (PR314): ayrı cancel preview/apply E14’e bağlı; ekran kabulünün sahibi TODO/E14.                                            |
| W1-BE-15 | E18 · P10/WF19            | Seans geneli bekleme listesi ve teklif geçmişi keşfi                             | Backend karşılandı (PR315): seans entries/offers dizini mevcut; E18 tüketiyor; kabul sahibi TODO/E18.                                          |
| W1-BE-16 | E18 · P09/WF06            | Rezervasyona bağlı gerçek paket/hak özeti                                        | Backend karşılandı (PR315): include_source_summary gerçek kaynak/hak özetini sağlar; E18 tüketiyor; kabul sahibi TODO/E18.                     |
| W1-BE-17 | E21 · P06.5/WF06          | Özel ders taleplerinin native durum filtresi ve merkez sayaçları                 | Açık: merkez cursor listesi mevcut; durum filtresi ve özet yok.                                                                                |
| W1-BE-18 | E24–E26 · P11.2/WF03/WF07 | Atanmış seansın eğitmene görünür salon etiketi                                   | Açık: mevcut güvenli typed kaynak eşlemesi isteniyor.                                                                                          |
| W1-BE-19 | E27 · P10/P11.2 | Kendi geçerli anlaşma/ödeme keşfi ve dönem toplamları | Açık: hakediş cursor satırları mevcut; eksik kaynak eşlemesi isteniyor. |
| W1-BE-20 | E28/E29 · P09/P11.1 | Üye ders keşfi, güvenli ders etiketleri ve iptal politikası | Açık: mevcut rezervasyonlar yeni ders keşfi yerine geçmez. |
| W1-BE-21 | E29 · P09/P11.1 | Öğrencinin kendi merkezindeki bekleme/teklif keşfi | Açık: bilinen seans veya kayıt gerektirmeyen özne keşfi isteniyor. |
| W1-BE-22 | E30 · P07/P08/P11.1 | Satın alınan paket bilgisi ve ödeme para birimi keşfi | Açık: hak/hareket ve açık borç özeti mevcut; kalan eşleme isteniyor. |
| W1-BE-23 | E32 · P05 | Kendi hesabının gerekli belgelerini gerçek işlem bağlamlarıyla keşfetme | Açık: mevcut requirements okuyucusu önceden bilinen satış/rezervasyon bağlamı istiyor. |

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

## W1-BE-18 · Atanmış seansın salon etiketi

**İhtiyaç:** Eğitmenin kendi gün/program/seans çizimindeki salon adı için mevcut güvenli typed okuma eşlemesini belirtin. Yoksa yalnız zaten görünür atanmış seanslara, mevcut canlı yetki/merkez sınırlarıyla salon görüntüleme etiketi eklenmesi gerekir. Yeni endpoint veya oda yönetimi yetkisi istenmiyor; kaynak biçimini backend sahibi belirler.

**İncelenen kaynak:** `calendar_get_v1(resource:{kind:person,id:gerçek_self_person})` görünür seansları daraltır; `CalendarItem.resources` içindeki `ResourceRef` yalnız kind/id taşır. `SessionView` salon adı taşımaz. `room_save_v1` management selector’ü yönetim alanıdır; eğitmen ilişkisi oda yönetimi yetkisi diye yorumlanmaz. Görüntüleme adını UUID’den veya sabit demo salondan üretmiyoruz. Typed kaynak: [generated.ts](../src/lib/api-contracts/generated.ts); akış: [WF03](../../../docs/workflows.md#wf03), [WF07](../../../docs/workflows.md#wf07).

**Frontend durumu:** Salon satırı bilinmiyor olarak korunuyor. Atanmış takvim ve kendi hakediş okuması bağımsız bağlı; kabul/ilerleme [TODO/E24](todo.md#sayfa-kabulu) sahibindedir.

## W1-BE-19 · Eğitmenin kendi hakediş özeti ve ödeme keşfi

**Mevcut kaynak:** `earnings_list_v1(person_id:gerçek_self,center_id,interval)` oluşturulma zamanına göre cursor satırlarını verir. Satırdaki paid/remaining/overpaid ve nested `payments` alanları korunur; bunlar bağımsız ödeme dönemi geçmişi veya bütün filtre toplamı değildir. Eski hakedişe bu ay yapılan ödeme, bu ay oluşturulmuş hakediş listesinde görünmeyebilir. `P03PaymentView` yöntem taşımaz. `instructor_agreement_get_v1` bilinen agreement_id için özneye açıktır; `instructor_agreements_list_v1` ise earnings.manage ister, genel eğitmen keşfi olarak çağrılmaz.

**İhtiyaç:** E27 için mevcut yetkili typed eşlemeyi belirtin; yoksa kendi kişi/merkez kapsamındaki geçerli anlaşma keşfi, bağımsız ödeme tarihiyle cursor ödeme/düzeltme geçmişi ve güvenli yöntem etiketi, desteklenen dönemler/tüm dönem seçimi ve seçili filtrenin para birimi bazında hakediş/ödeme/kalan toplamları gerekir. Düzeltme zinciri ve dönem semantiğini backend sahibi belirler; istemci mevcut sayfayı toplam veya tam ödeme geçmişi saymaz. Yeni endpoint zorunlu tutulmaz.

**Sınır:** Native self/aktif eğitmen, canlı merkez/plan ve finans görünürlüğü korunmalı. Yönetim ödeme/yayın yetkisi, private/core erişimi, bütün finans geçmişini tarama veya istemcide yeni bakiye hesabı istenmiyor. Frontend kendi hakediş cursor satırlarını bağlar; eksik kaynaklar bilinmiyor görünür. Kabulün sahibi [TODO/E27](todo.md#sayfa-kabulu).

## W1-BE-20 · Öğrencinin rezervasyon yapabileceği ders keşfi

**İhtiyaç:** E28'in seçili merkez/haftadaki ders listesi ve yeni rezervasyon paneli için, bağlı öğrencinin henüz kayıtlı olmadığı görünür dersleri keşfedeceği güvenli typed eşlemeyi belirtin. Mevcut kaynak yoksa native cursor keşfi; izinli başlık/zaman, güvenli eğitmen/salon etiketi, seans durumu/sürümü/kapasitesi ve kendi rezervasyon/bekleme durumuna giden bağ gerekir. Açılma ve ücretsiz iptal koşullarının gerçek politika kaynağını da belirtin; demo gün/saat eşikleri kullanılmayacak. Yeni endpoint veya yeni ürün görünürlük kuralını frontend belirlemiyor.

**İncelenen kaynak:** `schedule-reads.sql` içindeki `schedule_calendar_rows` → `session_readable`, öğrencide mevcut rezervasyonu olan seansları okur; öğrencilik ilişkisi tek başına henüz kayıtlı olmadığı seansları görünür kılmaz. `calendar_get_v1` üzerindeki kişi resource filtresi bu açığı kapatmaz. `public_calendar_get_v1(slug,interval)` yayın kapsamına ve anonim transport'a aittir; bütün üye dersleri yerine geçirilmez. `entitlements_get_v1(session_id,booking_mode)` bilinen seansın uygun hak seçimi, `reservation_create_v1` gerçek komuttur; bunların eksik olduğu iddia edilmiyor. [WF06](../../../docs/workflows.md#wf06), [WF19](../../../docs/workflows.md#wf19).

**Sınır:** Native self/öğrencilik, canlı organizasyon/merkez/plan, borç/belge/hak ve writer kontrolleri korunmalı. Yönetim program/kişi/finans kataloglarına erişim veya public yayın varsayımı istenmiyor. Mevcut rezervasyon okuyucusu E29'da bağımsız tüketilebilir. Kabulün sahibi [TODO/E28](todo.md#sayfa-kabulu).

## W1-BE-21 · Öğrencinin kendi bekleme ve teklif keşfi

**İhtiyaç:** E29'da kendi merkezindeki bekleme kayıtları ve aktif teklifler için native typed cursor keşif eşlemesini belirtin. Henüz rezervasyonu olmayan bekleme seansları da bulunmalı; gerekirse mevcut okuyucu özne kişi/merkez kapsamında genişletilmeli. Kayıt/teklif kimliği, güvenli ders başlığı/zamanı, state/version, gerçek expires_at ve varsa sunucunun sağladığı sıra bilgisi gerekir. Sıra numarası sağlanmazsa üretilmeyecek. Yeni endpoint kararı frontend'e ait değildir.

**Mevcut kaynak:** `ManagementSelectorWaitlistJoinV1` ya bilinen person_id+session_id, ya CM/reservation.write sınırlı `directory:session` ister. Bilinen entry_id/offer_id selector'leri kendi komutlarına kaynak olur; merkezde öznenin henüz bilinmeyen kayıt/tekliflerini keşfetmez. `reservation_list_v1` bekleme kaydı değildir; rezervasyon oluşmamış seansı oradan bulamayız. Bütün dersleri/kişileri veya bildirim metinlerini taramak çözüm olarak kullanılmaz. Mevcut native leave/accept/reject ve operation receipt protokolü korunur. [WF19](../../../docs/workflows.md#wf19).

**Sınır:** Yalnız native self ve canlı merkez/üst-plan görünürlüğü; başka üyelerin adı/iletişimi/hesap kimliği veya worker issue/expire yetkisi açılmaz. Kabulde kapasite/hak/belge ve politika writer'da yeniden denetlenir. Dersin güvenli eğitmen/salon ve iptal politikası eşlemesi ayrıca W1-BE-20 kapsamındadır. Kendi kesin rezervasyonları ve iptali bağımsız bağlanır; ekran kabulü [TODO/E29](todo.md#sayfa-kabulu) sahibindedir.

## W1-BE-22 · Öğrencinin satın alınan paket bilgisi ve ödeme para birimleri

**Mevcut kaynak:** `entitlements_get_v1` kendi satış-hak kimliği, product_version_id, tür, geçerlilik, native sayımlar/kota/dondurma ve hareket defterini verir. Satın alınan sürümün immutable adı/ilk kredi toplamı yoktur. `products_list_v1` aktif ürünün güncel yürürlük sürümünü verir; tarihsel satın alma şartının yerine kullanılamaz. `person_get_v1(include_member_summary:true)` kendi merkezindeki pozitif açık borçları gerçek para birimiyle verir; bu destek kullanılacak. Borçsuz geçmiş ödemelerin veya alacağın bütün para birimlerini keşfetmez. `finance_get_v1` ise açık person_id+currency ister.

**İhtiyaç:** E30 için mevcut güvenli typed eşlemeyi belirtin; yoksa kendi görünür satışları için satın alınan sürüm adı/ilk kredi toplamı ve bütün yetkili finans para birimlerini (borcu sıfır olsa da ödeme/alacak olanları) keşfedecek destek gerekir. Mevcut finance_get ve entitlement ledger cursor yolları yeniden kurulmayacak; yeni endpoint zorunlu tutulmaz. Negatif/düzeltme ve süreli hakta gerçek sınır semantiği backend sahibindedir.

**Sınır:** Yalnız native self/öğrenci ve canlı merkez/plan; yönetim ürün/satış/finans kataloğuna veya private/core tablolara erişim istenmiyor. UUID'den ad, aktif katalogdan eski şart, sayımları toplayarak ilk kredi veya varsayılan TRY üretilmez. Yerel hak sayımları/hareketler/borç özeti bağımsız bağlanır; ekran kabulü [TODO/E30](todo.md#sayfa-kabulu) sahibindedir.

## W1-BE-23 · Öğrenci hesabındaki gerekli belge listesi

**Mevcut kaynak:** `document_requirements_get_v1`, native self kişisini çözse de `AcceptanceContext` içinde gerçek gate ve subject ister. Yayımlanmış P05 bağlamı satış/ürün sürümü, ders talebi/seans/rezervasyon veya etkinlik/kayıttır; kişi veya hesap kimliği genel belge bağlamı değildir. Bilinen işlemdeki requirements/accept yolları korunur.

**İhtiyaç:** E32 Belgeler kartı için kendi canlı hesap/merkez kapsamındaki gerekli belgeleri, kabul durumunu ve gerçek işlem bağlamlarını keşfeden güvenli typed eşlemeyi belirtin; yoksa bu keşif desteği gerekir. Her satır mevcut okuma/kabul akışına doğru gate, subject ve varsa purchase_preview/rendered-document bağını taşımalı. Yeni endpoint zorunlu tutulmaz.

**Sınır:** Kişi/satış/rezervasyon geçmişinin tamamını taramak, sahte genel subject üretmek veya tek kabulü başka işlem bağlamlarına taşımak istenmiyor. Belge içeriği, sürümü, snapshot/hash ve native kabul yetkileri korunmalı. Native hesap kimliği veya token açılmamalı. Bu işlev boşluğu CI kontrolü olarak Pro sonrasına ertelenmez; ekran durumu TODO/E32 sahibindedir.
