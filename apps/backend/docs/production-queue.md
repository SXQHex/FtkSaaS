# Backend geliştirme sırası ve koordinasyon

Bu dosya yalnız **sıra, bağımlı teslim paketleri ve kontrol noktalarının** sahibidir. Görev içeriği/kabul/dosya alanı [remaining-work.md](remaining-work.md), gerçek kaynak/test/hosted durum [00 devir](00-FtkSaaS-yeni-sohbet-devir.md) sahibindedir. Frontend’in aktif modülü ve sırası değiştirilmez. İkinci roadmap/todo açılmaz.

**Aktif kaynak kabulü:** PR204 sonrası P10.1/P10.2 ve P11 backend kaynak/main/development teslimi doğrulandı; boyut onarımı kapanmıştır. Sıradaki bağımsız ürün paketi P14→P15→P16'dır; PR205 ortak Resend transport ve imzalı teslim kaynağı main/development kabulünü geçti. P14.2/P14.3 ve XREQ-020 backend kaynak/native/main/development teslimi PR210 ile doğrulandı. Aktif paket P14.4 gerçek webhook kurulumu/teslim ve S09 altındaki XREQ-021 self talep seçim kataloğudur; frontend kabulü kendi alanında kalır. P10.3 gerçek aktarım, Node yerleşimi ve Meta/Google live teslimi ayrı açık kalır. Main'deki deploy filtreleri ve aday test envanteri korunur. Kanıt ve ortam durumu devir sahibindedir.

## Uygulama sırası

**4 Kasım telefon kontrol noktası:** [S08 native telefon backend dilimi](remaining-work.md#s08), PR183 aday/main/development kabulüyle tamamlandı; [kanıt](00-FtkSaaS-yeni-sohbet-devir.md#native-telefon-test-numarası-dilimi). Kalan frontend consumer/ekran kabulü [XREQ-017](../../../docs/requests.md#xreq-017) ve PR184 sahibindedir. CRM PR182 ve CI PR185 ayrı yürütülür; bu kapanış onların kaynağını veya sırasını değiştirmez.

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

**S14–S16 kontrol noktası:** S14–S16 backend kaynak paketi PR156 ile aday/main/development kabulünü geçti; [kaynak/ortam kanıtı](00-FtkSaaS-yeni-sohbet-devir.md#s14s16-kaynak-paketi) ve açık hosted/tüketici sınırları [backlog](remaining-work.md#s14) sahibindedir.

### CRM paketinin kalan gerçek kabulleri

P01–P04, P12/P13, PR177 Starter CRM, PR182 P05/P06 + XREQ-016 ve PR188 P07 backend adaptörü teslimleri tamamlandı; [kaynak/ortam kanıtı](00-FtkSaaS-yeni-sohbet-devir.md) sahibindedir. P07'nin gerçek site bağlantısı ve form→inbox kabulü [XREQ-018](../../../docs/requests.md#xreq-018) altında açık; frontend deploy kısıtı bu kabulü bekletir, P05/P06'ya bağlı P08–P11 backend kaynağını durdurmaz.

P08–P11 backend kaynak paketi teslim edildi; gerçek sağlayıcı erişimi, site bağlantısı ve veri aktarımının açık sınırları [backlog](remaining-work.md#p08) sahibindedir. Kullanıcının Meta/Google canlı kurulumunu erteleme kararı korunur; bu işler bağımsız P14–P16 ürün geliştirmesini bekletmez. Yeni kaynakta küçük hedefli testler, bağımsız inceleme ve merge adayında yürürlükteki tam kabul korunur.

Dış e-posta ertelemesi de kaldırıldı; mevcut kurulum yeniden sıfırdan başlatılmaz. P14/P15 mevcut kaynak/sağlayıcı incelemesiyle kendi sırasında yürütülür; P16, P11/P15 bağımlılıklarını korur. Posta kurulumunun varlığı bütün bildirim olaylarının teslim kabulü değildir.

## CRM paketinin iç sırası

[CRM kararının](../../../docs/decisions/P08-accepted-scope.md) aktarımı mevcut P05–P11 paketine yapılır; ayrı karar sprinti açılmaz. P07 backend kaynak tesliminden sonra aktif kaynak paketi P08–P11'dir; P07 canlı site kabulü ayrı açık kalır. Görev ayrıntısı ve kabulün tek sahibi [P05](remaining-work.md#p05) ve devamındaki işlerdir.

1. Kısa mevcut karar/runtime uyumu; yalnız gerçek ürün boşluklarını ayırma.
2. PR177 ile teslim edilen Starter temel dilimini yeniden geliştirme; frontend ekran kabulü kendi alanında kalır.
3. Teslim edilmiş P05/P06 ortak kutu/inceleme/eşlemeyi koruyarak P07 web formu bağlantısını tamamla.
4. Son kullanıcı önceliğiyle P08 Instagram reklam anlık formları; P09 Google kaynak dilimi aynı PR'de korunur. Her sağlayıcının gerçek erişim/teslim kabulü ayrıdır.
5. P10 kontrollü eski kayıt aktarımı ve P11 ileri CRM, kendi bağımlılık ve yetkileriyle; Starter kapanışı bunları beklemez.

Reklam performans/harcama ve dönüşüm geri bildirimi sonraki ayrı dilimlerdir. Kaynak desteği ile gerçek sağlayıcı/ekran kabulü aynı kapanış değildir.

## Ortak işletim hattı

[A03](remaining-work.md#a03) sonrası [O01](remaining-work.md#o01)–[O03](remaining-work.md#o03) başlayabilir. Ardından [O04](remaining-work.md#o04)/[O05](remaining-work.md#o05) → [O06](remaining-work.md#o06) → [O07](remaining-work.md#o07) → [O08](remaining-work.md#o08) → [O09](remaining-work.md#o09). [O10](remaining-work.md#o10) gerekli alarm/restore kaynaklarıyla yürür. E-posta gerçek yük kabulü P14–P16’yı bekler. Ortak işletim bütün ürün işlerinin sonuna ertelenmez.

Aynı migration veya ortak sözleşmeye yazan işler seri yönetilir; bağımsız kaynak/kanıt işleri eşzamanlı hazırlanabilir. Her 2–3 ilişkili dilimde kaynak/olumsuz senaryo ve açık ortam bağımlılıkları gözden geçirilir. PR sınırı anlamlı modül teslimidir, her fonksiyon için ayrı PR açılmaz. Kesin bağımlılık her görevin kendi satırında tanımlıdır; bu sıra bağımlılık atlama yetkisi vermez.

## Plan bazlı kapanış

- [G01](remaining-work.md#g01): Starter; kendi uygulanabilir ortak işletim kapılarıyla kapanır, bütün Pro/Business’ın bitmesini beklemez.
- [G02](remaining-work.md#g02): Pro; ortak temel ve Pro işlevlerinin tamamı.
- [G03](remaining-work.md#g03): Business ve toplam backend; Pro’yu ve merkezler arası kapsamı içerir.

Kaynak hazır, test geçti, hosted kabul edildi ve production yayımlandı farklı sonuçlardır. Yayın/merge/full-clean devir kuralları [AGENTS](../../../AGENTS.md) ve [CI politikası](../../../docs/ci-policy.md) sahibindedir. Frontend gerçek ekran kabulü kendi sahibinde kalır; yalnız ilgili [talep](../../../docs/requests.md) üzerinden koordine edilir.
