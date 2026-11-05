# FtkSaaS backend

Supabase uygulaması, SQL kaynakları, Edge işlevleri, sunucu adapter’ı ve izole kabul testleri bu pakettedir. [Repo ve ortam düzeni](../../docs/monorepo.md), [kaynak indeksi](../../docs/source-index.md) ve [güncel kabul](docs/00-FtkSaaS-yeni-sohbet-devir.md) esas alınır.

Repo kökünden:

```sh
pnpm dev:backend
pnpm --filter @ftksaas/backend dev:info
pnpm --filter @ftksaas/backend test:db
pnpm --filter @ftksaas/backend test:api
pnpm stop:backend
```

Bu paketin içinden aynı komutlar `pnpm dev:start`, `pnpm dev:info`, `pnpm test:db`, `pnpm test:api`, `pnpm dev:stop` olarak çalışır. Testlerden önce izole native servis hazır olmalıdır. Reset içeren tam kabul yalnız açık son adayda kullanılır; hosted ortam test hedefi değildir.

Yerel/CI Edge worker politikası [config.toml](supabase/config.toml) içindedir. İstekler arasında worker'ı kapatan `oneshot`, ölçülen bellek birikimine karşı seçildi; yeniden yükleme maliyeti ve [tanı/kabul sınırları](docs/00-FtkSaaS-yeni-sohbet-devir.md#yerelci-edge-bellek-düzeltmesi) dikkate alınır. Her istekte mevcut kimlik ve oturum kontrolleri çalışır. Core ve on iki API shard kendi izole runtime/DB'sini kullanır. Yerel kaynak değişikliği yansımıyorsa bundle'ı yeniden üretip `pnpm dev:stop` → `pnpm dev:start` ile runtime'ı yeniden başlat.

Normatif makine kaynağı [ortak şema](../../packages/api-contracts/schema/contract.json); TypeScript ve embedded Edge sözleşmesi `pnpm generate` ile üretilir. Uygulanmış migration dosyası değiştirilmez. Runtime çıktısı `.artifacts` ve private yerel durum `.dev` altında kalır; tarihsel raporlar yeniden yazılmaz.

Proje iş akışları [ortak `/docs` rehberindedir](../../docs/workflows.md). Backend ajanının sorumlulukları [AGENTS](AGENTS.md), belge üretimi/kontrolü ve CD paketi [çalışma rehberindedir](docs/documentation-development.md). Backend geliştirme yol haritasının [görev/kabul listesi](docs/remaining-work.md) ve [uygulama sırası](docs/production-queue.md) bu paketin `docs` klasöründedir; kaynak kabulü yalnız devir dosyasındadır. Üç teknik referans ve API eşlemesi `pnpm --filter @ftksaas/backend docs:update` ile üretilir; değişen akış önce `docs:review` ile incelenir.

**Yetki sınırı:** Geliştirme durumu ve sohbet devri kendi `docs` dizinindedir; kök `/docs` yalnız görevde değişen ortak sözleşme için yazılır. Frontend belgeleri salt okunur; [ortak taleplerde](../../docs/requests.md) yalnız kendi alanını güncelle. Kapsam dışı veya belirsiz değişiklikte gerekçeyle kullanıcı onayı iste; mevcut açık yetkiyi tekrar sorma. [Ajan kuralları](AGENTS.md).

## CI kaynak bütçesi ve kurulum ölçümü

Bütün API shard’ları kendi gerçek full-clean yüklerinde `FTK_EDGE_MEMORY_GUARD=1` ile toplam Edge RSS bütçesini doğrular. Uygulanan bütçe 3 GiB'dir: başarılı oneshot koşusundaki yaklaşık 1,19 GiB tepenin iki katından fazla pay bırakır. En az iki geçerli Edge örneği gerekir; eksik/bozuk ölçüm veya bütçe aşımı kabulü kapatır. Aşım gözlenen komut grubunu durdurur; mevcut CI cleanup izole stack'i kapatır. Beş saniyelik örnekleme anlık tepeyi veya sızıntının yokluğunu kanıtlamaz. Politika `oneshot` kalır; yeni bir benchmark ortamı kurulmaz.

Clean hazırlık raporu native start, ilk readiness, reset/migration, reset sonrası readiness ve boş DB doğrulamasını ayrı ölçer. Temiz migration ve boş Auth/tenant/receipt kabulü korunur. Shard dağıtımı kaynak hash’i ve satır sahipliği doğrulanan ortak parça envanterini on iki runner’a dağıtır. Normal parçalar iki süreçte, global fixture yazan parçalar ayrı seri fazlarda yürür. Geçmiş kaynak bağlı süreler yalnız planlama girdisidir; yeni gerçek süreler core/API artifact’larında raporlanır.

Hosted CD smoke, olmayan finans kaynağını reddetmeyi, doğrudan RPC ve geçersiz/iptal edilmiş oturumu denetler. Olmayan kaynağın reddi hosted çapraz-tenant kabulü diye adlandırılmaz; gerçek iki tenant izolasyonu aday API testlerinde sınanır.
