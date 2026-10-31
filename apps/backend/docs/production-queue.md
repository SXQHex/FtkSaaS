# Backend geliştirme sırası ve koordinasyon

Bu kayıt backend işlerinin sırasını ve diğer alanlara bağımlılığını tutar; frontend’in aktif modülünü değiştirmez. Kapsam/kapanış ölçütleri yalnız [backlog’da](remaining-work.md); kaynak/CI/CD yalnız [güncel kabul kaydında](00-FtkSaaS-yeni-sohbet-devir.md) tutulur.

1. **CI-RERUN:** PR99 merge bekler. Aynı kaynakta failed-job rerun başarısının kabulünü düzelt; kaynak ve gerçek test güvenliğini koruyarak yerel regresyon, bağımsız inceleme, aday CI ve politika kurulumunu tamamla. Runner kapanışının sinyal kaynağı ayrı açık incelemedir.
2. **DOCS-01 / PR90:** CI kabulü düzeldikten sonra; bütün belgeleri temizle ve tek yetkili kaynak düzenini kur. Son kaynak inceleme ve aday kabulünden önce merge edilmez.
3. **WEB-01:** Frontend’in aktif bölümü ve bölüm sırası yalnız [web yol haritasında](../../web/docs/todo.md#7-bölüm-bölüm-teslim-tek-aktif-bölüm) tutulur. Bir bölüm bitmeden sonraki bölüme geçilmez; burada ikinci modül sırası oluşturulmaz. ST-03/PUBLIC-01 kabulü ilgili gerçek ekran/provider dilimiyle birlikte tamamlanır.
4. **OPS-01 / REL-01:** Backend privacy/retention ve hosted restore kalanları; frontend işi bu kapıları veya backend runtime’ı değiştirmez.
5. **CI-SPLIT:** Karşılıklı frontend/backend/shared kaynak kanıtları mevcut kabul sınırını koruyarak tamamlanır. Süre optimizasyonu üretim blokajı değildir.
