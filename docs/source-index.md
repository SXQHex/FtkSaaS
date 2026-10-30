# Kaynak indeksi

Başlangıç: [AGENTS](../AGENTS.md) → [güncel kaynak/kabul](../apps/backend/docs/00-FtkSaaS-yeni-sohbet-devir.md) → [backlog](../apps/backend/docs/remaining-work.md) → [sıra](../apps/backend/docs/production-queue.md). Ardından görevle ilgili tek konu sahibi seçilir. Main’in tam SHA’sı ve aynı kaynağın kanıtı doğrulanır.

## Tek konu sahibi

| Konu | Yetkili kaynak |
|---|---|
| Ürün modülleri ve plan erişimi | [01 ürün kapsamı](contracts/01-FtkSaaS-urun-kapsam-sozlesmesi.md) |
| Yürürlükteki domain/ayar davranışı; D/U/Q/DS/FD kararları | [02 teknik sözleşme](contracts/02-FtkSaaS-teknik-sozlesme.md) |
| Henüz uygulamaya ayrılmamış P08 kabulü ve açık ürün tercihleri | [P08](decisions/P08-accepted-scope.md) |
| DTO, enum, operasyon, izin ve sürüm alanları | [Makine sözleşmesi](../packages/api-contracts/schema/contract.json); [üretilmiş API](contracts/05-FtkSaaS-O4-API-katalogu.md) |
| Durum/hata/izin açıklaması | [06 referansı](contracts/06-FtkSaaS-O4-durum-hata-izin.md) |
| API sırası, rol/plan, yan etki ve kurtarma | [WF00–WF20](workflows.md); [API eşlemesi](functions.md) |
| Ortak istemci transport’u | [Entegrasyon protokolü](client-integration.md) |
| Typed ayar ve native hesap tüketicileri | [Ayar rehberi](settings.md) |
| Fiziksel şema/güvenlik kaynakları | [Migration referansı](database.md), [güvenlik referansı](security.md); kesin DDL migration zinciri |
| Repo düzeni ve CI kabul kuralları | [Monorepo](monorepo.md), [CI politikası](ci-policy.md) |
| Backend dokümantasyon üretimi ve işletimi | [Dokümantasyon](../apps/backend/docs/documentation-development.md), [işletim](../apps/backend/docs/remote-backend-setup.md) |
| Frontend geliştirme/ekran uygulaması | [Web rehberi](../apps/web/docs/development.md) |
| Frontend modül planı, aktif bölüm, bağımlılık ve kabul | [Tek frontend yol haritası](../apps/web/docs/todo.md) |
| Backend/frontend talep, karşı alanın onayı ve teslim kabulü | [Tek talep kaydı](requests.md) |
| Frontend sohbet devri | [Frontend devir kaydı](../apps/web/docs/handover.md) |
| Bütün yaşayan belgelerin rolü ve konu sahipliği | [Üretilmiş belge haritası](documentation-map.md) |

Bir karar yalnız sahibinde güncellenir; eski hükmü bırakıp yeni tarihli zıt ek yazılmaz. WF uygulama sırasını, generated katalog makine sözleşmesini, durum kaydı kaynak/ortam kanıtını gösterir; bu roller yeni ürün kararı oluşturamaz. API sayısı, dosya bağlantısı veya mock başarı tam özellik kabulü değildir.

## Arşiv sınırı

`docs/history/` yalnız immutable tarihsel kanıt deposudur; güncel ajan başlangıç/arama/context listesine alınmaz. Yalnız açık tarihsel incelemede [kaynak/hash manifesti](history/manifest.json) üzerinden, belgeyi kaynak SHA’sıyla birlikte oku. Eski pending/başarı/izin bugünün durumuna taşınmaz. Yeni emekli belgeler için ikinci arşiv kopyası yaratılmaz; Git geçmişi korunur. Yaşayan belgeler tarihsel Markdown’a karar veya çalışma talimatı olarak bağlanamaz.

## Konum

Kök `/docs` ürün/API/iş akışı sözleşmeleri ve ortak kuralları tutar; uygulama geliştirme ilerlemesi, test günlüğü, aktif görev ve sohbet devri burada tutulmaz. Tek koordinasyon istisnası requests.md içindeki alanlar arası talep/onay kaydıdır; diğer dosyalar ortak ürün/iş/makine kuralları ve teknik sözleşmelerdir. Backend liderliğinde tanımlanan proje iş akışı ve SSoT kök `/docs`; backend sohbet/geliştirme/işletim `apps/backend/docs`; frontend geliştirme `apps/web/docs` sahibindedir. README ve AGENTS giriş/kural taşır, alan belgelerini kopyalamaz. Sahiplik envanteri `documentation.json`, akış/test/API eşlemesi `workflows.json` tek makine girdileridir; CI’da çalıştırılabilir politika girdisi olarak değerlendirilirler.
