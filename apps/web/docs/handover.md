# Frontend sohbet devri

Bu dosya yalnız devam için gereken çalışma bağlamını taşır. Aktif bölüm, karar, uygulama, kaynak, test ve gerçek kabulün tek sahibi [S01 kaydıdır](todo.md#11-web-s01-güncel-kabul-durumu); bölüm sırası [todo'dadır](todo.md#7-bölüm-bölüm-teslim-tek-aktif-bölüm).

## Çalışma bağlamı

Aktif dal `feat/web-s04-completion`, taban main `029667d17e6df30b75b5ef0a2a46c080a7b0f16c`; aynı kaynak main proof (41339801085), merge proof (41339801102) ve development teslimi (41339837912) başarılıdır. S01 temel teslimi kullanıcı onayıyla kapalıdır; aktif bölüm [S04](todo.md#web-s04). Disiplin ilişkisi düzenleme ve tek yönetici kapsamlı kişi birleştirme geliştiriliyor; kaynak henüz PR/hosted kabulü değildir. Genel hesap erişimi keşfi ve çok yöneticili birleştirme onayı için talepler ortak kayıt sahibinde tutulur.

Kullanıcı, **Frontend UI Engineering** ve **frontend-design-assistant** becerilerinin sohbetin tamamındaki frontend çalışmalarında kullanılmasını açıkça istedi. Her ikisi uygulanır; mevcut shadcn/ui ve kabul edilmiş ürün tasarım tercihleri korunur. Ekranların amacı, bilgi sırası, mobil davranışı ve hata/kurtarma durumları koddan önce belirlenir.

Kullanıcı parola değişimi ve girişini tamamladı; güncel mevcut test parolası sohbet içinde sağlandı, kaynaklara kopyalanmaz. Özgün ana e-posta geri yüklendi, pending değişiklik yok ve Google kimliği korunuyor. Gerçek telefonla doğrulanmış bir TOTP faktörü etkindir. QR, MFA davet dönüşü, iki e-posta onayı, eski adrese geri dönüş ve kullanılmış bağlantı reddi çift10–14 ile [S01 kaydında](todo.md#gerçek-ortamda-doğrulananlar) tutulur. XREQ-001 dört gerçek senaryoyla kapandı; XREQ-004 frontend kabulü tamamlandı, talep edenin son kabulü kendisine aittir. Önceki hatalı parola ve boş faktör listesi tarihsel test sonuçlarıdır; güncel hesap durumu olarak okunmaz.

Chrome bağlantısı yeniden çalışıyor; uygulama yeni sekmede açıldı. Kullanıcının açtığı Gmail sekmesi test hesabının kutusudur; Gmail connector'ı farklı hesaba bağlı olduğundan bu testte kullanılmadı. İlgisiz posta okunmaz. Önceki silme testi hesabı aktif Google test hesabıyla karıştırılmaz ve DB'den geri açılmaz; ilgili backend işlerinin sahibi backend backlog'dur.

Kullanıcının önceki “maine birleştir” talimatı S01 dalı için uygulandı; S04 teslim talebi kapsamında ayrı modül dalı ve Draft PR hazırlanır. Remote `SXQHex/FtkSaaS` doğrulandı. Aynı kapsam için yeniden onay istenmez; merge ve development teslimi kaynakla eşleşen CI sonucundan sonra doğrulanır.

Devamda aynı modül dalı/PR'si kullanılır. CI başlayınca [AGENTS devir kuralı](../../../AGENTS.md#full-clean-sırasında-kullanıcıya-devir) uygulanır. Sırf yeni SHA/run yazmak için ek belge commit'i açılmaz; bir sonraki doğal değişiklikte tek durum kaydı güncellenir.
