# FtkSaaS — O4 tamamlanma ve doğrulama kaydı

> **Güncel 2.2-tech.2 / Q-D01:** Etkinlik 0/1/çok disiplin etiketini destekler. Tek etikette etkinliğe uygun dar/geniş paket, 0/çok etikette yalnız uygun geniş paket; etkinliklerde negatif kredi yok. Q-D01 ürün kararı kapalı, tam olay kayıt/RPC entegrasyonu ve son ortak kredi yarışı açık. Güncel durum 11-FtkSaaS-Q-D01-teknik-aktarim-raporu.md.

Güncel: 17 statik kontrol, 12 sözleşme/UUID testi, 10 gerçek DB alt testi (üst test dahil toplam runner 23), TypeScript typecheck ve advisors geçti. 88 tablo/178 operasyon sözleşmesi/690 tanım. Bütün iş kabulü açık. Ayrıntı ve sınırlamalar: 09-FtkSaaS-teknik-aktarim-raporu.md.

## Tarihsel v1.0 kayıt ve önceki kabul envanteri

> **Güncel teknik uygulama kaydı — 2.2-tech.1, 15 Ekim 2026:** D01–D09/U01–U08, 04–08 kataloglarına ve ortak tiplere aktarıldı. İki migration izole geliştirme DB’sinde uygulandı. Aşağıdaki eski “kod/kurulum yapılmadı” ve “teknik aktarım bekliyor” ifadeleri tarihsel kayıt olarak okunur. İş RPC’leri, ayrıntılı izin RLS politikaları ve gerçek iş akışı kabul testleri açık; Q-D01 yeni ürün kararı bekliyor. Güncel durum 09 teknik aktarım raporundadır.

> Güncel UUID üretim standardı: U01–U08, UUIDv7. Sağlayıcı kimlikleri korunur.

> Güncel ek: D01–D09 disiplin revizyonu kabul edilmiştir; aşağıdaki tarihsel teknik tamamlanma ifadeleri yeni kapsamı içermez. Ayrıntı ve açık teknik aktarım listesi belgenin sonundadır.

15 Ekim 2026 · v1.0 · O4 yazılı tasarım teslimi. 85 tablo, 174 operasyon, 665 tip/şema tanımı, 55 kabul senaryosu. Ürün/süreç kararları02’de; teknik adlar/mapping bu kataloglardadır. Kod/migration/endpoint/RLS uygulanmadı.

## Durum

Karar turu kapandı. O4’ün yazılı şema, istek/yanıt, alan, durum, hata, izin, transaction, semantic guard ve kabul envanteri04–08’de tamamlandı. Backend doğruluğunun testle kanıtlandığı veya üretime hazır olduğu anlamına gelmez. JSON Schema x-invariant ve semantic_guards DB/uygulamada uygulanacak zorunlu şartlardır; JSON tip kontrolü bunları tek başına ispatlamaz.

## Önceki K bulgularının kapanışı

| Bulgu | Son durum |
|---|---|
| K01 | Hesap erişimi mevcut kişiye ve öğrenci self profiliyle; ayrıcalık ancak link sonrası; owner rolü yalnız FtkSaaS. Çok rollü kişiye önceden grant varsayımı kaldırıldı. |
| K02 | Kaynak satışsız negatif yüzdede merkez değerleme bedeli rezervasyonda sabit; sonradan paket geçmiş hakedişi/ek öğrenci borcunu değiştirmez. |
| K03 | Grace ilk7gün mevcut seansa onay olabilir, yeni özel seans gerekiyorsa engel/bekleme; reject/withdraw açık. |
| K04 | Satış tarihleri kullanıcıdan açık, satış merkezi00:00 ve [start,end). Otomatik ay/takvim aylık ürün biçimi yok. DST/süre kesri teknik doğrulaması04’te. |
| K05 | Hafta/ay kota üyelik başlangıç çıpasında; son kısa dönem tam kota, deviryok, reservation reserve; iptal/yoklama consume/release. |
| K06 | Hukuki inceleme daha önce ertelendi. Varsayılan saklama sınıfları yürür; silinen hesap yeni namespace alır, doğrudan erişim bağı geri gelmez. Bu başlık hukuki teyit olarak açık, teknik karar turu değildir. |
| K07 | Çatışan iki hesapta merge durur; yetkili yanlış link düzeltmesi ön koşul, otomatik hesap seçimi yok. |
| K08 | Platform verified owner atar, owner merkez/self-CM kurar; ilk ödeme doğrulanınca öğrenci/satış/ders ve abonelik dönemi başlar; trial/ilk-payment grace yok. |
| K09 | Public application yalnız talep; merkez sabit koşullu candidate trial confirm, aktif öğrenci kotası istisnası yalnız aday denemesi; event istisna değil. |
| K10 | Öğrenci alternatif seçimi niyet, merkez son onay; kaynak/hak orada yeniden kontrol; personel reservation yetkisi dar scope. |
| K11 | CM blocked sonucu, başlangıç negatif limit aşımı katılımı engeller; geç ödeme geçmiş hakediş oluşturmaz. blocked yüzde/kişi0, gerçekleşen seans sabiti korunur. |
| K12 | İzinli merkez AND kapsam satırı, satırlar OR/satır boyutları AND. Bir katılım/bir kredi, farklı maliyet yeni özellik diye eklenmedi; hak seçimi bitiş/alış/ID. |
| K13 | Kaynak namespace+row key DB unique, satır başarı ile opening işlemleri atomik; e-posta otomatik identity değil. |
| K14 | Yeni reservation planned seans; tamamlanmış katılım correction, iptal geçmişi linked yeni kayda uygun koşulda. |
| K15 | Org belge/segment/automation Owner/OM, yerel CM; executor ayrı merkez yetkisi/plan/zorunlu kuralla. CM atama Owner, owner yalnız platform. |
| K16 | Görevli I/A mark, CM all-results close; event paket etkisi kayıt koşuluyla; duty fee ayrı gerçekleşme+CM verify, tahsilat/katılımcı sayısı fee değiştirmez. |

