# FtkSaaS tasarım v2: ilerleme (A1 - A8 kısmen) ve kararlar

Güncelleme: 12 Kasım 2026. Artifact: https://claude.ai/artifact/CSxL1ss3AX8eh7qbBiVuLY (v36). Zip: tasarim-v2.zip (v36 ile eşit). **`claude/devam-rehberi-yeni-sohbet.md` içindeki v34 / "eğitmen rol görünümü ilk iş" ve zip'teki README/GECIS ifadeleri eskidir; bu notun "Sıradaki" ve "Bilinen eksikler" bölümleri geçerlidir.** Bu not `claude/tasarim-eksikler-ve-cizim-sirasi.md` dosyasının ilerleme ekidir; o dosyadaki "v24" ve "açık sorular" bölümleri bu nota göre okunmalı.

## Kullanıcı kararları (açık sorular)
1. Starter'a kapalı özellikler kenar çubuğunda **gizlenir** (bağlam içinde kilit rozeti yine planlı).
2. Platform operatörü ekranları (C6) **kapsamda**.
3. Hakediş **Satış** grubunda.
4. Yalnızca **üye paneli ayrı kabuk**; eğitmen paneli yönetim kabuğunda sadeleştirilmiş rol görünümü.

## Çizilenler
- A1.1 - A1.3: dondurma/paket değişimi/sonlandırma, paket sürümü yayını, eğitmen değiştirme ve sabit grup (v25 - v27).
- A2 (v28): Hakediş sayfası, Stüdyo > Anlaşmalar.
- A3 (v29): Seans detayı > Bekleme listesi, süreli yer teklifi. Varsayım: teklif süresi = min(ayar, seans başlangıcına kalan dakika). Kullanıcı onayı bekliyor.
- A4 (v30): Etkinlikler listesi/detayı, ekle-düzenle, 3 adımlı kayıt, iptal etki önizlemesi.
- A5 (v31): Adaylar sayfası dört sekme (Pano Kanban + klavye alternatifi, Takipler, Başvurular, Liste), deneme teklifi → kabul → yönetici kayıt onayı, ortak başvuru kutusu.
- A6 (v32): Ayarlar > Bildirimler > Üye hatırlatmaları; yeni **Otomasyon** sayfası (Segmentler, Otomasyonlar, Son işler); Gelen kutusu'na otomasyon uyarısı.
- A7 (v33): **Ayarlar > Ekip** (Kişiler, İzinler matrisi, rol kaldırma önizlemesi, son Merkez yöneticisi koruması, yönetici hesabı sınırı 3).
- A8 / Ayarlar S12 (v34): Marka, Politikalar, Şablonlar, Geçmiş sekmeleri; Rezervasyon'da varsayılana sıfırla; Hesabım > Görünüm tercihleri.
- **A8 / Eğitmen rol görünümü (v35):** Üst çubukta "Yönetici | Eğitmen" önizleme seçici (`#role-sw`, yalnız tasarım önizlemesi). Eğitmen (Elif K.) menüsü: Bugün (bekleyen yoklama sayacı), Programım (haftalık, önceki/sonraki hafta), Hakedişim, Yardım, Hesabım. Diğer rotalar Bugün'e yönlenir (toast). `#egt-*` derin bağlantısı rolü kendiliğinden eğitmene çevirir.
  - Bugün: 4 özet kartı, bugünkü seanslar (durum rozeti + Yoklama/Görüntüle/Aç), haftanın sonraki seansları, veri sınırı notu (üye iletişim/ödeme/paket bilgisi görünmez).
  - Yoklama (`egt-seans`): planlanan başlangıçtan 15 dk önce açılır; fiilî başlangıç planlanandan 5 dk veya fazla farklıysa gerekçe zorunlu; 15 dk'dan erken, seans bitişinden sonrası ve seans günü dışı engellenir; Geldi/Gelmedi taslak olarak saklanır; tüm üyeler işaretlenmeden kapatılamaz; kapatma etki önizlemesi (yoklama, hak tüketimi, hakediş tutarı); kapalı yoklamada yalnız gerekçeli "Düzeltme iste". Bugünkü Arjantin tango seansı yönetici Seans detayı yoklamasıyla **aynı kaydı** kullanır (`SHARED.attApi`); kapatınca hakediş satırı oluşur.
  - Hakedişim: salt okunur özet, geçerli anlaşma (sürümlü), seans satırları ve ödemeler, dönem süzgeci.
  - Saat dilimi: Hesabım > Saat dilimi "Cihaz saati" ise saatler cihaza çevrilir, hafta içinde DST değişimi varsa uyarı.
  - Doğrulama: Playwright açık/koyu, 400px yatay taşma yok, konsol hatasız, zip `file://` ile açılıyor.
