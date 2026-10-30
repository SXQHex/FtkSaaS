# Aktif üretim sırası

Açık işlerin tanımı ve kabul ölçütleri yalnız [tek backlog’dadır](remaining-work.md). Kaynak/CI/CD durumu yalnız [00 devirde](contracts/00-FtkSaaS-yeni-sohbet-devir.md) tutulur.

1. **WEB-01 / aktif bölüm: öğrenci yönetimini tamamlama ve gerçek kabul.** [Frontend yol haritasındaki](../apps/web/todo.md) ilk bölüm bitirilir; kaynak, CI, hosted hesap/erişim/yazma ve gereken davet teslimi kanıtı ayrı doğrulanır. Aynı anda tek bölüm geliştirilir. Bu bölüm kapanmadan paket/finans/program gibi sonraki bölümün uygulamasına geçilmez; engeller backend/ortam sahibine somut kapanış koşuluyla bağlanır. Küçük düzeltmeler modülün aynı devam PR’sinde tutulur. Sonraki bölüm hesap ve güvenliktir; ayrıntılı sıra ve kapsam todo.md içindedir.
2. **OPS-01 / REL-01:** Backlog kapsamındaki genel privacy purge/retention/legal hold, backup non-resurrection, kalan lane iş yükleri ve provider/config/RPO/RTO/yük kabulü tamamlanır. Dar payload cleanup genel imha sayılmaz. Frontend çalışması backend runtime/CI kapılarını değiştirmez.
3. **REL-01 ve CI-ADMIN:** OPS-01 sonrasında tam restore/Auth/Storage/config, yük ve güncel repo korumaları doğrulanır. ST-03 ve PUBLIC-01 gerçek ekran/route/provider bağımlılıkları WEB-01 içinde ilgili dilime bağlanır.

Yeni görev tamamlanan kalemi backlog’da kapatır ve sıradan kaldırır; eski prompt/CI/pilot metinleri buraya eklenmez. P08 işleri ve gerçek SMS ayrı kapsamdadır. Full clean başlarsa [AGENTS bekleme kuralı](../AGENTS.md#full-clean-sırasında-kullanıcıya-devir) uygulanır.
