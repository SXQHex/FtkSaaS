# Özgün tasarım referansları

Bu klasör kullanıcı tarafından sağlanan HTML, CSS ve JavaScript çizimlerinin salt okunur örneklerini tutar. Geliştirme sırası ve bağlayıcı uygulama kararı [todo.md](../tasks/todo.md) sahibindedir.

## Kullanım

- Özgün kaynakların byte'larını değiştirme, biçimlendirme veya yeniden üretme. Uygulamayı `src` altında hazır blok ve bileşenlerle geliştir.
- Referansları üretim bundle'ına import etme, `public` altına taşıma veya deploy etme. Demo `app.js` backend, güvenlik, yetki veya iş kuralı kaynağı değildir.
- Lint, format ve Knip yalnız bu referans klasörünü dışlar; uygulama kaynaklarının kontrolleri korunur.
- Salt okunurluk bir kullanım kuralıdır. Git işletim sistemi düzeyinde read-only izni taşımaz; byte bütünlüğü aşağıdaki hash'lerle denetlenir.
- Dört dosya kaynak arşivdeki içerikle yerel ortamda karşılaştırıldı ve birebir aynı bulundu. Repoda doğrudan incelenebilir dört özgün dosya bulunur. Özgün arşiv [kaynak dosyasında](https://chatgpt.com/library?file_id=libfile_fde3_f-8802626211188191ab3cce09ff319b0b_e475c5c228c881918d2be9d25556f30c&account_id=personal) korunur.

## Kaynak ve bütünlük

Kaynak sürümleri **0**, inceleme tarihi **13 Kasım 2026**. Son aktarımda dört dosyanın SHA-256 değerleri özgün byte hash'leriyle tekrar eşleştirildi. Kimlikler özgün kaydı tanımlar; geliştirme durumu taşımaz.

| Dosya | Kaynak Library dosya kimliği | SHA-256 |
|---|---|---|
| `index.html` | `libfile_fde3_f-6ed1a32dbe988191874b229ec6e060d9_e475c5c228c881918d2be9d25556f30c` | `098fb6fd31a61f88f4aef4746d8fed55cf80ab87cee87cd28be50003e5ab2418` |
| `app.css` | `libfile_fde3_f-4961dae1f5fc8191bf18cd429e7bedb8_e475c5c228c881918d2be9d25556f30c` | `a8748d5c9923af76dfb65fc4fa37996df91f0bf26a8ae7ae3baf819985a3349c` |
| `tokens.css` | `libfile_fde3_f-ffe081c254c48191ad517104c9216222_e475c5c228c881918d2be9d25556f30c` | `2b13c0dbf69332f668e1393c6e00e880908912e413a612b441485f8b507a12c1` |
| `app.js` | `libfile_fde3_f-64f0a15b72a881918840d1ae5b0d3c24_e475c5c228c881918d2be9d25556f30c` | `35a291f01ca1f1a484618399a7ae3a636e49c5778084c420a1cdd946dd008892` |

Özgün arşivin SHA-256 değeri `91acf2e0363eba5cadc956207ad7a0e556c3c6528b66f9e77b23f502e50fe0e5`.

Bütünlük kontrolü, `apps/web1` çalışma dizininden:

```sh
python3 - <<'PY'
from pathlib import Path
import hashlib, re

root = Path("design-reference")
manifest = (root / "README.md").read_text()
rows = re.findall(r"^\| `([^`]+)` \| `libfile_[^`]+` \| `([a-f0-9]{64})` \|$", manifest, re.M)
assert len(rows) == 4, "Eksik hash kaydı"
for name, expected in rows:
    assert hashlib.sha256((root / name).read_bytes()).hexdigest() == expected, name
print("4 özgün dosyanın hash'i eşleşti.")
PY
```

## Yerel önizleme

`apps/web1` içinde, uygulamadan ayrı portta:

```sh
python3 -m http.server 4184 --bind 127.0.0.1 --directory design-reference
```

Tarayıcıda `http://127.0.0.1:4184` açılır. Tema, rol ve ekran seçimi demo görünümünü gösterir; gerçek erişim hakkı sağlamaz. Aynı viewport/tema/durumda uygulamayla karşılaştır; kabulü ilgili E maddesinde kaydet.
