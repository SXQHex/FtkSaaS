# Güncel kaynak ve kabul

30 Ekim 2026 kaynak kontrolü. Bu kayıt yalnız doğrulandığı kaynağı anlatır; sonraki çalışma başında canlı main ve aynı SHA’nın gerçek sonuçları yeniden okunur. Eski bir run yeni head’e taşınmaz. Açık iş [backlog](remaining-work.md), sıra [kuyruk](production-queue.md), ürün/iş akışı [kaynak indeksi](../../../docs/source-index.md) sahibindedir.

## Kaynak tabanı

Repo SXQHex/FtkSaaS; main `5455ba824868e30adac131993608e81477a3b461`, tree `efa209fa71f627690e7e107c46f852a7b2e4a77d`. PR89 öğrenci modülü, PR84 restore-guard araçları ve PR91 frontend bölüm planı main’dedir. PR91 yalnız web belgelerini değiştirdi; frontend bölüm/aktif iş/kabul sahibinin [web yol haritası](../../web/docs/todo.md) olması korunur. Kaynak envanteri: 221 implemented operasyon, 83 migration. Operasyon varlığı bütün selector/provider/ekran kabulü değildir; detay envanterler üreticiden gelir.

| Aynı main SHA’sının koşusu | Bu kontrolde görülen sonuç |
|---|---|
| [Merge kanıtı 40984554734](https://github.com/SXQHex/FtkSaaS/actions/runs/40984554734) | completed/success |
| [Frontend 40984554770](https://github.com/SXQHex/FtkSaaS/actions/runs/40984554770) | completed/success |

Bu okumada yalnız run özetleri doğrulandı; job/receipt içeriği ve canlı Edge/DB metadata’sı yeniden okunmadı. Son okunmuş backend main/CD başarısı önceki `fe650618503be24eb117297dc412c4ae6fd8018c` kaynağına aittir ([main](https://github.com/SXQHex/FtkSaaS/actions/runs/40980147546), [development CD](https://github.com/SXQHex/FtkSaaS/actions/runs/40980186925)); PR91 bu runtime’ı değiştirmez fakat eski koşu yeni SHA’da çalışmış gibi gösterilmez. Bu kayıt hosted sürüm/envanter veya bütün akışların tarayıcı kabulü iddiası değildir.

## Kabul edilmiş kapsamın sınırı

- Backend P01–P07, Starter kapıları, hesap/native Auth ve settings tüketicileri kaynakta vardır; gerçek consumer sınırları ortak WF/settings rehberlerindedir. Native Auth SMTP/Google/TOTP geçmiş kabulü uygulama davet/marketing/SMS teslimi değildir.
- PR80 süre ölçümünü advisory yaptı; gerçek core/dört API testleri ve exact-source kabul kapıları korunur. Bu konu tekrar açık optimizasyon blokajı değildir.
- PR83 report worker bounded backlog/retry/kesinti/rebind ve export expiry diliminin kaynak/development kabulü kayıtlıdır. Beş lane genel iş yükü, fiziksel privacy purge, legal hold, tam restore ve RPO/RTO kabulü bundan çıkmaz.
- PR84 JSON restore guard, imzalı sicil ve guarded callback araçlarını ekler. Hosted SQL yükleyiciye entegrasyon veya tamamlanmış DB/Auth/Storage purge sağlamaz.
- PR89 öğrenci arama/detay/kişi yazma/öğrencilik/davet işi takibini içerir. Frontend CI sonucu gerçek yetkili hesapla hosted bütün ekran/yazma/teslim kabulünün yerine geçmez. Ekran davranışının sahibi [web geliştirme rehberi](../../web/docs/development.md).

## PR90

Draft [PR90](https://github.com/SXQHex/FtkSaaS/pull/90), belge merkeziyetçiliği ve kaynak bağlı dokümantasyon altyapısıdır. Bu yerel revizyonda PR91 dahil main tabanı güncellendi; eski alan devirleri birleştirildi, tek karar sahipleri tanımlandı. Son kullanıcı PR90’ın main ile birleştirilmesini istedi; önceki push/aday CI bekletme kararı bu teslim için kaldırıldı. Yerel revizyon yayımlanıp aynı head/base/merge kaynağının gerekli aday CI’si doğrulanır; başarı olmadan merge yapılmaz. Önceki PR90 head/test başarısı bu revizyonun kabulü değildir. Son kaynak bağımsız incelemesi tamamlandı; uzaktaki yeni kaynak kabulü ve ardından main/development doğrulaması ayrıca gerekir. Hosted metadata/DB tipi artifact kabulü DOCS-01 kapsamında ayrıca açık kalır.

## Alanlar arası koordinasyon

Backend sohbet devri bu dosyada; frontend sohbet devri [kendi uygulamasında](../../web/docs/handover.md) yürütülür. Somut talep, karşı tarafın değerlendirmesi/onayı ve teslim kabulü yalnız [ortak talep kaydında](../../../docs/requests.md) tutulur; kendi iş planı talep kimliğine bağlanır. Bu devir frontend planını veya ortak ürün sözleşmesini ilerleme kaydı olarak güncelleme yetkisi vermez.

## Yönetim kanıtı ve geçmiş

Son kayıtlı main ruleset `26040398`: active, strict-status, GitHub Actions required check ve bypass boş; PR71/72 başarısız/stale negatif kabulü kayıtlıdır. Bu revizyonda ayarlar yeniden okunmadı. Politikanın sahibi [CI politikası](../../../docs/ci-policy.md); kaynak kanıtı [sabit önceki yönetim kaydı](https://github.com/SXQHex/FtkSaaS/blob/fe650618503be24eb117297dc412c4ae6fd8018c/docs/ci-policy.md).

Önceki teslimlerin SHA/run/attempt ayrıntıları [sabit devir sürümünde](https://github.com/SXQHex/FtkSaaS/blob/fe650618503be24eb117297dc412c4ae6fd8018c/apps/backend/docs/00-FtkSaaS-yeni-sohbet-devir.md) korunur. Tarihsel belgeden bugünün iş listesi, izin veya kabulü türetilmez. Bu dosya kronoloji biriktirmez; sonraki doğal güncellemede mevcut snapshot değiştirilir.
