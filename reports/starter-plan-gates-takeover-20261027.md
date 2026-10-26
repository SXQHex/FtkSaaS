# Starter plan kapıları — 27 Ekim devralma kabul kaydı

Başlangıç main: `3fa72e7b805b2bbfb8895f3d90813eaa3cb416aa`. Yerel mevcut `feat/starter-plan-gates` dalı ve kaydedilmemiş değişiklikler devralındı; mükerrer uygulama dalı açılmadı. Aynı SHA main run40386335578 kaynak/belge başarılı, runtime clean skipped. Eski başarı yeni66 migration kabulü değildir.

## Kaynak ve inceleme

- SQL ve yeni66 migration SHA256: `da64572fe7650184694399f383eb454dd0b0bf1d5e481fc8d731c2ded62b4d85`.
- Starter kabul testi SHA256: `ce19a2fd392da349e22630f6f6247e0611710f0eb451d16b7f6abc01e0e007ea`.
- Makine sözleşmesi SHA256: `486f1b0603e6fb9014f2edbc05b2f941b5bb756614b7b8237592629a79efab85`.
- Bağımsız salt-okuma incelemesi `/root/starter_review`: atomik limit, canlı permission/receipt, sürümlü downgrade/worker, canonical merge, public/nested reference ve DTO/test kapsamlarında bloklayıcı bulgu yok. Test çalıştırmadı; CI/hosted kabulü değildir.

## Devralınan koşu ve dar düzeltme

Önceki native koşu51 node/49pass/2fail,559750.21694ms ile bitmişti; başarısız child ve parent aynı fixture kaynaklıydı. `publications` satırı session/event hedefi olmadan oluşturulduğu için mevcut `p04_publication_target` CHECK'i reddediyordu. Fixture seçilmeyen eski Pro seansına bağlandı; CHECK ve PLAN_FEATURE_UNAVAILABLE assertion'ı korundu. Önceki koşunun SQL hash'i `ac0b6130c0c21937bde229514db14895595d640ebc05f719d0a21f8bad5f3e2d`; son yerel SQL `da64572…` olduğundan önceki49 başarı son kaynak kabulü diye taşınmaz.

## Son kaynak doğrulaması

- `npm run verify`:103 sözleşme/yönetişim +46 CI politikası testi;149pass/0fail. TypeScript, migration/hash, generator/validator/catalog ve audit kontrolleri geçti.
- Mevcut izole native Sandbox `sbx_Milny8oFnCaxfG5fChwrbdomA1NT` üzerinde temiz66 migration reset ve gerçek Auth→Edge→RPC Starter suite:9/9pass,0fail/skip/cancel,112925.32375ms, shell exit0. SQL ve test hash'leri yukarıdaki kaynakla eşleşti. Ham test `/tmp/starter-takeover-tests.log`, reset `/tmp/starter-takeover-reset.log`; command `cmd_042db37ed99d413b95b0d2234d97`.
- Ham9/9 kabul logu SHA256: `8d2c7017e44768183cd7e9a8cf6901fad32cf04c0d236c428564fbaad1227178`; yerel koruma `/tmp/starter-takeover-accepted-native.log`.
- Belge/link denetimi57 dosya/396 yerel bağlantı geçti.
- Son kaynak ilk yoklama/abonelik tekrarı20 node/15pass/5fail,250403.545853ms,exit1: dört child ve parent. Fiziksel booking'i fixture tarafından pasife alınmış fakat kapanmamış assigned-student rezervasyonu politika koruma güncellemesini reddetti; sonraki policy/block testlerine hata taşındı. Bu başarısız koşu kabul değildir.
- Son fixture çözümü: geçmişe taşınan her seans ayrı önceki güne, yine09:00 UTC'ye yerleştirilir; session ve booking aralığı birlikte güncellenir. Başka seansların booking kayıtları pasife alınmaz. Açık rezervasyonlar sonraki politika etki testlerinde korunur; ilave yapay kapanış eklenmez. Ürün guard'ı ve mevcut assertion'lar korunur. Bağımsız ek incelemede bloklayıcı bulgu yok; son test SHA256 `68bf40d49194ffb37c37f7910e7e830564ba7e42d691707c5f8ee9d4624d0792`.
- Advisors exit0; tek WARN mevcut `private.ops_run` mutable search_path belgeli istisnasıdır, yeni hata yok.
- Önceki session snapshot ile korundu. Tekil kapanış denemesiyle başlayan birleşik tekrar tamamlanmadan bilinçli durduruldu; temiz kabul değildir. Son8dk nonpersistent ortam `sbx_19YTlUOwXIjEIVMk5myrqvMMBK9f` üzerinde temiz66 reset sonrası mevcut yoklama/koruma+abonelik regresyonu sürüyor; sonucu henüz kabul edilmedi. Starter9/9 yukarıdaki aynı değişmemiş SQL/test kaynağına aittir.

Aday/main full clean, merge ve development CD henüz yoktur. Frontend veya production değişikliği yapılmadı; Pro/Business ayrı limit/özel teklif ve gerçek public hostname/Turnstile kabulü kapsam dışıdır.
