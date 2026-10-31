# Frontend sohbet devri

Aktif bölüm, kapsam ve kabulün tek sahibi [todo.md](todo.md) dosyasıdır. Bu dosya yalnız devam için gerekli çalışma bağlamını taşır.

## Çalışma bağlamı

PR104 main `89f9e099a7424d99065eb7f6791ae486f0d8fa50` ile birleşti; aday ve main kanıtları başarılıdır. PR104 yalnız belge değiştirdi; production runtime kanıtı ve önceki gerçek kabul [S01 kaydındadır](todo.md#11-web-s01-güncel-kabul-durumu). Yapılandırma veya secret aktarımı bekleyen iş yoktur.

Aktif devam dalı `test/web-s01-provider-acceptance`. Son kullanıcı isteği davet dışındaki kontrollerdir; davet teslimi [XREQ-003](../../../docs/requests.md#xreq-003-gerçek-davet-teslimi-ve-iş-takibi) kapsamında bekler. S01 açık, S02 Draft PR93 bekler. Bu dal yalnız frontend TOTP/Google tüketicileri, ilişkili mesaj/testler ve kendi kabul/devrini değiştirir.

Admin hesabından daha önce kaldırılan Google test kimliğiyle ayrı hesap açıldı. Şu an Chrome'da bu Google-only test hesabı açık; native e-posta doğrulanmış, parola yok, otomatik merkez/rol oluşmadı. Test kimliği admine yeniden bağlanmadı. Son Google kimliğini kaldırma native sağlayıcıda reddedildi ve kimlik korundu; devam dalı bu hata kodunu anlaşılır mesajla gösterir.

TOTP enrollment hazırlandı fakat doğrulanmadı. Canlı sürüm bekleyen faktörü listeleyemediği için iptal düğmesi yok; düzeltme native `listFactors().all` içinden TOTP kayıtlarını kullanır. Asıl hesap sekmesindeki kurulum anahtarını kaybetme, sayfayı gereksiz yenileme ve yeni kurulum üretme. İkinci hesap sekmesi parola/fotoğraf adımı için açıktır. Yeni parola ve TOTP doğrulama girdileri Browser credential kuralı gereği kullanıcıya bırakıldı; boş form doğrulamaları ve normal genişlikte klavye yolu kontrol edildi. Gerçek kimlik bilgileri kaynaklara yazılmaz.

Kullanıcının sağladığı JPEG fotoğraf henüz yüklenmedi. Chrome aracının sohbet ekine erişimi host kuralıyla reddedildi; alternatif yüzeyle aşılmadı. Kullanıcının tarayıcı cihazında dosyayı seçmesinden sonra profil kaydetme, yeniden okuma ve kaldırma kontrol edilir. Scratch yolu cihazda var sayılmaz.

Düzeltme regresyonları önce eski kodda başarısız, yeni kaynakta başarılıdır. `pnpm check:frontend` ve isolation geçti. Yerel E2E tarayıcıları yok; repo kurulum komutu geçersiz ZIP indirmesiyle başarısız oldu. Bu ortam engeli test başarısı sayılmaz; dört tarayıcı CI ve düzeltmelerin hosted kabulü bekler. Ayrıntı ve kalan parola/e-posta/TOTP/fotoğraf/sayfalama/replay kapıları [todo.md](todo.md#kalan-kapanış-kapıları) sahibindedir.

Önceki silme testi hesabı `deletion_pending`; yeni Google test hesabıyla karıştırılmaz ve DB'den geri açılmaz. İmha `partial/retry_wait` kapsamı backend OPS-01/REL-01'e aittir.

Yeni aday/main CI başlayınca run/head/base/tested merge bilgisi kullanıcıya bırakılır; AGENTS bekleme kuralı uygulanır. Kullanıcı dönmeden CI polling yapılmaz. Sonraki kabul aynı devam PR'sine eklenir; yalnız yeni SHA/run yazmak için ek belge commit'i açılmaz.
