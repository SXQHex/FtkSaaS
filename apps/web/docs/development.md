# Web geliştirme

`apps/web` ürün Vite SPA'sıdır. Dosya tabanlı TanStack Router, TanStack Query, native Supabase Auth ve Edge istemcisi kullanır. Türkçe kaynak ve selector tipleri `src/i18n` altındadır. [Tasarım arşivi](../design-reference/README.md) salt okunur uygulama referansıdır.

## Ortak kaynaklar

- `@ftksaas/ui` React Aria/shadcn bileşenlerini ve ortak UI yardımcılarını taşır. Sahiplik `packages/ui` altındadır. Uygulamanın Tailwind giriş dosyası oradaki sınıfları tarar.
- `@ftksaas/api-contracts` DTO, operasyon ve hata tiplerini sağlar. Transport, browser Auth ve uygulamaya özel hata/indirme davranışı için Web'in Edge adapter'ını kullanır. Gerçek yetki, tenant ve plan kararı API'dedir. [İstemci protokolü](../../../docs/client-integration.md)
- TypeScript pin'i kök workspace kataloğundan, ortak seçenekler `@ftksaas/typescript-config` paketinden gelir. pnpm tek kök lockfile ile kurar.

## Router ve Query veri sahipliği

- `beforeLoad` yalnız native oturum, AAL/MFA ve hesap yaşam döngüsü kontrolünden sorumludur. Backend yetki, organizasyon ve merkez kararının tek kaynağı olmaya devam eder.
- Korumalı route loader'ları, Router context'teki **aynı** `QueryClient` üzerinden `accountQuery` okur. Hesap DTO'su Router loader cache'ine dönmez; ekranlar `useAccountProjection()` ile Query cache'ine abone olur. `/account` ve `/platform` ayrı, yetkili platform projeksiyonunu kullanır.
- Yönetim, eğitmen ve üye ekranlarının temel workspace okumaları `workspaceQuery` tanımını paylaşır; seans detayı içindeki alternatif `queryFn` sarmalayıcısının kaldırılması açık iştir (M11). Loader, doğrulanmış hesap projeksiyonundan sonra sorguyu engellemeden başlatır; `WorkspaceLayout` ve `MemberLayout` aynı Query anahtarından tüketir. Organizasyon URL search alanı olan route'larda `loaderDeps.org` bu anahtarla eşleşir; `centerId` workspace keşfinin anahtarı değildir.
- Organizasyon parametresi, route bileşeninin tipini bozmadan ilgili route'un `({ context, params })` veya `({ context, deps })` adapter'ından ortak `loadScopedAccount` fonksiyonuna aktarılır. Paylaşılan loader fonksiyonu `params` veya `deps` tipini kendisi tanımlamaz; TanStack Router bu tipleri her route için üretir.
- Parola girişinde `lib/query-client.ts` içindeki tek QueryClient kullanılır; yeni native oturum açılır açılmaz eski Query cache'i temizlenir; MFA kapısı geçilirse hesap aynı QueryClient'ta doğrulanıp platform projeksiyonuna yazılır. Aynı native UUID ile yeniden girişte de eski özel veriler korunmaz. Profilin ilk okuması ile güvenlik/oturum yenilemesi, bu Query projeksiyonunu paylaşır. İşlem sonrası hesap invalid edilir **sonra** güncel profil okunur.
- `defaultPreloadStaleTime: 0` Router'ın ayrı bir preload tazelik penceresini kapatır. Query tazelik ve yeniden okuma sahibidir; `router.invalidate()` kendi başına Query cache'ini geçersiz kılmaz. Etki oluşturan işlemlerde ilgili sorgu önce açıkça invalid edilir.
- MFA, davet, callback ve silme sonucu gibi kimlik yaşam döngüsü rotaları bu veri loader'ından ayrıdır. `scopedBackend` üzerindeki pinned-bearer / hesap eşleme kontrolü, özellikle komut ve receipt yolları için güvenlik doğrulaması olarak korunur; bir ekran verisi cache'i değildir.

## Geçici tarayıcı CI profili

Refactoring tamamlanana dek otomatik frontend CI'si yalnız **Desktop Chromium** projesinin on iki Playwright shard'ını ve **tam Playwright test envanterini** çalıştırır. Diğer tarayıcı profilleri ve senaryoları korunur, fakat CI tarafından seçilmez. Lint, tip, build, birim/coverage, erişilebilirlik kontrolleri ve aynı profilin tam test envanteri geçerlidir. Dört tarayıcı kabulü bu dönemde iddia edilemez; refactoring kapanışında [CI politikasındaki](../../../docs/ci-policy.md) kaynak-özel güvenilir kurulum süreciyle dört tarayıcı profili × üç shard düzeni geri alınır.

