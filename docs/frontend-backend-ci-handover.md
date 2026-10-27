# Backend ekibine frontend CI devri

Kullanıcının 28 Ekim kararı: backend ve frontend testleri ayrı tetiklenir. Frontend-only merge backend testlerini; backend-only merge frontend testlerini başlatmamalıdır. Ortak sözleşme/workspace değişiklikleri ayrı etki/uyumluluk kontrolünden geçer. Her iki uygulama değişiyorsa her iki test zinciri ayrı çalışır. Backend kodu ve mevcut kabul workflow'ları frontend ekibinin değişiklik yetkisinde değildir.

## Frontend tarafındaki arayüz

- Sahiplik: apps/web/** ve packages/ui/**; frontend workflow'ları .github/workflows/frontend.yml ve .github/workflows/frontend-compatibility.yml.
- Açık komutlar: pnpm check:frontend, pnpm test:frontend, pnpm test:frontend:e2e, pnpm test:frontend:coverage; pnpm test:backend mevcut backend testini filtreler.
- Ortak paketler @ftksaas/api-contracts ve @ftksaas/typescript-config'tir. Frontend backend uygulama paketine bağımlı değildir. API sürümleri ve generated dosyalar değiştirilmemiştir.
- Kaynak kontrolü gerçek Turbo dry-run grafiğiyle yapılır. Frontend-only commit başarılı backend test sonucu gibi raporlanmaz.

## Backend sahibinin tamamlayacağı değişiklik

Mevcut ci-fast.yml her geliştirme push'unda, backend.yml her main push'unda çalışıyor. select-tests.mjs bilinmeyen frontend yollarını, packages/** ve kök lockfile değişikliklerini geniş backend regresyonuna alıyor. gate/source/deployment-source yalnız documentation/full ayrımı biliyor. Yeni frontend workflow'ları da mevcut trusted politika yüzeyine giriyor. Bu nedenle bu frontend dalını push etmek mevcut backend işlerini tetikleyebilir; frontend tarafındaki ayrım tek başına yeterli değildir.

Backend sahibi şu davranışı mevcut güven kapılarını koruyarak uygulamalı:

1. PR'da exact base/head ve merge-tree; main'de gerçek merge parent'ları üzerinden değişiklik kapsamını sınıflandır. Rename/delete durumunda eski ve yeni yolu değerlendir; eksik/truncated diff'i başarılı sayma.
2. İncelenmiş frontend-only kapsamda backend DB/API/full-clean işlerini başlatma. Bu kapsam için backend başarısı uydurma; frontend'in aynı kaynağa bağlı gerçek kontrolünü kendi kabul türüyle doğrula.
3. Backend-only kapsamda mevcut core+dört API shard ve kaynak/run/attempt denetimleri sürsün. Karma uygulama değişikliklerinde iki gerçek kabulü ayrı doğrula. Etiket/yazar/branch adına dayalı test atlama yapma.
4. Ortak lockfile/manifest değişikliğinde yalnız dosya adına bakma: backend importer ve transitif çözüm grafiğinin değişip değişmediğini değerlendir. Frontend-only bağımlılık güncellemesi backend full clean gerekçesi olmasın. Gerçek backend bağımlılık değişikliği kendi kabulünü gerektirsin.
5. Frontend-only main merge Supabase CD başlatmasın. Backend kabulü sürerken frontend merge main'i ilerletirse backend source eşdeğerliğini yalnız doğrulanmış ilgili kaynak/bağımlılık kümesinden kur; test edilmiş merge-tree/parent ilişkisini veya canlı yazma öncesi güncel kaynak denetimini gevşetme.

## Gerekli negatif testler

Frontend-only/backend-only/karma değişiklikler; yalnız frontend importer'ı değişen lockfile; gerçek backend transitif bağımlılık değişikliği; ortak DTO değişikliği; dosya taşıma/silme; farklı base/head/tree veya attempt'ten taşınmış receipt; başarısız/skipped job; bilinmeyen yol; backend CI sürerken frontend merge gelmesi test edilmeli. Frontend-only örneğinde backend job'larının gerçekten başlamadığı doğrulanmalı.

Bu belge bir kurulum veya merge onayı değildir. Backend sahibinin bağımsız inceleme, kaynak bazlı güvenilir politika kurulumu ve gerçek CI doğrulaması tamamlanmadan çift yönlü CI ayrımı teslim edilmiş sayılmaz. Açık işin sahibi [tek backlog'dur](remaining-work.md).
