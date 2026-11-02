# Frontend sohbet devri

Bu dosya yalnız devam için gereken çalışma bağlamını taşır. Aktif bölüm, uygulama, kaynak, test ve gerçek kabulün tek sahibi [frontend todo kaydıdır](todo.md).

## Çalışma bağlamı

Aktif dal `feat/web-s02-completion`, taban main `73700e37c3403dc309a5df61989837edbca24b96`; main proof, merge proof ve development teslimi başlangıçta başarılı doğrulandı. Çalışma checkout'u `FtkSaaS-s02` dizinidir; önceki `FtkSaaS` worktree kaydı taşınmış eski konuma işaret ettiği için yeni temiz clone kullanıldı. Eski S02 PR93 kullanıcı isteğiyle kapalıdır; yeni dal eski taslağın yalnız ilgili kaynak parçalarını güncel main'e uyarladı.

S02 kapanmadı. Kaynak uygulaması ve açık kabulün sahibi [S02 kaydıdır](todo.md#web-s02). Eksik merkez–disiplin ilişki okuması ve mevcut kapanış keşfi kendi frontend talep alanlarında [XREQ-007/008](../../../docs/requests.md) olarak kaydedildi; backend adına teslim/onay verilmedi. İstisna append sürümü merkez aggregate'inden okunur; bu kısım eksik selector gerekçesiyle kapatılmadı. Bu iki okuma ve hosted kabul tamamlanmadan S03'e geçilmez.

Kullanıcı test sunucusunda mock veri yazmaya izin verdi. Bu S02 kaynak çalışmasında hosted veri veya Auth ayarı değiştirilmedi; native oturum/MFA/rol kapıları korunur. Gerçek hesap kabulünde mevcut tarayıcı/oturum yeniden doğrulanmalı; eski oturum var sayılmaz. Secrets veya test parolası kaynaklara yazılmaz. Eski S04 test finans/hak kanıtı bu işle değiştirilmez.

Frontend UI Engineering, frontend-design-assistant, TDD, Code Simplification ve kod inceleme becerileri uygulanır. Mevcut shadcn teması korunur; yeni genel form framework'ü, yeni bağımlılık veya backend/CI değişikliği yapılmaz. Kayıp yanıtta aynı payload/key, yeni request_id; scope değişimi/unmount ve yanlış receipt kimliği korunur.

Yerel testte `NODE_USE_ENV_PROXY=0` süreç değişkeni kullanılır. Playwright Chromium indirmesi bozuk ZIP ile başarısız; browser veya hosted kabul yapılmış gösterilmez. Son frontend test/inceleme/CI durumu todo sahibinde tutulur. Sırf SHA/run yazmak için ek belge commit'i açılmaz. Full clean başlarsa kök AGENTS devir kuralı uygulanır.
