# Eğitmen anlaşması, ücretli yoklama kapanışı ve hakediş

Başlangıç main `ab3fca4af47b71b34a4a7b6d0df5211ad1e41141`, [başlangıç temiz CI](https://github.com/SXQHex/FtkSaaS/actions/runs/39042108296). Bu başlangıcın başarısı yeni kaynağın kabulü değildir. Son head bağımsız inceleme/temiz CI ve merge sonrası aynı main SHA CI kanıtları PR üzerinde bağlanır.

## Uçtan uca akış

CM `instructor_agreement_publish_v1` ile kişi/merkez/disiplin/ders biçimi için açık ücret koşulunu yayımlar. `instructor_agreements_list_v1` immutable zinciri, predecessor ve gerçek sürümü sayfalı okur. Eski satırın terms/tarih/state/version alanları değişmez. Yeni sürüm explicit supersedes_id/expected_version ister; tek successor ve ilerleyen yürürlük sınırı korunur. Bağımsız örtüşen zincir ve aynı yürürlük anı reddedilir.

Gelecekteki başlamamış planlı seanslar yeni koşula bağlanır. `attendance_start_v1` gerçek başlangıcı açık Instant, seans sürümü ve gerekçeyle kaydeder; saatten otomatik olay türetmez. CM veya canlı görevli eğitmen bu komutu kullanır. Gerçek başlangıç anında bilinen yayımlanmış anlaşma kimlikleri sabitlenir. Geç girilmiş olguda sonradan yayımlanan koşul geçmişe taşınmaz. Erken başlamış seans yeni yayınla veya saat/görev değişimiyle yeniden fiyatlanmaz. `attendance_get_v1` gerçek başlangıç ve seans sürümünü verir. Gözlem kaydı olmayan eski/past seansın başlamadığı varsayılmaz; mevcut konservatif plan zaman koruması sürer. Otomatik başlangıç gözlemcisi tamamlandı iddiası yoktur.

Taslak yoklama hak tüketmez. Pro/Business kapanışı `performed` ve `performed_instructor_ids` alanlarıyla fiilen gerçekleşme/görev beyanını açıkça ister; seçilen kişiler seansın gerçek görev kapsamındadır. Hak tüketimi/serbest bırakma, rezervasyon sonucu, immutable closure, earning farkı, audit, uygulama içi outbox ve receipt aynı transaction'dır. Başlangıç kaydı tek başına hak/hakediş üretmez. Starter aynı F14 akışında anlaşmasız ve hakedişsiz kalır; eski Starter kapanışı plan yükselmesiyle hakedişe çevrilmez.

İlk kapanışın ücret koşulları, paket kimliği, gerçek satış bedeli payı, kaynak paketsiz negatif değerleme ve görev beyanı snapshot'tır. Paket özel değişken bileşen genel değişken koşulun yerine geçer; seans sabiti genel koşuldan bir kez alınır. Sabit, kişi başı, yüzde ve açık karma modeller desteklenir; örtüşen aynı bileşen veya aynı product_id tekrarı reddedilir. Deneme ve blocked sonuç kişi/yüzdeye girmez; fiilen yapılan seansın sabiti korunur. Tüketmeyen no-show değişken ücrete girmez. Süreli yüzde explicit fixed_unit ister; eksiklik sıfır ücret değildir. Para ara hesabı PostgreSQL numeric, son sonuç yarım değer sıfırdan uzağa yuvarlanmış bigint'tir. Salon kesintisi bir kez uygulanır; negatif/net taşan sonuç yeni öğrenci borcu yaratmaz ve yapılandırma hatası olarak atomik reddedilir.

`negcredit_valuation_set_v1` merkez sürümüyle merkez/disiplin/format/effective_at değerini append eder. `management_state_get_v1` yalnız bu yazmanın selector'ını uygular; key içinde discipline_id + format gerekir. Bu dar destek başka yönetim yazmalarının generic okumasını uygulanmış yapmaz. Zorunlu organizasyon değeri merkezden aşılamaz. Rezervasyon değerlemesi oluştuğu anda sabitlenir. Daha sonraki uygun satışın açığı kapatması eski eğitmen ücretini veya yeni para borcunu değiştirmez.

`earnings_list_v1` center, person, interval ve actor'a bağlı cursor ile hareketleri okur. Owner/OM org, CM kendi merkezi, eğitmen yalnız kendi canlı merkez rolüyle kendi hakedişini görür. Direction/previous_id/closure_id, miktar, ödeme dağıtımı ve satır sürümü açıktır; ters hareket negatif Money gibi gizlenmez. Rol/bağ geri alma sonraki okuma ve aynı receipt tekrarında geçerlidir.

Gerekçeli correction preview, sabit orijinal koşullardan hak ve finans farkını gösterir. Apply yeniden güncel seans/preview/yetki bağımlılığını denetler, önceki closure'a bağlı revision ve önceki earning'e bağlı add/subtract hareketi ekler. Gerçekleşme/görev beyanı da aynı gerekçeli yolla, donmuş görevli listesi içinde düzeltilebilir; boş attendance corrections bu açık beyan değişikliğinde geçerlidir. Eski ödeme/dağıtım silinmez. Gerçekleşmeyen seans sıfır ücret üretir; sonradan yanlış beyan düzeltmesi kayıt zincirini korur.

## Ayrı kalanlar ve üçüncü teslim bağlantısı

- `instructor_payment_record_v1` / `instructor_payment_correct_v1` contract_only; okuma mevcut dağıtım verisini gösterebilir. Kabul fixture'ındaki geçmiş ödeme, bu iki API'nin uygulanmışlığı değildir.
- A→B ledger ve Owner/delege OM/CM yetki, başvuru/onay, mahsup/bağlı düzeltme runtime'ı ayrı PR'dir. Bu teslim yeni merkezler arası hareket üretmez.
- Üçüncü teslim satış net tutarı/product credits paydası, tüketim allocation/reservation/closure, hizmet merkezi, gerçekleşme beyanı ve settled deficit allocation kanıtını kullanır. Orijinal earning snapshot'ı sonradan satışla değiştirilmez.
- Generic management_state diğer selector'ları; otomatik başlangıç gözlemi, zorunlu belge tüketicileri ve diğer finansal olmayan hak değişikliği koruma tüketicileri pending kalır.
- Frontend, production, Resend ve repository yönetimi değişmez. Yük/restore ve frontend gerçek entegrasyon kanıtsız kapatılmaz.

## Kabul ayrımı

`tests/instructor-earnings.test.mjs` gerçek Auth → Edge → RPC testidir. Yapısal governance/AJV/enum/üretilmiş envanter kontrolleri davranış kabulü değildir. Önceki raporlar tarihsel kalır. Son kaynak odaklı sonuç, tam temiz CI ve bağımsız inceleme ayrı raporlanır.
