// Adapted from constraint-driven-development/references/floor-guard.md.
// Diff-only heuristic: reports locations, never source text or secret values.
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const source = p => /\.(?:[cm]?[jt]sx?|py|sql|sh)$/.test(p);
const testFile = p => /(?:^|\/)(?:tests?|__tests__)\/|\.(?:test|spec)\./.test(p);
const suppression = /@ts-(?:ignore|nocheck|expect-error)|(?:eslint|oxlint)-disable|biome[-]ignore|#\s*(?:noqa|type:\s*ignore)|istanbul\s+ignore|c8\s+ignore|v8\s+ignore|no[s]emgrep|gitleaks[: ]allow|Stryker\s+disable/;
const skips = /\b(?:test|it|describe|t|context)\s*\.\s*(?:skip|todo|only|skipIf|runIf|fails)\b|\b(?:xit|xdescribe|xtest)\s*\(|\b(?:skip|todo|only)\s*:\s*(?:true|['"])/;
const assertions = /\b(?:expect|assert)\s*(?:\(|\.)/;
export function inspectDiff(diff) {
  const findings = []; let file = '', oldFile = '', header = false, line = 0;
  const added = [], removed = [], deleted = new Set();
  for (const text of diff.split('\n')) {
    if (text.startsWith('diff --git ')) { header = true; continue; }
    if (header && text.startsWith('--- ')) oldFile = text.slice(4).replace(/^a\//, '');
    if (header && text.startsWith('+++ ')) {
      file = text.slice(4) === '/dev/null' ? oldFile : text.slice(4).replace(/^b\//, '');
      if (text.slice(4) === '/dev/null') deleted.add(file);
    }
    if (text.startsWith('@@')) {header = false; line = Number(/\+(\d+)/.exec(text)[1]); continue;}
    if (header) continue;
    if (text.startsWith('+')) added.push({file, line: line++, text: text.slice(1)});
    else if (text.startsWith('-')) removed.push({file, line, text: text.slice(1)});
    else if (text.startsWith(' ')) line++;
  }
  const flag = (rule, row) => findings.push({rule, file: row.file, line: row.line || 1, fingerprint:createHash('sha256').update((row.text || 'file deleted').trim()).digest('hex')});
  for (const row of added) {
    if (!source(row.file)) continue;
    if (suppression.test(row.text)) flag('silenced-checker', row);
    if (/throw new (?:Error|NotImplementedError)\([^\n]*[Nn]ot implemented|catch\s*(?:\([^)]*\))?\s*\{\s*\}/.test(row.text)) flag('unfinished-work', row);
    if (testFile(row.file) && skips.test(row.text)) flag('test-disabled', row);
  }
  for (const file of deleted) if (source(file) && testFile(file)) flag('test-deleted', {file});
  // Exact moved assertions are allowed; changed/removed assertions require review.
  const replacements = new Map();
  for (const row of added) {
    const key = row.file + '\0' + row.text.trim();
    replacements.set(key, (replacements.get(key) || 0) + 1);
  }
  for (const row of removed) {
    if (!source(row.file) || !testFile(row.file) || deleted.has(row.file) || !assertions.test(row.text)) continue;
    const key = row.file + '\0' + row.text.trim(), count = replacements.get(key) || 0;
    if (count) replacements.set(key, count - 1); else flag('assertion-changed', row);
  }
  // Text-only threshold semantics cannot be proven by regex. Existing rules are
  // protected by the trusted policy blob comparison, not an invented classifier.
  return findings;
}
export function collectDiff(base, cwd = process.cwd()) {
  const git = args => execFileSync('git', ['-c', 'core.quotePath=false', ...args], {cwd, encoding:'utf8', maxBuffer:32*1024*1024, stdio:['ignore','pipe','pipe']});
  const root = git(['rev-parse','--show-toplevel']).trim();
  cwd = root;
  const ancestor = git(['merge-base', base, 'HEAD']).trim();
  if (!ancestor) throw Error('Missing merge base');
  for(const path of git(['diff','--name-only','-z',ancestor,'--']).split('\0').filter(Boolean)) {
    if(/[\n\r\t"]/.test(path)) throw Error('Unsupported tracked path');
  }
  let diff = git(['diff','--no-ext-diff','--no-renames','--unified=0',ancestor,'--']);
  for (const path of git(['ls-files','--others','--exclude-standard','-z']).split('\0').filter(Boolean)) {
    // Fail closed for ambiguous/control-character paths and non-regular inputs.
    if (/[\n\r\t"]/.test(path) || !fs.lstatSync(root+'/'+path).isFile()) throw Error('Unsupported new file');
    try { diff += git(['diff','--no-ext-diff','--no-index','--unified=0','/dev/null',path]); }
    catch (e) { if(e.status !== 1 || typeof e.stdout !== 'string') throw e; diff += e.stdout; }
  }
  return diff;
}
export function applyExceptions(findings, entries, now = new Date()) {
  const today=now.toISOString().slice(0,10), seen=new Set();
  for(const e of entries) {
    const id=e.rule+'\0'+e.path+'\0'+e.fingerprint;
    const created=new Date(e.created), expires=new Date(e.expires);
    if(!['silenced-checker','test-disabled','test-deleted','assertion-changed','unfinished-work'].includes(e.rule)
      || typeof e.path!=='string' || e.path.startsWith('/') || e.path.split('/').includes('..')
      || !/^[a-f0-9]{64}$/.test(e.fingerprint) || !e.owner?.trim() || typeof e.reason!=='string' || e.reason.trim().length<20
      || !/^\d{4}-\d{2}-\d{2}$/.test(e.created) || !/^\d{4}-\d{2}-\d{2}$/.test(e.expires)
      || !Number.isFinite(+created) || !Number.isFinite(+expires) || expires<=created
      || expires-created>90*86400000 || e.created>today || e.expires<today || seen.has(id)) throw Error('Invalid quality exception');
    seen.add(id);
  }
  return findings.filter(f=>!seen.has(f.rule+'\0'+f.file+'\0'+f.fingerprint));
}
export function run(base) {
  try {
    const entries=JSON.parse(fs.readFileSync(new URL('./floor-exceptions.json',import.meta.url),'utf8'));
    if(!Array.isArray(entries)) throw Error('Invalid exceptions');
    const findings = applyExceptions(inspectDiff(collectDiff(base)),entries);
    for(const f of findings) console.error(`floor-guard: ${f.rule} ${f.file}:${f.line} (${f.fingerprint})`);
    console.log(`floor-guard: ${findings.length} finding(s)`);
    return findings.length ? 1 : 0;
  } catch { console.error('floor-guard: unable to inspect complete diff'); return 2; }
}
if(import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const args = process.argv.slice(2);
  if(args.length && (args.length !== 2 || args[0] !== '--base' || args[1].startsWith('-'))) process.exit(2);
  process.exitCode = run(args[1] || 'origin/main');
}