## Belge ve tip doğrulamaları

| Kontrol | Sonuç | Sınır |
|---|---|---|
| JSON referansları | GEÇTİ | 3242 referans, eksik hedef0 |
| Kapalı nesne tipleri | GEÇTİ | 575 nesne tipi additionalProperties=false |
| Required alanları | GEÇTİ | required her zaman tanımlı property |
| Operasyon benzersizliği | GEÇTİ | 174 işlem |
| Özellik kapsamı | GEÇTİ | 33/33 feature,14/14 modül |
| FK hedefleri | GEÇTİ | Tüm hedef tablo adları tanımlı; gerçek DB FK testi değil |
| İzin/hata referansları | GEÇTİ | Bilinmeyen izin/hata kodu0 |
| Eski owner-devri API | GEÇTİ | Customer owner_transfer_request/accept yok; owner set/remove platform-only |
| Owner yalnız platform | GEÇTİ | Platform actor istemciden seçilemez |
| Money float ret | GEÇTİ | Yerel sözleşme alt-küme doğrulayıcısı; production backend testi değildir |
| Money string kabul | GEÇTİ | Yerel sözleşme alt-küme doğrulayıcısı; production backend testi değildir |
| Client unknown field ret | GEÇTİ | Yerel sözleşme alt-küme doğrulayıcısı; production backend testi değildir |
| Capacity tipi | GEÇTİ | Yerel sözleşme alt-küme doğrulayıcısı; production backend testi değildir |
| Owner operational role enum ret | GEÇTİ | Yerel sözleşme alt-küme doğrulayıcısı; production backend testi değildir |
| Blocked ordinary mark ret | GEÇTİ | Yerel sözleşme alt-küme doğrulayıcısı; production backend testi değildir |
| Blocked result kabul | GEÇTİ | Yerel sözleşme alt-küme doğrulayıcısı; production backend testi değildir |
| Quota weekly tanımı | GEÇTİ | Yerel sözleşme alt-küme doğrulayıcısı; production backend testi değildir |
| Quota key injection ret | GEÇTİ | Yerel sözleşme alt-küme doğrulayıcısı; production backend testi değildir |
| Tarih biçimi | GEÇTİ | Yerel sözleşme alt-küme doğrulayıcısı; production backend testi değildir |
| UTC an timezone zorunlu | GEÇTİ | Yerel sözleşme alt-küme doğrulayıcısı; production backend testi değildir |
| Kapasite semantik aralık | GEÇTİ | Yerel sözleşme alt-küme doğrulayıcısı; production backend testi değildir |
| Erişim gönderme tenant zorunlu | GEÇTİ | Account prefix global scope hatası düzeltildi |
| Receipt org scope sorgusu | GEÇTİ | Org/G receipt namespace sorguda açık, authorization original operation üzerinden |
| Ödeme öncesi bootstrap | GEÇTİ | İlk ödeme yoksa satış/ders operasyonu yok |
| Okuma URL iptali | GEÇTİ | Her dosya indirmede güncel yetki; upload completion da current permission |
| Tam tahsilat request kabul | GEÇTİ | İstek başlığı ve bütün zorunlu alanlar birlikte |
| Sıfır tahsilat ret | GEÇTİ | PositiveMoney alan tipi |
| İstekten rol ekleme ret | GEÇTİ | additionalProperties=false; aktör backendden |
| Kritik işlem anahtarsız ret | GEÇTİ | operation_key zorunlu |
| Açık tarihli satış preview | GEÇTİ | Satışın start_date/end_date alanları, otomatik ay kaydırma yok |
| Bitiş tarihi olmadan satış ret | GEÇTİ | end_date gerekli, katalog süresi yerine geçmez |

