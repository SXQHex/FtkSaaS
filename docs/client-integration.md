# İstemci entegrasyon protokolü

Güncel kaynak/hosted kabulü [00 devirde](../apps/backend/docs/00-FtkSaaS-yeni-sohbet-devir.md); repo ve ortam düzeni [repo ve ortam rehberinde](monorepo.md). Bu belge projenin ortak istemci tüketim kurallarını taşır. Web istemcisi apps/web, ortak bileşenler packages/ui içindedir. Çalışma durumu ve sohbet devri uygulamanın geliştirme belgelerindedir.

## Gerçek sözleşme

[08 makine sözleşmesi](../packages/api-contracts/schema/contract.json) tek DTO/hata/izin kaynağıdır. [packages/api-contracts](../packages/api-contracts/package.json) bundan üretilir; uygulama `@ftksaas/api-contracts` ve `@ftksaas/api-contracts/client` kullanır. Elle paralel API tipi veya sahte endpoint yoktur. Yalnız yayımlanmış callable operasyonlar kullanılır; kesin alan/sürüm/selector için operations.ts ve08 okunur.

İnsan işlemleri `POST {API_URL}/functions/v1/backend-v1/{operation}` üzerinden typed Request JSON ile yapılır. Başlıklar `Authorization: Bearer <native Supabase access_token>`, `apikey: <publishable key>`, `Content-Type: application/json`. core/private tablo ve service-only RPC istemci yolu değildir. JWT doğrulaması açık kalır; native Auth ana yoldur.

