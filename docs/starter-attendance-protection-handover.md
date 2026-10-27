## 27 Ekim — Starter plan kapıları teslimi kapandı

[PR #56](https://github.com/SXQHex/FtkSaaS/pull/56) main `ed747324f7d008b24103d4fd2eba503791c70a93` üzerinde kabul edildi: **213 callable API / 0 contract_only / 66 migration / 90 core tablo**. [Aday full clean40419827224](https://github.com/SXQHex/FtkSaaS/actions/runs/40419827224), [aynı main full clean40422823564](https://github.com/SXQHex/FtkSaaS/actions/runs/40422823564) ve [development CD40425584520](https://github.com/SXQHex/FtkSaaS/actions/runs/40425584520) başarılı. CD gerçek deploy ve20/20 hosted kontrol içerir; backend-v1 Edge21 ACTIVE, `verify_jwt=true`. JWT doğrulaması son kullanıcı kararıyla açık kalır.

Starter limitleri **1 merkez / 1 aktif oda / 1 disiplin / 1 aktif eğitmen / 100 aktif öğrenci**; tek mantıksal oda, seçili merkez-disiplin paketi ve disiplin adı ön eki uygulanır. Genel CRM/etkinlik/personel/hakediş kapalı; yoklama anlaşmasız ve hakedişsiz çalışır. Canlı plan/kapsam kapıları eski receipt/preview/grant ve doğrudan RPC ile aşılamaz. Pro→Starter kapsam seçimi sürümlüdür; seçilmeyen operasyon kapanır, geçmiş seans/kesin rezervasyon/hak/finans kayıtları korunur. [DTO, kapsam ve kabul kanıtları](starter-plan-gates-handover.md).

Bu kapanış yalnız plan kapıları ve sürümlü kapsam düşürme teslimidir; bütün Starter dağıtım yol haritası, gerçek public hostname/Turnstile, Pro/Business ayrı limit/özel teklif veya production hazırlığı tamamlandı sayılmaz. Aşağıdaki önceki kaynaklara ait tarihli aday/bekleme/envanter notları tarihsel checkpointlerdir; güncel kabul veya açık iş olarak kullanılmaz. Tarihsel `reports/` dosyaları ve eski kaynak snapshotları korunur. Bu belge eşitlemesi yeni runtime testi veya deploy değildir.

# Starter yoklama ve kesin rezervasyon koruması devri

25 Ekim güncel ürün hedefi: [tek oda/seans/kategori kapasitesi ve ayrı kontrollü aşım](../contracts/02-FtkSaaS-teknik-sozlesme.md#oda-seans-kapasite-karari). Yayımlanmış main200/59 DTO'ları ile PR45 adayı201/60 ayrıdır. PR45 bağımsız inceleme ve aday40164825351 başarılı; merge/main/CD bekler. Bu modülün eski test/alan adları kendi tarihsel runtime kaydını anlatır, yeni ürün kuralı değildir.

Güncel durum ve kaynak/CI: [doğrulanmış devir](../contracts/00-FtkSaaS-yeni-sohbet-devir.md). Aşağıdaki 198/89/109 ve 27 migration sayıları PR #14 teslim snapshot’ıdır; 23 Ekim yayımlanmış envanter 200 API / 0 contract_only / 59 migration’dır. P02 hak değişikliği/koruma ve P05 belge tüketicileri sonradan kabul edildi; eski açık tüketici ifadeleri ilk PR kapsamını anlatır, güncel açık liste değildir.

Başlangıç: main `5265a70a0d29f91b9081a1ecbc2a8f0ff78668ee`; aynı SHA’nın başarılı [CI çalışması](https://github.com/SXQHex/FtkSaaS/actions/runs/39030586306). Başlangıcın 322 testi yeni head’in kabulü değildir. Son PR head/inceleme/temiz CI kanıtı PR üzerinde aynı tam SHA’ya bağlanır.

## Sözleşme ve zorunlu bağımlılıklar

Kabul edilmiş DS kararları değişmedi. F14 Starter’da hak tüketir; F20 anlaşma/hakediş değildir. Önceki runtime’da ders yoklaması yoktu; etkinlik kapanışı ders yerine kullanılamazdı. Mevcut allocation motoru kullanıldı; yeni satış/negatif rezervasyonun açık blocked-policy snapshot’ı, negatif yükümlülük hareket zinciri ve fiilen yakalanan kapanış hak/plan snapshot’ları eklendi. Eski migration’lar değiştirilmedi.

Gerçek Starter akışı için referans feature listesinin topluca kapı olması giderildi: eğitmen rolü F04, personel ataması ayrıca F05; ders F08 ve özel ders F09; sınıf F10 ve dışa açık seçilirse F11; rezervasyon F15, öncelikli sınıf F10 ve öğrencinin esnek grup kaydı F11; kredi ürünü F15, süreli F16, dondurma F17 ve başka merkez kapsamı F18; satış F15/F19 ve süreli ürün F16. Oturum görev değişikliği F13; açık ücret anlaşması referansı F20 kalır. Starter eğitmen görevi ücret anlaşması seçmez/üretmez. Bu dar kapı düzeltmeleri yeni ürün davranışı değildir.

PR #14 kapsamındaki Pro/Business kapalı yol sınırı PR #15 ile aşılmıştır: [güncel anlaşma/hakediş devri](instructor-earnings-handover.md) ücretli kapanışı ve bağlı düzeltmeyi tanımlar. Kaydedilmiş Starter kapanışının gerekçeli düzeltmesi kendi `starter_no_earning` snapshot’ını kullanır. Anlaşma sürümleme, ürün override ve hakediş PR #15 ile uygulanmıştır; hesaplaşma sonraki teslimde uygulanmıştır; [hesaplaşma devri](settlement-handover.md) güncel sınırı belirtir.

## Uçtan uca yol

Yetkili merkez yöneticisi Starter ders/programını anlaşmasız oluşturur; mevcut takvim/seans okuması sonucu gösterir. Gerçek rezervasyon hakkı/negatif yükümlülüğü ayırır. Politika veya kişisel limitte yeni olumsuz etki önce `reservation_impact_preview_v1` ile gösterilir; tam etkilenen liste açıkça onaylanır. `reservation_impact_apply_v1`, korumalı `policy_publish_v1` veya `negative_limit_set_v1` alternatif tek commit yollarıdır; art arda iki değişiklik olarak çağrılmaz.

`negative_limits_get_v1` merkez/kişi/disiplin limitlerini ve gerçek `people.version` aggregate’ını döndürür. `attendance_get_v1` rezervasyon/seans sürümlerini sağlar. I/A projeksiyonu finansal eligibility snapshot’ını açmaz. Aktif görev tek başına yetki değildir: canlı login rolü gerekir; legacy sınıf görevi aynı kontrolle çözülür. Owner’a merkez operasyon rolü türetilmez.

`attendance_mark_v1`/`attendance_block_v1` yalnız taslak ve gerçek değerlendirme kanıtını yazar; tüketim yoktur. Kapanış bütün iptal edilmemiş sonuçları ve seans sürümünü doğrular; allocation/negatif yükümlülük, rezervasyon, kapanış snapshot’ı, audit/in-app outbox/receipt aynı transaction’da kesinleşir. Starter hakediş üretmez. Gerekçeli correction preview/apply önceki kapanışa bağlı revision/hak hareketi ekler; geçmişi silmez, seansı açmaz.

Koruma yalnız değişikliğin neden olduğu olumsuz etkiye bağlıdır. Önceden bağımsız uygunsuz kayıt etkisiz politika yayımıyla muaf olmaz. Sabit yükümlülük/negatif toplam tavanı ve borç kimlikleri tutulur; sonraki bağımsız engel affedilmez. Yayınlanmış ama gelecekte etkinleşen politika altında arada yetkilendirilmiş kaydın gerçek booking kanıtı korunur. Kaynak/uygunluk engelleri kaldırılmaz; yeni kayıt güncel koşullara tabidir. Koruma iptal, borç silme veya yeni hak üretmez.

## İlk teslimden sonra tamamlanan tüketiciler ve kalan sınırlar

- İlk PR’de politika/kişisel limit dışındaki impact türleri kapalıydı. `credit_adjust`, `sale_scope`, `entitlement_extend` P02 ile uygulanıp kabul edildi; güncel çağrılar yayımlanmış DTO ve etki onayına tabidir.
- Kredi düzeltme, kapsam değişikliği, uzatma, dondurma/erken bitirme ve sonlandırma P02 ile kabul edildi. Satışla geçmiş açık kapama ve bağlı hesaplaşma sonraki tüketicilerde uygulanmıştır; allocation kanıtı olmayan settled deficit correction başarı göstermez.
- Başlangıç anını otomatik gözlemleyen ders katılım tüketicisi henüz yok. Taslağın `evaluated_for` değeri gerçek değerlendirme zamanıdır; başlangıç snapshot’ı değildir. Geç kapanışta bugünkü bakiyeden geçmiş başlangıç türetilmez; kanıt eksik diye kabul edilmemiş toplu kapanış engeli konmaz. Başlangıç öncesi taslak ile başlangıç arasındaki bağımsız uygunluk değişiminin tam kabulü pending.
- Pro/Business finansal kapanış/düzeltme, anlaşma zinciri ve hakediş PR #15 ile uygulanmıştır. Merkezler arası hesaplaşma uygulanmıştır; eğitmen ödeme komutları P03 ile uygulanıp kabul edilmiştir.
- Eski satış/rezervasyona blocked-policy snapshot’ı geri doldurulmaz. Eksik tarihsel koşulda ilgili blocked sonucu POLICY_NOT_CONFIGURED; diğer katıldı/no_show yolu koşulları varsa çalışır.
- P01 dar rezervasyon belge kapısı, P05 genel belge API’leri/yoklama tüketicileri sonradan kabul edildi. P01 fixture’ı tek başına P05 kabulü değildir; güncel kaynak kanıtı tek devirde ayrılır.
- Frontend, production, Resend ve main koruması değişmedi. Bu kapsam notu güncel merge yetkisi belirlemez; son açık kullanıcı talimatı esas alınır.

## Kanıt ayrımı

Yapısal kontroller davranış kabulü değildir. Mevcut 202 API/27 DB regresyonu ayrı tutulur. Yeni gerçek Auth → Edge → RPC testleri `tests/starter-attendance-protection.test.mjs`: anlaşmasız Starter program, plan sınırları, limit/politika etki/onayı, eski korunan/yeni reddedilen kayıt, taslak/kapanış/düzeltme, paket/negatif ledger, tekrar/yarış, canlı rol/merkez geri alma, finans redaksiyonu, stale onay, UTC etkinleşme, geç audit/outbox rollback.

Mevcut DST/fold/gap testi `tests/program-session-lifecycle.test.mjs` regresyonudur; yeni başlangıç anı kabulü değildir. DS-PLAN-01’in gerçek Starter kabulü bu dosyaya bağlıdır; F14/F15/F03 veya geniş DS-PROT/DS-ACCESS vakaları topluca kapatılmaz. Son SHA’nın CI/inceleme bağlantıları PR üzerindedir.

198 sözleşmeli işlem, 89 çağrılabilir, 109 contract-only; 90 core domain tablosu, 27 migration, iki yeni private teknik tablo. F01–F33 özellikleri partial/pending kalır.

[Önceki geliştirme kaynak raporu](../reports/starter-attendance-protection-verification.json): 93 yapısal test ve 60 gerçek API testi (41 mevcut regresyon + 19 yeni kabul). Bu rapor önceki kaynak snapshot’ıdır; yeni head’e taşınmaz. Tam temiz final CI ayrı kanıttır.

PR #14 tesliminin tarihsel CI’ı iki işte head SHA’sını checkout ederdi. Güncel hedefli/açık aday/main ayrımı ve CI-02 uygulama farkı [CI politikasında](ci-policy.md) izlenir. I/A yanıtında blocked sonucu kalır, finans gerekçesi açılmaz. Eski taslağın teknik tüketim alanı boşsa sabit rezervasyon koşulundan belirlenir; genel kapanış engeli eklenmez. Eski blocked koşulu yoksa yalnız o etki açık yapılandırma hatasıdır.

[Son odaklı kaynak raporu](../reports/starter-attendance-protection-final-verification.json): redaksiyon/legacy düzeltmesiyle 19 gerçek API kabulü; 26+27 ile yeniden kurulan fonksiyonlar test edilen tanımlarla byte-identical. 26 değiştirilmedi; 27 append-only düzeltmedir. Yeni son head’in CI/inceleme kanıtı PR’de ayrıca bağlanır.

