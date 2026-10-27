# Tek stüdyo kurulum ve sürümlü ürün adı kabul adayı — 27 Ekim 2026

## Kaynak ve kapsam

Başlangıç main5892b3cb729d62a045358ffdc588a66361331537; aynı kaynak main clean40430528120 ve development CD40432912898 başarılı. Yeni kaynak213 API/67 migration/90 core tablo; yeni endpoint veya kurulum modülü yok. Önceki66 migration ve tarihsel raporlar korunur.

F16 plan izi başlangıç main’de zaten Starter/Pro/Business’tır. Bu teslim kredili, kotalı süreli ve sınırsız üyeliklerin gerçek Starter satış/tahsilat/self rezervasyon/yoklama tüketimini bir kullanım zincirinde kanıtlar. Tek odada40 kişilik tekrarlı program ve ayrı saatte5 kişilik özel seans kabulü; eşzamanlı seans reddi;50 fiziksel tavanı aşan51 kişilik seans reddi. Mevcut kategori/kontrollü aşım motoru değiştirilmez; genel regresyonlar son full clean’de korunur.

Somut düzeltme: yayın isteğinin adı eskiden ortak ürün kaydından okunuyor ve mevcut ürünün yeni sürümündeki yeni ad ayrı korunmuyordu. product_versions.published_name sürüm snapshot’ı getirildi; catalog_terms seçili sürümden okur. Yeni Starter yayını güncel disiplin ön ekini ister ve mevcut ürün kimliğinde yeni sürüm yayımlanabilir. Eski satışın bedel/tarih/product_version_id/kapsam/hakları değiştirilmez; eski haklar disiplin adı değiştikten sonra da uygun seçili kapsamda tüketilir. Geç audit hatası sürüm ve güncel etiket değişimini birlikte geri alır; aynı anahtarla retry tek sonuç verir.

Backfill yalnız gerçekten saklanmış ürün adını kullanır; daha eski bilinmeyen adlar türetilmez. PGlite67 migration derlemesi ve66 üzerinde mevcut ürün sürümünden67 upgrade deneyi geçti: kayıtlı ad, kredi4 ve fiyat1000 korundu. Bu sentetik SQL kanıtı gerçek Auth kabulünün yerine geçmez.

## Kaynak hash’leri

- database/starter-studio-product-names.sql ve20261027013809_starter_studio_product_names.sql SHA256:8692bf7f654faf9574f695af4ffe5c1384e48c29a538d2deaddaeca98528bc2d.
- tests/starter-studio-acceptance.mjs SHA256:d7df4054a9d8040e68e220f19b8ef38535ca366452b15419ae1b034f8cf9596d.
- tests/starter-plan-gates-acceptance.mjs SHA256:0b6ecae6fa4e0ac56db42b727dcfcbe9fcfb85b5e8c9aa0a14a9e39b9e02413c.

## Gerçek native ve yapısal kanıt

İzole nonpersistent Sandbox sbx_aY8hOkfo9KJtnfv3ovraragZScQl,67 migration temiz reset, gerçek native Auth→Edge→RPC. Yeni suite mevcut registry shard’ına import edilir; yeni CI altyapısı, assertion/süre sınırı gevşetmesi veya full kapsam daraltması yoktur.

- Ön SQL96c6259d58f54fc5dd4aba94b40c49d8eacad6b625509330685a1b0fa2e38194 kaynağında yeni tek-stüdyo suite7/7pass,0fail/skip/cancel;96327.731376ms. Son çocuk üç paket türü için taslak/reserve→consume ve idempotent kapanışı, sıfır agreement/earning’i doğruladı.
- Ön SQL kaynağında ayrı seri Starter kapı regresyonu9/9pass,0fail/skip/cancel;110301.827941ms.
- npm run verify103 sözleşme/yönetişim +46 CI politikası=149/149pass; TypeScript, schema/validator/generator/migration/hash kontrolleri geçti.56 belge/418 yerel bağlantı; git diff --check temiz.
- Business katalog/hak okuma ilk seri tekrarında mevcut ürün kimliği adı assertionı P01 latest/P01 credits farkını yakaladı. Beklenti korunarak yalnız Starter yayınında yeni adın kullanılması sağlandı; diğer planlarda mevcut ürün kimliği adı sürüm snapshotına alınır. Son SQL hash’i yukarıdadır; önceki native başarılar bu yeni kaynağın kabulü değildir. Son kaynak temiz reset+seri native sonuçları aşağıya bağlanır.

İlk yeni koşuda kota dolumunda test ENTITLEMENT_UNAVAILABLE bekliyordu; negatif limit0 mevcut motor CREDIT_LIMIT_EXCEEDED döndürdü. Assertion mevcut kabul edilmiş hataya düzeltildi; sınırsız testin buna bağlı hazırlık hatası da ortadan kalktı. Ürün hata kapısı değiştirilmedi. Sonraki birleşik16node14pass2fail koşusunda yeni suite7/7 geçti fakat eski downgrade child boşHTTP503 verdi; aynı anda katalog suite’i de boşHTTP503 ile durdu. Bu iki başarısız koşu temiz kabul sayılmaz; altyapı kök nedeni iddia edilmedi.9/9 seri Starter tekrarı yukarıdadır.

Native test config/fiyatları sentetiktir; ürün varsayılanı/fiyat kararı değildir. Gerçek hesap/kurum verisi ve hosted migration/Edge değiştirilmedi.

## Kalan kabul sınırı

Son kaynak bağımsız incelemesi, aday full clean, merge, aynı main clean ve development CD henüz yoktur; bu kaynak taslak adayıdır. Full clean bağımsız inceleme öncesinde başlatılmaz. Bütün Starter yol haritası, public hostname/Turnstile, fiziksel imha/yük/backup-restore ve production bu teslimle kapanmaz. Önceki PR56/57 kabulü yeni67 kaynağa taşınmaz.

## Son SQL kaynağının temiz native kabulü

67 migration temiz resetten sonra son SQL8692bf7f654faf9574f695af4ffe5c1384e48c29a538d2deaddaeca98528bc2d ile Starter kapı9/9 ve tek-stüdyo7/7 aynı seri koşuda16/16pass,0fail/skip/cancel geçti;207310.613672ms. Çocuk suite süreleri109125.373715ms ve97880.452291ms. Ön kaynak sayıları bu son kaynağa taşınmadı; final doğrudan tekrarlandı. Son native log SHA256:e4c6f70dff24320cdfd31e670d321e0a24530aeef7ee91e2719df71608fc2e24

Son SQL kaynağında Business katalog/hak okuma regresyonu10/10pass,0fail/skip/cancel;134353.469565ms (suite134249.437349ms). Önceki P01 ad assertion’ı değiştirilmedi ve geçti. Ham log SHA256:ce670a7bd58959bfb68308593eb243fc9e70402b4d785fd9f2e4a5f7e4800447. Toplam26 native test node iki seri süreçte16+10 geçti; tek birleşik26 process iddiası yoktur.

Son native command cmd_3be8bf598a824abb805b2fc09eaf normal exit0;357464ms (temiz reset+iki seri test süreci). Son SQL/test hashleri sandbox üzerinde birebir geri okundu. db:advisors exit0; tek WARN private.ops_run search_path mevcut belgeli istisnasıdır; yeni ERROR yoktur. Ham native/katalog logları hash doğrulamasıyla yerelde korundu ve sandbox kanıt alındıktan sonra açıkça durduruldu.
