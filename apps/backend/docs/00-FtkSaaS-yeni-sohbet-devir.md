# Güncel kaynak ve kabul

1 Kasım 2026 başlangıç kontrolü. Açık işler ve kapanış ölçütleri [backlog](remaining-work.md), sıra [kuyruk](production-queue.md), ürün/API davranışı [kaynak indeksi](../../../docs/source-index.md) sahibindedir. Burada karar veya görev metni tekrar edilmez.

## Kaynak tabanı

Başlangıçta incelenen main `3855b74a6d207da1b1d1fa653053909a8e3224a8` idi; PR108 için aynı SHA’nın [Main proof](https://github.com/SXQHex/FtkSaaS/actions/runs/41264430757) ve [Development delivery](https://github.com/SXQHex/FtkSaaS/actions/runs/41264465868) sonuçları başarılıdır.

Bu dal hazırlanırken PR109 birleşti; bütünleştirilen güncel main `d144addf72947b823eea53cf8008dabb4084c47d`. Aynı SHA’nın [Main proof](https://github.com/SXQHex/FtkSaaS/actions/runs/41267135661) ve [Merge proof](https://github.com/SXQHex/FtkSaaS/actions/runs/41267135650) sonuçları başarılıdır. [Development delivery](https://github.com/SXQHex/FtkSaaS/actions/runs/41267158282) son okumada devam ediyordu; tamamlandı sayılmaz. PR108’in eski başarısı yeni kaynağın teslim kanıtı yerine geçmez. Main proof ağır test tekrarı değil aday kaynak/başarı kanıtıdır; CD başarısı bütün gerçek ekran/provider/restore kabulü değildir. Ayrıntılı metadata/receipt değerlendirmesi A03’te yapılır.

PR99 bu main’in atasıdır; yeni bir aday/merge işi olarak yeniden açılmaz. Kaynak teslimi ile XREQ-001/002 gerçek tüketici/hosted kabulü [ortak talepte](../../../docs/requests.md) ayrıdır. PR102 dönemindeki tek seferlik yönetici kurulum/bypass izni güncel dal veya sonraki PR’lara taşınmaz; o tarihte kaldırıldığı doğrulanmıştı, bugünkü ruleset readback’i bu belge güncellemesinde yapılmadı.

## Bu belge değişikliğinin durumu

Onaylanan bütün backend kararları mevcut normatif sahiplerine aktarıldı. Geliştirme görevleri tek backlog’da, bağımlı sıra tek kuyrukta toplandı. Eski PR99 bekleme/kronoloji metinleri ve P08’deki çözümlenmiş karar soruları kaldırıldı; tenant ve eski site inceleme girdileri işletim kaydına taşındı. Yeni paralel roadmap/spec/todo kurulmadı.

Bu değişiklik Markdown dokümantasyonudur: makine sözleşmesi, generated API tipleri, SQL/migration, Edge, test davranışı veya frontend değiştirilmedi. Karar kabulü uygulama kabulü değildir. Yeni limitler, Abone No, dönem geçişi, P08/hatırlatma hedeflerinin teknik aktarımı backlog’da açıktır. Bu dalın inceleme/CI/merge sonucu, gerçekleşmeden başarılı ilan edilmez. Production dağıtımı, dış e-posta veya canlı aktarım yapılmadı.

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
