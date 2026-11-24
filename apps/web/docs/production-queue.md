# Frontend geliştirme sırası ve kontrol noktaları

**Tek sıra sahibi:** Bu dosya _neye önce başlanacağını ve hangi noktada durulacağını_ belirler. İşlerin ve testlerin tam ölçütleri [remaining-work.md](remaining-work.md), güncel repo/PR/CI/ortam kanıtı [handover.md](handover.md) sahibindedir. Teknik gerekçe [development.md](development.md#router--query-birleşik-veri-yaşam-döngüsü) altındadır. Burada ayrı backlog ya da tarihsel kabul defteri oluşturulmaz.

Cache doğruluğu ve oturum kapsamı [kabul edildi](remaining-work.md#final-cache-audit). Güncel kaynak ve ortam kanıtı [devir kaydında](handover.md#kaynak-ve-kontrol-noktası).

## Aktif sıra

| Öncelik | Teslim dilimi                                                        | Kontrol noktası                                                                                                                            |
| ------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 1       | [M09](remaining-work.md#router-query-birlesik)                       | [Native ve Worker bağımlılıkları](../../../docs/requests.md#m09-kalan-native-destek), ardından açık okuyucuların frontend ölçüm ve kabulü. |
| 2       | [D01–D05](remaining-work.md#d--regresyon-güvenlik-ve-yayın-kapanışı) | Birleşik regresyon, dört tarayıcı ve gerekli gerçek ortam kabulü.                                                                          |

Her teslim ayrı branch ve Draft PR ile başlar. Kod, test ve kabul aynı kaynak SHA'sına bağlıdır. Merge ve production değişikliği açık yetkiye bağlıdır.

<a id="tip-guvenligi-sirasi"></a>

## Bağımsız tip güvenliği sırası

[TS01–TS06 kapandı](remaining-work.md#frontend-tip-guvenligi).

## Paralel, bağımsız teslim açıkları

[MONO-01 ve MONO-02](remaining-work.md#bağımsız-eski-teslim-kontrolleri-açık) Router/Query iyileştirmesi nedeniyle otomatik kapanmaz. Eski yayımlı adayın gerçek kaynak/ortam uzlaştırması ve kişisel ICS derin bağlantısının kullanıcı rolüne göre doğrulanması ayrı kabul ister.

## Son kontrol

- Açık işin kanıtı `remaining-work.md` içinde; sıra yalnız bu dosyada; tam SHA/run/ortam `handover.md` içinde.
- Yanlış yetki, stale cursor veya bilinmeyen write sonucu kalırsa ilgili iş **açık** kalır. Assertion, CI policy, timeout veya güvenlik kapısı gevşetilmez.
- Gerekli durumlarda backend API eksikliği somut tüketici talebine dönüştürülür; frontend bu gerekçeyle backend yazma yetkisi edinmez.
