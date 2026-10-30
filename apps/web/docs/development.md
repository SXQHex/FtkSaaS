# Frontend geliştirme

Kapsam yalnız FtkSaaS'tır. Web uygulaması apps/web, ortak arayüz packages/ui sahibindedir. Kök [AGENTS](../../../AGENTS.md), [istemci protokolü](../../../docs/client-integration.md) ve [API sözleşme paketi](../../../packages/api-contracts/README.md) önceliklidir. Starter bölüm planı, aktif bölüm, bağımlılıklar ve frontend kabul takibi [todo.md](todo.md) içindedir. Repo/backend kabulü [00 devirde](../../backend/docs/00-FtkSaaS-yeni-sohbet-devir.md), ortak işler [proje backlog’unda](../../backend/docs/remaining-work.md) tutulur.

## Bileşen ve araç kuralları

Önce shadcn/ui ve ondan türetilmiş hazır bloklar değerlendirilir. Özel bileşen yalnız hazır seçenek ihtiyacı karşılamadığında yazılır. packages/ui/registry-sources.json resmî registry adreslerini, alınan kaynakların SHA256 değerlerini ve sidebar-07/login-02/signup-02 uyarlamalarını kaydeder; aynı paketin LICENSE dosyası MIT bildirimini korur. Kullanılan bileşenler React 19 ve Tailwind 4 ile çalışır.

Kullanıcının 29 Ekim onayıyla yönetici kabuğu korumalı `/` route’una taşınır; eski bağlantı doğrulama ekranı ve login-01 Auth bileşenleri kaldırılır. Yeni Auth ekranları login-02/signup-02 tabanında ortak iki sütunlu düzeni kullanır; mobilde yalnız form bölümü gösterilir. `/tasarim` ayrı sentetik referans olarak kalır. Genel tablo/form framework’ü kurulmaz.

Üç starter için değerlendirme ve tam kaynak commit’leri [starter kaynak kaydındadır](../starter-sources.json). Bu aşamada starter dosyası kopyalanmadı: mevcut araçlar korunur, Clerk/Better Auth/veritabanı ve Base UI katmanları taşınmaz. shadcn uyarlamasının dosya/commit/hash izi registry kaydında, MIT bildirimi packages/ui/LICENSE içindedir.

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

Uygulama adresi http://127.0.0.1:3000. NEXT_PUBLIC_APP_ORIGIN OAuth, kayıt ve kurtarma callback'inin güvenilen origin'idir. Development Supabase projesi docs/development-connection.json ile tanımlıdır; yalnız URL ve publishable key istemciye gider. .env.local Git dışında kalır. Yayın sırasında kesin origin ile `/auth/callback` ve `/auth/callback?next=/reset-password` adreslerinin Supabase izin listesi ve sağlayıcı dönüşü doğrulanır; environment yazılması tek başına hosted Auth kabulü değildir.

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

## Paket ve CI ayrımı

Frontend komutları yalnız @ftksaas/web, @ftksaas/ui ve gerekli ortak tip kontrollerini seçer. test:backend yalnız backend paketini seçer. Mevcut genel pnpm test tüm workspace testlerini manuel çalıştırabilir; frontend CI bunu kullanmaz. verify-isolation.mjs gerçek Turbo dry-run grafiğinde iki yönlü ayrımı kontrol eder, backend testini çalıştırmaz.

Frontend checks workflow'u yalnız apps/web, packages/ui ve kendi workflow değişiklikleriyle PR/main'de veya manuel başlar. Backend-only değişiklik frontend testlerini başlatmaz. Ortak sözleşme/TypeScript ayarı/kök manifest/lockfile/Turbo değişiklikleri ayrı Frontend contract compatibility workflow'unda kurulum, frontend typecheck ve görev grafiği denetimi çalıştırır; tam frontend/backend test zinciri başlatmaz. Workflow'ların concurrency grupları ve artifact adları backend'den ayrıdır.

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
- `StudioWorkspace`: native oturum altında gerçek account/organization/center ve kullanıcı ayarı okumaları. Kuruluş/merkez seçici yoktur; izinli merkezler kartlarla gösterilir. Closed/bootstrap kuruluşlar için merkez okuması yapılmaz. Oturum kapandıktan sonra geç gelen yanıt ekrana taşınmaz; API hatası sentetik veriye dönüştürülmez. Ders programı calendar_get_v1, güncel seans detayı session_get_v1 ile okunur. Öğrenciler bölümü gerçek kişi okumaları ve öğrencilik işlemlerine bağlıdır; paket/finans/rapor/inbox alanları canlı consumer’ları bağlanana kadar açık bir hazırlık durumu gösterir.
- `AdminPreview`: URL hash ve geri/ileri gezinme; ders günü seçimi, öğrenci arama/filtre, detay panelleri ve örnek kart ekleme. Geçici eklenen kartlar yenilemede sıfırlanır. Bildirim okundu durumu yalnız önizleme belleğindedir; CSV açıkça örnek olarak indirilir.
- `preview-data`: yalnız `/tasarim` tarafından kullanılan kurgusal kişiler, dersler ve paketler. Fiyatlar/öğrenci sayıları ürün kararı veya canlı veri değildir.

