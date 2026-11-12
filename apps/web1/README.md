# FtkSaaS V2 frontend temeli

`apps/web1`, pnpm workspace dışında bağımsız bir npm projesidir. Bu aşama ürün modülleri veya backend entegrasyonu içermez. Komutları bu dizinde çalıştırın; kök manifestleri ve V1 uygulamalarını kullanmayın.

## Kurulum ve yerel çalışma

Node.js 24 LTS (en az 24.13) ve npm 11 kullanın. Kilitli sürümler `package-lock.json` içindedir.

```sh
cd apps/web1
mkdir -p .tmp
export npm_config_cache="$PWD/.npm-cache"
export TMPDIR="$PWD/.tmp"
export TMP="$TMPDIR"
export TEMP="$TMPDIR"
npm ci --ignore-scripts
npm run test:e2e:install
npm run dev
```

`.npmrc` npm cache/log yolunu `.npm-cache` içine alır. Yukarıdaki ortam değişkenleri geçici çıktıları proje içinde tutar. Kurulumda bağımlılık lifecycle scriptleri çalıştırılmaz; mevcut platforma ait native araçlar npm'in optional paketleriyle sağlanır. İşletim sistemi değişince `node_modules` taşımak yerine `npm ci --ignore-scripts` çalıştırın.

Playwright başlatıcısı hem indirme hem test sırasında tarayıcı yolunu `.playwright-browsers`, geçici dizini `.tmp` olarak sabitler. Tarayıcılar npm kurulumundan ayrı indirilir. Linux CI çalıştırıcısında `npm run test:e2e:deps` Chromium sistem bağımlılıklarını kurar; bu komut yalnız geçici CI runner içindir, geliştirici makinesinde çalıştırılmaz. Tarayıcı kurulumu ayrı `test:e2e:install` komutuyla yapılır. İndirme veya başlatma hatasını çözmek için TLS doğrulamasını ya da işletim sistemi güvenlik kontrollerini kapatmayın.

## Araçlar ve komutlar

Vite 8, React 19 ve strict TypeScript 7; dosya tabanlı TanStack Router ve TanStack Query; Tailwind CSS 4, shadcn React Aria/Rhea bileşenleri kullanılır. Supabase istemcisi yalnız `getSupabaseClient()` çağrıldığında oluşturulur.

| Komut                      | İşlev                                                             |
| -------------------------- | ----------------------------------------------------------------- |
| `npm run dev`              | Yerel Vite geliştirme sunucusu                                    |
| `npm run typecheck`        | Uygulama, testler ve araç yapılandırmalarının strict tip kontrolü |
| `npm run build`            | Tip kontrolü ve `dist/` altında production build                  |
| `npm run preview`          | Build çıktısını yerelde sunma                                     |
| `npm run lint`             | Sıfır uyarı sınırıyla type-aware Oxlint                           |
| `npm run format`           | Kaynak, test ve yapılandırmaları Oxfmt ile düzenleme              |
| `npm run format:check`     | Dosyaları değiştirmeden format kontrolü                           |
| `npm run i18n:extract`     | Türkçe katalog anahtarlarını çıkarma                              |
| `npm run i18n:types`       | Katalogdan selector tiplerini üretme                              |
| `npm run i18n:check`       | Değişiklik yazmadan katalog tutarlılığı ve Türkçe durum kontrolü  |
| `npm test`                 | Vitest birim/bileşen ve MSW altyapı testleri                      |
| `npm run test:watch`       | Vitest geliştirme izleme modu                                     |
| `npm run test:coverage`    | V8 metin ve `coverage/lcov.info` raporu                           |
| `npm run test:e2e:install` | Kilitli Playwright sürümüne uygun Chromium'u indirme              |
| `npm run test:e2e`         | Yerel Vite sunucusunda gerçek Chromium testleri                   |
| `npm run verify`           | Tip, lint, format, i18n, coverage testleri, E2E ve build          |
| `npm audit`                | Tüm bağımlılıkların güvenlik denetimi                             |
| `npm audit --omit=dev`     | Yalnız üretim bağımlılıklarının güvenlik denetimi                 |

