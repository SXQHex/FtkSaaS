# DS-2026-10-17 — hesaplaşma yetkisi ve iki taraflı kesinleştirme revizyonu

Kaynak: 17 Ekim 2026 son açık kullanıcı kararı. Bu kayıt DS-2026-10-17'nin çelişen hesaplaşma yetki/işlem hükümlerini değiştirir; diğer ürün kuralları korunur. Karar kabulü, sözleşme aktarımı, runtime ve gerçek kabul ayrı durumlardır.

## Kabul edilen yetki zinciri

Owner, aynı organizasyondaki aktif organizasyon yöneticisine merkez yöneticileri için hesaplaşma yetkisi verme/kaldırma izni verir/kaldırır. Owner doğrudan; OM ise yalnız bu canlı devretme izniyle aynı organizasyondaki aktif CM'ye tam seçilmiş merkez kapsamında hesaplaşma yetkisi verir/kaldırır. CM bu yetkiyi devredemez. OM/CM rolü tek başına hesaplaşma yetkisi değildir. Owner'ın yetki dağıtma yetkisi finansal merkez operasyon yetkisi sağlamaz. Çok rollü kullanıcı operasyon yapacaksa ilgili CM rolü ve açık merkez grantı ayrıca aranır.

DS-OPEN-01 karar düzeyinde kapalıdır; yetki depolaması, Auth/Edge/RPC ve canlı geri alma davranışı henüz uygulanmadı. Devretme izninin geri alınması OM'nin sonraki grant/revoke isteklerinde canlı denetlenir; CM'nin finansal işlemlerinde kendi canlı merkez grantı ve rolü aranır. Yeni bir otomatik toplu/cascade grant silme davranışı bu karardan türetilmez.

## Kabul edilen iki taraflı akış

1. Canlı yetkili A CM gerçekleşen ödeme veya önerilen aynı para birimli açık mahsup için immutable başvuru açar. Bakiye kapanmaz.
2. Canlı yetkili, başlatandan farklı hesaplı B CM paranın ulaştığını veya mahsubu kabul ettiğini onaylar.
3. B onayı başvuru durumunu, ödeme/mahsup kaydını, seçili bakiye kapamalarını, audit, in-app outbox ve receipt'i tek transaction içinde kesinleştirir.
4. Gerekçeli ret bakiye veya ödeme kaydı üretmez; gerekçe A'ya uygulama içi bildirilir.

Ayrı OM ödeme kaydı aşaması kaldırılmıştır. Onay banka transferi başlatmaz. Kısmi kapama, açık aynı para birimli karşılıklı mahsup, sadece ilgili seçili hareket/sürüm değişiminde stale ve yeniden onay, aynı-key tekrarında canlı yetki, eşzamanlı onay/çift kapama engeli ve geçmişi silmeyen bağlı düzeltmeler korunur. Önceden kesinleşmiş kaydın düzeltmesi yeni bağlı başvuru olarak B'nin onayına gider; geçmiş ödeme silinmez ve yeni nakit teslimi varsayılmaz.

## Önceki istisna ile çelişki

Başlatanın iki merkezi yönetmesi self-approval yasağını kaldırmaz. Eski başka B yöneticisi yoksa ayrı yetkili OM'nin onayı istisnası yeni CM merkez grant zincirinde bir operasyon yetkisi bulamaz. Owner/OM'ye sessiz onay yetkisi verilmedi; fallback DTO'su kaldırıldı. DS-OPEN-02 yalnız bu eski istisnanın yerine başka bir yol istenip istenmediğini açık kaydeder. Normal akış yalnız başlatandan farklı, açık yetkili B CM ile tanımlıdır; istisna yolu ek açık karar olmadan çalıştırılmaz.

## Teknik aktarım ve sınırlar

settlement_payment_record_v1, settlement_offset_record_v1 ve tek taraflı settlement_adjust_v1 aktif sözleşmeden çıkarılır. Payment/offset/linked correction payload'ları SettlementProposal birleşiminde settlement_request_submit_v1'e taşınır; settlement_request_decide_v1 approve dalı tek kesinleştirme noktasıdır. Bunlar hiçbir zaman uygulanmış endpoint değildi; runtime geriye uyumluluk değişikliği yoktur.

Yeni settlement_authority_get_v1, settlement_delegation_set_v1, settlement_authority_set_v1 yalnız sözleşmedir. Okuma dar idari grant projeksiyonu ve organizasyon hesaplaşma-yetki aggregate sürümünü döndürür; set işlemleri bu sürüm, özgün actor/target rol ve scope ile kontrol edilir. CM finansal okuması ayrı açık merkez grantı ister; idari okuma ledger açmaz.

Üretilmiş toplam 197 sözleşme / 79 çağrılabilir / 118 contract_only aynı kalır: 3 taslak işlem çıkar, 3 taslak yetki işlemi eklenir. Sözleşme/CI negatif testleri davranış kabulü değildir. Yeni 34 DS gerçek Auth → Edge → RPC senaryosu pending kalır. Tarihsel raporlar korunur. Yeni merge/repository yönetim yetkisi, frontend/production/Resend işi yoktur; main koruması ayrı yönetici işi.
