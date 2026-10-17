# Starter yoklama ve kesin rezervasyon koruması devri

Başlangıç: main `5265a70a0d29f91b9081a1ecbc2a8f0ff78668ee`; aynı SHA’nın başarılı [CI çalışması](https://github.com/SXQHex/FtkSaaS/actions/runs/39030586306). Başlangıcın 322 testi yeni head’in kabulü değildir. Son PR head/inceleme/temiz CI kanıtı PR üzerinde aynı tam SHA’ya bağlanır.

## Sözleşme ve zorunlu bağımlılıklar

Kabul edilmiş DS kararları değişmedi. F14 Starter’da hak tüketir; F20 anlaşma/hakediş değildir. Önceki runtime’da ders yoklaması yoktu; etkinlik kapanışı ders yerine kullanılamazdı. Mevcut allocation motoru kullanıldı; yeni satış/negatif rezervasyonun açık blocked-policy snapshot’ı, negatif yükümlülük hareket zinciri ve fiilen yakalanan kapanış hak/plan snapshot’ları eklendi. Eski migration’lar değiştirilmedi.

Gerçek Starter akışı için referans feature listesinin topluca kapı olması giderildi: eğitmen rolü F04, personel ataması ayrıca F05; ders F08 ve özel ders F09; sınıf F10 ve dışa açık seçilirse F11; rezervasyon F15, öncelikli sınıf F10 ve öğrencinin esnek grup kaydı F11; kredi ürünü F15, süreli F16, dondurma F17 ve başka merkez kapsamı F18; satış F15/F19 ve süreli ürün F16. Oturum görev değişikliği F13; açık ücret anlaşması referansı F20 kalır. Starter eğitmen görevi ücret anlaşması seçmez/üretmez. Bu dar kapı düzeltmeleri yeni ürün davranışı değildir.

Pro/Business kapanışı, henüz uygulanmayan kabul edilmiş anlaşma/hakediş motoruna bağımlıdır: hak/kapalı yoklama/audit/outbox/receipt yazmadan `POLICY_NOT_CONFIGURED`. Ücretli yolu atlayarak başarı dönmez. Kaydedilmiş Starter kapanışının gerekçeli düzeltmesi kendi `starter_no_earning` snapshot’ını kullanır. Anlaşma sürümleme, ürün override, hakediş ve hesaplaşma bu teslimde yoktur.

## Uçtan uca yol

Yetkili merkez yöneticisi Starter ders/programını anlaşmasız oluşturur; mevcut takvim/seans okuması sonucu gösterir. Gerçek rezervasyon hakkı/negatif yükümlülüğü ayırır. Politika veya kişisel limitte yeni olumsuz etki önce `reservation_impact_preview_v1` ile gösterilir; tam etkilenen liste açıkça onaylanır. `reservation_impact_apply_v1`, korumalı `policy_publish_v1` veya `negative_limit_set_v1` alternatif tek commit yollarıdır; art arda iki değişiklik olarak çağrılmaz.

`negative_limits_get_v1` merkez/kişi/disiplin limitlerini ve gerçek `people.version` aggregate’ını döndürür. `attendance_get_v1` rezervasyon/seans sürümlerini sağlar. I/A projeksiyonu finansal eligibility snapshot’ını açmaz. Aktif görev tek başına yetki değildir: canlı login rolü gerekir; legacy sınıf görevi aynı kontrolle çözülür. Owner’a merkez operasyon rolü türetilmez.

`attendance_mark_v1`/`attendance_block_v1` yalnız taslak ve gerçek değerlendirme kanıtını yazar; tüketim yoktur. Kapanış bütün iptal edilmemiş sonuçları ve seans sürümünü doğrular; allocation/negatif yükümlülük, rezervasyon, kapanış snapshot’ı, audit/in-app outbox/receipt aynı transaction’da kesinleşir. Starter hakediş üretmez. Gerekçeli correction preview/apply önceki kapanışa bağlı revision/hak hareketi ekler; geçmişi silmez, seansı açmaz.

Koruma yalnız değişikliğin neden olduğu olumsuz etkiye bağlıdır. Önceden bağımsız uygunsuz kayıt etkisiz politika yayımıyla muaf olmaz. Sabit yükümlülük/negatif toplam tavanı ve borç kimlikleri tutulur; sonraki bağımsız engel affedilmez. Yayınlanmış ama gelecekte etkinleşen politika altında arada yetkilendirilmiş kaydın gerçek booking kanıtı korunur. Kaynak/uygunluk engelleri kaldırılmaz; yeni kayıt güncel koşullara tabidir. Koruma iptal, borç silme veya yeni hak üretmez.

## Açık tüketiciler ve sınırlar

- Politika/kişisel limit dışındaki `credit_adjust`, `sale_scope`, `entitlement_extend` impact türleri `POLICY_NOT_CONFIGURED`; altyapı kurulması uygulama değildir.
- Kredi düzeltme, satışın kabul edilmiş kapsam değişikliği, geçerlilik uzatma, dondurma/erken bitirme, hak sonlandırma koruma tüketicileri pending. Satışla geçmiş açık kapama ve settled deficit’in sonradan yoklama düzeltmesi ayrı teslimdir; allocation kanıtı olmayan settled deficit correction başarı göstermez.
- Başlangıç anını otomatik gözlemleyen ders katılım tüketicisi henüz yok. Taslağın `evaluated_for` değeri gerçek değerlendirme zamanıdır; başlangıç snapshot’ı değildir. Geç kapanışta bugünkü bakiyeden geçmiş başlangıç türetilmez; kanıt eksik diye kabul edilmemiş toplu kapanış engeli konmaz. Başlangıç öncesi taslak ile başlangıç arasındaki bağımsız uygunluk değişiminin tam kabulü pending.
- Pro/Business finansal kapanış/düzeltme, anlaşma zinciri ve hakediş/hesaplaşma pending. F14/F20 ayrımı bunların tamamlandığını söylemez.
- Eski satış/rezervasyona blocked-policy snapshot’ı geri doldurulmaz. Eksik tarihsel koşulda ilgili blocked sonucu POLICY_NOT_CONFIGURED; diğer katıldı/no_show yolu koşulları varsa çalışır.
- Zorunlu belge kapısının ders tüketicisi bu koruma ile tamamlanmadı; geniş DS-PROT-03 kabulü açık.
- Frontend, production, Resend ve main koruması değişmedi. Bu yeni PR için merge yapılmaz.

## Kanıt ayrımı

Yapısal kontroller davranış kabulü değildir. Mevcut 202 API/27 DB regresyonu ayrı tutulur. Yeni gerçek Auth → Edge → RPC testleri `tests/starter-attendance-protection.test.mjs`: anlaşmasız Starter program, plan sınırları, limit/politika etki/onayı, eski korunan/yeni reddedilen kayıt, taslak/kapanış/düzeltme, paket/negatif ledger, tekrar/yarış, canlı rol/merkez geri alma, finans redaksiyonu, stale onay, UTC etkinleşme, geç audit/outbox rollback.

Mevcut DST/fold/gap testi `tests/program-session-lifecycle.test.mjs` regresyonudur; yeni başlangıç anı kabulü değildir. DS-PLAN-01’in gerçek Starter kabulü bu dosyaya bağlıdır; F14/F15/F03 veya geniş DS-PROT/DS-ACCESS vakaları topluca kapatılmaz. Son SHA’nın CI/inceleme bağlantıları PR üzerindedir.

198 sözleşmeli işlem, 89 çağrılabilir, 109 contract-only; 90 core domain tablosu, 27 migration, iki yeni private teknik tablo. F01–F33 özellikleri partial/pending kalır.

[Önceki geliştirme kaynak raporu](../reports/starter-attendance-protection-verification.json): 93 yapısal test ve 60 gerçek API testi (41 mevcut regresyon + 19 yeni kabul). Bu rapor önceki kaynak snapshot’ıdır; yeni head’e taşınmaz. Tam temiz final CI ayrı kanıttır.

CI iki işte PR head SHA’sını açıkça checkout eder ve gerçek git HEAD eşitliğini denetler. I/A yanıtında blocked sonucu kalır, finans gerekçesi açılmaz. Eski taslağın teknik tüketim alanı boşsa sabit rezervasyon koşulundan belirlenir; genel kapanış engeli eklenmez. Eski blocked koşulu yoksa yalnız o etki açık yapılandırma hatasıdır.

[Son odaklı kaynak raporu](../reports/starter-attendance-protection-final-verification.json): redaksiyon/legacy düzeltmesiyle 19 gerçek API kabulü; 26+27 ile yeniden kurulan fonksiyonlar test edilen tanımlarla byte-identical. 26 değiştirilmedi; 27 append-only düzeltmedir. Yeni son head’in CI/inceleme kanıtı PR’de ayrıca bağlanır.
