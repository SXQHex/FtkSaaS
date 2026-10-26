# Starter plan kapıları — uygulama ve kabul devri

Başlangıç: `3fa72e7b805b2bbfb8895f3d90813eaa3cb416aa`. Bu SHA'nın belge kabulü40386335578 ve CD kaynak kontrolü40386480669 başarılı; runtime kabul kaynağı7464383802deb8322e14a5ebec7d5e2ef650e436'dır. Yeni kaynak bu önceki CI başarısıyla kabul edilmiş sayılmaz. Bu teslim **Starter kapılarıdır**; Pro/Business diğer sayısal limitleri, fiyatlar ve özel teklif uygulaması ayrı iş olarak kalır.

## Çalışan kaynak değişikliği

`database/starter-plan-gates.sql` / yeni66. migration;213 API,90 core tablo. Eski65 migration ve satış/plan sürümleri değiştirilmez. Eğitmen hesabı normal `role_assign_v1` ile veya mevcut aktif eğitmen ilişkisiyle tanınır; program için ikinci bir SQL ilişki kaydı gerekmez. Yeni özel `starter_change_scopes` tablosu, geçişin seçilmiş kapsamını ve kaynak abonelik sürümünü tutar; RLS açık, anon/authenticated erişimi kapalıdır. `starter_scope_required=true`, eski permissive Starter verisi kapsam seçimi olmadan sınır üstündeyse operasyonların kapalı olduğunu gösterir. Sessiz ilk kaynak seçilmez; owner mevcut güvenli pasifleştirme yollarıyla kapsamı daraltabilir veya üst plana dönüp dönem sonu için açık Starter seçimi yapabilir. Yeni alanlar dump/restore ve ilerideki fiziksel imha envanterine dahildir. Bu teslim fiziksel imha kabulü değildir.

Starter'ın canlı limit kataloğu beş kalemdir: merkez1, oda1, disiplin1, eğitmen1, aktif öğrenci100. `plan_limit`, `require_feature`, `lesson_plan` ve abonelik okuması aynı revizyona bağlıdır. Tarihsel bir plan sürümünün yüksek kotası veya fazladan feature bitleri Starter sınırını genişletemez. Mevcut Pro/Business katalog değerleri bu teslimle uydurulmaz.

Organizasyon kilidi insan komutu, import ve sınır worker'ıyla ortak serileştirme sağlar. Aktif merkez/oda/disiplin/öğrenci-eğitmen ilişkisi ve eğitmen rolü için DB trigger'ları ikinci kaynak/101. öğrenci yarışını atomik reddeder. Aynı organizasyon kişisi tek öğrenci sayılır; hesapsız öğrenci dahildir. Yetki kontrolü ve direct RPC erişim kısıtları korunur.

Plan denetimi yeni mutasyondan ve receipt sonucunun yeniden verilmesinden önce çalışır. Eski preview'nin request içeriği, eski satış/talep/alternatif ve oluşturulmuş kaynak referansı güncel kapsamla yeniden denetlenir. Personel izni plan izni değildir. Pro’dan kalan personel rolü/grant’i Starter’da operasyon yetkisi vermez; `staff_grant`, dispatcher fallback’i ve davet fallback’i bu lisansa tabidir. Aynı kişinin bağımsız öğrenci self veya atanmış eğitmen yetkisi bu yüzden kaldırılmaz. Başarısız komutun receipt/audit/outbox ve alan etkileri birlikte geri alınır.

Tek mantıksal oda ve tek eğitmen her program/seans önerisinde denetlenir. Eski odasız/atamasız Pro seansı Starter’da yeni rezervasyon/yoklama veya public işlem için uygun değildir; seçilmiş iptal edilmiş seansın tarihsel okunması korunur. Kategori/seans kapasitesi fiziksel oda tavanı içinde kalır; mevcut çakışma ve kontrollü kontenjan aşımı kuralları değiştirilmez. Starter F11 self rezervasyonu ve F16 süreli/sınırsız paket desteklenir. Paket yalnız merkez-disiplin kapsamındadır; adı kayıtlı disiplin adıyla başlar. Eski ürünün adını geçmişe dönük düzeltmek yerine uyumsuz ada yeni Starter yayın/satış kapısı kapanır; doğru adla yeni ürün oluşturulur. Eski satışın snapshotı değiştirilmez. Genel CRM, etkinlik/workshop/parti, bekleme/yer teklifi, ücretli görevlendirme/hakediş ve ileri otomasyon kapalıdır. Yoklama/hak tüketimi anlaşmasız ve hakedişsiz çalışır.

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

## Doğrulama durumu

Ayrıntılı kaynak hashleri ve koşu sınırları [kabul raporundadır](../reports/starter-plan-gates-20261026.md). Yapısal `npm run verify` geçti. Yeni66 migration izole native Supabase'e temiz resetle uygulanmıştır. 27 Ekim devralmasında son kaynak Starter native9/9 ve149 yapısal kontrol geçti; bağımsız kaynak incelemesinde bloklayıcı bulgu yok. Aynı kaynak mevcut yoklama/koruma ve abonelik regresyonu devam ediyor; [devralma kabul kaydı](../reports/starter-plan-gates-takeover-20261027.md). Aday full clean henüz başlatılmadı. Main/hosted uygulaması yapılmadı; bu taslak tamamlandı sayılmaz.

Testlerde yalnız sentetik izole aktörler/veriler kullanılır. Yeni saatli tek oda/eğitmen modelinde eski eşzamanlı, kaynaksız test seansları ayrı saatlere taşınır. Testin fiilî zaman kaydırmasında session ve resource booking saatleri birlikte tutulur; kural/assertion gevşetilmez. Gerçek ortam verisi, secret veya provider ayarı değiştirilmez.
