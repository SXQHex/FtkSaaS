# Frontend sohbet devri

Aktif bölüm, kapsam ve kabulün tek sahibi [todo.md](todo.md) dosyasıdır. Bu dosya yalnız devam için gerekli çalışma bağlamını taşır.

## Çalışma bağlamı

Aktif dal `fix/web-account-form-feedback`, main tabanı `17ee1ebcf7b900b8e420d44903b589a9ebd22830`. S02 ayrı Draft PR93'te korunur. PR98 saat dilimi/parola formu main’e birleşti; CI/CD ve otomatik Vercel dağıtımı doğrulandı. Kullanıcı şimdi hesap ekranında boş kimlik satırları, genel bölüm açıklamaları ve üst tekrar kontrollerinin kaldırılmasını; zorunlu alanlarda yıldız/placeholder ve gönderimde alan altı hata görünümünü istedi. Gerçek kabul ve açık kapılar yalnız [todo](todo.md) sahibindedir; e-postadaki kurtarma isteği XREQ-002'de, mevcut hesap bildirimi XREQ-001'dedir.

Kullanıcı Chrome eklentisiyle `uye.fethiyetango.com` üzerinde gerçek kabul istedi. Main merge sonrası Vercel otomatik Git dağıtımı doğrulandı. Test posta kutusu Chrome'da açık, bağlı Gmail connector hesabı farklıdır. Sağlayıcı araçları ayar/log incelemesinde tercih edilir. Yeni parola girişi/gönderimi kullanıcı adımıdır; parola/token/gerçek adres kaynak veya rapora yazılmaz. Yeni CI başlayınca run/head/base bilgisi kullanıcıya bırakılır; AGENTS bekleme kuralı uygulanır.
