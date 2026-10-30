# Frontend sohbet devri

Aktif bölüm, kapsam ve kabulün tek sahibi [todo.md](todo.md) dosyasıdır. Bu dosya yalnız devam için gerekli çalışma bağlamını taşır.

## Çalışma bağlamı

PR92 ve kayıt geri bildirimi PR95 main'e birleşti. Devam dalı `fix/web-main-deploy`, tabanı main `4ac4b8d0573963c1763e46b9e5a523d8f85ac030`; S02 ayrı Draft PR93'te korunur. Önce kök/yerel AGENTS, [geliştirme rehberi](development.md), [todo](todo.md) ve ilgili WF01/native Auth sözleşmesi okunur.

Kullanıcı Chrome eklentisiyle `uye.fethiyetango.com` üzerinde gerçek kabul istedi. Bu adres için dağıtım ve PR92/PR95 merge yetkisi verdi. Main dağıtımını engelleyen kök vercel.json kuralının kaldırılmasını ayrıca açıkça onayladı; bu dosya silinir. Normal dağıtım yolu main merge sonrası Vercel'dir; tekrar doğrudan dağıtım gereksinimi varsayılmaz. Mevcut test kutusu kullanıcının Chrome'unda açıktır; bağlı Gmail connector hesabı farklıdır. E-posta için yalnız ilgili test mesajları aranır. Sağlayıcı araçları ayar/log incelemesi için tercih edilir.

Devam konusu kayıt sonrası yanlış e-posta izlenimi ve adres düzeltme: UI gönderilen adresi gösterir, yeni/var olan hesabı ifşa etmez, kesin teslim iddiası yapmaz; yeni parola saklanmaz. Detaylı teşhis/kanıt ve açık kabul yalnız todo sahibindedir. Parola/token/gerçek kullanıcı bilgileri kaynak, fixture veya rapora eklenmez. Yeni parola girme ve gönderme kullanıcı adımıdır. Yeni CI başlayınca run/head/base bilgisi kullanıcıya bırakılır; AGENTS bekleme kuralı uygulanır.
