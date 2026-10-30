# Frontend sohbet devri

Aktif bölüm, kapsam ve kabulün tek sahibi [todo.md](todo.md) dosyasıdır. Bu dosya yalnız devam için gerekli çalışma bağlamını taşır.

## Çalışma bağlamı

Aktif dal `fix/web-browser-timezone`, main tabanı `8ae10cc2fa030539bbfc823bb2b435caf148f4fa`. S02 ayrı Draft PR93'te korunur. Kullanıcı S01 kabulü sırasında ortak tarayıcı saat dilimi ile mevcut + yeni + tekrar parola formunu istedi. Gerçek kabul ve açık kapılar yalnız [todo](todo.md) sahibindedir; e-postadaki kurtarma isteği XREQ-002'de, mevcut hesap bildirimi XREQ-001'dedir.

Kullanıcı Chrome eklentisiyle `uye.fethiyetango.com` üzerinde gerçek kabul istedi. Main merge sonrası Vercel otomatik Git dağıtımı doğrulandı. Test posta kutusu Chrome'da açık, bağlı Gmail connector hesabı farklıdır. Sağlayıcı araçları ayar/log incelemesinde tercih edilir. Yeni parola girişi/gönderimi kullanıcı adımıdır; parola/token/gerçek adres kaynak veya rapora yazılmaz. Yeni CI başlayınca run/head/base bilgisi kullanıcıya bırakılır; AGENTS bekleme kuralı uygulanır.
