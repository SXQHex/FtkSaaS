# FtkSaaS frontend göç hazırlığı — kaynak doğrulama

27 Ekim2026. Başlangıç kabul edilmiş main `af06a64ba2e02823f60e74dcf637cc4dee0bd485`; bu rapor yeni hazırlık adayının yerel/bağımsız kaynak kanıtıdır. Eski backend CI/hosted kabulü yeni adaya taşınmaz. Henüz yeni aday/main full clean veya CD sonucu yoktur.

## Son kullanıcı kapsamı

Öncelik kendi repomuzu frontend göçüne hazırlamak, npm/pnpm kullanımını revize etmek ve Markdown kaynaklarını SSoT düzenine almaktır. İncelenen saaspt main `bec7e204e06a813e4907ff012d4bcea783472a15`: apps/web, packages/ui, pnpm/Turbo, sentetik tasarım. Frontend uygulama/tasarım/skill kaynakları bu hazırlığa alınmadı; import/hash izi ve gerçek ekran entegrasyonu WEB-01’dir. UI, studiosaas, DNS ve hosted yapılandırması değişmedi. Kullanıcı gerçek API entegrasyon hedefini mevcut geliştirme Supabase’i seçti; production kurulmadı.

## Gerçek değişiklik

- Tek pnpm12.15.0/pnpm-lock.yaml; npm lock kaldırıldı. Mevcut backend doğrudan bağımlılık sürümleri aynı; Turbo2.11.10 ve yerel ortak paket bağı eklendi. CI Corepack/frozen install ve .nvmrc kullanır.
- packages/contracts→packages/api-contracts; üreteç, paket export’u, typed consumer testi, delta analizi ve tarihsel fixture yol eşlemesi beraber taşındı. Tarihsel snapshot içerikleri değiştirilmedi.
- Root backend/Supabase yolları korunur; workspace apps/* ve packages/* göçe hazırdır. Turbo kök verify/test:clean ve paket typecheck/test cache’i kapalı; dört shard ve kaynak/merge/trusted-base kapısı korunur.
- Güncel kabul yalnız00, açık iş remaining-work, sıra production-queue; diğer Markdown alan devirleri bu sahipleri referans verir.71 mevcut Markdown dosyası için rol haritası hazırlandı; bu raporla72 dosya olur. Kopya kronolojiler kaldırıldı; Q-D01 köprü dosyası silindi. Eşsiz pilot/PR45 kayıtları reports/ içine byte eşliğiyle taşındı. P08 karar ve işletim girdileri kendi sahiplerine ayrıldı.
- Bağlantı JSON’u statik pnpm kurulum tarifidir; eski0/22 migration sayaçları yerine güncel kabul sahibine bağlanır. Markdown kontrolü eksik hedef ve eksik başlık fragment’ını reddeder.

## Paket sürümü karşılaştırması — 27 Ekim2026

Başlangıç FtkSaaS package.json/.nvmrc ile incelenen saaspt root ve apps/web manifestleri karşılaştırıldı. npm registry dist-tags/engines/peerDependencies geri okundu. Node [resmî sürümler](https://nodejs.org/en/about/previous-releases) ve [LTS takvimi](https://github.com/nodejs/Release#release-schedule) kontrol edildi:27 Ekim’de26.12.1 Current,24.22.1 yayımlanmış LTS yamasıdır;26 LTS başlangıcı28 Ekim’dir. TypeScript’in [resmî sürüm akışı](https://github.com/microsoft/TypeScript-wiki/blob/main/TypeScript%27s-Release-Process.md) stable/patch kullanır; ayrı LTS kanalı varsayılmaz.

| Ortak runtime/araç | Başlangıç FtkSaaS | saaspt | Hazırlık seçimi |
|---|---|---|---|
| Node .nvmrc |24.19.0 |24.21.0 |24.22.1 LTS; CI .nvmrc’den okur, engines >=24.22.1 <25 |
| TypeScript |7.0.2 |7.0.2 |7.0.2, registry latest stable; Node>=16.20 ile uyumlu |
| Paket yöneticisi | npm/package-lock; packageManager yok |pnpm12.15.0 |pnpm12.15.0, latest stable; Node>=18 |
| Turbo | yok |2.11.10 |2.11.10, latest stable |

Frontend’e özgü Next/React/Tailwind/Vitest/Playwright paketleri bu hazırlıkta backend köküne eklenmez. Registry incelemesinde saaspt Next16.4.2 yerine latest16.4.3 bulundu; göçte uygulama bağımlılığı olarak16.4.3 ve mevcut React19.3.1 peer uyumu kabul edilmelidir. Vitest5.0.5/Playwright1.64.1/Tailwind4.3.3/React19.3.1 zaten stable latest’tir. @types/node latest26.x etiketi LTS runtime24’e kör uygulanmaz; göçte24 ana sürümünün güncel24.19.2 tipi kullanılır; saaspt zaten bu sürümdedir. Ortak olmayan backend bağımlılıklarında bu istek adına toplu upgrade yapılmadı; sürümleri aynı kalır. Yeni politika güncel LTS/uyumlu stable ve exact pin’dir; otomatik latest/canary yükseltmesi değildir.

## Doğrulama ve bağımsız inceleme

Corepack12.15.0 ile frozen install başarılı. Kesin Corepack pnpm PATH’iyle son verify:105 sözleşme/yönetişim +48 CI politikası=153/153,0 fail/skip/cancel; Turbo workspace typecheck ayrıca başarıyla çalıştı. Üreteçler güncel; Supabase CLI2.122.0 çalışıyor. Kök Turbo verify dry-run doğru kök görevi ve cache MISS gösterdi. Belge kontrolü56 yaşayan dosya/335 yerel bağlantı; diff whitespace kontrolü geçti.

Bağımsız /root/review_studio kaynak incelemesi policy/CI/runtime açığı bulmadı. İki bulgu kapandı: verify’nin otomatik consistency.json mutasyonu final tree’den çıkarıldı; REPO-01 gerçek frontend importunu içermeyecek şekilde daraltıldı. Son ara tree99fb7211b2dc338b530c0108cbede4137641fc86 sonrası gerçek paket export’u/typed consumer ve bağlantı tarifi değişiklikleri de incelendi; nihai commit/tree bağı PR review kaydında tutulur. Testler inceleyen ajan tarafından başlatılmadı; bağımsız kaynak incelemesi CI yerine geçmez.

Önceki mevcut reports/, source-v2.2/,68 uygulanmış migration ve Edge index.ts byte’ları aynıdır. DB/API domain kodu ve08 makine sözleşmesi değişmedi. Yeni DB/native/full clean bu yerel hazırlık doğrulamasında çalıştırılmadı; gerçek son aday CI ayrı zorunlu kapıdır. CI politikası değiştiği için otomatik merge-clean trusted-base sınırı beklenen şekilde kapalıdır; exact-source güvenilir politika kurulum yetkisi ve gerçek aday/main kabulü olmadan merge/teslim kapandı denmez.
