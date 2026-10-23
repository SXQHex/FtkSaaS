> **23 Ekim kaynak sınırı:** Yayımlanmış toplam 200 API / 0 contract_only / 59 migration. Aşağıdaki eski sayılar ilgili modülün ilk teslim kaydıdır. Son kaynak ve kabul [güncel devirde](../contracts/00-FtkSaaS-yeni-sohbet-devir.md); gerçek açıklar [kalan işlerde](remaining-work.md) izlenir.

> Sonraki Starter uyarlaması: [Starter devri](starter-attendance-protection-handover.md). Aşağıdaki 79/105 ve tüm-plan anlaşma sınırı kendi önceki kaynak snapshot’ıdır.

> DS-2026-10-17 kabulü plan/anlaşma ve korunan rezervasyon hedefini değiştirir. Bu dosya önceki runtime kapsamını anlatır; yeni hedef ve açık farklar [sprint devrinde](decision-sprint-handover.md).

# Program ve gelecek seans değişiklikleri

Bu teslim yalnız `program_preview_v1`, `program_apply_v1`, `session_change_preview_v1`, `session_change_apply_v1`, `session_capacity_set_v1`, `session_assignment_set_v1`, `class_assignment_set_v1` işlemlerini çağrılabilir yapar. Toplam 79/105; 25 append-only migration. Kaynak main `69257f056f593b4b52248e7c9070dada7918344d` üzerinden ayrı dal. Önceki main CI yeni dal kabulü değildir; son head'in Backend CI'ı `npm run test:clean` çalıştırır.

## Tamamlanan akış

Yetkili merkez yöneticisi sınıf için sonlu programı önizler; somut UTC seansları, çözümlenmiş görevler/anlaşmalar, kaynaklar, kapasite ve engelleri alır. Önizleme yalnız teknik preview kaydı üretir; program/seans/rezervasyon/hak/borç/hakediş/audit/outbox yazmaz. `program_apply_v1` aynı aktörün süreli ID+token'ını tüketir. Canlı yetki, bağımlılıklar, uygunluk, kaynaklar ve haklar yeniden denetlenir; program sürümü ve tüm oluşumlar tek transaction'da yazılır. Mevcut `calendar_get_v1`, `session_get_v1`, `reservation_list_v1` sonucu gösterir. Öğrenci yalnız kendi kayıtlarını, giriş rolü hâlen etkin eğitmen/asistan yalnız görevli olduğu programı okur; merkez yöneticisi yalnız atanmış merkezi yönetir. Owner olmak merkez operasyon yetkisi sağlamaz.

Seans önizleme/uygulama aynı seans kimliğini koruyarak saat/kaynak/görev/kapasite değiştirir. `single` tek oluşumdur. `this_and_future` aynı `program_id` içindeki seçili ve sonraki materialize edilmiş, gelecekteki planned/open oluşumlardır; farklı program ve geçmiş/sonuçlanmış oluşumlar korunur. Programı olmayan tekil seans için seri kapsamı `POLICY_NOT_CONFIGURED` döner. Başlangıç merkez yerel saatindeki fark kadar ötelenir; süre açık interval'dan alınır. Sonlu immutable `program_versions.spec_snapshot/timezone` ilk üretimi kaydeder; sonradan oluşum değişiklikleri audit'te izlenir. Otomatik sonsuz program üretimi veya yeni program sürümleme akışı yoktur.

## İstemci çağrı sırası ve sürümler

Transport mevcut `POST /functions/v1/backend-v1/{operation}` ve typed JSON istek/zarfıdır; `org_id`, seçili `center_id`, her denemede `request_id` ve mutasyonlarda sabit `operation_key` kullanılır. Frontend service-role RPC'ye doğrudan çağrı yapmaz.

