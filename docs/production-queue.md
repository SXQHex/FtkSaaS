# Aktif üretim sırası

Açık işlerin tanımı ve kabul ölçütleri yalnız [tek backlog’dadır](remaining-work.md). Kaynak/CI/CD durumu yalnız [00 devirde](contracts/00-FtkSaaS-yeni-sohbet-devir.md) tutulur.

1. **WEB-01 / Starter frontend ilk hedef:** Kullanıcının son kararıyla `frontend-design` kullanılarak Starter’ın bütün ekran/iş akışları tamamlanır. Kapsam yalnız [Starter matrisindedir](remaining-work.md#web-01--starter-frontend-tamamlama-matrisi). İlk uygulama dilimi Syncfusion takvim okuma/seans detayı; ardından program yazmaları, öğrenci/paket/satış/rezervasyon/yoklama/tahsilat ve kalan Starter consumer’larıdır. Her dilimde gerçek DTO/izin/plan/preview/version/replay korunur; aynı kaynak frontend CI ve hosted kabulü ayrıdır. Expo bu hedefin dışındadır.
2. **OPS-01:** Ayrı backend worker/retention işi kendi kaynak bağlı kabulüyle sürer; frontend çalışması backend runtime/CI kapılarını değiştirmez.
3. **REL-01 ve CI-ADMIN:** OPS-01 sonrasında tam restore/Auth/Storage/config, yük ve güncel repo korumaları doğrulanır. ST-03 ve PUBLIC-01 gerçek ekran/route/provider bağımlılıkları WEB-01 içinde ilgili dilime bağlanır.

Yeni görev tamamlanan kalemi backlog’da kapatır ve sıradan kaldırır; eski prompt/CI/pilot metinleri buraya eklenmez. P08 işleri ve gerçek SMS ayrı kapsamdadır. Full clean başlarsa [AGENTS bekleme kuralı](../AGENTS.md#full-clean-sırasında-kullanıcıya-devir) uygulanır.
