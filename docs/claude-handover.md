# FtkSaaS backend — Claude devri · 0.2.0-rc.3

Kalıcı kaynak: https://github.com/SXQHex/FtkSaaS · dal: `main` · inceleme: https://github.com/SXQHex/FtkSaaS/pull/4. Frontend tasarımı ve bileşenleri değiştirilmedi. Bu sürüm geliştirme kabulüdür; ürünün 184 operasyonunun tamamının veya üretim dağıtımının bittiği iddia edilmez.

Güncel fiilî başlangıç aktarımı: `docs/actual-start-handover.md`, `reports/actual-start-verification.json` ve PR #4 son commit CI. Temiz kabul: 148 test, 11 migration. Aşağıdaki eski RC3 sayıları/raporları tarihsel snapshot'tır; güncel envanter 55 çağrılabilir / 129 yalnız sözleşmedir.

## Çalışan kapsam

55 çağrılabilir gateway/named RPC; 129 işlem yalnız sözleşme. Tam liste ve kapsam sınırları: `docs/endpoint-inventory.json`. `contracts/05-FtkSaaS-O4-API-katalogu.md` her satırda durumu gösterir. Yalnız sözleşme olan bir işlem gateway’de `NOT_FOUND` alır.

| Alan | Çağrılabilir işlemler |
|---|---|
| Hesap/organizasyon | account_get, organizations_list, organization_create/get, platform_owner_set/remove |
| Merkez/yetki | center_create, centers_list, center_manager_assign/revoke, manager_self_assign_center, org_manager_assign/revoke, role_assign/revoke, permission_set |
| Kişi/davet | person_create, student_activate, account_access_send/accept |
| Disiplin | discipline_save, center_discipline_set |
| Abonelik | saas_payment_submit/verify, subscription_get |
| Hak/para | product_publish, sale_preview/apply, collection_record, entitlements_get, debt_adjust, student_credit_refund/offset |
| Ders yarışı için yazma | class_save, session_create, reservation_create/cancel |
| Etkinlik | event_save/publish/get/list, event_payment_prepare/get, event_registration_preview, event_register, event_registration_cancel, event_attendance_mark/close/correct, event_complete, event_actual_start_record/correct, event_duty_verify, event_cancel_preview/apply |

Tablodaki bütün adlar `_v1` ile biter. Dersin tam yoklama/hakediş, ödeme düzeltme, bekleme listesi, dosya upload/download, CRM, rapor/export, kullanıcı belge onayı ve bütün diğer işlemler envanterde ayrıca belirtilmedikçe **yalnız sözleşmedir**. Bu ekranda görünür bir butonun backend’i var sayılmamalı.

## Kurulum ve bağlantı

```sh
git clone --branch backend/runtime-v0.2.0 https://github.com/SXQHex/FtkSaaS.git
cd FtkSaaS
# Node 24.19.0; alternatif: repoyu Dev Container içinde açın.
npm ci
npm run dev:start
npm run dev:seed
npm run dev:info
npm test
```

Supabase CLI 2.121.0, PostgreSQL 17 native runtime, npm bağımlılıkları ve Dev Container taban imajı sürüm/hash ile sabittir. Native runtime experimental; yerel geliştirme içindir. Worker policy `oneshot`; npm bağımlılıkları istek sırasında çözülmez, Edge bundle içine önceden paketlenir. Portlar çakışmaması için dinamik seçilir. `dev:info` mevcut API/gateway, Studio ve Mailpit adresini ve yalnız publishable anahtarı gösterir; `.dev/frontend.env` içine yazar. Bunlar geliştiricinin kendi makinesi/container bağlantılarıdır; kalıcı paylaşılan internet endpoint’i değildir.

`dev:seed` yalnız sentetik `@ftksaas.invalid` kullanıcıları ve örnek ticari yapılandırma üretir. Yerel giriş e-posta/parolaları ile org/merkez/disiplin/kişi ID’leri `.dev/development-users.json` içindedir; git’e girmez. Fiyat/limitler ürünün ticari varsayılanı değildir. Production veya başka projeye bağlanan seed/test kabul edilmez. Davet testi yerel Mailpit SMTP’ye teslim eder; gerçek e-posta sağlayıcısı kurulmuş değildir.

