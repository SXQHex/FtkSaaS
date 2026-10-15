# FtkSaaS — O4 durum, hata ve izin sözleşmesi

> **Güncel 2.2-tech.2 / Q-D01:** Etkinlik 0/1/çok disiplin etiketini destekler. Tek etikette etkinliğe uygun dar/geniş paket, 0/çok etikette yalnız uygun geniş paket; etkinliklerde negatif kredi yok. Q-D01 ürün kararı kapalı, tam olay kayıt/RPC entegrasyonu ve son ortak kredi yarışı açık. Güncel durum 11-FtkSaaS-Q-D01-teknik-aktarim-raporu.md.

> **Güncel teknik uygulama kaydı — 2.2-tech.1, 15 Ekim 2026:** D01–D09/U01–U08, 04–08 kataloglarına ve ortak tiplere aktarıldı. İki migration izole geliştirme DB’sinde uygulandı. Aşağıdaki eski “kod/kurulum yapılmadı” ve “teknik aktarım bekliyor” ifadeleri tarihsel kayıt olarak okunur. İş RPC’leri, ayrıntılı izin RLS politikaları ve gerçek iş akışı kabul testleri açık; Q-D01 yeni ürün kararı bekliyor. Güncel durum 09 teknik aktarım raporundadır.

> Güncel UUID üretim standardı: U01–U08, UUIDv7. Sağlayıcı kimlikleri korunur.

> Güncel ek: D01–D09 disiplin revizyonu kabul edilmiştir; aşağıdaki tarihsel teknik tamamlanma ifadeleri yeni kapsamı içermez. Ayrıntı ve açık teknik aktarım listesi belgenin sonundadır.

15 Ekim 2026 · v1.0 · Yazılı sözlük. Uygulanmış RLS/endpoint değildir.08 JSON enum ve request/response yapıları makine kaynağı; aşağıdaki rol ve durum anlamları kabul edilmiş02 hükümlerini uygular.

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
| `AttendanceResult` | `unmarked, attended, no_show, blocked` | Draft ordinary mark yetkili görevli; blocked CM tarafından. Kapanış unmarked kabul etmez. Başlangıçta limit aşılmışsa blocked ve bu öğrenci yüzde/kişi hakedişine girmez; sonradan ödeme geriye değiştirmez. |
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

RPC domain error ve transport ayrı normalize edilir; düz metin ayrıştırılmaz. HTTP sütunu adapter eşlemesidir. retry=true aynı operation_key gerektirir; otomatik deneme en fazla3, rate-limit Retry-After beklenir. RESULT_NOT_CONFIRMED istemci durumu, DB başarısızlık hükmü değildir.

