# Frontend sohbet devri

Aktif bölüm, geliştirme sırası, kaynak/CI/yayın ayrımı ve açık kabullerin tek sahibi [todo teslim kaydıdır](todo.md#7-bölüm-bölüm-teslim-tek-aktif-bölüm).

## Devam bağlamı

8 Kasım kullanıcı yönlendirmesiyle ayrı `test/web-batch-live-acceptance` test paketi hazırlandı: seri kodlama sonrasında main'den elle başlatılan toplu hosted kabul. Normal PR CI korunur, deploy başına hosted koşu yoktur. Test kapsamı ve kalan kabulün tek sahibi [todo bölüm 9](todo.md#pro-ilk-teslim-kapisi), çalıştırma/secret/fixture yöntemi [geliştirme rehberidir](development.md#toplu-canlı-tarayıcı-kabulünü-çalıştırma). Test kaynağı canlı başarı değildir; diğer geliştirme dalı aşağıdadır.

Kullanıcı Pro ilk teslimini hedefliyor; canlı kabulleri açık tutarak XREQ-027 → R14 → kalan S12 ve belge/teslim uzlaştırmasını istedi. Güncel dal `feature/web-r14-settings-completion`; kaynak sınırı, devralınan PR257/PR258 ve gerçek backend bağımlılıkları todo’nun ilgili modül sahiplerindedir. İkinci yol haritası tutulmaz. XREQ-006’nın frontend todo’da yalnız Business olarak sınırlandırılması düzeltildi; ortak talebin ertelenmiş Pro/Business kapsamı korunur.

Uygulama native Supabase Auth ve typed ortak transport üzerinden çalışır; özel tablo/service key yoktur. Hazır shadcn/ui, mevcut komut/preview/kurtarma ve alan bileşenleri kullanılır. Ayar formu ortak şemanın sunucuda çözülen görünümünü tüketir; ham JSON veya elle UUID formu değildir. Tasarım yöntemi [geliştirme rehberindedir](development.md).

Gerçek kabuller ve source/otomatik kanıt birbirine aktarılmaz. Yerel testlerde MSW için `NODE_USE_ENV_PROXY=0` gerekir. Pinli156 resmî headless-shell ile mevcut yerel Playwright konfigürasyonu `.artifacts/frontend/playwright-local.config.ts` altında tutulur; CI dört tarayıcı matrisi değişmedi. Backend/shared/CI politikası salt okunurdur. Native full clean başlayınca kök AGENTS doğrultusunda run/head/base/tested merge bilgisiyle devir yapılır; polling yapılmaz.
