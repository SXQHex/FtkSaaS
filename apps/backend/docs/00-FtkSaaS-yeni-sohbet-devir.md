# Güncel kaynak ve kabul

30 Ekim 2026 kaynak kontrolü. Bu kayıt yalnız doğrulandığı kaynağı anlatır; sonraki çalışma başında canlı main ve aynı SHA’nın gerçek sonuçları yeniden okunur. Eski bir run yeni head’e taşınmaz. Açık iş [backlog](remaining-work.md), sıra [kuyruk](production-queue.md), ürün/iş akışı [kaynak indeksi](../../../docs/source-index.md) sahibindedir.

## Kaynak tabanı

Repo SXQHex/FtkSaaS; çalışma tabanı main `faca3dc2420e8928531a8ce93ad5300be2003da4`, tree `a895004a1509d2fbc25460f03a42f61f815293d6`. PR100 frontend hesap formu/telefon değişiklikleri dahil güncel main, PR94 dalına taşındı; frontend kaynakları aynen korunur. PR90 belge merkeziyetçiliği, PR89 öğrenci modülü, PR84 restore-guard araçları ve PR91 frontend bölüm planı da main’dedir. Frontend bölüm/aktif iş/kabul sahibinin [web yol haritası](../../web/docs/todo.md) olması korunur. Kaynak envanteri: 221 implemented operasyon, 83 migration. Operasyon varlığı bütün selector/provider/ekran kabulü değildir; detay envanterler üreticiden gelir.