- **A8 / Üye paneli, ayrı kabuk (v36):** Yönetim kabuğundan bağımsız (üst gezinme, mobilde alt çubuk), rotalar `#m-*`. Rol önizleme seçicisi artık Yönetici | Eğitmen | Üye (`SHARED.roleTo`). Selin Aksoy olarak giriş.
  - Dersler: hafta/gün seçici, kayıt ol (hak seçimi + etki: hak, kalan, ücretsiz iptal süresi), iptal (etki önizlemesi, geç iptalde hak düşer), dolu derste bekleme listesine gir, kayıt kapalı nedeni (belge, hak yok, borç, dondurma, pasif, açılış penceresi).
  - Rezervasyonlarım: yaklaşan (sabit grup dahil), bekleme listesi ve süreli yer teklifi (geri sayım, kabul/ret, süre dolunca düşer; teklif süresi = min(ayar, derse kalan dk)), geçmiş.
  - Haklarım: paket, kullanılabilir/ayrılmış/kullanılan, hak hareketleri, bakiye ve ödemeler, önceki paketler.
  - Özel ders: talep (eğitmen uygunluğu, çakışma, geçmiş saat doğrulaması), geri çek, alternatifi kabul/reddet.
  - Hesabım: kişi bilgileri (ad salt okunur; telefon, e-posta düzenlenir, e-posta doğrulama bekler), belge kabulü, kendi bildirim tercihleri (zorunlu bildirimler kilitli).
  - Yönetim verisiyle bağ: hak/rezervasyon/telefon `SHARED.stu()` ile aynı kayıt (iptal ve kayıt Üye profilini değiştirir), politikalar Ayarlar > Rezervasyon alanlarından okunur, belgeler Belgeler modülüne bağlı (`docsOf`, `docAccept`).
  - Doğrulama: Playwright (açık/koyu, 400px yatay taşma yok, konsol hatasız, çift ID yok), zip `file://` ile açılıyor. Eğitmen ve yönetici akışlarında gerileme yok. Düzeltme: eğitmen görünümünde boş durum satırı dar sütuna sıkışıyordu, giderildi.

## Bilinen eksikler
- A3 teklif süresi sınırı varsayımı.
- A4: Etkinlikler Ders programı takviminde görünmüyor; etkinlik ödemesi Finans'a yazılmıyor; etkinlik hakedişi yok.
- A5: Aday çekmecesi Aşama seçimi "Deneme planlı"yı doğrudan atayabiliyor (teklifi atlar); görevler/başvurular Finans ve Üyeler ile bağlı değil; deneme koltuğu deneme listesi metninden düşmüyor; herkese açık form A8'de.
- A6: Otomasyonun oluşturduğu yönetici görevi Adaylar > Takipler listesine yazılmıyor; "Starter'da hatırlatma gizli" Faz B'de.
- A7: Otomasyon görev sorumlusu listesi Ekip'ten gelmiyor; Sahipliği devretme akışı yok (C5 ile); Business'ta çoklu merkez rolleri Faz C. İzinler matrisi sayfa görünürlüğünü hâlâ etkilemiyor (yalnız eğitmen rol görünümü var).
- A8 Ayarlar: hafta başı tercihi takvime bağlı değil; ölçek CSS zoom ile (gerçekte rem tabanlı olmalı); Plan sekmesindeki "Planı yönet" yer tutucu; politikalar henüz Rezervasyon/Paketler davranışını değiştirmiyor.
- **Eğitmen görünümü (v35):** "Düzeltme iste" yöneticinin Gelen kutusuna yazılmıyor; Hesabım eğitmen için de yönetici içeriğini gösteriyor; tarih/saat sabit (Çar 4 Kasım 14:20) olduğundan akşam seansı hep "erken" görünür, açma/kapama akışı bugün yalnız Arjantin tango seansında denenebilir; geçmiş seansların yoklaması örnek veridir; eğitmen başka eğitmenin seansını görmez ama ders/eğitmen değişikliği (A1.3) eğitmen listesine canlı yansıma testi yapılmadı.
- **Üye paneli (v36):** özel ders talebi yönetimdeki Talepler'e yazılmıyor ve oradan gelen yanıt üyeye yansımıyor; üye bekleme listesi/teklifi yönetici Seans detayı > Bekleme listesi ile ortak değil; program yönetici takviminin sürükle-bırak değişikliklerini ve tek seferlik seansları yansıtmıyor; kişi adı üyede salt okunur (ad düzenleme yönetici adı anahtar olarak kullandığı için yapılmadı, karar bekliyor); giriş/oturum kapatma, bildirim merkezi ve hesap silme yok; tarih/saat sabit.
- Zip: önceki `README.md` ve `GECIS.md` 12 Kasım oturumunda çalışma ortamında yoktu; v35 ve v36 zip'leri bunların yerine `GECIS-v35-egitmen.md` ve `GECIS-v36-uye-kabugu.md` içerir. Kullanıcının elindeki README/GECIS'e bu not eklenmeli.

