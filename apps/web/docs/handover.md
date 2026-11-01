# Frontend sohbet devri

Bu dosya yalnız devam için gereken çalışma bağlamını taşır. Aktif bölüm, karar, uygulama, kaynak, test ve gerçek kabulün tek sahibi [S01 kaydıdır](todo.md#11-web-s01-güncel-kabul-durumu); bölüm sırası [todo'dadır](todo.md#7-bölüm-bölüm-teslim-tek-aktif-bölüm).

## Çalışma bağlamı

Aktif dal `feat/web-s04-access-management`, taban main `3ea9b5df709625873f0cb8a4db9645a460edb499`. Aynı kaynağın main proof (41353519368), merge proof ve development teslimi (41353549415) başarılı olarak doğrulandı. S01 temel teslimi kapalı; aktif bölüm S04. PR123 ve PR124 main’de; eski PR123 dalında çalışmaya devam edilmez. PR125’in XREQ-005 kişi bazlı davet/hesap bağlantısı keşfi main’de tüketiliyor. Yeni aday frontend erişim yönetimi, durable status/replay ve ilgili testleri içerir. Kapsam ve kabulün tek sahibi [S04 kaydıdır](todo.md#web-s04). S04’ün gerçek CRUD/disiplin/birleştirme/erişim kabulü açıkken sonraki bölüm başlatılmaz.

Yerel transport testleri, host’un `NODE_USE_ENV_PROXY` ayarı açıkken MSW zaman aşımına girdi; yalnız test sürecinde `NODE_USE_ENV_PROXY=0` ile giderildi. Repo test/config değişikliği yapılmadı. Yerel Playwright tarayıcıları yok; resmi kurulum denemesi eksik/bozuk zip ile başarısız oldu. Yeni tarayıcı senaryosu eklendi; CI ve hosted sonuçları doğrulanmadan başarılı sayılmaz.

Kullanıcı, **Frontend UI Engineering** ve **frontend-design-assistant** becerilerinin sohbetin tamamındaki frontend çalışmalarında kullanılmasını açıkça istedi. Her ikisi uygulanır; mevcut shadcn/ui ve kabul edilmiş ürün tasarım tercihleri korunur. Ekranların amacı, bilgi sırası, mobil davranışı ve hata/kurtarma durumları koddan önce belirlenir.

Kullanıcı parola değişimi ve girişini tamamladı; güncel mevcut test parolası sohbet içinde sağlandı, kaynaklara kopyalanmaz. Özgün ana e-posta geri yüklendi, pending değişiklik yok ve Google kimliği korunuyor. Gerçek telefonla doğrulanmış bir TOTP faktörü etkindir. QR, MFA davet dönüşü, iki e-posta onayı, eski adrese geri dönüş ve kullanılmış bağlantı reddi çift10–14 ile [S01 kaydında](todo.md#gerçek-ortamda-doğrulananlar) tutulur. XREQ-001 dört gerçek senaryoyla kapandı; XREQ-004 frontend kabulü tamamlandı, talep edenin son kabulü kendisine aittir. Önceki hatalı parola ve boş faktör listesi tarihsel test sonuçlarıdır; güncel hesap durumu olarak okunmaz.

Gerçek ortam kabulünde tarayıcı/oturum yeniden doğrulanır; önceki Chrome bağlantısının bu oturumda çalıştığı varsayılmaz. Kullanıcının belirlediği test hesabı ve ilgili posta kutusu sınırı korunur. Önceki silme testi hesabı aktif Google test hesabıyla karıştırılmaz ve DB'den geri açılmaz; ilgili backend işlerinin sahibi backend backlog'dur.

Kullanıcının önceki “maine birleştir” talimatı S01 dalı için uygulandı; S04 teslim talebi kapsamında ayrı modül dalı ve Draft PR hazırlanır. Remote `SXQHex/FtkSaaS` doğrulandı. Aynı kapsam için yeniden onay istenmez; merge ve development teslimi kaynakla eşleşen CI sonucundan sonra doğrulanır.

Devamda yukarıdaki güncel modül dalı ve onun Draft PR’si kullanılır. CI başlayınca [AGENTS devir kuralı](../../../AGENTS.md#full-clean-sırasında-kullanıcıya-devir) uygulanır. Sırf yeni SHA/run yazmak için ek belge commit'i açılmaz; bir sonraki doğal değişiklikte tek durum kaydı güncellenir.
