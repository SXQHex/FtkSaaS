# P02 paket ve seans yaşam döngüsü

P02-A uygulaması PR #28 Draft/development dalında: session_cancel_preview/apply ve replacement_session_create eklendi (121 runtime / 78 contract_only / 35 migration). Önizleme aktör/merkez/token/bağımlılıkları; açık seans iptali hak serbest bırakma, bekleme/teklif kapama ve uygulama içi bildirimle atomiktir. Yerine seans yalnız linked yeni kayıttır. Yeni Auth→Edge→RPC negatif/replay/yarış/rollback testleri eklendi; runtime sonucu henüz doğrulanmadı. Kalan12 P02 API açık; bütün P02 bitmeden aday clean/merge yok.

Başlangıç main f6afef4bdc4ef1bcbf37697ae771fef04a9fb455; PR #28. P01/CI-02 kapalıdır. Yerel native DB artefact indirmesi DNS ETIMEOUT nedeniyle açılamadı; GitHub hedefli CI gerçek runtime kanıtını sağlayacak. Yapısal ve davranış kabulü ayrı tutulur.