## Sıradaki
A8'in kalanı, bu sırayla: herkese açık sayfa → ICS → abonelik → rapor/içe aktarma → giriş/hesap (S01) → denetim ve işlem durumu → ortak durumlar. Sonra A9 tutarlılık, Faz B Starter, Faz C Business (C6 dahil).

## Her turdan sonra
Playwright: masaüstü açık/koyu, 400px yatay taşma yok, konsol hatasız; aynı URL'ye yayın; zip yeniden üretilir (index.html, tokens.css, app.css, app.js, README.md, GECIS.md).


## v37 — Herkese açık sayfa (Version 17)
- Ayarlar > Yayın sekmesi (yayın, slug, doluluk gösterimi, bölüm anahtarları, onay cümlesi + form sürümü, önizleme).
- #pubshell: program (14 gün, filtre, etkinlikler), başvuru formu (doğrulama, tekrar başvuru, honeypot, onay kanıtı), kapalı durumu. Başvuru Adaylar'a düşer, sayaç güncellenir.
- Test: masaüstü açık/koyu, 400px taşma yok, konsol hatası yok, v35/v36 regresyonu temiz.
- Bilinen eksik: yayın kapalıyken kayıtlı slug değişimi yönlendirme/uyarı yok; etkinliklere kayıt formu ziyaretçide yok (yalnız bilgi).
- Sıradaki: ICS → abonelik → rapor/içe aktarma → giriş/hesap → denetim → ortak durumlar.

## v38 — ICS takvim bağlantısı (Version 18)
- Üye paneli > Hesabım > Takvimime ekle: oluştur / yenile / kapat, bağlantı bir kez tam gösterilir, kopyala, kurulum ipuçları (Google/Apple/Outlook).
- Bilinen eksik: eğitmen ve yönetici için ICS yok; yönetici üye kaydında bağlantı durumu görünmüyor; yenileme/kapatma denetim kaydına düşmüyor.
- Sıradaki: abonelik (Ayarlar > Plan) → rapor/içe aktarma → giriş/hesap → denetim → ortak durumlar.

## v39 — Abonelik (Version 19)
- Ayarlar > Plan: plan değiştir (yükseltme hemen, düşürme dönem sonu, limit aşımında devre dışı), planlanan geçişi geri alma, kart güncelleme, fatura listesi, abonelik iptali ve geri alma. Yönetici limiti seçili plana bağlı; Geçmiş'e Plan/Yayın bölümleri eklendi.
- Bilinen eksik: gerçek ödeme/3D Secure yok; Başlangıç planında kapanan özellikler (Faz B) henüz gizlenmiyor; iptal sonrası salt okunur hâl çizilmedi; fatura bilgileri (unvan, vergi no) düzenlenemiyor.
- Sıradaki: rapor ve içe aktarma → giriş/hesap → denetim ve işlem durumu → ortak durumlar.

## v40 — Rapor ve içe aktarma (Version 20)
- Raporlar: özel tarih aralığı, 4 sekme (Özet, Tahsilat ve borç, Eğitmen ve adaylar, Dosyalar), CSV dışa aktarma işleri (ilerleme, hazır, başarısız + yeniden dene).
- Üyeler > İçe aktar: 3 adımlı sihirbaz (dosya, önizleme + atlanan satır onayı, ilerleme/sonuç), satır listesi, tekrar gönderimde tek sonuç.
- Bilinen eksik: özel aralık verisi 90 günlük veriden ölçeklenir; hakediş/CRM rakamları rapor içinde sabit; içe aktarılan kişiler Üyeler/Davetler listesine yazılmıyor; dışa aktarma Denetim kaydına yazılmıyor.
- Sıradaki: giriş/hesap (S01) → denetim ve işlem durumu → ortak durumlar → A9.

