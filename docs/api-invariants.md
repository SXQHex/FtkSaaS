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
