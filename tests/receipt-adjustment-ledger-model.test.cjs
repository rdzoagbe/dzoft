'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {balanceSnapshot,preview}=require('../tools/receipt-correction-preview.cjs');

// These amounts and identifiers are ENTIRELY FICTIONAL: do not use client data in a public test.
const base=()=>({
 acceptedTotal:1200,asOfDate:'2026-11-20',
 receipts:[
  {id:'fake-cash',invoice_id:'invoice-cash',amount:275,received_on:'2026-11-04'},
  {id:'fake-bank',invoice_id:'invoice-bank',amount:125,received_on:'2026-11-14'}
 ],
 invoices:[
  {id:'invoice-cash',amt:275,paid:true},
  {id:'invoice-bank',amt:125,paid:true},
  {id:'invoice-final',amt:800,paid:false}
 ],
 adjustments:[],creditNotes:[]
});
const reduce=(amount=25,key='reduce-1')=>({receipt_id:'fake-cash',key,kind:'reduce_error',amount});
const voidRemaining=(amount,key='void-1')=>({receipt_id:'fake-cash',key,kind:'void_error',amount});
const dateFix=(date='2026-11-05',key='date-1')=>({receipt_id:'fake-cash',key,kind:'correct_date',date});

test('untouched synthetic contract: €1,200 agreed, €400 received, €800 outstanding',()=>{
 const s=balanceSnapshot(base());
 assert.deepEqual([s.agreed_cents,s.original_receipts_cents,s.effective_receipts_cents,s.legacy_cents,s.received_cents,s.remaining_cents],
  [120000,40000,40000,0,40000,80000]);
 assert.equal(s.invoice_settlements[0].status,'paid');
 assert.equal(s.invoice_settlements[2].status,'unpaid');
 assert.equal(s.read_only,true);
});

test('mistaken €25 entry reduction changes effective receipt without rewriting source',()=>{
 const s=balanceSnapshot({...base(),adjustments:[reduce()]});
 assert.deepEqual([s.adjustment_cents,s.receipts[0].original_cents,s.receipts[0].effective_cents,s.received_cents,s.remaining_cents],
  [2500,27500,25000,37500,82500]);
 assert.equal(s.invoice_settlements[0].status,'partial');
 assert.equal(s.invoice_settlements[0].remaining_cents,2500);
 assert.equal(s.legacy_cents,0);
});

test('void the remaining €250 after reducing €25; never revive linked paid flag',()=>{
 const s=balanceSnapshot({...base(),adjustments:[reduce(),voidRemaining(250)]});
 assert.equal(s.receipts[0].effective_cents,0);
 assert.equal(s.received_cents,12500);
 assert.equal(s.remaining_cents,107500);
 assert.equal(s.invoice_settlements[0].status,'unpaid');
 assert.equal(s.invoice_settlements[0].effective_paid_cents,0);
 assert.equal(s.legacy_cents,0);
});

test('historical receipt date stays visible but financial totals do not move',()=>{
 const s=balanceSnapshot({...base(),adjustments:[dateFix()]});
 assert.deepEqual([s.received_cents,s.remaining_cents],[40000,80000]);
 assert.equal(s.receipts[0].original_date,'2026-11-04');
 assert.equal(s.receipts[0].effective_date,'2026-11-05');
});

test('impossible or future dates fail a deterministic as-of-date check',()=>{
 assert.throws(()=>balanceSnapshot({...base(),adjustments:[dateFix('2026-02-30')]}),/date/);
 assert.throws(()=>balanceSnapshot({...base(),adjustments:[dateFix('2026-11-21')]}),/date/);
 assert.throws(()=>preview({
  receipt:base().receipts[0],key:'date-check',kind:'correct_date',
  reason:'Verified against the bank statement',date:'2026-11-21',asOfDate:'2026-11-20'
 }),/date/);
});

test('cross-receipt adjustments, double IDs and reused request keys fail closed',()=>{
 assert.throws(()=>balanceSnapshot({...base(),adjustments:[{...reduce(),receipt_id:'outside-project'}]}),/unknown receipt/);
 assert.throws(()=>balanceSnapshot({...base(),adjustments:[reduce(),{...reduce(),receipt_id:'fake-bank'}]}),/Duplicate adjustment request key/);
 assert.throws(()=>balanceSnapshot({...base(),receipts:[...base().receipts,base().receipts[0]]}),/duplicate receipt/);
});