Doğrulama aracı bu pakette kullanılan JSON Schema alt kümesini ve somut olumlu/olumsuz örnekleri kontrol eden yerel denetimdir. Harici tam2020-12 dialect/meta-schema validator çalıştırıldı iddiası yoktur. Gerçek PostgreSQL constraint/RLS/transaction, Auth entegrasyonu, provider gönderimi, yük veya restore testi çalıştırılmadı. Test sonuçları diye gösterilenler yalnız belge/type kontrolleridir.

## F01–F33 coverage

| Özellik | Operasyonlar |
|---|---|
| F01 | `organization_create_v1`, `organization_get_v1`, `organization_update_v1`, `organization_close_preview_v1`, `organization_close_apply_v1`, `organization_reopen_v1`, `organization_delete_preview_v1`, `organization_delete_apply_v1`, `centers_list_v1`, `center_create_v1`, `center_update_v1`, `room_save_v1` |
| F02 | `availability_save_v1`, `availability_exception_save_v1` |
| F03 | `policies_get_v1`, `policy_publish_v1` |
| F04 | `organizations_list_v1`, `roles_list_v1`, `role_assign_v1`, `role_revoke_v1`, `org_manager_assign_v1`, `org_manager_revoke_v1`, `manager_self_assign_center_v1`, `account_access_send_v1`, `account_access_revoke_v1`, `account_access_accept_v1`, `account_link_remove_v1`, `platform_owner_set_v1`, `platform_owner_remove_v1`, `center_manager_assign_v1`, `center_manager_revoke_v1` |
| F05 | `roles_list_v1`, `role_assign_v1`, `role_revoke_v1`, `permission_set_v1` |
| F06 | `account_get_v1`, `account_profile_update_v1`, `account_password_change_v1`, `account_password_reset_request_v1`, `account_delete_preview_v1`, `account_delete_apply_v1`, `account_access_send_v1`, `account_access_accept_v1`, `person_get_v1`, `reservation_list_v1`, `entitlements_get_v1`, `finance_get_v1` |
| F07 | `people_list_v1`, `person_get_v1`, `person_create_v1`, `person_update_v1`, `student_activate_v1`, `student_deactivate_v1`, `person_merge_preview_v1`, `person_merge_approve_v1`, `person_merge_apply_v1`, `lead_convert_v1` |
| F08 | `calendar_get_v1`, `program_preview_v1`, `program_apply_v1`, `session_create_v1`, `session_get_v1`, `session_change_preview_v1`, `session_change_apply_v1`, `session_capacity_set_v1` |
| F09 | `session_create_v1`, `lesson_request_create_v1`, `lesson_request_withdraw_v1`, `lesson_request_reject_v1`, `lesson_request_offer_alternative_v1`, `lesson_request_accept_alternative_v1`, `lesson_request_approve_v1`, `request_expire_v1` |
| F10 | `class_save_v1`, `program_preview_v1`, `program_apply_v1`, `reservation_create_v1`, `reservation_list_v1`, `sale_preview_v1`, `sale_apply_v1`, `class_assignment_set_v1` |
| F11 | `class_save_v1`, `reservation_create_v1` |
| F12 | `waitlist_join_v1`, `waitlist_leave_v1`, `seat_offer_accept_v1`, `seat_offer_reject_v1`, `seat_offer_issue_v1`, `seat_offer_expire_v1` |
| F13 | `session_change_preview_v1`, `session_change_apply_v1`, `session_assignment_set_v1` |
| F14 | `session_change_preview_v1`, `session_change_apply_v1`, `session_cancel_preview_v1`, `session_cancel_apply_v1`, `replacement_session_create_v1`, `reservation_cancel_v1`, `attendance_get_v1`, `attendance_mark_v1`, `attendance_close_v1`, `attendance_correct_preview_v1`, `attendance_correct_apply_v1`, `class_assignment_set_v1`, `attendance_block_v1` |
| F15 | `reservation_create_v1`, `products_list_v1`, `product_publish_v1`, `sale_preview_v1`, `sale_apply_v1`, `entitlements_get_v1`, `entitlement_extend_v1`, `credit_adjust_v1`, `negative_limit_set_v1`, `sale_terminate_preview_v1`, `sale_terminate_apply_v1`, `sale_renew_preview_v1`, `sale_renew_apply_v1`, `negcredit_valuation_set_v1` |
| F16 | `products_list_v1`, `product_publish_v1`, `sale_preview_v1`, `sale_apply_v1`, `entitlements_get_v1`, `sale_renew_preview_v1`, `sale_renew_apply_v1` |
| F17 | `product_publish_v1`, `freeze_preview_v1`, `freeze_apply_v1`, `freeze_end_preview_v1`, `freeze_end_apply_v1`, `sale_terminate_preview_v1`, `sale_terminate_apply_v1`, `sale_change_preview_v1`, `sale_change_apply_v1` |
| F18 | `product_publish_v1` |
| F19 | `sale_preview_v1`, `sale_apply_v1`, `sale_refund_preview_v1`, `sale_refund_apply_v1`, `sale_change_preview_v1`, `sale_change_apply_v1`, `finance_get_v1`, `collection_record_v1`, `collection_correct_preview_v1`, `collection_correct_apply_v1`, `student_credit_refund_v1`, `student_credit_offset_v1`, `debt_adjust_v1` |
| F20 | `attendance_close_v1`, `attendance_correct_preview_v1`, `attendance_correct_apply_v1`, `instructor_agreement_publish_v1`, `earnings_list_v1`, `instructor_payment_record_v1`, `instructor_payment_correct_v1`, `event_duty_verify_v1`, `attendance_block_v1`, `negcredit_valuation_set_v1` |
| F21 | `leads_list_v1`, `lead_save_v1`, `crm_activity_save_v1`, `lead_convert_v1`, `public_application_review_v1` |
| F22 | `trial_offer_create_v1`, `trial_registration_confirm_v1` |
| F23 | `crm_activity_save_v1`, `crm_followup_list_v1` |
| F24 | `segment_save_v1`, `automation_save_v1`, `automation_run_v1` |
| F25 | `event_publish_v1`, `publication_set_v1`, `public_calendar_get_v1`, `public_application_submit_v1`, `public_application_review_v1` |
| F26 | `notifications_list_v1`, `notification_mark_read_v1`, `notification_preferences_set_v1`, `outbox_deliver_v1` |
| F27 | `notification_preferences_set_v1`, `outbox_deliver_v1`, `reminder_schedule_v1` |
| F28 | `report_get_v1`, `report_export_start_v1`, `report_file_get_v1`, `job_status_get_v1`, `report_build_v1` |
| F29 | `event_save_v1`, `event_publish_v1`, `event_register_v1`, `event_registration_cancel_v1`, `event_complete_v1`, `event_duty_verify_v1`, `event_cancel_preview_v1`, `event_cancel_apply_v1`, `event_list_v1`, `event_attendance_mark_v1`, `event_attendance_close_v1`, `event_attendance_correct_v1` |
| F30 | `document_upload_prepare_v1`, `document_version_publish_v1`, `document_requirements_get_v1`, `document_accept_v1`, `file_upload_complete_v1` |
| F31 | `import_upload_prepare_v1`, `import_preview_v1`, `import_apply_v1`, `import_rows_list_v1`, `job_status_get_v1`, `import_rows_process_v1`, `file_upload_complete_v1` |
| F32 | `organization_create_v1`, `organization_close_preview_v1`, `organization_close_apply_v1`, `organization_reopen_v1`, `student_activate_v1`, `student_deactivate_v1`, `subscription_get_v1`, `subscription_upgrade_quote_v1`, `subscription_downgrade_request_v1`, `subscription_change_cancel_v1`, `subscription_renewal_set_v1`, `saas_payment_submit_v1`, `saas_payment_verify_v1`, `saas_grace_extend_v1`, `subscription_boundary_apply_v1` |
| F33 | `organization_delete_preview_v1`, `organization_delete_apply_v1`, `credit_adjust_v1`, `collection_correct_preview_v1`, `collection_correct_apply_v1`, `instructor_payment_correct_v1`, `operation_status_get_v1`, `preview_get_v1`, `audit_list_v1`, `privacy_execute_v1` |

