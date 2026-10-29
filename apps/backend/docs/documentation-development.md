# Dokümantasyon geliştirme ve CD

Bu belge çalışma talimatıdır. Projenin kullanıcı iş akışları [ortak rehber](../../../docs/workflows.md), DTO/izin/hata/selector ayrıntıları [API sözleşmesi](../../../packages/api-contracts/schema/contract.json) sahibindedir. Frontend ortak rehberi ve ilgili alan devrini okur; bütün full clean testlerinden ürün kuralı çıkarması beklenmez.

Repo kökünden:

```sh
# Önce etkilenen rehberi, sözleşmeyi, SQL/Edge ve davranış testlerini oku.
pnpm --filter @ftksaas/backend docs:review WF05 "Satış değişikliğinde rehber ve etkileri gözden geçirildi"
pnpm --filter @ftksaas/backend docs:update
pnpm --filter @ftksaas/backend docs:check
pnpm --filter @ftksaas/backend docs:context
```

`docs:review WFxx gerekçe` yalnız belirtilen akışın sözleşme/bağımlı kaynak/test parmak izini kaydeder. Kaynak değiştiğinde `docs:update` bu incelemeyi otomatik onaylamaz. Yeni API, eksik/tekrarlı eşleme, eksik test/dosya/rehber bölümü ve worker'ın insan akışına atanması reddedilir. Kaynak yeni bir dosyaya taşındıysa manifestin açık kaynak bağı da güncellenir. Yeni eşlenmemiş uygulama/transport/script/şema/test kaynağı reddedilir. ICS/public adapter WF09, worker scriptleri WF20, ortak protokol/üretim kaynakları WF00 altında açıkça izlenir. Markdown anlatım değişikliği tek başına kaynak hash onayı gerektirmez; böylece saf belge düzeltmesi JSON/code değişikliğine zorlanmaz. `docs:context`, `.artifacts/docs/context.json` içinde kaynak yolları/hash'leri ve akış bazında dosya listesi hazırlar; ajana ağ üzerinden kod veya secret göndermez. Ajan yalnız etkilenen kaynakları okuyarak rehberi günceller. Hash onayı içerik incelemesinin yerine geçmez; CI anlatımın anlamını kanıtlayamaz.

Üç teknik görünüm deterministiktir:

| Dosya | Sorumluluk |
|---|---|
| `/docs/database.md` | Mevcut fiziksel şema sahibine giriş, sıralı migration ve içerik özeti; regex'ten nihai DDL çıkarımı değildir |
| `/docs/security.md` | Güvenlik protokolü ve RLS/grant kaynağına giriş; etkin policy iddiası değildir |
| `/docs/functions.md` | Her sözleşme API'sinin birincil WF/aktör sınıfı ve test kaynakları; DTO katalogları kopyalanmaz |

Standart Markdown, göreli bağlantılar ve sabit WF başlıkları kullanılır; Mintlify/Starlight'a özgü MDX bağımlılığı yoktur. Site yayınlama gerekirse gezinme/config katmanı ayrıca kurulur.

## Kabul ve CD sırası

1. Backend PR'si rehber/sözleşme/tip/envanter ve ilgili devri birlikte günceller. Genel `generate` ve `verify` dokümantasyon üretimini/kontrolünü içerir.
2. Saf incelenmiş Markdown PR'si mevcut docs-check yolunda bağlantı, WF kapsamı ve generated drift kontrolü alır; pnpm kurulumu/DB/API/full clean yoktur. JSON eşleme, script, workflow veya tip değişikliği backend kabulüne tabidir. Üreteçlerin kendisi belge muafiyetine alınmaz.
3. Gerekli aday full clean'in core job'ı aynı migration'larla kurulmuş mevcut izole DB'den read-only `pg_catalog` metadata baseline alır. Ek reset veya ikinci clean çalışmaz. Snapshot test edilen tam merge SHA'sını taşır ve attempt'e bağlı artifact'tır.
4. Başarılı kaynak bağlı main/development tesliminden sonra CD, mevcut gate ile kabul edilmiş adayın run/attempt/merge ilişkisini yeniden doğrular; yalnız o adayın baseline artifact'ını alır. Canlı uygulama şemasıyla yapısal karşılaştırma yapar. Fark varsa dokümantasyon adımı başarısız olur ve metadata kanıtı saklanır; canlı ortam geriye alınmaz veya kendiliğinden yeni sözleşme yapılmaz.
5. Sabit workspace Supabase CLI zaten frozen install ile kurulur; ikinci/latest kurulum yoktur. `gen types --lang typescript --project-id ... --schema core,private,api_v1` backend DB tiplerini artifact'a üretir. Bunlar frontend DTO tipi değildir; `packages/api-contracts` sahipliği değişmez.
6. `backend-documentation-RUN-ATTEMPT` artifact'ı kaynak SHA, kabul/run/attempt, teknik referanslar, metadata, DB tipleri ve bağlam manifestini taşır. `development-delivery` receipt'i domain/CD sonucunun sahibidir. Dokümantasyon başarısızlığı dağıtım rollback'i değildir; iki sonuç ayrı okunur.

Snapshot kapsamı yalnız uygulamanın `core`, `private`, `api_v1` şemalarıdır: relation/sütun tipleri/nullability/identity/default hash, enum/domain, constraint/index ve trigger hash, RLS/policy, fonksiyon imzası/security/config/definition hash ve ACL. İş verisi, Auth kullanıcıları, Storage nesneleri, sırlar ve fonksiyon gövdeleri toplanmaz. Fonksiyon gövdesi yalnız hash ile karşılaştırılır. Ortama özel worker LOGIN/ACL farklı olabildiği için grantlar metadata olarak saklanır; yapısal eşitlik hash'ine katılmaz. Provider public/auth/storage şemaları, tüm rol üyelikleri, column-level ACL/default privilege ve provider config/secret eşitliği bu kontrolün iddiası değildir. Canlı migration geçmişi ve kritik RLS/RPC yetkileri mevcut CD tarafından ayrıca denetlenir.

CD main'e veya ayrı dala otomatik commit atmaz. Üretilmiş referans eskimesi PR'de zaten reddedildiğinden post-CD kaynak güncelleme PR'si gerekmez; dağıtım durumu kaynak dosyası değil artifact'tır. Şema drift'i yeni bir belge PR'siyle gizlenmez, gerçek uygulama/ortam uyumsuzluğu olarak çözülür. Ajan sonraki doğal PR'de yalnız doğrulanmış kanıta dayanarak güncel devri eşitler. Böylece otomatik commit/clean döngüsü ve yeni bot token/PR yetkisi gerekmez.
