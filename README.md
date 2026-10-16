# FtkSaaS backend

Kalıcı kaynak: https://github.com/SXQHex/FtkSaaS — `main`. Fiilî başlangıç uygulaması: [PR #4](https://github.com/SXQHex/FtkSaaS/pull/4). Frontend tasarımı bu repository görevinin kapsamında değiştirilmedi.

184 operasyon sözleşmesinin 63'ü geliştirme ortamında çağrılabilir; 121'i yalnız sözleşmedir. Güncel liste: [endpoint envanteri](docs/endpoint-inventory.json). Entegrasyon: [Claude devri](docs/claude-handover.md) ve [fiilî başlangıç API'si](docs/actual-start-handover.md).

Node 24.19.0 kullanın:

```sh
git clone --branch main https://github.com/SXQHex/FtkSaaS.git
cd FtkSaaS
npm ci
npm run dev:start
npm run dev:seed
npm run dev:info
npm test
```

`npm run test:clean` yalnız checkout'a ait loopback test DB'sini sıfırlar, 18 migration'ı temiz kurar ve test/seed/sağlık/advisors kontrollerini çalıştırır. Yeni kişi/merkez/disiplin uygulaması [PR #6](https://github.com/SXQHex/FtkSaaS/pull/6) içindedir. Güncel test ve inceleme kanıtı [registry raporunda](reports/registry-verification.json); kalan 121 işlem ve bağımlılık sırası [açık iş envanterindedir](docs/remaining-work.md). İncelenen uygulama `e425298`: 169/169 test (12 sözleşme + 27 DB + 130 gerçek Auth/API); temiz kurulum, seed, sağlık ve advisors başarılı. Son uygulama incelemesi bulgusuz. Her yeni head ve main merge CI’ı ayrıca doğrulanır.

Her yeni head için [GitHub Actions](https://github.com/SXQHex/FtkSaaS/actions) sonucu ayrıca doğrulanır. [Fiilî başlangıç kanıt kapsamı](reports/actual-start-verification.json) ve [Q-E03 kanıt kapsamı](reports/qe03-verification.json) raporların hangi doğrulamayı temsil ettiğini belirtir. Q-E01/Q-E02 ve önceki RC3 raporları tarihsel snapshot'tır; son head'in CI sonucunun yerine geçmez.

Q-E03 parasal sınırı planlanan başlangıçtır; fiilî başlangıç kaydı bunu yeniden hesaplatmaz. Q-E02 merkez iptali tam borç/alacak/hak hesabını korur. Fiilî başlangıç kayıt/düzeltme API'si artık mevcuttur ve append-only audit geçmişini kullanır.

Production dağıtımı yapılmadı. `vercel.json` main otomatik dağıtımını kapalı tutar. Kalıcı ortak staging, dış e-posta, yük/restore ve frontend gerçek entegrasyon kabulü ayrı açık işlerdir.
