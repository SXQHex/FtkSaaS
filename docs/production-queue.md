# Aktif üretim sırası

Açık işlerin tanımı ve kabul ölçütleri yalnız [tek backlog’dadır](remaining-work.md). Kaynak/CI/CD durumu yalnız [00 devirde](contracts/00-FtkSaaS-yeni-sohbet-devir.md) tutulur.

1. **REPO-01 aktif:** FtkSaaS backend ve belgelerini temiz apps/packages/docs sahipliğine taşıma; sonraki saaspt göçüne hazırlama, pnpm/Turbo/ortak sözleşme, CI ve SSoT belge düzeni. [Uygulama ve ortam devri](monorepo.md).
2. **WEB-01:** saaspt kaynak aktarımı ve mevcut geliştirme Supabase’ine native Auth + gerçek API ekran entegrasyonu; tasarım/etkileşim değişikliği ayrı gerekçelendirilir.
3. **ST-02 → ST-03 → OPS-01 → REL-01:** kalan Starter tüketicileri ve işletim kabulü. Ürün belirsizliği yoksa mevcut kararlarla ilerlenir.

Yeni görev tamamlanan kalemi backlog’da kapatır ve sıradan kaldırır; eski prompt/CI/pilot metinleri buraya eklenmez. P08 işleri ve gerçek SMS ayrı kapsamdadır. Full clean başlarsa [AGENTS bekleme kuralı](../AGENTS.md#full-clean-sırasında-kullanıcıya-devir) uygulanır.
