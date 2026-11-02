# web1 ajan talimatı

Bu alan bağımsız alternatif frontend tasarımı içindir. Bütün çalışma ve dosya çıktıları yalnız `apps/web1/` içinde kalır.

## Kesin yazma sınırı

- `apps/web1/` dışında hiçbir dosya oluşturma, değiştirme, silme veya taşıma. Kök manifestler, lockfile, CI, ortak belgeler, `apps/web`, `apps/backend` ve `packages` salt okunurdur.
- Bu yasak kaynak kodu, bağımlılık, config, belge, geçici dosya, cache, log, test raporu ve build çıktısını kapsar. Bunları bu klasör altında üret; Git'e eklenmemesi gereken çıktıları kendi `.gitignore` dosyanda tanımla.
- `..`, mutlak yol, symlink, script, kurulum hook'u veya araç ayarı kullanarak sınırı dolanma. Çalıştıracağın komutların ve bağımlılık scriptlerinin çıktı yollarını kontrol et. Yazma davranışı belirsizse çalıştırma.
- Klasör dışı değişiklik gerektiğinde dur ve ihtiyacı kullanıcıya bildir; kendin uygulama. Klasör dışına yazmaya çalışan bir komut başarısız olursa sınırı genişleterek tekrar deneme.

## npm ve bağımlılıklar

- Komutları yalnız `apps/web1/` çalışma dizininde çalıştır. Paket yöneticisi **npm**; bu alanda pnpm, Yarn veya Turbo kullanma.
- Bağımlılıkları buradaki `package.json` ile yönet. Kilit dosyası `apps/web1/package-lock.json`, kurulum dizini `apps/web1/node_modules` olmalıdır.
- `package-lock.json` varsa tekrarlanabilir kurulum için `npm ci`; bağımlılık eklemek/güncellemek için yerel `npm install` kullan. Global kurulum (`-g`) veya kök dizinde kurulum yapma.
- npm cache ve loglarını da burada tut. Komutlardan önce `npm_config_cache="$PWD/.npm-cache"` ayarla; geçici dosya kullanan araçlar için klasör içi bir geçici dizin oluşturup `TMPDIR` değerini ona yönlendir.
- `workspace:` bağımlılığı, klasör dışına `file:`/`link:` bağımlılığı veya üretim uygulamasının bu alana bağımlılığını ekleme. Ortak pnpm workspace/Turbo grafiğine katılma.
- Build, test ve geliştirme scriptleri yalnız bu klasör altına çıktı yazmalıdır. Kullanacağın tasarım aracını bu şartı sağlayacak şekilde yapılandır.

## Kapsam

Tasarım, yerel README, geliştirme notları ve ajan devri burada tutulur. Ürün/API sözleşmesi uydurma; gerektiğinde ortak sözleşmeleri salt okunur incele. Ortak CI muafiyetinin kapsamı [CI politikasında](../../docs/ci-policy.md#deneysel-tasarım-alanı) tanımlıdır. Muafiyet bu klasör dışındaki dosyalara yetki vermez. Ürün frontend'ine aktarım ayrı yetki ve normal kabul süreci gerektirir.

Bu dosya ajan davranış talimatıdır; işletim sistemi seviyesinde yazma izolasyonu sağlamaz.