Çalışma Box’ı süreli ve yeniden üretilebilirdir. Repo/CI/kurulum kodunun kalıcılığı Box’ın ömrüne bağlı değildir. Yerel veritabanını sıfırlamak için, yalnız sentetik geliştirme verisinin bulunduğu kendi ortamınızda `npx supabase db reset --local --no-seed --yes` çalıştırıp yeniden seed edin. Bu komut yerel veriyi siler.

## Frontend çağrı sözleşmesi

1. Supabase Auth ile giriş yapın; provider access token’ını alın. Hesap e-postası doğrulanmış olmalı.
2. `POST {API_URL}/functions/v1/backend-v1/{operation}` çağırın. JSON gövdesi doğrudan ortak Request tipidir; dış `p_request` sarmalı yoktur.
3. Header: `Authorization: Bearer <access_token>`, `apikey: <publishable key>`, `Content-Type: application/json`.

Ortak tipler: `packages/contracts/src/generated.ts`, operasyon eşlemesi `operations.ts`, çağrılabilir adlar `runtime.ts`, tipli adapter `client.ts`. `createBackendClient` transport hatasında `BackendTransportError` fırlatır; domain hataları `{ok:false,error:SafeError}` biçimindedir. Başarı `{ok:true,data,trace_id}`. Bazı domain hataları HTTP 200 zarfıyla döner; her zaman `ok` denetlenmeli.

```ts
import { createBackendClient } from '@ftksaas/contracts/client';
import { v7 } from 'uuid';
const api = createBackendClient({
  functionsUrl: connection.functions_url,
  publishableKey: connection.publishable_key,
  getAccessToken: async () => (await supabase.auth.getSession()).data.session?.access_token ?? null,
});
const result = await api.call('event_get_v1', {
  client_api_version: 1, request_id: v7(), org_id, center_id, event_id,
});
```

Paket tüketen yeni kayıt kimlikleri frontend’den gelmez. `request_id` ve mutasyon `operation_key` için `uuid` v7 kullanılır. Tek kullanıcı işleminin retry’ında aynı `operation_key` korunur; `request_id` yenilenebilir. Transport sonucu belirsizken yeni anahtar kullanmak yeni iş yaratabilir. En fazla üç otomatik retry; domain retryable=false sonucunu körlemesine tekrar etmeyin. 30 günlük receipt sonucu sona erse de eski anahtar yeni iş başlatmaz.

Supabase `/rest/v1/rpc/<operation>` yolu **backend içidir**. Actor/session ve ID bankasını frontend göndermez. Service-role anahtarı, DB URL/parolası veya sentetik kullanıcı parolası frontend public env’e konmaz.

Schema ile doğrulanmış JSON örnekleri: `examples/runtime-requests.json`. Bağlantı üretim bilgisi: `docs/development-connection.json`; yeni kurulumda `dev:info` çıktısı esas alınır.

## Etkinlik örnek akışı

`event_save` tek transaction’da etkinlik + UUID disiplin etiketleri + görevler + kaynak rezervasyonlarını oluşturur/günceller. Güncellemede `event_id/expected_version` zorunludur. Mevcut hakları bozan zaman/etiket değişikliği atomik reddedilir; mevcut katılımcılar otomatik iptal edilmez. Görev ücretinde ücretsiz değer açık `"0"` olmalıdır.

`event_publish` sonrasında `event_get` güncel version ve typed koşulları verir. `registrations` alanı yönetici/org okuyucusu veya güncel atanmış görevli için gerekli katılımcıları; öğrenci için yalnız kendi kayıtlarını içerir. `duties` yönetici/org okuyucusuna görev ID/sürüm/ücretlerini, ilgili kişiye kendi görevini verir. Böylece mark/cancel/correct ve duty verify için DB’ye erişmeden güncel ID/sürüm alınır. Liste projeksiyonu dar tutulur; `event_list` sıralaması `starts_at_asc`, cursor aynı filtreyle kullanılır.

