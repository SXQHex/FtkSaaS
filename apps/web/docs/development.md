# Frontend geliştirme

Kapsam yalnız FtkSaaS'tır. Web uygulaması apps/web, ortak arayüz packages/ui sahibindedir. Kök [AGENTS](../../../AGENTS.md), [istemci protokolü](../../../docs/client-integration.md) ve [API sözleşme paketi](../../../packages/api-contracts/README.md) önceliklidir. Pro ilk teslim hedefi, Starter varyantı, sonraki Business kapsamı, modül sırası ve frontend kabul takibinin tek sahibi [todo.md](todo.md) dosyasıdır. Bu rehber uygulama yöntemini ve mevcut ekran davranışlarını tutar; ikinci görev/kabul listesi oluşturmaz. Repo/backend kabulü [00 devirde](../../backend/docs/00-FtkSaaS-yeni-sohbet-devir.md), backend açık işleri [kendi backlog’unda](../../backend/docs/remaining-work.md) tutulur.

<a id="plan-ve-rol-uyarlamasi"></a>

## Plan ve role uygun ortak ekran geliştirme

Yeni akışlar [teslim planındaki](todo.md#7-bölüm-bölüm-teslim-tek-aktif-bölüm) sırayla Pro'nun çok kaynaklı kullanıcı yolculuğundan geliştirilir. Aynı modülde Starter'ın tek kaynak seçimi ve kapalı özellikleri doğrulanır; bu iş bütün Pro bittikten sonraya bırakılmaz. Ortak bileşeni plan başına kopyalama veya her bileşene dağılmış plan adı kontrolleri yerine mevcut typed plan/rol/işlem projeksiyonları tüketilir. Plan, canlı rol ve belirli eylem yetkisi farklıdır; genel abonelik okuması bütün yazıların yetki kaynağı değildir.

Organizasyon işleri ile merkez operasyonları ayrı kapsamdır. Org gelen kutusu/raporu/ayarını tek küresel seçili merkeze zorlamadan `org_id`, gerektiğinde `center_id` ve gerçek kişi/seans hedefi taşınır. Tek seçeneğin otomatik gösterilmesi işlem yetkisi üretmez. Mevcut scope tipi ve komut günlüğü genişletilir; hesap/merkez değişince seçili nesne, cursor, açık form, preview ve geç yanıt yeni bağlama sızmaz. Business için kapsam, izinli projeksiyon, para birimi ve ayar kaynağı/mirası korunur; sonraki çok merkezli işlemler sırf bu altyapı için erkenden uygulanmaz.

Yönetici, resepsiyon/personel, eğitmen ve öğrenci görevleri aynı izinli bileşenlerle farklı günlük görünümlerde birleştirilir. Yönetici paneline birkaç filtre eklemek self portalın kabulü değildir. Günlük iş → kişi/seans/aday/etkinlik ayrıntısı → ilgili işlem → sonuç akışı izlenir. Kısa işlem Sheet/Dialog, karmaşık yaşam döngüsü ayrı detay/adımlı akış olabilir. Finans ve yoğun karşılaştırmalar tabloda; mobil günlük görevler kısa liste/kartta sunulur. Yeni detaylarda kararlı bağlantı, reload, geri/ileri ve giriş sonrası dönüş korunur; çalışan hash kabuğu topluca yeniden yazılmaz.

Her dilim gerçek okuma → kullanıcı kararı → gerekiyorsa preview → açık onay/komut → yeniden okuma → hata/kurtarmayı tamamlar. Pro ürün payload'ı genişlerken aynı komutu kabul eden kurtarma doğrulaması da güncellenir. Anlaşma sürümü, paket etkisi, mali sonuç veya worker işi istemcide tekrar hesaplanmaz. `PLAN_FEATURE_UNAVAILABLE`, yetkisizlik, eksik config ve geçici hata ayrı kullanıcı durumlarıdır; eksik okuyucu sahte yetki veya başarıyla doldurulmaz.

Ayar ve belge tüketimi ilgili iş akışının parçasıdır. Kaydetme ile gerçek tüketici etkisi, kaynak/default/miras, seçili reset ve geçmiş birlikte doğrulanır; kapsamın sahibi [S12 eşlemesidir](todo.md#web-s12). Plan daralması ve erişim kaybı yeni form/komutlarda erken sınanır. Kaynak, otomatik test/CI, yayın ve canlı kabul ayrı kaydedilir; ertelenen gerçek kontrollerin tek takibi [todo teslim kapısındadır](todo.md#pro-ilk-teslim-kapisi).

## Bileşen ve araç kuralları

Önce shadcn/ui ve ondan türetilmiş hazır bloklar değerlendirilir. Özel bileşen yalnız hazır seçenek ihtiyacı karşılamadığında yazılır. packages/ui/registry-sources.json resmî registry adreslerini, alınan kaynakların SHA256 değerlerini ve sidebar-07/login-02/signup-02 uyarlamalarını kaydeder; aynı paketin LICENSE dosyası MIT bildirimini korur. Kullanılan bileşenler React 19 ve Tailwind 4 ile çalışır.

Kullanıcının 29 Ekim onayıyla yönetici kabuğu korumalı `/` route’una taşınır; eski bağlantı doğrulama ekranı ve login-01 Auth bileşenleri kaldırılır. Yeni Auth ekranları login-02/signup-02 tabanında ortak iki sütunlu düzeni kullanır; mobilde yalnız form bölümü gösterilir. `/tasarim` ayrı sentetik referans olarak kalır. Genel tablo/form framework’ü kurulmaz.

Üç starter için değerlendirme ve tam kaynak commit’leri [starter kaynak kaydındadır](../starter-sources.json). Bu aşamada starter dosyası kopyalanmadı: mevcut araçlar korunur, Clerk/Better Auth/veritabanı ve Base UI katmanları taşınmaz. shadcn uyarlamasının dosya/commit/hash izi registry kaydında, MIT bildirimi packages/ui/LICENSE içindedir.

Build önbelleği apps/web/turbo.json içinde .next çıktıları, açık NEXT_PUBLIC_* girdileri ve .env* dosya hash’leriyle tanımlıdır; yerel bağlantı değişince önceki build cache’i kullanılmaz.

TypeScript sürümü kök pnpm-workspace.yaml katalogundaki 7.0.2'dir. Next.js 16.4.5 varsayılan proje-yerel tsc CLI yoluyla build sırasında tip kontrolü yapar; ignoreBuildErrors veya TypeScript 6 fallback'i yoktur. Frontend lint için Oxlint, format için Oxfmt kullanılır; bağımsız tsc typecheck korunur. Oxlint React/Hooks, Next.js, JSX erişilebilirlik ve Vitest yerleşik kural gruplarını açar. `lint`, uyarıları hata sayar ve ardından Oxfmt check çalıştırır; bu nedenle mevcut `check:frontend` ve frontend CI format denetimini de içerir. Type-aware lint için ek tsgolint bu geçişe eklenmez. Üçüncü taraf frontend/UI paket sürümleri manifestlerde tam numarayla sabittir; `latest`, `^` veya `~` kullanılmaz. İç workspace bağlantıları ve tam TypeScript katalog kaydı korunur. Playwright da tam sürüm numarası kullanır; CI `--frozen-lockfile` ile kayıtlı ağacı kurar. Node24 tipleri en güncel24.x, React/React DOM tipleri güncel tam sürümden seçilir; kullanıcı kararıyla tip sürümleri için yayın yaşı beklenmez. Diğer güncellemeler mevcut yayın yaşı politikasını korur. Node .nvmrc, pnpm kök packageManager kaynağından seçilir.

## Next.js yükleme sınırları

Ana `/` sayfası URL değişmeden `(workspace)` route grubunda kalır. Grubun `loading.tsx` sınırı native Auth beklenirken yalnız yerelleştirilmiş, kişisel veri içermeyen iskeleti stream eder. Root layout içindeki locale/cookie okuması bu sınırdan önce tamamlanır. Stream başlamışsa giriş/MFA yönlendirmesi HTTP200 gövdesindeki Next yönlendirmesi olabilir; istemci içerik almadan native kontrol tamamlanır. Sınır köke taşınmaz: seans/satış belgesi yollarının geçersiz UUID kontrolleri ve gerçek HTTP404 davranışı korunur.

`StudioWorkspace` ekranları module-level `next/dynamic` sınırlarından, yalnız seçilen bölüm render edildiğinde yükler. Program yönetimi ve doğrudan seans düzenleme de eylem anında yüklenir. SSR varsayılanı korunur; `ssr:false` eklenmez. `WorkspaceLoading` mevcut tokenları, TR/EN yükleme metnini, canlı durum bildirimini ve azaltılmış hareket stilini kullanır. Seans özeti `session-summary.tsx` sahibindedir; doğrudan sayfa, Sheet'in bütün komut/düzenleme bağımlılıklarını sırf özeti göstermek için import etmez. Bileşen taşınması markup veya kapasite/tarih davranışını değiştirmez.

Ana sayfa sunucunun doğruladığı native kullanıcı ID'sini React key ve `authUserId` olarak kabuğa verir. Başka native hesaba giriş veya çıkış mevcut snapshot'ı temizler, bekleyen okuma sonucunu düşürür ve Next router üzerinden girişe döner. Domain komutlarının aktörü ayrıca gerçek `account_get_v1.id` olmaya devam eder. Kullanıcı/tenant verileri için ortak Next cache veya iş komutları için Server Action katmanı eklenmez; mevcut typed Edge ve recovery günlüğü aynı tüketicilerde kalır. Ölçüm ve kabul durumu [S06 kaynak/kabul kaydındadır](todo.md#web-s06).

## Erişim değişince bekleyen işlemler

Ana kabuktaki **Bekleyen işlemler** paneli, `account_get_v1.id` doğrulandıktan sonra organizasyon/merkez listeleri reddedilse bile açılır. Hesap okuması diğer bootstrap okumalarıyla paraleldir; her bağımsız okumadaki Auth/session reddi eski snapshot ve kurtarma kimliğini düşürür. `PendingOperations` yalnız açıldığında `next/dynamic` ile yüklenir. Aynı sekmenin aynı aktöre ait gerçek org/merkez UUID'li `sale-renew:{person}`, `rights:{person}`, `bookings:{session}` , `finance:{person}`, `collection-correct:{movement}`, `sale-refund:{sale}`, `credit-refund:{person}`, `credit-offset:{person}`, `debt-adjust:{debt}` ve `lesson-requests` kayıtları keşfedilir. Scope listeden tahmin edilmez; eski kayıttan alınır, `recoverSetup` doğrulamasından geçer. Tanınan bozuk kayıt eylemsiz hata verir; farklı komut ailesi/yabancı aktör/bozuk scope keşfe alınmaz. Panel S05/S06 ve S08 finans işlemlerini kapsar; genel bir backend iş kuyruğu değildir.

Panel var olan `useSetupCommand` ve `SetupFeedback` üzerinden işlem durumunu veya aynı payload/proof/key ile replay'i sunar. Yerel kayıt yetki sağlamaz; backend eski org/merkez ve güncel native rol/planı yeniden denetler. Kesin sonuç sonrası bootstrap yeniden okunur; hak/borç veya rezervasyon sonucu uydurulmaz, ilgili ekran güncel veriyi yeniden okur. Liste panel açılışında keşfedilir; başka yüzeyde kayıt değişmişse kapatıp yeniden açılır. Mobilde iç içe kutu kenarları azaltılır; mevcut tokenlar ve TR/EN metinleri kullanılır.

Aynı slot birden fazla yüzeyde açık olabilir. Ortak hook, yeni yazı veya kontrol öncesinde ve geç yanıt sonrasında kaydın bütün JSON içeriğinin beklenen komutla eşitliğini denetler. Karşılaştırma payload ve blocked işaretini de içerir; salt operation_key yeterli değildir. Daha yeni kayıt varsa eski controller yazmaz, silmez veya blocked yapmaz; eylemleri durdurup görünümü yeniden açma yönergesi verir. Kontrol ile storage değişikliği arasında await yoktur. Bu koruma backend idempotency'nin yerine geçmez.

## Çalıştırma

Repo kökünde:

```sh
corepack enable
pnpm install --frozen-lockfile
cp apps/web/.env.example apps/web/.env.local
# Development publishable key değerini yalnız .env.local içine yerleştir.
pnpm dev:web
```

Uygulama adresi http://127.0.0.1:3000. NEXT_PUBLIC_APP_ORIGIN OAuth, kayıt ve kurtarma callback'inin güvenilen origin'idir. Development Supabase projesi docs/development-connection.json ile tanımlıdır; yalnız URL ve publishable key istemciye gider. .env.local Git dışında kalır. Yayın sırasında kesin origin ile `/auth/callback` ve `/auth/callback?next=/reset-password` adreslerinin Supabase izin listesi ve sağlayıcı dönüşü doğrulanır; environment yazılması tek başına hosted Auth kabulü değildir.

5 Kasım 2026 kullanıcı kararı: Vercel Git bağlantısı korunur; `apps/web/vercel.json` içinde `git.deploymentEnabled=false` ile Vercel’in push/PR/merge tetikleyicisi kapatılır. Deploy’u yalnız [Vercel delivery](../../../.github/workflows/vercel.yml) Actions zinciri seçer. Otomatik preview için `apps/web/src/**` değişikliği ve gerçek frontend CI kaynak/iş/adım kabulü; production için aynı kaynak filtresi ve başarılı güncel main kabulü gerekir. `public`, ortak paket, bağımlılık, config, backend ve belge değişiklikleri bilinçli olarak bir sonraki src build’ine ertelenir. `workflow_dispatch` yalnız güncel kabul edilmiş main’i preview veya production’a filtreyi aşarak dağıtır. Build Vercel’de yapılır; kaynak/API çağrısı tam SHA’ya sabittir. Production adresi `https://uye.fethiyetango.com` korunur. CI başarısı deployment başarısı sayılmaz; Vercel READY ve yayımlanan SHA doğrulanır. Kurulum ve güven sınırlarının sahibi [CI politikasıdır](../../../docs/ci-policy.md#vercel-dağıtımı).

`(auth)` route grubu `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/mfa` yollarını kullanır; eski Türkçe yollar ve yönlendirmeleri yoktur. Native Supabase SDK parola, Google, e-posta doğrulamalı kayıt, kurtarma ve TOTP işlemlerinin sahibidir. Kayıt yalnız `display_name` metadata’sı taşır; rol/organizasyon üretmez. Doğrulama bekleyen kayıt oturum açmış sayılmaz. Callback PKCE exchange ve güvenli dönüş yolu denetimini korur; korumalı ana sayfa sunucuda kullanıcı ve MFA seviyesini doğrular.

## Test komutları

```sh
pnpm check:frontend
pnpm test:frontend
pnpm test:frontend:coverage
pnpm --filter @ftksaas/web test:isolation
pnpm --filter @ftksaas/web test:e2e:install
pnpm test:frontend:e2e
```

Vitest/Testing Library etkileşimleri, MSW gerçek shared transport'un DTO/hata/sayfalama tüketimini doğrular. Playwright varsayılan olarak public giriş/kayıt/kurtarma, korumalı yönlendirme, klavye erişimi, yüzde 200 metin ve axe kontrollerini Chromium/Firefox/WebKit/mobil projelerinde çalıştırır. Otomatik testte production uygulamasına Auth bypass veya demo fallback eklenmez. Coverage raporu ilgili paketin coverage dizininde; Playwright HTML/trace/başarısızlık ekran görüntüsü .artifacts/frontend altında tutulur. Gerçek API/E2E kabulü Turbo cache'inden gelmez.

Canlı development giriş testi ayrı ve açıktır. Mevcut yetkili hesabı Git dışındaki `apps/web/.env.e2e.local` dosyasında tanımla; parola veya gerçek hesap bilgisini belgeye/sohbete yazma. Dosya canlı test config’i tarafından Node native env loader ile okunur; process ortamı önceliklidir:

```dotenv
FTK_E2E_EMAIL=...
FTK_E2E_PASSWORD=...
```

```sh
# FTK_E2E_EMAIL ve FTK_E2E_PASSWORD mevcut yetkili test hesabından güvenli ortamda verilir.
pnpm --filter @ftksaas/web test:e2e:live
```

Bu komut mevcut hesabın native girişi→Edge account/organization/center okumaları→çıkış akışını test eder. Yeni hesap/kuruluş oluşturmaz; reset/seed yapmaz. Trace, video ve ekran görüntüsü canlı testte kapalıdır. TOTP ve Google'ın gerçek sağlayıcı dönüşü yetkili hesapla ayrıca tarayıcıda doğrulanır. Bu kabul gerçekleşmeden mock/public testleri gerçek giriş kanıtı sayılmaz.

Yerel Linux ortamında varsayılan browser CDN arşivi indirilemiyorsa kurulu `playwright-core/browsers.json` içindeki **aynı** browserVersion için resmî Chrome for Testing Google storage kaynağı denenebilir: `https://storage.googleapis.com/chrome-for-testing-public/{browserVersion}/linux64/chrome-headless-shell-linux64.zip`. ZIP doğrulanır ve geçici dizine açılır; yerel Playwright config’inde yalnız bu executablePath kullanılır. Tam Chrome’un profile Unix socket gereksinimi kısıtlı ortamda çalışmayabilir; aynı sürüm headless-shell ayrı desteklenen dağıtımdır. Kalıcı config/CI/browser pinini veya güvenlik kapısını bu yerel çözüm için değiştirme. Dört CI projesinin kabulü ve gerçek Auth/provider/browser ekran kabulü ayrı kalır; son koşu kanıtı todo sahibindedir.

## Paket ve CI ayrımı

Frontend komutları yalnız @ftksaas/web, @ftksaas/ui ve gerekli ortak tip kontrollerini seçer. test:backend yalnız backend paketini seçer. Mevcut genel pnpm test tüm workspace testlerini manuel çalıştırabilir; frontend CI bunu kullanmaz. verify-isolation.mjs gerçek Turbo dry-run grafiğinde iki yönlü ayrımı kontrol eder, backend testini çalıştırmaz.

Frontend checks ve Frontend contract compatibility PR olaylarında veya manuel tetiklenir; gerçek iş kapsamını `ci-scope.mjs` seçer. Frontend runtime değişikliği lint/typecheck/test/build ve dört tarayıcı projesini, ortak sözleşme/TypeScript/manifest/lockfile/Turbo değişikliği ayrıca kontrat uyum kontrolünü seçer. İncelenmiş yalnız belge farkında ağır frontend işleri atlanır; backend-only runtime farkı frontend testini kendiliğinden başlatmaz. Main proof başarılı adayın exact-source/artifact/run-attempt kanıtını doğrular; aynı testleri main'de yeniden çalıştırmaz. Workflow concurrency/artifact alanları ve bağlayıcı kabul kuralları [CI politikasının](../../../docs/ci-policy.md) sahibindedir.

Tarayıcı matrisinde `ci-apt.mjs`, Ubuntu’nun tanınan Azure/mirror-list kaynaklarını kurulumdan önce doğrudan `https://archive.ubuntu.com/ubuntu` kaynağına çevirir. Dağıtım/bileşen ve Signed-By alanları, üçüncü taraf depolar ve paket imza/TLS doğrulaması korunur. APT bağlantı/veri zaman aşımı30 saniye, yeniden deneme2 ve eksik indeks hatası kesin başarısızlıktır; bilinmeyen kaynak düzeni sessiz başarı vermez. Kaynak hazırlama2, tarayıcı/OS bağımlılık kurulumu8 dakika ile sınırlıdır. Playwright’ın mevcut `install --with-deps` yolu, seçilen tarayıcı ve dört gerçek test projesi aynen korunur. Yerel fixture/YAML testi runner ağını doğrulamaz; kurulumun gerçek sonucu yeni CI koşusundan alınır.

`Workflow checks`, her main hedefli PR’da Actionlint, Zizmor, Poutine ve Pinact’i ayrı adımlarda çalıştırır; bir tarayıcının bulgusu sonraki araçları atlatmaz, hiçbir araç `continue-on-error` kullanmaz. Tüm tarama job’u yalnız `contents:read` alır; token yalnız çevrim içi inceleme adımlarında bulunur. Installer resmî Linux/x64 sürümlerini tam sürüm + SHA256 ile indirir; APT veya uygulama kurulumu gerekmez. Installer ve iki açık config, mevcut trusted `policyPath` sınırındaki `apps/web/scripts/workflow-validation/` sahibindedir; backend kabul kodu değiştirilmez. Pinact SHA/sürüm açıklaması ve7 günlük yayın yaşını doğrular; yeni action eklenmedi, mevcut tam SHA’lar korundu. İptal edilen/eski koşular concurrency ile durur, ağ/kurulum/job süreleri sınırlıdır. Repository ruleset’inde zorunlu status eklenmiş sayılmaz; bu workflow tarama başarısızlığını kendi CI sonucu olarak bildirir.

Zizmor yalnız trusted-main kabul/dağıtım trigger satırları ile merge commit’e bağlı relative reusable workflow satırını gerekçeli, konuma bağlı istisna olarak tutar. Poutine yalnız SHA/tree doğrulaması yapan, secret almayan ve tokenı `contents:read` olan `clean-suite.yml` core/api/serial-reference job’larının `untrusted_checkout_exec` bulgusunu ayırır; kural küresel kapatılmaz. Yeni trigger/job veya başka güvenlik bulguları aynı istisnaya girmez. İstisna ve installer değişiklikleri trusted politika değişikliği sayılır; sadeleştirme bahanesiyle gate kaldırılmaz.

Ters yöndeki tetikleme ve merge kabulü mevcut [CI politikası](../../../docs/ci-policy.md#ci-split--frontendbackend-kaynak-sınırı) kapsamındadır; frontend çalışması backend workflow/gate kaynaklarını değiştirmez. Yerel görev ayrımı uzak CI kabulünün yerine geçmez.

## Dil, tema ve Expo sınırı

next-intl, locale routing eklemeden tr/en sözlüklerini sunucu ve istemciye taşır. Mevcut Auth/callback URL’leri korunur. Varsayılan Türkçe, dil seçimi doğrulanmış `ftksaas_locale` HttpOnly cookie’sinde bir yıl tutulur (Secure yalnız HTTP loopback adreslerinde kapalıdır); backend ayarı yazılmaz. Sayfa başlıkları, document lang, Auth/API hata metinleri ve yönetici kabuğu iki dildedir. Tema next-themes ile sistem/açık/koyu seçeneklerini kullanır. Tema değişiminde `disableTransitionOnChange`, metin ve arka planın farklı hızlarda renk değiştirerek geçici kontrast kaybı oluşturmasını önler; tarayıcı kabulü gerçek görünüm seçicisini kullanır. Cihazda geçerli next-themes tercihi varsa hesap ayarı bunu ezmez; cihaz tercihi yoksa hesabın tema ayarı başlangıcı belirler. Font ölçeği/kontrast/hareket tüketimi korunur. Nötr CSS tokenları ve sistem fontu ürünün nihai marka tasarımı değildir.

Çeviri runtime’ı opsiyonel SWC/Parcel extraction araçlarının lifecycle scriptlerini gerektirmez; workspace allowBuilds bunları açıkça kapatır. Yeni form/state/tablo/chart kütüphanesi kurulmaz.

packages/ui web/DOM bileşenleridir; Expo’da doğrudan kullanılabilir kabul edilmez. Expo kurulumu sonraki iştir. API tipleri ortak pakette kalır; renk/boşluk değerleri platformdan bağımsız kavramlarla ifade edilir.

## Lint ve format

`pnpm --filter @ftksaas/web format` ve `pnpm --filter @ftksaas/ui format` yalnız ilgili paketi Oxfmt ile düzenler. `format:check` dosya yazmadan kontrol eder; `lint` hem Oxlint hem format kontrolünü çalıştırır. Araç sürümleri her iki frontend manifestinde tam sabittir; kökte ikinci lint/format config’i yoktur.

Oxfmt100 sütun/2 boşluk kullanır; import, package anahtarı ve Tailwind sınıfı sıralaması kapalıdır. Geçişte TSX/CSS farkları yalnız biçimdir; markup, CSS değerleri, sınıf sırası ve etkileşimler korunur. Üretilmiş next-env, .next/coverage, yerel env ve Markdown dosyaları format kapsamı dışındadır.

Oxlint’te `vitest/valid-expect.maxArgs=2`, Vitest’in desteklediği tanılama mesajı argümanını korur. Yalnız Preferences için React Compiler `set-state-in-effect` istisnası next-themes SSR mount davranışını kapsar. Eski AuthForm/Workspace istisnaları kaldırılır; yeni bileşenler standart kurallardan geçer. Diğer erişilebilirlik/React kuralları ve Playwright/axe kabulü korunur.

## Yönetici kabuğu tasarımı

`pnpm dev:web` sonrasında `/tasarim` adresini aç. Giriş gerektirmeyen bu route yalnız sentetik tasarım verisi içerir; korumalı `/` route’u aynı kabuğu gerçek hesap ve stüdyo okumalarıyla kullanır. Önizleme, Auth bypass veya gerçek API hata fallback'i değildir. Üretim kullanıcı/veri/tenant erişimi vermez; arama motoru indekslemesi kapalıdır.

Tasarım yönü: kullanıcının verdiği nötr shadcn OKLCH tokenları, 0.625rem radius, sistem fontu; marka çalışması yapılmadı. Sidebar-07 yerleşimi mevcut shadcn bileşenleriyle uyarlandı. Kuruluş/merkez seçici kullanılmaz. Günün dersleri ve sıradaki ders ana odağı oluşturur; öğrenci/paket/ödeme görünümleri kart, detaylar Sheet kullanır. Kaynak ve MIT izi packages/ui/registry-sources.json ile LICENSE içindedir.

- `AdminShell`: kontrollü bölüm seçimi, daraltılabilir masaüstü menüsü, mobil Sheet, sayfa araması (Ctrl/⌘+K), hesap/görünüm ve yardım panelleri. Auth, plan veya domain yetkisi uygulamaz.
- `StudioWorkspace`: native oturum altında gerçek account/organization/center ve kullanıcı ayarı okumaları. Kuruluş/merkez seçici yoktur; izinli merkezler kartlarla gösterilir. Closed/bootstrap kuruluşlar için merkez okuması yapılmaz. Oturum kapandıktan sonra geç gelen yanıt ekrana taşınmaz; API hatası sentetik veriye dönüştürülmez. Ders programı calendar_get_v1, güncel seans detayı session_get_v1 ile okunur. Öğrenciler, paket/satış, rezervasyon/talep, finans ve belge/inbox alanlarında gerçek tüketiciler vardır; rapor gibi henüz bağlanmamış alanlar açık hazırlık durumu gösterir. Menü veya kaynak mevcudiyeti tam ürün kabulü değildir; ayrıntılı durum [todo](todo.md) sahibindedir.
- `AdminPreview`: URL hash ve geri/ileri gezinme; ders günü seçimi, öğrenci arama/filtre, detay panelleri ve örnek kart ekleme. Geçici eklenen kartlar yenilemede sıfırlanır. Bildirim okundu durumu yalnız önizleme belleğindedir; CSV açıkça örnek olarak indirilir.
- `preview-data`: yalnız `/tasarim` tarafından kullanılan kurgusal kişiler, dersler ve paketler. Fiyatlar/öğrenci sayıları ürün kararı veya canlı veri değildir.

TR/EN ve açık/koyu/sistem teması mevcut tercih altyapısını kullanır. Önizlemedeki örnek kayıtlar gerçek hesap veya hosted kabulü değildir. `admin-design.spec.ts` gezinme/detay, örnek kayıt izolasyonu, klavye araması, mobil menü, axe, TR/EN ve büyütülmüş metin akışlarını gerçek tarayıcıda doğrular. Testlerin yazılmış olması çalışıp geçtiği anlamına gelmez; gerçek CI sonucu ayrıca değerlendirilir.


## Ortak ekran yönü ve takvim sınırı

Kullanıcının yüklediği `frontend-design` becerisi bu dilimde uygulanır. Kabul edilmiş nötr tema korunur: beyaz `#ffffff`, yüzey `#fafafa`, ikincil yüzey `#f5f5f5`, ana metin `#171717`, yardımcı metin `#737373`, çizgi `#e5e5e5`; uygulamanın mevcut OKLCH tokenları tek CSS kaynağıdır. Sistem sans yazı ailesi, sol hizalı içerik ve tabular saat/rakamlar kullanılır. Görsel odak stüdyonun gün/hafta programıdır; yeni KPI kartları ve dekoratif grafikler eklenmez. Mobilde saat ve ders adı öne çıkar; detay Sheet ile bağlam korunur. Kontenjan yoklama veya gerçekleşme değildir.

`SessionCalendar` alan görünüm modeliyle çalışır; `scheduler-engine` Syncfusion tiplerini/olaylarını dışarı taşımaz. Ağ işlemleri `ScheduleWorkspace`/`SessionDetail` tarafından mevcut typed Edge transport ile yapılır. Gün sınırları merkezin IANA saat diliminden UTC’ye çevrilir; DST günleri24 saate sabitlenmez. Sayfa/merkez değişiminde eski istek sonucu gösterilmez; yenileme hatasında eski kayıtlar güncel gibi sunulmaz. Program yazmaları, tekrar üretimi, rezervasyon, çakışma ve iptal kuralları istemci takvimine taşınmaz.

Syncfusion yalnız çizelge seçildiğinde dinamik yüklenir. `NEXT_PUBLIC_SYNCFUSION_LICENSE_KEY`, kurulu35.x sürümüne uygun onaylı Community License anahtarıyla build ortamında tanımlanır; Turbo build girdisidir. Anahtar yokken lisanssız Scheduler başlatılmaz, aynı gerçek verinin liste görünümü kullanılır. Liste/gün/hafta işlevi lisans anahtarı gerektirmez. Anahtar değerini kaynak/PR/log’a yazma. İlk adaptör salt okunurdur; sürükle-bırak, resize ve dahili editör kapalıdır. Seans seçimi bizim detay panelimize gider. Lisans kaydı: [Community License](https://www.syncfusion.com/products/communitylicense); uygulama kaynakları [Scheduler](https://ej2.syncfusion.com/react/documentation/schedule/getting-started), [yerelleştirme](https://ej2.syncfusion.com/react/documentation/schedule/localization) ve [saat dilimi](https://ej2.syncfusion.com/react/documentation/schedule/timezone). Üçüncü taraf paketler kendi lisans bildirimlerini korur.

Pro ve Starter ekran/işlem ayrıntıları ile bölüm kabul ölçütleri [frontend yol haritasında](todo.md) tutulur. Tek aktif bölüm, ertelenen canlı kabul ve bağımlılığı hazır sonraki dilimin seçimi [teslim sırasına](todo.md#7-bölüm-bölüm-teslim-tek-aktif-bölüm) uyar; bu rehber ikinci görev listesi içermez.


## Doğrudan seans bağlantısı

Canlı seans panelindeki “Seans sayfasını aç” bağlantısı `/organizasyon/{org_id}/seans/{session_id}` yolunu açar. Route UUID'leri doğrular, native kullanıcı ve gerekli MFA seviyesini sunucuda denetler; `session_get_v1` her açılış/yenilemede canlı tenant ve seans yetkisini backend'de değerlendirir. İsteğe merkez eklenmez; yönetici merkez listesine bağımlı olmadan öğrenci/eğitmen seans erişimi korunur. Sayfada tarihler açıkça etiketlenen cihaz saat dilimindedir; takvimdeki Sheet merkez saat dilimini kullanır. DTO'da başlık/merkez adı bulunmadığı için doğrudan sayfa bunları uydurmaz. Mevcut SessionSummary gerçek durum/kontenjan/yoklama verisini iki görünümde paylaşır. Dar ekranda kontenjan değerleri alt alta akar.

Giriş ve MFA `next` yerel hedefini korur. Google/kayıt başlatılmadan önce server action güvenli hedefi on dakikalık HttpOnly/SameSite=Lax çerezine yalnız `/auth/callback` yolunda yazar; HTTPS ortamında Secure açıktır. Kod taşıyan callback çerezi tüketip aynı path ile siler. Native güvenli e-posta değişiminin ilk onayı kod yerine fragment mesajı döndürür; sunucunun okuyamadığı bu ara sonuç `/auth/confirmation` ekranında yalnız diğer adresi de onaylama yönergesi olarak gösterilir. İlk bağlantı dönüş çerezini ikinci PKCE bağlantısı için korur. Eksik/bilinmeyen fragment veya provider hatası doğrulama başarısı sayılmaz; fragment URL'den temizlenir. Ara ekran oturum/kimlik yazmaz, hesabın güncel durumu korumalı hesap ekranından okunur. Böylece mevcut kesin `/auth/callback` provider URL'si korunur; yeni redirect wildcard'ı gerekmez. Açık parola kurtarma `next` hedefi çerezden önceliklidir. Çerez başka cihazda yoksa veya süresi dolmuşsa varsayılan `/` açılır. Bu navigasyon bilgisi erişim yetkisi değildir.

`frontend-design` yönü mevcut nötr renk/sistem font/sol hizalı düzeni korur: doğrudan sayfanın odağı seans tarihi ve saatidir; başlık, programa dönüş ve yenileme eylemleri tek içerik sütunundadır. Yeni dekoratif grafik veya ikinci takvim sistemi eklenmez. Gerçek ICS URL şablonu, host ve signing key yapılandırması ayrı hosted kabul dilimidir; bu kaynak değişikliği platform ayarı yapmaz.

## Stüdyo kurulumu ve program tüketicileri

`StudioSetup` kendi merkez kapsamındaki oda/disiplin/uygunluk/politika formlarını mevcut typed yönetim okumalarıyla açar. Formun sürümü kendi varlığından alınır. Eğitmen seçimi merkez kapsamlı `role_assignments` üzerinden yapılır; frontend fiziksel `instructor` ilişkisi oluşturmaz. Owner/OM kimliği CM işletim yetkisi yerine kullanılmaz. Starter dar rol okuyucusu ile diğer planların izinli rol kataloğu `getSetupRoles` sınırında ayrılır. Normatif kurallar [WF02](../../../docs/workflows.md#wf02), ilerleme/kabul [S02 kaydındadır](todo.md#web-s02).

`ProgramManager` takvimde açık kullanıcı eylemiyle, aktör/org/merkez anahtarıyla açılır. Sınıflar `management_state_get_v1(class_save_v1)`, özgün program tanımları `management_state_get_v1(program_preview_v1)` selector/cursor okumalarından gelir. `classValues` sınıfın kendi sürümünü seçer; varsayılan eğitmen/asistan görevi kendi kişi/duty selector'ü ve assignment sürümüyle yönetilir. Oda ve etkin merkez disiplini/eğitmen seçenekleri canlı kataloglardan alınır. Backend okuma reddi sentetik katalogla örtülmez.

Sınıf listesi ve seçilen sınıfın özeti iki sütunlu çalışma alanındadır; mobilde alt alta gelir. Sınıf oluşturma/düzenleme, program, varsayılan görev ve tek seans formları ilgili eylemle mevcut shadcn `Sheet` panelinde açılır. Aynı anda tek form görünür; panel Escape ile kapandığında odak açan düğmeye, başarılı kayıt sonrası düğme artık yoksa yönetim başlığına döner. Katalog okunmadan veya okuma reddedildiğinde yeni yazma formu açılmaz. Panel kapatmak bekleyen komutu silmez; yönetim görünümündeki `ProgramRecovery` aynı aktör/org/merkez günlüğünden kurtarmayı sunar. Merkez değişince önceki kapsamın paneli ve kayıtları gizlenir.

Takvim ve sınıf/program yönetimi ayrı görünümlerdir. Yönetime geçiş açık seans detayını kapatır; takvime dönüş seçilmiş tarih/aralığı korur. Başarılı komut sınıf/katalog ve takvim okumalarını yeniler. Formların preview/onay, sürüm ve idempotency davranışı bu görünüm düzeninden bağımsız mevcut tüketicilerde kalır.

`ProgramForm` sonlu, bitiş-hariç aralık ve merkez saat diliminde tekrar kuralı üretir; boş DST saati kaydırılmaz ve her çift saat için açık UTC farkı gerekir. Toplam/kategori kontenjanları sıfır değerlerini korur. Sınıf varsayılan görevi devralma veya açık eğitmen seçimi ayrı girdidir. `program_preview_v1` sonucu onaylanmadan `program_apply_v1` gönderilmez. Tek seans `SingleSessionForm` ile sınıfa bağlı veya bağımsız oluşturulur; sahte preview çağrısı eklenmez. İş kurallarının sahibi [WF03](../../../docs/workflows.md#wf03), bölüm durumu [S03 kaydıdır](todo.md#web-s03).

## Seans değişikliğini önizleme ve uygulama

`SessionChange` doğrudan seans sayfasında saat/kontenjanı cihaz saat diliminde, takvim Sheet'inde bilinen merkez saat dilimi ve kapsamıyla düzenler. Değişmeyen saatler (kesirli saniyeler dahil), kaynaklar ve görevler patch'e eklenmez. Takvim bağlamında oda/eğitmen alanı açıkça seçilince `SessionResources` canlı katalog okur. Oda seçimi kaynak listesini değiştirir; eğitmen seçimi asistanları ve korunabilen anlaşma referanslarını içeren tam açık görev listesi üretir. Doğrudan seans DTO'sunda merkez/oda kimliği olmadığından bu sayfada merkez tahmin edilmez.

Tek seans/bu ve sonrası kapsamı `session_change_preview_v1` sonucundaki gerçek etkilenen seanslarla incelenir. `SeriesOffsets` bilinen merkez saat diliminde sonraki çift saat tarihleri için açık `offset_choices` alır; başlangıç değişince eski seçimler temizlenir. Otomatik seri keşfi yapılmaz; eksik/ilgisiz seçimleri ve iş kurallarını backend doğrular. Önizleme engeli veya süre aşımı `session_change_apply_v1` işlemini durdurur. Sürüm, CM/tenant/plan, kaynak, rezervasyon/hak ve kontenjanın sahibi backend'dir; okunabilir seans yazma yetkisi sayılmaz.

Seans değişikliği göndermeden önce preview id/token'ı ve operation_key bu sekmenin aktör/org/seans günlüğüne yazılır. Bozuk/yazılamayan günlükte yeni komut gönderilmez; kayıp yanıtta aynı payload/key ile sonuç kontrolü veya replay yapılır. Yeni transport denemesi yeni request_id alır. Kesin sonuçta seans/takvim yeniden okunur. Otomatik polling veya başarısız okumada sahte başarı yoktur.

## Seans iptali ve telafi

Takvim ayrıntısındaki `SessionCancellation`, gerekçeli `session_cancel_preview_v1` sonucunun etkilerini ve süresini gösterir; ayrı etki onayıyla `session_cancel_apply_v1` çağırır. Hak/rezervasyon/bekleme/teklif veya parasal etkiler backend yanıtından okunur. `effectMoney` integer-string alt birimleri Number'a dönüştürmeden gösterir. Blocker, expiry veya eksik para birimi onayı engeller.

`ReplacementSession` iptal edilmiş kaynak kimliğini değiştirmeden `replacement_session_create_v1` gönderir. Yeni yerel aralık, oda ve toplam/kategori kapasitesi açık seçilir; kaynak görevlerini backend alır. Rezervasyonların taşınmadığı ve yeni rezervasyon gerektiği onaylanır. Oluşan gerçek primary_id veya kurtarmanın sonuç referansı, yeni seans bağlantısını sağlar. Seans/takvim yeniden okunur.

İptal/telafi ve sınıf/program yazıları ortak `useSetupCommand` günlüğünü aktör/org/merkez/slot kapsamıyla kullanır. `ProgramRecovery`, katalog veya seans okuması reddedilse de önceki komutun aynı approved payload/key ile sonuç kontrolünü/replay'ini sunar; yeni komut yetkisini backend yeniden değerlendirir. Runtime kaynak teslimi, backend API suite kabulü ve yeni frontend'in gerçek oturum→Edge→DB kabulü ayrı kanıtlardır; tek durum sahibi [S03 kaydıdır](todo.md#web-s03).

`/tasarim/seans` mevcut örnek seans değişikliği formunun sentetik referansıdır. Yeni program/iptal/telafi ekranlarının tamamını barındırdığı veya hosted kabul sağladığı varsayılmaz. Geçici yerel test harness'i ürün bağımlılığı veya gerçek backend kanıtı değildir.

## Öğrenci listesi ve merkezde öğrencilik

`StudentsWorkspace`, gerçek hesap kimliği ve erişilebilir aktif merkezlerle çalışır. `people_list_v1` için merkez ve `relationship: student` filtresi, desteklenen `created_at_asc` sırası ve25 kişilik cursor sayfası kullanılır. Bu filtre geçmiş/pasif öğrenci ilişkilerini de kapsar; yalnız aktif öğrenci veya toplam öğrenci sayısı iddia edilmez. Arama backend’in ad/soyad kapsamındadır. Arama/merkez değişiminde cursor sıfırlanır; eski yanıtlar ve hata sonrası eski liste güncel veri gibi gösterilmez.

Liste satırı mevcut shadcn Sheet’i açar. `person_get_v1` güncel kişi detayını yeniden okur; yalnız seçilen merkezin ilişkileri gösterilir ve aktif ilişki varsa geçmiş pasif ilişki mevcut durumu değiştirmez. İletişim alanının paylaşılmaması ile boş olması ayrılır; iletişim doğrulaması hesap bağlantısı sayılmaz. Bilinmeyen hesap, disiplin adı veya belge durumu üretilmez. Klavye ile panel kapanınca odak liste satırına, satır artık yoksa aramaya döner.

`student_activate_v1` ayrı onay, `student_deactivate_v1` onay ve gerekçe ister. Backend plan limiti, merkez yetkisi ve açık işlem engellerini denetler; yalnız okuyabilmek yazma yetkisi sayılmaz. DTO’da olmayan expected_version gönderilmez. Başarı sonrasında kullanıcı güncel bilgileri gösterdiğinde liste ve detay yeniden okunur; durum iyimser olarak değiştirilmez.

`person_create_v1` kişi ve iletişim kaydını oluşturur, öğrencilik ilişkisini açmaz; oluşturulan kişi etkinleştirilene kadar ayrı bir oturum kapsamlı listede tutulur. `person_update_v1` satır sürümünü gönderir; iletişim değiştirilirse değiştirilen iletişim doğrulanmamış olarak yeniden girilir, değişmeyen doğrulama bilgileri korunur. `account_access_send_v1` açık kullanıcı eylemiyle e-posta davet işi başlatır; `job_status_get_v1` yalnız iş durumunu gösterir. İşin başarılı olması davetin kabul edildiğini veya yerel hesaba bağlandığını kanıtlamaz. Bu kişi DTO’sundan hesap bağı/hesap durumu türetilmez; `linked_person_ids` farklı kişi profillerini anlatır. `PersonAccess`, kişi bazlı `management_state_get_v1` selector'leriyle davet/link kayıtlarını ayrı okur; actionable ve her kaydın kendi sürümüyle gerekçeli kaldırma/iptal sunar. Sonuçta kişi/dizin/erişim okumaları yenilenir.

Profilde belge durumu uydurulmaz. `document_requirements_get_v1` gerçek rezervasyon, satış veya katılım bağlamı ister; belge kabulü de bu işlem akışının parçasıdır. Native Auth SMTP uygulama davet göndericisi değildir. Mevcut hosted davet worker/gönderici ve gerçek posta teslimi [XREQ-003](../../../docs/requests.md#xreq-003-gerçek-davet-teslimi-ve-iş-takibi) ile teslim edilmiştir; istemci Resend'i veya worker endpoint'ini doğrudan çağırmaz. Yerel sentetik SMTP aracının varlığı bu hosted kanıtın yerine geçmez. UI bir eylemin rol/plan yetkisini önden tahmin etmez; yazma ve erişim her istekte backend tarafından denetlenir.

Öğrencilik değişikliği isteği (pasifleştirme gerekçesi dahil), kişi oluşturma/düzenleme komutu veya davet anahtarı bu sekmenin kullanıcı/organizasyon/merkez/kişi kapsamlı sessionStorage kaydına yazılır; kimlik doğrulama tokenı hiçbir zaman saklanmaz. Kişi oluşturma/düzenlemenin bekleyen tam komutu iletişim alanlarını içerir ve kesin sonuçta silinir. Belirsiz sonuçta yeni anahtar üretilmez; manuel sonuç kontrolü veya aynı payload/operation_key ile tekrar gönderim yapılır, transport request_id yenilenir. NOT_FOUND veya sonraki yetki kaybı önceki işlemin başarısızlığı sayılmaz. Sonuç süresi dolarsa replay engeli yenileme sonrasında da korunur. Makbuzun center_relationships referansı kişi ID’siyle karşılaştırılmaz. Detay okuması reddedilse bile mevcut bekleyen işlemin sonuç kontrolü erişilebilir kalır; kontrol/yazma yetkisini backend yeniden denetler. Kapanan panelin geç yanıtı takip kaydını değiştiremez.

`/tasarim/ogrenciler`, aynı liste/panel/onay bileşenlerini yalnız sentetik ve bellekteki eylemlerle gösterir. Tasarım, mevcut nötr palet ve sistem fontuyla ad/öğrencilik durumunu öne çıkaran sol hizalı satırlar ve sağ detay panelidir; dar ekranda panel tam genişlik kullanır. TR/EN, tema, arama/boş durum, sayfalama, açık işlem reddi ve etkinleştirme/pasifleştirme örnekleri gerçek hosted kabulü değildir. Açık kapsam yalnız [WEB-S04](todo.md#web-s04) içindedir.


## Hesap ve güvenlik

Korumalı `/account` sayfası, yönetici kabuğundaki hesap panelinden açılır. Profil yazma sürümü kendi `management_state_get_v1` okumasından alınır. Profil adı/ad/soyad/doğrulanmamış telefon ile native doğrulanmış ve bekleyen e-posta/telefon ayrı tutulur. Fotoğraf yalnız private `media_get_v1` içeriğinden okunur; PNG/JPEG/WebP yüklemesi 1 MB ve SHA-256 kontrolüyle profil komutuna bağlanır. Eksik identity projeksiyonu boş alanla ezilmez.

Hesap telefon alanlarında `libphonenumber-js/max` ülke metadata’sıyla doğrulama ve E.164 üretimi yapar; varsayılan ülke `TR`, açık yabancı ülke kodu önceliklidir. Profil ve native telefon değişimi API'ye yalnız kütüphanenin `.number` sonucunu gönderir. Elle ülke kodu ekleme, rakam temizleme veya telefon regex’i yoktur. Profilde boş isteğe bağlı telefon `null` olarak temizlenir; geçersiz numara ve E.164 içinde taşınamayan dahili numara alan altında hata verir ve gönderilmez. Biçim doğrulaması SMS ile sahiplik doğrulamasından ayrıdır.

Hesap kimlik özetinde yalnız değeri olan doğrulanmış ve bekleyen e-posta/telefon satırları gösterilir; doğrulanmamış telefon profil formunda düzenlenir. Boş kayıt satırları ve bölüm açıklamaları gösterilmez. Sayfa başında silme takibi ve genel yenileme yoktur; silme takibi silme bölümünde, başarısız hesap okumasının yeniden denemesi hata yanında kalır. `AccountField` zorunlu alanlara kırmızı yıldız ve placeholder ekler; native HTML doğrulamasını korur, gönderimde hatayı kırmızı çerçeve/hover/focus ve alan altındaki küçük metinle gösterir. Hata `aria-invalid`/`aria-describedby` ile alana bağlanır, ilk geçersiz alana odaklanılır. Parola tekrar uyuşmazlığı kendi alanında gösterilir; sağlayıcı/ağ hatası belirli bir alanı doğrulamıyorsa form hatası olarak kalır.

Auth tüketimi [settings.md](../../../docs/settings.md#native-auth-tüketici-eşlemesi) sözleşmesine uyar. Kayıt önce `/api/auth/signup-check` sunucu route’undan yalnız e-posta ile `account_signup_check_v1` sonucunu okur: `account_exists` kaydı/resend’i durdurur, yalnız `available` native `signUp` açar. Rate-limit/transport/servis hatası signup'a geçmez. Bu anlık kontrol adresi rezerve etmez; native signup sonucu ayrıca işlenir. Route backend’in `handleAccountSignupCheck` sunucu transport’unu doğrudan çağırır; parola, metadata, PKCE ve redirect bu kontrole gönderilmez. `NEXT_PUBLIC_APP_ORIGIN` güvenilen host kaynağıdır; backend adresi ve public anahtarı mevcut `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` değerlerinden alınır. Route bu değerleri backend transport'unun alanlarına açıkça eşler; Vercel'de ikinci host/URL/anahtar değişkeni tanımlanmaz ve request host'undan ayar türetilmez. Yalnız `FTK_PUBLIC_INGRESS_SECRET` ek sunucu secret'ıdır; Supabase Edge'deki aynı adlı değerle eşleşmelidir. `FTK_PUBLIC_HASH_SECRET` yalnız Edge'de kalır. Platformun üzerine yazdığı bağlantı IP'si ve HMAC zinciri backend modülünde kalır. Import edilen transport/imza/UUID dosyaları web build cache girdilerine açıkça dahildir.

Oturumlar ve güvenlik geçmişi kendi cursor okumalarını kullanır. Oturum etiketi gerçek sürümle yazılır; seçili/mevcut/diğer oturum iptali mevcut uygulama komutudur. TOTP enrollment/challenge/verify/unenroll native SDK'dadır. Doğrulanmış faktör kaldırmada native challengeAndVerify ile güncel AAL2 oturumu alınır, ardından unenroll→refreshSession→listFactors yürür; uygulama onay/proof endpoint’i yoktur. Hata veya belirsiz sonuçta başarı duyurulmaz, faktör listesi yeniden okunur. Başarıda hesap ve oturum/güvenlik okumaları yenilenir.

Parola değişimi mevcut + yeni + tekrar alanlarından native `updateUser` çağırır; ilk parola ekleme istisnası dahil mevcut-parola zorunluluğunun sahibi native Auth’tur. `current_password_required`/`current_password_invalid` alan hatasıdır. `reauthentication_needed` kod gönderme eylemini açar; kullanıcı isteğiyle native `reauthenticate()` ve ardından `updateUser({password,current_password,nonce})` yürür. Yerel24saat hesabı, uygulama challenge/completion endpoint'i ve otomatik kod gönderimi yoktur. Başarısız nonce kullanımından sonra yeniden kullanılabileceği varsayılmaz. `reauthentication_not_valid` yeni kod istemeyi gerektirir. Parola/kod storage, log veya recovery komutuna yazılmaz. Başarı kayıtlı ana adrese native güvenlik bildirimini tetikler; posta teslimi ayrı kabul edilir.

Google bağlama `linkIdentity({provider:google,options:{redirectTo}})`, ayırma `unlinkIdentity(identity)` ile native OAuth/kimlik sahipliği ve son kimlik kurallarına bırakılır. Ek GIS istemci kimliği, ID token işleme, prepare endpoint’i veya uygulama bağlama izni yoktur. Callback aynı güvenli `/account` dönüş çerezini kullanır. Kimlik listesi native `getUserIdentities()` ile okunur. Google kimliği bağlıysa hesap bilgisi ve kaldırma eylemi gösterilir; bağlama düğmesi yalnız başarılı okumada Google kimliği yoksa görünür. Yükleme/ilk okuma hatasında bağlama önerilmez. Bu arayüz tercihidir; native sağlayıcıya tek-Google kimliği kısıtı eklenmez. Ayırma sonrası native oturum/kimlik listesi ve hesap güvenlik okumaları yenilenir. E-posta/telefon request/resend/verify native SDK'da kalır.

Kurtarma native `resetPasswordForEmail`→callback/PKCE→`updateUser({password})` zinciridir; zorunlu global signOut veya ikinci completion RPC yoktur. Eksik/süresi dolmuş/kullanılmış recovery oturumu `/forgot-password` üzerinde açık hata ve yeni istek formuna döner. Güvenlik e-postasının giriş bağlantısı GET ile e-posta göndermez veya parola/oturum değiştirmez; asıl kanıtın3600sn/tek kullanım denetimi native sağlayıcıdadır.


`/invite` doğru hesabı göstererek davet kodunu açık onayla kabul eder. Giriş öncesindeki davet fragment'i `preserveInvitationReturn` ile aynı sekmede geçici olarak saklanır; parola/Google/MFA geçişinde query veya sunucu dönüş çerezine yazılmaz. Davet ekranında `consumeInvitationReturn` geçici değeri tüketip siler ve fragment'i URL geçmişinden çıkarır. Başka hedefe geçiş/hesap değişimi temizliği korunur. Kabul komutunun kalıcı sekme kaydı yalnız kullanıcı kapsamlı token özeti ve operation_key içerir; ham kod komut günlüğüne yazılmaz. Gerçek dönüş/kabul ve açık negatif senaryolar [S01 kaydında](todo.md#11-web-s01-güncel-kabul-durumu) ayrıdır.

Hesap silme önce gerçek etki/engel/süre önizlemesini, ardından açık silme onayı ve taze doğrulamayı ister. `/account/deletion` global kendi talebini `job_status_get_v1(org_id:null)` ile kontrol eder; son talep referansı native kullanıcı kapsamındadır. İş sonucu ile privacy sonucu ve bekleyen kapsamlar ayrı gösterilir; job success tek başına fiziksel imha değildir.

Profil, oturum etiketi/iptali ve silme komutlarının kayıp yanıtında kullanıcı/sekme kapsamlı aynı payload ve operation_key korunur; request_id her çağrıda yenilenir. Sonraki NOT_FOUND/yetki kaybı önceki yazmanın başarısızlığını kanıtlamaz. Result expiry ve payload uyuşmazlığında replay bloke edilir. Storage hatasında yeni komut gönderilmez. Aktif hesap değişimi veya çıkış eski hesabın geç yanıtını ekrana taşımaz.

Auth dosyaları yalnız `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/mfa` yollarındadır; eski Türkçe dosyalar ve yönlendirmeleri yoktur. Provider callback `/auth/callback` olarak kalır. Ortamın izin listesinde gerçek origin ile `/auth/callback` ve `/auth/callback?next=/reset-password` doğrulanmalıdır. Kod/yerel test bu sağlayıcı yapılandırmasının veya gerçek e-posta/SMS/Google tesliminin kabulü değildir; durum [todo.md](todo.md) içindedir.


Hesap silme yanıtı kaybolursa `/account/deletion` sayfasındaki bekleyen işlemi bulma eylemi native kullanıcı kapsamlı takip bağlantısını okur. Özgün pending komut tekrar açık onay ve taze native proof ile sürdürülür; yeni preview/key üretilmez. Normal hesap projeksiyonu deletion_pending sırasında kapanabileceğinden bu recovery yolu account_get'e bağımlı değildir. Proof'un native kullanıcı kimliği sunucunun doğruladığı kimlikle giriş öncesi ve son oturumda eşleşmelidir; asıl silme/replay yetkisi yine backend'dedir. Takip meta verisi bir yetki kanıtı değildir.

`Providers`, `next-intl` ortak saat dilimini hydration sonrasında tarayıcının IANA saat dilimine ayarlar; sunucu ve ilk hydration UTC ile eşleşir. Pencereye dönüşte cihaz ayarı yeniden okunur. Hesap tarihleri bu ortak varsayılanı kullanır. Merkez takviminin açık `timeZone` seçenekleri merkez saat dilimini korur.

## Finans tüketicisi

WF08 için `FinanceWorkspace` ana kabukta, `PersonFinance` öğrenci detayında `next/dynamic` ile yüklenir. Finans verisi ortak/public cache'e konmaz; gerçek scope, kişi, açık para birimi, cursor ve yenileme kimliğiyle okunur. Borç projeksiyonu ile hareket sayfası ayrıdır; opsiyonel tutar veya geçmiş payment:null için varsayılan üretilmez. Tahsilat formu yalnız kendi normal yetki reader'ı doğrulandıktan sonra açılır; finans okuması yazma izni değildir. Dağılım/borç kapama/alacak sonucu backend'den yeniden okunur. Finans komutu kişi slotuyla ve kapalı ödeme snapshot'ıyla doğrulanır; native token veya tahmin edilmiş kişi kimliği günlüğe yazılmaz. Modül kapsamı ve açık bağımlılıkların tek sahibi [S08](todo.md#web-s08) kaydıdır.

Tahsilat düzeltmesinde kaynak hareketin kendi `collection_correct_preview_v1` selector’ı kullanılır; `canCollect` bu izni vermez. Kaynak seçicisi ret/hata sırasında da kullanılabilir. Yetki sonrası lazy form yönlü farkı ve gerçek zamanı preview’a gönderir; borç/alacak etkisi backend’den gösterilir ve ayrı onaylanır. İnceleme girdinin açık saat dilimini korur; düzenleme/kaynak değişikliği ve geç yanıtlar eski onayı geri getirmez. `collection-correct:{cash_movement_id}` yalnız `collection_correct_apply_v1` için kapalı preview tokenını korur; aynı-key kurtarma genel panelde de çalışır. Başarı/ret finansı ilk hareket sayfasından yeniden okur. Canlı kabulün sahibi [S08](todo.md#web-s08) kaydıdır.

S08 yönetim alanı `PersonFinance management` ile açıkça etkinleştirilir; varsayılan salt okunur özet yönetim API’si keşfetmez. Ayrı eylem okuyucuları gerçek selector hedefini doğrular; satış iadesi gerçek hak kaynağı → kendi izin okuyucusu → gerekçeli backend preview → ayrı onay → scoped apply sırasını izler. Alacak iadesi/mahsup/borç düzeltmesi ayrı form ve kapalı komut alanlarıdır; mahsup yalnız projeksiyondaki gerçek borç sürümüyle çalışır. Aile/hedefe bağlı journal aynı-key kurtarmayı korur. Normal başarı/ret bütün finansı ve satış haklarını yeniden okur; nakit/hak/rezervasyon etkisi istemcide hesaplanmaz. Kaynak, doğrulama ve ertelenen gerçek kabulün tek sahibi [S08](todo.md#web-s08) kaydıdır.

WF07 yoklama takvim seans paneli ve doğrudan seans sayfasından açılır; `AttendanceAccess` açılınca `next/dynamic` ile yüklenir. Normal session/attendance okumalarının sürümleri eşleşmeden form açılmaz. Her yazma ailesi kendi typed management selector’üne bağlıdır; eğitmen atamasından kişi/finans yetkisi türetilmez. Satırın gerçek rezervasyon sürümü mark/block için, gerçek seans sürümü start/close için kullanılır. Taslak ve kesin kapanış ayrıdır; düzeltme yalnız gerekçeli backend preview/token ile uygulanır. Aile/hedefe bağlı attendance journal genel kurtarma paneline dahildir. Başarı/ret gerçek seans/yoklamayı, kapanış/düzeltme ayrıca normal hak projeksiyonlarını tazeler; okuma hatası sahte sıfır bakiyeye dönüşmez. Kaynak/kabul durumunun sahibi [S07](todo.md#web-s07) kaydıdır.

S07’nin `#attendance` görev alanı normal `calendar_get_v1` sayfalarını açık merkez/gün/hafta/saat dilimiyle okur;25 satırlık cursor korunur ve yalnız seanslar gösterilir. İlk sayfanın event-only olması tarih aralığının boş olduğu iddiasına dönüşmez. Kart seçimi yoklamayı lazy açar. Katılımcı filtresi/Abone No araması kaynak sırasını değiştirmez; eksik veya reddedilmiş satıra dönüş odağı gerçek rezervasyon kimliğiyle tutulur. Hak incelemesi açık yoklamada da kullanılabilir; hata ve tekrar okuma kişi bazındadır. Belge kurtarma normal attendance context’inden yalnız okumadır; profil/finans yetkisi veya başka kişi adına kabul üretilmez. FORBIDDEN hem yetki hem güncel katılım koşulu anlamına gelebileceğinden bu modülde tarafsız açıklanır. Güncel kaynak/kabul sahibi [S07](todo.md#web-s07) kaydıdır.


### Pro ekip ve anlaşma akışı

WF02/WF14/WF03 için mevcut ekip ekranı kullanılır; Pro personel/asistan ilişkisi hesap bağı ve işlem izninden ayrıdır. Eğitmen anlaşması paneli ve yayımlama formu `next/dynamic` ile ihtiyaçta yüklenir. Normal kişi/merkez anlaşma listesi aynı iş akışının `earnings.manage` sınırını denetler; desteklenmeyen genel management selector'ü yerine rol veya finans okuma yetkisi kullanılmaz. Writer native plan/özellik/yetki ve iş kurallarını yeniden doğrular.

Ücret alanları yalnız gerçek yayımlama sözleşmesini üretir; finans formülü istemcide hesaplanmaz. Beş model, açık salon payı/sırası, hak türü/değerleme ve isteğe bağlı gerçek paket kimliği korunur; onay özetinde paket kimliği görünür. Form değişimi onayı düşürür. Yeni zincir predecessor/version üretmez; yeni sürüm kaynağın gerçek zincir/sürümünü kullanır. `agreements:{person}` günlüğü aynı onaylı payload/key'i genel kurtarma panelinden de yeniden gönderir. Program tanısından bu ekrana geçiş eski preview'ı kaldırır; yayımlama→normal listeyi yeniden okuma sonrasında yeni preview ve ayrı onay gerekir. Kaynak ve gerçek kabulün sahibi [S02 anlaşma kaydıdır](todo.md#pro-egitmen-anlasmalari).


### Eylem keşfi ve organizasyon/merkez ayrımı

WF06/WF08'in altı action-discovery reader'ı `actionAuthority` içinde aynı native projeksiyonu doğrular: tek gerçek entity, pozitif gerçek kaynak sürümü ve aynı typed selector anahtarları. Boş liste yazma yetkisi değildir; birden fazla/bozuk/eksik kaynak normal yetki reddi gibi gizlenmez; farklı selector hedefi mevcut unavailable/false sonucunu korur. FORBIDDEN/NOT_FOUND eylemi kapatır; diğer hatalar kullanıcıya tekrar kontrol olanağı bırakır. Bu kaynak sürümü yeni komutun expected_version'ı diye uydurulmaz; her writer kendi protokolünü ve yeniden yetkilendirmesini korur. İsteğe bağlı Business kaynak satışının merkezi istemcide tahmin edilmez.

Ana kabukta merkez keşfi her organizasyonda bağımsızdır. Merkez hatası organizasyonun normal inbox erişimini kaldırmaz; hatalı kuruluşun merkezleri sahte boş başarı olarak saklanmaz, görünür hata/yeniden okuma taşır. Auth reddi bütün hesabı/kurtarmayı kapatır. Yenileme eski snapshot'ı kaldırır. Kaynak/gerçek kabul ve açık R01 matrisinin sahibi [todo §7](todo.md#7-bölüm-bölüm-teslim-tek-aktif-bölüm).


### Org/merkez işletim ayarları ve kişi adresi

WF12 org/center işletim editörü `settings_catalog_get_v1` ile `settings_get_v1` okumalarını paralel yapar. Yalnız desteklenen typed alanı, katalogdaki writable ve gerçek version ile tek alan patch'i olarak gönderir. Gösterilmeyen alan patch'e girmez. Org formu center_id taşımaz; center formu kendi merkezini korur. Selected reset gerçek alan/scope/version/before/after/token/expiry ile ayrı onaylanır. Edit/refresh/alan değişimi ve süre aşımı eski incelemeyi kaldırır. Varsayılan, local override ve program süresinin creation-copy kaynağı karıştırılmaz; reset mevcut programları değiştirmez. Ayar geçmişi native cursor ile istekte okunur. `operating-settings` günlüğü eski member notification-preference patch'ini genişletmeden ayrı doğrulanır; org sentinel'i genel kurtarmada yalnız tam org ayar slotunu kabul eder.

WF01/WF04 kişi adresi native login/MFA dönüşünden sonra account_get ile gerçek core aktörünü çözer ve mevcut StudentDetail normal API akışlarını kullanır. URL org/center/person taşır; tarayıcıdaki ilk merkezden hedef türetilmez. Kabuk ve doğrudan kişi sayfası görünürlük/focus dönüşünde eski görünümü kaldırıp güncel erişimi yeniden okur; eşzamanlı okuma kilidi ve AbortController geç cevapları düşürür. Genel hash kabuğu göçü yapılmadı. Kaynak/bağımlılık/kabulün sahibi [R01/R02 planı](todo.md#7-bölüm-bölüm-teslim-tek-aktif-bölüm).

### Public takvim ve dar başvuru transport’u

WF09 frontend sunucu yolları `/api/public/calendar` ve `/api/public/application`; paylaşım adresi `/p/[org-id]`, açık merkez profili için `?center=[center-id]`. Public işletme profili yalnız backend’in izin verdiği projeksiyondan gelir. Ziyaretçinin native kullanıcı oturumu gerekmez.

- `FTK_PUBLIC_ANON_KEY`: sunucuda kalan Supabase legacy anon JWT; `role=anon` gerekir. Publishable key bu anonymous bearer yerine varsayılmaz; service-role key reddedilir.
- `FTK_PUBLIC_BACKEND_ORIGIN`: isteğe bağlı HTTPS backend origin; yoksa mevcut `NEXT_PUBLIC_SUPABASE_URL` kullanılır.
- `FTK_PUBLIC_APPLICATION_HOSTNAME`: başvurunun güvenilen tam hostname’i. Vercel origin kontrolü ve platformun üzerine yazdığı tek `x-vercel-forwarded-for` IP’si zorunludur; yerel/başka host gerçek submit’i servis hazır değil sonucuyla kapatır.
- `FTK_PUBLIC_INGRESS_SECRET`: Edge’dekiyle aynı WF09 sunucu HMAC anahtarı, en az32 UTF-8 byte. İstemci bundle’ına verilmez. `FTK_PUBLIC_HASH_SECRET` Edge’de kalır.
- `FTK_PUBLIC_TURNSTILE_SITE_KEY`: yalnız public widget site key; `public_application` action ve gerçek hostname sağlayıcı/Edge hazırlığıyla eşleşmelidir. Bu public anahtar secret değildir; eksikse form açılmaz.

Transport API’ye caller bearer/header taşımadan kendi request UUID’sini üretir; contact/publication/business retry key korunur, bot proof her denemede yenilenir ve saklanmaz. React Turnstile adaptörü `@marsidev/react-turnstile`1.6.3 (MIT; <https://github.com/marsidev/react-turnstile>) kullanılır. Widget/mock testi gerçek Turnstile/ingress kabulü değildir. Native Auth signup transport’u mevcut ayrı hattını korur.

### Scoped settings and subscription consumers

The extended settings editor reads the live catalog and settings version before offering a field. Its form shape is resolved on the server from `@ftksaas/api-contracts/schema` through `/api/settings-shape`; the browser does not bundle the entire contract, accept raw JSON, or ask users to enter resource UUIDs. Native paged sources provide named choices. Readonly/null-only fields do not become writable through schema metadata. Updates, selected reset, explicit inheritance and immutable-history restore keep separate review intents, exact scope/version and durable command slots. The inheritance review describes live organization inheritance rather than presenting the previous local value as its result. Domain preparation resolves only drafts; availability/product/sale/permission writes retain their own validation and explicit user action.

WF13 Owner retention uses the narrow subscription selector from the workflow guide rather than CM resource-management readers. Period requests use a target-keyed controller; unmount, refresh or target changes invalidate late proof responses. Organization deletion stores only the approved intent and job metadata. Fresh native reauthentication is supplied transiently to `run` and never enters sessionStorage. A succeeded receipt alone does not identify the privacy job; exact replay with a fresh proof recovers the native job response. Account settings expose the actor-bound recovery surface independently of the current organization list.

Display preferences are consumed through the user context and the existing next-intl/Intl formatting primitives. `display-format` applies the numeric locale independently of interface language and keeps money in integer strings/BigInt. Personal calendar display timezone, week start, weekends and view do not change the center timezone used by program and transaction forms. Remembered/fixed contexts are matched against live accessible sources and confer no permission.

The frontend-owned notification catalog is `public/notification-templates/v1.json`; `notification-copy` shares its closed native-event mapping between in-app text and a pure server-consumable plaintext renderer. Rendering does not queue or deliver messages. The existing backend email claim/frozen-payload integration remains a separate cross-area request. Open source and acceptance states belong only to [todo](todo.md#7-bölüm-bölüm-teslim-tek-aktif-bölüm) and the linked request owners.
