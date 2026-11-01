# Ortak kalite sınırları

1 Kasım 2026 kararı: mevcut tabanı koru; güvenlik ve mimari ihlallerini engelle; yeni yerel kalite kontrolünü en fazla 90 saniyede tamamla. Bu dosya iki alanın ortak kalite sözleşmesidir. Alanların geliştirme durumu burada tutulmaz. Ürün/API davranışı [kaynak indeksindeki](docs/source-index.md) sahiplerde, CI kabul protokolü [CI politikasında](docs/ci-policy.md) kalır.

## Değiştirilemeyen taban

- Denetim susturma: yeni tip/lint/coverage/güvenlik susturması eklenmez. Eski borcu yeniden tarayıp keyfî bir hedef dayatmak yerine yeni fark denetlenir.
- Test bütünlüğü: yeni atlama, odaklama, test silme veya assertion azaltma sessizce kabul edilmez. Aynı assertion’ın aynı dosyada birebir taşınması serbesttir; diğer değişiklikler inceleme bulgusudur, otomatik olarak yanlış kod sayılmaz.
- Tamamlanmış iş: uygulanmamış hata stub’ı veya tek satırlı boş catch eklenmez. Diff koruması regex tabanlıdır; çok satırlı/semantik stub ve assertion doğruluğu bağımsız incelemenin sorumluluğudur.
- Gizlilik: kaynakta yeni secret bulgusu sıfırdır. Gitleaks çıktısı yüzde 100 maskelenir; bulgunun değeri rapora yazılmaz. Tarayıcılar gerçek sızıntıların tamamını kanıtlayamaz.
- Kural bütünlüğü: kalite sözleşmesi, checker, istisna, workflow, test/lint/TypeScript config’i ve görev komutları trusted politika yüzeyidir. Değişiklik kendi kendine merge yetkisi vermez; kaynak bağlı inceleme/kurulum süreci uygulanır. Kontrolü yeşile çevirmek için eşik düşürülmez.

## Çalışan kontroller

| Boyut | Sınır ve gerekçe | Komut / mekanizma | Yürütme |
|---|---|---|---|
| Diff tabanı | 0 açıklanmamış bulgu; çıtanın sessiz düşmesini engeller | `pnpm check:quality` → Turbo `quality` → floor guard + olumsuz senaryo testleri | Yerel teslim; her PR’de aynı dependency-free komut |
| Secret | Yeni commit aralığında 0 Gitleaks bulgusu; anahtar sızıntısını engeller | Gitleaks 8.30.1 `git . --redact=100 --ignore-gitleaks-allow --gitleaks-ignore-path /dev/null --config apps/backend/scripts/ci/gitleaks.toml --log-opts=BASE..HEAD` | Her PR; indirme SHA256 ile doğrulanır |
| Tip | 0 hata; mevcut kontrat ve tip denetimleri korunur | `pnpm typecheck`; alan CI’larının mevcut typecheck görevleri | İlgili alanın yerel/CI doğrulaması |
| Frontend lint | 0 hata ve 0 uyarı; mevcut taban | `pnpm exec turbo run lint --filter=@ftksaas/web --filter=@ftksaas/ui` | Frontend değişikliğinde |
| Import sınırı | Tanımlı sınırda 0 yasak import; iş kuralı kopyalamayı önler | Mevcut Oxlint `no-restricted-imports` | Frontend/UI lint |
| SSoT ve belge sahipliği | 0 kayıtsız/çift sahipli belge; alan ilerlemesi ortak dizine taşınmaz. Ürün plan kapsamı ve hedef limitleri makine iziyle eşleşir. | `pnpm --filter @ftksaas/backend docs:check`; `pnpm --filter @ftksaas/backend test:governance` | Belge/ilgili kaynak kabulü; ürün/makine karşılaştırması backend verify içinde |
| Fonksiyon ve kaynak kabulü | Gerekli işlerde 0 başarısız/eksik kanıt; mevcut CI protokolü | [CI politikası](docs/ci-policy.md) ve kaynak bağlı merge/main doğrulayıcıları | Kapsama göre aday; main’de kanıt doğrulama |
| Erişilebilirlik | Mevcut Axe taranan durumlarında 0 ihlal; bugünkü çıta korunur | `pnpm test:frontend:e2e` | Mevcut dört tarayıcı projesi; bütün ekranların kapsandığı iddia edilmez |

