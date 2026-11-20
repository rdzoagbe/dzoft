'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {balanceSnapshot,preview,replayReceipt}=require('../tools/receipt-correction-preview.cjs');

const baseline=()=>({
 acceptedTotal:1500,asOfDate:'2026-11-20',
 receipts:[
  {id:'receipt-cash',invoice_id:'deposit-cash',amount:450,received_on:'2026-11-04'},
  {id:'receipt-transfer',invoice_id:'deposit-transfer',amount:350,received_on:'2026-11-14'}
 ],
 invoices:[
  {id:'deposit-cash',amt:450,paid:true},
  {id:'deposit-transfer',amt:350,paid:true},
  {id:'final',amt:700,paid:false}
 ],
 adjustments:[],creditNotes:[]
});
const reduction=(amount=50,key='reduce-1')=>({receipt_id:'receipt-cash',key,kind:'reduce_error',amount});
const voidRemain=(amount,key='void-1')=>({receipt_id:'receipt-cash',key,kind:'void_error',amount});
const dateFix=(date='2026-11-05',key='date-1')=>({receipt_id:'receipt-cash',key,kind:'correct_date',date});

test('unchanged historical state: €1,500 agreed, €800 verified and €700 remaining',()=>{
 const actual=balanceSnapshot(baseline());
 assert.equal(actual.agreed_cents,150000);
 assert.equal(actual.original_receipts_cents,80000);
 assert.equal(actual.effective_receipts_cents,80000);
 assert.equal(actual.legacy_cents,0,'historic paid flags linked to ledger may NOT double count');
 assert.equal(actual.received_cents,80000);
 assert.equal(actual.remaining_cents,70000);
 assert.equal(actual.overpaid_cents,0);
 assert.equal(actual.invoice_settlements[0].status,'paid');
 assert.equal(actual.invoice_settlements[2].status,'unpaid');
 assert.equal(actual.read_only,true);
});

test('reduce a mistaken entry: revised cash €400, received €750, collect €750',()=>{
 const actual=balanceSnapshot({...baseline(),adjustments:[reduction()]});
 assert.equal(actual.adjustment_cents,5000);
 assert.equal(actual.receipts[0].original_cents,45000);
 assert.equal(actual.receipts[0].effective_cents,40000);
 assert.equal(actual.received_cents,75000);
 assert.equal(actual.remaining_cents,75000);
 assert.deepEqual(
  [actual.invoice_settlements[0].status,actual.invoice_settlements[0].remaining_cents],
  ['partial',5000]
 );
 assert.equal(actual.legacy_cents,0);
});

test('void the remaining value of a previously reduced mistaken entry',()=>{
 const actual=balanceSnapshot({...baseline(),adjustments:[reduction(),voidRemain(400)]});
 assert.equal(actual.receipts[0].effective_cents,0);
 assert.equal(actual.received_cents,35000);
 assert.equal(actual.remaining_cents,115000);
 assert.equal(actual.invoice_settlements[0].status,'unpaid');
 assert.equal(actual.invoice_settlements[0].effective_paid_cents,0);
 assert.equal(actual.legacy_cents,0,'voiding does not resuscitate the paid JSON flag');
});

test('a date correction has no monetary effect and the old timestamp stays visible',()=>{
 const actual=balanceSnapshot({...baseline(),adjustments:[dateFix()]});
 assert.equal(actual.received_cents,80000);
 assert.equal(actual.remaining_cents,70000);
 assert.equal(actual.receipts[0].original_date,'2026-11-04');
 assert.equal(actual.receipts[0].effective_date,'2026-11-05');
});
test('impossible or future receipt dates are rejected with an explicit valuation date',()=>{
 assert.throws(()=>balanceSnapshot({...baseline(),adjustments:[dateFix('2026-02-30')]}),/date/);
 assert.throws(()=>balanceSnapshot({...baseline(),adjustments:[dateFix('2026-11-21')]}),/date/);
 assert.throws(()=>preview({
  receipt:baseline().receipts[0],key:'date-check',kind:'correct_date',
  reason:'Bank statement dated November 21st',date:'2026-11-21',asOfDate:'2026-11-20'
 }),/date/);
});

test('all active adjustments must refer to a listed receipt and carry globally unique request keys',()=>{
 assert.throws(()=>balanceSnapshot({...baseline(),adjustments:[{...reduction(),receipt_id:'different-project'}]}),/unknown receipt/);
 assert.throws(()=>balanceSnapshot({...baseline(),adjustments:[reduction(),{...reduction(),receipt_id:'receipt-transfer'}]}),/Duplicate adjustment request key/);
 assert.throws(()=>balanceSnapshot({...baseline(),receipts:[...baseline().receipts,baseline().receipts[0]]}),/duplicate receipt/);
});

