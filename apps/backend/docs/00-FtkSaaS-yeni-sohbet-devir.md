# Güncel kaynak ve kabul

2 Kasım 2026 başlangıç kontrolü. Açık işler ve kapanış ölçütleri [backlog](remaining-work.md), sıra [kuyruk](production-queue.md), ürün/API davranışı [kaynak indeksi](../../../docs/source-index.md) sahibindedir. Burada karar veya görev metni tekrar edilmez.

## Kaynak tabanı

Güncel main `d0a6b5639ba12809d6b5a5b61ca7f02ab485db31` (frontend PR136); [main proof](https://github.com/SXQHex/FtkSaaS/actions/runs/41418558318), [merge proof](https://github.com/SXQHex/FtkSaaS/actions/runs/41418558300) ve [development zinciri](https://github.com/SXQHex/FtkSaaS/actions/runs/41418657844) completed/success doğrulandı. Bu frontend değişimi yeni backend runtime kabulü değildir. Backend teslim kaynağı `0ade1417d5c24383d086496fcab47b7fb17f5873` (PR135). Aynı SHA'nın [main proof](https://github.com/SXQHex/FtkSaaS/actions/runs/41416100142), [merge proof](https://github.com/SXQHex/FtkSaaS/actions/runs/41416100150) ve [development teslimi](https://github.com/SXQHex/FtkSaaS/actions/runs/41416179330) attempt1 completed/success olarak doğrulandı. Hosted backend ve dağıtılmış dokümantasyon doğrulama/capture adımları başarılıdır. PR135 kaynak-özel kontrollü kullanıcı bypass izniyle birleşti; izin sonraki PR'lere taşınmaz. Kullanıcı kalıcı politika kurulum mekanizması istemedi; böyle bir açık görev veya uygulama yok. Bu taban kabulü yeni aday veya frontend gerçek ekran kabulü değildir.

## S01–S02 backend kabulü

PR131'in [aday full clean'i](https://github.com/SXQHex/FtkSaaS/actions/runs/41366260322), attempt1 head `924412040d1796d8723ef86e25c425cb7bbc5d14`, base `67b1ae704a6837fd0cc79057ea2ecb88df9e08a4`, tested merge `b87d86a43fda68029c0530ee5f8b35a3b634abe3` içindir. Core ve dört API Clean acceptance, full-clean toplayıcısı ve quality/Secret scan başarılıdır. Önceki başarısız aday bu kabulün kaynağı değildir; teşhis ve düzeltme geçmişi Git/PR131'de korunur.

S01 oda keşfi/ayrıntısı ve düzenleme sürümü; S02 sınıf keşfi/düzenlemesi ile değişmez program sürümünün özgün tanımı teslim edildi. Gerçek Auth→Edge→RPC testleri yeni oturumdan keşif ve yeniden okuma, stale sürüm, çakışma, cursor/selector/kapsam, rol/plan kaybı, Starter kaynak sınırı, eski snapshot yokluğu ve kategori kapasitesini kapsar. Program okuması yeni preview/apply yetkisi vermez; sınıf/program tanımı ile gerçekleşen seans görünümü ayrıdır. DTO/selector/izin ayrıntısının sahibi [WF02–WF03](../../../docs/workflows.md#wf02) ve makine sözleşmesidir.

S01–S02 backend teslimi kaynak, aday kabulü, merge/main kanıtı ve development doğrulamasıyla kapalıdır. Frontend ekran entegrasyonu/gerçek kullanıcı kabulü kendi alanında kalır; genel Starter veya F01–F33 bütün özellik kabulü bu teslimden çıkarılmaz.

## Starter yapılandırma okumaları kabulü

XREQ-007/008 için PR134'ün [son adayı](https://github.com/SXQHex/FtkSaaS/actions/runs/41397475140), attempt1 head `457a5451fac9ce4977937ab513dc7969858731eb`, base `b0d468d14fccde2816fb4cc6744038a608c80b84`, tested merge `77147bc3d0095d5b09405941c5aef951b95bbaa8` üzerinde core+dört API shard, quality/Secret scan ve full-clean toplayıcısını geçti. Önceki başarısız aday bu kabulün kanıtı değildir. Yukarıdaki main/development kabulüyle backend teslimi tamamlandı; frontend gerçek tüketici kabulü kendi sahibindedir. DTO/selector/izin sahibi [WF02](../../../docs/workflows.md#wf02); talep durumu [ortak kayıtta](../../../docs/requests.md) tutulur.

## Abone No yeni aday kapsamı

S03/S04 tahsis, tekrar güvenli ilk aktarım, birleşimde numara/alias koruma ve kişi araması kaynakları hazırlandı. Kişi detay/liste, güncel rapor ve yeni CSV projeksiyonları aynı adayda; diğer operasyon DTO'ları için S05 açık kalır. Davranışın tek sahibi [P08](../../../docs/decisions/P08-accepted-scope.md#organizasyon-bazında-sabit-abone-numarası), tüketim [WF04](../../../docs/workflows.md#wf04) ve [WF10](../../../docs/workflows.md#wf10) kapsamındadır.

[Son PR135 adayı](https://github.com/SXQHex/FtkSaaS/actions/runs/41409837224), head `4ef70c72f817668a5f73baf4715b014a139a1432`, base `61137c86c9ae015e2fc8f9dfef250a372bc1211d`, tested merge `a6f9531cddf8c7c16c934ea42bd622d97a8183af`, attempt1 üzerinde quality/Secret scan, core ve dört API Clean acceptance ile full-clean toplayıcısını geçti. İlk başarısız adayın fixture düzeltmeleri Git/PR geçmişindedir. Yerel SQL/API çalıştırması artifact DNS hatasıyla engelliydi; gerçek kabul bu başarılı CI kaynağıdır. Yukarıdaki main/development kanıtıyla S03/S04 ve S05 kişi/rapor/CSV temeli teslim edildi; diğer operasyon DTO'ları ve genel Starter kabulü açık.

PR136 XREQ-010 dar istisnaları PR135 ile kuruldu; frontend kendi güncel main/kaynak kabulünün sahibidir. S01.5/XREQ-009 yeni adayında dar instructor atama keşfi ve kaldırma/değiştirme hazırlanıyor. Kullanıcı kaldırmayı engelleyen yaklaşımı reddetti: seans esas, etkilenen gelecek seanslar açıkça önizlenip onaylanır; rol ve görevleri atomik kaldırılır. Seans/rezervasyon korunur, yöneticiye eğitmen atanmalı işi çıkar ve yeni kişi seansa manuel atanır. Son kullanıcı düzeltmesiyle eğitmen eksikliği normal seans yaşam döngüsüne ek kısıtlama getirmez; yeni rezervasyon, kapasite/saat değişikliği ve yoklama regresyonları eklendi. Yeni kaynakta yerel verify 166 sözleşme/yönetişim/restore + 103 CI + 9 kalite testiyle geçti; kalite kontrolü temiz. Gerçek API kabulü CI bekler. Önizleme mevcut core.previews/token/dependency modelini kullanır; ayrı bir onay altyapısı kurulmadı. Yerel şema regresyonu desteklenmeyen selector'da kırmızı, additive sözleşmeyle yeşil oldu; yeni SQL/API senaryoları henüz gerçek kabul sayılmaz. Önceki native başlatmada artifact DNS sorunu vardı; son denemede ortamın root/nobody PostgreSQL kullanıcısı reddedildi. Yerel SQL/API senaryoları çalıştırılmış sayılmaz. Yeni aday CI ve hosted kabulü beklenir.

PR137 ilk [aday full clean](https://github.com/SXQHex/FtkSaaS/actions/runs/41426523099), attempt1 head `437fc5c26d2439e3b41f63b3c9074525a0b64412`, base `d0a6b5639ba12809d6b5a5b61ca7f02ab485db31`, tested merge `81ac3a913d870e36fb4870267373744c86b11f56` üzerinde başarısız: core, quality ve API-1/3/4 geçti; API-2 yeni fixture'ın ilk rezervasyonunda eksik `student_cancel_group` nedeniyle `POLICY_NOT_CONFIGURED` verdi. Fixture iptal/katılım politikalarını açık yayımlar ve esnek kayıt denenen sınıf dış katılıma açıktır. 215 saniyede henüz ilk rezervasyona ulaşıldığından yeni suite'in 300 saniyelik bütçesi 600 saniyeye çıkarıldı; CI eşikleri/runtime ve assertion'lar değiştirilmedi. Düzeltilen adayın gerçek SQL/API kabulü beklenir.

## Devam noktası

A03.1 kaynak/plan/WF eşlemesi main'de; A03.2/A03.3 genel özellik bazlı kanıt ve boşluk uzlaştırması açık. S01.4 backend teslimi tamamlandı. Aktif paket S01.5/XREQ-009; S05 diğer operasyon projeksiyonları açıktır; görev/ölçütler [backlog](remaining-work.md), sıra [kuyruk](production-queue.md) sahibindedir. Genel Starter veya F01–F33 kabulü kapatılmadı.

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
