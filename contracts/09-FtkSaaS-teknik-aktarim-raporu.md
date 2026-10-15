> **Tarihsel 2.2-tech.1 raporu.** Q-D01 bu rapordan sonra kabul edildi ve teknik aktarımı ilerletildi. Güncel rapor 11 dosyasıdır; buradaki açık ürün kararı ifadeleri tarihsel kayıttır.

# FtkSaaS — Teknik aktarım ve izole ortam raporu

15 Ekim 2026 · kaynak ürün sözleşmesi v2.2 · teknik uygulama revizyonu 2.2-tech.1.

D01–D09 ve U01–U08 fiziksel sözlüğe, iki SQL migration’a, API kataloğuna ve üretilen ortak tiplere aktarıldı. Genel backend uygulaması tamamlanmadı. Frontend dosyası oluşturulmadı/değiştirilmedi; eski studioSaaS incelenmedi ve kullanılmadı.

## Somut çıktılar

| Alan | Sonuç |
|---|---|
| Fiziksel temel | 88 private core tablo; 85 kaynak + disciplines, center_disciplines, person_disciplines |
| Migration | 20261015152146_discipline_uuidv7_baseline ve 20261015153414_discipline_reference_integrity; izole DB’de ikisi de kayıtlı |
| API kataloğu | 178 operasyon sözleşmesi; 174 kaynak + 4 disiplin yönetim/okuma operasyonu. Aktif domain endpoint sayısı 0 |
| Ortak tip | 690 JSON Schema tanımı; bunlardan TypeScript ve operation request/response eşlemeleri üretildi |
| UUID eşlemesi | 1.487 UUID referans yolu, üretim/kabul/sağlayıcı ayrımıyla |
| Repo | Yeni bağımsız local git repo; backend/discipline-uuidv7 branch. GitHub remote/PR/CI bağlantısı henüz seçilmedi |
| Üretim | Bağlanılmadı, migration/merge/deploy yapılmadı |

## Doğrulama kanıtı

- 17 statik tutarlılık denetimi geçti: tam JSON Schema 2020-12 meta-schema, bütün tanımların validator derlemesi, ref/FK/izin/hata closure, kapalı nesneler, UUID alan haritası, tip–fiziksel kolon coverage, rol/özellik kapsamı ve private RLS/grants.
- 12 sözleşme/UUID testi geçti. UUID üreticisinde 20.000 örnek: v7/variant, yaklaşık zaman alanı ve tekillik. Bu test kriptografik denetim veya yük/yarış testi değildir.
- Gerçek PostgreSQL’de 10 DB alt testi geçti; Node runner üst test dahil 11 sayar. Toplam runner sayısı 23 passed, 0 failed.
- DB testleri: tenant dışı disiplin FK reddi, tek kişi/çok ilişki, aktif ilişki tekilliği, bağımsız merkez–disiplin override, seans–sınıf disiplini uyuşmazlık reddi, açık–rezervasyon–kişi–seans bağının doğruluğu, çift sayım reddi, dört fiziksel paket kapsamı, provider UUID koruma, üretici yokken kapalı default.
- Üretilmiş TypeScript typecheck ve scope discriminator olumsuz derleme örneği geçti. Generated-drift kontrolü var.
- Supabase security/performance advisors warn seviyesinde bulgu göstermedi. Bu, bütün iş izinlerinin uygulandığı anlamına gelmez: istemci core/private erişimi tamamen kapalı.
- Auth ve REST health: HTTP 200. Bunlar hesap/rol/iş akışı entegrasyon testleri değildir.
- Kanıtlar: reports/consistency.json, final-checks.log, all-tests.tap, db-probe.json, environment.json, advisors.json.

## UUID üreticisi — açık teknik sınır

uuid@14.0.3 v7() backend adaptörü seçildi ve test edildi; saat/rastgelelik override almıyor, v4 fallback yok. scripts/uuid.mjs, test/seed/worker/Edge kullanımının tek adaptörüdür. operation_key retry boyunca korunur. Dış Auth kimliği ve mevcut UUID değerleri yeniden yazılmaz; bearer tokenlar ayrı kalır.

Test edilen Supabase PostgreSQL 17.11’de native uuidv7 ve pg_uuidv7 extension yok. SQL varsayılanı bu durumda hata verir. SQL’de rastgele/timestamp birleştiren özel algoritma yazılmadı. Gelecek create rutinleri backend adaptöründen üretilmiş ID’yi almalı veya doğrulanmış DB üreticisi bağlanmalıdır; bu bağlama yapılmadan ilgili domain üretimi açılmayacak. Mevcut kurulum bunu tamamlanmış bir DB üreticisi olarak göstermiyor.

