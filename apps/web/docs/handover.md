# Frontend sohbet devri

Aktif bölüm, kaynak ve kabulün tek sahibi [frontend todo kaydıdır](todo.md#web-s02).

## Devam bağlamı

Checkout `FtkSaaS-s02`, dal `feat/web-s02-discovery-acceptance`, main tabanı `61137c86c9ae015e2fc8f9dfef250a372bc1211d` (PR134). Merkez–disiplin/kapanış consumer'ları hazır; main'e/yayına teslim henüz yapılmadı. Kullanıcı başarılı CI ve inceleme sonrası frontend merge için tekrar onay beklenmemesini istedi. Kullanıcı 2 Kasım 2026 tarihinde revize XREQ-009 ile mevcut durumun bu dala push edilmesini açıkça istedi. Gönderim yetkilidir; kalite istisnası veya backend kod değişikliği bu talimata dahil değildir.

Starter1 test kurulumu kullanıcı yetkisiyle hazırlandı; Pro1'e eğitmen atanmaması son kullanıcı talimatıdır. Hesap parolası/token veya gerçek iletişim kaynaklara yazılmaz. Native Auth/MFA/yetki kapıları korunur; güncel oturum tarayıcıda tekrar doğrulanmalıdır. Test hesap dosyası çalışma alanındaki kullanıcı ekidir; rapora kimlik bilgisi kopyalanmaz. Test düzeninin ve kabul sınırlarının sahibi todo'dur.

Sonraki iş: [XREQ-009](../../../docs/requests.md#xreq-009-starter-rol-listesi) backend düzeltmesini beklerken bu consumer kaynağını inceleme/CI ile teslim et; teslim sonrası gerçek Starter ekranında ilişki yazma/yeniden okuma, kapanış listesi, eğitmen/uygunluk ve checklist'i tamamla. 101. öğrenci ve gerçek kayıp yanıt ekran kanıtı açıktır. S02 kapanmadan S03'e geçilmez; açık kalemler Business hesabıyla ikame edilmez.

Frontend-design-assistant, Frontend UI Engineering, TDD, Code Simplification ve Code Review becerileri uygulandı; mevcut shadcn teması ve hazır bileşenler korundu, yeni bağımlılık yoktur. `NODE_USE_ENV_PROXY=0` yalnız yerel test sürecinde kullanılır. Tarayıcı binary'leri bu checkout'ta yok; önceki kurulum bozuk ZIP ile başarısızdı. Yeni CI başlarsa kök AGENTS devir kuralı, son kullanıcı kapsamındaki merge sonrası sonuç beklemeden bağımsız işe devam yetkisiyle birlikte uygulanır.

## Açık kalite bulguları

İki assertion değişikliğinin gerekçesi ve backend değerlendirme talebi yalnız [XREQ-010](../../../docs/requests.md#xreq-010-s02-assertion-değişiklikleri) sahibindedir. Kullanıcı kararın backend tarafından verilmesini istedi. Frontend istisna sicilini/checker'ı değiştirmez; mevcut kaynak açık bulgularıyla push edilir. Backend kararı ve gerekli CI kabulü tamamlanmadan merge edilmez.
