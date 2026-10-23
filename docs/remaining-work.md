# Kalan backend ve entegrasyon işleri

23 Ekim 2026 belge tabanı main `bfb8ccb29a1e0ca9efde7813dc3af4bbbad8768d`. P01–P07 kod/main/geliştirme-test kabulü tamamlandı; **200 API/0 contract_only/59 migration**. Eski178/22 ve PR40 pending listeleri güncel açık API listesi değildir. Kanıt [tek devirde](../contracts/00-FtkSaaS-yeni-sohbet-devir.md).

## Aktif görev ve durdurulmuş geliştirme

Frontend başlangıcı için belgeler eşitleniyor; [Claude talimatları](claude-handover.md) ve [settings davranışları](../contracts/02-FtkSaaS-teknik-sozlesme.md#ayarlar-sozlesmesi-ve-davranis-sprinti) güncel giriş noktalarıdır. Kullanıcı S01–S10 grupları kabul edildi. Kalan kullanıcı/merkez/organizasyon/platform davranışları netleşmeden yeni settings API/DTO/runtime geliştirmesi durduruldu. Yerel feature/platform-settings taslağı208 endpoint/60. migration ile yayımlanmış kaynak değildir; bu belge PR'sine dahil edilmez ve frontend tarafından kullanılmaz.

| İş | Durum ve kapanış koşulu |
|---|---|
| Organizasyon renk/font paketleri | Kullanıcı hazır marka paketleri ve kişisel görünüm ayrımını kabul etti. [Frontend ihtiyaç notu](claude-handover.md) içindeki organizasyon renk ve font paketleri bölümüne göre mevcut alan/API, canlı org yetkisi, katalog/sürüm/fallback, logo hattı, ortak tip ve kabul senaryoları eşlenecek. Not callable/runtime değildir; settings geliştirmesini durdurma kararı korunur. |
| Kabul edilmiş ayarların alan eşlemesi | Her alan için mevcut read/write/DTO, izin/plan, sürüm/preview, veri kaynağı, sağlayıcı, cihaz/senkron kapsamı ve kabul senaryosu çıkarılacak. Kabul edilmiş davranış otomatik runtime değil. |
| Kalan settings kararları | Takvim aboneliği; bildirim olay/kanal/sıklık/sessiz saat; pazarlama/ilgi/reklam/analitik ayrıntıları; görünürlük/izin; veri talepleri/silme/sıfırlama. Ardından C/O/P grupları. |
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

[Üretim kuyruğu](production-queue.md#p08--geliştirmeler) tam kapsamdır: organizasyon bazlı sabit abone numarası; web/Instagram/Facebook/Google formları için kaynak izlenen ortak CRM başvurusu; kadın/erkek kontenjanı; sınırsız etkinlik kapasitesi ve Business limit temsili; ders kredisi tüketmeyen pakete bağlı Pratik uygunluğu. Yeni ayar endpoint'iyle bu farklara bypass kurulmaz.

Mevcut kurulum20 kontenjan/100 tekrar/4 ders/2 ay; geçerli ve kullanılabilir ders hakkı birlikte sürerken ücretsiz Pratik hedefi P08'dir. Ayrı4 etkinlik sayacı, sonraki hafta uzatması veya ayrıca süresiz program işi açılmaz. Ayrıntılı gerçek kurulum verileri kuyrukta tarihli aktarım kaydıdır; gerçekleşmiş seans/satış/yoklama kanıtı değildir.
