# Starter plan kapıları — kaynak ve odaklı kabul

Başlangıç main: `3fa72e7b805b2bbfb8895f3d90813eaa3cb416aa`. Bu rapor aday değişikliğin geliştirme kanıtıdır; aday/main full clean veya hosted kabulü değildir. Mevcut65 migration korunur, yeni66 migration eklenir. Pro/Business diğer sayısal limit ve özel teklif işleri kapsam dışıdır.

## Kaynak bağı

- `database/starter-plan-gates.sql`: `a942d248f0d861277de2bcc0c3021f317263a3dac48a0d9427bf808d1a8a97c2`
- `tests/starter-plan-gates-acceptance.mjs`: `2a184ba6525c9c9cb9df85ebf8fdfcbf9f6913fc1f869b74a8b953d37d567549`
- `tests/starter-attendance-protection.test.mjs`: `15601c6c03681d3bc96126d02a6d3cb398d0cd2936b78178b3f35496b79044ef`
- `tests/fixtures/p07-subscription-lifecycle.sql`: `ea0ddbef9ef3a5c63f7f731982a19397d46050f92df44ae432bb0ee54cc2df57`

## Odaklı doğrulama

- `npm run verify`: son kaynak üzerinde geçti; sözleşme, generator, migration/hash ve mevcut CI politikası kontrolleri korunur.
- İzole native Supabase, gerçek Auth→Edge→RPC: önceki çekirdek Starter/yoklama/abonelik koşusu29/29 geçti (329.298sn,0fail/skip/cancel). Bu koşu P06 ortak kota ve personel rapor kapısını da kapsar; son lifecycle deltalarının yerine sayılmaz.
- Son geniş koşu51 testin45'ini geçirdi;3 child ve bunların3 parent'ı başarısız oldu. P06 kişi oluşturma boş HTTP503; yoklama düzeltme tarihsel booking kontrolü; role-only eğitmen uygunluğu ayrı sorunlar olarak kaydedildi. Bu koşu temiz kabul değildir. Aynı koşudaki profil/merge10/10 ve abonelik1/1 geçti.
- Seri tekrar: P06 12/12 geçti (144.571sn); boş HTTP503 tekrarlanmadı, kök neden iddiası yok. Yoklama ve yeni Starter kapsamı seri kabulü sürüyor.
- Temiz66 resetten sonra kaynakla aynı son request-guard gövdesi, Starter testleri başlamadan uygulandı. Kurulu `starter_request_guard` prosrc SHA256 `7c43cbdebd976bd2e8615fd3baec7f8ae3bb7aec7c052b991221cacb86ba6526`; `starter_session_allowed` `13230b5178011e513bd422e49dc2c42192230808dad242deecbfe7d3ae3d73b2`. Yerel son kaynak gövdeleriyle eşleşti.

## Kabulün kapsamı

Gerçek ödenmiş Starter aboneliği,1/1/1/1/100 limitleri, eşzamanlı100. öğrenci yarışı, doğru kredi/süreli paket, yanlış ad ve geniş kapsam, eski Pro ürün adı ve receipt, eski personel grant/rapor erişimi, doğrudan authenticated RPC reddi; sürümlü düşürme, seçilmeyen veri korunması, boşalan slotun açık aktivasyonu ve import kotası test edilir. Mevcut yoklama/hak tüketimi/düzeltme/rollback assertionları korunur.

Son lifecycle testleri: talep sonrası eğitmen ilişkisinin iptali→dönem sonu uygulaması; boş kalan veya null eğitmen slotuna gerçek rol ataması;100 öğrencide gerçek preview/apply canonical merge; legacy Staff+Instructor birleşmesi sonrasında personel yetkisinin kapalı kalması; eski odasız/atamasız Pro seansına operasyon reddi; seçilmiş iptal edilmiş seansın tarihsel okunması.

İlk geliştirme denemelerinde yeni tek oda kuralına uymayan eski eşzamanlı/kaynaksız fixture ve saat kaydırmalarına bağlı booking uyumsuzlukları düzeltildi. Assertionlar kapatılmadı; eğitmenin normal rol ataması ayrıca SQL ilişkiyle maskelenmedi. Bağımsız incelemede bulunan scope NULL, boundary revocation ve merge-pointer sorunları için dar kaynak düzeltmeleri ve regresyon senaryoları eklendi. Başarısız ara koşular temiz kabul sayılmaz.

## Kabul sınırı

Gerçek public hostname/Turnstile sağlayıcı kabulü, main full clean ve development CD henüz yapılmış sayılmaz. Production dağıtımı yoktur. Sentetik izole testler gerçek işletme verisini değiştirmez. Aday kabulü başlatılınca repository bekleme kuralına göre kullanıcıya kaynak bağlı devir yapılır.
