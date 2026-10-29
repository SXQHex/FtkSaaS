# Frontend geliştirme

Kapsam yalnız FtkSaaS'tır. Web uygulaması apps/web, ortak arayüz packages/ui sahibindedir. Kök [AGENTS](../../AGENTS.md), [istemci protokolü](../../docs/claude-handover.md) ve [API sözleşme paketi](../../packages/api-contracts/README.md) önceliklidir. Güncel kabul [00 devirde](../../docs/contracts/00-FtkSaaS-yeni-sohbet-devir.md), açık iş [tek backlog'dadır](../../docs/remaining-work.md).

## Bileşen ve araç kuralları

Önce shadcn/ui ve ondan türetilmiş hazır bloklar değerlendirilir. Özel bileşen yalnız hazır seçenek ihtiyacı karşılamadığında yazılır. packages/ui/registry-sources.json resmî registry adreslerini, alınan kaynakların SHA256 değerlerini ve sidebar-07/login-02/signup-02 uyarlamalarını kaydeder; aynı paketin LICENSE dosyası MIT bildirimini korur. Kullanılan bileşenler React 19 ve Tailwind 4 ile çalışır.

Kullanıcının 29 Ekim onayıyla yönetici kabuğu korumalı `/` route’una taşınır; eski bağlantı doğrulama ekranı ve login-01 Auth bileşenleri kaldırılır. Yeni Auth ekranları login-02/signup-02 tabanında ortak iki sütunlu düzeni kullanır; mobilde yalnız form bölümü gösterilir. `/tasarim` ayrı sentetik referans olarak kalır. Genel tablo/form framework’ü kurulmaz.

Üç starter için değerlendirme ve tam kaynak commit’leri [starter kaynak kaydındadır](starter-sources.json). Bu aşamada starter dosyası kopyalanmadı: mevcut araçlar korunur, Clerk/Better Auth/veritabanı ve Base UI katmanları taşınmaz. shadcn uyarlamasının dosya/commit/hash izi registry kaydında, MIT bildirimi packages/ui/LICENSE içindedir.

Build önbelleği apps/web/turbo.json içinde .next çıktıları, açık NEXT_PUBLIC_* girdileri ve .env* dosya hash’leriyle tanımlıdır; yerel bağlantı değişince önceki build cache’i kullanılmaz.

TypeScript sürümü kök pnpm-workspace.yaml katalogundaki 7.0.2'dir. Next.js 16.4.3 varsayılan proje-yerel tsc CLI yoluyla build sırasında tip kontrolü yapar; ignoreBuildErrors veya TypeScript 6 fallback'i yoktur. Frontend lint için Oxlint, format için Oxfmt kullanılır; bağımsız tsc typecheck korunur. Oxlint React/Hooks, Next.js, JSX erişilebilirlik ve Vitest yerleşik kural gruplarını açar. `lint`, uyarıları hata sayar ve ardından Oxfmt check çalıştırır; bu nedenle mevcut `check:frontend` ve frontend CI format denetimini de içerir. Type-aware lint için ek tsgolint bu geçişe eklenmez. Vitest/MSW ve Playwright sürümleri manifestlerde tam sabittir. Node .nvmrc, pnpm kök packageManager kaynağından seçilir.

## Çalıştırma

Repo kökünde:

```sh
corepack enable
pnpm install --frozen-lockfile
cp apps/web/.env.example apps/web/.env.local
# Development publishable key değerini yalnız .env.local içine yerleştir.
pnpm dev:web
```

Uygulama adresi http://127.0.0.1:3000. NEXT_PUBLIC_APP_ORIGIN OAuth, kayıt ve kurtarma callback'inin güvenilen origin'idir. Development Supabase projesi docs/development-connection.json ile tanımlıdır; yalnız URL ve publishable key istemciye gider. .env.local Git dışında kalır. Yayın sırasında kesin origin ile `/auth/callback` ve `/auth/callback?next=/parola-yenile` adreslerinin Supabase izin listesi ve sağlayıcı dönüşü doğrulanır; environment yazılması tek başına hosted Auth kabulü değildir.

