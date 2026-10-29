# Aktif üretim sırası

Açık işlerin tanımı ve kabul ölçütleri yalnız [tek backlog’dadır](remaining-work.md). Kaynak/CI/CD durumu yalnız [00 devirde](contracts/00-FtkSaaS-yeni-sohbet-devir.md) tutulur.

1. **OPS-01 aktif:** Kullanıcının 29 Ekim kararıyla frontend'e bağlı ST-03 takvim kabulü beklerken worker/retention öne alınır. Gerçek iş kuyruğu, retry, kesinti, disable/restart ve fiziksel imha kanıtı ayrı doğrulanır; idle heartbeat veya partial privacy stage kapanış değildir. Sonraki sıra REL-01 ve CI-ADMIN doğrulamasıdır.
2. **WEB-01:** 29 Ekim son kullanıcı onayıyla yönetici kabuğu ve yeni Auth ekranlarını mevcut geliştirme Supabase’iyle `uye.fethiyetango.com` üzerinde yayınla. Ayrı frontend adayı, kaynak bağlı CI/main kabulü ve hosted Auth dönüşleri doğrulanır. Operasyonel modül consumer’ları ve Expo ayrı devam eder; backend kaynakları değiştirilmez.
3. **REL-01 ve CI-ADMIN:** OPS-01 sonrasında tam restore/Auth/Storage/config, yük ve güncel repo korumaları doğrulanır. Takvim gerçek ekran/route bağımlılığı açık kalır.

Yeni görev tamamlanan kalemi backlog’da kapatır ve sıradan kaldırır; eski prompt/CI/pilot metinleri buraya eklenmez. P08 işleri ve gerçek SMS ayrı kapsamdadır. Full clean başlarsa [AGENTS bekleme kuralı](../AGENTS.md#full-clean-sırasında-kullanıcıya-devir) uygulanır.
