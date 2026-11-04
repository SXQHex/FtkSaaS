# Frontend sohbet devri

Aktif bölüm, kaynak ve kabulün tek sahibi [frontend todo kaydıdır](todo.md#web-s11).

## Devam bağlamı

S02 teslim kabulü tamamlandı; XREQ-012 kaynak/ortam ve frontend consumer uyum incelemesinin tek sahibi [S02 kabul kaydıdır](todo.md#web-s02). S02'nin kapanış belgesi PR146 ile main'dedir; yeni S03 kaynağının kabulü bundan ayrıdır.

[WEB-S03 kaynak, main/development/web ve son canlı kabulü tamamlandı](todo.md#web-s03). Kapanış belgesi PR175 ile main’dedir. Kullanıcının 4 Kasım talimatıyla [S11](todo.md#web-s11) aktif bölümdür; ilk inbox/geçmiş kaynak dilimi `feature/web-s11` dalında hazırlanmıştır. Kalan iş, test ve kabulün tek sahibi bu kayıttır; S11 tamamlanmadan sonraki bölüme geçilmez. Devam aynı Draft PR üzerinden yürür; bu ilk dilim bölüm kapanışı veya merge talebi değildir. Kaynak/run/deployment ve gerçek kabul kanıtı yalnız todo sahibinde tutulur. XREQ-014 ve XREQ-015 kapanışı korunur; özgün Business XREQ-013, kalıcı Community License ve vendor dış font incelemesi Starter kabulünden ayrı açıktır.

Kullanıcı geliştirme ve test yazımlarını açıkça onayladı; yeniden izin beklenmez. Test hesapları kullanıcının verdiği test-accounts.md dosyasındadır; eksik bilgiyi tekrar istemeden önce bu dosya aranır, parola/token repoya kopyalanmaz. İşaretli Starter ve Pro kabul fixture’ları geçmiş kanıtı olarak korunur; yeni işlem ihtiyacı yoksa tekrar hazırlanmaz. Kayıp yanıt/replay kanıtı gerçek kaynak bileşeni/native backend sınırındadır; hosted ağ kesintisi tekrarı gibi sunulmaz. Backend WF03 kabulü veya tamamlanmış S02 kontrolleri gerekçesiz tekrarlanmaz. Başarılı son CI ve bağımsız inceleme sonrası frontend PR’ını merge etme yetkisi sürer; yeni CI başlayınca devir kuralı korunur.

Mevcut shadcn teması ve hazır bileşenler korunur. TDD, sadeleştirme, React/erişilebilirlik ve bağımsız son kaynak incelemesi uygulanır. Backend/kontrat/CI/checker/kalite istisnaları değiştirilmedi. Native Auth, tenant/CM/plan kapıları ve belirsiz komutun aynı approved payload/key ile kurtarılması korunur; test hesabı parola/token'ları kaynak veya rapora yazılmaz. Geçici yerel TLS doğrulamalı test geçidi kaynak/deploy bağımlılığı değildir; gerçek native backend yanıt kaybını ve çalışan arayüz Axe kabulünü üretmiştir. Yeni CI başlayınca kök AGENTS uyarınca kullanıcıya devir yapılır.

CRM karar aktarımının frontend görevi ve kabul sınırı [S04'e bağlı açık ek kapsamda](todo.md#crm-temel-aday-takibi) tutulur. Bu belge aktarımı önceki S04 kabulünü değiştirmez; yeni CRM diliminin runtime ve hosted kabulü yapılmış sayılmaz. Backend sözleşme bağımlılığı aynı kayıttadır; burada ikinci görev listesi tutulmaz.
