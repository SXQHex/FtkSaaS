# Web1 · Backend talepleri

15 Kasım 2026 · Frontend talep kaydı. Bu dosya backend ihtiyaçlarının ve karşılanma durumlarının ayrıntı sahibidir; ekran sırası, uygulama ilerlemesi ve frontend kabulü [TODO](todo.md) içinde kalır. Buradaki ihtiyaçlar backend tarafından onaylanmış veya uygulanmış sayılmaz. Backend kodu, ortak sözleşmeler ve backend kabul kayıtları bu frontend çalışmasında değiştirilmez.

İncelenen main: `f0b9449fac4d25047834ca12c28ded6e76482e88` (PR311 dala alındı). Tüketici kaynak: `feat/web1-account-acceptance`, [PR308](https://github.com/SXQHex/FtkSaaS/pull/308). Kullanıcı W1-BE-01–03 desteğinin tamamlandığını bildirdi; yeni typed sözleşme yerel snapshot’a alındı. Aynı main kaynağında [Main proof](https://github.com/SXQHex/FtkSaaS/actions/runs/43673450868), [Merge proof](https://github.com/SXQHex/FtkSaaS/actions/runs/43673450968) ve [development teslimi](https://github.com/SXQHex/FtkSaaS/actions/runs/43673486444) başarılı. Bunlar frontend ekranlarının entegrasyon veya gerçek kabul kanıtı değildir.

| Kimlik   | Ekran / işlev | İhtiyaç                                                                       | Frontend tarafından bilinen durum                                            |
| -------- | ------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| W1-BE-01 | E13 · P04     | Merkez öğrencilik durumuna göre cursor’lı kişi filtresi                       | Backend talebi karşılandı (PR311); frontend entegrasyonu/kabulü açık.        |
| W1-BE-02 | E13 · P04     | Görünür kişi sayfası için hak, para birimine göre borç ve en yakın ders özeti | Backend talebi karşılandı (PR311); frontend entegrasyonu/kabulü açık.        |
| W1-BE-03 | E15 · P04.3   | Merkez geneli davet/hesap bağlantısı keşfi, filtreler ve sayaçlar             | Backend talebi karşılandı (PR311); frontend entegrasyonu/kabulü açık.        |
| W1-BE-04 | E16 · P04.4   | Birleştirme gerekçesi, öneri/geçmiş keşfi ve kalıcı kopya-değil kararı        | Kullanıcı üzerinden soru gönderildi; değerlendirme/uygulama teyidi alınmadı. |
| W1-BE-05 | E12 · P03.3   | Son uygunluk kuralını kapatma ve mevcut kapanışı iptal etme                   | Backend desteği veya salt okunur kapsam kararı bekleniyor.                   |

## Bütün talepler için ortak sınır

- Mevcut native Supabase Auth, JWT/AAL, plan/abonelik ve canlı organizasyon/merkez/kişi izinleri korunmalı. Yeni bir okuma mevcut görünürlüğü genişletmemeli.
- Native hesap kimliği, JWT, davet token’ı/URL’si, secret veya ihtiyaç dışı kişisel veri istenmiyor. Mevcut onay akışının kendine özgü capability token’ı yalnız yetkili işleme hizmet etmeli; başlatanın apply token’ı başka yöneticiye paylaşılmamalı.
- DTO/selector/yazar desteği tek [makine sözleşmesinden](../../../packages/api-contracts/schema/contract.json) üretilmeli. Yeni endpoint, alan veya durum adı bu talep kaydıyla icat edilmiş sayılmaz; mevcut işlemi genişletme veya yeni typed okuma kararını backend sahibi verir.
- Sayfalama filtre/arama/aktör/kapsama bağlı olmalı; sürüm, idempotency, hata/kurtarma ve yazı sonrası okuma kuralları korunmalı. Backend çakışma veya finans kuralı frontend’e taşınmamalı.
- Teslimde ilgili [WF](../../../docs/workflows.md), generated tipler ve gerçek development desteğinin durumu belirtilmeli. Kaynak, test, merge/development dağıtımı ve frontend kabulü ayrı kanıtlardır. Bu kayıt production dağıtımı, veri dönüşümü veya shared dosya değişikliği onayı vermez.

## W1-BE-01 · Merkez öğrencilik durumu filtresi

**Karşılandı:** `people_list_v1.student_status` açık merkezde active/inactive filtresi sağlar; cursor kapsamına dahildir. Öğrencilik bulunmaması pasif sayılmaz. WF04 ve generated tipler güncel; E13’e bağlama ve kabul açıktır.

**Talep açılırken kaynak:** `RequestPeopleList` yalnız query/relationship/page ve org/center kapsamı taşır; kişi satırındaki ilişkiler durum gösterir. Liste isteğinde merkez öğrenciliği için active/inactive filtresi yoktur. [Typed kaynak](../src/lib/api-contracts/generated.ts), [istemci okuyucu](../src/features/people/people.ts), [WF04](../../../docs/workflows.md#wf04).

**İhtiyaç:** Seçili merkezin öğrencilik durumunu filtreleyen typed liste girdisi. Durum filtresi cursor’ın kapsamına dahil olmalı ve aramayla birlikte çalışmalı. Öğrencilik ilişkisi olmayan kişi ile pasif öğrenci birbirine karıştırılmamalı; hangi durumların seçilebildiği backend sözleşmesinde açık olmalı. Mevcut kişi listesi ve diğer tüketiciler korunmalı.

**Neden istemcide çözülmüyor:** Yalnız dönen20 satırı süzmek, sonraki cursor sayfalarındaki uygun kişileri atlar ve yanlış boş sonuç üretir. Bütün organizasyonu taramak da doğru liste sözleşmesi değildir.

**Doğrulama beklentisi:** Birden fazla sayfaya yayılan aktif/pasif öğrenciler; başka merkezdeki farklı durum; öğrenciliği olmayan kişi; arama+durum birleşimi; farklı filtreyle eski cursor kullanımı; izin veya kapsam kaybı. Sonuçlar yetkili backend kümesiyle eşleşmeli.

## W1-BE-02 · Kişi sayfası özetleri

**Karşılandı:** `include_member_summary:true` yalnız dönen kişi sayfasına ayrı rights/debt/next_lesson durumları ve as_of ekler. Available/restricted/not_enabled ayrıdır; kredi ve minor tutarlar ondalık string, borç para birimine göre ayrıdır. E13 gösterimi ve kabul açıktır.

**Talep açılırken kaynak:** `PersonSummary` hak, borç veya sıradaki dersi taşımıyor. `finance_get_v1` kişi+para birimi ister; `ReservationView` ders başlangıcını taşımaz. [Typed kaynak](../src/lib/api-contracts/generated.ts), [mevcut tablo tüketicisi](../src/features/people/people-page.tsx).

**İhtiyaç:** Görünür cursor sayfasındaki kişiler için mevcut hak/finans/rezervasyon yetkilerini ayrı ayrı koruyan typed özet. Hak türü ve kullanılabilirliği, borcun gerçek para birimi ve en yakın dersin gerçek başlangıcı/kapsamı anlaşılır olmalı. Yetkisiz veya okunamayan alan, gerçek sıfır/borç yok/gelecek ders yok sonucundan ayrılmalı. Süreli/sınırsız hak sayısal krediye çevrilmemeli; farklı para birimleri tek tutarda toplanmamalı. Kesin özet alanları ve uygun en yakın ders seçimi backend sözleşmesinden gelmeli.

**Neden istemcide çözülmüyor:** TRY veya başka para birimi varsaymak, bütün rezervasyon geçmişlerini taramak ve kişi başına sınırsız finans/hak sorgusu üretmek yanlış sonuç veya kontrolsüz fanout yaratır.

**Doğrulama beklentisi:** Sıfır ve pozitif hak/borç; süreli/sınırsız hak; birden çok para birimi; uygun gelecek ders yokluğu; iptal/geçmiş ders; farklı merkez ve kısmi yetki; cursor sayfası dışındaki kişilerin verisinin açılmaması. E13 tablo/özet ve sonraki ilgili kişi tüketicileri aynı kanonik anlamı kullanmalı.

## W1-BE-03 · Merkez geneli davet ve hesap bağlantısı keşfi

**Karşılandı:** Mevcut management okuyucusunda `directory:center` selector’ı, arama/durum/cursor, access_detail ve access_summary desteği geldi. Gönderim oluşturma tarihiyle karıştırılmaz; resend entitlement değildir. Gerçek desteklenen durumlar WF04’ten alınacak, çizimdeki bağlı-değil kapsamı otomatik varsayılmayacak. E15 route/entegrasyon ve kabul açıktır.

**Talep açılırken kaynak:** `management_state_get_v1` için `account_access_revoke_v1` selector’ı önceden bilinen person_id veya invitation_id, `account_link_remove_v1` selector’ı person_id veya link_id ister. Kişi kapsamlı discovery seçili kaydın domain kimliği, state, version, actionable ve davette expires_at bilgisini sağlar; merkezi baştan keşfetmez. [WF04](../../../docs/workflows.md#wf04), [seçili kayıt adaptörü](../src/features/access/access.ts), [ekran](../src/features/access/access-view.tsx).

**İhtiyaç:** Çizimdeki iki merkez listesi için typed keşif: davetler ve kişi/hesap bağlantı durumu. Davet açık/kapanan/tüm; bağlantı bağlı/bağlı değil/tüm ve kişi araması, cursor kapsamına dahil olmalı. Sayaçlar yalnız mevcut sayfanın sayısı diye sunulmamalı; yetkili kapsamın hangi kümesini saydığı açık olmalı. Hesap bağlantısı bulunmayan görünür kişiler de ilgili listeye erişilebilir olmalı.

Gönderim tarihi, geçerlilik, yeniden gönderilebilirlik/varsa kalan hak ve güvenli komut seçimi için gereken domain kimliği/sürümü mevcut gerçek kaynaktan gelmeli. Native son giriş veya bağlanma tarihi mevcut destek kapsamında değilse bilinmeyen bırakılmalı; yeni native hesap görünürlüğü varsayılmamalı. Gönderenin job teslim durumu, davetin kabulü, domain bağı ve native giriş yapabilirlik farklı anlamlardır.

**Neden istemcide çözülmüyor:** Bütün kişileri listeleyip her kişinin davet/link geçmişini taramak, doğru keşif ve merkez geneli sayaç sözleşmesi değildir. Çizimin7 gün/3 yeniden gönderim örneği ürün config’i sayılmaz.

**Doğrulama beklentisi:** Çok sayfalı liste ve sayaç tutarlılığı; arama/filtre değişiminde cursor kapsamı; kişi alias’ları; başka merkez görünürlüğü; actionable=false; revoke/unlink sonrası yeniden okuma; token/native hesap kimliği açılmaması. Var olan kişi/by-ID selector tüketicileri bozulmamalı.

## W1-BE-04 · Birleştirme gerekçesi ve çizimdeki keşif/karar akışı

**Mevcut kaynak:** `person_merge_preview_v1` açık source_id/target_id ile çalışır; approve/apply girdileri preview capability ve operation_key kullanır, gerekçe alanı taşımaz. Merkez `person_merge_approve_v1` discovery’si güncel onaylanabilir preview’ları verir; otomatik kopya önerisi veya tüm tamamlanan birleşimler değildir. [WF04](../../../docs/workflows.md#wf04), [merge adaptörleri](../src/features/people/merge.ts), [ekran](../src/features/people/merge-view.tsx).

**İhtiyaç ve değerlendirme:**

- Çizimin zorunlu gerekçesinin yetkili native merge akışında kabul edilip doğru işlem geçmişine kaydedilmesi; geriye uyumluluk ve aynı operation_key ile değişen payload kurallarının korunması.
- Merkezde görünür kayıt çiftlerini keşfetme ve tamamlanan birleşim sonuçlarını typed/cursor’lı okuma. Açık ve tamamlanan durumlarının tanımı, sayaçların kapsamı, arama ve seçili çiftin güvenli alanları sözleşmede açıklanmalı.
- “Kopya değil” kararının kalıcı kaydı ve tekrar önerilmemesi hedefinin backend tarafından değerlendirilmesi; açık kullanıcı kararı, mevcut kişi/merkez yetkisi ve güvenli tekrar/yeniden okuma davranışı.
- Karşılaştırma alanlarının, birleşim etkisinin ve gerekli merkez onaylarının güvenli projeksiyonu. Hak/borç gibi ortak özet ihtiyacı W1-BE-02 ile birlikte ele alınabilir; doğrulanmış veri yoksa sıfır veya yerel hesaplama kullanılmaz.

Frontend önerisi: normalize edilmiş e-posta veya telefon birebir eşleşmesinden aday üretmek; ad benzerliğiyle öneri üretmemek ve elle çift seçimini korumak. Bu kapsam kullanıcıya önerildi; henüz açık kullanıcı onayı veya backend uygulaması sayılmaz. Öneri otomatik birleştirme değildir: kullanıcı karşılaştırır ve mevcut yetkili preview/onay/apply akışında açıkça karar verir. Normalizasyonun kesin kuralları, aday görünürlüğü ve kalıcı kopya-değil davranışı backend değerlendirmesinde netleşmeli; frontend kendi eşleştirme algoritmasını kurmaz.

**Korunacak davranış:** Geçmiş kimlikleri ve merkez sahipliği bağlantılı korunur. Fiziksel silme, borçları istemcide toplama, çakışan rezervasyonu otomatik tekilleştirip hak iade etme varsayılmaz. Başlatanın apply token’ı ile diğer merkezin onay capability’si ayrıdır. Mevcut hesap/rezervasyon/kaynak blocker’ları, canlı yetki, scope hash ve preview süresi aşılmaz.

**Doğrulama beklentisi:** Gerekçenin doğru audit/işleme bağlanması; eksik/değişmiş gerekçe ve aynı key davranışı; başka merkezin yetkisiz onayı; süresi dolmuş/değişmiş preview; çok merkez onayları; cursor kapsamı; tekrar eden kopya-değil kararı; kabul sonrası canonical kişi ve bağlantılı geçmiş okuması. Kaynak/ürün kararı netleşmeden E16/P04.4 kabulü kapatılmayacak.

## W1-BE-05 · Uygunluk ve kapanış yaşam döngüsü

**Mevcut kaynak:** Haftalık uygunluk ekleme/sürümlü güncelleme ve merkez aggregate version ile kapanış append destekleniyor. Son kalıcı uygunluk kuralını kapatma ve mevcut kapanışı iptal etme komutu mevcut tüketim sözleşmesinde yok. [Uygunluk adaptörü](../src/features/studio/availability-edit.ts), [kapanış adaptörü](../src/features/studio/closure.ts), [WF02](../../../docs/workflows.md#wf02)/[WF03](../../../docs/workflows.md#wf03).

**İhtiyaç:** Bu iki çizim eylemi için güvenli typed yaşam döngüsü desteği veya bu sürümde açıklamalı salt okunur bırakılacaklarına dair ürün/kapsam kararı. Uygulama yapılacaksa gerçek kayıt kimliği ve yetkili sürüm okuması, ayrı açık kullanıcı eylemi, gerekçe gereksinimi, idempotent yazı ve son durum okuması belirtilmeli. Son kural boş weekdays veya sahte tarih aralığıyla kapatılmayacak; mevcut gizli gerekçe okuyucuya açılmayacak.

**Doğrulama beklentisi:** Yalnız seçili kaynak/kayıt etkilenmeli; diğer kurallar/kapanışlar ve sürümleri korunmalı; stale version/yanlış merkez reddedilmeli. Kapanış değişikliği mevcut seansları otomatik iptal etmemeli. Desteklenmeyen silme/reset veya private tablo/RPC kullanılmayacak.
