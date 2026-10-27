# FtkSaaS — Q-D01 teknik aktarım raporu

15 Ekim 2026 · 2.2-tech.2. Bağlayıcı ürün kaynağı: 10-FtkSaaS-Q-D01-kabul-karari.md.

**Ürün kararı kapalı. Teknik aktarım kısmi:** şema, API/tip, kapsam filtresi ve pozitif hak kapısı uygulanıp sınandı; tam event kayıt/RPC entegrasyonu ve son ortak hak yarışı açık.

## Değişiklik

- core.event_disciplines eklendi. Etkinliğe 0/1/çok disiplin etiketi; UQ(org,event,discipline), event merkezine ve orga bileşik FK, aynı org disiplin FK. Center_disciplines kaydı etiketten dolayı zorunlu yapılmadı; etiket operasyon/paket erişimi vermez.
- Etkinlik yazma/okuma DTO'suna discipline_ids zorunlu dizisi, calendar/public projeksiyonuna disiplin listesi, event_list'e tek discipline_id filtresi eklendi. Boş dizi açıkça disiplinsiz etkinliktir; duplicate ve geçersiz UUID reddedilir.
- ProductScope, event uygunluğunu usage_targets ile ayrı tutar. SQL private.event_package_scope_matches tek etiketli etkinlikte aynı disiplini kapsayan dar veya uygun geniş scope'u; 0/çok etikette yalnız uygun geniş scope'u eşleştirir.
- class_id/event_id seçicilerinin AND kısıtı korunur. Yalnız event etiketi eşleşmesi scope yetmez; ders-only paket reddedilir.
- private.require_event_available_credit yalnız >=1 authoritative kullanılabilir hakkı kabul eden ortak kapıdır. 0/negatif/null ENTITLEMENT_UNAVAILABLE. Negatif limit argümanı/fallback yok. Bu helper bakiyeyi kendisi hesaplamaz, kilitlemez ve kredi ayırmaz.
- Makine katalog guardları Q-D01'e göre ayrıldı. Normal ders negatif-limit/tek disiplin guardları event yollarından çıkarıldı. Event listeleme gibi okuma işlemleri kredi ayırma guardına bağlanmadı.
- Önceki aktarımda eksik kalan EntityType enumu tüm 89 tabloya eşitlendi; disciplines, center_disciplines, person_disciplines ve event_disciplines artık ortak audit/preview referanslarında temsil ediliyor.
- Yeni rol/hata kodu veya ödeme davranışı eklenmedi. EventTerms, manuel tahsilat, geçerlilik, kapasite, plan/merkez izinleri, iptal/kapanış ve ortak satış havuzu kuralları korunuyor. Frontend değişmedi.

## Fiziksel ve tip envanteri

| Kalem | Güncel |
|---|---|
| Tablo | 89 |
| API operasyon sözleşmesi | 178; çalışan domain endpoint olduğu anlamına gelmez |
| JSON Schema tip tanımı | 692 |
| UUID alan yolu | 1.494; provider kimliği korunur, yeni üretim UUIDv7 |
| Migration | Önceki iki migration değiştirilmedi; 20261015160836_event_discipline_scope eklendi |
| Branch | backend/q-d01-event-scopes |
| Statik denetim | 19 passed |
| TypeScript | Üretim drift ve typecheck passed |
| Test toplamı | 39 passed, 0 failed: verify 12 + test:db 27; parent/container testler runner sayısına dahil |
| Advisors | warn/error seviyesinde bulgu yok |

## Q-D01 senaryo kanıtı

