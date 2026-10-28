# Güncel kaynak ve kabul

Bu dosya güncel backend kabulünün tek kaynağıdır. Ürün davranışı 01/02 ve kabul kararlarında; açık iş docs/remaining-work.md içindedir. Tarihsel aday notları güncel statü olarak taşınmaz.

## ST-02 kapanışı — 28 Ekim 2026

Son kabul edilmiş backend main: `19189d74e7feb1f03cfbd4e05b9132b2c71e4926`, [PR63](https://github.com/SXQHex/FtkSaaS/pull/63). Head `398c34dccb140b2763ba4907d642b05a41fbe4ab`, base `1c15ac8c43b4acc07e129b970e49801ebaf16d10`, tested merge `529bf58a86986ac8a883106a919520bbb658808b`, tree `97ea9416a20c041cdb16498e1960f8d14fb8426d`. Actual main aynı iki parent ve tree ile doğrulandı. Son tree bağımsız incelemesinde açık bulgu yok; ilk P2 outbox teslim kanıtı düzeltildi. İnceleme kaydı PR63 açıklamasındadır.

[Aday40574962716](https://github.com/SXQHex/FtkSaaS/actions/runs/40574962716), [aynı main40580037633](https://github.com/SXQHex/FtkSaaS/actions/runs/40580037633) ve [development CD40583510430](https://github.com/SXQHex/FtkSaaS/actions/runs/40583510430) attempt1 completed/success. Main source/core/API1–4/toplayıcı ve CD source/deploy/hosted doğrulama adımları geçti. CD receipt artifact12771360001, SHA256 `216a2d150fd0c2ec26b274117deec4ea995a02231e12274dd4f1fba73d0c717d`.

ST-02 kapandı: Starter gerçek CSV→preview→apply→hak/borç→tahsilat→self rezervasyon/yoklama→temel rapor/CSV ve işlemsel inbox zinciri kabul edildi. P05 pending→succeeded, worker sonucu ve tam bir bağlı receipt ayrıca denetlenir. Canlı yetki kaybı, current/consumed preview, satır rollback/kota ve replay korundu. Runtime API/migration/plan/CI politikası değişmedi; envanter213 callable/0 contract_only/68 migration/90 core tablo kaldı. [Alan devri](../p06-handover.md#starter-tüketici-kabulü--st-02).

Development kabulü production kabulü değildir. Frontend/public sağlayıcı, ST-03/OPS-01/REL-01 bu kapanıştan türetilmez. Sonraki sıra başlatılmadı. İptal edilmiş hedefli koşular başarı sayılmaz; son kaynak bağlı aday/main full clean esas alınır.

## ST-03 çalışma başlangıcı

Kullanıcının CI sonrası yeni işi Starter'da izinli bütün FD01–FD12 ayar tüketicileridir; marka/medya, kişisel takvim ve paylaşım kapsam dışına çıkarılmaz. Başlangıç main `f52fdaf7b6d1ecec56a8cb75ffaf7272f45770cf`, tree `ca0c4ca8e34ba5d489c47ddcf5792ef1bd62e203`. Aynı SHA'nın [belge CI40584796701](https://github.com/SXQHex/FtkSaaS/actions/runs/40584796701) ve [CD40584930534](https://github.com/SXQHex/FtkSaaS/actions/runs/40584930534) completed/success olduğu doğrulandı; belge yolunda full clean çalışmadı. Runtime kabulü yukarıdaki ST-02 kaynağına aittir.

Aktif adayın ilk tüketicileri program süresinin orgdan yeni merkeze bir kez kopyalanması, preview snapshot'ında kullanılması, CSV ayırıcı seçimi ve katılımcı görünürlüğünün gerçek session okumasıdır. Kaynak/yerel/native test, PR/bağımsız inceleme/CI ve main/development kabulü ayrı ilerler. ST-03 tamamlandı veya dağıtıldı sayılmaz. Kapsam ve kalan davranışlar [ayar devrinde](../frontend-settings-handover.md#st-03--starter-tüketici-kapsamı), açık iş ve sıra kendi tek kaynaklarındadır.

İlk ara adayın Vercel izole native testinde hazırlık/provenance/preview/reset/katılımcı/replay7/7 geçti. Birleşik test21/28 kaldı: ST-02 zincirinin ilk hatası job_status_get boş HTTP503; ona bağımlı fixture assertionları da başarısız oldu, bu koşu başarı sayılmaz. Aynı sırada runtime üretimi yapıldığı için sabit kaynakta regresyon yeniden koşmalıdır. VM13dk timeout sonunda kapandı. Bağımsız incelemenin yakaladığı UUID harf büyüklüğü P1'i için yeni kanonik scope göçü ve mixed-case testleri; telefon consumer'ı için native sentetik doğrulanmış telefon assertionları eklendi. Bunlar7/7 kaynağından sonradır; yeni native/CI kanıtı bekler. Uygulanmış69/70 migration değiştirilmedi, düzeltme71'e eklendi.

[Draft PR65](https://github.com/SXQHex/FtkSaaS/pull/65) çalışma dalıdır. Medya öncesi head `bc419f3225609b6372617d6b554bbcdfc0113b76`, tree `b4d9833578e272084b28cfa36071c6f054dbeef6`; [hedefli40591949965](https://github.com/SXQHex/FtkSaaS/actions/runs/40591949965) son sorguda in_progress'ti. Full clean tetiklenmedi. Legacy UUID göçünün exact SQL'ini ayrı loopback veritabanında çalıştıran kabul testi eklenmiştir; minimal history dispatcher fixture'ı gerçek Auth kabulü yerine sayılmaz.

Sonraki yerel medya adayı profil photo/org logo_image komut alanlarını, private güncel asset okumasını ve photo_visible consumer'ını ekler; aday envanter214 callable/0 contract_only/72 migration/90 core tablodur. Yapısal157/157 ve görsel envelope unit1/1 geçti; son medya/legacy/telefon kaynağı native kabul bekler. Bağımsız kaynak incelemesi ek somut bulgu bildirmedi; CI/main/hosted kabulü bundan türetilmez.

Medya head `38e304b0f3da446fbf7d0c39c0ffec5e1fb2e566`, tree `b55748096203d72aa3f87c73840bb81290d9d1e6` için [hedefli40593393943](https://github.com/SXQHex/FtkSaaS/actions/runs/40593393943) failure: yapısal157/157, DB29/29, öncelikli API114/117. Canonical legacy göçü3/3 ve ST-02 zinciri geçti. Telefon testinin native Admin API kanonik değerindeki baştaki+ dönüşümü beklentisi hatalıydı; peer testi durunca fotoğraf alt testi önceki açık email/phone tercihlerinden etkilendi. Fixture kanonik doğrulanmış kaynakla eşitliği ayrıca denetleyecek ve photo-only başlangıcını bağımsız kuracak biçimde düzeltildi. Henüz yeni native başarı yoktur; kalan API regresyonları bu priority failure ardından çalışmadı.69–72 uygulanmış göçleri değiştirilmedi.

Yerel sonraki şablon adayı katalogv4, scoped özel/ortak rapor-import hazırlığı ve canlı resolve→mevcut engine tüketimini ekler; aday envanter215 callable/0 contract_only/73 migration/90 core tablo. Kaynak/native ayrımı korunur; şablon yetki veya otomatik iş değildir. Son kaynak ve kapsam [ayar devrinden](../frontend-settings-handover.md#rapor-ve-import-şablon-tüketicisi--aday) okunur; ST-03 ve main/development teslimi açık kalır.

## Önceki domain/hosted tabanı — PR61

| Alan | Doğrulanmış kaynak |
|---|---|
| PR | [61](https://github.com/SXQHex/FtkSaaS/pull/61) |
| Main | `af06a64ba2e02823f60e74dcf637cc4dee0bd485` |
| PR head / base | `5e71aa3432cc47bfb68437340d3de20751e9978f` / `6c7587b63681cc9f89d14483eaca71e520a074af` |
| Test edilen merge / tree | `a32d1a4ad7b097745dd2b716a29db150ff474d3b` / `90eb5cdfb354a849d1dbf579f7370b6eb0ba98cf` |
| Bağımsız inceleme | [5666282768](https://github.com/SXQHex/FtkSaaS/pull/61#pullrequestreview-5666282768), son head/tree |
| Aday full clean | [40495866450](https://github.com/SXQHex/FtkSaaS/actions/runs/40495866450), success |
| Aynı main full clean | [40501291275](https://github.com/SXQHex/FtkSaaS/actions/runs/40501291275), source + core + API1–4 + toplayıcı success |
| Development CD | [40504620302](https://github.com/SXQHex/FtkSaaS/actions/runs/40504620302), gerçek deploy ve20/20 kontrol success |
| Envanter |213 callable /0 contract_only /68 migration /90 core tablo |
| Hosted Edge | backend-v1 v22 ACTIVE, verify_jwt=true; kaynak SHA256 `11f1daefdc3b9ef03d51e42730b126e39b51b6d6a443bfc5d4462722b17f84f6` |
| Migration readback |68 dosya içeriği eşleşti;20261027103358_starter_onboarding_defaults.sql uygulandı |
| İzinler | RLS eksik0, anon/authenticated uygulama RPC EXECUTE0 |
| CD receipt | artifact12733869000; ZIP SHA256 `23849169e7ae8374f74d73dcb40d41e303f1b1ee68ff8aee8f57bfb247f40422` |

Actual main’in iki parent’ı yukarıdaki base/head’dir ve test edilen tree aynıdır. CD aynı main/acceptance run’a bağlıdır; synthetic fixture temizliği geçti. Advisors ERROR0; önceki belgeli security WARN2 ayrı sınırdır. Development kabulü production kabulü değildir.

## Kapanmış backend teslimleri

| Teslim | Kaynak ve sınır |
|---|---|
| Kimlik/iletişim/oturum | PR54; native Auth/e-posta kurtarma/Google/TOTP/canlı oturum kabulü. Gerçek SMS ayrı dış entegrasyondur. [Sağlayıcı kanıtı](../remote-backend-setup.md#teslim1-native-kurtarma-kabul-20261026). |
| Starter plan ve downgrade | PR56; [plan/kapsam devri](../starter-plan-gates-handover.md), [kaynak raporları](../history/reports/starter-plan-gates-takeover-20261027.md). |
| Tek stüdyo/ürün sürümü | PR58; oda50/seans40 ve5/çakışma; kredili, kotalı süreli ve sınırsız satış→tahsilat→self rezervasyon→yoklama/hak tüketimi; [rapor](../history/reports/starter-studio-20261027.md). |
| Başlangıç ve public/self | PR61; yeni Starter org için FD07 üç politika; miras/yetki/borç tüketicisi; public intent→review→öğrenci aktivasyonu→native davet→satış/tahsilat→self rezervasyon. [Kaynak ve native kabul](../history/reports/starter-onboarding-20261027.md). |
| Temel motorlar | P01–P07 kod/main/development kabulü mevcut. Gerçek worker yükü/fiziksel imha/afet dönüşü bundan türetilmez. |

PR61 native28/28 ve yerel151/151 kanıtları kaynak raporundadır. Gerçek Turnstile tokenı ve frontend E2E bu kanıtlarla kapatılmaz. uye.fethiyetango.com yalnız mevcut widget’ın izinli alanına eklendi; eski frontend/site/DNS değiştirilmedi, public adapter dağıtılmadı.

## Monorepo kabulü ve aktif çalışma

PR62 normal merge ile main `1c15ac8c43b4acc07e129b970e49801ebaf16d10` kaynağına alındı (parent’lar `af06a64ba2e02823f60e74dcf637cc4dee0bd485` ve `e5dfcfd18e91c21a77e9773d33e5b58e6a4ec18a`; tree `9684db7655e25cd631d30cfc804d2d649f90e524`). Aynı SHA'nın [main clean40542200511](https://github.com/SXQHex/FtkSaaS/actions/runs/40542200511) ve [development CD40546616984](https://github.com/SXQHex/FtkSaaS/actions/runs/40546616984) completed/success olduğu GitHub'dan doğrulandı. CD artifact12752229300. REPO-01 kapandı; önceki PR61 domain/hosted ayrıntıları yukarıda kendi kaynağında korunur.

ST-02 teslimi yukarıdaki aynı kaynak main/development zinciriyle kapandı. Sonraki sıra için yeni uygulama başlatılmadı.

Backend `apps/backend`, normatif JSON `packages/api-contracts/schema`, yaşayan sözleşmeler `docs/contracts`, tarihsel snapshotlar `docs/history` altındadır. saaspt main `bec7e204e06a813e4907ff012d4bcea783472a15` kaynak incelemesi önceki teslimdedir; frontend aktarımı ve ekran/API kabulü frontend ekibinin ayrı WEB-01 işidir.

[Kaynak indeksi](../source-index.md), [tek backlog](../remaining-work.md), [aktif sıra](../production-queue.md), [ortam devri](../monorepo.md).

ST-03 şablon head `f35d468a3acd7d447a16ebfaa6f85800d2751d43`, tree `ddbe98933a510d5435e81bda21ecc7bdf354677b` için [hedefli40599749742](https://github.com/SXQHex/FtkSaaS/actions/runs/40599749742) failure: yapısal157/157, DB29/29, priority API118/120. Program/paylaşım/medya ve canonical göçü geçti; önceki telefon/photo fixture hataları kapanmıştır. Şablon rapor alt testindeki native pg parametre dizisi JSON.stringify olmadan SQL array biçimine çevrilmişti (22P02); iki helper query JSON parametreleri açık serialize edildi, assertionlar korunmuştur. Yeni kaynak native kabul bekler; full clean/main/development kabulü yoktur.

ST-03 devam kaynağında public organization/center tanıtım tüketicisi eklendi; katalogv5/74 migration/215 callable. Yerel yapısal157/157 geçti; native/public yeni testler ve bağımsız inceleme bekler. Full clean isteğinde önce yalnız ci:full-clean etiketi eklendiği doğrulandı; PR65 mergeable_state dirty/merge null nedeniyle yeni full clean run oluşmadı. Bu etiket kabul veya gerçek koşu sayılmaz. Frontend main kilidini çözerken kullanıcı kalan ST-03 geliştirmesine devam edilmesini istedi. Main/hosted güncellenmedi.

Manuel tahsilat payment snapshot/finance read adayıyla migration75 hazırlandı;215 callable korunur. Yerel yapısal157/157 geçti. Bağımsız incelemede SQL whitespace ile DTO ayrışması yakalandı; JS whitespace kümesini karşılayan denetim ve doğrudan native CHECK/helper tab/newline/NBSP/BOM assertionları eklendi. Native koşu yapılmadı; son inceleme ve main/development kabulü bundan türetilmez.

Kişisel takvim adayı5 yeni işlemle220 callable/0 contract_only/76 migration/90 core tabloya ilerler. Own-account credential komutları/global native Auth, private hash/pointer/history, canlı personal feed, RFC5545 encoder ve public-JWT HTTP adapter kaynakları hazırdır. Yerel yapısal162/162 (önceki157+5 calendar unit) geçti; bağımsız incelemede Starter session read sınırı ve iki yalancı negatif test düzeltildi. Native test aynı eski operation key replay'ini, geçerli boş VCALENDAR'ı, rotate/revoke/eskiURL ve erişim kaybını denetler; henüz çalıştırılmadı. CI fixture teknik key/origin'i yalnız loopback'te hazırlar; hosted adapter/route/secrets kurulmuş veya ST-03 kapanmış sayılmaz.

Takvim/public/manuel ödeme ara kaynağı tek12dk Vercel native VM'de denendi (`sbx_TctQ8tkZJYmMuxxz4aPYOEKc0THM`, Node24.22.1, Python3.14.4,2CPU/4GiB). Kaynak tar SHA256 `d0193966102761fea0c7532230b3c10c2e5241bfb29bf352de126b73a2abe840`; Edge SHA256 `8d9b0ab2491464a00cb8741f8effdc1ad8b01266111c605cd5ebe45ae674bc9e`.76 migration uygulandı; bunlar artık değiştirilmez. Gerçek native Auth/DataAPI/Edge/HTTP GET takvim explicit seçim/dedup/privacy, rotate/revoke/eski operation-key replay ve account/org/link kaybı alt testleri geçti. Hazırlık/provenance/peer/media, public alan seçimi ve manuel tahsilat reference/SQL CHECK alt testleri de geçti. Son kaynak native kabulü değildir: takvim selected-session negatif fixture'ı mevcut cd_sessions FK'sine uygun center_disciplines kaydını oluşturmadan session discipline değiştirmeye çalışıp23503 verdi. Assertion gevşetilmeden eksik inactive ilişki fixture'a eklendi. İzole ek sınır kontrolü VM timeout sırasında tamamlanamadı; düzeltme için yeni native/CI kanıtı bekler. VM otomatik kapandı, yeniden açılmadı; kaynak/runtime migration değişmedi.


ST-03 hazırlık/bildirim devam kaynağı katalogv6,221 callable/0 contract_only/78 migration/90 core tablo içerir. Yeni77 availability/package hazırlığı org→yeni merkez bir defalık kopya/provenance, reset ve gerçek availability/product/sale request çözümünü ekler;78 hazır olmayan email kanalının in_app tercihini değiştirmesini replay öncesi engeller ve typed bildirim kullanılabilirliğini döndürür.77/78 hiçbir ortamda henüz uygulanmadı; önceki76 immutable kalır. Yerel yapısal162/162 geçti. Bağımsız incelemede77 strict saat doğrulama bulgusu kapandı;78 ek bulgu yok. Bu native kabul değildir. Geliştirme DB'sinde salt okunur SELECT ile geçmiş succeeded email preference receipt sayısı0 doğrulandı; hosted veri/şema değiştirilmedi. İlgi/öneri, gece aşan availability, hazır marka assetleri ve gerçek takvim host/route/config kabulü açıktır. Frontend main kilidi devam ettiği için merge veya full clean başlatılmış sayılmaz.


ST-03 sonraki79/80 kaynak adayında221 callable/0 contract_only/80 migration/90 core tablo ve katalogv8 korunur.79 açık ilgi filtresini ve opt-in own-history takvim sırasını mevcut live authorization/keyset sayfalamasına bağlar;80 açık24:00 günlük bitişini ve bitişik UTC availability birleşimini, aynı pencerelerle resource-usage paydasını ekler. Yerel yapısal162/162 ve yeni native dosyaların JS syntax kontrolü geçti;79/80 henüz hiçbir native DB'ye uygulanmadı. İncelemede nonexistent-center fixture, DST timezone karşılaştırması ve rapor/schedule pencere ayrışması düzeltildi; bağımsız son kaynak incelemesinde ek bulgu yoktur. Starter pozitif ilgi, merged-own-history/no-show/başkasının geçmişi, opt-out/stale cursor ve gerçek session_create gece/boşluk/adjacent/DST testleri kaynağa eklendi, native geçiş iddiası yoktur. Main1f7f4a394c6ef8c50af0b292e23f457882370f77 ağacında hazır theme/font/brand asset kaynağı bulunmadı; değer uydurulmadı. Hosted/main/production güncellenmedi.
