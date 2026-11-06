# Frontend sohbet devri

Aktif bölüm, kaynak ve kabulün tek sahibi [frontend todo kaydıdır](todo.md#web-s07).

## Devam bağlamı

Kullanıcının6 Kasım son talimatı tarayıcı kontrollerini atlayıp açık bırakmak ve geliştirmeye odaklanmaktır. Önceki “S05/S06 canlı kabul bitene kadar durma” talimatının tarayıcı bölümü bu kararla ertelenmiştir. [S08 manuel finansın](todo.md#web-s08) kaynak geliştirmesi tamamlandı; kalan canlı kabul ve yeni override okuyucu bağımlılığı [S06](todo.md#web-s06), satış kabulü [S05](todo.md#web-s05) sahibindedir. Bu devir ikinci kabul listesi tutmaz.

PR223 main/development/Vercel teslimi ve bu oturumdaki ek native/bağlı Chrome kanıtları todo'ya işlendi. Geçici MFA faktörü kaldırıldı, geçici Pro CM rolü geri atandı; test oturumları kapatıldı. Tutarlı dummy kayıtlar/audit geçmişi korunur. Kullanıcı yeniden istemeden tarayıcı/canlı kabul denenmez. Yerel birim/statik/build kontrolleri kaynak teslimini doğrular; ertelenen gerçek kabul yerine sayılmaz.

PR232 main’e alındı. Kullanıcı XREQ-023/024’ün bekletilip geliştirmeye devam edilmesini istedi; bu talepler üzerinde işlem yapılmadı. Kullanıcı PR kapsamını büyütüp S07 bitmeden durulmamasını istedi. `feature/web-s07-attendance` / PR233 içinde görev alanı, yoklama yaşam döngüsü ve katılımcıya bağlı hak/belge/hata kurtarması birlikte tamamlanır; yeni küçük PR açılmaz. Kaynak/otomatik kanıt ve açık Chrome/canlı kabulün tek sahibi [S07](todo.md#web-s07) kaydıdır. CI sonucu beklenmez; bu teslimde S09 başlatılmaz.

S07 mevcut shadcn temasını, native Auth/typed Edge, hesap/tenant izolasyonu ve aynı payload/key kurtarmasını kullanır. Kaynaklar yalnız apps/web ve gerektiğinde packages/ui; backend/kontrat/CI/kalite politikası değiştirilmez. [XREQ-023](../../../docs/requests.md#xreq-023) ve [XREQ-024](../../../docs/requests.md#xreq-024) frontend talepleridir; backend adına çözüm/onay yazılmaz. Büyük modül PR tercihi, Draft PR ve önceki başarılı CI/inceleme sonrası merge yetkisi sürer. CI beklemeden geliştirme ve kalan işleri açık izleme kullanıcı tercihidir.

CRM karar aktarımının frontend görevi ve kabul sınırı [S04'e bağlı açık ek kapsamda](todo.md#crm-temel-aday-takibi) tutulur. Bu belge aktarımı önceki S04 kabulünü değiştirmez; yeni CRM diliminin runtime ve hosted kabulü yapılmış sayılmaz. Backend sözleşme bağımlılığı aynı kayıttadır; burada ikinci görev listesi tutulmaz.
