## 27 Ekim — Starter plan kapıları teslimi kapandı

[PR #56](https://github.com/SXQHex/FtkSaaS/pull/56) main `ed747324f7d008b24103d4fd2eba503791c70a93` üzerinde kabul edildi: **213 callable API / 0 contract_only / 66 migration / 90 core tablo**. [Aday full clean40419827224](https://github.com/SXQHex/FtkSaaS/actions/runs/40419827224), [aynı main full clean40422823564](https://github.com/SXQHex/FtkSaaS/actions/runs/40422823564) ve [development CD40425584520](https://github.com/SXQHex/FtkSaaS/actions/runs/40425584520) başarılı. CD gerçek deploy ve20/20 hosted kontrol içerir; backend-v1 Edge21 ACTIVE, `verify_jwt=true`. JWT doğrulaması son kullanıcı kararıyla açık kalır.

Starter limitleri **1 merkez / 1 aktif oda / 1 disiplin / 1 aktif eğitmen / 100 aktif öğrenci**; tek mantıksal oda, seçili merkez-disiplin paketi ve disiplin adı ön eki uygulanır. Genel CRM/etkinlik/personel/hakediş kapalı; yoklama anlaşmasız ve hakedişsiz çalışır. Canlı plan/kapsam kapıları eski receipt/preview/grant ve doğrudan RPC ile aşılamaz. Pro→Starter kapsam seçimi sürümlüdür; seçilmeyen operasyon kapanır, geçmiş seans/kesin rezervasyon/hak/finans kayıtları korunur. [DTO, kapsam ve kabul kanıtları](starter-plan-gates-handover.md).

Bu kapanış yalnız plan kapıları ve sürümlü kapsam düşürme teslimidir; bütün Starter dağıtım yol haritası, gerçek public hostname/Turnstile, Pro/Business ayrı limit/özel teklif veya production hazırlığı tamamlandı sayılmaz. Aşağıdaki önceki kaynaklara ait tarihli aday/bekleme/envanter notları tarihsel checkpointlerdir; güncel kabul veya açık iş olarak kullanılmaz. Tarihsel `reports/` dosyaları ve eski kaynak snapshotları korunur. Bu belge eşitlemesi yeni runtime testi veya deploy değildir.

# Beş ayar kapsamı ve kalıcı geliştirme pilotu

## 26 Ekim güncel ürün hedefi

Backend frontendten bağımsız kullanıma hazırlanır; ekran/render kabulü bu işin kapanış şartı değildir. Ayrı kalıcı dummy/pilot kurulum görevi kullanıcı tarafından iptal edildi; var olan sentetik kayıtların silinmesi gerekmez. PR48 runtime34aac276 aynı-main clean/CD kabulü kapalıdır. PR49 izole managed-baseline restore sahiplik/ACL/RLS, Auth giriş, Storage bayt aktarımı ve beş worker idle dönüşünü doğruladı; [restore sınırı](remote-backend-setup.md#restore-20261026) hosted afet kurtarma/RPO/RTO’yu açık tutar. Aşağıdaki25 Ekim prototip başarısızlığı tarihsel denemedir.

PR50 yerel aday212 API/64 migration;46 ayar alanı/44 writable ve beş kendi-hesap session/TOTP API’si içerir. Yeni native/bağımsız/full clean/main/CD kabulü ayrı tamamlanır. [Ayar ve güvenlik devri](frontend-settings-handover.md) güncel destek sınırıdır. Yeni Auth factor trigger’ları eski restore kanıtına dahil değildir.


25 Ekim 2026 başlangıç kaynağı: `d6b67139445f2b88298fc0ee6e1f5c476f3586b7`,207 API/61 migration. Main clean40206350648 ve development CD40207909599 başarılı; PR45 kapasitesi açık iş değildir. Bu ilk pilot ön koşul adayı207 API/62 migration; aşağıdaki kalan kapsam tamamlanmadan pilotun bütünü kabul edilmez.

## Son kullanıcı hedefi ve veri kararı

Beş ayar ekranının backend alan/API kabulü tamamlanacak; öğrenci/eğitmen/yönetici gerçek entegrasyonu ve kayıt→paket satın alma→rezervasyon→yoklama→hakediş→rapor zinciri hazırlanacak. Frontend henüz yeni FtkSaaS backend’iyle yayımlanmadı. Kullanıcı frontend için fethiyetango.com alt alanını kullanacak; öncelik hazır backend’dir. Bağlı Vercel studiosaas projesi eski SXQHex/studioSaaS kaynağına aittir; yeni FtkSaaS ekran kabulü kanıtı olarak kullanılmaz, değiştirilmez.

25 Ekim son yetki: sentetik veriler geliştirme Supabase projesine kalıcı yazılabilir, her seferinde silinmez; frontend geliştirmede kullanabilir. Gerçek kulüp verilerinden ayrı, açıkça sentetik adlandırılmış pilot organizasyon ve hesaplar kullanılır. Mevcut kulüp/Owner üyelik/finans verisi ezilmez. Dağıtım öncesi veri sıfırlama ayrıca yapılacaktır; bu karar şimdi toplu silme veya mevcut kimliğe bürünme izni değildir. Kullanıcı girişleri gerçek native Auth hesabı/oturumuyla yapılır; SQL ile sahte oturum oluşturulmaz. Kalıcı fixture oluşturulmadan oluşturuldu denmez.

## Teslim sırası ve somut kapanış koşulları

| Hat | Kapanış koşulu | Mevcut durum |
|---|---|---|
| 1. Operasyon/pilot ön koşulları | Worker güvenli session lookup, minimum EXECUTE, gerçek native roller; aynı sentetik orgda uçtan uca zincir; izole dump/restore eşitliği ayrıca restore hattında | Bu adayda güvenlik/zincir kodu ve dar doğrulama; son inceleme/CI/main/CD gerekir. |
| 2. Beş kapsam ayarları | Tüm kabul alanları gerçek read/write/DTO/yetki/sürüm/reset/consumer ve açık sağlayıcı durumuna eşlenir | PR50 adayı46 alan/44 writable; yalnız bu kapsamın native alan matrisi eklenir.69 grubun tamamı değildir. |
| 3. Kalıcı hosted pilot | Mevcut sentetik veri yeniden kullanılabilir | Ayrı dummy kurulum işi iptal edildi; yeni kurulum kabul kapısı değildir. |
| 4. Frontend entegrasyonu | Yeni frontend SHA/önizleme + gerçek Auth→ekran→Edge→DB + öğrenci/eğitmen/yönetici yetki, stale/replay/hata testleri | Yeni dağıtım yok; kaynak/önizleme gelmeden kabul edilemez. Tasarım Claude alanıdır. |
| 5. Restore/temel operasyon kapanışı | Veri+Auth çalışırlığı+Storage byte+gerekli secret/config ve worker geri dönüşü; izole hedefte tekrar doğrulama, RPO/RTO kanıtı | İzole PostgreSQL restore prototipi yönetilen extension ACL’lerinde başarısız; bu adaydan çıkarıldı. Hosted tam afet dönüşü/Storage/secrets açık. |

## Beş ekranın mevcut backend kabul sınırı

| Ekran | Mevcut genel ayar alanı | Ayrı kalan gerçek eksikler |
|---|---:|---|
| Kullanıcı |20 | Fotoğraf/ad-soyad ve doğrulanmış iletişim yayılımı; gerçek Google sağlayıcısı, hosted TOTP aktivasyonu ve güvenilen cihaz; ekran/bağlam kaydı; sessiz saatler. |
| Üye |9 | Açılan profil/iletişimin FD05 kitlesine gerçek projeksiyonu; takvim aboneliği; olay/zaman/özet consumerları. |
| Merkez |4 | Alan bazlı miras/şablonlar ve kabul edilmiş başlangıçların ilgili domain komutlarıyla eşlenmesi. |
| Organizasyon |9, marka2 salt okunur | Hazır marka kataloğu/seçimi ve PNG/JPEG/WebP logo hattı; delegasyon, şablon/default yayını ve domain consumerlar. |
| Platform |4 | Onaylı asset/katalog yönetimi, plan/fiyat katalog yolları, alan default/yayın/miras ve hazır sağlayıcı kullanılabilirliği. |

Gerçekten desteklenmeyen özellik genel JSON patch’e eklenmez; kayıt başarılı taklidi yoktur. Mevcut altı genel ayar API’si ve domain API’leri [frontend devrinde](frontend-settings-handover.md), kabul edilmiş alan kararları [teknik sözleşmede](../contracts/02-FtkSaaS-teknik-sozlesme.md#ayarlar-backend-frontend-siniflama). Mevcut field kataloğu backend depolamasını kanıtlar; frontend render veya henüz yazılmamış consumer davranışını kanıtlamaz.

## Restore deney sonucu — kabul açık

Vercel izolasyonunda gerçek PostgreSQL17.11 custom pg_dump snapshot’ı alındı; rastgele yeni yerel DB’ye restore denendi. Yönetilen Auth şema sahibi supabase_admin ve extension ACL’leri normal postgres kullanıcısıyla yeniden kurulamıyor. no-owner ile denemede de managed pg_stat_statements_reset grant adımı reddedildi; bu, restore kabulü değildir. Kaynak DB değiştirilmedi; oluşturulan hedef DB ve geçici archive’lar finally ile temizlendi. Deneme aracı bu teslimden çıkarıldı; çalışan test komutu diye sunulmaz. Sonuç ve güvenlik sınırı sonraki restore çalışmasının başlangıcıdır, başarısızlık gizlenmez.

Tam kapanış için yönetilen sahiplik/rol/ACL geri yükleme stratejisi, Auth login/oturum, Storage byte, gerekli secret/config ve worker geri dönüşü ayrı izole hedefte doğrulanacak. App verisi yeniden oluşturulabilir diye Auth/Storage/sırlar veya RPO/RTO kabulü varsayılmaz. Mevcut hosted projeye reset/restore uygulanmadı.

## Dar native doğrulama

62 migration temiz native Supabase’e yüklendi. Veritabanı physical-baseline ve OPS-W01 dedicated LOGIN/COMMIT/lease/kesinti kontrolleri geçti. İlk birleşik dar koşuda40 test düğümü,38pass/2fail (yeni rapor karşılaştırması + üst test) vardı; hata testin ReportTotal.metric yerine group_key kullanması gerektiğiydi. Aynı tutar assertionı korunarak yalnız yeni zincir tekrar çalıştı:2/2pass,0fail, normal exit0;81326.883774ms. Kaynak kapsamı t.test pilot zinciri ve onun sentetik native Auth/org hazırlığıdır; eski diğer alt testler açık skip pattern ile dışarıda, yeniden çalışmış sayılmaz.

Ayrı Frontend settings scope suite’i10/10pass,0fail, normal exit0;218546.341701ms. Bu beş scope’un44 mevcut alanı/42 writable için katalog, typed istek, write/read/replay ve salt okunur marka reddini içerir; henüz uygulanmamış69 grubun tamamına kabul taşınmaz. Yeni SDK/provider/ekran render kabulü yoktur. Yerel146 yapısal test ve PGlite62 migration derlemesi geçti. Native ortam ephemeral Sandbox sbx_O84sqkOKZ5jtDuYvDLBkdIK0HbCH;15dk sınırında durdu, yeni oturum açılmadı. Paylaşılan hosted pilot henüz oluşturulmadı.

## Güvenlik sınırı

private.ops_run SECURITY INVOKER ve COMMIT yapabilen SET-clause’suz procedure olarak kalır. Beş dedicated LOGIN için search_path=pg_catalog connection defaultu ve girişte session-level set_config uygulanır. Caller farklı path seçse de CALL başlangıcında güvenli değere döner; COMMIT/lease davranışı native testte korunur. public.rls_auto_enable mevcutsa PUBLIC/anon/authenticated EXECUTE kaldırılır; platform event trigger kaldırılmaz. Linter0011 procedure proconfig=null nedeniyle görülebilir; bu uyarıyı susturmak için COMMIT’i bozan SET clause eklenmez. Gerçek kontrol connection defaultu+runtime pin+dar EXECUTE’dür. Free plan parola uyarısı önceki kullanıcı kararıyla istisnadır. Hosted yeni kabul ölçümü kaynak/main/CD sonrası yapılır.
