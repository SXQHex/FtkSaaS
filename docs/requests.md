# Backend–frontend talepleri

Bu dosya alanlar arası talep ve teslim kabulünün tek kaydıdır. Sohbet devri, uygulamanın iş listesi, test günlüğü veya ikinci ürün sözleşmesi değildir. Backend kendi geliştirmesini `apps/backend/docs`, frontend kendi geliştirmesini `apps/web/docs` altında yürütür. Ortak ürün/makine kuralları kendi sözleşmelerinde kalır.

## Talep tablosu

| Kimlik | Talep eden | Karşılayan | Talep ve sözleşme/WF/API kaynağı | Kabul ölçütü | Talep durumu | Onay ve teslim kanıtı |
|---|---|---|---|---|---|---|
| XREQ-001 | Kullanıcı; frontend kayıt akışı ihtiyacı | Backend | [WF01 kayıt](workflows.md#wf01), [typed kayıt tüketicisi](settings.md#e-posta-parola-kayıt-tüketicisi) ve [dört kabul senaryosu](#xreq-001-kayıtta-mevcut-hesap-bildirimi). | Mevcut ana adres, farklı adresli bağlı Google kimliği, doğrulanmamış kayıt ve tamamen yeni adres gerçek Auth akışında doğrulanır; mevcut kayıtta yeni hesap ve doğrulama e-postası oluşmaz. | Uygulanıyor | Kullanıcının 30 Ekim 2026 ürün kararı ve “tamamla” uygulama talebi. Backend değerlendirmesi: service-only varlık kontrolü + native Auth signup proxy; kapalı `account_exists` / `confirmation_required` sonucu. Proxy çağrıları kalıcı dispatch ile korunur; proxy dışı native yarışlar global garanti kapsamında değildir. Kaynak/test ve frontend teslim kabulü bekliyor. |
| XREQ-002 | Kullanıcı; frontend hesap güvenliği ihtiyacı | Backend | [WF01 native Auth](workflows.md#wf01): hesap içi mevcut + yeni + tekrar parola değişiminden sonra kayıtlı e-postaya otomatik güvenlik bildirimi ve “Bu işlemi ben yapmadım” kurtarma yolu. | Geçerli mevcut parola olmadan değişim olmaz; bildirim yalnız kayıtlı adrese gider; e-postadaki eylem ve süresi/geçersiz/tekrar kullanım davranışı tanımlanıp gerçek Auth/posta ile denenir. | Değerlendirmede | Kullanıcının 30 Ekim 2026 isteği. Frontend native current_password formunu uygular; backend güvenli kurtarma/oturum iptali ve bildirim şablonu değerlendirmesi bekliyor. Karşılayan adına teknik onay verilmedi. |

Alanların kendi planlarındaki bağımlılık gözlemleri otomatik olarak talep, onay veya işe başlama yetkisi sayılmaz; somut talep bu tabloya kaydedildiğinde `XREQ-001` biçiminde sabit bir kimlik alır.

## XREQ-001 kayıtta mevcut hesap bildirimi

**İstenen davranış:** Kayıtta kullanılan e-posta, ana hesap e-postası veya bağlı Google kimliği üzerinden zaten mevcutsa frontend'e açık, makinece ayırt edilebilir bir “hesap mevcut” sonucu dönülsün. Yeni hesap oluşturulmasın, doğrulama e-postası gönderilmesin. Backend teknik değerlendirmesi sonuç/hata sözleşmesini ve native Auth ile uygulanacak yolu belirler; bu talep yeni bir endpoint veya hata kodu tanımlamaz.

Frontend'in göstereceği mesaj:

> Bu e-posta adresiyle ilişkili bir hesap zaten var. Giriş yapın, Google ile devam edin veya parolanızı yenileyin.

**Kullanıcının açık ürün kararı:** Adresin kayıtlı olduğunu açıklamak bilinçli tercihtir. Hangi hesaba bağlı olduğu, ana e-posta ve rol bilgileri anonim kullanıcıya açıklanmaz. Genel yönlendirme metni o hesabın hangi giriş yöntemini kullandığını ifşa etmez. Mevcut hesabın varlığı, oturum veya e-posta sahipliği doğrulaması sayılmaz.

| Kabul senaryosu | Beklenen sonuç |
|---|---|
| Mevcut ana hesap e-postasıyla kayıt | “Hesap mevcut” sonucu; yeni hesap ve doğrulama e-postası yok. |
| Ana e-postadan farklı adres taşıyan bağlı Google kimliğiyle kayıt | Google kimliğinin e-postası da mevcut kabul edilir; aynı genel sonuç döner. Ana hesap adresi, hesap bağlantısı ve rol bilgileri açıklanmaz; yeni hesap ve doğrulama e-postası yok. |
| Daha önce oluşturulmuş, doğrulanmamış kayıtla tekrar kayıt | “Hesap mevcut” sonucu; ikinci hesap veya kayıt denemesi nedeniyle yeni doğrulama e-postası yok. Bu talep ayrı doğrulama yeniden gönderme akışını değiştirmez. |
| Tamamen yeni adresle kayıt | Mevcut native kayıt ve e-posta doğrulama akışı çalışır; yanlış “hesap mevcut” sonucu üretilmez. |

**Teslim kabulü:** Dört senaryoda yanıt, Auth hesap/kimlik durumu ve e-posta gönderim etkisi birlikte doğrulanır; yalnız HTTP 200, UI metni veya mock testi yeterli değildir. Uygulama tesliminde backend ilgili ortak sözleşmeyi ve kendi iş/devrini; frontend kendi tüketicisini ve kabulünü yetkili kapsamlarında günceller. Bu kayıt teknik kabul veya tamamlanmış uygulama kanıtı değildir.

## XREQ-002 parola değişimi güvenlik e-postası

**İstenen davranış:** Hesap içindeki form mevcut parola, yeni parola ve yeni parola tekrarından oluşur. Native Auth mevcut parolayı doğrulayıp değişimi yapar; kullanıcıdan ayrıca e-posta adresi veya e-posta kodu istenmez. Kayıtlı adrese otomatik güvenlik bildirimi gelir. Kullanıcının istediği confirm/undo için backend değişim sonrası bilgilendirme/onay ile “Bu işlemi ben yapmadım” kurtarma eyleminin kesin davranışını ve güvenlik sınırını değerlendirir. Bu talep eski parolanın saklanmasını veya geri yüklenmesini tarif etmez.

**Teslim kabulü:** Yanlış mevcut parola, eşleşmeyen yeni parolalar, başarılı değişim ve kayıtlı adrese dış teslim; ardından e-postadaki kurtarma eylemi, süresi dolmuş/tekrar kullanılmış bağlantı ve gerekli oturum iptali gerçek sağlayıcıda doğrulanır. Frontend form testi veya native bildirim ayarının açık olması bu e-posta eyleminin kabulünü kapatmaz. Yeni endpoint, token veya hata kodu frontend tarafından icat edilmez.

## Alan sahipliği ve onay

- Talep eden kendi satırındaki ihtiyacı, etkilenen WF/API kaynağını, gerekçeyi ve ölçülebilir kabul koşulunu yazar. Kapsam değişirse karşılayanın önceki onayı yeni kapsam için geçerli gösterilmez.
- Karşılayan kendi değerlendirmesini, teknik kabul/ret/erteleme gerekçesini, teslim durumunu ve kaynak kanıtını yazar. Talep eden karşı taraf adına onay veya teslim sonucu giremez; karşılayan da talep eden adına son kabulü veremez.
- `Onay ve teslim kanıtı` hücresi karar sahibini ve gerekçeyi açıkça belirtir: karşılayan teknik değerlendirmesi, gerekiyorsa kullanıcının ürün/kapsam kararı, teslim SHA/PR/test kanıtı ve talep edenin doğrulaması ayrı kaydedilir. Verilmeyen onay `bekliyor` olarak kalır.
- Talep açmak yetki vermez. Ürün/iş/makine kuralı değişikliği kullanıcı kararına ve ilgili SSoT sözleşmesinin güncellenmesine bağlıdır. Mevcut görev yetkisini aşan uygulama, dış gönderim, dağıtım veya merge kendiliğinden başlamaz. Zaten verilmiş aynı kapsam yetkisi tekrar istenmez.
- Her alan kendi planında yalnız talep kimliğine bağlantı, kendi yapacağı iş ve kendi engelini tutar. Talep metni, karşı tarafın onayı ve ortak durum ikinci bir tabloda kopyalanmaz. Bir alan diğerinin todo veya sohbet devrini düzenlemez.

## Durum geçişleri

`Taslak` → `Değerlendirmede` → `Kabul edildi`, `Ertelendi` veya `Reddedildi`. Yetkili uygulama başladıysa `Uygulanıyor`; kaynak ve teslim kanıtı hazırsa `Teslim edildi`; talep eden kendi kabul ölçütünü gerçek kanıtla doğruladıysa `Kapandı`. Kabul ölçütü sağlanmayan teslim gerekçeyle `Değerlendirmede` durumuna döner. Talep eden vazgeçerse `İptal` kullanılır; karşı taraf adına ret yazılmaz.

Onaylanmış talep bitmiş iş değildir; başarılı CI da gerçek tüketici kabulünün yerine geçmez. Koşu/kanıt yalnız ait olduğu tam kaynak için geçerlidir. Güncel satır güncellenir, zıt tarihli ikinci karar satırı eklenmez; geçmiş Git'te kalır. Kapalı talep güncel ürün kuralının kaynağı değildir; bağlı sözleşme esas alınır.
