# Kalıcı geliştirme/test backend’i

Kullanıcının doğruladığı proje: `gwyprhenabtpkbojephw`, FtkSaaS, eu-central-1. Bu hedef geliştirme/test içindir; production yetkisi verilmemiştir.

Kurulum kaynağı: main `4d47d75e4a337378cfcc65f727c67abcac310303`, 21 sıralı ve SHA-256 ile dondurulmuş uygulama migration’ı; 22. migration `api_schema_exposure` yerel ve hosted API şema ayarını eşler. Edge kaynağı `supabase/functions/backend-v1/index.ts`; dependency-complete bundle, ek paket indirme gerektirmez.

Kurulum öncesi migration/Edge listesi boş, core/private/api_v1 şemaları yok ve Auth kullanıcı sayısı sıfır doğrulandı. Mevcut gerçek tenant/veri üzerine reset yapılmaz. `npm run test:clean` uzak projeye yönlendirilmez; bu komut yalnız loopback içindir.

Uygulanan kurulum sırası: migration’ları mevcut dosya sırasıyla uygula; yalnız `api_v1` Data API şemasını erişime aç; core/private kapalı kalır. Fonksiyonlar yalnız service_role tarafından çağrılır. Edge gelen tokenı Auth servisiyle doğrular ve DB canlı session/yetki kontrolünü sürdürür. JWT doğrulaması iki katmanda da korunur.

Salt okunur SQL kontrolleri `scripts/remote-backend-verify.sql` dosyasındadır.

22 migration kaydı kaynak sürümleriyle eşleşti. 90 core tabloda RLS, 65 API wrapper için yalnız service_role EXECUTE doğrulandı. Gerçek Auth girişi → Edge → RPC hesap/liste okuma; geçersiz JWT, doğrudan authenticated RPC reddi (403/42501) ve iptal edilmiş oturumun eski JWT ile reddi geçti. Geçici kullanıcı/hesap temizlendi; uzak smoke tam 181 testlik yerel/CI suite’in tekrarı değildir. Kanıt: `reports/remote-backend-verification.json`.

Security advisors: platformun `public.rls_auto_enable()` fonksiyonunun anon/authenticated EXECUTE izinleri ve kapalı sızdırılmış parola koruması WARN verir. `public`, authenticator için exposed şema değildir; core/private da dışarı açılmaz. RLS policy yokluğu servis rolü tasarımına ait INFO, kullanılmayan indeksler ve yedi indekssiz FK INFO’dur; yük kabulü yapılmadı. Parola koruması: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection .

Bağlantı: `https://gwyprhenabtpkbojephw.supabase.co/functions/v1/backend-v1/{operation}`. Frontend publishable key ve kullanıcının access tokenını kullanır. Service-role/DB parolası kaynak koduna veya frontend’e konmaz. Dış e-posta, frontend kabulü, yük/restore ayrı açık işlerdir.