<a id="router--query-birleşik-veri-yaşam-döngüsü"></a>

## Router + Query birleşik veri yaşam döngüsü

**Tek mimari iş:** “Aşama 1” ve “Aşama 2” ayrı teslimler değil. Kod denetiminin somut M01–M14 bulguları, açık maddeleri, kaynakları, öncelikleri ve kapanış testleri yalnız [aktif frontend backlog'unda](remaining-work.md#router-query-birlesik) tutulur. Bu bölüm yürürlükteki teknik tercihin **nedenini** açıklar; uygulama ve CI kabulünü ileri tarihli/otomatik tamamlanmış saymaz.

### Veri sahibi ve güvenlik sınırı

- Router `beforeLoad` native oturumu/AAL/MFA ve hesap yaşam döngüsünü korur; loader aynı `QueryClient` üzerinde `accountQuery` hazırlayıp workspace fetch'i başlatır. Hesap DTO'su ikinci Router loader cache'ine dönmez. Backend JWT, org, center, role, plan ve gerçek işlem izninin tek yetki kaynağıdır.
- `accountQuery` key'i native actor + platform projeksiyonunu içerir; `workspaceQuery` key'i domain account + org seçimini içerir. Merkez, workspace keşif key'ine eklenmez; gerçek merkezi etkileyen feature sorgularında `centerId` bulunur. Organizasyon genelindeki rapor, kişi/abonelik sorgusuna gereksiz center bağımlılığı eklenmez.
- Native `SIGNED_IN` callback'inde kullanıcı UUID'si tek başına oturum kimliği değildir; `native-session-id` gerçek `session_id` değişimini sıradan focus/token refresh'ten ayırır. Aynı kullanıcı/yeni oturumda `removeQueries()` özel salt okumaları iptal edip siler; devam eden native komutun MutationCache/receipt yaşamı korunur. Farklı kullanıcı/çıkışta tam `clear()` uygulanır. `router.invalidate()`, Query cache'ini temizlemez; `AUTH_REQUIRED`/`SESSION_REVOKED` ile `FORBIDDEN`/plan retleri aynı genel logout'a dönüştürülmez.
- Özel ekranların React Aria portal hedefi kök sunum ağacının içindeki sabit bir host'tur. Oturum devri veya erişim yeniden doğrulaması sırasında bu ortak DOM atası `display:none`, `inert` ve `aria-hidden` olur; açık Dialog/Sheet ile işlem state'i birlikte korunur. Erişilebilir yüklenme modalı bu özel ağacın dışında native React Aria odak/overlay yönetimini kullanır. `/mfa` ve `/reset-password` kendi `beforeLoad` doğrulamalarını koruyan bağımsız Auth kapılarıdır. Regresyon ve kabul durumu [M07'nin tek kaydındadır](remaining-work.md#router-query-birlesik).
- Kullanıcının açık workspace yenilemesi, `refreshWorkspace()` ile aynı `workspaceQuery` ve `QueryClient` üzerinden `staleTime: 0` kullanır; mevcut iptal ve geç native session doğrulamasını atlamaz. Native merkez oluşturma readback'i kendi komut sonucunu saklar, fakat o snapshot'ı ortak workspace cache'ine yazmaz; ilgili Query ailesini invalid ederek güncel oturumun yeniden okumasını sağlar.
- `scopedBackend()` bugün **her** kullanımda pinned native bearer + uzak `account_get_v1` yapar; bu güvenli ama pahalı. Salt Query okumaları için mevcut doğrulanmış projeksiyonu yeniden kullanma, aktör/session bağını korumayı ve backend'in her isteği yetkilendirmesini şart koşar (M08). **Etkili komut, receipt/status ve ayrı idempotency doğrulaması bu performans çalışmasına karıştırılmaz.**
- `session-detail` aynı workspace key'i üzerinde kendi `queryFn` sarmalayıcısını tanımlar; ortak factory'yi tüketip erişim kaybını gözlemciye taşıma kararı M11 açık işidir.

### Mutation sonrası tutarlılık

- Query key, okuyucunun sonucunu değiştiren bütün değişkenleri (actor/tenant/kişi, filtre, dönem, cursor vb.) kapsar. Başka merkezin key'ini silmeden etkilenen **aile prefix'i** invalid edilir; her eski sayfa anında okunmaz.
- Native yazma/ACK/receipt → **zorunlu typed readback** → ilişkili Query ailelerini `refetchType: "none"` ile stale işaretleme → cursor dizininde **ilk sayfadan** görünür filtre/özet doğrulama ve pagination sıfırlama sırası korunur. Devam cursor'ı yazmadan sonra geçersiz sayılır; sonsuz sayfalı cache'deki eski continuation zinciri yeniden oynatılmaz. M01'in ortak cursor/cache kabulü (PR #375, CI #45050876444), M02'nin belge kabulü (PR #378, CI #45062246019), M03'ün erişim dizinleri kabulü (PR #380, CI #45067096531), M04'ün hakediş kabulü (PR #382, CI #45077126472) ve M05'in finans kabulü (PR #384, CI #45080914146) bağımsız tamamlanmıştır; alanlar arası A-ortak regresyon/CI kabulü PR #387, CI #45087934058 ve main/merge kanıtlarıyla kapatılmıştır. Var olan `peopleKeys`, `productsKeys`, `leadsKeys`, `financeKeys`, `memberReservationKeys` kullanılabilir; bütün feature'lara yeni factory zorlaması yok.
- Belge yayınında etki kapsamı doğrulanmış native readback'ten belirlenir: merkez yayını o merkezin, organizasyon yayını aynı aktör/organizasyonun tüm merkezlerinin belge Query ailelerini stale işaretler. Belgelerin aktif ve pasif katalog/sürüm sonsuz sayfaları, eski cursor zincirini yinelememek için **invalidation öncesi** ilk sayfaya daraltılır; çeviri paneli kaynağı sürüm anahtarıyla ayırır. Diğer organizasyon/aktör ve kabul kanıtı içeriği etkilenmez. M02'nin geç yanıtlı salt okumaları dar Query kapsamıyla iptal etme ve filtrelenmemiş ilk sayfada tek native okuma kullanma kabulü PR #378'in aynı kaynak/CI/merge kanıtıyla tamamlandı. M10 genel AbortSignal çalışması bu A-ortak kabulünün dışında açık kalır.
- M03 erişim dizinleri için davet ve hesap key'leri aktör/organizasyon/merkez prefix'i paylaşır; yazma sonrası önceden başlamış okuyucular iptal edilir, eski filtre/cursor varyantları `refetchType: "none"` ile stale olur. İki ilk sayfanın `FORBIDDEN` sonucu birbirini engellemez; ret başarı/boş veri olarak gösterilmez. Davet işi readback'i sonrası aynı mekanizma çalışır. Genelleştirilmiş logout ve ikinci mutation cache'i eklenmez.
- M04 hakediş teslimi, aynı aktör/organizasyon/merkezin dönem–kişi–cursor dizinini, eğitmen kataloğunu, görünür toplamlarını, ödeme editörü kaynaklarını ve bağlı self-hakediş okumalarını ortak `earningsKeys` üzerinden hedefler. Native ödeme veya etkinlikte hakedişi değiştiren write sonrasında önceki salt okumalar iptal edilir; sonsuz katalogların eski cursor zinciri yalnız ilk sayfaya indirilir ve eski varyantlar `refetchType: "none"` ile stale kalır. Native ödeme receipt/readback sonrası görünür ilk sayfa, katalog ve eğitmen sayaçları zorunlu okunur; farklı tenant etkilenmez. PR #382'nin CI/merge/main kabulü tamamlanmıştır; diğer alan ve gerçek sağlayıcı kabulleri ayrıdır.
- `useMemberCommand` ve alanın native komut adaptörleri tekrar yazılmaz: kayıp ACK'yi aynı operation key/receipt ile kurtarır, ACK sonrası ikinci write başlatmaz; sonuç okunamıyorsa `saved-unread` durumu korunur. Query cancellation etkili komutlara uygulanmaz.
- Abonelik Query key'i organizasyon düzeylidir; cache'de merkez bağlı işlem scope'u taşımak yerine merkez bilgisi komut hazırlanırken bağlanır (M12). Plan/inbox gibi dışarıdan değişebilen kaynaklar focus/reconnect sırasında yeniden doğrulanabilir; kilitli editör taslağı sessizce değiştirilemez.

### Trafik ve düşük karmaşıklık sınırı

- Salt-okumalar için `backend.read(operation, request, signal)`, Query `AbortSignal`'ını gerçek alt `fetch`'lere taşır; pahalı/cursor/çok adımlı okuyucularda yaygınlaştırma M10'dur. Standalone doğrulama ve native `call()` davranışını değiştirme.
- Rezervasyonda seans başına ek başlık/ders, hakedişte görünür eğitmen başına ek toplam okuması önce mevcut typed cevaplarla karşılaştırılır. Ancak gerçek ağ ölçümü fayda gösteriyorsa kısaltılır; yeni genel batch API ölçümsüz oluşturulmaz (M09).
- Sunum amacıyla key'e büyük DTO koymak (örn. `event-rows`, event presentation) zorunlu değil. Yalnız ölçülen yük varsa saf hesaplama/`useMemo` yeterli; sunucu sorguları ile asenkron hesap ayrı kalır (M13).
- **Yapılmayacaklar:** İkinci QueryClient/store, uygulama çapı `invalidateQueries()`, kör `staleTime: 0`, tüm ekranlara `useSuspenseQuery` dayatması, tüm CRUD'ları `useMutation`'a taşıma, güvenlik testlerini gevşetme.

### Doğrulama

Kabul tek kaynak SHA'sına bağlıdır. [Önceki regression testleri](../src/features/workspace/query-invalidation.test.ts), [Auth](../src/features/auth/account-query.test.ts), [abort transport](../src/lib/backend-read-cancellation.test.ts), [SPA navigasyon](../e2e/auth-spa-navigation.spec.ts) ve [scope geçişi](../e2e/auth-scope-transition.spec.ts) korunur. Eski filtre/cursor, rol kaybı, aynı hesap-yeni session, late reply, bilinmeyen ACK ve ağ sayısı önce/sonra senaryoları [açık kabul listesinde](remaining-work.md#router-query-birlesik) eksiksiz kapatılır. Tek Desktop Chromium koşusu diğer üç tarayıcı profilinin kabulü değildir.

## Yerel çalışma

Repo kökünden `corepack enable`, `pnpm install --frozen-lockfile` ve `pnpm dev:web` çalıştırın. Gerçek geliştirme servisi için `apps/web/.env.example` değişkenlerini Git dışındaki `apps/web/.env.development.local` dosyasında tanımlayın. `VITE_` değerleri tarayıcıya açıktır. Native Auth loopback dönüşü için izinli yerel origin ve `/auth/callback` kullanılır. Test fixture'ları loopback arayüzünde çalışır. Hosted DB'ye reset veya seed uygulanmaz.

| Komut                                                                                                            | İşlev                                                                |
| ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `pnpm check:frontend`                                                                                            | Web ve UI lint, format, tip, birim ve build                          |
| `pnpm build:web`                                                                                                 | Üretim SPA ve bundle denetimi · `apps/web/dist`                      |
| `pnpm --filter @ftksaas/web test:e2e:install`                                                                    | Yerel Playwright Chromium                                            |
| `pnpm test:frontend:e2e`                                                                                         | Üretim build'i ve seri Playwright Chromium                           |
| `pnpm --filter @ftksaas/web verify`                                                                              | Lint, format, i18n, build, seri birim/coverage ve Chromium kanıtı    |
| `pnpm --filter @ftksaas/web test:local --unit src/features/member-profile --e2e e2e/auth-member-profile.spec.ts` | Seçili birim ve tarayıcı testlerini tek işçiyle sırayla yürütme      |
| `pnpm --filter @ftksaas/web test:external`                                                                       | Yayımlı SPA/Google yönlendirmesi ve loopback Turnstile test anahtarı |
| `pnpm --filter @ftksaas/web audit:production`                                                                    | Üretim bağımlılıkları için JSON audit                                |
| `pnpm --filter @ftksaas/web audit:all`                                                                           | Kurulu workspace için tam JSON audit                                 |

Testler gerçek ürün davranışı için sentetik fixture, MSW ve Playwright kullanır. Playwright HTML/JSON/JUnit ve accessibility kanıtı uygulama rapor dizininde kalır. Hosted test sonuçlarını yerel senaryo sonuçlarından ayrı kaydet. Üretim release yöntemi [Cloudflare dağıtımı](../../../docs/ci-policy.md#cloudflare-dağıtımı) bölümündedir.

Cloudflare sürüm yüklemesi ile sürümün okunabilir olması aynı anda tamamlanmayabilir. [Yayın istemcisi](../scripts/cloudflare-delivery.mjs), [Wrangler'ın kendi yaklaşımıyla](https://github.com/cloudflare/workers-sdk/blob/daa5389863bd20ab655cf68a5f7cd63afeb30904/packages/wrangler/src/containers/deploy.ts#L169) yalnız yeni oluşturulan sürümün HTTP 404 / sayısal `100146` yanıtını toplam beş GET ve arada 500 ms ile ele alır. Upload veya deployment POST'u tekrar edilmez; sürüm kimliği/commit etiketi doğrulanmadan trafik değişmez. API hata kaydı yalnız HTTP durumu ve sayısal kodları taşır; ham sağlayıcı yanıtı veya credential yazılmaz. Kaynak yeniden doğrulaması, aktif sürüm/trafik ve yayımlı dosya hash kontrolleri [mevcut yayın sözleşmesine](../../../docs/ci-policy.md#cloudflare-dağıtımı) bağlıdır.
