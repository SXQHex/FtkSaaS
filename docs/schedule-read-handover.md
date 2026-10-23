> **23 Ekim kaynak sınırı:** Yayımlanmış toplam 200 API / 0 contract_only / 59 migration. Aşağıdaki eski sayılar ilgili modülün ilk teslim kaydıdır. Son kaynak ve kabul [güncel devirde](../contracts/00-FtkSaaS-yeni-sohbet-devir.md); gerçek açıklar [kalan işlerde](remaining-work.md) izlenir.

> DS-2026-10-17 kabulü plan/anlaşma ve korunan rezervasyon hedefini değiştirir. Bu dosya önceki runtime kapsamını anlatır; yeni hedef ve açık farklar [sprint devrinde](decision-sprint-handover.md).

# Takvim, seans ve rezervasyon okumaları

Kapsam: `calendar_get_v1`, `session_get_v1`, `reservation_list_v1`. Başlangıç main: `a681f9c37858bd0fdb64a2d24785096adfd35d8e`; aynı SHA [Backend #84](https://github.com/SXQHex/FtkSaaS/actions/runs/39001670914) başarılıdır. Yeni uygulama kabulü son PR head CI'ından ayrıca okunur. 72 çağrılabilir / 112 yalnız sözleşme; 24 append-only migration.

## Sözleşme bağımlılığı ve ürün okuması

Mevcut seans/rezervasyon yazmaları, merkez/rol/hesap bağı, sınıf ve seans görevleri, etkinlik takvimi ve abonelik kapıları kullanılır. Yeni rezervasyon/program/yoklama yazma davranışı eklenmez.

İlk okuma tesliminde products_list_v1 yalnız sözleşmeydi; **P01 ile katalog okuması uygulanmıştır**. Ürün kataloğu satın alınmış hak değildir; seans/kişi/source-sale bağlamı entitlements_get_v1’in P01 teknik aktarımıyla sağlanır. `reservation_create_v1` ise kaynak olarak `sale_id` kullanır. Ürün kataloğu ile uygun satın alınmış hak seçimini eşitlemek yanlıştır. Mevcut `entitlements_get_v1` hak okuması ve `lesson_scope_matches` / `available_for` yazma guardları ayrı bağımlılıklardır. Uygun satışları seans/kişi bağlamında listeleme, öğrenci/CM görünürlüğü ve DTO aktarımı P01’de uygulanıp hedefli/aday kabulünden geçmiştir; [P01 devri](p01-handover.md) güncel kapsamı açıklar. Okuma yazma anındaki hak/kapasite kabulünün yerine geçmez.

## Görünürlük

- Owner/OM erişilebilir organizasyon merkezlerini okur; merkez operasyon yetkisi kazanmaz.
- CM yalnız güncel yöneticisi olduğu merkezleri okur.
- Personel için canlı staff rolüyle açık `reservation.write` veya `attendance.draft` gerekir. Personel rolü tek başına yetmez.
- Eğitmen/asistan canlı login rolü ve aktif seans veya sınıf göreviyle programını görür. İlgili seansın active/completed rezervasyonlarını okur; başka seans katılımcıları açılmaz.
- Aktif, doğrulanmış hesap–kişi bağıyla öğrenci yalnız kendi rezervasyonlarını (iptal/geçmiş dahil), bunların seanslarını ve kendi etkinlik kayıtlarını okur. Öğrenci ilişkisinin pasifliği geçmişini silmez. Öğrenci başkasının rezervasyonunu okuyamaz.
- Takvim yalnız bu yetkili program projeksiyonudur. Yeni rezervasyon için yayınlanmış tüm seçenekleri keşfetme/public-calendar akışı bu kabulde yoktur; `publication_set_v1/public_calendar_get_v1` hâlâ yalnız sözleşmedir.
- Seans görevlerinde yönetim dışındaki okuyucuya anlaşma kimliği verilmez. Takvimde katılımcı, iletişim, ücret/borç/hak veya audit gerekçesi yoktur.
- Rol, izin, görev veya hesap bağı kalkınca aynı JWT ve eski cursor erişimi koruyamaz. Canlı merkez/plan/abonelik/Auth oturumu her istekte denetlenir.

## İstek, filtre ve sıralama

Transport ortak Edge zarfıdır; `page` liste isteklerinde zorunludur; limit 1–200, varsayılan 50. Merkez verilmezse her satır için güncel yetkili merkez kapsamı uygulanır. Seans ID verilince merkez backend'de çözülür; açık merkez başka seansın merkezini geçersiz kılamaz.

`calendar_get_v1`: zorunlu Instant interval; isteğe bağlı center/resource; `starts_at_asc` (varsayılan), eşitlikte UUID ve tür. Seanslar ve F29 erişimi varsa görünür etkinlikler aynı listede; etkinliğin 0/1/çok disiplin etiketi korunur. Person resource oda/kişi booking'lerine veya aktif seans/sınıf/etkinlik görevine göre filtrelenir.

`reservation_list_v1`: isteğe bağlı person/session/interval/center birlikte kesişir. Varsayılan `created_at_asc`; ayrıca `created_at_desc`, `starts_at_asc`. Zaman eşitliğinde değişmez rezervasyon ID'si aynı yönde sıralanır. İzin verilmeyen kişi filtresi listeyi genişletmez. Başka kapsam seansı NOT_FOUND/FORBIDDEN olur; bilinmeyen kişi filtresi boş liste olabilir.

`session_get_v1`: ID, sınıf, disiplin, format, UTC zamanlar, kapasite, durum/yoklama durumu, canlı seans görevleri ve güncel version. Sınıf görevi erişim kapsamına dahildir; `assignments` alanı fiziksel seans atamalarının projeksiyonudur.

## Zaman ve sayfalama sınırı

Interval UTC offset taşıyan iki Instant'tır; merkez yerel gününü istemci açık offset'li sınırlarla gönderir. Karşılaştırma UTC anlarıyla yapılır; zaman sessiz kaydırılmaz. Çakışma `starts_at < filter.end AND ends_at > filter.start`; aralık [start,end), sınırda yalnız dokunma dahil değildir. Başlangıç < bitiş zorunlu. İstanbul gece yarısını aşan seans ve Berlin DST çift saati ayrı anlarla test edilir.

Cursor keyset'tir; aktör/işlem/tenant/merkez/filtre/sort bağını doğrular; rol veya kapsam yetkisi taşımaz. Sonraki sayfada canlı yetki tekrar hesaplanır. `as_of` o yanıtın değerlendirme zamanıdır, sayfalar arasında donmuş snapshot değildir. Eşzamanlı seans saat değişiminde istemci listeyi yenilemelidir; snapshot veya yük kabulü iddiası yoktur.

## Kabul kanıtı ve açık işler

`tests/schedule-reads.test.mjs` gerçek Supabase Auth → Edge → service-only RPC zincirini kullanır; sentetik ilişki/seans/rezervasyon fixture'ları DB'de kurulur, ayrıca güncel seans yazma → okuma bağlantısı doğrulanır. DB/Auth yetki kaldırma fixture'ı kullanılması, henüz uygulanmayan hesap erişimi veya görev kaldırma komutunun kabul edildiği anlamına gelmez.

Sözleşme/tip/envanter kontrolleri, temiz migration, tüm regresyon, seed/health/advisors ve son head CI ayrı kanıttır. Kaynak raporu: [schedule-read-verification](../reports/schedule-read-verification.json). Bu ilk rapor hosted kabulü değildir; sonraki P07 CD kabulünde 200 runtime işlem/59 migration/Edge8 doğrulandı. Program/seans, yoklama/hakediş ve P01 talep/bekleme/uygun hak seçimi sonraki teslimlerde uygulanmıştır. Public discovery API'si P04 ile canlıdır; gerçek hostname/Turnstile/signed gateway ve deneme konfigürasyonu kabulü ayrıdır. Frontend gerçek entegrasyonu ve yük/restore açık kalır. Production dağıtımı yok; dış e-posta ertelendi.

