# Aktif üretim sırası

Açık işlerin tanımı ve kabul ölçütleri yalnız [tek backlog’dadır](remaining-work.md). Kaynak/CI/CD durumu yalnız [00 devirde](contracts/00-FtkSaaS-yeni-sohbet-devir.md) tutulur.

1. **ST-03 aktif:** Kullanıcının 28 Ekim talimatıyla mevcut PR65'i güncel main'e uyarla; Starter'da izinli bütün ayarların typed alan/default-miras/yetki/gerçek tüketici kabulünü tamamla. [Alan devri](frontend-settings-handover.md#st-03--starter-tüketici-kapsamı). Hazır olmayan asset/sağlayıcı veya ürün değeri uydurulmaz. Full clean başlayınca kaynak/run bilgileriyle dur; polling yok.
2. **WEB-01 / CI-SPLIT:** Frontend altyapı ve ekran/gerçek API kabulü frontend ekibinin ayrı işidir; karşılıklı CI kapsamının uzak kanıtı backend ST-03 kabulünden türetilmez.
3. **OPS-01 → REL-01:** ST-03 sonrasındadır; bu görev bunları başlatmaz.

Yeni görev tamamlanan kalemi backlog’da kapatır ve sıradan kaldırır; eski prompt/CI/pilot metinleri buraya eklenmez. P08 işleri ve gerçek SMS ayrı kapsamdadır. Full clean başlarsa [AGENTS bekleme kuralı](../AGENTS.md#full-clean-sırasında-kullanıcıya-devir) uygulanır.
