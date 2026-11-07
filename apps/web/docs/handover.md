# Frontend sohbet devri

Aktif bölüm, geliştirme sırası, bağımlılık ve kabulün tek sahibi [todo teslim kaydıdır](todo.md#7-bölüm-bölüm-teslim-tek-aktif-bölüm).

## Devam bağlamı

Kullanıcı Pro tamamlanmadan ilk ürün tesliminin yapılamayacağını belirtti ve bağımsız modül haritasının `apps/web/docs` belgelerine aktarılmasını istedi. Plan aynı todo içinde güncellendi; raporun R00–R14 sırası mevcut S01–S13 ve Pro alt kapsamlarına bağlandı. Yeni paralel roadmap oluşturulmadı. Tasarım/uygulama yöntemi [geliştirme rehberindedir](development.md#plan-ve-rol-uyarlamasi).

PR239 R01/R02 genişlemesiyle main’e birleşti (`af5b8a536d1bc500b51dabdefea0cbfde0e639e7`). İlk R00/R01 head'in başarılı CI kanıtı ve genişleyen paketin sıra/kabul sahibi [§7](todo.md#7-bölüm-bölüm-teslim-tek-aktif-bölüm). Mevcut Pro anlaşma, yoklama, finans veya kabuk yeniden yazılmadı.

İşletim ayarları gerçek org/center katalog/sürüm/writable ve selected reset/history ile bağlandı; kişi detayına native Auth/MFA korumalı kalıcı scoped adres eklendi. Kabuk/kişi focus/visibility dönüşünde eski detayı kaldırıp yeniden okur. Ortak org settings kurtarması merkez keşfi olmadan da çalışır. Tam kaynak ve açık kapsam ilgili R01/R02 kaydındadır.

PR251 main sonrasında son kullanıcı talimatı R05–R11 kaynak geliştirmelerini tamamlamaktır. Aktif dal `feature/web-r05-r11-completion`; başlangıç main, kanıt, uygulama ve açık kabulün tek sahibi [todo §7](todo.md#7-bölüm-bölüm-teslim-tek-aktif-bölüm). R05 paket değişimi, R09 gerçek self paneli ve R11 etkinlik/Pratik yeni kaynakları; R06/R07/R08 ve desteklenen R10 mevcut temeli korur. Meta/Google gerçek bağlantıları/dış site adaptörleri bu sürümde iptal; önceki yerel karar commit’i bu dala taşındı. Tarayıcı/canlı kabul, aday CI, main ve dağıtım ayrı aşamalardır. R01’in kalan Owner/CM keşfi sonraki R12–R14 işleriyle karıştırılmaz.

Yerel Playwright’ın pinli156 tarayıcı sürümü için resmî Google storage ZIP’i doğrulandı; tam Chrome ortamın Unix socket kısıtına takıldı. Aynı sürüm resmî headless-shell ile yerel sentetik22 Chromium access/flow/320px/%200/axe testi geçti. Bu hosted veya yeni R11 ekranlarının tam tarayıcı kabulü değildir; CI dört tarayıcı matrisi değişmedi.

Çalışan native Auth, typed transport, kurtarma, takvim, kişi, satış, finans ve belge temeli korunur. Yeni dilim mevcut shadcn/ui ve hazır bileşenlerle yürür; genel kabuk/framework veya CRM auth/backend göçü açılmaz. Business'ın sonraki kapsamı ve bu sürümde iptal edilen Meta/Google bağlantıları/dış site adaptörlerinin tek kapsam sahibi [todo ürün sınırlarıdır](todo.md#2-ürün-sınırları); burada ikinci görev listesi tutulmaz.

Büyük, anlamlı modül PR tercihi ve Draft PR yolu sürer; her endpoint/commit için ayrı PR açılmaz. CI beklememe tercihi, kaynak bağlı kontrol/inceleme ve merge/dağıtım kanıtını kaldırmaz. Yeni full clean başlarsa kök AGENTS uyarınca run/kaynak bilgisiyle devir yapılır. Frontend uygulama/belge yazma alanı kök AGENTS sınırında `apps/web` ve gerektiğinde `packages/ui` içindedir; backend, ortak sözleşme, AGENTS ve CI politikası değiştirilmez.
