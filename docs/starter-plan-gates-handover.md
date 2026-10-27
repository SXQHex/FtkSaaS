## Starter başlangıç ayarları ve self/public — backend adayı

Son kabul edilmiş taban PR60/main `6c7587b63681cc9f89d14483eaca71e520a074af` (213 API/67 migration); bu uygulama Draft PR61’de213 API/68 migration’dır. Önceki67 migration değişmez. Son aday/main/CD kabulü tamamlanmadan yeni kaynak yayımlanmış sayılmaz.

| Alan | API ve gerçek tüketici |
|---|---|
| FD07 başlangıcı | Yeni Starter organization_create_v1 aynı transaction’da org scope’lu sürüm1 negative_default=0, debt_booking=true, debt_participation=true üretir. Oluşum audit’i politika kimliklerini taşır; receipt replay yeni sürüm üretmez. Mevcut org/merkez/kişi/politika kayıtlarına backfill yok. |
| Miras ve yetki | policies_get_v1 ile merkezden org politikası okunur; policy_at/lesson_limits/rezervasyon/yoklama tüketir. Starter merkez override’ı açılmaz; org yöneticisinin mevcut policy_publish/impact yolları kullanılır. Genel settings patch’i bu iş politikalarının yerine geçmez. |
| Eksik yapılandırma | Merkez timezone’u açık seçilir. Oda/eğitmen uygunluğu, pencere, iptal/no-show, ürün hak/fiyat/süre/iade şartları açık domain komutlarıyla kurulur. Tanımsız değer, sahte çalışma saati veya ücretsiz hak üretilmez. Otomatik public yayın yok; publication_set_v1 açık hedef ve public_details ister. |
| Public başlangıç | Public takvim yalnız yayın allowlist’ini verir. Geçerli hizmet+imza+bot bağlamında submit yalnız intent üretir. CM review ile kişi/aday oluşturur/eşler; Starter genel CRM lead’i, satış, rezervasyon veya yönetim rolü oluşturmaz. |
| Öğrenciye geçiş | student_activate_v1, account_access_send_v1/accept_v1 ve doğrulanmış native hesap bağı; sonra ayrı sale/collection ve kendi reservation_create_v1. Yanlış hesap daveti alamaz; borç engeli yeni rezervasyonda gerçekten uygulanır. |

Frontend tasarımı/işleyişi, studiosaas dağıtımı ve DNS değişmedi. Hedef uye.fethiyetango.com; mevcut managed widget’a yalnız bu alan eklendi, eski alanlar/mode korundu. Gerçek istemcinin widget tokenı/siteverify kabulü bu backend/native bağlam testiyle kapanmış sayılmaz.

Public server adapter api/public-application.js, scripts/public-application-gateway.mjs ve mevcut signer’ı kullanır. Web Request/Response POST; exact HTTPS host/origin; Vercel’in overwrite ettiği tek x-vercel-forwarded-for IP’si; sabit Edge submit path;64KiB istek/yanıt; caller imza/auth/cookie’leri taşınmaz. Upstream yalnız kapalı accepted veya SafeError allowlist envelope’uyla döner; bozuk/taşan yanıt503, bozuk istemci JSON/UTF8 girdisi400’dür. Kodlar kanonik08 sözleşmesinden okunur; server dağıtımı bu sözleşme dosyasını da içermelidir. Bu adapter mevcut frontend’e dağıtılmadı.

Sunucu config’i: FTK_PUBLIC_APPLICATION_HOSTNAME, FTK_PUBLIC_INGRESS_SECRET (en az32bayt), FTK_PUBLIC_ANON_KEY (legacy anon JWT); isteğe bağlı FTK_PUBLIC_BACKEND_ORIGIN yalnız sunucuda HTTPS origin’dir, default mevcut geliştirme Supabase’idir. Edge’de FTK_PUBLIC_INGRESS_SECRET/FTK_PUBLIC_HASH_SECRET/FTK_TURNSTILE_SECRET gerekir. Public hostname FTK_PUBLIC_APPLICATION_HOSTNAME, yoksa legacy FTK_TURNSTILE_HOSTNAME olur. Handler erken kapısı ve siteverify aynı resolver’ı kullanır; recovery action legacy hostname’inde kalır. Sırlar istemciye/kaynağa/rapora yazılmaz.

