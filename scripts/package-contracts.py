"""Package only bytes from an explicit reviewed commit; no worktree or secrets."""
from pathlib import Path
import subprocess,json,hashlib,zipfile,sys
if len(sys.argv)!=3:raise SystemExit('python3 scripts/package-contracts.py COMMIT_SHA OUTPUT_ZIP')
sha=subprocess.check_output(['git','rev-parse',sys.argv[1]+'^{commit}'],text=True).strip()
out=Path(sys.argv[2]).resolve()
base='a76e0e618744147471796a5b3a227a7bce2dced2'
def git(*args):return subprocess.check_output(['git',*args])
def read(p):return git('show',sha+':'+p)
files=git('ls-tree','-r','--name-only',sha).decode().splitlines()
selected=[p for p in files if (
 (p.startswith('contracts/') and '/source-v2.2/' not in p)
 or p.startswith('packages/api-contracts/')
 or p.startswith('docs/decisions/')
 or p in ['docs/claude-handover.md','docs/endpoint-inventory.json','docs/development-connection.json',
 'vercel.json','reports/qe02-verification.json','reports/qe02-acceptance.log','reports/qe02-review.md','examples/event-cancellation-semantics.json']
)]
changed=git('diff','--name-status',base,sha).decode()
mapping=[]
for n in range(9):
 p=next(p for p in selected if p.startswith('contracts/'+f'{n:02}-'))
 status='replace' if git('diff',base,sha,'--',p) else 'unchanged'
 mapping.append({'project_source_filename':Path(p).name,'package_path':p,'action':status,'sha256':hashlib.sha256(read(p)).hexdigest()})
manifest={'reviewed_commit_sha':sha,'comparison_base_sha':base,'project_source_mapping':mapping,'files':[{'path':p,'sha256':hashlib.sha256(read(p)).hexdigest(),'bytes':len(read(p))} for p in selected]}
listing='# Kaynak değişim listesi\n\nİncelenen commit: '+sha+'\n\nKarşılaştırma: '+base+'\n\n| Proje kaynak dosyası | İşlem | Paket yolu |\n|---|---|---|\n'
for x in mapping:listing+='| '+x['project_source_filename']+' | '+x['action']+' | '+x['package_path']+' |\n'
listing+='\n00–08 dosyaları bu commit’in güncel kopyalarıdır. Eski dosyaları kullanıcı değiştirir. 09–11 raporları tarihsel snapshot; güncel teknik kanıt qe02 raporudur. Q-E02 karar kaydı ve Claude devri ayrıca dahildir. Fiilî başlangıç/kısmi gerçekleşme tanımı açıktır; mevcut occurred ve yoklama delilleri korunur.\n\nRepository değişimleri (RC2’den):\n\n'+chr(96)*3+'text\n'+changed+chr(96)*3+'\n'
out.parent.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
 for p in selected:z.writestr(p,read(p))
 z.writestr('SOURCE-MANIFEST.json',json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
 z.writestr('KAYNAK-DEGISIM-LISTESI.md',listing)
 z.writestr('README.md','# FtkSaaS güncel sözleşme paketi · 0.2.0-rc.3\n\nKesin kaynak commit: '+sha+'\n\nÖnce KAYNAK-DEGISIM-LISTESI.md, docs/decisions/Q-E02.md ve docs/claude-handover.md okunur. 53 çağrılabilir / 129 yalnız sözleşme. Production dağıtımı yoktur. CI/PR durumu commit’in GitHub kontrollerinden ayrıca doğrulanır; bu paket kendi başına review onayı değildir.\n')
with zipfile.ZipFile(out) as z:
 assert z.testzip() is None
 for entry in manifest['files']:assert hashlib.sha256(z.read(entry['path'])).hexdigest()==entry['sha256']
out.with_name('FtkSaaS-kaynak-degisim-listesi.md').write_text(listing)
print(json.dumps({'commit':sha,'zip':str(out),'files':len(selected),'sha256':hashlib.sha256(out.read_bytes()).hexdigest()}))