`event_registration_preview` etkisiz uygunluk incelemesidir. Apply karşılığı `event_register` isteğinde `preview:{id,token}` geçirilebilir. Actor/scope, event ve entitlement-account sürümü değişirse `PREVIEW_STALE`; bakiye/kota/kapasite/yetki/abonelik daima güncel transaction’da yeniden kontrol edilir. `sale_id` açıkça seçilen paket yoludur; verilmezse manuel etkinlik koşulları uygulanır.

Kayıt katılımcı/işletme iptalinde aynı allocation üzerinden serbest bırakılır veya sabitlenmiş koşul tüketme gerektiriyorsa tüketilir. Taslak mark hak tüketmez. `event_attendance_close` bütün aktif sonuçlar girildikten sonra CM tarafından tek transaction’da kapatır; `expected_version` gerekir. Gerekçeli correction geçmiş hareketi silmez, linked reverse/yeni hareket ekler. `event_complete` gerçekleşme bilgisidir; duty ücreti ayrıca gerçekleşme + CM `event_duty_verify` ile oluşur. Katılım kapanışı ile görev hakedişi birbirinden ayrıdır.

## Karar ve teknik kapsam sınırları

**Q-E01 teknik aktarımı bu sürümde uygulandı.** Bağlayıcı kaynak docs/decisions/Q-E01-accepted.md; kapsam/kanıt docs/decisions/Q-E01.md ve reports/qe02-verification.json. Q-E02 son kabul bu eski engeli kaldırır: merkez iptali draft/published/occurred durumlarında tam finansal hesaplaşma ve tam hak dönüşü yapar. Fiilî başlangıç/kısmi gerçekleşmenin ayrı kaydı tanımlı değildir; saat geçmesi gerçekleşme sayılmaz ve tanım konusu açık kalır. Katılımcının kendi iptalindeki yeni parasal formüller bu kararla eklenmez. Q-D01'in ortak pozitif hak ve negatif etkinlik kredisi yasağı korunur.

Merkez ve organizasyon liste projeksiyonları şu aşamada tek sayfadır; event listesi gerçek cursor kullanır. Dev seed’deki ticari sayılar/izinler yalnız test fixture’ıdır. Gerçek sağlayıcı e-posta teslimi, dosya saklama/indirme, hukuki onay, dış ödeme sağlayıcısı, ölçek/yük ve yedekten geri yükleme kabulü bu sürümde tamamlanmış sayılmaz. Bu işler için henüz uygulanmayan özelliklere frontend’den dayanak oluşturulmamalı.

## Doğrulama ve çalışma düzeni

Güncel kabul kanıtı reports/qe02-verification.json ve reports/qe02-acceptance.log; CI her commit için ayrıca denetlenir. Testler eski son hak/kapasite/tenant/rol kabulünü ve Q-E01 ödenmiş hazırlıkların son kontenjan yarışı ile finansal rollback senaryolarını içerir.

Önce org kilidi, ardından ilgili kaynak/hak satırları tutulur. Bu kaba kilit rol iptali ve bütün ortak havuz mutasyonlarını sıralar; yük testi sonucu değildir. Domain + allocation/ledger + receipt + audit + outbox tek commit’tir. UUID bankası tükenirse transaction tümüyle rollback olur; gateway aynı işlem anahtarıyla daha geniş doğrulanmış UUIDv7 bankasıyla tekrarlar. Defter/audit güncellenemez veya silinemez; düzeltmeler linked kayıtlarla eklenir.

Yeni değişiklik ayrı migration ve branch/PR ile yapılmalı. `npm run generate` ortak tipleri, yalnız ihtiyaç duyulan şemaları, önceden derlenmiş validatorları, npm bağımlılıksız Edge bundle’ını ve katalogları üretir; `npm run verify` drift’i reddeder. `scripts/*historical*` ve `transfer_contract.py` geçmiş aktarım kaydıdır; güncel sözleşmeyi yeniden üretmek için çalıştırılmaz. Frontend tasarımı Claude’un alanıdır.

## Temiz kabulü yeniden çalıştırma

Node 24.19.0 ile npm ci ve npm run test:clean. Yalnız checkout'a ait loopback DB'deki sentetik veriyi siler; sekiz migration geçmişini ve boş tenant/Auth durumunu denetler. Sonra 20 statik kontrol, 12 sözleşme, 27 DB ve 85 gerçek Auth/API testi, seed ve sağlık kontrolü çalışır. CI aynı komutu kullanır. Reset logu .dev/clean-reset.log paylaşılmaz. Güncel kanıt: reports/qe02-verification.json ve reports/qe02-acceptance.log. Önceki verification/resumed raporları tarihsel snapshot'tır.

