# İstemci entegrasyon protokolü

Güncel kaynak/hosted kabulü [00 devirde](../apps/backend/docs/00-FtkSaaS-yeni-sohbet-devir.md); repo ve ortam düzeni [monorepo devrinde](monorepo.md). Bu belge projenin ortak istemci tüketim kurallarını taşır. Web istemcisi apps/web, ortak bileşenler packages/ui içindedir. Çalışma durumu ve sohbet devri uygulamanın geliştirme belgelerindedir.

## Gerçek sözleşme

[08 makine sözleşmesi](../packages/api-contracts/schema/contract.json) tek DTO/hata/izin kaynağıdır. [packages/api-contracts](../packages/api-contracts/package.json) bundan üretilir; uygulama `@ftksaas/api-contracts` ve `@ftksaas/api-contracts/client` kullanır. Elle paralel API tipi veya sahte endpoint yoktur. Yalnız yayımlanmış callable operasyonlar kullanılır; kesin alan/sürüm/selector için operations.ts ve08 okunur.

İnsan işlemleri `POST {API_URL}/functions/v1/backend-v1/{operation}` üzerinden typed Request JSON ile yapılır. Başlıklar `Authorization: Bearer <native Supabase access_token>`, `apikey: <publishable key>`, `Content-Type: application/json`. core/private tablo ve service-only RPC istemci yolu değildir. JWT doğrulaması açık kalır; native Auth ana yoldur.

## İşlem bütünlüğü

- request_id ve gereken operation_key doğrulanmış UUIDv7; sağlayıcı kimlikleri aynen korunur. Aynı kullanıcı işleminin retry’ında operation_key korunur, transport request_id değişebilir.
- expected_version yalnız ilgili komutta ve gerçek management/read kaynağından alınır. account_get profil write-version kaynağı değildir. Append-only policy_publish’e rastgele sürüm alanı eklenmez.
- Başarı HTTP200 değil `ok/data` ve typed iş sonucudur. Hata kapalı error.code/retryable/trace_id sözleşmesiyle işlenir; hata metni parse edilmez.
- Timeout sonucu bilinmiyor demektir. Aynı key/status/replay kullanılır; yeni anahtarla kör tekrar yapılmaz. Stale preview/sürüm, yetki/plan, kapasite/hak/borç/politika reddi otomatik retry ile çözülmez. Retryable geçici hatada en çok üç otomatik deneme.
- null/optional/false/sıfır farklıdır; bilinmeyen alan reddedilir. Yetkisiz alanı istemcide türetmek veya sadece sütun gizlemek güvenlik sağlamaz.

## Kimlik, kapsam ve sonuç

Owner olmak CM operasyon yetkisi vermez. Canlı native session/MFA, hesap/kişi bağı, org/merkez/disiplin, rol/izin/plan kapılarını backend uygular. Frontend menüsü yetki kanıtı değildir. Doğrulanmamış iletişim, pending_email/phone ve canonical doğrulanmış iletişim ayrı gösterilir. Native provider sonuçları ve dönen güncel oturum kullanılır; özel sahte completion yoktur.

Para borcu, öğrenci alacağı, kullanılabilir/ayrılmış hak ayrı gösterilir. Program zamanı gerçekleşme/yoklama kapanışı değildir. Kesin rezervasyon koruması yeni yetki/kapasite bypass’ı değildir. Finans iptal/ödeme/mahsup etkisi istemcide hesaplanmaz; preview/apply/status ve gerçek sürüm kullanılır.

## Alan devirleri

| Alan | Tüketim kaynağı |
|---|---|
| Ayarlar/hesap/kimlik | [Ayar alanları ve gerçek destek](../apps/backend/docs/frontend-settings-handover.md);69 kabul grubunun tamamı uygulanmış değildir |
| Program/takvim | [Program](../apps/backend/docs/program-session-handover.md), [okumalar](../apps/backend/docs/schedule-read-handover.md), [kapasite kararı](decisions/DS-2026-10-25-session-capacity.md) |
| Starter/public | [Starter](../apps/backend/docs/starter-plan-gates-handover.md), [public transport](../apps/backend/docs/p04-handover.md) |
| Finans/etkinlik | [P03](../apps/backend/docs/p03-handover.md), [Q-E01](decisions/Q-E01-accepted.md), [Q-E02](decisions/Q-E02.md), [Q-E03](decisions/Q-E03.md), [fiilî başlangıç](../apps/backend/docs/actual-start-handover.md), [hesaplaşma](../apps/backend/docs/settlement-handover.md) |
| Hakediş | [Anlaşma ve hakediş](../apps/backend/docs/instructor-earnings-handover.md), [Starter koruma](../apps/backend/docs/starter-attendance-protection-handover.md) |
| Belge/bildirim/rapor/import | [P05](../apps/backend/docs/p05-handover.md), [P06](../apps/backend/docs/p06-handover.md) |

## Entegrasyon kabulü

saaspt’deki görünüm ve test verisi sentetiktir. Gerçek native giriş/oturum, rol-plan görünürlüğü, DTO/sürüm/preview/replay ve hata senaryoları ekran→Edge→DB ile doğrulanmadan canlı bağlı denmez. Gerçek API hatasında sessiz demo/sahte başarı fallback’i yoktur. Secrets/admin anahtarı public değişkene veya istemci bundle’ına girmez. Native Auth provider kabulü, public Turnstile ve org dış bildirimleri farklıdır. Açık iş bu dosyada çoğaltılmaz; [tek backlog](remaining-work.md) kullanılır.
