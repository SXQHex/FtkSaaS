# PR56 — tam kabul rol okuma regresyonu düzeltmesi

Başlangıç head `a1cbbd6fc5f730cf4404b0b44af3c15f4101d671`; base `3fa72e7b805b2bbfb8895f3d90813eaa3cb416aa`; test edilen merge `17cfa6650dc970e8aee07277ca66a432ab06d97c`, tree `905a59de68b6f86e3826df704609bf95697c11cc`.

## Başarısız aday kanıtı

[Aday full clean40415840619](https://github.com/SXQHex/FtkSaaS/actions/runs/40415840619): core, API1, API2 ve API3 başarılı. API4 job121897883165,122 node/120pass/2fail/0skip/cancel: tek child `unscoped CM list excludes inactive and plan-inaccessible centers` ve bağlı parent. Test satır116'da `FORBIDDEN` bekledi, `PLAN_FEATURE_UNAVAILABLE` aldı. Toplayıcı API4 nedeniyle doğru biçimde başarısız oldu; yeşil Candidate merge gate workflow'u başarılı runtime kabulü olarak kullanılmaz. Eski run yeni kaynak kabulü değildir.

## Neden ve dar düzeltme

`roles_list_v1` makine sözleşmesinde F04+F05 gerektirir. Starter F05 kapalıdır; owner veya merkez yöneticisi olması bu lisansı açmaz. Eski test, merkez izolasyonunu doğrularken plan adını Starter yapıyor ve genel rol listesinin açık olduğunu varsayıyordu. İlk hatalı beklenti düzeltilmeden sonraki owner/CM okuma assertion'ları da bu kapıya takılacaktı.

Yalnız `tests/room-role-registry.test.mjs` değişti: mevcut merkez izolasyonu Pro altında doğrulanır; Pro tek merkezlidir ve F05 açıktır. Diğer merkezin yöneticisi için kesin FORBIDDEN, owner'ın tarihsel rolü görebilmesi ve ilk CM'nin merkez filtresi aynen korunur. Ardından Starter'a geçilip owner ve iki CM'nin her birinde kesin PLAN_FEATURE_UNAVAILABLE doğrulanır. Business planı finally ile geri yüklenir. OR'lu hata beklentisi, assertion kaldırma, timeout/retry veya CI kapısı değişikliği yoktur.

Runtime, SQL, migration, makine sözleşmesi, üretilmiş tip/katalog/envanter ve F01–F33 davranışı değişmez. SQL/migration SHA256 `da64572fe7650184694399f383eb454dd0b0bf1d5e481fc8d731c2ded62b4d85`; yeni test SHA256 `62a50abd0be3ef51219537437342e0857b70253380c13341e52fc896b5611125`.

## Doğrulama

- npm run verify:149 yapısal kontrol geçti; tip, generator, hash/migration ve mevcut CI politikası kontrolleri korundu.
- Bağımsız salt-okuma `/root/starter_review`: son test hash'i üzerinde bloklayıcı bulgu yok; eski scope assertion'larının korunduğu ve Starter retlerinin eklendiği doğrulandı. Native/CI kabulü değildir.
- İzole native temiz66 reset ve gerçek Auth→Edge→RPC oda/rol suite'i12/12pass,0fail/skip/cancel,95850.192501ms; shell exit0. Önceki başarısız child, Pro scope ve üç Starter actor ret assertion'ı dahil geçti. SQL/test hashleri yerel kaynakla aynı.
- Sandbox `sbx_8E0giEt27ZaY9ZJ5vvcQ2eXonM75`, command `cmd_43bc41d7f90943b0ad13bd6f0be2`; kanıt alınınca sandbox durduruldu. Ham log SHA256 `a21c8867c8f22b3dc58c7899c59f62b3921617e5cc9cbd48b195be4bf5140ea1`; yerel kopya `/tmp/pr56-role-fix-accepted.log`.
- Belge/link denetimi57 dosya/399 yerel bağlantı geçti. Native dar kabul, yeni aday/main full clean'in yerine sayılmaz.

Yeni aday full clean/main/merge/development CD henüz yoktur. Production veya frontend değişikliği yapılmadı. Tarihsel raporlar değiştirilmedi.
