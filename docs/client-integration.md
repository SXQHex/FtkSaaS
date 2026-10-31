# İstemci entegrasyon protokolü

Güncel kaynak/hosted kabulü [00 devirde](../apps/backend/docs/00-FtkSaaS-yeni-sohbet-devir.md); repo ve ortam düzeni [monorepo devrinde](monorepo.md). Bu belge projenin ortak istemci tüketim kurallarını taşır. Web istemcisi apps/web, ortak bileşenler packages/ui içindedir. Çalışma durumu ve sohbet devri uygulamanın geliştirme belgelerindedir.

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
