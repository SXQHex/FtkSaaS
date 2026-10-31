# Frontend sohbet devri

Aktif bölüm, kapsam ve kabulün tek sahibi [todo.md](todo.md) dosyasıdır. Bu dosya yalnız devam için gerekli çalışma bağlamını taşır.

## Çalışma bağlamı

Aktif dal `fix/web-native-auth-consumers`, bağımlı kaynak açık backend PR99 head `35efd9b35ce2f47bf79728c2ee5b6585f525b368`. Ayrı worktree `FtkSaaS-auth` kullanılır; diğer worktree’deki backend geçici dosyasına dokunulmaz. Başlangıç main `65d64aed54716a53cda14963b1438a3523451afa` başarılı kabulüyle doğrulandı. Kullanıcı bu commit’teki settings.md’ye göre bütün Auth tüketimini istedi. Teslim frontend-only farkla PR99 dalını hedefler. Bu frontend düzeltmesi PR99’a alınınca parent PR’nin birleşik kaynak CI’si çalışır; main’e birleşme o kanıtla ayrı yürür. Böylece main tabanına backend kodu kopyalanmaz ve geçici uyumluluk yolu kurulmaz. S02 Draft PR93 kapsam dışıdır.

Kayıt check route’u, native Google/TOTP/parola/reauth/recovery sözleşmesi uygulanır; eski özel Auth endpoint’leri çağrılmaz. Kalan gerçek kabul, eksik gateway sunucu ortamı ve test sınırları yalnız [todo](todo.md) sahibindedir. Hosted Auth/Vercel/secret ayarı değiştirilmedi. Parola/token/gerçek adres kaynak veya rapora yazılmaz. Chrome eklenti aracı bu turda mevcut değildir; yerel Playwright kurulumu başarısızdır. Yeni CI başlayınca run/head/base bilgisi kullanıcıya bırakılır; AGENTS bekleme kuralı uygulanır.
