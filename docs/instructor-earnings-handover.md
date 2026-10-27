> Alan devri: teknik tüketim ve kaynağına bağlı eski kabul kayıtları. Güncel kaynak/CI/hosted durum [00 devirde](contracts/00-FtkSaaS-yeni-sohbet-devir.md), açık iş [tek backlog’da](remaining-work.md) tutulur. Eski aday/pending ifadeleri yeni görev veya güncel durum değildir.

# Eğitmen anlaşması, ücretli yoklama kapanışı ve hakediş

PR #15 main’e birleşmiştir. Güncel uygulama SHA’sı, bağımsız son-head incelemesi, head CI ve merge sonrası temiz CI kanıtları [doğrulanmış devirde](contracts/00-FtkSaaS-yeni-sohbet-devir.md) birlikte bulunur. Başlangıç main ab3fca4af47b71b34a4a7b6d0df5211ad1e41141 önceki teslim referansıdır.

## Uçtan uca akış

CM `instructor_agreement_publish_v1` ile kişi/merkez/disiplin/ders biçimi için açık ücret koşulunu yayımlar. `instructor_agreements_list_v1` immutable zinciri, predecessor ve gerçek sürümü sayfalı okur. Eski satırın terms/tarih/state/version alanları değişmez. Yeni sürüm explicit supersedes_id/expected_version ister; tek successor ve ilerleyen yürürlük sınırı korunur. Bağımsız örtüşen zincir ve aynı yürürlük anı reddedilir. Devam sürümü de diğer bağımsız zincirlerin successor sınırında kesilmiş etkin aralığıyla çakışamaz; yalnız kendi predecessor soyu çakışma kontrolünden çıkarılır.

Gelecekteki başlamamış planlı seanslar yeni koşula bağlanır. `attendance_start_v1` gerçek başlangıcı açık Instant, seans sürümü ve gerekçeyle kaydeder; saatten otomatik olay türetmez. CM veya canlı görevli eğitmen bu komutu kullanır. Gerçek başlangıç anında bilinen yayımlanmış anlaşma kimlikleri sabitlenir. Geç girilmiş olguda sonradan yayımlanan koşul geçmişe taşınmaz. Erken başlamış seans yeni yayınla veya saat/görev değişimiyle yeniden fiyatlanmaz. `attendance_get_v1` gerçek başlangıç ve seans sürümünü verir. Gözlem kaydı olmayan eski/past seansın başlamadığı varsayılmaz; mevcut konservatif plan zaman koruması sürer. Otomatik başlangıç gözlemcisi tamamlandı iddiası yoktur.

Taslak yoklama hak tüketmez. Pro/Business kapanışı `performed` ve `performed_instructor_ids` alanlarıyla fiilen gerçekleşme/görev beyanını açıkça ister; seçilen kişiler seansın gerçek görev kapsamındadır. Hak tüketimi/serbest bırakma, rezervasyon sonucu, immutable closure, earning farkı, audit, uygulama içi outbox ve receipt aynı transaction'dır. Başlangıç kaydı tek başına hak/hakediş üretmez. Starter aynı F14 akışında anlaşmasız ve hakedişsiz kalır; eski Starter kapanışı plan yükselmesiyle hakedişe çevrilmez.

İlk kapanışın ücret koşulları, paket kimliği, gerçek satış bedeli payı, kaynak paketsiz negatif değerleme ve görev beyanı snapshot'tır. Paket özel değişken bileşen genel değişken koşulun yerine geçer; seans sabiti genel koşuldan bir kez alınır. Sabit, kişi başı, yüzde ve açık karma modeller desteklenir; örtüşen aynı bileşen veya aynı product_id tekrarı reddedilir. Deneme ve blocked sonuç kişi/yüzdeye girmez; fiilen yapılan seansın sabiti korunur. Tüketmeyen no-show değişken ücrete girmez. Süreli yüzde explicit fixed_unit ister; eksiklik sıfır ücret değildir. Para ara hesabı PostgreSQL numeric, son sonuç yarım değer sıfırdan uzağa yuvarlanmış bigint'tir. Salon kesintisi bir kez uygulanır; negatif/net taşan sonuç yeni öğrenci borcu yaratmaz ve yapılandırma hatası olarak atomik reddedilir.