PostgreSQL 18’in native UUIDv7 desteği olduğu belgeyle doğrulandı; seçilen Supabase CLI native runtime 15/17 ile sınırlı olduğundan 18 çalıştırıldığı iddia edilmiyor.

## Karar sohbetine taşınacak yeni ürün konusu

**Q-D01 — Etkinlik disiplin sınıflaması ve dar kapsamlı hak eşleşmesi.**

Etkinlik tek disiplinli, çok disiplinli veya disiplinsiz olabilir mi? Çok disiplinli etkinlikte bir katılım hangi merkez–disiplin negatif kredi kapsamına yazılır? D03 normal ders/seansı belirliyor; etkinlik için aynı hükmü varsaymak doğru değil.

Etkilenen işler: disipline daraltılmış paketin etkinlikte kullanımı, etkinlik için negatif açık kapsamı. Bu yollar varsayımla açılmadı. Organization_all/center_all kapsamındaki açık event uygunluğu ve diğer mevcut event koşulları ayrı kalır. Q-D01 normal seans disiplin altyapısını engellemiyor.

## İzole geliştirme ortamı

- Upstash Box: present-bobcat-18604, ad: ftksaas-contract-dev.
- Ücretsiz ephemeral ortam. Otomatik silinme: 15 Ekim 2026 21:28:15 Europe/Istanbul. Kalıcı hosting/deployment değildir.
- Çalışma dizini: /workspace/home/FtkSaaS. Supabase native, PostgreSQL 17.11. Auth/REST çalışıyor; Storage/Functions/Studio lazy başlatma düzeninde, kendi health/iş akışı testleri henüz yapılmadı.
- Public preview açılmadı. Secretlar teslim arşivine/repository’ye alınmadı. Gerçek öğrenci/finans verisi yok; sentetik DB testleri rollback yapıyor.
- Yerel ilk deneme Docker yokluğu/kullanıcı değiştirme kısıtı nedeniyle başarısızdı; cloud ortamında gerçek kurulumla giderildi.
- Arşiv yeniden kurulum içindir; çalışan DB veya credential taşımaz. npm ci; npm run dev:start; npm test; npm run dev:health; npm run db:advisors. Default Docker yolu desteklenen makinede supabase start --runtime docker ile seçilebilir.
- Şema için core/private erişimi kapalı, api_v1 seçili. İş RPC’leri uygulanırken dar grants, güncel actor/tenant/merkez/plan kontrolleri ve gerektiğinde private privileged rutinler ayrı test edilecek.

## Tamamlandı sayılmayan işler

| Konu | Durum |
|---|---|
| D06/D08/D09 iş akışları | Ortak havuz kilidi, uygun kapsam filtresi, geçmiş→gelecek açık kapatma sırası, başlangıç snapshot ve no-retro-earning guardları katalogda; RPC uygulama/gerçek kabul testleri açık |
| D-A09 son ortak kredi yarışı | Çalıştırılmadı; private havuz ve lock sözleşmesi var, çalışan iş rezervasyon RPC’si yok |
| A01–A55 ve D-A01–D-A12 | Tam kabul paketi çalıştırılmadı; yalnız raporda açıkça listelenen altyapı alt testleri çalıştı |
| Yetki entegrasyonu | Owner/CM/OM, rol iptali, Auth sessions, student self ve assignment kapsamlı gerçek iş testleri açık |
| İş backend’i | 178 operasyonun iş rutini/Edge/worker uygulaması açık; katalog endpoint başarısı değildir |
| Veri kurtarma/işletim | Yük, gerçek restore/imha, RPO/RTO hedef ölçümü yapılmadı |
| Önceden açık kapılar | Hukuk uzmanı teyidi; ticari fiyat/limit ve politika konfigürasyonu; provider/secrets; repository/CI/kalıcı geliştirme ortamı seçimi |
| Merge/üretim | Somut kullanıcı onayı ve zorunlu kontroller olmadan yapılmaz |

Önceki 31 belge kontrolü ve 55 senaryo tarihsel envanterdir. Yeni gerçek doğrulama yalnız yukarıdaki kanıt kapsamındadır. Yeni ürün kararı Q-D01 dışında davranış varsayılmadı.

## Teknik kaynaklar

- Supabase native çalışma zamanı: https://supabase.com/docs/guides/local-development/docker-and-native-runtimes
- Çoklu/izole local proje: https://supabase.com/docs/guides/local-development/running-multiple-local-projects
- PostgreSQL UUID işlevleri: https://www.postgresql.org/docs/18/functions-uuid.html
- UUID kütüphanesi: https://github.com/uuidjs/uuid
- Supabase changelog ve 10 Kasım TLS değişikliği: https://supabase.com/changelog/cbc-tls-ciphers-deprecated
