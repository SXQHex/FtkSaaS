# PR50 dar native hesap/güvenlik kanıtı

26 Ekim teslim adayı; başlangıç main a7569bbb11353dc342804eb5050800d77a31a8e9.212 API/64 migration; ilk62 uygulanan migration değişmez. Aşağıdaki sonuçlar full clean veya hosted kabulü değildir.

- İlk native session suite5/5pass,103144.522567ms: own scope/etiket sürümü/receipt, geç history hatasında native session+refresh rollback, gerçek refresh iptali, taze mevcut proof ile others ve retry sonradan açılan session’ı koruma, current logout, kararlı sayfalama. Sandbox sbx_2tsns3dWx6qJMXHEW5UCTEaeDVUh. Sonraki MFA değişikliği enrolled olmayan bu hesapların session davranışını değiştirmez; ilk session sonucu son tüm birleşik suite çalıştı iddiası değildir.
- İlk birleşik settings testinde reset alt testi boş503 transport cevabı aldı; assertion/timeout başarı sayılmadı. İlk TOTP removal negatifinde native GoTrue eski aal1 bearer ile same-session verified factor kaldırmayı kabul etti; test korunup intent/fence düzeltildi.
- Son64 source ile gerçek Auth TOTP:4/4pass,0fail/skip/cancel,23229.165584ms. Enrollment/yanlış kod/doğru kod; JWT1+DB2 reddi; SQL lifecycle guard; zayıf ve doğrudan güçlü native kaldırma reddi; backend güçlü fresh proof kaldırma/retry; tek secret’siz disabled history.
- Aynı settings dosyasından ilk üç özgün case değişmeden geçici dar dosyaya çıkarıldı:4/4pass,0fail/skip/cancel,44889.337182ms. Global self/version/replay, concurrent/rollback ve privacy reset. Önceki503 bu dar tekrarda oluşmadı; geçici dosya repoya/CI’a eklenmedi.
- Bağımsız startup parent aynı özgün kaynaktan geçici dosyada2/2pass,0fail/skip/cancel,51936.938425ms. Canlı yetki/replay/reset/privacy kontrolleri ve300s/120s sınırları korunur.
- Son native Sandbox sbx_Vv4X9uneUpRtWtBjhexgXafniFCs; final MFA command cmd_118a69381ac349979ed3df5e0fc3, startup cmd_3f2e81c4cdf243fcad0cfbf1d0ea. Test-runner özetleri korundu; sağlayıcı command kaydı exitCode=null döndürdüğü için normal shell çıkış kodu ayrıca kanıtlanmış sayılmaz. Sandbox elle durduruldu; hosted veriye yazılmadı.
- Native advisors tek mevcut private.ops_run mutable search_path WARN; documented session/role pin istisnası korunur. Yeni error gözlenmedi. Yerel verify149test,64 migration izole derleme; bağımsız SQL intent expiry/ownership/weak proof/history rollback/commit+retry kontrolleri geçti.

Yeni testler mevcut person-registry suite’ine eklenir;15suite/dört shard ve full/main tüm kontroller korunur. Yeni altyapı/otomatik dağıtım sistemi yoktur. Global settings catalog46 alan/44 writable; beş güvenlik API’si genel patch alanı değildir. Hosted Auth TOTP config ve64 kaynağıyla restore henüz kabul edilmedi.

## Doğrulanan kritik kaynak SHA256’ları

- database/account-session-management.sql: `8387b101adf458e19657efdd7e2e47834f210b4ae102d256fcc8ab395735d978`
- supabase/migrations/20261025222434_account_session_management.sql: `c74b2127cb79a054b3f3222d2c93a0ccc652e3646de276e7a71f48bac9aef367`
- tests/account-mfa-acceptance.mjs: `dd5360082f2e71957a9c4524d42a07bfc8f87f4cc62814532101986b1def8fc8`
- tests/account-session-management-acceptance.mjs: `62ccb6daff74c2bce6a85b6f9b72ae2504247245f33502bc235255aa294f69e1`
- tests/frontend-settings-acceptance.mjs: `c369802c18050a49a4c5a4f5d27d18c6ce407da89c2923483c92cafcaf9bb428`
- supabase/functions/backend-v1/handler.ts: `503f5a74771ae16be21f9bc71190f5a6d04ac8042aba06ea8b60213e1b173378`
- supabase/functions/backend-v1/lifecycle-auth.ts: `36f1f87ac08d6b47f1113b42306b16349e22131f5894c3cdc02ee51e39bc68e9`
