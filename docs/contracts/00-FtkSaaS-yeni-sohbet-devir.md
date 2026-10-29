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
## Frontend geri alma adayı — 28 Ekim 2026

Kullanıcı etiket yasağını kaldırdı ve PR66 frontend merge'inin geri alınmasına başlanmasını istedi. Ardından manuel tetikleyicinin de gereksiz olduğunu belirtti; PR67'nin manuel workflow'u ve ona ait politika bölümü aynı adayda kaldırılır. Hazırlık main `7334d24c9f1f5a54686125b890ce90c321b896e6` üzerinde ayrı geri alma dalındadır. PR66'nın ilk parent'ına göre ters yaması uygulanır. Backend uygulama kaynağı PR66 öncesi `f52fdaf7b6d1ecec56a8cb75ffaf7272f45770cf` ile aynıdır; yalnız PR66 ile eklenmiş governance test uyarlaması geri alınır. Yeni full clean ve merge henüz kabul edilmedi.

Geri alma sonrasında frontend aynı repo içinde ayrı PR ile yeniden uygulanır. Her adayda son head/base/tested merge üzerinde full clean başarıyla bitmeden merge yapılmaz; merge sonrası aynı main kabulü ayrıca doğrulanır. Eski başarısız koşular yeniden adlandırılmaz veya başarıya çevrilmez. Diğer repolar bağlam dışıdır; eski göç notları bu kararı değiştirmez.

## CI-SPLIT uygulama adayı — 28 Ekim 2026

Başlangıç main `1f7f4a394c6ef8c50af0b292e23f457882370f77`; aynı SHA'nın [main kabulü40610094049](https://github.com/SXQHex/FtkSaaS/actions/runs/40610094049) ve [development CD40613023027](https://github.com/SXQHex/FtkSaaS/actions/runs/40613023027) GitHub'dan completed/success doğrulandı. Açık PR65 ST-03 kapsamındadır; bu işe mükerrer değildir. CI-SPLIT `ci/split-backend-frontend` dalında ayrı uygulama adayıdır.

Backend/shared pozitif kaynak kaydı, development ön sınıflandırması, saf belge hafif kabulü, backend Turbo grafiği ve frontend ilerlemesinde kaynak bağlı CD eşdeğerliği eklendi. Frontend uygulama/test/workflow yapısı kurulmadı; sahibi frontend ekibidir. Runtime API/migration/plan davranışı ve F01–F33 uygulama izi değişmedi; tip/katalog/envanter üretimi değişmedi. Aday/main full clean tekrarı ve ayrı merge gate bu dilimde korunur. CI-ADMIN ayarları değiştirilmedi.

