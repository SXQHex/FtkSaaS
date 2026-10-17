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
3. Required status checks: contract-governance ve contracts-and-database (GitHub Actions). Güncel base ile merge/sıkı güncellik kontrolü açık. Bu PR'nin check isimleri ilk CI sonrasında Actions'tan doğrulanır.
4. Yetkisiz bypass yok; admin/bypass politikası yetkili yönetici tarafından açıkça belirlenip belgelenmeli.
5. Merge sonrası push/main Backend CI aynı yeni SHA için başarıyla tamamlanmadan kabul kapanmamalı.
6. Production dağıtım yetkisi merge'den türemez. Mevcut vercel.json main otomatik deployment kapısını false tutar.

Bu dosya ayarların uygulanmış olduğuna dair kanıt değildir. Yönetici ayar kaydı/erişilebilir API sonucu ayrı teslim edilmelidir. Yeni merge yetkisi verilmedi.
