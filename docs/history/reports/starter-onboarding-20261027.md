# Starter başlangıç ayarları ve self/public — backend aday kabulü

Taban: `6c7587b63681cc9f89d14483eaca71e520a074af`; uygulama Draft PR61. Envanter213 callable API/68 migration/90 core tablo. Önceki67 migration değişmedi. Son aday/main/CD kabulü bu rapor yazılırken henüz yoktur; mevcut hosted kabul213/67/Edge21/JWT açık kalır.

## Önceki belge eşitlemesi

PR60 head6a734cdabf1032522605e3a11fb9e6f113230895/tree4cbc71365d61553a46b7b20813462a6e97c86a38 yalnız incelenmiş belge yollarını değiştirdi. Documentation acceptance40489030502, main40489319042 ve development delivery40489417743 başarılıdır. Kaynak bağlı status açıkça “documentation acceptance (no full clean)” dedi; full-clean label eklenmedi, full clean çalıştırılmadı. Tarihsel raporlar/source-v2.2 korunmuştur.

## Gerçek değişiklik ve sınırı

- Yeni Starter organization_create_v1 aynı transaction’da FD07 negative_default=0, debt_booking=true ve debt_participation=true org politikalarını sürüm1 olarak oluşturur. UUIDv7 kimlikleri mevcut Edge üretim dizisinden gelir; kuruluş audit’i politika kimliklerini taşır. Aynı-key tekrar3 politikayı çoğaltmaz. Mevcut org/politika/kişi/para/hak geçmişine backfill yoktur.
- policies_get_v1 merkezden gerçek org politikasını okur; policy_at/lesson_limits ve rezervasyon/yoklama tüketicileri kullanır. Starter merkez override kapısı korunur. Seçilmemiş çalışma saati, rezervasyon/talep penceresi, iptal/no-show, fiyat/hak/süre/iade veya şablon değeri uydurulmaz. Genel JSON settings bu domain komutlarının yerine geçmez.
- Public hostname resolver’ı FTK_PUBLIC_APPLICATION_HOSTNAME, yoksa legacy FTK_TURNSTILE_HOSTNAME seçer. Handler erken config kapısı ile siteverify aynı resolver’ı kullanır; password_recovery legacy host seçimini korur.
- api/public-application.js yalnız server adapter’dır. Sabit Edge submit path, exact HTTPS host/origin, Vercel’in overwrite ettiği doğrulanmış bağlantı IP’si,64KiB request/response sınırları ve raw-body imzası vardır. Caller x-ftk/auth/cookie başlıkları taşınmaz. Kapalı accepted/SafeError envelope dışında upstream gövde yayımlanmaz; bozuk upstream503; bozuk istemci UTF8/JSON400; boyut413 ve yöntem405 mevcut VALIDATION_FAILED zarfındadır. Trace UUIDv7’dir. Error code allowlist’i kanonik08 sözleşmesinden okunur; server paketi bu dosyayı da içermelidir.
- Gateway/backend endpoint/config kodu hazırdır; mevcut studiosaas projesine dağıtılmadı. Son kullanıcı talimatı yalnız backend’dir: frontend tasarımı/işleyişi/dağıtımı ve DNS değiştirilmedi. Kullanıcının seçtiği uye.fethiyetango.com mevcut managed widget’ın domain listesine eklendi; önceki domain/mode korundu. Secret değerleri rapor/kaynağa çıkarılmadı.

## Son kaynak doğrulaması

Yerel npm verify105 sözleşme/yönetişim +46 CI politika =151/151;0fail/skip/cancel. TypeScript, üretim/hash/katalog/validator kontrolü ve PGlite68 migration derlemesi geçti.56 belge/415 yerel bağlantı ve git diff --check temizdir. generate/verify’nin tarihsel consistency raporundaki otomatik oynaması geri alındı; eski reports dosyaları değişmedi.

İzole native Supabase, temiz68 reset, sonra iki seri test süreci:

| Kapsam | Sonuç | Süre |
|---|---|---|
| Starter studio/public/self |9/9,0fail/skip/cancel |177074.53499ms |
| Mevcut Starter attendance/protection |19/19,0fail/skip/cancel |341424.126276ms |
| Bütün reset/test/advisors komutu | normal exit0 |530705ms |

Toplam28 node iki seri süreçtedir; tek28-node koşu diye sunulmaz. Command `cmd_c1081925d0df4c8fb049ef3a27bc`; sandbox `sbx_tXi3QwUccR6X6U79eRD5LpbrU7Rz`. Kaynak hashleri native ortamdan geri okunup yerelle eşlendi. Advisors exit0; yalnız önceden belgeli private.ops_run search_path WARN kaldı. Ortam kanıt alındıktan sonra durduruldu.

