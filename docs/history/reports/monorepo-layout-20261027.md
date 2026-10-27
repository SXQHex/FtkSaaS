# PR62 — temiz workspace yerleşimi ve doğrulama

27 Ekim2026. Düzenleme başlangıcı PR62 head `94831a10e9f888e7c9e3e7ebf4137bc1e8082f56`; son kabul edilmiş backend main af06a64ba2e02823f60e74dcf637cc4dee0bd485. [Eski aday40521129985](https://github.com/SXQHex/FtkSaaS/actions/runs/40521129985) ve eski hedefli40520875622 kullanıcı tarafından iptal edildi; yeni kaynağın kabulü değildir. PR Draft’a çevrildi ve ci:full-clean kaldırıldı. Son talimat root’u sıfırdan temiz monorepo gibi düzenleyip önce PR testlerine geçmektir; yeni full clean başlatılmadı.

## Gerçek yerleşim

Backend api/config/database/examples/scripts/supabase/tests ve kendi package/tsconfig/.env.example dosyaları apps/backend sahibindedir. Root package yalnız pnpm/Turbo orchestration ve Turbo bağımlılığı içerir. Backend bağımlılıkları backend paketine; ortak TypeScript sürümü pnpm catalog’a; TS temeli packages/typescript-config paketine aittir. Normatif JSON packages/api-contracts/schema/contract.json, generated types/client aynı pakettedir. İnsan sözleşmeleri docs/contracts; tarihsel rapor/ilk07-09-11 aktarım/source-v2.2 snapshotları docs/history altındadır. Frontend apps/web/packages/ui aktarımı henüz yapılmadı.

Root .DS_Store ve çift .node-version kaldırıldı. Devcontainer Node24.22.1 resmi image index digest sha256:6449e19d8184d84062525b6a7524def03146c2cb04a7f08b076680d0e8e4240a ile sabittir; digest Docker Registry library/node manifests/24.22.1-bookworm üzerinden doğrulandı. Corepack enable ve frozen pnpm postCreate kullanılır. Docker image/container build bu oturumda çalıştırılmadı; konfigürasyon ve digest doğrulandı. Aynı Node patch .nvmrc/engines/CI/container eşliği testtedir.

Build/test/CI tarafından çağrılmayan ilk aktarım/legacy schema/ZIP araçları generate_schema.py, generate_schema.historical.py, transfer_contract.py ve package-contracts.py kaldırıldı; kaynakları Git geçmişinde ve ilk kurulum immutable migration zincirinde korunur. Bunlar güncel kaynak üretim yolu değildir. Yeni audit/health çıktıları tarihsel raporları ezmez; .artifacts/backend içine, CI selection/receipt/timing çıktıları .artifacts/ci içine yazılır. apps/backend/.dev private ve ignore kapsamındadır. Supabase CLI’nin eklediği .link/lock ignore kalıpları yalnız yerel state hijyenidir.

## Korunan içerik

Arşiv manifestindeki64 kaydın mevcut byte’ları hem SHA256 ile hem özgün94831a source_path içeriğiyle eşleşir. Bunlar mevcut reports60 + eski JSON snapshot1 + ilk aktarım raporları3’tür.64 kayıt dışındaki yeni rapor kendiliğinden tarihsel link istisnası alamaz. Manifest yalnız docs/history yolları ve exact hash’leri kapsar; CI trust surface içindedir. Living file/fragment, tamper ve unknown-report retleri korunur.

Database/Supabase/makine şemasındaki207 kaynak dosyası byte eşidir; bütün68 migration, SQL kaynak/manifest, embedded Edge ve handler içerikleri değişmedi. Supabase .gitignore yalnız CLI local-state kalıplarıyla güncellendi. Edge source hash’i ve API/plan/yetki/finans davranışı değiştirilmedi; yeni hosted deploy yapılmadı. Yeni uygulama başarısı eski CI/CD sonucundan türetilmez.

## CI ve inceleme sırasında bulunan hata

GitHub Actions kabul ve CD sahibi kalır. Kurulum kökte; backend run adımları apps/backend CWD’sindedir. GitHub script import’ları yeni konuma, upload/receipt yolları ortak root .artifacts/ci konumuna bağlandı. Dört API shard, two-process concurrency, source/head/base/tree/job/attempt/step ve trusted-base kapıları korunur. API suite kimlikleri repo-root yoludur; Node süreçleri absolute dosya argümanı ve backend CWD kullanır. Sayısal ölçüm ağırlıkları değiştirilmedi; yeni süre kazanımı iddiası yoktur.

Erken bağımsız /root/review_studio incelemesi, backend CWD’sinden ls-tree root pathspec çözümünün yanlış olduğunu buldu. Graph/tree komutları Git repository root’a bağlandı. Root ve backend CWD’sinden aynı selection ve documentation scope sonucunu doğrulayan regresyon eklendi. İlk fixture uyarlamalarındaki path farkları ve historical renderer karşılaştırması düzeltildi; eski kabul kaydı yeniden yazılmadı. PR24’nin historical prose kanıtı korunur, güncel executable I/O yol değişimi eski prose-only istisnasını alamaz. Assertion, role/tenant/plan veya full-clean kapısı gevşetilmedi.

## Son yerel doğrulama ve sınırlar

Node24.22.1/Corepack pnpm12.15.0 frozen install, generate, verify106 sözleşme/yönetişim +50 CI politika=156/156;0fail/skip/cancel. Root Turbo gerçek API-package typecheck→backend verify görevlerini çalıştırdı; cache kapalıdır. Yeni root sahiplik/secret-file/version/container testleri ve CWD regresyonu geçti. GitHub workflow YAML7 dosyası parse edildi; root install/backend run scope’ları kontrol edildi. Bu kontroller gerçek GitHub job kabulü yerine geçmez.

Yerel native başlangıç bu hostun root kullanıcı kısıtında PostgreSQL tarafından reddedildi. nobody uid/gid65534 de native sağlayıcı tarafından uygun bulunmadı; geçici dedicated kullanıcı oluşturma denemesi host audit kısıtı nedeniyle kullanıcı yaratmadı. Kaynak kodda bu ortam kısıtını atlayan ayar eklenmedi; native smoke başarılı gösterilmez. Son stop çıktısı found:false/No managed stack doğruladı. Gerçek native Auth/API kabulü non-root GitHub PR runner’ında alınacaktır. Hosted veri/tenant ve production/DNS değiştirilmedi.

Nihai kaynak incelemesi ve PR hedefli test sonucu ayrıca bağlanır. CI politika/path değişimi trusted-base kurulum sınırını kaldırmaz; gerçek son aday/main kabulü ve mevcut politika kurulum yetkisi olmadan merge yapılmaz.
