# CI-02 — kaynak bağlı belge kabulü ve dört bağımsız shard

## Kaynak ve gerçek durum

Başlangıç main `d544efe9f88f34edd7d6ce3055ed46d291a55f2c`; [PR24](https://github.com/SXQHex/FtkSaaS/pull/24) birleşti. Aynı kaynak [39408606736](https://github.com/SXQHex/FtkSaaS/actions/runs/39408606736) `Verify merged candidate relation` içinde `No source-bound full clean evidence for merged tree` ile durdu; test çalışmadı. Kurulumdan önce koşulsuz cleanup ayrıca `supabase: not found` üretti. Eski run yeniden başarı gösterilmez.

P01 PR22 / `7577b2f1873c6b1fcf83390bfa94a34374c44082` / [39401570751](https://github.com/SXQHex/FtkSaaS/actions/runs/39401570751) completed/success ve P01 done korunur; başarı yeni SHA'ya taşınmaz. Ürün/runtime/migration/118 callable/81 contract_only/F01–F33 değişmedi. P02 başlamadı.

Tek geliştirme [Draft PR25](https://github.com/SXQHex/FtkSaaS/pull/25), `ci/ci02-source-bound-shards`, `development`. İlk dilim `fc074566643ac07afd00a82aa34d6f3cccf36452`: dar belge kabulü, source binding, recovery ve cleanup; yerel verify + 28 politika testi geçti. Yeni dört-shard dilimi yerel 36 politika testinden geçti; uzak hedefli, bağımsız son-head incelemesi, aday/main kabulü ve kurulum henüz bekler. Geliştirme durumundan çıkış kendiliğinden clean değildir.

## PR24 için somut belge kanıtı

Birikimli fark `7577b2f… → 4e80716fdd6f12c3972635903c9435f253b34905`, actual merge `d544efe…`, gerçek iki parent ve tree ile değerlendirilir. 33 yaşayan Markdown ve `scripts/render_catalogs.py` değişmiştir; dependency/lockfile, migration, workflow, makine sözleşmesi, runtime tip/bundle ve endpoint JSON değişmemiştir.

Renderer değişikliği yalnız `schema[2]` giriş paragrafı, `schema +=` DS bağımlılık açıklaması (başlıkla sabitlenen dördüncü öğe) ve `feature_doc[2]` açıklamasıdır; ayrıca etkisiz son boş satır vardır. Trusted Python AST karşılaştırması yalnız bu konumlardaki metin sabitlerini normalleştirir. f-string ifadeleri, importlar, bütün diğer AST, emit hedefleri, envanter/iteration mantığı aynı kalmalıdır. JSON envanter üretimi içeren dosyanın tamamına istisna verilmez. Metin dışı veya bilinmeyen değişiklik reddedilir.

Belge yolları uzantıdan türetilmez: CI politikasındaki tam incelenmiş yol listesi, normal 100644 dosya ve UTF8/NUL kontrolü gerekir. Yeni bilinmeyen `.md`, runtime tarafından tüketilen JSON/tip, symlink veya karma kaynak tam yola gider. Rename iki uçtan, silme bütün yaşayan inbound linklerden kontrol edilir. Belge kabulü `docs-check` + `verify` çalıştırır; DB/API/full clean çalışmış sayılmaz.

`ci-fast` CI-02 dalında salt-okuma documentation-recovery işi yeni politika kaynağıyla eski merge'in iki parent/tree ve birikimli belge farkını kanıtlar, sonra exact d544efe checkout'unda belge kontrollerini çalıştırır. Artifact policy SHA + actual SHA + PR/head/base/tree + run/attempt taşır. Genel merge proof fallback'i, sahte commit status veya eski başarısız run'ın rerun'ı değildir. Elle çağrılan aynı dar audit için backend workflow_dispatch exact merge_sha kabul eder. İlk uzak kaynak 68bb98f / run39411398475 targeted işi 22 saniyede başarılı; recovery job'u context.repo getter'ının object spread ile kaybolması nedeniyle /repos/// URL'sinde 404 aldı. Getter'ı koruyan explicit repo context ve sentetik regresyon eklendi; yeni uzak recovery kabulü henüz bekler. Ana dalın eski başarısız run'ı değişmeden kalır.

## Zorunlu clean kapsamı

Aday ve main aynı `clean-suite.yml` reusable workflow ve aynı test-clean rol runner'ını kullanır. Her core/API/seri kıyas işi ayrı ubuntu runner, bağımsız native backend/DB, tam migration manifest eşleşmesi ve boş Auth/tenant/receipt kontrolü ile başlar. Ortak DB üzerinde concurrency artırılmadı; suite içindeki bağlı yarış vakaları bölünmez, mevcut process concurrency=2 korunur.

| İş | Korunan yükümlülük |
|---|---|
| core | Temiz reset + migration/boş fixture kanıtı; generate drift/TypeScript/audit/governance/contract/CI testleri; 27 DB testi; sentetik seed; Auth/REST health; advisors; JSON health doğrulaması |
| api-1…4 | Her runner'da aynı temiz reset/migration/fixture kanıtı; 15 API suite'inin eksiksiz ve tekrarsız ölçümlü deterministik dağılımı; bütün mevcut Auth/Edge/RPC/yarış vakaları |
| full-clean | GitHub Jobs API üzerinden bütün zorunlu iş/step'lerin aynı run, attempt, head ve gerçek success durumunu denetler; source/coverage binding artifact ve ölçüm üretir |
| serial-reference | Yalnız açık `ci:measure-serial` etiketiyle aynı kaynakta ek karşılaştırma; eski seri kapsamın tamamı, aynı reset/verify/DB/API/seed/health/advisors. İstenmişse başarısı zorunludur |

Shard dağılımı [suite-durations.json](../scripts/ci/suite-durations.json) ölçümüne dayanır: süre azalan, eşitlikte dosya adı ve shard numarasıyla LPT. Test envanteri package test:api ve seçiciyle eşleşir; yeni/missing/duplicate suite kapalıdır. Ağırlıkların toplamı tahmini wall değildir; süreçler concurrency=2 altında örtüşür. Gerçek yeni sonuçlar [performans belgesinde](ci-performance.md) ayrıca yazılacak.

Eksik, skipped, cancelled, failure, farklı run/attempt/head, eksik Clean acceptance step'i, bozuk coverage veya gerektiğinde eksik seri benchmark kabulü kapatır. Rerun-failed ile eski attempt'ten başarı birleştirilmez; yeni attempt tüm zorunlu işleri kapsamalıdır. Artifact tek başına kabul değildir. Privileged status yalnız main'deki trusted verifier tarafından, salt-okuma aday işlerinin gerçek kaynak/step kanıtıyla yazılır.

## Geliştirme ve güvenilir kurulum

Push yalnız hızlı/hedefli; PR açılışı/güncellemesi ve ready/development temizliği full clean tetiklemez. Draft/development aday resolver'ında ve merge kapısında reddedilir. Yalnız `ci:full-clean` etiketinin açık eklenmesi runtime/CI son adayını başlatır. Güvenli belge PR/merge ayrı belge acceptance alır. Her main push bütün açık PR'lerin güncel base kapısını tekrar denetler; eski source binding geçersizdir.

CI-only geliştirme seçimi yalnız son commit'e bakmaz: main merge-base'ten birikimli farkın sonlu incelenmiş CI harness listesi + güvenli belge kaynaklarından oluştuğunu kanıtlar. Bu durumda verify ve politika negatifleri çalışır; ürün farkı veya bilinmeyen CI/doc adı varsa normal dependency graph/geniş geri dönüş korunur. Açık son aday bütün gerçek runtime kapsamını yine çalıştırır.

Güven yüzeyi artık full workflow dışında tüm workflow'lar, scripts/ci ve clean/start runner'larının kaynak blob/mode kümesini de kapsar. Policy değişikliği normal otomatik merge kapısından geçmez. CI-02 bu sınırı kendisi gevşetmez. PR23'ün tek seferlik kullanıcı kurulum izni bu teslimi kapsamaz. Son-head bağımsız inceleme ve gerçek aday kanıtından sonra bu somut CI-02 politika kurulumu için açık yetki değerlendirilir; normal merge API dışında status/bypass/ayar/direct push yoktur. Repository yönetim ayarları doğrulanmış/değiştirilmiş sayılmaz.

Aday veya main full clean tetiklenince ajan kaynak/run/sonraki adımı bildirip durur. Kullanıcı dönmeden polling/log izleme yoktur. CI-02 main kabulü tamamlanmadan P02'ye geçilmez.
