# Frontend sohbet devri

Aktif bölüm, kaynak ve kabulün tek sahibi [frontend todo kaydıdır](todo.md#web-s08).

## Devam bağlamı

Kullanıcının6 Kasım son talimatı tarayıcı kontrollerini atlayıp açık bırakmak ve geliştirmeye odaklanmaktır. Önceki “S05/S06 canlı kabul bitene kadar durma” talimatının tarayıcı bölümü bu kararla ertelenmiştir. [S08 manuel finansın](todo.md#web-s08) kaynak geliştirmesi tamamlandı; kalan canlı kabul ve yeni override okuyucu bağımlılığı [S06](todo.md#web-s06), satış kabulü [S05](todo.md#web-s05) sahibindedir. Bu devir ikinci kabul listesi tutmaz.

PR223 main/development/Vercel teslimi ve bu oturumdaki ek native/bağlı Chrome kanıtları todo'ya işlendi. Geçici MFA faktörü kaldırıldı, geçici Pro CM rolü geri atandı; test oturumları kapatıldı. Tutarlı dummy kayıtlar/audit geçmişi korunur. Kullanıcı yeniden istemeden tarayıcı/canlı kabul denenmez. Yerel birim/statik/build kontrolleri kaynak teslimini doğrular; ertelenen gerçek kabul yerine sayılmaz.

PR230 main’e alındı; workflow doğrulayıcıları ve sabit paket bakımının taban CI/deployment kanıtı [S08 kaydındadır](todo.md#web-s08). Yeni `feature/web-s08-complete` dalı S08’in kalan kaynaklarını tek Draft modül PR’si olarak teslim eder; Chrome/canlı kabul ve XREQ-024 açık kalır. CI sonucu beklenmez, sonraki modül bu teslimde başlatılmaz.

S08 mevcut shadcn temasını, native Auth/typed Edge, hesap/tenant izolasyonu ve aynı payload/key kurtarmasını kullanır. Kaynaklar yalnız apps/web ve gerektiğinde packages/ui; backend/kontrat/CI/kalite politikası değiştirilmez. [XREQ-023](../../../docs/requests.md#xreq-023) ve [XREQ-024](../../../docs/requests.md#xreq-024) frontend talepleridir; backend adına çözüm/onay yazılmaz. Büyük modül PR tercihi, Draft PR ve önceki başarılı CI/inceleme sonrası merge yetkisi sürer. CI beklemeden geliştirme ve kalan işleri açık izleme kullanıcı tercihidir.

CRM karar aktarımının frontend görevi ve kabul sınırı [S04'e bağlı açık ek kapsamda](todo.md#crm-temel-aday-takibi) tutulur. Bu belge aktarımı önceki S04 kabulünü değiştirmez; yeni CRM diliminin runtime ve hosted kabulü yapılmış sayılmaz. Backend sözleşme bağımlılığı aynı kayıttadır; burada ikinci görev listesi tutulmaz.
