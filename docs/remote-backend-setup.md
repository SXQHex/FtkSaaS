# Kalıcı geliştirme/test backend’i

Proje `gwyprhenabtpkbojephw`, FtkSaaS, eu-central-1; kullanıcı tarafından geliştirme/test olarak doğrulandı. Son açık talimat20 Ekim2026: her main birleşmesinin aynı kaynak kabulü sonrası bu ortam da güncellenir.

20 Ekim son kullanıcı talimatı: her main birleşmesinin aynı kaynak kabulü doğrulandıktan sonra `gwyprhenabtpkbojephw` FtkSaaS **geliştirme/test** ortamını da o main ile eşitle. Önce migration geçmişi ve içerik eşleşmesini doğrula; yalnız eksik migration’ları sırasıyla uygula, değişen Edge bundle’ını yayımla, JWT/izin kapılarını koru; aynı içerik varsa yeniden kurulum yapmadan eşleşmeyi kaydet. Ardından uzak Auth→Edge→RPC smoke, RLS/EXECUTE ve advisors doğrulaması yap; kaynak SHA/migration/Edge sürümü/sonucu kaydet. Bu, ajanın teslim kapanış adımıdır; otomatik CD workflow’u kurulduğu anlamına gelmez. Production yetkisi değildir. Testler yalnız ayrılmış sentetik verilerle yapılır; mevcut gerçek veriyi reset etme. `npm run test:clean` loopback kabulünde kalır; hosted smoke onun yerine geçmez. Full clean çalışırken izleme/yayın devamı durur; kullanıcı dönüşünde gerçek main kabulü sonrası bu adıma geçilir.

## P02 main eşitlemesi — 20 Ekim 2026

Kaynak `cc4878d09e45204dbc13ccfe1324b38b14548167`, PR28. Aynı main clean39461804543 completed/success;469 test. Güncellemeden önce22 migration, Edge1,0 organizasyon ve0 Auth kullanıcısı doğrulandı. Eksik23–40 migration’lar repository SQL gövdeleri değiştirilmeden sırayla uygulandı. MCP’nin verdiği kurulum timestamp’leri yalnız başarılı uygulama ve SQL gövdesi eşleşmesi sonrasında repository’nin özgün migration sürümlerine hizalandı.40/40 uzak SQL gövdesinin hash’i kaynakla eşleşti; reset yapılmadı.

Edge backend-v1 sürüm2 ACTIVE; verify_jwt=true. Gönderilen dependency-complete `index.ts` SHA256 `b4a8a5d1472ddb16c986f11f2183d9f528ef184e540fc1c662049dbeed5a0916`; deploy cevabı EZBR SHA256 `08545118be6513e52c94ae9d103f8c8035b22165f4071ce458282a5199c995b8` (farklı artefact türleri). Connector kaynak geri okuması UNAVAILABLE verdi; geri-indirilmiş bundle eşitliği iddia edilmez. Deploy cevabı ve gerçek uç smoke’u başarılıdır.

Salt okunur doğrulama:90 core tablo, RLS kapalı0;133 runtime operation; api_v1 içinde133 iş wrapper’ı + ayrı p01_jobs_claim helper’ı=134 fonksiyon. Anon/authenticated EXECUTE0; Data API yalnız api_v1, core/private kapalı. Yeni named API wrapper’ları yalnız service_role çağırır. P01 worker zamanlayıcısı ve dar DB işletim kimliği bu Edge deploy’uyla kurulmuş sayılmaz.

Uzak smoke: sentetik Auth fixture’ı SQL ile kuruldu, gerçek parola girişi Auth servisi üzerinden yapıldı; Edge account_get_v1 ve organizations_list_v1 başarılı. Geçersiz JWT401, doğru RPC imzasıyla doğrudan authenticated session_cancel_preview çağrısı403/42501; geçerli P02 DTO ile başka/olmayan tenant çağrısı NOT_FOUND. Auth logout sonrası eski JWT AUTH_REQUIRED. Bu smoke P02 başarıyla iş yazan bütün senaryoları veya469 testlik temiz CI’ı tekrar etmez. Fixture hesabı/oturumları/kullanıcısı temizlendi; son sayılar0 hesap,0 Auth kullanıcısı,0 organizasyon. Ortak kullanıcı/parola oluşturulmadı, dış e-posta gönderilmedi.

