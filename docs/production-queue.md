# Aktif üretim sırası

Açık işlerin tanımı ve kabul ölçütleri yalnız [tek backlog’dadır](remaining-work.md). Kaynak/CI/CD durumu yalnız [00 devirde](contracts/00-FtkSaaS-yeni-sohbet-devir.md) tutulur.

1. **ST-02 aktif:** Kullanıcının son talimatı yalnız rapor/import/işlemsel bildirim tesliminin tamamlanmasıdır. P05/P06 motorlarının Starter tüketici zinciri, plan/rol/kota, gerçek CSV/export/inbox ve kaynak bağlı kabulü tamamlanır. [Alan devri](p06-handover.md#starter-tüketici-kabulü-st-02).
2. **WEB-01:** Frontend ekibinin saaspt kaynak aktarımı ve mevcut geliştirme Supabase’ine native Auth + gerçek API ekran entegrasyonu; backend ST-02 için bekleme koşulu değildir.
3. **ST-03 → OPS-01 → REL-01:** Sonraki işler; ST-02 talimatı bu sıraların uygulamasını başlatmaz.

Yeni görev tamamlanan kalemi backlog’da kapatır ve sıradan kaldırır; eski prompt/CI/pilot metinleri buraya eklenmez. P08 işleri ve gerçek SMS ayrı kapsamdadır. Full clean başlarsa [AGENTS bekleme kuralı](../AGENTS.md#full-clean-sırasında-kullanıcıya-devir) uygulanır.
