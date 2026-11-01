# Frontend sohbet devri

Bu dosya yalnız devam için gereken çalışma bağlamını taşır. Aktif bölüm, karar, uygulama, kaynak, test ve gerçek kabulün tek sahibi [S01 kaydıdır](todo.md#11-web-s01-güncel-kabul-durumu); bölüm sırası [todo'dadır](todo.md#7-bölüm-bölüm-teslim-tek-aktif-bölüm).

## Çalışma bağlamı

Aktif dal `feat/web-s04-live-acceptance`, taban main `164ebef80438f3ca231227e5a88c33970345ac66`. PR127 main’e birleşti; kaynak bağlı adayın dört tarayıcı projesi, main/merge proof ve development teslimi başarılı, production alan adı aynı kaynağı READY yayımlıyor. Kanıtların tek sahibi [S04 kaydıdır](todo.md#web-s04). S04’ün gerçek CRUD/disiplin/birleştirme/erişim kabulü açıkken sonraki bölüm başlatılmaz. Kullanıcı yetkili CM hesabıyla giriş yaptı; FTK/Taşyaka erişimi açıldı. İki iletişimsiz yeni test kişisiyle gerçek oluşturma/düzenleme, öğrencilik etkinleştirme/pasifleştirme, Tango ilişkisi ve tek merkez birleştirme kabulü yapıldı; sonuç ve açık senaryolar yalnız S04 kaydında. Yeni test hedefi ve Tango ilişkisi kabul sonrası pasife alındı; kaynak birleştirilmiş durumda. Mevcut kişilere/finans/erişim kayıtlarına yazılmadı; davet veya e-posta gönderilmedi. Ajan tarafından kullanıcının oturumu veya roller değiştirilmedi; reset/seed yapılmadı. Bu dal S04 kabul kanıtını ve bu kabulde bulunan frontend düzeltmelerini toplar; açık kabul boşlukları gizlenmez.

Yerel transport testleri, host’un `NODE_USE_ENV_PROXY` ayarı açıkken MSW zaman aşımına girdi; yalnız test sürecinde `NODE_USE_ENV_PROXY=0` ile giderildi. Repo test/config değişikliği yapılmadı. Yerel Playwright tarayıcıları yok; resmi kurulum denemesi eksik/bozuk zip ile başarısız oldu. Yeni tarayıcı senaryosu eklendi; CI ve hosted sonuçları doğrulanmadan başarılı sayılmaz.

Kullanıcı, **Frontend UI Engineering** ve **frontend-design-assistant** becerilerinin sohbetin tamamındaki frontend çalışmalarında kullanılmasını açıkça istedi. Her ikisi uygulanır; mevcut shadcn/ui ve kabul edilmiş ürün tasarım tercihleri korunur. Ekranların amacı, bilgi sırası, mobil davranışı ve hata/kurtarma durumları koddan önce belirlenir.

Kullanıcı parola değişimi ve girişini tamamladı; güncel mevcut test parolası sohbet içinde sağlandı, kaynaklara kopyalanmaz. Özgün ana e-posta geri yüklendi, pending değişiklik yok ve Google kimliği korunuyor. Gerçek telefonla doğrulanmış bir TOTP faktörü etkindir. QR, MFA davet dönüşü, iki e-posta onayı, eski adrese geri dönüş ve kullanılmış bağlantı reddi çift10–14 ile [S01 kaydında](todo.md#gerçek-ortamda-doğrulananlar) tutulur. XREQ-001 dört gerçek senaryoyla kapandı; XREQ-004 frontend kabulü tamamlandı, talep edenin son kabulü kendisine aittir. Önceki hatalı parola ve boş faktör listesi tarihsel test sonuçlarıdır; güncel hesap durumu olarak okunmaz.

Gerçek ortam kabulünde tarayıcı/oturum yeniden doğrulanır; önceki Chrome bağlantısının bu oturumda çalıştığı varsayılmaz. Kullanıcının belirlediği test hesabı ve ilgili posta kutusu sınırı korunur. Önceki silme testi hesabı aktif Google test hesabıyla karıştırılmaz ve DB'den geri açılmaz; ilgili backend işlerinin sahibi backend backlog'dur.

Kullanıcının önceki “maine birleştir” talimatı S01 dalı için uygulandı; S04 teslim talebi kapsamında ayrı modül dalı ve Draft PR hazırlanır. Remote `SXQHex/FtkSaaS` doğrulandı. Aynı kapsam için yeniden onay istenmez; merge ve development teslimi kaynakla eşleşen CI sonucundan sonra doğrulanır.

Devamda yukarıdaki güncel modül dalı ve onun Draft PR’si kullanılır. CI başlayınca [AGENTS devir kuralı](../../../AGENTS.md#full-clean-sırasında-kullanıcıya-devir) uygulanır. Sırf yeni SHA/run yazmak için ek belge commit'i açılmaz; bir sonraki doğal değişiklikte tek durum kaydı güncellenir.
