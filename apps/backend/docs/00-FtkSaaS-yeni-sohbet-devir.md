# Güncel kaynak ve kabul

2 Kasım 2026 başlangıç kontrolü. Açık işler ve kapanış ölçütleri [backlog](remaining-work.md), sıra [kuyruk](production-queue.md), ürün/API davranışı [kaynak indeksi](../../../docs/source-index.md) sahibindedir. Burada karar veya görev metni tekrar edilmez.

## Kaynak tabanı

Main `b0d468d14fccde2816fb4cc6744038a608c80b84` (PR133). Aynı SHA'nın [main proof](https://github.com/SXQHex/FtkSaaS/actions/runs/41392859595), [merge proof](https://github.com/SXQHex/FtkSaaS/actions/runs/41392859644) ve [development teslimi](https://github.com/SXQHex/FtkSaaS/actions/runs/41392911722) GitHub'dan completed/success olarak doğrulandı. Bu taban kabulü yeni aday veya frontend gerçek ekran kabulü değildir.

## S01–S02 backend kabulü

PR131'in [aday full clean'i](https://github.com/SXQHex/FtkSaaS/actions/runs/41366260322), attempt1 head `924412040d1796d8723ef86e25c425cb7bbc5d14`, base `67b1ae704a6837fd0cc79057ea2ecb88df9e08a4`, tested merge `b87d86a43fda68029c0530ee5f8b35a3b634abe3` içindir. Core ve dört API Clean acceptance, full-clean toplayıcısı ve quality/Secret scan başarılıdır. Önceki başarısız aday bu kabulün kaynağı değildir; teşhis ve düzeltme geçmişi Git/PR131'de korunur.

S01 oda keşfi/ayrıntısı ve düzenleme sürümü; S02 sınıf keşfi/düzenlemesi ile değişmez program sürümünün özgün tanımı teslim edildi. Gerçek Auth→Edge→RPC testleri yeni oturumdan keşif ve yeniden okuma, stale sürüm, çakışma, cursor/selector/kapsam, rol/plan kaybı, Starter kaynak sınırı, eski snapshot yokluğu ve kategori kapasitesini kapsar. Program okuması yeni preview/apply yetkisi vermez; sınıf/program tanımı ile gerçekleşen seans görünümü ayrıdır. DTO/selector/izin ayrıntısının sahibi [WF02–WF03](../../../docs/workflows.md#wf02) ve makine sözleşmesidir.

S01–S02 backend teslimi kaynak, aday kabulü, merge/main kanıtı ve development doğrulamasıyla kapalıdır. Frontend ekran entegrasyonu/gerçek kullanıcı kabulü kendi alanında kalır; genel Starter veya F01–F33 bütün özellik kabulü bu teslimden çıkarılmaz.

## Starter frontend talepleri için yeni aday

XREQ-007/008 kapsamında merkez–disiplin ve kaynak kapanışı yönetim okumaları eklendi; DTO/selector/izin sahibi [WF02](../../../docs/workflows.md#wf02). Yeni sözleşme regresyonu eksik runtime metadata'sında kırmızı, değişiklik sonrası yeşil oldu. Gerçek Auth→Edge→RPC senaryoları ilişki yokluğu/kendi sürümü/stale yazma, kapanış append/yeniden okuma, cursor/hesap/kaynak, rol kaybı, F01/F02 kaybı ve Starter sınırlarını kapsayacak biçimde eklendi. Yerel native stack PostgreSQL artifact DNS ETIMEOUT nedeniyle başlatılamadı; bu gerçek API senaryoları yerelde geçmiş sayılmaz. İlk [PR134 adayı](https://github.com/SXQHex/FtkSaaS/actions/runs/41394141146) head `e82b67ba4db1d233b88bdd4498e4116195202567` üzerinde core/API-2/3/4 ve kaliteyi geçti; API-1 yeni Starter fixture içindeki zorunlu `page` alanı eksik `centers_list_v1` isteğinde reddedildi. Kapanış oluşturulmadığı için sonraki downgrade okuma assertion’ı da başarısız oldu. Yalnız test isteğine sayfalama eklendi; runtime ve assertion’lar korundu. Yeni aday CI, merge/main ve development teslimi bekleniyor; frontend adına kabul verilmedi.

XREQ-005 için kişi bazlı davet/bağ keşfi mevcut `person-management-discovery.sql` ve kendi gerçek API testlerinde bulundu; bu görevde yeniden uygulanmadı veya eski “uygulanıyor” kaydı kanıtsız kapatılmadı. XREQ-006 Starter dışında ertelenmiş kalır. XREQ-002'nin gerçek native recovery/oturum kabulü ayrı açık kalır. Görev ve sıra kendi sahiplerindedir.

## Devam noktası

A03.1 kaynak/plan/WF eşlemesi main'de; A03.2/A03.3 özellik bazlı kanıt/ortam ve gerçek boşluk uzlaştırması açık. Öncelik mevcut frontend Starter taleplerinin ek okuma dilimi, ardından S03–S05'tir. Görev/ölçütler [backlog](remaining-work.md), uygulama sırası [kuyruk](production-queue.md) sahibindedir. Yeni aday ek yönetim okumaları ve migration içerir; yeni ürün kararı içermez. Aday/main/development kabulü bekliyor.

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