| Kod | HTTP | Retry | Anlam |
|---|---|---|---|
| `AUTH_REQUIRED` | 401 | hayır | Geçerli hesap/oturum yok; public kapsam ayrı. |
| `SESSION_REVOKED` | 401 | hayır | Eski JWT tek başına canlı erişim sağlamaz. |
| `FORBIDDEN` | 403 | hayır | Güncel işlem/scope/alan yetkisi yok. |
| `NOT_FOUND` | 404 | hayır | Yok veya aktörün göremediği kayıt; tenant varlığı açıklanmaz. |
| `VALIDATION_FAILED` | 400 | hayır | Tip/aralık/bilinmeyen alan/geçersiz currency; alan yolları güvenli. |
| `CLIENT_UPDATE_REQUIRED` | 426 | hayır | Desteklenmeyen sözleşme sürümü, iş yaratılmadı. |
| `PLAN_FEATURE_UNAVAILABLE` | 403 | hayır | Özellik plan dışında; veri silinmez, kullanım açılmaz. |
| `PLAN_LIMIT_REACHED` | 409 | hayır | Yeni aktif öğrenci/merkez vb plan limitinde. |
| `SERVICE_UNAVAILABLE` | 503 | hayır | Organizasyon hizmeti kapalı; öğrenciye SaaS borcu açıklanmaz. |
| `BILLING_OPERATION_RESTRICTED` | 403 | hayır | İlk 7 gün kapalı işlem grubu. |
| `POLICY_NOT_CONFIGURED` | 409 | hayır | Zorunlu politika veya anlaşma eksik; otomatik izin/ret varsayımı yok. |
| `CAPACITY_FULL` | 409 | hayır | İlgili nominal/maksimum ortak yer sınırı. |
| `RESOURCE_CONFLICT` | 409 | hayır | Oda/görevli çakışması. |
| `RESERVATION_EXISTS` | 409 | hayır | Farklı key ile aynı aktif rezervasyon; izinli current ref varsa döner. |
| `ENTITLEMENT_UNAVAILABLE` | 409 | hayır | Ders tarihinde uygun kullanılabilir hak yok. |
| `CREDIT_LIMIT_EXCEEDED` | 409 | hayır | Ayrılmış+tüketilmiş açık limiti aşar. |
| `QUOTA_EXCEEDED` | 409 | hayır | Süreli ürün dönem kullanım sınırı dolu. |
| `CLASS_ACCESS_DENIED` | 403 | hayır | Paket sınıf/merkez kapsamı uygun değil. |
| `DOCUMENT_REQUIRED` | 409 | hayır | İşlem noktasında gerekli sürüm onayı eksik. |
| `ATTENDANCE_INCOMPLETE` | 409 | hayır | Sonucu girilmemiş iptal edilmemiş rezervasyon var. |
| `ATTENDANCE_CLOSED` | 409 | hayır | Açık yoklama komutu kapalıya uygulanamaz. |
| `ASSISTANT_PARTICIPANT_CONFLICT` | 409 | hayır | Asistan/katılımcı iki yönlü çakışma. |
| `OPEN_OPERATIONS_EXIST` | 409 | hayır | Öğrenci pasifleştirmesi açık işlem varken yasak. |
| `VERSION_CONFLICT` | 409 | hayır | Güncel veri yeniden alınmalı; eski değişiklik otomatik uygulanmaz. |
| `PREVIEW_STALE` | 409 | hayır | İlgili scope/sürüm/onay değişmiş, yeniden önizleme. |
| `APPROVAL_REQUIRED` | 409 | hayır | Eksik etkilenen merkez onayları. |
| `ACCOUNT_LINK_CONFLICT` | 409 | hayır | Hesap bağlantısı veya çok rollü davet; otomatik merge yok. |
| `OWNER_TRANSFER_REQUIRED` | 409 | hayır | Aktif owner hesabı silinmeden devir/kapama gerekir. |
| `INVALID_STATE_TRANSITION` | 409 | hayır | Terminal kayıt yeniden açılamaz/uygunsuz komut. |
| `INVITATION_UNAVAILABLE` | 409 | hayır | Kullanılmış/süresi dolmuş/iptal/uygunsuz davet; hesap varlığı açılmaz. |
| `OFFER_UNAVAILABLE` | 409 | hayır | Yer teklifi terminal veya expiry; kabul tekrar yeri arttırmaz. |
| `INSUFFICIENT_STUDENT_CREDIT` | 409 | hayır | Alacak iade/mahsup yarışı kalan bakiyeyi aştı. |
| `CURRENCY_MISMATCH` | 409 | hayır | Merkez/currency eşleşmez; kur dönüşümü yok. |
| `IDEMPOTENCY_PAYLOAD_MISMATCH` | 409 | hayır | Aynı key farklı kanonik içerik. |
| `OPERATION_IN_PROGRESS` | 409 | aynı key | Aynı key işlem durumu sorgulanır; yeni iş açılmaz. |
| `OPERATION_RESULT_EXPIRED` | 409 | hayır | Tam sonuç 30 gün sonra yok; aynı key yeni iş başlatmaz, yetkili business ref sorgulanır. |
| `RATE_LIMITED` | 429 | aynı key | retry_after_ms dolmadan deneme yok; public yanıt hesabı sızdırmaz. |
| `BOT_VERIFICATION_FAILED` | 400 | hayır | Kabulden önce doğrulama gerekli; kişisel veri sisteme yazılmadı. |
| `TEMPORARY_FAILURE` | 503 | aynı key | Geçici DB/altyapı; en fazla 3 otomatik retry aynı key. |
| `INTEGRITY_VIOLATION` | 500 | hayır | İlgili transaction rollback, kritik alarm; hassas DB hata metni açıklanmaz. |
| `RESULT_NOT_CONFIRMED` | istemci | hayır | İstemcinin bağlantı sonucu belirsiz sunum durumu; DB başarısızlık kodu değildir. |
| `ACCOUNT_ALREADY_LINKED` | 409 | hayır | Mevcut bağlı hesaba tekrar erişim daveti gönderilmez. |
| `ACCOUNT_LINK_REQUIRED` | 409 | hayır | Öğrenci dışı role grant öncesi hesap bağı zorunlu. |
| `SUBSCRIPTION_NOT_STARTED` | 403 | hayır | İlk ödeme doğrulanmadı; yalnız kuruluş/ödeme kapısı açık. |
| `PARTICIPATION_BLOCKED` | 409 | hayır | Seans başlangıcındaki kredi limit aşımı; geriye ödeme sonucu değiştirmez. |