`(auth)` route grubu mevcut `/giris`, `/parolami-unuttum`, `/parola-yenile`, `/dogrulama` yollarını korur ve `/kayit` ekler. Native Supabase SDK parola, Google, e-posta doğrulamalı kayıt, kurtarma ve TOTP işlemlerinin sahibidir. Kayıt yalnız `display_name` metadata’sı taşır; rol/organizasyon üretmez. Doğrulama bekleyen kayıt oturum açmış sayılmaz. Callback PKCE exchange ve güvenli dönüş yolu denetimini korur; korumalı ana sayfa sunucuda kullanıcı ve MFA seviyesini doğrular.

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

## Paket ve CI ayrımı

Frontend komutları yalnız @ftksaas/web, @ftksaas/ui ve gerekli ortak tip kontrollerini seçer. test:backend yalnız backend paketini seçer. Mevcut genel pnpm test tüm workspace testlerini manuel çalıştırabilir; frontend CI bunu kullanmaz. verify-isolation.mjs gerçek Turbo dry-run grafiğinde iki yönlü ayrımı kontrol eder, backend testini çalıştırmaz.

Frontend checks workflow'u yalnız apps/web, packages/ui ve kendi workflow değişiklikleriyle PR/main'de veya manuel başlar. Backend-only değişiklik frontend testlerini başlatmaz. Ortak sözleşme/TypeScript ayarı/kök manifest/lockfile/Turbo değişiklikleri ayrı Frontend contract compatibility workflow'unda kurulum, frontend typecheck ve görev grafiği denetimi çalıştırır; tam frontend/backend test zinciri başlatmaz. Workflow'ların concurrency grupları ve artifact adları backend'den ayrıdır.

Ters yöndeki tetikleme ve merge kabulü mevcut [CI politikası](../../docs/ci-policy.md#ci-split--frontendbackend-kaynak-sınırı) kapsamındadır; frontend çalışması backend workflow/gate kaynaklarını değiştirmez. Yerel görev ayrımı uzak CI kabulünün yerine geçmez.

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
- `StudioWorkspace`: native oturum altında gerçek account/organization/center ve kullanıcı ayarı okumaları. Kuruluş/merkez seçici yoktur; izinli merkezler kartlarla gösterilir. Closed/bootstrap kuruluşlar için merkez okuması yapılmaz. Oturum kapandıktan sonra geç gelen yanıt ekrana taşınmaz; API hatası sentetik veriye dönüştürülmez. Ders/öğrenci/paket/finans/rapor/inbox alanları canlı consumer’ları bağlanana kadar açık bir hazırlık durumu gösterir.
- `AdminPreview`: URL hash ve geri/ileri gezinme; ders günü seçimi, öğrenci arama/filtre, detay panelleri ve örnek kart ekleme. Geçici eklenen kartlar yenilemede sıfırlanır. Bildirim okundu durumu yalnız önizleme belleğindedir; CSV açıkça örnek olarak indirilir.
- `preview-data`: yalnız `/tasarim` tarafından kullanılan kurgusal kişiler, dersler ve paketler. Fiyatlar/öğrenci sayıları ürün kararı veya canlı veri değildir.

TR/EN ve açık/koyu/sistem teması mevcut tercih altyapısını kullanır. Ürün ayarları/backend bağlantısı veya Syncfusion takvim entegrasyonu bu tasarım tesliminden türetilmez. `admin-design.spec.ts` gezinme/detay, örnek kayıt izolasyonu, klavye araması, mobil menü, axe, TR/EN ve büyütülmüş metin akışlarını gerçek tarayıcıda doğrular. Testlerin yazılmış olması çalışıp geçtiği anlamına gelmez; gerçek CI sonucu ayrıca değerlendirilir.
