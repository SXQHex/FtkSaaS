# FtkSaaS kaynak indeksi

24 Ekim 2026 inceleme tabanı main `702063807b0a0d09f559f070ffde1b1ae3e7563b`. Yayımlanmış kapsam **200 sözleşme / 200 runtime / 0 contract_only / 59 migration / 90 core tablo / Edge8**. P01–P07 kod/main/geliştirme-test kabulü kapandı. Ürün, işletim ve frontend kabulü API sayısından türetilmez.

Öncelik artık beş ayar ekranı ve typed API teslimidir: kullanıcı/global hesap, üye/org person ve tercihi, merkez, org, platform. SQL/Cron/DB işletim ayarları ayrı backlog. [Somut ekran/alan/API matrisi](claude-handover.md) mevcut desteği ve açıkları gösterir.

Önce [backend/frontend ayrımı, 69 kararın beş frontend scope eşlemesi ve FD açık kararları](../contracts/02-FtkSaaS-teknik-sozlesme.md#ayarlar-backend-frontend-siniflama) okunur. Yeni sıra sınıflama → eksik frontend kararları → gerçek typed API/ekran teslimidir.

## Başlangıç sırası

1. [AGENTS](../AGENTS.md): alan sahipliği, kaynak kanıtı ve full clean sırasında kullanıcıya devir.
2. [00 güncel devir](../contracts/00-FtkSaaS-yeni-sohbet-devir.md): kaynak/run/tree/CD receipt ve hosted temel kurulum kanıtı.
3. [Kalan işler](remaining-work.md) ve [üretim kuyruğu](production-queue.md): gerçek açıklar; P08 abone numarası ve ortak çok kaynaklı CRM.
4. [Claude frontend talimatları](claude-handover.md): gerçek API/DTO, istek, sürüm, ortam, güvenlik ve tasarım sınırları. Kökte otomatik yüklenen CLAUDE.md bulunmadığından bu dosya açıkça okutulur.
5. [02 ayarlar sözleşmesi](../contracts/02-FtkSaaS-teknik-sozlesme.md#ayarlar-sozlesmesi-ve-davranis-sprinti): S01–S17, M01–M22, organizasyon O01–O21 ve platform P01–P09: 69 ana grup kabul edildi; somut değerler/yetkiler/sağlayıcılar alan bazında açık. Yeni ayar davranışlarının tümü mevcut API'de var değildir. Yerel 208 API/60. migration taslağı yayımlanmamıştır.
6. Görevle ilgili ürün/teknik sözleşme, kabul edilmiş karar ve gerçek makine/TypeScript DTO'su.

Son açık kullanıcı kararı üstündür; sonraki kabul yalnız çelişen hükümleri değiştirir. Kabul edilmiş ürün davranışı, teknik aktarım, callable uygulama ve doğrulanmış kabul ayrı tutulur. Eski bir rapor veya modül devrindeki pending notu güncel kaynak kanıtından üstün değildir.

## Sözleşmelerin ayrı inceleme kaydı

| Belge | Rol ve inceleme sonucu |
|---|---|
| [00 devir](../contracts/00-FtkSaaS-yeni-sohbet-devir.md) | Güncel başlangıç. P07 aday/main/CD, PR41 belge kabulü ve beş Cron heartbeat kanıtı eklendi; önceki kaynaklar tarihsel bölümde. |
| [01 ürün](../contracts/01-FtkSaaS-urun-kapsam-sozlesmesi.md) | Normatif ürün kapsamı. Ayar davranış kabulü/uygulama ayrımı, güncel kişi verisi ve P08 abone numarası sınırı eşitlendi. |
| [02 teknik](../contracts/02-FtkSaaS-teknik-sozlesme.md) | Normatif teknik davranış. Word v0.1 settings kataloğu tek Markdown kaynağına aktarıldı; 69 ana grubun kabulü, eski Word aileleri ve açık alt alanlar ayrı; numara kapsamları karıştırılmaz. |
| [03 sorumluluklar](../contracts/03-FtkSaaS-kodlama-sorumluluklari.md) | ChatGPT backend / Claude frontend sınırı, ortak tiplerin gerçek yolu ve durdurulmuş settings geliştirmesi güncellendi. |
| [04 şema](../contracts/04-FtkSaaS-O4-veri-semasi.md) | Üretilmiş katalog; 90 tablo/59 migration doğrulanır. Kesin DDL migrations içindedir. Yeni settings alanı elle eklenmedi. |
| [05 API](../contracts/05-FtkSaaS-O4-API-katalogu.md) | Üretilmiş 200 callable operasyon kataloğu. DTO kaynağı 08; kapsam notu gerçek sağlayıcı kabulünün yerine geçmez. |
| [06 durum/hata/izin](../contracts/06-FtkSaaS-O4-durum-hata-izin.md) | Yeni ayarlar için uydurma enum/izin eklenmedi. Global kimlik, oturum ve görünüm yetki sınırları eşitlendi. |
| [07 denetim](../contracts/07-FtkSaaS-O4-denetim-ve-aciklar.md) | İlk tasarım denetimi; tarihsel açık listesi güncel teslim listesi olarak kullanılmaz. Değiştirilmedi. |
| [08 makine sözleşmesi](../contracts/08-FtkSaaS-tip-ve-operasyon-sozlesmesi.json) | Callable DTO/izin/guard/faz/sürüm kaynağı. 200/200/0 doğrulanır. Eski decision_delivery/feature_delivery notları ürünün tüm kabulü değildir; değişiklik yapılmadı. |
| [09 aktarım](../contracts/09-FtkSaaS-teknik-aktarim-raporu.md) | İlk aktarımın kaynak raporu; bugünün CI/hosted kabulü yerine kullanılmaz. Değiştirilmedi. |
| [10 Q-D01](../contracts/10-FtkSaaS-Q-D01-kabul-karari.md) | Etkinlik disiplin/kapsam ve negatif kredi yasağı kabulü; ürün hükmü korundu. |
| [11 Q-D01 aktarım](../contracts/11-FtkSaaS-Q-D01-teknik-aktarim-raporu.md) | Kaynağına ait tarihsel aktarım raporu; yeniden yazılmadı. |
| [12 Q-E02](../contracts/12-FtkSaaS-Q-E02-kabul-karari.md) | Merkez iptalinin her aşamada tam para/hak sonucu; Q-E03 ve fiilî başlangıç ayrımı korunur. |
| [source-v2.2](../contracts/source-v2.2/08-FtkSaaS-tip-ve-operasyon-sozlesmesi.json) | Eski makine sözleşmesi snapshotı; aktif istemci üretim kaynağı değildir. |

## Entegrasyon ve işletim belgelerinin ayrı incelemesi

| Belge | Rol ve inceleme sonucu |
|---|---|
| [Claude devri](claude-handover.md) | Baştan güncellendi. Eski 119 işlem/eksik backend yönlendirmesi kaldırıldı; mevcut API ile kabul edilmiş gelecek ayarlar ayrıldı. |
| [API invariants](api-invariants.md) | Canlı yetki, idempotency, sürüm/preview ve gizli alan sınırları korundu; profil sürüm okuması ve Auth tamamlama ayrımı eklendi. |
| [Fiziksel invariants](physical-invariants.md) | Kilit/indeks, hak/zaman ve migration kabul ilkeleri incelendi; SQL uygulama kanıtı olmadığı açıklaması yerinde, değişiklik gerekmedi. |
| [Hosted kurulum](remote-backend-setup.md) | 59 migration/Edge8, beş dedicated LOGIN Cron ve 23 Ekim health kaydı. 3600sn quote/900sn reauth kullanıcı seçimi; evrensel varsayılan değil. |
| [Bağlantı JSON'u](development-connection.json) | URL/yerel hazırlık yönergesi kullanılabilir; 0 observed/22 migration ve ilk rapor alanları tarihsel kurulum snapshotıdır. Güncel hosted envanter olarak kullanılmaz. Runtime/CI girdisi olabileceği için bu prose tesliminde değiştirilmedi. |
| [Endpoint envanteri](endpoint-inventory.json) | Üretilmiş 200/200/0 callable envanteri; generate --check ile eşleşmesi doğrulanır, elle değiştirilmedi. |
| [Özellik haritası](feature-delivery.md) | Üretilmiş F01–F33 eşlemesi. İşlem varlığı gerçek sağlayıcı/operasyonel/üretim kabulü değildir; mevcut partial/pending kanıtları topluca kapatılmadı. |
| [Kalan işler](remaining-work.md) | Baştan güncellendi; kapanan API'ler açık listeden çıkarıldı, settings/P08/sağlayıcı/güvenlik/işletim açıkları ayrıldı. |
| [Üretim kuyruğu](production-queue.md) | P01–P07 ve OPS kaynak kapanışı; P08 ortak CRM/abone no/etkinlik hakkı. Eski Draft/CI bekletme aktif talimat olmaktan çıkarıldı. |
| [CI politikası](ci-policy.md) | Kurulu yalnız-belge kabulü ile full/main clean ayrımı korunur; tarihsel bakım/CD anlatımı güncel kuyruk sayılmaz. |
| [CI-02 devri](ci02-handover.md) | Kaynak bazlı kurulum/tam shard kanıtı korunur; P02 başlamadı ifadesinin tarihsel sınırı düzeltildi. |
| [CI performansı](ci-performance.md) | Eski kaynak ölçümleri değiştirilmedi. Son P07 süresi ayrı; belge kabulü runtime performans kıyası değildir. |
| [Branch koruması](branch-protection-review.md) | Kaynak kapısı kuruludur; yönetici required-check/strict-base ayarları bu bağlantıyla doğrulanmış sayılmaz. |
| [README](../README.md), [AGENTS](../AGENTS.md), [CHANGELOG](../CHANGELOG.md) | Frontend başlangıcı, durdurulmuş settings taslağı, kapsam ve doğrulama yolu eşitlendi. |

## Modül devirlerinin ayrı incelemesi

Bu belgelerin eski SHA/test/migration sayıları ilk teslimlerinin kanıtıdır. Yeni kaynak için eski başarı taşınmaz; güncel kaynak/main/CD kaydı 00 devirde aranır.

| Belge | İnceleme sonucu |
|---|---|
| [Fiilî başlangıç](actual-start-handover.md) | Event record/correct, Q-E03 parasal sınır ve audit ayrımı doğru; eski aktif envanter başlığı güncellendi. |
| [Takvim okumaları](schedule-read-handover.md) | Interval/cursor/görünürlük korunur. Public discovery P04 ile uygulanmış; gerçek sağlayıcı kabulü ve frontend/yük ayrıldı. |
| [Program/seans](program-session-handover.md) | Immutable program/override/sürüm kuralları korunur. P02 seans iptali/yerine seans artık açık gösterilmez; gece/gün aşan birleşik uygunluk sınırı korunur. |
| [Starter koruma](starter-attendance-protection-handover.md) | P02 hak koruma, P03 ödeme ve P05 belge tüketicileri güncellendi; ilk PR'nin test kanıtı değiştirilmedi. |
| [Anlaşma/hakediş](instructor-earnings-handover.md) | P03 ödeme artık contract_only gösterilmez. Frozen değerleme ve açık başlangıç korunur; trailing earning_ids iyileştirmesi ayrı açık. |
| [Hesaplaşma](settlement-handover.md) | A/B bağımsız canlı yetki ve ledger korunur. Sonradan tamamlanan P02/P03 bağımlılıkları açık listeden çıkarıldı. |
| [DS sprint devri](decision-sprint-handover.md) | İlk aktarımın hedef/runtime farkları tarihsel ayrıldı; güncel hak/belge/CI-02 uygulaması düzeltildi. Yeni ayar sprintinin normatif kaynağı 02'dir. |
| [P01](p01-handover.md) | Kaynak/main kabulü tamam; dedicated worker/scope kurulumu ve boş kuyruk sınırı eklendi. |
| [P02](p02-handover.md) | PR28/main kabulü kapanmış, geliştirme pending notları snapshot. Güncel ödeme entegrasyonu P03 ile tamam; dosya ilk teslim kanıtı olarak korunur. |
| [P03](p03-handover.md) | PR30/main kabulü kapanmış tarihsel geliştirme notu. Açık trailing earning_ids doğrulaması kalan işlerde; yedi API kapalı sayılmaz. |
| [P04](p04-handover.md) | CRM/public API kaynak/CD kabulü kapalı. Gerçek hostname/bot/gateway/deneme kurulumu ayrı; telefon tabanlı ortak reklam/web CRM P08'dir. |
| [P05](p05-handover.md) | Belge/in-app/otomasyon kaynak/main/CD kabulü kapalı. İlk aday hataları kaynak tarihçesi; dış e-posta teslimi kabul edilmiş değil. |
| [P06](p06-handover.md) | PR38/main/CD kabulü kapalı. OPS/P07 queued notu kendi tarihine ait; bugün aktif sıra değildir. |
| [OPS-W01](ops-w01-handover.md) | Üç lane kurulum/disable-restart boş kuyruk kanıtı korunur. Sonradan tenant bağlandı, P07 iki lane eklendi; güncel beş lane için hosted kurulum okunur. |
| [P07 A+B+C](p07-a-handover.md) | İlk Draft/pending/GitHub erteleme ve dar teşhis kayıtları tarihsel. Son PR40 aday/main/CD tamamlandı; eski belge yeniden CI tetikleme talimatı değildir. |

## Karar belgeleri

| Kaynak | Güncel anlamı |
|---|---|
| [Q-D01 köprüsü](karar-sohbetine-Q-D01.md) | Etkinlik kapsamı/negatif kredi kabul ve runtime bağlantısı; açık yeniden açılmaz. |
| [Q-E01 kabulü](decisions/Q-E01-accepted.md) ve [aktarımı](decisions/Q-E01.md) | Ödeme hazırlığı ve kesin kayıt; eski aktarım bekliyor sayısı düzeltildi. Merkez iptalinde Q-E02 üstündür. |
| [Q-E02](decisions/Q-E02.md) | Her aşamada tam merkez iptali sonucu; fiilî başlangıç mevcut. Tarihsel sekiz migration kabulü güncel main sayısı değildir. |
| [Q-E03](decisions/Q-E03.md) | Planlanan başlangıç dahil sonrası katılımcı parasal sınır; fiilî başlangıç bu sınıflandırmayı değiştirmez. |
| [DS-2026-10-17](decisions/DS-2026-10-17.md) | Plan/yoklama, rezervasyon koruması, anlaşma, A→B hesaplaşma ve geçmiş satış ürün kararları. |
| [Hesaplaşma revizyonu](decisions/DS-2026-10-17-settlement-revision.md) | OM üçüncü kayıt aşaması yerine iki taraflı başvuru/onay; sonraki merkez kapsam kararı uygulanır. |
| [Merkez kapsamı](decisions/DS-2026-10-17-settlement-center-scope.md) | Aynı hesap A ve B'de ayrı canlı yetkiliyse iki adımı yapabilir. A yetkisi B yerine geçmez; fallback yoktur. |
| [CI-2026-10-20](decisions/CI-2026-10-20.md) | Dört bağımsız shard, kaynak bağlı belge kabulü ve açık full clean. Kurulum bekleme ifadesi güncel kapanışa bağlandı; kapı gevşetilmedi. |

## Kanıt ve değişiklik sınırı

`reports/` ve `contracts/source-v2.2/` kaynağına bağlı tarihsel kanıttır; yeniden yazılmaz. Geliştirici yerel kontrolü, bağımsız kaynak incelemesi, aday/main CI ve hosted smoke farklı kanıt türleridir. Fiziksel imha, gerçek worker yükü, frontend entegrasyonu, dış e-posta, yük/restore ve production kabulü kapanmış sayılmaz.

Üretilmiş katalog/tip/validator/Edge/makine sözleşmesi bu belge güncellemesinde değiştirilmez. Gelecekte davranış/API geliştirmesi yapıldığında ilgili kaynak ve kabul senaryolarıyla birlikte güncellenir. Güvenli yalnız-belge yolu mevcut CI izin listesi üzerinden doğrulanır; bu teslim için izin listesi veya full/main testleri değiştirilmez.