TR/EN ve açık/koyu/sistem teması mevcut tercih altyapısını kullanır. Önizlemedeki örnek kayıtlar gerçek hesap veya hosted kabulü değildir. `admin-design.spec.ts` gezinme/detay, örnek kayıt izolasyonu, klavye araması, mobil menü, axe, TR/EN ve büyütülmüş metin akışlarını gerçek tarayıcıda doğrular. Testlerin yazılmış olması çalışıp geçtiği anlamına gelmez; gerçek CI sonucu ayrıca değerlendirilir.


## Starter ekran yönü ve takvim sınırı

Kullanıcının yüklediği `frontend-design` becerisi bu dilimde uygulanır. Kabul edilmiş nötr tema korunur: beyaz `#ffffff`, yüzey `#fafafa`, ikincil yüzey `#f5f5f5`, ana metin `#171717`, yardımcı metin `#737373`, çizgi `#e5e5e5`; uygulamanın mevcut OKLCH tokenları tek CSS kaynağıdır. Sistem sans yazı ailesi, sol hizalı içerik ve tabular saat/rakamlar kullanılır. Görsel odak stüdyonun gün/hafta programıdır; yeni KPI kartları ve dekoratif grafikler eklenmez. Mobilde saat ve ders adı öne çıkar; detay Sheet ile bağlam korunur. Kontenjan yoklama veya gerçekleşme değildir.

`SessionCalendar` alan görünüm modeliyle çalışır; `scheduler-engine` Syncfusion tiplerini/olaylarını dışarı taşımaz. Ağ işlemleri `ScheduleWorkspace`/`SessionDetail` tarafından mevcut typed Edge transport ile yapılır. Gün sınırları merkezin IANA saat diliminden UTC’ye çevrilir; DST günleri24 saate sabitlenmez. Sayfa/merkez değişiminde eski istek sonucu gösterilmez; yenileme hatasında eski kayıtlar güncel gibi sunulmaz. Program yazmaları, tekrar üretimi, rezervasyon, çakışma ve iptal kuralları istemci takvimine taşınmaz.

