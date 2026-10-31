# Frontend sohbet devri

Aktif bölüm, kapsam ve kabulün tek sahibi [todo.md](todo.md) dosyasıdır. Bu dosya yalnız devam için gerekli çalışma bağlamını taşır.

## Çalışma bağlamı

PR105 main `896326ac4e0adba6556807e44b0c579c8df7c3e6` ile birleşti; aday dört tarayıcı, main proof/CD ve Vercel production kabulü başarılıdır. Gerçek sağlayıcı kabulü ve açık kapılar [S01 kaydındadır](todo.md#11-web-s01-güncel-kabul-durumu). Yapılandırma veya secret aktarımı bekleyen iş yoktur.

Aktif devam dalı `feat/web-s01-photo-autosave`. Kullanıcı fotoğrafın seçimden hemen sonra kaydolmasını, kaldırmanın hemen kalıcı olup ekteki SVG varsayılana dönmesini ve görsel üzerindeki küçük düzenle/sil düğmelerini istedi. Yeni davranış yalnız frontend kodu, ilgili mesaj/testler, statik kullanıcı eki ve kendi belge alanındadır. Backend/contract/CI değişmez. Fotoğraf ve metin formu aynı sürümlü komutu kullanır; otomatik fotoğraf işlemi ad/telefon taslağını kaydetmez ve yeniden okumada silmez. Taslak, geçici okuma hatası ve idempotent tekrar sonrası sürüm değişmemesi regresyonlarla kapsanır. Yeni akışın hosted kabulü dağıtımdan sonra gerekir.

Son kullanıcı isteği davet dışındaki kontrollerdir; davet teslimi [XREQ-003](../../../docs/requests.md#xreq-003-gerçek-davet-teslimi-ve-iş-takibi) kapsamında bekler. S01 açık, S02 Draft PR93 bekler.

Chrome'daki ayrı Google test hesabına kullanıcı ilk parolayı ekledi ve yeni parolayla giriş yaptı. Yeni parola ajan tarafından bilinmiyor; eski ortak test parolası bu hesapta artık kullanılmaz. Bildirim teslimi ve gelen kutusu doğrulandı. Native kimlik listesi hâlâ yalnız Google olduğundan unlink son kimlik reddi veriyor; doğrudan Auth tablo müdahalesi yapılmaz. Test Google kimliği admine yeniden bağlanmadı. Hesaba otomatik merkez/rol atanmadı.

TOTP bekleyen kurulum iptali PR105 sonrasında gerçek sağlayıcıda doğrulandı. Yeni bir `unverified` enrollment asıl hesap sekmesinde kullanıcı kodu için açık bırakıldı. Kurulum anahtarını kaybetmemek için sekmeyi gereksiz yenileme veya yeni kurulum üretme; secret'ı ekran görüntüsü/log/kaynaklara alma. Gerçek TOTP doğrulama/yanlış kod/kaldırma hâlâ açık. Yeni parola ve TOTP credential girdileri kullanıcı adımıdır.

Önceki fotoğraf akışında kullanıcı JPEG'i seçti; profil kaydetme, özel medya okuma, yeniden yüklemede kalıcılık, kaldırma ve yeniden yüklemede yokluk doğrulandı. Son test fotoğrafı kaldırıldı. Yeni default SVG kullanıcı ekinden aynen alındı. Önceki akışın hosted başarısı yeni otomatik akışa taşınmaz.

Yeni kaynakta `pnpm check:frontend` (220 web + 1 UI), isolation ve bağımsız inceleme tamamlandı; açık zorunlu inceleme bulgusu yok. Yerel Playwright binary'leri yok; önceki repo kurulum denemesi geçersiz ZIP indirmişti. Yerel ortam engeli dört tarayıcı başarısı sayılmaz. Yeni adayın CI kanıtı ve hosted görsel/klavye/mobil kabulü ayrıca gerekir.

Önceki silme testi hesabı `deletion_pending`; aktif Google test hesabıyla karıştırılmaz ve DB'den geri açılmaz. İmha `partial/retry_wait` kapsamı backend OPS-01/REL-01'e aittir.

Yeni aday/main CI başlayınca run/head/base/tested merge bilgisi kullanıcıya bırakılır; AGENTS bekleme kuralı uygulanır. Kullanıcı dönmeden CI polling yapılmaz. Sonraki kabul aynı devam PR'sine eklenir; yalnız yeni SHA/run yazmak için ek belge commit'i açılmaz.