Yerel `pnpm exec turbo run verify --filter=@ftksaas/backend...` geçti:106 contract/governance ve60 CI politika testi; tip/generator/migration manifest/audit kontrolleri de geçti. Gerçek Turbo sentetik workspace grafiğinde backend/frontend ayrımı ve ortak paket tüketimi doğrulandı. Belge kontrolünde55 dosya/335 bağlantı geçti; workflow YAML parse ve diff whitespace kontrolü de geçti. Kaynak/taşıma/silme/bilinmeyen kapsam/eksik ağaç/run-attempt/CD negatifleri bu yerel kapsamdadır. Bu kaydın yeni aday için uzak CI, bağımsız inceleme, trusted politika kurulumu, merge veya hosted kabul iddiası yoktur. CI-SPLIT gerçek karşılıklı tetikleme örnekleriyle doğrulanana kadar açık kalır. Kapsamın tek tarifi [CI politikasındadır](../ci-policy.md#ci-split--frontendbackend-kaynak-sınırı).

### İlk uzak hedefli koşu ve cwd düzeltmesi

Head `5409d466ea4b71041deb0ea381ff7ad1ce49ec75` için [Development targeted40614523847](https://github.com/SXQHex/FtkSaaS/actions/runs/40614523847) attempt1 başarısızdır; scope işi backend cwd'den belge mode'unu çözerken `UNSAFE_DOCUMENT_SCOPE` verdi. DB/API ve targeted işi başlamadı. Gate workflow'unun yeşil bitmesi Draft PR'nin merge kabulü değildir; belge işi Draft nedeniyle skipped'dır. Bu başarısız sonuç korunur.

`localScope` git işlemleri öncesinde repo kökünü çözecek şekilde düzeltildi. Kök ve backend cwd'de belge-only/karma kapsam, kurulum öncesi CLI çıktısı ve symlink reddi aynı regresyon testinde doğrulandı. Yerel backend verify106 contract/governance +61 CI politika testiyle geçti. Yeni kaynak için uzak CI henüz ayrı doğrulanmalıdır; eski SHA'nın sonucu yeni kaynağa taşınmaz.

### Bağımsız inceleme ve aday hazırlığı

Kullanıcının ayrı inceleme ajanı yetkisiyle CI-SPLIT bağımsız incelendi. İlk kaynak hedefli CI40654290663 completed/success; scope, documentation ve targeted işleri geçti. İncelemede P2: checkout yapılmayan frontend-only main marker işinin backend çalışma dizinini miras alması bulundu. Step çalışma dizini repo çalışma alanı köküne sabitlendi ve regresyon testi eklendi. Son yerel backend verify106 contract/governance +62 CI politika testiyle geçti. Son ağaç inceleme kaydı PR69 açıklamasına bağlanır; bağımsız inceleme CI veya kurulum/merge/main kabulü yerine geçmez. Bu workflow politika değişimi normal trusted-base kapısını otomatik açmaz; kaynak bazlı kurulum sınırı korunur.

## CI-SPLIT main ve CI-ADMIN yönetim kaydı

PR69 normal merge main `8d5d3025f1be5d3318e042bfb9167b4bfdca859c`; parent'lar1f7f4a394c6ef8c50af0b292e23f457882370f77 ve3f2ce6b796db54ac1190aae411b62d00ae550f4d; tree df6a10f52557dd8637451749e42c220f1b5613de. Aynı main [40682715287](https://github.com/SXQHex/FtkSaaS/actions/runs/40682715287) ve development CD[40686483288](https://github.com/SXQHex/FtkSaaS/actions/runs/40686483288) attempt1 completed/success; source/core/API1–4/toplayıcı ve deploy/hosted adımları GitHub'dan doğrulandı. Delivery receipt artifact12815591017. Frontend karşılıklı tetikleme kabulü açık kalır.

CI-ADMIN talimatıyla main-acceptance ruleset26040398 uygulandı, active/strict-status/GitHub Actions/bypass boş readback doğrulandı. [Denetim kaydı](../branch-protection-review.md#28-ekim-2026--ci-admin-uygulaması). Bu belge adayı henüz main kabulü değildir; kaynak kod veya production dağıtımı değişmez.

## CI-ADMIN negatif kabul kapanışı

CI-ADMIN required-check/strict-base/bypass kurulumunun eksik iki negatif kabulü gerçek test PR71 ve72 ile doğrulandı. Çakışmasız/non-Draft başarısız kanıt blocked; source-bound başarılı kanıt taşıyan eski branch behind kaldı. Test PR'leri merge edilmeden kapatıldı ve main değişmedi. [İzole kanıtlar](../branch-protection-review.md#ci-admin-izole-negatif-kabulü--28-ekim-2026). Bu kapanış yalnız yönetim ve negatif kabul içindir; CI-SPLIT frontend örneklerini veya yeni runtime/production kabulünü kapatmaz. Kapanış belge adayının kendi kaynak bağlı belge/main kabulü ayrıca izlenir.

## WEB-01 frontend altyapısı adayı — 28 Ekim 2026

[PR76](https://github.com/SXQHex/FtkSaaS/pull/76) ayrı frontend adayıdır. Başlangıç kaynak `8d5d3025f1be5d3318e042bfb9167b4bfdca859c`; aynı SHA'nın [main clean40682715287](https://github.com/SXQHex/FtkSaaS/actions/runs/40682715287) source/core/API1–4/full-clean işleri ve [development CD40686483288](https://github.com/SXQHex/FtkSaaS/actions/runs/40686483288) completed/success doğrulandı. PR açılırken güncel base `7bf9b3a15843d13c7f31ad4ecd0f8f78c8812d88` üzerindeki yalnız CI-ADMIN belge değişiklikleri korundu; bu base'in [main40694002736](https://github.com/SXQHex/FtkSaaS/actions/runs/40694002736) ve [CD40694110185](https://github.com/SXQHex/FtkSaaS/actions/runs/40694110185) completed/success sonucu ayrıca okundu. Belge-only kabulü yeni frontend runtime kabulü değildir.

Son kullanıcı kararıyla mevcut taslak tasarım reddedildi; ürün CRM olarak ele alınmaz. Bu aday yalnız resmî shadcn/ui login-01 tabanlı Auth/bağlantı doğrulaması, tr/en, tema, typed Edge tüketimi ve frontend araç/test/CI altyapısıdır. Ekran tasarımı ve Expo kurulumu ayrı aşamadır. Backend kaynakları, API sözleşmesi ve backend workflow/gate dosyalarında değişiklik yoktur. Teknik tüketim ve hazır blok kuralları [frontend rehberindedir](../../apps/web/README.md).

Node24.22.1 ile frontend lint/typecheck/build,12 web +1 UI birim testi, coverage ve gerçek Turbo dry-run ayrımı geçti. Chromium/WebKit/mobil public kabul18/18 geçti; dil kalıcılığı, metadata/lang, tema, klavye,320px/yüzde200 metin ve axe dahildir. Yerel Firefox1555, test sayfasını açmadan `Could not find profile folder` ile başlatılamadı; CI Firefox projesi korunur, kabul edilmiş sayılmaz. Mevcut yetkili development hesabıyla live-chromium native giriş→gerçek kuruluş/merkez seçimi→çıkış→korumalı alana erişimin kapanması1/1 geçti. Canlı koşuda trace/video/screenshot kapalıdır; hesap/parola kaydı yoktur. Google/TOTP sağlayıcı dönüşü bu parola giriş kabulünden türetilmez.

PR Draft durumundadır. Son kaynak bağımsız incelemesi, uzak frontend/ortak kapsam kabulü, aday full clean, normal merge ve aynı main kabulü bu yerel sonuçlarla kapanmaz; güncel run/head ilişkisi PR üzerinden doğrulanmalıdır.

İlk kaynak head `e9c6ba5b9d9a613f483f203a1a0ba1bd63b99d20` için [targeted40694656538](https://github.com/SXQHex/FtkSaaS/actions/runs/40694656538), scope aşamasında `UNCLASSIFIED_SOURCE docs/frontend-development.md` ile durdu; backend testleri başlamadı. Yeni frontend rehberi uygulama sahibinin apps/web/README.md yoluna alındı ve bağlantıları düzeltildi. Backend scope kaydı veya güvenlik kapıları değiştirilmedi; önceki başarısız koşu korunur. Yeni kaynak uzak kabulü ayrıca doğrulanacaktır.

Head `1518149b0e957c322bbd792b218ba5dffdeec92d` için [frontend40695015077](https://github.com/SXQHex/FtkSaaS/actions/runs/40695015077) koşusunda Chromium ve Firefox geçti; WebKit/mobil dil seçimi HTTP loopback üzerinde Secure cookie reddi nedeniyle başarısız oldu. Yalnız locale cookie için HTTP localhost/127.0.0.1 istisnası eklendi; hosted originlerde Secure korunur. Assertion veya güvenlik kapısı gevşetilmedi. Bu sınır için3 regresyon testi eklendi;15 web +1 UI birim testi ve yerel WebKit/mobil dil-tema4/4 doğrulandı. Eski başarısız koşular yeni kaynağa başarı olarak taşınmaz.

Kullanıcının ayrı ajan yetkisiyle head `b5b0aa42ed84e789151f2366c209dae86b57d875`, tree `888eef4ccc2f1a17be1d4718f4d9b436a3ea2828` bağımsız incelendi. P2: girişli settings yüklemesi cihazın next-themes tercihini eziyordu. Geçerli cihaz seçimi korunacak, yalnız seçim yokken hesap teması başlangıç olacak şekilde dar düzeltme ve remount regresyonu eklendi. Son yerel frontend lint/typecheck/build ve16 web +1 UI testi geçti. Son kaynak yeniden incelemesi PR76 açıklamasında kaydedilir; önceki inceleme yeni kaynağın kabulü yerine geçmez. Backend/sözleşme/backend CI kaynağı değişmedi.

## CI sadeleştirme adayı — 28 Ekim 2026

Başlangıç main `7bf9b3a15843d13c7f31ad4ecd0f8f78c8812d88`; aynı SHA’nın [belge kabulü40694002736](https://github.com/SXQHex/FtkSaaS/actions/runs/40694002736) GitHub’dan completed/success doğrulandı. Önceki yerel değişiklikler tek `ci/automatic-pr-proof-main` dalında tamamlanıyor; PR65/76/77’ye mükerrer backend uygulaması eklenmiyor.

Kullanıcının kabul ettiği model: açık main tabanlı PR’de otomatik kapsam/full clean veya hafif belge kabulü; main’de gerçek parent/tree ve aday run/attempt/job kanıtı doğrulaması, test tekrarı yok; tam SHA/aralık manuel targeted ve bağımsız seçili API shard’ları. Eski recovery girişi/script’i ve silinen belge workflow’una canlı referanslar kaldırıldı. Frontend workflow politikası da trusted yüzeyde; önceki CD receipt’i güvenilir main/aynı-attempt deploy kaynağıyla sınırlandı. Runtime API/migration/plan davranışı, F01–F33 izi, üretilmiş tip/katalog ve envanter213 callable/0 contract_only/68 migration/90 core tablo değişmedi.

Yerel backend Turbo verify geçti:106 contract/governance +70 CI politika testi, migration/generator/TypeScript/audit kontrolleri başarılı. Gerçek zip receipt’leriyle iptal/eksik/eski koşunun geçerli full/belge kanıtını gölgelememesi, main’in test tekrarı yapmadan aynı adayı doğrulaması, manuel aralık/checkout/ancestor/shard/envanter negatifleri ve CD geçmiş makbuz güven sınırı doğrulandı. Bu yerel sonuçlar uzak CI, bağımsız son kaynak incelemesi, trusted politika kurulumu, merge veya hosted kabulü değildir; bunlar tamamlanmadan CI-SIMPLIFY kapanmaz.

Son bağımsız incelemede workflow politika sınırı, serial etiket semantiği, manuel yeni-test envanteri, geçmiş CD receipt kaynağı, CD PR okuma yetkisi, base retarget ve metadata concurrency bulguları düzeltildi; son ağaçta açık bulgu kalmadı. Son yerel kontrol70/70 CI politika testi ve55 dosya/339 belge bağlantısı başarılı;106 contract/governance dahil Turbo verify başarılı. Metadata ayrı grupta olduğundan kaynak clean’ini iptal edemez. Uzak aday full clean sonraki aşamadır; bu kayıt başarı/kurulum/merge/CD iddiası değildir.

Gönderim öncesinde PR76 main’e birleştiği için aday güncel `073e0daf9d0df9c00c9a7f77fc9b67f26279aa65` üzerine yeniden taşındı; yalnız üç durum/sıra belgesi çakışması iki teslimin bilgileri korunarak çözüldü. Bu base’in [main clean40703561601](https://github.com/SXQHex/FtkSaaS/actions/runs/40703561601) okuma anında in_progress; frontend checks40703561551 ve compatibility40703561416 completed/success. Bu gözlem backend main kabulünün bittiği iddiası değildir. Yeni adayın gerçek full clean’i ayrıca gerekir.

## WEB-01 Oxlint/Oxfmt araç adayı — 28 Ekim 2026

Son kullanıcı talimatıyla araç geçişi `chore/frontend-oxlint-oxfmt` dalında, PR76 head `9673f87aea7dcafe784f87e9c5a99272c0c84f41` üstünde ayrı adaydır. PR76 kaynağına push veya yeni full-clean tetiklemesi yapılmadı. apps/web ve packages/ui Biome bağımlılık/config’leri kaldırıldı; Oxlint1.90.0 ve Oxfmt0.75.0 tam sürümle eklendi. Lint önce Oxlint uyarılarını hata sayar, ardından Oxfmt check yapar; mevcut frontend CI komutları bu iki kontrolü de tüketir. Bağımsız tsc typecheck korundu. Yerel kural kapsamı ve gerekçeli iki bileşen istisnası [frontend rehberindedir](../../apps/web/README.md#lint-ve-format).

Node24.22.1 `check:frontend` lint/format/typecheck/build ve16 web +1 UI testiyle geçti; gerçek Turbo görev ayrımı backend görevi seçmedi. Formatlanan11 runtime kaynağının normalize derleme çıktısı başlangıçla aynı; test assertion’ları değişmedi, mock tipleri açıklaştırıldı. pnpm çok belgeli lockfile karşılaştırmasında backend importer’ı ve geçişli100 snapshot/resolution kaydı birebir aynı. Backend/API sözleşmesi/backend CI/CD kaynak farkı yoktur. Ortak lockfile hâlâ mevcut CI politikasının ortak kapsamındadır; bu kontrol scope istisnası oluşturmaz. Yeni araç adayının uzak CI/bağımsız inceleme/full clean/merge/main kabulü henüz bu yerel sonuçlarla kapanmaz.

### PR78 ilk kabul ve PR77 sonrasında kaynak eşitleme

PR78 head `c6e325b414df1dc776c9691d3841ebd03506bfef` için [aday40705249743](https://github.com/SXQHex/FtkSaaS/actions/runs/40705249743) attempt1 completed/success doğrulandı: candidate, core, API1–4 ve full-clean toplayıcı gerçek adımları aynı run/attempt/head üzerinde başarılıdır. İlk base073e0da için bu başarı korunur; PR77’nin main `5bebc8f0fb6c89e1d67648fb06a2db729a4f489b` merge’inden sonra güncel kabul yerine geçmez. PR78’de yalnız üç durum/sıra belgesi çakıştı; iki teslimin kayıtları korunarak güncel main branch’e normal merge ile alındı. Backend CI uygulaması değişmedi, frontend kaynakları main’dekiyle aynıdır. Son kaynak inceleme ve yeni kaynak bağlı aday kabulü gerekir; PR65 ve PR43’e müdahale edilmedi.

### PR78 güncel aday kabulü ve süre denge kapısı

Head `3eafa771c3c67372da4f9934a66442666e4d891e` /base `5bebc8f0fb6c89e1d67648fb06a2db729a4f489b` için [aday40711022126](https://github.com/SXQHex/FtkSaaS/actions/runs/40711022126) attempt1 completed/success doğrulandı; henüz trusted kurulum/merge yoktur. Kullanıcı daha sonra mevcut ve yeni testlerde süre dengesizliğinin sessiz birikmemesini istedi. Başarılı aynı-main40709789814 gerçek ölçümünde API1/3 clean1651/793sn bulundu.15 suite süre tablosu bu kaynağın başarılı job loglarından güncellendi; CLI2.122.0 ve run/attempt/job izi korunur.

Aynı PR78’de gerçek API süre denge kapısı eklenir: oran>1.25 VE fark>120sn kabulü başarısız yapar; rapor korunur, binding üretilmez. Trusted doğrulayıcı zamanı bağımsız yeniden denetler. Yeni/mevcut test değişikliği aynı kapıya tabidir. Model yeni dağılımda yaklaşık26dk48sn en uzun suite alt sınırını kaldırmaz; hızlanma veya suite bölünmesi iddiası yoktur. Son kaynak yerel/bağımsız/gerçek aday kabulü gerekir; önceki başarılı koşular bu yeni politika kaynağının kabulü değildir. Runtime/API/migration/entegrasyon veya frontend kaynakları değiştirilmedi.

Süre kapısının yerel kabulü:106 contract/governance +73 CI politika testi, migration/generator/TypeScript/audit ve57 dosya/354 belge bağlantısı başarılı. Gerçek PR77’nin1651/1102/793/1167sn süreleri bütün test ve collector başarılarıyla birlikte verilse bile yeni gate reddeder. Mevcut suite’e yeni assertion yükü, sınır değerleri, eksik/mükerrer/sıfır/geçersiz zaman ve karışık run/attempt/head negatifleri geçti. Eski snapshot8% tahmini-wall regresyonu ayrı korunur. Son kaynak bağımsız incelemesi ve yeni uzak aday kabulü olmadan bu değişiklik kurulmuş sayılmaz.


ST-03 şablon head `f35d468a3acd7d447a16ebfaa6f85800d2751d43`, tree `ddbe98933a510d5435e81bda21ecc7bdf354677b` için [hedefli40599749742](https://github.com/SXQHex/FtkSaaS/actions/runs/40599749742) failure: yapısal157/157, DB29/29, priority API118/120. Program/paylaşım/medya ve canonical göçü geçti; önceki telefon/photo fixture hataları kapanmıştır. Şablon rapor alt testindeki native pg parametre dizisi JSON.stringify olmadan SQL array biçimine çevrilmişti (22P02); iki helper query JSON parametreleri açık serialize edildi, assertionlar korunmuştur. Yeni kaynak native kabul bekler; full clean/main/development kabulü yoktur.

ST-03 devam kaynağında public organization/center tanıtım tüketicisi eklendi; katalogv5/74 migration/215 callable. Yerel yapısal157/157 geçti; native/public yeni testler ve bağımsız inceleme bekler. Full clean isteğinde önce yalnız ci:full-clean etiketi eklendiği doğrulandı; PR65 mergeable_state dirty/merge null nedeniyle yeni full clean run oluşmadı. Bu etiket kabul veya gerçek koşu sayılmaz. Frontend main kilidini çözerken kullanıcı kalan ST-03 geliştirmesine devam edilmesini istedi. Main/hosted güncellenmedi.

Manuel tahsilat payment snapshot/finance read adayıyla migration75 hazırlandı;215 callable korunur. Yerel yapısal157/157 geçti. Bağımsız incelemede SQL whitespace ile DTO ayrışması yakalandı; JS whitespace kümesini karşılayan denetim ve doğrudan native CHECK/helper tab/newline/NBSP/BOM assertionları eklendi. Native koşu yapılmadı; son inceleme ve main/development kabulü bundan türetilmez.

Kişisel takvim adayı5 yeni işlemle220 callable/0 contract_only/76 migration/90 core tabloya ilerler. Own-account credential komutları/global native Auth, private hash/pointer/history, canlı personal feed, RFC5545 encoder ve public-JWT HTTP adapter kaynakları hazırdır. Yerel yapısal162/162 (önceki157+5 calendar unit) geçti; bağımsız incelemede Starter session read sınırı ve iki yalancı negatif test düzeltildi. Native test aynı eski operation key replay'ini, geçerli boş VCALENDAR'ı, rotate/revoke/eskiURL ve erişim kaybını denetler; henüz çalıştırılmadı. CI fixture teknik key/origin'i yalnız loopback'te hazırlar; hosted adapter/route/secrets kurulmuş veya ST-03 kapanmış sayılmaz.

Takvim/public/manuel ödeme ara kaynağı tek12dk Vercel native VM'de denendi (`sbx_TctQ8tkZJYmMuxxz4aPYOEKc0THM`, Node24.22.1, Python3.14.4,2CPU/4GiB). Kaynak tar SHA256 `d0193966102761fea0c7532230b3c10c2e5241bfb29bf352de126b73a2abe840`; Edge SHA256 `8d9b0ab2491464a00cb8741f8effdc1ad8b01266111c605cd5ebe45ae674bc9e`.76 migration uygulandı; bunlar artık değiştirilmez. Gerçek native Auth/DataAPI/Edge/HTTP GET takvim explicit seçim/dedup/privacy, rotate/revoke/eski operation-key replay ve account/org/link kaybı alt testleri geçti. Hazırlık/provenance/peer/media, public alan seçimi ve manuel tahsilat reference/SQL CHECK alt testleri de geçti. Son kaynak native kabulü değildir: takvim selected-session negatif fixture'ı mevcut cd_sessions FK'sine uygun center_disciplines kaydını oluşturmadan session discipline değiştirmeye çalışıp23503 verdi. Assertion gevşetilmeden eksik inactive ilişki fixture'a eklendi. İzole ek sınır kontrolü VM timeout sırasında tamamlanamadı; düzeltme için yeni native/CI kanıtı bekler. VM otomatik kapandı, yeniden açılmadı; kaynak/runtime migration değişmedi.


ST-03 hazırlık/bildirim devam kaynağı katalogv6,221 callable/0 contract_only/78 migration/90 core tablo içerir. Yeni77 availability/package hazırlığı org→yeni merkez bir defalık kopya/provenance, reset ve gerçek availability/product/sale request çözümünü ekler;78 hazır olmayan email kanalının in_app tercihini değiştirmesini replay öncesi engeller ve typed bildirim kullanılabilirliğini döndürür.77/78 hiçbir ortamda henüz uygulanmadı; önceki76 immutable kalır. Yerel yapısal162/162 geçti. Bağımsız incelemede77 strict saat doğrulama bulgusu kapandı;78 ek bulgu yok. Bu native kabul değildir. Geliştirme DB'sinde salt okunur SELECT ile geçmiş succeeded email preference receipt sayısı0 doğrulandı; hosted veri/şema değiştirilmedi. İlgi/öneri, gece aşan availability, hazır marka assetleri ve gerçek takvim host/route/config kabulü açıktır. Frontend main kilidi devam ettiği için merge veya full clean başlatılmış sayılmaz.


ST-03 sonraki79/80 kaynak adayında221 callable/0 contract_only/80 migration/90 core tablo ve katalogv8 korunur.79 açık ilgi filtresini ve opt-in own-history takvim sırasını mevcut live authorization/keyset sayfalamasına bağlar;80 açık24:00 günlük bitişini ve bitişik UTC availability birleşimini, aynı pencerelerle resource-usage paydasını ekler. Yerel yapısal162/162 ve yeni native dosyaların JS syntax kontrolü geçti;79/80 henüz hiçbir native DB'ye uygulanmadı. İncelemede nonexistent-center fixture, DST timezone karşılaştırması ve rapor/schedule pencere ayrışması düzeltildi; bağımsız son kaynak incelemesinde ek bulgu yoktur. Starter pozitif ilgi, merged-own-history/no-show/başkasının geçmişi, opt-out/stale cursor ve gerçek session_create gece/boşluk/adjacent/DST testleri kaynağa eklendi, native geçiş iddiası yoktur. Main1f7f4a394c6ef8c50af0b292e23f457882370f77 ağacında hazır theme/font/brand asset kaynağı bulunmadı; değer uydurulmadı. Hosted/main/production güncellenmedi.


## PR65 güncel main uyarlaması — 28 Ekim 2026

Kullanıcının doğrudan BackendCoder talimatıyla mevcut `feat/starter-settings-consumers` dalına main `7acf33907accb27a00d535399960b2cf890a454c` normal merge ile alınır; ayrı ST-03 PR açılmaz. Başlangıç PR head `4a976b45a1cbf79313fb493d27aaa8fcda63751f`. Main'in [proof40733276779](https://github.com/SXQHex/FtkSaaS/actions/runs/40733276779), [merge proof40733276919](https://github.com/SXQHex/FtkSaaS/actions/runs/40733276919) ve [development delivery40733345673](https://github.com/SXQHex/FtkSaaS/actions/runs/40733345673) aynı SHA'da completed/success olarak GitHub'dan doğrulandı. Bu main kanıtı PR65'in yeni birleşik kaynağının kabulü değildir.

Yerel klasör boş ve terminal GitHub DNS erişimi kapalı olduğundan çalışma bağlı Vercel Sandbox üzerinde yeniden kuruldu: `ftk-st03-pr65-main-20261028`, session `sbx_5NMyFrZdZc0aJNPI0R985COkCln9`, Node24.22.1, pnpm12.15.0,4CPU/8GiB. Önceki `ftk-st03-calendar-native` stopped/persistent=false kaydı canlı checkout veya son kaynak native kabulü sayılmadı. İki yaşayan belge çakışması iki teslimin kayıtları korunarak çözüldü; frontend ve CI uygulaması güncel main ile aynıdır. Kararlar, runtime uygulaması, native test, uzak aday/main/development ve production kabulü ayrı kalır.

Birleşik kaynakta backend Turbo verify112 sözleşme/yönetişim +73 CI politika testiyle geçti; generator/TypeScript/migration manifest/audit kontrolleri başarılı. Belge kontrolü57 dosya/368 bağlantı geçti.80 migration yeni izole loopback DB'ye uygulandı; hosted DB reset/seed/değişikliği yapılmadı. İlk native koşuda yeni availability ve takvim-tercih fixture'larının kuruluş kapsamlı discipline_save_v1 isteğine center_id eklediği bulundu; yalnız bu üç istek kuruluş kapsamına düzeltildi, assertionlar ve DTO güvenlik kapısı korundu. Düzeltmenin native sonucu aşağıdaki devam kaydına aittir; eski koşu başarıya çevrilmez.

Onaylı renk/font asset kataloğu ve gerçek development takvim HTTP hostname/origin/session route/config değerleri önceki kullanıcı bağlamında da bulunamadı. Bunlar uydurulmadı; sistem fallback ve açık sağlayıcı/config sınırı korunur. Son kaynak bağımsız incelemesi ve yeni kaynak bağlı aday/main/development kabulü tamamlanmadan ST-03 kapanmaz.


### ST-03 native bulguları ve dar düzeltmeler

80 migration üzerindeki birleşik kaynak native denemesi merkez settings_get yanıtında preparation_sources alanının kaynak nesnesi yerine şablon dizisiyle tanımlandığını ve member katalog consumer enum'unda schedule_calendar_preferences değerinin eksik olduğunu buldu. Makine sözleşmesi düzeltildi; tip/validator/Edge/kataloglar üreticiden yenilendi, gerçek merkez yanıtı ve tüm katalog descriptor'ları için regresyon eklendi. Assertion veya güvenlik kapısı gevşetilmedi.

Takvim-tercih testinin Business fixture'ında bulunmayan cancellation policy açık sentetik kayıtla kuruldu. Availability ve takvim-tercih testlerinin org-only discipline komutuna center_id eklemesi düzeltildi. Yeni test modülleri mevcut takvim okuma, availability ve genel API suite'lerine dağıtıldı;15 suite envanteri, concurrency2 ve CI politika/denge kapısı değişmedi. Yeni gerçek uzak süre kabulü henüz yoktur.

Native denemede sözleşmedeki availability yönetim seçicisinin runtime'da eksik olduğu da görüldü. Uygulanmış80 migration değiştirilmeden81'inci ek göç hazırlanıp yalnız izole loopback DB'ye uygulandı; canlı CM/F02/resource kapsamı, dar typed projection, sürüm ve actor/selector bağlı sayfalama eklendi. Kaynak kaybı/yanlış cursor/receipt oluşturmama ve gerçek resolve→sürüm okuması→availability_save assertion'ları korunur. Hazırlık kabulü360sn toplam bütçede son alt testte iptal olduğundan sınır480sn'ye çıkarıldı; bu önceki iptal başarı değildir, iş akışı ve bütün assertionlar korunur. Yeni kaynak native ve uzak kabul sonuçları ayrı devam kaydındadır. Envanter221 callable/0 contract_only/81 migration/90 core tablodur.


82'nci göç, availability yönetim okumasının cursor as_of değerini ortak list envelope'unun ezmesini yalnız bu seçici için engeller; uygulanmış81 değiştirilmedi. Native82 availability kabulü6/6 geçti: canlı typed sürüm, iki sayfada sabit as_of, selector-cursor kapsamı, yabancı kaynak ve receipt oluşturmama; gece/gap/adjacent/DST ve rapor paydası birlikte doğrulandı. Bir önceki81 koşusu aynı as_of assertion'ında başarısızdı; yeni başarı ona taşınmaz. Önceki80 kaynağında kanonik göç3/3 ve gerçek HTTP kişisel takvim lifecycle5/5, sonraki düzeltilmiş takvim-tercih native kabulü6/6 geçti; bunlar final82 full clean değildir.

Son hazırlık fixture incelemesi iki ek yanlış beklentiyi kapattı: legacy notification receipt UUID parametresi açık uuid/text dönüşümüyle yazılır; program_preview başarı zarfındaki blocker ile program_apply gerçek RESOURCE_CONFLICT/no-write kabulü ayrı denetlenir. Bu davranış mevcut program lifecycle kabulüyle aynıdır; assertion kaldırılmadı.480sn'de son güvenlik alt testi yine iptal olduğundan tek hazırlık fixture toplam bütçesi600sn olarak sınırlandı; süre denge kapısı değiştirilmedi. Son değişikliklerin tüm hazırlık akışındaki kabulü yeni kaynak full clean'ine bağlıdır. Envanter221 callable/0 contract_only/82 migration/90 core tablodur. Onaylı assetler, gerçek takvim development config/route ve son bağımsız inceleme/main/development kabulü açık kalır.

## PR78 kapanışı ve PR65 süre blokajı düzeltmesi — 28 Ekim 2026

PR78 head629abf6bd73dff7b4ea1a6316a33c246a4e746d7 /base5bebc8f0fb6c89e1d67648fb06a2db729a4f489b için aday40718912135 attempt1 başarılı; kullanıcı kaynak bazlı kurulum ve tek seferlik yönetici istisnasını açıkça onayladı. Normal merge main `7acf33907accb27a00d535399960b2cf890a454c` aynı parent/tree ile doğrulandı. [Main proof40733276779](https://github.com/SXQHex/FtkSaaS/actions/runs/40733276779) ve [development CD40733345673](https://github.com/SXQHex/FtkSaaS/actions/runs/40733345673) attempt1 completed/success; deploy ve hosted kontrol adımı başarılı. Geçici bypass hemen kaldırıldı; kurallar/hedef değişmeden active ve bypass boş readback doğrulandı.

Kullanıcının yeni üretim önceliği, süre optimizasyonunun merge’i engellemesini kaldırır. [PR65 attempt1](https://github.com/SXQHex/FtkSaaS/actions/runs/40743048028/attempts/1) head3b706b513530bdd514d4ae20e0dabc8fbabb981f için bütün fonksiyon/core/API testleri başarılı; collector yalnız ratio1.412/gap475s nedeniyle başarısız. Latest job API’si sonraki attempt3’ü döndürdüğünden ilk teşhiste görülen source/attempt mismatch ayrı rerun durumuydu; explicit attempt1 API ve collector123024708030 loguyla asıl neden doğrulandı. Tarihsel başarısız koşu korunur.

Ayrı dar `ci/balance-advisory` düzeltmesi süreyi warning/report yapar; ölçüm yokluğu da tek başına kabulü engellemez. Gerçek test job/step başarısı, coverage, trusted workflow ve head/base/tree/run/attempt zorunlulukları değişmez. Suite/runtime/API/frontend değişikliği yoktur; suite bölme/tekrar/fixture optimizasyonu ertelidir ve üretim kuyruğunu bloke etmez. Yeni kaynak yerel/inceleme/uzak kabulü ve kurulum ayrıca gerekir.

Dar advisory düzeltmesinin yerel kabulü:106 contract/governance +74 CI politika testi, migration/generator/TypeScript/audit ve57 dosya/355 belge bağlantısı başarılı. Collector integration testi dengesizlik ve eksik süre ölçümünde binding üretildiğini; failed gerçek test veya farklı binding attempt’inde binding üretilmediğini doğrular. Kaynak bağlı uzak kabul henüz tamamlanmadı.

## PR65 PR80 sonrası kaynak eşitlemesi — 28 Ekim 2026

Kullanıcının PR65'i güncel main ile birleştirme ve yeniden full clean başlatma talimatıyla main `48d96bf6782b3e20321806e94b6fd44ea4054375` mevcut ST-03 dalına normal merge ile alındı. Yalnız devir ve sıra belgelerindeki çakışmalar iki teslimin kayıtları korunarak çözüldü. PR80'in advisory süre politikası ve tüm CI kaynakları main ile birebir korunur; backend runtime, test assertionları, üretilmiş sözleşme/envanter ve frontend kaynaklarında ek değişiklik yoktur. Önceki PR65 fonksiyon başarısı yeni kaynak kabulü sayılmaz; yeni aday full clean beklenir. ST-03'ün mevcut açık kabul/asset/config işleri korunur; bu eşitleme kapanış veya production yetkisi değildir.

Birleşik kaynak backend Turbo verify114 sözleşme/yönetişim +74 CI politika testiyle geçti; generator/migration manifest/TypeScript/audit ve57 dosya/368 bağlantı kontrolü başarılı. Base48d96bf için [main proof40756010404](https://github.com/SXQHex/FtkSaaS/actions/runs/40756010404), [merge proof40756010535](https://github.com/SXQHex/FtkSaaS/actions/runs/40756010535) ve [development delivery40756068943](https://github.com/SXQHex/FtkSaaS/actions/runs/40756068943) completed/success GitHub’dan doğrulandı; bunlar PR65’in yeni aday kabulü değildir.

## ST-03 organizasyon renkleri — 28 Ekim 2026

Başlangıç main09433e61463eada6c109f08671a0e43dc0bc6227; PR65 aday40757052042, aynı main proof40763721022/merge proof40763721243 ve development CD40763772477 başarılı doğrulandı. Hosted katalog salt okunur kontrolde paket alanlarını null-only doğruladı. Son kullanıcı kararı hazır renk/font katalog koşulunu kaldırır; theme_package_id/font_package_id aynen null-only kalır. Yeni üç organizasyon rengi sözleşme/katalogv9 ve83'üncü ek migration adayıdır; Owner/OM, version/replay/history/reset zinciri ve merkez override yasağı korunur. Eski uygulanmış migrationlar değişmez. Yeni kaynak native/full clean ve hosted kabulü ayrı beklenir. Sonraki iş gerçek takvim HTTP host/route/config kabulüdür; bilinmeyen host/config uydurulmaz.

Yeni renk kaynağı yerel backend verify115 contract/governance +74 CI politika testiyle geçti; üreteç/TypeScript/migration manifest/audit,57 dosya/369 bağlantı ve SQL/PLpgSQL parse başarılı. Bağımsız inceleme migration string/fixture sırası/paylaşılan patch-history required bulgularını yakaladı; üçü düzeltildi ve son kaynakta açık P1/P2 kalmadı. Yeni native renk kabul testi kaynakta, henüz çalıştırılmadı; uzak full clean beklenir. Mevcut hosted DB değiştirilmedi.

### PR81 ilk uzak kabul ve test düzeltmesi — 29 Ekim 2026

Aday40766721164 attempt1 head491dbd022e23d7144e140d08b88a6a2925b3424b başarısız: core/API2/API3 geçti; API4 hazırlık testi katalogv8 beklerken gerçek v9 döndü. API1 mevcut frontend-settings fixture toplam300sn sınırına yeni renk alt testi eklendiği için son field round-trip sırasında iptal oldu. Renk lifecycle aynı dosyada bağımsız Auth/org fixture ile ayrı test yapıldı;300sn/120sn sınırları ve renk/assertion kapsamı korunur. Hazırlık beklentisi gerçek katalogv9 olarak güncellendi. Runtime/migration/CI/shard/envanter değişmedi; yerel verify115+74 ve belge kontrolü geçti; yeni kaynak full clean gerekir. Gerçek takvim host/route/config kabulü sonraki adımdır.

## PR81 kabulü ve gerçek takvim bağımlılığı — 29 Ekim 2026

PR81 normal merge main `a09f39a54be27aca6d6b2feccfb7e72b8e4977d7`; aday [40772289904](https://github.com/SXQHex/FtkSaaS/actions/runs/40772289904) attempt1 core/dört API/toplayıcı başarılı. Aynı main [proof40776981034](https://github.com/SXQHex/FtkSaaS/actions/runs/40776981034), [merge proof40776981050](https://github.com/SXQHex/FtkSaaS/actions/runs/40776981050) ve [development delivery40777033554](https://github.com/SXQHex/FtkSaaS/actions/runs/40777033554) completed/success GitHub'dan doğrulandı. Geliştirme Supabase katalog salt-okuma sorgusu organization primary_color/secondary_color/accent_color alanlarının tam #RRGGBB veya null/default null olduğunu; theme_package_id/font_package_id alanlarının aynen null-only kaldığını doğruladı. Renk dilimi main/development kabulü tamamlandı; bu ST-03 kapanışı değildir.

Kullanıcı gerçek seans ekranının henüz olmadığını doğruladı. Takvim host/route/config gerçek kabulü bu ekrana bağlı açık iş olarak korundu; var olmayan route veya yalnız login yönlendirmesi ile kabul üretilmez. Backend altyapısı ve önceki native kanıt korunur; yeni hosted takvim config/deploy veya gerçek route kabulü yapılmadı. Tüketici devri/backlog/sıra birlikte eşitlendi. OPS-01/REL-01 bu belge işiyle başlatılmaz; production değişikliği yoktur.

## OPS-01 başlangıç denetimi — 29 Ekim 2026

Kullanıcı OPS-01'i takvim/frontend bağımlılığının önüne aldı; ardından REL-01 ve CI-ADMIN doğrulanacak. Başlangıç main4cb29f7601413656e808c2f9b3b95502a6bc9f5b PR82 belge merge'idir; önceki backend main a09f39a54be27aca6d6b2feccfb7e72b8e4977d7 proof/CD kabulü yukarıda korunur. Hosted salt-okuma sağlık sorgusunda p01/p05/p06/p07/p07_privacy enabled/healthy/idle ve claimed/succeeded/failed0; beş cron5sn active görüldü. Bu gerçek iş yükü kanıtı değildir. GitHub ruleset26040398 güncel readback active, strict required ftksaas/merge-clean integration15368, merge-only, deletion/non-fast-forward koruması ve bypass_actors boş; yönetim ayarı değiştirilmedi. Eski negatif kabul yeni bir test diye sunulmaz.

OPS-01 ilk aday yalnız mevcut native scheduler acceptance testini gerçek üç işlik backlog, geç domain hata/rollback/retry ve bekleyen işte disable/rebind/yeni session restart ile güçlendirir. Runtime/API/migration/üretilmiş envanter/F01–F33 davranışı değişmez. Fiziksel silme worker'ı mevcut kaynakta partial/retry_wait manifest aşamasıdır; database/Auth/Storage/export/backup gerçek imhası kanıtlanmadı. Sözleşmede geçici saklama varsayılanları vardır; eksik olan uygulama ve imha/restore non-resurrection kanıtıdır. OPS-01/REL-01 tamamlanmış sayılmaz.

İlk OPS test kaynağı yerel backend verify115 contract/governance +74 CI politika testiyle geçti; generator/manifest/typecheck/audit,57 dosya/371 bağlantı ve syntax/diffcheck başarılı. Bağımsız kaynak incelemesinde açık P1/P2 yoktur. Native yeni testler yerelde Docker olmadığı için çalıştırılmadı; kaynak bağlı full clean beklenir. Bu sonuçlar fiziksel imha, hosted iş yükü veya REL-01 kapanışı değildir.


## REL-01 izole hosted geri dönüş ara kanıtı — 29 Ekim 2026

Kullanıcı ayrı hedef oluşturmayı ve gerekli kimlik/yapılandırma bilgilerinin yalnız özel yerel dosyalarda kullanılarak izole hedefe aktarılmasını onayladı. Kaynak geliştirme projesi değiştirilmedi. İzole hedef `gctmlkohhbwpimgxubzj` üzerinde83 kaynak migration kaydı ve iki teknik restore kaydı,90 core/76 private tablo,606 uygulama fonksiyon/prosedür tanımı ve güvenlik hash eşitliği önceki restore kontrolünde doğrulandı. Auth/core/private/Storage snapshot'ında199 tablo/302 satır kanonik içerik eşitliği vardı; bu yükleme sonrası temel karşılaştırmadır, sonraki Auth oturum testleri Auth session tablolarını doğal olarak değiştirir.

`backend-v1` izole hedefte sürüm1 ACTIVE ve verify_jwt=true readback ile doğrulandı. JWT eksik/geçersiz istekler401 döndü. Geri yüklenen dört doğrulanmış kullanıcı için e-posta göndermeyen native magiclink verify ile gerçek session açıldı; kimlik UUID'si değişmedi ve gerçek account_get_v1 Edge→service-only RPC çağrısı dört kullanıcıda başarılı oldu; test oturumlarına logout uygulandı. Bu parola/Google/SMTP teslim testi değildir.

Kaynak Storage snapshot'ında nesne yoktur. Hedefte özel geçici bucket ve4096 bayt sentetik dosya ile gerçek upload/download, delete, cache-busting URL'de400 absence, özel yerel kopyadan restore ve SHA256 eşitliği doğrulandı; test dosyası/bucket temizlendi. İlk aynı URL okuması silmeden sonra cached içerik döndürdü; cache purge yeteneği hedefte kapalıdır. Bu sınırlama fiziksel imha veya cache/backuplardan silinme kabulüyle karıştırılmaz.

Auth yapılandırmasının20 farklı yazılabilir alanı aktarıldı;18 alan ilk readback'te eşleşti. Google secret/SMTP password ve beş FTK Edge secret değerinin API'de yalnız digest olarak döndüğü saptandı. Digest'lerin yanlışlıkla gerçek secret gibi hedef Auth'a yazılması düzeltildi: Google devre dışı bırakıldı ve SMTP credential/host temizliği doğrulandı; kaynak etkilenmedi. Asıl secret değerleri olmadan provider ve tam config restore kabulü açık kalır. Kaynak/hedef Storage feature farkları da açıktır; ücretli yetenek açılmadı. Özel snapshot/credential/session dosyaları kaynaklara eklenmedi.

Bu ara hosted kanıt OPS-01 fiziksel imha veya REL-01 kapanışı, RPO/RTO/yük kabulü, son PR83 kaynak full clean veya main/development kabulü değildir. Yeni full clean tetiklenmedi.


### İzole worker/Auth/yük ek kanıtı — 29 Ekim 2026

Geçici hedef Cron görevi gerçek ftk_ops_p06 LOGIN kimliğiyle15 başarılı tick üretti. Lane disabled iken üç gerçek report_export_start_v1 işi pending kaldı; enabled sonrası üçü de attempts1/succeeded ve birer export payload üretti; yetkili job_status_get_v1 sonuçları doğrulandı. Bir dosyanın expiry'si yalnız izole hedefte öne alındı; sonraki native tick aktif private.p06_export_files satırını kaldırdı, diğer iki canlı payload korundu. SQL satır yokluğu MVCC/WAL/backup fiziksel bayt imhası değildir. İlk temizlik çağrısı görev sahipliği nedeniyle hata verdi; görev sahibi rolüne dar geçici provisioning ile geçilip görev kaldırıldı ve geçici üyelik/cron erişimi geri alındı. Son readback test Cron sayısı0, p06 enabled=false/idle/error null/claimed3/succeeded3. Kaynak projeye dokunulmadı.

Ayrı sentetik native Auth kimliğinde gerçek parola girişi, delete öncesi global session revoke ve should_soft_delete=false ile hard delete denendi. Son sorguda auth.users/identities/sessions/refresh_tokens satırları0; eski JWT ile gerçek Edge account_get_v1 AUTH_REQUIRED/401 ve eski parola ile giriş400 döndü. Bu provider aktif DB/erişim kabulüdür; uygulama privacy worker'ının orkestrasyonu veya backup/WAL imhası değildir. Dört geri yüklenmiş gerçek kimlik silinmedi.

Uzak HTTPS istemciden concurrency4, işlem başına3 warmup ve40 örneklik ilk ölçüm: organizations_list p95 5298ms/hata0 (1000ms hedefi başarısız), calendar_get p95 812ms/hata0 (2000ms hedefi başarılı). İlk warmup paralel bağlantı havuzunu ısıtmadığı için tanı koşusu ayrıca kaydedildi:12 paralel warmup,80 örnek/işlem, concurrency4 ile organizations_list p95 768ms/hata0 ve calendar_get p95 627ms/hata0. İlk hata korunur; ısınmış sınırlı okuma testi geniş veri/soğuk başlangıç, mutation veya report start SLA kapanışı değildir.

PR83 test kaynağı dar aktif export payload cleanup, canlı CSV'nin HTTP üzerinden DB'deki baytlarla birebir eşitliği ve expired download reddini de denetler. Yerel verify115 contract/governance +74 CI politika testi,83 migration manifest/generator/typecheck/audit ve57 dosya/371 belge bağlantısı geçti. Yeni native testin uzak full clean kabulü henüz yoktur. Genel privacy purge/retention/backup non-resurrection uygulaması, gerçek provider secret/config ve tam RPO/RTO/yük kabulü açık kalır; PR83 merge edilmedi ve yeni clean tetiklenmedi.


### PR83 ilk yeni kaynak CI hatası ve dar düzeltme — 29 Ekim 2026

Aday40859842984 attempt1 head a8bc4d228aaa87f4289935946b99c00d3e22e94f için core/API2/API3/API4 başarılı, API1 başarısız. Retry testinde bigint attempts sürücüden string döndüğü için numeric deepEqual yanıldı; assertion öncesi kurulu fault trigger kaldırılmadan alt test sonlandı ve sonraki expiry/restart testlerini de bozdu. İki sorguda yalnız test projection'ı attempts::int olarak düzeltildi; fault trigger temizliği alt test try/finally sınırına alındı. Beklenen retry_wait/attempt1, zero file, health error ve retry sonrası succeeded/attempt2/tek dosya assertionları korunur. Runtime/migration/API/CI/shard/timeout değişmez. İlk başarısız koşu başarı sayılmaz; yeni kaynak bağımsız inceleme ve full clean bekler. Genel privacy/retention/backup non-resurrection ve REL-01 açık işleri bu dar düzeltmeyle kapanmaz.


### PR83 export fixture sözleşme düzeltmesi — 29 Ekim 2026

Aday40867303163 attempt1 head323dbb57e4cb7a7f3903e09e66b77622fd405307 için core/API2/API3/API4 geçti; API1 yalnız yeni export expiry testinde report_file_get_v1 VALIDATION_FAILED ile kaldı. Retry sayısı ve fault-cleanup düzeltmeleri bu koşuda geçti. Yeni testin metadata, HTTP CSV ve expired-result çağrıları sözleşmedeki required operation_key alanını atlamıştı; üç çağrı da ayrı gerçek UUIDv7 operation_key ile düzeltildi. Byte equality, expired-result reddi ve payload yokluğu assertionları korunur; runtime/API sözleşmesi/migration/CI/timeout değiştirilmedi. Eski başarısız koşular başarı sayılmaz; yeni kaynak kabulü ve genel privacy/REL işleri açık kalır.


## WEB-01 tasarımın ana uygulamaya taşınması — 29 Ekim 2026

PR85 tasarım kaynağı normal merge ile main `522df4777c29c8d2128b4434fbd69cfdc25f4453` oldu. Aynı kaynakta [frontend40889593015](https://github.com/SXQHex/FtkSaaS/actions/runs/40889593015), [main proof40889593534](https://github.com/SXQHex/FtkSaaS/actions/runs/40889593534), [merge proof40889593155](https://github.com/SXQHex/FtkSaaS/actions/runs/40889593155) ve [development delivery40889670656](https://github.com/SXQHex/FtkSaaS/actions/runs/40889670656) success doğrulandı. Vercel `ftksaas-web` ilk yayını bu kaynaktan READY; bu durum yeni Auth adayı veya gerçek hesap akışı kabulü değildir.

Kullanıcı yerleşimi başlangıç için onayladı, eski tasarım/Auth sayfalarının kaldırılmasını ve atıl üye alan adının kullanılmasını istedi. Ayrı `feat/live-admin-auth` adayı ortak login-02/signup-02 düzenini, yeni kayıt ekranını ve korumalı yönetici kabuğunu içerir. Eski seçicili bağlantı ekranı kaldırıldı; gerçek hesap/stüdyo okumaları kullanılır. Henüz bağlı olmayan iş modülleri sentetik kayıt yerine hazırlık durumu gösterir. Backend/API/CI-politika kaynakları değişmez.

Yerel `pnpm check:frontend` başarılı: 24 web ve1 UI testi, lint/format/typecheck/build. `pnpm test:frontend:e2e` çağrıldı fakat48 senaryo tarayıcı executable dosyaları bulunmadığından başlatılamadı; bu koşu başarı değildir. Uzak frontend tarayıcı ve kaynak bağlı aday/main kabulü beklenir.

`uye.fethiyetango.com` Vercel’de `ftksaas-web` projesine bağlı ve verified=true; mevcut Cloudflare CNAME doğru Vercel hedefine yönelir. Production environment, mevcut geliştirme Supabase URL/publishable key ve bu origin için hazırlandı. Supabase Dashboard readback iki kesin callback kaydını doğruladı: `/auth/callback` ve `/auth/callback?next=/parola-yenile`. Site URL hâlâ `https://ftksaas.vercel.app/`; kullanıcı kalan Supabase işlerini devraldı ve yeni Site URL olarak `https://uye.fethiyetango.com` kaydetmesi tarif edildi. Yeni kaynak dağıtılmadı. Gerçek giriş/kayıt/e-posta/Google/TOTP kabulü ve tüm WEB-01 bu hazırlıkla kapanmaz.


### PR86 Safari tema geçişi düzeltmesi — 29 Ekim 2026

Head `65c815d5ee318729562aa43ecb267488a55f8222`, base `522df4777c29c8d2128b4434fbd69cfdc25f4453`, tested merge `3f8881be6632063042c027133f939a044866ccd9` için [aday40900062281](https://github.com/SXQHex/FtkSaaS/actions/runs/40900062281) success; [frontend40900062447](https://github.com/SXQHex/FtkSaaS/actions/runs/40900062447) failure. Checks ve Chromium/Firefox12/12 geçti; WebKit/mobil11/12 ile aynı yeni kayıt/kurtarma axe testi başarısız oldu. Test, provider durumunu atlayarak dark sınıfını doğrudan değiştiriyordu; Select metni geçişte koyu arka plan üzerinde eski koyu rengini taşıdı.

Dar düzeltme next-themes’in yerleşik `disableTransitionOnChange` seçeneğini açar; test görünüm seçicisinden açık/koyu tema seçer ve hem sınıfı hem color-scheme değerini doğruladıktan sonra mevcut eksiksiz axe kontrolünü çalıştırır. Kontrast eşiği/kural kapsamı, retry/timeout veya CI değiştirilmez. Yeni kaynak uzak kabulü beklenir; merge/yayın yapılmadı. Kullanıcı kalan Supabase hazırlığını tamamladığını bildirdi; ek platform değişikliği yapılmadı.


## PR86 main/yayın kabulü ve Starter frontend başlangıcı — 29 Ekim 2026

Önceki PR86 aday/yayın-bekliyor notlarının sonraki durumu: PR86 normal merge ile main `68e5696edc21a0a1ea613e17e90747bb8607b6b0` kaynağına alındı. Aynı SHA’nın [frontend40930658787](https://github.com/SXQHex/FtkSaaS/actions/runs/40930658787), [main proof40930658768](https://github.com/SXQHex/FtkSaaS/actions/runs/40930658768), [merge proof40930658772](https://github.com/SXQHex/FtkSaaS/actions/runs/40930658772) ve [development delivery40930729324](https://github.com/SXQHex/FtkSaaS/actions/runs/40930729324) completed/success olduğu yeni iş başlangıcında tekrar doğrulandı. Dört Playwright tarayıcı matrisi geçti.

Önceki yayın kontrolünde Vercel production `dpl_8vWHYQuuKEekT6fw2Z7VjmbLBGDK` aynı main kaynağında READY; `uye.fethiyetango.com` alias’ı bağlıdır. Giriş/kayıt/kurtarma sayfaları HTTP200 verdi. Kullanıcı kalan Supabase hazırlığını tamamladığını bildirdi. Gerçek hesapla kayıt/e-posta/Google/TOTP uçtan uca kabulü bu HTTP kontrollerinden türetilmez. Bu yeni frontend çalışmasında provider/DNS değiştirilmedi.

Kullanıcı Syncfusion React Scheduler’ı seçti ve `frontend-design` ile Starter planının frontend’de eksiksiz tamamlanmasını ilk hedef yaptı. Yeni `feat/session-calendar-ux` dalı yukarıdaki başarılı main’den açıldı. İlk kaynak adayı ortak `SessionCalendar`, gerçek sayfalı calendar/session okumaları, merkez saat dilimi, arama/gün/hafta/liste ve güncel detay panelidir. Sentetik `/tasarim` aynı sunum bileşenini kullanır; gerçek API hatası örnek veriye dönüşmez. Syncfusion tipleri adaptör içinde, yazma ve iş kuralları backend’dedir; bu aday program/rezervasyon/yoklama yazması yapmaz.

Bu bölüm yeni adayın CI/main/hosted kabulünü veya bütün Starter’ın tamamlandığını iddia etmez. Eksik lisans anahtarında takvim listesi çalışır; Scheduler çizelgesi için sürüme uygun Community License anahtarı ve gerçek tarayıcı kabulü ayrıca gerekir. Kalan işler ve sıra kendi tek kaynaklarında tutulur.


Yerel ilk kaynak doğrulaması: `env -u NODE_USE_ENV_PROXY pnpm check:frontend` lint/format/typecheck/build,31 web ve1 UI testiyle geçti; `test:isolation` backend testi çalıştırmadan görev ayrımını doğruladı. Ortamın Node ağ proxy’si MSW testlerini ilk denemede timeout’a uğrattı; aynı testler yalnız test sürecinde proxy devre dışıyken geçti. Eski yerel Next build önbelleği temizlendikten sonra production build geçti. Test eşikleri/timeout/CI değiştirilmedi.

`67e378822107b744f52a1c499821f8c6dfbfb1ad` kaynaklı Vercel preview `dpl_Ama4w5EiaTKPj6wk99dCsADwank5` READY. Sentetik `/tasarim` üzerinde gerçek Chrome ile hafta araması18→6 kayıt, seans Sheet/kontenjan ve390px koyu/320px açık görünümde yatay taşma olmaması doğrulandı. Browser tercihi/viewport test sonunda eski haline getirildi. Bu gerçek API hesabı veya lisanslı Scheduler kabulü değildir. Sonraki fark yalnız E2E testinin “Bugün” seçicisini takvim bölgesine daraltır; uygulama kaynağı değişmez. Dört tarayıcı matrisi ve yeni aday/main kabulü CI’da ayrıca beklenir.


### PR87 ilk frontend CI hatası ve dar düzeltme — 29 Ekim 2026

Head `f88ce29d60ac2e173307dec26c047264f1c651aa`, base `68e5696edc21a0a1ea613e17e90747bb8607b6b0`, tested merge `736d15b291d1529a48f5a12dd32c38318c80eb4c` için [aday40938068645](https://github.com/SXQHex/FtkSaaS/actions/runs/40938068645) ve [frontend uyumluluk40938068701](https://github.com/SXQHex/FtkSaaS/actions/runs/40938068701) success; [frontend40938068643](https://github.com/SXQHex/FtkSaaS/actions/runs/40938068643) failure. Checks geçti; dört tarayıcıda11/13 geçti. İki ortak hata: takvim günü düğmesinin gizli tam tarih metni accessible name ile uyuşmadığı için axe label-content-name-mismatch;320px İngilizce %200 metinde yatay taşma.

Dar düzeltme gün adını görünen iki span üzerinden aria-labelledby ile kurar; tam tarih açıklaması düğme dışında benzersiz useId kimliğiyle tutulur. Kontenjan rozeti ve ok dar alanda satır atlayabilir; font küçültülmez ve taşma saklanmaz. İki dilde gerçek takvim bileşeninin ad/açıklama ayrımı regresyonu eklendi. Aynı sayfa genişliği assertion'ı ve bütün axe kuralları korunur; genişlik hatasına yalnız route/taşan öğe tanısı eklendi.

İlk düzeltme kaynağı yerel frontend lint/format/typecheck/build,33 web ve1 UI testiyle geçti. Yerel Playwright tarayıcısı indirilerek iki başarısız senaryo denenmek istendi; container socket izni Chromium'u sayfa açılmadan durdurdu. Bu yerel E2E başarı değildir; sandbox/CI politikası değiştirilmedi. Yeni kaynak aynı uzak dört tarayıcı kabulü bekler; PR87 Draft ve merge edilmemiştir.
