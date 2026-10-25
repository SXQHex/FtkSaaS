# PR45 bağımsız kapasite incelemesi — 25 Ekim 2026

İnceleme uygulamayı yapan ajandan ayrı `capacity_independent_review` ajanı tarafından yapıldı. İlk kaynak `7e04b46617c4732932823d69d2d6bf302f2da3ba`, taban `702063807b0a0d09f559f070ffde1b1ae3e7563b`. Bu bir insan GitHub onayı değildir. Kaynak incelemesi, runtime testi ve CI ayrı kanıtlardır.

## İlk inceleme bulguları

| Önem | Bulgu | Düzeltme ve regresyon |
|---|---|---|
| P1 | Yalnız capacity içeren session_change_preview/apply fiziksel oda ve kategorisiz aktif kayıt geçiş kontrollerini atlıyordu. | schedule_build_change kapasite dalı `_capacity_touch=true` üretir. Preview/apply oda üstü toplamı ve sınıflandırılmamış aktif kayıtta kategori açmayı reddeder; geçerli değişiklik kaynak kayıtlarını yeniden yazmaz. |
| P2 | Başarılı fakat teklifsiz worker işinin keşif anahtarı oda kapasitesini ve kategori doluluğunu içermiyordu; sonradan boşluk açılması yeniden keşfedilmeyebilirdi. | Keşif anahtarına atanmış oda kimlikleri/fiziksel kapasitesi ve erkek/kadın aktif kayıt+teklif doluluğu eklendi. Null oda kapasitesinin yapılandırılması ve aynı toplamda erkek kaydının kadın kaydıyla değişmesi ayrı regresyonlardır. |

İlk kaynak iki bulgu nedeniyle merge edilebilir bulunmadı. Daha önceki [aday full clean40159833415](https://github.com/SXQHex/FtkSaaS/actions/runs/40159833415) başarılıdır; incelemeden önce tetiklendiği ve bu kusurları kapsamadığı kaydedilir. Düzeltilmiş kaynağa kabul taşımaz.

## Düzeltme incelemesi

Aynı bağımsız ajan SQL ve üç yeni regresyonun diff'ini yeniden inceledi: iki bulgu kaynak düzeyinde giderildi, yeni somut bloklayıcı kusur bulunmadı. Fiziksel/kategori kontrolü `_touch` değerini değiştirmeden eklenir; kaynak/görev yazımları tetiklenmez. Worker toplam doluluk aynı kalsa da kategori değişimini, seans sürümü aynı kalsa da oda yapılandırmasını keşfeder. Önceki main migration59 değişmedi; henüz main/hosted'e uygulanmamış bu PR'nin taslak60 migration kaynağı eşitlendi. DTO/operasyon sayısı değişmedi:201 işlem/60 migration/90 core tablo.

SQL ve migration SHA256: `11554b9292cb11e96322ed9f4d5eb66a06a41820d65a3e0187eb10175b835bc6`.

Yayımlanan son SHA için bağımsız inceleme kaydı [PR45 Reviews](https://github.com/SXQHex/FtkSaaS/pull/45#pullrequestreview) bölümünde tutulur; raporun bulunduğu commit kendi SHA’sını içine yazmaz. Son aday full clean, main clean, merge ve hosted dağıtım bu belgeyle yapılmış sayılmaz.

Yerel yapısal doğrulama: `npm run generate` ve `npm run verify` başarılı;103 sözleşme/yönetişim +43 CI politika testi geçti.53 Markdown/294 yerel bağlantı ve `git diff --check` başarılı. Üretilmiş DTO/validator/envanter değişikliği çıkmadı.

İzole runtime için yerel dosyalarla eşleşen test SHA256'ları:

- `tests/program-session-lifecycle.test.mjs`: `0d3b41605d75effe42d5582808c48ac4981b354fec197c37b1a951a4fb269f9a`
- `tests/p01-waitlist-workers.test.mjs`: `81813d01cdc0c961846cca212b5c1b94880c3aa6e76ef0687734c7b00cd2cd6b`

İlk iki grubun tüm eski worker senaryolarını içeren koşu süre kapsamını daraltmak için durduruldu; tamamlanmadı ve kabul değildir. Son dar koşu tüm yeni kapasite grubunu, P01 temel teklif/kabul yolunu, iki yeni keşif regresyonunu ve kategori FIFO/kabul yolunu seçer. Eski ilgisiz worker alt testleri açık skip pattern ile dışarıda tutulur; bunlar başarılı çalıştırılmış sayılmaz.

## Gerçek Auth → Edge → RPC dar kabul

Temiz izole DB'ye60 migration uygulandı; gerçek native Auth/Data API/Edge gateway hazırlandı. Yukarıdaki SQL ve test dosyası hash'leri hem yerelde hem test ortamında eşleşti. İlgili kaynak `7e04b46617c4732932823d69d2d6bf302f2da3ba` üzerine bu raporda hash'leri verilen düzeltme dosyalarıdır. Runtime sonucu tam repository/full-clean kabulü değildir.

```sh
node --test --test-concurrency=2 \
  --test-name-pattern='Session capacity revision|P01-C waitlist' \
  --test-skip-pattern='reject, expiry|lease fencing|cancelled sessions|accepted offer survives|expired running lease|live center state|request expiry|late worker failure|bounded discovery|scheduled loop' \
  tests/program-session-lifecycle.test.mjs tests/p01-waitlist-workers.test.mjs
```

Normal süreç çıkışı0; seçilen13 test/13pass/0fail/0cancelled/0skipped; toplam258435.390309ms. P01 seçili grup185740.496215ms; kapasite grubu258134.039287ms. Üç yeni regresyonun tamamı geçti. Skip pattern ile kapsam dışı tutulan eski senaryolar bu13 teste dahil değildir; runner'ın0skipped sayısı bütün test dosyasının çalıştırıldığı anlamına gelmez.

Geçici Sandbox kanıt alındıktan sonra durduruldu; sentetik fixture kullanıldı. Paylaşılan hosted ortama veya frontend'e değişiklik yapılmadı. Son kaynak bağımsız incelemesi ve açık aday full clean sırası korunur; önceki40159833415 sonucu bu düzeltmelere taşınmaz.
