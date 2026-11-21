(function(global){
 'use strict';
 // Owner-only invoice print sheet. No network requests, mutations, or automatic email.
 // Number is issued by DZOFT's atomic server-side sequence, or supplied for an already-issued external invoice.
 function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
 function amount(n){return Number(n).toLocaleString('fr-FR',{style:'currency',currency:'EUR'});}
 function date(v){var d=new Date(/^\d{4}-\d{2}-\d{2}$/.test(v)?v+'T12:00:00':v);return isNaN(d)?'':d.toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'});}
 function numeric(n){var x=Number(n);return Number.isFinite(x)&&x>0&&Math.round(x*100)===x*100;}
 function validPaymentLink(value){
   try{var u=new URL(String(value||''));return u.protocol==='https:'&&u.hostname&&String(value).length<=240?u.href:'';}catch(_){return '';}
 }
 function qrSVG(link){
   if(!link||typeof global.qrcode!=='function')return '';
   try{
     var qr=global.qrcode(0,'M');qr.addData(link);qr.make();
     var n=qr.getModuleCount(),out='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+(n+8)+' '+(n+8)+'" width="112" height="112" role="img" aria-label="QR code vers la page de paiement">'+
     '<rect width="100%" height="100%" fill="white"/>';
     for(var row=0;row<n;row++)for(var col=0;col<n;col++)if(qr.isDark(row,col))
       out+='<rect x="'+(col+4)+'" y="'+(row+4)+'" width="1" height="1" fill="#14233f"/>';
     return out+'</svg>';
   }catch(_){return '';}
 }
 function open(data){
   var quote=data&&data.quote, receipt=data&&data.receipt, invoice=data&&data.invoice;
   var f=((quote&&(quote.accepted_data||quote.data))||{}).f||{};
   var number=String(invoice&&invoice.num||'').trim();
   var amt=Number(invoice&&invoice.amt), paid=Number(receipt&&receipt.amount);
   if(!quote||!receipt||!number||number.length>40||!numeric(amt)||!numeric(paid)||paid>amt){
     throw new Error('Vérifiez le numéro, le montant et le paiement avant de préparer la facture.');
   }
   var seller=String(f.myaddr||'').trim(), buyer=String(f.cname||'').trim(), address=String(f.caddr||'').trim();
   if(!seller||!buyer||!address){
     throw new Error('Complétez le nom et l’adresse du client et votre adresse professionnelle sur le devis accepté avant de créer le PDF.');
   }
   var now=new Date(), issued=invoice.issuedOn && /^\d{4}-\d{2}-\d{2}$/.test(invoice.issuedOn)?invoice.issuedOn:[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
   var taxable=f.novat===false||f.novat==='false';
   var ht=taxable?Math.round(amt/1.2*100)/100:amt, vat=Math.round((amt-ht)*100)/100;
   var title=invoice.label||'Facture d’acompte', remaining=Math.round((amt-paid)*100)/100;
   var payment=data&&data.payment||{},paylink=validPaymentLink(payment.link||'');
   var windowName='DZOFT — facture '+number, w=data&&data.popup||global.open('','_blank');
   if(!w)throw new Error('Autorisez les fenêtres contextuelles pour ouvrir la facture et l’enregistrer en PDF.');
   var body='<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
    '<title>'+esc(windowName)+'</title><style>'+
    '@page{size:A4;margin:16mm}*{box-sizing:border-box}body{font:14px/1.6 system-ui,Arial,sans-serif;margin:0;color:#14233f;background:#f1f4fa}'+
    '.actions{max-width:840px;margin:16px auto;background:#fff8e7;padding:16px;border:1px solid #ecd6a3;border-radius:10px;font-size:13px}.actions button{padding:10px 16px;border:0;background:#243d88;color:#fff;border-radius:8px;font-weight:700;cursor:pointer}'+
    '.sheet{max-width:840px;min-height:1050px;background:#fff;padding:48px 56px;margin:18px auto;box-shadow:0 8px 40px #14233f1a}h1{font-size:26px;letter-spacing:.07em;margin:0;color:#25438b}h2{font-size:16px;margin:0 0 12px}'+
    '.top,.parties,.row{display:flex;justify-content:space-between;gap:28px}.top{border-bottom:3px solid #4f65c6;padding-bottom:28px;align-items:start}.sub{color:#52627c}.top p{margin:3px 0;font-size:12px}.parties{margin-top:32px}.party{width:50%;overflow-wrap:anywhere}.party h2{color:#384da6;font-size:13px;text-transform:uppercase}.party p{margin:4px 0;white-space:pre-wrap}'+
    'table{width:100%;border-collapse:collapse;margin-top:32px}th{text-align:left;color:#536078;font-size:12px;border-bottom:2px solid #dee5f2;padding:10px 8px}td{border-bottom:1px solid #e5eaf2;padding:12px 8px}td:last-child,th:last-child{text-align:right}.totals{margin:30px 0 26px auto;max-width:340px}.totals .row{padding:7px 0;border-bottom:1px solid #e2e8f3}.totals .row:last-child{font-size:17px;font-weight:750;color:#253f81}'+
    '.settled{padding:18px;border-radius:10px;background:#f3f7ff;margin-top:30px}.settled strong{color:#184c34}.foot{border-top:1px solid #dae3ef;margin-top:36px;padding-top:14px;color:#52627c;font-size:12px}'+
    '.pay-info{margin-top:30px;padding:22px;background:#f8f9fd;border:1px solid #e0e6f1;border-radius:13px}.pay-info h2{color:#233b7e;margin:0 0 10px}.pay-columns{display:flex;gap:22px;flex-wrap:wrap}.pay-bank{flex:1;min-width:220px}.pay-qr{flex:0 0 140px;text-align:center}.pay-qr svg{display:block;margin:auto;max-width:100%;border-radius:6px}.pay-info p{margin:5px 0;font-size:12px;overflow-wrap:anywhere}.pay-info a{color:#243d88;overflow-wrap:anywhere}.pay-info .pay-flag{font-size:11px;color:#636d83;margin-top:9px}'+
    '@media(max-width:700px){.sheet{padding:22px;min-height:0}.top,.parties{display:block}.party{width:100%}.party+ .party{margin-top:20px}}@media print{body{background:#fff}.actions{display:none}.sheet{margin:0;padding:0;box-shadow:none;min-height:0}}'+
    '</style></head><body><div class="actions"><strong>Vérification avant émission.</strong> Numéro et date doivent correspondre à votre séquence de facturation. Vérifiez les mentions légales, la TVA, le contexte de la prestation et les conditions contractuelles. Ce document n’est pas automatiquement archivé dans DZOFT. '+
    '<button type="button" onclick="window.print()">Imprimer / Enregistrer en PDF</button></div><main class="sheet">'+
    '<header class="top"><div><strong style="font-size:23px">DZOFT</strong><p>Roland Dzoagbe · Entrepreneur individuel</p><p>SIRET 104 838 727 00014</p></div><div style="text-align:right"><h1>FACTURE</h1><p><b>N° '+esc(number)+'</b></p><p>Émise le '+esc(date(issued))+'</p><p>Devis '+esc(quote.numero||'')+'</p></div></header>'+
    '<section class="parties"><div class="party"><h2>Émetteur</h2><p><b>Roland Dzoagbe</b></p><p>'+esc(seller)+'</p><p>roland.dzoagbe@hotmail.com</p></div>'+
    '<div class="party"><h2>Facturé à</h2><p><b>'+esc(buyer)+'</b></p><p>'+esc(f.corg||'')+'</p><p>'+esc(address)+'</p><p>'+esc(f.ccontact||'')+'</p></div></section>'+
    '<table><thead><tr><th>Prestation / désignation</th><th>Montant</th></tr></thead><tbody><tr><td><b>'+esc(title)+'</b><div class="sub">Sur devis accepté n° '+esc(quote.numero||'')+' — '+esc(String(f.desc||'').slice(0,240))+'</div></td><td>'+esc(amount(amt))+'</td></tr></tbody></table>'+
    '<section class="totals">'+(taxable?'<div class="row"><span>HT</span><span>'+esc(amount(ht))+'</span></div><div class="row"><span>TVA 20 %</span><span>'+esc(amount(vat))+'</span></div>':'')+
    '<div class="row"><span>Total de la facture</span><span>'+esc(amount(amt))+'</span></div></section>'+
    '<div class="settled"><div class="row"><span>Règlement reçu le '+esc(date(receipt.received_on))+'</span><strong>'+esc(amount(paid))+'</strong></div>'+
    '<p style="margin:8px 0 0">Mode : '+esc(({transfer:'Virement bancaire',cash:'Espèces',card:'Carte',other:'Autre'})[receipt.method]||receipt.method)+'</p>'+
    '<div class="row" style="margin-top:15px;border-top:1px solid #dce5f1;padding-top:10px"><b>Reste dû sur cette facture</b><b>'+esc(amount(remaining))+'</b></div></div>'+
    (remaining>0?
      '<section class="pay-info"><h2>Comment régler le solde</h2><div class="pay-columns"><div class="pay-bank">'+
      (payment.holder?'<p><b>Titulaire :</b> '+esc(payment.holder)+'</p>':'')+
      (payment.bank?'<p><b>Banque :</b> '+esc(payment.bank)+'</p>':'')+
      (payment.iban?'<p><b>IBAN :</b> '+esc(payment.iban)+'</p>':'')+
      (payment.bic?'<p><b>BIC :</b> '+esc(payment.bic)+'</p>':'')+
      '<p><b>Référence :</b> '+esc(number)+'</p>'+
      (paylink?'<p><b>Paiement en ligne :</b> <a href="'+esc(paylink)+'" target="_blank" rel="noopener noreferrer">'+esc(paylink)+'</a></p>':'')+
      (payment.note?'<p>'+esc(payment.note)+'</p>':'')+
      '</div>'+(paylink&&qrSVG(paylink)?'<div class="pay-qr">'+qrSVG(paylink)+'<p>Scannez pour ouvrir la page de paiement</p></div>':'')+'</div>'+
      (paylink?'<p class="pay-flag">Ce lien ouvre votre page de paiement configurée. Vérifiez le montant et précisez la référence de facture avant de régler.</p>':'')+'</section>'
      :'<section class="pay-info"><h2>Facture acquittée</h2><p>Aucun paiement supplémentaire n’est dû sur cette facture.</p></section>')+
    '<footer class="foot">'+(taxable?'TVA calculée à 20 %. Vérifiez le régime et les mentions fiscales applicables avant émission.':'TVA non applicable, article 293 B du CGI.')+
    '<p>Facture relative au devis '+esc(quote.numero||'')+'. Les paiements reçus sont affichés séparément du solde du projet.</p>'+
    (quote.accepted_terms==='v2026-11'||quote.accepted_terms==='v2026-12'?'<p><b>Prix convenu et demandes complémentaires :</b> le prix initial couvre uniquement les prestations du devis accepté. Toute demande hors périmètre fera l’objet d’un devis complémentaire ou avenant accepté expressément avant toute facturation supplémentaire. Les corrections dues au devis initial restent incluses.</p>':'')+'</footer>'+
    '</main></body></html>';
   w.document.open();w.document.write(body);w.document.close();w.focus();
   return true;
 }
 global.DzoftInvoicePreview={open:open};
})(window);
