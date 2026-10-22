# P07-A — Draft geliştirme devri

22 Ekim kullanıcı talimatı: PR39 korunur; yeni kod Draft PR40 altında push edilir. Otomatik hedefli CI açılırsa kullanıcı iptal edebilir. Full clean veya merge şimdi başlatılmaz. Dal `feature/p07-a-account-person`, tabanı PR39 `545d5c854e8b953814539397d82c4721b74ec898`; PR hedefi `feature/ops-w01-hosted-workers` olduğundan fark yalnız P07 kodunu gösterir. Kaynak geliştirmesi, CI kabulü ve hosted dağıtım ayrı durumlardır.

## İlk kod dilimi

- `account_access_revoke_v1`: mevcut davet ve gerçek merkez çözülür; canlı `can_invite` yetkisi receipt replay öncesi denetlenir. Sürüm ve pending/son kullanma şartıyla revoked yapılır. Kabul edilmiş bağlantıyı kaldırmaz. İptal token’ı tekrar kabul edilemez.
- `account_link_remove_v1`: org çapındaki bağlantıyı revoked yapar; eski bağlantının aktif rollerini, kişinin explicit permission override ve settlement grant’larını aynı transaction içinde kapatır. Yeni davet yeni bağlantı yaratır; eski grant’lar yeniden canlanmaz. Kişi/iletişim/finansal tarihçe ve global Auth hesabı silinmez. Eski JWT org’a bir sonraki çağrıda erişemez; diğer org bağlantıları değişmez.
- Bağlantı org çapında olduğundan seçilen merkez diğer etkilenen merkezleri gizleyemez: kişinin ilişki/rol/override/settlement kapsamlarının tamamında canlı CM gerekir. Org çapında grant varsa tüm merkezler denetlenir. Owner olmak CM yetkisi sağlamaz; owner bağlantısı devredilmeden kaldırılamaz (`OPEN_OPERATIONS_EXIST`). Önceki scope kayıtları replay yetkisi için korunur.
- Her iki komut için `management_state_get_v1` aynı yazma yetkisini doğrulayan dar sürüm/state okuması verir; davet e-posta/token’ını döndürmez. Ortak org lock, receipt, audit, in-app outbox ve hata rollback zinciri korunur.

Envanter:200 sözleşme/180 geliştirme runtime/20 contract_only,56 migration/90 core tablo. Yeni migration CLI ile oluşturulmuş append-only `20261022151954_p07_account_revocation.sql` ve iki source modülünün birebir birleşimidir. Eski migration ve CI kapıları değiştirilmedi.

## Açık P07 işleri

P07-A tamamlanmadı: profil güncelleme, parola değiştirme, parola kurtarma ve person merge preview/approve/apply (6 API) contract_only kalır. Profil org’suz audit/notification yolunu gerektirir. Parola değişim DTO’sunda yeni parola/reauth girişi yoktur; sağlayıcı devri gerçek uçtan uca davranışla ele alınmalıdır. Parola kurtarma public rate/bot gate ve dış e-posta erteleme kararıyla uyumlu olmalıdır; başarı/delivery taklidi yapılamaz. Kişi birleştirme bütün etkilenen merkezlerin onayını, alias çözümlemesini ve geçmiş finansal kayıtları koruyan tüketicileri gerektirir. Abonelik B (6 API), gizlilik/organizasyon C (8 API) queued kalır.

## Doğrulama ve sonraki kabul

Yeni kabul senaryoları mevcut registry shard’ına eklenir; ayrı full suite veya tekrar clean eklenmez. Gerçek Auth→Edge testleri sürüm/yetki/replay, başka merkez/tenant reddi, iptal token’ı, çok merkezli kaldırma, owner engeli, geç audit hatasında atomik rollback, eski JWT reddi ve yeni bağlantıda grant’ın canlanmamasını kapsar. Yerel `npm run verify` (100 sözleşme/yönetişim +43 CI politika kontrolü) geçti. SQL derleme/ACL probe’u ve iki sentetik org ile hedefli davet/link/sürüm/grant/ilgisiz org bütünlüğü denemesi geçti; transaction sonunda ROLLBACK yapıldı. Bağımsız incelemenin bulduğu geçersiz link state ve PL/pgSQL değişken/kolon çakışması düzeltildi; testler exact revoked state ve ilgisiz aynı/başka org satırlarını koruma assertion’ları taşır. Mevcut “sahte canlı read” mutation testi, artık gerçek runtime olan davet iptali yerine hâlâ contract_only profil işlemini bozmaya devam eder; aynı assertion korunur. Docker bulunmadığı için gerçek Auth→Edge kabulü yerelde çalıştırılmış sayılmaz. Hosted kalıcı migration/Edge dağıtımı yapılmaz.

GitHub toparlandığında **önce PR39** son kaynak full clean→merge→aynı main clean/CD ve hosted işletim kabulü. Ardından **PR40** güncel main’e uyarlanır/hedefi main yapılır, kalan kapsam tamamlanır; son kaynak bağımsız inceleme ve kendi full clean→merge→aynı main clean/CD zinciri uygulanır. PR39 CI sonucu PR40’a taşınmaz. Full/main clean şartları ve kaynak bağlı merge kapısı aynen korunur.
