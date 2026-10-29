# Aktif üretim sırası

Açık işlerin tanımı ve kabul ölçütleri yalnız [tek backlog’dadır](remaining-work.md). Kaynak/CI/CD durumu yalnız [00 devirde](contracts/00-FtkSaaS-yeni-sohbet-devir.md) tutulur.

1. **OPS-01 / REL-01 aktif:** Kullanıcının son kararıyla PR83 kabul edilmiş worker/export dilimiyle birleşti. Ayrı feat/privacy-rel01 adayında genel privacy purge/retention/legal hold, backup non-resurrection ve tam REL-01 kapatılır. Beş lane kalan iş yükleri ve gerçek provider/config/RPO/RTO/yük kabulü bu kapsamda doğrulanır; önceki dar payload cleanup genel imha sayılmaz. Güncel kabul00 devirde, kapanış ölçütleri tek backlog'dadır.
2. **WEB-01:** Son kullanıcı talimatıyla yalnız frontend altyapısını tamamla. PR68 geri alması sonrası ayrı adayda hazır shadcn/ui blokları, Türkçe/İngilizce, tema ve native Auth bağlantısını doğrula. PR76’nın test edilen kaynağını sabit tut; Oxlint/Oxfmt geçişini onun üstünde ayrı araç adayı olarak hazırla. Backend kaynaklarını değiştirme. Ekran tasarımı, menüler ve iş akışları ayrı çalışmadır; Expo kurulumu sonraya bırakılır.
3. **CI-ADMIN:** Aktif OPS-01/REL-01 adayı boyunca güncel repo korumaları ve kaynak bağlı kabul korunur. Takvim gerçek ekran/route bağımlılığı açık kalır.

Yeni görev tamamlanan kalemi backlog’da kapatır ve sıradan kaldırır; eski prompt/CI/pilot metinleri buraya eklenmez. P08 işleri ve gerçek SMS ayrı kapsamdadır. Full clean başlarsa [AGENTS bekleme kuralı](../AGENTS.md#full-clean-sırasında-kullanıcıya-devir) uygulanır.
