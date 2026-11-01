# Frontend sohbet devri

Bu dosya yalnız devam için gereken çalışma bağlamını taşır. Aktif bölüm, uygulama, kaynak, test ve gerçek kabulün tek sahibi [frontend todo kaydıdır](todo.md); bölüm sırası [todo'dadır](todo.md#7-bölüm-bölüm-teslim-tek-aktif-bölüm).

## Çalışma bağlamı

Aktif dal `feat/web-s04-remaining-acceptance`, taban main `56bfc6dda568824bc0c0bc4b49f380f50165bfa4`. S04 Starter geliştirme/kabulü tamamlandı; kapanış belgesi PR/main teslimine hazırlanıyor. Tek kabul sahibi [S04 kaydıdır](todo.md#web-s04); source/CI/hosted kanıtı ve test verisinin son durumu oradadır. S01 temel teslimi kapalıdır. Sonraki bölüm, kapanış tesliminden sonra [todo bölüm sırasından](todo.md#7-bölüm-bölüm-teslim-tek-aktif-bölüm) seçilir.

Kullanıcı test sunucusuna mock veri yazılmasına açık izin verdi. Fixture kurulumundan sonra gerçek UI/API ile açık işlem reddi, cursor sayfalama, finans/hak geçmişli birleştirme, davet iptali ve mock hesap bağı kaldırma tamamlandı. Gerçek API’de tüketilmeyen cevap sonrası status/aynı-key replay tek kişi üretti; UI kurtarma testleri ayrı kanıttır. Tarayıcı reload/lock denemeleri gerçek yanıt kaybı sayılmaz. Auth/RLS/yetki kapıları değiştirilmedi, e-posta veya tahsilat yapılmadı. Test borcu/hak geçmişi korundu; test öğrencilikleri pasif. Mevcut native hesap bağları kaldırılmadı.

Yerel testlerde yalnız süreç için `NODE_USE_ENV_PROXY=0` gereklidir; repo config değiştirilmedi. Yerel Playwright browser indirimi bozuk ZIP ile engellendi; dört tarayıcı kanıtı PR127’nin başarılı CI’sındadır. Kapanışta runtime/test/config değişmediği için ağır suiteler tekrar çalıştırılmaz.

Kullanıcı, **Frontend UI Engineering** ve **frontend-design-assistant** becerilerinin sohbetin tamamındaki frontend çalışmalarında kullanılmasını açıkça istedi. Her ikisi uygulanır; mevcut shadcn/ui ve kabul edilmiş ürün tasarım tercihleri korunur. Ekranların amacı, bilgi sırası, mobil davranışı ve hata/kurtarma durumları koddan önce belirlenir.

Kullanıcı parola değişimi ve girişini tamamladı; güncel mevcut test parolası sohbet içinde sağlandı, kaynaklara kopyalanmaz. Özgün ana e-posta geri yüklendi, pending değişiklik yok ve Google kimliği korunuyor. Gerçek telefonla doğrulanmış bir TOTP faktörü etkindir. QR, MFA davet dönüşü, iki e-posta onayı, eski adrese geri dönüş ve kullanılmış bağlantı reddi çift10–14 ile [S01 kaydında](todo.md#gerçek-ortamda-doğrulananlar) tutulur. XREQ-001 dört gerçek senaryoyla kapandı; XREQ-004 frontend kabulü tamamlandı, talep edenin son kabulü kendisine aittir. Önceki hatalı parola ve boş faktör listesi tarihsel test sonuçlarıdır; güncel hesap durumu olarak okunmaz.

Gerçek ortam kabulünde tarayıcı/oturum yeniden doğrulanır; önceki Chrome bağlantısının bu oturumda çalıştığı varsayılmaz. Kullanıcının belirlediği test hesabı ve ilgili posta kutusu sınırı korunur. Önceki silme testi hesabı aktif Google test hesabıyla karıştırılmaz ve DB'den geri açılmaz; ilgili backend işlerinin sahibi backend backlog'dur.

Kullanıcının önceki “maine birleştir” talimatı S01 dalı için uygulandı; S04 teslim talebi kapsamında ayrı modül dalı ve Draft PR hazırlanır. Remote `SXQHex/FtkSaaS` doğrulandı. Aynı kapsam için yeniden onay istenmez; merge ve development teslimi kaynakla eşleşen CI sonucundan sonra doğrulanır.

Devamda yukarıdaki güncel modül dalı ve onun Draft PR’si kullanılır. CI başlayınca [AGENTS devir kuralı](../../../AGENTS.md#full-clean-sırasında-kullanıcıya-devir) uygulanır. Sırf yeni SHA/run yazmak için ek belge commit'i açılmaz; bir sonraki doğal değişiklikte tek durum kaydı güncellenir.
