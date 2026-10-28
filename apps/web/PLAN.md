# Web altyapısı: hazır bileşenler, ekran tasarımı ayrı

## Özet

Mevcut tasarım kabul edilmeyecek ve görsel referans olarak kullanılmayacak. Ürün CRM olarak ele alınmayacak. Önce teknik frontend altyapısı tamamlanacak; ekran çizimleri, navigasyon düzeni ve kullanıcı akışları ayrı çalışmada belirlenecek.

Backend’e dokunulmayacak. Web öncelikli ilerleyeceğiz; Expo kurulumu sonraya kalacak.

## Altyapı çalışması

- Mevcut yerel çalışma korunarak teknik parçalar incelenecek. Auth/API istemcisi, test ve yapılandırma kodları uygunluklarına göre kullanılacak; mevcut ekran düzeni tasarım kararı sayılmayacak.
- Mevcut Next.js/React/TypeScript/Tailwind workspace yapısı tamamlanacak. Frontend geliştirme, build, lint ve test komutları backend’den ayrı çalışacak.
- shadcn/ui resmî bileşenleri ve hazır blokları ilk tercih olacak. Üç starter’dan yalnız gerekli, uyumlu parçalar seçilecek; kaynak commit’i ve lisansları kaydedilecek.
- Aynı işi yapan birden fazla UI, form veya state kütüphanesi eklenmeyecek. Mevcut Radix tabanı korunacak; Base UI tabanlı bloklar doğrudan karıştırılmayacak.
- Özel tasarım sistemi, genel amaçlı tablo/form framework’ü veya hazır bileşenleri tekrar saran component katmanı yazılmayacak. Yalnız ürün davranışının zorunlu kıldığı ince bağlantı kodları oluşturulacak.
- Türkçe/İngilizce çeviri altyapısı ve tema desteği hazırlanacak. Renk, font, yerleşim ve menü hiyerarşisinin nihai seçimi ekran tasarımı aşamasına bırakılacak.
- Mevcut native Supabase Auth ve typed Edge istemcisi korunacak. Giriş ve kuruluş/merkez seçimi, minimum uyarlama yapılmış hazır bloklarla teknik olarak doğrulanacak; bu görünüm nihai tasarım kabulü olmayacak.

## Hazır blok seçme kuralı

Önce resmî shadcn bloğu, ardından paylaşılan repolardaki uygun blok değerlendirilecek. Seçimde erişilebilirlik, responsive davranış, bağımlılık uyumu, bakım durumu ve lisans dikkate alınacak.

Bir blok yalnız görsel olarak hazır olduğu için güvenilir kabul edilmeyecek; kullanılan akış test edilecek. Tablo, grafik, takvim, komut menüsü ve benzeri ekler, ekran ihtiyacı belirlenmeden kurulmayacak.

## Doğrulama ve teslim

- Vitest, Testing Library, MSW, Playwright ve axe altyapısı tamamlanacak.
- Frontend lint, typecheck, build ve ilgili testler geçecek.
- İki dil, tema, klavye erişimi ve kullanılan hazır blokların mobil davranışı doğrulanacak.
- Yetkili geliştirme hesabıyla gerçek giriş → kuruluş/merkez okuma → çıkış akışı kontrol edilecek; mock sonuçları canlı kabul sayılmayacak.
- Backend kaynakları, API sözleşmesi ve backend CI/CD dosyalarında değişiklik olmayacak. Mevcut kabul kapıları korunacak.
- Ayrı frontend branch ve Draft PR kullanılacak; full clean başladığında AGENTS devir kuralı uygulanacak.

Altyapı tesliminden sonra ekranları ürünün gerçek kullanım amaçlarına göre birlikte çizeceğiz. Bu aşamada dashboard, CRM menüsü veya iş ekranı tasarımı üretilmeyecek.

## Güncel durum — 28 Ekim 2026

Bu dosya frontend planının, açık işlerinin, sırasının ve kabul durumunun tek sahibidir. Üstteki kabul edilmiş plan aynen korunur; ilerleme ve yeni açık kararlar yalnız aşağıda güncellenir. Teknik kullanım [README](README.md), çalışma kuralları [AGENTS](AGENTS.md) içindedir. Genel docs belgelerinde frontend görev listesi veya durum kronolojisi tutulmaz. Expo başladığında kendi uygulama dizininde aynı dosya düzenini kullanır.

| Teslim | Durum | Kabul kanıtı |
|---|---|---|
| Web teknik altyapısı | PR76 normal merge ve aynı-main/development kabulü tamamlandı. Native giriş → gerçek kuruluş/merkez seçimi → çıkış doğrulandı. | [PR76](https://github.com/SXQHex/FtkSaaS/pull/76), [main clean](https://github.com/SXQHex/FtkSaaS/actions/runs/40703561601), [frontend CI](https://github.com/SXQHex/FtkSaaS/actions/runs/40703561551), [development CD](https://github.com/SXQHex/FtkSaaS/actions/runs/40707542463) |
| Oxlint + Oxfmt | Son kullanıcı kararıyla Biome yerine geçti; PR77 normal merge ve aynı-main/development kabulü tamamlandı. | [PR77](https://github.com/SXQHex/FtkSaaS/pull/77), [main clean](https://github.com/SXQHex/FtkSaaS/actions/runs/40709789814), [frontend CI](https://github.com/SXQHex/FtkSaaS/actions/runs/40709789822), [development CD](https://github.com/SXQHex/FtkSaaS/actions/runs/40714573352) |
| Ekran tasarımı ve işlemler | Başlamadı. Geçici Auth/bağlantı görünümü nihai tasarım kabulü değildir. | İlk ekran ve kullanım amacı henüz seçilmedi. |
| Expo | Sonraya bırakıldı; uygulama kurulmadı. | Web önceliği korunuyor. |

Altyapı kabulü tüm ürün ekranlarının API entegrasyonunu, Google/TOTP’nin gerçek sağlayıcı dönüşünü, public widget kabulünü veya production yayınını kapatmaz. Ekran işlemleri bağlanırken rol/plan/tenant ve veri görünürlüğü, expected_version, preview, replay ve bilinmeyen sonuç davranışları [mevcut istemci protokolüne](../../docs/claude-handover.md) göre doğrulanacak. Önceki frontend aday ve inceleme kayıtları [PR77 main’indeki değişmez kaynak sürümünde](https://github.com/SXQHex/FtkSaaS/blob/5bebc8f0fb6c89e1d67648fb06a2db729a4f489b/docs/contracts/00-FtkSaaS-yeni-sohbet-devir.md#web-01-frontend-altyapısı-adayı--28-ekim-2026) korunur; burada ikinci kronoloji oluşturulmaz.

## Sıradaki iş ve açık kararlar

İlk web ekranının kullanıcı grubunu, amacını ve yapılacak işlemleri birlikte belirle; ardından resmî shadcn ve uygun hazır bloklarla ekran çizimine geç. Renk, font, yerleşim ve navigasyon kararları bu çalışmada verilecek. Ekran ihtiyacı belirlenmeden tablo, grafik, takvim veya komut menüsü kurulmayacak.
