# Kalan backend ve entegrasyon işleri

25 Ekim uzlaştırması: FD01–FD12 kararları kapalı; [kaynak/main/PR43–45 kabul tablosu](../contracts/00-FtkSaaS-yeni-sohbet-devir.md) ve [tek kapasite/giriş kararı](../contracts/02-FtkSaaS-teknik-sozlesme.md#oda-seans-kapasite-karari) geçerlidir. Main200/59; PR45 adayı201/60 bağımsız inceleme/aday clean başarılı, merge/main/CD bekliyor. Settings belge çalışması runtime teslimi değildir.

24 Ekim 2026 belge tabanı main `702063807b0a0d09f559f070ffde1b1ae3e7563b`. P01–P07 kod/main/geliştirme-test kabulü tamamlandı; **200 API/0 contract_only/59 migration**. Eski178/22 ve PR40 pending listeleri güncel açık API listesi değildir. Kanıt [tek devirde](../contracts/00-FtkSaaS-yeni-sohbet-devir.md).

## Aktif görev — beş ayar ekranı ve API teslimi

Frontend başlangıcı için belgeler eşitleniyor; [Claude talimatları](claude-handover.md) ve [settings davranışları](../contracts/02-FtkSaaS-teknik-sozlesme.md#ayarlar-sozlesmesi-ve-davranis-sprinti) güncel giriş noktalarıdır. 69 ana grup kabul edildi: 17 kullanıcı, 22 merkez, 21 organizasyon, 9 platform. Grup görüşmesi kapandı. Son talimat kullanıcı–üye–merkez–org–platform ekranları ve gerçek API teslimidir; [somut alan/API matrisi](claude-handover.md) hazır ve eksik yolları ayırır. SQL/Cron/DB/worker teknik yönetim ayarları ertelendi; uygulama verisi kalıcılığı ve kabul kontrolleri ertelenmedi. Yerel feature/platform-settings taslağı208 endpoint/60. migration ile yayımlanmış kaynak değildir; bu belge PR'sine dahil edilmez ve frontend tarafından kullanılmaz.

| İş | Durum ve kapanış koşulu |
|---|---|
| Frontend karar kapanışı | [FD01–FD12](../contracts/02-FtkSaaS-teknik-sozlesme.md#ayarlar-backend-frontend-siniflama) 25 Ekim kullanıcı kabulüyle kapandı. Yeni tur açılmaz; sıradaki iş gerçek alan/DTO/permission/API/sürüm ve kabul açığıdır. Standart negatif limit 0, mevcut kulüp −2. Karar uygulanmış config/API değildir. |
| Beş ekran/API kabulü | Kullanıcı global hesap, üye org person/relationship ve org tercihi; merkez/org/platform scope ayrı. Her ekran alan/tip/default, yetki/miras, gerçek read-write/sürüm, hata ve kabul senaryosuyla teslim edilir. Mevcut API ile eksik alanlar ayrıdır; genel settings/marka API boşluğu kapanmadan beş ekran çalışıyor denmez. |
| Ertelenmiş altyapı ayarları | Worker/pg_cron/DB bağlantı-RLS-grant/search_path/network/SSL, migration/deploy/yedek-restore motoru ve teknik limit yönetimi ayrı iş. Eski sekiz endpointli 208/60 taslak bu hedefin yerine geçmez. |
| Frontend PR43 renk/font ihtiyacı | [PR43](https://github.com/SXQHex/FtkSaaS/pull/43) okundu; hazır org marka paketi ve S08 kişisel görünüm ayrımı teknik sözleşmede O01/S08/P01/P04 alan eşlemesine bağlandı. Katalog, read/write/reset, logo, canlı yetki, sürüm/cache/fallback, ortak tip ve gerçek E2E açık; isimler öneri, API hazır değil. PR43 ayrı açık branch olarak korunur. |
| Kabul edilmiş ayarların alan eşlemesi | Her alan için mevcut read/write/DTO, izin/plan, sürüm/preview, veri kaynağı, sağlayıcı, cihaz/senkron kapsamı ve kabul senaryosu çıkarılacak. Kabul edilmiş davranış otomatik runtime değil. |
| Açık settings alanları | 69 grup tekrar onaylatılmayacak. Somut süre/limit/default, dil/sağlayıcı/kitle, miras/yerel/yayın/reset ve kesin permission/ek onay eşlemesi teknik sözleşmedeki tek matriste çözülecek. API uygunluğu ve runtime testi ayrı kanıtlanacak. |
| P03 eğitmen ödeme doğrulaması | instructor_payment_record_v1 tutarı karşılandıktan sonra kullanılmayan trailing earning_ids için de kişi/merkez/para birimi doğrulaması ve karışık kapsam regresyonu. Review5594023911; başka tenant'a allocation/para sızıntısı tespit edilmedi, iyileştirme henüz uygulanmadı. |
| Güvenlik sertleştirmesi | private.ops_run connection/role search_path sabitlemesi ve public.rls_auto_enable gereksiz EXECUTE izinlerinin kaldırılması kaynak kabulüyle yapılacak. ops_run üzerine SET clause eklenmez: COMMIT bozulur. Event-trigger dönüş tipi doğrudan normal çağrıyı reddeder; uyarılar kanıtlanmış dış saldırı gibi sunulmaz. |
| Parola koruması uyarısı | Kullanıcı Free plan kısıtı nedeniyle kapsam dışında bıraktı; çözülmüş sayılmaz, geliştirme engeli yapılmaz. |
| Fiziksel gizlilik imhası | DB saklama/hukuki bekletme, native Auth, Storage, export/geçici kopya ve backup/restore imha kanıtları gerekir. Eksikte partial/pending/completed_at=null. Hukuki süreler ayrıca teyit edilir. |
| Worker işletimi | Beş Cron/dedicated LOGIN/scope ve idle heartbeat kuruldu, failed0/claimed0. P07 için gerçek iş yükü, hosted kesinti/disable-restart ve erasure kabulü bu boş kuyruk kontrolünden çıkarılmaz. |
| P04 gerçek sağlayıcı kabulü | Yayın hedefli mevcut public başvuru için gerçek hostname/Turnstile/signed gateway ve gerçek deneme ürün/politika/config kanıtı. Genel telefon tabanlı formlar P08'dir. |
| İlk kulüp kurulumunun kalanları | Programlar/ürün kimliği inactive; ürün sürümü/seans/satış/yoklama/anlaşma/etkinlik henüz kurulmadı. Oda ücreti tercihi/dış mekân/etkinlik şartları ve P08 ders tüketmeyen uygunluk bağımlılığı var; yeni varsayılan yaratılmaz. |
| CI dar profil bakımı | P02 ortak kaynak değişimleri güvenli geniş fallback kullanıyor. Dar profil ayrı kanıtlı CI bakımı; full/main kapsamı azaltılmaz. |
| Repository koruması | Required-check/strict-base/bypass yönetici ayarlarının bu bağlantıyla uygulanması/doğrulanması açık. CI kaynak kapısı yönetim ayarı kanıtı değildir. |
| Frontend uçtan uca kabul | Claude alanı; gerçek sentetik Auth/Edge/DTO/rol/plan/stale/replay/hata senaryoları gerekir. Tasarım veya mock başarı kanıtı değildir. |
| Dış e-posta | Ertelendi; Resend/SMTP kurulumu ve gerçek teslim kabulü yok. Yerel Mailpit dış teslim sayılmaz. |
| Yük yedek restore production | Ayrı doğrulama/işletim/izin kapsamı; development CD production yetkisi değildir. |

## P08 geliştirmeler

[Üretim kuyruğu](production-queue.md#p08--geliştirmeler) tam kapsamdır: organizasyon bazlı sabit abone numarası; web/Instagram/Facebook/Google formları için kaynak izlenen ortak CRM başvurusu; PR45 adayında tamamlanan fakat main/CD bekleyen kategori kapasitesi; ayrı sınırsız etkinlik kapasitesi ve Business limit temsili; ders kredisi tüketmeyen pakete bağlı Pratik uygunluğu. Yeni ayar endpoint'iyle bu farklara bypass kurulmaz.

Mevcut kurulum20 kontenjan/100 tekrar/4 ders/2 ay; geçerli ve kullanılabilir ders hakkı birlikte sürerken ücretsiz Pratik hedefi P08'dir. Ayrı4 etkinlik sayacı, sonraki hafta uzatması veya ayrıca süresiz program işi açılmaz. Ayrıntılı gerçek kurulum verileri kuyrukta tarihli aktarım kaydıdır; gerçekleşmiş seans/satış/yoklama kanıtı değildir.

Instagram ile giriş/kayıt/hesap bağlama kapsam dışıdır. Buradaki Instagram/Facebook/Google reklam başvuru kaynakları ayrı ortak CRM/P08 veri alımıdır; sosyal login yöntemi veya kurulmuş entegrasyon değildir.
