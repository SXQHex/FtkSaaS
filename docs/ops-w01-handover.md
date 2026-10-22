# OPS-W01 — Supabase içi hosted worker

Kaynak tabanı kabul edilmiş main `006ad36918ae823bc10fbdefa2d48901e193121c`, PR38. P06 aday39779013518/main39782197422/CD39785146645 başarılı;178 runtime/22 contract_only,54 migration/Edge7. Bu yeni OPS kaynağı55 migration taşır, API sayısını değiştirmez. Durum **kaynak ve hosted işletim kabulü bekleniyor**. P07 queued.

22 Ekim kullanıcı tercihi: Supabase içinde barındırma. Ek sunucu, dış servis, insan JWT'si veya service-role worker kimliği yoktur. Supabase becerisi ve güncel Cron belgeleri incelendi. Platformda pg_cron etkinleştirildi; yalnız teknik canary ayrı LOGIN session_user ile iki başarılı tick yaptı ve job/table/role temizlendi. Üretim worker görevleri henüz kurulmadı; accepted-source CI ve CD sonrası kurulur. Geliştirme DB'sinde0 organizasyon ve0 worker binding görüldü; sentetik veya gerçek tenant/config uydurulmaz.

## Kaynak ve güven sınırı

`database/ops-hosted-workers.sql` ile aynı yeni migration native adaptörü kurar. Önceki54 migration değişmez. Üç passwordless LOGIN `ftk_ops_p01`, `ftk_ops_p05`, `ftk_ops_p06`, yalnız kendi `ftk_pXX_worker` grubunu devralır; süper kullanıcı/rol-veritabanı kurma/replication/bypass RLS yoktur. Bu ayrılmış isimlerde beklenmeyen grup üyeliği kurulumda reddedilir; parola NULL yapılır. İki bağlantı,30sn statement/idle transaction ve5sn lock sınırları vardır. Parola bulunmadığı için harici password auth kurulmaz; Supabase'in yerel Cron bağlantısı bu gerçek kimliği kullanır. Ana DB parolası veya API anahtarı job komutunda tutulmaz.

Kullanıcıdan lane dışında işlem, aktör, rol, tenant, UUID veya görev payload'ı alınmaz. Gerçek session_user ve canlı grup üyeliği kontrol edilir; SET ROLE ile insan/admin oturumu worker olamaz. Core/Auth/private tablolar worker'a açılmaz. Yalnız sınırlı native girişler ve daha önce kabul edilmiş claim/execute fonksiyonları çağrılır. Açık org binding'leri mevcut private.p01/p05/p06_worker_scopes tablolarında kalır; bütün özgün tenant/merkez/plan/aktör/lease/receipt kapıları tekrar çalışır.

Native SQL adaptörünün RFC9562 UUIDv7 bankı server timestamp + kriptografik random, doğru version/variant bitleri kullanır; v4 fallback yoktur. Mevcut private.new_uuid_v7 veya tablo default'ları değiştirilmez. Başlangıç4096, P06'nın aynı teknik büyüme tavanı116574 ve en çok4 deneme korunur.4096 benzersiz UUIDv7 gerçek Postgres17 BEGIN/ROLLBACK denemesinde doğrulandı; native adaptör bu denemede kalıcı uygulanmadı.

## Çalışma ve toparlanma

Her lane için5sn Cron tick, tur başına açık binding'lerden sıradaki bir org ve en çok bir claim vardır. Son org'dan sonra UUID sırasıyla dolaşır ve sona ulaşınca başa döner; hiçbir org yoksa idle heartbeat üretir. Tenant sayısı büyüdükçe org başına tick aralığı artar; iş yükü kabulü bu teslim değildir. Private sağlık satırı bounded tek satır/lane'dir; payload/token veya kişi bilgisi yazmaz.

