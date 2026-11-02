# Frontend sohbet devri

Aktif bölüm, kaynak ve kabulün tek sahibi [frontend todo kaydıdır](todo.md#web-s02).

## Devam bağlamı

PR136 main `d0a6b5639ba12809d6b5a5b61ca7f02ab485db31` ile teslim edildi; aynı kaynağın main/merge/development ve Vercel başarısı doğrulandı. Yeni kabul kaydı dalı `feat/web-s02-live-acceptance`, checkout `FtkSaaS-s02` dizinidir. Güncel kabul kanıtlarının tek sahibi todo'dur; ortak talep kaydında yalnız XREQ-007/008 frontend kabulü eklenir, backend kararları korunur.

XREQ-010 backend tarafından main'e eklenen dar kayıtlarla kalite kontrolünü geçiriyor. Frontend istisna sicili/checker veya kalıcı politika kurulumu değiştirmedi. Kullanıcı PR135'i kontrollü izinle birleştirdiğini ve kalıcı politika kurulumu istemediğini belirtti; bu tercih korunur. Eşitlenmiş kaynakta frontend test/build, kalite ve belge kontrolü başarılı; yeni PR CI ve kaynak bağlı kabul ayrıca gerekir. Kullanıcının başarılı CI ve inceleme sonrası frontend PR'ını tekrar onay beklemeden merge etme yetkisi sürer.

S02 kapanmadı; S03 başlatılmaz. Sonraki bağımlılık [XREQ-009](../../../docs/requests.md#xreq-009-starter-rol-listesi): genel rol listesi/F05 açılması zorunlu değil; tek eğitmen atamasının gerçek kimlik/durum/sürümüyle keşfi, gerekçeli kaldırma ve başka eğitmenle değiştirme backend sözleşmesini bekler. PR135 bu runtime'ı teslim etmedi. PR136 sonrası bağımsız ilişki/kapanış ve 101. öğrenci canlı kabulü tamamlandı; test kontenjanı normal API ile 0 aktife geri getirildi. Erişilebilirlik incelemesi başlık sırası, yüzde200 dar ekran taşması kapanış hata ilişkisini ve mobil menünün Escape sonrası odak dönüşünü düzeltti; ağsız DOM/CSS taraması ile canlı etkileşimli kabul ayrımı todo sahibindedir. Yeni canlı erişilebilirlik testi normal TLS ortamında çalıştırılmayı bekler. Gerçek kayıp yanıt ekranı ile yeni kaynağın canlı yüzde200/Axe kabulü açıktır; hızlı yenileme denemesi tek sürüm artışı gösterse de yanıt kaybını ispatlamadı. Geçici oda adı geri alındı.

Starter1 test kurulumu kullanıcı yetkisiyle hazırdır; Pro1'e eğitmen atanmadı. Kurulum ve gerçek kabul ayrıntıları yalnız todo sahibindedir. Native Auth/MFA/tenant/rol/plan kapıları korunur; güncel tarayıcı oturumu yeniden doğrulanmalı. Hesap parolası/token veya gerçek iletişim kaynaklara yazılmaz.

Frontend-design-assistant, Frontend UI Engineering, TDD, Code Simplification ve bağımsız Code Review uygulanmış kaynak korunur. Mevcut shadcn teması ve hazır bileşenler kullanılır; yeni bağımlılık yoktur. `NODE_USE_ENV_PROXY=0` yalnız yerel test sürecindedir. Yerel Playwright binary'leri yok; CI tarayıcı sonucu ile gerçek hosted ekran kabulü ayrı doğrulanır. Yeni CI başlarsa kök AGENTS devir kuralı uygulanır.
