> 23 Ekim 2026 güncel durum: P01–P07 kod/main/geliştirme-test kabulü kapandı; yayımlanmış kapsam **200 API / 0 contract_only / 59 migration / 90 core tablo / Edge8**. P07 runtime kaynağı `4cfc9a55`; güncel belge tabanı `bfb8ccb2`. Beş Cron hattı aktif ve boş kuyrukta healthy/idle; fiziksel imha ve gerçek yük kabulü tamamlanmış değildir. Ayar davranış sprinti ve güncel entegrasyon sınırları [tek devir](../contracts/00-FtkSaaS-yeni-sohbet-devir.md) ve [ayarlar sözleşmesinde](../contracts/02-FtkSaaS-teknik-sozlesme.md#ayarlar-sozlesmesi-ve-davranis-sprinti). Eski tarih/CI/pending snapshotları yeni durum kanıtı değildir; ürün kuralları yalnız son açık kararla değişir.

25 Ekim güncel ürün hedefi: [tek oda/seans/kategori kapasitesi ve ayrı kontrollü aşım](../contracts/02-FtkSaaS-teknik-sozlesme.md#oda-seans-kapasite-karari). Yayımlanmış main200/59 DTO'ları ile PR45 adayı201/60 ayrıdır. PR45 bağımsız inceleme ve aday40164825351 başarılı; merge/main/CD bekler. Bu modülün eski test/alan adları kendi tarihsel runtime kaydını anlatır, yeni ürün kuralı değildir.

# DS-2026-10-17 sözleşme ve CI devri

Güncel uygulama SHA/CI ve teslim kanıtı: [doğrulanmış devir](../contracts/00-FtkSaaS-yeni-sohbet-devir.md). Aşağıdaki başlangıç SHA’sı tarihsel referanstır; güncel kabul yerine geçmez.

Başlangıç main: c231ab5526854ed62445613467649e1b0bf960bb; [aynı SHA CI](https://github.com/SXQHex/FtkSaaS/actions/runs/39010419849) başarılı: 25 migration, 241 test (12 sözleşme + 27 DB + 202 Auth/API). Bu geçmiş kanıt yeni PR'nin kabulü değildir.

Kabul edilmiş karar/DTO/izin/guard aktarımı korunur. Starter ve anlaşma/hakediş teslimlerinden sonra üçüncü teslim hesaplaşma runtime’ını ve 29. migration’ı ekler; frontend değişmez. 184 başlangıç işlemine net 15 yeni sözleşme adı eklenmiştir: o teslim snapshot’ında 199 toplam, 104 canlı, 95 yalnız sözleşme; 29 migration. 23 Ekim yayımlanmış main kapsamı 200/200/0 ve 59 migration’dır; bu bölümün 104/95 dağılımı ilk DS aktarımının tarihsel ölçümüdür. Anlaşma/hakediş ve açık fiilî başlangıç dar yolu güncel devirde tanımlıdır. Ayrıntı ve açık tüketiciler Starter devrindedir. İşlem sayısı ürün tamamlanma oranı değildir.

## Karar, aktarım, uygulama ve doğrulama ayrımı

| Katman | Durum |
|---|---|
| Ürün kararı | [DS-2026-10-17 açık kullanıcı kararları](decisions/DS-2026-10-17.md) kabul edilmiş ve önceki çelişen hükümleri değiştirir |
| Teknik aktarım | 01/02/06 yaşayan hükümler, 08 DTO/izin/guard/faz/sürüm/etki metaverisi, üretilmiş 04/05/envanter/ortak tipler |
| Runtime | P07 sonrası 200 çağrılabilir işlem/90 core tablo/59 migration. P02 hak koruma ve P05 belge tüketicileri dahil uygulanmıştır; ürün/işletim kabul açıkları kalan işlerde ayrılır |
| Sözleşme/CI denetimi | Pozitif şema/tutarlılık ve kasıtlı bozmada gerçekten başarısız olan negatif governance testleri |
| Gerçek davranış kabulü | 394 testlik kaynak kabulünde 272 Auth/API testi başarılıdır. DS-PLAN-01, DS-PLAN-02 ve DS-AGR-01–05 ile 22 hesaplaşma kabul maddesi gerçek testlere bağlıdır; o raporda diğer 9 madde pending_runtime idi. Bu tarihsel metadata güncel callable açık listesi değildir; son durum endpoint envanteri ve kalan işlerden okunur. Kaynak SHA/CI kanıtı hesaplaşma devrindedir; yapısal testten davranış kabulü çıkarılmaz |
| Son head ve merge | Son PR head incelemesi ve CI ayrıca doğrulanır; koşullu merge yetkisi son kullanıcı talimatından okunur |

## Plan kapıları

features özellik referansıdır; required_features hedef zorunlu kapı; conditional_features yalnız seçilen koşulun kapısıdır. runtime_required_features mevcut migration'ların fiilen kurduğu kapıdır; hesaplaşma tesliminin tarihsel CI’ı 104 işlem için permission/billing/feature metaverisini migration kaynağındaki son SQL kapı kaydıyla karşılaştırır; bu yapısal eşleme gerçek plan davranışı kabulü değildir. İlk aktarımda hedef/runtime farkları plan_gate_alignment teslimi olarak ayrılmıştı; güncel 200 runtime kapısı verify ile denetlenir. Eski hedef matrisi yeni açık teslim listesi değildir.

Starter F14 yoklama kapanışı/hak tüketimi anlaşma gerektirmez ve hakediş üretmez. Pro/Business ücretli görevlendirme/hakediş için açık geçerli anlaşma gerekir. F20 yalnız planın ücretli hakediş yolu seçildiğinde devreye girer. Starter seans/program doğrulayıcısı anlaşma gerektirmez; ders attendance_close Starter’da canlıdır ve gerçek API kabulüne bağlıdır. Ücretli kapanış explicit gerçekleşme/görev beyanı, immutable anlaşma ve donmuş değerlemeyle ders motorunda çalışır; etkinlik kapanışı bunun yerine kanıt sayılmaz. Ayrıntı: instructor-earnings-handover.md.

Ürün, rezervasyon, sınıf, öğretmen değişimi, bildirim ve dosya/job işlemlerindeki çoklu özellik referansları da koşullara ayrıldı. Bu hedef eşleme mevcut canlı plan kapılarının değiştiği iddiası değildir.

## Kesin rezervasyon koruması

reservation_impact_preview/apply hedef çifti policy, negative_limit, credit_adjust, entitlement_extend ve sale_scope değişikliklerinin somut etkisini ve mevcut obligation kimliklerini taşır. Özgün değişiklik yetkisi (politikada policy.manage + hiyerarşi, hak/limitte ilgili merkez entitlement.correct) korunur; generic CM yetkisi org politikası yetkisine dönüşmez. Yetkili yönetici bütün etkilenen rezervasyonları açıkça onaylar; apply tam aynı listeyi ve güncel dependency/actor/scope'u doğrular. Aynı hak/ayrılmış açık tekrar kullanılmaz; mevcut açık silinmez, yeni hak yaratılmaz. Koruma katılım, kapanış ve hakediş değerlendirmesinde sürer. Yalnız değişiklik nedeniyle iptal/blocked/bildirim yoktur; yeni işlemler güncel hak/limit/mandatory upper kullanır. Kişisel limit default yerine geçer. Kaynak, uygunluk, belge ve bağımsız diğer engeller aşılmaz.

policy_publish ve negative_limit_set, mevcut kesin rezervasyonlar için gerçek etki/onay akışını uygular. credit_adjust/entitlement_extend ve diğer hak değişikliği tüketicileri P02 ile runtime oldu; koruma preview/approval ve özgün komut atomikliği korunur. Freeze, non-financial change ve terminate hedefleri korunan yükümlülükleri sessiz silmez; rezervasyon iptali ayrı açık merkez müdahalesidir.

Açık merkez iptalinde ayrılmış hak/açık serbest bırakılır ve kabul edilmiş iade/düzeltmeler uygulanır. Gerekçeli müdahale uygulama içi bildirilir. Tahsilat kredi üretmez. Hak işlemi geçmiş tüketilmiş açığı, sonra gelecek rezervasyon açığını mevcut kararlı sıra/kapsamla karşılar.

Koruma kaydı, yükümlülük rezervasyonu ve kapanış tüketicisi PR #14 ile uygulanmıştır; diğer hak değişikliği tüketicileri P02, belge tüketicileri P05 ile ayrıca kabul edildi. Kanıt eksikliğini bütün seans kapanışını durdurmaya dönüştüren yeni kural eklenmedi.

## Anlaşma zinciri ve paket seçimi

instructor_agreement_publish hedef DTO'su açık valid başlangıcı, reason, supersedes_id ve predecessor expected_version taşır. Yeni zincirde predecessor/version yoktur; değiştirmede ikisi birlikte zorunludur. Aynı scope'ta bağımsız tarih çakışması veya aynı yürürlük anında iki baş kabul edilmez. Eski yayımlanmış satır düzenlenmez; önceki sürümün bitişi zincir çözümünde yeni sınırla kesilir. Başlangıç sınırı dahildir. Başlamış açık seans eski sabitlenmiş koşulunu korur; kapanmış hakediş yeni anlaşmayla yeniden fiyatlandırılmaz. İzinli düzeltme bağlı fark/ters harekettir.

PayTerms paket özel koşulu product_id kimliğine bağlar; product_version/sale kimliğine bağlayıp eski satışları dışarı atmaz. Paket özel bileşen genel aynı bileşenin yerine geçer. Seans sabiti kişi/paket sayısıyla çoğalmaz. Belirsiz/çakışan bileşen seçimi yayımlama öncesi açık koşulla çözülmelidir; otomatik en yüksek/düşük ücret seçimi icat edilmez. Gerçek satış bedeli ve rezervasyonun source-less negative değerlemesi korunur. Süreli/sınırsız için sabit ücret temel tercih olarak sunulur ama tutar açık onaylıdır; değişken bileşen açık seçimdir, kârlılık garantisi yoktur.

instructor_agreements_list zincir/sürümleri okur. Immutable predecessor, attendance_start_v1 açık fiilî başlangıç kimlik snapshot'ı, ücret seçimi ve bağlı kapanış/düzeltme uygulanmıştır. Otomatik gözlem tüketicisi yoktur; olay başlangıç API'si ders yerine kullanılmaz.

## Merkezler arası hesaplaşma — üçüncü teslim runtime aktarımı

B'nin fiilî eğitmeni B anlaşmasıyla hesaplanır: ilgili ürün kimliğine özel koşul, yoksa B genel koşulu. A anlaşması taşınmaz. Uygun kredili A satışı B'de gerçekleşmiş/tüketilmiş kullanımın gerçek bedel payını A→B oluşturur; eğitmen maliyeti veya tahsilatla eşitlenmez. Tüketen no-show/geç iptal dahil, bırakılan hak hariç. Süreli/sınırsız aktarım üretmez. İlk kaynak paketsiz negatif kapanışta aktarım yoktur; daha sonra uygun A kredili satışla geçmiş B açığı kapanırsa aktarım oluşur, eski eğitmen hakedişi değişmez. Kaynak B ise merkezler arası pay yoktur.

İade/düzeltme önceki kaydın tutarını bağlı ters hareketle geri alır. Ödenmiş tutar silinmez; fazla ödeme B'nin A'ya iade/mahsup bakiyesidir. Mevcut para hassasiyet kuralı (yarım sıfırdan uzağa, en büyük küsurat/kararlı eşitlik; ters kayıtta orijinal tutar) kullanılır. Otomatik para transferi, otomatik netleştirme veya kur dönüşümü yoktur. Kullanım izni her zaman paket kapsamı, Business, merkez erişimi, disiplin ve diğer kapılardan gelir; hesaplaşma yeni kullanım yetkisi vermez.

[Son merkez bazlı yetki düzeltmesi](decisions/DS-2026-10-17-settlement-center-scope.md) önceki üç aşamayı kaldırır. Owner, OM'ye CM hesaplaşma grantını yönetme izni verir/kaldırır. Owner doğrudan veya canlı delege OM, belirli merkezde aktif CM'ye açık grant verir/kaldırır. CM devredemez. Rol veya idari grant yönetimi finansal operasyon hakkı doğurmaz.

A'nın açık yetkili CM'si gerçekleşen ödeme / önerilen açık aynı para birimli mahsup / bağlı düzeltme başvurusu açar; bakiye değişmez. B merkezinde bağımsız doğrulanmış aktif CM rolü ve açık grantı olan kişi (aynı hesap olabilir) onayında başvuru + ödeme/mahsup/bağlı düzeltme kaydı + seçili bakiye etkileri + audit/outbox/receipt tek transaction içinde kesinleşir. Gerekçeli rette bakiye/kayıt değişmez, gerekçe A'ya uygulama içi gider. Ayrı OM kayıt aşaması ve banka transferi yoktur.

settlement_payment_record, settlement_offset_record ve tek taraflı settlement_adjust sözleşmeleri kaldırıldı; gövdeleri SettlementProposal üzerinden submit'e, kesinleştirmeleri decide approve dalına taşındı. Böylece kaldırılan üçüncü aşama veya tek taraflı düzeltme ile B onayı aşılamaz. Düzeltme original_record_id/version ile eski kayda bağlanır; geçmiş ödeme korunur. request_get proposal, request version ve onaylandığında immutable record/version sağlar; hareket okuması açık tutar/sürüm verir. İlgili değişiklik stale yapar, alakasız ders yapmaz. Değişmiş onaylı kapsam yeni bağlı pending başvuru ister; önceki kesinleşmiş pay tekrar kapatılamaz.

Yetki sözleşmeleri: settlement_authority_get, settlement_delegation_set, settlement_authority_set. İdari okuma dar grant projeksiyonu ve org settlement-authority aggregate sürümü verir; set bu sürümü atomik artırır. Owner kendi org'unda, delege OM yönetebildiği CM scope'unda, CM yalnız kendi grant durumunda idari okuma yapar. İdari yetki ledger erişimi değildir. Submit/read/approve/withdraw ve receipt replay canlı CM rolü ve seçili merkez grantını yeniden denetler; yetki kaldırma eski Auth oturumuyla aşılamaz. Delege OM grant yönetiminde kendi canlı devretme iznini yeniden kontrol eder. Genel permission_set Permission enumu settlement.* yetkilerini kabul etmez; yalnız özel yetki komutları bu grantları yönetir. Otomatik cascade grant silme icat edilmez.

DS-OPEN-02 son kullanıcı düzeltmesiyle karar düzeyinde kapalıdır. Farklı kişi/hesap veya self-approval yasağı yoktur: aynı hesap A ve B'de gerekli güncel yetkilere sahipse A kapsamıyla başvuru açıp B kapsamıyla onaylayabilir. A-only yetki B'ye taşınmaz. B, istemci center seçimi yerine dondurulmuş başvurunun to_center_id alanından çözülür. Fallback input'u/yolu yoktur; Owner/OM'ye sessiz operasyon yetkisi doğmaz.

Üçüncü teslim özel hesaplaşma tablolarını, yetki depolamasını, ledger ve dokuz RPC/Edge işlemini uygular. Güncel kaynak ve kabul kanıtı [hesaplaşma devrindedir](settlement-handover.md).

## Satış kapsamı ve geçmiş tarih

Katalog kapsamı yeni satışlar içindir; mevcut satışın kabul edilmiş kapsamı sabittir. Mevcut kapsam değişimi gerekçe/etki önizlemesi ve rezervasyon koruması ister. CM gerekçeyle geçmiş başlangıçlı satış yapabilir; gerçek created_at/aktör ve girilmiş geçerlilik tarihleri ayrı kalır. Geçmiş açığı kapatmak için backdate zorunlu değildir. Geçmiş rezervasyon/katılım/hakediş veya blocked sonucu yeniden yaratılmaz/değiştirilmez. Süreli geçmiş zaman uzamaz ve kota devretmez. Kredili geçmiş B açığı DS aktarım kuralına tabidir.

## Her yönetim yazması için okuma/sürüm yolu

Her operation_contract hedef varlık, faz, version_mode/version_field, read_operation ve atomik etkileri tanımlar. ManagementStateView özgün yazmanın canlı yetkisini/alan scope'unu kullanır; lifecycle state ve entity/aggregate versions ile kapalı, o yazmanın düzenlenebilir alan projeksiyonunu verir. Şifre/bearer/reauth/operation_key alanları projeksiyona alınmaz. Raw core/private tablo okuması değildir.

Bileşik kimlikler (class/person/duty, person/discipline, resource/rule gibi) kapalı operation-bağlı selector ile okunur; selector başka işlem adına taşınamaz. Sonuç sayfalı state/versions/current-projection listesiyle çoklu uygunluk kurallarını da ayırt eder. Var olan doğru okuyucu varsa kullanılır; aksi halde management_state_get hedef sözleşmesine bağlanır. read_path_status implemented/contract_only ayrıdır: yalnız read_operation adının bulunması çalışan okuma yolu kanıtı değildir. Yeni genel management.inspect izni özgün yazmayı yetkilendirmeden veri açamaz.

## Açık ürün/teslim sınırı

DS-OPEN-01 grantor konusu [son karar](decisions/DS-2026-10-17-settlement-revision.md) ile karar düzeyinde kapalıdır; grant yönetimi ve finansal adım yetkisi üçüncü teslimde uygulanmıştır. DS-OPEN-02 [son merkez yetki kararı](decisions/DS-2026-10-17-settlement-center-scope.md) ile karar düzeyinde kapalıdır: aynı hesap iki merkezde de açık canlı yetkiliyse iki adımı yapabilir; ayrı istisna/fallback yoktur.

Otomatik başlangıç gözlemi ürün davranışı uydurularak kapatılmaz; mevcut açık attendance_start kaydı korunur. Diğer hak değişikliği koruma tüketicileri P02 ile tamamlanmıştır. Hesaplaşma ledger’ı ve ilgili okuma/izolasyon/yarış/rollback kapsamı üçüncü teslimdedir; kabul kanıtı güncel hesaplaşma devrinden okunur. Açık başlangıç kaydı, anlaşma seçicisi ve ücretli kapanış PR #15 ile uygulanmıştır. [F01–F33 haritası](feature-delivery.md) ve 08 içindeki 38 DS kabul senaryosu bu ayrımı taşır.

## CI ve kanıt

npm run verify artık üretilmiş 04/05/envanter drift'ini, işlem enum/status/audit/izin referanslarını, plan hedefini, faz/sürüm/okuma/atomik etki tutarlılığını ve gerçek migration runtime kapılarını denetler. tests/governance.test.mjs kasıtlı bozmaları doğrulayıcının reddettiğini kanıtlar. Bu testler sözleşme bozulmasını saptar; yeni runtime iş davranışını çalıştırmaz.

[Yeni CI politikası](ci-policy.md) otomatik push/PR mükerrer clean yerine hedefli geliştirme ve açık son aday full clean kullanır. Merge kapısı head/base/tested merge ağacını doğrular; runtime/CI merge’lerinde main full clean korunur. Yeni yalnız-belge kabulü ve dört shard/Draft-development geçişi [CI-2026-10-20](decisions/CI-2026-10-20.md) kararında kabul edilmiş, uygulaması CI-02 PR25/26 ile kurulmuş ve kabul edilmiştir. [Main koruması denetimi](branch-protection-review.md) gerçek erişim sınırını kaydeder.

Kaynak raporu reports/decision-sprint-verification.json, geliştirici sözleşme kontrolleri ile son head CI ve yeni davranış kabulünü ayrı belirtir. Tarihsel raporlar yeniden yazılmaz. Frontend/production/Resend değişikliği yoktur; repository yönetim yetkisi varsayılmaz.

## İnceleme düzeltmeleri

center_update hedef sürümü centers.center_id üzerinden okunur; yönetim okuması açık merkez UUID ister. Canlı DTO değişmez; Target_center_update_identified gelecekteki açık hedefi gösterir. CRM faaliyet oluşturma activity_id olmadan, güncelleme activity_id + expected_version ile yapılır; lead_id güncellenecek faaliyet kimliği yerine kullanılamaz. Yönetim okuması bu kimliği ve satır sürümünü döndürür.

Süre değişikliği etki önizlemesinde entitlement_extend / sale_id / end_date ile temsil edilir; sale/entitlement sürümleri ve gerekçe tokena bağlanır. Etki önizlemesi onay veya commit değildir. reservation_impact_apply veya özgün korumalı komut (impact_approval + accepted_reservation_ids) aynı önizlemeyi bir kez tüketen alternatif uygulama yollarıdır; art arda iki yazma yapılmaz. Tam etkilenen liste onayı, tam değişiklik eşleşmesi, ilgili sürümler, özgün yetki ve koruma aynı transaction içinde doğrulanır. Politika/kişisel limit türleri PR #14, entitlement_extend ve diğer hak değişikliği türleri P02 ile runtime’dır.

## Son revizyon kanıtı

Başlangıç PR head c1a479c72e98c5a53d949a1eb7e30e1abc6679a3 ve CI 39023254173 yalnız önceki kapsamın kanıtıdır. Son yetki/iki taraflı kesinleştirme revizyonu için yeni kaynak raporu reports/settlement-revision-verification.json; son SHA bağımsız incelemesi ve tek tam temiz CI kanıtı PR #13 konuşmasına ayrıca bağlanır. Tarihsel raporlar değiştirilmez.

Kısmi bağlı düzeltme original_record_id/version yanında özgün allocation_id/version/tutar seçimlerini taşır. request_get finalized record içinde allocation kimliği, hareketi, payment/debit/credit tarafı, özgün tutarı ve güncel unreversed_minor/sürümü gösterir. Ödeme düzeltmesinde seçili toplam; mahsup terslemesinde iki özgün karşı tarafın her toplamı amount_minor ile eşit olmalıdır. Özgün kayıt üyeliği, tekrar etmeyen seçim ve kalan terslenebilir tutar commit içinde doğrulanır; dağıtım varsayılmaz ve eski ödeme geçmişi değişmez.

## Merkez adımı yetkisi ve audit

Son karar: docs/decisions/DS-2026-10-17-settlement-center-scope.md. Submit actor/org/from_center_id, decide actor/stored_request.org_id/stored_request.to_center_id kapsamını bağımsız doğrular. Aynı hesap eşitliği ret nedeni değildir ve B kontrolünü atlatmaz. Yetki rol/grantları eski Auth oturumu, pending request veya receipt ile korunmaz; commit/replay öncesi canlı denetim ve ilgili yarış kilitleri gerekir. Audit ve request read, initiator_authority/decision_authority içinde doğrulanmış account/org/center/permission, CM rol kimlik/sürümü, grant sürümü ve checked_at bilgisini taşır; istemci snapshot sağlayamaz. Yeni rapor reports/settlement-center-scope-verification.json; tarihsel raporlar önceki SHA kurallarını korur.

## Starter runtime aktarımı

[Starter devri](starter-attendance-protection-handover.md) 10 yeni canlı işlem/dar okuma, zorunlu koşullu plan kapıları, gerçek kapanış/düzeltme ve açık başlangıç/belge/diğer hak tüketicilerini gösterir. Ücretli hakediş PR #15 ile ayrıca uygulanmıştır; hesaplaşma üçüncü teslimin ayrı ledger ve yetki akışındadır.

[Hesaplaşma runtime devri](settlement-handover.md) uygulanmış tüketicileri ve gerçek kabul kapsamını belirtir. Önceki pending ifadeleri tarihsel sözleşme aktarım sınırlarıdır; kalan işler yaşayan listeden okunur.

