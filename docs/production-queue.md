# Aktif üretim sırası

Açık işlerin tanımı ve kabul ölçütleri yalnız [tek backlog’dadır](remaining-work.md). Kaynak/CI/CD durumu yalnız [00 devirde](contracts/00-FtkSaaS-yeni-sohbet-devir.md) tutulur.

1. **ST-03 bekleme bağımlılığı:** Gerçek takvim kabulü seans ekranı ve gerçek org/session route'una bağlıdır; kullanıcı ekranın henüz olmadığını doğruladı. Önce WEB-01 kapsamında bu ekran/route hazırlanır; ardından development host/config ve gerçek HTTP/seans bağlantısı kabulü tek PR'de tamamlanır. Sahte route/config ile kapanış yapılmaz; açık iş ve kabul koşulları backlog'dadır.
2. **WEB-01:** Son kullanıcı talimatıyla yalnız frontend altyapısını tamamla. PR68 geri alması sonrası ayrı adayda hazır shadcn/ui blokları, Türkçe/İngilizce, tema ve native Auth bağlantısını doğrula. PR76’nın test edilen kaynağını sabit tut; Oxlint/Oxfmt geçişini onun üstünde ayrı araç adayı olarak hazırla. Backend kaynaklarını değiştirme. Ekran tasarımı, menüler ve iş akışları ayrı çalışmadır; Expo kurulumu sonraya bırakılır.
3. **OPS-01 → REL-01:** ST-03 sonrasındadır; bu kaynak eşitleme görevi bunları başlatmaz.

Yeni görev tamamlanan kalemi backlog’da kapatır ve sıradan kaldırır; eski prompt/CI/pilot metinleri buraya eklenmez. P08 işleri ve gerçek SMS ayrı kapsamdadır. Full clean başlarsa [AGENTS bekleme kuralı](../AGENTS.md#full-clean-sırasında-kullanıcıya-devir) uygulanır.
