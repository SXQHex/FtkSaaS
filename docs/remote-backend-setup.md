# Kalıcı geliştirme/test backend’i

## 26 Ekim — SMS dış entegrasyon kararı (son kullanıcı kabulü)

Telefon numarası kaydedilebilir; gerçek SMS proof tamamlanmadıkça doğrulanmamış kalır. Numaranın kaydedilmesi, doğrulanmış iletişim yayılımı, hesap sahipliği kanıtı veya telefonla giriş yetkisi değildir. Ücretsiz geliştirme testlerinde yalnız izole yerel test OTP kodları kullanılabilir; bunlar gerçek SMS gönderimi/teslimi veya hosted provider kabulü sayılmaz. Sabit test kodları hosted ortama uygulanmaz.

E-posta/parola, gerçek Google giriş/bağlama ve doğrulayıcı uygulama TOTP ile ilerlenir. Gerçek SMS sağlayıcısı kurulumu ayrı dış entegrasyon statüsündedir; birinci satırın diğer backend işlerini ve backend kapanışını engellemez. SMS'in gerçek sağlayıcı kabulü tamamlandı işaretlenmez. Doğrulanmamış telefon kaydetme/okuma yolu ile yerel proof/test-code davranışının uygulama kabulü backend kapsamındadır; bu karar tek başına yeni alan/API'nin uygulanmış olduğu kanıtı değildir.


## 23 Ekim güncel geliştirme kaynağı ve hosted kontrol

