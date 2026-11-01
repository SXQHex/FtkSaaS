# Backend geliştirme sırası ve koordinasyon

Bu dosya yalnız **sıra, bağımlı teslim paketleri ve kontrol noktalarının** sahibidir. Görev içeriği/kabul/dosya alanı [remaining-work.md](remaining-work.md), gerçek kaynak/test/hosted durum [00 devir](00-FtkSaaS-yeni-sohbet-devir.md) sahibindedir. Frontend’in aktif modülü ve sırası değiştirilmez. İkinci roadmap/todo açılmaz.

## Uygulama sırası

| Sıra | Görev paketi | Bağımlılık ve kontrol noktası |
|---|---|---|
| 0 | [A01](remaining-work.md#a01)–[A03](remaining-work.md#a03) | Karar aktarımı ve kaynak/kanıt uzlaştırması; sahipsiz özellik veya çelişen karar bırakma |
| 1 | [S01](remaining-work.md#s01)–[S02](remaining-work.md#s02) | Mevcut oda/sınıf/program okuma-düzenleme kapanışı |
| 2 | [S03](remaining-work.md#s03)–[S05](remaining-work.md#s05) | Abone No tahsis→ilk aktarım/merge→operasyon projeksiyonları |
| 3 | [S06](remaining-work.md#s06)–[S08](remaining-work.md#s08) | Davet/job ve native Auth; 1–2 ile bağımsız hazırlanabilir |
| 4 | [S09](remaining-work.md#s09)–[S10](remaining-work.md#s10) | Starter günlük akış ve ayar/izin tüketicileri |
| 5 | [S11](remaining-work.md#s11)–[S13](remaining-work.md#s13) | Rapor/import/belge gerçek işler ve indirme |
| 6 | [S14](remaining-work.md#s14)–[S16](remaining-work.md#s16) | Gerçek public/ICS tüketicisi ve SaaS dönem değişimi; hazır tüketici dilimi diğer frontend modüllerini beklemez |
| 7 | [P01](remaining-work.md#p01)–[P04](remaining-work.md#p04) | Ticari limit, çok kaynak, ileri paket/planlama ve hakediş |
| 8 | [P05](remaining-work.md#p05)–[P07](remaining-work.md#p07) | Tek ortak CRM alımı→inceleme/eşleme→web bağlantısı |
| 9 | [P08](remaining-work.md#p08)–[P11](remaining-work.md#p11) | Sağlayıcı başına gerçek kabul, kontrollü aktarım ve CRM tam akışı |
| 10 | [P12](remaining-work.md#p12)–[P13](remaining-work.md#p13) | Etkinlik kapasitesi ve kredi tüketmeyen uygunluk |
| 11 | [P14](remaining-work.md#p14)–[P16](remaining-work.md#p16) | E-posta teslim→zamanlama/sessiz saat→otomasyon |
| 12 | [B01](remaining-work.md#b01)–[B05](remaining-work.md#b05) | Business scope, ortak inbox, hesaplaşma, rapor ve özel teklif |

**Aktif kullanıcı önceliği:** [A03](remaining-work.md#a03) → [S01](remaining-work.md#s01) → [S02](remaining-work.md#s02) → [S03](remaining-work.md#s03) → [S04](remaining-work.md#s04) → [S05](remaining-work.md#s05). Frontend'in kendi ekran/kabul sırası değişmez; CI süre optimizasyonu ürün sırasının önüne geçmez.

### A03–S05 teslim paketi ve kontrol noktaları

Alt adımlar ve ölçülebilir dilim kabulü yalnız [backlog'daki ilgili görevlerde](remaining-work.md#a03) tutulur. Uygulama tek Draft PR içinde dilim dilim ilerler; her fonksiyon için ayrı PR açılmaz. Bu belge PR'si uygulama teslimi veya A03–S05 kapanışı değildir.

| Kontrol noktası | Sıra ve sonraki adım |
|---|---|
| A03 sonrası | Mevcut kanıt ile gerçek geliştirme boşluğu ayrılmış olmalı; S01'e geçilir. |
| S02 sonrası | S01→S02 oda/sınıf/program okuma-düzenleme kabulü incelenir; S03'e geçilir. |
| S04 sonrası | S03→S04 tahsis/ilk aktarım/birleşim ve yarış kabulü birlikte incelenir; S05'e geçilir. |
| S05 sonrası | Etkilenen sözleşme/üretilmiş çıktı/WF devri ve son kaynak incelemesi tamamlanır; yürürlükteki CI politikasına göre aday kabulüne geçilir. |

S03'ün teknik bağımlılığı A01 olsa da bu pakette kullanıcı sırası korunur. Her dilimde değişen davranışın uygun odak testi ve gerekli sözleşme/devri aynı dalda tamamlanır; sırf kontrol noktası için boş commit veya mükerrer clean üretilmez. S06 ve sonrası bu paketin kapsamına kendiliğinden eklenmez.

## Ortak işletim hattı

[A03](remaining-work.md#a03) sonrası [O01](remaining-work.md#o01)–[O03](remaining-work.md#o03) başlayabilir. Ardından [O04](remaining-work.md#o04)/[O05](remaining-work.md#o05) → [O06](remaining-work.md#o06) → [O07](remaining-work.md#o07) → [O08](remaining-work.md#o08) → [O09](remaining-work.md#o09). [O10](remaining-work.md#o10) gerekli alarm/restore kaynaklarıyla yürür. E-posta gerçek yük kabulü P14–P16’yı bekler. Ortak işletim bütün ürün işlerinin sonuna ertelenmez.

Aynı migration veya ortak sözleşmeye yazan işler seri yönetilir; bağımsız kaynak/kanıt işleri eşzamanlı hazırlanabilir. Her 2–3 ilişkili dilimde kaynak/olumsuz senaryo ve açık ortam bağımlılıkları gözden geçirilir. PR sınırı anlamlı modül teslimidir, her fonksiyon için ayrı PR açılmaz. Kesin bağımlılık her görevin kendi satırında tanımlıdır; bu sıra bağımlılık atlama yetkisi vermez.

## Plan bazlı kapanış

- [G01](remaining-work.md#g01): Starter; kendi uygulanabilir ortak işletim kapılarıyla kapanır, bütün Pro/Business’ın bitmesini beklemez.
- [G02](remaining-work.md#g02): Pro; ortak temel ve Pro işlevlerinin tamamı.
- [G03](remaining-work.md#g03): Business ve toplam backend; Pro’yu ve merkezler arası kapsamı içerir.

Kaynak hazır, test geçti, hosted kabul edildi ve production yayımlandı farklı sonuçlardır. Yayın/merge/full-clean devir kuralları [AGENTS](../../../AGENTS.md) ve [CI politikası](../../../docs/ci-policy.md) sahibindedir. Frontend gerçek ekran kabulü kendi sahibinde kalır; yalnız ilgili [talep](../../../docs/requests.md) üzerinden koordine edilir.
