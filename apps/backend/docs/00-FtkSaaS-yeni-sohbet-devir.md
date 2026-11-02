# Güncel kaynak ve kabul

2 Kasım 2026 kaynak ve hosted teslim kontrolü. Açık işler ve kapanış ölçütleri [backlog](remaining-work.md), sıra [kuyruk](production-queue.md), ürün/API davranışı [kaynak indeksi](../../../docs/source-index.md) sahibindedir. Burada karar veya görev metni tekrar edilmez.

## Kaynak tabanı

Güncel çalışma tabanı main `5137b69fc436e49ca46dc47af86d1e88ea1a5766` (frontend PR141). Aynı SHA için [main proof](https://github.com/SXQHex/FtkSaaS/actions/runs/41458486442), [merge proof](https://github.com/SXQHex/FtkSaaS/actions/runs/41458486529) ve [development teslimi](https://github.com/SXQHex/FtkSaaS/actions/runs/41458609116) completed/success doğrulandı. XREQ-009 gerçek frontend tüketici kabulü [ortak talepte](../../../docs/requests.md#xreq-009-frontend-kabul) tamamlandı; frontend yayın/ekran kanıtının sahibi kendi alanıdır.

S05'in beş okuma projeksiyonunun backend teslim kaynağı main `a21a87208b3cbca9fc1a877fa41fd7c746fe55cd` (PR139). Aynı SHA için [main proof](https://github.com/SXQHex/FtkSaaS/actions/runs/41450827285), [merge proof](https://github.com/SXQHex/FtkSaaS/actions/runs/41450826811) ve [development teslimi](https://github.com/SXQHex/FtkSaaS/actions/runs/41450894731), attempt1 completed/success doğrulandı. Bu teslim S05'in aşağıdaki beş okuma projeksiyonunu kapsar; genel S05 veya frontend ekran kabulü değildir.

S01.5'in PR137 main kaynağı `aa52a873fc363aaa41eb851c538dd510122b0602`; [main proof](https://github.com/SXQHex/FtkSaaS/actions/runs/41442842244), [merge proof](https://github.com/SXQHex/FtkSaaS/actions/runs/41442842200) ve [development teslimi](https://github.com/SXQHex/FtkSaaS/actions/runs/41442898421) başarılıdır. Development attempt2 hosted backend ve dokümantasyon doğrulamasını geçti. İlk CD denemesinde migration uygulandı, Edge CLI yüklemesi başarısız oldu; aynı kaynaklı tekrar tamamlandı, ilk CLI hatasının ayrıntılı nedeni eldeki kayıttan çıkarılamadı. PR135 için verilen kontrollü bypass yalnız o teslim içindi; kalıcı politika kurulum işi yok.

## S01–S02 backend kabulü

PR131'in [aday full clean'i](https://github.com/SXQHex/FtkSaaS/actions/runs/41366260322), attempt1 head `924412040d1796d8723ef86e25c425cb7bbc5d14`, base `67b1ae704a6837fd0cc79057ea2ecb88df9e08a4`, tested merge `b87d86a43fda68029c0530ee5f8b35a3b634abe3` içindir. Core ve dört API Clean acceptance, full-clean toplayıcısı ve quality/Secret scan başarılıdır. Önceki başarısız aday bu kabulün kaynağı değildir; teşhis ve düzeltme geçmişi Git/PR131'de korunur.

S01 oda keşfi/ayrıntısı ve düzenleme sürümü; S02 sınıf keşfi/düzenlemesi ile değişmez program sürümünün özgün tanımı teslim edildi. Gerçek Auth→Edge→RPC testleri yeni oturumdan keşif ve yeniden okuma, stale sürüm, çakışma, cursor/selector/kapsam, rol/plan kaybı, Starter kaynak sınırı, eski snapshot yokluğu ve kategori kapasitesini kapsar. Program okuması yeni preview/apply yetkisi vermez; sınıf/program tanımı ile gerçekleşen seans görünümü ayrıdır. DTO/selector/izin ayrıntısının sahibi [WF02–WF03](../../../docs/workflows.md#wf02) ve makine sözleşmesidir.

S01–S02 backend teslimi PR131 main `73700e37c3403dc309a5df61989837edbca24b96` üzerinde [main proof](https://github.com/SXQHex/FtkSaaS/actions/runs/41386709580) ve [development teslimi](https://github.com/SXQHex/FtkSaaS/actions/runs/41386745640) attempt1 success ile kapalıdır. Frontend ekran entegrasyonu/gerçek kullanıcı kabulü kendi alanında kalır; genel Starter veya F01–F33 bütün özellik kabulü bu teslimden çıkarılmaz.

## Starter yapılandırma okumaları kabulü

XREQ-007/008 için PR134'ün [son adayı](https://github.com/SXQHex/FtkSaaS/actions/runs/41397475140), attempt1 head `457a5451fac9ce4977937ab513dc7969858731eb`, base `b0d468d14fccde2816fb4cc6744038a608c80b84`, tested merge `77147bc3d0095d5b09405941c5aef951b95bbaa8` üzerinde core+dört API shard, quality/Secret scan ve full-clean toplayıcısını geçti. Önceki başarısız aday bu kabulün kanıtı değildir. PR134 main `61137c86c9ae015e2fc8f9dfef250a372bc1211d` için [main proof](https://github.com/SXQHex/FtkSaaS/actions/runs/41400798811) ve [development teslimi](https://github.com/SXQHex/FtkSaaS/actions/runs/41400845196) attempt1 success ile backend teslimi tamamlandı; frontend gerçek tüketici kabulü kendi sahibindedir. DTO/selector/izin sahibi [WF02](../../../docs/workflows.md#wf02); talep durumu [ortak kayıtta](../../../docs/requests.md) tutulur.

<a id="abone-no-yeni-aday-kapsamı"></a>
## Abone No tahsis ve ilk aktarım kabulü

S03/S04 tahsis, tekrar güvenli ilk aktarım, birleşimde numara/alias koruma ve kişi araması PR135 ile teslim edildi. Kişi detay/liste, güncel rapor ve yeni CSV projeksiyonları aynı teslimdedir; diğer operasyon DTO'ları için S05 açık kalır. Davranışın tek sahibi [P08](../../../docs/decisions/P08-accepted-scope.md#organizasyon-bazında-sabit-abone-numarası), tüketim [WF04](../../../docs/workflows.md#wf04) ve [WF10](../../../docs/workflows.md#wf10) kapsamındadır.

[Son PR135 adayı](https://github.com/SXQHex/FtkSaaS/actions/runs/41409837224), head `4ef70c72f817668a5f73baf4715b014a139a1432`, base `61137c86c9ae015e2fc8f9dfef250a372bc1211d`, tested merge `a6f9531cddf8c7c16c934ea42bd622d97a8183af`, attempt1 üzerinde quality/Secret scan, core ve dört API Clean acceptance ile full-clean toplayıcısını geçti. İlk başarısız adayın fixture düzeltmeleri Git/PR geçmişindedir. Yerel SQL/API çalıştırması artifact DNS hatasıyla engelliydi; gerçek kabul bu başarılı CI kaynağıdır. PR135 main `0ade1417d5c24383d086496fcab47b7fb17f5873` için [main proof](https://github.com/SXQHex/FtkSaaS/actions/runs/41416100142) ve [development teslimi](https://github.com/SXQHex/FtkSaaS/actions/runs/41416179330) attempt1 success ile S03/S04 ve S05 kişi/rapor/CSV temeli teslim edildi; diğer operasyon DTO'ları ve genel Starter kabulü açık.

## S01.5 eğitmen yönetimi kabulü

PR137 [aday full clean](https://github.com/SXQHex/FtkSaaS/actions/runs/41437372390), attempt1 head `8e7b3d3740e0e146c6b35e0385cbbff246caf75a`, base `d0a6b5639ba12809d6b5a5b61ca7f02ab485db31`, tested merge `159e9e4e672333e4bd836d470a4271943981026b` üzerinde core, dört API shard, quality ve full-clean toplayıcısını geçti. Yukarıdaki main/CD kabulüyle S01.5 backend teslimi kapalıdır. Önceki başarısız fixture denemeleri Git/PR geçmişindedir. Eğitmen keşfi, etki onayı ve normal seans yaşam döngüsü gerçek API'de doğrulandı; frontend ekran kabulü ortak talep sahibindedir.

## S05 operasyon projeksiyonları kabulü

PR139 [aday full clean](https://github.com/SXQHex/FtkSaaS/actions/runs/41445290413), attempt1 head `e9fda3cf9003cbba577a1ec6cde8571cac2a8ac8`, base `2901f4ce3339a5bbc47408f98a0609241ebd7378`, tested merge `a5201619bce98caba6dfbf7eb15917c1381dcc31` üzerinde core, dört API shard, quality ve full-clean toplayıcısını geçti. Yukarıdaki aynı-main proof ve development teslimiyle bu dilimin backend kabulü tamamlandı.

ReservationView, AttendanceEntryView, EntitlementView, FinanceView ve NegativeLimitsView nullable Abone No taşır. Gerçek API kabulü tutarlılık, self/tenant sınırı, alias→UUID→finans ve okumanın numara tahsis etmemesini kapsar. Yerel PostgreSQL çalıştırması ortamın chown yetkisi olmadığı için engelliydi; migration/API kabulünün kaynağı başarılı aday CI'dır. Diğer operasyon DTO'ları için S05 ve frontend ekran kabulü açık.

## Devam noktası

A03.1 kaynak/plan/WF eşlemesi main'de; A03.2/A03.3 genel özellik bazlı kanıt ve boşluk uzlaştırması açık. S01.4 backend teslimi tamamlandı. S01.5/XREQ-009 backend teslimi tamamlandı; aktif paket S05 operasyon projeksiyonlarıdır; görev/ölçütler [backlog](remaining-work.md), sıra [kuyruk](production-queue.md) sahibindedir. Genel Starter veya F01–F33 kabulü kapatılmadı.

## Mevcut kaynak ve gerçek kabul sınırları

| Alan | Kaynak/kanıt sınırı |
|---|---|
| Temel domain | Rezervasyon koruması, atomik hak/finans, yoklama, hakediş ve hesaplaşma kaynakları mevcut; eksik metadata bunları sıfırdan iş yapmaz. |
| F01–F33 | Güncel operasyon/özellik ve kabul envanteri [üretilmiş feature-delivery görünümündedir](../../../docs/feature-delivery.md); feature_delivery kabul alanları pending_feature_acceptance. Kanıt uzlaştırılmadan tamamlanma yüzdesi çıkarılmaz. |
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
