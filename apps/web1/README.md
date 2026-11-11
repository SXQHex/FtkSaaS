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

Playwright başlatıcısı hem indirme hem test sırasında tarayıcı yolunu `.playwright-browsers`, geçici dizini `.tmp` olarak sabitler. Tarayıcılar npm kurulumundan ayrı indirilir. Linux çalıştırıcısında Chromium sistem bağımlılıkları önceden sağlanmalıdır; bu proje sistem paketlerini kurmaz. İndirme veya başlatma hatasını çözmek için TLS doğrulamasını ya da işletim sistemi güvenlik kontrollerini kapatmayın.

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

## Türkçe ve üretilen kaynaklar

Tek katalog `src/locales/tr/common.json`, varsayılan dil `tr`, React Aria locale değeri `tr-TR` ve HTML dil niteliği `tr`'dir. Çeviriler tipli selector API ile tüketilir. Katalog değişince `i18n:extract`, ardından `i18n:types` ve kontrolleri çalıştırın. Bu aşamada başka dil eklenmez.

`src/routeTree.gen.ts` Router eklentisi, `src/i18n/generated/` i18next CLI tarafından üretilir; elle düzenlenmez. Bunlar lint/format dışında kalır. Bileşen kaynakları (shadcn UI dahil) format ve lint denetimine dahildir. Lockfile npm tarafından yönetilir. Cache, geçici dosyalar, build, coverage ve tarayıcı raporları Git dışında tutulur.

## Test düzeni ve ağ izolasyonu

Vitest jsdom, React Testing Library, user-event ve jest-dom kullanır. `src/test/setup.ts` ortak MSW sunucusunu başlatır, her testten sonra handler'ları sıfırlar ve DOM'u temizler. MSW 3'te eski `onUnhandledRequest` seçeneğinin adı [`onUnhandledFrame`](https://mswjs.io/docs/migrations/2.x-to-3.x) olmuştur. Özel callback hata mesajını yazdırıp isteği reddeder; böylece string `error` stratejisinin varsayılan statik dosya muafiyeti de kapatılır. Testler hem API hem statik dosya isteğinin MSW hata tanısıyla birlikte ağ hatası olarak reddedildiğini doğrular.

`src/test/server.test.ts` başarı/hata HTTP yanıtlarını, tanımsız isteğin engellenmesini ve bir testin handler'ının sonraki teste sızmamasını doğrular. Fixture istekleri ayrılmış `.invalid` alan adını kullanır; canlı API'ye bağlanmaz. `HomePage` testi Türkçe metni ve sayaç etkileşimini doğrular.

Coverage test edilmemiş `src/**/*.{ts,tsx}` dosyalarını da içerir. Test/kurulum dosyaları, üretilmiş dosyalar ve Vitest'in standart istisnaları dışarıdadır; main, route, Supabase ve UI kaynakları kapsamda kalır. Ölçülmemiş minimum yüzde eşiği yoktur.

Playwright iki bağımsız Chromium testiyle Türkçe ekranı, HTML dilini, başlangıç durumunu, pointer/Enter/Space etkileşimlerini ve yeniden yüklemede sıfırlamayı doğrular. Her testin ayrı browser context'i vardır; retry yoktur ve odaklı testler yasaktır. Sunucu `127.0.0.1:4173` üzerinde strict port ile açılır, mevcut sunucu yeniden kullanılmaz. Tarayıcı HTTP istekleri yalnız bu origin'e izin verir; service worker'lar engellenir. E2E sunucusu Supabase değişkenlerini boşaltır. Hata halinde trace/screenshot `test-results/`, HTML rapor `playwright-report/` altındadır.

## Ortam ve güvenlik

Temel ekran ve bütün testler `.env` veya gerçek Supabase bilgisi gerektirmez. İleride yetkili entegrasyon için `.env.example` esas alınabilir. `VITE_` değişkenleri tarayıcıya gönderilir; yalnız publishable key kullanılabilir. Secret/service-role anahtarı kaynaklara veya istemci ortamına konulmaz. Hosted veriye reset/seed yapılmaz.

Bu çalışma sırasında `npm audit --omit=dev` **0 bulgu**, tam audit **6 geliştirme bulgusu (2 düşük, 4 orta)** verdi. İki kök advisory, [deepmerge prototype poisoning](https://github.com/advisories/GHSA-gcqx-w48m-w2h4) ve [minimatch kaynak tüketimi](https://github.com/advisories/GHSA-g3hv-75wg-m249); diğer kayıtlar shadcn → registry/ts-morph zincirindeki etkilenen paketlerdir. Bunlar tarayıcı runtime bağımlılığı değildir; bileşen üretimi sırasında güvenilmeyen registry/girdi işlenirse geliştirme ortamını etkileyebilir.

İncelenen güncel shadcn 4.23.0 hâlâ deepmerge 4.3.1 ve ts-morph 26 zincirini kullanır; güncel deepmerge sürümü de 4.3.1'dir. Güncel @ts-morph/common 0.29.0 da minimatch 10 ister. Uyumlu üst paket düzeltmesi doğrulanamadığı için zorunlu override, `audit fix --force` veya audit'in önerdiği shadcn 1.0.0'a dönüş uygulanmadı. Güncellemelerde audit'i yeniden çalıştırın; bu sonuç kalıcı güvenlik garantisi değildir.

## Sonraki V2 CI aşaması

Bu aşama GitHub Actions workflow'u oluşturmaz veya değiştirmez. Ayrı CI çalışmasında yalnız `apps/web1` için Node/npm sürümü, `npm ci --ignore-scripts`, proje içi cache/geçici yollar, Chromium sistem bağımlılıkları ve tarayıcı kurulumu, `npm run verify`, audit politikası ve hata raporu artifact yükleme adımları bağlanmalıdır. Coverage eşiği ve açık geliştirme advisory'lerinin kabul politikası ölçüm ve ayrı kararla belirlenmelidir. Yerel test başarısı hosted kabul veya V1 CI kabulü yerine geçmez.
