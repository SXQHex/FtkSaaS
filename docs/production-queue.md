# Aktif üretim sırası

Açık işlerin tanımı ve kabul ölçütleri yalnız [tek backlog’dadır](remaining-work.md). Kaynak/CI/CD durumu yalnız [00 devirde](contracts/00-FtkSaaS-yeni-sohbet-devir.md) tutulur.

1. **CI-SIMPLIFY aktif:** Kullanıcının 28 Ekim kararıyla tek `ci/automatic-pr-proof-main` adayı üzerinde otomatik PR kabulü, main proof, manuel targeted ve eski yolların temizliğini tamamla. Son kaynak inceleme/gerçek full clean ve kaynak bazlı kurulum sonrası normal merge, main proof ve development CD doğrula. Full clean başlayınca run/kaynak bilgileriyle dur; polling yok. CI-SPLIT frontend karşılıklı kabulü ayrı gerçek kanıt ister.
2. **WEB-01:** Son kullanıcı talimatıyla yalnız frontend altyapısını tamamla. PR68 geri alması sonrası ayrı adayda hazır shadcn/ui blokları, Türkçe/İngilizce, tema ve native Auth bağlantısını doğrula. Backend kaynaklarını değiştirme. Ekran tasarımı, menüler ve iş akışları ayrı çalışmadır; Expo kurulumu sonraya bırakılır.
3. **ST-03 → OPS-01 → REL-01:** Sonraki backend işleri; ST-02 kapandı. Kullanıcı yeni sırayı başlatmadan bu kapanış görevi bunları uygulamaz.

Yeni görev tamamlanan kalemi backlog’da kapatır ve sıradan kaldırır; eski prompt/CI/pilot metinleri buraya eklenmez. P08 işleri ve gerçek SMS ayrı kapsamdadır. Full clean başlarsa [AGENTS bekleme kuralı](../AGENTS.md#full-clean-sırasında-kullanıcıya-devir) uygulanır.
