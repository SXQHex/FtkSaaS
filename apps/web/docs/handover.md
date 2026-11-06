# Frontend sohbet devri

Aktif bölüm, geliştirme sırası, bağımlılık ve kabulün tek sahibi [todo teslim kaydıdır](todo.md#7-bölüm-bölüm-teslim-tek-aktif-bölüm).

## Devam bağlamı

Kullanıcı Pro tamamlanmadan ilk ürün tesliminin yapılamayacağını belirtti ve bağımsız modül haritasının `apps/web/docs` belgelerine aktarılmasını istedi. Plan aynı todo içinde güncellendi; raporun R00–R14 sırası mevcut S01–S13 ve Pro alt kapsamlarına bağlandı. Yeni paralel roadmap oluşturulmadı. Tasarım/uygulama yöntemi [geliştirme rehberindedir](development.md#plan-ve-rol-uyarlamasi).

PR233 yoklama/görev kaynağı main'e birleşti; aynı main teslimi ve yeni Pro paketinin tabanı [todo kaynak kaydında](todo.md#1-kaynak-ve-değerlendirme-yöntemi) doğrulandı. Aktif dal `feature/web-pro-team-agreements`; S02 Pro ekip/anlaşma ve program önkoşulu birlikte geliştirilir. Önceki yoklama/finans yeniden yazılmaz. Bu paketin kaynak/otomatik doğrulaması, kalan ekip işleri ve gerçek kabul sınırı [anlaşma kaydındadır](todo.md#pro-egitmen-anlasmalari).

Tarayıcı/Chrome/canlı kontrolleri açık bırakıp geliştirmeye odaklanma talimatı sürer; kullanıcı yeniden istemeden çalıştırılmaz. Son kullanıcı düzeltmesine göre XREQ-023/024 backend teslim kabulü doğrulanmadı; backend çalışması devam ediyor. Bekleyen frontend uyumu ve kabulün sahibi todo kaydıdır. Kaynak, otomatik test, aday/main, yayın ve hosted kabul ayrı durumlardır; ertelenen gerçek kontroller ilk Pro tesliminden düşürülmez. Dummy kayıtlar ve audit geçmişi korunur; önceki kabulde kullanılan geçici oturum/rol işlemleri yeniden başlatılmaz.

Çalışan native Auth, typed transport, kurtarma, takvim, kişi, satış, finans ve belge temeli korunur. Yeni dilim mevcut shadcn/ui ve hazır bileşenlerle yürür; genel kabuk/framework veya CRM auth/backend göçü açılmaz. Business'ın sonraki kapsamı ve sağlayıcı alımının ilk teslim etkisi [todo](todo.md) sahibindedir; burada ikinci görev listesi tutulmaz.

Büyük, anlamlı modül PR tercihi ve Draft PR yolu sürer; her endpoint/commit için ayrı PR açılmaz. CI beklememe tercihi, kaynak bağlı kontrol/inceleme ve merge/dağıtım kanıtını kaldırmaz. Yeni full clean başlarsa kök AGENTS uyarınca run/kaynak bilgisiyle devir yapılır. Frontend uygulama/belge yazma alanı kök AGENTS sınırında `apps/web` ve gerektiğinde `packages/ui` içindedir; backend, ortak sözleşme, AGENTS ve CI politikası değiştirilmez.
