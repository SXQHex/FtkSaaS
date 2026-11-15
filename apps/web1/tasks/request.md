# Web1 · Backend talepleri

15 Kasım 2026 · Frontend talep kaydı. Bu dosya backend ihtiyaçlarının ve karşılanma durumlarının ayrıntı sahibidir; ekran sırası, uygulama ilerlemesi ve frontend kabulü [TODO](todo.md) içinde kalır. Talep açılması tek başına backend onayı veya uygulama kanıtı değildir; karşılanan talepler aşağıda kaynaklarıyla işaretlidir. Backend kodu, ortak sözleşmeler ve backend kabul kayıtları bu frontend çalışmasında değiştirilmez.

İncelenen main: `a309f6cd09c7f26a15376ac872bba3507556f6cb` (PR311 ve PR312 dala alındı). Tüketici kaynak: `feat/web1-account-acceptance`, [PR308](https://github.com/SXQHex/FtkSaaS/pull/308). Beş talebin backend sözleşme desteği mevcut typed kaynakta karşılandı ve yerel snapshot’a alındı. W1-BE-03 kişi dizininin gerçek development okuması tekrar eden503 hatasıyla açıktır; aşağıdaki hosted bulgu kaynak tesliminden ayrıdır. Aynı main kaynağında [Main proof](https://github.com/SXQHex/FtkSaaS/actions/runs/43702230837), [Merge proof](https://github.com/SXQHex/FtkSaaS/actions/runs/43702230839) ve [development teslimi](https://github.com/SXQHex/FtkSaaS/actions/runs/43702268310) başarılı. Bunlar frontend ekranlarının gerçek kabul kanıtı değildir; kalan tüketici işleri TODO’dadır.

| Kimlik   | Ekran / işlev           | İhtiyaç                                                                          | Frontend tarafından bilinen durum                                                                                           |
| -------- | ----------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| W1-BE-01 | E13 · P04               | Merkez öğrencilik durumuna göre cursor’lı kişi filtresi                          | Backend karşılandı (PR311); E13 bağlantısı/testleri geçti, gerçek kabul açık.                                               |
| W1-BE-02 | E13 · P04               | Görünür kişi sayfası için hak, para birimine göre borç ve en yakın ders özeti    | Backend karşılandı (PR311); E13 bağlantısı/testleri geçti, gerçek kabul açık.                                               |
| W1-BE-03 | E15 · P04.3             | Merkez geneli davet/hesap bağlantısı keşfi, filtreler ve sayaçlar                | Kaynak karşılandı (PR311/312); kişi dizini gerçek development’ta503 veriyor, inceleme açık.                                 |
| W1-BE-04 | E16 · P04.4             | Birleştirme gerekçesi, öneri/geçmiş keşfi ve kalıcı kopya-değil kararı           | Backend karşılandı (PR312); E16 kalan tüketici bağlantısı/kabulü açık.                                                      |
| W1-BE-05 | E12 · P03.3             | Son uygunluk kuralını kapatma ve mevcut kapanışı iptal etme                      | Backend karşılandı (PR312); E12 retire/cancel bağlandı; gerçek kabul TODO’da açık.                                          |
| W1-BE-06 | E17 · P06               | Sabit grup öğrenci üyeliğinin keşif ve ekle/çıkar native eşlemesi                | Backend değerlendirmesi bekleniyor; form açıklamalı salt okunur.                                                            |
| W1-BE-07 | E17 · P06.3/.4          | Seans düzenleme ve kalıcı telafi bağı için native okuma eşlemesi                 | Gerçek program oluşumunda da management okuması POLICY_NOT_CONFIGURED; doğru native eşleme veya runtime desteği bekleniyor. |
| W1-BE-08 | E17 · aynı-key kurtarma | Native telafi komutu receipt okumasının typed request ile doğrulanması           | ACK200 sonrası canonical client `operation_status_get_v1` VALIDATION_FAILED döndürüyor; backend incelemesi bekleniyor.      |
| W1-BE-09 | E19 · P07               | Paket yönetimi durum/arama/özet/geçmiş ve satışa kapatma/arşiv eşlemesi          | Ürün katalog/yayın desteği bağlı; çizimdeki yönetim alanları için doğru typed kaynak veya runtime desteği bekleniyor.       |
| W1-BE-10 | E20 · P08               | Merkez geneli finans hareket/borç/alacak keşfi ve para birimine ayrılmış özetler | Kişi+para birimi okuyucusu ve native tahsilat bağlı; merkez geneli çizim için doğru typed kaynak/eşleme bekleniyor.         |

## Bütün talepler için ortak sınır

- Mevcut native Supabase Auth, JWT/AAL, plan/abonelik ve canlı organizasyon/merkez/kişi izinleri korunmalı. Yeni bir okuma mevcut görünürlüğü genişletmemeli.
- Native hesap kimliği, JWT, davet token’ı/URL’si, secret veya ihtiyaç dışı kişisel veri istenmiyor. Mevcut onay akışının kendine özgü capability token’ı yalnız yetkili işleme hizmet etmeli; başlatanın apply token’ı başka yöneticiye paylaşılmamalı.
- DTO/selector/yazar desteği tek [makine sözleşmesinden](../../../packages/api-contracts/schema/contract.json) üretilmeli. Yeni endpoint, alan veya durum adı bu talep kaydıyla icat edilmiş sayılmaz; mevcut işlemi genişletme veya yeni typed okuma kararını backend sahibi verir.
- Sayfalama filtre/arama/aktör/kapsama bağlı olmalı; sürüm, idempotency, hata/kurtarma ve yazı sonrası okuma kuralları korunmalı. Backend çakışma veya finans kuralı frontend’e taşınmamalı.
- Teslimde ilgili [WF](../../../docs/workflows.md), generated tipler ve gerçek development desteğinin durumu belirtilmeli. Kaynak, test, merge/development dağıtımı ve frontend kabulü ayrı kanıtlardır. Bu kayıt production dağıtımı, veri dönüşümü veya shared dosya değişikliği onayı vermez.

## W1-BE-01 · Merkez öğrencilik durumu filtresi

**Karşılandı:** `people_list_v1.student_status` açık merkezde active/inactive filtresi sağlar; cursor kapsamına dahildir. Öğrencilik bulunmaması pasif sayılmaz. WF04 ve generated tipler güncel; E13’e bağlandı;9 birim ve1 ortak Axe taramalı sentetik tarayıcı senaryosu geçti. Gerçek kabul TODO’da açıktır.

**Talep açılırken kaynak:** `RequestPeopleList` yalnız query/relationship/page ve org/center kapsamı taşır; kişi satırındaki ilişkiler durum gösterir. Liste isteğinde merkez öğrenciliği için active/inactive filtresi yoktur. [Typed kaynak](../src/lib/api-contracts/generated.ts), [istemci okuyucu](../src/features/people/people.ts), [WF04](../../../docs/workflows.md#wf04).

**İhtiyaç:** Seçili merkezin öğrencilik durumunu filtreleyen typed liste girdisi. Durum filtresi cursor’ın kapsamına dahil olmalı ve aramayla birlikte çalışmalı. Öğrencilik ilişkisi olmayan kişi ile pasif öğrenci birbirine karıştırılmamalı; hangi durumların seçilebildiği backend sözleşmesinde açık olmalı. Mevcut kişi listesi ve diğer tüketiciler korunmalı.

**Neden istemcide çözülmüyor:** Yalnız dönen20 satırı süzmek, sonraki cursor sayfalarındaki uygun kişileri atlar ve yanlış boş sonuç üretir. Bütün organizasyonu taramak da doğru liste sözleşmesi değildir.

**Doğrulama beklentisi:** Birden fazla sayfaya yayılan aktif/pasif öğrenciler; başka merkezdeki farklı durum; öğrenciliği olmayan kişi; arama+durum birleşimi; farklı filtreyle eski cursor kullanımı; izin veya kapsam kaybı. Sonuçlar yetkili backend kümesiyle eşleşmeli.

## W1-BE-02 · Kişi sayfası özetleri

**Karşılandı:** `include_member_summary:true` yalnız dönen kişi sayfasına ayrı rights/debt/next_lesson durumları ve as_of ekler. Available/restricted/not_enabled ayrıdır; kredi ve minor tutarlar ondalık string, borç para birimine göre ayrıdır. E13 gösterimine bağlandı; hassasiyet/para birimi ve görünürlük ayrımı testleri geçti. Gerçek kabul TODO’da açıktır.

**Talep açılırken kaynak:** `PersonSummary` hak, borç veya sıradaki dersi taşımıyor. `finance_get_v1` kişi+para birimi ister; `ReservationView` ders başlangıcını taşımaz. [Typed kaynak](../src/lib/api-contracts/generated.ts), [mevcut tablo tüketicisi](../src/features/people/people-page.tsx).

**İhtiyaç:** Görünür cursor sayfasındaki kişiler için mevcut hak/finans/rezervasyon yetkilerini ayrı ayrı koruyan typed özet. Hak türü ve kullanılabilirliği, borcun gerçek para birimi ve en yakın dersin gerçek başlangıcı/kapsamı anlaşılır olmalı. Yetkisiz veya okunamayan alan, gerçek sıfır/borç yok/gelecek ders yok sonucundan ayrılmalı. Süreli/sınırsız hak sayısal krediye çevrilmemeli; farklı para birimleri tek tutarda toplanmamalı. Kesin özet alanları ve uygun en yakın ders seçimi backend sözleşmesinden gelmeli.

**Neden istemcide çözülmüyor:** TRY veya başka para birimi varsaymak, bütün rezervasyon geçmişlerini taramak ve kişi başına sınırsız finans/hak sorgusu üretmek yanlış sonuç veya kontrolsüz fanout yaratır.

**Doğrulama beklentisi:** Sıfır ve pozitif hak/borç; süreli/sınırsız hak; birden çok para birimi; uygun gelecek ders yokluğu; iptal/geçmiş ders; farklı merkez ve kısmi yetki; cursor sayfası dışındaki kişilerin verisinin açılmaması. E13 tablo/özet ve sonraki ilgili kişi tüketicileri aynı kanonik anlamı kullanmalı.

## W1-BE-03 · Merkez geneli davet ve hesap bağlantısı keşfi

**Karşılandı (PR311/312):** `view:people` linked/unlinked/all kişi dizini ve open/closed/all davet grupları eklendi. Hiç bağı olmayan kişiler people entity/version ile, bağlı kişi gerçek link entity/version ile döner; kişi oluşturma tarihi bağlanma tarihi değildir. Mevcut management okuyucusunda `directory:center` selector’ı, arama/durum/cursor, access_detail ve access_summary desteği geldi. Gönderim oluşturma tarihiyle karıştırılmaz; resend entitlement değildir. Filtreler doğrudan WF04 sözleşmesine bağlandı; E15 route/okuma/yazar bağlantısı yapıldı, final ve gerçek kabul TODO’da izlenir.

**Talep açılırken kaynak:** `management_state_get_v1` için `account_access_revoke_v1` selector’ı önceden bilinen person_id veya invitation_id, `account_link_remove_v1` selector’ı person_id veya link_id ister. Kişi kapsamlı discovery seçili kaydın domain kimliği, state, version, actionable ve davette expires_at bilgisini sağlar; merkezi baştan keşfetmez. [WF04](../../../docs/workflows.md#wf04), [seçili kayıt adaptörü](../src/features/access/access.ts), [ekran](../src/features/access/access-view.tsx).

**İhtiyaç:** Çizimdeki iki merkez listesi için typed keşif: davetler ve kişi/hesap bağlantı durumu. Davet açık/kapanan/tüm; bağlantı bağlı/bağlı değil/tüm ve kişi araması, cursor kapsamına dahil olmalı. Sayaçlar yalnız mevcut sayfanın sayısı diye sunulmamalı; yetkili kapsamın hangi kümesini saydığı açık olmalı. Hesap bağlantısı bulunmayan görünür kişiler de ilgili listeye erişilebilir olmalı.

Gönderim tarihi, geçerlilik, yeniden gönderilebilirlik/varsa kalan hak ve güvenli komut seçimi için gereken domain kimliği/sürümü mevcut gerçek kaynaktan gelmeli. Native son giriş veya bağlanma tarihi mevcut destek kapsamında değilse bilinmeyen bırakılmalı; yeni native hesap görünürlüğü varsayılmamalı. Gönderenin job teslim durumu, davetin kabulü, domain bağı ve native giriş yapabilirlik farklı anlamlardır.

**Neden istemcide çözülmüyor:** Bütün kişileri listeleyip her kişinin davet/link geçmişini taramak, doğru keşif ve merkez geneli sayaç sözleşmesi değildir. Çizimin7 gün/3 yeniden gönderim örneği ürün config’i sayılmaz.

**Doğrulama beklentisi:** Çok sayfalı liste ve sayaç tutarlılığı; arama/filtre değişiminde cursor kapsamı; kişi alias’ları; başka merkez görünürlüğü; actionable=false; revoke/unlink sonrası yeniden okuma; token/native hesap kimliği açılmaması. Var olan kişi/by-ID selector tüketicileri bozulmamalı.

**Gerçek development bulgusu ·15 Kasım2026:** Kontrollü Pro owner fixture ile native girişten ve kendi org/center keşfinden sonra `management_state_get_v1(operation:account_link_remove_v1,selector:{operation:account_link_remove_v1,key:{directory:center,view:people,status:all}},page:{limit:20,sort:created_at_asc})` HTTP503/`TEMPORARY_FAILURE` döndü. Ekranın açık “Yeniden dene” eyleminde aynı doğru kapsamlı okuma yeniden503 verdi. Aynı oturumda davet open directory HTTP200, access_summary mevcut ve items boş döndü. E13’ün20 satırlık summary okuması ile active/inactive filtreleri gerçek API’de geçti. Dolayısıyla sözleşme veya frontend parametre boşluğu varsayılmıyor; kişi dizininin hosted runtime hatası backend tarafından incelenmeli. Hatanın kök nedeni henüz doğrulanmadı; timeout/SQL/veri nedeni diye tahmin yazılmıyor.

Kanıt: `.tmp/access-hosted-result.json` (iki503, readErrorVisible:true, explicitRetrySucceeded:false,0 pageerror/0 blocked write, nativeLocalSignout:true), `.tmp/e13-real-reads-result.json`. Scriptler yalnız native Auth ve izinli Edge okuyucularını kullandı; domain yazısı, reset/seed, private tablo/RPC veya service-role erişimi yoktur. Ekran hata durumunda kaldı ve yeniden deneme sundu; gerçek hata durumu100 mevcut WCAG2.2AA/best-practice kuralıyla0 Axe ihlali verdi, incomplete sonuçlar TODO’da açıktır. Kişi/hesap kimlikleri, e-posta, parola ve token rapora eklenmedi. Backend düzeltmesi geldikten sonra bu exact okuma ve listedeki bağlı/bağlı-değil filtreleri yeniden doğrulanacak; yeni fallback veya bütün kişileri tarama eklenmeyecek.

## W1-BE-04 · Birleştirme gerekçesi ve çizimdeki keşif/karar akışı

**Karşılandı (PR312):** Preview gerekçesi sabitlenir, apply/audit sonucuna taşınır. Merkez review directory suggested/completed/not_duplicate durumlarını ve sayaçlarını keşfeder. Kesin normalize e-posta/telefon adayları iletişim görünürlüğüyle sınırlıdır; kopya-değil kararı mevcut preview → açık onay → apply yolundadır. Seçili iki kişiye `person_get_v1(include_member_summary:true)` projeksiyonu desteklenir. E16 tüketici bağlantısı ve odaklı kaynak/sentetik testleri tamamlandı; dört gerçek development dizin okuması ve owned çiftte kopya-değil/merge/canonical geçmiş kabulü geçti; finans/çok merkez/son ekran kabulü [TODO](todo.md) içinde açıktır.

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

**Karşılandı (PR312):** `availability_save_v1(action:retire,rule_id,resource,expected_version,reason)` gerçek kural row version’ıyla; `availability_exception_save_v1(action:cancel,exception_id,resource,expected_version,reason)` gerçek merkez aggregate sürümüyle çalışır. Reader active/inactive ve active/cancelled durumlarını verir. Eski saat/hafta/tarih veya gizli gerekçe açılmaz; seanslara otomatik yan etki yoktur. E12 retire/cancel tüketimi hazır onaylar ve sürümlü yazar/yeniden okumayla bağlandı; gerçek kapanış cancel ve kalıcı kural retire kabulü geçti; ayrıntı ve kalan ekran kabulü [TODO](todo.md) sahibindedir.

**Talep açılırken kaynak:** Haftalık uygunluk ekleme/sürümlü güncelleme ve merkez aggregate version ile kapanış append destekleniyor. Son kalıcı uygunluk kuralını kapatma ve mevcut kapanışı iptal etme komutu mevcut tüketim sözleşmesinde yok. [Uygunluk adaptörü](../src/features/studio/availability-edit.ts), [kapanış adaptörü](../src/features/studio/closure.ts), [WF02](../../../docs/workflows.md#wf02)/[WF03](../../../docs/workflows.md#wf03).

**İhtiyaç:** Bu iki çizim eylemi için güvenli typed yaşam döngüsü desteği veya bu sürümde açıklamalı salt okunur bırakılacaklarına dair ürün/kapsam kararı. Uygulama yapılacaksa gerçek kayıt kimliği ve yetkili sürüm okuması, ayrı açık kullanıcı eylemi, gerekçe gereksinimi, idempotent yazı ve son durum okuması belirtilmeli. Son kural boş weekdays veya sahte tarih aralığıyla kapatılmayacak; mevcut gizli gerekçe okuyucuya açılmayacak.

**Doğrulama beklentisi:** Yalnız seçili kaynak/kayıt etkilenmeli; diğer kurallar/kapanışlar ve sürümleri korunmalı; stale version/yanlış merkez reddedilmeli. Kapanış değişikliği mevcut seansları otomatik iptal etmemeli. Desteklenmeyen silme/reset veya private tablo/RPC kullanılmayacak.

## W1-BE-06 · Programdaki sabit grup üyeliğinin native eşlemesi

**Frontend talebi:** E17 çizimindeki sabit grup üyesi listesi, kişi ekleme/çıkarma ve sonraki program oluşumlarına etkisi için mevcut doğru native akışın/sözleşmenin belirtilmesi veya eksik typed desteğin tamamlanması gerekiyor. `class_assignment_set_v1` eğitmen/asistan duty’sidir; öğrenci üyeliği değildir. `reservation_create_v1` gerçek session_id/person_id/source_sale_id ve priority/flexible mode ister; tekil rezervasyonları kalıcı sınıf üyeliği olarak göstermeyeceğiz.

**Kaynak:** [WF03](../../../docs/workflows.md#wf03), [WF06](../../../docs/workflows.md#wf06), [F10 ürün kapsamı](../../../docs/contracts/01-FtkSaaS-urun-kapsam-sozlesmesi.md), [hazır program paneli](../src/features/schedule/schedule-session-sheet.tsx).

**İhtiyaç:** Seçili merkez/sınıf/program için cursor’lı, yetkili ve güvenli üyelik keşfi; exact kayıt/sürüm, üyelik durumunun anlamı, açık ekle/çıkar işlemi ve varsa gelecekteki oluşum/rezervasyon etkisinin preview/onay/yeniden okuma sırası. Mevcut başka native akış bu hedefi karşılıyorsa yeni model/API yerine onun typed eşlemesi yeterlidir. Hak, borç, belge, rezervasyon koruması ve canlı yetki kapıları korunmalı; satış/hak otomatik seçilmemeli, mevcut kesin rezervasyonlar sessizce değiştirilmemeli.

**Frontend durumu:** E17’nin bağımsız takvim/seans/program işlemleri sürüyor. Sabit grup formu kaynak desteği gelene kadar açıklamalı salt okunur kalacak; yerel sahte üyelik, class duty veya geçmiş taramasıyla doldurulmayacak. Backend değerlendirmesi/ürün kararı bekleniyor.

## W1-BE-07 · Mevcut seansın düzenleme ve telafi bağı kaynağı

**Frontend talebi:** `management_state_get_v1(operation:session_change_preview_v1,selector:{operation:session_change_preview_v1,key:{session_id,scope:single}},page:{limit:1})` için mevcut doğru native okuma eşlemesini belirtin veya eksik runtime desteğini tamamlayın. Typed selector/projeksiyon mevcut; gerçek development CM okuması `POLICY_NOT_CONFIGURED` dönüyor. Bu kodun hangi gerçek config’i istediği de bilinemediğinden frontend kullanıcıya ayar değeri uydurmayacak.

**Somut kanıt:** Aynı kontrollü Pro CM, native UI üzerinden iki haftalık programı `program_apply_v1`200 ile oluşturdu; program/iki session ve oda+kişi filtreleri ayrı oturumda doğrulandı. Aynı iki yeni owned session’ın düzenleme okuyucusu da200/ok:false/POLICY_NOT_CONFIGURED döndü. Kanıt `.tmp/e17-native-program-final-audit-result.json` içindeki iki `expectedEditPolicyRejections`; program kaynak doğrulaması ve her iki haftanın oda/eğitmen görünümü aynı raporda başarılı. Auth/token veya native hesap kimliği paylaşılmadı.

**Kaynak bulgusu:** `20261017150034_instructor_earnings_workflow.sql` içindeki `management.inspect` dalı, `negcredit_valuation_set_v1` dışındaki işlemleri POLICY_NOT_CONFIGURED ile reddediyor; sonraki Studio/oda/sınıf/uygunluk/duty okuyucuları kendi dispatch desteğini ekliyor. İncelenen `a309f6cd09c7f26a15376ac872bba3507556f6cb` kaynağında session-change okuyucusuna karşılık gelen eşleme bulunamadı. Bu bir config varsayımı olarak kapatılmayacak; backend doğru mevcut eşlemeyi gösterebilir.

**Gerekli güvenli veri:** Exact org/merkez/session ve canlı schedule.manage sınırında mevcut resources, scope ve seansın kendi sürümü; schema’daki mevcut session-change projeksiyonu yeterliyse yeni model/API gerekmiyor. `session_get_v1` kaynak listesini taşımıyor; `calendar_get_v1` kaynakları görünüm için kullanılıyor fakat tek başına düzenleme yetkisi sayılmıyor. Başka merkez/hesap, plan ve rezervasyon/hak/belge sınırları korunmalı. Başarıda fresh session/preview/apply/yeniden okuma sırası korunmalı.

**Telafi bağı ek kanıtı:** Aynı owned programın ilk oluşumu `session_cancel_apply_v1`200 ile iptal edildi ve ayrı `replacement_session_create_v1`200 ile telafi oluşturuldu; diğer oluşum korundu. Taze native okumada eski session cancelled, yeni session planned ve aynı sınıf doğrulandı. Buna rağmen `management_state_get_v1(operation:replacement_session_create_v1,selector:{operation:replacement_session_create_v1,key:{replaces_id}},page:{limit:10})` da POLICY_NOT_CONFIGURED verdi. Typed selector/projeksiyon tanımlı, fakat `SessionView`/`CalendarItem` kalıcı replaces bağını taşımıyor. Mevcut doğru ilişki okuyucusu gösterilmeli veya aynı yetki sınırında desteklenmeli; frontend teknik receipt/local ledger’ı ürünün kalıcı ilişki kaynağı saymayacak. Kanıt `.tmp/e17-owned-replacement-read-probe.json`; yönetim okuması trace `01a1e045-fd81-715a-b8f6-16a65ad1f956`. Bu talep backend değerlendirmesi gelmeden yerine getirilmiş sayılmaz.

**Frontend durumu:** Aynı session sürümündeki gerçek takvim kaynakları salt okunur ayrıntıda gösteriliyor. Düzenleme/eğitmen değiştirme mevcut kaynak desteği olmadan açılmıyor; bağımsız native iptal/telafi kabulü sürüyor. Backend değerlendirmesi ve doğru eşleme bekleniyor.

## W1-BE-08 · Native telafi komutu receipt okuması

**Frontend talebi:** ACK200 almış `replacement_session_create_v1` komutunun aynı domain hesabıyla yeni native oturumda `operation_status_get_v1` sonucunu okuması typed sözleşmeye göre doğrulanmalı. Mevcut `readScheduleReceipt` tüketicisinin ürettiği `client_api_version/request_id/org_id/operation/key` isteği native development’ta VALIDATION_FAILED veriyor. Merkez alanı bu request şemasında yok; frontend ek alan veya özel RPC icat etmeyecek.

**Kanıt:** Aynı owned org/merkezde eski cancelled ve telafi planned session’ları native `session_get_v1` ile okunuyor; iki gerçek writer ACK’sı ve operation_key’ler yalnız `.tmp/e17-owned-cancel-replacement-private.json` içindeki özel ledger’da. Canonical istemci üzerinden receipt okuması HTTP200/ok:false/VALIDATION_FAILED, `field_paths:[]`, trace `01a1e046-0120-7761-96dc-76179bde3826`. Kanıt `.tmp/e17-owned-replacement-read-probe.json`; doğrudan typed request ile önceki hata `.tmp/e17-owned-replacement-status-validation-original.json` içinde korunur. Bu yalnız telafi receipt’inde gözlendi; diğer komutlarda genel arıza olduğu iddia edilmez.

**Kaynak ve sınır:** WF00 aynı key/payload kurtarması, yayımlı `Request_operation_status_get` ve `src/features/schedule/schedule-command.ts:readScheduleReceipt`. Writer yeniden oynatılmadı; diğer hesap/oturum kimliği veya token paylaşılmadı. Backend mevcut doğru parametre/yetki kapsamını açıklayabilir veya sözleşme/runtime uyumsuzluğunu giderebilir. Receipt başarısızlığı ACK’ı geri alındı saydırmaz; mevcut hook bilinmeyen sonucu ve anahtarı korur, yeni niyet/anahtar otomatik üretilmez.

## W1-BE-09 · Paket yönetimi keşfi, durum ve geçmiş

**Frontend ihtiyacı:** E19 çizimindeki Paketler tablosu (arama, Tümü/Satışta/Kapalı/Arşiv, cursor, aktif hak sütunu), dört merkez özeti (satışta paket, son30 gün satış/ciro, aktif hak sahibi), paket sürüm/satış geçmişi ve satışa kapatma/arşiv akışı için mevcut doğru native okuma/yazı eşlemesini belirtin; yoksa mevcut yetki/plan sınırlarını koruyan typed destek sağlayın. Para birimleri ayrı korunmalı; ciro farklı para birimleri toplanarak üretilmemeli. Sayaçlar mevcut cursor sayfasının uzunluğundan hesaplanmayacak. Yeni bir endpoint veya alan adı bu kayıtla önerilmiş/kararlaştırılmış değildir.

**İncelenen kaynak:** `Request_products_list` yalnız org/center, page ve include_timed_products taşır; query/status yoktur. `ProductView` yalnız id/version_id/terms döndürür. `20261019131628_p01_catalog_entitlement_reads.sql` içindeki `private.catalog_page` etkin ürünlerin geçerli son sürümünü listeler; `p.state='active'` koşulu nedeniyle kapalı/arşiv yönetim dizini değildir. `ProductTerms` ürün-genel geçerlilik gününü veya satış/arşiv durumunu taşımaz; WF05 geçerliliği satış tarihleriyle belirler. Bu nedenle90 gün gibi çizim değerleri ürün şartına yazılmadı. Taslak/sürüm notu için de yayımlı request alanı bulunmuyor. `product_publish_v1` yeni ürün sürümü oluşturur; `expected_version` veya preview request'i yoktur. Mevcut ürünün adını değiştiren doğru native eşleme de gerekli: incelenen writer yeni üründe adı kaydediyor, mevcut üründe yeni terms.name değerini core.products adına uygulamıyor; frontend mevcut adı salt okunur koruyor.

**Mevcut tüketim:** Aynı sayfada katalog → açık koşul incelemesi/onay → native product_publish → ACK product_versions kimliğiyle tam şart/sürüm yeniden okuma bağlandı. Bu yönetim görünümü için tüm kişi/satış/finans geçmişlerini tarama, sayfayı yerelde filtreleyip merkez sonucu iddiası veya SQL/private RPC kullanılmadı. Eksik alanlar açıklamalı kullanılamaz; yayınlama ve kendi yerel testleri bunlardan bağımsız ilerliyor. Backend değerlendirmesi ve gerçek frontend kabulü kendi sahiplerinde ayrı kaydedilecek.

## W1-BE-10 · Merkez geneli finans keşfi ve özetler

**İhtiyaç:** E20 çizimindeki Hareketler/Açık borçlar/Alacaklar listeleri için seçili merkezde izinli native keşif, kişi arama/işlem türü/yöntem filtresi ve cursor; dönem satış/tahsilat ile güncel borç/alacak toplamları ve kişi sayaçlarının güvenli kaynağı gerekiyor. Mevcut doğru eşlemeyi belirtin; yoksa typed desteği backend sahibi tanımlasın. Her para birimi ayrı kalmalı, görünür cursor sayfası merkez toplamı sayılmamalı; finans yetkisi ve ilgili plan/merkez sınırları korunmalı.

**İncelenen kaynak:** `Request_finance_get` kişi ve para birimini zorunlu ister. `FinanceView` o kişinin borçları/alacağı ve cursor'lı `CashSummary` listesi verir; bu nakit listesi satış dizini değildir. `CashSummary` türleri collection/refund/correction_in/correction_out; `DebtSummary` kaynak satış kimliğini ve son satış adını taşımaz. Kök tahsilat veya satış eylemine geçmek için güvenli kaynak kimliği/sürümü gerekir; nakit hareket kimliği sale_id sanılmayacak. `report_get_v1(collections_debts)` tarih aralıklı, ayrı report.read yetkili ve gruplanmış ReportRow/ReportTotal döndürür; global işlem kimliği/yöntem/kişi adı keşfinin veya finance.read görünürlüğünün yerine kullanılamaz. `settlement_movements_list_v1` Business merkezler arası hesaplaşmadır (WF18), öğrenci finans listesi değildir; audit de önceden bilinen subject ve interval ister.

**Tüketici durumu:** Çizimdeki bütün hazır tablo/panel kompozisyonu tamamlandıktan sonra mevcut kişi+para birimi okuyucusu açık kapsam seçimiyle bağlandı; hiç kimse veya para birimi varsayılmadı. Seçili kişi bakiyesi merkez KPI'sına dönüştürülmüyor; bütün kişilerin finans/geçmişi taranmıyor. Merkez geneli filtre/özet henüz kullanılamaz. WF08'deki `management_state_get_v1(collection_record_v1,selector.key:{person_id})` canlı eylem yetkisi mevcut; bunun için yeni backend desteği istenmiyor. Kişi tahsilatı, düzeltme, iade, mahsup ve borç düzeltme kendi native sıralarıyla frontend'de bağımsız ilerleyebilir; bu talep onları bitmiş saymaz. Satış iadesi ve nakit alacak iadesi ayrıdır. Finans eylemleri için eski topyekûn silme/iptal veya yeni toplam davranışı uydurulmayacak.