08 operations.errors her işlem için izinli kod kümesini içerir; permission/transition/semantic_guards ve transaction sınıfıyla birlikte değerlendirilir. Örn. role owner beyanı doğrulama/forbidden, source-less negative basis eksikliği POLICY_NOT_CONFIGURED, başlangıç limit aşımı PARTICIPATION_BLOCKED, closed correction yetkisi yoksa FORBIDDEN. İş sonucunu sızdırabilecek NOT_FOUND/FORBIDDEN ayrımı tenant varlığı açıklamayacak şekilde maskelenir. Public/hesap kurtarma yanıtı hesap varlığını açıklamaz.

## Sonuçların kaydı

OrdinaryAttendanceResult attended/no_show; blocked ayrı CM işlemidir. AttendanceResult unmarked/attended/no_show/blocked. Seans saatinin geçmesi hiçbiri için otomatik yoklama üretmez. blocked sonucu işaretli kabul edildiği için CM/I ders kapanışı tüm sonuçlar tamken yapılabilir; katılım engeli kararını verme yetkisi instructor’a geçmez. Event closure yalnız CM’dir, instructor/asst sadece mark.

Kesin para/kredi/hakediş düzeltilirken eski hareket silinmez. Slot/hak/limit/permission yarışı transaction içinde yeniden denetlenir; notification hatası domain commit’i geri almaz. Terminal iptal ve tamamlanmış katılım yeniden etkinleşmez; izinli düzeltme bağlı yeni revision/hareketle. Ayrı platform silme/kanuni imha yükümlülüğü append-only geçmiş için de geçerlidir.

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

Teknik aktarım listesi: disiplin ilişki durumları ve yaşam döngüsü, işlem bazlı yetki/hata eşleşmeleri ve merkez–disiplin kapsam kontrolleri mevcut yetki modeline göre hazırlanır. Disiplin katmanı yeni yönetici rolü oluşturmaz.

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


## 2.2-tech.1 — alan/izin aktarımı

- Yeni rol/izin yok. Organizasyon disiplin tanımı: org.manage; merkezde açma: center.manage; kişi ilişkisi: person.manage + öğrenci aktiflik/plan/merkez kapıları.
- person_disciplines student/instructor ilişkisidir; role_assignments/account_links değiştirmez.
- PackageScopeKind: center_discipline, center_all_disciplines, organization_discipline, organization_all. usage_targets lesson/event; iki boyut bağımsız.
- CREDIT_LIMIT_EXCEEDED artık ilgili org/person/center/discipline ayrılmış+tüketilmiş açık toplamıdır. Başka disiplinin açığı bu sonucu doğurmaz.
- Kapsam dışı hak CLASS_ACCESS_DENIED/ENTITLEMENT_UNAVAILABLE; tenant görünürlüğü NOT_FOUND; biçim/eksik alan VALIDATION_FAILED. Yeni hata kodu icat edilmedi.
- EligibilitySnapshot merkez ve disiplini taşır; başlangıç snapshot ve geç ödeme/no retro earning kuralları korunur.
- FtkUuid yeni üretimi UUIDv7 şart koşar, var olan UUID girişini sürümü yüzünden reddetmez. ProviderUuid sağlayıcı UUID'sidir. Üretim kontrolü FtkGeneratedUuidV7 tanımıyla ayrıca sınanır.
- DB UUID üreticisi yoksa private default teknik hata 0A000/UUIDV7_GENERATOR_UNAVAILABLE ile kapalıdır; bu müşteri domain hata sözlüğüne yeni ürün davranışı eklemez. İlgili domain create endpoint henüz açık değildir.
- Q-D01: etkinlik disiplin sınıflaması ve dar kapsamlı event hakkı/negatif kapsamı kararı yok; çıkarım yapılmaz.