Kabul kapsamı: native Auth→Edge→RPC yönetim/davet/self rezervasyon; public submit’in DB aşamasında yalnız yerel testte Edge-owned doğrulanmış bağlam emülasyonu; ayrıca tam handler signed ingress→preflight→mock siteverify→submit ve gateway adversarial sözleşme testleri. Bunlar gerçek Turnstile tokenı, dış SMTP veya frontend E2E kabulü değildir. Son kaynak/sonuçlar [PR61 backend raporundadır](../reports/starter-onboarding-20261027.md):151 yerel doğrulama, temiz native9+19=28/28 ve advisors exit0 geçti. Son aday/main/CD kabulü ayrıca bekler.

# Starter plan kapıları — uygulama ve kabul devri

Başlangıç: `3fa72e7b805b2bbfb8895f3d90813eaa3cb416aa`. Bu SHA'nın belge kabulü40386335578 ve CD kaynak kontrolü40386480669 başarılı; runtime kabul kaynağı7464383802deb8322e14a5ebec7d5e2ef650e436'dır. Yeni kaynak bu önceki CI başarısıyla kabul edilmiş sayılmaz. Güncel kabul main `ed747324f7d008b24103d4fd2eba503791c70a93` üzerindedir; aşağıdaki başlangıç SHA’sı önceki kaynak referansıdır. Bu teslim **Starter kapılarıdır**; Pro/Business diğer sayısal limitleri, fiyatlar ve özel teklif uygulaması ayrı iş olarak kalır.

## Çalışan kaynak değişikliği

`database/starter-plan-gates.sql` / uygulanmış66. migration;213 API,90 core tablo. Eski65 migration ve satış/plan sürümleri değiştirilmez. Eğitmen hesabı normal `role_assign_v1` ile veya mevcut aktif eğitmen ilişkisiyle tanınır; program için ikinci bir SQL ilişki kaydı gerekmez. Yeni özel `starter_change_scopes` tablosu, geçişin seçilmiş kapsamını ve kaynak abonelik sürümünü tutar; RLS açık, anon/authenticated erişimi kapalıdır. `starter_scope_required=true`, eski permissive Starter verisi kapsam seçimi olmadan sınır üstündeyse operasyonların kapalı olduğunu gösterir. Sessiz ilk kaynak seçilmez; owner mevcut güvenli pasifleştirme yollarıyla kapsamı daraltabilir veya üst plana dönüp dönem sonu için açık Starter seçimi yapabilir. Yeni alanlar dump/restore ve ilerideki fiziksel imha envanterine dahildir. Bu teslim fiziksel imha kabulü değildir.

Starter'ın canlı limit kataloğu beş kalemdir: merkez1, oda1, disiplin1, eğitmen1, aktif öğrenci100. `plan_limit`, `require_feature`, `lesson_plan` ve abonelik okuması aynı revizyona bağlıdır. Tarihsel bir plan sürümünün yüksek kotası veya fazladan feature bitleri Starter sınırını genişletemez. Mevcut Pro/Business katalog değerleri bu teslimle uydurulmaz.

Organizasyon kilidi insan komutu, import ve sınır worker'ıyla ortak serileştirme sağlar. Aktif merkez/oda/disiplin/öğrenci-eğitmen ilişkisi ve eğitmen rolü için DB trigger'ları ikinci kaynak/101. öğrenci yarışını atomik reddeder. Aynı organizasyon kişisi tek öğrenci sayılır; hesapsız öğrenci dahildir. Yetki kontrolü ve direct RPC erişim kısıtları korunur.

Plan denetimi yeni mutasyondan ve receipt sonucunun yeniden verilmesinden önce çalışır. Eski preview'nin request içeriği, eski satış/talep/alternatif ve oluşturulmuş kaynak referansı güncel kapsamla yeniden denetlenir. Personel izni plan izni değildir. Pro’dan kalan personel rolü/grant’i Starter’da operasyon yetkisi vermez; `staff_grant`, dispatcher fallback’i ve davet fallback’i bu lisansa tabidir. Aynı kişinin bağımsız öğrenci self veya atanmış eğitmen yetkisi bu yüzden kaldırılmaz. Başarısız komutun receipt/audit/outbox ve alan etkileri birlikte geri alınır.

