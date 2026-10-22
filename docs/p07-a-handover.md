# P07-A — Draft geliştirme devri

22 Ekim son kullanıcı kararı: P07-A+B+C tek Draft PR40 içinde bağımlılık sırasıyla geliştirilir ve birlikte merge edilir. Ayrı A/B/C merge/kabul döngüleri kaldırıldı. GitHub servisleri normale dönene kadar manuel CI, rerun, aday label ve merge başlatılmaz; geliştirme commitlerinde geçici `[skip ci]` kullanılarak push kaynaklı pahalı CI ertelenir. Workflow veya kabul kapısı değiştirilmez. Yerel odaklı doğrulamalar sürer. Servisler normale dönünce önce d1830c8 main39809302120 retry ve PR39 main/CD/OPS kapanışı, ardından tamamlanmış P07 için son kaynak bağımsız inceleme, tek aday full clean, merge ve aynı main clean/CD sırasıyla yapılır. Eski/skipped CI kabul değildir; bütün22 API tamamlanmış sayılmaz: A8 kaynak hazır, B6/C8 geliştirme sırasındadır.

22 Ekim güncel durum: OPS-W01 PR39, `d1830c89e3d5e7f3c90db7ef0953cc264b35205f` ile main’e birleşti. Aday39795678387 attempt5 kabulü doğrulandı; aynı main [39809302120](https://github.com/SXQHex/FtkSaaS/actions/runs/39809302120) başarısızdır. Kullanıcının son talimatıyla bu SHA için yeniden çalıştırma **açık iş** tutulur, şimdi tetiklenmez; main/CD ve hosted worker kabulü kapanmadı. Son kabul edilmiş hosted kaynak P06 `006ad36918ae823bc10fbdefa2d48901e193121c`,54 migration/Edge7 olarak kalır. P07-A Draft PR40 geliştirmesi sürer: **200 sözleşme/186 geliştirme runtime/14 contract_only/57 migration/90 core tablo**. Sekiz A işleminin kaynağı uygulandı; gerçek Auth→Edge/aday/main kabulü bekler. B6 ve C8 aynı Draft PR40 geliştirme sırasındadır. Full clean/merge şimdi tetiklenmez; kapılar gevşetilmez.

Çalışılan önceki head `1c09ecf55dc0c4891cf5cb28f424e95473a0c921`; yeni completion kaynak farkı bu commit üzerine gelir. Draft PR40 main hedefiyle ayrı kabulden geçer.

## Erişim geri alma

- `account_access_revoke_v1`: mevcut davet ve gerçek merkez çözülür; canlı `can_invite` yetkisi receipt replay öncesi denetlenir. Sürüm ve pending/son kullanma şartıyla revoked yapılır. Kabul edilmiş bağlantıyı kaldırmaz. İptal token’ı tekrar kabul edilemez.
- `account_link_remove_v1`: org çapındaki bağlantıyı revoked yapar; eski bağlantının aktif rollerini, kişinin explicit permission override ve settlement grant’larını aynı transaction içinde kapatır. Yeni davet yeni bağlantı yaratır; eski grant’lar yeniden canlanmaz. Kişi/iletişim/finansal tarihçe ve global Auth hesabı silinmez. Eski JWT org’a bir sonraki çağrıda erişemez; diğer org bağlantıları değişmez.
- Bağlantı org çapında olduğundan seçilen merkez diğer etkilenen merkezleri gizleyemez: kişinin ilişki/rol/override/settlement kapsamlarının tamamında canlı CM gerekir. Org çapında grant varsa tüm merkezler denetlenir. Owner olmak CM yetkisi sağlamaz; owner bağlantısı devredilmeden kaldırılamaz (`OPEN_OPERATIONS_EXIST`). Önceki scope kayıtları replay yetkisi için korunur.
- Her iki komut için `management_state_get_v1` aynı yazma yetkisini doğrulayan dar sürüm/state okuması verir; davet e-posta/token’ını döndürmez. Ortak org lock, receipt, audit, in-app outbox ve hata rollback zinciri korunur.

## Profil, Auth ve kişi birleştirme

Profil org’suz kendi hesap sürümünü kilitler; isim, özel audit ve hesap içi bildirim aynı receipt transaction’ında yazılır. Auth metadata, kişi iletişimi ve tenant grant’ları profil adıyla değişmez. account_get profil adını ve son20 hesap bildirimini döndürür. Yarışta tek sürüm kazanır; geç bildirim hatası receipt dahil rollback olur.

`account_password_change_v1` kapalı DTO’yu korur: yeni parola alanı yoktur. Canlı hesap/oturum doğrulamasından sonra gerçek Supabase reauthenticate çağrısı başarılıysa `challenge_required` döner. Parolanın kendisi native Supabase `updateUser({password,nonce})` yolunda tamamlanır; başlatıcı tek başına parola değiştirmiş sayılmaz. Public recovery, imzalı ingress + password_recovery amaçlı bot kanıtı + atomik IP/hedef hash limitlerinden sonra gerçek provider recover çağrısı yapar; kullanıcı varlığı sorgulanmaz. Rate değerleri açık config ister. Hosted dış e-posta varsayılan kapalıdır; teslimat etkinliği veya SMTP kabulü iddia edilmez. Local loopback Auth kabul testi gerçek provider parola güncellemesi ve yeniden login içerir.

Merge preview tüm alias bileşeninin bağımlılıklarını ve etkilenen merkezleri snapshot/hash ile bağlar. Gerekli CM merkezleri typed merge_summary’de görünür; owner olmak CM değildir. Diğer merkez onayları canlı hesap/link/CM yetkisine ve sürümüne bağlıdır. Preview expiry/hash/sürüm veya yetki değişimi yeniden preview/onay gerektirir. Çift aktif hesap, çakışan rezervasyon/kaynak/config ve farklı kişisel limitler blocker’dır. Kaynak kişisel negatif limit canonical’a taşınır; çelişen limit sessizce düşürülmez.

Aktif operasyonel kayıtlar ve geçerli hesap grant’ları taşınır; eski finans hareketleri, borç/satış/hakediş ve başlamış/tamamlanmış görev geçmişi ID’leri korunur. Okuma ve işlem kapıları aynı org içindeki alias bileşenini çözer: eski borç katılım/rezervasyonu engeller, eski paket kapalı sınıfta kullanılabilir, eski alacak mahsup edilebilir. İletişim okumasında görünen eski alias bilgileri canonical kişi güncellemesinde de değiştirilebilir. İnaktif/eski grant yeni bağlantıyla canlanmaz.

İki yeni append-only migration toplamı57’dir; core tablo sayısı90 kalır. Profil/Auth/merge kaynakları 20261022153421 migration’ına birebir derlenir. Uygulanmış migration ve full/main clean workflow kapıları değiştirilmedi.

## Doğrulama ve açık kabul

Yerel verify102 sözleşme/yönetişim +43 CI politika kontrolünü kapsar. Auth adapter testleri provider reddi, yanlış bot amacı ve eksik hosted config’i güvenli hata olarak doğrular. Hosted transaction/ROLLBACK probe’ları SQL derlemesi, iki org izolasyonu, canlı çok merkezli onay, sürüm eskimesi, borcun değişmeden korunması, alias finans/kişi okuması, eski paket rezervasyonu, alacak mahsubu, borç kapıları, kişisel limitin taşınması ve alias iletişim silmesini gerçek dispatcher yolunda doğrular. Sentetik veri ve geçici kaynaklar transaction sonunda geri alınır.

Yeni senaryolar mevcut registry shard’ındadır; ayrı full suite eklenmez. Docker olmadığı için yeni gerçek Auth→Edge kabul senaryoları yerelde çalıştırılmış sayılmaz; CI bekler. Kaynak bağımsız incelemesi son tree’ye bağlanır. Hosted kalıcı migration/Edge dağıtımı ve full clean şimdi yapılmaz.

Açık işler: d1830c8 main39809302120 retry → aynı main clean/CD → OPS hosted işletim kabulü; ardından PR40 son kaynak full clean → merge → aynı main clean/CD. PR39 veya eski head başarısı PR40’a taşınmaz. P07-B6 abonelik ve P07-C8 gizlilik/organizasyon API’si aynı Draft PR40 içinde tamamlanır; tek son kaynak kabulü bekler.
