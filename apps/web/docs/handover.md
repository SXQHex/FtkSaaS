# Frontend sohbet devri

Bu dosya yalnız devam için gereken çalışma bağlamını taşır. Aktif bölüm, karar, uygulama, kaynak, test ve gerçek kabulün tek sahibi [S01 kaydıdır](todo.md#11-web-s01-güncel-kabul-durumu); bölüm sırası [todo'dadır](todo.md#7-bölüm-bölüm-teslim-tek-aktif-bölüm).

## Çalışma bağlamı

Aktif dal `docs/xreq-acceptance`; PR112 main’e birleşti. XREQ-001/002 kapanış kabulü sürüyor. Son bulguların tek sahibi docs/requests.md içindeki frontend kabul alanlarıdır. Kullanıcı native kurtarma formunda yeni parolayı kaydettiğini teyit etti. Aynı parola reddi için anlamlı mesaj ve kayıt/kurtarma formlarının tekrar parola alanına bağımsız göster/gizle denetimi eklendi; kaynak kontrolleri ve PR kabulü bu dalda tamamlanır. Kullanıcının frontend değişiklikleri güncel main üzerinden bu dala dahil edildi. Native Auth arayüz düzeltmelerinin kapsamı, son taban ve doğrulama sınırları [S01 kaydından](todo.md#native-auth-arayüz-düzeltmeleri) okunur. Yeni backend yol haritası frontend'in aktif bölümünü değiştirmez; davet bağımlılığı [XREQ-003](../../../docs/requests.md#xreq-003-gerçek-davet-teslimi-ve-iş-takibi) üzerinden izlenir.

Kullanıcı mevcut parola değişimini tamamladığını teyit etti; yeniden test edilmez. Test hesaplarının parolasını sohbet içinde verdi; kaynaklara veya rapora kopyalanmaz. Bu parola aktif Google test hesabında native girişte reddedildi; parola tahmini/tekrar döngüsü yapılmaz. Önceki geçici TOTP anahtarı temizlendi. Faktör/iletişim temizliği ve açık adımların sahibi [gerçek ortam kaydıdır](todo.md#gerçek-ortamda-doğrulananlar).

Chrome bağlantısı yeniden çalışıyor; uygulama yeni sekmede açıldı. Kullanıcının açtığı Gmail sekmesi test hesabının kutusudur; Gmail connector'ı farklı hesaba bağlı olduğundan bu testte kullanılmadı. İlgisiz posta okunmaz. Önceki silme testi hesabı aktif Google test hesabıyla karıştırılmaz ve DB'den geri açılmaz; ilgili backend işlerinin sahibi backend backlog'dur.

Kullanıcının son “maine birleştir” talimatı bu S01 dalının yayımlanmasını, PR açılmasını ve gerekli kontrollerden sonra main'e birleştirilmesini yetkilendirir. Remote `SXQHex/FtkSaaS` doğrulandı. Aynı kapsam için yeniden onay istenmez; merge ve development teslimi kaynakla eşleşen CI sonucundan sonra doğrulanır.

Devamda aynı modül dalı/PR'si kullanılır. CI başlayınca [AGENTS devir kuralı](../../../AGENTS.md#full-clean-sırasında-kullanıcıya-devir) uygulanır. Sırf yeni SHA/run yazmak için ek belge commit'i açılmaz; bir sonraki doğal değişiklikte tek durum kaydı güncellenir.
