> Alan devri: teknik tüketim ve kaynağına bağlı eski kabul kayıtları. Güncel kaynak/CI/hosted durum [00 devirde](contracts/00-FtkSaaS-yeni-sohbet-devir.md), açık iş [tek backlog’da](remaining-work.md) tutulur. Eski aday/pending ifadeleri yeni görev veya güncel durum değildir.

# P06 — rapor, CSV import ve sonuç kurtarma

P06 **done (kod, main ve geliştirme/test kabulü)**: [PR38](https://github.com/SXQHex/FtkSaaS/pull/38), main `006ad36918ae823bc10fbdefa2d48901e193121c`;200 sözleşme/178 runtime/22 contract_only,54 migration/90 core tablo. Son headf2f9d6c/base8364144/tested merge1901fc6/treeb486ffe; bağımsız review5614150102, [aday39779013518](https://github.com/SXQHex/FtkSaaS/actions/runs/39779013518), [aynı main39782197422](https://github.com/SXQHex/FtkSaaS/actions/runs/39782197422) ve [CD39785146645 attempt1](https://github.com/SXQHex/FtkSaaS/actions/runs/39785146645) success. CD18 kontrol/54 içerik eşleşmesi/Edge7 ACTIVE/verify_jwt=true/RLS kapalı0/client RPC EXECUTE0 ve fixture temizliği geçti; receipt12428881259 SHA256 `bcd1ab3255c1808982de76c3d09d47d5eaa95c5fb2e8f9f870d3fedc9ce93b65`. Önceki aday hataları tarihsel kanıttır. Aktif OPS-W01 adayı Supabase Cron içindir;55 migration/aynı178 runtime, kaynak ve hosted işletim kabulü beklenir. Tenant config/binding uydurulmaz; P07 queued kalır.

Aşağıdaki geliştirme/aday-pending ve hata kayıtları tarihsel kaynak snapshotlarıdır; güncel kabul yukarıdadır. Hosted işletim OPS-W01 ayrı kalır.

Kaynak: `feature/p06-reports-imports`, taban kabul edilmiş main `83641447b29e459236aea1a9a4379b5d19825af6`. Durum **kod adayı; aynı kaynak aday/main clean ve development CD kabulü bekleniyor**.200 sözleşme/178 runtime/22 contract_only,54 migration/90 core tablo. P07'nin22 API'si yalnız sözleşmedir. P05/PR37'nin kabul ve CD receipt'i güncel devirde kapatıldı; bu eski başarı yeni P06 kaynağının kabulü değildir.

## Teslim edilen akış

- Rapor: `report_get_v1` → `report_export_start_v1` → dedicated `report_build_v1` → `report_file_get_v1` tanımı ve aynı authenticated POST ile CSV byte indirme. Sayfa limiti toplamı/exportu kesmez. Aynı key/payload aynı işi döndürür.
- Import: `import_upload_prepare_v1` → özel Storage signed upload → isteğe bağlı ortak `file_upload_complete_v1` → `import_preview_v1` teknik doğrulama işi → dedicated `import_rows_process_v1` → `job_status_get_v1.result_reference` içindeki preview → `preview_get_v1` → `import_apply_v1` → worker → `import_rows_list_v1`. Ortak file_upload_complete import ve document dosyalarını kendi güncel izinleri/Storage bucket'larıyla doğrular; belge yayını import dosyasına genişlemez. Signed upload write-only ve upsert=false; doğrudan client read politikası yoktur.
- Kurtarma: `operation_status_get_v1`, `preview_get_v1`, `job_status_get_v1` yalnız özgün işlemin canlı hesap/bağlantı/rol/merkez/alan/plan yetkisinde sonuç verir. Audit kapalı entity kataloğu ve güvenli diff alanları kullanır; token, iletişim ve ham payload açmaz.

## Rapor metrikleri

| report | group_key / ölçü |
|---|---|
| collections_debts | collections: bağlı düzeltmeler sonrası net kök tahsilat; refunds: nakit iade hareketleri; outstanding_debt: seçili vadelerde güncel kalan borç |
| lesson_attendance | attendance:result; aktif/tamamlanmış rezervasyonlar, kayıtsız sonuç unrecorded |
| renewal | renewed / expiring_unrenewed; aralıkta biten aktif/sona ermiş satış ve bağlı aktif yenileme |
| occupancy | planned/occurred seansların aktif/tamamlanmış rezervasyon sayısı; basis_count nominal kapasite |
| resource_usage | resource:kind:id; çakışan booking aralıkları birleştirilmiş saniye; basis_count yerel çalışma saatleri birliği eksi istisna saniyesi; hiç kullanılmayan tanımlı kaynak da sıfır kullanım gösterir |
| earnings | earning_accrual; kök hakedişin bağlı düzeltmeler sonrası güncel neti |
| crm_conversion | seçilen aralıkta açılan adayların dönüştürülmüş sayısı; basis_count toplam aday |
| cross_center_usage | outgoing_to / incoming_from; seçilen merkezin karşı merkezli accrual hareketlerinde güncel açık tutar. İki taraf seçildiğinde ayrı yön metrikleri, otomatik netleştirme yok |

Aralık `[starts_at,ends_at)` ve en çok366 gün; merkez/kişi/para birimi/kaynak durumu filtreleri projeksiyondan önce uygulanır. Sonuç grupları metrik/merkez/kişi/para birimi sırasında, desteklenen sayfa sort değeri created_at_asc'dir. Cursor aktör/istek/sıra/tam sonuç hash'ine bağlıdır; değişen sonuç VERSION_CONFLICT verir. Totals metrik ve para birimi bazında tam sonuçtur; para birimleri veya borç/tahsilat birbirine eklenmez. ratio_bps kullanım oranıdır; nominal kapasite aşımı için10000'i aşabilir, finansal RateBps değişmez. Sıfır paydada oran null/eksik kalır.

Starter temel tahsilat/borç ve ders/katılım; Pro operasyon raporları; Business çok merkez/birleşik ve çapraz merkez kapsamıdır. Finans alanı ayrıca finance.read; dışa aktarım ayrıca report.export ister. Dar CRM personeli toplu CRM export yapamaz. Owner/OM org okuyucusudur; import/merkez işlemleri için CM veya özel merkez override gerekir.

Rapor dosyası `core.files` + `private.p06_export_files` private DB byte nesnesidir; object_key Storage yolu değildir.7 gün sonra okunamaz; worker claim süresi dolmuş byte nesnelerini temizler. Descriptor'daki download_path bir yetki tokenı değildir. İndirme aynı request gövdesi ve güncel Auth ile POST yapar, cache-control:no-store döner. Başka hesap, geri alınmış izin, kapanmış merkez/plan ve süresi dolmuş dosya aynı linkle okunamaz. Teknik export byte sınırı aşılırsa iş hata verir; sessiz kesilme olmaz.

## Import kimlik ve mali kayıt

Kalıcı tekillik `(org_id,source_namespace,source_key)` üzerindedir. Yeniden yüklenen başarılı aynı payload eski typed referansları döndürür; kişi/aktif ilişki/satış/hak/borç yeniden oluşmaz. Aynı kaynakta farklı payload IDEMPOTENCY_PAYLOAD_MISMATCH olur. Hatalı/başarısız satır yeni önizlemeyle tekrar denenebilir. E-posta/telefon otomatik kişi birleştirmesi yapmaz; yalnız açık person_ref mevcut kişiyi seçer. Birden fazla contact eşleme kolonu korunur; mevcut kişinin bilgileri sessizce değiştirilmez. Yeni kişi için hesap/Auth/davet üretilmez.

Önizleme dosya hash'i, eşleme, kaynak, ilgili kişi/ürün/config/plan/izin ve satır sürümlerine bağlıdır. Preview.import_summary yeni kişi/tekrar/satır/kredi sayılarını, para birimi bazında açık borç ve özgün kredi bedeli toplamlarını ve mevcut negatif kredi miktarını ayrı gösterir. Apply güncel bağımlılık ve tokenı yeniden denetler; worker kuyruğunda ve batch aralarında dış değişiklik olursa PREVIEW_STALE verir, kendi başarılı batch değişiklikleriyle aynı atomik işlemde sonraki fence güncellenir. Worker her satırda canlı import/F07/aktif öğrenci tekil limiti ve ilgili ürün/mali/belge kapılarını yeniden denetler. Kişi, ilişki, açılış kredi ve borç tek satır alt işlemiyle oluşur; bir satır hatası o satırı geri alır. Batch sonunda audit/receipt/outbox hatası bütün batch'i geri alır.25 satırdan sonra kalanlar yeni lease ile devam eder. Başarılı satır tekrar uygulanmaz.

opening_credit_value_minor **özgün tam paket net bedelidir**; kalan miktarın yeni fiyatı değildir ve nakit üretmez. Kalan kredi özgün ürün kredilerini aşamaz. Açılış borcu ayrı, açık amount/currency ile core.debts'e girer; otomatik katalog fiyatı/borç/nakit üretilmez. Hak core.sales → entitlement_accounts → entitlement_movements içinde worker receipt ve kaynak referansıyla izlenir. Mevcut uygun negatif kredi açıkları kabul edilmiş satış sırasıyla geçmiş tüketim önce, gelecek rezervasyon sonra kapatılır; geçmiş yoklama/hakediş yeniden hesaplanmaz; uygun geç çapraz merkez tüketimi mevcut settlement_sync ile özgün kuruş dilimlerinden accrual üretir.

Geçmiş tüketim veya geçmiş kuruş dilimleri yeniden oluşturulmuş sayılmaz. Açılış kredi satırlarında none/credit_ratio iade yöntemleri desteklidir. used_at_unit_price/time_ratio geçmişi eksikse veya kısmi kalan kredi tutarı özgün krediye tam bölünmüyorsa POLICY_NOT_CONFIGURED: eksik geçmişten iade tutarı/kuruş sırası varsayılmaz. Bu durum satır sonucunda görünür; keyfi sıfır fiyat veya eski tüketim üretilmez.

## Kurulum ve worker

Migration `20261022090305_p06_reports_imports_tracking.sql`, p06 access/reports/imports/workers/tracking/bind/wrappers kaynakları ve manifest ile birebir bağlıdır. Eski53 migration değişmez. Private tablolar RLS açık/client grants yok; API RPC'leri service-only; insan JWT'si worker işlemi çalıştıramaz.

`private.p06_configuration` org başına **açık** max_import_bytes/max_import_rows/max_export_bytes ister. Eksik config POLICY_NOT_CONFIGURED olur.2097152 byte CSV,5000 satır ve16777216 byte export teknik tavanlarıdır; deploy'da tenant değerleri bu sınırlar içinde ayrıca seçilir. Sayısal iş/ücret politikası uydurulmaz. Bucket gerçek ingress tavanı2MiB/text-csv/private; dosyanın boyutu/MIME/SHA256/UTF-8 ve RFC4180 yapısı gerçek byte üzerinden denetlenir.

Dedicated LOGIN yalnız `ftk_p06_worker` üyeliği ve `private.p06_worker_scopes(db_role,org_id)` binding'i alır. Core/Auth/private tablo erişimi verilmez. `P06_WORKER_DATABASE_URL`, `P06_WORKER_ORG_ID`; bir kez `node scripts/p06-worker.mjs`, sürekli `node scripts/p06-worker.mjs --loop`. Loop varsayılan5sn, en az1sn; SIGINT/SIGTERM yeni tick'i durdurur.60sn lease, en çok3 art arda başarısız deneme/5sn retry; başarıyla ilerleyen batch hata sayacını sıfırlar. UUID bankı yalnız server'ın hesapladığı sınır içinde büyütülür. Eski lease/key/payload fenced; aynı başarılı lease replay yeni etkisizdir. Worker kimliği/tenant binding kaybı fatal; tek işin talep sahibi/plan yetki kaybı bounded job hatasıdır, diğer işleri durdurmaz.

Hosted işletim **OPS-W01**: hedef host ve dedicated secret sağlanmadı, worker kurulmuş/çalışıyor sayılmaz. P01/P05/P06 CLI'leri hazır olsa da süreklilik/kesinti/yeniden başlatma/lease reclaim/sağlık gözlemi ayrı ortam kabulüdür. P06 sonrası, P07 öncesi tamamlanır. DB boşluğu kurulum için tenant/limit hedefi uydurma gerekçesi değildir.

## Doğrulama ve kabul sınırı

Yerel `npm run verify`:100 yapı/sözleşme +43 CI politikası geçti; frozen migration/generation/audit/governance/TypeScript denetimi dahil. Full clean/main clean veya CI trusted policy kapsamı değiştirilmedi. Parser gerçek RFC4180/multiline/escaped quote/duplicate header/map, UUIDv4 mevcut referans, para overflow ve private gerçek byte/hash sınırlarını sınar.

Geliştirme sırasında alınmış kaynak snapshotlarında hosted DB'de yalnız BEGIN/ROLLBACK ile P06 kaynağı kurulup gerçek dispatcher/worker çalıştırıldı:28 satır,2 preview/apply batch, replay tekilliği, kişi/borç önizlemede oluşmaması, config-stale apply reddi, açılış3 kredi +200 borç/nakit0, geç audit hatasında bütün açılış batch rollback ve yeniden claim, sayfadan bağımsız tam CSV, audit/management ve link geri alma reddi.20 gerçek yanıt projeksiyonu ve WorkerResult üretilmiş Edge success validator'larından geçti. Bu sentetik SQL denemeleri son SHA kabulü değildir; gerçek Auth/Storage/Edge clean testinin yerine geçmez. Uzak53 migration/Edge6 korunmuştur; P06 kalıcı yayımlanmadı.

Gerçek Auth/özel Storage/Edge/dedicated DB LOGIN kabulü `apps/backend/tests/p06-acceptance.mjs` içinde mevcut registry shard'ına bağlıdır; ayrı15. suite veya yeni shard yoktur. Final bağımsız inceleme, açık aday full clean, aynı merge/main clean ve development CD henüz beklenir. Bu kanıtlar tamamlanmadan P06 done değildir. Clean başlayınca izleme durur, kullanıcıya kaynak/run ile devir yapılır.

### İlk aday clean ve fixture düzeltmesi

PR38 head28267a2b060236f944697bf1e44c62281c6cb9af / aday39770432753 başarısızdır: core ve API1/2/4 geçti, API3 P06 kabulünde kaldı. operation_status_get kapalı istek şemasına test yardımcısı center_id eklemişti; ilk önizleme testi kesilince apply/dedupe/export/negatif bakiye bağımlı kontrolleri de düştü. Ayrıca doluluk fixture'ında merkez-disiplin ilişkisi eksikti ve PostgreSQL bigint attempts dönüşü string iken sayı bekleniyordu. Düzeltme yalnız geçerli istek/ilişkisel fixture ve açık int cast'idir; iş beklentileri, assertion'lar, runtime, migration ve full/main clean kapsamı korunur. Yeni kaynak için yeniden bağımsız inceleme ve tam aday kabulü gerekir.

İkinci aday39773000797 / head330c770bf1dc8dd579a283b7ac9f573a0b4f4aa1 yalnız çapraz merkez rapor assertion'ında başarısız oldu; diğer P06 akışları, core ve API1/2/4 geçti. Kök neden gerçek SQL değişken/kolon çakışmasıdır: `#variable_conflict use_column` altında `kind` rapor seçicisi settlement/cash tablolarındaki `kind` kolonuna bağlanıyordu. Rapor seçicisi `report_kind` yapıldı; tablo discriminator'ları aynı kaldı. Çapraz merkez beklentisi korunur; ayrıca gerçek tahsilat150/iade20 ile ayrı rapor toplamları kontrol edilir, sentetik nakit satırları hemen temizlenir. Son kaynak full/main/CD kabulü hâlâ beklenir.

Düzeltmenin odaklı gerçek Postgres17 rollback denemesi geçti: yalnız A merkezi seçiliyken B'ye100 çapraz accrual görünür; tahsilat150 ve iade20 ayrı satır/toplam girdileri döner. BEGIN/ROLLBACK nedeniyle kalıcı P06 DDL/veri/migration uygulanmaz. Yerel100 yapı/sözleşme +43 CI politika kontrolü tekrar geçti.

Üçüncü aday39775601853 / head3a72dd8611c79c6c5efb4188647c56bd0f3f2455 rapor beklentilerini geçti, fakat yeni nakit fixture'ının DELETE temizliği append_only korumasınca INTEGRITY_VIOLATION ile doğru reddedildi; kalan2 sentetik satır sonraki sıfır-nakit kontrolünü etkiledi. Test düzeltmesi nakit kontrolünü bütün sıfır-nakit/import kontrollerinden sonraya taşır ve DELETE'i kaldırır. Değişmez ledger korunur; sentetik satırlar yalnız izole disposable clean DB'sinde kalır ve stack teardown ile gider. Önceki rapor/export borç2900 ve sıfır-nakit beklentileri değişmez; sona taşınan nakit testi negatif kredi senaryosunun açık100 borcundan sonra toplam3000 bekler. Tahsilat150 ve iade20 beklentileri korunur; runtime/migration/CI politikası değişmez. Önceki “hemen temizlenir” açıklaması hatalı test hazırlığının tarihsel beyanıdır, kabul kanıtı değildir.
