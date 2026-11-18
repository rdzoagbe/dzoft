const test=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'), path=require('node:path'), vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../admin/suivi.html'),'utf8');
const start=source.indexOf('function sendInvoiceDialog(x, fresh){');
const end=source.indexOf('function mailInvoice(x, b){',start);
const dialog=source.slice(start,end);
test('invoice dialog prepares drafts but never queues, marks sent, or writes invoices',()=>{
 assert.ok(start>0&&end>start);
 assert.match(dialog,/data-outlook/);
 assert.match(dialog,/data-wa-open/);
 assert.match(dialog,/data-pdf/);
 assert.match(dialog,/data-recipient/);
 assert.match(dialog,/data-email-body/);
 assert.match(dialog,/data-subject/);
 assert.match(dialog,/openHotmail\(to,subject,message\)/);
 assert.match(dialog,/wa\.me/);
 assert.match(dialog,/sb\.files\.link\(x\.file,true\)/);
 assert.doesNotMatch(dialog,/mailInvoice\(|sb\.fn\(|sb\.rpc\(|save\(|emailAt\s*=|attachPdf\s*=|process-notification-outbox/);
});
test('invoice buttons route through the manual send dialog, not the automatic mail queue',()=>{
 assert.match(source,/data-a="invoice-send"/);
 assert.match(source,/data-a="invoice-email'\) return sendInvoiceDialog\(x, false\)/);
 assert.match(source,/data-a === 'invoice-send'\) return sendInvoiceDialog\(x, false\)/);
 assert.match(source,/Préparer \(Outlook ou WhatsApp\)/);
});
test('Outlook draft uses saved client email, asks for explicit send, and cannot auto-attach PDF',()=>{
 assert.match(source,/var recipient=mailTo\(\)/);
 assert.match(source,/https:\/\/outlook\.live\.com\/mail\/0\/deeplink\/compose\?to=/);
 assert.match(dialog,/Le PDF ne se joint pas automatiquement/);
 assert.match(dialog,/DZOFT ne sait pas si vous avez envoyé le message/);
 const scripts=[...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
 for(const m of scripts)if(m[1].trim())new vm.Script(m[1]);
});
