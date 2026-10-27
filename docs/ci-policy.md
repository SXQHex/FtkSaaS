# CI çalışma politikası

CI-02 PR25/26 ile main’e kuruldu; tam kabul kaynağı0ade7877cc16fc121095decbc276f2fbc868607e / [39425915555](https://github.com/SXQHex/FtkSaaS/actions/runs/39425915555) completed/success. [Teknik devir](ci02-handover.md) kaynak/review/kurulum zincirini, [karar](decisions/CI-2026-10-20.md) bağlayıcı davranışı ve [ölçüm](ci-performance.md) gerçek süreleri taşır. Yeni SHA eski kabulü devralmaz.

## Paket yöneticisi

Kurulum package.json’da sabit pnpm sürümüyle `corepack enable` ve `pnpm install --frozen-lockfile` kullanır. Tek lockfile pnpm-lock.yaml; ortak tipler packages/api-contracts. Paket/workspace/lock değişimi runtime/shared girdi olarak geniş regresyona gider. Bu politika adayı trusted-base kurulum sınırına tabidir; [göç kapsamı](monorepo.md#ci-geçiş-sınırı).

## Geliştirme ve açık kabul

| Olay/durum | Uygulanan davranış |
|---|---|
| Bölüm geliştirmesi | Tek Draft + development PR; push ile hızlı ve merge-base'ten birikimli hedefli CI |
| Push/PR güncellemesi, Draft/development temizliği | Kendiliğinden full clean yok |
| Draft veya development | Aday clean resolver'ı ve merge kabulü kapalı |
| Hazır runtime/CI son adayı | Açık ci:full-clean eklenmesiyle core + dört bağımsız API shard; kaynak bağlı toplayıcı |
| Runtime/CI merge'i | Actual merge ilişkisi doğrulanır, aynı main SHA'sında aynı tam kapsam çalışır |
| Güvenli yalnız-belge PR/main | Ayrı source-bound belge kabulü; full clean çalışmaz ve çalışmış gösterilmez |
| Karma, bilinmeyen veya runtime girdisi | Belge istisnası verilmez; birikimli runtime kapsamı korunur |

Aynı branch'in eski hızlı işi iptal edilir; farklı PR ve her main SHA birbirini kesmez. Matrix fail-fast:false ile bir shard hatası diğerlerini iptal etmez. Toplayıcı tüm zorunlu işlerin bitmesini bekler; tam hata ayrıntıları ayrı job loglarındadır, tekleştirilmiş bütün hata listesi henüz yoktur. Zorunlu skipped/cancelled/failure kabulü kapatır. Optional serial-reference yalnız açık ci:measure-serial isteğinde zorunludur; istenmediğinde atlanır ve ölçülmez. Bu isteğin sonradan eklenmesi onu çalıştırmamış eski kabulü geçersiz kılar.

## Birikimli hedefli seçim

[Seçici](../apps/backend/scripts/ci/select-tests.mjs) dosya adı benzerliğinden ziyade açık kaynak–tüketici haritası ve [delta kanıtı](../apps/backend/scripts/ci/delta-analysis.mjs) kullanır. Diff origin/main ile head'in merge-base'inden tüm branch değişiklikleridir; son belge commit'i önceki runtime değişimini gizleyemez. Rename eski/yeni uç, silme ve açıklanamayan fark kapsama dahildir. Eksik geçmiş/head uyumsuzluğu/bilinmeyen paylaşılan kaynak bütün DB/API regresyonuna düşer.

Bilinen modül sözleşme/tip/bundle/envanter farkı ancak operasyon/definition tüketicileri ve birebir source+wrapper append-only migration kanıtıyla daralır; generation/schema/TypeScript kontrolü korunur. Paylaşılan management_state_get modüle bütünüyle sahiplenilmez; yalnız izinli projection/selector ekleri açıklanabilir. Auth/tenant/kernel/finans/hak/gateway ve açıklanamayan migration/üretim kaynağı geniştir.

CI-only geliştirme daralması yalnız sonlu incelenmiş harness listesi + kaynak bağlı güvenli belge farkını kapsar. Unknown CI-looking/doc yolu veya karma runtime farkı daraltılmaz. Yeni test dosyası envanterden kaybolamaz; package test:api, seçici ve shard planı birebir denetlenir. Seçilen modül öncelikli koşar; hata halinde ertelenmiş hedefli regresyon başlamaz. Son aday/main her durumda tam kapsamı kullanır.

## Güvenli belge kabulü

Tam incelenmiş belge yolu, regular100644 dosya ve UTF8/NUL kontrolü gerekir; uzantı/docs öneki/etiket yeterli değildir. Workflow, CI kapı/seçici, dependency/lockfile, migration, makine sözleşmesi ve runtime tüketimli tip/üretilmiş dosya istisna değildir. Renderer'ın yalnız üç açıklama slotu AST ile kanıtlanabilir; f-string ifadeleri, inventory/emit/diğer mantık değişikliği tam yola gider. [PR24 kanıtı](ci02-handover.md) dosyanın tamamına izin vermez.

PR base–head ağaç farkı, gerçek merge parent/tree ve yaşayan inbound/outgoing bağlantılar denetlenir. docs-check + verify başarılı job/step receipt'i ayrı belge kabulüdür; DB/API/full clean sayılmaz. Main doc merge'inde actual tree/parents aynı receipt'e bağlanır ve belge kontrolleri tekrar çalışır. Her main push bütün açık PR'lerin base kabulünü yeniden değerlendirir. Tarihsel belge recovery, exact source/policy SHA/run/attempt ile salt-okuma tanıdır; genel proof fallback'i veya eski başarısız status'u değiştirme yolu değildir.

## Tam clean, toplayıcı ve güvenilir kurulum

Aday/main aynı [reusable workflow](../.github/workflows/clean-suite.yml) kullanır. Core ve dört API işi ayrı runner/backend/DB, temiz migration manifesti ve boş Auth/tenant/receipt ile başlar. Core verify/DB/seed/health/advisors'ı; dört shard 15 API suite'ini eksiksiz/tekrarsız taşır. Suite içi bağlı yarışlar bölünmez; mevcut process concurrency=2 korunur. Ölçümlü deterministik dağılım envanteri kapalıdır; bilinmeyen/yeni/missing/duplicate suite kabul edilmez.

[Toplayıcı](../apps/backend/scripts/ci/collect.mjs) önce tüm zorunlu job/step'lerin aynı run/attempt/head ve gerçek başarısını doğrular, sonra başarılı icra rollerini ölçer. Artifact tek başına kabul değildir. Rerun-failed ile başka attempt başarıları birleştirilmez. PR/head/base/tested merge/tree/coverage/run/attempt bağlanır; actual main aynı iki parent ve tested tree ile normal merge olmalıdır. Squash/rebase'e kanıt sessiz taşınmaz. Source değişirse yeni kabul gerekir.

`ftksaas/merge-clean` status'unu yalnız trusted main kodu, salt-okuma aday işlerinin gerçek kanıtıyla yazar. Aday script/archive executable'ı privileged verifier'da çalışmaz. Trust yüzeyi tüm workflow'lar, scripts/ci ve clean/start runner blob/mode kümesidir. Bu yüzeyi değiştiren PR normal otomatik kapıyı açamaz; bağımsız son-head incelemesi + gerçek aday kabulü + açık kaynak bazlı güvenilir politika kurulum yetkisi gerekir. PR23,25,26 kurulum izinleri gelecekteki kaynağa otomatik taşınmaz. Sahte status, required-check bypass, direct push veya yönetim ayarı değişikliği kullanılmaz.

Required-check/strict-base/bypass yönetim ayarları API erişim sınırı nedeniyle uygulanmış/doğrulanmış sayılmaz; [koruma durumu](branch-protection-review.md) ayrı yönetici işidir. CI status invalidasyonu tek başına sunucu tarafı strict merge yarış korumasının yerine sunulmaz.

## Ölçüm ve ajan devri

Suite ağırlıkları önceki process wall ölçümünden gelir; örtüşen sürelerin toplamı wall diye sunulmaz. Kuyruk, checkout/npm, backend/reset, test, seed-health-advisors ve runner maliyeti ayrı raporlanır. Aynı kaynak seri/shard kıyası istenirse ek seri iş zorunludur; rutin main'de yoktur. Collector henüz çalışırken ölçülen toplam nihai workflow runner dakikası diye sunulmaz. Sonuç tamamlanınca tüm Jobs API zamanlarıyla final toplam alınır; ölçülmemiş tasarruf vaat edilmez.

Aday veya main full clean tetiklenince run/PR/head/base/tested merge/kuyruk/sonraki adımı bildirip turu bitir. Yanıtta run URL yoksa workflow ve tetikleme zamanını kaydet; run aramak için bekleme. Kullanıcı dönene kadar polling/log takibi/sleep döngüsü/arka plan watcher/otomasyon yoktur. Kullanıcı döndüğünde gerçek sonuç ve güncel kaynak bir kez doğrulanır; hâlâ çalışıyorsa yeniden durulur. Başarı ve mevcut yetki varsa merge; main full clean başlayınca tekrar devir. Sırf durum için frozen clean SHA'sını değiştirme; sonraki doğal belge commit'inde eşitle. Güvenli yalnız-belge kontrolleri full clean olarak raporlanmaz.

## Tarihsel Action runtime bakım kaydı — 19 Ekim 2026

Son hedefli run 39281409902 / P01 head 580239075b16f6ac6893d5ac01975d32133d0757 logları 96 sözleşme/yönetişim, 23 CI politika, 27 DB ve 51 API testini başarılı gösterdi. Bu branch dışındaki P01 kaynak kanıtıdır; main kabulü değildir. Önceki Auth/kota assertion hataları bu kaynakta geçmiştir. Geriye kalan Annotations warning'i checkout/setup-node Action'larının Node 20 hedeflemesidir; uygulamanın node-version:24.19.0 ayarı Action'ın kendi runtime'ını değiştirmez.

Bakım branch'i maintenance/actions-node24, main 9ce0a5639417f959111b11f70157156733e3de18 tabanındadır. Ürün/runtime değişikliği içermez. Main'deki aynı saat bağımlı ortak kota fixture'ının düzeltmesi P01 PR'sinden birebir alınır; CI bakımının full clean'i bilinen mevcut fixture hatasında boşa çalıştırılmaz. Yeniden ürün uygulaması yapılmaz. Dört workflow'da yalnız Node 20 Action bağımlılıkları Node 24 kullanan resmi sürümlerin değişmez commit SHA'larına yükseltilir:

| Action | Resmi sürüm | Yeni commit | Runtime |
|---|---|---|---|
| checkout | [v7.0.1](https://github.com/actions/checkout/releases/tag/v7.0.1) | 3d3c42e5aac5ba805825da76410c181273ba90b1 | node24 |
| setup-node | [v7.1.0](https://github.com/actions/setup-node/releases/tag/v7.1.0) | 949feb2413d6458794dcd2491c4babbbce0c15c1 | node24 |
| upload-artifact | [v7.0.2](https://github.com/actions/upload-artifact/releases/tag/v7.0.2) | cf430e030ddbb5b0abf93d22962f4752f3646cd9 | node24 |

Her resmi tag'in commit'i ve action.yml runs.using değeri doğrulandı. Mevcut github-script ed597411d8f924073f98dfc5c65a23a2325f34cd zaten node24; gereksiz major yükseltmesi yapılmadı. Checkout persist-credentials:false, uygulama Node24.19.0, npm cache, event/permissions/concurrency/test komutları ve gate/binding kodu korunur. upload-artifact v7'nin varsayılan archive:true davranışı açık yazılır; gizli .ci/binding.json, candidate-binding adı ve ZIP receipt uyumu korunur. Uyarı gizleme veya FORCE_* ortam bayrağı yoktur.

ci-full.yml blob'u değiştiği için mevcut güvenilir base denetimi bakım PR'sinin otomatik ftksaas/merge-clean kabulünü reddedecektir. Bu beklenen güven sınırıdır: bağımsız son-head incelemesi ve gerçek aday clean çalıştırılır; normal kabul/merge veya güvenilir politika kurulumunun tamamlandığı iddia edilmez. Gate gevşetilmez, başarı status'u elle yazılmaz, required check bypass edilmez ve repository yönetim ayarı değiştirilmez. Yeni runtime/annotation sonucu ve main kabulü henüz bekler.

### Bakım kurulumu ve main kabulü tamamlandı

PR #23, kullanıcı tarafından açıkça onaylanan tek seferlik güvenilir workflow kurulumu olarak normal merge API'siyle 24007212005d07938fb1265a9f42891f18d7fa09 SHA'sına alındı. Aday full clean 39282766184 / eab732f17d0e2955fb88c5e46354c785da89d845 / base9ce0a5639417f959111b11f70157156733e3de18 başarılıydı: 409 test, sıfır aday annotation warning/error; aday tree2b7a76e73ca1e2efd201b0d9a18bea4afe12007b gerçek merge ile aynıydı. [Main clean 39298247595](https://github.com/SXQHex/FtkSaaS/actions/runs/39298247595) Verify merged candidate relation ve test:clean ile 409 testi geçti; main'de de sıfır annotation warning/error. Önceki bakım adayı kurulum engeli kapanmıştır.

Repository ayarları ve required-check bypass kullanılmadı; gate kodu veya kaynak bağı zayıflatılmadı, sahte status yazılmadı. Tek seferlik kullanıcı yetkisi yeni workflow değişiklikleri veya P01 runtime'ı için otomatik istisna değildir. Güncel main'le aynı ci-full.yml blob'u taşıyan P01 son adayı normal kaynak bağlı kabul kapısından geçer; yeni head/base için eski clean geçerli sayılmaz.



## CD-01 kuruldu ve canlı kabulü tamamlandı — 21 Ekim 2026

PR32 head4e1e25c5 için bağımsız review5597902305 + aday39580259901 + açık exact-source kullanıcı kurulum onayı sonrası normal merge3e2fcd7 yapıldı. Trust kapısı gevşetilmedi; sahte status, bypass, direct push veya yönetim ayarı değişikliği yoktur. İlk main39582760620, Starter testinin3 saniyelik kurulum yarışı nedeniyle API3 başarısız oldu; CD39584677756 doğru biçimde skipped. Tarihsel başarısız sonuç korunur.

Test-only PR33 headfab366c5 bağımsız review5598374267, hedefli39585487735 (iki düzelen vaka dahil60 API+27 DB), aday39587119715 sonrasında normal merge ile `0fabf3a4a605dd6be5a1d358c660021f59406e20` main kaynağına alındı. [Aynı main39588975421](https://github.com/SXQHex/FtkSaaS/actions/runs/39588975421) core/dört API shard/toplayıcı completed/success. Runtime, migration ve CI kapıları test düzeltmesiyle değişmedi.

[CD39590690817 attempt1](https://github.com/SXQHex/FtkSaaS/actions/runs/39590690817/attempts/1), variable değeri TRUE olduğu için yazma öncesi yapılandırma kontrolünde durdu. Kullanıcı değeri true düzeltti; yalnız başarısız CD işleri yeniden çalıştırıldı, main full CI tekrarlanmadı. [Attempt2](https://github.com/SXQHex/FtkSaaS/actions/runs/39590690817/attempts/2) source/deploy success;17 kontrol geçti,49 migration/Edge4 ve fixture temizliği doğrulandı. İlk canlı CD kabulü tamamlandı. Ayrıntı/işletim/token rotasyonu [uzak backend kurulumundadır](remote-backend-setup.md).

CD aynı kaynak bağlı main kabulüne dayanır; belge kabulü full runtime kanıtı yerine geçmez. Kabul edilmiş runtime ile araya giren yalnız-belge main’in SHA’ları ayrı bağlanır; her yazma aşamasında run/attempt/işler ve güvenli belge eşdeğerliği yeniden doğrulanır. Gelecekteki trusted politika değişikliklerine bu PR’nin kurulum izni taşınmaz. Bu 21 Ekim CD-01 kapanışında P04 sıradaydı. Sonradan P01–P07 kaynak ve beş worker temel kurulum kabulü tamamlandı; frontend, dış e-posta ve yük/restore açık kalır.

## 23 Ekim dokümantasyon teslimi

P01–P07 kaynak kabulü kapanmıştır. Frontend/settings belge eşitlemesi yalnız incelenmiş source-bound belge yolundan geçer; yeni runtime kabulü gibi raporlanmaz. PR41 main39873010292 belge kabulü/CD deploy skipped örneğidir. Bilinmeyen/mixed yol aynı kapı tarafından reddedilir; izin listesi/CI workflow bu belge göreviyle değiştirilmez.

## 25 Ekim — ölçüm güncellemesi ve CLI bakımı

Supabase CLI tam2.122.0 sürümüne package+lockfile ile sabitlenir; her koşuda otomatik en son sürüm çekilmez. Dört API shardı, concurrency2 ve bütün full/main clean yükümlülükleri korunur. Süre kaynağı ve sonraki kontrollü ölçüm güncellemesi [performans kaydındadır](ci-performance.md). Yeni suite için gerçek pozitif ölçüm/inventory şartı, kaynak/head/base/merge-tree kabulü ve bağımsız inceleme kaldırılmaz. Tahmini süre gerçek CI sonucu değildir.

Bu bakım scripts/ci ve clean runner güven yüzeyini değiştirir. Mevcut trusted-base policyMatches denetimi aday full clean başarılı olsa bile otomatik merge-clean status’unu reddeder; bu beklenen kurulum sınırıdır. Bağımsız son kaynak incelemesi ve gerçek aday kabulü sonrası exact-source güvenilir politika kurulum yetkisi gerekir. Gate kodu, status, required check ve repository yönetim ayarları değiştirilmeyecek.
