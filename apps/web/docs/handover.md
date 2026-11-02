# Frontend sohbet devri

Aktif bölüm, kaynak ve kabulün tek sahibi [frontend todo kaydıdır](todo.md#web-s02).

## Devam bağlamı

PR142 main `152bdcba16f8b26e810cbe2dd91f0a46d5260a9e` üzerine birleşti; aynı kaynağın main proof/development teslimi başarılıdır. S02'nin mevcut consumer geliştirmesi ve PR141 yayın kabulü tamamdır. Kontroller ve son kalan adımlar yalnız [S02 kapanış kaydında](todo.md#web-s02) tutulur.

Backend düzeltmesi PR143'te sürüyor. Mevcut rol yaşam döngüsü/keşif/kaldırma consumer'ı korunuyor; ayrı ilişşik kesme API'si veya eski ilişkiden aktiflik türeten frontend katmanı ekleme. Son backend kaynağı ve ortam teslimini doğrula; ardından todo'daki yetkili eski ilişki kaydıyla gerçek kaldırma/değiştirme kabulünü tamamla. Backend işini tekrar üstlenme, test hazırlamak için hosted SQL/seed uygulama. Bu kabul tamamlanmadan S02 kapanmaz ve S03 başlamaz. Başarılı CI ve bağımsız inceleme sonrası frontend PR'ını tekrar onay beklemeden merge etme yetkisi sürer; full clean devir kuralı korunur.

Mevcut shadcn teması ve hazır bileşenler korunur. TDD, sadeleştirme, React/erişilebilirlik ve bağımsız son kaynak incelemesi uygulanır. Backend/kontrat/CI/checker/kalite istisnaları değiştirilmedi. Native Auth, tenant/CM/plan kapıları ve belirsiz komutun aynı approved payload/key ile kurtarılması korunur; test hesabı parola/token'ları kaynak veya rapora yazılmaz. Geçici yerel TLS doğrulamalı test geçidi kaynak/deploy bağımlılığı değildir; gerçek native backend yanıt kaybını ve çalışan arayüz Axe kabulünü üretmiştir. Yeni CI başlayınca kök AGENTS uyarınca kullanıcıya devir yapılır.
