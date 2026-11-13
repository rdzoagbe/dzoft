const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
class Node {
 constructor(tag){this.tag=tag;this.children=[];this._text='';this.className='';this.attributes={};}
 set textContent(t){this._text=String(t);this.children=[];}
 get textContent(){return this._text+this.children.map(c=>typeof c==='string'?c:c.textContent).join('');}
 append(...n){this.children.push(...n);}
 replaceChildren(...n){this._text='';this.children=n;}
 setAttribute(k,v){this.attributes[k]=v;}
 closest(){return null;}
}
function contextFor(query,commits){
 const root=new Node('div'),calls=[];
 const ctx={
  window:{setInterval:()=>0},
  document:{
   visibilityState:'visible',
   getElementById(id){return id==='jr-github-slot'?root:null;},
   createElement(tag){return new Node(tag);},
   addEventListener(){}
  },
  location:{search:query},
  URLSearchParams,Date,console,
  fetch(url,opts){calls.push({url,opts});return Promise.resolve({ok:true,json:()=>Promise.resolve(commits)});}
 };
 return {ctx,root,calls};
}
const commit=(sha,date,message)=>({sha,commit:{committer:{date},message,author:{name:'Claude',email:'private@example.com'}}});
test('Rodney activity updates automatically without copying AI metadata, commit subjects, code or session URLs',async()=>{
 const data=[
  commit('a'.repeat(40),'2026-11-13T15:10:00Z',
   'Admin portal: print-friendly venue QR code\n\nCo-Authored-By: Claude Fable <noreply@example.com>\nClaude-Session: https://claude.ai/code/session_secret'),
  commit('b'.repeat(40),'2026-11-13T15:10:01Z','Fix user login issue and internal API token leak'),
  commit('c'.repeat(40),'2026-11-12T12:00:00Z','Fix client mobile layout')
 ];
 const {ctx,root,calls}=contextFor('?q=c8a50cee-3856-4539-98a3-f5df201dbff0',data);
 vm.runInNewContext(read('admin/github-journal.js'),ctx,{filename:'admin/github-journal.js'});
 for(let i=0;i<5;i++)await new Promise(setImmediate);
 assert.equal(calls.length,1);
 assert.match(calls[0].url,/^https:\/\/api\.github\.com\/repos\/ProjectRodney\/ProRod\/commits\?sha=main/);
 assert.equal(calls[0].opts.credentials,'omit');
 const visible=root.textContent;
 assert.match(visible,/Activité de développement/);
 assert.match(visible,/3/);
 assert.match(visible,/Administration/);
 assert.doesNotMatch(visible,/Co-Authored-By|Claude-Session|claude\.ai|Claude Fable|noreply@example|internal API token|leak|a{40}|b{40}|print-friendly|user login/i);
});
test('the GitHub synchronization is limited to the known Rodney quote',()=>{
 const {ctx,calls}=contextFor('?q=random-client-project',[]);
 vm.runInNewContext(read('admin/github-journal.js'),ctx);
 assert.equal(calls.length,0);
});
test('journal quick add and legacy notes remain local and private',()=>{
 const html=read('admin/suivi.html'),js=read('admin/github-journal.js');
 for(const id of ['jr-quick','jr-quick-text','jr-quick-date','jr-quick-type','jr-github-slot','jr-bulk','jr-copy','jr-edit','jr-filters','journal'])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/Q\.journal\.unshift\(\{ d:\$\('jr-quick-date'\)/);
 assert.match(html,/filtered\.slice\(0,8\)/);
 assert.match(html,/github-journal\.js\?v=/);
 assert.doesNotMatch(js,/\.rpc\(|sb\.update|sb\.insert|localStorage|sessionStorage|XMLHttpRequest|POST|PUT|PATCH|DELETE/);
 const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
 for(const m of scripts)if(m[1].trim())new vm.Script(m[1]);
});