Tek mantıksal oda ve tek eğitmen her program/seans önerisinde denetlenir. Eski odasız/atamasız Pro seansı Starter’da yeni rezervasyon/yoklama veya public işlem için uygun değildir; seçilmiş iptal edilmiş seansın tarihsel okunması korunur. Kategori/seans kapasitesi fiziksel oda tavanı içinde kalır; mevcut çakışma ve kontrollü kontenjan aşımı kuralları değiştirilmez. Starter F11 self rezervasyonu ve F16 süreli/sınırsız paket desteklenir. Paket yalnız merkez-disiplin kapsamındadır; adı kayıtlı disiplin adıyla başlar. PR56 kaynağında uyumsuz eski ürün kimliğine yayın da kapanıyordu. Kabul edilen tek-stüdyo67 teslimi, güncel disiplin ön ekiyle aynı ürün kimliğinde yeni sürüm yayımlar; ad sürüme snapshotlanır. Eski sürümle yeni satış kapısı güncel ön ekten geçer; eski satışın snapshotı/hak tüketimi değiştirilmez. Bu67 davranışının kabulü aşağıda ayrı izlenir. Genel CRM, etkinlik/workshop/parti, bekleme/yer teklifi, ücretli görevlendirme/hakediş ve ileri otomasyon kapalıdır. Yoklama/hak tüketimi anlaşmasız ve hakedişsiz çalışır.

F25 dar ders takvimi/başvurusu, genel CRM yetkisi değildir. Starter public okumaları ve tekrarlanan başvuru da güncel yayın/seans kapsamına tabidir. Ders başvurusu değerlendirmesi kişi/aday eşler; genel CRM lead'i yaratmaz. Gerçek public hostname/Turnstile/siteverify kabulü bu teslimle yapılmış sayılmaz. Native Auth'a CAPTCHA şartı eklenmez.

## Sürümlü plan düşürme

Son kullanıcı kararı: seçilmeyen kaynakların operasyon erişimi kapanır; veriler, kesin rezervasyonlar, hak/para ve denetim geçmişi silinmez/dönüştürülmez. Üst plana geçişte veriler yeniden erişilebilir. Bu kaynaklarda yoklama/hak tüketimi devamı istisnası verilmez. Kaçırılmış otomasyonlar geriye dönük çalıştırılmaz.

`subscription_downgrade_request_v1`, hedef Starter olduğunda `expected_version` (abonelik sürümü), `kept_center_id` ve `kept_scope` ister. Mevcut diğer plan geçişlerinin wire alanları korunur. Kapsam:

```json
{
  "room_id": "seçilen aktif oda veya bu aile boşsa null",
  "discipline_id": "seçilen aktif disiplin veya bu aile boşsa null",
  "instructor_id": "seçilen aktif eğitmenin person UUID'si veya aile boşsa null",
  "student_person_ids": []
}
```

Bütün UUID'ler aynı organizasyona, oda/disiplin/eğitmen ve öğrenciler seçilen merkeze aittir. Öğrenci listesi benzersiz ve en fazla100 kişidir. Boş olmayan kaynak ailesinde sessiz ilk kayıt seçimi yapılmaz. `management_state_get_v1` mevcut abonelik sürümünü verir; `subscription_get_v1` Starter veya bekleyen Starter geçişinde `subscription_version`, `starter_scope` ve `pending_starter_scope` döndürür. İki kapsam alanı `center_id`+`scope` nesnesi veya null'dır. Seçim ödenmiş dönem sonuna kadar yeni sürümlü taleple değiştirilebilir; talep abonelik sürümünü artırır. Sınır worker'ı kaydedilmiş seçimi plan+kapsam olarak aynı transaction'da uygular. Talep sonrası pasifleştirilen ilişki veya iptal edilen eğitmen rolü boş operasyonel slot bırakır; sınırı kilitlemez ve başka kaynak otomatik seçilmez. Boş eğitmen slotu normal yetki kontrolünden geçen açık rol atamasıyla doldurulur. Onaylı kişi birleştirme, güncel ve bekleyen kapsam UUID'lerini canonical hedefe aynı transaction içinde taşır; tarihsel kayıtlar korunur.