`verify` ilk başarısız kontrolde durur. Audit ayrı çalıştırılır ve bulgular varsa sıfır olmayan çıkış kodu üretir; kapatılmış veya susturulmuş değildir.

## Erişilebilirlik, analiz, Devtools ve form örneği

Bu aşamada kurulan güncel kararlı sürümler `^` politikasıyla manifestte, tam çözülmüş sürümleri lockfile'da tutulur:

| Paket                             | Kurulan sürüm |
| --------------------------------- | ------------- |
| `@axe-core/playwright`            | 4.14.0        |
| `knip`                            | 6.45.1        |
| `@tanstack/react-devtools`        | 0.10.14       |
| `@tanstack/devtools-vite`         | 0.8.6         |
| `@tanstack/react-query-devtools`  | 5.107.1       |
| `@tanstack/react-router-devtools` | 1.167.3       |
| `@tanstack/react-form-devtools`   | 0.2.34        |
| `@tanstack/react-form`            | 1.33.5        |
| `zod`                             | 4.6.7         |

### Knip analizi

`npm run knip` kullanılmayan dosya, bağımlılık ve export'ları raporlar. **Şimdilik tanı komutudur; `verify`, `verify:ci` veya CI şablonuna zorunlu kapı olarak eklenmemiştir.** Otomatik silme veya bulgu bastırma yapılmaz; bulgular varken sıfır olmayan çıkış kodu korunur.

`knip.json` asgari ek yapılandırmadır: i18next CLI tarafından dosya adıyla dinamik yüklenen `i18next.config.ts` bir entry'dir; üretilmiş `src/i18n/generated/**` deklarasyonları analizden çıkarılır. Knip'in Vite/Vitest/Playwright ve TanStack Router eklentileri otomatik aktiftir. Vite `index.html` girişini, test glob'larını, setup dosyasını, npm script'lerindeki Node girişlerini ve Router'ın `routeTree.gen.ts` üzerinden dinamik route grafiğini izler. Route ağacı veya bütün `src` entry olarak eklenerek bulgular gizlenmez.

Bu kaynağın gerçek açık bulguları:

| Tür        | Bulgu                          | Değerlendirme                                                                           |
| ---------- | ------------------------------ | --------------------------------------------------------------------------------------- |
| Dosya      | `src/lib/supabase.ts`          | Hazır lazy istemcinin henüz uygulama tüketicisi yok; bu görev canlı entegrasyon yapmaz  |
| Dosya      | `src/lib/utils.ts`             | Mevcut Button doğrudan `cn` paketini import ediyor; bu re-export kullanılmıyor          |
| Bağımlılık | `@supabase/supabase-js`        | Kullanılmayan istemci dosyası üzerinden mevcut; aktif uygulama grafiğinde kullanılmıyor |
| Bağımlılık | `lucide-react`                 | Henüz uygulama import'u yok                                                             |
| Export     | `LinkButton`, `buttonVariants` | Yerel UI kaynağında tanımlı, mevcut tüketicileri yok                                    |

Bu kayıtlar yanlış pozitif olarak ignore edilmemiştir. Silme/uyarlama kararı ayrı bakımdır; mevcut temel istemci ve UI API'si bu görevde topluca kaldırılmaz.

### Tek TanStack Devtools arayüzü

