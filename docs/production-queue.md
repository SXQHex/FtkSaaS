# Aktif üretim sırası

Açık işlerin tanımı ve kabul ölçütleri yalnız [tek backlog’dadır](remaining-work.md). Kaynak/CI/CD durumu yalnız [00 devirde](contracts/00-FtkSaaS-yeni-sohbet-devir.md) tutulur.

1. **ST-03 aktif:** Kullanıcının son talimatı Starter'da izinli bütün ayarların typed alan/default-miras/yetki/gerçek tüketici kabulüdür. [Alan devri](frontend-settings-handover.md#st-03--starter-tüketici-kapsamı). Kapsam daraltılmaz; ürün değeri veya hazır olmayan asset/sağlayıcı uydurulmaz.
2. **WEB-01:** Frontend ekibinin saaspt kaynak aktarımı ve gerçek API ekran entegrasyonu; backend kaynak kabulünün yerine geçmez.
3. **OPS-01 → REL-01:** ST-03 sonrasındadır; bu görev bunları başlatmaz.

Yeni görev tamamlanan kalemi backlog’da kapatır ve sıradan kaldırır; eski prompt/CI/pilot metinleri buraya eklenmez. P08 işleri ve gerçek SMS ayrı kapsamdadır. Full clean başlarsa [AGENTS bekleme kuralı](../AGENTS.md#full-clean-sırasında-kullanıcıya-devir) uygulanır.
