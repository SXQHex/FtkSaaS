# 25 Ekim 2026 — oda, seans ve kontrollü kapasite aşımı

Durum: kullanıcı tarafından kabul edilmiş ürün kararı; bu branch uygulaması aday/main ve gerçek Auth → Edge → RPC kabulü tamamlanmadan yayımlanmış sayılmaz. Başlangıç main: `702063807b0a0d09f559f070ffde1b1ae3e7563b`. Aynı SHA'nın [39890889184](https://github.com/SXQHex/FtkSaaS/actions/runs/39890889184) kaynak/belge kontrolleri başarılıdır; runtime clean skipped, yeni kapasite davranışına kabul taşımaz.

## Kabul edilmiş davranış

- Odanın tek fiziksel insan kapasitesi bulunur. Seansın kayıt kapasitesi ayrı girilir ve oda kapasitesini geçemez.
- Seanslarda nominal/maksimum ayrımı kaldırılır. Öncelikli/esnek paket veya kayıt biçimi korunur; farklı bir kapasite sınırı veya kendiliğinden aşım yetkisi sağlamaz.
- Kategori kullanılmayan seansta yalnız toplam kontenjan uygulanır. Kategorili seansta erkek/kadın kontenjanları ve toplam kontenjan birlikte denetlenir; boşluk kategoriler arasında otomatik aktarılmaz.
- Toplam veya kategori kontenjanı dolduğunda normal rezervasyon reddedilir. Kesin kayıt ve süresi dolmamış bekleme/deneme teklifleri ortak yer tutar.
- Canlı yetkili eğitmen, çalışan veya yönetici seans bazında açık, ayrı bir işlemle tek rezervasyon için toplam ve/veya kategori sınırını kontrollü aşabilir. Odanın fiziksel sınırı her durumda korunur.
- İşlemi yapan hesap/kişi, gerekçe, aşılan toplam/kategori kontenjanı, işlem öncesi doluluk ve aşım miktarı append-only audit'te tutulur. Aynı işlem tekrarı ikinci kayıt/audit üretmez; yetki geri alındıysa eski başarılı sonuç dahi yetkisiz replay edilmez.
- Kalıcı seans kapasitesi/kategori değişimi ayrı sürümlü yapılandırma işlemidir. Tek kayıt aşımı tanımlı kapasiteyi veya seans sürümünü değiştirmez.
- Hak, kredi/borç, belge, zaman, sınıf erişimi, rol/plan, tenant/merkez ve mükerrer rezervasyon kapıları aşım işleminde de korunur. Geç hata bütün rezervasyon/hak/audit/receipt etkilerini geri alır.

## Teknik karşılık ve istemci geçişi

| İşlem | Yeni sözleşme |
|---|---|
| `room_save_v1` | `capacity: Count`; eski `capacities[]` isteği kaldırılır. Mevcut oda güncellemesi `expected_version` ister. |
| `session_create_v1`, program `schedule`, `SessionCreate`, yerine seans ve seans patch | `capacity: { total, categories?: {male, female} veya null }`. Toplam sınır ile her kategori sınırı birlikte uygulanır. |
| `session_capacity_set_v1` | `capacity` nesnesi, mevcut seans sürümü ve gerekçe. Eski üst düzey `nominal/maximum` alanları kaldırılır. |
| `session_get_v1`, takvim seansları, program/seans önizlemesi | Seans için yeni `capacity` nesnesi; güncel okumalarda toplam/kategori doluluğu ve kalan yer, oda tavanı. Etkinlik kapasitesi bu ders tesliminde değiştirilmez. |
| `reservation_create_v1` | Kategorili seansta `booking_category: male/female` zorunlu; kategorisiz seansta gönderilmez. Normal toplam/kategori sınırları geçerlidir. |
| `reservation_capacity_override_v1` | Normal rezervasyon alanları + boş olmayan `reason`; ayrı idempotency/operasyon/audit kimliği. Oda sınırını aşamaz. |
| `waitlist_join_v1`, `trial_offer_create_v1`, özel ders onayı | İlgili kategorili seans için kayıt kategorisi açık seçilir. Kategori bekleme/teklif/rezervasyon dönüşümünde korunur. |

Kategori, bu teslimde kayıt isteğinde seçilen kontenjan kategorisidir; kişi profiline cinsiyet alanı eklenmez veya geçmiş kişi verisinden cinsiyet tahmin edilmez. Yeni bir hukuki kimlik doğrulama kuralı üretilmez.