| Aynı main SHA’sının koşusu | Bu kontrolde görülen sonuç |
|---|---|
| [Merge kanıtı 41037452649](https://github.com/SXQHex/FtkSaaS/actions/runs/41037452649) | completed/success |
| [Backend main kanıtı 41037452785](https://github.com/SXQHex/FtkSaaS/actions/runs/41037452785) | completed/success |
| [Development CD 41037500364](https://github.com/SXQHex/FtkSaaS/actions/runs/41037500364) | completed/success |

Bu taban kontrolünde yalnız run özetleri doğrulandı; job/receipt içeriği ve canlı Edge/DB metadata’sı yeniden okunmadı. Bu kayıt hosted sürüm/envanter veya bütün akışların tarayıcı kabulü iddiası değildir. Tabanın başarılı sonucu aşağıdaki worker politikası değişikliğinin kabulü yerine geçmez.

## Kabul edilmiş kapsamın sınırı

- Backend P01–P07, Starter kapıları, hesap/native Auth ve settings tüketicileri kaynakta vardır; gerçek consumer sınırları ortak WF/settings rehberlerindedir. Native Auth SMTP/Google/TOTP geçmiş kabulü uygulama davet/marketing/SMS teslimi değildir.
- PR80 süre ölçümünü advisory yaptı; gerçek core/dört API testleri ve exact-source kabul kapıları korunur. Bu konu tekrar açık optimizasyon blokajı değildir.
- PR83 report worker bounded backlog/retry/kesinti/rebind ve export expiry diliminin kaynak/development kabulü kayıtlıdır. Beş lane genel iş yükü, fiziksel privacy purge, legal hold, tam restore ve RPO/RTO kabulü bundan çıkmaz.
- PR84 JSON restore guard, imzalı sicil ve guarded callback araçlarını ekler. Hosted SQL yükleyiciye entegrasyon veya tamamlanmış DB/Auth/Storage purge sağlamaz.
- PR89 öğrenci arama/detay/kişi yazma/öğrencilik/davet işi takibini içerir. Frontend CI sonucu gerçek yetkili hesapla hosted bütün ekran/yazma/teslim kabulünün yerine geçmez. Ekran davranışının sahibi [web geliştirme rehberi](../../web/docs/development.md).

## Backend full clean süre çalışması

Kullanıcının yeni önceliği backend full clean süresidir. Son üç başarılı aday [40990953637](https://github.com/SXQHex/FtkSaaS/actions/runs/40990953637), [40975050984](https://github.com/SXQHex/FtkSaaS/actions/runs/40975050984) ve [40974542624](https://github.com/SXQHex/FtkSaaS/actions/runs/40974542624) toplam 29:19, 32:58 ve 33:36 sürmüştür. Son koşuda API job'larının backend hazırlığı 43–48 saniye, testleri 1183–1596 saniyedir; baskın maliyet API çağrılarıdır. On beş API giriş dosyasının import ağında 34 gerçek test dosyası bulunur; shard'lar arasında aynı test dosyası yeniden çalıştırılmaz. Ortak fixture/operasyon tekrarları ayrı test amaçları taşıyabilir ve bu değişiklikte kaldırılmaz.

Dar düzeltme yerel/CI Edge worker politikasını `oneshot` yerine `per_worker` yapar. Gerçek Auth→Edge→RPC yolu, assertion'lar, core+dört izole shard, concurrency=2 ve kaynak/run/attempt kanıtı korunur. Yeni tam kabul ve süre kazancı henüz doğrulanmış değildir. Yerel native paket indirmesi ağ sınırına takıldı; geçici uzak ortamda servisler açıldı fakat ölçüm işlem kotası nedeniyle tamamlanamadı ve ortam silindi. Son adayın bütün testleri ve gerçek job/phase süreleri aynı GitHub runner sınıfındaki yukarıdaki tabanla karşılaştırılmadan optimizasyon kapanmış sayılmaz. Ana kabul ölçütü kapsam korunarak daha kısa full clean'dir; ölçülmemiş hızlanma yüzdesi kullanılmaz.

PR94 eski head `efe50efbe4fd562b5d705e20d10f2719b2a87e17` için [41001187314](https://github.com/SXQHex/FtkSaaS/actions/runs/41001187314) core ve üç API shard'ında başarılıydı; API-4 testler sürerken kesildi. Kesilmeden önce başarısız assertion görülmedi; kesinti sonrası süreç hataları tam kabul değildir. Güncel main ile birleştirilmiş yeni kaynak için bütün core/dört API kabulü yeniden gereklidir. Kullanıcı PR94 ve PR99 için merge yetkisi verdi. Sıra: PR94 aday kabulü → merge/main/development kanıtı → PR99'u yeni main ile eşitleme ve aday kabulü → merge. PR99'un son kaynak koşusu `Merge parents mismatch` nedeniyle testlere başlamadan durdu; eski base ile rerun yapılmaz. CI ve kaynak güvenliği kapıları gevşetilmez.

## Alanlar arası koordinasyon

Backend sohbet devri bu dosyada; frontend sohbet devri [kendi uygulamasında](../../web/docs/handover.md) yürütülür. Somut talep, karşı tarafın değerlendirmesi/onayı ve teslim kabulü yalnız [ortak talep kaydında](../../../docs/requests.md) tutulur; kendi iş planı talep kimliğine bağlanır. Bu devir frontend planını veya ortak ürün sözleşmesini ilerleme kaydı olarak güncelleme yetkisi vermez.

## Yönetim kanıtı ve geçmiş

Son kayıtlı main ruleset `26040398`: active, strict-status, GitHub Actions required check ve bypass boş; PR71/72 başarısız/stale negatif kabulü kayıtlıdır. Bu revizyonda ayarlar yeniden okunmadı. Politikanın sahibi [CI politikası](../../../docs/ci-policy.md); kaynak kanıtı [sabit önceki yönetim kaydı](https://github.com/SXQHex/FtkSaaS/blob/fe650618503be24eb117297dc412c4ae6fd8018c/docs/ci-policy.md).

Önceki teslimlerin SHA/run/attempt ayrıntıları [sabit devir sürümünde](https://github.com/SXQHex/FtkSaaS/blob/fe650618503be24eb117297dc412c4ae6fd8018c/apps/backend/docs/00-FtkSaaS-yeni-sohbet-devir.md) korunur. Tarihsel belgeden bugünün iş listesi, izin veya kabulü türetilmez. Bu dosya kronoloji biriktirmez; sonraki doğal güncellemede mevcut snapshot değiştirilir.
