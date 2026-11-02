# Frontend sohbet devri

Aktif bölüm, kaynak ve kabulün tek sahibi [frontend todo kaydıdır](todo.md#web-s02).

## Devam bağlamı

PR136 dalı `feat/web-s02-discovery-acceptance`, main `0ade1417d5c24383d086496fcab47b7fb17f5873` (PR135) ile eşitlendi. Çalışma checkout'u `FtkSaaS-s02`; yerel `local/s02-pr136-sync` aynı uzak PR dalının aktarım checkout'udur. Ortak requests çatışmasında main'deki backend değerlendirmeleri bütünüyle korundu; ortak/backend kaynağına frontend değişikliği eklenmedi. GitHub aktarımında dosya ağacı birebir doğrulanır.

XREQ-010 backend tarafından main'e eklenen dar kayıtlarla kalite kontrolünü geçiriyor. Frontend istisna sicili/checker veya kalıcı politika kurulumu değiştirmedi. Kullanıcı PR135'i kontrollü izinle birleştirdiğini ve kalıcı politika kurulumu istemediğini belirtti; bu tercih korunur. Eşitlenmiş kaynakta frontend test/build, kalite ve belge kontrolü başarılı; yeni PR CI ve kaynak bağlı kabul ayrıca gerekir. Kullanıcının başarılı CI ve inceleme sonrası frontend PR'ını tekrar onay beklemeden merge etme yetkisi sürer.

S02 kapanmadı; S03 başlatılmaz. Sonraki bağımlılık [XREQ-009](../../../docs/requests.md#xreq-009-starter-rol-listesi): genel rol listesi/F05 açılması zorunlu değil; tek eğitmen atamasının gerçek kimlik/durum/sürümüyle keşfi, gerekçeli kaldırma ve başka eğitmenle değiştirme backend sözleşmesini bekler. PR135 bu runtime'ı teslim etmedi. PR136 kaynak tesliminden sonra yeni ilişki/kapanış ekranlarının gerçek Starter kabulü, kalan 101. öğrenci ve kayıp yanıt ekran kanıtı tamamlanır.

Starter1 test kurulumu kullanıcı yetkisiyle hazırdır; Pro1'e eğitmen atanmadı. Kurulum ve gerçek kabul ayrıntıları yalnız todo sahibindedir. Native Auth/MFA/tenant/rol/plan kapıları korunur; güncel tarayıcı oturumu yeniden doğrulanmalı. Hesap parolası/token veya gerçek iletişim kaynaklara yazılmaz.

Frontend-design-assistant, Frontend UI Engineering, TDD, Code Simplification ve bağımsız Code Review uygulanmış kaynak korunur. Mevcut shadcn teması ve hazır bileşenler kullanılır; yeni bağımlılık yoktur. `NODE_USE_ENV_PROXY=0` yalnız yerel test sürecindedir. Yerel Playwright binary'leri yok; CI tarayıcı sonucu ile gerçek hosted ekran kabulü ayrı doğrulanır. Yeni CI başlarsa kök AGENTS devir kuralı uygulanır.
