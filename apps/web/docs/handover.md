# Frontend sohbet devri

Aktif bölüm, kaynak ve kabulün tek sahibi [frontend todo kaydıdır](todo.md#web-s02).

## Devam bağlamı

PR141 main'e alındı; frontend CI, main/development ve hosted teslim kanıtları [S02 kabul kaydında](todo.md#web-s02) tamamdır. Yayın bekleyen eski anlatım kaldırıldı. Son incelenen main `eb0f1df91deeb031d890f8b0b2978d6f8a617317`; aynı kaynağın main proof ve development teslimi başarılıdır.

Aktif bölüm hâlâ S02'dir. Tek açık kapanış bağımlılığı [XREQ-011](../../../docs/requests.md#xreq-011) backend teslimi ve ardından frontend entegrasyon/kabulüdür; ayrıntı ve tamamlanmış kabulün tek sahibi [todo](todo.md#web-s02) kaydıdır. S02 kapanmadan S03 uygulamasına geçilmez. Ortak talepte yalnız frontend talep/kabul alanları güncellendi; backend kararları ve belgeleri değiştirilmedi. Başarılı CI ve bağımsız inceleme sonrası frontend PR'ını tekrar onay beklemeden merge etme yetkisi sürer; full clean devir kuralı korunur.

Mevcut shadcn teması ve hazır bileşenler korunur. TDD, sadeleştirme, React/erişilebilirlik ve bağımsız son kaynak incelemesi uygulanır. Backend/kontrat/CI/checker/kalite istisnaları değiştirilmedi. Native Auth, tenant/CM/plan kapıları ve belirsiz komutun aynı approved payload/key ile kurtarılması korunur; test hesabı parola/token'ları kaynak veya rapora yazılmaz. Geçici yerel TLS doğrulamalı test geçidi kaynak/deploy bağımlılığı değildir; gerçek native backend yanıt kaybını ve çalışan arayüz Axe kabulünü üretmiştir. Yeni CI başlayınca kök AGENTS uyarınca kullanıcıya devir yapılır.
