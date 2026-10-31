# Güncel kaynak ve kabul

31 Ekim 2026 kaynak kontrolü. Bu kayıt yalnız doğrulandığı kaynağı anlatır; sonraki çalışma başında canlı main ve aynı SHA’nın gerçek sonuçları yeniden okunur. Eski bir run yeni head’e taşınmaz. Açık iş [backlog](remaining-work.md), sıra [kuyruk](production-queue.md), ürün/iş akışı [kaynak indeksi](../../../docs/source-index.md) sahibindedir.

## Kaynak tabanı

Repo SXQHex/FtkSaaS; CI düzeltmesinin tabanı main `65d64aed54716a53cda14963b1438a3523451afa`, tree `eb207fffe4c762a977abc4e90afc25a655f3a55e`. PR94 main’e alınmıştır. Aynı main’in [kaynak kabulü](https://github.com/SXQHex/FtkSaaS/actions/runs/41043771480), [merge doğrulaması](https://github.com/SXQHex/FtkSaaS/actions/runs/41043771460) ve [development teslimi](https://github.com/SXQHex/FtkSaaS/actions/runs/41043811463) başarılıdır. Bu tabanın başarısı CI değişikliğinin kabulü değildir. Bu revizyonda hosted veri/ayar yeniden denetlenmedi.

## Kabul edilmiş kapsamın sınırı

- Backend P01–P07, Starter kapıları, hesap/native Auth ve settings tüketicileri kaynakta vardır; gerçek consumer sınırları ortak WF/settings rehberlerindedir. Native Auth SMTP/Google/TOTP geçmiş kabulü uygulama davet/marketing/SMS teslimi değildir.
- PR80 süre ölçümünü advisory yaptı; gerçek core/dört API testleri ve exact-source kabul kapıları korunur. Bu konu tekrar açık optimizasyon blokajı değildir.
- PR83 report worker bounded backlog/retry/kesinti/rebind ve export expiry diliminin kaynak/development kabulü kayıtlıdır. Beş lane genel iş yükü, fiziksel privacy purge, legal hold, tam restore ve RPO/RTO kabulü bundan çıkmaz.
- PR84 JSON restore guard, imzalı sicil ve guarded callback araçlarını ekler. Hosted SQL yükleyiciye entegrasyon veya tamamlanmış DB/Auth/Storage purge sağlamaz.
- PR89 öğrenci arama/detay/kişi yazma/öğrencilik/davet işi takibini içerir. Frontend CI sonucu gerçek yetkili hesapla hosted bütün ekran/yazma/teslim kabulünün yerine geçmez. Ekran davranışının sahibi [web geliştirme rehberi](../../web/docs/development.md).

## Öncelikli CI düzeltmesi ve kapanış incelemesi

Kullanıcının 31 Ekim kararı: PR99 merge girişimi bekler; önce aynı kaynakta failed-job rerun başarısının kabulü düzeltilir. Ayrı dal `fix/ci-same-source-reruns` doğrudan güncel main’den açılmıştır; PR99’un Auth değişiklikleri bu dalın kapsamında değildir. Runner kapanışının kök nedeni ayrıca açık tutulur; başarılı tekrar kapanış nedeninin çözümü sayılmaz.

Geçmiş taraması PR94’ün ilk koşusundan önceki 1.550 run kaydını kapsadı: 130 failure, 144 cancelled, 1.276 success; başarılıya dönmüş koşuların önceki denemeleri de incelendi. Hata/iptal içeren 350 job logundan 321’i okunabildi; 28 frontend/belge logu BlobNotFound döndü, bir backend targeted işi runner atanmadan iptal edilmişti (runner_id=0, adım yok, boş log). Erişilebilir eski loglarda `The runner has received a shutdown signal` eşleşmesi yoktu. Bulunan en eski aynı mesaj [PR94 ilk aday API-4](https://github.com/SXQHex/FtkSaaS/actions/runs/41001187314/job/123885755133) içinde **2026-10-30 04:12:08.736 UTC / 07:12:08 Türkiye** zamanındadır; merge 10:51:06 UTC’de olmuştur. Bu erişilebilir kayıtların sınırıdır; kayıp loglar nedeniyle mutlak ilk olay iddiası değildir. [GitHub Status tarihsel API](https://www.githubstatus.com/api/v2/incidents.json) bu saatle örtüşen genel Actions olayı göstermedi; tekil runner sağlığı bundan çıkarılamaz. `per_worker` ile zaman ilişkisi kök neden kanıtı değildir.

Rerun kabul kusuru somuttur: run41185531199 deneme7, kaynak çözümleme denemesi3 olan binding’i sırf attempt eşitsizliğinden reddetti. GitHub deneme7 görünümünde core/API2/API3’e yeni job ID ve run_attempt=7 verirken deneme3’teki runner ve yürütme zamanlarını korur. V2 düzeltmesi ilk olayın merge SHA/base/head değerlerini sabitler, güncel denemenin native job görünümündeki bütün zorunlu başarıları doğrular ve kabul denemesini kaynak çözümleme denemesinden ayırır. Güncel failure/cancel/skipped/missing/duplicate reddi, bütün core/dört API testleri ve mevcut güvenlik assertion’ları korunur. Core’un run kapsamındaki baseline artifact’ı devralınmış başarıyla korunur; CD bunu aynı merge SHA’ya doğrular. Ürün/Auth/runtime veya Edge worker politikası değişmez.

Yerel backend verify başarılı: 143 sözleşme/governance/restore testi ve 90 CI politika testi geçti; typecheck, kaynak/generator ve dokümantasyon kontrolleri de geçti. Yeni CI regresyonları V2 tekrar kabulünü, değişen kaynak/iş/adım reddini, okuma sırasında deneme değişimini ve V1/V2 main/CD tüketimini kapsar. Bağımsız kaynak incelemesinde yeni P1/P2 bulgu yok; incelemenin gördüğü WF00 fingerprint eskimesi güncellenip tam verify tekrar başarılı oldu. Uzak aday, main kurulumu ve CD henüz kabul edilmiş değildir. Actionlint, zizmor, poutine ve pinact bu çalışma ortamında bulunmadığından skill validator bu araçları çalıştıramadı; sıfır scanner bulgusu iddia edilmez. `gh`/gasa/shellcheck de bulunmuyor; GitHub geçmişi bağlı API üzerinden incelendi.

Kurulum sınırı: mevcut trusted gate politika blob/mode farkını koşulsuz reddeder. Gerçek test başarısı tek başına yeni gate kodunu main’e kuramaz. Mevcut required-check/strict-base/bypass ayarları değiştirilmemiştir; kaynak bağlı inceleme ve gerçek aday başarısından sonra açık bir yönetim/kurulum kararı gerekir. Sahte status veya koruma istisnası uygulanmış değildir.

## Alanlar arası koordinasyon

Backend sohbet devri bu dosyada; frontend sohbet devri [kendi uygulamasında](../../web/docs/handover.md) yürütülür. Somut talep, karşı tarafın değerlendirmesi/onayı ve teslim kabulü yalnız [ortak talep kaydında](../../../docs/requests.md) tutulur; kendi iş planı talep kimliğine bağlanır. Bu devir frontend planını veya ortak ürün sözleşmesini ilerleme kaydı olarak güncelleme yetkisi vermez.

## Yönetim kanıtı ve geçmiş

Son kayıtlı main ruleset `26040398`: active, strict-status, GitHub Actions required check ve bypass boş; PR71/72 başarısız/stale negatif kabulü kayıtlıdır. Bu revizyonda ayarlar yeniden okunmadı. Politikanın sahibi [CI politikası](../../../docs/ci-policy.md); kaynak kanıtı [sabit önceki yönetim kaydı](https://github.com/SXQHex/FtkSaaS/blob/fe650618503be24eb117297dc412c4ae6fd8018c/docs/ci-policy.md).

Önceki teslimlerin SHA/run/attempt ayrıntıları [sabit devir sürümünde](https://github.com/SXQHex/FtkSaaS/blob/fe650618503be24eb117297dc412c4ae6fd8018c/apps/backend/docs/00-FtkSaaS-yeni-sohbet-devir.md) korunur. Tarihsel belgeden bugünün iş listesi, izin veya kabulü türetilmez. Bu dosya kronoloji biriktirmez; sonraki doğal güncellemede mevcut snapshot değiştirilir.