## Q-E01 entegrasyon akışı

1. Ücretli, manuel ve tam ödeme şartlı etkinlikte event_payment_prepare_v1 çağırın (event_id/person_id). Sonuç EventPaymentPreparationView: id, debt_id, paid_minor, remaining_minor, state, registration_id, credited_minor, student_credit_available_minor ve sabitlenmiş terms. Hazırlık kesin kayıt/yer ayırma değildir. Açık hazırlık/borç farklı anahtarla tekrar oluşturulmaz; mevcut kayıt döner.
2. collection_record_v1 içinde debt_ids:[preparation.debt_id] kullanın. Başka borca bağlı veya dağıtılmamış tahsilat bu hazırlığın tam ödeme şartını karşılamaz. Para birimi/kişi/merkez farklı borç reddedilir. Mevcut açık yetkili indirimler güncel borç hesabına dahildir.
3. event_payment_get_v1 (preparation_id) güncel finans durumunu verir. event_registration_preview_v1 isteğine preparation_id eklenebilir; sale_id ile birlikte gönderilmez.
4. event_register_v1 isteği event_id/person_id/preparation_id taşır; aynı kullanıcı işleminin retry'ında operation_key korunur. Sonuç EventRegistrationResult union tipidir. **data.outcome mutlaka kontrol edilir.**
5. outcome=registered ise primary_id kesin kayıt ID'sidir; ikinci borç veya tahsilat oluşturulmaz. outcome=capacity_closed ise kesin kayıt yoktur: preparation_id/debt_id, remaining_removed_minor/student_credit_added_minor/currency döner. Hazırlık kapanmış, borç ters kaydı ve yalnız daha önce alacaklaştırılmamış tutar aynı transaction'da kaydedilmiştir. Bu ok:true sonucu kayıt başarısı olarak gösterilmemeli; finansal kapanışın başarıyla kaydedildiğini belirtir.
6. event_cancel_preview/apply, her aşamada merkez iptalinde tüm ilgili borçları/ödenmiş tutarları/önceki indirim ve alacakları hesaba katar. Önizleme effects.reason=remaining_debt_removed ve student_credit_added parasal tutarlarını; release hak miktarlarını ve close hazırlıkları gösterir. Finans veya event bağımlılıkları değişirse PREVIEW_STALE. Önizleme varken ödeme sonradan değişirse yeniden önizleme gerekir; bu arada otomatik iade yoktur.
7. student_credit_refund_v1 açık nakit iadedir; student_credit_offset_v1 açık borç mahsubudur (expected_version ilgili debt sürümüdür). Otomatik nakit iade/başka borca dağıtma yapılmaz. debt_adjust_v1 gerekçeli append-only düzeltmedir; terminal etkinlik borcu yeniden açılmaz. Hepsi mevcut merkez/kişi/para birimi ve alacak bakiye sınırlarını kullanır.

Önizleme süresi/sürümü eskiyse kayıt PREVIEW_STALE dönebilir; bu sonuç finansal kapatma değildir. Güncel önizleme/yeniden doğrulama gerekir. Önizleme olmadan da kayıt güncel kapasite ve ödemeyi transaction içinde denetler. Kaynak borç başına daha önce oluşturulmuş refund_claim_add toplamı, sonradan nakit iade edilmiş veya mahsup edilmiş olsa bile yeniden üretilmez.

Yeni işlemler de aynı POST gateway/gerçek Auth/service-only RPC yolundadır. İstek örnekleri examples/runtime-requests.json, iki farklı kayıt sonucu examples/event-payment-results.json içindedir; hepsi kapalı şemayla doğrulanır. Frontend tasarım veya bileşen değişikliği yapılmadı; burada yalnız entegrasyon sözleşmesi tanımlanır.


## Q-E02 — son iptal kabulü / entegrasyon

