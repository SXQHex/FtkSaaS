# Aktif üretim sırası

Açık işlerin tanımı ve kabul ölçütleri yalnız [tek backlog’dadır](remaining-work.md). Kaynak/CI/CD durumu yalnız [00 devirde](contracts/00-FtkSaaS-yeni-sohbet-devir.md) tutulur.

1. **Üretim önceliği:** ST-03 PR65’in kabulünü yalnız süre optimizasyonuyla engelleyen kapıyı dar düzeltmeyle advisory yap. Fonksiyon/core/dört API ve kaynak kanıtı zorunlu kalır. Suite optimizasyonu/tekrar denetimi/bölme işi açılmaz; mevcut üretim işi sürdürülebilir. Dar düzeltme için kaynak bağlı CI ve kurulum güvenliği korunur.
2. **WEB-01:** Son kullanıcı talimatıyla yalnız frontend altyapısını tamamla. PR68 geri alması sonrası ayrı adayda hazır shadcn/ui blokları, Türkçe/İngilizce, tema ve native Auth bağlantısını doğrula. PR76’nın test edilen kaynağını sabit tut; Oxlint/Oxfmt geçişini onun üstünde ayrı araç adayı olarak hazırla. Backend kaynaklarını değiştirme. Ekran tasarımı, menüler ve iş akışları ayrı çalışmadır; Expo kurulumu sonraya bırakılır.
3. **ST-03 → OPS-01 → REL-01:** Sonraki backend işleri; ST-02 kapandı. Kullanıcı yeni sırayı başlatmadan bu kapanış görevi bunları uygulamaz.

Yeni görev tamamlanan kalemi backlog’da kapatır ve sıradan kaldırır; eski prompt/CI/pilot metinleri buraya eklenmez. P08 işleri ve gerçek SMS ayrı kapsamdadır. Full clean başlarsa [AGENTS bekleme kuralı](../AGENTS.md#full-clean-sırasında-kullanıcıya-devir) uygulanır.