## Uygulanacak kabul/başarısızlık senaryoları

| ID | Alan | Düzen/yarış | Beklenen |
|---|---|---|---|
| A01 | tenant | İki org aynı e-posta | Her sorgu/RPC/URL/file ve worker path’inde diğer org verisi açılmaz. |
| A02 | scope | Owner yönetici atanmadığı merkezde tahsilat | FORBIDDEN; organization read yetkisi mutation değildir. |
| A03 | scope | Rol kaldırılırken açık JWT ile yazma | Erişim kapısı güncel kontrol; commit sonrası eski role yeni başarılı yazma yok. |
| A04 | capacity | Son nominal yere 2 esnek istek | Tek commit, diğeri CAPACITY_FULL; çift credit reserve yok. |
| A05 | capacity | Nominal10/max12 toplam11 | Esnek/offer ret; priority bir kabul; toplam12’den sonrası ret. |
| A06 | capacity | Kapasite mevcut yer altına düşürüldü | Eski kayıt korunur; yeni istekte güncel sınır uygulanır. |
| A07 | resource | Aynı eğitmen farklı merkezlerde aynı saat | Tenant kişinin ortak kaynak çakışması ret; merkez seçimiyle aşılmaz. |
| A08 | wait | Offer accept ile expiry aynı anda | Tek terminal; offer yeri rezervasyon olurken ikinci kez sayılmaz. |
| A09 | wait | Teklif verilirken hak yok | Yer ayrılabilir, hak ayrılmaz; acceptte uygunluk hatası süresini uzatmaz. |
| A10 | credit | Son krediye farklı seanslardan istek | Kredi bir kez ayrılır; açık limiti izinliyse yalnız o kapsamda deficit. |
| A11 | credit | Kişisel negatif limit ve org upper | Kişisel varsayılanın yerine geçer; ayrılmış+tüketilmiş org kişi açığı upper aşmaz. |
| A12 | credit | Geçmiş2 açık + yeni8 paket | Geçmiş tüketilmiş açık önce kapanır;6 kalır; yeni paket start geçmişi kapsamazsa özel istisna; ek para borcu yok. |
| A13 | attendance | Taslak attended kaydı | Kredi reserved; hakediş yok; zaman geçmesi auto-close yapmaz. |
| A14 | attendance | Bir unmarked kalan kapanış | INCOMPLETE, hiçbir kısmi tüketim/hakediş/closed yok. |
| A15 | attendance | Asistan kendi katıldığı seansa atanır veya tersi | İki yönde ret; sınıf varsayılanı bypass etmez. |
| A16 | attendance | Kapalı yoklama düzeltmesi | Yalnız CM reason; önceki kredi/earning bağlı fark, eski ödeme silinmez. |
| A17 | sale | Öncelikli satışın tek seansı dolu | Tüm satış/hak/borç/rezervasyon rollback; sessiz eksik paket yok. |
| A18 | sale | Katalog fiyatı yeni sürüm | Eski satış/rezervasyon iptal koşulu değişmez; yeni satış yeni sürüm. |
| A19 | freeze | 20 günlük freeze8 gün sonra bitti | Fiilî8 yerel gün uzatma; iptal kayıtlar otomatik geri açılmaz. Geçmiş00:00 sınırı erken bitiş diye yazılamaz. |
| A20 | refund | 4.000 satış/3.000 tahsil/8 kredi/2 tüketim | Kredi oranı3.000;1.000 kalan borç indir,2.000 alacak; nakit ayrı. |
| A21 | finance | Son alacağa refund ve offset race | Toplam kullanılabilir aşılmaz; offset cash collection yaratmaz. |
| A22 | finance | Aynı tutar farklı key iki gerçek ödeme | Sırf öğrenci/tutar eşit diye ret yok; mevcut borç dışı fazla alacak. |
| A23 | idempotency | Başarılı tahsilat yanıtı kayıp | Aynı key aynı sonuç, ikinci cash yok; farklı payload mismatch. |
| A24 | idempotency | Sonuç30 gün sonra aynı key | Yeni iş yok; yetkili business ref veya result_expired. |
| A25 | version | İki kullanıcı aynı session version | İlk commit, ikinci VERSION_CONFLICT; stale automatic replay yok. |
| A26 | preview | Dondurma önizlemesi sonrası ilgili reservation değişti | PREVIEW_STALE, yeni preview/onay gerekli. |
| A27 | merge | Merkez B onaysız birleştirme | Hiçbir ilişki/finans kimliği taşınmaz; K07 hesap çatışması otomatik çözülmez. |
| A28 | earning | Süreli ürün için açık agreement yok | POLICY_NOT_CONFIGURED; sıfır/per_person otomatik seçilmez. |
| A29 | earning | İşletme seansı gerçekleşmeden iptal | Hakediş yok; allocation release, validity sorunu görünür, auto extension yok. |
| A30 | event | Sadece asistan görevli harici etkinlik | İzinli; sorumlu merkez var, room zorunlu değil; fee açık0 veya amount. |
| A31 | event | Adayı etkinlikte limitten kaçırma | Aktif öğrenci ve org limit kontrolü, deneme istisnası uygulanmaz. |
| A32 | limit | Aynı kişi iki merkez aktif | Org tek sayım; açık talep/liste/event varken inactive engeli, borç tek başına değil. |
| A33 | billing | Gecikmenin ilk7 gününde öğrenci işlemi | Mevcut hakla öğrenci normal; ilk7gün yeni sale/program/seans kapalı. Talep mevcut seansa bağlanabilir, yeni özel seans gerektiriyorsa bekler. |
| A34 | billing | 7 gün sınırında race | Tek backend saat/erişim kararı; bütün roller kapalı, owner yalnız subscription; başka org etkilenmez. |
| A35 | billing | Business düşüşü merkez seçilmemiş | Talep tamamlanmaz; seçildiyse dönem sonunda diğer merkezler erişime kapalı, veri korunur. |
| A36 | billing | Yükseltme quote ödeme anında | Fiyat korunur; gecikmiş borç kapanmadan açılmaz; renewal date değişmez. |
| A37 | public | Hedef adrese çok başvuru ve hesap enumeration | Bot/rate + generic yanıt, öğrenci varlığı/rezervasyonuna erişim yok. |
| A38 | invite | Hesabı bağlanmamış kişiye personel erişim bağlantısı | Öğrenci self erişimiyle kabul; yönetim grant linkten önce ret. Owner CM değilse erişim gönderemez; başka org yönetim yetkisi taşınmaz. |
| A39 | document | Yeni belge sürümü yayımlandı | Eski kabul durur; ilgili gate yeni sürüm isterse işlem engeli, rezervasyon auto cancel yok. |
| A40 | import | Dosya tekrar veya çalışan job retry | Applied row ikinci kişi/grant/debt üretmez; K13 dosyalararası duplicate ayrıca çözülür. |
| A41 | export | İş başlatıldıktan sonra rol kaldırıldı | Worker/download güncel alan kapsamı kontrolü; eski signed URL tasarımı yetki iptaliyle sınanır. |
| A42 | notification | Provider sonucu belirsiz timeout | İş commit korunur; lease/dedupe; dış kanalda exactly-once iddiası yok. |
| A43 | privacy | Kalıcı silme sonrası eski backup restore | Bağımsız deletion receipt uygulanır; silinen veri/iş/bağlantı yeniden açılmaz; tüm kopya doğrulama. |
| A44 | performance | Pilot yük10org/500student/50concurrent | p95 list1s/calendar2s/write2s; bütünlük/failure oranı birlikte ölçülür; test henüz yok. |
| A45 | recovery | Canlı DB ve dosyalar kayıp | Bağımsız tutarlı restore, RPO24h/RTO8h tespit hedefi ölçülür; SLA diye raporlanmaz. |
| A46 | scope | Owner CM atanmadan account_access_send | FORBIDDEN; merkez oluşturup self-manager sonrası izin. Center-manager grant owner, owner grant yalnız platform. |
| A47 | scope | Student-only hesap bağlanmadan role_assign | ACCOUNT_LINK_REQUIRED; kayıt açma kişi/ilişkidir, giriş grantı değildir. |
| A48 | billing | İlk ödeme öncesi kuruluş ve operasyon | Platform owner atar, owner merkez/self-manager kurar; öğrenci/satış/ders SUBSCRIPTION_NOT_STARTED; trial/grace yok. İlk doğrulama anı dönem başlar. |
| A49 | credit | 15Şubat→15Mart üyelik tarihi | Satış merkezi00:00 UTC dönüşümü;15Mart00:00 başlayan ders kapsam dışı. Month default/takvim ayı zorunluluğu yok. |
| A50 | credit | 15Şubat üyelik haftada2 kota | 15–22Şubat iki reserve üçüncüret; son kısa dönemde2kota; hak serbest bırakan iptal yeniden kullanılabilir; deviryok. |
| A51 | attendance | Limit-2, üçüncü açığı gerektiren ders | Seans başlangıcında uygunsuz, blocked; kendi reserve açığı çift sayılmaz. Yüzde/kişi payı0; diğer öğrencilerle gerçekleşen seans sabiti korunur. |
| A52 | earning | Kaynak satış yok, negative value500TRY, instructor40% | Rezervasyonda500 snapshot; kapanışta200TRY. Sonraki8kredi satış/ödeme eski200’ü değiştirmez, ayrıca öğrenci para borcu yaratmaz. |
| A53 | earning | Limit aşılmış, seans sonrası ödeme | Başlangıç blocked snapshot değişmez, o öğrenci için geriye hakediş yok. Ödeme/hak düzeltmesi sonraki seansa etki eder. |
| A54 | event | Asistan yoklamayı işaretler sonra kapatır | Mark izinli, close yasak; CM tüm sonuçlar tamamlanınca close, paket etkisi atomik. Duty fee ayrı verify. |
| A55 | scope | Org manager org automation tanımlar, merkez manager ataması yok | Tanım izinli, merkez operation kendiliğinden çalışamaz; execution merkez yetki kapsamını ayrıca doğrular. |

