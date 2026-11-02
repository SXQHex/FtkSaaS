# Frontend sohbet devri

Aktif bölüm, kaynak ve kabulün tek sahibi [frontend todo kaydıdır](todo.md#web-s03).

## Devam bağlamı

S02 teslim kabulü tamamlandı; XREQ-012 kaynak/ortam ve frontend consumer uyum incelemesinin tek sahibi [S02 kabul kaydıdır](todo.md#web-s02). Son kapanış belgesinin kendi CI/merge/main sonucu ayrıca doğrulanır; önceki başarı yeni belge kaynağına taşınmaz.

Aktif bölüm [WEB-S03](todo.md#web-s03): sınıf yönetimi, program oluşturma ve takvim entegrasyonu; ardından seans değişiklik/iptal/telafi ve bölümün gerçek kabulü. Backend temizliği tekrar uygulanmaz, tamamlanmış S02 canlı testleri gerekçesiz tekrarlanmaz. Başarılı son CI ve inceleme sonrası frontend PR'ını merge etme yetkisi sürer; full clean devir kuralı korunur.

Mevcut shadcn teması ve hazır bileşenler korunur. TDD, sadeleştirme, React/erişilebilirlik ve bağımsız son kaynak incelemesi uygulanır. Backend/kontrat/CI/checker/kalite istisnaları değiştirilmedi. Native Auth, tenant/CM/plan kapıları ve belirsiz komutun aynı approved payload/key ile kurtarılması korunur; test hesabı parola/token'ları kaynak veya rapora yazılmaz. Geçici yerel TLS doğrulamalı test geçidi kaynak/deploy bağımlılığı değildir; gerçek native backend yanıt kaybını ve çalışan arayüz Axe kabulünü üretmiştir. Yeni CI başlayınca kök AGENTS uyarınca kullanıcıya devir yapılır.
