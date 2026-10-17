# DS-2026-10-17 sözleşme ve CI devri

Başlangıç main: c231ab5526854ed62445613467649e1b0bf960bb; [aynı SHA CI](https://github.com/SXQHex/FtkSaaS/actions/runs/39010419849) başarılı: 25 migration, 241 test (12 sözleşme + 27 DB + 202 Auth/API). Bu geçmiş kanıt yeni PR'nin kabulü değildir.

Bu PR ürün kararlarını, DTO/izin/guard/okuma-yazma bağımlılıklarını ve denetimleri aktarır. Yeni iş akışı runtime'ı, fiziksel tablo/migration ve frontend eklemez. 184 mevcut işlem korunur; OperationName eksik 10 adı tamamlayıp gerçek kayıt/audit adlarıyla aynı tam _v1 isimlerini kullanır. 13 yeni işlem yalnız sözleşmedir: toplam 197, çağrılabilir 79, yalnız sözleşme 118. İşlem sayısı ürün tamamlanma oranı değildir.

## Karar, aktarım, uygulama ve doğrulama ayrımı

| Katman | Durum |
|---|---|
| Ürün kararı | [DS-2026-10-17 açık kullanıcı kararları](decisions/DS-2026-10-17.md) kabul edilmiş ve önceki çelişen hükümleri değiştirir |
| Teknik aktarım | 01/02/06 yaşayan hükümler, 08 DTO/izin/guard/faz/sürüm/etki metaverisi, üretilmiş 04/05/envanter/ortak tipler |
| Runtime | Önceki 79 endpoint/90 tablo/25 migration. 13 yeni hedef endpoint gateway runtime listesine eklenmez; NOT_FOUND kalır. Yeni DS hedefleri tamamlandı sayılmaz |
| Sözleşme/CI denetimi | Pozitif şema/tutarlılık ve kasıtlı bozmada gerçekten başarısız olan negatif governance testleri |
| Gerçek davranış kabulü | Önceki 202 Auth/API testinin regresyonu korunur; DS kabul kataloğundaki yeni akışlar pending_runtime, statik testten geçti çıkarımı yoktur |
| Son head ve merge | Son PR head incelemesi ve CI ayrıca doğrulanır; bu PR için yeni merge yetkisi varsayılmaz |

## Plan kapıları

features özellik referansıdır; required_features hedef zorunlu kapı; conditional_features yalnız seçilen koşulun kapısıdır. runtime_required_features mevcut migration'ların fiilen kurduğu kapıdır; CI 79 işlem için permission/billing/feature metaverisini migration kaynağındaki son SQL kapı kaydıyla karşılaştırır; bu yapısal eşleme gerçek plan davranışı kabulü değildir. Hedef ile runtime farkları plan_gate_alignment teslimi olarak açıktır.

Starter F14 yoklama kapanışı/hak tüketimi anlaşma gerektirmez ve hakediş üretmez. Pro/Business ücretli görevlendirme/hakediş için açık geçerli anlaşma gerekir. F20 yalnız planın ücretli hakediş yolu seçildiğinde devreye girer. Mevcut seans/program yazma doğrulayıcısının bütün planlarda anlaşma araması henüz uyarlanmadı. Ders attendance_close da halen yalnız sözleşmedir; mevcut etkinlik kapanışı bunun yerine kanıt sayılmaz.

Ürün, rezervasyon, sınıf, öğretmen değişimi, bildirim ve dosya/job işlemlerindeki çoklu özellik referansları da koşullara ayrıldı. Bu hedef eşleme mevcut canlı plan kapılarının değiştiği iddiası değildir.

## Kesin rezervasyon koruması

reservation_impact_preview/apply hedef çifti policy, negative_limit, credit_adjust, entitlement_extend ve sale_scope değişikliklerinin somut etkisini ve mevcut obligation kimliklerini taşır. Özgün değişiklik yetkisi (politikada policy.manage + hiyerarşi, hak/limitte ilgili merkez entitlement.correct) korunur; generic CM yetkisi org politikası yetkisine dönüşmez. Yetkili yönetici bütün etkilenen rezervasyonları açıkça onaylar; apply tam aynı listeyi ve güncel dependency/actor/scope'u doğrular. Aynı hak/ayrılmış açık tekrar kullanılmaz; mevcut açık silinmez, yeni hak yaratılmaz. Koruma katılım, kapanış ve hakediş değerlendirmesinde sürer. Yalnız değişiklik nedeniyle iptal/blocked/bildirim yoktur; yeni işlemler güncel hak/limit/mandatory upper kullanır. Kişisel limit default yerine geçer. Kaynak, uygunluk, belge ve bağımsız diğer engeller aşılmaz.

Mevcut canlı policy_publish istek şeması korunur; yeni hedef onayı Target_policy_publish_protected ile ayrı tutulur. Böylece runtime'ın uygulamadığı bir approval alanını kabul ediyormuş gibi göstermeyiz. policy_publish mevcut haliyle DS etki onayını sağlamaz. negative_limit_set/credit_adjust/entitlement_extend sözleşmeleri impact_approval ister; bunlar zaten contract_only'dir. Freeze, non-financial change ve terminate hedefleri korunan yükümlülükleri sessiz silmez; rezervasyon iptali ayrı açık merkez müdahalesidir.

Açık merkez iptalinde ayrılmış hak/açık serbest bırakılır ve kabul edilmiş iade/düzeltmeler uygulanır. Gerekçeli müdahale uygulama içi bildirilir. Tahsilat kredi üretmez. Hak işlemi geçmiş tüketilmiş açığı, sonra gelecek rezervasyon açığını mevcut kararlı sıra/kapsamla karşılar.

Koruma kaydı, yükümlülük rezervasyonu ve etkilerin sabitlenmesi için yeni fiziksel depolama/migration ve gerçek kapanış tüketicisi ayrı teslimdir. Kanıt eksikliğini bütün seans kapanışını durdurmaya dönüştüren yeni kural eklenmedi.

## Anlaşma zinciri ve paket seçimi

instructor_agreement_publish hedef DTO'su açık valid başlangıcı, reason, supersedes_id ve predecessor expected_version taşır. Yeni zincirde predecessor/version yoktur; değiştirmede ikisi birlikte zorunludur. Aynı scope'ta bağımsız tarih çakışması veya aynı yürürlük anında iki baş kabul edilmez. Eski yayımlanmış satır düzenlenmez; önceki sürümün bitişi zincir çözümünde yeni sınırla kesilir. Başlangıç sınırı dahildir. Başlamış açık seans eski sabitlenmiş koşulunu korur; kapanmış hakediş yeni anlaşmayla yeniden fiyatlandırılmaz. İzinli düzeltme bağlı fark/ters harekettir.

PayTerms paket özel koşulu product_id kimliğine bağlar; product_version/sale kimliğine bağlayıp eski satışları dışarı atmaz. Paket özel bileşen genel aynı bileşenin yerine geçer. Seans sabiti kişi/paket sayısıyla çoğalmaz. Belirsiz/çakışan bileşen seçimi yayımlama öncesi açık koşulla çözülmelidir; otomatik en yüksek/düşük ücret seçimi icat edilmez. Gerçek satış bedeli ve rezervasyonun source-less negative değerlemesi korunur. Süreli/sınırsız için sabit ücret temel tercih olarak sunulur ama tutar açık onaylıdır; değişken bileşen açık seçimdir, kârlılık garantisi yoktur.

instructor_agreements_list hedef okuması zincir/sürümleri sağlar. Immutable predecessor, fiilî başlangıç/başlangıç snapshot'ı ve ücret seçimi depolaması/runtime'ı ayrı bağımlılıktır; olay başlangıç API'sinin varlığı ders başlangıç snapshot'ının üretildiği kanıtı değildir.

## Merkezler arası hesaplaşma — ayrı runtime teslimi

B'nin fiilî eğitmeni B anlaşmasıyla hesaplanır: ilgili ürün kimliğine özel koşul, yoksa B genel koşulu. A anlaşması taşınmaz. Uygun kredili A satışı B'de gerçekleşmiş/tüketilmiş kullanımın gerçek bedel payını A→B oluşturur; eğitmen maliyeti veya tahsilatla eşitlenmez. Tüketen no-show/geç iptal dahil, bırakılan hak hariç. Süreli/sınırsız aktarım üretmez. İlk kaynak paketsiz negatif kapanışta aktarım yoktur; daha sonra uygun A kredili satışla geçmiş B açığı kapanırsa aktarım oluşur, eski eğitmen hakedişi değişmez. Kaynak B ise merkezler arası pay yoktur.

İade/düzeltme önceki kaydın tutarını bağlı ters hareketle geri alır. Ödenmiş tutar silinmez; fazla ödeme B'nin A'ya iade/mahsup bakiyesidir. Mevcut para hassasiyet kuralı (yarım sıfırdan uzağa, en büyük küsurat/kararlı eşitlik; ters kayıtta orijinal tutar) kullanılır. Otomatik para transferi, otomatik netleştirme veya kur dönüşümü yoktur. Kullanım izni her zaman paket kapsamı, Business, merkez erişimi, disiplin ve diğer kapılardan gelir; hesaplaşma yeni kullanım yetkisi vermez.

[Son kabul edilmiş revizyon](decisions/DS-2026-10-17-settlement-revision.md) önceki üç aşamayı kaldırır. Owner, OM'ye CM hesaplaşma grantını yönetme izni verir/kaldırır. Owner doğrudan veya canlı delege OM, belirli merkezde aktif CM'ye açık grant verir/kaldırır. CM devredemez. Rol veya idari grant yönetimi finansal operasyon hakkı doğurmaz.

A'nın açık yetkili CM'si gerçekleşen ödeme / önerilen açık aynı para birimli mahsup / bağlı düzeltme başvurusu açar; bakiye değişmez. Başlatandan farklı açık yetkili B CM onayında başvuru + ödeme/mahsup/bağlı düzeltme kaydı + seçili bakiye etkileri + audit/outbox/receipt tek transaction içinde kesinleşir. Gerekçeli rette bakiye/kayıt değişmez, gerekçe A'ya uygulama içi gider. Ayrı OM kayıt aşaması ve banka transferi yoktur.

settlement_payment_record, settlement_offset_record ve tek taraflı settlement_adjust sözleşmeleri kaldırıldı; gövdeleri SettlementProposal üzerinden submit'e, kesinleştirmeleri decide approve dalına taşındı. Böylece kaldırılan üçüncü aşama veya tek taraflı düzeltme ile B onayı aşılamaz. Düzeltme original_record_id/version ile eski kayda bağlanır; geçmiş ödeme korunur. request_get proposal, request version ve onaylandığında immutable record/version sağlar; hareket okuması açık tutar/sürüm verir. İlgili değişiklik stale yapar, alakasız ders yapmaz. Değişmiş onaylı kapsam yeni bağlı pending başvuru ister; önceki kesinleşmiş pay tekrar kapatılamaz.

Yetki sözleşmeleri: settlement_authority_get, settlement_delegation_set, settlement_authority_set. İdari okuma dar grant projeksiyonu ve org settlement-authority aggregate sürümü verir; set bu sürümü atomik artırır. Owner kendi org'unda, delege OM yönetebildiği CM scope'unda, CM yalnız kendi grant durumunda idari okuma yapar. İdari yetki ledger erişimi değildir. Submit/read/approve/withdraw ve receipt replay canlı CM rolü ve seçili merkez grantını yeniden denetler; yetki kaldırma eski Auth oturumuyla aşılamaz. Delege OM grant yönetiminde kendi canlı devretme iznini yeniden kontrol eder. Genel permission_set Permission enumu settlement.* yetkilerini kabul etmez; yalnız özel yetki komutları bu grantları yönetir. Otomatik cascade grant silme icat edilmez.

Eski OM fallback yeni merkez operasyon zincirinde yetkilenemiyor. fallback input'u kaldırıldı; Owner/OM'ye sessiz operasyon yetkisi yoktur. DS-OPEN-02 yalnız eski istisna yerine alternatif istenirse yeni açık karar gerektiğini kaydeder. Self-approval iki merkez CM'si için de yasaktır.

Yeni settlement tabloları/authority depolaması/ledger/izolasyon/RPC/Edge uygulaması bu PR'nin içinde değildir.

## Satış kapsamı ve geçmiş tarih

Katalog kapsamı yeni satışlar içindir; mevcut satışın kabul edilmiş kapsamı sabittir. Mevcut kapsam değişimi gerekçe/etki önizlemesi ve rezervasyon koruması ister. CM gerekçeyle geçmiş başlangıçlı satış yapabilir; gerçek created_at/aktör ve girilmiş geçerlilik tarihleri ayrı kalır. Geçmiş açığı kapatmak için backdate zorunlu değildir. Geçmiş rezervasyon/katılım/hakediş veya blocked sonucu yeniden yaratılmaz/değiştirilmez. Süreli geçmiş zaman uzamaz ve kota devretmez. Kredili geçmiş B açığı DS aktarım kuralına tabidir.

## Her yönetim yazması için okuma/sürüm yolu

Her operation_contract hedef varlık, faz, version_mode/version_field, read_operation ve atomik etkileri tanımlar. ManagementStateView özgün yazmanın canlı yetkisini/alan scope'unu kullanır; lifecycle state ve entity/aggregate versions ile kapalı, o yazmanın düzenlenebilir alan projeksiyonunu verir. Şifre/bearer/reauth/operation_key alanları projeksiyona alınmaz. Raw core/private tablo okuması değildir.

Bileşik kimlikler (class/person/duty, person/discipline, resource/rule gibi) kapalı operation-bağlı selector ile okunur; selector başka işlem adına taşınamaz. Sonuç sayfalı state/versions/current-projection listesiyle çoklu uygunluk kurallarını da ayırt eder. Var olan doğru okuyucu varsa kullanılır; aksi halde management_state_get hedef sözleşmesine bağlanır. read_path_status implemented/contract_only ayrıdır: yalnız read_operation adının bulunması çalışan okuma yolu kanıtı değildir. Yeni genel management.inspect izni özgün yazmayı yetkilendirmeden veri açamaz.

## Açık ürün/teslim sınırı

DS-OPEN-01 grantor konusu [son karar](decisions/DS-2026-10-17-settlement-revision.md) ile karar düzeyinde kapalıdır; yalnız sözleşme aktarılmıştır. DS-OPEN-02 önceki OM fallback'inin yeni zincirle çeliştiğini gösterir; normal farklı yetkili B CM akışını engellemez, istisna operasyon yetkisi türetilmez.

Diğer açıklar ürün tercihi diye yeniden açılmaz: yeni migration, başlangıç/koruma snapshot üreticisi, anlaşma seçicisi, ledger, ilgili okuma/izolasyon ve gerçek yarış/rollback kabulü teknik teslim bağımlılıklarıdır. [F01–F33 haritası](feature-delivery.md) ve 08 içindeki 34 DS kabul senaryosu bu ayrımı taşır.

## CI ve kanıt

npm run verify artık üretilmiş 04/05/envanter drift'ini, işlem enum/status/audit/izin referanslarını, plan hedefini, faz/sürüm/okuma/atomik etki tutarlılığını ve gerçek migration runtime kapılarını denetler. tests/governance.test.mjs kasıtlı bozmaları doğrulayıcının reddettiğini kanıtlar. Bu testler sözleşme bozulmasını saptar; yeni runtime iş davranışını çalıştırmaz.

Backend workflow iki zorunlu aday job içerir: contract-governance (hızlı verify) ve contracts-and-database (tam npm run test:clean). Tam temiz kabul atlanmaz veya yalnız smoke'a indirilmez. Geliştirmede odaklı verify kullanılır; son PR kapsamı için tam temiz CI çalışır. [Main koruması denetimi](branch-protection-review.md) gerçek erişim sınırını kaydeder.

Kaynak raporu reports/decision-sprint-verification.json, geliştirici sözleşme kontrolleri ile son head CI ve yeni davranış kabulünü ayrı belirtir. Tarihsel raporlar yeniden yazılmaz. Frontend/production/Resend değişikliği yoktur; yeni merge veya yönetim yetkisi varsayılmaz.

## İnceleme düzeltmeleri

center_update hedef sürümü centers.center_id üzerinden okunur; yönetim okuması açık merkez UUID ister. Canlı DTO değişmez; Target_center_update_identified gelecekteki açık hedefi gösterir. CRM faaliyet oluşturma activity_id olmadan, güncelleme activity_id + expected_version ile yapılır; lead_id güncellenecek faaliyet kimliği yerine kullanılamaz. Yönetim okuması bu kimliği ve satır sürümünü döndürür.

Süre değişikliği etki önizlemesinde entitlement_extend / sale_id / end_date ile temsil edilir; sale/entitlement sürümleri ve gerekçe tokena bağlanır. Etki önizlemesi onay veya commit değildir. reservation_impact_apply veya özgün korumalı komut (impact_approval + accepted_reservation_ids) aynı önizlemeyi bir kez tüketen alternatif uygulama yollarıdır; art arda iki yazma yapılmaz. Tam etkilenen liste onayı, tam değişiklik eşleşmesi, ilgili sürümler, özgün yetki ve koruma aynı transaction içinde doğrulanır. Bu hedef sözleşme davranışı henüz runtime değildir.

## Son revizyon kanıtı

Başlangıç PR head c1a479c72e98c5a53d949a1eb7e30e1abc6679a3 ve CI 39023254173 yalnız önceki kapsamın kanıtıdır. Son yetki/iki taraflı kesinleştirme revizyonu için yeni kaynak raporu reports/settlement-revision-verification.json; son SHA bağımsız incelemesi ve tek tam temiz CI kanıtı PR #13 konuşmasına ayrıca bağlanır. Tarihsel raporlar değiştirilmez.

Kısmi bağlı düzeltme original_record_id/version yanında özgün allocation_id/version/tutar seçimlerini taşır. request_get finalized record içinde allocation kimliği, hareketi, payment/debit/credit tarafı, özgün tutarı ve güncel unreversed_minor/sürümü gösterir. Ödeme düzeltmesinde seçili toplam; mahsup terslemesinde iki özgün karşı tarafın her toplamı amount_minor ile eşit olmalıdır. Özgün kayıt üyeliği, tekrar etmeyen seçim ve kalan terslenebilir tutar commit içinde doğrulanır; dağıtım varsayılmaz ve eski ödeme geçmişi değişmez.