## Kodlama / üretim öncesi açık kapılar

1. Kullanıcının hukuk uzmanı ile saklama matrisini ve veri sorumlusu/işleyen sözleşmesini teyit/düzenlemesi. Mevcut uzun varsayılanlar kesin kanuni maksimum değildir.
2. Ticari fiyat/limitler, trial tekrar sayısı ve gerekli kurulum politika değerleri; provider/kanal, hesap/secrets/ortam ve repository adresi seçimi. Bunlar sözleşme boşluğunu keyfî izinle doldurmaz; eksik zorunlu config varsa ilgili işlem açılmaz.
3. SQL/RLS/RPC/Edge uygulaması ve bu senaryoların gerçek testleri. Owner/CM sınırı, eski oturum, last-slot/last-credit, başlangıç eligibility ve late-payment özellikle doğrulanacak.
4. Pilot RPO24h/RTO8h hedefi için DB+dosya tutarlı bağımsız yedek, geri yükleme ve silme imha listesi; ücretli üretim hedefi ayrıca değerlendirme.
5.03 sözleşmesindeki somut merge/üretim onayı. Bu belge kodlama veya deployment emri değildir.

Ek iş kararı gerektiren yeni bir çelişki uygulamada bulunursa öneri→kabul→belge süreci izlenir. Tamamlanma statüsü, eksik gerçek testleri gizlemek için kullanılamaz.

