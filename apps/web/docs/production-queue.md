# Frontend geliştirme sırası ve kontrol noktaları

**Tek sıra sahibi:** Bu dosya _neye önce başlanacağını ve hangi noktada durulacağını_ belirler. İşlerin ve testlerin tam ölçütleri [remaining-work.md](remaining-work.md), güncel repo/PR/CI/ortam kanıtı [handover.md](handover.md) sahibindedir. Teknik gerekçe [development.md](development.md#router--query-birleşik-veri-yaşam-döngüsü) altındadır. Burada ayrı backlog ya da tarihsel kabul defteri oluşturulmaz.

**Kaynak incelemesi:** 23 Kasım 2026 · M04'ün birleştirildiği `main` `1bff760b872c5c5f6cad4ab6535edbbdf0e2eff2`. M01–M04'ün kaynak/CI/merge/main kanıtları kapandı; M05/A ayrı açık. `main` değişmişse önce kod ve açık iş farkını uzlaştır.

## Aktif sıra

| Öncelik | Teslim dilimi                                                                                          | Kontrol noktası                                                                                                                    |
| ------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| 1       | [M05 finans iadesi ve A-ortak cache/mutation kabulü](remaining-work.md#router-query-birlesik)                    | Eski cursor/filtre, zorunlu readback, başka tenant ve bilinmeyen ACK testleri. İlgili key aileleri dışında gereksiz `refetch` yok. |
| 2       | [M06–M07, M11–M12 oturum/scope ve veri sahibi](remaining-work.md#router-query-birlesik)                | MFA, same-user/new-session, rol iptali, Router history, workspace tek `queryFn`; yanlış/eskimiş yetki görünümü yok.                |
| 3       | [M08–M10 trafik ve iptal](remaining-work.md#router-query-birlesik)                                     | Önce/sonra istek sayısı ve gecikme ölçülür. Native write/receipt doğrulaması bozulmaz.                                             |
| 4       | [M13 koşullu, M14 test kararlılığı ve D01–D05 birleşik kabul](remaining-work.md#router-query-birlesik) | Ölçülmemiş optimizasyon yapılmaz; tam birim/Chromium, sonra dört profil ve gerekli gerçek ortam kabulü.                            |

**PR sınırı:** M01 PR #375, M02 PR #378, M03 PR #380 ve M04 PR #382 ile doğrulandı. Kalan işlerde tercihen iki mantıksal büyük PR: (1) alan kabulleri + oturum/scope doğruluğu, (2) ağ maliyeti + AbortSignal. Aynı sınıra bağlı birkaç iş bir PR'da kapanabilir; tam CI gereksiz sık çalıştırılmaz. Her PR ayrı branch ve Draft ile başlar; kod, test ve kabul aynı kaynak SHA'sına bağlıdır. Yeni kullanıcı yetkisi olmadan merge veya production değişikliği yapılmaz.

## Paralel, bağımsız teslim açıkları

[MONO-01 ve MONO-02](remaining-work.md#bağımsız-eski-teslim-kontrolleri-açık) Router/Query iyileştirmesi nedeniyle otomatik kapanmaz. Eski yayımlı adayın gerçek kaynak/ortam uzlaştırması ve kişisel ICS derin bağlantısının kullanıcı rolüne göre doğrulanması ayrı kabul ister.

## Son kontrol

- Açık işin kanıtı `remaining-work.md` içinde; sıra yalnız bu dosyada; tam SHA/run/ortam `handover.md` içinde.
- Yanlış yetki, stale cursor veya bilinmeyen write sonucu kalırsa ilgili iş **açık** kalır. Assertion, CI policy, timeout veya güvenlik kapısı gevşetilmez.
- Gerekli durumlarda backend API eksikliği somut tüketici talebine dönüştürülür; frontend bu gerekçeyle backend yazma yetkisi edinmez.
