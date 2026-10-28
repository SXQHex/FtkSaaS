# Kaynak indeksi

Tek repo SXQHex/FtkSaaS; main güncel kaynak dalıdır. Başlangıç yönlendirmesi [AGENTS](../AGENTS.md) sahibindedir. Frontend UI/UX işi [uygulama planı](../apps/web/PLAN.md), kuralları ve README’siyle başlar; frontend günlük işleri genel görev listelerine kopyalanmaz. Backend/ortak entegrasyon işi [backend kabulü](contracts/00-FtkSaaS-yeni-sohbet-devir.md), [açık işler](remaining-work.md), [sıra](production-queue.md) ve ilgili alan belgesiyle ilerler.

## Tek kaynak tablosu

| Soru | Yetkili kaynak |
|---|---|
| Backend/ortak entegrasyonda hangi kaynak ve kabul geçerli? | [00 güncel kabul](contracts/00-FtkSaaS-yeni-sohbet-devir.md) |
| Backend/ortak entegrasyonda hangi iş açık? | [remaining-work](remaining-work.md) |
| Backend/ortak entegrasyon sırası ne? | [production-queue](production-queue.md) — backlog’u kopyalamaz |
| Ürün davranışı ne? | [01 ürün](contracts/01-FtkSaaS-urun-kapsam-sozlesmesi.md), kabul edilmiş decisions/ |
| Teknik kurallar ve69 ayar grubu? | [02 teknik](contracts/02-FtkSaaS-teknik-sozlesme.md) |
| Aktör/dosya/değişiklik yetkisi? | [AGENTS](../AGENTS.md), [03 sorumluluk](contracts/03-FtkSaaS-kodlama-sorumluluklari.md) |
| Tam DTO/hata/izin/sürüm? | [08 makine sözleşmesi](../packages/api-contracts/schema/contract.json); bundan üretilen packages/api-contracts |
| Uygulanan API ve fiziksel şema? | [Endpoint envanteri](endpoint-inventory.json), apps/backend/supabase/migrations/, apps/backend/database/;04/05 ve [özellik haritası](feature-delivery.md) üretilmiş görünümler |
| İstemci nasıl bağlanır? | [Entegrasyon devri](claude-handover.md), [ayar tüketicileri](frontend-settings-handover.md), [API değişmezleri](api-invariants.md) |
| Repo/ortam/dağıtım düzeni? | [Monorepo](monorepo.md), [hosted runbook](remote-backend-setup.md), [CI politikası](ci-policy.md) |
| Frontend planı, açık işleri, sırası ve kabulü ne? | [apps/web/PLAN.md](../apps/web/PLAN.md) |
| Frontend nasıl çalıştırılır ve doğrulanır? | [apps/web/README.md](../apps/web/README.md) |
| Hangi belge neden var? | [Belge haritası ve saklama kuralı](documentation-map.md) |

## Öncelik ve kanıt

Son açık kullanıcı kararı önceki çelişen hükmü değiştirir; alt katalog veya eski rapor üst kararı değiştirmez. Karar, teknik aktarım, runtime ve doğrulanmış kabul farklıdır. D01–D09/U01–U08/Q-D01/Q-E02/Q-E03 ve FD01–FD12 korunur. Kabul edilmiş69 davranış grubu bütün alanların uygulanmış olduğu anlamına gelmez.

Tarihsel docs/history/ ve ilk07/09/11 raporları kaynağına aittir. Eski pending notundan yeni görev veya yeni kabul türetilmez. Yerel test, bağımsız inceleme, CI ve hosted/provider kabulü birbirinin yerine geçmez. development-connection.json bağlantı/yerel kurulum tarifidir; güncel hosted kabulü veya secret kaynağı değildir.

## Güncelleme kuralı

Her bilgi yalnız tablodaki sahibinde güncellenir. Devir/run/envanter paragrafını diğer belgelere yapıştırma. Davranış/API değişince normatif kaynak + üretici + ilgili consumer devri + tek backlog/kabul kaydı birlikte güncellenir. Tarihsel rapora sonradan CI-ID eklenmez. Belge silme/birleştirmede yaşayan inbound/outgoing bağlantılar ve başlık anchor’ları kontrol edilir; eşsiz karar/kanıt kaybedilmez.
