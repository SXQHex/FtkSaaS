# Claude frontend entegrasyon talimatları

## 26 Ekim — PR50 hesap ve güvenlik teslim paketi

PR50 yerel kapsamı **212 callable API / 64 migration**,46 ayar alanı/44 writable; başlangıç main `a7569bbb11353dc342804eb5050800d77a31a8e9`. İlk207/63 iki alan adayı aşağıda tarihsel snapshot’tır. Yeni beş işlem kendi oturumlarını listeleme/etiketleme/kapatma, güvenlik geçmişi ve güçlü doğrulanmış TOTP kaldırmayı kapsar. Native TOTP enrollment/challenge/verify sağlayıcıda kalır; verified factor varsa uygulama ve SQL hem doğrulanmış JWT aal2 hem canlı native session aal2 ister. Genel tercih patch’i güvenlik işlemlerini değiştirmez.

Oturum/refresh iptali ve geç hata rollback’i dar native testte geçti. Native sağlayıcının eski aal1 token ile aynı-session factor kaldırmasını kabul ettiği görüldü; bu negatif assertion korunarak10 saniyelik, yalnız aynı faktöre ait güçlü yeniden doğrulanmış kaldırma niyeti ve transactional native DELETE koruması eklendi. Son koruma gerçek native Auth üzerinde4/4 geçti (23.229sn); resetin ilk üç özgün akışı4/4 (44.889sn), ayrılan başlangıç grubu2/2 (51.937sn) geçti. Bağımsız incelemede bloklayıcı bulgu kalmadı; son commit/tree bağı ve aday/main clean/CD bekler. Eski başarısız aday40237107409 bu genişleyen kaynağın kabulü değildir; yeni full clean başlatılmadı. Uygulanmış62 migration değişmez;63–64 henüz adaydır.

Bu paket beş ekranın/69 grubun tümü değildir. Global ad/doğrulanmış iletişim yayılımı, avatar/logo, gerçek Google sağlayıcısı, takvim bağlantısı ve diğer özel consumer açıkları korunur. Hosted TOTP yapılandırması, yeni Auth trigger’larıyla hosted restore ve aynı-main CD kabulü kanıtsız kapatılmaz. Ayrı dummy organizasyon veya yeni CI altyapısı kurulmaz.


## 25 Ekim — aktif backend ve kalıcı pilot teslimi

Main `d6b67139445f2b88298fc0ee6e1f5c476f3586b7`:207 API/61 migration; PR45 main clean40206350648 ve development CD40207909599 başarılı. Aşağıdaki eski PR45 pending notları önceki aday snapshotıdır. Son kullanıcı talimatı beş ayar kapsamının backend/API kabulü, pilot zinciri ve restore/operasyon güvenliği teslimidir. Frontend için yeni alt alan kullanılacak; önce backend hazır edilir. Sentetik pilot verileri ayrı organizasyonda geliştirme Supabase’inde kalıcı tutulabilir; her koşuda silinmez. Dağıtım öncesi sıfırlama ayrıca yapılır; mevcut gerçek kulüp verileri şimdi silinmez. [Teslim sırası, kapsam ve kanıt sınırı](pilot-readiness.md). Bu ilk aday207/62 olup bütün ayar/hosted pilot/restore kabulü değildir.

## 25 Ekim — PR45 kapasite ve main ayarları uzlaştırması

