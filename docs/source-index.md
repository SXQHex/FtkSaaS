# FtkSaaS kaynak indeksi

## 26 Ekim — PR48 kabulü ve ürün önceliği

Main `34aac276ba124405cc99129a354ff61c376977d1`:207 API/62 migration. PR48 head0397d8ba için bağımsız review5645032155 + aday40230141266 ve exact-source kullanıcı kurulum onayı sonrası normal merge yapıldı. Aynı main [clean40232332540](https://github.com/SXQHex/FtkSaaS/actions/runs/40232332540) ve [development CD40234018404](https://github.com/SXQHex/FtkSaaS/actions/runs/40234018404) başarılı; deploy adımı gerçekten çalıştı. CLI tam2.122.0; dört shard ve full/main assertionları korunur.

Son kullanıcı kararı: yeni altyapı/otomatik süre ölçüm sistemi geliştirilmez. Ayrı kalıcı dummy/pilot organizasyon oluşturma işi iptal edildi; yalnız mevcut sentetik verilerin her seferinde silinmesi gerekmiyor. Önce restore sahiplik/izin denemesi, ardından kalan ürün/ayar API’leri. Alttaki eski kalıcı pilot ve bakım önceliği notları tarihsel snapshot’tır; açık kurulum görevi olarak uygulanmaz. [Güncel kabul sınırı](remote-backend-setup.md#restore-20261026).


## 25 Ekim — PR47 kabulü ve öncelikli CI bakımı

Main `9fd084b9ddbbefc225c98adbf3f25ddee85a9b6e`:207 API/62 migration. PR47 aday40218840402, aynı main40226464989 ve development CD40228555171 başarılı; önceki PR47 aday/pending notları snapshot’tır. Worker session pin ve dar EXECUTE kaynağı yayımlandı; hosted advisors’ta public.rls_auto_enable iki client EXECUTE uyarısı kalktı. COMMIT yapan ops_run için kalan search_path linter uyarısı güvenli session pin/role defaultu sınırıyla belgeli istisnadır; parola uyarısı önceki Free-plan kararıyla kapsam dışıdır. Son kullanıcı talimatı CLI tam2.122.0 ve gerçek sürelere göre dört shard dengelemesidir; full/main clean ve assertionlar korunur. [Bakım kaynağı ve ölçümler](ci-performance.md). Kalan ayar alanları, kalıcı hosted dummy pilot ve restore/managed sahiplik kabulü açık iş olarak sürer. Veriler için kullanıcı teknik karar yetkisi verdi; bu bakımda hosted veri silinmez/değiştirilmez.

## 25 Ekim — aktif backend ve kalıcı pilot teslimi

Main `d6b67139445f2b88298fc0ee6e1f5c476f3586b7`:207 API/61 migration; PR45 main clean40206350648 ve development CD40207909599 başarılı. Aşağıdaki eski PR45 pending notları önceki aday snapshotıdır. Son kullanıcı talimatı beş ayar kapsamının backend/API kabulü, pilot zinciri ve restore/operasyon güvenliği teslimidir. Frontend için yeni alt alan kullanılacak; önce backend hazır edilir. Sentetik pilot verileri ayrı organizasyonda geliştirme Supabase’inde kalıcı tutulabilir; her koşuda silinmez. Dağıtım öncesi sıfırlama ayrıca yapılır; mevcut gerçek kulüp verileri şimdi silinmez. [Teslim sırası, kapsam ve kanıt sınırı](pilot-readiness.md). Bu ilk aday207/62 olup bütün ayar/hosted pilot/restore kabulü değildir.

## 25 Ekim — PR45 kapasite ve main ayarları uzlaştırması

Başlangıç main `3456050a3061d7bf5dc2ce8898b82c5cfe84e773`: **206 callable API / 60 migration**; PR46 ayarları birleşti, aynı main clean [40200716603](https://github.com/SXQHex/FtkSaaS/actions/runs/40200716603) ve development CD [40202862244](https://github.com/SXQHex/FtkSaaS/actions/runs/40202862244) başarılı. Bu PR45 birleşim adayı kapasite işlemini ekler: **207 callable API / 61 migration**. Altı ayar işlemi ve kapasite davranışı birlikte korunur. Henüz uygulanmamış kapasite migration’ı main’deki ayar migration’ından sonra sıralandı; SQL içeriği ve mevcut 60 migration değişmedi. Önceki PR45 clean yalnız eski tabana aittir; bu birleşik kaynak için bağımsız inceleme ve yeni aday/main clean gerekir. Kapasite henüz main/hosted kabulü değildir.

[Alanlar, API'ler ve kesin destek sınırı](frontend-settings-handover.md). Teknik SQL/worker yönetimi erteli; beş ekranın bütün 69 davranış grubu tamamlandı denmez. Hazır renk/font/logo, native provider/MFA/oturum ve diğer özel yaşam döngüsü açıkları bu genel tercihlere dönüştürülmez.


25 Ekim uzlaştırması: FD01–FD12 kararları kapalı; [kaynak/main/PR43–45 kabul tablosu](../contracts/00-FtkSaaS-yeni-sohbet-devir.md) ve [tek kapasite/giriş kararı](../contracts/02-FtkSaaS-teknik-sozlesme.md#oda-seans-kapasite-karari) geçerlidir. Main PR46 sonrası 206/60; birleşik PR45 adayı 207/61, yeni kaynak inceleme/aday/main/CD bekler.

24 Ekim 2026 inceleme tabanı main `702063807b0a0d09f559f070ffde1b1ae3e7563b`. Yayımlanmış kapsam **200 sözleşme / 200 runtime / 0 contract_only / 59 migration / 90 core tablo / Edge8**. P01–P07 kod/main/geliştirme-test kabulü kapandı. Ürün, işletim ve frontend kabulü API sayısından türetilmez.

Öncelik artık beş ayar ekranı ve typed API teslimidir: kullanıcı/global hesap, üye/org person ve tercihi, merkez, org, platform. SQL/Cron/DB işletim ayarları ayrı backlog. [Somut ekran/alan/API matrisi](claude-handover.md) mevcut desteği ve açıkları gösterir.

Önce [backend/frontend ayrımı, 69 kararın beş frontend scope eşlemesi ve FD01–FD12 kabulü](../contracts/02-FtkSaaS-teknik-sozlesme.md#ayarlar-backend-frontend-siniflama) okunur. Sınıflama ve FD01–FD12 karar turu tamamlandı. Sıradaki iş gerçek typed API/ekran teslimi ve uygulama açığıdır; backend işletim ayarları ayrı kalır.

## Başlangıç sırası

1. [AGENTS](../AGENTS.md): alan sahipliği, kaynak kanıtı ve full clean sırasında kullanıcıya devir.
2. [00 güncel devir](../contracts/00-FtkSaaS-yeni-sohbet-devir.md): kaynak/run/tree/CD receipt ve hosted temel kurulum kanıtı.
3. [Kalan işler](remaining-work.md) ve [üretim kuyruğu](production-queue.md): gerçek açıklar; P08 abone numarası ve ortak çok kaynaklı CRM.
4. [Claude frontend talimatları](claude-handover.md): gerçek API/DTO, istek, sürüm, ortam, güvenlik ve tasarım sınırları. Kökte otomatik yüklenen CLAUDE.md bulunmadığından bu dosya açıkça okutulur.
5. [02 ayarlar sözleşmesi](../contracts/02-FtkSaaS-teknik-sozlesme.md#ayarlar-sozlesmesi-ve-davranis-sprinti): S01–S17, M01–M22, organizasyon O01–O21 ve platform P01–P09: 69 ana grup kabul edildi; FD01–FD12 ilk frontend seçenekleri kesin, yalnız asset/teknik DTO/permission/provider/uygulama eşlemesi açık. Yeni ayar davranışlarının tümü mevcut API'de var değildir. Yerel 208 API/60. migration taslağı yayımlanmamıştır.
6. Görevle ilgili ürün/teknik sözleşme, kabul edilmiş karar ve gerçek makine/TypeScript DTO'su.

Son açık kullanıcı kararı üstündür; sonraki kabul yalnız çelişen hükümleri değiştirir. Kabul edilmiş ürün davranışı, teknik aktarım, callable uygulama ve doğrulanmış kabul ayrı tutulur. Eski bir rapor veya modül devrindeki pending notu güncel kaynak kanıtından üstün değildir.

## Sözleşmelerin ayrı inceleme kaydı

| Belge | Rol ve inceleme sonucu |
|---|---|
| [00 devir](../contracts/00-FtkSaaS-yeni-sohbet-devir.md) | Güncel başlangıç. P07 aday/main/CD, PR41 belge kabulü ve beş Cron heartbeat kanıtı eklendi; önceki kaynaklar tarihsel bölümde. |
| [01 ürün](../contracts/01-FtkSaaS-urun-kapsam-sozlesmesi.md) | Normatif ürün kapsamı. Ayar davranış kabulü/uygulama ayrımı, güncel kişi verisi ve P08 abone numarası sınırı eşitlendi. |
| [02 teknik](../contracts/02-FtkSaaS-teknik-sozlesme.md) | Normatif teknik davranış. Word v0.1 settings kataloğu tek Markdown kaynağına aktarıldı; 69 ana grup ve FD01–FD12 kapanışı, eski Word aileleri ve kalan teknik eşleme ayrı; numara kapsamları karıştırılmaz. |
| [03 sorumluluklar](../contracts/03-FtkSaaS-kodlama-sorumluluklari.md) | ChatGPT backend / Claude frontend sınırı, ortak tiplerin gerçek yolu ve durdurulmuş settings geliştirmesi güncellendi. |
| [04 şema](../contracts/04-FtkSaaS-O4-veri-semasi.md) | Üretilmiş katalog; 90 core tablo; bu aday61 migration/main60 doğrulanır. Kesin DDL migrations içindedir. Yeni settings alanı elle eklenmedi. |
| [05 API](../contracts/05-FtkSaaS-O4-API-katalogu.md) | Üretilmiş207 callable operasyon aday kataloğu; main206. DTO kaynağı 08; kapsam notu gerçek sağlayıcı kabulünün yerine geçmez. |
| [06 durum/hata/izin](../contracts/06-FtkSaaS-O4-durum-hata-izin.md) | Yeni ayarlar için uydurma enum/izin eklenmedi. Global kimlik, oturum ve görünüm yetki sınırları eşitlendi. |
| [07 denetim](../contracts/07-FtkSaaS-O4-denetim-ve-aciklar.md) | İlk tasarım denetimi; tarihsel açık listesi güncel teslim listesi olarak kullanılmaz. Değiştirilmedi. |
| [08 makine sözleşmesi](../contracts/08-FtkSaaS-tip-ve-operasyon-sozlesmesi.json) | Callable DTO/izin/guard/faz/sürüm kaynağı. Bu aday207/207/0, main206/206/0. Eski decision_delivery/feature_delivery notları ürünün tüm kabulü değildir; değişiklik yapılmadı. |
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
| [Fiziksel invariants](physical-invariants.md) | Kilit/indeks, hak/zaman ve migration kabul ilkeleri incelendi; SQL uygulama kanıtı olmadığı açıklaması korunur; eski kapasite alanlarının tarihsel sınırı güncel karar bağlantısıyla açıklandı. |
| [Hosted kurulum](remote-backend-setup.md) | 59 migration/Edge8, beş dedicated LOGIN Cron ve 23 Ekim health kaydı. 3600sn quote/900sn reauth kullanıcı seçimi; evrensel varsayılan değil. |
| [Bağlantı JSON'u](development-connection.json) | URL/yerel hazırlık yönergesi kullanılabilir; 0 observed/22 migration ve ilk rapor alanları tarihsel kurulum snapshotıdır. Güncel hosted envanter olarak kullanılmaz. Runtime/CI girdisi olabileceği için bu prose tesliminde değiştirilmedi. |
| [Endpoint envanteri](endpoint-inventory.json) | Üretilmiş aday207/207/0 callable envanteri; generate --check ile eşleşmesi doğrulanır, elle değiştirilmedi. |
| [Özellik haritası](feature-delivery.md) | Üretilmiş F01–F33 eşlemesi. İşlem varlığı gerçek sağlayıcı/operasyonel/üretim kabulü değildir; ilk DS metadata partial/pending satırlarının tarihsel snapshot olduğu üretici prose içinde açıklandı; güncel runtime/açık iş kaynağına yönlendirildi. |
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
