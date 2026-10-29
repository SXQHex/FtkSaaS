# Backend ajanı

Önce kök [AGENTS](../../AGENTS.md), [kaynak indeksi](../../docs/source-index.md), [güncel devir](docs/00-FtkSaaS-yeni-sohbet-devir.md), ortak backlog/kuyruk ve ilgili normatif sözleşme okunur. İş akışı projenin iş akışıdır: `/docs/workflows.md` ve `/docs/workflows.json` backend'in sürdürdüğü ortak entegrasyon yüzeyidir.

Her davranış diliminde etkilenen WF rehberi, açık API eşlemesi, test/uygulama kaynakları, makine sözleşmesi/tipler, API/envanter ve alan devri aynı PR'de güncellenir. Yeni API eşlemesiz bırakılamaz. RLS/Edge tek başına iş akışını açıklamaz; SQL domain işlemleri ve gerçek kabul testleri de okunur. Sürüm, selector ve plan desteği eksikse bunu frontend'e açık bağımlılık olarak bildir; yalnız contract'ta var diye uygulanmış gösterme.

`docs:review` bir kaynak inceleme kaydıdır. Scriptin istemesi nedeniyle okumadan onaylama veya sırf hash yenileyerek davranış anlatımını atlama. İlgili rehber zaten doğruysa gerekçeyi kaydet; değişmişse rehberi düzelt. Üretilmiş Markdown/tipleri elle düzeltme. CI metnin anlamını doğrulamaz; son kaynak incelemesi gerekir.

Sohbet devri, tanı, çalışma notları ve teknik işletim talimatları `apps/backend/docs` altında tutulur. Ürün kararı ve istemcinin ihtiyaç duyduğu iş akışı ortak `/docs` sahibindedir. [Dokümantasyon komutları](docs/documentation-development.md). Frontend tasarımı/istemci kodu ve production dağıtımı bu görevin kapsamı değildir.
