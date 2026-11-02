# Frontend sohbet devri

Aktif bölüm, kaynak ve kabulün tek sahibi [frontend todo kaydıdır](todo.md#web-s02).

## Devam bağlamı

PR138 main `2901f4ce3339a5bbc47408f98a0609241ebd7378` üzerinde main/merge/development ile başarıyla teslim edildi. Yeni `feat/web-starter-instructor` dalı bu tabandan XREQ-009 consumer entegrasyonunu tamamlar ve PR139 sonrası main `a21a87208b3cbca9fc1a877fa41fd7c746fe55cd` ile eşitlendi; checkout `FtkSaaS-s02` dizinidir. Yeni kaynak için aday CI/main ve development/Vercel production teslimi henüz doğrulanmadı. Başarılı CI ve bağımsız inceleme sonrası frontend PR'ını tekrar onay beklemeden merge etme yetkisi sürer; full clean devir kuralı korunur.

S02'nin geliştirme ve canlı kabulü tamamlandı; yeni kaynak yayın kanıtı beklenir. S03 uygulaması S02 teslimi kapanmadan başlatılmaz. Starter F05/genel rol listesi açılmadan dar keşif, tam etki önizlemesiyle açık kaldırma onayı ve eğitmen atanmalı yönetici işleri/manual seans onarımı bağlıdır. Kaynak ve gerçek kabul ayrıntıları, ortam ayrımı, test temizliği ve eski aktif eğitmen ilişkisi sınırı yalnız todo sahibindedir. Ortak talepte yalnız frontend değerlendirme/kabul alanı güncellenir; backend kararları korunur.

Mevcut shadcn teması ve hazır bileşenler korunur. TDD, sadeleştirme, React/erişilebilirlik ve bağımsız son kaynak incelemesi uygulanır. Backend/kontrat/CI/checker/kalite istisnaları değiştirilmedi. Native Auth, tenant/CM/plan kapıları ve belirsiz komutun aynı approved payload/key ile kurtarılması korunur; test hesabı parola/token'ları kaynak veya rapora yazılmaz. Geçici yerel TLS doğrulamalı test geçidi kaynak/deploy bağımlılığı değildir; gerçek native backend yanıt kaybını ve çalışan arayüz Axe kabulünü üretmiştir. Yeni CI başlayınca kök AGENTS uyarınca kullanıcıya devir yapılır.