| Adım | İstek / sonuç |
|---|---|
| Program önizle | `class_id + schedule`; `sessions[]` somut UTC interval, görev, kaynak, kapasite; `blockers[]` boş olmadan uygulama yapılmaz |
| Program uygula | Yalnız aynı preview `{id,token}`; Mutation.primary_id program sürümü, related[] oluşan seans kimlikleri |
| Oku | calendar interval/page; session_get session_id; reservation_list session_id/page; görünürlük her istekte canlı |
| Seans önizle/uygula | `session_id + patch + scope + reason`, gerekirse offset_choices; apply yalnız preview token; Mutation.primary_id seçili seans, version onun yeni sürümü, related[] bütün etkilenen seanslar |
| Kapasite/görev | session_get.version ile expected_version; görevde person_id/duty, gerekirse agreement_id/state; Mutation seans kimliği/sürümü |
| Sınıf görevi | class_id/person_id/duty; create expected_version içermez; update class_assignments içindeki hedef satır version'ını kullanır; Mutation atama satırı kimliği/sürümü |

Preview token yalnız onu alan aktöre aittir. Stale sonucunda yeni preview alınır; başarısızlığı gizlemek için farklı sale veya tarih seçilmez. Sınıf görevi kaldırma/tekrar etkinleştirmesi açık seans kaldırma override'ını geri getirmez; legacy yalnız-sınıf görevinin doğrudan kaldırılması da kalıcı inactive override bırakır.

## Sözleşme aktarımı ve zorunlu bağımlılıklar

- `ProgramSpec` merkez yerel tarihleri `[starts_on,ends_on)` ve ISO 1–7 günleri kullanır. `LocalOffsetChoice {date,offset_minutes}` DTO'su DST çift saatini açık seçmek için eklendi. Geçersiz yerel saat reddedilir; çift saatte sessiz erken/geç seçim yoktur. UTC interval açık anı belirler; sağlanan offset onunla da uyuşmalıdır. Takip eden oluşumların çift saatleri ayrıca açık seçim ister.
- Sınıf varsayılanları oluşturma sırasında görevlere çözülür. `inherit_class_assignments` varsayılan true; false tam açık oluşum atamasıdır. Açık kişi/görev çifti aynı varsayılanı ezer. `session_assignment_set_v1` tek çiftin açık override'ını yazar; inactive açık kaldırmadır. `SessionPatch.assignments` tüm oluşum atamalarının yerini alır. Sınıf değişikliği yalnız varsayılanı miras alan gelecekteki açık seanslara uygulanır; açık oluşum/key override'ını geri getirmez. Geçmiş legacy satırlar eski okuma fallback'ini korur, yönetilen satırlar fiziksel görevi esas alır. Offline görev login rolü yaratmaz.
- `session_capacity_set_v1` ve `session_assignment_set_v1.expected_version` seans sürümüdür. `class_assignment_set_v1` create sürümsüz, update mevcut class_assignment satır sürümünü ister; sınıf sürümü değildir. Mutation primary ID/sürümü o atama satırınındır. İlgili CM önizleme ve seans okuması `class_assignments`/sürümleri ve `class_version` taşır; öğrenci/eğitmen yanıtına bu idari alanlar eklenmez.
- Sonraki DS/Starter ve anlaşma teslimleri eski tüm-plan anlaşma bağımlılığını değiştirmiştir: Starter ders/program ve hak tüketimi anlaşma gerektirmez, hakediş üretmez. Pro/Business ücretli görevlendirmede açık geçerli anlaşma gerekir; instructor_agreement_publish_v1 ve immutable zincir okuması çağrılabilir. Ücretli yoklama kapanışı/hakediş uygulaması [anlaşma devrinde](instructor-earnings-handover.md), Starter ayrımı [Starter devrinde](starter-attendance-protection-handover.md) izlenir. Eski sentetik fixture ilk teslimin kanıtıdır; güncel üretim yapılandırması yerine geçmez.
- Eski `session_create_v1` aynı görev/anlaşma/uygunluk/kaynak doğrulayıcısını kullanır. Aksi hâlde yeni programla çakışan tekil seans komutundan kontrol aşılabilirdi. Bu endpoint yeni kapsam sayısına eklenmez.
- `products_list_v1` ve uygun satın alınmış paket seçimi bu PR'de uygulanmaz. Mevcut rezervasyonun sabit sale/allocation/policy kimliği korunur; kaynak satış değiştirilmez veya alternatif hak seçilmez. Mevcut süreli hakkın kota dönemleri yeni seans zamanlarıyla topluca doğrulanır ve eski/yeni bucket sayıları transaction içinde güncellenir.

