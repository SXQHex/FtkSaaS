# P04 CRM ve public başvuru devri

Başlangıç main: `920cdbb486d9dddb81b183ac92c5d4fe5ad6c819` (PR34 belge kabulü başarılı; CD source başarılı/deploy skipped). Bu dalda 11 P04 API geliştirme runtime'ına eklendi: toplam199 sözleşme /151 runtime /48 contract_only,51 append-only migration,90 core tablo. Aday/main clean ve gerçek hosted sağlayıcı kabulü henüz yoktur; P04 done değildir.

## Davranış

- Aday mevcut `people` kaydı ve merkezde `candidate` ilişkisidir. `lead_save_v1` yeni kişi oluşturmaz; ayrı izinli kişi kaydı ya da public başvurunun yönetici incelemesi kullanılır. Aynı kişi/merkezde ikinci açık lead yoktur. Güncelleme hedef kimliğini/kişiyi değiştiremez ve güncel sürüm ister.
- CM kendi merkezini yönetir; açık `crm.daily` grant'lı staff yalnız kendine atanmış adayı görür/değiştirir, yeni adayı kendine atar. Atamayı değiştiremez. Canlı kapsam receipt replay'den önce denetlenir. CRM satış/tahsilat/indirim/export yetkisi vermez; dönüşüm ayrıca CM veya `person.activate` ister.
- Görüşme/takip/sonuç `crm_activities` içinde sürümlüdür. Mevcut `management_state_get_v1` orijinal işlemin izniyle aday, faaliyet, deneme, yayın ve başvuru durum/sürümünü okur. Başvuru selector'ında application_id yoksa CM merkez inbox'ını sayfalar; iletişim yalnız bu yetkili projeksiyondadır.
- Öğrenci dönüşümü org kilidi altında tekil aktif öğrenci limitini uygular; hesap bağı/rol veya satış oluşturmaz. Sonraki ücretli satış/tahsilat mevcut ayrı yetkili API'lerle yapılır. Geçmiş bedelsiz rezervasyon satın alınmış satışa bağlanmaz.
- Deneme için `private.p04_trial_configuration` içinde org/center/product_version_id/offer_minutes/enabled açıkça kurulur; süre varsayılanı yoktur. Mevcut `trial_repeat_limit` politikası gerekir. Tüm merkezlerdeki kişi kullanımları ve süresi dolmamış teklifler aynı cap'e girer. Teklif nominal yer tutar; normal rezervasyon ve bekleme listesi worker'ı bu teklifi de sayar. Onayda pencere/kapsam/kaynak uygunluğu/kontenjan/borç/belge yeniden kontrol edilir. Bedelsiz aday öğrenci kotasına girmez; ücretli deneme ayrıca önceden yetkili satıştan hak gerektirir, CRM satış/tahsilat yapmaz. Yalnız bedelsiz deneme kişi başı/yüzdelik hakediş dışıdır; tarihsel snapshot değişmez.
- F23 takip nüfusu aktif öğrenci ilişkileridir; daha önce lead'i olmayan öğrenci CM listesinde de bulunur. Staff yalnız atanmış lead'i olan öğrenciyi görür. `CrmFollowupView` kişi/merkez/opsiyonel lead/kind/due_at taşır; sahte lead yaratılmaz. İnaktiflik `inactive_student_days`, yenileme `entitlement_reminder_days` politikasından gelir. Yenilenmiş önceki satış linked active successor varsa aday dışıdır; bağımsız diğer paketler bir yenileme sayılmaz. Otomasyon/mesaj P05'tir.

## Public transport ve zorunlu kurulum

`backend-v1` için `verify_jwt=true` korunur. Hesapsız public çağrının gateway credential'ı legacy **anon JWT**'dir; yeni publishable key bearer JWT değildir. İnsan operasyonları yine gerçek Auth kullanıcısı ve canlı session ister. Public RPC'ler de yalnız service_role tarafından çalıştırılır; anon/authenticated doğrudan EXECUTE almaz.

Takvim `slug=org_id` ile grupludur; `publication_set_v1` tam bir session/event hedefi ve ilk yayında açık `public_details` (başlık, kamuya açık mekan etiketi, ücret, para birimi, koşul) ister. Aralık ve disiplinler hedefin güncel verisinden gelir. Kamu çıktısı yalnız `PublicCalendarItem` allowlist'idir. Yayından kaldırma, seans/etkinlik iptali, kapalı organizasyon/merkez ve F25 kaybı anında uygulanır.

Anonim submit doğrudan istemcinin bildirdiği X-Forwarded-For'a güvenmez. Güvenilir sunucu/gateway gerçek ve normalize IP'yi alır ve şu protokolü imzalar:

