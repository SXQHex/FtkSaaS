# Aktif üretim sırası

Açık işlerin tanımı ve kabul ölçütleri yalnız [tek backlog’dadır](remaining-work.md). Kaynak/CI/CD durumu yalnız [00 devirde](contracts/00-FtkSaaS-yeni-sohbet-devir.md) tutulur.

1. **ST-03 aktif:** PR65 main kabulü sonrası null-only paket alanlarını koru; organizasyonda üç isteğe bağlı renk kararını sözleşme/runtime/tip/devir ile tamamla. Ardından gerçek development takvim host/route/config kabulünü yap. Hazır renk/font kataloğu gereksinimi kalktı. Full clean başlayınca kaynak/run bilgileriyle dur; polling yok.
2. **WEB-01:** Son kullanıcı talimatıyla yalnız frontend altyapısını tamamla. PR68 geri alması sonrası ayrı adayda hazır shadcn/ui blokları, Türkçe/İngilizce, tema ve native Auth bağlantısını doğrula. PR76’nın test edilen kaynağını sabit tut; Oxlint/Oxfmt geçişini onun üstünde ayrı araç adayı olarak hazırla. Backend kaynaklarını değiştirme. Ekran tasarımı, menüler ve iş akışları ayrı çalışmadır; Expo kurulumu sonraya bırakılır.
3. **OPS-01 → REL-01:** ST-03 sonrasındadır; bu kaynak eşitleme görevi bunları başlatmaz.

Yeni görev tamamlanan kalemi backlog’da kapatır ve sıradan kaldırır; eski prompt/CI/pilot metinleri buraya eklenmez. P08 işleri ve gerçek SMS ayrı kapsamdadır. Full clean başlarsa [AGENTS bekleme kuralı](../AGENTS.md#full-clean-sırasında-kullanıcıya-devir) uygulanır.
