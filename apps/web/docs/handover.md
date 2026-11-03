# Frontend sohbet devri

Aktif bölüm, kaynak ve kabulün tek sahibi [frontend todo kaydıdır](todo.md#web-s03).

## Devam bağlamı

S02 teslim kabulü tamamlandı; XREQ-012 kaynak/ortam ve frontend consumer uyum incelemesinin tek sahibi [S02 kabul kaydıdır](todo.md#web-s02). S02'nin kapanış belgesi PR146 ile main'dedir; yeni S03 kaynağının kabulü bundan ayrıdır.

Aktif bölüm [WEB-S03](todo.md#web-s03). Mevcut kaynak paketi sınıf/program, kategori kontenjanı, varsayılan sınıf görevi, tek seans oluşturma ve takvim bağlantısını içerir; kaynak, kapsam ve kabul sınırının tek sahibi S03 kaydıdır. PR151 main/development teslimi tamamlandı. Kaynak/seri düzenlemesi ve iptal/telafi aynı taslak PR153 içinde sürer; önceki başarı yeni kodun kanıtı değildir. Sıradaki iş aynı bölümün gerçek program→seans/seri değişikliği→iptal/telafi kabulüdür. Seansın görev/kontenjanı mevcut preview/apply akışından yönetilir; yalnız endpoint tüketmek için paralel yazma ekranı kurulmaz. Yeni modüle geçilmez. Backend temizliği tekrar uygulanmaz; tamamlanmış S02 canlı testleri gerekçesiz tekrarlanmaz. Başarılı son CI ve inceleme sonrası frontend PR'ını merge etme yetkisi sürer; full clean devir kuralı korunur.

Mevcut shadcn teması ve hazır bileşenler korunur. TDD, sadeleştirme, React/erişilebilirlik ve bağımsız son kaynak incelemesi uygulanır. Backend/kontrat/CI/checker/kalite istisnaları değiştirilmedi. Native Auth, tenant/CM/plan kapıları ve belirsiz komutun aynı approved payload/key ile kurtarılması korunur; test hesabı parola/token'ları kaynak veya rapora yazılmaz. Geçici yerel TLS doğrulamalı test geçidi kaynak/deploy bağımlılığı değildir; gerçek native backend yanıt kaybını ve çalışan arayüz Axe kabulünü üretmiştir. Yeni CI başlayınca kök AGENTS uyarınca kullanıcıya devir yapılır.
