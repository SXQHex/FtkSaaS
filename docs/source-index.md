# Kaynak indeksi

Tek repo SXQHex/FtkSaaS; main güncel kaynak dalıdır. Önce [AGENTS](../AGENTS.md), sonra [güncel kabul](contracts/00-FtkSaaS-yeni-sohbet-devir.md), [açık işler](remaining-work.md), [aktif sıra](production-queue.md) okunur. Görevle ilgili alan belgesi bunun ardından seçilir.

## Tek kaynak tablosu

| Soru | Yetkili kaynak |
|---|---|
| Ne kabul edildi, hangi SHA/CI/CD/hosted sürümü? | [00 güncel kabul](contracts/00-FtkSaaS-yeni-sohbet-devir.md) |
| Hangi iş açık? | [remaining-work](remaining-work.md); WEB-01 uygulama ayrıntıları [frontend todo](../apps/web/todo.md) |
| Şimdi hangi sırada çalışıyoruz? | [production-queue](production-queue.md) — backlog’u kopyalamaz |
| Ürün davranışı ne? | [01 ürün](contracts/01-FtkSaaS-urun-kapsam-sozlesmesi.md), kabul edilmiş decisions/ |
| Teknik kurallar ve69 ayar grubu? | [02 teknik](contracts/02-FtkSaaS-teknik-sozlesme.md) |
| Aktör/dosya/değişiklik yetkisi? | [AGENTS](../AGENTS.md), [03 sorumluluk](contracts/03-FtkSaaS-kodlama-sorumluluklari.md) |
| Tam DTO/hata/izin/sürüm? | [08 makine sözleşmesi](../packages/api-contracts/schema/contract.json); bundan üretilen packages/api-contracts |
| Uygulanan API ve fiziksel şema? | [Endpoint envanteri](endpoint-inventory.json), apps/backend/supabase/migrations/, apps/backend/database/;04/05 ve [özellik haritası](feature-delivery.md) üretilmiş görünümler |
| İstemci nasıl bağlanır? | [Entegrasyon devri](claude-handover.md), [ayar tüketicileri](frontend-settings-handover.md), [API değişmezleri](api-invariants.md) |
| Repo/ortam/dağıtım düzeni? | [Monorepo](monorepo.md), [hosted runbook](remote-backend-setup.md), [CI politikası](ci-policy.md) |
| Frontend ne durumda? | [Frontend geliştirme](../apps/web/README.md), [göç/ortam sınırları](monorepo.md) |
| Hangi belge neden var? | [Belge haritası ve saklama kuralı](documentation-map.md) |

## Öncelik ve kanıt

Son açık kullanıcı kararı önceki çelişen hükmü değiştirir; alt katalog veya eski rapor üst kararı değiştirmez. Karar, teknik aktarım, runtime ve doğrulanmış kabul farklıdır. D01–D09/U01–U08/Q-D01/Q-E02/Q-E03 ve FD01–FD12 korunur. Kabul edilmiş69 davranış grubu bütün alanların uygulanmış olduğu anlamına gelmez.

Tarihsel docs/history/ ve ilk07/09/11 raporları kaynağına aittir. Eski pending notundan yeni görev veya yeni kabul türetilmez. Yerel test, bağımsız inceleme, CI ve hosted/provider kabulü birbirinin yerine geçmez. development-connection.json bağlantı/yerel kurulum tarifidir; güncel hosted kabulü veya secret kaynağı değildir.

## Güncelleme kuralı

Her bilgi yalnız tablodaki sahibinde güncellenir. Devir/run/envanter paragrafını diğer belgelere yapıştırma. Davranış/API değişince normatif kaynak + üretici + ilgili consumer devri + tek backlog/kabul kaydı birlikte güncellenir. Tarihsel rapora sonradan CI-ID eklenmez. Belge silme/birleştirmede yaşayan inbound/outgoing bağlantılar ve başlık anchor’ları kontrol edilir; eşsiz karar/kanıt kaybedilmez.
