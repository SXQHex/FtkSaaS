> Aktif aday: tek stüdyo kurulum kabulü ve sürümlü ürün adı;213 API/67 migration. Son kabul edilmiş main5892b3c hâlâ213/66’dır; yeni adayın kabulü ayrı bekler.

# FtkSaaS backend

## Doğrulanmış güncel kaynak

## 27 Ekim — Starter plan kapıları teslimi kapandı

[PR #56](https://github.com/SXQHex/FtkSaaS/pull/56) main `ed747324f7d008b24103d4fd2eba503791c70a93` üzerinde kabul edildi: **213 callable API / 0 contract_only / 66 migration / 90 core tablo**. [Aday full clean40419827224](https://github.com/SXQHex/FtkSaaS/actions/runs/40419827224), [aynı main full clean40422823564](https://github.com/SXQHex/FtkSaaS/actions/runs/40422823564) ve [development CD40425584520](https://github.com/SXQHex/FtkSaaS/actions/runs/40425584520) başarılı. CD gerçek deploy ve20/20 hosted kontrol içerir; backend-v1 Edge21 ACTIVE, `verify_jwt=true`. JWT doğrulaması son kullanıcı kararıyla açık kalır.

Starter limitleri **1 merkez / 1 aktif oda / 1 disiplin / 1 aktif eğitmen / 100 aktif öğrenci**; tek mantıksal oda, seçili merkez-disiplin paketi ve disiplin adı ön eki uygulanır. Genel CRM/etkinlik/personel/hakediş kapalı; yoklama anlaşmasız ve hakedişsiz çalışır. Canlı plan/kapsam kapıları eski receipt/preview/grant ve doğrudan RPC ile aşılamaz. Pro→Starter kapsam seçimi sürümlüdür; seçilmeyen operasyon kapanır, geçmiş seans/kesin rezervasyon/hak/finans kayıtları korunur. [DTO, kapsam ve kabul kanıtları](docs/starter-plan-gates-handover.md).

Bu kapanış yalnız plan kapıları ve sürümlü kapsam düşürme teslimidir; bütün Starter dağıtım yol haritası, gerçek public hostname/Turnstile, Pro/Business ayrı limit/özel teklif veya production hazırlığı tamamlandı sayılmaz. Aşağıdaki önceki kaynaklara ait tarihli aday/bekleme/envanter notları tarihsel checkpointlerdir; güncel kabul veya açık iş olarak kullanılmaz. Tarihsel `reports/` dosyaları ve eski kaynak snapshotları korunur. Bu belge eşitlemesi yeni runtime testi veya deploy değildir.

Güncel kaynak merkezi [SXQHex/FtkSaaS main](https://github.com/SXQHex/FtkSaaS). İşe [AGENTS](AGENTS.md), [kaynak indeksi](docs/source-index.md) ve [güncel devir](contracts/00-FtkSaaS-yeni-sohbet-devir.md) ile başlanır.

## API ve entegrasyon

- [Makine sözleşmesi](contracts/08-FtkSaaS-tip-ve-operasyon-sozlesmesi.json), [TypeScript API](packages/contracts/src/operations.ts) ve [endpoint envanteri](docs/endpoint-inventory.json):213 yayımlanmış callable operasyon;0 contract_only.
- [İstemci devri](docs/claude-handover.md): gerçek DTO/yetki/sürüm/sağlayıcı ve kalan consumer sınırları.
- [Ayar API devri](docs/frontend-settings-handover.md):46 alan/44 writable, altı settings işlemi;69 davranış grubunun tümü uygulanmış değildir.
- [Kalan işler](docs/remaining-work.md) ve [üretim kuyruğu](docs/production-queue.md): tüm Starter backend yol haritasının kalanları ve ayrı P08 işleri.

Kapasite, settings ve kimlik kaynakları PR56 tabanında birleşmiştir. P01–P07 önceki motorları yeniden yazılmaz. Standart yeni org negatif limit kararı0, mevcut kulüp−2’dir; politika yapılandırması ve gerçek consumer kabulü ayrı doğrulanır. Beş hosted worker’ın temel kurulum/idle kanıtı, gerçek iş yükü veya afet kurtarma kabulü değildir.

## Geliştirme ve CI

Node24.19.0 ve sabit lockfile ile:

```bash
npm ci
npm run generate
npm run verify
npm run dev:start
npm run test:clean
npm run dev:stop
```

`test:clean` yalnız izole loopback DB’sini sıfırlar; hosted gerçek veriye reset/clean/seed uygulanmaz. Geliştirmede birikimli hedefli doğrulama, runtime/CI son aday ve aynı main’de full clean; incelenmiş güvenli belge yollarında kaynak bağlı belge kabulü uygulanır. [CI politikası](docs/ci-policy.md) ve clean başladığında kullanıcıya devir kuralı korunur. Sadece Markdown uzantısı belge istisnası sağlamaz.

[Hosted kurulum](docs/remote-backend-setup.md) geliştirme/test içindir. Frontend tasarımı ve production dağıtımı bu kapanışta yapılmaz. Native Auth e-postası/Google/TOTP kabulü önceki kimlik teslimine aittir; pazarlama veya yeni dış gönderim başlatılmaz. Tarihsel raporlar korunur.
