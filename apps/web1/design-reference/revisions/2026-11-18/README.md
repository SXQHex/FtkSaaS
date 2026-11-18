# FtkSaaS tasarım v2: paket içeriği (v67)

Tek dosyalık HTML tasarım prototipi. Gerçek API yok, tüm veri kurgusal, taban tarih Çar 4 Kasım 2026 14:20.

## Dosyalar
- `tasarim-v2/index.html`: sayfa iskeleti (tüm görünümler, rol kabukları).
- `tasarim-v2/app.css`: tüm stiller. Başında shadcn adlı OKLCH tokenları var (açık, koyu, sistem; yüksek karşıtlık).
- `tasarim-v2/tokens.css`: yalnız tokenlar (`app.css` başlığından otomatik üretilir, uygulamada `globals.css`'e taşınır).
- `tasarim-v2/app.js`: tüm davranış (tek büyük IIFE, modüller `SHARED` köprüsüyle konuşur).
- `GECIS.md`: tek geçiş belgesi. Alan alan mevcut durum, `SHARED`/işlem adı eşlemesi, kararlar, bilinen eksikler, test düzeni.
- `ILERLEME.md`: sürüm sürüm ilerleme günlüğü (A1 → v67). Proje dokümanı `claude/tasarim-ilerleme-a1-a6.md` ile aynı dosyadır.

## Açmak
`tasarim-v2/index.html` dosyasını tarayıcıda aç (`file://` çalışır). Üst çubuktaki rol seçici (Yönetici / Eğitmen / Üye) ve `Ayarlar > Yayın > Önizleme` yalnız tasarım önizlemesidir; gerçekte rol oturumdan gelir.
Canlı kopya: aynı içerik Artifact olarak yayınlıdır (tek HTML dosyası).

## Ne kapsıyor
Yönetim kabuğu (Genel bakış, Program, Üyeler, Finans, Paketler, Etkinlikler, Hakediş, Adaylar, Otomasyon, Raporlar, Stüdyo, Denetim, Ayarlar, Gelen kutusu, Talepler, Belgeler, Yardım), eğitmen rol görünümü, ayrı üye kabuğu, herkese açık sayfa, giriş/hesap ve kurulum sihirbazı, platform operatörü konsolu, Starter / Stüdyo / İşletme (çok merkez) plan katmanı.
