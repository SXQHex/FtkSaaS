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

**Güncel öncelik:** [S01.4](remaining-work.md#s01) ek okuma tesliminin backend kabulü doğrulandı; frontend gerçek kabulü [ortak talep](../../../docs/requests.md) sahibinde kalır. PR135 ile S03/S04 ve S05 kişi/rapor/export temeli teslim edildi. S01.5/XREQ-009 backend kabulü tamamlandı; XREQ-011 / S01.6 tek eğitmen yaşam döngüsü teslim edildi. PR145 ile XREQ-012 eski instructor verisi/kod temizliği ve S05 kalan Starter kişi okumaları aday/main/development kabulünü tamamladı. Güncel paket: S07 kanıt uzlaştırması ve S08/S09/S10 backend kabul boşlukları.

**Sonraki işler:** Üst-plan S05 DTO işleri Starter kapanışını bekletmez. S06/S07 teslim hattı yeniden kurulmaz; tamamlanan frontend dönüş kabulü ile açık olumsuz tüketici senaryoları ayrılır. Büyük PR sınırı native hesap/günlük akış/ayar etkisi kabul paketidir; mevcut çalışan davranış sırf kabul eksik diye yeniden tasarlanmaz. A03.2/A03.3 kanıt uzlaştırması doğrulanan dilimlerle sürdürülür.

### Backend coder için sıradaki paket

1. Güncel main, açık branch/PR ve aynı-source kanıtı doğrula; mevcut çalışmayı çoğaltma. S07/XREQ-004'ün tamamlanan dönüş kabulünü uzlaştır; açık yanlış hesap/expiry/revoke/link çakışmasını tamamlandı sayma.
2. S08'de native mevcut parola, eski oturum/nonce, recovery ve diğer oturumların iptali için mevcut kabul kapsamını incele; eksik backend kanıtını izole native Auth ile tamamla. Eski harness/Preview temizliğini mevcut kaynak/ortam kanıtından doğrula. Yeni Auth katmanı kurma; gerçek PKCE/ekran/posta kabulünün frontend veya yetkili ortam bağımlılığını koru.
3. S09'da mevcut güçlü testleri koruyarak program→paket→manuel tahsilat→self rezervasyon→yoklama→düzeltme zincirindeki eksik bağı tamamla; son yer/son hak yarışı, iptal/telafi ve replay etkilerini doğrula. Negatif kredi sınırını ürün varsayımı yapma; merkezde sıfır dahil tanımlanabilen değeri kullan, mevcut 2 değerli fixture'ı bu nedenle değiştirme.
4. S10'da mevcut typed ayar kataloğu ve tüketici testlerini eşleştir; yalnız kanıt boşluğunu kapat. Unsupported alanı etkin gösterme, yeni politika değeri uydurma. Bulunan gerçek runtime hatasını kaynağa bağlı düzelt; yeni kalite istisnası veya CI politikası değişikliği yapma.
5. Hedefli doğrulama ve bağımsız son kaynak incelemesi sonrasında etkilenen sözleşme/tip/katalog/WF-F izi ile backend backlog/devir/kuyruğunu aynı PR'de güncelle. Uygulama, yerel test, aday, main ve hosted kabulünü ayrı tut. Gerekli full clean başlarsa kaynak/run bilgileriyle turu bitir; polling yapma. Yeni kapsamın merge yetkisi ayrıca korunur.

## Ortak işletim hattı

[A03](remaining-work.md#a03) sonrası [O01](remaining-work.md#o01)–[O03](remaining-work.md#o03) başlayabilir. Ardından [O04](remaining-work.md#o04)/[O05](remaining-work.md#o05) → [O06](remaining-work.md#o06) → [O07](remaining-work.md#o07) → [O08](remaining-work.md#o08) → [O09](remaining-work.md#o09). [O10](remaining-work.md#o10) gerekli alarm/restore kaynaklarıyla yürür. E-posta gerçek yük kabulü P14–P16’yı bekler. Ortak işletim bütün ürün işlerinin sonuna ertelenmez.

Aynı migration veya ortak sözleşmeye yazan işler seri yönetilir; bağımsız kaynak/kanıt işleri eşzamanlı hazırlanabilir. Her 2–3 ilişkili dilimde kaynak/olumsuz senaryo ve açık ortam bağımlılıkları gözden geçirilir. PR sınırı anlamlı modül teslimidir, her fonksiyon için ayrı PR açılmaz. Kesin bağımlılık her görevin kendi satırında tanımlıdır; bu sıra bağımlılık atlama yetkisi vermez.

## Plan bazlı kapanış

- [G01](remaining-work.md#g01): Starter; kendi uygulanabilir ortak işletim kapılarıyla kapanır, bütün Pro/Business’ın bitmesini beklemez.
- [G02](remaining-work.md#g02): Pro; ortak temel ve Pro işlevlerinin tamamı.
- [G03](remaining-work.md#g03): Business ve toplam backend; Pro’yu ve merkezler arası kapsamı içerir.

Kaynak hazır, test geçti, hosted kabul edildi ve production yayımlandı farklı sonuçlardır. Yayın/merge/full-clean devir kuralları [AGENTS](../../../AGENTS.md) ve [CI politikası](../../../docs/ci-policy.md) sahibindedir. Frontend gerçek ekran kabulü kendi sahibinde kalır; yalnız ilgili [talep](../../../docs/requests.md) üzerinden koordine edilir.
