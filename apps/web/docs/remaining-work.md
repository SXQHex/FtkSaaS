# Frontend açık işler ve kabul ölçütleri

**Tek görev/kabul sahibi:** Bu belge yalnız tamamlanmamış frontend işlerini ve kaynak bağlı kapanış ölçütlerini tutar. **Yürütme sırası** [production-queue.md](production-queue.md), **koddan türetilmiş mimari gerekçeler** [development.md](development.md#router--query-birleşik-veri-yaşam-döngüsü), **en son gerçek kaynak/CI durumu** [handover.md](handover.md), **önceki teslim tarihçesi** [22 Kasım 2026 öncesi kayıt](https://github.com/SXQHex/FtkSaaS/blob/8a5efbb0c14ea259246ca9d07f1fb92948007557/apps/web/docs/todo.md) sahibindedir. Tamamlanmış iş burada tekrar listelenmez.

**Kaynak denetimi.** Cache incelemesi 23 Kasım 2026'da `main` `823605a9c1d6b35c5ecc7a5dd1711da78fdbbf40` üzerinde başladı ve 24 Kasım 2026'da doğrulandı. Güncel kaynak kanıtı [devir kaydında](handover.md). **Sistem:** Native Supabase Auth + Edge; Vite/React + TanStack Router/Query. Eski “Aşama 1/2” bölünmesi kaldırıldı; tek uçtan uca veri yaşam döngüsü kabulü yapılacak.

**Kapanış kuralı:** Her `[ ]` ancak düzeltme + ilgili olumlu/olumsuz test + tam son kaynak ve zorunlu CI kanıtıyla `[x]` yapılır. Mock runtime/provider/hosted kabulünün yerine geçmez. `CONSTRAINTS.md`/CI politikası gevşetilemez. Başarılı önceki PR yeni davranış için otomatik kanıt değildir.

<a id="router-query-birlesik"></a>

## Router + Query birleşik veri yaşam döngüsü (kapalı)

**Hedef:** Var olan Vite/React/TanStack mimarisini koruyarak güvenli, tenant kapsamlı, doğru, iptal edilebilir ve ölçülmüş en az API isteğiyle çalışan SPA. _Yeni state store, ikinci cache, genel event bus, bütün mutation'ları yeniden yazma veya ölçümsüz backend API tasarımı yapılmaz._

**İlk kaynak denetimi.** `8a5efbb0c14ea259246ca9d07f1fb92948007557` üzerindeki 50 route, 36 feature alanı ve ilgili Query/reader/mutation kodu; kod aramasında `queryKey` eşleşmeli 127 dosya ve `onRefresh` eşleşmeli 116 dosya. Bu statik tarama yeni bir CI/test veya canlı performans kanıtı değildir. Bulguların açıklama ve teknik tercih sahibi [geliştirme rehberidir](development.md#router--query-birleşik-veri-yaşam-döngüsü).

### A · Cache doğruluğu

**M01–M05 bağımsız tamamlandı:** Ortak cache/cursor sözleşmesi [PR #374](https://github.com/SXQHex/FtkSaaS/pull/374) ve [PR #375](https://github.com/SXQHex/FtkSaaS/pull/375), belge alanı [PR #377](https://github.com/SXQHex/FtkSaaS/pull/377) ve [PR #378](https://github.com/SXQHex/FtkSaaS/pull/378), davet/hesap dizinleri [PR #380](https://github.com/SXQHex/FtkSaaS/pull/380), hakediş listeleri [PR #382](https://github.com/SXQHex/FtkSaaS/pull/382), finans listeleri [PR #384](https://github.com/SXQHex/FtkSaaS/pull/384) ile doğrulandı. Kaynak ve CI kanıtı [devir kaydındadır](handover.md). **A-ortak** birleşik kabulü ayrıca [PR #387](https://github.com/SXQHex/FtkSaaS/pull/387) ile tamamlandı.

- [x] **M02 · P1 · Belge dizini cursor/filtreleri.** [PR #377](https://github.com/SXQHex/FtkSaaS/pull/377) ve [PR #378](https://github.com/SXQHex/FtkSaaS/pull/378) ile kapandı. Native dosya/yayın readback'i, eski cursor ve filtre, aktif/pasif sonsuz katalog, tenant izolasyonu, geç yanıt iptali ve tekil ilk sayfa okumasının kaynak/CI/merge/main kanıtı [devir kaydında](handover.md#22-kasım-2026--m02-bağımsız-kapanışı). A-ortak kabulü bundan bağımsızdır.
- [x] **M03 · P1 · Davet/hesap dizinleri.** [PR #380](https://github.com/SXQHex/FtkSaaS/pull/380) ile kapandı. İlgili merkez ve aktörde eski davet/hesap filtre-cursor kayıtları stale; geç yanıt iptali, bağımsız `FORBIDDEN` hataları, zorunlu ilk sayfa readback, eski sayfaya fresh dönüş ve tek native write/kurtarma kabulü [devir kaydında](handover.md#22-kasım-2026--m03-bağımsız-kapanışı). A-ortak kabulü ayrıdır.
- [x] **M04 · P1 · Hakediş listeleri.** [PR #382](https://github.com/SXQHex/FtkSaaS/pull/382) ile kapandı. Dönem/kişi/cursor ve bağlı eğitmen/ödeme katalogları, aynı aktör/organizasyon/merkezle sınırlı stale işaretlenir; in-flight eski okumalar iptal edilir, infinite continuation ilk sayfaya indirilir. Native ödeme/etkinlik yazması sonrası görünür ilk sayfa, katalog ve sayaç readback'i; geçmiş döneme/sayfa-2'ye güncel dönüş, yabancı tenant ve saved-unread regresyonları [devir kaydındaki](handover.md#23-kasım-2026--m04-bağımsız-kapanışı) CI/merge/main kanıtıyla doğrulandı. A-ortak kabulü ayrıdır.
- [x] **M05 · P1 · Finans dizini satış iadesi.** [PR #384](https://github.com/SXQHex/FtkSaaS/pull/384) ile kapandı. Etkilenen kişi/para birimi/merkez, parasal rapor, dizin filtre/cursor ve görünür alacak okumaları kapsamlı iptal + `refetchType: "none"` ile stale; doğrulanmış native finans sonucu yeniden kullanılıyor, yalnız görünür ilk sayfa okunuyor. Diğer tenant/para birimi korunuyor. [Frontend CI #45080914146](https://github.com/SXQHex/FtkSaaS/actions/runs/45080914146), [main #45082324949](https://github.com/SXQHex/FtkSaaS/actions/runs/45082324949) ve [merge #45082324985](https://github.com/SXQHex/FtkSaaS/actions/runs/45082324985) başarılı.
- [x] **A-ortak kabulü.** [PR #387](https://github.com/SXQHex/FtkSaaS/pull/387) ortak `QueryClient` üzerinde M01–M05 eski cursor/sayfa-2, etkilenen ilk sayfanın yeniden okunması, daha sonra eski sayfaya fresh dönüş, in-flight geç yanıt iptali, yabancı tenant/para birimi ve gereksiz `refetch` olmaması regresyonlarını tamamladı. Bağımsız native write/receipt/readback Playwright testleri aynı SHA'nın tam Chromium envanterinde koştu. [Frontend CI #45087934058](https://github.com/SXQHex/FtkSaaS/actions/runs/45087934058) 12/12 Desktop Chromium + unit/coverage/lint/Oxfmt/typecheck/build başarılı; merge `2cd773cd8ef11717f9ff750aa466e596d23351b2`, [main proof #45089006340](https://github.com/SXQHex/FtkSaaS/actions/runs/45089006340) ve [merge proof #45089006375](https://github.com/SXQHex/FtkSaaS/actions/runs/45089006375) başarılı. Bu kanıt dört tarayıcı ve hosted/provider kabulü değildir.

#### Bağımsız cache incelemesi sonrası kabul

- [x] **Önceki incelemenin sekiz akışı.** [PR #398](https://github.com/SXQHex/FtkSaaS/pull/398) aday CI ve aynı ağaçtaki main kabulüyle kapandı. [Kaynak ve ortam kanıtı](handover.md#kaynak-ve-kontrol-noktası).

<a id="overlay-cache-audit"></a>

#### Modal, dialog, çekmece ve yan sayfa cache doğruluğu

- [x] **Önceki incelemenin on akışı.** [PR #399](https://github.com/SXQHex/FtkSaaS/pull/399) 12/12 Chromium ve aynı ağaçtaki main kanıtıyla kapandı. [Kaynak ve ortam kanıtı](handover.md#kaynak-ve-kontrol-noktası).

<a id="final-cache-audit"></a>

#### Cache doğruluğu · Sayfa, modal, dialog, çekmece ve yan sayfa

- [x] **Tüm frontend cache taramasının kabulü.** Sayfa, modal, dialog, çekmece ve yan sayfaların oturum, yetki, tenant kapsamı, yazma sonrası okuma ve cursor regresyonları doğrulandı. [PR #401](https://github.com/SXQHex/FtkSaaS/pull/401) · [Sabit kabul ölçütleri](https://github.com/SXQHex/FtkSaaS/blob/d646cf52968996bb68efd3d0cbd6b826fcdbd259/apps/web/docs/remaining-work.md#L39-L48) · [CI, main ve ortam kanıtı](handover.md#kaynak-ve-kontrol-noktası).

### B · Kimlik, erişim ve veri sahibi

- [x] **M06–M07 · Erişim kaybı ve native oturum devri.** Korunan içeriğin sıcak history geçişi, bağımsız yetki reddi, geç yanıt, açık portal ve aynı kullanıcıda yeni oturum regresyonları [cache kabulüne](#final-cache-audit) dahil.
- [x] **M11–M12 · Ortak workspace ve organizasyon aboneliği.** Seans ayrıntısı ortak workspace okuyucusunu kullanır. Aynı organizasyonun iki merkezi tek doğrulanmış abonelik sorgusunu paylaşır. [Cache kabulü](#final-cache-audit) · [Abonelik regresyonu](../src/features/settings/settings-native.test.ts#L155).

### C · Hız ve ağ maliyeti — ölç, sonra sadeleştir

**Bulgu kapsamı.** 24 Kasım 2026 bağımsız kaynak taraması `41775df365af408ec5a43b891579310bb78d10d7` üzerinde 629 takipli dosyayı, 50 rotayı ve 36 özellik alanını kapsadı. Sayfa, modal, dialog, çekmece ve yan sayfa okumaları Query anahtarından native isteğe kadar izlendi. Kaynak ve kabul kayıtlarının sahibi [devir kaydıdır](handover.md#kaynak-ve-kontrol-noktası).

- [x] **M08 · P1 · Tekrarlanan `account_get_v1`.** Salt Query zincirlerinin doğrulanmış hesap paylaşımı ve Platform kurulumunda yazma öncesi taze native kontrol [PR #404](https://github.com/SXQHex/FtkSaaS/pull/404) ile kabul edildi. İstek sayıları, CI ve main kanıtı [devir kaydındadır](handover.md#kaynak-ve-kontrol-noktası).
- [x] **M09 · P1 performans · Tekrarlanan, N+1 ve gereksiz geniş okumalar.** [Son kaynak, istek ve satır ölçümü](handover.md#m09-kaynak-ve-olcum).
- [x] **M10 · P2 · İptal edilebilir salt okumalar.** PR #406 ile hesap, panel ve editör ilk okumalarının HTTP iptali kabul edildi. MSW gerçek isteğin durduğunu, tarayıcı regresyonları oturum ve kapsam geçişini doğruladı. Native yazma, receipt/status ve zorunlu taze readback kendi doğrulama zincirini sürdürür. [Kaynak ve CI kanıtı](handover.md#kaynak-ve-kontrol-noktası) · [MSW regresyonu](../src/lib/scoped-backend.test.ts)
- [x] **M13 · P3 · Sunum ve kaynak kimliği.** Etkinlik saatleri güncel kayıttan türetilir ve yetkili görevli adı aynı aktör, organizasyon, merkez ve kişi kapsamında paylaşılır. Açık takvim görünür sayfa projeksiyonunu tek kaynak sorgusunda tutar. [PR #414 ölçümü](https://github.com/SXQHex/FtkSaaS/pull/414) ve [kaynak bağlı CI ile dağıtım kanıtı](handover.md#kaynak-ve-kontrol-noktası).
- [x] **C-ortak kabulü.** İlk yükleme, SPA’da beş ekran, geri/ileri, panel ve cursor akışının önce/sonra sayım ve süre karşılaştırması aynı yetki ve fixture ile development’ta tamamlandı. Tek mutasyon ve taze readback yerel fixture’da doğrulandı. [Ölçüm ve 503 tanı kaydı](handover.md#c-ortak-ölçümü) · [History erişim kontrolü](../src/main.tsx#L27)
  - **Her değişikliğin kabul koşulu.** [Cache doğruluğu](#final-cache-audit) ve [kimlik, erişim ve veri sahibi](#b--kimlik-erişim-ve-veri-sahibi) regresyonları korunur. Paylaşılan sonuçlar native oturum, aktör, organizasyon, merkez, veri sahibi, yetki/plan, filtre, cursor ve sürüm bakımından eşdeğer olur. Geri/ileri canlı erişim kontrolü, kapsam değişiminde geç yanıtın reddi, mutasyon sonrası hedefli invalidation ve taze readback doğrulanır. `FORBIDDEN`, okunamamış veri, boş liste ve sıfır ayrı kalır. Native JWT denetimi, tek yazma, receipt/status ve belirsiz sonuç kurtarması test edilir. [İstemci sözleşmesi](../../../docs/client-integration.md#kimlik-kapsam-ve-sonuç) · [Tenant ve history regresyonu](../e2e/auth-scope-transition.spec.ts)

### D · Regresyon, güvenlik ve yayın kapanışı

- [x] **M14 · Test kararsızlığı.** [Devtools senaryosu](../e2e/devtools.spec.ts) girdiyi değiştirmeden önce iç Form panelinin hazır olduğunu doğrular. Gecikmeli ve normal tekrarların [PR #415](https://github.com/SXQHex/FtkSaaS/pull/415) kanıtı ve [kaynak bağlı CI kabulü](handover.md#kaynak-ve-kontrol-noktası) doğrulandı.
- [x] **D01.** Özel cache, oturum geçişi ve kapsam yalıtımı.
- [x] **D02.** Tek native yazma, makbuz ve taze sonuç doğrulaması.
- [x] **D03.** Aynı adayda unit/MSW, statik kalite kontrolleri ve 12 Desktop Chromium shard.
- [x] **D04.** Dört Ubuntu tarayıcı profilinin otomatik kabulü tamamlandı. [Kaynak, CI ve yayın kanıtı](handover.md#d-birlesik-kabul).
- [x] **D05.** Main kabulü, Cloudflare yayını ve ilgili gerçek sağlayıcı kontrolleri.

[Birleşik regresyon, kaynak ve yayın kanıtı](handover.md#d-birlesik-kabul).

<a id="frontend-tip-guvenligi"></a>

## Frontend TypeScript tip güvenliği (kapalı)

[Kaynak, teslim ve kapanış kanıtı](handover.md#ts02-ts03-kaynak-ve-ortam-kabulu).

- [x] **TS01 · Native API yanıt güven sınırı.** Zarf, aktör ve yetki projeksiyonu, finans okuması ve işlem makbuzu doğrulamaları tamamlandı.
- [x] **TS02 · Vite ortam tipleri.** Ortam bildirimi ve yapılandırma doğrulaması ortak tüketicide toplandı.
- [x] **TS03 · Rapor dosyası, yükleme ve public istekler.** Dosya ve public istekler doğrulanmış yapılandırmayı kullanıyor. Origin, yönlendirme, token ve dosya kontrolleri korundu.
- [x] **TS04 · Playwright E2E native istek sınırı.** Ortak fixture, kayıttan önce isteği yayımlanmış operasyon şemasıyla doğruluyor. Mevcut assertion'lar korundu.
- [x] **TS05 · Dinamik değer ve Promise hata tipleri.** Ayarlar, bildirim özeti, ders talebi ve müsaitlik değerleri tüketildikleri yerde daraltılıyor.
- [x] **TS06 · Betikler ve tip güvenliği kapısı.** Açık `any` Web lint'inde, güvensiz `any` yayılımı üretim kaynaklarında engelleniyor. İlk `checkJs` partisi tarayıcı profil matrisi ve bağımlılık denetimi betiklerini kapsıyor.

<a id="monorepo-geçişi"></a>

## Bağımsız eski teslim kontrolleri (açık)

- [x] **MONO-01 · Eski kabulün sonlandırılması.** Taşıma adayının ortak CI kabulü ve yayımlı sürümü aynı Git ağacına bağlandı. [Kaynak ve Cloudflare kanıtı](handover.md#monorepo-teslim-kabulu)
- [ ] **MONO-02 · Kişisel ICS derin linkleri.** Yayımlı SPA’ya gerçek ICS bağlantısından giriş yaparak öğrenci ve eğitmen ekranlarında canlı merkez ve rol eşleşmesini doğrula. [Kaynak ve ortam](handover.md#mono-02-kaynak-ve-ortam) · [İstemci protokolü](../../../docs/client-integration.md#statik-spa-transportu)
