# Frontend sohbet devri

Bu dosya yalnız devam için gereken çalışma bağlamını taşır. Aktif bölüm, karar, uygulama, kaynak, test ve gerçek kabulün tek sahibi [S01 kaydıdır](todo.md#11-web-s01-güncel-kabul-durumu); bölüm sırası [todo'dadır](todo.md#7-bölüm-bölüm-teslim-tek-aktif-bölüm).

## Çalışma bağlamı

Aktif dal `fix/web-s01-invitation-return`, taban main `56a170779994d0708fcbe66dffa5f19b3da1d2bd`; aynı kaynak main proof ve development teslimi başarılıdır. PR114 teslimi ve canlı parola görünürlüğü kabulü [S01 kaydında](todo.md#native-auth-arayüz-düzeltmeleri) uzlaştırıldı. Kullanıcının güncel talimatı S01’i bitirmek ve tamamlanan gerçek kontrolleri ikişerli kanıt commit’leriyle kaydetmektir; çift 01 ve 02 ayrı commitlerle gönderildi. Backend’in bizden istediği [XREQ-004](../../../docs/requests.md#xreq-004-giriş-boyunca-davet-fragmentini-koruma) düzeltmesi bu dalda; kod/otomatik test ile hosted kabul ayrı tutulur. XREQ-001/002 son kabulünün tek sahibi ortak talep kaydıdır. Davet artık bu turun kapsamındadır.

Kullanıcının işlem anı onayıyla gerçek davet kabul edildi; aynı bağlantının yenileme sonrası replay kabulü tamamlandı. Kanıt çifti 03 S01 kaydındadır. Aynı tarayıcıdaki sayfa sonraki kullanıcı adımı için bırakılır. Bu kabul oturumlu doğrudan geliş kanıtıdır; yeni oturumsuz dönüş kodunun canlı kabulü değildir.

Kullanıcı mevcut parola değişimini tamamladığını teyit etti; yeniden test edilmez. Yeni kayıt/doğrulama/parolalı giriş ve parolalı davet dönüşü çift06–08 ile kaydedildi. Ana Google hesabında kullanıcının yeniden ortak olarak belirttiği parola yine native invalid_credentials verdi; yeni hesabın aynı parolayla girişi çalıştı. Ana hesaba parola tahmini/tekrar yok; kurtarmada belirlenen mevcut parola kullanıcıdan veya kendi girişinden sağlanmalı. Test hesaplarının parolasını sohbet içinde verdi; kaynaklara veya rapora kopyalanmaz. Bu parola aktif Google test hesabında native girişte reddedildi; parola tahmini/tekrar döngüsü yapılmaz. Önceki geçici TOTP anahtarı temizlendi. Faktör/iletişim temizliği ve açık adımların sahibi [gerçek ortam kaydıdır](todo.md#gerçek-ortamda-doğrulananlar).

Chrome bağlantısı yeniden çalışıyor; uygulama yeni sekmede açıldı. Kullanıcının açtığı Gmail sekmesi test hesabının kutusudur; Gmail connector'ı farklı hesaba bağlı olduğundan bu testte kullanılmadı. İlgisiz posta okunmaz. Önceki silme testi hesabı aktif Google test hesabıyla karıştırılmaz ve DB'den geri açılmaz; ilgili backend işlerinin sahibi backend backlog'dur.

Kullanıcının son “maine birleştir” talimatı bu S01 dalının yayımlanmasını, PR açılmasını ve gerekli kontrollerden sonra main'e birleştirilmesini yetkilendirir. Remote `SXQHex/FtkSaaS` doğrulandı. Aynı kapsam için yeniden onay istenmez; merge ve development teslimi kaynakla eşleşen CI sonucundan sonra doğrulanır.

Devamda aynı modül dalı/PR'si kullanılır. CI başlayınca [AGENTS devir kuralı](../../../AGENTS.md#full-clean-sırasında-kullanıcıya-devir) uygulanır. Sırf yeni SHA/run yazmak için ek belge commit'i açılmaz; bir sonraki doğal değişiklikte tek durum kaydı güncellenir.