## 15 Ekim 2026 — D01–D09 disiplin revizyonu (kabul edildi)

Belge paketi revizyonu: 2.1. Bu bölüm önceki çelişen disiplin, paket kapsamı ve negatif kredi hükümlerinin yerini alır. Önceki sürüm numaraları ve denetim sayıları tarihsel tabanı gösterir.

**D01.** Disiplin organizasyon düzeyinde tanımlanır; merkezler sundukları disiplinleri kullanıma açar. Aynı organizasyonun merkezleri aynı disiplin kimliğini kullanır.

**D02.** Eğitmen birden fazla merkez/disiplinde görev alabilir. Öğrenci birden fazla merkez/disipline kayıt olabilir; organizasyon kişi kaydı çoğaltılmaz. Öğrenci eğitmenin alt kaydı değildir; eğitmen değişimi öğrencinin kimliğini veya haklarını değiştirmez.

**D03.** Normal ders/seansın merkezi ve disiplini belirgindir. Merkezlerin program, fiyat ve eğitmen anlaşmaları ayrı kalır. Disiplin ilişkisi yeni uygulama rolü veya operasyon yetkisi vermez.

**D04.** Paket kullanım kapsamları: merkez+disiplin; merkezin bütün disiplinleri; organizasyonun bütün merkezlerinde belirli disiplin; organizasyonun bütün merkez ve disiplinleri. Organizasyon sınırı aşılamaz; mevcut SaaS plan/merkez erişim sınırları korunur.

