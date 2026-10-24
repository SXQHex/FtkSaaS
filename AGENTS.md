# FtkSaaS çalışma kuralları

24 Ekim son kullanıcı kabulü: 17 kullanıcı/22 merkez/21 organizasyon/9 platform olmak üzere 69 ana ayar grubu tamamlandı. Önce kararları yaşayan belgelerde birleştir ve alan/değer/yetki/API matrisiyle açık ayrıntıları çöz; bu kapanış yeni settings runtime/DTO/API geliştirmesi başlatmaz. Mevcut yerel platform-settings taslağı yayımlanmış sayılmaz. Frontend tasarımına müdahale etme.

P01–P07/PR40 kod/main/development kabulü kapandı; runtime main4cfc9a55, belge main7020638;200 API/0 contract_only/59 migration/90 core tablo/Edge8. Beş hosted worker temel kurulum ve idle heartbeat doğrulaması geçti. Fiziksel imha/yük/restore ve ek işletim kabulü açık; ayrıntılar [güncel devir](contracts/00-FtkSaaS-yeni-sohbet-devir.md). Eski GitHub ertelemesi ve PR40 pending notları tarihsel sınırdır; mevcut görev yalnız belge eşitlemesidir.

[Ayarlar sözleşmesi](contracts/02-FtkSaaS-teknik-sozlesme.md#ayarlar-sozlesmesi-ve-davranis-sprinti) 69 S/M/O/P kabul grubunu ve açık alt alanları ayırır. Davranış grubu numaraları eski Word aileleri ve üretim P01–P08 kuyruğuyla karıştırılmaz. Yeni davranış kararı otomatik runtime kabulü değildir. Word dosyası ayrı otorite değildir.

Vercel Sandbox yalnız yerelde çalıştırmanın mümkün olmadığı zorunlu dar doğrulamada kullanılabilir; kanıt alınınca durdurulur. Bu belge görevinde native test/Sandbox veya runtime full clean gerektiren kaynak değişikliği yapılmaz. Mevcut CI kapıları/izin listesi değiştirilmez; güvenli yalnız-belge yolu kaynak bağlı olarak doğrulanır.

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