[Resmî ortak arayüz entegrasyonu](https://tanstack.com/devtools/latest/docs/quick-start) ile Query ve Router **Panel** bileşenleri ile [resmî Form `formDevtoolsPlugin()` entegrasyonu](https://tanstack.com/form/latest/docs/framework/react/guides/devtools) `src/components/devtools.tsx` içinde tek `TanStackDevtools` altında birleşir. İkinci bağımsız Query/Router/Form floating panel'i yoktur. Root route altında Router bağlamını, ana uygulamadaki QueryClientProvider'dan Query bağlamını alırlar.

`npm run dev` (`mode=development`) açıldığında ortak panel lazy yüklenir; normal ürün içeriği aynı kalır. `import.meta.env.DEV` ve açık development mode koşulu sayesinde production, Vitest ve `mode=e2e` çalıştırmalarında panel yüklenmez. E2E/Axe normal uygulamayı tarar; geliştirici panelinin erişilebilirlik kabulünü iddia etmez. Vite Devtools eklentisi yalnız development serve sırasında [resmî öneriyle ilk sıradadır](https://tanstack.com/devtools/latest/docs/vite-plugin); mevcut Router → React → Tailwind sırası korunur.

`npm run build` sonundaki `npm run check:bundle`, Vite'ın gerçekten ürettiği chunk modül kimliklerini `.tmp/production-modules.json` üzerinden denetler. TanStack Devtools/event-bus paketlerini veya yerel Devtools bileşenini içeren çıktı hata verir. Üretilen bütün JavaScript chunk'larında panel/source-injection işaretleri de denetlenir; kaynak dosyada sadece `DEV` koşulu bulunması yeterli kanıt sayılmaz. Modül raporu `dist` içine konmaz. `check:bundle` için önce güncel build gereklidir. Bu kaynakta ölçülen çıktı: 154 modül kaydı, 4 JS chunk, sıfır Devtools modülü/işareti.

### Standard Schema + React Aria form örneği

`src/examples/schema-form.tsx`, küçük bir temel bileşendir; normal ana sayfaya veya ürün route'una eklenmez, backend isteği yapmaz. Testler ve yalnız development modunda `http://localhost:5173/?__form_example` ile açılan örnek görünüm tarafından tüketilir (Vite portu değişirse URL'yi uyarlayın). Bu görünüm production'da bulunmaz; `schema-example` form kimliğiyle ortak Form Devtools listesinde görünür. Değerleri ve doğrulama hatalarını incelemek için formu seçip Individual Fields → text → meta → errors ağacını açın. `@tanstack/react-form`, Zod 4 şemasını [Standard Schema aracılığıyla doğrudan](https://tanstack.com/form/latest/docs/framework/react/guides/validation) kullanır; resolver adaptörü, React Hook Form veya ikinci doğrulama sistemi yoktur. İlk doğrulama blur/submit, ilk submit sonrasında yeniden doğrulama change olayındadır; aynı hata birden fazla event listesinde tekrarlanmaz.

React Aria `TextField`, `Label`, `Input`, `FieldError` ve submit Button kullanılır. Örneğin boş olmama ve en az üç karakter sınırı yalnız entegrasyon test verisidir; ürün iş kuralı değildir. Yerelleştirilmiş hatalar `aria-invalid` ve `aria-describedby` ile input'a bağlanır. Testler boş alanı, kısa değeri, hatanın düzelmesini, submit payload/başarı durumunu ve Tab/Shift+Tab/Enter ile kullanımını doğrular. Gerçek kişisel veri veya hosted kaynak kullanılmaz. `npm run test:coverage`/`test:ci` glob'ları bu testleri; mevcut E2E komutları Axe testini otomatik kapsar. Etkin olmayan CI YAML dosyalarında yeni bir test listesi kopyalanmamıştır.

## Türkçe ve üretilen kaynaklar

Tek katalog `src/locales/tr/common.json`, varsayılan dil `tr`, React Aria locale değeri `tr-TR` ve HTML dil niteliği `tr`'dir. Çeviriler tipli selector API ile tüketilir. Katalog değişince `i18n:extract`, ardından `i18n:types` ve kontrolleri çalıştırın. Bu aşamada başka dil eklenmez.

`src/routeTree.gen.ts` Router eklentisi, `src/i18n/generated/` i18next CLI tarafından üretilir; elle düzenlenmez. Bunlar lint/format dışında kalır. Bileşen kaynakları (shadcn UI dahil) format ve lint denetimine dahildir. Lockfile npm tarafından yönetilir. Cache, geçici dosyalar, build, coverage ve tarayıcı raporları Git dışında tutulur.

## Test düzeni ve ağ izolasyonu

Vitest jsdom, React Testing Library, user-event ve jest-dom kullanır. `src/test/setup.ts` ortak MSW sunucusunu başlatır, her testten sonra handler'ları sıfırlar ve DOM'u temizler. MSW 3'te eski `onUnhandledRequest` seçeneğinin adı [`onUnhandledFrame`](https://mswjs.io/docs/migrations/2.x-to-3.x) olmuştur. Özel callback hata mesajını yazdırıp isteği reddeder; böylece string `error` stratejisinin varsayılan statik dosya muafiyeti de kapatılır. Testler hem API hem statik dosya isteğinin MSW hata tanısıyla birlikte ağ hatası olarak reddedildiğini doğrular.

`src/test/server.test.ts` başarı/hata HTTP yanıtlarını, tanımsız isteğin engellenmesini ve bir testin handler'ının sonraki teste sızmamasını doğrular. Fixture istekleri ayrılmış `.invalid` alan adını kullanır; canlı API'ye bağlanmaz. `HomePage` testi Türkçe metni ve sayaç etkileşimini doğrular.

Coverage test edilmemiş `src/**/*.{ts,tsx}` dosyalarını da içerir. Test/kurulum dosyaları, üretilmiş dosyalar ve Vitest'in standart istisnaları dışarıdadır; main, route, Supabase ve UI kaynakları kapsamda kalır. Ölçülmemiş minimum yüzde eşiği yoktur.

Playwright dört bağımsız Chromium testiyle Türkçe ekranı, HTML dilini, başlangıç durumunu, pointer/Enter/Space etkileşimlerini ve yeniden yüklemede sıfırlamayı doğrular. Her testin ayrı browser context'i vardır; retry yoktur ve odaklı testler yasaktır. Axe testi ana sayfanın render edilmiş DOM'unda bütün varsayılan axe kurallarını çalıştırır ve herhangi bir ihlalde başarısız olur; kural kapatma veya selector muafiyeti yoktur. Bu otomatik tarama bütün WCAG uyumunu veya manuel ekran okuyucu/klavye incelemesini kanıtlamaz. Sunucu `127.0.0.1:4173` üzerinde strict port ile açılır, mevcut sunucu yeniden kullanılmaz. Tarayıcı HTTP istekleri yalnız bu origin'e izin verir; service worker'lar engellenir. E2E sunucusu Supabase değişkenlerini boşaltır. Hata halinde trace/screenshot `test-results/`, HTML rapor `playwright-report/` altındadır. Aynı Playwright yapılandırması ayrıca `127.0.0.1:4174` üzerinde development sunucusu açar. Yeni Devtools testi tek ortak panelde Query/Router/Form erişimini ve örnek formun canlı değer, doğrulama hatası, touched/valid durumları ile düzeltme/submit akışını doğrular; bu test de yalnız yerel origin'e HTTP erişimine izin verir.

## Ortam ve güvenlik

Temel ekran ve bütün testler `.env` veya gerçek Supabase bilgisi gerektirmez. İleride yetkili entegrasyon için `.env.example` esas alınabilir. `VITE_` değişkenleri tarayıcıya gönderilir; yalnız publishable key kullanılabilir. Secret/service-role anahtarı kaynaklara veya istemci ortamına konulmaz. Hosted veriye reset/seed yapılmaz.

Bu çalışma sırasında `npm audit --omit=dev` **0 bulgu**, tam audit **6 geliştirme bulgusu (2 düşük, 4 orta)** verdi. İki kök advisory, [deepmerge prototype poisoning](https://github.com/advisories/GHSA-gcqx-w48m-w2h4) ve [minimatch kaynak tüketimi](https://github.com/advisories/GHSA-g3hv-75wg-m249); diğer kayıtlar shadcn → registry/ts-morph zincirindeki etkilenen paketlerdir. Bunlar tarayıcı runtime bağımlılığı değildir; bileşen üretimi sırasında güvenilmeyen registry/girdi işlenirse geliştirme ortamını etkileyebilir.

İncelenen güncel shadcn 4.23.0 hâlâ deepmerge 4.3.1 ve ts-morph 26 zincirini kullanır; güncel deepmerge sürümü de 4.3.1'dir. Güncel @ts-morph/common 0.29.0 da minimatch 10 ister. Uyumlu üst paket düzeltmesi doğrulanamadığı için zorunlu override, `audit fix --force` veya audit'in önerdiği shadcn 1.0.0'a dönüş uygulanmadı. Güncellemelerde audit'i yeniden çalıştırın; bu sonuç kalıcı güvenlik garantisi değildir.

## Bağımsız CI şablonları — henüz etkin değil

[ci.yml](.github/workflows/ci.yml) ve [security.yml](.github/workflows/security.yml) bu depoda **GitHub tarafından çalıştırılmaz**. GitHub yalnız depo kökündeki `.github/workflows/` dosyalarını yükler; `apps/web1/.github/workflows/` bir şablon dizinidir. Yerel doğrulama veya statik analiz, gerçek Actions koşusu/CI kabulü/merge yetkisi değildir. [GitHub workflow konumu](https://docs.github.com/en/actions/concepts/workflows-and-actions/workflows).

CI şablonu Ubuntu 24.04 ve Node 24.21.0 kullanır. `npm ci --ignore-scripts` zorunludur; lifecycle scriptleri çalışmaz, optional platform paketleri kurulur. Node'un npm 11'i kullanılır. Npm cache ve geçici dosyalar proje altında kalır. Setup-node otomatik paket yöneticisi cache'i kapalıdır; node_modules/build/browser cache'i başka koşudan devralınmaz.

`ci.yml`, Chromium sistem bağımlılıklarını `npm run test:e2e:deps` ile **geçici GitHub-hosted Linux runner'a** kurar. Bu adım apt/sudo gerektirir ve runner işletim sistemine yazar; yerel çalışma alanı izolasyonuna uygun bir geliştirici komutu olarak sunulmaz. Ardından kilitli Playwright'ın Chromium'u `.playwright-browsers` altına indirilir; `npm run verify:ci` strict tip, type-aware lint, format, Türkçe katalog, rapor denetleyicisi testleri, Vitest/MSW+coverage, production build ve Chromium E2E'yi yürütür. E2E mevcut davranışı koruyarak yerel Vite geliştirme sunucusunu açar; üretilen production bundle'ın tarayıcı kabulünü kanıtlamaz.

| Ek npm komutu              | Amaç                                                                          |
| -------------------------- | ----------------------------------------------------------------------------- |
| `npm run test:ci`          | Coverage ile Vitest, JSON/JUnit raporu ve sıfır skipped/todo denetimi         |
| `npm run test:ci:guards`   | Rapor denetleyicisinin boş/atlanmış/başarısız/flaky/beklenen hata senaryoları |
| `npm run test:e2e:ci`      | Chromium testleri ve sıfır skipped/flaky denetimi                             |
| `npm run test:e2e:deps`    | Yalnız geçici Linux CI runner'ında Chromium OS bağımlılıkları                 |
| `npm run verify:ci`        | CI raporları ve rapor denetimi dahil bütün kalite zinciri                     |
| `npm run audit:production` | Üretim audit JSON'unu kaydeder; gerçek npm çıkış kodunu korur                 |
| `npm run audit:all`        | Geliştirme dahil bütün dependency audit'i; gerçek çıkış kodunu korur          |

Rapor denetimi en az bir başarılı test ve bütün raporlanan testlerin gerçekten geçmiş olmasını ister. Vitest `only` yasaktır; pending/todo veya eksik sonuçlar reddedilir. Playwright'ta skipped, flaky, beklenen başarısızlık, global hata veya sonuçsuz test reddedilir. Test komutu başarısızsa rapor kontrolü o başarısızlığı yeşile çevirmez. Mevcut testler korunmuştur. `verify` yerel komutu değişmeden kullanılabilir; CI, raporlu ve ek denetimli `verify:ci` komutunu çağırır.

Artifact'lar `test-reports/` (Vitest ve Playwright JSON/JUnit, audit JSON), `coverage/`, `playwright-report/` ve `test-results/` kaynaklarından yüklenir. Adlar run ID/attempt ve audit kapsamıyla ayrılır; saklama süresi 7 gündür. Raporlar kurulum sonrası hata olsa da iptal edilmemiş koşuda yüklenmeye çalışılır. Hiç rapor yoksa artifact adımı hata verir. Erken hata yüzünden çalışmayan test/adım, kayıp artifact, iptal veya metadata olayında atlanan job başarılı test kanıtı değildir. Job özetleri gerçek adım sonucunu (`success`, `failure`, `skipped`) gösterir. Yalnız upload başarısı kabul değildir; artifact içeriği çalıştırılacak kod veya merge kanıtı olarak güvenilmez.

`security.yml` üretim (`production`) ve tam (`all`) audit'i ayrı runner/job'larda, `fail-fast: false` ile yürütür; birindeki hata diğerini iptal etmez. npm'in yalnız geliştirme bağımlılıklarını denetleyen güvenilir bir `audit --only=dev` modu yoktur: geliştirme maruziyeti tam raporun üretim raporuyla karşılaştırılmasıyla belirlenir. Düşük seviye dahil bulgular hata üretir; ağ/registry hataları da başarısızlıktır. JSON hem log'a yazılır hem artifact olur. `continue-on-error`, bulgu allowlist'i veya audit eşiği yükseltmesi yoktur. Mevcut 6 geliştirme bulgusuyla **tam audit/security kabulü açıktır ve ilgili job başarısız olur**; üretim audit'inin geçmesi bu sonucu değiştirmez. Haftalık tarama pazartesi 06:17 UTC'dir; manuel/scheduled koşu PR merge kanıtı değildir.

Her iki şablon main tabanlı PR açma/kaynak güncelleme/yeniden açma/retarget ve manuel çalıştırma için hazırlanmıştır. Üst düzey path filtresi yoktur; henüz güvenilir V2 scope seçicisi bağlanmadığından etkinleştirilirse her ilgili PR'de tam zincir çalışır. Başlık/açıklama `edited` olayı testleri atlar ve ayrı metadata concurrency grubuyla kaynak koşusunu iptal etmez. Aynı PR'nin eski kaynak koşusu iptal edilir; farklı workflow/PR grupları ayrıdır. Main push ağır test tetikleyicisi eklenmemiştir; main kabulünün sahibi mevcut ortak kanıt mekanizmasıdır. PR için checkout varsayılan event merge kaynağını, manuel koşu seçilen ref'i kullanır; HEAD'in `GITHUB_SHA` eşleşmesi kontrol edilir. Bu basit kontrol parent/tree/run/attempt doğrulayıcısının yerine geçmez.

### Action pinleri ve yetkiler

12 Kasım 2026'da resmi upstream release/tag referansları `git ls-remote` ile doğrulandı:

| Action                                                                                    | Sürüm  | Tam commit SHA                             |
| ----------------------------------------------------------------------------------------- | ------ | ------------------------------------------ |
| [actions/checkout](https://github.com/actions/checkout/releases/tag/v7.0.1)               | v7.0.1 | `3d3c42e5aac5ba805825da76410c181273ba90b1` |
| [actions/setup-node](https://github.com/actions/setup-node/releases/tag/v7.1.0)           | v7.1.0 | `949feb2413d6458794dcd2491c4babbbce0c15c1` |
| [actions/upload-artifact](https://github.com/actions/upload-artifact/releases/tag/v7.0.2) | v7.0.2 | `cf430e030ddbb5b0abf93d22962f4752f3646cd9` |

[GitHub güvenli kullanım rehberine](https://docs.github.com/en/actions/reference/security/secure-use) uygun olarak varsayılan izinler `{}`, job izni yalnız `contents: read` ve checkout `persist-credentials: false`'tur. Secret, environment, OIDC, status/check yazma veya deploy yetkisi verilmez. `pull_request_target`, ayrıcalıklı `workflow_run` ve self-hosted runner kullanılmaz. Action pin güncellemesinde resmi tag→commit eşleşmesi, release değişiklikleri ve statik taramalar yeniden incelenir; SHA kullanımı action kodunun bütünüyle denetlendiği anlamına gelmez.

### Yerel şablon doğrulaması

Kurulum bölümündeki cache/temp ortamını ayarladıktan sonra:

```sh
npm ci --ignore-scripts
npm run verify
npm run verify:ci
npm run audit:production
npm run audit:all
```

Audit komutları ayrı çalıştırılır; mevcut tam audit'in sıfır olmayan sonucu beklenen **açık bulgudur**, kabul edilmiş başarı değildir. Linux sistem bağımlılığı adımının gerçek kurulumu ve Actions artifact upload/izin/tetikleme davranışı yalnız etkinleştirme sonrası geçici Linux runner'da kanıtlanabilir.

Statik analiz yalnız bu iki dosyayı hedefler. Bu çalışmada resmi release SHA256 digest'i doğrulanarak proje içindeki `.tmp/workflow-tools` altına indirilen actionlint 1.7.12 ve zizmor 1.32.0 kullanıldı. Araçlar runtime/npm bağımlılığı değildir. Uygun platform için resmi [actionlint](https://github.com/rhysd/actionlint/releases/tag/v1.7.12) ve [zizmor](https://github.com/zizmorcore/zizmor/releases/tag/v1.32.0) release asset'ini ve SHA256 değerini doğrulayarak aynı yere kurduktan sonra:

```sh
.tmp/workflow-tools/actionlint .github/workflows/ci.yml .github/workflows/security.yml
.tmp/workflow-tools/zizmor --offline --no-config --no-ignores --strict-collection --no-progress --cache-dir .tmp/zizmor-cache .github/workflows/ci.yml .github/workflows/security.yml
```

Zizmor çevrimdışı kontrolü uzak advisory/branch/tag politikalarını incelemez. Actionlint YAML/Actions ifade ve şema kontrolüdür; bu yerel ortamda ShellCheck yoktur. SHA/tag eşleşmeleri ayrıca upstream'den doğrulanmıştır. Statik tarama gerçek GitHub çalıştırması değildir.

### Gelecekte monorepo entegrasyonu

Bu bölüm kurulum talimatıdır; kök dosyaları değiştirme yetkisi veya uygulanmış entegrasyon iddiası değildir. Normatif kabul kuralları [CI politikasında](../../docs/ci-policy.md), sahiplik [belge haritasında](../../docs/documentation-map.md) kalır.

1. Ayrı açık yetki ve son kaynak incelemesiyle şablonlar depo köküne `.github/workflows/web1-ci.yml` ve `.github/workflows/web1-security.yml` olarak taşınmalıdır. Kök workflow adlarıyla çakışma önlenmeli; şablon ve etkin dosya iki ayrı yaşayan politika kaynağına dönüşmemelidir.
2. Şablonların mevcut yolları monorepo köküne göre hazırdır: `defaults.run.working-directory: apps/web1`, ortam yolları `${{ github.workspace }}/apps/web1/...`; action `with.path` yolları depo kökünden `apps/web1/...` olarak çözülür, `defaults.run` action'ları etkilemez. Checkout ve setup-node adımlarına çalışma dizini eklenmez. V2 ayrı bir repoya çıkarılırsa run dizini `.`, ortam/artifact yolları da yeni repo köküne göre uyarlanmalıdır. V2 npm projesi kalır; root pnpm/Turbo veya V1/backend scriptleri test bağımlılığı yapılmaz.
3. V2'yi bugün kapsam dışında tutan deneysel alan kararı, ilgili scope sahipleri tarafından açıkça ele alınmalıdır. [Backend scope kaydı](../backend/scripts/ci/scope.json), [frontend kapsam seçicisi](../web/scripts/ci-scope.mjs) ve ilgili workflow tetikleme listeleri birlikte incelenmelidir. V2 kendi kabulünü seçmeli; V1 veya backend testlerini V2 kabulü diye kullanmamalıdır. Tam Git farkı, silme/taşımanın iki ucu, mode değişiklikleri, ortak kaynak ve bilinmeyen yol davranışı korunmalıdır. Path filtreleri veya başarılı skipped job ile gerekli kabul atlanmamalıdır.
4. Yeni kök workflow'lar ve V2 görev/test yapılandırmaları trusted politika yüzeyine kaydedilmeli; mevcut workflow validators'ın actionlint/zizmor/poutine/pinact kapsamı ve politika kurulum karşılaştırmaları güncellenmelidir. Bu dosyaların burada statik olarak geçmesi, kökteki mevcut taramaların veya trusted politika kurulumunun tamamlandığını göstermez. Required-check/strict-base/ruleset kurulumu ayrıca yetki ve gerçek kanıt ister.
5. [Frontend kaynak kanıtı](../web/scripts/ci-proof.mjs) ve ortak [Main acceptance](../../.github/workflows/backend.yml) / `ftksaas/merge-clean` doğrulama zincirine V2'nin gerekli kalite ve güvenlik işleri eklenmelidir. Gerçek PR merge SHA'sı, event base/head parent'ları, tam tree, repo/workflow/job kimliği, run ID ve güncel attempt/step başarıları kaynak makbuzuna bağlanmalıdır. Rerun devralma, expired/kayıp artifact, stale base, fork ve yanlış kaynak reddi ayrıca test edilmelidir. Mevcut V1 kanıt biçimini taklit eden ikinci bir doğrulayıcı kurulmaz; yetkili sahipler V2 kanıt sözleşmesini mevcut zincire entegre eder. Şimdiki rapor artifact'ları böyle bir makbuz değildir.
6. Güvenlik kabulü için mevcut geliştirme bulguları çözülmeli veya ayrı kullanıcı kararıyla normatif risk kabulü belirlenmelidir; şablonlar bunu kabul edilmiş saymaz. Beklenen audit başarısızlığını yeşil sonuç üretmek için bastırmak yetki değildir. Gerekli kalite/E2E/audit job veya adımları `skipped`, iptal ya da başarısızsa merge kabulü verilmez; kapsam gerektirmeyen atlama da test başarısı diye raporlanmaz.
7. Etkinleştirme PR'sinde gerçek Ubuntu kurulum, Chromium, artifact, salt-okunur fork PR ve retarget/metadata/concurrency davranışı doğrulanmalıdır. Aynı kaynağın zorunlu kontrolleri ve trusted kurulum yetkisi olmadan merge yapılmaz. Main aynı ağır testleri tekrarlamadan aday kaynak/run/attempt kanıtını doğrulamalıdır; deploy/CD bağlantısı bu şablonlara eklenmemiştir.
