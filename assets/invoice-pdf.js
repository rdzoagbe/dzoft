(function(global){
 'use strict';
 // Self-contained A4 PDF generator: no third-party scripts, remote fonts or network calls.
 // The numbered invoice comes from the database, not from this client-side PDF function.
 function safe(v){return String(v==null?'':v).replace(/[\u0000-\u001f\u007f]/g,' ').trim();}
 function asciiLine(v){return safe(v).replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"').replace(/[\u2013\u2014]/g,'-').replace(/[\u2022]/g,'-');}
 function money(v){return (Math.round(Number(v)*100)/100).toFixed(2).replace('.',',')+' EUR';}
 function frenchDate(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value)))throw new Error('Invalid invoice date');var a=String(value).split('-');return a[2]+'/'+a[1]+'/'+a[0];}
 function bytes(s){
   var out=[];
   for(var ch of s){var n=ch.codePointAt(0);
     if(n<32&&n!==10&&n!==13)n=32;
     if(n>255)n=({8364:128,338:140,339:156,352:138,353:154,376:159,381:142,382:158,402:131,8218:130,8222:132,8230:133,8224:134,8225:135,710:136,8240:137,8249:139,8250:155,8482:153})[n]||63;
     out.push(n);
   }return out;
 }
 function escapePDF(text){return asciiLine(text).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');}
 function build(data){
   var q=data&&data.quote, r=data&&data.receipt, inv=data&&data.invoice;
   var f=q&&((q.accepted_data||q.data||{}).f)||{};
   if(!q||!r||!inv||!/^F-[0-9]{4}-[0-9]+$/.test(String(inv.num||''))||!/^\d{4}-\d{2}-\d{2}$/.test(String(inv.issuedOn||'')))throw new Error('Missing issued invoice details');
   if(!f.myaddr||!f.cname||!f.caddr)throw new Error('Complete the billing addresses first');
   var total=Number(inv.amt),paid=Number(r.amount);
   if(!Number.isFinite(total)||!Number.isFinite(paid)||total<=0||paid<=0||paid>total||!r.received_on)throw new Error('Invalid invoiced/received amount');
   var payment=data&&data.payment||{};
   var commands=[],y=778;
   function text(value,size,bold){if(y<70)throw new Error('Invoice details exceed one-page PDF limit');commands.push('BT /'+(bold?'F2':'F1')+' '+(size||11)+' Tf 46 '+y+' Td ('+escapePDF(value)+') Tj ET');y-=size>=16?26:17;}
   function wrap(value,max){var words=asciiLine(value).split(/\s+/),lines=[],line='';for(var word of words){if((line+' '+word).trim().length>max&&line){lines.push(line);line='';}while(word.length>max){lines.push(word.slice(0,max));word=word.slice(max);}line=(line?line+' ':'')+word;}if(line)lines.push(line);return lines;}
   function block(value,max){wrap(value,max||84).forEach(x=>text(x,10,false));}
   var taxable=f.novat===false||f.novat==='false', ht=taxable?Math.round(total/1.2*100)/100:total,vat=Math.round((total-ht)*100)/100;
   var payLabel={transfer:'Virement bancaire',cash:'Espèces',card:'Carte bancaire',other:'Autre'}[r.method]||'Paiement';
   text('DZOFT  |  FACTURE',21,true);
   commands.push('0.25 0.32 0.65 RG 1.6 w 46 704 m 548 704 l S 0 0 0 RG');
   text('Numéro : '+inv.num,12,true);
   text('Date d’émission : '+frenchDate(inv.issuedOn),11);
   text('Devis accepté : '+safe(q.numero||''),11);
   y-=8;
   text('PRESTATAIRE',12,true);
   text('Roland Dzoagbe - Entrepreneur individuel',11);
   block(f.myaddr,89);
   text('SIRET : 104 838 727 00014',10);
   text('E-mail : roland.dzoagbe@hotmail.com',10);
   y-=8;
   text('CLIENT',12,true);
   text(f.cname,11,true);
   if(f.corg)block(f.corg,89);
   block(f.caddr,89);
   if(f.ccontact)block(f.ccontact,89);
   y-=8;
   text('DÉSIGNATION',12,true);
   block(inv.n||'Prestation de services numériques',88);
   if(f.desc)block(f.desc,88);
   y-=10;
   if(taxable){text('Montant HT : '+money(ht),11);text('TVA 20 % : '+money(vat),11);}
   text('TOTAL TTC : '+money(total),14,true);
   text('Paiement reçu : '+money(paid),11);
   text('Reçu le '+frenchDate(r.received_on)+' - '+payLabel,10);
   text('Reste à payer sur cette facture : '+money(total-paid),11,true);
   if(Math.round((total-paid)*100)<=0){
     text('FACTURE RÉGLÉE - Aucun paiement supplémentaire à effectuer',10,true);
   }else{
     y-=8;
     text('MOYENS DE RÈGLEMENT',12,true);
     if(payment.holder)block('Titulaire : '+safe(payment.holder),81);
     if(payment.iban)block('IBAN : '+safe(payment.iban),81);
     if(payment.bic)block('BIC : '+safe(payment.bic),81);
     if(payment.bank)block('Banque : '+safe(payment.bank),81);
     block('Référence de paiement : '+inv.num,81);
     if(payment.link){
       var u;try{u=new URL(String(payment.link));}catch(_){u=null;}
       if(u&&u.protocol==='https:'&&u.hostname&&String(payment.link).length<=240){
         var link=String(payment.link);
         block('Paiement en ligne : '+link,77);
         // Offline, payment-link QR. No network calls, no counterfeit Revolut checkout.
         if(typeof global.qrcode==='function'&&y>182){
           try{
             var qr=global.qrcode(0,'M');qr.addData(link);qr.make();
             var count=qr.getModuleCount(),size=92,step=size/(count+8),left=46,bottom=y-size-8;
             commands.push('0.08 0.16 0.32 rg');
             for(var row=0;row<count;row++)for(var col=0;col<count;col++)if(qr.isDark(row,col))
               commands.push((left+(col+4)*step).toFixed(2)+' '+(bottom+(count-row+3)*step).toFixed(2)+' '+step.toFixed(2)+' '+step.toFixed(2)+' re f');
             commands.push('0 0 0 rg');
             y=bottom-13;
           }catch(_){/* Printed payment link remains available if QR cannot be drawn. */}
         }
       }
     }
     if(payment.note)block(safe(payment.note),78);
   }
   y-=10;
   if(!taxable)block('TVA non applicable, article 293 B du CGI.',88);
   if(f.pay){text('Conditions de règlement :',10,true);block(f.pay,88);}
   block('Nature : prestation de services. Facture liée au devis '+safe(q.numero||'')+'.',88);
   // Reminder, not a unilateral revision. Legacy signed agreements keep their original document wording.
   if(q.accepted_terms==='v2026-11'){
     y-=7;
     text('PRIX CONVENU ET CHANGEMENTS',10,true);
     block('Le prix du devis reste fixe pour les prestations convenues. Une demande hors périmètre peut entraîner un supplément ou un délai ajusté, uniquement après acceptation expresse d’un devis complémentaire ou d’un avenant avant intervention et facturation. Les corrections dues au devis signé restent incluses.',87);
   }
   // PDF 1.4 with two embedded standard font references and a single content stream.
   var stream=commands.join('\n')+'\n',streamBytes=bytes(stream);
   var chunks=['%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'], offsets=[0];
   function length(){return chunks.reduce((n,s)=>n+bytes(s).length,0);}
   function object(id,data){offsets[id]=length();chunks.push(id+' 0 obj\n'+data+'\nendobj\n');}
   object(1,'<< /Type /Catalog /Pages 2 0 R >>');
   object(2,'<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
   object(3,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>');
   object(4,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
   object(5,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
   object(6,'<< /Length '+streamBytes.length+' >>\nstream\n'+stream+'endstream');
   var xref=length();chunks.push('xref\n0 7\n0000000000 65535 f \n');
   for(var i=1;i<=6;i++)chunks.push(String(offsets[i]).padStart(10,'0')+' 00000 n \n');
   chunks.push('trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n');
   return new Blob([Uint8Array.from(bytes(chunks.join('')))],{type:'application/pdf'});
 }
 global.DzoftInvoicePdf={build:build};
})(window);
