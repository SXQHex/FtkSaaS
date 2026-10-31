## Kayıt ön kontrolü ve native Auth hataları

`account_signup_check_v1` için `account_exists / available` HTTP 200 içindeki ayrık iş sonucudur. Anonim kullanıcı yalnız adres varlığını öğrenir; kontrol parola almaz, kayıt veya posta oluşturmaz. Native signup/parola/reauth hataları Supabase SDK’dan gelir ve Edge hata zarfına çevrilmez. [Typed tüketici](../settings.md#e-posta-parola-kayıt-tüketicisi).

## Tek stüdyo ürün adı hata eşlemesi — 67 kabulü

Yayında güncel disiplin ön eki yoksa `VALIDATION_FAILED`; güncel ön eki taşımayan eski sürümle yeni satış `PLAN_FEATURE_UNAVAILABLE`; sürümün `published_name` alanını sonradan değiştirme `INVALID_STATE_TRANSITION` ile reddedilir. Yeni ürün adı yalnız yeni yayın sürümündedir. DTO’ya yeni hata/izin veya yeni endpoint eklenmez; mevcut `ProductTerms.name` seçilen sürümden okunur.67 kabulü PR58/main5639783b5dcd963d84bb76ec7bdf75d65a75ced5, aday40452100471/main40476673333/CD40479412819 ile doğrulandı.

## Starter kapıları — kabul edilmiş hata ve yetki davranışı

PR56 ile kabul edilmiş66. migration Starter canlı limit/özellik/kapsam ve receipt tekrar denetimini uygular; [hata, DTO ve kabul sınırı](../workflows.md). Yeni hata/izin enum’u eklenmez: kaynak/öğrenci kota aşımı `PLAN_LIMIT_REACHED`; plan dışı özellik veya seçilmemiş kaynak `PLAN_FEATURE_UNAVAILABLE`; güncel yetki yokluğu `FORBIDDEN`; yabancı/olmayan kimlik `NOT_FOUND`; stale abonelik sürümü `VERSION_CONFLICT`; yanlış ad/çapraz seçim `VALIDATION_FAILED`. Şema kapısı geçerli istekten önce çalışır; malformed istek plan kabul testi değildir. Eski yüksek katalog veya personel grant’i kapıyı açmaz; personel yetkisiyle operasyon Pro/Business lisansına tabidir, öğrencinin kendi ve atanmış eğitmenin bağımsız yetkisi korunur. Bu davranış PR56 aynı-main clean ve development CD kabulüyle doğrulanmıştır.

# FtkSaaS — O4 durum, hata ve izin sözleşmesi

## 26 Ekim — Starter/Pro/Business plan erişim hedefi

[Ürün kararı](01-FtkSaaS-urun-kapsam-sozlesmesi.md): Starter 1 merkez/1 aktif oda/1 disiplin/1 aktif eğitmen/100 aktif öğrenci; self-servis ve temel ders public başvurusu açık; bağımsız etkinlik, genel CRM/otomasyon ve hakediş kapalı. Pro bütün tek merkezli fonksiyonları, Business en fazla 5 merkezi kapsar. Operasyon rolü, owner/grant veya doğrudan RPC çağrısı plan kapısını aşmaz. Mevcut öğrenci limitinde `RelationshipState=active` ve canlı yetki esas alınır; eski kayıtlar/rezervasyonlar plan düşüşüyle silinmez. Starter isteklerinin hata/izin eşlemesi mevcut `08`, gerçek API ve PR56 kabulüne bağlıdır; yeni hata kodu veya izin enum’u eklenmemiştir. Pro/Business ayrı limit/özel teklif hedefinin tamamı bu dar kabulden türetilmez.


## Durum aileleri

| Tip | Değerler | Geçiş / garanti |
|---|---|---|
| `RecordState` | `active, inactive` | Yapılandırma/katalog/görev aktifliği; kaydın iş geçmişini silmez. Etkinleştirme kapsam/plan kontrolüyle. |
| `OrganizationState` | `active, closed, deletion_pending, deleted` | active→closed→active açık owner/abonelik; active/closed→deletion_pending→deleted; deleted→active yok. SaaS askısı bununla karıştırılmaz. |
| `AccountState` | `pending, active, deletion_pending, deleted` | Davet/şifre doğrulaması pending→active; silme engelleri çözülmeden deletion_pending yok. Global owner ilişkileri kontrol edilir. |
| `LinkState` | `active, revoked` | Doğrulanmış davet→active; active→revoked; eski link tekrar açılmaz, yeni doğrulanmış süreç. |
| `InviteState` | `pending, accepted, expired, revoked` | pending→bir terminal sonuç; token/süre/güncel yetki atomik kontrol. Yeniden gönderme eski pending→revoked + yeni pending. |
| `PersonState` | `active, merged` | Kişi aktifliği öğrenci ilişkisi aktifliği değildir. active→merged aynı tenant onaylı; merged_into alias geçmişi korur. Silme state değil privacy işidir. |
| `RelationshipState` | `active, inactive` | Öğrenci inactive→active org limit kapısı; active→inactive açık talep/alternatif/rezervasyon/liste/teklif/event kaydı yoksa. Borç/hak tek başına engel değil. |
| `ApprovalState` | `pending, accepted, rejected, cancelled` | Merge/ödeme gibi onaylarda pending→accepted/rejected/cancelled, aynı scope/aktör kontrolü. Owner devri müşteri approval akışı değildir. |
| `RequestState` | `pending, alternative_offered, approved, rejected, withdrawn, expired` | pending→alternative_offered/approved/rejected/withdrawn/expired; alternative_offered→approved/rejected/withdrawn/expired veya yeni alternatif sürümü. Kabul kaynağı  |
| `AlternativeState` | `offered, accepted, rejected, superseded, expired` | Öğrenci seçimi niyet kaydı; request alternative_offered kalır. Kesin onay merkez approve, güncel kaynak/hak kontrolü; offered alternatif resource ayırmaz. |
| `ReservationState` | `active, cancelled, completed` | active→cancelled (politika); active→completed yoklama kapandığında. cancelled yeniden active olmaz; yeni kayıt linked previous. completed seansa yeniden kayıt  |
| `SessionState` | `planned, occurred, cancelled` | planned→occurred yoklama kapanışı; planned→cancelled yönetici. Zaman geçmesi occurred/no_show üretmez. occurred düzeltme revizyonudur, eski kayıt silinmez. |
| `AttendanceResult` | `unmarked, attended, no_show, blocked` | Draft ordinary mark yetkili görevli; blocked CM tarafından. Kapanış unmarked kabul etmez. DS etki onayıyla korunan kesin rezervasyon dışında başlangıçta limit aşılmışsa blocked ve bu öğrenci yüzde/kişi hakedişine girmez; sonradan ödeme geriye değiştirmez. |
| `AttendanceClosure` | `open, closed` | open→closed eğitmen/merkez yönetici; asistan/personel yok. closed düzeltme yalnız manager yeni revision, sessiz reopen değil. |
| `WaitState` | `waiting, offered, converted, left, closed` | waiting→offered/left/closed; offered→converted/closed; ret/expiry listeden çıkış. Yeni giriş yeni sıra. Seans iptalinde açık kayıtlar closed. |
| `OfferState` | `active, accepted, rejected, expired, withdrawn` | active→tek terminal; seat_offer kabul ve expiry race tek sonuç. Quote/trial aynı enum etiketini paylaşabilir fakat koşullar farklıdır. |
| `SaleState` | `active, terminated, expired` | active→terminated açık sonlandırma; sürenin dolması expired read/projection veya worker; aynı geçiş çift hak/para hareketi üretmez. Geçmiş aktive edilmez; uzatma ayrı auditli işlem. |
| `EntitlementState` | `active, suspended, closed` | Dondurma suspended; sonlandırma closed. Zaman geçerliliği ayrı; state=active süresi dolmuş hakkı kullandırmaz. |
| `AllocationState` | `reserved, consumed, released` | reserved→consumed/released. Düzeltme yeni movement/revision ile; aynı hak iki kez tüketilemez. |
| `DeficitState` | `reserved, consumed, settled, released` | Gelecek açık reserved, geçmiş tüketen consumed; yeni paketle uygun kaynaktan settled. Parçalı settled miktarı hareket bazlı, tüm açık bitmeden terminal değil. |
| `FreezeState` | `scheduled, active, ended, cancelled` | Zaman+onaylı aralık kaynak; ended fiilî süre snapshot. Geçmişe erken bitirme yok. İşletim state’i rezervasyon otomatik geri açmaz. |
| `DebtState` | `open, settled` | Kalan>0 open, =0 settled; düzeltme eski tahsilat silmeden tekrar open gösterebilir. Alacak negatif debt değildir. |
| `LeadState` | `open, converted, closed` | Taslak minimum CRM state; ayrıntılı pipeline ilk kapsamda icat edilmez. Dönüşüm aktif ilişki+limit kapısı; geri kazanma taskları ayrı. |
| `JobState` | `pending, running, retry_wait, succeeded, failed, cancelled` | Lease expiry running yeniden claim edilebilir; failed sınırlı deneme sonrası; geçmiş automation/bildirim toplu replay yok. Süresi dolmuş teklif job retry ile uzamaz. |
| `SubscriptionState` | `pending_payment, active, grace, suspended, ended` | İlk ödeme yokken pending_payment yalnız kuruluş/ödeme; deneme/grace yok. İlk doğrulanmış ödeme aktif dönem başlatır. Yenileme gecikmesi grace→suspended; gönüllü iptal dönem sonunda ended. İlk ödeme öncesi öğrenci/satış/ders yok. |
| `ChangeState` | `scheduled, applied, cancelled` | Düşürme dönem sınırında, upgrade ödeme doğrulaması; edit uygulanmamış scheduled revizyonu, eski quote bedeli sessiz değişmez. |
| `EventState` | `draft, published, occurred, cancelled` | Şartlar/görevli eksikse published yok; occurred yönetici gerçekleşme, duty verify ücretli hakedişi doğurur. Katılım etkisi kayıt koşuluyla kapanışta. |
| `EventRegistrationState` | `active, cancelled, completed` | Yer aktif kayıtta; katılım sonucu taslak. Tüm iptal edilmemiş sonuçlar CM kapatınca completed ve paket etkisi. Duty hakedişi ayrıca gerçekleşme+verify; eksik ödeme auto cancel değil. |
| `FileState` | `pending_upload, ready, rejected, deleted` | Signed upload hazır dosya değildir; checksum/byte/mime kontrolü sonrası ready. URL süresi erişim yetkisi yerine geçmez. |
| `PreviewState` | `current, applied, invalidated, expired` | Onayda dependency hash/sürüm değişmişse invalidated; uygulanmış preview aynı key replay, yeni key ikinci apply yok. |
| `OperationState` | `in_progress, succeeded, failed_final, result_expired` | Successful business + receipt atomik. İşlenmemiş validation ret için kalıcı key tüketme ayrıntısı teknik receipt tasarımında belgelenecek. Failed DB transaction başarılı sayılmaz. |
| `ImportRowState` | `pending, valid, invalid, applied, failed` | Önizlemede valid iş yaratmaz; applied source key tekrar çalışmaz. Düzeltme yeni satır/source ilişki kanıtı  |
| `ApplicationState` | `pending, reviewed, closed` | Hesapsız başvuru domain reservation değildir; incelemede mevcut kişi eşlemesi yetkili/doğrulanmış;  |
| `PrivacyState` | `requested, running, partial, completed, failed` | Erişim kesme ile tüm kopyaları yok etme farklı. completed bütün sistem doğrulama; partial tamamlandı diye raporlanmaz. |

## İzinler

| Kod | Yetki ve scope |
|---|---|
| `account.self` | Giriş yapmış hesabın kendisi; organizasyonsuz da mümkün. |
| `org.read` | Owner/organizasyon yöneticisi org; merkez yöneticisi kendi merkez projeksiyonu. |
| `org.manage` | Owner veya organizasyon yöneticisi; merkez operasyonu içermez. |
| `org.owner` | Yalnız mevcut owner, kendi organizasyonunun yönetimi; owner rolü atama/kaldırma veya merkez operasyonu içermez. |
| `center.manage` | İlgili merkez yöneticisi; owner/org_manager atamasız operasyon yapamaz. Ödeme öncesi yalnız kabul edilen merkez kuruluş ayarı; operasyon yok. |
| `policy.manage` | Owner/organizasyon yöneticisi; merkez yöneticisi yalnız devredilmiş/tavsiye scope. |
| `person.read` | Org okuyucular; merkez yöneticisi; personel ilgili işlem için dar alanlar. Eğitmen/asistan yalnız görevlendirildiği katılımcı alanları; öğrenci yalnız kendisi. |
| `person.manage` | Merkez yöneticisi veya people.write personeli; rol atayamaz, default öğrenci self erişimi hesap bağlanınca. İletişim alan izni ayrıca. |
| `person.activate` | Merkez yöneticisi veya people.write personeli, aktif öğrenci ve limit kapısı. |
| `person.merge` | Tüm etkilenen merkezlerde yönetici veya eksik merkezlerin yönetici onayları. |
| `invite.student` | Merkez yöneticisi veya kapsamlı personel varsayılan açık (yönetici kapatabilir), eğitmen izinle kendi sınıf/seans öğrencileri; asistan yok. Owner tek başına yok. Yalnız mevcut kişi ve henüz bağlanmamış hesap erişimi; bağlanmadan yönetim rolü atanamaz. |
| `invite.accept` | Hedef e-postası doğrulanmış hesap; davet kapsamı/gönderen güncel yetkisi. |
| `schedule.read` | Org okuyucular ve merkez yöneticisi; ilgili personel; eğitmen/asistan görevleri; öğrenci izinli yayın veya kendi program projeksiyonu. |
| `schedule.manage` | İlgili merkez yöneticisi. |
| `request.write` | Öğrenci kendi adına; merkez yöneticisi veya reservations.write personeli merkez adına. |
| `request.resolve` | Merkez yöneticisi veya merkez kapsamlı reservations.write personeli; kesin onayda kaynak/hak kontrolü. Öğrencinin alternatif seçimi onay yetkisi vermez. |
| `reservation.write` | Öğrenci yalnız kendi esnek kaydı; merkez yöneticisi; reservations.write personeli. |
| `attendance.draft` | Seans merkez yöneticisi; görevlendirilmiş eğitmen/asistan; attendance.write personeli. |
| `attendance.close` | İlgili merkez yöneticisi veya görevlendirilmiş eğitmen; personel/asistan kapatamaz. |
| `attendance.correct` | Yalnız merkez yöneticisi; gerekçeli. |
| `product.manage` | Merkez yöneticisi; fiyat/indirim personelde yok. |
| `sale.write` | Merkez yöneticisi veya sales.write personeli; personel yalnız tanımlı fiyat/koşul. |
| `entitlement.correct` | Merkez yöneticisi; gerekçe ve üst sınırlar. |
| `finance.read` | Org okuyucular/merkez yöneticisi; öğrenci kendi hareketleri; tahsilat personeli yalnız görev için gerekli borç/sonuç, tam finans yok. |
| `finance.collect` | Merkez yöneticisi veya collections.write personeli. |
| `finance.refund` | Yalnız merkez yöneticisi. |
| `earnings.manage` | Merkez yöneticisi; instructor öz hakediş okuma ayrı projeksiyon. |
| `crm.daily` | Merkez yöneticisi; CRM izni personel atanmış aday/merkez; fiyat/segment/automation/export yok. |
| `crm.manage` | Org çapında Owner/organizasyon yöneticisi; merkez yöneticisi yalnız kendi merkez konfigürasyonu. Automation executor merkez operasyon yetkisini ayrıca taşır. |
| `notification.self` | Alıcı kendi inbox/tercihleri; yönetici başkasının inbox’ını bu izinle okuyamaz. |
| `report.read` | Owner/organizasyon yöneticisi org, merkez yöneticisi merkez; personel yalnız açık dar rapor izni. Finans alanı ayrıca. |
| `report.export` | report.read alan/kapsamına ek dışa aktarım izni; CRM personeline toplu export yok. |
| `import.execute` | Merkez yönetici veya merkez kapsamlı özel imports.write izni; people.write tek başına yetmez. |
| `subscription.owner` | Owner yalnız org SaaS teklif/değişim/ödeme yönetimi. |
| `saas.operator` | Platform SaaS yöneticisi; müşteri rolü değil, müşteri hesapları bu actor türünü seçemez. |
| `event.manage` | İlgili merkez yöneticisi; en az eğitmen/asistan görevi. |
| `event.register` | Öğrenci kendi adına veya merkez yöneticisi/rezervasyon personeli; aktif öğrenci şartı. |
| `document.manage` | Org çapında Owner/organizasyon yöneticisi; merkez yöneticisi yalnız kendi merkezi. Belge yayını merkez rezervasyonu değiştirmez. |
| `document.accept` | Doğrulanmış kendi kişi hesabı; merkez vekâleten kabul semantiği hukuki inceleme, kendiliğinden kabul değil. |
| `public.apply` | Hesapsız/public; yayın ve bot/hız kapısı, mevcut kişi eşleştirme yok. |
| `system.worker` | Dar görev kimliği; istemciden actor spoof yok. Claim edilen org/iş kapsamı ve güncel kurallar korunur. |
| `earnings.read` | Owner/organizasyon yöneticisi org; merkez yöneticisi merkezi; eğitmen yalnız kendisine ait hakediş/ödeme. Öğrenci/tahsilat personeli başka eğitmen hakedişi görmez. |
| `platform.owner` | Yalnız FtkSaaS platform yetkilisi; doğrulanmış hedef hesap. Müşteri hiçbir role/actor beyanıyla çağrı yapamaz. |
| `center.manager.assign` | Owner: kendi orgunda bağlı hesaplı kişiye merkez yöneticiliği verme/kaldırma; kendisi de dahil. Organizasyon yöneticisinin önce kabul edilmiş kendisini merkeze atama yetkisi ayrı korunur. |
| `org.configuration` | Owner/organizasyon yöneticisi org çapında belge/segment/automation; merkez operasyonu vermez. Merkez yöneticisi yalnız kendi merkez scope’u. |
| `auth.recover` | Hesapsız parola sıfırlama; generic yanıt, bot/rate/provider sınırları. Organizasyon verisi açmaz. |
| `event.attendance` | Sorumlu merkez yöneticisi veya atanmış eğitmen/asistan; yalnız işaretleme, kapanış yok. |
| `event.close` | Yalnız etkinliğin sorumlu merkez yöneticisi; bütün sonuçlar tamam. |
| `attendance.block` | Yalnız merkez yöneticisi; negatif kredi sınırı seans başlangıcı snapshot’ıyla, eğitmen/asistana finans gerekçesi açılmaz. |

Owner, organizasyon kuralları/tüm merkez görüntüleme/rapor ve kabul edilmiş organizasyon yönetimindedir; başka role ait merkez mutasyonu yapamaz. Özel kuruluş bootstrap, owner’ın merkez oluşturup kendisini manager atamasını sağlar, otomatik manager atamaz. Diğer CM atama owner’a aittir; organizasyon yöneticisinin önce kabul edilen self-center ataması korunur. Merkez yöneticisi başka CM/OM/owner atayamaz; kapsamlı staff/assistant görev yönetimi yapar. OM atama/kaldırma owner, owner atama/kaldırma yalnız platformdur.

Self hesap erişimi aktif öğrenci ilişkisinin veya ticari kota istisnasının yerine geçmez. Kişi/ilişki ile giriş grant ayrı; aktif öğrenci sayımı org/person tekildir. CM/staff/instructor davet yetkileri varlıkları nedeniyle diğer merkez veya org yetkisini açmaz. Bağlantı kaldırılması ve yeniden bağlama eski ayrıcalıkları kendiliğinden canlandırmaz.

## Alan görünürlüğü

| Rol | Görebildiği | Yetki sağlamayan |
|---|---|---|
| Owner/OM | Tüm merkez rapor/iş verisi; org konfigürasyonu | Atanmamış merkezde operasyon; Auth sırları/platform hukuki arşivi |
| CM | Kendi merkez operasyon/finans/katılımcı/personel | Başka merkez mutasyonu; owner/OM grant |
| Personel | Verilen görev için gerekli kişi/iletişim/borç/rezervasyon ve sonuç | Tam finans, iade/kredi/fiyat/anlaşma; CRM toplu export/automation |
| Eğitmen | Görevli program, gerekli katılımcı alanları, öz hakediş | Öğrenci finans ayrıntıları/CRM; blocked gerekçesinin hassas finans detayı |
| Asistan | Görevli katılımcı ve açık yoklama; etkinlik mark | Ders/event close, finans/rezervasyon/CRM |
| Öğrenci | Kendi program/hak/borç/ödeme ve safe durum | Başka kişi listesi, anlaşma, SaaS borcu |
| Public | Yayımlanmış ders/event ücret/koşul/zaman | Kişi/iletişim/borç/kredi/iç not/hesap varlığı |

## Hata kodları

RPC domain error ve transport ayrı normalize edilir; düz metin ayrıştırılmaz. SQL domain sonuçları HTTP 200 içinde ok:false/SafeError dönebilir. Gateway/Auth/transport hatalarının HTTP status’u ayrıca vardır; iş başarısı yalnız HTTP kodundan çıkarılmaz. Aşağıdaki kodlar domain anlamını taşır, sabit HTTP eşlemesi değildir. retry=true aynı operation_key gerektirir; otomatik deneme en fazla3, rate-limit Retry-After beklenir. RESULT_NOT_CONFIRMED istemci durumu, DB başarısızlık hükmü değildir.

| Kod | Retry | Anlam |
|---|---|---|
| `AUTH_REQUIRED` | hayır | Geçerli hesap/oturum yok; public kapsam ayrı. |
| `SESSION_REVOKED` | hayır | Eski JWT tek başına canlı erişim sağlamaz. |
| `FORBIDDEN` | hayır | Güncel işlem/scope/alan yetkisi yok. |
| `NOT_FOUND` | hayır | Yok veya aktörün göremediği kayıt; tenant varlığı açıklanmaz. |
| `VALIDATION_FAILED` | hayır | Tip/aralık/bilinmeyen alan/geçersiz currency; alan yolları güvenli. |
| `CLIENT_UPDATE_REQUIRED` | hayır | Desteklenmeyen sözleşme sürümü, iş yaratılmadı. |
| `PLAN_FEATURE_UNAVAILABLE` | hayır | Özellik plan dışında; veri silinmez, kullanım açılmaz. |
| `PLAN_LIMIT_REACHED` | hayır | Yeni aktif öğrenci/merkez vb plan limitinde. |
| `SERVICE_UNAVAILABLE` | hayır | Organizasyon hizmeti kapalı; öğrenciye SaaS borcu açıklanmaz. |
| `BILLING_OPERATION_RESTRICTED` | hayır | İlk 7 gün kapalı işlem grubu. |
| `POLICY_NOT_CONFIGURED` | hayır | Zorunlu politika veya anlaşma eksik; otomatik izin/ret varsayımı yok. |
| `CAPACITY_FULL` | hayır | Güncel hedefte seans toplam/kategori veya fiziksel oda sınırı; ayrı kontrollü aşım fiziksel oda sınırını kaldıramaz. |
| `RESOURCE_CONFLICT` | hayır | Oda/görevli çakışması. |
| `RESERVATION_EXISTS` | hayır | Farklı key ile aynı aktif rezervasyon; izinli current ref varsa döner. |
| `ENTITLEMENT_UNAVAILABLE` | hayır | Ders tarihinde uygun kullanılabilir hak yok. |
| `CREDIT_LIMIT_EXCEEDED` | hayır | Ayrılmış+tüketilmiş açık limiti aşar. |
| `QUOTA_EXCEEDED` | hayır | Süreli ürün dönem kullanım sınırı dolu. |
| `CLASS_ACCESS_DENIED` | hayır | Paket sınıf/merkez kapsamı uygun değil. |
| `DOCUMENT_REQUIRED` | hayır | İşlem noktasında gerekli sürüm onayı eksik. |
| `ATTENDANCE_INCOMPLETE` | hayır | Sonucu girilmemiş iptal edilmemiş rezervasyon var. |
| `ATTENDANCE_CLOSED` | hayır | Açık yoklama komutu kapalıya uygulanamaz. |
| `ASSISTANT_PARTICIPANT_CONFLICT` | hayır | Asistan/katılımcı iki yönlü çakışma. |
| `OPEN_OPERATIONS_EXIST` | hayır | Öğrenci pasifleştirmesi açık işlem varken yasak. |
| `VERSION_CONFLICT` | hayır | Güncel veri yeniden alınmalı; eski değişiklik otomatik uygulanmaz. |
| `PREVIEW_STALE` | hayır | İlgili scope/sürüm/onay değişmiş, yeniden önizleme. |
| `APPROVAL_REQUIRED` | hayır | Eksik etkilenen merkez onayları. |
| `ACCOUNT_LINK_CONFLICT` | hayır | Hesap bağlantısı veya çok rollü davet; otomatik merge yok. |
| `OWNER_TRANSFER_REQUIRED` | hayır | Aktif owner hesabı silinmeden devir/kapama gerekir. |
| `INVALID_STATE_TRANSITION` | hayır | Terminal kayıt yeniden açılamaz/uygunsuz komut. |
| `INVITATION_UNAVAILABLE` | hayır | Kullanılmış/süresi dolmuş/iptal/uygunsuz davet; hesap varlığı açılmaz. |
| `OFFER_UNAVAILABLE` | hayır | Yer teklifi terminal veya expiry; kabul tekrar yeri arttırmaz. |
| `INSUFFICIENT_STUDENT_CREDIT` | hayır | Alacak iade/mahsup yarışı kalan bakiyeyi aştı. |
| `CURRENCY_MISMATCH` | hayır | Merkez/currency eşleşmez; kur dönüşümü yok. |
| `IDEMPOTENCY_PAYLOAD_MISMATCH` | hayır | Aynı key farklı kanonik içerik. |
| `OPERATION_IN_PROGRESS` | aynı key | Aynı key işlem durumu sorgulanır; yeni iş açılmaz. |
| `OPERATION_RESULT_EXPIRED` | hayır | Tam sonuç 30 gün sonra yok; aynı key yeni iş başlatmaz, yetkili business ref sorgulanır. |
| `RATE_LIMITED` | aynı key | retry_after_ms dolmadan deneme yok; public yanıt hesabı sızdırmaz. |
| `BOT_VERIFICATION_FAILED` | hayır | Kabulden önce doğrulama gerekli; kişisel veri sisteme yazılmadı. |
| `TEMPORARY_FAILURE` | aynı key | Geçici DB/altyapı; en fazla 3 otomatik retry aynı key. |
| `INTEGRITY_VIOLATION` | hayır | İlgili transaction rollback, kritik alarm; hassas DB hata metni açıklanmaz. |
| `RESULT_NOT_CONFIRMED` | hayır | İstemcinin bağlantı sonucu belirsiz sunum durumu; DB başarısızlık kodu değildir. |
| `ACCOUNT_ALREADY_LINKED` | hayır | Mevcut bağlı hesaba tekrar erişim daveti gönderilmez. |
| `ACCOUNT_LINK_REQUIRED` | hayır | Öğrenci dışı role grant öncesi hesap bağı zorunlu. |
| `SUBSCRIPTION_NOT_STARTED` | hayır | İlk ödeme doğrulanmadı; yalnız kuruluş/ödeme kapısı açık. |
| `PARTICIPATION_BLOCKED` | hayır | Seans başlangıcındaki kredi limit aşımı; geriye ödeme sonucu değiştirmez. |

08 operations.errors her işlem için izinli kod kümesini içerir; permission/transition/semantic_guards ve transaction sınıfıyla birlikte değerlendirilir. Örn. role owner beyanı doğrulama/forbidden, source-less negative basis eksikliği POLICY_NOT_CONFIGURED, başlangıç limit aşımı PARTICIPATION_BLOCKED, closed correction yetkisi yoksa FORBIDDEN. İş sonucunu sızdırabilecek NOT_FOUND/FORBIDDEN ayrımı tenant varlığı açıklamayacak şekilde maskelenir. Public/hesap kurtarma yanıtı hesap varlığını açıklamaz.

## Sonuçların kaydı

OrdinaryAttendanceResult attended/no_show; blocked ayrı CM işlemidir. AttendanceResult unmarked/attended/no_show/blocked. Seans saatinin geçmesi hiçbiri için otomatik yoklama üretmez. blocked sonucu işaretli kabul edildiği için CM/I ders kapanışı tüm sonuçlar tamken yapılabilir; katılım engeli kararını verme yetkisi instructor’a geçmez. Event closure yalnız CM’dir, instructor/asst sadece mark.

Kesin para/kredi/hakediş düzeltilirken eski hareket silinmez. Slot/hak/limit/permission yarışı transaction içinde yeniden denetlenir; dış bildirim teslimat hatası domain commit’i geri almaz. Terminal iptal ve tamamlanmış katılım yeniden etkinleşmez; izinli düzeltme bağlı yeni revision/hareketle. Ayrı platform silme/kanuni imha yükümlülüğü append-only geçmiş için de geçerlidir.

## Normatif davranış kaynağı

D01–D09, U01–U08 ve etkinlik kararları [teknik sözleşmede](02-FtkSaaS-teknik-sozlesme.md) tutulur. Bu belge bu kararların hata/izin/durum projeksiyonudur; ayrı karar kopyası değildir.

## 2.2-tech.1 — alan/izin aktarımı

- Yeni rol/izin yok. Organizasyon disiplin tanımı: org.manage; merkezde açma: center.manage; kişi ilişkisi: person.manage + öğrenci aktiflik/plan/merkez kapıları.
- person_disciplines student/instructor ilişkisidir; role_assignments/account_links değiştirmez.
- PackageScopeKind: center_discipline, center_all_disciplines, organization_discipline, organization_all. usage_targets lesson/event; iki boyut bağımsız.
- CREDIT_LIMIT_EXCEEDED artık ilgili org/person/center/discipline ayrılmış+tüketilmiş açık toplamıdır. Başka disiplinin açığı bu sonucu doğurmaz.
- Kapsam dışı hak CLASS_ACCESS_DENIED/ENTITLEMENT_UNAVAILABLE; tenant görünürlüğü NOT_FOUND; biçim/eksik alan VALIDATION_FAILED. Yeni hata kodu icat edilmedi.
- EligibilitySnapshot merkez ve disiplini taşır; başlangıç snapshot ve geç ödeme/no retro earning kuralları korunur.
- FtkUuid yeni üretimi UUIDv7 şart koşar, var olan UUID girişini sürümü yüzünden reddetmez. ProviderUuid sağlayıcı UUID'sidir. Üretim kontrolü FtkGeneratedUuidV7 tanımıyla ayrıca sınanır.
- DB UUID üreticisi yoksa private default teknik hata 0A000/UUIDV7_GENERATOR_UNAVAILABLE ile kapalıdır; bu müşteri domain hata sözlüğüne yeni ürün davranışı eklemez. Bu ilk aktarımın eski endpoint bekleme notu geçerli değildir; çağrılabilir create yolları runtime/envanterde gösterilir ve kimliklerini backend UUIDv7 üreticisinden alır.
- Q-D01 karar/uygulama güncel kaynakta kapalıdır; bu ilk aktarım notu tarihsel kalır.

## Q-D01 — güncel izin/hata eşlemesi

- event_disciplines yalnız organizasyona ait etiket ilişkisidir; rol, plan, merkez erişimi veya paket yetkisi vermez.
- event_save event.manage kapsamında discipline_ids listesini sürüm kontrollü atomik kaydeder; boş liste disiplinsiz etkinliktir. event_save_v1 çağrılabilir runtime içindedir; son kaynak kabulü güncel devir/CI’dan doğrulanır.
- EventView/CalendarItem/PublicCalendarItem disiplin UUID listesini döndürür. event_list discipline_id filtresi etiket üyeliğidir; diğer görünürlük kurallarını değiştirmez.
- Tam bir disiplin etiketinde center_discipline/organization_discipline ancak aynı disiplin ve açık usage_targets:event ile eşleşir. 0 veya birden çok etikette bu iki dar scope kullanılamaz.
- center_all_disciplines/organization_all de event uygunluğu ve merkez/diğer mevcut gate'lere tabidir.
- Kapsam uyumsuzluğu CLASS_ACCESS_DENIED; kullanılabilir hak yetersizliği ENTITLEMENT_UNAVAILABLE. Normal ders için negatif limit veya override etkinliğe uygulanmaz; yeni hata/rol eklenmedi.
- private.event_package_scope_matches scope filtresi, private.require_event_available_credit pozitif kullanılabilir hak kapısıdır. Bu yardımcılar tek başına kayıt RPC’si değildir; güncel event_register_v1 yolu yetki/kapasite ve ortak hak havuzu kilidi/atomik allocation ile birlikte bunları tüketir. Negatif kredi yasağı korunur.

## Q-E01 çalışma durumları ve izinler

event_payment_preparations: prepared → registered / capacity_closed / event_cancelled; registered → event_cancelled. Hazırlık yer ayırmaz. Merkez/tenant/kişi/borç/registration FK'leri korunur. Eski hazırlık ikinci kesin kaydı finanse etmez.

event_payment_prepare: event.register; event_payment_get: kişi kendisi veya merkez yöneticisi/açık finance.collect personeli. student_credit_refund ve debt_adjust: finance.refund (CM); student_credit_offset: finance.collect. Tahsilat ve açık mahsup yalnız aynı merkez/kişi/para birimindeki borca uygulanır.

event_register başarı verisi outcome üzerinden ayrılır: registered kesin kayıttır; capacity_closed kesin kayıt değildir, ödenmiş hazırlığın kapanması/borcun ters kaydı/öğrenci alacağı commit edilmiştir. capacity_closed HTTP/domain hata zarfına çevrilmez. Aynı anahtar aynı sonucu tekrarlar. Hazırlıksız normal kapasite hatası halen CAPACITY_FULL; eksik tam ödeme ENTITLEMENT_UNAVAILABLE; yanlış kapsam NOT_FOUND; güncel olmayan önizleme PREVIEW_STALE.

İptal önizlemesi kalan borç kaldırma, yeni öğrenci alacağı, hak serbest bırakma ve hazırlık kapatma etkilerini verir. Tahsilat/indirim/alacak veya hazırlık değiştiyse yeniden önizleme gerekir. Q-E02 merkez iptalinde aşamadan bağımsız tam hak/para sonucu; Q-E03 katılımcı iptalinde planlanan başlangıç sınırı uygulanır. Oransal yeni iade kuralı türetilmez.

## Etkinlik iptalinin durum etkisi

Q-E02/Q-E03’ün tek normatif sahibi [etkinlik kararıdır](02-FtkSaaS-teknik-sozlesme.md#etkinlik-kararlari). Merkezce iptal edilmiş etkinlikte sonraki yoklama komutları hakkı yeniden tüketemez.

## Takvim/seans/rezervasyon okuma aktarımı

`schedule.read` satırı yeni genel merkez yetkisi değildir. Üç okuma için öğrenci self kayıtları, canlı seans/sınıf görevi + I/A login rolü, CM veya açık reservation.write/attendance.draft personel grantı ve organizasyon okuyucusu kapsamı satır bazında uygulanır. Aktif hesap bağı, plan/merkez/abonelik ve Auth oturumu her sayfada denetlenir. Yönetim dışındaki seans görevlerinde agreement_id gösterilmez. Zaman/cursor/alan ayrıntıları: [okuma devri](../workflows.md). Ürün/uygun satış seçimi bu aktarımda kapatılmadı.


## Program/seans teknik aktarımı — 17 Ekim 2026

Yeni ürün kuralı eklemeden mevcut program/saat/kaynak/kapasite/görev kuralları sonlu materialize edilmiş oluşumlara aktarılır. Ayrıntılı DTO, bağımlılık, miras/override ve hata davranışı [program/seans devrindedir](../workflows.md). Yerel tarihler [başlangıç,bitiş), DST çift saatinde açık date/offset_minutes; gap reddi. this_and_future aynı programın gelecekteki planned/open oluşumlarını kapsar; geçmiş/sonuçlanmış korunur. Mevcut rezervasyon/hak kimliği kapasite indirimiyle iptal edilmez; saat değişikliği mevcut sabit hakkı geçersiz kılıyorsa transaction reddedilir. Kabul edilmiş DS kuralında Starter kapanışı F20/anlaşma istemez ve hakediş üretmez; Pro/Business ücretli görev için açık anlaşma gerekir. API tüketimi WF03/WF07, kaynak kabulü güncel kabul kaydında izlenir.

Sınıf atama güncellemesi hedef atama satır sürümünü, seans kapasite/görev güncellemesi seans sürümünü ister. Inactive açık görev kaldırmasıdır; sınıf varsayılanı açık oluşum override'ını geri getirmez. Önizleme dependency değişimi PREVIEW_STALE, komut sürüm yarışı VERSION_CONFLICT, kaynak/uygunluk çakışması RESOURCE_CONFLICT, eksik yapılandırma POLICY_NOT_CONFIGURED üretir. Yetki geri alınması receipt replay öncesinde denetlenir. İlgili komutların çağrı sırası ortak iş akışları rehberindedir.


## Hesaplaşma durum ve izin projeksiyonu

Tek normatif [hesaplaşma kararı](02-FtkSaaS-teknik-sozlesme.md#hesaplasma) esas alınır.

SettlementRequestState: pending → approved/rejected/withdrawn. approved = B tarafından record + seçili bakiye etkileri aynı transaction içinde kesinleşmiş; ayrı kayıt bekleyen approved aşaması yok. Onaylı kaydın revizyonu yeni bağlı pending başvuru ve yeniden onaydır; eski kayıt silinmez. Gerekçeli ret bakiye/kayıt üretmez. payment/offset/correction kapalı DTO birleşimidir. OM fallback alanı ve settlement.record izni kaldırıldı.

settlement.delegation.manage Owner'a özgü; settlement.authority.manage Owner veya canlı delege OM'ye özgüdür. settlement.authority.inspect yalnız dar idari grant projeksiyonudur. settlement.read/request/decide aktif CM + açık canlı merkez grantı ister. Yetki setleri org settlement-authority aggregate sürümünü kullanır. B onayında record/balance/request/audit/outbox/receipt ve yetki setinde grant/version/audit/outbox/receipt atomiktir. DTO/guard varlığı çalışan uygulama kanıtı değildir.

## Yoklama ve hakediş yetkileri

earnings.manage seçili CM; earnings.read org okuyucusu/seçili CM/kendi canlı merkez rolündeki eğitmen projeksiyonudur. attendance_start_v1, attendance.close yetkisiyle açık olgu kaydıdır; taslak/tüketim/kapanış değildir. Management okuması yalnız makine sözleşmesindeki desteklenen selector ve domain yetki kapısıyla çalışır; genel tablo erişimi sağlamaz.

## 23 Ekim settings ve kullanıcı güvenliği aktarımı

Ayarlar davranış sözleşmesi [02 içindedir](02-FtkSaaS-teknik-sozlesme.md#ayarlar-sozlesmesi-ve-davranis-sprinti). Ürün kararı yeni hata/enum/permission veya callable DTO eklemez; aşağıdakiler hedef semantik aktarımıdır.

- Hesap sahibi kendi profil/tercih/oturumunu; merkez ve org yöneticileri yalnız mevcut canlı scoped izinlerini kullanır. Platform yetkisi kullanıcı adına rıza oluşturamaz. Org güvenlik şartı diğer orga kendiliğinden taşınmaz.
- Doğrulama bekleyen iletişim, doğrulanmış güncel değer değildir. Yeni aynı-alan talebi eski bekleyeni geçersizleştirir. Başka hesaba bağlı giriş/kurtarma iletişimi otomatik birleştirme doğurmaz. Active güvenli bağlantı kaldırılınca gelecekteki yayılım durur; üyelik/hesap silme anlamına gelmez.
- Parola değişimi/kurtarmanın tek kuralı teknik sözleşmenin S04 grubudur: mevcut native oturum korunur, diğerleri kapatılır; ikinci completion/all-session trigger eklenmez. Canlı session kapısı korunur.
- Ayarları kapalı/desteklenmiyor/yetkisiz/doğrulama bekliyor/sürüm çatışması/yayılma sürüyor durumları UI'da tek başarı durumuna indirgenmez. Mevcut error enum'u dışında yeni string uydurulmaz; gerekli yeni kod ayrı API sözleşmesidir.
- S01–S10 görünüm tercihleri rol/merkez/plan/alan iznini değiştirmez. Erişimsiz kayıtlı bağlam güvenli yeniden seçime gider; API gizli alanları göndermemelidir.
