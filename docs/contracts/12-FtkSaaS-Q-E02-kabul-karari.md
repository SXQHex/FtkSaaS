> **Güncel ek: Q-E03.** Parasal iptal sınırı planlanan başlangıçtır (eşitlik dahil sonrası). Q-E02 merkez iptali korunur. Teknik durum: docs/decisions/Q-E03.md; test/CI kanıtı ayrıca doğrulanır.

# Q-E02 — Etkinlik iptali son kabul · 16 Ekim 2026

Bu kabul önceki “başlama sonrası merkez iptalinde iade yok, borç korunur” hükmünün yerine geçer.

- Katılımcı etkinlik başladıktan sonra kendi kaydını iptal eder veya ayrılırsa parasal iade yapılmaz. Paket hakları için yeni sonuç türetilmez; mevcut kabul edilmiş koşullar korunur.
- Merkez etkinliği iptal ederse, başlamış veya kısmen gerçekleşmiş olsa da etkinliğe bağlı ücret yükümlülüğü tamamen kaldırılır. Kalan etkinlik borcu sıfırlanır; tahsil edilmiş tutarın tamamı öğrenci alacağına dönüşür. Nakit iade veya mahsup ayrı, açık ve yetkili işlemdir; otomatik nakit çıkışı yapılmaz.
- Paketle katılımda merkez iptali ayrılmış hakları tamamen serbest bırakır. Tüketilmiş haklar bağlı ters hareketlerle tamamen geri verilir. Kısmi tüketim uygulanmaz; aynı hak için ayrıca parasal alacak oluşturulmaz.
- Önceki iade, alacak ve hak dönüşleri hesaba katılır; mükerrer sonuç üretilmez. Başka borçlar ve geçmiş kayıtlar değiştirilmez.

Başlangıç sınırı: ilk Q-E02 kararının ayrı fiilî başlangıç kaydı yoktu; sonraki kabul edilmiş aktarım kayıt/düzeltme API’lerini ve actual_started_at geçmişini ekledi. [Fiilî başlangıç devri](../../apps/backend/docs/actual-start-handover.md) güncel operasyonel karşılıktır. Saat geçmesi gerçekleşme değildir; kısmi gerçekleşmeye yeni oran/para/hak kuralı eklenmez. Q-E03 parasal sınırı ve merkez iptalinin aşamadan bağımsız tam sonucu korunur. Teknik durum ve test kanıtı docs/decisions/Q-E02.md ve reports/qe02-verification.json içindedir.


## Q-E03 — Planlanan başlangıç ve iptalin parasal sınırı · 16 Ekim 2026

**E03-01.** Katılımcı iptalinin parasal sınırı planlanan başlangıçtır. Başlangıç anı dahil sonrasında iade, borç indirimi veya öğrenci alacağı oluşmaz. Öncesindeki iptaller mevcut kabul edilmiş koşullara tabidir.

**E03-02.** Fiilî başlangıcın gecikmesi, sonradan kaydı veya düzeltmesi tamamlanmış katılımcı iptalini yeniden sınıflandırmaz; finansal yeniden hesaplama yapılmaz. Plan 21.00, iptal 21.15, fiilî başlangıç 21.30 başlangıç sonrası iptaldir.

**E03-03.** Planlanan saatin gelmesi tek başına yoklama, hak tüketimi, gerçekleşme veya hakediş oluşturmaz. Katılımcı paket iptal koşulları korunur.

**E03-04.** Merkez iptalinde Q-E02 aynen geçerlidir; ertesi gün kaydı veya aşama tam borç kaldırma ve bağlı para/hak dönüşlerini değiştirmez.

**E03-05.** Başarılı katılımcı iptalinde backend karar zamanı, o andaki planlanan başlangıç ve parasal sınıflandırma participant_cancellation kaydında atomik sabitlenir. Önceki kayıtlara zaman kanıtı uydurulmaz; eski ve merkez iptallerinde alan null kalabilir. İstemci zaman veya sınıflandırma gönderemez.

