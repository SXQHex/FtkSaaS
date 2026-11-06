# Frontend sohbet devri

Aktif bölüm, geliştirme sırası, bağımlılık ve kabulün tek sahibi [todo teslim kaydıdır](todo.md#7-bölüm-bölüm-teslim-tek-aktif-bölüm).

## Devam bağlamı

Kullanıcı Pro tamamlanmadan ilk ürün tesliminin yapılamayacağını belirtti ve bağımsız modül haritasının `apps/web/docs` belgelerine aktarılmasını istedi. Plan aynı todo içinde güncellendi; raporun R00–R14 sırası mevcut S01–S13 ve Pro alt kapsamlarına bağlandı. Yeni paralel roadmap oluşturulmadı. Tasarım/uygulama yöntemi [geliştirme rehberindedir](development.md#plan-ve-rol-uyarlamasi).

Bu değişiklik yalnız üç frontend belgesini günceller; uygulama veya backend geliştirmesi, PR233/234 birleştirmesi ve canlı kabul yapmaz. İncelenen main'in tam SHA/CI/yayın kanıtı [todo kaynak bölümünde](todo.md#1-kaynak-ve-değerlendirme-yöntemi); güncel aday/kabul ayrımları kendi S07/S08 ve bağımlılık kayıtlarındadır. Eski başarı yeni belge adayına taşınmaz.

Devam ederken önce güncel main ve açık adayları yeniden doğrula. [S07'nin mevcut adayındaki](todo.md#web-s07) yoklama kaynağı/test/kabul kayıtlarını koru; ikinci uygulama başlatma. Bu belge dalı ile aday uzlaştırılırken S07'nin yeni kanıtları silinmez, eski Starter sırası geri getirilmez. S07'nin ardından seçilecek Pro paketinin kapsamı ve finans okuyucusu hazır olduğunda yapılacak uyum [tek sıra kaydında](todo.md#7-bölüm-bölüm-teslim-tek-aktif-bölüm) tanımlıdır.

Tarayıcı/Chrome/canlı kontrolleri açık bırakıp geliştirmeye odaklanma talimatı sürer; kullanıcı yeniden istemeden çalıştırılmaz. XREQ-023/024 için beklenen backend main/dağıtım teslimi doğrulandı; frontend uyumunun hazır devam işi ve canlı kabulün ayrı açık durumu todo sahibindedir. Kaynak, otomatik test, aday/main, yayın ve hosted kabul ayrı durumlardır; ertelenen gerçek kontroller ilk Pro tesliminden düşürülmez. Dummy kayıtlar ve audit geçmişi korunur; önceki kabulde kullanılan geçici oturum/rol işlemleri yeniden başlatılmaz.

Çalışan native Auth, typed transport, kurtarma, takvim, kişi, satış, finans ve belge temeli korunur. Yeni dilim mevcut shadcn/ui ve hazır bileşenlerle yürür; genel kabuk/framework veya CRM auth/backend göçü açılmaz. Business'ın sonraki kapsamı ve sağlayıcı alımının ilk teslim etkisi [todo](todo.md) sahibindedir; burada ikinci görev listesi tutulmaz.

Büyük, anlamlı modül PR tercihi ve Draft PR yolu sürer; her endpoint/commit için ayrı PR açılmaz. CI beklememe tercihi, kaynak bağlı kontrol/inceleme ve merge/dağıtım kanıtını kaldırmaz. Yeni full clean başlarsa kök AGENTS uyarınca run/kaynak bilgisiyle devir yapılır. Yazma sınırı bu görevde `apps/web/docs` içindedir; backend, ortak sözleşme, AGENTS ve CI politikası değiştirilmez.
