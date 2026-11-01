# Güncel kaynak ve kabul

1 Kasım 2026 başlangıç kontrolü. Açık işler ve kapanış ölçütleri [backlog](remaining-work.md), sıra [kuyruk](production-queue.md), ürün/API davranışı [kaynak indeksi](../../../docs/source-index.md) sahibindedir. Burada karar veya görev metni tekrar edilmez.

## Kaynak tabanı

PR113 için 1 Kasım 2026’da GitHub’dan doğrulanan main tabanı `4776df7af5695a657d162aec771f4c1873d06f48`; aday bu tabanı içerir. Eski PR108/109 başarıları bu kaynağa veya yeni adaya taşınmaz. Bu SSoT düzeltmesinde main/CD’nin güncel başarılı olduğu iddia edilmiyor; tam kaynak ve receipt uzlaştırması A03’te yapılır. Main proof adayın kaynak/başarı kanıtıdır; CD başarısı bütün gerçek ekran/provider/restore kabulü değildir.

PR99 bu main’in atasıdır; yeni bir aday/merge işi olarak yeniden açılmaz. Kaynak teslimi ile XREQ-001/002 gerçek tüketici/hosted kabulü [ortak talepte](../../../docs/requests.md) ayrıdır. PR102 dönemindeki tek seferlik yönetici kurulum/bypass izni güncel dal veya sonraki PR’lara taşınmaz; o tarihte kaldırıldığı doğrulanmıştı, bugünkü ruleset readback’i bu belge güncellemesinde yapılmadı.

## Güncel adayın durumu

PR113 kalite/SSoT adayı main’den ayrıdır. `f27435a1a546abdc1e8a2d6ad966826eb5198f68` kaynağındaki [41272661320 koşusunda](https://github.com/SXQHex/FtkSaaS/actions/runs/41272661320) core ve quality geçti; önceki ürün/makine kapsam hatası giderildi. API-1/2/3 runner kapanışıyla kesildi; API-4 geçti. Tam aday kabulü yoktur.

Düzeltme, ürün sözleşmesindeki F01/F26 kapsamını makine izine ve kabul edilmiş plan limitlerini ayrı hedef metadata’sına aktarır. Governance hem özellik kapsamını hem limit tablosunu denetler; runtime SQL/kapı veya DTO desteği bu metadata’dan türetilmez. Tekrarlı plan özetleri ve ikinci sahiplik tablosu kaldırıldı. Pro/Business limit uygulaması, Abone No, dönem geçişi ve P08/hatırlatma hedeflerinin gerçek teknik aktarımı backlog’da açık kalır. Yerel backend verify içindeki 250 test, governance, üretilmiş çıktı kontrolleri ve 35 belge/1001 yerel bağlantı denetimi geçti; Turbo quality sıfır bulgu verdi. PR114 main değişikliği çatışmasız alındı; birleşim sonrası Turbo frontend/UI lint, typecheck ve test görevleri geçti. Bunlar yeni full clean/merge/hosted başarısı değildir.

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

## API-1 kapanış ölçümü — PR109 kaynak sınırı

PR108 API-1 ikinci denemenin runner arşivi worker'ın `UserCancelled` kapanış yoluna girdiğini gösterir; normal job cancellation mesajı veya OOM kanıtı yoktur. Bu enum manuel kullanıcı iptalini kanıtlamaz. Native hesap testi geçmiştir; kesilme daha sonraki renk yaşam döngüsü fixture'ında görülür. Kök neden ve sinyali gönderen süreç henüz belirlenmedi.

Yalnız API-1 için `scripts/ci/observe-api.mjs` gözlemcisi PR109 ile main’e alınmıştır: özel tracefs instance'ında SIGINT/SIGTERM/SIGKILL gönderici thread/comm ve hedef, süreç hâlâ varsa TGID; beş saniyede bir bellek/swap, cgroup memory sayaçları, en yüksek RSS süreçleri ve Docker kaynakları; ayrıca seçilmiş Docker container olayları. Argv/env/label veya iş verisi kaydedilmez. Kayıtlar anlık job loguna ve `.artifacts/ci/diagnostics/api-1-ATTEMPT.jsonl` dosyasına gider. Normal kapanışta timings artifact'ına eklenir; tanı `always()` upload başarısına dayanmaz. VM tamamen kaybolursa son kayıtlar da kaybolabilir; VM dışındaki sağlayıcı eylemi kanıtlanmaz. Trace erişilemezse/stream kapanırsa açık uyarı yazılır; test sonucu veya kabul koşulları değiştirilmez. Kaynağın birleşmesi bir kapanış olayının gerçek göndericisinin saptandığını göstermez. Gerçek kernel/Docker olay kanıtı bu belge çalışmasında incelenmedi; kök neden kabulü verilmez.

## Alanlar arası koordinasyon

Frontend kaynak/ekran kabulünün sahibi [frontend devri](../../web/docs/handover.md) ve [frontend planıdır](../../web/docs/todo.md). Backend bunları değiştirmez veya karşı taraf adına kapatmaz. Somut teslim/ret/erteleme yalnız [ortak taleplerde](../../../docs/requests.md) kendi alanına yazılır. Sonraki doğal belge değişikliğinde doğrulanmış güncel snapshot değiştirilir; run linki için sonsuz commit veya ikinci durum tablosu kurulmaz.

## Yerel/CI Edge bellek düzeltmesi

[41296560661 tanı koşusu](https://github.com/SXQHex/FtkSaaS/actions/runs/41296560661), `7211b9d231db98e0d96d9b66f17bbe3c04aa0b21` kaynağında Supabase CLI 2.122.0 ile iki politikayı aynı bundle ve kilit kaynağı üzerinde karşılaştırdı. `per_worker`, ısınma sonrası 10 ölçülen yetkisiz istekte 2,07 GiB RSS’ye ulaşarak korumayla durdu. `oneshot`, 240 yetkisiz ve 236 oturumlu isteği beklenen yanıtlarla tamamladı; yaklaşık 1,1–1,2 GiB aralığında kaldı (tepe 1.259.852 KiB). 480 isteğin son dördü ve idle aşaması 600 saniye deney bütçesine sığmadı; deney tam başarılı sayılmaz.

Kullanıcının onayıyla yerel/CI `edge_runtime.policy` değeri `oneshot` seçildi. Bu, gözlenen bellek birikimini önleyen çalışma politikasıdır; sızıntının runtime içindeki kesin mekanizması veya hosted ortam için kanıt değildir. JWT/yetki kontrolleri, suite sayıları ve test assertion’ları değişmedi. Yeni kaynakta core+dört API shard full clean sonucu gereklidir; tanı dalının workflow/araçları bu PR’ye taşınmadı.
