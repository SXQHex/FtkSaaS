# Kaynak indeksi

Başlangıç: [AGENTS](../AGENTS.md) → çalışılan alanın README/AGENTS dosyaları → o alanın plan ve devir kaydı. Backend için [backend girişi](../apps/backend/README.md), frontend için [web girişi](../apps/web/README.md) kullanılır. Diğer alan yalnız ilgili sözleşme veya bağımlılık için okunur. Main’in tam SHA’sı ve aynı kaynağın kanıtı doğrulanır.

## Tek konu sahibi

Yaşayan belge ve konu sahiplerinin tek envanteri `documentation.json`, okunabilir görünümü [üretilmiş belge haritasıdır](documentation-map.md). Burada ikinci bir sahiplik tablosu tutulmaz. Görevle ilgili konu sahibini haritadan seç; API çağrı sırası için [WF rehberine](workflows.md), DTO/izin/hata için [makine sözleşmesine](../packages/api-contracts/schema/contract.json) git.

Bir karar yalnız sahibinde güncellenir; eski hükmü bırakıp yeni tarihli zıt ek yazılmaz. Ürün sözleşmesi kabul edilmiş hedefi, makine sözleşmesinin hedef metadata’sı onun denetlenen aktarımını, runtime alanları mevcut desteği gösterir. WF uygulama sırasını, generated katalog makine görünümünü, alanın durum kaydı kaynak/ortam kanıtını taşır. API sayısı, dosya bağlantısı veya mock başarı tam özellik kabulü değildir.

## Arşiv sınırı

`docs/history/` yalnız immutable tarihsel kanıt deposudur; güncel ajan başlangıç/arama/context listesine alınmaz. Yalnız açık tarihsel incelemede [kaynak/hash manifesti](history/manifest.json) üzerinden, belgeyi kaynak SHA’sıyla birlikte oku. Eski pending/başarı/izin bugünün durumuna taşınmaz. Yeni emekli belgeler için ikinci arşiv kopyası yaratılmaz; Git geçmişi korunur. Yaşayan belgeler tarihsel Markdown’a karar veya çalışma talimatı olarak bağlanamaz.

## Konum

Kök `/docs` ürün/API/iş akışı sözleşmeleri ve ortak kuralları tutar; uygulama geliştirme ilerlemesi, test günlüğü, aktif görev ve sohbet devri burada tutulmaz. Tek koordinasyon istisnası requests.md içindeki alanlar arası talep/onay kaydıdır; diğer dosyalar ortak ürün/iş/makine kuralları ve teknik sözleşmelerdir. Backend liderliğinde tanımlanan proje iş akışı ve SSoT kök `/docs`; backend sohbet/geliştirme/işletim `apps/backend/docs`; frontend geliştirme `apps/web/docs` sahibindedir. README ve AGENTS giriş/kural taşır, alan belgelerini kopyalamaz. Sahiplik envanteri `documentation.json`, akış/test/API eşlemesi `workflows.json` tek makine girdileridir; CI’da çalıştırılabilir politika girdisi olarak değerlendirilirler.
