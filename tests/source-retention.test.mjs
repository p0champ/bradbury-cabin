import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, mkdtemp, rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join, dirname, basename, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const git=(...args)=>execFileSync('git',['-c','safe.directory=*',...args],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']});
const json=async path=>JSON.parse(await readFile(join(root,path),'utf8'));

test('a fresh checkout without platform newline conversion preserves every pinned original source byte',async()=>{
  const expected=new Map();
  for(const manifest of ['tools/source-manifest.json','tools/expansion-031.json','tools/expansion-world.json','tools/expansion-french.json']){
    for(const [file,source] of Object.entries((await json(manifest)).sources))expected.set(`tools/sources/${file}`,source.sha256);
  }
  for(const manifest of ['tools/critic/critic-extraction.json','tools/critic/extraction-031.json','tools/critic/extraction-world.json','tools/critic/extraction-french.json']){
    for(const [number,source] of Object.entries((await json(manifest)).sources))expected.set(`tools/critic/sources/pg${number}-images.html`,source.sha256);
  }
  expected.set('tools/critic/critic-extraction.json',(await json('tools/critic/verdicts.json')).extractionSha256);
  const dir=await mkdtemp(join(tmpdir(),'cabin-source-retention-'));
  try{
    const checkout=join(dir,'checkout');
    git('-c','core.autocrlf=false','clone','--quiet','--no-hardlinks','--no-checkout',root,checkout);
    git('-C',checkout,'-c','core.autocrlf=false','checkout','--force','HEAD','--','.gitattributes','tools/sources','tools/critic/sources','tools/critic/critic-extraction.json');
    assert.ok(expected.size>=19,'the retained text and independent HTML editions are all checked');
    for(const [file,hash]of expected){
      const bytes=await readFile(join(checkout,file));
      assert.equal(createHash('sha256').update(bytes).digest('hex'),hash,`fresh checkout must retain the existing pinned hash: ${file}`);
    }
  }finally{
    assert.equal(dirname(resolve(dir)),resolve(tmpdir()));
    assert.ok(basename(dir).startsWith('cabin-source-retention-'));
    await rm(dir,{recursive:true,force:true});
  }
});
