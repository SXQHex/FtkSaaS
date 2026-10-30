# Fiziksel bütünlük ve transaction tasarımı

## Ürün adı snapshot’ı

`product_versions.published_name` yeni sürümde sabittir; kataloğun `ProductTerms.name` alanı seçilen sürümün adıdır. UPDATE trigger’ı ad değişimini reddeder. Backfill yalnız gerçekten kayıtlı ürün adını kullanır; eski satış/finans/scope/hak defterleri değiştirilmez. Aynı ürün kimliğinde yeni yayın yeni snapshot yaratır. Restore/export core satırının yeni alanını taşır; ayrı private veri deposu veya imha consumer’ı eklenmez. Önceki migrationlar değiştirilmez.

## Eşzamanlılık ve indeks planı

Kapasite davranışının tek normatif kaynağı [teknik sözleşmedir](contracts/02-FtkSaaS-teknik-sozlesme.md#oda-seans-kapasite-karari). Bu belge veri yapısı/transaction tasarımının referansıdır; çalıştırılmış kabul iddiası değildir.

Kilitler tenant/aktör yetki kapısı → etkilenen person/org-limit satırları UUID sırasıyla → kaynak takvim satırları UUID sırasıyla → seans/etkinlik UUID sırasıyla → hak hesapları ve finans cüzdanları UUID sırasıyla → alt kayıtlar şeklinde tek toplam sırayla alınır. Çoklu işlem önce tam bağımlılık kümesini toplar; alt komut yukarı sıradaki bir kilidi sonradan alamaz. Yetki kaldırma/kapama ile yazma yarışı aynı erişim kapısı üzerinde koordine edilir. Bu plan deadlock’u azaltır; sıfır deadlock garantisi değildir, sınırlı DB transaction tekrarı aynı idempotency ile yapılır.

| Sorgu/garanti | İndeks veya kilit |
|---|---|
| Tenant ve merkez filtreleri | O/C her FK için uygun tenant önekli B-tree; filtre/sıralama bileşik indeksle eşleşir. |
| Tek aktif rezervasyon | Partial unique(org,session,person) state=active; kapasite session row lock; gerçek place count kesin rezervasyon+geçerli offer. |
| Oda/eğitmen takvimi | Resource satırı/advisory transaction lock + `(org,resource_kind,resource_id,starts_at)` aralık indeksi; exclusion constraint uygunluğu migration tasarımında doğrulanır. |
| Öğrenci limiti | Organizasyon sayım kilidi; aktif öğrenci org/person distinct, yeni center ilişkisi aynı kişiyi ikinci kez saymaz. |
| Kredi/açık limiti | İlgili org/person/center/discipline açık kilidi; ayrıca kaynak sale entitlement-account kilidi bütün disiplinlerde ortaktır. Ayrılmış+tüketilmiş açık aynı kapsamda, rezervasyon bir kez sayılır. |
| Bekleme sırası | `(org,session,state,joined_at,id)`; offer expiry worker yalnız aktif ve vadesi dolanları claim eder. |
| Para mahsup/iade | `(org,center,person,currency)` hesap kilidi; her borç/credit/ödeme kaynağı bakiye sınırı tekrar kontrol edilir. |
| Tekrar koruması | Receipt unique; başarılı iş+receipt+audit+outbox aynı transaction. SQL rollback sonrası receipt başarısız sanılıp iş tekrar doğmaz. |
| Ders/rapor sayfalama | `(org,center,starts_at,id)` ve permission-filtered keyset cursor. Sayfalama sabit snapshot garantisi değildir. |
| İş kuyruğu | `(state,next_attempt_at,id)` partial; lease+SKIP LOCKED/claim, yeniden başlama aynı business dedupe. |

Yetki okumalarında kullanıcı metadata’sına güvenilmez. RLS, grant ve fonksiyon sahipliği ayrı denetlenir. İstemcinin core tablolarına DML yetkisi yoktur; api fonksiyonu SECURITY INVOKER, yazmayı sadece gerekli komut için yetkilendirilmiş private rutin yürütür. SECURITY DEFINER gerekirse private şema, sınırlı sahibi, sabit search_path, açık EXECUTE ve zorunlu güncel tenant/aktör kontrolleriyle kullanılır; bypass eden genel DML kapısı açılmaz. Okuma projeksiyonunda security_invoker ve alt tablolara dar alan grant gereksinimi migration tasarımında doğrulanır; güvenli kanıtlanamayan okuma private yetki kontrollü RPC olur.


## Hak, yoklama ve zaman sınırları

Seans başlangıcındaki izinli negatif limit, ayrılmış+tüketilmiş açık ve bu rezervasyonun zaten dahil olup olmadığı sürümlü EligibilitySnapshot ile korunur. Sonradan tahsilat/yeni paket geçmiş uygunluğu ve blocked kişiden hakediş oluşturmaz. Snapshot zamanında kayıt yoksa başlangıçtaki immutable hareket/politika/rol geçmişinden aynı sonuç çıkarılmalıdır; geç çalışan job güncel ödeme bakiyesini geçmişe uygulayamaz. Snapshot yokluğu auto no_show değildir. Kaynak satışı olmayan yüzdelik hakediş rezervasyonun merkez değerleme snapshot’ını kullanır.

Satış start_date/end_date ve timezone açık değerlerdir:00:00 normalize, başlangıç dahil bitiş hariç. Satış son tarihini otomatik ay aritmetiği belirlemez. Quota pencereleri satış başlangıcından haftalık7 yerel gün veya aylık aynı gün sınırlarıdır; ayda gün yoksa yalnız quota sınırı o ayın son gününe sıkışır, sonraki sınır yeniden ilk başlangıç gününden hesaplanır. Bu, kullanıcının girdiği satış bitişini değiştirmez. Son kısa kota dönemi tam limittir, devir yoktur.

Yerel saat geçersizse sessiz kaydırma yapılmaz; ambiguous yerel seans saati offset doğrulamasıyla açık ana çevrilir. Tarih00:00 o saat diliminde geçersiz/çiftse doğrulama hatası, yönetici geçerli tarih/saat dilimini netleştirmeden satış yok. Saat dilimi değişikliği mevcut satışın snapshotını ve geçmiş UTC anlarını yeniden yazmaz. Dondurma/iade ücretli yerel gün farkıyla hesaplanır; ücretsiz uzatma para iadesini büyütmez. Erken dondurma bitişinde seçilen00:00 geçmişteyse geriye işlem sayılır ve ret, ileri geçerli tarih gerekir.

## Üretimden önce

RLS, grants, private privileged rutin sahibi/search_path, indeks ve exclusion/lock uygulaması migration/test görevindedir. Bu belge SQL veya uygulanmış güvenlik kanıtı değildir. O3 pilot restore/load hedefleri ve hukuki saklama incelemesi ayrıca doğrulanacaktır.
