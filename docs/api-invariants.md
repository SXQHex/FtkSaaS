> 23 Ekim 2026 güncel durum: P01–P07 kod/main/geliştirme-test kabulü kapandı; yayımlanmış kapsam **200 API / 0 contract_only / 59 migration / 90 core tablo / Edge8**. P07 runtime kaynağı `4cfc9a55`; güncel belge tabanı `bfb8ccb2`. Beş Cron hattı aktif ve boş kuyrukta healthy/idle; fiziksel imha ve gerçek yük kabulü tamamlanmış değildir. Ayar davranış sprinti ve güncel entegrasyon sınırları [tek devir](../contracts/00-FtkSaaS-yeni-sohbet-devir.md) ve [ayarlar sözleşmesinde](../contracts/02-FtkSaaS-teknik-sozlesme.md#ayarlar-sozlesmesi-ve-davranis-sprinti). Eski tarih/CI/pending snapshotları yeni durum kanıtı değildir; ürün kuralları yalnız son açık kararla değişir.

25 Ekim güncel ürün hedefi: [tek oda/seans/kategori kapasitesi ve ayrı kontrollü aşım](../contracts/02-FtkSaaS-teknik-sozlesme.md#oda-seans-kapasite-karari). Yayımlanmış main200/59 DTO'ları ile PR45 adayı201/60 ayrıdır. PR45 bağımsız inceleme ve aday40164825351 başarılı; merge/main/CD bekler. Bu modülün eski test/alan adları kendi tarihsel runtime kaydını anlatır, yeni ürün kuralı değildir.

# API değişmezleri ve uygulama sınırı

Güncel çağrılabilir kullanıcı API transport'u `POST /functions/v1/backend-v1/{operation}` → service-only named RPC'dir; frontend doğrudan core/private veya service-only Data API RPC'sine çağrı yapmaz. P01 sistem worker'ı ayrı dar DB kimliğiyle private worker girişini kullanır; insan Auth dispatcher'ı değildir. Aşağıdaki W/R/P/A/E/B/H ayrımı sözleşmenin işlem türü/hedef taşıma sınıflandırmasıdır; her soyut sınıfın ayrı public URL ile uygulanmış olduğu anlamına gelmez. Kesin çağrılabilir yol ve izinler [endpoint envanterinde](endpoint-inventory.json), kaynak/CI ve açık kapsam [tek devirde](../contracts/00-FtkSaaS-yeni-sohbet-devir.md) izlenir.

## Taşıma ve tip kuralları

- W/R/P/A RPC adı `api_v1.<name>_v1`; Data API yolu `/rest/v1/rpc/<name>_v1`, seçilen schema profili api_v1; tek p_request zarfı, overload yok. R salt okuma, P önizleme business verisi değiştirmez, A dependency kontrollü apply, W komuttur.
- E dış Auth/dosya/provider işi için Edge orkestrasyonudur; aday yol `/functions/v1/<name>_v1`. Her RPC’nin önüne Edge konmaz. B private worker/platform API; istemciye grant yok. H Supabase Auth SDK adaptörüdür; Request/Success tanımı uygulama adapter şekli, Auth provider raw session cevabını yeniden tanımlamaz.
- Ortak request başlığı: client_api_version=1, request_id UUID; domain işleminde org_id ve gerekiyorsa center_id. G hesap işleminde org zorunlu değildir; account_access_send org işlemi, access_accept hedef token/verified hesapla çözülür. Aktör hiçbir request rol/account beyanından alınmaz.
- W/A/E/B mutasyonda operation_key; existing mutable record’da expected_version; create/update birleşik çağrıda existing target için version şart, create’de yok. A request preview token+dependencies içerir, TTL15dk teknik config; değişmiş ilgili kayıt/onay veya expired preview ret. Key içeriği: operation_key/request_id harici business içerik (expected_version dahil) canonical hash; retry payload semantiği korunur, version değiştirerek aynı key farklı iş yapılamaz.
- API money bigint string, ara hesap decimal; yarım sıfırdan uzağa, dağıtım en büyük küsurat/kararlıID, kayıtlı tutar tersine çevirilir. Bilinmeyen alanlar ret. JSON nullable ile optional ayrıdır; key yoksa patch korur, izinli null temizler. Secret/password/token/signed URL loglanmaz.
- Page default50/max200, sorguya özgü sort allowlist + UUID tiebreak; cursor org/actor-scope/filtre/sort bağlı. Tüm filterli export tüm sayfaları kapsar. Canlı keyset liste snapshot garantisi değildir; rapor as_of zamanı bellidir.
- RPC domain yanıtı `{ok,data,trace_id}` veya `{ok:false,error}`. RPC domain hatasının HTTP kodu her durumda otomatik eşleşmez; Edge/adaptör06 kod eşlemesi yapar, hata metni parse etmez. Connection timeout iş başarısızlığı kanıtı değildir; aynı key ile status/retry.
- Okuma DTO’su08’de alan bazında tanımlıdır; role mask’te izin verilmeyen optional alan üretilmez. Required output alanına yetki yoksa ilgili DTO/query yetkisi verilmez. JSON type doğrulama, semantic guard/tenant/RLS kontrolünün yerine geçmez.

## Ödeme/plan/kuruluş kapıları

bootstrap: İlk ödeme öncesi yalnız owner kuruluş/ödeme, merkez oluşturma ve kendini manager atama. Yeni owner ataması yalnız platform. Öğrenci/satış/ders işlemleri pending_payment durumunda yok; ilk ödeme doğrulama anında abonelik başlar, ücretsiz trial veya7gün ilk ödeme ek süresi yok. Aktif abonelik normal capability/limit, grace kabul edilen ilk7gün matrisi, service closed owner subscription dışında kapalıdır.

Owner tek başına merkez invite/rezervasyon/tahsilat yapamaz. Config org scope O/OM; center scope CM. Otomasyon tanımlamak merkez operasyonu yetkisi üretmez; execution actor/scope’u merkez yetkilendirmesinden gelir, rol/plan/zorunlu politika aşılmaz. Satır Fxx minimum plan erişimi01 plan matrisindendir; ayrı plan fiyat/limitleri konfigürasyon, değişmez bütünlük şartları değildir.

Q-E03: `event_registration_cancel_v1` zamanını backend belirler; planlanan başlangıç eşitliği sonrası sayılır. Başarılı iptalin `participant_cancellation` snapshot'ı event_get içinde okunur; sonradan gerçekleşme kaydı/düzeltmesi bu sonucu yeniden hesaplamaz. Para ve paket sonucu ayrı kurallardır. Öncesindeki mevcut iptal koşulları ve Q-E02 merkez iptali korunur.

## Settings ve frontend sınırları 23 Ekim

[Normatif settings davranışları](../contracts/02-FtkSaaS-teknik-sozlesme.md#ayarlar-sozlesmesi-ve-davranis-sprinti) kabul edilmiş hedef ile callable DTO'yu ayırır. Mevcut200 operasyon yerinde kalır. Profil write-version account_get'den tahmin edilmez; management okumasından alınır. Native parola challenge yanıtı parola tamamlandı/diğer oturumlar kapandı/dış e-posta ulaştı kanıtı değildir.

Güncel kişisel bilgi yalnız aktif güvenli hesap bağına yansır; rol veya kişi birleştirmesi üretmez. Geçmiş belge snapshotları ayrı kalır. Tercih sıfırlama izin verme değildir. Görünüm/rol/filtre seçimi erişimi genişletemez; cihaz timezone'u iş Instant'ını değiştiremez. API olmadığı yerde sahte kaydetme başarısı üretilemez.

