# Frontend sohbet devri

Aktif bölüm, geliştirme sırası, bağımlılık ve kabulün tek sahibi [todo teslim kaydıdır](todo.md#7-bölüm-bölüm-teslim-tek-aktif-bölüm).

## Devam bağlamı

Kullanıcı Pro tamamlanmadan ilk ürün tesliminin yapılamayacağını belirtti ve bağımsız modül haritasının `apps/web/docs` belgelerine aktarılmasını istedi. Plan aynı todo içinde güncellendi; raporun R00–R14 sırası mevcut S01–S13 ve Pro alt kapsamlarına bağlandı. Yeni paralel roadmap oluşturulmadı. Tasarım/uygulama yöntemi [geliştirme rehberindedir](development.md#plan-ve-rol-uyarlamasi).

PR239 R01/R02 genişlemesiyle main’e birleşti (`af5b8a536d1bc500b51dabdefea0cbfde0e639e7`). İlk R00/R01 head'in başarılı CI kanıtı ve genişleyen paketin sıra/kabul sahibi [§7](todo.md#7-bölüm-bölüm-teslim-tek-aktif-bölüm). Mevcut Pro anlaşma, yoklama, finans veya kabuk yeniden yazılmadı.

İşletim ayarları gerçek org/center katalog/sürüm/writable ve selected reset/history ile bağlandı; kişi detayına native Auth/MFA korumalı kalıcı scoped adres eklendi. Kabuk/kişi focus/visibility dönüşünde eski detayı kaldırıp yeniden okur. Ortak org settings kurtarması merkez keşfi olmadan da çalışır. Tam kaynak ve açık kapsam ilgili R01/R02 kaydındadır.

XREQ-023/024 frontend kaynak uyumu korunur. XREQ-026/027 backend kaynağı PR242 ile main’e geldi; frontend tüketimi ve ekran kabulü açık, kanıt kendi frontend takip alanında [ortak talep kaydındadır](../../../docs/requests.md#xreq-026). PR241 R03, PR243 birleşik R04/R05 ve PR244 belge uzlaştırması main’dedir. Kullanıcı R06/R07 devamı istedi; aktif dal `feature/web-r06-r07`, kapsam rezervasyon/bekleme ve mevcut yoklama üzerine hakediş/eğitmen ödemeleridir; son aday/main/dağıtım kanıtı ve kalan işlerin tek sahibi [§7](todo.md#7-bölüm-bölüm-teslim-tek-aktif-bölüm). R04 kapsamı [Pro program](todo.md#pro-program-kabulu), R05’in PR245 ile gelen XREQ-029 backend kaynağına frontend uyumu [Pro paket yaşam döngüsü](todo.md#pro-paket-yasam-dongusu) sahibindedir. Chrome/canlı kontroller kullanıcı talimatıyla açık; çalıştırılmadı. Kaynak, otomatik test, aday/main, yayın ve gerçek kabul ayrı durumlardır.

Çalışan native Auth, typed transport, kurtarma, takvim, kişi, satış, finans ve belge temeli korunur. Yeni dilim mevcut shadcn/ui ve hazır bileşenlerle yürür; genel kabuk/framework veya CRM auth/backend göçü açılmaz. Business'ın sonraki kapsamı ve sağlayıcı alımının ilk teslim etkisi [todo](todo.md) sahibindedir; burada ikinci görev listesi tutulmaz.

Büyük, anlamlı modül PR tercihi ve Draft PR yolu sürer; her endpoint/commit için ayrı PR açılmaz. CI beklememe tercihi, kaynak bağlı kontrol/inceleme ve merge/dağıtım kanıtını kaldırmaz. Yeni full clean başlarsa kök AGENTS uyarınca run/kaynak bilgisiyle devir yapılır. Frontend uygulama/belge yazma alanı kök AGENTS sınırında `apps/web` ve gerektiğinde `packages/ui` içindedir; backend, ortak sözleşme, AGENTS ve CI politikası değiştirilmez.