Advisors ERROR0. İki WARN platform `public.rls_auto_enable()` fonksiyonunun anon/authenticated EXECUTE izinleri; public exposed değildir. [Anon uyarısı](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [authenticated uyarısı](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable). Servis-only tasarıma ait107 RLS/no-policy INFO,30 indekssiz FK,284 kullanılmayan indeks ve1 PK’siz tablo INFO var; yük kabulü veya performans düzeltmesi tamamlandı denmez. Platform yardımcı fonksiyonuna veya Auth yönetim ayarlarına müdahale edilmedi.

Bağlantı: `https://gwyprhenabtpkbojephw.supabase.co/functions/v1/backend-v1/{operation}`. İstemci publishable key ve kullanıcı access tokenını kullanır; service-role/DB parolası frontend veya repository’ye yazılmaz. Testler sentetik veriyle ve açık cleanup ile yapılır; global trigger/function fixture’ları paylaşılan DB’de paralel çalıştırılmaz.

## Tarihsel ilk kurulum


Kullanıcının doğruladığı proje: `gwyprhenabtpkbojephw`, FtkSaaS, eu-central-1. Bu hedef geliştirme/test içindir; production yetkisi verilmemiştir.

Kurulum kaynağı: main `4d47d75e4a337378cfcc65f727c67abcac310303`, 21 sıralı ve SHA-256 ile dondurulmuş uygulama migration’ı; 22. migration `api_schema_exposure` yerel ve hosted API şema ayarını eşler. Edge kaynağı `supabase/functions/backend-v1/index.ts`; dependency-complete bundle, ek paket indirme gerektirmez.

Kurulum öncesi migration/Edge listesi boş, core/private/api_v1 şemaları yok ve Auth kullanıcı sayısı sıfır doğrulandı. Mevcut gerçek tenant/veri üzerine reset yapılmaz. `npm run test:clean` uzak projeye yönlendirilmez; bu komut yalnız loopback içindir.

Uygulanan kurulum sırası: migration’ları mevcut dosya sırasıyla uygula; yalnız `api_v1` Data API şemasını erişime aç; core/private kapalı kalır. Fonksiyonlar yalnız service_role tarafından çağrılır. Edge gelen tokenı Auth servisiyle doğrular ve DB canlı session/yetki kontrolünü sürdürür. JWT doğrulaması iki katmanda da korunur.

Salt okunur SQL kontrolleri `scripts/remote-backend-verify.sql` dosyasındadır.

22 migration kaydı kaynak sürümleriyle eşleşti. 90 core tabloda RLS, 65 API wrapper için yalnız service_role EXECUTE doğrulandı. Gerçek Auth girişi → Edge → RPC hesap/liste okuma; geçersiz JWT, doğrudan authenticated RPC reddi (403/42501) ve iptal edilmiş oturumun eski JWT ile reddi geçti. Geçici kullanıcı/hesap temizlendi; uzak smoke tam 181 testlik yerel/CI suite’in tekrarı değildir. Kanıt: `reports/remote-backend-verification.json`.

Security advisors: platformun `public.rls_auto_enable()` fonksiyonunun anon/authenticated EXECUTE izinleri ve kapalı sızdırılmış parola koruması WARN verir. `public`, authenticator için exposed şema değildir; core/private da dışarı açılmaz. RLS policy yokluğu servis rolü tasarımına ait INFO, kullanılmayan indeksler ve yedi indekssiz FK INFO’dur; yük kabulü yapılmadı. Parola koruması: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection .

Bağlantı: `https://gwyprhenabtpkbojephw.supabase.co/functions/v1/backend-v1/{operation}`. Frontend publishable key ve kullanıcının access tokenını kullanır. Service-role/DB parolası kaynak koduna veya frontend’e konmaz. Dış e-posta, frontend kabulü, yük/restore ayrı açık işlerdir.
