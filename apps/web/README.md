# FtkSaaS web

Çalıştırma, araçlar ve tasarım rehberi [docs/development.md](docs/development.md) altındadır. Starter bölüm planı, aktif bölüm, bağımlılıklar ve frontend kabul takibi yalnız [docs/todo.md](docs/todo.md) içinde tutulur. Bir bölüm bitmeden sonraki bölümün uygulamasına geçilmez.
Ajan önce kök [AGENTS](../../AGENTS.md), yerel [AGENTS](AGENTS.md), [kaynak indeksi](../../docs/source-index.md) ve backend [iş akışlarını](../../docs/workflows.md) okur.

**Yetki sınırı:** Plan ve sohbet devri kendi `docs` dizinindedir. Backend belgeleri ve ortak sözleşmeler salt okunur; [ortak taleplerde](../../docs/requests.md) yalnız kendi alanını güncelle. Kapsam dışı veya belirsiz değişiklikte gerekçeyle kullanıcı onayı iste; mevcut açık yetkiyi tekrar sorma. [Ajan kuralları](AGENTS.md).

Ekran geliştirmeden önce ilgili WF kimliğini, API okuma/komut sırasını, rol/plan sınırını, yan etkileri ve hata/kurtarma davranışını PR'de belirt. Eksik/unsupported okuma veya selector varsa backend bağımlılığını kaydet; tablo erişimi, sahte endpoint veya tahminî iş kuralıyla doldurma.

Başarı sonrası yenilenecek veriler, preview/version, belirsiz sonuç ve replay, hesap/tenant değişimi, loading/empty/error ve erişim kaybı senaryoları tamamlanmadan entegrasyon bitti sayılmaz. Mock test ve gerçek hosted kabul ayrı kaydedilir.

Komutlar: `pnpm dev:web`, `pnpm check:frontend`, `pnpm test:frontend:e2e`. Backend tipleri `@ftksaas/api-contracts` kaynağından gelir; DB artifact tipleri frontend sözleşmesi değildir.
