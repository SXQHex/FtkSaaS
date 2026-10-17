# DS-2026-10-17 — hesaplaşmada merkez bazlı yetki düzeltmesi

Kaynak: 17 Ekim 2026 son açık kullanıcı düzeltmesi. Bu karar önceki kendi başvurusunu onaylayamaz / başlatandan farklı kişi veya hesap gerekir hükümlerini yürürlükten kaldırır. Diğer kabul edilmiş ekonomik, kapsam, sürüm ve atomiklik kuralları korunur. DS-OPEN-02 karar düzeyinde kapanmıştır; runtime veya gerçek davranış kabulü tamamlandı anlamına gelmez.

## Merkezler üzerinden bağımsız yetki

A ve B aynı organizasyonda farklı merkezlerdir; hesapların farklı olması şart değildir. Aynı kişi/hesap hem A hem B'de aktif merkez yöneticisi ve açık hesaplaşma yetkilisi ise A kapsamıyla başvuru açabilir, B kapsamıyla aynı başvuruyu onaylayabilir. Yalnız A yetkisi B adına onay sağlamaz. Owner → OM'ye devretme izni → CM'ye merkez grantı zinciri ve Owner'ın doğrudan grant yönetimi korunur; rol veya idari grant yönetimi tek başına finansal operasyon yetkisi doğurmaz.

Submit'te sunucu aktörünü request.from_center_id (A) için güncel CM rolü ve açık merkez grantıyla doğrular. Decide'ta actor ve org/center scope başvurunun dondurulmuş stored_request.to_center_id (B) üzerinden yeniden doğrulanır; A'nın yetki kontrolü B kontrolünün yerine geçmez. İstemcinin center_id seçmesi, snapshot göndermesi veya hesapların eşit olması yetki yaratmaz. Eski Auth oturumu, bekleyen başvuru veya receipt replay geri alınmış B rol/grantını korumaz. İlgili rol/grant canlı kontrolü commit ve tekrar öncesinde yapılır ve yarışlarda seri hale getirilir.

## Audit ve atomik kesinleştirme

Audit her adımın sunucudan doğrulanmış hesabı, organizasyonu, merkezi, permission'ı, CM rol kimlik/sürümü ve grant sürümünü kaydeder. Request okuması initiator_authority ve decision_authority snapshot'larını ilgili account ID'leriyle gösterir. Hesap ID'lerinin eşit olması hata değildir; A/B yetki kapsamları ayrı kalır. Bu snapshot'lar tekrar kullanılabilir yetki tokenı değildir ve istemci input'u olarak kabul edilmez.

A başvurusu bakiyeyi kapatmaz. B onayı payment/offset/bağlı düzeltme kaydı, seçili bakiyeler, başvuru, audit/outbox/receipt'i tek transaction içinde kesinleştirir. Gerekçeli ret bakiye değiştirmez ve A'ya uygulama içi bildirilir. Kısmi kapama, aynı para birimli açık mahsup, açık original allocation seçimi, ilgili değişiklikte stale/yeniden onay ve geçmişi koruyan düzeltme aynen korunur. Aynı hesapla çalışmak idempotency, sürüm/yarış kilitleri veya çift bakiye kapama engelini aşmaz. Ayrı OM kayıt aşaması, banka transferi veya istisna/fallback yolu yoktur.

## Aktarım ve teslim sınırı

01/02/06/08 sözleşmeleri, permission/guard/step authority_binding/audit DTO'ları, F01–F33 izi, kabul kataloğu, katalog/tip/envanter ve devirler bu kararla eşitlenir. 197 sözleşme / 79 çağrılabilir / 118 contract_only, 25 migration korunur. 38 DS gerçek davranış senaryosu pending_runtime kalır; yapısal şema/governance testleri gerçek Auth → Edge → RPC kabulü değildir.

Tarihsel raporlar eski kuralları kendi kaynak SHA'sında korur. Yeni son head için odaklı doğrulama, bağımsız inceleme ve zorunlu tam temiz CI gerekir; eski SHA başarısı taşınmaz. Kullanıcı PR #13'ün main'e merge edilmesini bu görevde yetkilendirmiştir. Merge sonrası aynı tam main SHA'sının CI sonucu ayrıca doğrulanır. Repository yönetimi/main koruması ayrı yönetici işidir. Frontend, production ve Resend'e müdahale edilmez.
