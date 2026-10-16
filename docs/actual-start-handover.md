# Fiilî başlangıç kayıt ve düzeltme

Bu, kullanıcının açık kalan fiilî başlangıç API'sini tamamlama talebinin teknik aktarımıdır. Yeni parasal veya paket tüketim kuralı tanımlanmaz.

- `event_actual_start_record_v1`: org_id, center_id, event_id, expected_version, actual_started_at (Instant), reason ve standart request/operation başlığı. İlk kayıt bir kez yapılır.
- `event_actual_start_correct_v1`: aynı alanlar; actual_started_at nullable. Düzeltme ve hatalı bilgiyi kaldırma gerekçeli audit diff ekler. İlk kayıt olmadan düzeltme reddedilir.
- Yetki: mevcut `event.manage` merkez yöneticisi; canlı hesap/rol/abonelik/tenant/merkez denetlenir. Owner tek başına bu operasyon yetkisine sahip değildir.
- Gelecek fiilî zaman, boş gerekçe, yanlış sürüm ve draft reddedilir. Published/occurred/cancelled durumları korunur. İptal sonrasında geriye kayıt, iptali yeniden açmaz.
- Başarı primary_id=event_id ve yeni event version döner. Aynı operation_key ve içerik tek sonucu tekrarlar; farklı içerik reddedilir. Ayrı anahtarlarla aynı sürüm yarışında tek yazma kazanır.
- `event_get_v1`: actual_started_at null/Instant. Yönetici ve organizasyon okuyucusu actual_start_history (audit id, kayıt zamanı, aktör, gerekçe, old/new diff) görür. Diğer izinli okuyucular yalnız fiilî zamanı görür; audit gerekçeleri açılmaz.
- Q-E03 participant_cancellation kanıtı yeniden sınıflandırılmaz. Q-E02 tam merkez hesaplaşması, hak dönüşü, yoklama ve hakediş değişmez. Kayıt tek başına occurred durumuna geçirmez. Kısmi gerçekleşmeden yeni finansal sonuç türetilmez.
- Domain güncellemesi + append-only audit diff + receipt + notification/outbox aynı transaction'dır. Eski cancel preview sürüm değişiminde stale olur, yeni preview aynı kabul edilmiş hesaplaşmayı uygular.

55 çağrılabilir / 129 yalnız sözleşme işlemi. On birinci migration eklendi; önceki on migration korunur. Nihai kanıt PR'ın son commit CI kaydıdır. Yerel tip/sözleşme kontrolü gerçek API kabulünün yerine geçmez. Frontend, production, kalıcı staging, dış e-posta ve yük/restore bu değişiklikle tamamlanmaz.
