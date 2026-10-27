> Alan devri: teknik tüketim ve kaynağına bağlı eski kabul kayıtları. Güncel kaynak/CI/hosted durum [00 devirde](contracts/00-FtkSaaS-yeni-sohbet-devir.md), açık iş [tek backlog’da](remaining-work.md) tutulur. Eski aday/pending ifadeleri yeni görev veya güncel durum değildir.

# Starter plan kapıları — uygulama ve kabul devri

Başlangıç: `3fa72e7b805b2bbfb8895f3d90813eaa3cb416aa`. Bu SHA'nın belge kabulü40386335578 ve CD kaynak kontrolü40386480669 başarılı; runtime kabul kaynağı7464383802deb8322e14a5ebec7d5e2ef650e436'dır. Yeni kaynak bu önceki CI başarısıyla kabul edilmiş sayılmaz. Güncel kabul main `ed747324f7d008b24103d4fd2eba503791c70a93` üzerindedir; aşağıdaki başlangıç SHA’sı önceki kaynak referansıdır. Bu teslim **Starter kapılarıdır**; Pro/Business diğer sayısal limitleri, fiyatlar ve özel teklif uygulaması ayrı iş olarak kalır.

## Çalışan kaynak değişikliği

`apps/backend/database/starter-plan-gates.sql` / uygulanmış66. migration;213 API,90 core tablo. Eski65 migration ve satış/plan sürümleri değiştirilmez. Eğitmen hesabı normal `role_assign_v1` ile veya mevcut aktif eğitmen ilişkisiyle tanınır; program için ikinci bir SQL ilişki kaydı gerekmez. Yeni özel `starter_change_scopes` tablosu, geçişin seçilmiş kapsamını ve kaynak abonelik sürümünü tutar; RLS açık, anon/authenticated erişimi kapalıdır. `starter_scope_required=true`, eski permissive Starter verisi kapsam seçimi olmadan sınır üstündeyse operasyonların kapalı olduğunu gösterir. Sessiz ilk kaynak seçilmez; owner mevcut güvenli pasifleştirme yollarıyla kapsamı daraltabilir veya üst plana dönüp dönem sonu için açık Starter seçimi yapabilir. Yeni alanlar dump/restore ve ilerideki fiziksel imha envanterine dahildir. Bu teslim fiziksel imha kabulü değildir.

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

İlk başarısız aday40415840619 ve önceki bekleme ifadeleri kendi kaynaklarının tarihsel kanıtıdır. F05 genel rol listesinin eski Starter beklentisi düzeltildi; Pro merkez izolasyonu assertion’ları korundu, owner/CM Starter retleri ayrıca doğrulandı. Runtime kapısı gevşetilmedi. [İlk kaynak raporu](history/reports/starter-plan-gates-20261026.md), [devralma ve native kabul](history/reports/starter-plan-gates-takeover-20261027.md), [rol testi düzeltmesi](history/reports/starter-plan-gates-role-read-ci-fix-20261027.md) yeniden yazılmadı.

Testlerde yalnız sentetik izole aktörler/veriler kullanıldı. Açık rezervasyonların booking kanıtı korundu; testin fiilî zaman kaydırmasında session ve resource booking saatleri birlikte tutuldu. Assertion veya ürün kuralı gevşetilmedi. Gerçek ortam verisi ve sırlar bu belge işinde değiştirilmez.

## Kapsam dışında kalanlar

Bu teslim Starter dağıtım yol haritasının bütünü değildir. Gerçek public hostname/Turnstile/siteverify ve istemci entegrasyonu, Pro/Business ayrı sayısal limit/özel teklif, kalan backend ürün akışları, fiziksel imha, gerçek worker yükü, yük/backup-restore ve production kabulü [kalan işler](remaining-work.md) ve [üretim kuyruğunda](production-queue.md) ayrı kalır. Önceden kabul edilmiş motorlar yeniden geliştirme işi değildir. Son kullanıcı kararıyla JWT doğrulaması açık kalır.
