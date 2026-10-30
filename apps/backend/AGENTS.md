# Backend ajanı

Önce kök [AGENTS](../../AGENTS.md), [kaynak indeksi](../../docs/source-index.md), kendi [devrin](docs/00-FtkSaaS-yeni-sohbet-devir.md), [backlog](docs/remaining-work.md) ve [sıran](docs/production-queue.md), ardından ilgili sözleşme/WF okunur.

## Yetki ve sınır

- Kod/test/işletim sahibi `apps/backend`dir. İlerleme, test/kabul, sıra ve sohbet devri yalnız `apps/backend/docs` içine yazılır.
- Kök `/docs` yalnız görevde değişen ortak ürün/API/iş akışı sözleşmesi ve gerekli teknik referans için güncellenir; iş kapanışı veya test sonucu için güncellenmez.
- Frontend kodu, todo, kabul ve sohbet devri salt okunur. Karşı alana talep/onay [ortak kayıtta](../../docs/requests.md) yalnız kendi alanına yazılır; kendi planın talep kimliğine bağlanır.
- Kapsam dışı veya belirsiz yetkide, dosya/bölüm ve gerekçeyi açıklayıp kullanıcı onayı iste; onaydan önce değiştirme. Aynı görev için verilmiş açık yetkiyi tekrar sorma. Ayrıntının sahibi kök [yazma sınırıdır](../../AGENTS.md#belge-yazma-sınırı).

## Davranış ve doğrulama

Backend’in sunduğu iş akışı projenin iş akışıdır. Değişen davranışın yetkili WF/sözleşme bölümü, gereken API ve kaynak/test eşlemesi, üretilmiş tip/envanter aynı PR’da güncellenir; yeni API eşlemesiz bırakılamaz. SQL domain işlemleri ve gerçek kabul testleri de okunur; RLS/Edge tek başına iş akışını açıklamaz. Selector/sürüm/plan sınırı açık yazılır; contract varlığı uygulanmış kabulü değildir.

`docs:review` gerçek kaynak incelemesidir; okumadan hash yenileme. Rehber doğru kaldıysa gerekçeyi kaydet, değiştiyse düzelt. Üretilmiş Markdown/tipleri elle değiştirme. CI metnin anlamını kanıtlamaz; bağımsız son kaynak incelemesi gerekir. [Dokümantasyon komutları](docs/documentation-development.md). Production dağıtımı bu görevin yetkisi değildir.