Studio zinciri:3 başlangıç politikası ve receipt tekrarının tekilliği; orgdan merkez okuması ve Starter yerel override reddi;40/5 kapasiteler ve50 fiziksel tavan; yayımlı public takvimin kapalı projeksiyonu; public intent’in otomatik kişi/satış/rezervasyon yapmaması; CM review sonrası genel CRM lead’i olmaması; ayrı öğrenci aktivasyonu; yerel SMTP daveti ve yanlış native hesabın kabulünün reddi; gerçek doğrulanmış hesapla kabul; yönetim rolü oluşmaması; ayrı satış/tahsilat; borç varken self rezervasyon reddi, tahsilat sonrası kendi rezervasyonu; yetkisiz politika okuması ve genel CRM reddi; yayını kapatınca eski public receipt’in hizmet kapısını aşamaması. Kredili/kotalı süreli/sınırsız hak tüketimi, ad/disiplin değişimi, eski satış/sürüm bütünlüğü, geç hata rollback/retry ve sıfır hakediş korunur.

Public submit’in pozitif DB aşaması yalnız yerel native DB’de Edge-owned doğrulanmış bağlam emülasyonuyla sınanır; gerçek widget/siteverify kabulü değildir. Ayrı21-node contract suite içindeki tam handler testi signed ingress→preflight→mock siteverify→submit yolunu public-only hostname ile çalıştırır. Gateway adversarial testleri sahte IP/imza/auth/cookie, origin/config/JSON/boyut ve bozuk/diagnostic upstream yanıtlarını kapsar. Gerçek istemcinin widget tokenı, dış SMTP ve frontend E2E kabulü bu sonuçlardan çıkarılmaz; entegrasyon devridir.

## İnceleme ve ilk kapsamlar

Bağımsız ilk kaynak incelemesi iki P2 buldu: handler’ın public hostname override’a rağmen legacy host istemesi; gateway’in upstream gövdesini sınırsız/doğrulamasız geçirmesi. İkisi düzeltildi ve gerçek handler/gateway regresyonları eklendi. Ek inceleme eski Starter protection fixture’ının borçlu satıştan tahsilatsız rezervasyon yaptığını gösterdi. Runtime borç kapısı gevşetilmedi: fixture önce true default’ları doğrular, sonra eski unpaid/negative senaryoları için açık org politikalarını API’den false seçer. Yeni studio suite default true’yu koruyup gerçek borç reddini doğrular. Eski assertion’lar değişmedi. Son kaynak incelemesinde bu bulgular kapandı; final commit/tree bağı PR incelemesinde tutulur.

Önceki1-policy kaynağında native studio8/8 ve Business policy19/19; public testinin eklendiği ara kaynakta9/9 geçti. Bunlar son3-policy kaynağı yerine taşınmadı; yukarıdaki temiz reset/28-node kabulü ayrıca çalıştı. Başarısız native koşu başarı diye gizlenmedi; inceleme bulguları full clean’den önce düzeltildi.

## Kaynak ve log SHA256

| Dosya | SHA256 |
|---|---|
| starter-onboarding-defaults SQL (source=migration68) |9c5f3b1e09029ba88ca5b99c4532c74408b4fdff4d1b00ee5211e6c9237fbfe9 |
| public-ingress.ts |8cfadca96a23fec668328f0f174df898b3129da3f7d02fabc21b985fd25b0cff |
| handler.ts |b46d76b6cf0350a3dc1194d41570087139531fd9d67a0ad894e19aa0edf6d457 |
| generated index.ts |11f1daefdc3b9ef03d51e42730b126e39b51b6d6a443bfc5d4462722b17f84f6 |
| public-application-gateway.mjs |824cbf04aedae36c080ba722b94199040311edabb2cdf4e0b14472fe2e856c9c |
| starter-studio-acceptance.mjs |32e3d59bec63c7730d0d3f8217f729b7ee268bccca3441607ec2b8ae2dce2926 |
| starter-attendance-protection.test.mjs |9d93be46565cb37ade91fce42301549edebc60a835a2ddca524ae029112dede6 |
| contract.test.mjs |280f65459b29f48d1ac0707ce34fa0cfe80964cc5a9eece9bfcf5039fb67f2c6 |
| Son native studio ham log,1265bytes |b5e1e8081ee2749b89779fa82f3de9d9d3756b7a62439f84ee421817a142ef90 |
| Son advisors ham log,807bytes |15fa809f9961a55e11a84811be4fac2578a36ff5d48a07b8463b4d3e0e47c3dc |

Protection logunun tam base64 aktarımı araç tarafından kırpıldı; tam yerel kopyası/hash’i varmış gibi sunulmaz.19/19/0fail ve süre, native log sonundan; tüm seri komutun normal exit0 sonucu ayrıca API’den doğrulandı. Son ortam snapshot’ı snap_s9Wp3vW3Ct5Wpn3Pz4gwZM5cANVk içinde kaynak/loglar bulunur; ortam yeniden açılmadı.

## Kapanış sınırı

Bu rapor backend aday kanıtıdır. Tek final aday full clean, aynı main clean ve development CD başarıları sonradan kaynak bağlı doğrulanacak. Bütün Starter yol haritası, gerçek frontend/provider entegrasyonu, hosted tam geri dönüş/yük/production kabulü kapanmış değildir. Sırf CI kimliği için tarihsel rapor yeniden yazılmaz; PR/main kanıtı sonraki doğal devirde tutulur.
