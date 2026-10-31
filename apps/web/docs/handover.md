# Frontend sohbet devri

Aktif bölüm, kapsam ve kabulün tek sahibi [todo.md](todo.md) dosyasıdır. Bu dosya yalnız devam için gerekli çalışma bağlamını taşır.

## Çalışma bağlamı

PR103 main `fd410ba8224983b47fe62db67639750063ec6d0a` ile birleşti; aynı kaynak için CI/development delivery ve Vercel production başarılıdır. Signed signup precheck canlı kabulü kapandı; Vercel–Supabase ingress eşleşmesi doğrulandı. Yapılandırma veya secret aktarımı bekleyen iş yoktur. Ayrıntı ve bağlantılar [S01 kabul kaydındadır](todo.md#11-web-s01-güncel-kabul-durumu).

Aktif devam dalı `docs/web-s01-live-acceptance`; yalnız frontend kabul/devir belgeleri değişir. S01 açık, S02 Draft PR93 bekler. Gerçek Chrome kabulünde profil/E.164, oturum etiketi/others/current revoke, eski bearer ve refresh reddi, Google girişi, hesap değiştirme, kurtarma postası/PKCE/tekrar kullanım ve geçersiz davet doğrulandı. Test numarası ve etiket eski boş değerlerine döndürüldü; görünüm tercihleri/viewport geri alındı.

Kullanıcı bütün hesapları test hesabı olarak tanımladı ve ayrı S01 hesabının silinmesine açık izin verdi. O hesap artık `deletion_pending`; testlere aktif hesap gibi devam edilmez ve doğrudan DB ile geri açılmaz. Kendi takip ekranı yeniden native giriş sonrası çalışıyor; başka hesap aynı işi okuyamıyor. Worker `partial/retry_wait`, fiziksel imha kapsamları bekliyor; backend OPS-01/REL-01 kapanmış sayılmaz.

Sıradaki iş [açık kabul kapılarıdır](todo.md#kalan-kapanış-kapıları). Admin hesabındaki mevcut parola formu kullanıcı adımına hazırlanır. Yeni parola girişi/tekrarı/gönderimi Browser credential kuralı gereği kullanıcı tarafından yapılır; mevcut parola tekrar yeni parola olarak kullanılırsa native same_password reddi beklenir. Değişiklik sonrası gerçek posta ve oturum davranışı doğrulanır. TOTP/Google kimlik değişimi, fotoğraf, e-posta değişimi ve gerçek davet için gereken kullanıcı/ortam adımları kabul kaydındaki sınırlarla yürütülür. Parola/token/gerçek adres bu dosyaya yazılmaz.

Yeni aday/main CI başlayınca run/head/base/tested merge bilgisi kullanıcıya bırakılır; AGENTS bekleme kuralı uygulanır. Kullanıcı dönmeden CI polling yapılmaz. Sonraki kabul aynı devam PR'sine eklenir; yalnız yeni SHA/run yazmak için ek belge commit'i açılmaz.
