# Frontend sohbet devri

Bu dosya yalnız devam için gereken çalışma bağlamını taşır. Aktif bölüm, karar, uygulama, kaynak, test ve gerçek kabulün tek sahibi [S01 kaydıdır](todo.md#11-web-s01-güncel-kabul-durumu); bölüm sırası [todo'dadır](todo.md#7-bölüm-bölüm-teslim-tek-aktif-bölüm).

## Çalışma bağlamı

Aktif dal `docs/web-s01-final-acceptance`, taban main `d88e103b0cb8c156292c17f889ad65443948938d`; aynı kaynak main proof ve development teslimi başarılıdır. PR114 teslimi ve canlı parola görünürlüğü kabulü [S01 kaydında](todo.md#native-auth-arayüz-düzeltmeleri) uzlaştırıldı. Kullanıcının güncel talimatı S01’i bitirmek ve tamamlanan gerçek kontrolleri ikişerli kanıt commit’leriyle kaydetmektir; çift 01 ve 02 ayrı commitlerle gönderildi. Backend’in bizden istediği [XREQ-004](../../../docs/requests.md#xreq-004-giriş-boyunca-davet-fragmentini-koruma) düzeltmesi PR120 ile main’de teslim edildi; bu dal yalnız sonraki kabul kanıtlarını taşır. XREQ-001/002 son kabulünün tek sahibi ortak talep kaydıdır. Davet artık bu turun kapsamındadır.

Kullanıcının işlem anı onayıyla gerçek davet kabul edildi; aynı bağlantının yenileme sonrası replay kabulü tamamlandı. Kanıt çifti 03 S01 kaydındadır. Aynı tarayıcıdaki sayfa sonraki kullanıcı adımı için bırakılır. Bu kabul oturumlu doğrudan geliş kanıtıdır; yeni oturumsuz dönüş kodunun canlı kabulü değildir.

Kullanıcı parola değişimi ve girişini tamamladı; güncel mevcut test parolası sohbet içinde sağlandı, kaynaklara kopyalanmaz. Özgün ana e-posta geri yüklendi, pending değişiklik yok ve Google kimliği korunuyor. Gerçek telefonla doğrulanmış bir TOTP faktörü etkindir. QR, MFA davet dönüşü, iki e-posta onayı, eski adrese geri dönüş ve kullanılmış bağlantı reddi çift10–14 ile [S01 kaydında](todo.md#gerçek-ortamda-doğrulananlar) tutulur. XREQ-001 dört gerçek senaryoyla kapandı; XREQ-004 frontend kabulü tamamlandı, talep edenin son kabulü kendisine aittir. Önceki hatalı parola ve boş faktör listesi tarihsel test sonuçlarıdır; güncel hesap durumu olarak okunmaz.

Chrome bağlantısı yeniden çalışıyor; uygulama yeni sekmede açıldı. Kullanıcının açtığı Gmail sekmesi test hesabının kutusudur; Gmail connector'ı farklı hesaba bağlı olduğundan bu testte kullanılmadı. İlgisiz posta okunmaz. Önceki silme testi hesabı aktif Google test hesabıyla karıştırılmaz ve DB'den geri açılmaz; ilgili backend işlerinin sahibi backend backlog'dur.

Kullanıcının son “maine birleştir” talimatı bu S01 dalının yayımlanmasını, PR açılmasını ve gerekli kontrollerden sonra main'e birleştirilmesini yetkilendirir. Remote `SXQHex/FtkSaaS` doğrulandı. Aynı kapsam için yeniden onay istenmez; merge ve development teslimi kaynakla eşleşen CI sonucundan sonra doğrulanır.

Devamda aynı modül dalı/PR'si kullanılır. CI başlayınca [AGENTS devir kuralı](../../../AGENTS.md#full-clean-sırasında-kullanıcıya-devir) uygulanır. Sırf yeni SHA/run yazmak için ek belge commit'i açılmaz; bir sonraki doğal değişiklikte tek durum kaydı güncellenir.
