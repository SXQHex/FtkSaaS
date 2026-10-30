# Backend–frontend talepleri

Bu dosya alanlar arası talep ve teslim kabulünün tek kaydıdır. Sohbet devri, uygulamanın iş listesi, test günlüğü veya ikinci ürün sözleşmesi değildir. Backend kendi geliştirmesini `apps/backend/docs`, frontend kendi geliştirmesini `apps/web/docs` altında yürütür. Ortak ürün/makine kuralları kendi sözleşmelerinde kalır.

## Talep tablosu

| Kimlik | Talep eden | Karşılayan | Talep ve sözleşme/WF/API kaynağı | Kabul ölçütü | Talep durumu | Onay ve teslim kanıtı |
|---|---|---|---|---|---|---|

Başlangıçta kayıt yoktur. Alanların kendi planlarındaki bağımlılık gözlemleri otomatik olarak talep, onay veya işe başlama yetkisi sayılmaz; somut talep bu tabloya kaydedildiğinde `XREQ-001` biçiminde sabit bir kimlik alır.

## Alan sahipliği ve onay

- Talep eden kendi satırındaki ihtiyacı, etkilenen WF/API kaynağını, gerekçeyi ve ölçülebilir kabul koşulunu yazar. Kapsam değişirse karşılayanın önceki onayı yeni kapsam için geçerli gösterilmez.
- Karşılayan kendi değerlendirmesini, teknik kabul/ret/erteleme gerekçesini, teslim durumunu ve kaynak kanıtını yazar. Talep eden karşı taraf adına onay veya teslim sonucu giremez; karşılayan da talep eden adına son kabulü veremez.
- `Onay ve teslim kanıtı` hücresi karar sahibini ve gerekçeyi açıkça belirtir: karşılayan teknik değerlendirmesi, gerekiyorsa kullanıcının ürün/kapsam kararı, teslim SHA/PR/test kanıtı ve talep edenin doğrulaması ayrı kaydedilir. Verilmeyen onay `bekliyor` olarak kalır.
- Talep açmak yetki vermez. Ürün/iş/makine kuralı değişikliği kullanıcı kararına ve ilgili SSoT sözleşmesinin güncellenmesine bağlıdır. Mevcut görev yetkisini aşan uygulama, dış gönderim, dağıtım veya merge kendiliğinden başlamaz. Zaten verilmiş aynı kapsam yetkisi tekrar istenmez.
- Her alan kendi planında yalnız talep kimliğine bağlantı, kendi yapacağı iş ve kendi engelini tutar. Talep metni, karşı tarafın onayı ve ortak durum ikinci bir tabloda kopyalanmaz. Bir alan diğerinin todo veya sohbet devrini düzenlemez.

## Durum geçişleri

`Taslak` → `Değerlendirmede` → `Kabul edildi`, `Ertelendi` veya `Reddedildi`. Yetkili uygulama başladıysa `Uygulanıyor`; kaynak ve teslim kanıtı hazırsa `Teslim edildi`; talep eden kendi kabul ölçütünü gerçek kanıtla doğruladıysa `Kapandı`. Kabul ölçütü sağlanmayan teslim gerekçeyle `Değerlendirmede` durumuna döner. Talep eden vazgeçerse `İptal` kullanılır; karşı taraf adına ret yazılmaz.

Onaylanmış talep bitmiş iş değildir; başarılı CI da gerçek tüketici kabulünün yerine geçmez. Koşu/kanıt yalnız ait olduğu tam kaynak için geçerlidir. Güncel satır güncellenir, zıt tarihli ikinci karar satırı eklenmez; geçmiş Git'te kalır. Kapalı talep güncel ürün kuralının kaynağı değildir; bağlı sözleşme esas alınır.