Geçişte seçilmeyen eski aktif satırların tarihsel state'i değiştirilmez; **operasyonel aktif kullanım**, aktif ilişki ve yürürlükteki seçilmiş kapsamın kesişimidir. Kota okumaları bu kapsamı sayar. Seçilmiş bir kaynak/ilişki meşru olarak pasife alınırsa mevcut domain kuralları korunur; boşalan slotta yeni kaynak oluşturmak/ilişkiyi açıkça aktive etmek receipt/audit'li komuttur. Öğrencinin açık işlem varken pasifleştirilmesi gibi mevcut korumalar kaldırılmaz.

## Doğrulama ve kapanış durumu

**Tamamlandı: kod, bağımsız inceleme, aday/main kabulü ve geliştirme/test dağıtımı.** Bu belge eşitlemesinin kendi kaynak kabulü runtime kabulünden ayrıdır.

| Kanıt | Doğrulanmış sonuç |
|---|---|
| Uygulama PR’si | [PR #56](https://github.com/SXQHex/FtkSaaS/pull/56), normal merge ile kapandı |
| Son uygulama head | `8cd720a7e5879ae30b90123100b8ddba7c4a3200` |
| Base | `3fa72e7b805b2bbfb8895f3d90813eaa3cb416aa` |
| Test edilen merge | `3e758583fbbfae08d1211dab07a579757d4d8439` |
| Kabul edilen main | `ed747324f7d008b24103d4fd2eba503791c70a93` |
| Test edilen ve main kaynak ağacı | `e67e059d3968d46bcbd7f9cacc95e75683c96111`; parentlar base + son head |
| Dar native kabul | Starter9/9; yoklama/abonelik20/20; oda/rol12/12. Bunlar ayrı koşulardır;149 yapısal kontrol geçti |
| Bağımsız inceleme | Son uygulama ve test fixture incelemelerinde bloklayıcı bulgu yok; PR56 kaynak kayıtları ve aşağıdaki raporlar |
| Aday full clean | [40419827224](https://github.com/SXQHex/FtkSaaS/actions/runs/40419827224): core, dört API shard ve toplayıcı başarılı; kaynak bağlı merge-clean doğrulandı |
| Aynı main full clean | [40422823564](https://github.com/SXQHex/FtkSaaS/actions/runs/40422823564): source/core/dört API shard/toplayıcı başarılı; istenmeyen optional serial-reference atlandı |
| Development CD | [40425584520](https://github.com/SXQHex/FtkSaaS/actions/runs/40425584520): aynı main kaynağında gerçek deploy,20/20 hosted kontrol ve sentetik fixture temizliği başarılı |
| Hosted envanter |66 migration içeriği eşleşti; backend-v1 Edge21 ACTIVE, `verify_jwt=true`;90 core tabloda RLS eksik0, istemci RPC EXECUTE0; advisors ERROR yok |
| CD artifact |12698584169; ZIP SHA256 `4add712822474c84707f3db469da4100b5a99cf8399ac4526d43b931eda5b919` |

İlk başarısız aday40415840619 ve önceki bekleme ifadeleri kendi kaynaklarının tarihsel kanıtıdır. F05 genel rol listesinin eski Starter beklentisi düzeltildi; Pro merkez izolasyonu assertion’ları korundu, owner/CM Starter retleri ayrıca doğrulandı. Runtime kapısı gevşetilmedi. [İlk kaynak raporu](../reports/starter-plan-gates-20261026.md), [devralma ve native kabul](../reports/starter-plan-gates-takeover-20261027.md), [rol testi düzeltmesi](../reports/starter-plan-gates-role-read-ci-fix-20261027.md) yeniden yazılmadı.

Testlerde yalnız sentetik izole aktörler/veriler kullanıldı. Açık rezervasyonların booking kanıtı korundu; testin fiilî zaman kaydırmasında session ve resource booking saatleri birlikte tutuldu. Assertion veya ürün kuralı gevşetilmedi. Gerçek ortam verisi ve sırlar bu belge işinde değiştirilmez.

## Kapsam dışında kalanlar

Bu teslim Starter dağıtım yol haritasının bütünü değildir. Gerçek public hostname/Turnstile/siteverify ve istemci entegrasyonu, Pro/Business ayrı sayısal limit/özel teklif, kalan backend ürün akışları, fiziksel imha, gerçek worker yükü, yük/backup-restore ve production kabulü [kalan işler](remaining-work.md) ve [üretim kuyruğunda](production-queue.md) ayrı kalır. Önceden kabul edilmiş motorlar yeniden geliştirme işi değildir. Son kullanıcı kararıyla JWT doğrulaması açık kalır.

## 27 Ekim — tek stüdyo kurulum ve ürün adı sürümü kabul edildi

Dar native tek-stüdyo7/7 ve seri Starter kapı9/9 geçti; kaynak hashleri ve başarısız ilk koşular [kabul kaydındadır](../reports/starter-studio-20261027.md). [PR #58](https://github.com/SXQHex/FtkSaaS/pull/58) main `5639783b5dcd963d84bb76ec7bdf75d65a75ced5` üzerinde kabul edildi: **213 API / 67 migration / 90 core tablo**. Son head `a9a09c8685d706d6f9abab842aeb10c7c90b565d` bağımsız incelemesi5662350042, [aday full clean40452100471](https://github.com/SXQHex/FtkSaaS/actions/runs/40452100471), [aynı main full clean40476673333](https://github.com/SXQHex/FtkSaaS/actions/runs/40476673333) ve [development CD40479412819](https://github.com/SXQHex/FtkSaaS/actions/runs/40479412819) başarılı. Aday ve main tree `3d1fc9d98c6eea8864c7bb99e9d7515200a86a74` aynıdır. CD67 migration içerik eşliğini ve20/20 kontrolü doğruladı;67 gerçekten uygulandı. Edge kaynağı değişmediği için yeniden deploy edilmedi; mevcut backend-v1 Edge21 ACTIVE ve `verify_jwt=true` korundu.

Başlangıç main `5892b3cb729d62a045358ffdc588a66361331537`; aynı kaynak main clean40430528120 ve development CD40432912898 başarılı. Kabul edilen kapsam **213 API / 67 migration / 90 core tablo**; önceki66 migration değişmez. Güncel F16 plan izi zaten Starter/Pro/Business’tır; eski Pro/Business-only etiketleri yeniden uygulanmaz. Başlangıç kaynağının kabulü ile yukarıdaki67 migration kabulü ayrı kaynaklara aittir.

Mevcut merkez/oda/disiplin/eğitmen/uygunluk/politika/program/paket/satış/rezervasyon/yoklama komutları kullanılır; yeni kurulum modülü veya endpoint yoktur. `core.product_versions.published_name` sürüme bağlı ad snapshot’ıdır. Eski sürümler yalnız migration öncesinde gerçekten saklanan ürün adıyla doldurulur; bilinmeyen eski adlar uydurulmaz. Starter yayını `terms.name` değerini kendi sürümüne kaydeder; güncel katalog etiketi de güncellenir. Diğer planlarda mevcut ürün kimliği adı davranışı korunur. Eski satışın product_version_id/tarih/bedel/kapsam/hakları yeniden yazılmaz.

Yeni yayın güncel disiplin adı ön ekini ister. Disiplin adı değiştikten sonra eski ön ekli sürümle yeni satış yapılmaz; aynı ürün kimliğinde doğru yeni adla yeni sürüm yayımlanabilir. Eski satışın uygun seçili kapsamındaki rezervasyon ve hak tüketimi devam eder. Canlı plan/yetki, scope, kapasite, borç, belge, kota ve receipt denetimleri korunur; genel JSON settings bu domain komutlarının yerine geçmez.

Kabul kaynağı `tests/starter-studio-acceptance.mjs` mevcut registry shard’ına bağlıdır: gerçek Starter kuruluşu; tek odada40 kişilik tekrarlı program ve ayrı saatte5 kişilik özel seans; eşzamanlı oda reddi ve fiziksel50 tavanı; kredili/kotalı süreli/sınırsız ürün satış-tahsilat-self rezervasyon-kapanış; ad/disciplin değişimi, immutable eski satış/sürüm ve sıfır hakediş. Test config/fiyatları yalnız sentetik kabul verisidir; yeni ticari/politika defaultu değildir. Bu alt teslim native kabul, bağımsız inceleme, aday/main full clean ve development CD ile kapandı. Bütün Starter dağıtım yol haritası veya production hazırlığı tamamlandı sayılmaz. Hedefli40436211363 öncelikli94 testi geçti, sonraki geniş regresyonda45 dakika sınırında iptal edildi; başarılı kabul sayılmadı. Son aday/main tam kapsamı ayrıca başarıyla geçti. Bu belge eşitlemesi yeni runtime test/deploy icrası değildir; tarihsel raporlar korunur.