- Secrets: `FTK_PUBLIC_INGRESS_SECRET`, `FTK_PUBLIC_HASH_SECRET`, `FTK_TURNSTILE_SECRET`, `FTK_TURNSTILE_HOSTNAME`. Hiçbirini istemciye gönderme.
- `x-ftk-client-ip`, `x-ftk-ingress-time` (Unix saniye), `x-ftk-ingress-signature` (hex HMAC-SHA256) başlıkları kullanılır.
- İmzalanan UTF-8 metin: HTTP method, tam URL pathname, timestamp, normalize IP, ham body SHA256 hex; her alan arasına tek newline. En fazla60 saniye sapma kabul edilir. Proxy body'yi imzaladıktan sonra değiştirmez.
- Turnstile siteverify `success=true`, yapılandırılan hostname ve `action=public_application` ister. Eksik secret/ingress, provider timeout/ret ve yanlış hostname/action bypass oluşturmaz. Sağlayıcı yokken endpoint SERVICE_UNAVAILABLE döner.
- İlk DB preflight kapalı hizmeti veri toplamadan reddeder, IP denemesini provider başarısızlığında da kalıcı sayar. İkinci aşama yalnız sunucunun doğruladığı bot bağlamıyla intent yazar. IP düz metni DB'ye girmez; keyed hash ve org/hedef hash kullanılır. Başlangıç5/15 dakika IP ve3/saat org/hedef limiti `private.p04_public_security` üzerinden ayarlanabilir. Pencere sınırında iki patlamaya izin vermeyen muhafazakar kayan pencere uygulanır.
- Contact normalize edilmiş e-posta adresidir; doğrulanmış sayılmaz. client_request_key aynı payload replay eder, başka payload reddedilir. Aynı açık hedef/yayında ikinci application olmaz; yanıt yalnız accepted=true'dur. Yer/hak/kişi/hesap bağı/rol oluşturulmaz. Bilinen iletişim create_candidate ile ikinci kişiye çevrilmez; manager match_existing seçer, eski iletişim güncellenmez.

Bu PR sağlayıcı/gateway secret'larını kurmaz veya frontend geliştirmez. Gerçek signed ingress→Turnstile→Edge kabulü dış bağımlılık olarak açık kalır; unit mock başarı kanıtı bunun yerine geçmez.

## Doğrulama ve bekleyen kabul

Yerel `npm run verify`: generation/migration hash/katalog/type/governance,97 yapısal ve42 CI politika düğümü başarılı. Yeni testler mevcut `contract.test.mjs` ve `person-registry.test.mjs` suite'lerine eklendi; CI workflow/shard/full-main kapsamı değiştirilmedi. Gerçek Auth→Edge→RPC P04 suite'i ilk geliştirme CI'ında çalışacak; yerelde Docker olmadığı için bu sonucu başarılı diye yazmıyoruz.

Geliştirme/test Supabase üzerinde modül+wrapper aynı transaction'da derlendi; sentetik yayın→iki ayrı başvuru→replay/mismatch→inceleme→takip→deneme→öğrenci ve lead'i olmayan öğrenci takibi çalıştırıldı, tümü ROLLBACK edildi. Bu geçici sorgu hosted deploy veya temiz CI kabulü değildir. Kalıcı hosted durum49 migration/Edge4 kabulünde kalır.

Bağımsız ilk inceleme public hash/key değişken çakışmasını ve lead'siz öğrencinin takip dışında kalmasını buldu; düzeltildi, regresyonlar eklendi. İkinci geçiş bloklayıcı kaynak hatası bulmadı; önerdiği gerçek yoklama kapanışı sonrası bedelsiz hakediş/dönüşüm ve önceden satın alınmış ücretli deneme allocation kontrolleri aynı API suite’ine eklendi, CI’da çalışacak. Son kaynak incelemesi ve aday/main clean ayrı bekler. Merge sonrası mevcut CD normal akışı uygulanır. Full clean veya main clean atlanmaz, daraltılmaz; CI başlayınca kullanıcıya devir yapılır.

İlk hedefli CI39597246182 başarısız:97 yapısal/42 CI politika/27 DB geçti; yeni P04 free-trial kapanış fixture’ında Owner’a instructor rolü verilmesine rağmen aktif merkez ilişkisi kurulmamıştı. `availability_save_v1` doğru biçimde NOT_FOUND döndü; sonraki earnings_snapshot kontrolü kapanış oluşmadığı için zincirleme düştü. Fixture mevcut `student_activate_v1` ile merkez ilişkisini kurar ve bunu açıkça doğrular. Ürün izinleri, kapanış/hakediş assertion’ları ve clean kapıları değiştirilmedi. Yeni kaynak CI kabulü ayrıca bekler.

İkinci hedefli CI39599003841 aynı yeni kapanışta INTEGRITY_VIOLATION buldu: eski private.lesson_right yalnız satın alınmış allocation veya negatif deficit tanıyordu; bedelsiz aday denemesinde ikisi de bulunmaz. Yeni51. migration yalnız accepted teklif + aynı org/merkez/kişi/seans/usage + sabit0 fiyat + source_sale_id yok kanıtıyla free_trial kapanışını destekler. Eksik kanıt ve sıradan eksik hak yine INTEGRITY_VIOLATION’dır. İlk used_at kanıtı düzeltmede silinmez; hak/deficit/borç/hakediş üretilmez. Test önce usage kanıtını kaldırınca kapanış reddini, geri koyunca gerçek kapanışı doğrular. Aday/main clean değişmedi; yeni kaynak CI bekler.

Yeni düzeltme odaklı gerçek PostgreSQL transaction testinde geçti: kullanım kanıtı yokken gerçek kapanış reddi, kanıt geri geldiğinde gerçek private.lesson_dispatch kapanışı, frozen trial=true/0 hakediş, used_at kaydı ve düzeltmede ilk kullanımın korunması. Modül+51. migration+sentetik fixture bütünü ROLLBACK edildi; hosted migration geçmişine eklenmedi. Bu doğrulama gerçek Auth→Edge CI veya aday/main clean yerine geçmez.