test('a partial debit or a void cannot exceed the effective confirmed amount',()=>{
 assert.throws(()=>balanceSnapshot({...base(),adjustments:[reduce(250),voidRemaining(50)]}),/exceeds/);
 assert.throws(()=>balanceSnapshot({...base(),adjustments:[reduce(275),voidRemaining(1)]}),/exceeds/);
 assert.throws(()=>balanceSnapshot({...base(),adjustments:[reduce(0)]}),/exceeds/);
});

test('credit notes reduce contract debt but do not remove cash from the ledger',()=>{
 const s=balanceSnapshot({...base(),creditNotes:[{invoice_id:'invoice-final',amount:100,effect:'reduce',invoice_kind:'base'}]});
 assert.deepEqual([s.agreed_cents,s.received_cents,s.remaining_cents],[110000,40000,70000]);
 assert.equal(s.invoice_settlements[2].net_cents,70000);
 assert.equal(s.invoice_settlements[2].status,'unpaid');
});

test('a supplement cancelled for reissue is removed from the agreed amount once',()=>{
 const data=base();data.invoices.push({id:'fake-extra',amt:180,change:'fake-signed-change',paid:false});
 const before=balanceSnapshot(data);
 assert.deepEqual([before.agreed_cents,before.remaining_cents],[138000,98000]);
 const after=balanceSnapshot({...data,creditNotes:[{invoice_id:'fake-extra',amount:180,effect:'reissue',invoice_kind:'supplement'}]});
 assert.deepEqual([after.agreed_cents,after.remaining_cents],[120000,80000]);
 assert.equal(after.invoice_settlements.find(x=>x.invoice_id==='fake-extra').status,'credited');
});

test('only historical paid invoices with no receipt ledger link count as legacy received',()=>{
 const data=base();data.invoices.push({id:'fake-external',amt:60,paid:true});
 const before=balanceSnapshot(data);
 assert.deepEqual([before.legacy_cents,before.received_cents,before.remaining_cents],[6000,46000,74000]);
 const after=balanceSnapshot({...data,adjustments:[reduce(275)]});
 assert.equal(after.legacy_cents,6000);
 assert.equal(after.received_cents,18500);
});

test('overpayments remain visible, while amount to collect never goes negative',()=>{
 const data=base();data.acceptedTotal=350;
 const s=balanceSnapshot(data);
 assert.deepEqual([s.received_cents,s.remaining_cents,s.overpaid_cents],[40000,0,5000]);
});

test('refund, short reason and repeated idempotency key are rejected',()=>{
 const {receipts,asOfDate}=base();
 const opt={receipt:receipts[0],reason:'Verified against bank records',key:'replayed-key',asOfDate};
 assert.throws(()=>preview({...opt,kind:'refund',amount:20}),/Unsupported/);
 assert.throws(()=>preview({...opt,kind:'void_error',reason:'oops'}),/reason/);
 assert.throws(()=>preview({...opt,kind:'reduce_error',amount:25,previous:[reduce(100,'replayed-key')]}),/Idempotency/);
});

test('original invoices/receipts and their immutable copies never change in preview',()=>{
 const data=base(),before=JSON.stringify(data);
 const s=balanceSnapshot({...data,adjustments:[reduce()]});
 assert.equal(JSON.stringify(data),before);
 assert.ok(Object.isFrozen(s));
 assert.ok(Object.isFrozen(s.receipts));
 assert.ok(Object.isFrozen(s.receipts[0]));
 assert.equal(data.invoices[0].paid,true);
 assert.equal(data.receipts[0].amount,275);
});

test('offline model contains no live API or network clients',()=>{
 const src=fs.readFileSync(path.join(__dirname,'../tools/receipt-correction-preview.cjs'),'utf8');
 assert.doesNotMatch(src,/\bfetch\s*\(|https?:\/\/|XMLHttpRequest|require\(['"](@supabase|pg)['"]/i);
 const owner=fs.readFileSync(path.join(__dirname,'../admin/suivi.html'),'utf8');
 const client=fs.readFileSync(path.join(__dirname,'../espace/index.html'),'utf8');
 assert.doesNotMatch(owner,/receipt-correction-preview\.cjs/);
 assert.doesNotMatch(client,/receipt-correction-preview\.cjs/);
});