Yetki: merkez yöneticisinin canlı merkez yetkisi; personelin aynı merkezde açık `reservation.capacity_override` izni; eğitmenin aynı merkezde aktif eğitmen rolü ve ilgili seans görevlendirmesi gerekir. Owner/organizasyon yöneticiliği tek başına merkez operasyon yetkisi vermez. İstemciden aktör/rol beyanı kabul edilmez.

## Veri geçişi ve sınırlar

Main’deki uygulanmış 60 migration değiştirilmez. Kapasite SQL’i değişmeden, Supabase CLI ile üretilen `20261025143856_session_capacity.sql` adıyla 61. sıraya alınır; eski taslak `20261025030000_session_capacity.sql` uygulanmadığı için kaldırılmıştır. Yeni append-only migration oda fiziksel kapasitesini ve kategori snapshot alanlarını ekler. Eski `sessions.nominal` tek toplamın uyumluluk depolamasıdır; `maximum` eski şema/etkinlik bağımlılıklarını bozmamak için korunur, yeni yazımlarda toplamla eşitlenir ve kayıt kapısında farklı tavan olarak kullanılmaz. Bu adlar seans API'sinden kaldırılır. Tarihsel defter, fiyat, ödeme, hakediş ve önceki audit değiştirilmez.

Eski disiplin bazlı oda değerleri fiziksel kapasite kanıtı değildir. Eski odalarda yeni alan `null` kalır; yetkili kişi gerçek kapasiteyi girene kadar odayı kullanan yeni seans/rezervasyon işlemi `POLICY_NOT_CONFIGURED` verir. Migration mevcut rezervasyonları silmez. Oda küçültme, açık seansların tanımlı kapasitesi veya mevcut kayıt/teklif doluluğu yeni fiziksel sınırı aşacaksa reddedilir; açık kayıtların sessiz iptali yoktur.

Seans toplam/kategori indirimi mevcut kesin kayıtları otomatik iptal etmez. Kategorisiz mevcut aktif kayıt/teklifler varken kategorili yapıya geçiş, kategori tahmini yapılarak tamamlanmaz. Böyle bir geçiş `VALIDATION_FAILED` ile reddedilir; mevcut işlemler açık ve yetkili yollarla çözülmelidir. Kategoriler arası FIFO uygulanabilir kontenjan içinde korunur; dolu kategorinin bekleyeni diğer kategorinin boşluğunu bloke etmez.

Birden çok oda atanmışsa her birinin fiziksel sınırı korunur; oda kapasiteleri toplanmaz. Oda atanmamış mevcut açık alan/uzaktan seans modellerine yeni bir oda zorunluluğu eklenmez. Etkinliklerde sınırsız kapasite ve diğer P08 işleri bu teslimle kapanmaz.

## Kabul kanıtı

Yapısal sözleşme/tip/validator/SQL kayıt kapısı kontrolleri ile gerçek Auth → Edge → RPC senaryoları ayrı raporlanır. Yeni testler: toplam/kategori doluluğu; öğrenci/yabancı tenant retleri; yönetici/açık personel/atanmış eğitmen yetkisi; canlı yetki geri alma; aynı anahtar replay/farklı payload; son fiziksel yer yarışı; hak yetersizliği ve geç audit hatasında rollback; tekliflerin ortak havuzu; kalıcı kapasite değişikliği ve eski alanların reddi. Çalıştırılmamış senaryo geçti sayılmaz. Son kaynak bağımsız inceleme, aday full clean ve aynı main kabulü ayrıca zorunludur.

Kaynak bağlı dar doğrulama: [rapor](../history/reports/session-capacity-validation.json). Son kaynakta 7/7 gerçek Auth→Edge→RPC, yerelde 103+43 yapısal test geçti. Tam kaynak bağımsız inceleme, GitHub hedefli ve aday/main clean kabulü bekler; birleştirme/hosted dağıtım yapılmadı.

25 Ekim bağımsız inceleme düzeltmesi: kapasite-only genel seans değişikliği de fiziksel/kategori korumalarını uygular; kaynak ve görevleri yeniden yazmaz. Bekleme keşif anahtarı oda yapılandırması ve kategori doluluğunu içerir; toplam yer sayısı değişmeden kategori boşluğu açılması da yeniden teklif keşfi üretir. [Bulgular ve kanıt](../history/reports/session-capacity-independent-review.md).
