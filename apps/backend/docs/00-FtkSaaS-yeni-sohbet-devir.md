# Güncel kaynak ve kabul

1 Kasım 2026 başlangıç kontrolü. Açık işler ve kapanış ölçütleri [backlog](remaining-work.md), sıra [kuyruk](production-queue.md), ürün/API davranışı [kaynak indeksi](../../../docs/source-index.md) sahibindedir. Burada karar veya görev metni tekrar edilmez.

## Kaynak tabanı

Güncel main `d5eac14b3791e77b0f752132ad7b765379fad4f0` (PR113/PR116 kalite ve CI düzenlemeleri). Aynı SHA'nın Main proof `41306220196` ve Development delivery `41306257850` sonuçları başarılıdır. Önceki kaynak başarısı yeni adayın kabulü değildir. PR113 için tek seferlik yönetici bypass'ı kaldırıldı; sonraki adaylara taşınmaz.

## Güncel adayın durumu

PR115 `fix/invitation-delivery-tracking`, XREQ-003 uygulama dilimidir; ayrıntılı kaynak/yerel/hosted kabul sınırı aşağıdadır. Main'den gelen kalite sözleşmesi, oneshot ve bütün API shard bellek kabulü korunur; bu dalda CI/kalite politikası farkı yoktur. PR116'nın frontend kaynak doğrulamalı tek-build aktarımı, daraltılmış backend kurulumları ve faz ölçümleri korunmuştur; bütçe sahibi [backend README](../README.md#ci-kaynak-bütçesi-ve-kurulum-ölçümü). Main'den devralınan tam-parmak-izi assertion istisnaları makine sicilindedir; SXQHex sahipliğinde ilk doğal bakımda kaldırılmalıdır (30 Kasım bitişi korunur).

## Mevcut kaynak ve gerçek kabul sınırları

| Alan | Kaynak/kanıt sınırı |
|---|---|
| Temel domain | Rezervasyon koruması, atomik hak/finans, yoklama, hakediş ve hesaplaşma kaynakları mevcut; eksik metadata bunları sıfırdan iş yapmaz. |
| F01–F33 | Makine envanterinde 218 operasyon ve 33 özellik var; feature_delivery kabul alanları pending_feature_acceptance. Kanıt uzlaştırılmadan tamamlanma yüzdesi çıkarılmaz. |
| Native Auth | PR99 native sadeleştirme kaynağı main’de. Auth SMTP/Google/TOTP kabulü uygulama davet/marketing/SMS teslimi değildir. Gerçek route/config/PKCE ve tüketici kabulü ayrı. |
| Davet/job | XREQ-003 hosted gözleminin tam kaydı ortak talepte; komut başarısı gönderim ve hesap bağı başarısı değildir. |
| Worker/export | PR83 bounded report backlog/retry/kesinti/rebind ve export expiry dilimi kayıtlıdır; genel beş lane, privacy purge ve tam restore bundan çıkarılamaz. |
| Restore | PR84 guard/sicil/callback araçları mevcut; gerçek hosted loader, fiziksel imha ve DB/Auth/Storage restore tamamlığı değildir. |
| Public/ICS | Backend kaynakları mevcut; gerçek widget/action/hostname ve gerçek takvim host’u/route kabulü ayrıca gerekir. |
| Bildirim | Mevcut support projeksiyonu in_app hazır, email/push ve timing/quiet-hours/digest unavailable gösterir. Son ürün kararları bu çalışma sırasında runtime’ı değiştirmedi. |
| Limit/CRM/Pratik | PlanLimit wire ile unlimited runtime ayrımı, telefon temelli genel alım ve kredi tüketmeyen katılım uygulama işleri backlog’da; ürün onayı runtime başarısı değildir. |
| CI kapanış teşhisi | Önceki timeout düzeltmesi ve başarılı rerun sinyali gönderen süreç/host kaynağının kanıtı değildir. Yeni olay olmadan kök neden ilan edilmez; mevcut başarılı kaynak kabulü keyfî geri açılmaz. |

## Alanlar arası koordinasyon

Frontend kaynak/ekran kabulünün sahibi [frontend devri](../../web/docs/handover.md) ve [frontend planıdır](../../web/docs/todo.md). Backend bunları değiştirmez veya karşı taraf adına kapatmaz. Somut teslim/ret/erteleme yalnız [ortak taleplerde](../../../docs/requests.md) kendi alanına yazılır. Sonraki doğal belge değişikliğinde doğrulanmış güncel snapshot değiştirilir; run linki için sonsuz commit veya ikinci durum tablosu kurulmaz.

## Yerel/CI Edge bellek düzeltmesi

[41296560661 tanı koşusu](https://github.com/SXQHex/FtkSaaS/actions/runs/41296560661), `7211b9d231db98e0d96d9b66f17bbe3c04aa0b21` kaynağında Supabase CLI 2.122.0 ile iki politikayı aynı bundle ve kilit kaynağı üzerinde karşılaştırdı. `per_worker`, ısınma sonrası 10 ölçülen yetkisiz istekte 2,07 GiB RSS’ye ulaşarak korumayla durdu. `oneshot`, 240 yetkisiz ve 236 oturumlu isteği beklenen yanıtlarla tamamladı; yaklaşık 1,1–1,2 GiB aralığında kaldı (tepe 1.259.852 KiB). 480 isteğin son dördü ve idle aşaması 600 saniye deney bütçesine sığmadı; deney tam başarılı sayılmaz.

Kullanıcının onayıyla yerel/CI `edge_runtime.policy` değeri `oneshot` seçildi. Bu, gözlenen bellek birikimini önleyen çalışma politikasıdır; sızıntının runtime içindeki kesin mekanizması veya hosted ortam için kanıt değildir. JWT/yetki kontrolleri, suite sayıları ve test assertion’ları değişmedi. PR113 full clean bu politika ile geçti; API-1 tepe RSS 1.249.664 KiB oldu. Yeni aday için yeni kaynak bağlı kabul gerekir. Tanı dalının workflow/araçları main’e taşınmadı.

## XREQ-003 uygulama dilimi

Kullanıcı “XREQ-003 çöz”, ardından güncel main’e uyarlayıp birleştirme talimatını verdi. Dal `fix/invitation-delivery-tracking`, PR115; ilk aday `3f865744cfe01de42ab32a2812085f109af79977` için full clean `41273809468`, frontend checks ve contract compatibility başarılıdır. Yeni main `d5eac14b3791e77b0f752132ad7b765379fad4f0` ile bütünleştirildi; aynı main için Main proof `41306220196` ve Development delivery `41306257850` başarılı doğrulandı. Yeni kalite sözleşmesi, oneshot politikası ve dört API shard bellek kabulü korunur. Eski aday başarısı güncel birleşimin kabulü değildir.

Kaynak incelemesi kopukluğu doğruladı: davet outbox/delivery kaydı üretirken job okuması yalnız p06 report/import kaydını arıyordu. Yeni append-only migration, özgün gönderen ve canlı tenant/merkez/yetkiyle davet job takibini ekler. Mevcut outbox RPC’sinin özel service-only handoff’u, kısa ömürlü HMAC tick/replay kaydı, native Cron kurulum aracı, Vault referansları, lease ve bounded provider retry hazırlanmıştır. Ayrıntı WF04/WF20 ve işletim sahibindedir; burada sözleşme kopyalanmaz.

Hosted salt okunur kontrolde iki pending uygulama daveti, mevcut beş worker Cron görevi, Vault/pgcrypto/pg_cron görüldü; pg_net kurulu değildi. Mevcut işler gönderilmedi, native Auth veya hosted veri değiştirilmedi. Kurulum öncesi gerçek alıcı yetkisi ve eski pending davetler incelenmelidir. Yerel native Supabase PostgreSQL yalnız UID0 eşlemesi yüzünden başlayamadı; hiçbir farklı UID map’i yok. Gerçek DB/Auth kabulü aday full clean’de gerekir. Edge/provider/config davranış testleri yerelde çalışır; gerçek dış sağlayıcı teslimi yerine geçmez. Son kaynak inceleme, CI ve hosted teslim gerçekleşmeden bu dal tamamlandı sayılmaz.

Başlangıç main’inde tam backend verify, F01/F26 plan_scope açıklamaları ürün belgesiyle uyuşmadığı için duruyordu. Yalnız iki metadata açıklaması mevcut normatif tabloya eşitlendi; plan/runtime limitleri veya doğrulayıcı değiştirilmedi. Bu kaynak tutarlılığı gerçek ürün/plan kabulü sayılmaz.

Son yerel doğrulama: `pnpm --filter @ftksaas/backend verify` başarılı; 154 contract/governance/restore (yeni 7 Edge/provider/config testi dahil) + 103 CI politika/gözlemci + 9 kalite guard testi geçti. `pnpm check:quality` ayrıca başarılıdır. Yeni kalite sözleşmesine uyarlamada davet retry ve mevcut takvim readiness catch blokları aynı güvenli sonucu açıkça atar; istisna eklenmedi. 86 migration manifesti ve kaynak eşitliği, generated docs/runtime/validator/bundle/tipler, audit ve TypeScript başarılı. Bağımsız son kaynak incelemesinde açık P1/P2 bulgu kalmadı; üç fixture önkoşulu ve config SQL escaping kusuru da düzeltildi. Native DB/cron ve gerçek dış alıcı kabulü bu yerel sonucun kapsamında değildir. Aday full clean başlayınca AGENTS devir kuralı uygulanır; gerçek hosted kurulum/teslimden önce kaynak kabulü gerekir.

PR115 güncel main uyarlamasında Gitleaks 8.30.1 iki yanlış pozitif bildirdi: yeniden eklenen eski migration SHA256 satırı ve config UPSERT sütun referansı. Manifestte yeni kayıt mevcut son satırın önüne alınır; bütün dosya/hash eşlemeleri korunur. Config aynı üç sütunu PostgreSQL row assignment ile günceller. Tarama kuralları/istisnaları değişmez. Tarayıcı commit geçmişini de okuduğu için dal tek main-tabanlı commit olarak yeniden oluşturulur; eski uç yerel yedek dalda korunur ve push beklenen eski SHA ile yapılır. Bu kaynak için scanner/verify ve aday CI kabulü ayrı doğrulanır.
