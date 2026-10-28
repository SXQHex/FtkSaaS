# Güncel kaynak ve kabul

Bu dosya güncel backend kabulünün tek kaynağıdır. Ürün davranışı 01/02 ve kabul kararlarında; açık iş docs/remaining-work.md içindedir. Tarihsel aday notları güncel statü olarak taşınmaz.

## ST-02 kapanışı — 28 Ekim 2026

Son kabul edilmiş backend main: `19189d74e7feb1f03cfbd4e05b9132b2c71e4926`, [PR63](https://github.com/SXQHex/FtkSaaS/pull/63). Head `398c34dccb140b2763ba4907d642b05a41fbe4ab`, base `1c15ac8c43b4acc07e129b970e49801ebaf16d10`, tested merge `529bf58a86986ac8a883106a919520bbb658808b`, tree `97ea9416a20c041cdb16498e1960f8d14fb8426d`. Actual main aynı iki parent ve tree ile doğrulandı. Son tree bağımsız incelemesinde açık bulgu yok; ilk P2 outbox teslim kanıtı düzeltildi. İnceleme kaydı PR63 açıklamasındadır.

[Aday40574962716](https://github.com/SXQHex/FtkSaaS/actions/runs/40574962716), [aynı main40580037633](https://github.com/SXQHex/FtkSaaS/actions/runs/40580037633) ve [development CD40583510430](https://github.com/SXQHex/FtkSaaS/actions/runs/40583510430) attempt1 completed/success. Main source/core/API1–4/toplayıcı ve CD source/deploy/hosted doğrulama adımları geçti. CD receipt artifact12771360001, SHA256 `216a2d150fd0c2ec26b274117deec4ea995a02231e12274dd4f1fba73d0c717d`.

ST-02 kapandı: Starter gerçek CSV→preview→apply→hak/borç→tahsilat→self rezervasyon/yoklama→temel rapor/CSV ve işlemsel inbox zinciri kabul edildi. P05 pending→succeeded, worker sonucu ve tam bir bağlı receipt ayrıca denetlenir. Canlı yetki kaybı, current/consumed preview, satır rollback/kota ve replay korundu. Runtime API/migration/plan/CI politikası değişmedi; envanter213 callable/0 contract_only/68 migration/90 core tablo kaldı. [Alan devri](../p06-handover.md#starter-tüketici-kabulü--st-02).

Development kabulü production kabulü değildir. Frontend/public sağlayıcı, ST-03/OPS-01/REL-01 bu kapanıştan türetilmez. Sonraki sıra başlatılmadı. İptal edilmiş hedefli koşular başarı sayılmaz; son kaynak bağlı aday/main full clean esas alınır.

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

## PR78 kapanışı ve PR65 süre blokajı düzeltmesi — 28 Ekim 2026

PR78 head629abf6bd73dff7b4ea1a6316a33c246a4e746d7 /base5bebc8f0fb6c89e1d67648fb06a2db729a4f489b için aday40718912135 attempt1 başarılı; kullanıcı kaynak bazlı kurulum ve tek seferlik yönetici istisnasını açıkça onayladı. Normal merge main `7acf33907accb27a00d535399960b2cf890a454c` aynı parent/tree ile doğrulandı. [Main proof40733276779](https://github.com/SXQHex/FtkSaaS/actions/runs/40733276779) ve [development CD40733345673](https://github.com/SXQHex/FtkSaaS/actions/runs/40733345673) attempt1 completed/success; deploy ve hosted kontrol adımı başarılı. Geçici bypass hemen kaldırıldı; kurallar/hedef değişmeden active ve bypass boş readback doğrulandı.

Kullanıcının yeni üretim önceliği, süre optimizasyonunun merge’i engellemesini kaldırır. [PR65 attempt1](https://github.com/SXQHex/FtkSaaS/actions/runs/40743048028/attempts/1) head3b706b513530bdd514d4ae20e0dabc8fbabb981f için bütün fonksiyon/core/API testleri başarılı; collector yalnız ratio1.412/gap475s nedeniyle başarısız. Latest job API’si sonraki attempt3’ü döndürdüğünden ilk teşhiste görülen source/attempt mismatch ayrı rerun durumuydu; explicit attempt1 API ve collector123024708030 loguyla asıl neden doğrulandı. Tarihsel başarısız koşu korunur.

Ayrı dar `ci/balance-advisory` düzeltmesi süreyi warning/report yapar; ölçüm yokluğu da tek başına kabulü engellemez. Gerçek test job/step başarısı, coverage, trusted workflow ve head/base/tree/run/attempt zorunlulukları değişmez. Suite/runtime/API/frontend değişikliği yoktur; suite bölme/tekrar/fixture optimizasyonu ertelidir ve üretim kuyruğunu bloke etmez. Yeni kaynak yerel/inceleme/uzak kabulü ve kurulum ayrıca gerekir.

Dar advisory düzeltmesinin yerel kabulü:106 contract/governance +74 CI politika testi, migration/generator/TypeScript/audit ve57 dosya/355 belge bağlantısı başarılı. Collector integration testi dengesizlik ve eksik süre ölçümünde binding üretildiğini; failed gerçek test veya farklı binding attempt’inde binding üretilmediğini doğrular. Kaynak bağlı uzak kabul henüz tamamlanmadı.
