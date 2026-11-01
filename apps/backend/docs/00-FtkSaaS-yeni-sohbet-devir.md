# Güncel kaynak ve kabul

1 Kasım 2026 başlangıç kontrolü. Açık işler ve kapanış ölçütleri [backlog](remaining-work.md), sıra [kuyruk](production-queue.md), ürün/API davranışı [kaynak indeksi](../../../docs/source-index.md) sahibindedir. Burada karar veya görev metni tekrar edilmez.

## Kaynak tabanı

Güncel main `5b848e7716e847bbedffe31f60e9a21d0ec08379`: PR115 uygulama daveti kaynağı ve PR117 ortak teslim kayıtları birleşti. PR115 aday `41307840130`, main proof `41310466403`, development teslimi `41310495115`; PR117 main proof `41313592802` ve development teslimi `41313619012` başarılıdır. Kaynak CI dış posta veya frontend son kabulü değildir.

## Güncel adayın durumu

`fix/invitation-worker-signing`, XREQ-003 operasyonel kabulünde görülen worker imza reddini düzeltir. Native Auth, JWT doğrulaması, service-only RPC, oneshot, kaynak/kalite/bellek kapıları korunur. Bu dalın yeni aday kabulü henüz yoktur. Main'den devralınan tam-parmak-izi assertion istisnaları makine sicilindedir; SXQHex sahipliğinde ilk doğal bakımda kaldırılmalıdır (30 Kasım bitişi korunur).

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

## XREQ-003 operasyonel kabulü

Kullanıcının kurulum/gerçek posta kabulünü tamamlama talimatıyla development/test `gwyprhenabtpkbojephw` üzerinde yalnız yetkili davetin tenant'ı etkinleştirildi. Geçerli davet unexpired, özgün gönderen/merkez/F04-F06-F26 yetkileri geçerli ve mevcut hesap bağı yoktur. Eski davet revoked durumundadır; alıcı/token kaynak veya rapora alınmaz.

Domain'e kısıtlı sending-only Resend credential Vault'a kaydedildi; mevcut Auth SMTP ayarı değiştirilmedi. pg_net ve kabul edilmiş kaynak scriptiyle 30 saniyelik `ftksaas-invitations` Cron kuruldu; sahibi `ftk_ops_invitation`, rol üyeliği yoktur. Diğer beş lane korunur. Advisor farkı yoktur; mevcut private.ops_run search_path ve leaked-password protection uyarıları bu kurulumda değiştirilmedi.

İlk iki Cron isteği 403 FORBIDDEN döndü, tick tüketimi ve gönderim denemesi sıfır kaldı. Dispatch `enabled=false` yapıldı; işler/provider teslimi oluşmadı. PostgreSQL/Node HMAC eşitliği, imza uzunluğu ve saat penceresi doğrulandı. Panel legacy anahtarının rol/proje metadatası doğru; eski ciphertext bu anahtarla çözülemedi. Runtime/panel anahtar farkı olası açıklamadır, doğrudan karşılaştırılmadı. Kanıtlanan kusur, operasyonel HMAC’ın iki yüzeyde aynı service-role metni varsayımına bağlı olmasıdır. İmzanın geniş yetkili service-role metnine bağlanması kaldırılır; aynı scoped `FTK_INVITATION_TICK_SECRET` Edge ve Vault'a verilir. Setup aracı secret eşitlemesi bitmeden Cron'u açmaz; worker eksik/bozuk secret'ta kapalı kalır. Davet token şifrelemesi ve native Auth akışı değişmez.

Bağımsız worker imzası regresyonu eski kaynakta 403/200 farkıyla kırmızı, düzeltmede yeşildir. Dokuz Edge/provider/config testi geçer; tam backend verify 156 contract/governance/restore + 103 CI politika/gözlemci + 9 kalite testiyle başarılıdır. Ayrı quality kontrolü 0 bulgu ve 9 testle geçti. Gitleaks ve yeni aday kaynak kabulü ayrıca doğrulanır. Kaynak kabulünden sonra aynı scoped secret iki tarafta doğrulanarak dispatch açılacak; revoked işin gönderilmemesi, gerçek provider/alıcı teslimi ve yetkili job takibi tamamlanacaktır. Frontend ekran ve doğru/yanlış hesap davet kabulü karşı alanın son kabulüdür. Bu kaynak veya mevcut kurulum gerçek posta teslimi olarak kapatılmaz.
