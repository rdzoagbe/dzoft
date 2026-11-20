const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

function functionSlice(source,from,to){
 const a=source.indexOf(from),b=source.indexOf(to,a+from.length);
 assert.ok(a>=0&&b>a,'Expected source boundaries: '+from+' → '+to);
 return source.slice(a,b);
}

test('pending-payment status has Discard changes without being committed as a received payment',()=>{
 const code=read('assets/project-tracking.js');
 const src=functionSlice(code,'function wireDraftCancelButtons(root){',' function invoiceLinkForms(');
 assert.match(src,/\.tracking-claim-actions > form\[data-status-id\]/);
 assert.match(src,/Annuler les modifications','Discard changes'/);
 assert.match(src,/if\(form\.querySelector\('button\[type="submit"\]:disabled'\)\)return/);
 assert.match(src,/form\.reset\(\)/);
 assert.doesNotMatch(src,/sb\.rpc|\.update\(|fetch\(/);
});

test('pending-payment status Discard restores the old selection, date and focus, without a server call',()=>{
 const code=read('assets/project-tracking.js');
 const src=functionSlice(code,'function wireDraftCancelButtons(root){',' function invoiceLinkForms(');
 const handlers={};
 const date={value:'2026-11-20'};
 const status={value:'cancelled',defaultValue:'pending',required:false,dispatched:0,focused:false,
  dispatchEvent(){this.dispatched++;this.required=this.value==='sent_by_client';},
  focus(){this.focused=true;}};
 const submit={disabled:false,insertAdjacentElement(position,button){assert.equal(position,'afterend');handlers.cancel=button;}};
 const message={textContent:'Unsaved draft'};
 let resetCount=0;
 const form={
  elements:{status,reportedOn:date},
  hasAttribute(k){return k==='data-status-id';},
  querySelector(s){
   if(s==='[data-cancel-draft]')return null;
   if(s==='button[type="submit"]')return submit;
   if(s==='button[type="submit"]:disabled')return submit.disabled?submit:null;
   if(s==='[role="status"]')return message;
   return null;
  },
  querySelectorAll(s){assert.equal(s,'select');return [status];},
  closest(s){assert.equal(s,'details');return null;},
  reset(){resetCount++;status.value=status.defaultValue;date.value='2026-11-14';}
 };
 const root={querySelectorAll(selector){assert.match(selector,/form\[data-status-id\]/);return [form];}};
 let rpcCount=0;
 const sandbox={document:{createElement(){return {setAttribute(k,v){this[k]=v;},addEventListener(k,fn){handlers[k]=fn;}};}},t:fr=>fr,Event:class Event{constructor(type,options){this.type=type;this.bubbles=options.bubbles;}},sb:{rpc(){rpcCount++;}}};
 vm.runInNewContext(src+';wireDraftCancelButtons(root);',Object.assign(sandbox,{root}));
 assert.equal(handlers.cancel.textContent,'Annuler les modifications');
 assert.equal(handlers.cancel.type,'button');
 handlers.click();
 assert.equal(resetCount,1);
 assert.equal(status.value,'pending');
 assert.equal(date.value,'2026-11-14');
 assert.equal(status.dispatched,1);
 assert.equal(status.focused,true);
 assert.equal(message.textContent,'');
 assert.equal(rpcCount,0);
 status.value='cancelled';submit.disabled=true;
 handlers.click();
 assert.equal(resetCount,1,'in-flight status update must never be silently dismissed');
});

test('client and owner change forms cannot pretend to Cancel a server operation already in progress',()=>{
 const source=read('assets/change-requests.js');
 assert.match(source,/function perform\(promise,done\)\{if\(busy\)return;busy=true;root\.__dzoftChangeBusy=true;/);
 assert.match(source,/function perform\(p,msg\)\{if\(busy\)return;busy=true;root\.__dzoftChangeBusy=true;/);
 assert.equal((source.match(/root\.__dzoftChangeBusy=false/g)||[]).length,5);
 assert.match(source,/options\.sendCode\(btn\.dataset\.changeCode\)/);
 assert.match(source,/function fromJournal\(form,btn\)\{[\s\S]{0,90}root\.__dzoftChangeBusy=true/);
 assert.match(source,/owner_mark_change_shared_manually/);
 const src=functionSlice(source,"if(global.document)global.document.addEventListener('click'","api.client=bindClient;");
 let click=null,resets=0,details={open:true},scope={__dzoftChangeBusy:true};
 const form={reset(){resets++;},closest(s){return s==='details'?details:null;}};
 const button={dataset:{formCancel:''},closest(sel){return sel==='form'?form:(sel==='details'?details:scope);}};
 const sandbox={global:{document:{addEventListener(k,fn){assert.equal(k,'click');click=fn;}}},document:{documentElement:{lang:'fr'}},tr:(en,fr)=>fr};
 vm.runInNewContext(src,sandbox);
 click({target:{closest(){return button;}}});
 assert.equal(resets,0);
 assert.equal(details.open,true);
 scope.__dzoftChangeBusy=false;
 click({target:{closest(){return button;}}});
 assert.equal(resets,1);
 assert.equal(details.open,false);
});

test('quote line and hosting removal requires confirmation before an autosaved draft changes',()=>{
 const html=read('admin/devis.html');
 const src=functionSlice(html,'function removeQuoteLine(index){','  function renderLines(){');
 const dialogs=[];
 const state={lines:[{l:'Client authentication',s:'Secured login',q:1,p:120},{h:1,l:'PWA',s:'Scope'}],host:[{l:'Domain',w:'OVH',c:'12 €/yr'}]};
 let confirmResult=false,renderCount=0,hostRenderCount=0;
 const context={
  state,
  window:{confirm(message){dialogs.push(message);return confirmResult;}},
  renderLines(){renderCount++;},
  renderHost(){hostRenderCount++;}
 };
 vm.runInNewContext(src,context);
 context.removeQuoteLine(0);
 assert.equal(state.lines.length,2);
 assert.equal(renderCount,0);
 assert.match(dialogs[0],/Client authentication/);
 confirmResult=true;
 context.removeQuoteLine(0);
 assert.equal(state.lines.length,1);
 assert.equal(renderCount,1);
 confirmResult=false;
 context.removeQuoteLine(0);
 assert.equal(state.lines.length,1);
 assert.match(dialogs.at(-1),/Les prestations sous ce titre resteront/);
 context.removeHostLine(0);
 assert.equal(state.host.length,1);
 assert.equal(hostRenderCount,0);
 confirmResult=true;
 context.removeHostLine(0);
 assert.equal(state.host.length,0);
 assert.equal(hostRenderCount,1);
 assert.equal(dialogs.length,5);
});