Geliştirme/test proje `gwyprhenabtpkbojephw`; gerçek ilk kurulum verisi içerir. Reset/clean/seed yalnız izole loopback ortamında yapılır. Son runtime kabulü main4cfc9a55/PR40:59 migration içeriği eşleşti,200 runtime,90 core tablo,Edge backend-v1 v8 ACTIVE/verify_jwt=true. [CD39869023193](https://github.com/SXQHex/FtkSaaS/actions/runs/39869023193) 18 kontrol ve fixture temizliği geçti; receipt/source bağları [tek devirdedir](../contracts/00-FtkSaaS-yeni-sohbet-devir.md).

Son belge mainbfb8ccb2/PR41 source-bound belge kabulünden geçti; CD39873101014 deploy skipped. Bu, yeni Edge veya runtime full-clean icrası değildir. Eski migration22 ve Edge4/5/6/7 snapshotlarını güncel ortam ölçümü diye kullanma.

23 Ekim05:04 Türkiye salt-okuma: beş Cron5sn active, beş dedicated LOGIN enabled/idle; failed0/claimed0. p07 scope1 (mevcut org), privacy scope2 (aynı org+global null). Kullanıcının seçtiği quote3600sn ve reauth900sn kuruldu. Bunlar ilk kurulum config'idir; yeni platform ayar API'si veya bütün tenantlar için varsayılan ilanı değildir. Temel kurulum/heartbeat kapandı; yeni P07 hatlarının gerçek iş yükü/hosted kesinti ve fiziksel imha kabulü ayrıca açık.

Son advisor incelemesindeki ops_run search_path ve rls_auto_enable EXECUTE sertleştirmeleri henüz yayımlanmadı. Parola koruması uyarısı Free plan nedeniyle kullanıcı tarafından kapsam dışında bırakıldı. Uygulama RPC EXECUTE0 ölçümü, public yardımcı event-trigger fonksiyonu uyarısını kapsıyor gibi sunulmaz.

İstemci bağlantı ve sınırları [Claude talimatındadır](claude-handover.md). Secret değerler bu belgeye yazılmaz. PAT30-gün rotasyonu ayrı işletim sorumluluğudur; otomatik yenileme varsayılmaz. Production, frontend E2E, yük/restore ve fiziksel erasure tamamlanmış değildir. 26 Ekim platform Auth SMTP kurulumu ve Resend delivered kanıtı [aktif teslimde](production-queue.md#teslim1-kimlik-iletisim) kayıtlıdır; tüm dış e-posta yaşam döngüsü kabulü değildir.

## Önceki dağıtım kaynaklarının tarihsel kayıtları

Aşağıdaki source/CI/envanter/kurulum sayıları kendi teslim tarihine aittir; yukarıdaki güncel durumun yerine kullanılmaz. İlk kurulum adımları boş DB varsayar; mevcut gerçek ortamda körlemesine uygulanmaz.


P06 **done (kod, main ve geliştirme/test kabulü)**: [PR38](https://github.com/SXQHex/FtkSaaS/pull/38), main `006ad36918ae823bc10fbdefa2d48901e193121c`;200 sözleşme/178 runtime/22 contract_only,54 migration/90 core tablo. Son headf2f9d6c/base8364144/tested merge1901fc6/treeb486ffe; bağımsız review5614150102, [aday39779013518](https://github.com/SXQHex/FtkSaaS/actions/runs/39779013518), [aynı main39782197422](https://github.com/SXQHex/FtkSaaS/actions/runs/39782197422) ve [CD39785146645 attempt1](https://github.com/SXQHex/FtkSaaS/actions/runs/39785146645) success. CD18 kontrol/54 içerik eşleşmesi/Edge7 ACTIVE/verify_jwt=true/RLS kapalı0/client RPC EXECUTE0 ve fixture temizliği geçti; receipt12428881259 SHA256 `bcd1ab3255c1808982de76c3d09d47d5eaa95c5fb2e8f9f870d3fedc9ce93b65`. Önceki aday hataları tarihsel kanıttır. Aktif OPS-W01 adayı Supabase Cron içindir;55 migration/aynı178 runtime, kaynak ve hosted işletim kabulü beklenir. Tenant config/binding uydurulmaz; P07 queued kalır.

[OPS-W01 native kurulum/sağlık devri](ops-w01-handover.md) yeni işletim adayını açıklar; henüz aktif worker kurulmuş sayılmaz.

## PR37 — güncel kabul edilmiş geliştirme kaynağı

P05 **done (kod, main ve geliştirme/test kabulü)**: [PR37](https://github.com/SXQHex/FtkSaaS/pull/37), kabul edilmiş main `83641447b29e459236aea1a9a4379b5d19825af6`;200 sözleşme/165 runtime/35 contract_only,53 migration/90 core tablo. Son head15e2126/base16cb570/tested merge2ebe087/tree736a75b; bağımsız son kaynak incelemesi5611074233, [aday39745672815](https://github.com/SXQHex/FtkSaaS/actions/runs/39745672815) ve [aynı main39748053581](https://github.com/SXQHex/FtkSaaS/actions/runs/39748053581) completed/success. [CD39750264949 attempt1](https://github.com/SXQHex/FtkSaaS/actions/runs/39750264949) success:18 kontrol,53/53 içerik eşleşmesi, P05 migration uygulandı, Edge6 ACTIVE/verify_jwt=true, RLS kapalı0/client RPC EXECUTE0 ve sentetik fixture temizliği. Receipt artifact12412499512 SHA256 `a41a8448c0a1b9dfdf853b58bea7cd56525fd8ede14812684b12619c3c8ee04e`. Eski aday hata kayıtları tarihsel kanıttır; bu kabulün kaynağı değildir.

CD receipt'teki pending_migrations alanı uygulama öncesi farktır:20261021181208_p05_documents_notifications.sql uygulandı. Son SQL history okuması53 migration/P05 mevcut;0 organizasyon,0 hesap,0 Auth kullanıcısı. Doküman bucket private,2097152 byte/text/plain+application/pdf. Edge source SHA256 b3a953555393c88471755ea187043613d55af23ecd117de44fc7ec3f41da29f6; deploy EZBR5dc25091617607c0ecbff5b3999178fad5dc4e166cd6fbb238089400ff71a53f metadata ile eşleşir. Aşağıdaki PR36/52/Edge5 ve eski pending kayıtları tarihsel snapshot'tır.

## PR36 — kabul edilmiş güncel geliştirme kaynağı

Main `16cb570eb45381ce41a509a7d2d954f929de9e6b`; aynı main39644044693 ve CD39646391222 attempt1 completed/success. Receipt artifact12368500165 SHA256 `97fdfe9e877f2aa0b67dc88e5a7fc1c126041d776791629ced28807b9c10f27c`:18 kontrol passed, transport management-api-atomic-v1, pending[],52 içerik eşleşmesi; Edge5 değişmeden ACTIVE/verify_jwt=true, RLS kapalı0/client RPC EXECUTE0 ve sentetik temizliği. Bu bölüm aşağıdaki PR36 pending ifadelerinin yerine geçer. P05 SQL denemeleri rollback içindedir; uzak P05 migration/Edge kalıcı kurulmadı. [P05 devri](p05-handover.md) kabul sınırını açıklar.

## P04 güncel kabulü ve migration transport takibi

Kabul edilmiş main `7b96d8866abb2c056d1b59a96afee0696a1187d6`; [aynı main39633243405](https://github.com/SXQHex/FtkSaaS/actions/runs/39633243405) ve [CD39635569033 attempt2](https://github.com/SXQHex/FtkSaaS/actions/runs/39635569033/attempts/2) successful. Receipt artifact12362171004, digest `b2063f2744f3c0b8d5c31be6ddb8f595aade684e9abf9284c54c73e8c3be23c0`; source=expected_main7b96d88, acceptance39633243405/attempt1,17 kontrol passed.52/52 migration içeriği tam eşleşiyor,151 runtime,90 core tablo/RLS, client RPC EXECUTE0, Edge5 ACTIVE/verify_jwt=true; Edge kaynak SHA256 `709540edcb17f17ac660d3125bce3014ae90ec110d7f8e042bfc5599f45c8051`, EZBR `10f3a3e1959cba9fe9030d3bd2b72717d23310097c002626c53740409626ad55`. Gerçek Auth→Edge→RPC/ret/cleanup başarılı; son0 organizasyon/hesap/Auth kullanıcısı.

İlk CD aynı kaynağın üç eksik migration'ını CLI db push yolunda uygulayamadan durdu. SQL/credential içerebilecek stderr yayımlanmadığından parola, ağ veya scope kaynaklı kesin neden kanıtlanamadı. Onaylı52 migration kaynağı MCP ile gerçekten uygulandı, her tam SQL hash'i doğrulandıktan sonra orijinal sürüm adları eşitlendi; ardından yalnız başarısız CD işleri yeniden denendi. İkinci denemede pending=[] olduğundan CLI'nin pending yolu doğrulanmış sayılmaz.

Bu takip dalı doğrudan DB CLI bağımlılığını kaldırır: aynı proje-scoped PAT ile çalışan Management API `/database/query` üzerinden tek DO transaction'ı kullanır. History satırları lock altında preflight snapshot'ıyla (version/name/sıralı statement SHA256) karşılaştırılır; eksik dosyalar sırayla çalışır, orijinal tam byte'lar aynı transaction'da history'ye yazılır. Tüm üst düzey BEGIN/COMMIT zarfları lexical taramayla çalıştırmadan çıkarılır; iç içe yorum, quoted identifier, E-string ve dollar-quoted fonksiyon gövdeleri korunur. Çok zarflı P04 modül+wrapper dosyası desteklenir; frozen dosya ve history kaydı değişmez. Geç hata bütün batch'i geri alır; sapmış/eşzamanlı history durdurur. Yanıt kaybında yeni çalışmanın history/readback'i neyin commit edildiğini belirler; otomatik kör retry/history repair yapılmaz. Desteklenmeyen transaction dışı SQL fail-closed kalır.

Her CD'de aynı executor üzerinden sentetik temp tablo/history yazımı, exact readback ve geç hata rollback'i iki subtransaction'da sınanır. Her iki deneme ve history tamamen geri alınır; yeni migration yokken de pending transport yolu doğrulanır. Gerçek geliştirme DB'sinde bu probe çalıştı;52 migration ve0 tenant/kullanıcı korunuyor. Bu geçici kanıt yeni workflow'un kurulmuş/CI kabul edilmiş olduğu anlamına gelmez; aday/main/CD ve exact-source trusted kurulum onayı bekler. DB parolası yeni transport'ta kullanılmaz; Edge CLI `--use-api` korunur. Eski CLI'nin kesin alt nedeni çözüldü diye raporlanmaz; arızalı bağlantı bağımlılığı kaldırılır.

Bot/gateway ve gerçek deneme config'i kullanıcı kararıyla hedef oluşana kadar ertelendi; [P04 kurulum yordamı](p04-handover.md) geçerlidir. Aşağıdaki CD-01/49 migration/Edge4 kayıtları tarihsel kabul snapshot'ıdır.

## CD-01 — ilk canlı kabul tamamlandı, 21 Ekim 2026

Kaynak **`0fabf3a4a605dd6be5a1d358c660021f59406e20`**. [Aynı main39588975421](https://github.com/SXQHex/FtkSaaS/actions/runs/39588975421) core/dört API shard/toplayıcı success; [CD39590690817 attempt2](https://github.com/SXQHex/FtkSaaS/actions/runs/39590690817/attempts/2) source/deploy success. Artifact `development-delivery-39590690817-2` /12341449247, receipt source=expected_main=0fabf3a, acceptance_run_id39588975421/attempt1;17 kontrolün tamamı passed ve success=true. Hosted smoke full clean’in tekrarı değildir.

49 migration’ın tamamı içerik olarak eşleşti; pending_migrations=[] ve yeni SQL uygulanmadı. Edge backend-v1 v4 ACTIVE, verify_jwt=true. İlk CD’de önceki başarılı receipt bulunmadığı için aynı kaynak bundle yeniden deploy edildi. Gönderilen index.ts SHA256 `8fc08b06592abcb530f81fcf96e879f75f1ab1f8017fb93f2fb61db213fea329`; deploy EZBR SHA256 `27d8927946cf7905423ad24c65fe1d245a10efc85775f010eac5808ac78e9df4`. Canlı metadata aynı sürüm/hash/JWT durumunu ayrıca doğruladı; indirilen kaynak bundle eşitliği iddia edilmez.

Kontroller: checkout kabul SHA’sı, tam migration manifesti ve uzak içerik eşleşmesi; aktif Edge/JWT;90 core tabloda RLS kapalı0 ve api_v1 anon/authenticated EXECUTE0; sentetik kullanıcı oluşturma, gerçek Auth parola girişi, Edge→RPC account_get/organizations_list, finance tenant sınırı, doğrudan RPC403/42501, invalid JWT401, logout, eski oturum reddi ve geçici fixture temizliği; security/performance advisors ERROR0. Son bağımsız SQL kontrolünde0 hesap,0 Auth kullanıcısı,0 organizasyon. Advisors: security INFO108/WARN2; performance INFO319; uyarılar kapatılmış sayılmaz. Envanter199 sözleşme/140 runtime/59 contract_only ve49 migration değişmedi.

## Kurulum ve düzeltme geçmişi

PR32 head4e1e25c5/treeffa1c79f, review5597902305 ve aday39580259901 sonrası açık kaynak bazlı kullanıcı onayıyla normal merge3e2fcd7 olarak kuruldu. İlk main39582760620 API3’te future-effective Starter testinin3 saniyelik kurulum yarışı ve sonraki teste sızan upper0 nedeniyle başarısız; CD39584677756 skipped, hosted yazma yoktu. PR33 test-only düzeltmesi API yayınlama/rezervasyon ve bütün kabul sonuçlarını korudu; yalnız tam org/policy ID’sindeki fixture etkinleşme anı kontrollü ilerletildi. SQL timestamp sırası, değişmeyen booking_obligation, explicit protection üretilmemesi, mevcut rezervasyonun korunması ve yeni rezervasyon reddi doğrulandı; üst limit finally ile geri yüklenir. Review5598374267 + hedefli39585487735 + aday39587119715 sonrası main0fabf3a; aynı main39588975421 success. Runtime, migration ve CI kapıları değişmedi.

CD39590690817 attempt1, SUPABASE_NATIVE_DEPLOY_DISABLED değeri TRUE olduğu için yapılandırma aşamasında, yazmadan önce durdu. Kullanıcı true düzeltti; yalnız başarısız CD işleri yeniden çalıştırıldı. Attempt2 canlı kabulü geçti. Önceki başarısız run/attempt’ler tarihsel kayıt olarak korunur.

## Dağıtım işletimi ve sınırlar

Kullanıcının açık hedefi `gwyprhenabtpkbojephw` FtkSaaS projesinin Supabase **production branch** ortamını doğrudan geliştirme/test için kullanmaktır. Ayrı preview projesi açılmaz; gerçek müşteri production kabulü veya yedek/restore kanıtı anlamına gelmez. Kaynak SQL/Edge yeniden kurulabilir; platform ayarlarının, gizli anahtarların ve çalışma verilerinin Git tarafından otomatik geri getirildiği varsayılmaz.

[Workflow](../.github/workflows/cd-development.yml), Main clean acceptance tamamlanınca exact repository/path/event/push/main/run-attempt ve bütün zorunlu job/step başarısını doğrular. Yeni runtime eski kabulü geçersiz kılar. Araya yalnız güvenli belge merge’i girerse ancestry ve tam ağaç belge farkı kanıtıyla full kabulü geçmiş runtime dağıtılabilir; source SHA ve expected_main ayrı kaydedilir. Belge main’i tek başına full runtime kabulü olmaz; henüz dağıtılmamış backend için önceki başarılı full runtime kanıtını çözer. Zaten başarılı CD receipt’iyle dağıtılmış aynı kaynak belge olayında atlanır. İlk closure belge merge’inin bu skip davranışı ayrıca gözlenecek; henüz gerçekleşmiş diye raporlanmaz.

Otomatik tarama son100 başarılı main kabulüyle sınırlıdır; eski full kabul için açık run ID ile workflow_dispatch retry vardır. Sabit proje concurrency grubu çalışan dağıtımı iptal etmez. Migration, Edge ve fixture yazmaları öncesinde aynı run/attempt/işler, canlı main ve varsa belge eşdeğerliği yeniden doğrulanır. Main değişirken tamamlanmış migration’lar geri alınmaz; yeni kabul edilmiş kaynak ilerletir.

Migration manifest hash’leri ve uzak SQL içerikleri kontrol edilir; bilinmeyen/sapmış/tekrarlı sürümde durulur. CD-01 tarihsel transport'unda yalnız eksikler sabit sürümlü CLI db push --include-all --skip-vault --yes ile uygulanırdı; seed/reset/roles/config push veya otomatik history repair yoktur. CLI SQL parçalarının kaynakta birebir metni/sırası korunur; yalnız aradaki yorum/ayraçlar dikkate alınmaz. String/fonksiyon gövdeleri normalize edilmez; uygulama sonrası bütün içerik yeniden okunur.

Edge yalnız dependency-complete index.ts ve geçici hosted config verify_jwt=true ile yayımlanır; yerel config değişmez. Önceki başarılı receipt’teki kaynak hash’i ve canlı Edge sürümü/ACTIVE/JWT aynıysa deploy atlanır. İlk CD/receipt kaybında yeniden deploy yapılır. Smoke sentetik email_confirm=true kullanıcıyla dış e-posta göndermeden çalışır; hata halinde de yalnız aynı auth UUID’ye bağlı hesap/kullanıcı temizlenir. Core RLS/RPC EXECUTE ve advisors ERROR kontrolleri zorunludur. Worker zamanlayıcısı, frontend, dış e-posta ve yük/restore açık kalır.

## Kimlik bilgileri ve rotasyon

GitHub Actions secrets: SUPABASE_ACCESS_TOKEN ve SUPABASE_DB_PASSWORD. İlk canlı CD bu değerlerin workflow tarafından kullanılabildiğini doğruladı; değerler kaynak/rapora yazılmaz. Scoped PAT yalnız FtkSaaS projesine30 gün: Project Settings/Advisors/Connection Pooling/API Keys/API Key Secrets=Read; Database/Edge Functions=Read-write; diğerleri None. Bu scope/expiry seçimi kullanıcı bildirimidir; connector ayarları bağımsız okuyamaz. Süre dolmadan yeni scoped PAT oluşturulup aynı secret güncellenir; otomatik yenileme kurulmaz.

Actions variable **SUPABASE_NATIVE_DEPLOY_DISABLED=true**, küçük harfle, tırnaksız. Native GitHub Deploy to production kapalı bilgisi kullanıcı bildirimine dayanır; variable kontrolü canlı CD’de geçti, native ayarı connector okuyamaz. İki farklı dağıtıcı aynı projeye yazmamalıdır. development environment’ın branch sınırı yalnız main tutulmalıdır; yönetim ayarı uygulanmış/doğrulanmış sayılmaz.

Receipt `.ci/development-delivery.json` artifact’inde kaynak/run/attempt/migration/Edge/hash/izin/smoke/cleanup/advisor özeti tutulur, saklama14 gün. Sonraki doğal devir güncellemeleri kalıcı run bağlantısını kaydeder. Bilerek başarısız/CD-only bir düzeltmede tam main CI yeniden çalıştırılmaz; mevcut aynı kaynak kabulü hâlâ geçerliyse yalnız başarısız CD işleri yeniden denenebilir.

## Tarihsel manuel eşitleme talimatı

Proje `gwyprhenabtpkbojephw`, FtkSaaS, eu-central-1; kullanıcı tarafından geliştirme/test olarak doğrulandı. Son açık talimat20 Ekim2026: her main birleşmesinin aynı kaynak kabulü sonrası bu ortam da güncellenir.

20 Ekim son kullanıcı talimatı: her main birleşmesinin aynı kaynak kabulü doğrulandıktan sonra `gwyprhenabtpkbojephw` FtkSaaS **geliştirme/test** ortamını da o main ile eşitle. Önce migration geçmişi ve içerik eşleşmesini doğrula; yalnız eksik migration’ları sırasıyla uygula, değişen Edge bundle’ını yayımla, JWT/izin kapılarını koru; aynı içerik varsa yeniden kurulum yapmadan eşleşmeyi kaydet. Ardından uzak Auth→Edge→RPC smoke, RLS/EXECUTE ve advisors doğrulaması yap; kaynak SHA/migration/Edge sürümü/sonucu kaydet. Bu, ajanın teslim kapanış adımıdır; otomatik CD workflow’u kurulduğu anlamına gelmez. Production yetkisi değildir. Testler yalnız ayrılmış sentetik verilerle yapılır; mevcut gerçek veriyi reset etme. `npm run test:clean` loopback kabulünde kalır; hosted smoke onun yerine geçmez. Full clean çalışırken izleme/yayın devamı durur; kullanıcı dönüşünde gerçek main kabulü sonrası bu adıma geçilir.

## P03 main eşitlemesi — 21 Ekim 2026

Kaynak `10710ffa90747a7e35c452c4c07ba59522f50ce3`, PR30; aynı main39529992556 completed/success13:18 ve476 test. Başlangıç40 migration/Edge2,0 tenant/hesap/Auth kullanıcısı doğrulandı. İlk40 SQL gövdesi kaynak manifestiyle eşleşti; eksik41–49 migration’lar değiştirilmeden sırasıyla uygulandı. MCP timestamp’leri yalnız başarılı uygulama ve9/9 SQL gövdesi hash eşleşmesinden sonra özgün repository sürümlerine hizalandı; son49/49 sürüm ve SHA256 eşleşmesi doğrulandı. Reset yapılmadı.

Edge backend-v1 sürüm3 ACTIVE; verify_jwt=true. Dependency-complete index.ts SHA256 `8fc08b06592abcb530f81fcf96e879f75f1ab1f8017fb93f2fb61db213fea329`; deploy EZBR SHA256 `d62ce0de4d5d9a176fa63432354e9bfc67f8cfb7e33f3609035ef8a9e76138d7`. Kaynak geri okuma connector’ı UNAVAILABLE; deploy cevabı ve canlı smoke kanıtıdır, geri indirilmiş bundle eşitliği iddia edilmez.

Salt okunur kontroller:90 core tablo,RLS kapalı0;140 runtime operation;141 api_v1 fonksiyonu (140 wrapper+ayrı worker claim helper),anon/authenticated EXECUTE0. Uzak smoke dokuz kontrol:gerçek Auth parola girişi;account_get;organizations_list;geçerli DTO ile finance_get ve sale_refund_preview başka/olmayan tenant reddi NOT_FOUND;doğrudan authenticated finance_get RPC403/42501;geçersiz JWT401;Auth logout204;eski JWT ile account_get AUTH_REQUIRED401. Bunlar hosted ortamda yedi API’nin bütün başarılı finans yazmalarını veya476 testlik CI’ı yeniden çalıştırmaz. İlk istemci smoke yardımcı kodunun204 boş gövde ayrıştırması düzeltildikten sonra dokuz kontrolün tamamı geçti; runtime değişmedi. Fixture hesabı/kullanıcısı/oturumları temizlendi; son0 hesap,0 Auth kullanıcısı,0 organizasyon. Sentetik parola ve tokenlar rapora veya repository’ye yazılmadı.

Advisors ERROR0;WARN3:platform public.rls_auto_enable için [anon](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable) ve [authenticated](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) EXECUTE, ayrıca [sızdırılmış parola koruması](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Public exposed değildir; platform/Auth ayarları değiştirilmedi. INFO:108 RLS/no-policy,34 indekssiz FK,284 kullanılmayan indeks,1 PK’siz tablo. Yük/restore veya performans kabulü tamamlandı sayılmaz.

Bu eşitleme ajanın teslim kapanışıdır; otomatik CD kurulumu değildir. GitHub repo bağlantısının otomatik dağıtım seçenekleri doğrulanmadı. Native entegrasyonda Deploy to production push/merge’de uygulayabilir; bizim kabul kuralımız aynı main clean başarısını bekler. Yerel config.toml backend-v1 verify_jwt=false kullanırken hosted kurulum true’yu korur; otomasyon yerel ayarı sessizce hosted ortama taşımamalıdır. Yeni CD/yayın politikası bu belge kapanışında kurulmaz.

## P02 main eşitlemesi — 20 Ekim 2026

Kaynak `cc4878d09e45204dbc13ccfe1324b38b14548167`, PR28. Aynı main clean39461804543 completed/success;469 test. Güncellemeden önce22 migration, Edge1,0 organizasyon ve0 Auth kullanıcısı doğrulandı. Eksik23–40 migration’lar repository SQL gövdeleri değiştirilmeden sırayla uygulandı. MCP’nin verdiği kurulum timestamp’leri yalnız başarılı uygulama ve SQL gövdesi eşleşmesi sonrasında repository’nin özgün migration sürümlerine hizalandı.40/40 uzak SQL gövdesinin hash’i kaynakla eşleşti; reset yapılmadı.

Edge backend-v1 sürüm2 ACTIVE; verify_jwt=true. Gönderilen dependency-complete `index.ts` SHA256 `b4a8a5d1472ddb16c986f11f2183d9f528ef184e540fc1c662049dbeed5a0916`; deploy cevabı EZBR SHA256 `08545118be6513e52c94ae9d103f8c8035b22165f4071ce458282a5199c995b8` (farklı artefact türleri). Connector kaynak geri okuması UNAVAILABLE verdi; geri-indirilmiş bundle eşitliği iddia edilmez. Deploy cevabı ve gerçek uç smoke’u başarılıdır.

Salt okunur doğrulama:90 core tablo, RLS kapalı0;133 runtime operation; api_v1 içinde133 iş wrapper’ı + ayrı p01_jobs_claim helper’ı=134 fonksiyon. Anon/authenticated EXECUTE0; Data API yalnız api_v1, core/private kapalı. Yeni named API wrapper’ları yalnız service_role çağırır. P01 worker zamanlayıcısı ve dar DB işletim kimliği bu Edge deploy’uyla kurulmuş sayılmaz.

Uzak smoke: sentetik Auth fixture’ı SQL ile kuruldu, gerçek parola girişi Auth servisi üzerinden yapıldı; Edge account_get_v1 ve organizations_list_v1 başarılı. Geçersiz JWT401, doğru RPC imzasıyla doğrudan authenticated session_cancel_preview çağrısı403/42501; geçerli P02 DTO ile başka/olmayan tenant çağrısı NOT_FOUND. Auth logout sonrası eski JWT AUTH_REQUIRED. Bu smoke P02 başarıyla iş yazan bütün senaryoları veya469 testlik temiz CI’ı tekrar etmez. Fixture hesabı/oturumları/kullanıcısı temizlendi; son sayılar0 hesap,0 Auth kullanıcısı,0 organizasyon. Ortak kullanıcı/parola oluşturulmadı, dış e-posta gönderilmedi.

Advisors ERROR0. İki WARN platform `public.rls_auto_enable()` fonksiyonunun anon/authenticated EXECUTE izinleri; public exposed değildir. [Anon uyarısı](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [authenticated uyarısı](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable). Servis-only tasarıma ait107 RLS/no-policy INFO,30 indekssiz FK,284 kullanılmayan indeks ve1 PK’siz tablo INFO var; yük kabulü veya performans düzeltmesi tamamlandı denmez. Platform yardımcı fonksiyonuna veya Auth yönetim ayarlarına müdahale edilmedi.

Bağlantı: `https://gwyprhenabtpkbojephw.supabase.co/functions/v1/backend-v1/{operation}`. İstemci publishable key ve kullanıcı access tokenını kullanır; service-role/DB parolası frontend veya repository’ye yazılmaz. Testler sentetik veriyle ve açık cleanup ile yapılır; global trigger/function fixture’ları paylaşılan DB’de paralel çalıştırılmaz.

## Tarihsel ilk kurulum


Kullanıcının doğruladığı proje: `gwyprhenabtpkbojephw`, FtkSaaS, eu-central-1. Bu hedef geliştirme/test içindir; production yetkisi verilmemiştir.

Kurulum kaynağı: main `4d47d75e4a337378cfcc65f727c67abcac310303`, 21 sıralı ve SHA-256 ile dondurulmuş uygulama migration’ı; 22. migration `api_schema_exposure` yerel ve hosted API şema ayarını eşler. Edge kaynağı `supabase/functions/backend-v1/index.ts`; dependency-complete bundle, ek paket indirme gerektirmez.

Kurulum öncesi migration/Edge listesi boş, core/private/api_v1 şemaları yok ve Auth kullanıcı sayısı sıfır doğrulandı. Mevcut gerçek tenant/veri üzerine reset yapılmaz. `npm run test:clean` uzak projeye yönlendirilmez; bu komut yalnız loopback içindir.

Uygulanan kurulum sırası: migration’ları mevcut dosya sırasıyla uygula; yalnız `api_v1` Data API şemasını erişime aç; core/private kapalı kalır. Fonksiyonlar yalnız service_role tarafından çağrılır. Edge gelen tokenı Auth servisiyle doğrular ve DB canlı session/yetki kontrolünü sürdürür. JWT doğrulaması iki katmanda da korunur.

Salt okunur SQL kontrolleri `scripts/remote-backend-verify.sql` dosyasındadır.

22 migration kaydı kaynak sürümleriyle eşleşti. 90 core tabloda RLS, 65 API wrapper için yalnız service_role EXECUTE doğrulandı. Gerçek Auth girişi → Edge → RPC hesap/liste okuma; geçersiz JWT, doğrudan authenticated RPC reddi (403/42501) ve iptal edilmiş oturumun eski JWT ile reddi geçti. Geçici kullanıcı/hesap temizlendi; uzak smoke tam 181 testlik yerel/CI suite’in tekrarı değildir. Kanıt: `reports/remote-backend-verification.json`.

Security advisors: platformun `public.rls_auto_enable()` fonksiyonunun anon/authenticated EXECUTE izinleri ve kapalı sızdırılmış parola koruması WARN verir. `public`, authenticator için exposed şema değildir; core/private da dışarı açılmaz. RLS policy yokluğu servis rolü tasarımına ait INFO, kullanılmayan indeksler ve yedi indekssiz FK INFO’dur; yük kabulü yapılmadı. Parola koruması: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection .

Bağlantı: `https://gwyprhenabtpkbojephw.supabase.co/functions/v1/backend-v1/{operation}`. Frontend publishable key ve kullanıcının access tokenını kullanır. Service-role/DB parolası kaynak koduna veya frontend’e konmaz. Dış e-posta, frontend kabulü, yük/restore ayrı açık işlerdir.


## Restore 20261026

Kaynak: `34aac276ba124405cc99129a354ff61c376977d1` (PR48); aynı main clean40232332540 ve development CD40234018404 successful. CLI2.122.0; native PostgreSQL17.11.0.006-r0. Deneme 26 Ekim TSİ, ephemeral Vercel Sandbox `sbx_nfAbLxqGoLjgkTNog3VOL3Ezmp1J` içinde birbirinden farklı iki yerel native Supabase stack’inde yapıldı. Hosted projeye dump/reset/restore veya veri değişikliği uygulanmadı. Yeni kalıcı altyapı, workflow veya rutin CI testi eklenmedi.

**Yönetilen sahiplik/izin engeli için izole geri dönüş kabulü geçti. Hosted tam afet kurtarma kabulü açık.** Önceki blank-DB/no-owner/extension-ACL başarısızlığı bu kanıt değildir. Resmî [CLI backup/restore](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore) yaklaşımı hazır Supabase hedefini ve platform iç şemalarına ayrı davranmayı gerektirir. Native ortamda aynı sürümde boş managed hedef hazırlandı; Auth/Storage şema sahipleri platformun kurduğu haliyle korundu. Platform extension ACL’lerini tekrar yazmak veya uygulama ACL’lerini kaldırmak gerekmedi.

### Uygulanan ve doğrulanan sıra

1. Kaynakta mevcut API testlerinin oluşturduğu sentetik satış/hakediş verisi kullanıldı; ayrı hosted dummy organizasyon oluşturulmadı. Ek bir sentetik Auth hesabı gerçek admin API’sinden oluşturuldu, parola girişi ve account_get_v1 ile hesap UUID’si alındı. Kaynak/hedef URL’leri CLI status’tan alındı; ikisi de127.0.0.1 ve farklı DB endpoint’i olmak zorundaydı. Hedefte core/private/api_v1 şemalarının bulunmadığı kontrol edildi.
2. Kaynakta REPEATABLE READ READ ONLY snapshot açıldı. core/private/api_v1/supabase_migrations şemaları custom schema-only dump ile; core/private/supabase_migrations ve Auth verisi aynı exported snapshot ile alındı. Auth’un platform migration tablosu auth.schema_migrations hedef platforma bırakıldı. Supabase migration geçmişi ayrıca taşındı. Vault/secrets ve Storage nesne baytları SQL dump kapsamında sayılmadı.
3. On uygulama rolünün güvenlik bayrakları, connection limit ve rol config’leri aktarıldı. Yalnız eksik üyelikler eklendi; hedefte CREATE ROLE ile zaten oluşan postgres ADMIN üyeliğini tekrar grant etmek PostgreSQL’in grantor döngüsü hatasına yol açtığından mevcut eşit üyelik korundu. Managed rollerin grant zinciri kopyalanmadı. Worker parolaları dump’tan geri gelmiş sayılmadı; yerel çalışma kontrolünde hedefe yeni rastgele parolalar atandı.
4. Uygulama şema arşivi sahiplik ve ACL’ler korunarak pg_restore --exit-on-error ile işlendi; **--no-owner/--no-acl kullanılmadı**. Veri psql -X --single-transaction --set=ON_ERROR_STOP=1 ve transaction içi session_replication_role=replica ile yüklendi. service_role Auth user/session SELECT ve authenticator api_v1 şema ayarı mevcut kaynak kuralıyla eşitlendi.
5. 178 tabloda1.025 satır sayısı ve sıralı satır içerik checksum’ları eşleşti. Bu sayı core/private/Supabase migration geçmişi ve Auth veri tablolarını kapsar; platform migration tabloları ve Storage metadatası dahil değildir. Uygulama tablo/sequence sahipleri, etkin ACL’leri, RLS/force-RLS; fonksiyon imzaları/sahipleri/security-definer/config/etkin EXECUTE ACL ve pg_policies karşılaştırması geçti. NULL ACL, acldefault ile etkin varsayılanına açılıp aclexplode sonuçları sıralanarak kıyaslandı; owner-only açık ACL ile NULL owner-default eşdeğerliği ham dizi farkı diye başarısız sayılmadı. Anon doğrudan core.people okuması42501 ile reddedildi.
6. Restore edilen Auth hesabı **eski parolasıyla aynı kullanıcı UUID’sine** giriş yaptı. Hedefe aynı Git kaynağının dependency-complete Edge dosyaları kopyalandı, functions serve ile etkinleştirildi. Auth→Edge account_get_v1 aynı account UUID’sini döndürdü. İlk404 yalnız functions capability henüz serve edilmediği aşamaydı; son kontrol geçti.
7. Kaynaktaki private ftksaas-documents bucket ayarları hedefte API ile oluşturuldu. Sentetik text/plain dosya kaynaktan indirilen gerçek baytlarla hedefe yüklendi; tekrar indirilen baytlar ve SHA256 eşleşti. Anon dosya okuması reddedildi. Bu tek nesne aktarımıdır; hosted bütün bucket envanterinin eksiksiz kopyası veya belge domain yaşam döngüsü kabulü değildir.
8. Beş lane p01/p05/p06/p07/p07_privacy hedefte gerçek dedicated LOGIN ile bağlandı; connection search_path=pg_catalog, CALL private.ops_run COMMIT yolu, idle heartbeat ve doğrudan core.people erişim reddi geçti. Worker rol bayrakları/config’leri parola atamasından önce kaynakla eşleşti. Bu hosted pg_cron kurulumu veya gerçek iş yükü/kesinti kurtarma kanıtı değildir.

Veri arşivi SHA256: `ff8edbc1e75b7bdeb8e4e9453367274dd8f6428dcaa4248e84dd62233cfd1491`.
Dosya baytları SHA256: `0b823549bc662d739bf5b8a3d79979096388f6eed6ab3d6a4ee2c1530bca8dc2`.
Bir defalık deney araçları SHA256: managed-restore `2b245f79903158282f5481c12c0b1b8d6746e3d74176c4ac2d092ee4a3cf007b`; followup `56760289b2d5e8b898daf9b3b461c35861ef86ddbf12ce7f7c17a9b6a316463b`. Bunlar desteklenen repository komutları değildir; yeni restore motoru/API teslimi iddiası yoktur. Snapshot/dump/restore/veri-güvenlik/parola ilk bölümünde6.521ms ölçüldü; ortam hazırlığı/Edge/Storage/worker dahil uçtan uca RTO değildir, hosted RPO/RTO hedefi türetilmez.

### Kalan gerçek sınır

Hosted ayrı hedefte gerçek proje ayarları, secret/key rotasyonu, sağlayıcı yapılandırması, bütün Storage envanteri, pg_cron schedule/bağlantı kurulumu ve gerçek workload yeniden başlatma doğrulanmadı. Auth eski access tokenlarının hedef projede geçerliliği varsayılmaz; yeniden giriş kullanıldı. Hosted RPO/RTO ve tam afet kurtarma kabulü kapanmadı. Son kullanıcı kararıyla yeni altyapı geliştirmesi açılmadan ürün/ayar API işlerine dönülür; bu sınırlar deployment öncesi kabulde ayrıca korunur.

Önceki pilot-readiness ve tarihsel kuyruklarda geçen ayrı kalıcı dummy kurulum işi son kullanıcı kararıyla iptaldir; mevcut sentetik veri yeniden kullanılabilir. Yeni otomatik süre ölçme/CI altyapısı da bu çalışmanın parçası değildir.


Deneme fixture hazırlığında Node name-pattern üst testi eşlediği için planlanandan geniş eğitmen suite’i başlamıştı; successor sınır vakası bir kez failed gösterdi ve geniş koşu durduruldu. Bu koşu başarılı suite diye raporlanmaz. Kaynak assertionlarına dokunmadan yalnız ilk iki mevcut testin setup+bloklarıyla yapılan dar tanı3/3pass,0fail,56.455ms ile normal tamamlandı. İlk tekil başarısızlığın nedeni kanıtlanmadı; yeni runtime kusuru veya çözülmüş bir flaky sorun iddiası yoktur. Restore veri kabulü bu kesilmiş suite’in sonucundan türetilmedi; satış/hakediş varlığı ve snapshot içerik/güvenlik eşitliği ayrı assertionlarla denetlendi. Aday/main tam clean kanıtları yukarıdaki gerçek GitHub koşularıdır.

## PR50 Auth trigger restore bağımlılığı

64. aday migration auth.mfa_factors üzerinde verified TOTP history ve removal fence trigger’ları ekler. Restore’da uygulama tablolarıyla birlikte bu tanımlar/owner/ACL ve intent-event bağı korunmalıdır; Auth faktör secret’ları loga veya uygulama geçmişine taşınmaz. Önceki34aac276 restore kanıtı bu yeni kaynağı kapsamaz. Hosted TOTP enable/config/secrets ve bu yeni kaynakla managed restore kabulü ayrıca doğrulanır; local supabase/config.toml hosted aktivasyon kanıtı değildir.

## Teslim1 kimlik tabloları ve sağlayıcı envanteri

Yerel65 taslağındaki private.account_identity_names ve private.account_contact_projections current kimlik/authority verisidir; restore RLS/owner/ACL ve trigger envanterine, fiziksel privacy/purge envanterine dahil edilmelidir. Mapping geçmiş snapshot değildir: link target değişince eski authority satırı kaldırılır, mevcut physical contact geçmişi otomatik silinmez. Önceki restore ve PR50 native kabulü yeni65 kaynağı kapsamaz. Google/SMS/SMTP secret ve provider config geri dönüşü ayrıca kanıtlanır; Resend key veya kullanıcı OTP’si rapora yazılmaz.

26 Ekim hosted Auth güvenlik kabulü: yayımlanmış26e7091/64 üzerinde gerçek Resend signup-mail doğrulaması, tek kullanımlık proof reddi, native TOTP enroll/challenge/verify, eski aal1 Edge reddi, güçlü erişim, native direct removal fence, güçlü backend removal+repeat ve tek enable/disable history geçti. Ayrıntılar [aktif rapordadır](../reports/account-identity-progress-20261026.md). Yeni65 yerel kimlik trigger’ları bu hosted denemede yoktur; yeni kaynak/restore kabulü açık kalır.
