# Frontend sohbet devri

Aktif bölüm, kaynak ve kabulün tek sahibi [frontend todo kaydıdır](todo.md#web-s02).

## Devam bağlamı

PR143 main `2f2f083b54e59d997c375d90bc05528a69344fbe` üzerinde main/development ile teslim edildi. Mevcut frontend'in yeni taban kontrolü ve gerçek kaldırma/değiştirme kabulü tamamdır; ortam/fixture ayrımı, geri yükleme ve kanıtın tek sahibi [S02 kabul kaydıdır](todo.md#web-s02). PR144 son belge kaynağı henüz merge edilmez.

Kullanıcı eski instructor merkez ilişkisini pasif tarihçe olarak da istemiyor; yeni [XREQ-012](../../../docs/requests.md#xreq-012) veri/kod temizliği backend'e iletildi. Backend'in migration ve kullanılmayan legacy kodunu temizleme teslimini bekle; aynı işi frontend'den SQL ile tekrar uygulama. İşlevsel kabul tamamdır; tam S02 kapanışı temizlik ve son kaynak teslimine bağlıdır. Tamamlanmış testleri gerekçesiz tekrar açma. S02 kapanmadan S03 uygulaması başlamaz. Başarılı son CI ve inceleme sonrası mevcut frontend PR'ını merge etme yetkisi sürer; full clean devir kuralı korunur.

Mevcut shadcn teması ve hazır bileşenler korunur. TDD, sadeleştirme, React/erişilebilirlik ve bağımsız son kaynak incelemesi uygulanır. Backend/kontrat/CI/checker/kalite istisnaları değiştirilmedi. Native Auth, tenant/CM/plan kapıları ve belirsiz komutun aynı approved payload/key ile kurtarılması korunur; test hesabı parola/token'ları kaynak veya rapora yazılmaz. Geçici yerel TLS doğrulamalı test geçidi kaynak/deploy bağımlılığı değildir; gerçek native backend yanıt kaybını ve çalışan arayüz Axe kabulünü üretmiştir. Yeni CI başlayınca kök AGENTS uyarınca kullanıcıya devir yapılır.