Anonim kayıt ön kontrolü `account_signup_check_v1` için [kayıt transport sözleşmesini](settings.md#e-posta-parola-kayıt-tüketicisi) kullanır. Yalnız `account_exists / available` döner; ardından gerekiyorsa native SDK signup çağırır. Gateway public/anon anahtar taşır; Edge→RPC service anahtarı istemciye verilmez. Kontrol parola almaz, hesap oluşturmaz veya posta göndermez.

## İşlem bütünlüğü

- request_id ve gereken operation_key doğrulanmış UUIDv7; sağlayıcı kimlikleri aynen korunur. Aynı kullanıcı işleminin retry’ında operation_key korunur, transport request_id değişebilir.
- expected_version yalnız ilgili komutta ve gerçek management/read kaynağından alınır. account_get profil write-version kaynağı değildir. Append-only policy_publish’e rastgele sürüm alanı eklenmez.
- Başarı HTTP200 değil `ok/data` ve typed iş sonucudur. Hata kapalı error.code/retryable/trace_id sözleşmesiyle işlenir; hata metni parse edilmez.
- Timeout sonucu bilinmiyor demektir. Aynı key/status/replay kullanılır; yeni anahtarla kör tekrar yapılmaz. Stale preview/sürüm, yetki/plan, kapasite/hak/borç/politika reddi otomatik retry ile çözülmez. Retryable geçici hatada en çok üç otomatik deneme.
- null/optional/false/sıfır farklıdır; bilinmeyen alan reddedilir. Yetkisiz alanı istemcide türetmek veya sadece sütun gizlemek güvenlik sağlamaz.

## Kimlik, kapsam ve sonuç

Owner olmak CM operasyon yetkisi vermez. Canlı native session/MFA, hesap/kişi bağı, org/merkez/disiplin, rol/izin/plan kapılarını backend uygular. Frontend menüsü yetki kanıtı değildir. Doğrulanmamış iletişim, pending_email/phone ve canonical doğrulanmış iletişim ayrı gösterilir. Native provider sonuçları ve dönen güncel oturum kullanılır; özel sahte completion yoktur.

Para borcu, öğrenci alacağı, kullanılabilir/ayrılmış hak ayrı gösterilir. Program zamanı gerçekleşme/yoklama kapanışı değildir. Kesin rezervasyon koruması yeni yetki/kapasite bypass’ı değildir. Finans iptal/ödeme/mahsup etkisi istemcide hesaplanmaz; preview/apply/status ve gerçek sürüm kullanılır.

## Akış seçimi

İşlem sırası için [WF00–WF20](workflows.md), gerçek typed ayar/native hesap alanları için [ayar rehberi](settings.md), durum/hata açıklamaları için [06](contracts/06-FtkSaaS-O4-durum-hata-izin.md) okunur. Ürün davranışı teknik sözleşme, plan kapsamı ürün sözleşmesi sahibindedir.

## Wire ve okuma sınırları

- Ortak request başlığı: client_api_version=1, request_id UUID; domain işleminde org_id ve gerekiyorsa center_id. G hesap işleminde org zorunlu değildir; account_access_send org işlemi, access_accept hedef token/verified hesapla çözülür. Aktör hiçbir request rol/account beyanından alınmaz.
- W/A/E/B mutasyonda operation_key; existing mutable record’da expected_version; create/update birleşik çağrıda existing target için version şart, create’de yok. A request preview token+dependencies içerir, TTL15dk teknik config; değişmiş ilgili kayıt/onay veya expired preview ret. Key içeriği: operation_key/request_id harici business içerik (expected_version dahil) canonical hash; retry payload semantiği korunur, version değiştirerek aynı key farklı iş yapılamaz.
- API money bigint string, ara hesap decimal; yarım sıfırdan uzağa, dağıtım en büyük küsurat/kararlıID, kayıtlı tutar tersine çevirilir. Bilinmeyen alanlar ret. JSON nullable ile optional ayrıdır; key yoksa patch korur, izinli null temizler. Secret/password/token/signed URL loglanmaz.
- Page default50/max200, sorguya özgü sort allowlist + UUID tiebreak; cursor org/actor-scope/filtre/sort bağlı. Tüm filterli export tüm sayfaları kapsar. Canlı keyset liste snapshot garantisi değildir; rapor as_of zamanı bellidir.
- RPC domain yanıtı `{ok,data,trace_id}` veya `{ok:false,error}`. SQL domain hatası HTTP200 içinde ok:false olabilir; transport/Auth HTTP hataları ayrıdır, istemci hata metni parse etmez. Connection timeout iş başarısızlığı kanıtı değildir; aynı key ile status/retry.
- Okuma DTO’su08’de alan bazında tanımlıdır; role mask’te izin verilmeyen optional alan üretilmez. Required output alanına yetki yoksa ilgili DTO/query yetkisi verilmez. JSON type doğrulama, semantic guard/tenant/RLS kontrolünün yerine geçmez.

## Entegrasyon kabulü

Gerçek native giriş/oturum, rol/plan görünürlüğü, DTO/sürüm/preview/replay ve hata senaryoları ekran→Edge→DB ile doğrulanır. Tasarım fixture’ı veya MSW kabulü hosted kanıt değildir. Gerçek API hatasında sessiz demo/sahte başarı fallback’i yoktur. Secrets/admin anahtarı public değişkene veya istemci bundle’ına girmez. Native Auth, public Turnstile ve uygulama dış bildirimleri ayrı kabul edilir. Ortak/backend açık iş [proje backlog’unda](../apps/backend/docs/remaining-work.md), frontend bölüm ve kabul işi [web planında](../apps/web/docs/todo.md) tutulur.

## Statik SPA transportu

Statik Vite/React istemcisi için frontend Node/Next.js route'u gerekmez. Public HTTP girişi istemciden bağımsız backend hizmetidir; web ve Expo/native istemci aynı URL/DTO'yu kullanır, platform başına Worker kurulmaz. İş API'si Supabase Edge'de; kayıt/public imzalı girişin bağlantı IP'si Cloudflare Worker'da edinilir. Tarayıcı yalnız public Supabase key taşır; ingress/hash/Turnstile/service-role sırları backend'de kalır. Worker dış Cloudflare ingress'inde çalışır; başka Worker'dan alt istek kabul etmez. Aynı zone'daki Worker kodu da güvenilen deployment yüzeyidir. IP başlığı silen transform veya Pseudo IPv4 overwrite kullanılmaz. Supabase'e doğrudan yollanan imzasız signup isteği güvenilir giriş oluşturmaz.

İzinli uygulama origin'i `https://app.fethiyetango.com`dur. Worker ve Edge `FTK_BROWSER_ORIGINS` içinde virgülle ayrılmış tam origin listesi kullanır; wildcard, path, trailing slash ve `null` kabul edilmez. Geliştirme için yalnız açık loopback origin eklenebilir. Origin'li yanlış istek dispatch/Auth/RPC'den önce403 alır; origin'siz sunucu tüketicisinin kendi JWT/imza yetkisi korunur. OPTIONS, POST ve standart SDK başlıklarını (`authorization,apikey,content-type,x-client-info,x-retry-count,traceparent,tracestate,baggage`) kabul eder; tarayıcıya ingress imzası/IP header yetkisi verilmez. CORS credential cookie kullanılmaz; `Vary: Origin` vardır. Supabase'in yerel gateway'i preflight'ı kendi yanıtlayabilir; fonksiyon politikası, gateway davranışı ve hosted kabul ayrı doğrulanır.

Kayıt ön kontrolü `POST {VITE_PUBLIC_GATEWAY_URL}/api/auth/signup-check`, `Content-Type: application/json`, `credentials: omit` ve `{client_api_version:1,request_id:<UUIDv7>,email:<string>}` kullanır. Native JWT, IP, parola, CAPTCHA veya imza gönderilmez. Yanıt `{ok:true,data:{status:"account_exists"|"available"},trace_id}` veya SafeError'dır; `no-store`. Sonraki native signup ve hata kurtarması [kayıt tüketicisindedir](settings.md#e-posta-parola-kayıt-tüketicisi). Development Worker URL'si public env tablosundadır; ilgili Supabase Edge kaynağı ve hosted kabul durumu [backend devrinden](../apps/backend/docs/00-FtkSaaS-yeni-sohbet-devir.md#statik-spa) doğrulanır. URL'nin varlığı tek başına bütün yolların kullanılabilirlik kabulü değildir.

| Statik istemci isteği | Backend sözleşmesi |
|---|---|
| `POST {VITE_PUBLIC_GATEWAY_URL}/api/public/calendar` | `Request_public_calendar_get`: `client_api_version`, UUIDv7 `request_id`, `slug` (org UUID veya yayımlanmış mevcut slug), UTC `interval`, `page`; opsiyonel `center_id`, `include_disciplines`. Başarı `Success_public_calendar_get` ve tam public DTO; items/next_cursor/as_of yanında yayın izinli profiller. |
| `POST {VITE_PUBLIC_GATEWAY_URL}/api/public/application` | Tam `Request_public_application_submit`; ders için `publication_id,contact,bot_proof,client_request_key` + ortak sürüm/request_id; opsiyonel `center_id`. Yayın/form hedefi backend'de çözülür. Mevcut `form_id+intake/contact_intake` dalları aynı wire ile korunur; yeni form veya onay kuralı yaratılmaz. |
| `POST https://gwyprhenabtpkbojephw.supabase.co/functions/v1/backend-v1/{operation}` | Oturumlu typed istek, `apikey: <publishable key>`, `Authorization: Bearer <native access_token>`, JSON. MFA gerekiyorsa native AAL2 token. Success/FailureEnvelope; HTTP200 içindeki `ok:false` hata sayılır. |
| `GET/HEAD <calendar_link_create/rotate sonucundaki subscription_url>` | Native `personal-calendar/calendar/<token>.ics`; Auth/apikey istemez. Başarılı GET ICS byte'ları, HEAD aynı metadata/Content-Length ve boş body; revoked/yanlış bağlantı404, geçici backend503, private/no-store. URL loglanmaz. |

İlk iki public istek JSON Content-Type taşır; tarayıcı kendi Origin başlığını gönderir ve `credentials: omit` kullanır. Native istemcide Origin yoksa aynı anonim giriş çalışır; CORS bir kimlik/yetki kanıtı değildir. Origin varsa exact allowlist uygulanır (`null` reddedilir). İki istemci türünde de bağlantı IP'si platformdan alınır, caller IP/imza/JWT/cookie taşınmaz; CAPTCHA proof'u aynı provider/hostname/action kontrolünden geçer. Başarı submit için `{ok:true,data:{accepted:true},trace_id}`; SafeError kapalı hata kodlarıdır. Timeout'ta aynı `client_request_key` korunur; yeni transport `request_id` ve gerekiyorsa yeni widget proof kullanılabilir. Commit edilmiş aynı payload replay'i ikinci başvuru veya ikinci CAPTCHA tüketimi üretmez. Değişmiş iş payload'ı aynı key ile kabul edilmez. Public okuma ve yanıtlar no-store'dur. Eski Vercel route/adapter çağrıları bu yeni yollara geçmeden çalışmayı sürdürür.

Public Vite değişkenleri: `VITE_SUPABASE_URL=https://gwyprhenabtpkbojephw.supabase.co`, `VITE_SUPABASE_PUBLISHABLE_KEY` (aynı projenin etkin public publishable key'i), `VITE_PUBLIC_GATEWAY_URL=https://ftksaas-spa-ingress-dev.erkinkunbuk.workers.dev` (bağımsız development backend girişi), `VITE_APP_ORIGIN=https://app.fethiyetango.com`, `VITE_TURNSTILE_SITE_KEY` (bu hostname'e izinli public widget key'i). Backend `FTK_*` sırları Vite'a taşınmaz. Worker kendi `FTK_PUBLIC_ANON_KEY` legacy anon JWT'sini upstream için kullanır; kullanıcı JWT'si taklit edilmez. Siteverify yalnız Edge'de `FTK_TURNSTILE_SECRET` ile çalışır. Yeni Worker'ın backend imza binding'i Edge'deki ayrı `FTK_SPA_INGRESS_SECRET` ile eşleşir; eski Edge ingress anahtarı korunur. İki giriş aynı hash salt ve rate/tenant/replay motorunu kullanır. `FTK_PUBLIC_APPLICATION_HOSTNAMES` virgülle ayrılmış ek tam widget hostname'lerini tanımlar; eski `FTK_PUBLIC_APPLICATION_HOSTNAME`/legacy fallback korunur. Wildcard/URL/port listesi geçerli değildir. Siteverify hostname listedekilerden biri ve action tam `public_application` olmalıdır; widget sağlayıcı domain izni ayrıca hazırlanır.

### SPA Auth callback hazırlığı

SPA aynı native Supabase SDK ile `flowType: 'pkce'`, `persistSession:true`, `autoRefreshToken:true`, `detectSessionInUrl:false` kullanıp callback'te code'u bir kez `exchangeCodeForSession` ile tamamlayabilir. Tek callback sahibi seçilir; SDK otomatik code değişimiyle ikinci manual değişim birlikte çalıştırılmaz. PKCE verifier başlatan tarayıcıda saklanır; kayıp/başka cihaz/expired/kullanılmış code yeni akış gerektirir. Refresh token/PKCE verifier URL'ye, loga veya Worker'a gönderilmez. Frontend server cookie'si gerekmez.

SPA route sözleşmesi: `/auth/callback` Google ve e-posta doğrulama; `/auth/callback?next=/reset-password` kurtarma dönüşü; `/forgot-password` güvenlik postasından kurtarma girişi, `/reset-password` native kurtarma oturumunda parola güncelleme. Frontend coder bu TanStack route'larını uygulamalıdır; route adının burada hazırlanması çalışan ekran kabulü değildir. `next` yalnız aynı uygulamadaki allowlist path olabilir; mutlak/`//` dış dönüş kabul edilmez. Provider hata query/fragment'ı başarı sayılmaz. E-posta değişiminin ilk onayında session/code gelmemesi bilgilendirme durumudur; doğrulanmış işlem varsayılmaz. Callback sonrası `account_get_v1` ve gereken kendi hesap okumaları yenilenir.

Supabase Auth redirect allowlist'e iki tam app callback URL'si eklenir; mevcut tüketicilerin callback'leri silinmez. `signUp.options.emailRedirectTo`, Google `signInWithOAuth.options.redirectTo` ve `resetPasswordForEmail.redirectTo` bu URL'leri açık kullanır. Google Cloud OAuth authorized redirect URI **`https://gwyprhenabtpkbojephw.supabase.co/auth/v1/callback`** olarak kalır; SPA callback Google Console'a doğrudan provider callback yerine yazılmaz. Native SiteURL mevcut tüketicileri etkiler; `https://app.fethiyetango.com` hedefi yalnız ayrı mevcut-config incelemesi ve açık ortam uygulamasıyla değiştirilir. Mail template `RedirectTo`/ConfirmationURL davranışı, e-posta confirmation, secure email change, parola/recovery ve3600sn native kanıt süreleri korunur. Gerçek Google/posta/link kabulü config yazılmasıyla kazanılmaz.

### Frontend sunucu bağımlılığı denetimi

Mevcut web'deki signup/public takvim/public application Next route'larının karşılığı yukarıdaki Worker yollarıdır. `apps/web1` bu server modüllerini import etmez. Auth server callback/cookie helper'ları yerine native browser PKCE kullanılır. Mevcut `/api/settings-shape?scope=...` ise canlı backend değeri okumaz: `node apps/backend/scripts/build-spa-assets.mjs` makine sözleşmesinden `.artifacts/spa-client/settings-shapes/{user,member,center,organization}.json` üretir; coder bunları kendi statik build'ine alır ve statik import/fetch kullanır. Ayrı kural/izin listesi türetilmez; ayar değeri ve write yetkisi her zaman gerçek API'den gelir.

Personal-calendar zaten Supabase Edge'dedir; frontend proxy gerekmez. `FTK_CALENDAR_SESSION_URL_TEMPLATE` mevcut yetkili seans route'unu hedefler. Yeni SPA'da seans route'u ve org/session parametreleri uygulanıp login→canlı yetki denetimi doğrulanmadan hedef yeni uygulamaya çevrilmez. Invite fragment/native Auth, signed Storage upload ve Edge `report_file_get_v1?download=csv` mevcut doğrudan tarayıcı yollarını kullanır; rapor indirme POST/JWT şartını korur. Native worker/Cron/sağlayıcı webhook host'ları frontend server bağımlılığı değildir.