Önceki “başlama sonrası merkez iptalinde iade yok / borç korunur” hükmü yürürlükten kalkmıştır.
- Katılımcı: event_registration_cancel_v1, aynı anahtar/expected_version kuralları. Parasal defter değişmez; mevcut terms_snapshot cancellation koşulları paket hakkına uygulanır. Bu parasal karardan yeni paket şartı çıkarılmaz.
- Merkez: event_cancel_preview_v1 → event_cancel_apply_v1. Merkez yetkisi şart; öğrenci kendi etkinliğini iptal edemez. draft/published/occurred kabul edilir. Mevcut occurred ve yoklama delilleri silinmez.
- Önizleme effects: remaining_debt_removed, student_credit_added; ayrılmış hak için release, tüketilmiş için reverse (quantity tam hak miktarı); hazırlık için close. reverse UI'da nakit iade anlamına gelmez.
- Apply tüm etkinlik kayıtlarını kapsar; daha önce kendi kaydını iptal etmiş kişinin tüketilmiş hakkı da tamamen döner. Önceden iade edilmiş/alacaklaştırılmış/mahsup edilmiş tutarlar tekrar üretilmez. Paket satış borcu ve başka etkinlik borcu değişmez.
- Tüketim linked previous_id reverse + release hareketiyle geri döner. Aynı hak için parasal alacak yok; zaman/haftalık kota da serbest kalır. Katılım geçmişi ve doğrulanmış görev hakedişi bu kararla değiştirilmez.
- İptal edilen etkinlikte yoklama kapatma/düzeltme tekrar hak tüketemez. Veri/yetki değişmişse PREVIEW_STALE/FORBIDDEN; istemci yeni önizleme alır, aynı kullanıcı işleminde operation_key korunur.
- Nakit refund ve offset ayrı açık yetkili işlemlerdir. Apply otomatik nakit çıkışı/mahsup yapmaz.

Fiilî başlangıç/kısmi gerçekleşme tanımı Q-E02 karar kaydında açık. Testler geçmiş planlı zamanı fiilî başlama diye sunmaz; ayrıca mevcut event_complete ile explicit occurred ve event_attendance_close ile gerçek tüketim yolları doğrulanır. Tanımlanmamış başlatma işlemi tamamlandı sayılmaz.

53 çağrılabilir geliştirme işlemi / 129 yalnız sözleşme değişmedi. Üretim, kalıcı ortak staging, dış e-posta, yük/restore ve frontend gerçek entegrasyon kabulü bu teslimle tamamlanmaz.

RC3 temiz kabul: Node 24.19.0, 8 migration, 20 tutarlılık kontrolü, 124 test (12 sözleşme + 27 DB + 85 gerçek Auth/API). Yeni Q-E02 grubu 25 senaryo; ayrıca gerçek öğrenci oturumuyla 3 iptal senaryosu. Effect.action artık reverse içerir; ortak tipleri yeniden üretin ve bu önizleme eylemini açıkça karşılayın. CI/review son commit için ayrıca denetlenir.

Production dağıtımı yasağı: PR üzerinde etkin Vercel Git bağlantısı gözlendi. vercel.json git.deploymentEnabled.main=false, main merge ile otomatik deployment oluşmasını engeller. Bu ayar production dağıtım izni değildir; frontend tasarımını değiştirmez. Kaynak: https://vercel.com/docs/project-configuration/git-configuration

## RC3 düzeltmesi — tahsilat / merkez iptali yarış kabulü

Merge sonrası main CI #38820160639, tahsilat–iptal testinin yalnız bir işlem sırasını kabul eden yanlış beklentisini ortaya çıkardı. Teknik sözleşme bölüm 8'deki fazla tahsilat kuralı korunur: merkez iptali tamamlandıktan sonra kaydedilen gerçek tahsilat borcu yeniden açmaz; dağıtılamayan tutar source_cash_id bağlı surplus_add olarak öğrenci alacağına yazılır. İptalden önce borca dağıtılmış tahsilat ise source_debt_id bağlı refund_claim_add ile alacaklaşır. İki başarılı işlem aynı anda mümkün olabilir; bu tek başına mükerrer alacak kanıtı değildir.

