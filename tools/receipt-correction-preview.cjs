'use strict';
// DZOFT read-only, deterministic correction model. NEVER writes to Supabase.
// It is not an authorization check, an issued credit note, or a completed reversal.

function cents(n){
 if(typeof n!=='number'||!Number.isFinite(n)||n<0||
    !Number.isSafeInteger(Math.round(n*100))||
    Math.abs(n*100-Math.round(n*100))>1e-7)throw Error('Invalid amount in EUR cents');
 return Math.round(n*100);
}
function amount(n){
 if(typeof n==='string'){
  if(!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(n))throw Error('Invalid decimal amount');
  n=Number(n);
 }
 return cents(n);
}
function iso(s){
 if(typeof s!=='string'||! /^\d{4}-\d{2}-\d{2}$/.test(s))return false;
 const d=new Date(s+'T12:00:00Z');
 return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===s;
}
function nonFutureDate(d,asOfDate){
 if(!iso(d)||!iso(asOfDate)||d>asOfDate)throw Error('Invalid or future correction date');
}
function add(a,b){
 const n=a+b;
 if(!Number.isSafeInteger(n))throw Error('Money exceeds safe integer range');
 return n;
}
function replayReceipt(receipt,history=[],asOfDate='9999-12-31'){
 if(!receipt||!receipt.id||!iso(receipt.received_on))throw Error('Invalid original receipt');
 const original=amount(receipt.amount);
 if(original===0)throw Error('Invalid original receipt');
 let remaining=original,effectiveDate=receipt.received_on;
 const keys=new Set();
 for(const entry of history){
  if(entry.receipt_id!==receipt.id)throw Error('Wrong receipt');
  if(!entry.key||keys.has(entry.key))throw Error('Duplicate historical key');
  keys.add(entry.key);
  if(entry.kind==='correct_date'){
   nonFutureDate(entry.date,asOfDate);
   if(entry.date===effectiveDate)throw Error('Duplicate correction date');
   effectiveDate=entry.date;
   continue;
  }
  if(entry.kind!=='reduce_error'&&entry.kind!=='void_error')throw Error('Unsupported historical correction');
  const debit=amount(entry.amount);
  if(!debit||debit>remaining)throw Error('Historical amount exceeds balance');
  remaining-=debit;
 }
 return {original,remaining,effectiveDate,keys};
}
function preview(opts){
 const {receipt,previous=[],kind,amount:amountToDebit,date,reason,key,asOfDate='9999-12-31'}=opts||{};
 if(!receipt||!receipt.id||!key||typeof key!=='string')throw Error('Missing identifiers');
 if(typeof reason!=='string'||reason.trim().length<12||reason.trim().length>500)throw Error('Invalid audit reason');
 if(!['void_error','reduce_error','correct_date'].includes(kind))throw Error('Unsupported correction');
 const {original,remaining,effectiveDate,keys}=replayReceipt(receipt,previous,asOfDate);
 if(keys.has(key))throw Error('Idempotency key already used; retrieve existing result');
 if(remaining===0)throw Error('Already fully voided');
 let debit=0,newDate=effectiveDate;
 if(kind==='correct_date'){
  nonFutureDate(date,asOfDate);
  if(date===effectiveDate)throw Error('Invalid or unchanged correction date');
  newDate=date;
 }else{
  debit=kind==='void_error'?remaining:cents(amountToDebit);
  if(debit===0||debit>remaining)throw Error('Debit exceeds effective receipt');
 }
 return Object.freeze({
  receipt_id:receipt.id,key,kind,original_cents:original,previous_cents:remaining,
  debit_cents:debit,new_cents:remaining-debit,old_date:effectiveDate,new_date:newDate,
  reason:reason.trim(),read_only:true,requires_server_approval:true
 });
}

