const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
function walk(dir){
 return fs.readdirSync(dir,{withFileTypes:true}).flatMap(function(entry){
  if(entry.name==='.git'||entry.name==='node_modules'||entry.name==='test-results')return [];
  const full=path.join(dir,entry.name);
  return entry.isDirectory()?walk(full):[path.relative(root,full).split(path.sep).join('/')];
 });
}
const files=new Set(walk(root));
function resolve(page,link){
 // Ignore runtime-built URLs and external navigation; inspect literal
 // same-origin references that GitHub Pages must be able to serve.
 if(!link||/^(?:#|mailto:|tel:|data:|blob:|javascript:|https?:|\/\/)/i.test(link))return null;
 if(!/^[a-zA-Z0-9_\-./?=#%&:]+$/.test(link))return null;
 let value=link.split('#')[0].split('?')[0];
 if(!value)return null;
 if(value[0]==='/'){
  if(!value.startsWith('/dzoft/'))return null;
  value=value.slice('/dzoft/'.length);
  return value.endsWith('/')||!value?value+'index.html':value;
 }
 const out=path.posix.normalize(path.posix.join(path.posix.dirname(page),value));
 if(value.endsWith('/'))return (out==='.'?'':out.replace(/\/?$/,'/'))+'index.html';
 return out==='.'?'index.html':out;
}
test('literal same-origin links across public, bilingual, client and Admin pages exist',()=>{
 const pages=[...files].filter(function(p){return p.endsWith('.html')&&!p.includes('node_modules/');});
 const missing=[];
 let inspected=0;
 pages.forEach(function(page){
  const html=fs.readFileSync(path.join(root,page),'utf8');
  const re=/<(?:a|link|script|img|source)\b[^>]*?\b(?:href|src)\s*=\s*(["'])(.*?)\1/gi;
  for(const match of html.matchAll(re)){
   const dest=resolve(page,match[2]);if(!dest)continue;
   inspected++;
   if(!files.has(dest))missing.push(page+' → '+match[2]+' ('+dest+')');
  }
 });
 assert.ok(pages.length>=30,'Expected French/English and private pages to be scanned');
 assert.ok(inspected>400,'Expected static link coverage across site');
 assert.deepEqual(missing,[],'Broken same-origin links:\n'+missing.join('\n'));
});