400 tahsil edilmiş / 1000 bedelli etkinliğe 600 ek tahsilat örneği:
- İptal önce: borç 0; iptalden 400 refund_claim_add, sonraki tahsilattan 600 surplus_add; toplam alacak 1000.
- Tahsilat önce: eski iptal önizlemesi PREVIEW_STALE; finans hareketi/receipt yazılmaz. Yeni önizleme ile iptalden 1000 refund_claim_add; toplam alacak 1000.

Her iki sıralama, gerçek eşzamanlı API çağrıları ve aynı anahtarla tekrarlar ayrı denetlenir. Testler toplam nakdi, borç dağıtımlarını, alacak kaynaklarını ve defterlerin tekrarda değişmediğini kontrol eder. Ürün, API, tipler ve sekiz migration değişmedi; 53 çalışan / 129 yalnız sözleşme işlemi envanteri korunur. Önceki RC3 kabul raporları tarihsel kanıttır; bu düzeltmenin CI sonucu ilgili PR ve son commit üzerinden ayrıca doğrulanır.

## Q-E03 — planlanan başlangıç / parasal iptal sınırı

Katılımcı iptalinde planlanan başlangıç anı dahil sonrası parasal iade, borç indirimi veya öğrenci alacağı üretmez. Fiilî gecikme, sonradan gerçekleşme doğrulaması veya düzeltmesi bu sonucu değiştirmez. Öncesinde mevcut kabul edilmiş koşullar korunur; yeni iade formülü veya paket koşulu eklenmedi. Q-E02 merkez iptalinde gün/aşama bağımsız tam hesaplaşma aynen korunur.

`event_get_v1.data.registrations[].participant_cancellation` null veya `{cancelled_at, planned_starts_at, phase, rule}` döner. `phase`: `before_planned_start` / `at_or_after_planned_start`; `rule`: `planned_start_v1`. Alan opsiyoneldir (eski sonuçlarla uyum), güncel projeksiyon null/nesne döner. Zamanlar backend tarafından ortak kilit alındıktan sonra sabitlenir; istemci iptal zamanı, fiilî başlangıç veya phase gönderemez. Eski ve yalnız merkez tarafından iptal edilen kayıtlara zaman kanıtı uydurulmaz. Başarılı snapshot değiştirilemez; rollback ve replay aynı transaction/receipt kurallarındadır. Paket tüketim sınırı mevcut terms_snapshot cancellation koşulundan gelir; parasal phase'den türetilmez.

Planlanan saatin gelmesi state=occurred, yoklama, hak tüketimi veya hakediş yazmaz. Ayrı fiilî başlangıç kayıt/düzeltme API'si mevcut değildir ve bu teslimle eklenmez; geç `event_complete_v1` doğrulamasının önceki parasal sınıflandırmayı değiştirmediği sınanır. Q-E02'de açık bırakılan parasal başlangıç sınırı bu kararla kapalıdır; operasyonel fiilî başlangıç/kısmi gerçekleşme kaydı ayrı kapsamdır.

Dokuzuncu migration karar kanıtını ekler; onuncu migration incelemede bulunan transaction-start / post-lock saat farkını düzeltir. Paket cutoff formülü değişmez; aynı post-lock cancel_at ile değerlendirilir. Önceki migrationlar değişmez. Envanter 53 çağrılabilir / 129 yalnız sözleşme; frontend, üretim, dış e-posta, kalıcı staging ve yük/restore kabulü bu aktarımla tamamlanmaz. Q-E03 kanıtı: `reports/qe03-verification.json`; önceki RC3 raporları tarihsel kalır.

## Fiilî başlangıç açık işi

`event_actual_start_record_v1` ve `event_actual_start_correct_v1` eklendi. Ortak tipleri yeniden üretin; request alanları, sürüm/tekrar/yetki kuralları ve read projection `docs/actual-start-handover.md` içindedir. `actual_started_at` yalnız operasyonel kanıt; Q-E03 parasal başlangıç sınırını ve Q-E02 iptal hesaplaşmasını değiştirmez. Gerekçeli eski/yeni değerler mevcut append-only audit defterinde kalır. Yeni tablo veya kullanıcı rolü eklenmedi. Güncel envanter: 55 çağrılabilir / 129 yalnız sözleşme. Fiilî başlangıç API'sinin teknik kapanışı için son commit'in temiz CI sonucu esas alınır.
