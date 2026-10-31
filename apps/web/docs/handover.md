# Frontend sohbet devri

Aktif bölüm, kapsam ve kabulün tek sahibi [todo.md](todo.md) dosyasıdır. Bu dosya yalnız devam için gerekli çalışma bağlamını taşır.

## Çalışma bağlamı

Aktif dal `fix/web-native-auth-consumers`, PR101 artık main’i hedefler. Backend PR99 main’e birleşti: `2cad812fe476d0dd00315fbe1afab7b59c450b36`. Kullanıcı güncel main ile farkların giderilmesini ve PR101’in merge edilmesini açıkça onayladı. Main çatışmasız alındı; backend/CI kaynakları main ile aynıdır, yalnız frontend tüketicisi ve kendi durum belgeleri değişir. Main’in proof41214268975, merge proof41214269047 ve frontend41214269061 başarılı; compatibility41214268919 başarısızdı ve yeni kaynakta kapanması gerekir. Kullanıcının merge yetkisi geçerlidir; gerekli kaynak bağlı CI başarılı olmadan merge edilmez. Retarget sırasında ilk edited olayının merge SHA’sı eski PR99 parent’ını taşıdığı için kaynak doğrulaması reddetti; immutable eski olayı rerun etmek yerine güvenlik kapısı korunarak yeni synchronize olayıyla kabul yenilenir. Runtime/test kaynağı yerelde doğrulanmış haliyle aynıdır. S02 Draft PR93 kapsam dışıdır.

Kayıt check route’u, native Google/TOTP/parola/reauth/recovery sözleşmesi uygulanır; eski özel Auth endpoint’leri çağrılmaz. Kalan gerçek kabul, eksik gateway sunucu ortamı ve test sınırları yalnız [todo](todo.md) sahibindedir. Hosted Auth/Vercel/secret ayarı değiştirilmedi. Parola/token/gerçek adres kaynak veya rapora yazılmaz. Önceki yerel Playwright kurulumu başarısızdı; yeni CI ve hosted kabul ayrı izlenir. Yeni CI başlayınca run/head/base bilgisi kullanıcıya bırakılır; AGENTS bekleme kuralı uygulanır.
