# Güncel kaynak ve kabul

Bu dosya güncel backend kabulünün tek kaynağıdır. Ürün davranışı 01/02 ve kabul kararlarında; açık iş docs/remaining-work.md içindedir. Tarihsel aday notları güncel statü olarak taşınmaz.

## Son kabul edilmiş backend

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

## Aktif frontend çalışması

Yerel başlangıç kaynağı main `1c15ac8c43b4acc07e129b970e49801ebaf16d10` (PR62 monorepo). Aynı kaynağın [main kabulü40542200511](https://github.com/SXQHex/FtkSaaS/actions/runs/40542200511) ve [development CD40546616984](https://github.com/SXQHex/FtkSaaS/actions/runs/40546616984) başarılı olarak canlı doğrulandı; bu kanıt yerel frontend değişikliklerine taşınmaz.

Kullanıcının 28 Ekim kararları: yalnız FtkSaaS bağlam içindedir; önce shadcn/ui/hazır bloklar ve tüm frontend test altyapısı; TypeScript7 korunur; frontend/backend testleri ayrı tetiklenir; backend kodu ve mevcut backend CI/kabul kaynakları frontend görevinin yetkisinde değildir. Çalışma dalı feat/frontend-foundation. apps/web ve packages/ui yeni frontend temelidir; native Auth ve typed Edge tüketimi mevcut development projesini hedefler.

Yerel pnpm check:frontend lint + TypeScript7.0.2 typecheck +11 web/1 UI testi +Next16.4.3 production build ile geçti; Turbo dry-run iki yönlü paket/test ayrımını doğruladı; backend importer ve100 transitif lockfile snapshot’ı değişmedi. Public Playwright testleri Chromium/WebKit/mobilde9/9 geçti. Firefox1555 tarayıcı açılmadan macOS profil erişim hatası veriyor; Firefox kabulü açık ve CI projesi korunuyor. Kullanıcı 28 Ekim’de gerçek giriş sonrası “Merhaba, …” başlığı ve kuruluş seçicisinin açıldığını doğruladı. Bu kullanıcı doğrulamasıdır; ajan aynı oturumun veri/rol/tenant zincirini bağımsız gözlemlemedi. Google/TOTP/kurtarma ve kapsamlı ekran→Edge→DB kabulü açık; mock/public testler bunların kanıtı değildir.

Frontend değişiklikleri feat/frontend-foundation aday dalındadır; yeni kaynak için uzak CI/merge kabulü henüz yoktur. Kullanıcı 28 Ekim’de bu dalın push edilmesini istedi. Mevcut backend tetikleyicileri frontend push/merge’lerinde de çalışabilir; bu push talimatı backend kodunu veya kabul politikasını değiştirme yetkisi vermez. Backend sahibinin [CI kapsam/kabul devrini](../frontend-backend-ci-handover.md) tamamlaması gerekir. Güncel frontend araç/komut kuralları [frontend devrindedir](../frontend-development.md).

[Kaynak indeksi](../source-index.md), [tek backlog](../remaining-work.md), [aktif sıra](../production-queue.md), [taşıma/ortam devri](../monorepo.md). Önceki uzun devir checkpointleri Git geçmişinde `af06a64` sürümünde korunur; tarihsel reports/ dosyaları değişmez.