## Atomiklik, koruma ve erişim

Önizleme aktör/organizasyon/merkez/işlem ve token'a bağlıdır; 15 dakika teknik geçerlilik vardır. Config, kaynak, görev, rezervasyon/hak, plan veya canlı erişim bağımlılığı değişirse muhafazakâr org kapsamlı parmak izi `PREVIEW_STALE` verir; yeniden önizlenir. Alakasız aynı-org değişiklikleri de stale yapabilir. Bu bir ürün limiti değildir. Büyük finite batch'lerde gateway'in mevcut sınırlı UUID bankası dolarsa transaction geri alınır ve bankası büyütülerek sınırlı retry yapılır; sınırsız batch/yük kabulü iddiası yoktur.

Organizasyon transaction kilidi komutlarla yetki geri almayı sıralar. Receipt replay'den önce canlı Auth/session/bağ/rol/plan denetlenir. Aynı anahtar aynı payload önceki başarıyı replay eder; farklı payload reddedilir. Aynı preview farklı anahtarla iki kez uygulanmaz. Seans sürüm yarışı tek kazanan üretir. Kaynak çakışmaları org içindeki merkezler arasında da kontrol edilir; [start,end) bitişe komşu seans serbesttir. Mevcut eski duty satırları da çakışma hesabına katılır.

Kapasite indirimi mevcut rezervasyonları veya süresi dolmamış yer tekliflerini iptal etmez; yeni kayıt mevcut ortak kapasite hesabına tabidir. Kapasite-only işlem ilgisiz eski anlaşma/uygunluk değişikliğini düzeltme zorunluluğu yaratmaz. Saat/kaynak/görev değişikliğinde mevcut rezervasyonun satış geçerliliği, kapsamı, dondurma ve ortak kotası yeniden kontrol edilir; uygun değilse tüm değişiklik reddedilir. Önizleme veya komut yeni satın alma/hak/borç/hakediş üretmez. Audit/outbox hatası dahil tek bir geç hata bütün batch'i, preview tüketimini, receipt ve görev/sürüm değişikliklerini geri alır.

## Kabul ve açık sınırlar

Odaklı geliştirme testleri `tests/program-session-lifecycle.test.mjs` ve etkilenen eski tüketici testleridir; gerçek Supabase Auth → Edge → service-only RPC yolunu kullanır. Son kapsam tam temiz CI'ında sözleşme, DB, tüm API testleri, 25 migration reset, seed, health ve advisors birlikte çalışır. Son geliştirici kaynak ağacında 12 sözleşme ve 20 program Auth/API testi geçti; önceki kaynakta 68 etkilenen API testi geçti. Bağımsız statik incelemede bulunan legacy sınıf-only görev kaldırma P2'si düzeltildi ve yeniden inceleme bulgusuz tamamlandı. Kaynak ve kanıt ayrımı [raporda](../reports/program-session-verification.json) belirtilir. Başarısızlık veya kaynak değişikliği dışında aynı kabul geliştirici tarafından gereksiz tekrarlanmaz.

İlk program PR’sinin dışında kalan ders yoklaması/anlaşma yayını ve P01 bekleme/teklif/uygun hak seçimi sonraki teslimlerde uygulanmıştır. Seans iptali ve yerine seans komutları P02 ile uygulanıp kabul edildi; ilk program PR’sinin kapsamına geriye dönük eklenmez. Yeni program planlanan seans yaratır; gerçekleşme/hakediş yaratmaz. Birden fazla uygunluk kuralını birleştirerek gece/gün aşan uygunluk hâlen ayrı sınırdır. Sonraki P07 CD/hosted kabulü güncel devirde kapandı; bu ilk PR raporu onun kanıtı değildir. Frontend gerçek entegrasyonu ve yük/restore açık kalır. Frontend, production ve Resend değişikliği yoktur.

