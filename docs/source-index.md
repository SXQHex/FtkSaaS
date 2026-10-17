# FtkSaaS kaynak indeksi

Repository’nin güncel dalı `main`dir. Başlarken GitHub main SHA’sını ve aynı SHA’nın CI’ını doğrulayın; bu dosyalardaki son doğrulanmış snapshot yeni commit’e otomatik başarı vermez. Yerel/ZIP kopyaları alındıkları SHA’nın snapshot’ıdır. İkinci belge ağacı kullanılmaz.

## Okuma sırası ve roller

| Sıra | Kaynak | Rol |
|---|---|---|
| 1 | [AGENTS.md](../AGENTS.md) | Tüm ajanların başlangıç, alan, kanıt ve iş kapanış kuralları |
| 2 | [00 güncel devir](../contracts/00-FtkSaaS-yeni-sohbet-devir.md) | Kısa doğrulanmış başlangıç ve tarihsel metin sınırı |
| 3 | [Kalan işler](remaining-work.md) | Yalnız sözleşme işlemleri ve operasyonel kabul açıkları |
| 4 | [Claude devri](claude-handover.md) | Gerçek bağlantı, istekler, mevcut uygulama sınırları |
| 5 | [01 ürün kapsamı](../contracts/01-FtkSaaS-urun-kapsam-sozlesmesi.md) | Ürün kapsamı; eski teknik durum sayıları tarihsel |
| 6 | [02 teknik sözleşme](../contracts/02-FtkSaaS-teknik-sozlesme.md) | Kabul edilmiş davranış; D01–D09 ve U01–U08 değişiklikleri |
| 7 | [03 sorumluluklar](../contracts/03-FtkSaaS-kodlama-sorumluluklari.md) | Backend/frontend alan sahipliği; güncel çalışma düzeni kök AGENTS’ta |
| 8 | [04 şema](../contracts/04-FtkSaaS-O4-veri-semasi.md), [05 API](../contracts/05-FtkSaaS-O4-API-katalogu.md), [06 durum/hata/izin](../contracts/06-FtkSaaS-O4-durum-hata-izin.md) | Fiziksel/API sözlükleri; kesin DDL supabase/migrations, işlem tipleri 08 |
| 9 | [08 makine sözleşmesi](../contracts/08-FtkSaaS-tip-ve-operasyon-sozlesmesi.json) | Tipler, işlem/izin/guard ve implementation_status; katalog varlığı runtime kabulü değildir |
| 10 | [Endpoint envanteri](endpoint-inventory.json), [runtime listesi](../supabase/functions/backend-v1/implemented.json) | Üretilmiş 184 işlem envanteri ve 69 çağrılabilir işlem; 115 contract_only |

## Kabul edilmiş kararlar

Son açık kullanıcı kararı üstündür; sonraki kabul yalnız çelişen hükümleri değiştirir. D01–D09 ve U01–U08 [02 sözleşmesindedir](../contracts/02-FtkSaaS-teknik-sozlesme.md). [Q-D01](../contracts/10-FtkSaaS-Q-D01-kabul-karari.md) etkinlik etiket/paket matrisi ve negatif kredi yasağıdır. [Q-E01 kabulü](decisions/Q-E01-accepted.md) ve [aktarımı](decisions/Q-E01.md) ödeme hazırlığıdır. [Q-E02](decisions/Q-E02.md) merkez iptalinin tam para/hak sonucu; [Q-E03](decisions/Q-E03.md) planlanan başlangıca göre katılımcı parasal sınırıdır. [Fiilî başlangıç devri](actual-start-handover.md) mevcut operasyonel kaydı açıklar; eski kararların “başlangıç API’si yok” durum notu güncel uygulama açığı değildir. Kısmi gerçekleşme için yeni oran/para/hak kuralı türetilmez.

## Kanıtlar ve tarihsel kayıtlar

[Uzak backend kurulumu](remote-backend-setup.md) ve [smoke raporu](../reports/remote-backend-verification.json) bağlantı/erişim kanıtıdır; temiz CI’daki 181 testi uzak projede tekrar etmez. Geliştirici beyanı, repository raporu ve bağımsız CI sonucu farklı kanıt türleridir. Tam kaynak SHA’sı ve test kapsamı birlikte okunur.

[Oda/rol raporu](../reports/room-role-verification.json), [registry raporu](../reports/registry-verification.json), [fiilî başlangıç raporu](../reports/actual-start-verification.json), [Q-E03 raporu](../reports/qe03-verification.json), [Q-E02 raporu](../reports/qe02-verification.json), [Q-E01 raporu](../reports/qe01-verification.json) ait oldukları uygulama snapshot’larının kayıtlarıdır. Son main CI yerine kullanılmaz.

[07 denetim](../contracts/07-FtkSaaS-O4-denetim-ve-aciklar.md), [09 ilk aktarım](../contracts/09-FtkSaaS-teknik-aktarim-raporu.md), [11 Q-D01 aktarımı](../contracts/11-FtkSaaS-Q-D01-teknik-aktarim-raporu.md) ve [eski kaynak JSON’u](../contracts/source-v2.2/08-FtkSaaS-tip-ve-operasyon-sozlesmesi.json) tarihsel kanıt/tasarım kayıtlarıdır. Açıklarını güncel karar, envanter, devir ve aynı SHA’nın CI’ıyla karşılaştırmadan yeniden açmayın. reports/ tarihsel kayıtları yeniden yazılmaz.

## Kalıcı kapanış kuralı

Her uygulama PR’si etkilediği sözleşmeleri, envanteri, kalan işleri ve devri aynı PR’de günceller; etkilenmeyen belgelere dokunmaz. [AGENTS.md](../AGENTS.md) kanıt/SHA ve merge sonrası CI teslimini tanımlar. Yeni ürün kararı, teknik aktarım, uygulama ve kabul ayrı izlenir. Dış e-posta ertelendi; Resend başlatılmaz. Yük/restore ve frontend gerçek kabulü açıktır. Production dağıtımı yapılmaz.

[Uygunluk/politika kapsam raporu](../reports/availability-policy-verification.json) yeni kaynak SHA ve odaklı test kapsamını belirtir. Son PR/main temiz CI ve hosted smoke ayrı kanıtlardır.
