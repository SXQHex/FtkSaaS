# Açık işler — tek backlog

Kabul edilmiş kaynak ve kapanmış teslimler [00 devirde](contracts/00-FtkSaaS-yeni-sohbet-devir.md), aktif sıra [üretim kuyruğunda](production-queue.md). Bu dosya başka belgedeki eski pending listesinden otomatik görev üretmez.

| Kimlik | Alan | Açık iş ve kapanış ölçütü |
|---|---|---|
| WEB-01 | Gerçek istemci entegrasyonu | saaspt kaynaklarını hash/SHA iziyle apps/web ve packages/ui içine aktar; sentetik görünümü native Auth + typed Edge API ile mevcut geliştirme Supabase’ine bağla. Rol/plan/tenant, expected_version, preview, replay/bilinmeyen sonuç ve veri görünürlüğü ekran→API→DB ile doğrulanır. Tasarım kaynağını taşımak bu kabul değildir. |
| PUBLIC-01 | Public sağlayıcı/istemci devri | uye.fethiyetango.com üzerinde gerçek widget tokenı/action/hostname/replay ve gateway yapılandırmasıyla başvuru kabulü. Backend intent/review/self zinciri kapalıdır; gerçek provider/browser kanıtı mock ile kapanmaz. |
| ST-03 | Kalan ayar consumerları |69 kabul grubunda eksik alan/DTO/miras/default/şablon/yayın/sağlayıcı eşlemesini [alan devri](frontend-settings-handover.md) üzerinden tamamla. Marka kataloğu/logo/medya, takvim, sessiz saat/özet/olay consumerları ve özel domain yolları generic JSON saklamayla kapanmaz. Yeni Starter FD07 başlangıcı yeniden açılmaz. |
| OPS-01 | Worker/retention | Beş worker’ın temel kurulum/idle kabulü var; gerçek yük, kesinti/disable-restart ve fiziksel imha kabulünü izole ve kaynak bağlı kanıtla tamamla. |
| REL-01 | Yayın/geri dönüş | Hosted tam restore, Auth/Storage baytları/secret/config envanteri, RPO/RTO ve yük kabulü. İzole restore sahiplik denemesi ve development CD production kabulü değildir. |
| CI-ADMIN | Repo koruması | Yönetici required-check/strict-base/bypass ayarlarını ayrı doğrula; kaynak CI kapısı bu ayarların kurulu olduğuna kanıt değildir. |
| FIN-01 | Eğitmen ödeme okuması | trailing earning_ids doğrulaması ayrı iyileştirmedir; mevcut kabul edilmiş finans/tenant zinciri yeniden açık sayılmaz. |

## Ayrı ürün kapsamı: P08

[P08 karar kaydı](decisions/P08-accepted-scope.md) Business kurulumunda abone numarası yaşam döngüsü; telefon tabanlı çok kaynaklı ortak CRM/web/reklam başvuru alımı; sınırsız etkinlik kapasitesi; pakete bağlı ders kredisi tüketmeyen Pratik katılımı; Pro/Business diğer limit/özel teklif temsili değerlendirilir. Ortak başvuru için ikinci paralel tablo kurulmaz; kaynak/form/kampanya ve ayrı onay kanıtları korunur. Mevcut public submit’in e-posta/publication DTO’su telefon tabanlı genel CRM ihtiyacını karşılamaz. Uygulama öncesi eşsiz numara/alias/merge ve paketin geçerlilik+bakiye ilişkisi netleştirilir; ürün kararı uydurulmaz.

P08 mevcut Fethiye Tango kurulum değerleri ve önceki izinli tekil yönetici aktarımı [hosted runbook’un kaynak kaydındadır](remote-backend-setup.md). Sipariş/ödenmiş satış/tahsilat/yoklama birbirine çevrilmez.100 tekrar,20 kontenjan,4 ders/2ay ve Pratik adı genel ürün defaultu değildir. İkinci paket kendiliğinden satış değildir; gerçek kulüp verisi silinmez.

## Ertelenmiş ve kapsam dışı

Gerçek SMS sağlayıcısı ayrı dış entegrasyondur; sabit yerel OTP hosted kanıtı değildir. Apple/Instagram login kapsam dışı, passkey erteli; reklam formu alımı sosyal login değildir. Ayrı kalıcı dummy/pilot kurulum görevi iptaldir; mevcut sentetik veri tekrar kullanılabilir. SQL/Cron/DB teknik yönetim ekranı ertelidir. Free-plan parola koruması uyarısı ve belgeli ops_run search_path linter istisnası yeniden açık ilan edilmez. Frontend gerçek ortamda kullanıma açılmadan production verisi/dağıtımı ayrı kabul edilir.