## Mimari ve alan sahipliği

Frontend/backend aynı monoreponun alanlarıdır. Backend sözleşmeyi geliştirir; frontend yayımlanan `@ftksaas/api-contracts` üzerinden adapte olur. Frontend contract compatibility tanı sinyalidir; backend’in bağımsız teslimini engelleyen yeni kapı yapılmaz. Paket/tip ve görev grafiği izolasyonu [monorepo rehberi](docs/monorepo.md) ve mevcut isolation kontrolüyle korunur.

Frontend kaynakları backend iç dosyalarını import edemez. Mevcut, bilinçli sunucu köprüsü yalnız `apps/web/src/app/api/auth/signup-check/route.ts` → `apps/backend/transports/account-signup-gateway.mjs` için korunur; bu izin istemci bileşenlerine yayılmaz. UI paketi uygulama iç dosyalarını import edemez. Oxlint statik ve literal import yollarını denetler; hesaplanan dinamik yollar ve transitif istemci/sunucu grafiği için tam analiz iddiası yoktur.

Ortak `docs` yalnız iki alanı ilgilendiren sözleşme/kuralları içerir. Alan README/AGENTS girişleri ve geliştirme planı/ilerleme/kabul/devir kayıtları kendi klasörlerinde kalır. Makine belge sicili bu ayrımı denetler; bir belgenin anlamsal olarak iki tarafı ilgilendirmesi ayrıca inceleme konusudur.

## Turborepo ve süre

Yerel `pnpm check:quality`, yalnız backend paketinin sahip olduğu ortak checker’ı çalıştırır; backend DB/API veya frontend testlerine bağımlılığı yoktur. Git farkına bağlı `quality` görevi `cache: false` kullanır ve `QUALITY_BASE` girdisini açık taşır. Varsayılan karşılaştırma `origin/main` merge-base’inden staged, unstaged ve yeni dosyalara kadardır; teslim öncesi main güncellenir. CI base/head/merge parent’larını ayrıca doğrular.

90 saniye yalnız yeni yerel kalite kontrolünün bütçesidir; mevcut full clean veya tarayıcı testlerine timeout düşürülmez. Dependency-free PR kalite işi en fazla 5 dakikadır; scanner indirimi/çalışması başarısızsa kabul başarısızdır. Saf belge değişimi dependency kurulumu, frontend build veya backend DB/API testi başlatmaz. Main aynı testleri tekrarlamaz, başarılı adayın kalite kanıtını doğrular.

## Henüz eşik uygulanmayan boyutlar

| Boyut | Doğrulanmış mevcut durum | Yaklaşım |
|---|---|---|
| Frontend coverage | V8/LCOV raporu mevcut; minimum eşik yok. Bu çalışmada sayısal ölçüm doğrulanamadı. | Yeni zorunlu yüzde yok; ilk güvenilir rapordan sonra ayrı kararla taban belirlenir. |
| Backend coverage | SQL/Edge uçtan uca testlerinden satır coverage yüzdesi çıkarılmıyor. | Test sayısı veya API envanteri coverage diye sunulmaz. |
| Performans | Zorunlu LCP/CLS/bundle eşiği yok. | Ölçmeden sayı veya hız kazancı iddia edilmez. |
| Bağımlılık açığı / SAST | Bu kurulum genel CVE/SAST kapısı eklemez; secret taraması bunların yerine geçmez. | Ayrı ölçüm ve araç kurulumu gerektirir. |

## İstisnalar ve gözden geçirme

Makine istisnaları yalnız [floor-exceptions.json](apps/backend/scripts/ci/floor-exceptions.json) içindedir; burada ikinci liste tutulmaz. Her kayıt tek kural, tam dosya yolu, bulgu parmak izi, gerekçe, sorumlu ve bitiş tarihi taşır. Ömür en fazla 90 gündür; süresi geçmiş/geçersiz kayıt kontrolü başarısız yapar. Yeni istisna trusted politika değişikliğidir ve bağımsız son kaynak incelemesine girer. İstisna test başarısı, merge veya production yetkisi değildir.

Regex guard bütün anlamsal test zayıflatmalarını bulamaz. Trusted politika kontrolü de bağımsız incelemenin yerini tutmaz. Yerel başarı, PR CI başarısı, politika kurulumu ve main kabulü ayrı kanıtlardır.
