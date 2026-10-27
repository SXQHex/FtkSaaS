> Alan devri: teknik tüketim ve kaynağına bağlı eski kabul kayıtları. Güncel kaynak/CI/hosted durum [00 devirde](../contracts/00-FtkSaaS-yeni-sohbet-devir.md), açık iş [tek backlog’da](remaining-work.md) tutulur. Eski aday/pending ifadeleri yeni görev veya güncel durum değildir.

# CI-02 — kaynak bağlı belge kabulü ve dört bağımsız shard

## Kapanış — 20 Ekim 2026

CI-02 done. PR25 head150d9fa/tree4b1d49b için kaynak incelemesi + aday39412474187 ve açık kullanıcı politika kurulum onayı; PR26 head01d5cbc/tree25e8b3b için yeni bağımsız inceleme + aday39423719153 ve ayrı açık kurulum onayı tamamlandı. Her ikisi normal iki-parent merge ile alındı; sahte status, bypass, yönetim ayarı veya direct push yok.

Son actual main **0ade7877cc16fc121095decbc276f2fbc868607e**, basea0325d7cdace18e3dfbb51691e631de53400724f, head01d5cbc8f8015e4293403d625bbebd51c7a2c31e. Tested merge51c0fc67228177f9694a160bc59cc5a7e70db4f4 ile actual main aynı iki parent ve tree25e8b3bdb0045a6aa21e84657830571ae9717aa1 taşır. [Main39425915555](https://github.com/SXQHex/FtkSaaS/actions/runs/39425915555) attempt1 completed/success: source, core, api-1…4, full-clean collector başarılı; optional serial-reference doğru biçimde skipped, hiçbir zorunlu iş atlanmadı. Main-binding-1 artifact12266003219 actual/head/base/tested merge/tree/run/attempt/coverage/profile bağını taşır.

462 benzersiz test düğümü: yapı96, CI politika37, DB27, API302 (shard58/71/79/94); sıfır fail ve sıfır test skipped. Her backend temiz34 migration ve boş Auth/tenant/receipt ile başladı; core sentetik seed, Auth/REST health ve advisors geçti. Source scope/type/runtime envanteri 199/118/81,34 migration olarak değişmedi. Full clean ile ayrı belge kabulü karıştırılmaz; sonraki belge main SHA'sı bu eski full clean'in çalıştığı kaynak sayılmaz.

[Performans](ci-performance.md) aynı kaynak seri/dört-shard ölçümünü ve yeni main sürelerini ayırır. Rutin geliştirmede hızlı/birikimli hedefli, son hazır runtime/CI adayı için açık full clean, merge sonrası aynı main full clean; güvenli yalnız-belge için ayrı source-bound belge kabulü aktiftir. Unknown/mixed/runtime girdisi, Draft/development ve eksik/skipped/başarısız zorunlu iş kapalıdır. Yeni trusted CI politika değişikliği otomatik kabul almaz; mevcut kaynak bazlı kurulum izinleri başka kaynağa taşınmaz.

Bu kapanış anında P01 ve CI-02 done, P02 henüz başlamamıştı. 23 Ekim güncel durumda P01–P07 kaynak kabulü kapalı, beş hosted worker temel kurulumu tamamdır. Frontend/production, Resend, yük/restore ve repository yönetim ayarları CI-02 kabulü değildir; güncel açıklar remaining-work.md içindedir.

<details>
<summary>Önceki dilimler ve hata teşhisleri — kaynaklarına ait tarihsel süreç</summary>

## Main kabul düzeltmesi — 20 Ekim 2026

PR25 son head150d9fafd38f19d990dd29019698d5a72fb62b60 bağımsız incelendi ve aday39412474187/attempt1 başarıyla geçti. Kullanıcı exact kaynak için güvenilir kurulum onayı verdi; normal merge ile main a0325d7cdace18e3dfbb51691e631de53400724f oluştu. Required check bypass, sahte status, yönetim ayarı veya direct push yoktu.

[Main39421388153](https://github.com/SXQHex/FtkSaaS/actions/runs/39421388153) gerçek merge/head/base/tree kanıtını doğruladı; core ve api-1…4 başarıyla geçti. İsteğe bağlı serial-reference main’de benchmark=false ile doğru biçimde skipped oldu. Toplayıcının ölçüm kodu bu işin olmayan Clean acceptance adımını okumaya çalışıp TypeError: Cannot read properties of undefined (reading started_at) verdi. Bu hata main kabulünü kapatır; önceki shard başarıları yeni SHA’ya taşınmaz.

Dar düzeltme yalnız gerçekten completed/success olmuş rolleri ölçer. Ölçümden ÖNCE zorunlu core/dört shard ve istenmişse serial-reference validateJobs tarafından aynı kaynak/run/attempt ve başarılı step koşuluyla denetlenmeye devam eder. Zorunlu skipped/cancelled/failure kabul edilmez. Gerçek main Jobs API metadata’sı önce hatayı üretti, sonra beş gerçek rolü finite sürelerle ölçtü. Yeni regresyon routine main skipped serial + zorunlu negatifleri kapsar; yerel37 politika testi geçti. Yeni branch fix/ci02-main-optional-measurement, hedefli/son inceleme/aday/main kabulü bekliyor; P02 başlamadı.

## Kaynak ve gerçek durum

Başlangıç main `d544efe9f88f34edd7d6ce3055ed46d291a55f2c`; [PR24](https://github.com/SXQHex/FtkSaaS/pull/24) birleşti. Aynı kaynak [39408606736](https://github.com/SXQHex/FtkSaaS/actions/runs/39408606736) `Verify merged candidate relation` içinde `No source-bound full clean evidence for merged tree` ile durdu; test çalışmadı. Kurulumdan önce koşulsuz cleanup ayrıca `supabase: not found` üretti. Eski run yeniden başarı gösterilmez.

P01 PR22 / `7577b2f1873c6b1fcf83390bfa94a34374c44082` / [39401570751](https://github.com/SXQHex/FtkSaaS/actions/runs/39401570751) completed/success ve P01 done korunur; başarı yeni SHA'ya taşınmaz. Ürün/runtime/migration/118 callable/81 contract_only/F01–F33 değişmedi. P02 başlamadı.

İlk geliştirme [PR25](https://github.com/SXQHex/FtkSaaS/pull/25), `ci/ci02-source-bound-shards` üzerinde Draft/development ile ilerledi; hazır geçişi sonrası birleşti. İlk dilim `fc074566643ac07afd00a82aa34d6f3cccf36452`: dar belge kabulü, source binding, recovery ve cleanup; yerel verify + 28 politika testi geçti. Yeni dört-shard dilimi yerel 36 politika testinden geçti; son 27fe070 kaynağının bağımsız incelemesi aday hazırlığını onayladı; uzak hedefli, bağımsız son-head incelemesi, aday/main kabulü ve kurulum henüz bekler. Geliştirme durumundan çıkış kendiliğinden clean değildir. Trusted base henüz yeni belge modülünü içermiyorsa docs classify kabul vermeden eligible=false ile kapanır; CI-02 kurulumu için belge istisnası açılmaz.

## PR24 için somut belge kanıtı

Birikimli fark `7577b2f… → 4e80716fdd6f12c3972635903c9435f253b34905`, actual merge `d544efe…`, gerçek iki parent ve tree ile değerlendirilir. 33 yaşayan Markdown ve `scripts/render_catalogs.py` değişmiştir; dependency/lockfile, migration, workflow, makine sözleşmesi, runtime tip/bundle ve endpoint JSON değişmemiştir.

Renderer değişikliği yalnız `schema[2]` giriş paragrafı, `schema +=` DS bağımlılık açıklaması (başlıkla sabitlenen dördüncü öğe) ve `feature_doc[2]` açıklamasıdır; ayrıca etkisiz son boş satır vardır. Trusted Python AST karşılaştırması yalnız bu konumlardaki metin sabitlerini normalleştirir. f-string ifadeleri, importlar, bütün diğer AST, emit hedefleri, envanter/iteration mantığı aynı kalmalıdır. JSON envanter üretimi içeren dosyanın tamamına istisna verilmez. Metin dışı veya bilinmeyen değişiklik reddedilir.

Belge yolları uzantıdan türetilmez: CI politikasındaki tam incelenmiş yol listesi, normal 100644 dosya ve UTF8/NUL kontrolü gerekir. Yeni bilinmeyen `.md`, runtime tarafından tüketilen JSON/tip, symlink veya karma kaynak tam yola gider. Rename iki uçtan, silme bütün yaşayan inbound linklerden kontrol edilir. Belge kabulü `docs-check` + `verify` çalıştırır; DB/API/full clean çalışmış sayılmaz.

`ci-fast` CI-02 dalında salt-okuma documentation-recovery işi yeni politika kaynağıyla eski merge'in iki parent/tree ve birikimli belge farkını kanıtlar, sonra exact d544efe checkout'unda belge kontrollerini çalıştırır. Artifact policy SHA + actual SHA + PR/head/base/tree + run/attempt taşır. Genel merge proof fallback'i, sahte commit status veya eski başarısız run'ın rerun'ı değildir. Elle çağrılan aynı dar audit için backend workflow_dispatch exact merge_sha kabul eder. İlk uzak kaynak 68bb98f / run39411398475 targeted işi 22 saniyede başarılı; recovery job'u context.repo getter'ının object spread ile kaybolması nedeniyle /repos/// URL'sinde 404 aldı. Getter'ı koruyan explicit repo context ve sentetik regresyon eklendi; Düzeltme 27fe070 / [39411888033](https://github.com/SXQHex/FtkSaaS/actions/runs/39411888033) içinde targeted ve documentation-recovery completed/success ile doğrulandı. Recovery job42 saniye, belge acceptance6 saniye; exact d544efe'de43 yaşayan dosya/240 link, 96 yapısal test ve eski CI politikasının24 düğümü (23 pass, sığ geçmişteki tarihsel fixture1 skip, sıfır fail). Bu atlanan tarihsel fixture full runtime kabulü değildir. Receipt: actual d544efe, PR24, base7577b2f, head4e80716, treecd131d085713066d37c9111289453aa95e5f5f3f, policy_sha27fe070, run39411888033/attempt1. Eski ana dal başarısız run'ı değişmeden kalır.

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

</details>
