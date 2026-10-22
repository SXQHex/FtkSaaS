# Kalan backend işleri

22 Ekim son kullanıcı kararı: P07-A+B+C tek Draft PR40 içinde bağımlılık sırasıyla geliştirilir ve birlikte merge edilir. Ayrı A/B/C merge/kabul döngüleri kaldırıldı. GitHub servisleri normale dönene kadar manuel CI, rerun, aday label ve merge başlatılmaz; geliştirme commitlerinde geçici `[skip ci]` kullanılarak push kaynaklı pahalı CI ertelenir. Workflow veya kabul kapısı değiştirilmez. Yerel odaklı doğrulamalar sürer. Servisler normale dönünce PR39 main39809302120 attempt6/CD39820836027 attempt2/OPS hosted kapanışı doğrulanmıştır; sırada tamamlanmış P07 için son kaynak bağımsız inceleme, tek aday full clean, merge ve aynı main clean/CD sırasıyla yapılır. Eski/skipped CI kabul değildir; bütün22 API tamamlanmış sayılmaz: A8 kaynak hazır, B6/C8 geliştirme sırasındadır.

22 Ekim güncel durum: OPS-W01 PR39, `d1830c89e3d5e7f3c90db7ef0953cc264b35205f` ile main’e birleşti. Aday39795678387 attempt5 kabulü doğrulandı; aynı main [39809302120 attempt6](https://github.com/SXQHex/FtkSaaS/actions/runs/39809302120/attempts/6) completed/success: source, core, API1–4 ve toplayıcı gerçek kabul adımları başarılıdır. Main retry işi kapandı. [CD39820836027 attempt2](https://github.com/SXQHex/FtkSaaS/actions/runs/39820836027/attempts/2) completed/success:18 kontrol,55/55 migration içeriği, pending[], Edge7 değişmeden ACTIVE/verify_jwt=true, RLS/EXECUTE, gerçek Auth→Edge→RPC smoke/advisors ve fixture temizliği geçti. Receipt artifact12445920610 SHA256 `a1261502037363f5bf77fdc2a714eb780f9ec42012484104bd53f6e922d87cb5`. Kullanıcı yetkisiyle22 Ekim20:32–20:33 (Türkiye) Cron2/3/4 kuruldu: p01/p05/p06 kendi LOGIN kimlikleriyle5sn çalışır; üçü healthy/idle, hata0. P06 disable sırasında tick4 sabit kaldı, enable sonrası6 oldu; açık tenant binding0/org0 olduğundan iş claim0. OPS-W01 kaynak/main/CD ve boş kuyruk hosted işletim kabulü kapandı. P07 taslak kaynakları hosted uygulanmadı. Yeni CI/CD koşusu şimdi tetiklenmez. P07-A Draft PR40 geliştirmesi sürer: **200 sözleşme/186 geliştirme runtime/14 contract_only/57 migration/90 core tablo**. Sekiz A işleminin kaynağı uygulandı; gerçek Auth→Edge/aday/main kabulü bekler. B6 ve C8 aynı Draft PR40 geliştirme sırasındadır. Full clean/merge şimdi tetiklenmez; kapılar gevşetilmez. [P07-A devri](p07-a-handover.md).

P05 **done (kod, main ve geliştirme/test kabulü)**: [PR37](https://github.com/SXQHex/FtkSaaS/pull/37), kabul edilmiş main `83641447b29e459236aea1a9a4379b5d19825af6`;200 sözleşme/165 runtime/35 contract_only,53 migration/90 core tablo. Son head15e2126/base16cb570/tested merge2ebe087/tree736a75b; bağımsız son kaynak incelemesi5611074233, [aday39745672815](https://github.com/SXQHex/FtkSaaS/actions/runs/39745672815) ve [aynı main39748053581](https://github.com/SXQHex/FtkSaaS/actions/runs/39748053581) completed/success. [CD39750264949 attempt1](https://github.com/SXQHex/FtkSaaS/actions/runs/39750264949) success:18 kontrol,53/53 içerik eşleşmesi, P05 migration uygulandı, Edge6 ACTIVE/verify_jwt=true, RLS kapalı0/client RPC EXECUTE0 ve sentetik fixture temizliği. Receipt artifact12412499512 SHA256 `a41a8448c0a1b9dfdf853b58bea7cd56525fd8ede14812684b12619c3c8ee04e`. Eski aday hata kayıtları tarihsel kanıttır; bu kabulün kaynağı değildir.

P06 **done (kod, main ve geliştirme/test kabulü)**: [PR38](https://github.com/SXQHex/FtkSaaS/pull/38), main `006ad36918ae823bc10fbdefa2d48901e193121c`;200 sözleşme/178 runtime/22 contract_only,54 migration/90 core tablo. Son headf2f9d6c/base8364144/tested merge1901fc6/treeb486ffe; bağımsız review5614150102, [aday39779013518](https://github.com/SXQHex/FtkSaaS/actions/runs/39779013518), [aynı main39782197422](https://github.com/SXQHex/FtkSaaS/actions/runs/39782197422) ve [CD39785146645 attempt1](https://github.com/SXQHex/FtkSaaS/actions/runs/39785146645) success. CD18 kontrol/54 içerik eşleşmesi/Edge7 ACTIVE/verify_jwt=true/RLS kapalı0/client RPC EXECUTE0 ve fixture temizliği geçti; receipt12428881259 SHA256 `bcd1ab3255c1808982de76c3d09d47d5eaa95c5fb2e8f9f870d3fedc9ce93b65`. Önceki aday hataları tarihsel kanıttır. OPS-W01 PR39 main’e birleşti; aynı main clean attempt6/CD attempt2 ve hosted boş kuyruk işletim kabulü kapandı. P07-A Draft geliştirmesi son kullanıcı talimatıyla sürer; tenant config/binding uydurulmaz.

PR36 operasyonel takip kapandı: aynı main [39644044693](https://github.com/SXQHex/FtkSaaS/actions/runs/39644044693) success; [CD39646391222](https://github.com/SXQHex/FtkSaaS/actions/runs/39646391222) success,18 kontrol,52/52 migration, pending[], Edge5 değişmeden ACTIVE/verify_jwt=true. Atomik Management API transport yeni migration olmadan da rollback probe ile doğrulandı. Bot/deneme hedefi hâlâ kullanıcı kararıyla ertelendi; hosted P05 worker kurulmuş değildir.

P04 **done (kod ve kaynak kabulü)**: [PR35](https://github.com/SXQHex/FtkSaaS/pull/35), kabul edilmiş main `7b96d8866abb2c056d1b59a96afee0696a1187d6`;199 sözleşme/151 runtime/48 contract_only,52 migration/90 core tablo. Son head55c23dd, base920cdbb, tested merge901c64a, treee2011a6 kaynak zinciri; bağımsız son kaynak incelemesi ve [aday39630534660](https://github.com/SXQHex/FtkSaaS/actions/runs/39630534660) ile [aynı main39633243405](https://github.com/SXQHex/FtkSaaS/actions/runs/39633243405) completed/success doğrulandı. [CD39635569033 attempt2](https://github.com/SXQHex/FtkSaaS/actions/runs/39635569033/attempts/2) success:52/52 içerik eşleşmesi, Edge5 ACTIVE/verify_jwt=true,17 kontrol ve sentetik fixture temizliği. İlk CD'deki CLI migration hatası aşağıdaki operasyonel takipten ayrıdır; ikinci denemede eksik migration kalmadığı için o yol sınanmadı.

21 Ekim bot/deneme hedefi kararı sürer: alan adı/tenant/ürün/süre/tekrar limiti uydurulmaz. PR36 transport kapanışı ve yeni P05 kabul sınırı yukarıdadır; eski P04/CD-01 metinleri yeni kaynağa başarı taşımaz.

CD-01 **done**: PR32 kurulum + PR33 test fixture düzeltmesi sonrası kabul edilmiş main `0fabf3a4a605dd6be5a1d358c660021f59406e20`. [Main39588975421](https://github.com/SXQHex/FtkSaaS/actions/runs/39588975421) ve [ilk canlı CD39590690817/attempt2](https://github.com/SXQHex/FtkSaaS/actions/runs/39590690817/attempts/2) completed/success. CD receipt aynı source/main/run kabulünü bağlar;17 kontrol başarılı,49 migration içerik eşleşmesi,90 core tablo/RLS, anon/authenticated EXECUTE0, Edge backend-v1 v4 ACTIVE/verify_jwt=true. Gerçek Auth→Edge→RPC, oturum reddi ve fixture temizliği geçti; ayrıca uzak son0 hesap/0 Auth kullanıcısı/0 organizasyon doğrulandı. Envanter199/140 runtime/59 contract_only değişmedi. P04 CRM/public başvuru queued; başlamadı. Hosted worker işletimi, frontend, dış e-posta ve yük/restore bu kapanışla tamamlanmaz.

P03 **done**: [PR #30](https://github.com/SXQHex/FtkSaaS/pull/30), kabul edilmiş main `10710ffa90747a7e35c452c4c07ba59522f50ce3`. Son head2526347 / basece95a9d / tested merge1768fc2 / tree9ac328b aynı kaynak zinciridir. Bağımsız kaynak incelemesi PR review5594023911 içinde kayıtlı; [aday39527260056](https://github.com/SXQHex/FtkSaaS/actions/runs/39527260056) ve [aynı main39529992556](https://github.com/SXQHex/FtkSaaS/actions/runs/39529992556) completed/success.96 yapı +37 CI politika +27 DB +316 API =476 test düğümü; fail/skipped0,49 migration. Main13:18; aday13:34. Envanter199 sözleşme/140 runtime/59 contract_only,90 core tablo. Geliştirme/test Supabase aynı49 migration/Edge3 kaynağına eşitlendi; ayrı dokuz kontrollü Auth→Edge→RPC smoke ve fixture temizliği başarılı. P04 queued, başlamadı.

P02 **done**: [PR #28](https://github.com/SXQHex/FtkSaaS/pull/28), kabul edilmiş main `cc4878d09e45204dbc13ccfe1324b38b14548167`. Envanter **199 sözleşme / 133 runtime / 66 contract_only / 40 migration / 90 core tablo**. Son head `35816cc30a9b28e273e94e6cef86e8b402dbaad0` bağımsız incelemeden geçti; [hedefli39448566998](https://github.com/SXQHex/FtkSaaS/actions/runs/39448566998), [aday39455462417](https://github.com/SXQHex/FtkSaaS/actions/runs/39455462417) ve [aynı main39461804543](https://github.com/SXQHex/FtkSaaS/actions/runs/39461804543) completed/success. Full kapsam:96 sözleşme/yönetişim +37 CI politika +27 DB +309 API =469 test düğümü; fail/skipped0. Core, dört izole API shard, toplayıcı,40 migration, seed/health/advisors geçti. Main clean14:43; önceki43:33 hedefli koşu seri tüm-suite fallback kullandı, aynı çalışma profili değildir. Eski başarı yeni kaynağa taşınmaz.

Geliştirme/test Supabase `gwyprhenabtpkbojephw`, kabul edilmiş main `006ad36918ae823bc10fbdefa2d48901e193121c` kaynağına CD39785146645 ile eşitlendi:54 migration/Edge7/178 runtime,18 kontrol ve fixture temizliği. OPS-W01 main d1830c8/CD39820836027 attempt2 kabulü55 migration/Edge7 kaynağını doğruladı; Cron2/3/4 kurulumu ve boş kuyruk health/disable-restart kabulü geçti. Frontend/dış e-posta/yük/restore ayrı kalır.

## Aktif seri üretim

**P01, CI-02, P02, P03, P04 ve PR36 kod kabulü kapandı.** P05 aday/main/CD kabulü kapandı. P06 PR38 kabulü13 API ekledi;178 runtime/22 contract_only. P07-A sekiz işlem geliştirme runtime’ıdır; kalan14 işlem yalnız sözleşmedir. P06 kaynak/main/CD kabulü kapandı; aktif OPS-W01 Supabase Cron adayının kabulü beklenir. [Tek kuyruk](production-queue.md) ve [P06 devri](p06-handover.md) kabul edilmiş kapsamdır. Bot/deneme canlı kurulumu kullanıcı hedefi oluşana kadar ertelendi.

[P01 devri](p01-handover.md): katalog/hak okuması, talep/alternatif/onay, bekleme/teklif/expiry ve gerçek dar worker döngüsü uygulandı. Genel belge upload/yayın/kabul ve bildirim API'leri P05/PR37 kabulüyle kapandı. Hosted worker provisioning/işletim kabulü CI'daki gerçek CLI/loop testinden ayrıdır.

## DS öncelikli teslim sırası

1. Karar/DTO/izin/guard/sürüm-okuma aktarımı ve F01–F33 yapısal denetimleri korundu; gerçek davranış kanıtı ayrı izlenir.
2. Starter yoklama/hak kapanışı, politika/kişisel limit etkisi/onayı uygulandı. Belge tüketicileri P05 ile kapandı; otomatik başlangıç gözlemi ve diğer hak değişikliği tüketicileri kendi devirlerindeki sınırda izlenir.
3. Immutable anlaşma/hakediş ve dar gerçek başlangıç yolu uygulandı; son kaynak kabulü/inceleme/CI PR kanıtıyla değerlendirilir. P03 ödeme komutları PR30 ve aynı main39529992556 kabulüyle tamamlandı.
4. Ayrı merkezler arası ledger, Owner/delege OM grant zinciri ve B onayında atomik ödeme/mahsup/bağlı düzeltme kesinleştirmesi. DS-OPEN-01 karar düzeyinde kapalı; DS-OPEN-02 son merkez yetki kararıyla karar düzeyinde kapalı; aynı hesap A/B yetkileri ayrı doğrulanarak iki adımı yapabilir. Fiziksel depolama, dokuz RPC/read ve adım kapsamlı audit uygulandı; [hesaplaşma devri](settlement-handover.md) ve son head temiz CI kabulü esas alınır.
5. Satış kapsam snapshot/değişim, gerekçeli backdate ve geçmiş açık kapatma; yeni ürün davranışı uydurulmadan uçtan uca kabul.

Kalan delivery_gaps ve vaka bazlı durumlar [08 makine sözleşmesi](../contracts/08-FtkSaaS-tip-ve-operasyon-sozlesmesi.json) ile [üretilmiş F01–F33 haritasından](feature-delivery.md) okunur; yapısal test başarısı davranış kabulü değildir. [Main koruması](branch-protection-review.md) klasik API 403 nedeniyle doğrulanamıyor; gerekli yönetici ayarları teslim edilir, uygulanmış sayılmaz.

## Bağımlılık sırası

1. Uygunluk/politika dört API uygulandı; tüketici sınırları ve eksik iş akışları Claude devrindeki güncel bölümde açıkça ayrılır. Son PR SHA kabulü CI ile ayrıca doğrulanır.
2. Ürün kataloğu, seans bağlamında uygun satın alınmış hak seçimi ve talep–bekleme–yer teklifi yaşam döngüleri P01 PR #22 ile uygulandı; program/seans yedi komutu PR #12 ile, Starter uyarlaması PR #14 ve anlaşma yayını PR #15 ile uygulandı; kalan tüketiciler ilgili devirlerde belirtilir. Üç program okuması uygulandı; sınırlar okuma devrindedir.
3. Starter ve Pro/Business yoklama/kapanış/bağlı düzeltme ile ücretli anlaşma/hakediş uygulandı. Belge kapıları P05 ile uygulandı; otomatik başlangıç gözlemi ve diğer hak değişikliği koruma tüketicileri kendi kapsamlarında izlenir.
4. P02 paket dondurma/uzatma/değişim/yenileme/sonlandırma tamamlandı; P03 finans düzeltme/iade çiftleri tamamlandı; genel iade private.p02_sale_settlements ve önceki borç/alacak hareketlerini tüketerek çift alacağı engelliyor.
5. Hesap erişimi geri alma, hesap/organizasyon kapanış/silme ve kişi birleştirme.
6. CRM, bildirim tercihleri ve belgeler P04/P05 kabulünde; rapor, import ve izleme P06 kabulünde. Hosted worker işletimi OPS-W01'dir.

Her yeni runtime/CI grubu: sözleşme/izin incelemesi → gerekli yeni migration → geliştirmede hedefli gerçek Auth/API kabulü (sınır, yetki, tekrar, yarış, rollback) → son inceleme → açık aday full clean → merge → main full clean. Güvenli yalnız-belge kabul yolu CI-02 ile kuruldu; full clean’den ayrı kaynak bağlı kabul kullanır. Ürün kararında boşluk varsa teknik varsayımla yeni kural eklenmez.

## P03 bağımsız inceleme takip notu

Bloklayıcı sayılmayan doğrulama iyileştirmesi: instructor_payment_record_v1 tutarı karşılandıktan sonra kullanılmayan trailing earning_ids satırlarının kişi/merkez/para birimi kontrolü atlanabiliyor. Fiilen yazılan allocation’lar kapsamlıdır; inceleme başka kapsama yazma veya para sızıntısı bulmadı. Tüm seçili listeyi allocation’dan önce doğrula ve karışık kapsamlı kullanılmayan son ID regresyonu ekle. Kaynak review5594023911; P03 kabulünü veya diğer59 contract_only API’yi değiştirmez. Henüz düzeltilmiş sayılmaz.

## Yalnız sözleşme envanteri — adayda22 işlem

Kabul edilmiş P05 main165 runtime/35 contract_only taşır. P06 kabul edilmiş main178 runtime/22 contract_only taşır. P07 kapsamı:

| İşlem | İzin |
|---|---|
| account_profile_update_v1 | account.self |
| account_password_change_v1 | account.self |
| account_password_reset_request_v1 | auth.recover |
| account_delete_preview_v1 | account.self |
| account_delete_apply_v1 | account.self |
| organization_close_preview_v1 | org.owner |
| organization_close_apply_v1 | org.owner |
| organization_reopen_v1 | org.owner |
| organization_delete_preview_v1 | org.owner |
| organization_delete_apply_v1 | org.owner |
| account_access_revoke_v1 | invite.student |
| account_link_remove_v1 | center.manage |
| person_merge_preview_v1 | person.merge |
| person_merge_approve_v1 | person.merge |
| person_merge_apply_v1 | person.merge |
| subscription_upgrade_quote_v1 | subscription.owner |
| subscription_downgrade_request_v1 | subscription.owner |
| subscription_change_cancel_v1 | subscription.owner |
| subscription_renewal_set_v1 | subscription.owner |
| saas_grace_extend_v1 | saas.operator |
| privacy_execute_v1 | system.worker |
| subscription_boundary_apply_v1 | system.worker |

## Operasyonel kabul işleri

- OPS-W01: Supabase Cron hedefi seçildi; native dedicated kimlik, heartbeat, açık tenant binding/config ve kesinti sonrası lease toparlanma kaynak/hosted kabulü; P07 öncesi.
- Ortak test backend’i kuruldu; frontend’in gerçek bağlantı/iş akışı kabulü açık.
- Dış e-posta ertelendi; uygulanmış değildir, Resend entegrasyonu başlatılmayacak. Yerel Mailpit kabulü dış teslim kanıtı değildir.
- Yük, yedek ve geri yükleme doğrulaması.
- Production hazırlığı ve ayrı dağıtım yetkisi. Main merge production izni değildir.

Bu maddeler ve yalnız sözleşme işlemleri kapanmış sayılmaz. Frontend tasarımı ayrı alan sahibindedir.

[P01 devri](p01-handover.md): uygulama main’de; gerçek main sonucu ve hosted worker işletim sınırı güncel devirde ayrıdır.


## Geliştirme CI süresi

P02 kaynak modülleri hedefli profil haritasında tanımlı olmadığı için39448566998 güvenli fallback ile15 API suite’inin tamamını seri çalıştırdı (43:33). Dar ve kanıtlı P02 seçici profili ayrı CI bakımı olarak açıktır; güvenilir politika kurulumu için önceki tek seferlik izinler yeniden kullanılamaz. Test kapsamını azaltmak veya hosted smoke’u full clean yerine geçirmek çözüm değildir.

## P08 — Geliştirmeler

[Üretim kuyruğundaki P08](production-queue.md#p08--geliştirmeler): ayrı kadın/erkek kontenjanı, açık sınırsız etkinlik kapasitesi ve ders kredisi tüketmeden pakete bağlı ücretsiz etkinlik katılımı. Bu pakette4 ders/2 ay vardır; etkinlik tarihinde süre ve kullanılabilir ders hakkı birlikte geçerliyse Pratik katılımı dahildir. Hangisi önce biterse uygunluk kapanır. Ayrı4 etkinlik hakkı/sayacı talebi kaldırılmıştır; başka paketler için sayaç seçeneği ayrıca tartışılabilir. Etkinlik kontenjanı ayrılır/yoklama tutulur, ders havuzundan kredi ayrılmaz/tüketilmez. Paket hareketlerinde güncel uygunluk hesaplanır; kesin kayıt koruması ve yarışlar korunur. Şimdilik kontenjan20/100 tekrar; runtime terfisi yok. Kaldırılan “sonraki hafta” kuralı ve süresiz program açık listeye eklenmez.

Adlandırma düzeltmesi: “Pratik” etkinliğin adıdır; mevcut etkinlik modeli kullanılır. Ayrı pratik modülü/türü geliştirme işi yoktur.

P08 tartışılacaklar: sınırsız Business limitlerinde private.plan_limit ile kapalı PlanLimit API sözleşmesi arasındaki uyumsuzluk. Şimdilik kurulumda aktif öğrenci1000/eğitmen50/merkez5 kullanılır; sınırsız kullanım uygulanmış sayılmaz. Owner Auth e-posta onayı doğrulandı; Business fiyat/dönem/sonlu limit girdileri alındı, Business aylık/yıllık katalog sürümleri hosted oluşturuldu ve geri okundu; kullanıcının açık onayıyla organizasyon/owner bağlantısı ve1 Eylül2026–1 Eylül2027 aktif yıllık abonelik tek seferlik yönetici aktarımıyla oluşturuldu. Makbuz/audit ve tarihler/limitler/normal erişim geri okundu. Ödeme zamanı/referansı bilinmediğinden ayrı ödeme işlemi üretilmedi; tarihsel hak aktarımı API ödeme doğrulaması gibi gösterilmez. İkinci yönetici aktarımıyla2 merkez/oda kapasite50/1 disiplin/1 aktif öğrenci/3 yetki/2 kapalı sınıf oluşturuldu. Programlar100 tekrar ve20 kontenjan ile inactive; ürün kimliği inactive. Ürün sürümü, seans, satış, yoklama, eğitmen anlaşması ve etkinlik henüz yok: oda ücreti tercihi, gerçek dış mekân/etkinlik şartları ve P08 ders tüketmeyen etkinlik uygunluğu sınırı çözülmeden yayınlanmaz.

Hosted worker tenant kapsamları p01/p05/p06 için bağlandı; üç Cron5sn active ve üç lane healthy/idle/hata0 olarak doğrulandı. Kuyrukta iş0, gerçek iş yükü kabulü iddia edilmez. Worker kurulumu kapandı; P08 geliştirmeleri P07’ye dönmenin engeli değildir. Aktif geliştirme P07-B/C Draft PR40 içinde sürer.
