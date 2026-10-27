# Aktif üretim sırası

Açık işlerin tanımı ve kabul ölçütleri yalnız [tek backlog’dadır](remaining-work.md). Kaynak/CI/CD durumu yalnız [00 devirde](contracts/00-FtkSaaS-yeni-sohbet-devir.md) tutulur.

1. **WEB-01 aktif:** Yalnız FtkSaaS içinde hazır shadcn/ui bileşenleriyle frontend ve tüm test altyapısını kur; yönetici giriş/oturum/bağlam temelini mevcut geliştirme Supabase'ine bağla. [Frontend devri](frontend-development.md).
2. **CI ayrımı:** Frontend tetikleyicisini bağımsız tut; backend sahibinin frontend-only kaynak için karşı tetikleme/kabul değişikliğini [CI devrinden](frontend-backend-ci-handover.md) tamamlaması gerekir. Backend kodu ve mevcut backend CI bu frontend görevinin yetkisinde değildir.
3. **ST-02 → ST-03 → OPS-01 → REL-01:** kalan Starter tüketicileri ve işletim kabulü. Ürün belirsizliği yoksa mevcut kararlarla ilerlenir.

Yeni görev tamamlanan kalemi backlog’da kapatır ve sıradan kaldırır; eski prompt/CI/pilot metinleri buraya eklenmez. P08 işleri ve gerçek SMS ayrı kapsamdadır. Full clean başlarsa [AGENTS bekleme kuralı](../AGENTS.md#full-clean-sırasında-kullanıcıya-devir) uygulanır.