## Q-D01 — güncel izin/hata eşlemesi

- event_disciplines yalnız organizasyona ait etiket ilişkisidir; rol, plan, merkez erişimi veya paket yetkisi vermez.
- event_save event.manage kapsamında discipline_ids listesini sürüm kontrollü atomik kaydeder; boş liste disiplinsiz etkinliktir. Bu API uygulaması henüz tamamlanmadı.
- EventView/CalendarItem/PublicCalendarItem disiplin UUID listesini döndürür. event_list discipline_id filtresi etiket üyeliğidir; diğer görünürlük kurallarını değiştirmez.
- Tam bir disiplin etiketinde center_discipline/organization_discipline ancak aynı disiplin ve açık usage_targets:event ile eşleşir. 0 veya birden çok etikette bu iki dar scope kullanılamaz.
- center_all_disciplines/organization_all de event uygunluğu ve merkez/diğer mevcut gate'lere tabidir.
- Kapsam uyumsuzluğu CLASS_ACCESS_DENIED; kullanılabilir hak yetersizliği ENTITLEMENT_UNAVAILABLE. Normal ders için negatif limit veya override etkinliğe uygulanmaz; yeni hata/rol eklenmedi.
- private.event_package_scope_matches scope filtresi, private.require_event_available_credit pozitif kullanılabilir hak kapısıdır. Bu yardımcılar yetkilendirilmiş kayıt RPC'si değildir. Authoritative balance/pool lock/atomik allocation henüz bağlı değil.

## Q-E01 çalışma durumları ve izinler

event_payment_preparations: prepared → registered / capacity_closed / event_cancelled; registered → event_cancelled. Hazırlık yer ayırmaz. Merkez/tenant/kişi/borç/registration FK'leri korunur. Eski hazırlık ikinci kesin kaydı finanse etmez.

event_payment_prepare: event.register; event_payment_get: kişi kendisi veya merkez yöneticisi/açık finance.collect personeli. student_credit_refund ve debt_adjust: finance.refund (CM); student_credit_offset: finance.collect. Tahsilat ve açık mahsup yalnız aynı merkez/kişi/para birimindeki borca uygulanır.

event_register başarı verisi outcome üzerinden ayrılır: registered kesin kayıttır; capacity_closed kesin kayıt değildir, ödenmiş hazırlığın kapanması/borcun ters kaydı/öğrenci alacağı commit edilmiştir. capacity_closed HTTP/domain hata zarfına çevrilmez. Aynı anahtar aynı sonucu tekrarlar. Hazırlıksız normal kapasite hatası halen CAPACITY_FULL; eksik tam ödeme ENTITLEMENT_UNAVAILABLE; yanlış kapsam NOT_FOUND; güncel olmayan önizleme PREVIEW_STALE.

İptal önizlemesi kalan borç kaldırma, yeni öğrenci alacağı, hak serbest bırakma ve hazırlık kapatma etkilerini verir. Tahsilat/indirim/alacak veya hazırlık değiştiyse yeniden önizleme gerekir. Başlamış/kısmen gerçekleşmiş etkinlik iptali POLICY_NOT_CONFIGURED; yeni ürün kararı olmadan oransal hesap yapılmaz.