**D05.** Ders/etkinlik uygunluğu kullanım kapsamından ayrı belirtilir. Organizasyon genelinde etkinlik paketi bütün normal derslerde kendiliğinden geçmez. Geniş kapsam kapalı sınıf, kapasite, tarih ve diğer uygunluk kurallarını aşmaz.

**D06.** Dar kapsamlı disiplin hakları başka disiplinde kullanılamaz; başka disipline ait paket, kapsam dışındaki kredi açığını kapatamaz. Birden fazla disiplinde geçerli 10 kredilik paket toplam 10 kredi sağlar; disiplin başına ayrı 10 kredi oluşmaz.

**D07.** Negatif kredi sınırı öğrenci için merkez–disiplin bazında uygulanır. Aynı kapsamdaki ayrılmış ve tüketilmiş açık birlikte sayılır; mevcut rezervasyon iki kez sayılmaz. Bir disiplindeki kredi açığı diğer disiplinin katılımını engellemez. Organizasyon geneli kişi açığı üzerinden tek katılım sınırı uygulayan eski hükümler bu kararla değiştirilmiştir.

**D08.** Geniş kapsamlı paket, uygun olduğu merkez/disiplinlerdeki açıkları mevcut kapatma sırasıyla karşılayabilir: önce geçmiş tüketilmiş açık, sonra gelecek rezervasyon açığı. Uygun hak seçiminde en erken bitiş, eşitlikte önce satın alma ve mevcut kararlı eşitlik çözümü korunur. Paket kapsamı uygunluk filtresidir.

**D09.** Seans başlangıcındaki limit kontrolü ve sonradan ödemenin geçmiş katılım/hakedişi değiştirmemesi korunur; kontrol artık ilgili merkez–disiplin kapsamındadır. Para borcu ile kredi açığı ayrı kavramlardır.

**Teknik aktarım durumu:** Ürün kararı kabul edildi; kaynak karar sohbetinde kurulum, fiziksel tablo/API dönüşümü veya kodlama yapılmamıştı. Kaynak v2.2 katalogları o tarihte bu revizyonu bütünüyle temsil etmiyordu; güncel aktarım 09 raporundadır. Disiplin kimlikleri/merkez ilişkileri, öğrenci-eğitmen disiplin ilişkileri, paket kapsam tipleri, kredi açığı anahtarı, işlem izinleri ve ortak tiplerin dönüşümü ayrı teknik sohbette tamamlanıp doğrulanacaktır. Önceki 31 kontrol ve 55 senaryo bu yeni revizyonun geçtiği testler değildir. Disiplin revizyonu için O4 teknik katalog kapanışı yeniden açıktır.

### Yeni kabul senaryoları — taslak, çalıştırılmadı

