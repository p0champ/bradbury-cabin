// One complete release gate. A receipt is valid only for these exact files.
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { validateReceipt } from './release-receipt.mjs';
process.chdir(fileURLToPath(new URL('../', import.meta.url)));
const evidence = 'evidence/verify';
const git = (...args) => execFileSync('git',['-c','safe.directory=*',...args],{encoding:'utf8'}).trim();
const dirty = () => !!git('status','--porcelain','--untracked-files=all');
async function digest() {
  const files = execFileSync('git', ['-c','safe.directory=*','ls-files','--cached','--others','--exclude-standard','-z'], {encoding:'utf8'}).split('\0').filter(Boolean);
  const hash = createHash('sha256');
  for (const file of [...new Set(files)].sort()) {
    hash.update(file + '\0');
    hash.update(await readFile(file));
  }
  return hash.digest('hex');
}
if (process.argv.includes('--receipt')) {
  const receipt = JSON.parse(await readFile(`${evidence}/receipt.json`, 'utf8'));
  const refs=process.argv.includes('--push')?readFileSync(0,'utf8').trim().split('\n').filter(Boolean).map(line=>{
    const [ref,sha]=line.trim().split(/\s+/);
    return {ref,commit:git('rev-parse',`${sha}^{commit}`)};
  }):[];
  validateReceipt(receipt,{digest:await digest(),commit:git('rev-parse','HEAD'),dirty:dirty(),refs});
  console.log('Complete verification receipt matches these files.');
} else {
  if(dirty())throw Error('Commit this isolated repair before running the complete release gate.');
  const commit=git('rev-parse','HEAD');
  for (const key of Object.keys(process.env)) if (key.startsWith('CABIN_') && key.endsWith('_ONLY') && process.env[key]) throw Error('Focused checks cannot produce a release receipt.');
  await mkdir(evidence, {recursive:true});
  await writeFile(`${evidence}/receipt.json`, JSON.stringify({allPassed:false, startedAt:new Date().toISOString()}));
  const before = await digest();
  const tests = (await readdir('tests')).filter(f=>f.endsWith('.test.mjs')).sort().map(f=>`tests/${f}`);
  const modules = (await readdir('tests')).filter(f=>f.endsWith('-browser.cjs')).sort();
  const runner = await readFile('tests/browser-check.cjs','utf8');
  const fullRunner = runner.slice(runner.indexOf('    const page = await browser.newPage'));
  for (const module of modules) {
    const match = runner.match(new RegExp('const (\\w+) = require\\("\\./' + module.replaceAll('.','\\.') + '"\\)'));
    if (!(match ? fullRunner.includes(`await ${match[1]}(`) : fullRunner.includes(`require("./${module}")`))) throw Error(`Browser module missing from complete run: ${module}`);
  }
  const logs = [];
  async function run(name, command, args, env = {}) {
    const log = [];
    console.log(`Starting ${name}`);
    const child = spawn(command,args,{env:{...process.env,...env},stdio:['ignore','pipe','pipe']});
    for (const stream of [child.stdout, child.stderr]) stream.on('data', b=>{log.push(b); process.stdout.write(b);});
    const [code] = await once(child,'exit');
    await writeFile(`${evidence}/${name}.log`,Buffer.concat(log));
    logs.push({name,code});
    if (code !== 0) throw Error(`${name} failed; no release receipt issued.`);
  }
  await run('unit',process.execPath,['--test',...tests]);
  await run('picker',process.execPath,['tools/generate_picker_workflow.mjs','--check']);
  for (const script of ['expand_catalogue_031','generate_source_catalogue','critic_compare','extract_library','test_critic_compare'])
    await run(script,process.env.CABIN_PYTHON || 'python',['-I',`tools/${script}.py`,...(script==='test_critic_compare'?[]:['--check'])]);
  const server = spawn(process.execPath,['serve.mjs'],{env:{...process.env,PORT:'0'},stdio:['ignore','pipe','pipe']});
  try {
    const url = await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error('Preview did not start')),10000);
      server.once('error',reject);server.stdout.on('data',b=>{const m=String(b).match(/http:\/\/127\.0\.0\.1:\d+/);if(m){clearTimeout(timer);resolve(m[0]);}});
    });
    await run('browser',process.execPath,['tests/browser-check.cjs'],{CABIN_BASE_URL:url,CABIN_EVIDENCE_DIR:evidence});
    if (dirty() || commit!==git('rev-parse','HEAD') || before !== await digest()) throw Error('Project changed during verification. Run the full gate again.');
    await writeFile(`${evidence}/receipt.json`,JSON.stringify({allPassed:true,commit,digest:before,finishedAt:new Date().toISOString(),tests,modules,logs,hardwareVerified:false},null,2));
  } finally { server.kill(); }
}