Syncfusion yalnız çizelge seçildiğinde dinamik yüklenir. `NEXT_PUBLIC_SYNCFUSION_LICENSE_KEY`, kurulu35.x sürümüne uygun onaylı Community License anahtarıyla build ortamında tanımlanır; Turbo build girdisidir. Anahtar yokken lisanssız Scheduler başlatılmaz, aynı gerçek verinin liste görünümü kullanılır. Liste/gün/hafta işlevi lisans anahtarı gerektirmez. Anahtar değerini kaynak/PR/log’a yazma. İlk adaptör salt okunurdur; sürükle-bırak, resize ve dahili editör kapalıdır. Seans seçimi bizim detay panelimize gider. Lisans kaydı: [Community License](https://www.syncfusion.com/products/communitylicense); uygulama kaynakları [Scheduler](https://ej2.syncfusion.com/react/documentation/schedule/getting-started), [yerelleştirme](https://ej2.syncfusion.com/react/documentation/schedule/localization) ve [saat dilimi](https://ej2.syncfusion.com/react/documentation/schedule/timezone). Üçüncü taraf paketler kendi lisans bildirimlerini korur.

Starter’ın ekran/işlem ayrıntıları ve bölüm kabul ölçütleri [frontend yol haritasında](todo.md) tutulur. Bir bölüm bitmeden sonraki bölümün uygulamasına geçilmez; bu rehber ikinci görev listesi içermez.


## Doğrudan seans bağlantısı

Canlı seans panelindeki “Seans sayfasını aç” bağlantısı `/organizasyon/{org_id}/seans/{session_id}` yolunu açar. Route UUID'leri doğrular, native kullanıcı ve gerekli MFA seviyesini sunucuda denetler; `session_get_v1` her açılış/yenilemede canlı tenant ve seans yetkisini backend'de değerlendirir. İsteğe merkez eklenmez; yönetici merkez listesine bağımlı olmadan öğrenci/eğitmen seans erişimi korunur. Sayfada tarihler açıkça etiketlenen cihaz saat dilimindedir; takvimdeki Sheet merkez saat dilimini kullanır. DTO'da başlık/merkez adı bulunmadığı için doğrudan sayfa bunları uydurmaz. Mevcut SessionSummary gerçek durum/kontenjan/yoklama verisini iki görünümde paylaşır. Dar ekranda kontenjan değerleri alt alta akar.

Giriş ve MFA `next` yerel hedefini korur. Google/kayıt başlatılmadan önce server action güvenli hedefi on dakikalık HttpOnly/SameSite=Lax çerezine yalnız `/auth/callback` yolunda yazar; HTTPS ortamında Secure açıktır. Callback çerezi tüketip aynı path ile siler. Böylece mevcut kesin `/auth/callback` provider URL'si korunur; yeni redirect wildcard'ı gerekmez. Açık parola kurtarma `next` hedefi çerezden önceliklidir. Çerez başka cihazda yoksa veya süresi dolmuşsa varsayılan `/` açılır. Bu navigasyon bilgisi erişim yetkisi değildir.

`frontend-design` yönü mevcut nötr renk/sistem font/sol hizalı düzeni korur: doğrudan sayfanın odağı seans tarihi ve saatidir; başlık, programa dönüş ve yenileme eylemleri tek içerik sütunundadır. Yeni dekoratif grafik veya ikinci takvim sistemi eklenmez. Gerçek ICS URL şablonu, host ve signing key yapılandırması ayrı hosted kabul dilimidir; bu kaynak değişikliği platform ayarı yapmaz.

## Seans değişikliğini önizleme ve uygulama

Doğrudan seans sayfasındaki düzenleme eylemi `SessionChange` formunu açar. Saat, toplam ve isteğe bağlı kategori kontenjanı ile tek seans/bu ve sonraki seanslar kapsamı, mevcut typed `session_change_preview_v1` çağrısına gider. Değişmeyen saatler (kesirli saniyeler dahil), kaynaklar ve görevlendirmeler patch'e eklenmez. Cihaz saat dilimi açıkça etiketlenir; geçersiz yerel saat kaydırılmaz, yinelenen saat için UTC farkı seçilir. Backend seri değişikliklerini merkezin saat dilimi ve program kurallarıyla üretir; kullanıcı onaydan önce gerçek etkilenen seansları görür.

Önizleme engelleri veya süre aşımı uygulamayı durdurur. `session_change_apply_v1` yalnız ayrı kullanıcı onayıyla gönderilir; sürüm, izin, rezervasyon/hak, oda/eğitmen ve kontenjan kurallarını backend denetler. Merkez verilmediğinde backend seans/önizlemeden çözer. Owner veya okunabilir seans bilgisinden CM yetkisi türetilmez; düzenleme çağrısının gerçek yetki reddi kullanıcıya gösterilir. `management_state_get_v1` sınıf/oda/program selector’ları henüz canlı olmadığından program kataloğu ön yükleme kaynağı yapılmaz; diğer desteklenen selector’lar ayrı kapsamdadır.

Göndermeden önce operation_key ve önizleme id/token'ı bu sekmenin sessionStorage alanında doğrulanmış kullanıcı/organizasyon/seans anahtarıyla tutulur; Auth tokenı saklanmaz. Yazılamayan veya bozuk takip kaydında yeni değişiklik gönderilmez. Kaybolan yanıtta aynı kayıt sayfa yenilemesinden sonra geri alınır; kullanıcı `operation_status_get_v1` ile sonucu kontrol edebilir veya birebir aynı işlemi yeniden gönderebilir. Her transport denemesinde yeni request_id, aynı işlemi sürdürürken aynı operation_key kullanılır. NOT_FOUND veya erişim kaybı önceki işlemin başarısızlığı sayılmaz; belirsiz işlem için yeni anahtar üretilmez. Otomatik retry/polling yoktur. Kesin sonuç sonrasında güncel seans yeniden okunur.

`/tasarim/seans` aynı form ve onay görünümünü açıkça kurgusal, canlı backend'e erişmeyen bağımsız eylemlerle gösterir. Nötr tek sütunlu düzen, dar ekranda satıra bölünen eylemler, TR/EN ve açık/koyu tercihler kullanılır. Önizleme örneği veya mock testleri gerçek hosted yazma kabulü değildir; bu dilimin kalan kapsamı [WEB-S03](todo.md#web-s03) kaynağındadır.


## Öğrenci listesi ve merkezde öğrencilik

`StudentsWorkspace`, gerçek hesap kimliği ve erişilebilir aktif merkezlerle çalışır. `people_list_v1` için merkez ve `relationship: student` filtresi, desteklenen `created_at_asc` sırası ve25 kişilik cursor sayfası kullanılır. Bu filtre geçmiş/pasif öğrenci ilişkilerini de kapsar; yalnız aktif öğrenci veya toplam öğrenci sayısı iddia edilmez. Arama backend’in ad/soyad kapsamındadır. Arama/merkez değişiminde cursor sıfırlanır; eski yanıtlar ve hata sonrası eski liste güncel veri gibi gösterilmez.

Liste satırı mevcut shadcn Sheet’i açar. `person_get_v1` güncel kişi detayını yeniden okur; yalnız seçilen merkezin ilişkileri gösterilir ve aktif ilişki varsa geçmiş pasif ilişki mevcut durumu değiştirmez. İletişim alanının paylaşılmaması ile boş olması ayrılır; iletişim doğrulaması hesap bağlantısı sayılmaz. Bilinmeyen hesap, disiplin adı veya belge durumu üretilmez. Klavye ile panel kapanınca odak liste satırına, satır artık yoksa aramaya döner.

`student_activate_v1` ayrı onay, `student_deactivate_v1` onay ve gerekçe ister. Backend plan limiti, merkez yetkisi ve açık işlem engellerini denetler; yalnız okuyabilmek yazma yetkisi sayılmaz. DTO’da olmayan expected_version gönderilmez. Başarı sonrasında kullanıcı güncel bilgileri gösterdiğinde liste ve detay yeniden okunur; durum iyimser olarak değiştirilmez.

`person_create_v1` kişi ve iletişim kaydını oluşturur, öğrencilik ilişkisini açmaz; oluşturulan kişi etkinleştirilene kadar ayrı bir oturum kapsamlı listede tutulur. `person_update_v1` satır sürümünü gönderir; iletişim değiştirilirse değiştirilen iletişim doğrulanmamış olarak yeniden girilir, değişmeyen doğrulama bilgileri korunur. `account_access_send_v1` açık kullanıcı eylemiyle e-posta davet işi başlatır; `job_status_get_v1` yalnız iş durumunu gösterir. İşin başarılı olması davetin kabul edildiğini veya yerel hesaba bağlandığını kanıtlamaz. Bu kişi DTO’sunda hesap bağı/hesap durumu okuması yoktur; `linked_person_ids` farklı kişi profillerini anlatır.

Profilde belge durumu uydurulmaz. `document_requirements_get_v1` gerçek rezervasyon, satış veya katılım bağlamı ister; belge kabulü de bu işlem akışının parçasıdır. Native Auth SMTP uygulama davet göndericisi değildir; mevcut davet teslim aracı yalnız yerel sentetik SMTP içindir. Hosted davet gönderici/teslim kabulü backlog’da izlenir. UI bir eylemin rol/plan yetkisini önden tahmin etmez; yazma ve erişim her istekte backend tarafından denetlenir.

Öğrencilik değişikliği isteği (pasifleştirme gerekçesi dahil), kişi oluşturma/düzenleme komutu veya davet anahtarı bu sekmenin kullanıcı/organizasyon/merkez/kişi kapsamlı sessionStorage kaydına yazılır; kimlik doğrulama tokenı hiçbir zaman saklanmaz. Kişi oluşturma/düzenlemenin bekleyen tam komutu iletişim alanlarını içerir ve kesin sonuçta silinir. Belirsiz sonuçta yeni anahtar üretilmez; manuel sonuç kontrolü veya aynı payload/operation_key ile tekrar gönderim yapılır, transport request_id yenilenir. NOT_FOUND veya sonraki yetki kaybı önceki işlemin başarısızlığı sayılmaz. Sonuç süresi dolarsa replay engeli yenileme sonrasında da korunur. Makbuzun center_relationships referansı kişi ID’siyle karşılaştırılmaz. Detay okuması reddedilse bile mevcut bekleyen işlemin sonuç kontrolü erişilebilir kalır; kontrol/yazma yetkisini backend yeniden denetler. Kapanan panelin geç yanıtı takip kaydını değiştiremez.

`/tasarim/ogrenciler`, aynı liste/panel/onay bileşenlerini yalnız sentetik ve bellekteki eylemlerle gösterir. Tasarım, mevcut nötr palet ve sistem fontuyla ad/öğrencilik durumunu öne çıkaran sol hizalı satırlar ve sağ detay panelidir; dar ekranda panel tam genişlik kullanır. TR/EN, tema, arama/boş durum, sayfalama, açık işlem reddi ve etkinleştirme/pasifleştirme örnekleri gerçek hosted kabulü değildir. Açık kapsam yalnız [WEB-S04](todo.md#web-s04) içindedir.


## Hesap ve güvenlik

Korumalı `/account` sayfası, yönetici kabuğundaki hesap panelinden açılır. Profil yazma sürümü kendi `management_state_get_v1` okumasından alınır. Profil adı/ad/soyad/doğrulanmamış telefon ile native doğrulanmış ve bekleyen e-posta/telefon ayrı tutulur. Fotoğraf yalnız private `media_get_v1` içeriğinden okunur; PNG/JPEG/WebP yüklemesi 1 MB ve SHA-256 kontrolüyle profil komutuna bağlanır. Eksik identity projeksiyonu boş alanla ezilmez.

Oturumlar ve güvenlik geçmişi kendi cursor okumalarını kullanır. Oturum etiketi gerçek sürümle yazılır; seçili, mevcut ve diğer oturumları kapatma işlemleri ayrıdır. TOTP enrollment/challenge native SDK'dadır; doğrulanmış faktör kaldırma backend onayı ister. Parola değişimi backend challenge → native nonce/update; e-posta/telefon değişimi native request/resend/verify üzerinden yürür. Provider hatası teslim veya doğrulama başarısı değildir.

Google hesap bağlama için `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, ilgili web origin'ine izin verilmiş Google Identity Services istemci kimliğidir. Native Google girişi bu ayardan bağımsızdır. Bağlamada taze kendi girişinden alınan proof → GIS nonce bağlı ID token → `account_google_link_prepare_v1` → native ID-token `linkIdentity` sırası korunur. E-posta/parola ile yeniden girişte mevcut doğrulanmış TOTP de doğrulanır; Google ile yeni giriş yapmış kullanıcı mevcut native proof'u kullanabilir. Tazelik ve güçlü oturum koşullarını backend denetler; refresh eski girişi taze yapmaz. Proof, parola, Google tokenı ve nonce recovery kaydına veya log'a yazılmaz.

`/invite` doğru hesabı göstererek davet kodunu açık onayla kabul eder. URL fragment'inde token varsa hemen tüketilip geçmişten çıkarılır; sorgu parametresine yazılmaz. Sekmede yalnız hesap kapsamlı token özeti ve işlem anahtarı tutulur; ham davet kodu saklanmaz. Kayıt/doğrulama sonrası davet kodu yeniden girilebilir.

Hesap silme önce gerçek etki/engel/süre önizlemesini, ardından açık silme onayı ve taze doğrulamayı ister. `/account/deletion` global kendi talebini `job_status_get_v1(org_id:null)` ile kontrol eder; son talep referansı native kullanıcı kapsamındadır. İş sonucu ile privacy sonucu ve bekleyen kapsamlar ayrı gösterilir; job success tek başına fiziksel imha değildir.

Profil, oturum etiketi/iptali ve silme komutlarının kayıp yanıtında kullanıcı/sekme kapsamlı aynı payload ve operation_key korunur; request_id her çağrıda yenilenir. Sonraki NOT_FOUND/yetki kaybı önceki yazmanın başarısızlığını kanıtlamaz. Result expiry ve payload uyuşmazlığında replay bloke edilir. Storage hatasında yeni komut gönderilmez. Aktif hesap değişimi veya çıkış eski hesabın geç yanıtını ekrana taşımaz.

Auth dosyaları yalnız `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/mfa` yollarındadır; eski Türkçe dosyalar ve yönlendirmeleri yoktur. Provider callback `/auth/callback` olarak kalır. Ortamın izin listesinde gerçek origin ile `/auth/callback` ve `/auth/callback?next=/reset-password` doğrulanmalıdır. Kod/yerel test bu sağlayıcı yapılandırmasının veya gerçek e-posta/SMS/Google tesliminin kabulü değildir; durum [todo.md](todo.md) içindedir.


Hesap silme yanıtı kaybolursa `/account/deletion` sayfasındaki bekleyen işlemi bulma eylemi native kullanıcı kapsamlı takip bağlantısını okur. Özgün pending komut tekrar açık onay ve taze native proof ile sürdürülür; yeni preview/key üretilmez. Normal hesap projeksiyonu deletion_pending sırasında kapanabileceğinden bu recovery yolu account_get'e bağımlı değildir. Proof'un native kullanıcı kimliği sunucunun doğruladığı kimlikle giriş öncesi ve son oturumda eşleşmelidir; asıl silme/replay yetkisi yine backend'dedir. Takip meta verisi bir yetki kanıtı değildir.
