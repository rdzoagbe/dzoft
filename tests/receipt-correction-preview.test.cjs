const test=require('node:test');
const assert=require('node:assert/strict');
const {preview,cents,iso}=require('../tools/receipt-correction-preview.cjs');
const receipt={id:'test-only-receipt',amount:450,received_on:'2026-11-04'};
const base={receipt,reason:'Incorrect receipt entry, verified against bank statement',key:'new-key'};
test('reduce incorrect entry, keep original unchanged',()=>{
 const snap=JSON.stringify(receipt),p=preview({...base,kind:'reduce_error',amount:50});
 assert.equal(p.original_cents,45000);assert.equal(p.new_cents,40000);
 assert.equal(p.read_only,true);assert.equal(JSON.stringify(receipt),snap);
});
test('void remaining effective amount after partial correction',()=>{
 const p=preview({...base,kind:'void_error',previous:[{receipt_id:receipt.id,key:'old',kind:'reduce_error',amount:100}]});
 assert.equal(p.debit_cents,35000);assert.equal(p.new_cents,0);
});
test('over reversal and zero reduction are forbidden',()=>{
 const previous=[{receipt_id:receipt.id,key:'old',kind:'reduce_error',amount:400}];
 assert.throws(()=>preview({...base,kind:'reduce_error',previous,amount:100}),/exceeds/);
 assert.throws(()=>preview({...base,kind:'reduce_error',amount:0}),/exceeds/);
});
test('date correction does not move money and rejects invalid dates',()=>{
 const p=preview({...base,kind:'correct_date',date:'2026-11-05'});
 assert.equal(p.new_cents,45000);assert.equal(p.new_date,'2026-11-05');
 assert.equal(iso('2026-02-30'),false);
 assert.throws(()=>preview({...base,kind:'correct_date',date:'2026-02-30'}),/date/);
 assert.throws(()=>preview({...base,kind:'correct_date',date:'2026-11-04'}),/date/);
});
test('reused idempotency key cannot be counted twice',()=>{
 assert.throws(()=>preview({...base,kind:'reduce_error',amount:5,previous:[{receipt_id:receipt.id,key:'new-key',kind:'reduce_error',amount:10}]}),/Idempotency/);
});
test('wrong receipt, refunds and fractional-cent amounts are rejected',()=>{
 assert.throws(()=>preview({...base,kind:'reduce_error',amount:5,previous:[{receipt_id:'other',key:'older',kind:'reduce_error',amount:10}]}),/Wrong receipt/);
 assert.throws(()=>preview({...base,kind:'refund',amount:50}),/Unsupported/);
 for(const x of [NaN,Infinity,-1,0.001,Number.MAX_SAFE_INTEGER])assert.throws(()=>cents(x),/Invalid/);
});
test('reason mandatory',()=>assert.throws(()=>preview({...base,kind:'void_error',reason:'oops'}),/reason/));
