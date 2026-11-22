# FtkSaaS · Frontend açık işler ve kabul

**Tek aktif takip kaynağı:** Bu dosya, yalnız açık işlerin sırasını, kapanış ölçütlerini ve doğrulanmış son durumu tutar. Teknik gerekçe [geliştirme rehberinde](development.md#router--query-birleşik-veri-yaşam-döngüsü), tamamlanmış uzun kabul kayıtları [22 Kasım 2026 tarihli Git geçmişindedir](https://github.com/SXQHex/FtkSaaS/blob/8a5efbb0c14ea259246ca9d07f1fb92948007557/apps/web/docs/todo.md). Eski kayıt Git'te korunur; buraya ikinci bir tarihçe kopyalanmaz.

**Aktif iş:** [Router + Query birleşik veri yaşam döngüsü](#router-query-birlesik) — önceki “Aşama 1 / Aşama 2” ayrımı artık yok. **Sonraki iş:** Listedeki doğruluk/güvenlik açıkları → ölçülmüş performans → birleştirilmiş tarayıcı kabulü. **Başlangıç SHA:** \`8a5efbb0c14ea259246ca9d07f1fb92948007557\` (22 Kasım 2026); bu SHA inceleme kaynağıdır, yeni işlerin yapılmış/kanıtlanmış olduğu anlamına gelmez.

**Durum gösterimi:** \`[ ]\` açık · \`[x]\` yalnız kod, test ve aynı kaynak CI kanıtıyla kapanmış · “risk” yeni regresyon/çalışma zamanı kanıtı isteyen bulgu. **Kaynak seçimi:** Repo başındaki [AGENTS](../../../AGENTS.md), [web ajan kuralları](../AGENTS.md), [kaynak indeksi](../../../docs/source-index.md), ilgili API/WF ve kod. Test eşiği, güvenlik veya CI politikası düşürülemez.

<a id="router-query-birlesik"></a>

## Router + Query birleşik veri yaşam döngüsü (açık)

**Hedef:** Var olan Vite/React/TanStack mimarisini koruyarak güvenli, tenant kapsamlı, doğru, iptal edilebilir ve ölçülmüş en az API isteğiyle çalışan SPA. *Yeni state store, ikinci cache, genel event bus, bütün mutation'ları yeniden yazma veya ölçümsüz backend API tasarımı yapılmaz.*

**Kaynak denetimi:** \`8a5efbb0c14ea259246ca9d07f1fb92948007557\` üzerindeki 50 route, 36 feature alanı ve ilgili Query/reader/mutation kodu; kod aramasında \`queryKey\` eşleşmeli 127 dosya ve \`onRefresh\` eşleşmeli 116 dosya. Bu statik tarama yeni bir CI/test veya canlı performans kanıtı değildir. Bulguların açıklama ve teknik tercih sahibi [geliştirme rehberidir](development.md#router--query-birleşik-veri-yaşam-döngüsü).

### A · Cache doğruluğu — önce kapat

- [ ] **M01 · P1 · Üye özel ders cursor'ları.** [Kaynak](../src/features/member-private-lessons/member-private-lessons-content.tsx): Onaylanan komuttan sonra yalnız açık \`list.refetch()\` çağrılıyor. Aynı kişi/merkezin \`member-private-lessons … "list"\` filtre/cursor ailesini stale işaretle; görünür listeyi doğrulayan readback'i koru. **Kabul:** Mutasyon→eski cursor'a dönüş güncel; başka kişi/merkez değişmiyor; bilinmeyen ACK'te ikinci yazma yok.
- [ ] **M02 · P1 · Belge dizini cursor/filtreleri.** [Kaynak](../src/features/documents/documents-content.tsx): \`refresh()\` açık sayfa/kataloğu yenilerken eski \`document-directory\` varyantlarını stale işaretlemiyor. İlgili \`document-directory\`, \`document-catalog\` ve \`document-versions\` varyantlarını hedefli invalid et; readback ve onay tarihi değişmesin. **Kabul:** Yayın→eski filtre/cursor doğru; başka tenant değişmiyor.
- [ ] **M03 · P1 · Davet/hesap dizinleri.** [Kaynak](../src/features/access/access-content.tsx): İşlem sonrası ilk sayfalar \`fetchQuery\` ile güncelleniyor; eski \`access-invitations\`/\`access-accounts\` filtre/cursor kayıtları stale olmuyor. Yalnız ilgili merkez prefix'lerini invalid et; iki dizinden biri \`FORBIDDEN\` ise izinli diğerini bloke etme. **Kabul:** Eski sayfaya dönüş fresh; yetkisiz dizin “boş/başarılı” sayılmıyor.
- [ ] **M04 · P1 · Hakediş listeleri.** [Kaynak](../src/features/earnings/earnings-content.tsx): \`earnings-directory\` dönem, kişi ve cursor anahtarlı; yazma sonrasında yalnız açık sayfa/katalog/sayaçlar okunuyor. Etkilenen merkezin bütün geçmiş varyantlarını stale işaretle; zorunlu görünen sayfa readback'i sürsün. **Kabul:** Önceki dönem ve cursor güncel ödeme/earning gösteriyor, yabancı tenant etkilenmiyor.
- [ ] **M05 · P1 · Finans dizini satış iadesi.** [Kaynak](../src/features/finance/finance-directory-content.tsx): \`SaleRefundEditor.onRefresh\` yalnız \`directory.refetch()\` yapıyor. Mevcut [finans invalidation](../src/features/finance/finance-query.ts) sözleşmesiyle etkilenen kişi/para birimi/merkez + dizin filtre/cursor ailesini eşle. **Kabul:** Aynı finans olayına bağlı diğer liste/özetler fresh; ilgisiz para birimi/tenant gereksiz refetch görmüyor.
- [ ] **A-ortak kabulü.** M01–M05 için birim + Playwright ile “önce sayfa-2 cache'i → write/receipt/readback → sayfa-1 → eski sayfa-2” ve başka tenant olumsuz senaryosu geçir. Toplu eski sayfa \`refetch\` fırtınası oluşturma; \`refetchType: "none"\` + gereken görünür readback kullan.

### B · Kimlik, erişim ve veri sahibi — yanlış izin/gösterimi önle

- [ ] **M06 · P1 · Erişim kaybında Query/Router tutarlılığı.** [CRM](../src/features/leads/leads-content.tsx), [özel ders](../src/features/member-private-lessons/member-private-lessons-content.tsx), [kişi](../src/features/people/people-page.tsx) vb. yalnız \`router.invalidate()\` çağırabiliyor; Query cache'i kendiliğinden geçersiz olmuyor. Gerçek \`AUTH_REQUIRED\`/\`SESSION_REVOKED\`/\`ACCOUNT_CHANGED\` ile sadece yetki \`FORBIDDEN\`/plan retlerini **ayrı** işle. **Kabul:** Harici rol/merkez iptali sonrası açık ekran, history ve doğrudan URL eski yetkili içeriği/eylemi göstermiyor; sonuç belirsiz komut kurtarması korunuyor. Koddaki mekanizma kesin; görünür bug güvenlik testiyle kanıtlanmalı.
- [ ] **M07 · P1 koşullu · Aynı native kullanıcı, farklı session.** [Kaynak](../src/features/auth/use-auth-session.ts): \`SIGNED_IN\` dalı aynı \`user.id\` ile yeniden gelen session'ı ayırmıyor. [Açık parola girişindeki](../src/features/auth/auth.ts) cache temizliği korunarak gerçek \`session_id\` geçişi ve sıradan focus/refresh ayrıştırılsın. **Kabul:** Aynı kullanıcı/yeni session özel cache yeniler; aynı session/focus/token refresh fazladan temizlemez; MFA/recovery/farklı kullanıcı/late reply testleri geçer. Veri sızıntısı kanıtlanmış değildir.
- [ ] **M11 · P2 · Workspace tek \`queryFn\`.** [Kaynak](../src/features/session-detail/session-detail-content.tsx): Aynı \`workspaceQuery()\` key'i farklı \`guardedRead\` sarmalayıcıyla çalıştırılıyor. Erişim kaybı yan etkisini gözlemci seviyesine taşı; sorgu tanımı tek kalsın. **Kabul:** Seans görünümü, erişim retleri ve native komut kilidi değişmiyor.
- [ ] **M12 · P2 · Organizasyon aboneliği scope modeli.** [Kaynak](../src/features/settings/settings-subscription.ts): \`["settings-subscription", accountId, orgId]\` organizasyon düzeyli ama cache nesnesi çağrıldığı \`centerId\` içerebiliyor; [tüketici](../src/features/settings/use-settings-subscription.tsx) mevcut scope'u yeniden bağlıyor. Organizasyon cevabı ile güncel işlem scope'unu açık ayır. **Kabul:** Aynı organizasyonda A→B merkez geçişi abonelik için ikinci gereksiz API isteği yaratmıyor, komut doğru merkez/organizasyonla çalışıyor.

### C · Hız ve ağ maliyeti — ölç, sonra sadeleştir

- [ ] **M08 · P1 performans · Tekrarlanan \`account_get_v1\`.** [Kaynak](../src/lib/scoped-backend.ts): Her çağrı pinned bearer + yeni domain hesap okuması yapıyor. Salt Query okumalarında mevcut doğrulanmış \`accountQuery\` projeksiyonunu güvenle yeniden kullanmanın istek/süre etkisini ölç ve dar kapsamlı uygula; backend JWT/tenant denetimi ile yazma/receipt hesap eşlemesini kaldırma. OAuth [callback](../src/features/auth/callback.ts) doğrudan \`readAccount()\` kullanır; route ile mükerrer okumayı aynı testte değerlendir. **Kabul:** Native aktör/session değişimi, yetki kaybı, stale sonuç ve yönlendirme testleri geçer; hesap API istekleri önce/sonra kaydedilir.
- [ ] **M09 · P1 performans · N+1 okuma.** [Üye rezervasyonları](../src/features/member-reservations/member-reservations-read.ts) seans başına ek okur; [hakediş](../src/features/earnings/earnings-content.tsx) görünür eğitmen başına ek \`closed_session_count\` okur. Önce typed mevcut payload'u kullan; aynı isteği tekrar etme. Ölçümden sonra gerekirse sınırlı backend ek alanı için ayrı ihtiyaç belirt; kanıtsız yeni API icat etme. **Kabul:** Sonuç doğruluğu ve readback korunarak önce/sonra istek sayısı + süre kaydedilir.
- [ ] **M10 · P2 · İptal edilebilir salt okumalar.** [Transport](../src/lib/backend.ts) ve [workspace](../src/features/workspace/workspace-query.ts) \`AbortSignal\` taşır; CRM, eğitmen, rezervasyon, seans, audit ve raporlardaki önemli çoklu/cursor reader'lar çoğunlukla taşımaz. Gerçekten faydalı/uzun süren Query okuyucularını ve alt \`fetch\` zincirini sinyale bağla. **Kabul:** Scope değişimi/iptal sırasında alt ağ okuması durur; write/receipt/status değişmez.
- [ ] **M13 · P3 · Sunum nesneleri Query key'lerinde.** [Etkinlik](../src/features/events/events-content.tsx) ve [etkinlik detayı](../src/features/events/event-detail-content.tsx) kaynak sonuçlarını sunum key'ine koyuyor. Ölçülen tekrar/hashing maliyeti varsa saf türetime/\`useMemo\`'ya indir; asenkron gerekli dönüşümü koru. **Kabul:** Aynı render ve cache ayrımı, azalan bellek/hesap yükü; performans kanıtı yoksa değişiklik yapma.
- [ ] **C-ortak kabulü.** Gerçekçi aynı fixture ve cihaz profilinde ilk yükleme, SPA 5 ekran geçişi, geri/ileri, sayfa/cursor değişimi ve mutasyon sonrası \`account_get\`, org/center/role, alt sorgu sayısı ile gecikmeyi karşılaştır. Hız artışı ölçmeden iddia edilmez.

### D · Regresyon, güvenlik ve yayın kapanışı

- [ ] **M14 · Test kararsızlığı.** [Devtools senaryosu](../e2e/devtools.spec.ts) farklı Chromium koşularında \`schema-example\` öğesini bulamayarak zaman zaman başarısız oldu. Kök sebebi trace/DOM ve form panel yaşam döngüsüyle ayır; timeout/retry/assertion gevşetme. Başarısızlık ürün veri katmanına kanıtsız bağlanmaz.
- [ ] **D01.** Özel cache yeni aktörde/signed-out durumunda görünmez; MFA/recovery, aynı hesap-yeni session, rol kaybı, başka merkez ve late read regresyonu geçer. [Temel testler](../src/features/auth/account-query.test.ts), [workspace](../src/features/workspace/workspace-query.test.ts), [tenant geçişi](../e2e/auth-scope-transition.spec.ts).
- [ ] **D02.** Tüm ilgili mutation'lar tek native write + receipt/status + sonuç readback sözleşmesini korur; bilinmeyen ACK veya readback başarısızlığı \`saved\` ilan edilmez. [Komut](../src/features/member-profile/use-member-command.ts).
- [ ] **D03.** İlgili unit/MSW, source-bound typecheck/lint/format/build/quality ve 12 Desktop Chromium shard aynı aday SHA'sında başarılıdır. Testler, floor guard ve güvenlik kapıları gevşetilmez.
- [ ] **D04.** Refactoring tamamlanınca [dört tarayıcı profili](../scripts/browser-profiles.mjs) (Desktop Chromium, Mobile Chromium, Desktop WebKit, Mobile WebKit) bağımsız başarılı kabul edilir; güvenilir workflow değişikliği ancak açık inceleme/politika kurulumuyla yapılır. Yalnız Desktop Chromium başarısı dört profil kabulü değildir.
- [ ] **D05.** Başarılı merge/main kanıtı, gerçekten gerekiyorsa development/live yayın ve gerçek sağlayıcı sınırı ayrı kaydedilir. Son kaynak ve koşu numarası bulunmadan hiçbir kutu kapatılmaz.

**Uygulama sırası (tek iş):** A cache doğruluğu → B oturum/kapsam → C ölçülmüş trafik/iptal → D birleşik kabul. İki mantıksal büyük PR (doğruluk-güvenlik, hız-iptal) tercih edilir; bağımsız inceleme ve tam CI yalnız kaynak sınırı ve merge kurallarıyla yürütülür. Kod/tip/test sonucu değişmeden CI yeniden koşturulmaz.

<a id="monorepo-geçişi"></a>

## Bağımsız açık teslimler

- [ ] **MONO-01 · Eski kabulun sonlandırılması.** Mevcut ürün \`apps/web\` ve statik Cloudflare dağıtımı main üzerinde çalışsa da önceki taşıma kaydındaki **adayın ortak CI kabulü ve yayımlı sürüm** eşlemesi uygun son kaynak/ortam kanıtıyla ayrıca kapatılacak. Geçmiş kaydın [aslı](https://github.com/SXQHex/FtkSaaS/blob/8a5efbb0c14ea259246ca9d07f1fb92948007557/apps/web/docs/todo.md#monorepo-geçişi).
- [ ] **MONO-02 · Kişisel ICS derin linkleri.** Eski konfigürasyondan gelen org + seans linki, yeni SPA'da giriş, doğru merkez/yetki ve öğrenci/eğitmen davranışıyla doğrulanacak. [İstemci protokolü](../../../docs/client-integration.md#statik-spa-transportu).

<a id="sayfa-kabulu"></a>

## Tamamlanmış işler ve eski bağlantılar

Eski 403 KB dosya aktif backlog değildi; tamamlanmış ekran, Pro/Starter/Business, görsel ve yayın kabulleriyle ilgili uzun geçmiş anlatımıydı. **Silinmiş kanıt yok:** [Sabit kaynak SHA'lı eski kayıt](https://github.com/SXQHex/FtkSaaS/blob/8a5efbb0c14ea259246ca9d07f1fb92948007557/apps/web/docs/todo.md) Git'te okunabilir. Önceki teslim ve kararların asıl kanıtı o kaydın bağlantılı testleri, PR'leri ve ortam koşularıdır; eski başarı yeni kaynak için otomatik kabul değildir. Normatif ürün/izin/limit kararları güncel [ürün sözleşmesinde](../../../docs/contracts/01-FtkSaaS-urun-kapsam-sozlesmesi.md), [makine sözleşmesinde](../../../packages/api-contracts/schema/contract.json) ve [WF rehberlerinde](../../../docs/workflows.md) kalır.

- **SPA ve görsel:** [T01–T04, V01–V09, E01–E53 geçmişi](https://github.com/SXQHex/FtkSaaS/blob/8a5efbb0c14ea259246ca9d07f1fb92948007557/apps/web/docs/todo.md#başlangıç) · [eski T04 kabulü](https://github.com/SXQHex/FtkSaaS/blob/8a5efbb0c14ea259246ca9d07f1fb92948007557/apps/web/docs/todo.md#t04--spa-yönlendirmesi-ve-ortak-okuma-tekrarları-kapandı).
- **Plan bazlı kabuller:** [Pro](https://github.com/SXQHex/FtkSaaS/blob/8a5efbb0c14ea259246ca9d07f1fb92948007557/apps/web/docs/todo.md#pro-geliştirmesi) · [Starter](https://github.com/SXQHex/FtkSaaS/blob/8a5efbb0c14ea259246ca9d07f1fb92948007557/apps/web/docs/todo.md#starter) · [Business](https://github.com/SXQHex/FtkSaaS/blob/8a5efbb0c14ea259246ca9d07f1fb92948007557/apps/web/docs/todo.md#business). Bu başlıkların geçmişte kapatılması yeni Router/Query işini kapatmaz.
- **Önceki uygulamaya ait WEB-S referansları:** Eski Web S01–S12 kayıtlarının yerini almak üzere yeni bir kabul icat edilmez; [tarihsel Git kaynak/commit bağlantıları](https://github.com/SXQHex/FtkSaaS/blob/8a5efbb0c14ea259246ca9d07f1fb92948007557/apps/web/docs/todo.md#önceki-frontend-kabul-bağlantıları) kullanılır.

Bu dizin, eski belgelerdeki anchor'ların açılmasını korumak için tutulur; **aşağıdaki ID'ler aktif görev değildir**.

<a id="e34"></a><a id="e47-ilk-kurulum"></a><a id="e48-uye-bildirim-merkezi"></a><a id="e50"></a><a id="e52"></a>
<a id="v02"></a><a id="v03"></a><a id="v04"></a><a id="v05"></a><a id="v06"></a><a id="v07"></a><a id="v09"></a>
<a id="p01"></a><a id="b03--merkezler-arası-kullanım-hakkı"></a>
<a id="web-s02"></a><a id="web-s03"></a><a id="web-s05"></a><a id="web-s06"></a><a id="web-s08"></a><a id="web-s09"></a><a id="web-s11"></a><a id="web-s12"></a>
<a id="11-web-s01-güncel-kabul-durumu"></a><a id="7-bölüm-bölüm-teslim-tek-aktif-bölüm"></a>
<a id="pro-kaynak-ve-ekip"></a><a id="ortak-kapsam-erisimi"></a><a id="pro-paket-yasam-dongusu"></a><a id="pro-finans-kabulu"></a>

İlgili eski bölümün ayrıntısını [tarihsel dosyada](https://github.com/SXQHex/FtkSaaS/blob/8a5efbb0c14ea259246ca9d07f1fb92948007557/apps/web/docs/todo.md) ara. Herhangi bir eski bağlantı güncel implementasyonun teslimi olarak okunmamalıdır.
