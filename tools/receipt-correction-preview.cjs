'use strict';
// Isolated offline preview. Does NOT contact DZOFT or change financial data.
function cents(n) {
 if(typeof n!=='number'||!Number.isFinite(n)||n<0||!Number.isSafeInteger(Math.round(n*100))||Math.abs(n*100-Math.round(n*100))>1e-7)throw Error('Invalid amount in EUR cents');
 return Math.round(n*100);
}
function iso(s){
 if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;
 const d=new Date(s+'T12:00:00Z');
 return !isNaN(d.getTime())&&d.toISOString().slice(0,10)===s;
}
function preview(opts){
 const {receipt,previous=[],kind,amount,date,reason,key}=opts||{};
 if(!receipt||!receipt.id||!key||typeof key!=='string')throw Error('Missing identifiers');
 if(typeof reason!=='string'||reason.trim().length<12||reason.trim().length>500)throw Error('Invalid audit reason');
 if(!['void_error','reduce_error','correct_date'].includes(kind))throw Error('Unsupported correction');
 const original=cents(receipt.amount);
 if(original===0||!iso(receipt.received_on))throw Error('Invalid original receipt');
 let effective=original, effectiveDate=receipt.received_on;
 const keys=new Set();
 for(const a of previous){
   if(a.receipt_id!==receipt.id)throw Error('Wrong receipt');
   if(!a.key||keys.has(a.key))throw Error('Duplicate historical key');
   keys.add(a.key);
   if(a.kind==='correct_date'){
     if(!iso(a.date))throw Error('Invalid date history');
     effectiveDate=a.date;
   }else if(['void_error','reduce_error'].includes(a.kind)){
     const debit=cents(a.amount);
     if(debit===0||debit>effective)throw Error('Historical amount exceeds balance');
     effective-=debit;
   }else throw Error('Unsupported historical correction');
 }
 if(keys.has(key))throw Error('Idempotency key already used; retrieve existing result');
 if(effective===0)throw Error('Already fully voided');
 let debit=0,newDate=effectiveDate;
 if(kind==='correct_date'){
   if(!iso(date)||date===effectiveDate)throw Error('Invalid or unchanged correction date');
   newDate=date;
 }else{
   debit=kind==='void_error'?effective:cents(amount);
   if(debit===0||debit>effective)throw Error('Debit exceeds effective receipt');
 }
 return Object.freeze({receipt_id:receipt.id,key,kind,original_cents:original,previous_cents:effective,debit_cents:debit,new_cents:effective-debit,old_date:effectiveDate,new_date:newDate,reason:reason.trim(),read_only:true,requires_server_approval:true});
}
module.exports={cents,iso,preview};
