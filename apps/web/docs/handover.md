# Frontend sohbet devri

Aktif bölüm, kapsam ve kabulün tek sahibi [todo.md](todo.md) dosyasıdır. Bu dosya yalnız devam için gerekli çalışma bağlamını taşır.

## Çalışma bağlamı

PR101 main `35218844948b186f71836e7d5cee0f8065d49d69` ile birleşti; aday dört tarayıcı, main CI/CD ve aynı SHA Vercel production dağıtımı başarılıdır. S01’in kalan işi gerçek kayıt/sağlayıcı ve hesap güvenliği kabulüdür; S02 Draft PR93 kapsam dışıdır.

Kullanıcı kayıt yapılandırmasını çözmeyi istedi. Aktif dal `fix/web-signup-config`: frontend route’u mevcut app origin, Supabase URL ve publishable key’i backend’in değişmeyen server transport’una eşler. Vercel’de üç mükerrer FTK host/URL/key alanı oluşturulmaz; yalnız ingress secret eklenir. Uygulamanın host doğrulaması, imza/IP zinciri ve JWT kapıları korunur. Backend/ortak sözleşme/workflow dosyaları değişmez.

Vercel Production’a yeni şifreli `FTK_PUBLIC_INGRESS_SECRET` eklendi. Supabase’de eski ingress ve hash secret adları vardır; ingress’in asıl değeri erişilebilir yerel kaynakta ve Vault’ta bulunmadı. Yeni değerin Supabase panelinde aynı adla kaydı kullanıcıya bırakılır; eşleşme henüz doğrulanmadı. Secret değeri sohbet/kaynak/belgeye yazılmaz. Browser credential kuralı son değerin giriş ve kaydında kullanıcı devri gerektirir. Aynı secret eşleşmesi ve yeni kodun yayını sonrasında signed precheck gerçek ortamda doğrulanır; şu an kayıt kabulü kapatılmaz.

Yeni CI başlayınca run/head/base bilgisi kullanıcıya bırakılır; AGENTS bekleme kuralı uygulanır. Gerçek Auth/gateway kabulü ve eksikler yalnız [todo](todo.md) sahibindedir.