| ID | Senaryo | Beklenen |
|---|---|---|
| D-A01 | Aynı öğrenci Salsa ve Yoga kaydı | Tek organizasyon kişi kaydı, iki ilişki |
| D-A02 | Salsa paketini Yoga dersinde kullanma | Kapsam nedeniyle ret |
| D-A03 | Salsa açığını Yoga paketiyle kapatma | Açık kapanmaz |
| D-A04 | İki disiplinde geçerli 10 krediyle 6+4 katılım | Toplam 10; 11. kullanım yeni hak veya ilgili negatif sınır gerektirir |
| D-A05 | Organizasyon çapında Salsa paketi, A/B merkezleri | Plan/diğer koşullar uygunsa ikisinde Salsa; Yoga kapsam dışı |
| D-A06 | Etkinlik paketiyle normal derse başvuru | Etkinlik uygunluğu normal dersi açmaz |
| D-A07 | A/Salsa limiti aşılmış, A/Yoga uygun | Salsa engelli; Yoga bu açık nedeniyle engellenmez |
| D-A08 | Geniş paketle uygun geçmiş/gelecek açık kapatma | Mevcut sıra korunur; kaynak havuz çoğalmaz |
| D-A09 | Aynı ortak son krediye iki disiplin eşzamanlı istek | Kredi bir kez ayrılır; açık için ilgili kapsam limiti uygulanır |
| D-A10 | Kapalı sınıf veya dolu seans, organizasyon paketi | Geniş kapsam diğer engelleri aşmaz |
| D-A11 | Eğitmen değişimi ve çoklu disiplin ataması | Öğrenci kimliği/hakları korunur, rol otomatik verilmez |
| D-A12 | Limit aşımı sonrası geç ödeme | Geçmiş engel/hakediş değişmez |

Önceki A11 org-geneli limit ifadesi yerine ilgili merkez–disiplin toplamı doğrulanacaktır. Eski senaryolar bu değişiklikle yeniden gözden geçirilmelidir.

## 15 Ekim 2026 — U01–U08 UUIDv7 standardı (kabul edildi)

Paket revizyonu: 2.2. D01–D09 disiplin kararları korunur. Bu bölüm önceki çelişen UUID üretim önerilerinin yerini alır.

**U01.** FtkSaaS tarafından üretilen bütün UUID değerleri için UUIDv7 zorunlu standarttır. Domain kayıtları, işlem/idempotency anahtarları, request/trace kimlikleri ve geçici teknik UUID değerleri bu kapsamdadır. UUIDv1/v4/v5 üretimi için önceki öneriler yürürlükte değildir; istisna yeni açık karar gerektirir.

**U02.** Domain kayıt kimlikleri varsayılan olarak backend tarafından üretilir. UUID üretmesi gereken istemci, test verisi, seed, worker, Edge veya diğer FtkSaaS bileşeni de UUIDv7 kullanır. Bu karar istemciye yeni kayıt oluşturma veya operasyon yetkisi vermez.

**U03.** Supabase Auth ve diğer dış sağlayıcıların ürettiği kimlikler aynen korunur; yeniden UUIDv7 yapılmaz. Üretim standardı ile dış kimlik kabulü ayrıdır. Mevcut UUID değerleri sırf sürümü farklı diye yeniden yazılmaz; FK ve dış referanslar bozulmaz.

**U04.** Aynı kişinin farklı organizasyonlardaki kişi kayıtları bağımsız UUIDv7 alır. E-posta/telefon/isimden deterministik kimlik türetilmez; disiplin kayıtları için de aynı üretim standardı geçerlidir.

**U05.** UUIDv7 RFC 9562 uyumlu, güvenli rastgelelik kullanan doğrulanmış üreticiyle üretilir; timestamp eklenmiş özel UUID algoritması yazılmaz. Seçilen Supabase/PostgreSQL ortamındaki yerleşik üretim desteği teknik kurulumda doğrulanır; yoksa denetlenmiş uyumlu üretici seçilir, v4 fallback yapılmaz. Üretici yoksa ilgili üretim açılmaz.

**U06.** UUIDv7 yaklaşık üretim zamanını açığa çıkarabilir. created_at, seans zamanı ve audit zamanı ayrı alanlardır; UUID kesin küresel işlem sırası, iş tarihi veya yetki kanıtı sayılmaz. Sıralama ve eşzamanlılık kuralları açık iş alanlarına dayanır.

**U07.** Davet, hesap erişimi ve benzeri bearer token değerleri UUID kimliği değildir; güvenli rastgele token standardı korunur. Tokenlar UUIDv7 ile değiştirilmez. operation_key UUIDv7 olsa da retry aynı anahtarı yeniden kullanır; her denemede yeni UUID üretmek idempotency kuralını bozar.

**U08.** PostgreSQL alan tipi uuid olarak kalır. UUIDv7 üretim standardı bütün dış UUID girişlerini v7 diye reddetmek anlamına gelmez. FtkSaaS üretimi olan alanlarla sağlayıcı kimliği alanlarının şema/DTO eşlemesi teknik sohbette tamamlanır; yetki ve tenant kontrolü UUID sürümünden bağımsız uygulanır.

**Durum:** Belge ve makine sözleşmesine üretim politikası işlendi. Ortam/üretici seçimi, alan bazlı ortak tip aktarımı, migration ve gerçek üretim/yarış testleri ayrı teknik sohbette yapılacaktır. Kodlama, kurulum veya dağıtım yapılmadı.
