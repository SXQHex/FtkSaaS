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
