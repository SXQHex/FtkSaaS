# Frontend sohbet devri

Aktif bölüm, kapsam ve kabulün tek sahibi [todo.md](todo.md) dosyasıdır. Bu dosya yalnız devam için gerekli çalışma bağlamını taşır.

## Çalışma bağlamı

Dal `feat/web-s01-account-security`, [PR92](https://github.com/SXQHex/FtkSaaS/pull/92). Kullanıcının son kararı S01 kabulüne dönmektir; S02 ayrı Draft PR93'te korunur ve bu dala taşınmaz. Önce kök/yerel AGENTS, [geliştirme rehberi](development.md), [todo](todo.md), ardından WF00/WF01/WF04/WF12/WF17/WF20 ve settings alanları okunur.

Main `86b9b890d987518f3afe2d18ccef960a43cd244d` bu S01 dalına normal merge ile alındı. README/todo çakışmaları yeni belge sahipliğine göre çözüldü: kısa README korunur; frontend notları bu dizinde kalır. Backend/ortak/CI kaynakları main ile aynı olmalıdır. Eski 925ed064 head'in başarısı yeni birleşik kaynağa taşınmaz.

Kabul incelemesindeki runtime düzeltmeleri aynı dalda tutulur: aktif hesap projeksiyonu kapanmışken silme replay'inin native kullanıcı bağında kurtarılması; status ile kesinleşen mevcut oturum iptalinde native çıkış; cihaz saat diliminin açık formatlanması. Test ve kabul sonuçları yalnız todo sahibinde güncellenir.

Bu çalışma ortamında canlı kabul hesabı/config dosyası yoktur. Token/parola sohbete veya kaynaklara yazılmaz; gerçek sağlayıcı/hesap kabulü mock ile kapatılmaz. Gerçek hesap silme veya production değişikliği yapılmadı. Yeni CI başlayınca run/head/base bilgisini kullanıcıya bırak; AGENTS bekleme kuralı uygulanır.
