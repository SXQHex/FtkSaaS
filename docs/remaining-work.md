# Starter backend — güncel kalan işler

Kabul edilmiş main `fc96dc15f336abed20cd0a6c73d84a5b0e3b08b0`:213 API/67 migration/90 core tablo/Edge21 ACTIVE/JWT açık. [PR58](https://github.com/SXQHex/FtkSaaS/pull/58) tek-stüdyo runtime kabulünü, [PR59](https://github.com/SXQHex/FtkSaaS/pull/59) belge kapanışını taşır. [Main40483793353](https://github.com/SXQHex/FtkSaaS/actions/runs/40483793353) ve [development CD40487227365](https://github.com/SXQHex/FtkSaaS/actions/runs/40487227365) başarılıdır.

## Kapanmış teslimler

| Alan | Kabul |
|---|---|
| Kimlik/iletişim/oturum | PR54; native Auth, Google bağlama, doğrulanmış e-posta, kurtarma ve canlı oturum iptali. Gerçek SMS ayrı dış entegrasyondur. |
| Starter plan kapıları | PR56;1 merkez/oda/disiplin/eğitmen/100 aktif öğrenci, API/RPC/replay sınırları ve geçmişi koruyan sürümlü downgrade. |
| Tek stüdyo ve ürün/hak zinciri | PR58;50 oda tavanında40/5 seans, çakışma reddi, kredili/kotalı süreli/sınırsız satış/tahsilat/self rezervasyon/yoklama/hak tüketimi; sıfır hakediş. |
| Ürün adı/sürüm | PR58; zorunlu disiplin ön eki, aynı kimlikte yeni yayın, disiplin/ad değişiminde eski satış/bedel/kapsam/hak bütünlüğü. |
| Temel motorlar | P01–P07 API uygulama kabulü mevcut. Tekrar geliştirilmez; aşağıdaki Starter tüketici ve işletim kabulü ayrı doğrulanır. |

## Aktif teslim — başlangıç ayarları ve self/public

İki alan tek Draft PR içinde geliştirilir. Son adayda bağımsız inceleme ve tek full clean alınır; aynı main/CD kabulü korunur.

| Alan | Kalan iş / kapanış kanıtı |
|---|---|
| Yeni işletme başlangıç ayarları | Gerekli alanların mevcut API/DTO/default/miras/yetki/sürüm/reset ve gerçek program/paket/rezervasyon/yoklama tüketici eşlemesi; org zorunlu politika/merkez istisnası; eksik config’in kapalı kalması. Sözleşmede olmayan ticari/politika değeri yaratılmaz. |
| Öğrenci self/public başlangıcı | Self rezervasyon kabulü korunur; gerçek public hostname, Turnstile action/hostname/replay, signed ingress ve yetkili yapılandırmayla anonim başvuru→yetkili inceleme→öğrenci başlangıcı. Starter genel CRM/etkinlik/deneme Pro kapıları aşılmaz. Gerçek sağlayıcı kanıtı mock ile kapanmaz. |

## Sonraki Starter işleri

| Alan | Durum |
|---|---|
| Temel rapor/import/bildirim | Mevcut P05/P06 motorları var; Starter plan/rol/kapsam ve gerçek tüketici akışlarının bütünleşik kabulü tamamlanacak. |
| Gerekli diğer ayar consumerları |69 davranış grubu yeniden onaylatılmaz. Alan bazlı kalan wire/provider/domain/miras/şablon/yayın boşlukları gerçek kaynakla ayrılır; genel JSON saklama yeterli değildir. Marka/medya/takvim gibi özel yaşam döngüleri mevcut destek sınırına göre ele alınır. |
| Worker işletimi | Beş worker’ın kurulum/idle heartbeat kabulü mevcut; gerçek yük, kesinti/disable-restart ve fiziksel imha kabulü açık. |
| Geri dönüş/yayın hazırlığı | İzole restore sahiplik kanıtı mevcut; hosted tam geri dönüş, secret/config/Storage envanteri ve RPO/RTO/yük kabulü açık. Development CD production yetkisi değildir. |
| CI belge istisnası | Yeni devir dosyalarının incelenmiş izin listesine eklenmesi ayrı CI bakımıdır. Bu belge eşitlemesinde politika/kapı değiştirilmez. |

## Ayrı kapsam ve korunacak sınırlar

Pro/Business diğer sayısal limit/özel teklif işleri Starter kapanışını genişletmez. Genel CRM/etkinlikler, Business P08 gerçek kulüp geçmişi ve ders kredisi tüketmeyen Pratik, frontend tasarımı/ekranları ayrı kapsamdır. İnstructor ödeme trailing earning_ids iyileştirmesi ayrı takip notudur; para/tenant sızıntısı bulgusu olarak sunulmaz.

Native Auth güvenlik e-postaları/Resend kurulumu ve gerçek kimlik kabulü tamamlandığından eski “dış e-posta hiç kurulmadı / Google kapalı / kurtarma gateway’i zorunlu” notları güncel açık iş değildir. Organizasyon pazarlama/diğer dış e-posta consumerları ayrıca değerlendirilir. Gerçek SMS erteli; sabit yerel OTP hosted kabul değildir. Ücretsiz plan parola koruması uyarısı kullanıcı kararıyla kapsam dışıdır. ops_run/search_path ve rls_auto_enable önceki düzeltmeleri yeniden açık ilan edilmez; belgeli ops_run linter istisnası korunur.

Repository required-check/strict-base/bypass yönetim ayarlarının doğrulanması ayrı yönetici işidir; source-bound CI kabulü yönetim ayarı kanıtı değildir.

## Kaynaklar

[Güncel devir](../contracts/00-FtkSaaS-yeni-sohbet-devir.md), [kaynak önceliği](source-index.md), [üretim kuyruğu](production-queue.md), [Starter devri](starter-plan-gates-handover.md), [ayar alan/consumer sınırları](frontend-settings-handover.md), [public transport kurulumu](p04-handover.md), [uzak backend kabulü](remote-backend-setup.md). Tarihsel reports/ ve source-v2.2 değiştirilmez; eski aday sayıları yeni kaynağa taşınmaz.
