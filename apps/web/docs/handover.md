# Frontend sohbet devri

Aktif bölüm, kapsam ve kabulün tek sahibi [todo.md](todo.md) dosyasıdır. Bu dosya yalnız devam için gerekli çalışma bağlamını taşır.

## Çalışma bağlamı

PR103 main `fd410ba8224983b47fe62db67639750063ec6d0a` ile birleşti; aynı kaynak için CI/development delivery ve Vercel production başarılıdır. Signed signup precheck canlı kabulü kapandı; Vercel–Supabase ingress eşleşmesi doğrulandı. Yapılandırma veya secret aktarımı bekleyen iş yoktur. Ayrıntı ve bağlantılar [S01 kabul kaydındadır](todo.md#11-web-s01-güncel-kabul-durumu).

Aktif devam dalı `docs/web-s01-live-acceptance`, Draft PR104; frontend kabul/devir belgeleri ve kendi alanlar arası talep alanı değişir. S01 açık, S02 Draft PR93 bekler. Gerçek Chrome kabulünde profil/E.164, oturum etiketi/others/current/selected revoke, eski bearer ve refresh reddi, Google girişi, hesap değiştirme, kurtarma postası/PKCE/tekrar kullanım ve geçersiz davet doğrulandı. Yabancı session label/revoke reddi native Edge ile ayrıca doğrulandı. Test numarası ve etiket eski boş değerlerine döndürüldü; görünüm tercihleri/viewport geri alındı. Tanılama native oturumları kapatıldı.

Kullanıcı bütün hesapları test hesabı olarak tanımladı ve ayrı S01 hesabının silinmesine açık izin verdi. O hesap artık `deletion_pending`; testlere aktif hesap gibi devam edilmez ve doğrudan DB ile geri açılmaz. Kendi takip ekranı yeniden native giriş sonrası çalışıyor; başka hesap aynı işi okuyamıyor. Worker `partial/retry_wait`, fiziksel imha kapsamları bekliyor; backend OPS-01/REL-01 kapanmış sayılmaz.

Son kullanıcı sırası: kendi belirttiği test hesabına gerçek davet, ardından parola değişimi/bildirim, TOTP, Google bağlama/kaldırma, fotoğraf ve e-posta değişimi. Test adresi yerine yeni alias kullanılmaz. Oluşturulan kişi kaydının adresi kullanıcı seçimine düzeltildi; yanlış alıcılı ilk davet yeni gönderimle iptal edildi. Öğrencilik etkinleştirilmedi, hesap bağı oluşturulmadı. Davet teslimi ve iş takibi [XREQ-003](../../../docs/requests.md#xreq-003-gerçek-davet-teslimi-ve-iş-takibi) ile backend değerlendirmesine açıldı; token elle çıkarılıp gönderilmez. Son açık istekle test adresinin admin hesabındaki Google bağı UI'dan kaldırıldı; native kimlik okuması, oturum yenilenmesi, güvenlik geçmişi ve ana adrese bildirim teslimi doğrulandı. Adminin e-posta kimliği korundu. Bu adrese ayrı aktif hesap açıldığı varsayılmaz; yeniden bağlama/silme adımından önce güncel kimlikler okunur.

Sıradaki iş [açık kabul kapılarıdır](todo.md#kalan-kapanış-kapıları). Yeni parola girişi/tekrarı/gönderimi Browser credential kuralı gereği kullanıcı adımıdır; aynı parola native same_password reddi verebilir. Değişiklik sonrası gerçek posta ve oturum davranışı doğrulanır. Fotoğraf için tarayıcı cihazından dosya seçimi gerekir; scratch dosyası cihazda var sayılmaz. Bu tur fotoğraf yüklenmedi. Parola/token/gerçek adres bu dosyaya yazılmaz.

Yeni aday/main CI başlayınca run/head/base/tested merge bilgisi kullanıcıya bırakılır; AGENTS bekleme kuralı uygulanır. Kullanıcı dönmeden CI polling yapılmaz. Sonraki kabul aynı devam PR'sine eklenir; yalnız yeni SHA/run yazmak için ek belge commit'i açılmaz.
