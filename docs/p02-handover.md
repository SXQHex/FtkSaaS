# P02 paket ve seans yaşam döngüsü

P02-C uygulandı; hedefli runtime kabulü bekliyor: freeze_preview/apply ve freeze_end_preview/apply. Satış saat dilimindeki açık aralık, plan/ürün/max_days/çakışma/bağımlılık kontrolleri; eski rezervasyonlar aynı allocation ile korunur, dondurulan tarihte yeni hak kullanılamaz. Erken bitirme gerekçeli ve ileri tarihli; yalnız fiilî yerel günler kadar ücretsiz uzatma kalır, paid_days değişmez. 127 runtime / 72 contract_only / 37 migration. Kalan6 satış API açık; aday clean henüz yok.


P02-B uygulandı; hedefli runtime doğrulaması bekliyor: credit_adjust/entitlement_extend tam etki tokeniyle, actor/center/reason/change/dependency ve bütün etkilenen kayıt onayıyla atomik çalışır. reservation_impact_apply alternatif tek tüketim yoludur. Kredi düşüşü mevcut allocation/rezervasyonu iptal etmez; kullanılabilir yeni hak negatife düşse de yeni kayıt açılmaz. Uzatma açık ileri tarihli00:00 ve entitlement account sürümü ister; tarihi yoklama/hakediş üretmez. entitlements_get account/sale sürümü ve freeze okuması taşır. 123 runtime / 76 contract_only / 36 migration; kalan10 P02 API açık.


P02-A uygulaması PR #28 Draft/development dalında: session_cancel_preview/apply ve replacement_session_create eklendi (121 runtime / 78 contract_only / 35 migration). Önizleme aktör/merkez/token/bağımlılıkları; açık seans iptali hak serbest bırakma, bekleme/teklif kapama ve uygulama içi bildirimle atomiktir. Yerine seans yalnız linked yeni kayıttır. Yeni Auth→Edge→RPC negatif/replay/yarış/rollback testleri eklendi; runtime sonucu henüz doğrulanmadı. Kalan12 P02 API açık; bütün P02 bitmeden aday clean/merge yok.

Başlangıç main f6afef4bdc4ef1bcbf37697ae771fef04a9fb455; PR #28. P01/CI-02 kapalıdır. Yerel native DB artefact indirmesi DNS ETIMEOUT nedeniyle açılamadı; GitHub hedefli CI gerçek runtime kanıtını sağlayacak. Yapısal ve davranış kabulü ayrı tutulur.
