# P02 paket ve seans yaşam döngüsü

P02 kapanış: PR28 main cc4878d09e45204dbc13ccfe1324b38b14548167 ve aynı main39461804543 completed/success ile done;469 test,40 migration. Aşağıdaki geliştirme kaynaklarının pending notları tarihsel snapshot’tır. Güncel P03 değişiklikleri ve kabulü üretim kuyruğunda ayrı izlenir.

Hedefli39447440608 (d313538):27 DB testi ve P02 seans/hak/sonlandırma-yenileme/değişim/bekleme-iade vakaları geçti. Dondurma vakası, başarılı korunan attendance tüketiminden sonra doğrudan node-pg bigint sonucu "31" ile31 karşılaştırmasında durdu; Number(...) test düzeltmesi eklendi. Runtime kaynağı değişmedi. Yeni head hedefli sonucu, tek aday clean ve main kabulü hâlâ bekler; eski koşu genel başarı değildir.


P02 PR #28 Draft/development: bütün15 API uygulama adayı, 199 / 133 runtime / 66 contract_only / 40 migration. Hedefli39443588849 test beklentisini,39444715078 özgün etki yetkisi/fiziksel tablo adını,39445926760 ortak dependency fonksiyonundaki sale_id parametre/kolon belirsizliğini yakaladı. Düzeltmeler yeni migrationlarda; son kaynakta hedefli doğrulama henüz bekleniyor. Bağımsız inceleme yenilemede gereksiz currency eşitliğini kaldırttı; yalnız ürün değişimi/mahsup aynı currency ister. Son kaynak incelemesi ve bütün P02 için tek aday/main clean açık; P02 done değildir.

Başlangıç main f6afef4bdc4ef1bcbf37697ae771fef04a9fb455; tek feature/p02-package-session-lifecycle / PR #28. P01 ve CI-02 kapalıdır. Frontend, production, Resend ve repo ayarları değişmedi. Yerel native DB artefact indirmesi DNS ETIMEOUT ile engellendi; gerçek runtime kanıtı GitHub hedefli CI’da alınır.

## Uygulama sınırları

- Seans iptali: açık planned seans için aktör/merkez/token/bağımlılık bağlı preview; active rezervasyonların hak/açıkları serbest kalır, waitlist ve teklifler kapanır, etkilenen kişilere tek in-app bildirim çıkar. Closed attendance reddedilir. Yerine seans linked yeni kayıttır; katılımcı ve telafi kredisi taşımaz.
- Kredi/uzatma: reservation_impact_preview tam change/reason/actor/center/dependency ve bütün affected onayını bağlar. credit_adjust veya entitlement_extend ile reservation_impact_apply alternatif tek tüketim yollarıdır. Kredi düşüşü reserved/consumed yükümlülüğü silmez; yeni kayıt güncel havuza tabidir. Uzatma açık ileri00:00 tarihi ve entitlement account sürümünü kullanır; geçmiş katılım/hakediş üretmez.
- Dondurma/erken bitirme: planF17 ve ürün snapshot koşulları, açık yerel tarihler, toplam max_days, aralık çakışması ve kaynak bağı kontrol edilir. Mevcut kesin haklar korunur; yeni kayıt dondurulan aralıkta hak kullanamaz. Erken bitirme gerekçeli ve ileri tarihli; yalnız kullanılan yerel gün kadar ücretsiz uzatma kalır, paid_days değişmez. Kaynak/duty-only seans değişimi aynı andaki korunmuş yükümlülüğü düşürmez; yeni an güncel hak kontrolüne tabidir.
- Sonlandırma: yalnız serbest kullanılmamış hak kapanır; geçmiş allocation/confirmed rezervasyon, borç/tahsilat ve bağımsız katılım engelleri korunur. Otomatik iade/borç silme/rezervasyon iptali yoktur.
- Değişim: bütün gelecek rezervasyonlar açık keep/cancel seçimine dahil edilir. Uygun yeni hakka yer kaybetmeden atomik rebind yapılır. İlgili merkezde canlı CM yetkisi gerekir; desteklenmeyen gelecek event kayıtları ayrı açık iptal edilmeden değişim tamamlanmaz. Yeni satış/hak yazarı rollback-only subtransaction içinde kapasite/deficit/kota için önizlenir; kalıcı satış, borç, hak, receipt veya bildirim oluşmaz. Eski sabit refund yöntemi (credit_ratio / used_at_unit_price / time_ratio / none) önce aynı satışın borcunu azaltır; yalnız tahsil edilmiş fazla tutar student credit olur. offset_minor ayrı açık tutardır; nakit iade yoktur.
- Yenileme: bağımsız linked yeni satış; eski kredi/süre/kayıt taşınmaz veya canlandırılmaz. Açık tarih gap/overlap gösterilir; yeni kredi mevcut eligible consumed sonra reserved deficit’i mevcut yazar üzerinden kapatır. Yeni para birimi eskiyle aynı olmak zorunda değildir; para/hak dönüşümü yapılmaz.

## Okuma ve finans entegrasyonu

entitlements_get account_id/version, sale_version/sale_state ve freeze kayıtlarını taşır; closed satışın serbest kullanılabilir hakkı0 gösterilir. Preview.sale_lifecycle açık tarih, gap/overlap, frozen refund hesabı ve mahsup tutarını gösterir. Güvenli hata şekli korunur.

private.p02_sale_settlements her eski satışın değişim hesabını receipt’e bağlı immutable kaydeder. P03 genel iadesi bu kaydı ve mevcut debt_adjustments/debt_claimed/student-credit hareketlerini tüketmeli; aynı bedeli yeniden alacaklaştırmamalıdır. Genel P03 finans API’leri bu teslimde kapanmaz.

## Doğrulama ve kalan kabul

Yapısal verify:96 sözleşme/yönetişim +37 CI politika testi geçti. Çağrılabilir envanter133, contract_only66, core tablo90;40 append-only migration kaynak/wrapper/manifest ile eşlenir. F01–F33 haritasında yeni runtime yolları izlenir; feature/main kabulü tamamlandı sayılmaz.

Gerçek Auth→Edge→RPC testleri token/reason/change/version/actor/center, canlı yetki geri alma, aynı-key yarış/replay, geç audit rollback, bekleme/teklif bağı, korunan hakların gerçek attendance close tüketimi, ayrı para birimli yenileme, frozen iade yöntemleri ve açık offset’i kapsar. Time-ratio geçmiş zaman girdisi geçmişi temsil eden sentetik fixture ile, gerçek preview yolunda sınanır; geçmişte çalışmış otomasyon kanıtı değildir.

Son head hedefli CI, bağımsız re-review, Draft/development temizliği, tek açık aday full clean, koşullu merge ve aynı main full clean kabulü bekliyor. Full clean başlayınca run/head/base/tested merge ile kullanıcıya devredilir; izleme yapılmaz. P03’e main kabulünden önce geçilmez.
