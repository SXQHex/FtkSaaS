# Frontend sohbet devri

Bu dosya yalnız devam için gereken çalışma bağlamını taşır. Aktif bölüm, karar, uygulama, kaynak, test ve gerçek kabulün tek sahibi [S01 kaydıdır](todo.md#11-web-s01-güncel-kabul-durumu); bölüm sırası [todo'dadır](todo.md#7-bölüm-bölüm-teslim-tek-aktif-bölüm).

## Çalışma bağlamı

Aktif dal `test/web-s01-security-acceptance`. Kullanıcının frontend değişiklikleri güncel main üzerinden bu dala dahil edildi. Native Auth arayüz düzeltmelerinin kapsamı, son taban ve doğrulama sınırları [S01 kaydından](todo.md#native-auth-arayüz-düzeltmeleri) okunur. Yeni backend yol haritası frontend'in aktif bölümünü değiştirmez; davet bağımlılığı [XREQ-003](../../../docs/requests.md#xreq-003-gerçek-davet-teslimi-ve-iş-takibi) üzerinden izlenir.

Aktif Google test hesabının kullanıcı tarafından belirlenen mevcut parolası ajan tarafından bilinmiyor; eski ortak test parolası kullanılmaz. Önceki geçici TOTP anahtarı temizlendi ve yeniden kullanılamaz. Devamda faktör/iletişim temizliği ve hangi adımların açık kaldığı için [gerçek ortam kaydını](todo.md#gerçek-ortamda-doğrulananlar) esas al; eski kurulum veya geçici alias üzerinden yeni işlem başlatma. Doğrudan Auth tablo müdahalesi yapılmaz.

Son tarayıcı çağrısı Chrome ChatGPT eklentisinin güncellenmesini istedi; yeni canlı işten önce bağlantının yeniden çalıştığı doğrulanmalı. Kullanıcının açtığı Gmail sekmesi test hesabının kutusudur; Gmail connector'ı farklı hesaba bağlı olduğundan bu testte kullanılmadı. İlgisiz posta okunmaz. Önceki silme testi hesabı aktif Google test hesabıyla karıştırılmaz ve DB'den geri açılmaz; ilgili backend işlerinin sahibi backend backlog'dur.

Kullanıcının son “maine birleştir” talimatı bu S01 dalının yayımlanmasını, PR açılmasını ve gerekli kontrollerden sonra main'e birleştirilmesini yetkilendirir. Remote `SXQHex/FtkSaaS` doğrulandı. Aynı kapsam için yeniden onay istenmez; merge ve development teslimi kaynakla eşleşen CI sonucundan sonra doğrulanır.

Devamda aynı modül dalı/PR'si kullanılır. CI başlayınca [AGENTS devir kuralı](../../../AGENTS.md#full-clean-sırasında-kullanıcıya-devir) uygulanır. Sırf yeni SHA/run yazmak için ek belge commit'i açılmaz; bir sonraki doğal değişiklikte tek durum kaydı güncellenir.
