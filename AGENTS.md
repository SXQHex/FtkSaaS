# FtkSaaS çalışma kuralları

21 Ekim CD görevi: mevcut Supabase projesinin platformdaki production branch’i doğrudan geliştirme/test hedefidir; ayrı ücretli preview projesi gerekmez. Kullanıcının bu proje için doğrudan dağıtım yetkisi vardır; gerçek müşteri production kabulü verilmez. CD-01 ayrı altyapı PR’sında hazırlanıyor; aynı main full kabulü → migration/Edge → uzak smoke/cleanup zinciri henüz etkin ve canlı doğrulanmış sayılmaz. P04, CD kapanışından sonra sıradadır.

P03 **done**: [PR #30](https://github.com/SXQHex/FtkSaaS/pull/30), kabul edilmiş main `10710ffa90747a7e35c452c4c07ba59522f50ce3`. Son head2526347 / basece95a9d / tested merge1768fc2 / tree9ac328b aynı kaynak zinciridir. Bağımsız kaynak incelemesi PR review5594023911 içinde kayıtlı; [aday39527260056](https://github.com/SXQHex/FtkSaaS/actions/runs/39527260056) ve [aynı main39529992556](https://github.com/SXQHex/FtkSaaS/actions/runs/39529992556) completed/success.96 yapı +37 CI politika +27 DB +316 API =476 test düğümü; fail/skipped0,49 migration. Main13:18; aday13:34. Envanter199 sözleşme/140 runtime/59 contract_only,90 core tablo. Geliştirme/test Supabase aynı49 migration/Edge3 kaynağına eşitlendi; ayrı dokuz kontrollü Auth→Edge→RPC smoke ve fixture temizliği başarılı. P04 queued, başlamadı.

P02 **done**: [PR #28](https://github.com/SXQHex/FtkSaaS/pull/28), kabul edilmiş main `cc4878d09e45204dbc13ccfe1324b38b14548167`. Envanter **199 sözleşme / 133 runtime / 66 contract_only / 40 migration / 90 core tablo**. Son head `35816cc30a9b28e273e94e6cef86e8b402dbaad0` bağımsız incelemeden geçti; [hedefli39448566998](https://github.com/SXQHex/FtkSaaS/actions/runs/39448566998), [aday39455462417](https://github.com/SXQHex/FtkSaaS/actions/runs/39455462417) ve [aynı main39461804543](https://github.com/SXQHex/FtkSaaS/actions/runs/39461804543) completed/success. Full kapsam:96 sözleşme/yönetişim +37 CI politika +27 DB +309 API =469 test düğümü; fail/skipped0. Core, dört izole API shard, toplayıcı,40 migration, seed/health/advisors geçti. Main clean14:43; önceki43:33 hedefli koşu seri tüm-suite fallback kullandı, aynı çalışma profili değildir. Eski başarı yeni kaynağa taşınmaz.

20 Ekim son kullanıcı talimatı: her main birleşmesinin aynı kaynak kabulü doğrulandıktan sonra `gwyprhenabtpkbojephw` FtkSaaS **geliştirme/test** ortamını da o main ile eşitle. Önce migration geçmişi ve içerik eşleşmesini doğrula; yalnız eksik migration’ları sırasıyla uygula, değişen Edge bundle’ını yayımla, JWT/izin kapılarını koru; aynı içerik varsa yeniden kurulum yapmadan eşleşmeyi kaydet. Ardından uzak Auth→Edge→RPC smoke, RLS/EXECUTE ve advisors doğrulaması yap; kaynak SHA/migration/Edge sürümü/sonucu kaydet. Bu, ajanın teslim kapanış adımıdır; otomatik CD workflow’u kurulduğu anlamına gelmez. Production yetkisi değildir. Testler yalnız ayrılmış sentetik verilerle yapılır; mevcut gerçek veriyi reset etme. `npm run test:clean` loopback kabulünde kalır; hosted smoke onun yerine geçmez. Full clean çalışırken izleme/yayın devamı durur; kullanıcı dönüşünde gerçek main kabulü sonrası bu adıma geçilir.

## Başlangıç ve kaynak önceliği

İşe başlarken çalışılan tam SHA’yı belirt. Önce [kaynak indeksini](docs/source-index.md), [güncel devri](contracts/00-FtkSaaS-yeni-sohbet-devir.md), [kalan işleri](docs/remaining-work.md), [entegrasyon devrini](docs/claude-handover.md), sonra görevle ilgili sözleşme ve kararları oku. GitHub’dan güncel main/PR ve aynı SHA’nın CI durumunu doğrula; eski başarıyı yeni SHA’ya taşıma.

Son açık kullanıcı kararı üstündür. D01–D09, U01–U08, Q-D01, Q-E02 ve Q-E03 korunur. Sonraki kabul edilmiş karar yalnız çelişen hükümleri değiştirir. Alt katalog veya uygulama üst kararı sessizce değiştiremez; bilinmeyen ürün/config değerlerini uydurma.

Ürün kararı, teknik aktarım, çalışan uygulama ve doğrulanmış kabul ayrı durumlardır. Geliştirici beyanı, repository raporu ve bağımsız CI kanıtını ayrı belirt. Raporun kaynak SHA’sını/kapsamını kontrol et. Eski raporlardaki açıkları güncel runtime/karar/CI ile karşılaştırmadan yeniden açık ilan etme. Uzak Auth → Edge → RPC smoke temiz CI kabulünün yerine geçmez.

## Alan ve güvenlik sınırları

Frontend tasarımına/istemci koduna müdahale etme. Production dağıtımı yapma; main merge dağıtım izni değildir. Secrets, tokenlar, parolalar ve kişisel verileri kaynaklara/raporlara yazma; sentetik test verisi kullan. Uygulanmış migration değiştirilmez. Dış e-posta ertelendi; uygulanmış sayma ve Resend entegrasyonu başlatma. Yük/restore ve frontend gerçek entegrasyon kabulünü kanıtsız kapatma.

## Her uygulama PR’sinin kapanışı

Etkilenen sözleşme/karar aktarımını, işlem envanterini, kalan işleri ve devir notlarını aynı PR içinde güncelle. Etkilenmeyen belgeleri gereksiz değiştirme; ikinci paralel belge ağacı oluşturma. İşlem durumunu makine sözleşmesi, runtime listesi ve üretilmiş endpoint envanteriyle karşılaştır. Üretilen dosyalar için mevcut üretim komutlarını kullan.

Belge bağlantılarını, kaynak önceliğini ve envanter tutarlılığını kontrol et. [CI politikası](docs/ci-policy.md) geçerlidir: geliştirme push’unda hızlı doğrulama ve merge-base’ten itibaren birikimli değişikliklere göre hedefli testler; PR açılışı/güncellemesi full clean tetiklemez. Runtime/CI içeren son merge adayında `ci:full-clean` label’ını açıkça ekleyerek tam `npm run test:clean` çalıştır. Label varlığı/skipped job kabul değildir. Mevcut `ftksaas/merge-clean` başarılı kaynak-head/base/merge-tree ve gerçek full-clean kanıtına dayanır; güvenli yalnız-belge için ayrı kaynak bağlı kabul yolu kuruludur; head/base değişimi kabulü düşürür. Bağımsız incelemeyi son adayda doğrula. Merge sonrası aynı main SHA’sı ve full clean sonucunu paylaş. Yönetici erişimi olmayan required-check/strict-base ayarını uygulanmış sayma; mevcut required check’i bypass etme. İlk güvenilir workflow politika kurulumu ve koruma sınırı CI belgesinde açıkça ayrılır.

Test raporu doğrulanan kaynak SHA’sını ve kapsamını belirtir. Raporun bulunduğu commit’in kendi SHA’sını içine yazması veya henüz çalışmamış merge CI’ını başarılı göstermesi gerekmez. Merge kanıtı gerekiyorsa sonraki doğal belge güncellemesinde kaydedilir; sırf CI bağlantısı için sonsuz belge commit’i döngüsü oluşturma. Önceki tarihsel raporları yeniden yazma.

## Sıralı üretim ve clean bekleme

Aktif prompt/sıra [üretim kuyruğundadır](docs/production-queue.md). Bitiren ajan tamamlanan promptu oradaki kuralla kısaltır/kaldırır; kalan işleri ve kanıtları günceller.

## Full clean sırasında kullanıcıya devir — 19 Ekim 2026 son talimatı

Bu kural önceki otomatik devam/CI izleme talimatlarını yalnız bekleme davranışı bakımından değiştirir; merge için başarılı kabul şartını kaldırmaz.

- Aday veya main full clean tetiklendiği/çalışmaya başladığı doğrulanınca run URL/ID, head SHA, base SHA ve test edilen merge SHA (uygunsa), PR, kuyruk adımı ve sonraki eylemi son durum mesajında paylaş; turu bitir.
- Full clean bitene kadar polling, sleep/wait döngüsü, log takibi, gh run watch, tarayıcı yenileme, hatırlatıcı/otomasyon veya arka planda izleyici başlatma. Aynı clean'i tekrar tetikleme. Kullanıcı sonucu getirene kadar üretim/merge devamını durdur.
- Tetikleme yanıtında run URL henüz yoksa workflow/PR/head ve tetikleme zamanını kaydet; bekleyerek run arama. Kullanıcı dönüşünde eşleştir.
- Kullanıcı “clean bitti/başarılı” dediğinde yeniden çalışmaya başla; bildirimi tek başına başarı kanıtı sayma. GitHub'dan o run'ın durumunu/sonucunu, güncel head/base ve kaynak bağlı kabulü bir kez doğrula.
- Run hâlâ çalışıyorsa yeniden izlemeye geçme; durumunu bildir ve turu bitir. Başarısızsa ilgili hatayı incele, odaklı düzeltme yap; kaynak değişince eski clean'i yeni kaynağa taşıma.
- Aday kabulü ve inceleme geçerliyse mevcut yetki kapsamında merge et. Main clean başlarsa yeniden aynı kullanıcıya devir kuralını uygula; main kabulü doğrulanmadan işi tamamlandı sayma.
- CI kendi kendine çalışmaya devam eder; duracak olan Work ajanının aktif izlemesidir. Bu talimat workflow iptal etme veya testleri atlama talimatı değildir.

