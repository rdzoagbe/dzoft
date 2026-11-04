const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('assets/payment-reminder.js','utf8');
const body=source.split("box.querySelector('[data-send]').onclick=async function(){")[1].split('\n        };')[0];
async function scenario(email,wa,fail){
 const close={disabled:false,textContent:''},popup={closed:false,location:{},close(){this.closed=true;}};
 const controls={'[data-email]':{checked:email},'[data-wa]':{checked:wa},'[data-phone]':{value:'+33612345678'},'[data-message]':{value:'Test message'},'[data-pdf]':{checked:false},'[data-result]':{},'[data-outcome]':{focus(){}}};
 const box={innerHTML:'',querySelector:s=>controls[s]};let calls=[];
 const ctx={box,busy:false,dialog:{querySelector:()=>close,scrollTop:0},p:{email:'test@example.com'},window:{open:()=>popup},t:(fr,en)=>en,en:()=>true,escape:String,errorText:()=> 'Service error',setTimeout,clearTimeout,Date,call:async action=>{calls.push(action);if(action===fail)throw Error('failure');return action==='email'?{ok:true}:{ok:true,url:'https://wa.me/33612345678?text=test'};}};
 vm.createContext(ctx);await vm.runInContext('(async function(){'+body+'})()',ctx);return {box,close,calls};
}
(async()=>{
 let r=await scenario(true,false);assert.match(r.box.innerHTML,/Email submitted successfully/);assert.match(r.box.innerHTML,/Delivery to the client/);assert.equal(r.close.disabled,false);
 r=await scenario(true,false,'email');assert.match(r.box.innerHTML,/sending not confirmed/);assert.match(r.box.innerHTML,/role="alert"/);
 r=await scenario(true,true,'whatsapp');assert.match(r.box.innerHTML,/Email submitted successfully/);assert.match(r.box.innerHTML,/preparation not confirmed/);assert.deepEqual(r.calls,['email','whatsapp']);
 r=await scenario(false,true);assert.match(r.box.innerHTML,/WhatsApp: finish sending/);assert.doesNotMatch(r.box.innerHTML,/Email submitted/);
 console.log('PASS: email success, failure, mixed channel results, WhatsApp-only status, and enabled Done button; no live sends.');
})().catch(e=>{console.error(e);process.exitCode=1});