`negcredit_valuation_set_v1` merkez sürümüyle merkez/disiplin/format/effective_at değerini append eder. `management_state_get_v1` yalnız bu yazmanın selector'ını uygular; key içinde discipline_id + format gerekir. Bu dar destek başka yönetim yazmalarının generic okumasını uygulanmış yapmaz. Zorunlu organizasyon değeri merkezden aşılamaz. Rezervasyon değerlemesi oluştuğu anda sabitlenir. Daha sonraki uygun satışın açığı kapatması eski eğitmen ücretini veya yeni para borcunu değiştirmez.

`earnings_list_v1` center, person, interval ve actor'a bağlı cursor ile hareketleri okur. Owner/OM org, CM kendi merkezi, eğitmen yalnız kendi canlı merkez rolüyle kendi hakedişini görür. Katılımcı quantity ve excluded_blocked sayıları ilgili immutable kapanış/revision zincirinden türetilir; eski hakedişin sayıları sonraki düzeltmeyle değişmez. Direction/previous_id/closure_id, miktar, ödeme dağıtımı ve satır sürümü açıktır; ters hareket negatif Money gibi gizlenmez. Rol/bağ geri alma sonraki okuma ve aynı receipt tekrarında geçerlidir.

Gerekçeli correction preview, sabit orijinal koşullardan hak ve finans farkını gösterir. Apply yeniden güncel seans/preview/yetki bağımlılığını denetler, önceki closure'a bağlı revision ve önceki earning'e bağlı add/subtract hareketi ekler. Gerçekleşme/görev beyanı da aynı gerekçeli yolla, donmuş görevli listesi içinde düzeltilebilir; boş attendance corrections bu açık beyan değişikliğinde geçerlidir. Eski ödeme/dağıtım silinmez. Gerçekleşmeyen seans sıfır ücret üretir; sonradan yanlış beyan düzeltmesi kayıt zincirini korur.

## Ayrı kalanlar ve üçüncü teslim bağlantısı

- `instructor_payment_record_v1` / `instructor_payment_correct_v1` P03 ile runtime ve kaynak kabulüne geçti. İlk PR'nin geçmiş ödeme fixture'ı bu sonraki kabulün kanıtı değildir. Tutarı karşılandıktan sonraki kullanılmayan earning_ids kapsam doğrulaması iyileştirmesi kalan işlerde açıktır.
- A→B ledger ve Owner/delege OM/CM yetki, başvuru/onay, mahsup/bağlı düzeltme runtime’ı sonraki hesaplaşma tesliminde uygulanmıştır; [hesaplaşma devri](settlement-handover.md) güncel davranış ve kabul sınırıdır. Eğitmen hakedişi ve merkez payı ayrı kayıtlardır.
- Üçüncü teslim satış net tutarı/product credits paydası, tüketim allocation/reservation/closure, hizmet merkezi, gerçekleşme beyanı ve settled deficit allocation kanıtını kullanır. Orijinal earning snapshot'ı sonradan satışla değiştirilmez.
- management_state_get_v1 hedefi ilgili operation_contract üzerinden seçilir; selector keyfi genel tablo sorgusu değildir. P02 hak değişikliği/koruma ve P05 belge/yoklama tüketicileri sonradan uygulandı. Otomatik başlangıç gözlemcisi bu kabulden türetilmez; açık Instant ile attendance_start akışı kullanılır.
- Frontend, production, Resend ve repository yönetimi değişmez. Yük/restore ve frontend gerçek entegrasyon kanıtsız kapatılmaz.

## Kabul ayrımı

`apps/backend/tests/instructor-earnings.test.mjs` gerçek Auth → Edge → RPC testidir. Yapısal governance/AJV/enum/üretilmiş envanter kontrolleri davranış kabulü değildir. Önceki raporlar tarihsel kalır. Son kaynak odaklı sonuç, tam temiz CI ve bağımsız inceleme ayrı raporlanır.

