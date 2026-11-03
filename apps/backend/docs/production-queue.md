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

**S01–S02 kontrol noktası:** Ayrı teslimin backend kapanışı doğrulandı; [görev kabulü](remaining-work.md#s01) ve [kaynak/ortam kanıtı](00-FtkSaaS-yeni-sohbet-devir.md#s01s02-backend-kabulü) kendi sahiplerindedir. Frontend ekran sırası ve kabulü değişmez.

**Güncel öncelik:** S14–S16 backend kaynak paketi PR156 ile aday/main/development kabulünü geçti; [kaynak/ortam kanıtı](00-FtkSaaS-yeni-sohbet-devir.md#s14s16-kaynak-paketi) ve açık hosted/tüketici sınırları [backlog](remaining-work.md#s14) sahibindedir.

### Aktif kaynak paketi: P01–P04

1. [P01](remaining-work.md#p01) backend teslimi tamamlandı; [tam kaynak/ortam kanıtı](00-FtkSaaS-yeni-sohbet-devir.md#p01-ticari-limit-kaynak-paketi) sahibindedir. Frontend limit tüketimi XREQ-014 kendi kabulünü bekler.
2. [P02](remaining-work.md#p02) PR167 ile main'e alındı; development kabulü ve teslim kapanışı beklenir. Kaynak paketi için mükerrer PR açılmaz. Ayrı PR168'de [P03](remaining-work.md#p03) ileri rezervasyon/paket ve [P04](remaining-work.md#p04) anlaşma/hakediş kanıtları tamamlanır. Mevcut sağlam işlev yeniden yazılmaz; FIN-01 dar regresyonu genel P04 kabulü değildir.
3. PR159 backend kaynak teslimi doğrulandı; XREQ-013 özgün Business/native tüketici kabulü [ortak talepte](../../../docs/requests.md#xreq-013) kendi sahibinde açık kalır. S14/S15 gerçek widget/host/seans route'u ve diğer Starter hosted bağımlılıkları da kendi kimliklerinde açıktır; bunlar bağımsız kaynak paketini durdurmaz.

### Ayrı paralel kaynak paketi: P03/P04

4 Kasım kullanıcı talimatıyla `feature/pro-lifecycle-earnings-acceptance` branch'i P03/P04 için main'den ayrı hazırlanır. PR167 main'e alındıktan sonra PR168 güncel main ile senkronize edilir; P02 development kapanışı ayrı kalır. İç sıra: mevcut kaynak/kabul incelemesi → bağlı Pro/Business paket/teklif ve hakediş/ödeme kanıtı → kendi aday kabulü. P02 sonucu geldiğinde P02 teslim kapanışı ayrıca yapılır; bağımlı nihai P03/P04 kapanışı kanıtlarıyla uzlaştırılır. Görev ayrıntısı [P03](remaining-work.md#p03)/[P04](remaining-work.md#p04), kaynak/ortam [devir](00-FtkSaaS-yeni-sohbet-devir.md#p03p04-paralel-kaynak-paketi) sahibindedir.

## Ortak işletim hattı

[A03](remaining-work.md#a03) sonrası [O01](remaining-work.md#o01)–[O03](remaining-work.md#o03) başlayabilir. Ardından [O04](remaining-work.md#o04)/[O05](remaining-work.md#o05) → [O06](remaining-work.md#o06) → [O07](remaining-work.md#o07) → [O08](remaining-work.md#o08) → [O09](remaining-work.md#o09). [O10](remaining-work.md#o10) gerekli alarm/restore kaynaklarıyla yürür. E-posta gerçek yük kabulü P14–P16’yı bekler. Ortak işletim bütün ürün işlerinin sonuna ertelenmez.

Aynı migration veya ortak sözleşmeye yazan işler seri yönetilir; bağımsız kaynak/kanıt işleri eşzamanlı hazırlanabilir. Her 2–3 ilişkili dilimde kaynak/olumsuz senaryo ve açık ortam bağımlılıkları gözden geçirilir. PR sınırı anlamlı modül teslimidir, her fonksiyon için ayrı PR açılmaz. Kesin bağımlılık her görevin kendi satırında tanımlıdır; bu sıra bağımlılık atlama yetkisi vermez.

## Plan bazlı kapanış

- [G01](remaining-work.md#g01): Starter; kendi uygulanabilir ortak işletim kapılarıyla kapanır, bütün Pro/Business’ın bitmesini beklemez.
- [G02](remaining-work.md#g02): Pro; ortak temel ve Pro işlevlerinin tamamı.
- [G03](remaining-work.md#g03): Business ve toplam backend; Pro’yu ve merkezler arası kapsamı içerir.

Kaynak hazır, test geçti, hosted kabul edildi ve production yayımlandı farklı sonuçlardır. Yayın/merge/full-clean devir kuralları [AGENTS](../../../AGENTS.md) ve [CI politikası](../../../docs/ci-policy.md) sahibindedir. Frontend gerçek ekran kabulü kendi sahibinde kalır; yalnız ilgili [talep](../../../docs/requests.md) üzerinden koordine edilir.
