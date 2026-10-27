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