Başlangıç main `3456050a3061d7bf5dc2ce8898b82c5cfe84e773`: **206 callable API / 60 migration**; PR46 ayarları birleşti, aynı main clean [40200716603](https://github.com/SXQHex/FtkSaaS/actions/runs/40200716603) ve development CD [40202862244](https://github.com/SXQHex/FtkSaaS/actions/runs/40202862244) başarılı. Bu PR45 birleşim adayı kapasite işlemini ekler: **207 callable API / 61 migration**. Altı ayar işlemi ve kapasite davranışı birlikte korunur. Henüz uygulanmamış kapasite migration’ı main’deki ayar migration’ından sonra sıralandı; SQL içeriği ve mevcut 60 migration değişmedi. Önceki PR45 clean yalnız eski tabana aittir; bu birleşik kaynak için bağımsız inceleme ve yeni aday/main clean gerekir. Kapasite henüz main/hosted kabulü değildir.

[Alanlar, API'ler ve kesin destek sınırı](frontend-settings-handover.md). Teknik SQL/worker yönetimi erteli; beş ekranın bütün 69 davranış grubu tamamlandı denmez. Hazır renk/font/logo, native provider/MFA/oturum ve diğer özel yaşam döngüsü açıkları bu genel tercihlere dönüştürülmez.


25 Ekim 2026. Belge tabanı main `702063807b0a0d09f559f070ffde1b1ae3e7563b`. Frontend tasarım/istemci kodu Claude'un alanıdır; backend bu teslimde tasarıma müdahale etmez. Bu dosya Claude'un açıkça okutulacak başlangıç talimatıdır; repository'de kök `CLAUDE.md` veya `.claude` yapılandırması bulunmuyor. Dosyanın Claude tarafından kendiliğinden yüklendiğini varsayma.

## 25 Ekim — frontend karar kapanışı ve uygulama sırası

Önce [backend/frontend ve beş scope sınıflaması](../contracts/02-FtkSaaS-teknik-sozlesme.md#ayarlar-backend-frontend-siniflama) uygulanır: 69 kabul grubunun her biri alan bazında izlendi; SQL/işletim yapılandırması ayrı backlog. Frontend alanlarının scope'u user/member/center/organization/platform. Platform yöneticisinin uygulama ayarı da frontend ayarıdır; verinin DB'de tutulması sınıflamayı değiştirmez.

69 ana grup korunur; **FD01–FD12 tamamen kabul edildi**. [Kesin frontend kararları](../contracts/02-FtkSaaS-teknik-sozlesme.md#ayarlar-backend-frontend-siniflama) tek kaynaktır. Bunlar yeni 12 ana grup veya çalışan API değildir. Yeni hesap/org defaultu mevcut tercihleri ezmez; standart negatif limit 0, mevcut kulüp −2 kalır. Backend teknik knobları ertelidir. Aşağıdaki API matrisi hâlen gerçek mevcut desteği gösterir; bu belge kapanışı yeni endpoint/enum/permission yayımlamaz.

### İlk kapsam için kesinleşen alanlar

| Kapsam | FD kapanışından önemli sonuç |
|---|---|
| user | Hazır Türkçe/İngilizce, cihaz dili/fallback Türkçe; tr-TR/24 saat/Pazartesi, cihaz timezone, sistem tema; foto PNG/JPEG/WebP. E-posta+şifre ana, son kararla Google ek kayıt/giriş; Apple/Instagram login yok, passkey erteli, ilk MFA doğrulayıcı kodu. |
| member | Org bazlı bildirim/pazarlama, aynı gelecek/aktif kesin kayıt kitlesi, default kapalı profil/iletişim; boş ilgi, geçmiş öneri kapalı; takvim türleri kullanıcı seçimi. |
| center | İş takvimi tanımsızsa kurulum; yeni merkez timezone önerisi İstanbul, yeni ders 60dk/saat seçici 15dk/tek seans; pencere/teklif orgdan, liste yeni sınıfta kapalı. Teknik worker alanı yok. |
| organization | Hazır uyumlu marka, Owner/açık OM; merkez marka override yok. Yeni org negatif 0, kişisel istisna kapalı, borç engelleri ayrı açık; mevcut kurulum korunur. Belge/yayın default taslak/kapalı. |
| platform | Hazır katalog/default/miras seçenekleri ve yetkili yönetim; DB/worker/secrets/CI/deploy alanı yok. Sadece gerçek katalog/sağlayıcı sunulur, serbest SQL/CSS/font yok. |

FD04 kişisel hatırlatmaları başlangıçta açık, pazarlama kapalıdır. FD10'daki ek iş otomasyonları başlangıçta kapalıdır; bu iki alan birbirini değiştirmez. Yeni genel ikinci-onay akışı ilk kapsam dışı; mevcut özel onaylar korunur. CSV rapor/import ile JSON kişisel veri kopyası ayrı hedeflerdir. İmha kanıtsız completed veya provider hazır değilken doğrulama başarısı gösterilmez.

Kapasite için [güncel teknik karar](../contracts/02-FtkSaaS-teknik-sozlesme.md#oda-seans-kapasite-karari) esas alınır: tek fiziksel oda kapasitesi, ayrı seans toplamı ve isteğe bağlı kategori limitleri; seanslarda nominal/maksimum ayrımı yoktur. PR45’in önceki aday clean’i eski tabana aittir. Yeni birleşik aday207/61, mevcut main206/60’tır; kapasite DTO’su henüz main/hosted kabulü değildir. Ayar API’leri PR46 ile main’de mevcuttur. Tek kayıt için gerekçeli kapasite istisnası fiziksel oda tavanını veya diğer katılım engellerini aşamaz.

## Beş kapsamlı ayar ekranı teslimi — 24 Ekim önceliği

Son kullanıcı talimatı: kullanıcı–üye–merkez–organizasyon–platform ayar değiştirme ekranları ve gerçek API karşılıkları frontend'e teslim edilecek. SQL/Cron/worker işletimi ve DB yönetim ayarları sonraya bırakılır. 69 ana grubu yeniden görüşmek yerine ekran alanları tamamlanır. Backend ekranların alan/veri/yetki/API sözleşmesini, frontend kendi tasarım ve istemci uygulamasını teslim eder. Bu belge ekranların veya eksik API'lerin çalıştığı iddiası değildir.

### Beş kapsamın anlamı

| Ekran | Değerin sahibi | Düzenleyen / ayrım |
|---|---|---|
| Kullanıcı | Global hesap; bazı tercihler cihaz | Hesap sahibi kendi bilgisi/güvenliği/tercihi. Org yöneticisi global hesabı düzenleyemez. |
| Üye | Organizasyona ait kişi/ilişki ve o orgdaki kullanıcı tercihleri | Kendi org tercihini hesap sahibi; üye operasyon alanını ilgili mevcut person/merkez yetkilisi. Tek ekranda bu iki izin birbirinin yerine geçmez. |
| Merkez | Açık org + merkez | Yetkili merkez yöneticisi ve yalnız açık devredilmiş alan yetkilisi. |
| Organizasyon | Organizasyon | Alana göre Owner veya ilgili açık organizasyon yetkilisi. Owner otomatik merkez operasyon yetkisi değildir. |
| Platform | SaaS'ın uygulama yapılandırması | Alana göre platform yapılandırma/güvenlik/plan/entegrasyon yetkilisi. İsimler henüz yeni permission enumu değildir. |

Üye yeni global hesap veya yeni UUID türü değildir: mevcut org person/relationship kaydıdır. Bir kişi farklı orglarda bağımsız tercihlere sahiptir. Hesaba güvenli bağlanmış üyenin güncel ad/doğrulanmış iletişimi global kaynaktan gelir; admin ekranı sessiz yerel kimlik override'ı üretmez. Hesapsız kişi için mevcut person_update yetkisi ayrı korunur. Abone no üretim P08'dir, salt okunur hedef alan olarak ayrılır.

### Ekran bölümleri ve kontrol türleri

Bu tablo bileşen yerleşimi veya route/framework dayatmaz. Metin, seçim, çoklu seçim, aç/kapat ve özel doğrulama akışları backend alan türüne bağlanır. Aşağıdaki hedef alanların tamamı mevcut API'de var sayılmaz.

| Ekran | Bölüm | Düzenlenebilir hedef alanlar / kontrol |
|---|---|---|
| Kullanıcı | Profil | Görünen ad (metin), isteğe bağlı hitap (metin), fotoğraf (yükle/değiştir/kaldır). |
| Kullanıcı | Kimlik/iletişim | Ad/soyad; e-posta/telefon için yeni değer–doğrulama bekliyor–doğrulanmış akışı. Normal tercih PATCH'i değildir. |
| Kullanıcı | Güvenlik | Parola ekle/değiştir/sıfırla, hazır login yöntemi/MFA, kendi session/cihaz işlemleri. Özel proof/reauth ve durum akışı. |
| Kullanıcı | Dil/saat/görünüm | Desteklenen dil/format/hafta başlangıcı/timezone, açık-koyu-sistem tema, erişilebilirlik, desteklenen ses/titreşim; hesap/cihaz alanları ayrıdır. |
| Kullanıcı | Başlangıç/ekran | Yetkili org/merkez/disiplin/başlangıç ekranı, son bağlam seçimi, desteklenen liste/takvim/görünüm ve filtreler. |
| Kullanıcı | Genel tercihler | Sessiz saat/gün/timezone, platform pazarlama kanalları ve üç bağımsız reklam/ölçüm tercihi. Açık tercih hukuki izin/SDK aktivasyonu değildir. |
| Kullanıcı | Geçmiş/veri | Güvenlik ve izin geçmişi salt okunur; veri talebi/silme/reset ayrı etki/reauth komutları. |
| Üye | Organizasyon tercihleri | Org bazlı bildirim olay/kanal/hatırlatma/özet, pazarlama amaç/kanalı, ilgi/öneri tercihleri. |
| Üye | Paylaşım | Org katılımcılarına ad/fotoğraf/telefon/e-posta gösterimi ayrı aç/kapat; default kapalı; kitle FD05 gereği aynı gelecek/aktif kesin kayıt katılımcılarıdır. |
| Üye | Takvim/bağlantı | Org takvim bağlantısı tür seçimi/oluştur/yenile/kaldır; hesap–kişi bağını görme ve kendi kaldırma talebi/özel akış. |
| Üye | Yetkili yönetim | Hesapsız kişi ad/contacts, merkez/disiplin ilişkileri ve ilgili kişisel negatif ders limiti yalnız mevcut yetkiyle. Borç, paket, hak, görev veya abonelik durumunu genel settings kaydıyla değiştirme yok. |
| Üye | Bilgi | Üye/ilişki kimliği, varsa ileride abone no, bağ/ilişki durumu ve iş bakiyeleri salt okunur veya ilgili domain işlemine yönlenir. |
| Merkez | Kimlik/konum | Ad, açıklama, işletme iletişimi, adres/harita/ulaşım ve dış alan görünürlüğü. |
| Merkez | Takvim/kaynak | İş timezone/takvim, oda uygunluk/kapasite ve sunulan org disiplinleri; mevcut domain önizleme/yazma yolları korunur. |
| Merkez | İş varsayılanları | Yeni program/paket/etkinlik/anlaşma hazırlığında desteklenen başlangıç seçenekleri. Mevcut kayıtları güncelleme işlemi değildir. |
| Merkez | Katılım politikası | Mevcut izinli rezervasyon/talep/bekleme/borç/negatif hak politika alanları ve etki/onay. |
| Merkez | İletişim/belge/CRM | Şablon/kanal/hatırlatma, belge/yeniden onay, form görünürlüğü/alanlar ve CRM ortak sözlük/atama seçenekleri. |
| Merkez | Otomasyon/rapor | Hazır iş otomasyonu, yetkili alıcılar, ortak rapor/import şablonu; teknik worker ayarı yok. |
| Merkez | Miras/yetki | Desteklenen orgdan al/yerel değer, kaynak/kilit nedeni, izinli grup reseti ve değişiklik geçmişi. |
| Organizasyon | Kurumsal bilgiler | Ad, iletişim, fatura alanı, logo ve dış görünürlük; kişisel Owner bilgisi ayrı. |
| Organizasyon | Marka | PR43'teki hazır renk/font paket kataloğu seçimi, bağımsız marka reseti. Özel font/CSS/serbest renk ilk kapsam değil. |
| Organizasyon | Ortak katalog/şablon | Disiplinler ve desteklenen paket/program/etkinlik/anlaşma, takvim/dil/format başlangıçları. |
| Organizasyon | Miras/politika | Merkezlere default/zorunlu/yerel sınır; desteklenen katılım/bildirim/belge/CRM ayarları. |
| Organizasyon | Yetki/gizlilik | Kaynakta izinli delegasyon, org güvenlik şartı, izin metni/katılımcı paylaşım kapsamı ve veri talebi sorumluları. |
| Organizasyon | Bağlantılar/işler | Hazır sağlayıcı bağlantısı ve kapsamı, iş otomasyonu, rapor/import şablonları. Provider sırları genel form yanıtında yok. |
| Organizasyon | SaaS hesabı | Fatura iletişimi, yenileme tercihi ve desteklenen plan/dönem değişim komutları. Mevcut dönem/fiyat/limit serbest düzenleme alanı değildir. |
| Platform | Uygulama kimliği | Ad/logo/destek/iletişim, hazır dil/format seçenekleri ve yeni hesap/org/merkez başlangıçları. |
| Platform | Görünüm katalogları | Hazır renk/font/tema paketlerinin tanımlı kimlik/sürüm/aktiflik/varsayılan seçimi; rastgele font URL/CSS veya yeni veri tipi tanımı değil. |
| Platform | Plan/fiyat/limit | Desteklenen plan katalog/özellik/fiyat dönemi ve kullanım limitleri; mevcut subscriber komutları plan katalog API'si sayılmaz. |
| Platform | Alan politikaları | Kaynakta tanımlı kullanıcı/üye/merkez/org alanlarının default/seçenek/miras/yerel aralık/plan kullanılabilirliği. Serbest JSON/SQL düzenleyici yok. |
| Platform | Güvenlik seçenekleri | Entegrasyonu hazır giriş/MFA yöntemi ve desteklenen uygulama güvenlik şartları. Backend DB/connection/JWT-secret ayarı bu ekrana girmez. |
| Platform | Bildirim/belge katalogları | Hazır olay-kanal matrisi, şablon/dil/yerel düzenleme izni, izin metni sürümü ve yetkili sorumlular. Dış e-posta kurulum işi ertelenmiş kalır. |
| Platform | İş yetenekleri | Desteklenen form/CRM/iş otomasyonu/rapor-import seçeneklerini plan ve kapsam içinde kullanıma açma. Teknik executor parametreleri değil. |
| Platform | Hazır entegrasyonlar | Bağlantısı desteklenen sağlayıcı/amaç/organizasyon kullanım izni ve health; provider/bot kurulumu ayrıca açık. |
| Platform | Yönetim | Tanımlı platform görev kapsamları, yetkili uyarı alıcıları, kullanıcıya gösterilecek bakım açıklaması, ayar yayın/geçmiş/reset. Migration/deployment kontrolü değil. |

### Mevcut 200 API üzerinden doğrulanmış ilk eşleme

Bu tablo main200 baseline işlemlerini gösterir. Yeni altı settings işleminin aday kaynak/alan matrisi yukarıdaki uygulama devrindedir; main/deploy tamamlanmadan mevcut canlı ortamda var sayılmaz. Parametre/Response tam kaynağı 08 ve üretilmiş operations.ts'dir.

| Ekran / alan | Mevcut okuma | Mevcut yazma / izin | Hazır sınır ve eksik |
|---|---|---|---|
| Kullanıcı görünen adı | account_get_v1; yazma sürümü management_state_get_v1 | account_profile_update_v1 / account.self | Yalnız display_name; hitap/fotoğraf/dil/tema bu DTO'da yok. |
| Kullanıcı parola | Mevcut Auth/Edge challenge akışı | account_password_change_v1; account_password_reset_request_v1 | Başlatıcı ile native Auth completion ayrı; MFA/session listesi/kimlik doğrulama yayılımı genel prefs gibi gösterilmez. |
| Üye kişi bilgisi | person_get_v1 | person_update_v1 / person.manage | PersonPatch yalnız display_name ve contacts. Kendi tercihini düzenlemek bu admin iznine dönüşmez; doğrulanmış global identity yayılımının tamamı hazır değildir. |
| Üye org bildirim tercihi | management_state_get_v1, hedef notification_preferences_set_v1 | notification_preferences_set_v1 / notification.self | channel/purpose/enabled + hedef sürüm; enum in_app/email ve transactional/reminder/marketing. Canlı yol in_app, transactional=false ret; email enum'u teslim kanıtı değil. Sessiz saat/olay detayları yok. |
| Üye merkez/disiplin ilişkisi | person_get_v1; ilgili management state | student_activate_v1, student_deactivate_v1 / person.activate; person_discipline_set_v1 / person.manage | Domain state/grant kapıları korunur. Üye kendisine admin ilişkisi veya sınırsız hak veremez. |
| Üye kişisel negatif limit | negative_limits_get_v1 | negative_limit_set_v1 / entitlement.correct | Person + merkez + disiplin, gerekçe/etki/onay; üyenin kendi self tercih alanı değildir. |
| Merkez adı/timezone | centers_list_v1; ilgili management_state_get_v1 | center_update_v1 / center.manage | Yalnız name/timezone; hedef merkez selector/versiyon sözleşmesi aynen korunur, keyfî center_get ucu uydurulmaz. İletişim/takvim şablonu aynı DTO'da yok. |
| Merkez oda/uygunluk/disiplin | İlgili mevcut domain okuyucuları ve management state | room_save_v1, availability_save_v1, availability_exception_save_v1, center_discipline_set_v1 / center.manage | Kaynak/kapasite/etki şartları korunur; genel ayar yazmasıyla mevcut kayıtlar topluca değiştirilmez. |
| Org/merkez politika alanları | policies_get_v1 | policy_publish_v1 / policy.manage | Mevcut kapalı policy_value_map anahtarları. Yeni key veya generic preferences değildir. effective_at/mandatory/etki-onay alanları aynen korunur. |
| Organizasyon adı | organization_get_v1 | organization_update_v1 / org.manage | Yalnız name; marka/iletişim/fatura alanı yok. |
| Organizasyon disiplini | disciplines_list_v1 | discipline_save_v1 / org.manage | Mevcut name/state; yeni simge/renk alanı var sayılmaz. |
| Organizasyon aboneliği | subscription_get_v1 | subscription_renewal_set_v1, subscription_upgrade_quote_v1, subscription_downgrade_request_v1, subscription_change_cancel_v1 / subscription.owner | Alanlar domain komutlarıyla; fatura tercihleri/plan dönem seçiminin tümü ve auto ödeme hazır değil. |
| Platform plan/marka/default katalogları | Uygun genel katalog/settings okuyucusu henüz yok | Mevcut 200 işlemde uygun typed genel katalog/settings yazarı yok | Yeni backend sözleşme ve uygulama gerekir. saas_payment_verify/grace_extend gibi operasyon komutları settings editörü yerine kullanılamaz. |
| PR43 org marka + kişisel görünüm | Kalıcı paket/tercih okuyucusu yok | Kalıcı katalog/seçim/reset yazarı yok | Ayrı org/kullanıcı scope, yetki, sürüm, logo/cache/fallback ve ortak tip ihtiyacı açık. |

### Ertelenen SQL ve altyapı ayarları

Frontend ilk teslim ekranlarından çıkarılanlar: private.ops_* ve worker scope/LOGIN yönetimi, pg_cron takvimi, batch/concurrency/lease/retry/timeout teknik ayarı, DB search_path/RLS/grant/connection-pool/network/SSL, Auth/JWT signing secret, migration ve deployment, yedek/restore motoru, fiziksel imha yürütücüsü ve backend dosya/iş teknik tavanlarının yönetimi. Kararlar silinmez; ayrı altyapı backlog'unda kalır. Uygulama ekranındaki normal iş otomasyonu aç/kapat ve iş hatırlatma tercihleri bu ertelemeye dahil değildir.

Yerel 208 API/60. migration taslağı incelendi: sekiz yeni işlem çoğunlukla quote/reauth teknik config, dosya/rapor tavanları, deneme config ve worker kontrolüdür; kullanıcı ve üye tercih ekranlarını veya PR43 markayı sağlamaz. Dolayısıyla bu taslak beş ekran teslimi olarak kullanılmayacak, otomatik taşınmayacaktır.

### Her ekranın frontend kabul paketi

1. Alan listesi + kontrol/veri tipi + seçilebilir değerler + default kaynağı; seçilmemiş bir ürün değeri uydurulmaz.
2. Okuyabilen/değiştirebilen aktör, kapsam, miras/etkin değer/kilit nedeni ve alan bazlı destek durumu.
3. Gerçek read/write Request/Response/Error, hedef sürüm okuması, idempotency/preview/reset davranışı ve üretilmiş ortak tip.
4. Normal kaydetme, validation, yetki kaybı, stale sürüm, aynı işlem retry'si, tenant geçişi ve ilgili miras/bağımsız reset kabul senaryoları.
5. Her alan için ayrı hazır/eksik/sağlayıcı bekliyor/cihazda durum kaydı. Çalışan API ve test kanıtı olmadan ekran bütünü teslim edildi sayılmaz.

Öncelik UI alanlarının ve typed API boşluklarının tamamlanmasıdır. Kalıcılık için gereken uygulama migration'ı ile ertelenmiş DB işletim ayarları birbirinden ayrılır; ertelenen şey normal uygulama verisinin güvenli saklanması değildir. Mevcut backend güvenlik ve full/main clean kapıları korunur.

## Önce okunacak kaynaklar

1. [AGENTS](../AGENTS.md), [kaynak indeksi](source-index.md), [tek güncel devir](../contracts/00-FtkSaaS-yeni-sohbet-devir.md).
2. [Ürün](../contracts/01-FtkSaaS-urun-kapsam-sozlesmesi.md), [teknik sözleşme ve settings](../contracts/02-FtkSaaS-teknik-sozlesme.md#ayarlar-sozlesmesi-ve-davranis-sprinti), [alan sahipliği](../contracts/03-FtkSaaS-kodlama-sorumluluklari.md), [durum/hata/izin](../contracts/06-FtkSaaS-O4-durum-hata-izin.md).
3. [08 makine sözleşmesi](../contracts/08-FtkSaaS-tip-ve-operasyon-sozlesmesi.json), [üretilmiş TypeScript operasyonları](../packages/contracts/src/operations.ts), [runtime adları](../packages/contracts/src/runtime.ts), [endpoint envanteri](endpoint-inventory.json).
4. [Kalan işler](remaining-work.md), [üretim kuyruğu](production-queue.md), [hosted kurulum](remote-backend-setup.md). Modül devirleri işlem ayrıntısı için kullanılır; eski source/pending etiketleri güncel teslim durumunu belirlemez.

## Mevcut backend ve ortam

200 sözleşme/200 callable runtime/0 contract_only;59 migration/90 core tablo/Edge8. P01–P07'nin kaynak/full-clean/main/CD kabulü kapandı. Son runtime main `4cfc9a55`; PR41 belge main `bfb8ccb2` yalnız belge kabulünden geçti, CD deploy skipped. Ayrıntılı run/tree/receipt kanıtları tek devirdedir. Yerel, henüz yayımlanmamış 208 API/60. migration settings taslağı kullanılmaz.

Paylaşılan **geliştirme/test** hedefi `https://gwyprhenabtpkbojephw.supabase.co`; Edge yolu `/functions/v1/backend-v1/{operation}`. Bu ortamda gerçek ilk kurulum verileri var; reset/seed/test:clean çalıştırma ve gerçek kişiyi test fixture'ı yapma. İzole yerel ortam `npm run dev:start`, sentetik `npm run dev:seed`, bağlantı `npm run dev:info` ile hazırlanır. `docs/development-connection.json` içindeki eski22-migration ve report sayıları ilk kurulum snapshotıdır; güncel durum için kullanılmaz.

İstemciye yalnız proje publishable key ve kullanıcı access tokenı verilir. Publishable key bu belgede yayımlanmaz; ortamın güvenli yapılandırmasından alınır. `service_role`, Management PAT, DB parolası ve public ingress/Turnstile secret'ı istemciye, kaynak koduna veya rapora konmaz. `.dev/frontend.env` ve sentetik giriş dosyaları yerel üretilir; gerçek parola/tokenlar paylaşılmaz.

## Tasarım kararı ile mevcut API ayrımı

S11 kişisel takvim, S14 pazarlama/ilgi, S15 görünürlük/izin, S16 veri talebi/silme ve S17 güvenlik geçmişi/reset de kabul edilmiştir. Bu grupların gerçek read/write/DTO desteği aşağıdaki mevcut 200 işlemden tek tek eşlenecek; takvim bağlantısı/export desteği ayrıca eşlenir; PR50 oturum/güvenlik ve mevcut settings reset desteği güncel API devrinde ayrıdır. Desteklenmeyen seçenek yerel taslak olabilir, sahte kalıcı kayıt olamaz.

| Ayar alanı | Kabul edilmiş hedef | Bugün kullanılabilen yol ve açık sınır |
|---|---|---|
| S01 Profil | Görünen ad, hitap, fotoğraf ve ayrı görünürlük | `account_get_v1` ve `account_profile_update_v1` yalnız display_name; yazma sürümü `management_state_get_v1` ile okunur. Hitap/fotoğraf/görünürlük alanları bu DTO'da yok. |
| S02 Kimlik iletişim | Ad ve doğrulanmış iletişimin aktif bağlı orglara onaysız yansıması | Mevcut display_name komutu bu akışın bütünü değildir. Global yasal ad, e-posta/telefon doğrulama ve yayılma için alan bazlı API/sağlayıcı analizi bekler. |
| S03 Bağlantılar | Güvenli mevcut kişiye bağlama, kaldırma ve yeni yetkiyle yeniden bağlama | `account_access_send/accept/revoke_v1`, `account_link_remove_v1`, `person_merge_*` mevcut komutlarıdır; her biri kendi yetkisine tabidir. Kullanıcının kendi bağlantısını kaldırma hedefi mevcut CM komutuna otomatik eşitlenmez. Abone numarası P08'dir. |
| S04 Şifre | Ekle/değiştir/kurtarma ve kabul edilmiş oturum kapatma | `account_password_change_v1` challenge başlatır; tamamlama native Auth'tadır. `account_password_reset_request_v1` korumalı recover başlatıcısıdır. Kabul edilmiş tüm oturum temizliği ve dış teslim hazır varsayılmaz. |
| S05 Sağlayıcı MFA | Güvenli ekleme/kaldırma, son giriş yöntemi koruması | Seçim kesin: e-posta/parola ve Google kayıt/giriş, doğrulayıcı uygulama MFA. Apple/Instagram login kapsam dışı, passkey erteli. Gerçek provider/hesap yaşam döngüsü ve kabul kanıtı ayrıca doğrulanacak; seçim desteğin çalıştığı kanıtı değildir. |
| S06 Oturumlar | Kendi oturumlarını gör/kapat; güven kaydını ayrı yönet | PR50 beş hesap güvenlik API’si ve native TOTP devri frontend-settings-handover belgesindedir; son native/CI/hosted kabulü bekler. Güvenilen cihaz ayrı ve açık kalır. |
| S07 Dil bölge saat | Hesap manuel/cihaz otomatik tercihleri; iş zamanı sabit | Aday settings_get/update S07 görünüm alanlarını kapalı DTO ile saklar. İş zamanları Instant/merkez timezone kaynağında kalır; görüntüleme tercihi onları değiştirmez. |
| S08–S10 Görünüm ve bağlam | Erişilebilirlik, başlangıç, ekran/takvim tercihleri | Aday settings API'leri sistem tema/kontrast/hareket, hatırlama ve takvim görünümünü saklar; desteklenmeyen ekran filtre/sütun ve varsayılan bağlam yolları ayrı açıktır. Yetki filtreleri tercihle aşılmaz. |
| Bildirim tercihi | S12–S13 ve FD04 olay/kanal/istisna/zaman değerleri kesin; mevcut API kapsamı dar | `notification_preferences_set_v1` ve yetkili management okuması mevcut. Amaçlar transactional/reminder/marketing; mevcut yol in_app, transactional=false ret. Enum'da email olması dış teslim kanıtı değildir; push/SMS yeni enum gibi eklenmez. |
| Reklam ölçüm ve analitik | Üç ayrı tercih açık/kapatılabilir; FD04 pazarlama ve FD05 geçmiş öneri defaultları ayrı kapalı | Tercih değeri rıza/dayanak değildir. Yeni SDK/toplama entegrasyonu bu belgeyle etkinleştirilmez. İzin, teknik etkinlik ve sağlayıcı desteği ayrı. |
| Merkez/org/platform | M01–M22, org O01–O21 ve platform P01–P09 / FD alan kararları kapalı; uygulama kapsamı alan bazında | Mevcut `policies_get/policy_publish`, availability, registry, belge/otomasyon ve abonelik komutları kullanılır. Altı generic tercih işlemi uygulama adayında; yalnız kapalı alan listesi, main/CD henüz yok. |

24 Ekim: S01–S17/M01–M22/org O01–O21/platform P01–P09 olmak üzere 69 ana davranış grubu kabul edildi; tüm alanlar uygulanmış değildir. Ayrıntılar tek teknik sözleşmede; açık default/değer/permission/sağlayıcı ve mevcut API eşlemesi ayrı çözülür. Yeni API alanı, değer veya sağlayıcı davranışı uydurma. Eski Word aileleri ve üretim kuyruğu aynı numaralarla karıştırılmaz. Aynı durumun tasarım prototipi ile gerçek API kaydetme başarısını ayır; desteklenmeyen alan için sahte başarılı kayıt üretme.

## İstek yanıt ve sürüm kuralları

İnsan işlemleri `POST {API_URL}/functions/v1/backend-v1/{operation}` üzerinden doğrudan typed Request JSON ile yapılır. Başlıklar `Authorization: Bearer <Supabase access_token>`, `apikey: <publishable key>`, `Content-Type: application/json`. Named `/rest/v1/rpc` backend/service-only'dir; `core/private` tablolara doğrudan yazma veya SQL yoktur. `backend-v1 verify_jwt=true` korunur.

- `request_id` ve gereken `operation_key` doğrulanmış UUIDv7; domain kimliklerini backend üretir, Auth sağlayıcı kimliği aynen kalır. Kullanıcı işlemi retry edildiğinde operation_key korunur; transport request_id değişebilir.
- `expected_version` yalnız ilgili komut istiyorsa kullanılır. Okuma projeksiyonu ve hedef entity bağlamı tamdır. `account_get` bir profil write-version kaynağı değildir; management okuması kullanılır. Append-only policy_publish'e rastgele expected_version eklenmez.
- Başarı yalnız HTTP200 değildir; `ok`, typed `data` ve iş sonucunu kontrol et. Hata `{ok:false,error:{code,retryable,trace_id}}`; metin parse etme. Timeout sonucu bilinmiyor demektir: aynı anahtar/status/replay yolu kullanılır. Yeni anahtarla kör tekrar yoktur.
- Eski preview/sürüm, değişen yetki/plan/tenant, yetersiz hak/kontenjan/politika durumları ayrı ele alınır. Kural hatası otomatik retry ile çözülmez. Page/sort/cursor mevcut DTO sınırlarındadır.
- Tanınmayan alanlar reddedilir; null/optional/false/sıfır aynı değildir. Backend'in döndürmediği yetkisiz alanı istemcide varmış gibi üretme. Sütun gizleme güvenlik değildir.

Profil güncellemenin mevcut örneği (UUID alanları çalışma anında gerçek değerlerle doldurulur):

```json
{
  "client_api_version": 1,
  "request_id": "<UUIDv7>",
  "operation_key": "<işlem boyunca sabit UUIDv7>",
  "expected_version": 1,
  "display_name": "Yeni görünen ad"
}
```

Bu yalnız şema örneğidir; expected_version=1 varsayılmaz, management okumasından gelir. Kullanıcı ad/soyad/iletişim yayılma hedefinin tamamını temsil etmez.

## Yetki zaman ve iş sonuçları

Owner olmak CM operasyon yetkisi vermez. Merkez, disiplin, plan, canlı bağlantı/grant ve alan görünürlüğü her istek için backend'de doğrulanır. Rol/görünüm seçimi veya kayıtlı filtre yeni yetki üretmez. Aynı kişi A ve B merkezlerinde açık yetkiliyse hesaplaşmanın iki tarafını da yapabilir; A-only B onayı vermez.

UTC Instant, merkez iş saati ve kullanıcının görüntüleme saati ayrıdır. Kullanıcının tarih/saat biçimi veya timezone seçimi seansın gerçek zamanını, iptal parasal sınırını veya paket geçerliliğini değiştirmez. Erişim kaybolunca eski ekrandaki veri ve seçenekler kullanılmaz; başka tenantın varlığı hatadan açıklanmaz.

## Sağlayıcı ve yaşam döngüsü sınırları

Dış e-posta/Resend, gerçek frontend entegrasyon kabulü ve yük/restore açık. Native Mailpit kabulü dış teslim kanıtı değildir. Public başvuruda JWT gateway credential, signed ingress, Turnstile hostname/action ve hız kapıları mevcut P04 sözleşmesine tabidir; iki web formu için telefon tabanlı genel CRM kabulü P08'dir. Güvenlik/bot kapıları kaldırılarak demo yapılmaz.

`account_delete_*` ve `organization_*` lifecycle komutları mevcut; fiziksel imha kanıtı eksikse partial/pending ve completed_at=null korunur. Kullanıcının talebi iptal etme veya kişisel veri export akışının tamamı otomatik hazır sayılmaz. Beş Cron'un idle çalışması gerçek iş yükü veya fiziksel imha kanıtı değildir.

## Claude teslim kontrolü

- Tasarımda kullanılan her kayıt yolu için gerçek operation + request/response alanı + permission + sürüm/preview kaynağı yazılır. API boşluğu mevcut iş kuyruğuna sözleşme önerisi olarak iletilir; backend source/migration Claude tarafından değiştirilmez.
- Yalnız callable sözleşmeye uyan mock gerçek entegrasyonun yerine geçmez. Yeni kabul edilmiş ekran davranışı statik tasarımda gösterilebilir; buna hayali endpoint veya başarılı kaydetme yanıtı eklenmez. Üretimde mock fallback yoktur.
- Gerçek testler sentetik kullanıcı/tenant ve yetkili ortamda yapılır; paylaşılan gerçek kurulum verisi resetlenmez. Başarı, ret, erişim geri alma, stale version, timeout/replay ve alan gizliliği kabulü ayrı kanıtlanır.
- Ortak tipler elle kopyalanmaz. Güncel package yolu `packages/contracts` ve üretilmiş operations.ts'dir; kullanıcı tarafından kararlaştırılmış `packages/api-contracts` düzenleme hedefi mevcut dosya yolu gibi import edilmez. Solito kullanılmaz; monorepo reorganizasyonu backend davranışını değiştirmez.
- Kendi frontend tasarımını/istemci kodunu kendi alanında sürdür. Bu backend belge teslimi frontend framework, ekran yerleşimi veya deployment değişikliği yapmaz. Main merge production izni değildir.

## Mevcut finans ve etkinlik entegrasyon ayrıntıları

## Q-E01 — ödeme hazırlığı ve kesin kayıt

1. Ücretli manuel, tam ödeme şartlı katılımda `event_payment_prepare_v1` ile event/person için tek hazırlık ve bağlı borç alınır. Hazırlık yer tutmaz.
2. `collection_record_v1` içinde `debt_ids:[preparation.debt_id]` kullanılır. Başka borca dağıtılmış veya dağıtılmamış para tam ödeme şartını karşılamaz.
3. `event_payment_get_v1` güncel ödenen/kalan tutarı verir. `event_registration_preview_v1` ve `event_register_v1` preparation_id kullanabilir; sale_id ile birlikte gönderilmez.
4. `data.outcome` mutlaka denetlenir: `registered` kesin kayıttır; `capacity_closed` kesin kayıt değildir. İkinci sonuç hazırlığın kapanması, borç ters kaydı ve ilgili öğrenci alacağının atomik kaydıdır.
5. Aynı bağlı borç tekrar kullanılabilir; ikinci borç/tahsilat yaratılmaz. Önceki indirim, refund claim, açık iade ve mahsup tekrar üretilmez.

`student_credit_refund_v1` açık nakit iade, `student_credit_offset_v1` açık mahsuptur. Otomatik nakit çıkışı/başka borca dağıtım yoktur. Fazla tahsilat borcu eksi yapmaz; source_cash_id bağlı surplus_add olur. İptal önce gerçekleşmişse sonraki gerçek tahsilat yine bu mevcut surplus kuralına tabidir; iki işlemin başarılı olması tek başına mükerrerlik değildir.

## Q-E02 — merkez iptali

`event_cancel_preview_v1` → `event_cancel_apply_v1` merkez yetkisiyle çalışır. Draft/published/occurred kapsamı ve ertesi gün kayıt aynı tam sonucu verir: etkinlik borcu sıfır; daha önce alacaklaştırılmamış tahsilat öğrenci alacağı; ayrılmış hak serbest; tüketilmiş hak previous_id bağlı reverse/release ile tamamen geri. Paket hakkı için ayrıca parasal alacak ve kısmi tüketim yoktur.

Önizleme effects: `remaining_debt_removed`, `student_credit_added`, `release`, `reverse`, hazırlık için `close`. Reverse nakit iade anlamına gelmez. Kendi kaydını daha önce iptal etmiş kişinin ilgili borç/tüketimi de kapsanır. Başka borç/satış ve geçmiş yoklama/görev hakedişi değiştirilmez. İptal sonrası attendance close/correct yeniden hak tüketemez. Finans/event/yetki bağımlılıkları değişmişse stale/forbidden sonucu alınır.

## Q-E03 — planlanan parasal sınır

Katılımcı iptalinde **planlanan başlangıç anı dahil sonrası** parasal iade, borç indirimi veya öğrenci alacağı üretmez. Öncesindeki mevcut kabul edilmiş koşullar korunur; yeni iade formülü eklenmedi. Katılımcı paket sonucu mevcut terms_snapshot cancellation koşulundandır, parasal phase'den türetilmez.

`event_get.data.registrations[].participant_cancellation` null veya `{cancelled_at, planned_starts_at, phase, rule}` nesnesidir. Phase `before_planned_start` / `at_or_after_planned_start`, rule `planned_start_v1`. Backend ortak kilit sonrası karar zamanını sabitler; parasal karşılaştırma ve mevcut paket cutoff formülü aynı karar saatini kullanır. İstemci bu zamanları gönderemez. Eski/yalnız merkez iptallerine kanıt uydurulmaz. Başarılı snapshot değiştirilemez.

Plan 21.00, iptal 21.15, fiilî başlangıç 21.30: parasal olarak başlangıç sonrası iptaldir. Fiilî kayıt/düzeltme bunu değiştirmez. Planlanan saatin gelmesi kendi başına occurred, yoklama, hak tüketimi veya earning yazmaz.

## Fiilî başlangıç API'si — artık mevcut

Ayrıntılı request/response ve kurallar: `docs/actual-start-handover.md`. İki işlem de event.manage merkez yöneticisi, event expected_version, açık Instant ve gerekçe ister. İlk kayıt bir kez yapılır. Correct nullable zamanla hatalı bilgiyi kaldırabilir; eski/yeni değerler mevcut append-only audit defterinde kalır. Gelecek fiilî saat ve boş gerekçe reddedilir.

`event_get` current `actual_started_at` döndürür. Yönetici/organizasyon okuyucusu `actual_start_history` içindeki actor/time/reason/diff geçmişini de görür; diğer izinli okuyucular audit gerekçelerini görmez. İptal sonrasında geriye kayıt/düzeltme yapılabilir, state yeniden açılmaz. Published/occurred/cancelled korunur; draft ret. Sürüm artışı eski iptal önizlemesini stale yapar; yeni preview aynı Q-E02 hesabını uygular.

Bu yalnız operasyonel kanıttır. Q-E03 katılımcı sınıflandırması, Q-E02 hesaplaşması, yoklama, haklar ve earning kendiliğinden değişmez. Kısmi gerçekleşmeden yeni parasal kural türetilmez.


## Kapasite istemci geçişi — henüz main teslimi değil

`room_save_v1.capacity` tek fiziksel sayı; `management_state_get_v1` room_save_v1 seçicisi aynı merkezde oda değerini/sürümünü okur. Eski fiziksel kapasitesi yapılandırılmamış oda `null` gösterilir; doldurulmadan yeni oda bağlı kayıt tamamlanmaz. `session_get_v1`, takvim seansları ve önizlemelerde `capacity.total`/`capacity.categories` kullanılır. Etkinlik DTO'su bu ders kapsamı dışında korunur. Program, tek seans, yerine seans, özel ders oluşturma ve kapasite güncellemesi aynı yeni `SessionCapacity` tipini kullanır.

`booking_category` kategorili seansa kayıt, bekleme ve deneme teklifi girişinde açık seçilir; profil cinsiyetinden tahmin yapılmaz. Normal kayıt dolduğunda açık kontrollü aşım eylemi ayrı komutu ve zorunlu gerekçeyi gönderir. Başarı tanımlı seans kapasitesini değiştirmez. Aktif teklifler dahil doluluk ve oda tavanı backend tarafından yeniden kontrol edilir. Yetki UI görünürlüğünden türetilmez; `FORBIDDEN`, `CAPACITY_FULL`, `POLICY_NOT_CONFIGURED`, `VERSION_CONFLICT` ve tekrar gönderim sonuçları gerçek sözleşme üzerinden ele alınır. Backend/API kabulü tamamlanmadan ekranların bu yeni biçimi çalışıyor sayılmaz; frontend tasarımı değiştirilmedi.

Seans/takvim okuması ayrıca toplam `held`/`remaining`, `category_held`/`category_remaining` ve `room_capacity` verir. Bunlar kesin kayıt + süresi dolmamış bekleme/deneme tekliflerinin sunucu hesabıdır. Kontrollü aşımda kalan yer sıfırın altına düşmez; tanımlı limit ayrı kalır. Rezervasyon listesi `booking_category` snapshot'ını gösterir. Bu özetler yeni kayıt yetkisi veya boş yer garantisi değildir; komut yeniden denetler.
