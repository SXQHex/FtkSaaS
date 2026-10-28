# Backend ve ortak entegrasyon sırası

Açık işlerin tanımı ve kabul ölçütleri yalnız [tek backlog’dadır](remaining-work.md). Backend/ortak kaynak CI/CD durumu [00 devirde](contracts/00-FtkSaaS-yeni-sohbet-devir.md) tutulur. Frontend sırası ve durumu [apps/web/PLAN.md](../apps/web/PLAN.md) sahibindedir; burada frontend görev listesi tutulmaz.

1. **CI-SPLIT:** Kullanıcının son talimatıyla backend/frontend test ve CD kaynak sınırını ayır. Pozitif sahiplik, saf belge hafif yolu ve kaynak bağlı negatifleri tamamla; frontend test yapısını frontend sahibi kurar. Trusted CI kurulumu ve gerçek uzak kabul tamamlanmadan kapatma.
2. **ST-03 → OPS-01 → REL-01:** Sonraki backend işleri; ST-02 kapandı. Kullanıcı yeni sırayı başlatmadan bu kapanış görevi bunları uygulamaz.

Yeni görev tamamlanan kalemi backlog’da kapatır ve sıradan kaldırır; eski prompt/CI/pilot metinleri buraya eklenmez. P08 işleri ve gerçek SMS ayrı kapsamdadır. Full clean başlarsa [AGENTS bekleme kuralı](../AGENTS.md#full-clean-sırasında-kullanıcıya-devir) uygulanır.
