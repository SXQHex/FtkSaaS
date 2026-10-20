# FtkSaaS çalışma kuralları

## P01 teslim sınırı — son kullanıcı kararı

P01 bütünü `feature/p01-request-reservation-flow` dalında ve mevcut PR #22 içinde geliştirilir. Her uygulama commit'i hedefli doğrulanır; A/B/C ara dilimleri için aday full clean veya merge yapılmaz. P01'in bütün kalan API ve worker kabulü tamamlandığında son head bağımsız incelenir, toplu aday full clean alınır ve normal kaynak bağlı kapıyla merge edilir. Main full clean kabulü ayrıca gerekir. Full clean başlayınca aşağıdaki kullanıcıya devir kuralı korunur.


## Başlangıç ve kaynak önceliği

İşe başlarken çalışılan tam SHA’yı belirt. Önce [kaynak indeksini](docs/source-index.md), [güncel devri](contracts/00-FtkSaaS-yeni-sohbet-devir.md), [kalan işleri](docs/remaining-work.md), [entegrasyon devrini](docs/claude-handover.md), sonra görevle ilgili sözleşme ve kararları oku. GitHub’dan güncel main/PR ve aynı SHA’nın CI durumunu doğrula; eski başarıyı yeni SHA’ya taşıma.

Son açık kullanıcı kararı üstündür. D01–D09, U01–U08, Q-D01, Q-E02 ve Q-E03 korunur. Sonraki kabul edilmiş karar yalnız çelişen hükümleri değiştirir. Alt katalog veya uygulama üst kararı sessizce değiştiremez; bilinmeyen ürün/config değerlerini uydurma.

Ürün kararı, teknik aktarım, çalışan uygulama ve doğrulanmış kabul ayrı durumlardır. Geliştirici beyanı, repository raporu ve bağımsız CI kanıtını ayrı belirt. Raporun kaynak SHA’sını/kapsamını kontrol et. Eski raporlardaki açıkları güncel runtime/karar/CI ile karşılaştırmadan yeniden açık ilan etme. Uzak Auth → Edge → RPC smoke temiz CI kabulünün yerine geçmez.

## Alan ve güvenlik sınırları

Frontend tasarımına/istemci koduna müdahale etme. Production dağıtımı yapma; main merge dağıtım izni değildir. Secrets, tokenlar, parolalar ve kişisel verileri kaynaklara/raporlara yazma; sentetik test verisi kullan. Uygulanmış migration değiştirilmez. Dış e-posta ertelendi; uygulanmış sayma ve Resend entegrasyonu başlatma. Yük/restore ve frontend gerçek entegrasyon kabulünü kanıtsız kapatma.

## Her uygulama PR’sinin kapanışı

Etkilenen sözleşme/karar aktarımını, işlem envanterini, kalan işleri ve devir notlarını aynı PR içinde güncelle. Etkilenmeyen belgeleri gereksiz değiştirme; ikinci paralel belge ağacı oluşturma. İşlem durumunu makine sözleşmesi, runtime listesi ve üretilmiş endpoint envanteriyle karşılaştır. Üretilen dosyalar için mevcut üretim komutlarını kullan.

Belge bağlantılarını, kaynak önceliğini ve envanter tutarlılığını kontrol et. [CI politikası](docs/ci-policy.md) geçerlidir: geliştirme push’unda hızlı doğrulama ve merge-base’ten itibaren birikimli değişikliklere göre hedefli testler; PR açılışı/güncellemesi full clean tetiklemez. Son merge adayında `ci:full-clean` label’ını açıkça ekleyerek tam `npm run test:clean` çalıştır. Label varlığı/skipped job kabul değildir. `ftksaas/merge-clean` başarılı kaynak-head/base/merge-tree ve gerçek full-clean kanıtına dayanır; head/base değişimi kabulü düşürür. Bağımsız incelemeyi son adayda doğrula. Merge sonrası aynı main SHA’sı ve full clean sonucunu paylaş. Yönetici erişimi olmayan required-check/strict-base ayarını uygulanmış sayma; mevcut required check’i bypass etme. İlk güvenilir workflow politika kurulumu ve koruma sınırı CI belgesinde açıkça ayrılır.

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
