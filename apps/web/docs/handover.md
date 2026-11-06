# Frontend sohbet devri

Aktif bölüm, geliştirme sırası, bağımlılık ve kabulün tek sahibi [todo teslim kaydıdır](todo.md#7-bölüm-bölüm-teslim-tek-aktif-bölüm).

## Devam bağlamı

Kullanıcı Pro tamamlanmadan ilk ürün tesliminin yapılamayacağını belirtti ve bağımsız modül haritasının `apps/web/docs` belgelerine aktarılmasını istedi. Plan aynı todo içinde güncellendi; raporun R00–R14 sırası mevcut S01–S13 ve Pro alt kapsamlarına bağlandı. Yeni paralel roadmap oluşturulmadı. Tasarım/uygulama yöntemi [geliştirme rehberindedir](development.md#plan-ve-rol-uyarlamasi).

PR237 anlaşma/ekip kaynağı main'e birleşti; aynı main ve dağıtım kanıtı [todo kaynak kaydında](todo.md#1-kaynak-ve-değerlendirme-yöntemi). Aktif dal `feature/web-r00-action-reader-alignment`; kullanıcı §7'ye göre R00'dan itibaren ilerlemeyi istedi. Kaynak uzlaştırma ve altı eylem okuyucusu uyumu ardından R01 org/merkez erişim ayrımı ele alındı. Bir sonraki kapsam, açık bağımlılıklar ve kabulün tek sahibi [§7](todo.md#7-bölüm-bölüm-teslim-tek-aktif-bölüm); yeni paralel sıra kurulmaz.

XREQ-023/024 backend kaynak/CI/development kanıtı yeniden doğrulandı; backend kaydında hosted okumalar da vardır. Backend bekleme hükmü artık geçerli değildir; mevcut frontend okuyucularının exact projection uyumu bu adayda, Chrome/canlı ekran kabulü açık kalır. Tarayıcı/Chrome/canlı kontrol çalıştırılmadı; kullanıcı yeniden istemeden başlatılmaz. Kaynak, test, aday/main, yayın ve gerçek kabul ayrı durumlardır. Dummy kayıtlar/audit geçmişi korunur.

Çalışan native Auth, typed transport, kurtarma, takvim, kişi, satış, finans ve belge temeli korunur. Yeni dilim mevcut shadcn/ui ve hazır bileşenlerle yürür; genel kabuk/framework veya CRM auth/backend göçü açılmaz. Business'ın sonraki kapsamı ve sağlayıcı alımının ilk teslim etkisi [todo](todo.md) sahibindedir; burada ikinci görev listesi tutulmaz.

Büyük, anlamlı modül PR tercihi ve Draft PR yolu sürer; her endpoint/commit için ayrı PR açılmaz. CI beklememe tercihi, kaynak bağlı kontrol/inceleme ve merge/dağıtım kanıtını kaldırmaz. Yeni full clean başlarsa kök AGENTS uyarınca run/kaynak bilgisiyle devir yapılır. Frontend uygulama/belge yazma alanı kök AGENTS sınırında `apps/web` ve gerektiğinde `packages/ui` içindedir; backend, ortak sözleşme, AGENTS ve CI politikası değiştirilmez.