// Mirrors the current project_tracking() accounting identity for offline review.
// Credit notes reduce contract value; mistaken receipt corrections reduce funds.
// An actual refund is neither of these and is explicitly NOT modelled here.
// Legacy "paid" flags count only when NO ledger receipt is linked, even when
// that ledger receipt has later been voided. Never double-count the old flag.
function balanceSnapshot({acceptedTotal,invoices=[],receipts=[],adjustments=[],creditNotes=[],asOfDate='9999-12-31'}={}){
 const accepted=amount(acceptedTotal);
 if(![invoices,receipts,adjustments,creditNotes].every(Array.isArray))throw Error('Expected arrays');
 if(!iso(asOfDate))throw Error('Invalid valuation date');
 const receiptIds=new Set(),adjustmentKeys=new Set();
 const history=new Map();
 receipts.forEach(r=>{
  if(!r||typeof r.id!=='string'||!r.id||receiptIds.has(r.id))throw Error('Invalid or duplicate receipt');
  receiptIds.add(r.id);
 });
 adjustments.forEach(a=>{
  if(!a||!receiptIds.has(a.receipt_id))throw Error('Adjustment refers to unknown receipt');
  if(typeof a.key!=='string'||!a.key||adjustmentKeys.has(a.key))throw Error('Duplicate adjustment request key');
  adjustmentKeys.add(a.key);
  if(!history.has(a.receipt_id))history.set(a.receipt_id,[]);
  history.get(a.receipt_id).push(a);
 });
 const effectiveReceipts=receipts.map(r=>{
  const {original,remaining,effectiveDate}=replayReceipt(r,history.get(r.id)||[],asOfDate);
  return Object.freeze({
   receipt_id:r.id,invoice_id:r.invoice_id||null,
   original_cents:original,effective_cents:remaining,
   debited_cents:original-remaining,
   original_date:r.received_on,effective_date:effectiveDate
  });
 });
 const allReceiptAmount=effectiveReceipts.reduce((v,r)=>add(v,r.original_cents),0);
 const correctedAmount=effectiveReceipts.reduce((v,r)=>add(v,r.debited_cents),0);
 const effectiveAmount=effectiveReceipts.reduce((v,r)=>add(v,r.effective_cents),0);
 const linkedInvoices=new Set(receipts.map(r=>r.invoice_id).filter(Boolean));
 let legacy=0,supplement=0,reducedCredits=0,suppReissue=0;
 for(const i of invoices){
  if(!i||typeof i.id!=='string'||!i.id)throw Error('Invalid invoice');
  if(Object.prototype.hasOwnProperty.call(i,'change'))supplement=add(supplement,amount(i.amt));
  if(!Object.prototype.hasOwnProperty.call(i,'care')&&i.paid===true&&!linkedInvoices.has(i.id))
   legacy=add(legacy,amount(i.amt));
 }
 for(const cn of creditNotes){
  if(!cn||!['reduce','reissue'].includes(cn.effect))throw Error('Invalid credit note');
  const credit=amount(cn.amount);
  if(credit===0)throw Error('Invalid credit note amount');
  if(cn.effect==='reduce')reducedCredits=add(reducedCredits,credit);
  else if(cn.invoice_kind==='supplement')suppReissue=add(suppReissue,credit);
 }
 const agreed=accepted+supplement-reducedCredits-suppReissue;
 if(!Number.isSafeInteger(agreed)||agreed<0)throw Error('Contract and credit note totals conflict');
 const received=add(effectiveAmount,legacy);
 const due=Math.max(agreed-received,0),overpaid=Math.max(received-agreed,0);
 // Invoice "paid" JSON flags are historical; for an invoice with ledger links
 // the true status must be derived from the effective linked receipts.
 const invoiceSettlements=invoices.map(i=>{
  const invoiceAmount=amount(i.amt);
  const linked=effectiveReceipts.filter(r=>r.invoice_id===i.id);
  const actuallyPaid=linked.reduce((v,r)=>add(v,r.effective_cents),0);
  const paid=linked.length?actuallyPaid:(i.paid===true?invoiceAmount:0);
  const credited=creditNotes.filter(cn=>cn.invoice_id===i.id)
   .reduce((v,cn)=>add(v,amount(cn.amount)),0);
  if(credited>invoiceAmount)throw Error('Credits exceed invoice amount');
  const net=invoiceAmount-credited;
  const status=net===0?'credited':paid>=net?'paid':paid>0?'partial':'unpaid';
  return Object.freeze({invoice_id:i.id,original_cents:invoiceAmount,
   effective_paid_cents:paid,credited_cents:credited,net_cents:net,
   remaining_cents:Math.max(0,net-paid),status});
 });
 return Object.freeze({
  agreed_cents:agreed,accepted_cents:accepted,supplement_cents:supplement,
  credits_cents:reducedCredits+suppReissue,
  original_receipts_cents:allReceiptAmount,adjustment_cents:correctedAmount,
  effective_receipts_cents:effectiveAmount,legacy_cents:legacy,
  received_cents:received,remaining_cents:due,overpaid_cents:overpaid,
  receipts:Object.freeze(effectiveReceipts),invoice_settlements:Object.freeze(invoiceSettlements),
  read_only:true,requires_server_approval:true
 });
}
module.exports={cents,iso,preview,replayReceipt,balanceSnapshot};