test('combined reductions cannot reverse more than the originally confirmed receipt',()=>{
 assert.throws(()=>balanceSnapshot({...baseline(),adjustments:[reduction(400),voidRemain(75)]}),/exceeds/);
 assert.throws(()=>balanceSnapshot({...baseline(),adjustments:[reduction(450),voidRemain(1)]}),/exceeds/);
 assert.throws(()=>balanceSnapshot({...baseline(),adjustments:[reduction(0)]}),/exceeds/);
});

test('credit notes change contract value, not the amount of money genuinely received',()=>{
 const actual=balanceSnapshot({...baseline(),creditNotes:[{invoice_id:'final',amount:100,effect:'reduce',invoice_kind:'base'}]});
 assert.equal(actual.agreed_cents,140000);
 assert.equal(actual.received_cents,80000);
 assert.equal(actual.remaining_cents,60000);
 assert.equal(actual.invoice_settlements[2].net_cents,60000);
 assert.equal(actual.invoice_settlements[2].status,'unpaid');
});

test('supplement reissue credit does not count as approved extra work twice',()=>{
 const input=baseline();
 input.invoices.push({id:'extra',amt:200,change:'signed-extra-request',paid:false});
 const initial=balanceSnapshot(input);
 assert.equal(initial.agreed_cents,170000);
 assert.equal(initial.remaining_cents,90000);
 const updated=balanceSnapshot({...input,creditNotes:[{invoice_id:'extra',amount:200,effect:'reissue',invoice_kind:'supplement'}]});
 assert.equal(updated.agreed_cents,150000);
 assert.equal(updated.remaining_cents,70000);
 assert.equal(updated.invoice_settlements.find(x=>x.invoice_id==='extra').status,'credited');
});

test('only orphaned historic paid invoices count as legacy received',()=>{
 const input=baseline();
 input.invoices.push({id:'historic-external',amt:120,paid:true});
 const actual=balanceSnapshot(input);
 assert.equal(actual.legacy_cents,12000);
 assert.equal(actual.received_cents,92000);
 assert.equal(actual.remaining_cents,58000);
 const zeroed=balanceSnapshot({...input,adjustments:[reduction(450)]});
 assert.equal(zeroed.legacy_cents,12000,'linked invoice must not be relabelled as legacy');
 assert.equal(zeroed.received_cents,47000);
});

test('overpayment is separate from the remaining collection amount',()=>{
 const input=baseline();
 input.acceptedTotal=700;
 const actual=balanceSnapshot(input);
 assert.equal(actual.received_cents,80000);
 assert.equal(actual.remaining_cents,0);
 assert.equal(actual.overpaid_cents,10000);
});

test('refunds, missing reasons and repeated preview idempotency keys are blocked',()=>{
 const input=baseline(),base={receipt:input.receipts[0],reason:'Verified against the bank statement',key:'request-one',asOfDate:input.asOfDate};
 assert.throws(()=>preview({...base,kind:'refund',amount:100}),/Unsupported/);
 assert.throws(()=>preview({...base,kind:'void_error',reason:'bad'}),/reason/);
 assert.throws(()=>preview({...base,kind:'reduce_error',amount:50,previous:[reduction(100,'request-one')]}),/Idempotency/);
});

test('input data and original invoices/receipts remain untouched',()=>{
 const input=baseline(),before=JSON.stringify(input);
 const model=balanceSnapshot({...input,adjustments:[reduction()]});
 assert.equal(JSON.stringify(input),before);
 assert.ok(Object.isFrozen(model));
 assert.ok(Object.isFrozen(model.receipts));
 assert.ok(Object.isFrozen(model.receipts[0]));
 assert.equal(input.invoices[0].paid,true);
 assert.equal(input.receipts[0].amount,450);
});

test('the preview is offline and is NOT reachable from the currently deployed Admin/Client UI',()=>{
 const src=fs.readFileSync(path.join(__dirname,'../tools/receipt-correction-preview.cjs'),'utf8');
 assert.doesNotMatch(src,/fetch\s*\(|https?:\/\/|supabase|XMLHttpRequest|require\(['"](@supabase|pg)['"]/i);
 const admin=fs.readFileSync(path.join(__dirname,'../admin/suivi.html'),'utf8');
 const client=fs.readFileSync(path.join(__dirname,'../espace/index.html'),'utf8');
 assert.doesNotMatch(admin,/receipt-correction-preview\.cjs/);
 assert.doesNotMatch(client,/receipt-correction-preview\.cjs/);
});