| Senaryo | Gerçekleşen doğrulama | Tam kayıt kabulü |
|---|---|---|
| A01 tek Salsa etiketi + event uygun dar paket | Gerçek DB scope filtresi true; dar center/org scope sınandı | RPC entegrasyonu bekliyor |
| A02 Salsa etiketi + lesson-only paket | Gerçek DB scope filtresi false | RPC entegrasyonu bekliyor |
| A03 iki etiket + dar paket | İki dar scope türü de false | RPC entegrasyonu bekliyor |
| A04 iki etiket + event uygun geniş paket | Center ve org geniş scope true; yanlış merkez false | RPC entegrasyonu bekliyor |
| A05 disiplinsiz + event uygun geniş paket | Geniş true, dar false | RPC entegrasyonu bekliyor |
| A06 hak yok + normal negatif izin | Private pozitif hak kapısı 0/negatif/null değerde ENTITLEMENT_UNAVAILABLE; request override kabul etmez | Authoritative bakiye hesabı + kayıt entegrasyonu bekliyor |
| A07 son ortak hak / iki eşzamanlı event kaydı | Çalıştırılmadı | Atomik kayıt/hak ayırma RPC'si henüz yok |
| A08 başka organizasyonun etiketi | Gerçek composite FK reddi; scope filtresi tenant dışında false | Fiziksel sınır doğrulandı; yetkili event_save yolu ayrıca bekliyor |

Test verisi sentetik ve rollback kapsamındadır. Scope helper yalnız kapsam boyutunu doğrular: plan/actor/merkez erişimi, event özel allowed_product_version_ids ve ödeme koşulları, zaman, kapasite, kullanılabilir hak ve transaction denetiminin yerine geçmez. İstemciye private/core erişimi açılmadı. Bütün fonksiyonlar SECURITY INVOKER, sabit search_path ve açık revoke ile sınırlı.

## Açık teknik işler

1. Yetkilendirilmiş event_save içinde etiket setinin tam/sürüm kontrollü atomik kaydı ve public/authorized okuma/filter projeksiyonları. Şu an API kataloğu ve tipleri var; endpoint uygulaması yok.
2. Preview/eligibility/register yollarını aynı scope filtresi ve pozitif hak kapısına bağlamak. Mevcut EventTerms ve diğer koşullar ayrıca uygulanmalı.
3. Shared entitlement_account kilidi altında authoritative available hesabı ve tek atomik event kayıt/allocation/movement/audit/outbox. Release/cancel/close/correction yolları da aynı havuzda tutarlı olmalı.
4. Son ortak hak için iki event ve event–normal ders yarışını gerçek kayıt RPC'siyle sınamak. Salt helper veya SELECT FOR UPDATE testi bu kabulün yerine sayılmayacak.
5. Başka org/disiplin etiketinin sürüm değişiminde yeni yetki yaratmadığını, eski JWT/rol iptalini ve plan/merkez koşullarını tam Auth/API akışında test etmek.
6. UUIDv7 backend adaptörü önceki sürümde hazır. Test PG17'de SQL default UUIDv7 üreticisi yok; default hâlâ kapalı. Bu çalışma o eksiği kapatmadı.

Q-D01 için yeni ürün kararı gerekmiyor. Yukarıdaki işler teknik uygulama ve doğrulama bağımlılıklarıdır. Bu maddeler tamamlanmadan teknik aktarımın bütünü kapandı denmeyecek.

## Ortam ve yeniden kurulum

Aynı süreli izole Box: present-bobcat-18604. Yeni branch için önceki native stack durduruldu; ayrı, temiz Supabase stack üç migration ile kuruldu. Önceki migration dosyaları ve verileri silinmedi. PostgreSQL 17.11, gerçek geliştirme DB; üretim bağlantısı yok. Yeni branchte Auth/REST health ayrıca yeniden çalıştırılmadı; önceki branch health sonuçları yeni branch için kanıt sayılmadı.

Box otomatik silinme zamanı değişmedi: 15 Ekim 2026 21:28:15 Europe/Istanbul. Kalıcı geliştirme/hosting kurulumu değil. Arşivde secrets veya gerçek müşteri verisi yok. Yeniden kurulum: npm ci; npm run dev:start; npm test; npm run db:advisors. Native runtime CLI 2.121.0'a sabit.

Kanıtlar: reports/consistency.json, reports/q-d01-checks.log, reports/q-d01-advisors.log, reports/migrations.json; test kodu tests/event-scope.test.mjs. Önceki reports/final-checks ve 09 raporu tarihsel 2.2-tech.1 kanıtlarıdır.
