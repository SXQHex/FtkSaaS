# PR45 — PR46 main ile kaynak uzlaştırması

25 Ekim 2026. Taban main `3456050a3061d7bf5dc2ce8898b82c5cfe84e773`, önceki PR45 head `149be4f4d925674c97f04d40bb0c9a8416f2c66c`. Main206 API/60 migration; birleşik aday207 API/61 migration/90 core tablo/Edge8.

Kapasite ürün davranışı değiştirilmedi. `database/session-capacity.sql` SHA256 `11554b9292cb11e96322ed9f4d5eb66a06a41820d65a3e0187eb10175b835bc6` önceki PR45 ile aynıdır. Supabase CLI ile üretilen `20261025143856_session_capacity.sql`, henüz uygulanmamış eski taslak yerine ayar migration’ından sonra gelir. Main’deki60 migration dosyası ve hash’i aynen korunur. Ortak execute_operation yamaları sırasıyla ayar yetkisini ve kapasite kontrolünü koruyarak yüklenir.

Makine sözleşmesinde iki branch’in alan/operation/permission/selector/UUID metadata değişiklikleri birleştirildi; tip, validator, Edge ve kataloglar mevcut üreticilerle yeniden üretildi. Registry’deki yeni ayar suite kaydı ile kapasitenin yeni fixture DTO’su birlikte korunur. Full/main gate, shard kapsamı ve assertionlar gevşetilmedi. Frontend veya paylaşılan hosted ortam bu uzlaştırmada değiştirilmedi.

Yerel `npm run generate` ve `npm run verify` başarılı:103 sözleşme/yönetişim +43 CI politika testi.53 yaşayan Markdown/310 yerel bağlantı ve diff kontrolü geçti. İzole PGlite üzerinde61 migration zinciri yüklendi; legacy reminder snapshot, beş settings scope, canlı sürüm/replay, reset privacy/actor, sayfalama ve kapalı orgda kendi tercihini geri alma SQL kontrolleri geçti. Sentetik Auth tabloları native Auth/Edge kabulü değildir. Kapasitenin önceki13 native testi ve eski aday clean’i yalnız önceki kaynağın kanıtıdır; birleşik kaynağa taşınmaz.

Son birleşik kaynak için bağımsız inceleme ve açık aday full clean, merge sonrasında aynı main clean ve development CD ayrıca gereklidir. Production veya tüm69 ayar grubu tamamlandı denmez. [Güncel devir](../contracts/00-FtkSaaS-yeni-sohbet-devir.md), [kapasite kararı](decisions/DS-2026-10-25-session-capacity.md), [ayar teslim sınırı](frontend-settings-handover.md).
