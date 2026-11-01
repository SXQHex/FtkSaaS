# Güncel kaynak ve kabul

1 Kasım 2026 başlangıç kontrolü. Açık işler ve kapanış ölçütleri [backlog](remaining-work.md), sıra [kuyruk](production-queue.md), ürün/API davranışı [kaynak indeksi](../../../docs/source-index.md) sahibindedir. Burada karar veya görev metni tekrar edilmez.

## Kaynak tabanı

Güncel taban main `7cd5aa68d5031cd740ce1469fc2bcd74f8d65e35` (PR124). Aynı SHA’nın [main proof](https://github.com/SXQHex/FtkSaaS/actions/runs/41346290299), [merge proof](https://github.com/SXQHex/FtkSaaS/actions/runs/41346290405) ve [development teslimi](https://github.com/SXQHex/FtkSaaS/actions/runs/41346327690) başarılı doğrulandı. Bu başarı yeni adayın kabulü değildir.

## Güncel adayın durumu

PR125 `feat/backend-person-access-merge-reads`, kullanıcının son Starter kapsamı ve “PR push” talimatıyla yalnız XREQ-005’e daraltıldı; güncel main birleştirildi. XREQ-006’nın onay kutusu/durum okuması, bunların selector/projection alanları ve yeni kabul senaryoları adaydan çıkarıldı; mevcut merge komutları ve negatifleri korunur. Frontend dosyaları yalnız main’den devralınır, bu görevde değiştirilmez. Birleştirilmiş kişinin eski davetini keşfetme regresyonu XREQ-005 kapsamında kalır. Eklenen migration henüz main’e alınmadığından aynı aday dosyası daraltıldı; uygulanmış migration değiştirilmedi.

Yerelde Docker yok; gerçek Auth/Edge/DB kabulü yeni aday full clean ile doğrulanacak. Daraltılmış kaynakta yerel backend verify geçti: 21 statik denetim, 157 contract/governance/restore, 103 CI politika/gözlemci ve 9 kalite testi. Ayrı check:quality sıfır bulgu; son bağımsız kaynak incelemesinde engelleyici bulgu yok. Önceki geniş adayın gerçek DB/API sonucu bu kaynağa taşınmaz. Kalite job’ında testler geçti; Gitleaks mevcut native Auth migration checksum’unun yalnız eklenen virgül yüzünden diff’e giren satırını generic-api-key olarak işaretledi. Manifest değerleri korunarak yeni kayıt eski son kaydın önüne alındı; eski aday geçmişindeki aynı yanlış eşleşmenin taranmaması için PR adayı main tabanlı tek commit olarak yeniden hazırlandı. Gitleaks kuralı/allowlist/istisna değiştirilmedi. CI/development/karşı alan kabulü tamamlanmadan XREQ-005 kapalı sayılmaz. Main’den devralınan tam-parmak-izi assertion istisnaları makine sicilindedir; ilk doğal bakımda kaldırılma ve 30 Kasım bitişi korunur.

## Mevcut kaynak ve gerçek kabul sınırları

| Alan | Kaynak/kanıt sınırı |
|---|---|
| Temel domain | Rezervasyon koruması, atomik hak/finans, yoklama, hakediş ve hesaplaşma kaynakları mevcut; eksik metadata bunları sıfırdan iş yapmaz. |
| F01–F33 | Makine envanterinde 218 operasyon ve 33 özellik var; feature_delivery kabul alanları pending_feature_acceptance. Kanıt uzlaştırılmadan tamamlanma yüzdesi çıkarılmaz. |
| Native Auth | PR99 native sadeleştirme kaynağı main’de. Auth SMTP/Google/TOTP kabulü uygulama davet/marketing/SMS teslimi değildir. Gerçek route/config/PKCE ve tüketici kabulü ayrı. |
| Davet/job | XREQ-003 backend kurulum, gerçek dış teslim ve iş takibi kabulü tamamlandı; aşağıdaki hosted kanıt ve ortak talep kaydı esas alınır. Posta teslimi hesap bağı veya frontend ekran kabulü değildir. |
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

## XREQ-003 operasyonel kabulü

1 Kasım 2026 development/test `gwyprhenabtpkbojephw` üzerinde kullanıcının yetkilendirdiği gerçek davet teslim edildi. Talep/kapanış sahibi [XREQ-003](../../../docs/requests.md#xreq-003-gerçek-davet-teslimi-ve-iş-takibi); bu kayıt backend test/ortam kanıtıdır, frontend adına onay değildir.

- Tek yetkili tenant'ın sender/Vault yapılandırması etkin; domain'e kısıtlı sending-only Resend credential kullanılır. Mevcut Auth SMTP ve insan kimlik akışı değişmedi.
- Native pg_net ve 30 saniyelik `ftksaas-invitations` Cron etkin; sahibi `ftk_ops_invitation`, rol üyeliği yoktur. Önceki beş lane etkin kalır. Scoped Edge/Vault secret SHA256 parmak izleri eşleşti; secret/değer, gerçek adres ve davet token'ı bu kayda alınmadı.
- İlk 403 sonrası dispatch durmuştu; PR118 kabul/development tesliminden sonra eşleştirme yapılıp yeniden açıldı. Gerçek imzalı tick HTTP200 döndü. Revoked eski iş `cancelled`, attempts=0, provider reference yok; geçerli iş `succeeded`, attempts=1, provider reference var ve lease temizdir. Sonraki tickler claimed=0 döner; iş yeniden gönderilmedi.
- Resend aynı provider reference için `delivered` bildirdi: 1 Kasım 19:49 Türkiye saati. Gönderici/alıcının yetkili test girdisiyle eşleşmesi ve yalnız `/invite#token=…` fragment hedefi doğrulandı. Kullanıcının Gmail görüntüsü gerçek alıcı kutusu kabulünü sağladı; otomatik incelemenin engellediği posta kutusu erişimine devam edilmedi.
- Hosted DB'de özgün gönderenin kapsamıyla gerçek iş takibi `succeeded`, progress=1/total=1, safe_error=null ve invitation referansı döndürdü. Yanlış hesap/tenant/merkez üç negatif kontrolünde NOT_FOUND doğrulandı. Bunlar yönetim bağlantısıyla iç projeksiyon/scope kontrolleridir; frontend HTTP/native oturum testi diye raporlanmaz. Son aday CI gerçek native Auth/RPC kabulünü içerir.

PR118 kaynak doğrulaması: önce kırmızı sonra yeşil bağımsız worker imzası regresyonu; dokuz Edge/provider/config testi, toplam 156 contract/governance/restore + 103 CI politika/gözlemci + 9 kalite testi; ayrı kalite ve Gitleaks sıfır bulgu. İlk kurulum/rotasyon UPSERT'i dispatch'i kapatır; Edge secret eşitlemesi başarısızsa Cron açılmaz. Bu kaynak ve gerçek teslimden genel provider/restore/marketing veya bütün frontend kabulü çıkarılmaz. Kullanıcının login görüntüsü üzerine salt okunur frontend incelemesi, giriş dönüşünde davet fragmentinin taşınmadığını gösterdi; [XREQ-004](../../../docs/requests.md#xreq-004-giriş-boyunca-davet-fragmentini-koruma) kendi talep alanımıza kaydedildi. Frontend kodu/devir/todo değiştirilmedi. Gerçek frontend davet kabulü, yanlış hesap/expired/revoked/link çakışması S01 sahibinde kalır; başka alana işaret konmadı.