## v41 — Giriş ve hesap S01 (Version 21)
- Ayrı #authshell, shadcn login-02/signup-02 düzeni: giriş, kayıt, e-posta doğrulama, parola kurtarma ve yeni parola, iki adımlı doğrulama (kod + kurtarma kodu), davet kabulü, süresi dolan davet, hesap silindi.
- Hesabım > Güvenlik: parola değiştir, iki adım kur/kapat, güvenlik geçmişi, oturum kapatma, hesabı sil (yönetici sahiplik engeli); Çıkış yap; üye Hesabım > hesabı sil.
- Bilinen eksik: gerçek oturum/yetki yok (giriş yalnız rolü seçer, giriş yapmadan #hash ile sayfalara gidilebilir); Google girişi yalnız bildirim; sahiplik devri ve stüdyo kapatma ekranı yok (Faz C5); kayıttan sonra stüdyo kurulum sihirbazı yok; güvenlik olayları denetim ekranına bağlı değil.
- Sıradaki: denetim ve işlem durumu (S11/F33) → ortak durumlar → A9.

## v42 — Denetim ve işlem durumu S11/F33 (Version 22)
- Stüdyo > Denetim: denetim kaydı (filtreler, ayrıntı çekmecesi, dışa aktarma işi) ve İşlemler (önizleme+süre, canlı ilerleme, kısmi, yeniden denenecek, başarısız, tamamlandı; yalnız retry_available için yeniden dene).
- Ayarlar geçmişi ve güvenlik olayları denetim kaydına yansır; işlem tamamlanınca kayıt eklenir.
- Bilinen eksik: Finans, Üyeler, Yoklama, Hakediş gibi sayfalardaki işlemler henüz denetim kaydına yazmıyor (seed veri + Ayarlar/Güvenlik/İşlemler yazıyor); Raporlar > Dosyalar işleri ile bu İşlemler listesi ayrı; Starter'da denetim görünürlüğü Faz B'de; 15 satırlık sayfalama basit (sunucu cursor yok).
- Sıradaki: ortak durumlar (yükleme/boş/hata, sürüm çakışması, plan limiti, yetkisiz, kapalı erişim, 404, onay süresi doldu, tekrar gönderim) → A9.

## v43 — Ortak durumlar (Version 23)
- `.state` bileşeni + iskelet; 404 ve 403 gerçek davranış, çevrimdışı çubuğu; Yardım > Durum ekranları kataloğu (12 durum, denenebilir).
- A8 tamam. Kalan: A9 tutarlılık ve borçlar, Faz B Starter, Faz C Business (C6 dahil).
- Bilinen eksik: sürüm çakışması diyaloğu, kapalı erişim (salt okunur) ve plan limiti durumları henüz gerçek sayfalara bağlı değil (kayıt kaydı, abonelik sonu, Üyeler limit); yükleme iskeleti sayfalarda kullanılmıyor.
- Sıradaki: A9 (tek mock veri kaynağı, Raporlar/Finans bağlantısı, denetim kaydına yazma, Etkinlikler takvime, vb.).

## v44 — A9 dilim 1: Ctrl K Ara ve git (Version 24)
- A9 borç listesinden kapandı: "Ctrl K arama düğmesi görsel; çalışır hâle gelsin, Yardım kısayol listesine eklensin."
- A9'da kalan: Raporlar rakamlarını Finans kayıtlarına bağlama; Etkinlikler'i Ders programı takvimine düşürme ve etkinlik ödemesini Finans'a yazma; otomasyon görevini Takipler'e yazma; İzinlerin sayfa görünürlüğünü etkilemesi; politikaların Rezervasyon/Paketler davranışını değiştirmesi; hafta başının takvime bağlanması; Gelen kutusu silme/arşiv/toplu seçim; birleştirme kopyalarının Üyeler listesinde görünmesi; eski Seans detayı ile #oc-sheet birleşimi; işlemlerin denetim kaydına yazılması; durum ekranlarının gerçek sayfalara bağlanması (409, salt okunur, limit, iskelet).
- Sıradaki dilim: Etkinlikler takvimde + etkinlik ödemesi Finans'a, ardından Raporlar-Finans bağı.

## v45 — A9 dilim 2: Etkinlik ödemesi → Finans ve üye (Version 25)
- Etkinlik kaydı/iptali Finans satış-tahsilat-alacak, üye ödeme geçmişi, borç ve alacağı günceller (SHARED.finEvent). Mevcut etkinlik kayıtları Finans'a işlendi.
- A9'da kalan: Etkinlikleri Ders programı takvimine düşürme; Etkinlik detayında "Ödemeyi al" (bekleyen kayıt, Finans tahsilatıyla eşleşme yok); Raporlar rakamlarını Finans'a bağlama (etkinlik geliri dahil); otomasyon görevi → Takipler; İzinler → sayfa görünürlüğü; politikalar → Rezervasyon/Paketler; hafta başı; Gelen kutusu silme/arşiv/toplu; birleştirme kopyaları; eski Seans detayı ile #oc-sheet; işlemlerin denetim kaydına yazılması; durum ekranlarının gerçek sayfalara bağlanması.
- Sıradaki dilim: Etkinlikler Ders programı takviminde.

## v46 — Etkinlikler Ders programı takviminde (A9 dilim 3)
- Hafta/gün görünümünde yayımlanmış/tamamlanmış/iptal etkinlikler ayrı stil (kesik kenarlık, "Etkinlik" rozeti) ile görünür; tıklayınca etkinlik detayı.
- Salon filtresi etkinlikleri de süzer; eğitmen filtresinde gizlenir; salon çakışması işaretlenir (kaydı engellemez).
- Testler: t19 yeni, t4/t6/t8/t12/t16/t17 temiz; 400px taşma yok.
- Kalan A9: Finans "Ödemeyi al" (etkinlik borcu), Raporlar–Finans uyumu, otomasyon→Takipler, izinler→sayfa görünürlüğü, politikalar, hafta başı, Gelen kutusu toplu işlem, üye birleştirme, eski Seans detay, denetim kaydı kapsamı, ortak durumların sayfalara bağlanması.

## v47 — Etkinlikte "Ödemeyi al" (A9 dilim 4)
- Ödeme bekleyen etkinlik kaydında "Ödemeyi al": yöntem seçimi, etki listesi; Finans tahsilatı eklenir, üye borcu düşer, üye ödeme geçmişi yazılır, kayıt "Ödendi" olur. Sonradan kayıt iptali alacak (iade) akışına girer.
- Test: t20 yeni; t17/t18/t19/t6 temiz; 400px taşma yok.
- Açık: Finansta etkinlik tahsilatı iptal edilince etkinlik kaydı geri "bekliyor" olmaz; Raporlar–Finans uyumu; otomasyon→Takipler; izinler→sayfa görünürlüğü; politikalar; hafta başı; Gelen kutusu toplu işlem; üye birleştirme; eski Seans detay; denetim kaydı kapsamı; ortak durumların sayfalara bağlanması.

## v48 — Raporlar–Finans uyumu (A9 dilim 5)
- Raporlar cirosuna etkinlik satışı, haftalık grafiğe kayıt haftası, paket/satış dağılımına "Etkinlikler" satırı eklendi; "Tahsil edilen" gerçek etkinlik tahsilatını içerir. Ödemeyi al sonrası Raporlar'da tahsilat artar, açık borç düşer.
- Sayfa her girişte yeniden hesaplanır. Test: t21 yeni; t11/t17/t20 temiz; 400px taşma yok.
- Açık: paket rakamları örnek veri (Finans satışlarıyla birebir değil); otomasyon→Takipler; izinler→sayfa görünürlüğü; politikalar; hafta başı; Gelen kutusu toplu işlem; üye birleştirme; eski Seans detay; denetim kaydı kapsamı; ortak durumların sayfalara bağlanması; Finans tahsilat iptali→etkinlik kaydı.

## v49 — Denetim kaydı kapsamı (A9 dilim 6)
- `SHARED.audit` köprüsü; Finans (tahsilat, iptal, etkinlik ödemesi), Üye paneli (tahsilat, hak düzeltme, dondurma), Yoklama (kapatma/düzeltme; yönetici, eğitmen, etkinlik), Hakediş (ödeme, düzeltme) işlemleri Denetim kaydına düşer.
- Test: t22/t23 yeni; t13/t4/t5/t17/t20 temiz.
- Açık: Paketler, Belgeler, Rezervasyon politikası, üye ekleme/arşivleme, etkinlik oluşturma/iptali denetime yazılmıyor; otomasyon→Takipler; izinler→sayfa görünürlüğü; politikalar; hafta başı; Gelen kutusu toplu işlem; üye birleştirme; eski Seans detay; ortak durumların sayfalara bağlanması; Finans tahsilat iptali→etkinlik kaydı.

## v50 — Ortak durumlar sayfalara bağlandı: filtre sonucu yok (A9 dilim 7)
- `emptyRow` ile Üyeler, Paketler, Finans, Etkinlikler, Eğitmenler listelerinde tek biçim "Bu filtreye uyan … yok" + "Filtreleri temizle".
- Test: t24 yeni; t/t4/t13/t15/t16 temiz; 400px taşma yok.
- Açık: yükleme iskeleti, sunucu hatası, 409, salt okunur, plan limiti sayfalara bağlı değil (plan limiti Faz B ile); diğer A9 maddeleri (otomasyon→Takipler, izinler→sayfa görünürlüğü, politikalar, hafta başı, Gelen kutusu toplu işlem, üye birleştirme, eski Seans detay, denetim kapsamı genişletme, Finans iptali→etkinlik kaydı).

## v51 — Gelen kutusu toplu işlemler (A9 dilim 8)
- Onay kutuları, tümünü seç, Shift aralık; toplu okundu/okunmadı/arşivle/sil; Arşiv sekmesi; 7 sn geri al; ayrıntıda tek ileti arşivle/sil; boş durumlar.
- 400px'te gizli `sr-only` taşması düzeltildi (`.ib-item{overflow:hidden}`).
- Test: t25 yeni; t/t2/t24/t17 temiz.
- Açık: kalıcı silme/çöp kutusu yok (geri al yalnızca 7 sn); otomasyon→Takipler; izinler→sayfa görünürlüğü; politikalar; hafta başı; üye birleştirme; eski Seans detay; yükleme iskeleti/sunucu hatası/409/salt okunur sayfalara bağlı değil; Finans iptali→etkinlik kaydı.

## v52 — A9 kapanışı (Version 32)
- Kapananlar (ayrıntı GECIS-v52): izinler→sayfa görünürlüğü ("Bu kişi olarak görüntüle", 403), otomasyon→Takipler, birleştirme kopyaları/davet/CSV→Üyeler listesi, Finans↔Üyeler tahsilat senkronu (+Gelen kutusu "Tamamlandı"), Finans iptali→etkinlik kaydı.
- Zaten tamam sayıldı: politikalar (üye kabuğu `pol()`), eski Seans detayı (Çar 14:30 tango `#seans`, diğerleri `#oc-sheet`, tasarım gereği).
- **A9 kapsamından bilerek çıkarılanlar:** (1) hafta başı → takvim (takvim Pazartesi haftasına bağlı, veri modeli değişikliği; backend `week_start` ile), (2) yükleme iskeleti/sunucu hatası/409/salt okunur sayfa bağları (katalogda var, gerçek istek yok), (3) plan limiti (Faz B8).
- Bilinen eksikler: birleştirmede kopyanın borcu Finans satırı olarak yazılmaz; Finans tahsilat iptali üye ödeme geçmişi satırını silmez; Plan sayfası aktif üye sayısı (10) sabit; içe aktarılan üyeye paket/rezervasyon yok.
- Testler: t26 (izin görünümü), t27 (taskAdd), t28 (davet/birleştirme/içe aktarma), t29 (Finans iptali→etkinlik), t30 (tahsilat senkronu), t31 (400px); t..t25 regresyon temiz.
- **Sıradaki: Faz B Starter (plan kısıt katmanı).**

## v53 — Faz B1/B6 Starter kısıt katmanı
Plan limitleri hizalandı; kapalı özellikler Starter'da gizli/kilitli; "Planı yükselt" penceresi; Başlangıç'a düşürmede kaynak seçimi (salon/eğitmen/disiplin) + demo dönem sonu; limit durumu demo anahtarı. Test t32 + regresyon temiz.
Sıradaki: B2 tek salon/eğitmen sadeleştirme → B3 temel CRM → B4 dar public yüzey → B5 → B7 → Faz C.

## v54 — Faz B2/B3/B4
B2 tek salon/eğitmen (kilitli ekle, "Planda kapalı" rozeti, program salon filtresi gizli); B3 temel CRM (deneme teklifi, Başvurular, segment kapalı + bilgi notu); B4 dar public yüzey (etkinlik yok). Stüdyo sekmeleri 400px taşması giderildi. Testler t33/t34 + regresyon temiz.
Sıradaki: B5 → B7 → B6 üye seçimi (>100) → Faz C.

## v55 — Faz B kapanış
B5 yoklama→hakediş yok + temel raporlar; B6 üye seçimi (arama/sayfalama, 100 sınırı, boş seçim onayı); B7 yalnız işlem bildirimi. **Faz B (B1–B8) tamam.** Test t36 + regresyon + 400px temiz.
Sıradaki: Faz C Business (C1–C6, platform operatör ekranları dahil).

## v56 — Faz A eksiklerinin kapatılması
A5 aşama/deneme sayacı, A7 sorumlu listesi Ekip'ten, eğitmen "Düzeltme iste" → Gelen kutusu, Hesabım rol bilgisi, hafta başı → Program, birleştirme borcu → Finans, tahsilat iptali → üye geçmişi, durumlar (iskelet/hata/409/salt okunur) gerçek sayfalara bağlandı. Bilerek açık: A3 varsayım onayı, etkinlik hakedişi, CSS zoom, Pazar-ilk modda önceki hafta Pazar'ı salt okunur.
Sıradaki: Faz C Business.

## Karar (15 Kasım): A3 varsayımı onaylandı
Yer teklifi süresi = min(ayar, seans başlangıcına kalan dakika). Çizim bu kuralla kesinleşti; açık borç listesinden düştü. Not: Tasarım tamamlanınca frontend bu ekranlardaki mock veriyi backend API'sinden çağıracak; ekranlardaki işlem adları (`seat_offer_issue/expire` vb.) bu eşleme içindir. Süre hesabı backend'de de aynı kuralla yapılmalı.

## v57 — Faz C1 Merkezler
Merkezler sayfası (liste, ekle/düzenle, 5 sınır/6. reddi), Yöneticiler (Sahip/OM/MM, son yönetici koruması), Politikalar (Zorunlu/Tavsiye, miras, önizleme), Disiplinler, kenar çubuğu merkez seçici. Yalnız İşletme planı. Test t40/t41 + regresyon temiz.
Sıradaki: C2 birleşik kişi ve organizasyon başvuru kutusu → C3 hesaplaşma → C4 birleşik rapor ve daralma → C5 yaşam döngüsü → C6 platform operatörü.

## v58 — Faz C2 Birleşik kişi ve başvuru kutusu
Merkezler > Kişiler (Abone No, merkez kayıtları, kaynak/onay geçmişi, merkez kapsamlı okuma reddi, merkez onaylı birleşim) ve Başvurular (atama/aktarma/kapatma, disiplin kontrolü). Test t44/t41/t45 + regresyon temiz.
Sıradaki: C3 merkezler arası kullanım hakkı ve hesaplaşma → C4 birleşik rapor ve daralma → C5 → C6.

## v59: C3 Hesaplaşma + C4 Birleşik rapor / Business daralması
- C3: Merkezler > Hesaplaşma (hareketler, talepler, kullanım kapsamı, yetki/delegasyon). Sahip/OM tek başına yetki vermez, çift hareket yok, gerekçeli red.
- C4: Birleşik rapor (OM / merkez yöneticisi bakışı, mutabakat, tekil üye kotası 154/1250, cross_center_usage). Business daralmasında merkez seçimi, açık hesaplaşma engeli, arşive alma.
- Testler: t46 (akış), t47 (400px + daralma). Bilinen eksik: arşive alınan Moda seçiliyse merkez değiştirici güncellenmiyor; rapor FIN verisi sabit.
- Sıradaki: C5 (organizasyon yaşam döngüsü) → C6 (platform operatörü).

## v60: C5 Organizasyon yaşam döngüsü
- Ayarlar > Organizasyon: sahiplik devri (taze yetki, alıcı kabulü), kapatma önizlemesi/uygulama, yeniden açma, silme (dışa aktarma şart, iş ilerlemesi, partial/retry_wait tamamlandı sayılmaz). Business'ta açık hesaplaşma kapatmayı engeller.
- Test: t48. Bilinen eksik: kapalıyken diğer sayfalar gerçekten salt okunur değil (yalnız üst şerit); sahiplik devri sonrası Ekip rolleri ve Sahip rozeti güncellenmiyor.
- Sıradaki: C6 platform operatörü.

## v61: C6 Platform operatörü konsolu (Faz C tamam)
- Ayrı kabuk `#o-*`: organizasyon oluştur, SaaS ödeme doğrula/reddet, ek süre (en çok 30 gün), platform sahibi ekle/kaldır (son sahip korunur), 403 müşteri erişimi, Destek/Platform sahibi yetki ayrımı.
- Test: t49. Bilinen eksik: operatör kaydı yalnız oturumda tutuluyor, Denetim sayfasına yazılmıyor; organizasyon detay/askıya alma ekranı yok; ödemeyle plan/dönem Ayarlar > Plan'a yansımıyor.
- **Faz A, B, C çizim olarak tamam.** Kalan işler: A8 listesindeki başka sohbet borçları ve her fazın "Bilinen eksik" maddeleri.

## v62: Faz C bilinen eksik kapatma
- Sahiplik devri Ekip rollerine yansır, kapalı organizasyonda birincil eylemler pasif, operatör işlemleri Denetim'de, arşivde merkez değiştirici düzelir.
- Kalan: doğrulanan SaaS ödemesi Ayarlar > Plan dönemine yansımıyor; kapalıyken yalnız görsel pasiflik (gerçek yetki kontrolü backend'de); rapor FIN verisi sabit; arşiv rozeti Business'ta görünmez.

## v63: SaaS ödemesi → Plan dönemi, rapor → Finans
- Plan > Havale bildir, operatör doğrula/reddet Plan kartına yansır; Birleşik rapor Moda Merkez rakamları Finans'tan. Test: t52/t53.
- Kalan çizim eksikleri (backend hariç): arşiv rozeti, platform organizasyon detay/askıya alma, etkinlik hakedişi, hafta başı Pazar-ilk, Planı yönet/fatura bilgileri, iptal sonrası salt okunur, üye paneli bağları, ICS (eğitmen/yönetici), public slug uyarısı/etkinlik formu, rapor sabit rakamları/içe aktarılan üye paketi/dışa aktarma denetimi, kurulum sihirbazı, denetim kapsamı, sabit sayılar, CSS zoom.

## v64: arşiv rozeti kaldırıldı, platform organizasyon detayı + askıya alma
- Detay ekranı, askıya al/kaldır (Platform sahibi), müşteri tarafında askı şeridi. Test t54.
- Kalan çizim eksikleri: etkinlik hakedişi, hafta başı Pazar-ilk, Planı yönet/fatura bilgileri, iptal sonrası salt okunur, üye paneli bağları, ICS (eğitmen/yönetici), public slug uyarısı/etkinlik formu, rapor sabit rakamları/içe aktarılan üye paketi/dışa aktarma denetimi, kurulum sihirbazı, denetim kapsamı, sabit sayılar, CSS zoom.

## v65: kalan çizim eksikleri 5-9
- 5 etkinlik hakedişi, 6 Pazar-ilk düzenlenebilir, 7 fatura bilgileri, 8 iptal sonrası salt okunur, 9 üye paneli bağları (talep iki yönlü, bildirim merkezi, tek seans taşıması). Testler t55-t61.
- Açık: üye bekleme listesi ↔ yönetici Seans detayı; üyede kişi adı düzenleme (karar); seri taşıma üyeye yansımaz.
- Kalan çizim eksikleri: ICS (eğitmen/yönetici), public slug uyarısı/etkinlik formu, rapor sabit rakamları/içe aktarılan üye paketi/dışa aktarma denetimi, kurulum sihirbazı, denetim kapsamı, sabit sayılar, CSS zoom.

## v66: üyede kişi adı düzenleme (karar 1)
- Üye adını kendisi düzenler; tüm ad-anahtarlı mock kaynaklar yeniden adlandırılır, Denetim ve Gelen kutusu bilgi notu. Test t62.
- Açık: üye bekleme listesi ↔ yönetici Seans detayı; seri taşıma üyeye yansımaz.

## v67: kalan çizim eksikleri
- ICS: Hesabım'da yönetici (tüm program) ve eğitmen (kendi seansları) takvim bağlantısı oluştur/yenile/iptal; yönetici üye kaydında bağlantı durumu.
- Public: kayıtlı adres değişimi uyarısı (açık/kapalı), ziyaretçi etkinlik kayıt formu → Adaylar > Başvurular.
- Rapor: hakediş Hakediş'ten, aday hunisi Adaylar'dan; içe aktarmada paket/rezervasyon yok notu; dışa aktarma Denetim'e yazılır.
- Kurulum sihirbazı (3 adım, atlanabilir) kayıt sonrası ilk girişte.
- Denetim kapsamı: Paketler, Etkinlikler, Program, Belgeler, Ekip.
- Paketler aktif hak/satış rakamları üye listesi ve Finans'tan türetilir; ölçek CSS zoom yerine rem/kök font-size.
- Açık: %125 ölçekte 400 px taşma; üye bekleme listesi ↔ Seans detayı; seri taşıma üyeye yansımaz; eğitmen görünümü sabit tarih/saat.

## Belge düzeni (v67)
- Zip: `README.md`, `GECIS.md` (tek birleşik geçiş belgesi, eski GECIS-vNN notlarının yerine), `ILERLEME.md` (bu dosya), `tasarim-v2/{index.html, app.css, tokens.css, app.js}`.
- Proje: `claude/tasarim-ilerleme-a1-a6.md` (bu dosya) ve `claude/devam-rehberi-yeni-sohbet.md` (nasıl çalışılır). Eski `tasarim-eksikler-ve-cizim-sirasi.md` ve devir notları tarihsel kapsam belgesidir.
