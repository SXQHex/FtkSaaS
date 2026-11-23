# Frontend geliştirme sırası ve kontrol noktaları

**Tek sıra sahibi:** Bu dosya _neye önce başlanacağını ve hangi noktada durulacağını_ belirler. İşlerin ve testlerin tam ölçütleri [remaining-work.md](remaining-work.md), güncel repo/PR/CI/ortam kanıtı [handover.md](handover.md) sahibindedir. Teknik gerekçe [development.md](development.md#router--query-birleşik-veri-yaşam-döngüsü) altındadır. Burada ayrı backlog ya da tarihsel kabul defteri oluşturulmaz.

Cache doğruluğu ve oturum kapsamı [kabul edildi](remaining-work.md#final-cache-audit). Güncel kaynak ve ortam kanıtı [devir kaydında](handover.md#kaynak-ve-kontrol-noktası).

## Aktif sıra

| Öncelik | Teslim dilimi                                             | Kontrol noktası                                                                                                                                                                                  |
| ------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1       | [M09](remaining-work.md#router-query-birlesik)            | Önce mevcut native sonuçların tüketimi. Kalan seçiciler ve projeksiyonlar [XREQ-073 değerlendirmesindeki](../../../docs/requests.md#xreq-073-backend-degerlendirmesi) bağımlılık sırasına bağlı. |
| 2       | [M13 ve C-ortak](remaining-work.md#router-query-birlesik) | Sunum ve kaynak kimliği, ardından aynı fixture ile okuma maliyeti karşılaştırması ve canlı ölçüm.                                                                                                |
| 3       | [M14 ve D01–D05](remaining-work.md#router-query-birlesik) | Kalan değişikliklerin birleşik regresyonu, dört tarayıcı ve gerekli gerçek ortam kabulü.                                                                                                         |

Her teslim ayrı branch ve Draft PR ile başlar. Kod, test ve kabul aynı kaynak SHA'sına bağlıdır. Merge ve production değişikliği açık yetkiye bağlıdır.

<a id="tip-guvenligi-sirasi"></a>

## Bağımsız tip güvenliği sırası

**Karar:** Hazır kütüphanelere/üretici dosyalarına müdahale yok. Kaynak denetimi `main` `1ecad263a392a8112665cb6dd1d3b57e670c27fe`; bulgu ve kapanış ölçütleri yalnız [TS01–TS06](remaining-work.md#frontend-tip-guvenligi) altında. Mevcut M alanları otomatik kapanmaz.

| Sıra | Görev                                       | Başlama/ayrılma sınırı                                                                  |
| ---- | ------------------------------------------- | --------------------------------------------------------------------------------------- |
| 1    | **TS01 · API yanıt sınırı**                 | Önce yüksek etkili native DTO/hata doğruluğu; mevcut korumayı yeniden kurma.            |
| 2    | **TS02 · Vite ortam tipleri**               | Merkezi `VITE_*` tip ve config kontrolü; üçüncü taraf türleri değişmez.                 |
| 3    | **TS03 · Rapor/public veri akışı**          | TS02 üzerine finans dosyası ve public bağlantı regresyonları.                           |
| 4    | **TS04 · E2E native istek sınırı**          | Playwright `any` çıkışını kendi fixture'ında doğrula; assertion'lara dokunma.           |
| 5    | **TS05 · Dinamik tip kaybı**                | `Reflect`, `Object.entries`, `JSON.parse`, Promise hata yollarını kaynak başına daralt. |
| 6    | **TS06 · Betikler ve tip güvenliği kapısı** | Önce temizlenmiş `src` kapsamını koru; script/E2E uyarılarını ayrı partilerde ele al.   |

**Teslim sınırı:** Öncelik 1–3 aynı veri güven sınırına bağlıysa bir mantıksal PR'da değerlendirilebilir; 4 ve 5 bağımsızdır. 6 ancak önceki kapsamın temizliği kanıtlanınca gelir. Büyük tek PR, dış kütüphane güncellemesi, generator düzeltmesi veya toplu CI gevşetmesi yapılmaz.

## Paralel, bağımsız teslim açıkları

[MONO-01 ve MONO-02](remaining-work.md#bağımsız-eski-teslim-kontrolleri-açık) Router/Query iyileştirmesi nedeniyle otomatik kapanmaz. Eski yayımlı adayın gerçek kaynak/ortam uzlaştırması ve kişisel ICS derin bağlantısının kullanıcı rolüne göre doğrulanması ayrı kabul ister.

## Son kontrol

- Açık işin kanıtı `remaining-work.md` içinde; sıra yalnız bu dosyada; tam SHA/run/ortam `handover.md` içinde.
- Yanlış yetki, stale cursor veya bilinmeyen write sonucu kalırsa ilgili iş **açık** kalır. Assertion, CI policy, timeout veya güvenlik kapısı gevşetilmez.
- Gerekli durumlarda backend API eksikliği somut tüketici talebine dönüştürülür; frontend bu gerekçeyle backend yazma yetkisi edinmez.