SECURITY INVOKER procedure `private.ops_run` explicit COMMIT ile claim'i domain execution'dan ayırır. İcra iptalinde domain transaction geri alınır, önceki claim lease'i kalır; yeni Cron oturumu süresi dolmuş lease'i geri alır. Her lane için session advisory lock çift icrayı engeller; Cron bağlantısının kapanması lock'u bırakır. Aynı Cron job üst üste eşzamanlı çalışmaz. Domain job hatası bounded modül retry yoluna gider; sonraki lane/tenant tick'i devam eder. Commit dışında global EXCEPTION bloğu yoktur; query cancellation yutulmaz. Native COMMIT gereği CALL tek başına/autocommit komutudur, BEGIN veya management API çoklu transaction içine konmaz.

Heartbeat: last_started_at/last_finished_at/status/code ve toplam tick/claim/success/fail sayıları.2dk bitmemiş heartbeat stale olarak görünür. Claim/job hatası error,0 bağlı tenant idle/healthy'dir. Her720 tick'te yalnız bu dedicated kimliğin üç native job adına ait7 günden eski Cron geçmişinden en çok1000 kayıt silinir; iş defterlerine dokunulmaz. Bu teknik log retention ürün/hukuki saklama politikası değildir.

## Kabul edilmiş kaynak sonrası kurulum

1. Son head/base/tree bağımsız inceleme ve gerçek full clean; merge sonrası aynı main clean ve development CD55/55 içerik eşleşmesi.
2. `scripts/ops-cron-install.sql` yönetici SQL oturumunda bir kez atomik uygulanır. Cron görevleri gerçek worker rolüyle oluşturulur; geçici provisioning üyelikleri ve cron schema erişimi işlem sonunda kaldırılır. Aynı ad/rol yeniden kurulumda aynı job güncellenir; mükerrer job oluşmaz.
3. `scripts/ops-cron-health.sql` ile üç job owner/schedule/active ve gerçek idle heartbeat doğrulanır. Tenant binding yokken sahte iş başarısı raporlanmaz.
4. Bir lane enabled=false ile durdurulur, yeni claim oluşmadığı doğrulanır; true ile heartbeat devam eder. Bu yumuşak durdurma sürmekteki işi iptal etmez. Sert kesinti/lease reclaim gerçek LOGIN CI testinde ayrıca doğrulanır.
5. Canlı setup/run kimlikleri ve sağlık kanıtı sonraki doğal devir commit'inde kaydedilir; full clean izleme kuralı korunur.

Durdurma: `update private.ops_worker_health set enabled=false where lane='p06'` (veya üç lane). Yeniden başlatma enabled=true. Tam zamanlayıcı durdurması yönetici `cron.alter_job(job_id:=...,active:=false)`; kaldırma cron.unschedule ile yalnız ilgili job adı içindir. Extension'ı drop etmek bütün Cron job'larını siler; rollback yöntemi olarak kullanılmaz. Worker/grup/binding kaldırılırsa özgün yetki kapıları fail-closed çalışır. Yeniden kurulumda yeni parola gerekmez.

## Doğrulama sınırı

Yeni `tests/ops-hosted-acceptance.mjs` mevcut registry shard'ına bağlıdır; yeni suite/shard veya temiz kabul gevşetmesi yoktur. Gerçek dedicated LOGIN oturumları: boş binding heartbeat; başka lane/tabloların reddi; UUID bankı; gerçek Auth→report job; geç audit sleep sırasında CALL iptalinin kalıcı claim/domain rollback sınırı; oturum kapama/lease expiry/yeni session reclaim/tek dosya; güncel authorized job sonucu; disable ve binding kaldırma.

Yerel Docker bulunmadığından gerçek Auth/native CALL testinin başarı kanıtı henüz yoktur; final CI gerekir. Platform canary ve SQL rollback UUID testi bunun yerine geçmez. Kaynak kabulü + development kurulum/işletim doğrulanmadan OPS-W01 done değildir. Dış e-posta, frontend, yük/restore ve production müşteri kabulü kapsam dışıdır.
