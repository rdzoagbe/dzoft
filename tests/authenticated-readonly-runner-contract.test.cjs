'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const script=path.resolve(__dirname,'../tools/acceptance-readonly.mjs');
const source=fs.readFileSync(script,'utf8');

test('authenticated acceptance is manual-only and parses on Node',()=>{
 const check=spawnSync(process.execPath,['--check',script],{encoding:'utf8'});
 assert.equal(check.status,0,check.stderr);
 assert.match(source,/process\.env\.CI/);
 assert.match(source,/headless:false/);
 assert.match(source,/acceptDownloads:false/);
 assert.match(source,/serviceWorkers:'block'/);
});
test('read-only browser guard rejects mutations and does not serialize sessions',()=>{
 assert.match(source,/context\.route\('\*\*\/\*'/);
 assert.match(source,/READ_RPCS\.has\(rpc\[1\]\)/);
 assert.match(source,/route\.abort\('blockedbyclient'\)/);
 assert.match(source,/authLogin/);
 for(const forbidden of ['storageState(', 'page.screenshot(', 'tracing.start(', 'localStorage.getItem(']){
  assert.equal(source.includes(forbidden),false,'Forbidden credential capture: '+forbidden);
 }
});
