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
3. Required status checks: `ftksaas/merge-clean` (beklenen kaynak GitHub Actions); Development targeted/targeted hızlı sonucu da zorunlu tutulabilir. Güncel base ile merge/sıkı güncellik kontrolü açık. Bu PR'nin check isimleri ilk CI sonrasında Actions'tan doğrulanır.
4. Yetkisiz bypass yok; admin/bypass politikası yetkili yönetici tarafından açıkça belirlenip belgelenmeli.
5. Runtime/CI merge’lerinde aynı yeni main SHA’sının full clean’i başarılı olmadan kabul kapanmaz. Güvenli yalnız-belge kabulü CI-02’de ayrı uygulanacak; mevcut kapının bunu desteklediği varsayılmaz.
6. Production dağıtım yetkisi merge'den türemez. Mevcut vercel.json main otomatik deployment kapısını false tutar.

Bu dosya ayarların uygulanmış olduğuna dair kanıt değildir. Yönetici ayar kaydı/erişilebilir API sonucu ayrı teslim edilmelidir. Bu denetim repository yönetim yetkisi vermez. Son kullanıcı talimatı PR #13 main merge işlemini yetkilendirmiştir; main koruması ayrı yönetici işi olarak açık kalır.

## 19 Ekim CI politikası güncellemesi

Protection okuması yeniden 403; rulesets boş. Yeni status ve strict-base ayarları bu bağlantıyla kurulmadı/doğrulanmadı. [CI politikası](ci-policy.md) ilk workflow kurulumu, güvenilir verifier ve merge-tree ilişkisinin sınırlarını açıklar. Eski otomatik her PR full-clean talimatı son kullanıcı politikasıyla değişmiştir. Sıradan geliştirmede skip-ci merge kapısı değildir; runtime/CI için gerçek kaynak bağlı aday clean gerekir. [20 Ekim kararı](decisions/CI-2026-10-20.md) güvenli belge-only kabulünü ayrıca tanımlar; CI-02 kaynak bağlı belge otomasyonu PR25/26 ile sonradan kurulmuştur; yönetici branch-protection ayarı bu kanıt değildir.

