# Main koruması denetimi — 17 Ekim 2026

Repository: SXQHex/FtkSaaS. Başlangıç main c231ab5526854ed62445613467649e1b0bf960bb.

| Kontrol | Gerçek sonuç |
|---|---|
| GET branches/main/protection | 403 Resource not accessible by integration |
| GET rulesets | Başarılı, boş liste [] |
| Klasik branch protection | Bu bağlantıyla doğrulanamadı; boş ruleset listesi klasik korumanın yokluğunu kanıtlamaz |
| Yönetim yazması | Yapılmadı; yeni yönetim yetkisi varsayılmadı |

Koruma uygulanmış veya mevcut koruma yeterli diye raporlanamaz. Yetkili repository yöneticisinin main için doğrulaması/uygulaması gereken ayarlar:

1. Require pull request before merging; doğrudan push, force push ve deletion kapalı.
2. Son değişikliği kapsayan onaylı inceleme zorunlu; eski onayları dismiss et, unresolved conversation varken merge engelle. Bağımsız ajan inceleme kanıtı ile GitHub review onayı ayrı türlerdir.
3. Required status checks: `ftksaas/merge-clean` (beklenen kaynak GitHub Actions); Manuel targeted tanısı required check değildir. Güncel base ile merge/sıkı güncellik kontrolü açık. Bu PR'nin check isimleri ilk CI sonrasında Actions'tan doğrulanır.
4. Yetkisiz bypass yok; admin/bypass politikası yetkili yönetici tarafından açıkça belirlenip belgelenmeli.
5. Runtime/CI merge’lerinde aynı yeni main SHA’sının full clean’i başarılı olmadan kabul kapanmaz. Güvenli yalnız-belge kabulü CI-02’de ayrı uygulanacak; mevcut kapının bunu desteklediği varsayılmaz.
6. Production dağıtım yetkisi merge'den türemez. Mevcut vercel.json main otomatik deployment kapısını false tutar.

Bu dosya ayarların uygulanmış olduğuna dair kanıt değildir. Yönetici ayar kaydı/erişilebilir API sonucu ayrı teslim edilmelidir. Bu denetim repository yönetim yetkisi vermez. Son kullanıcı talimatı PR #13 main merge işlemini yetkilendirmiştir; main koruması ayrı yönetici işi olarak açık kalır.

## 19 Ekim CI politikası güncellemesi

Protection okuması yeniden 403; rulesets boş. Yeni status ve strict-base ayarları bu bağlantıyla kurulmadı/doğrulanmadı. [CI politikası](../../../docs/ci-policy.md) ilk workflow kurulumu, güvenilir verifier ve merge-tree ilişkisinin sınırlarını açıklar. Eski otomatik her PR full-clean talimatı son kullanıcı politikasıyla değişmiştir. Sıradan geliştirmede skip-ci merge kapısı değildir; runtime/CI için gerçek kaynak bağlı aday clean gerekir. [20 Ekim kararı](../../../docs/decisions/CI-2026-10-20.md) güvenli belge-only kabulünü ayrıca tanımlar; CI-02 kaynak bağlı belge otomasyonu PR25/26 ile sonradan kurulmuştur; yönetici branch-protection ayarı bu kanıt değildir.


## 28 Ekim 2026 — CI-ADMIN uygulaması

Kullanıcının CI-ADMIN uygulama talimatıyla [main-acceptance ruleset26040398](https://github.com/SXQHex/FtkSaaS/rules/26040398) tarayıcı yönetim oturumunda oluşturuldu. API readback: active; hedef ~DEFAULT_BRANCH (main); bypass_actors=[] ve current_user_can_bypass=never. Klasik protection API403 sınırı sürer; ruleset GET başarılıdır.

- PR zorunlu; required_approving_review_count=0, stale approvals dismiss=true ve conversation resolution=true. Tek yetkili çalışma düzeninde başka GitHub hesabından onay zorunlu değildir; bağımsız ajan incelemesi teslim sürecinde korunur.
- Yalnız normal merge; squash/rebase kapalı. Main silme ve force push engelli.
- Required status ftksaas/merge-clean; kaynak GitHub Actions integration_id15368. strict_required_status_checks_policy=true; creation istisnası kapalı.
- Koşullu frontend/backend job adları ayrıca required yapılmadı. Frontend kabulü frontend sahibinin sonraki PR'sinde kendi kontrolleriyle tamamlanmalıdır; backend scope istisnası frontend test kabulü değildir.

PR65 ekranında ftksaas/merge-clean Required ve merge düğmesi disabled; ilk kurulumda1 approving review zorunluluğu görüldü; kullanıcı düzeltmesiyle bu zorunluluk kaldırıldı. PR65'te ayrıca kaynak çakışması vardır; bu gözlem, başarısız/stale kanıt engelinin diğer engellerden izole edilmiş uçtan uca denemesi olarak sunulmaz. Main'e doğrudan/force push, dal silme veya geçersiz PR merge yazması denenmedi. Ayarların uygulanması ve readback doğrulandı; izole negatif kabul örnekleri ayrıca açıktır.

Ruleset kurulurken main8d5d3025f1be5d3318e042bfb9167b4bfdca859c değişmedi. Kaynak workflow'ları, testler, kişilerin/app'lerin erişimi, secret ve production dağıtımı değiştirilmedi. Bypass aktörü eklenmedi. Gelecekte trusted CI politika kurulumlarının da bu zorunlu gate altında kontrollü bir kurulum yolu gerektireceği unutulmamalıdır; sohbet onayı tek başına sunucu korumasını aşmaz.

### Tek yetkili çalışma düzeni düzeltmesi

Kullanıcının açık onayıyla required_approving_review_count0 olarak kaydedildi. İlk kurulumdaki1 onay zorunluluğu tek yetkili repoda gereksiz merge kilidi oluşturduğu için geri alındı. Bu son karar, bu dosyadaki önceki zorunlu GitHub review önerisini değiştirir. Bağımsız ajan incelemesi korunur; ayrı GitHub reviewer hesabı gerekmez. API readback approvals0; diğer rule parametreleri önce/sonra birebir aynı, enforcement active ve bypass_actors[] kaldı. PR/CI/strict-base, conversation resolution, normal merge, force-push ve silme korumaları korunur. Güncel ayar canlıdır; belge PR70 henüz main'e alınmadı.

## CI-ADMIN izole negatif kabulü — 28 Ekim 2026

Main63f2471d0b57e45edd5ac6c4422bfa141b63dfe2 üzerinde yalnız disposable README değişiklikleriyle iki gerçek non-Draft test PR'si oluşturuldu. Sahte status yazılmadı, ruleset değiştirilmedi, hiçbir test PR'si merge edilmedi.

| Senaryo | Gerçek kanıt | GitHub merge değerlendirmesi |
|---|---|---|
| Başarısız gerekli kontrol | [PR71](https://github.com/SXQHex/FtkSaaS/pull/71), head2db6b5119cda8ca55fec25b6e613bc545fabf8c8; [belge koşusu40693345160](https://github.com/SXQHex/FtkSaaS/actions/runs/40693345160) gerçek BROKEN_LOCAL_LINK README.md→ci-admin-probe-missing.md ile failure; ftksaas/merge-clean failure | draft=false, mergeable=true (çakışmasız), mergeable_state=blocked |
| Başarılı kontrol + eski branch | [PR72](https://github.com/SXQHex/FtkSaaS/pull/72), head6111842df30353a8a46f8872961155c3ba9057f7; [belge40693353896](https://github.com/SXQHex/FtkSaaS/actions/runs/40693353896) ve targeted40693347701 success; ftksaas/merge-clean success, source-bound documentation acceptance | draft=false, mergeable=true, mergeable_state=behind; compare main...head ahead1/behind3. Başarısız kontrol değil strict-base engeli |

Ruleset aktif, required review0 ve bypass boşken gözlemlendi. GitHub sunucusunun hesapladığı PR/merge durumu salt okunarak doğrulandı; reddedileceği varsayılan bir merge/push/delete yazması gönderilmedi. Bu kabul o tehlikeli yazmaların denenmiş olduğu iddiası değildir. Her iki PR closed/merged=false olarak temizlendi; main önce/sonra63f2471d0b57e45edd5ac6c4422bfa141b63dfe2 kaldı. CI-ADMIN yönetim kurulumu ve bu iki kabul ölçütü tamamlandı; frontend karşılıklı tetikleme kabulü CI-SPLIT kapsamında ayrı açık kalır.
