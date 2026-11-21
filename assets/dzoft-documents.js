(function(global){
'use strict';
/* DZOFT official documents as PDF (17 Nov 2026): the signed quote (contract), each signed extra-work proposal
   and a receipt for each recorded payment. They are drawn in the browser from what is already recorded
   (signature, proposal, payments): nothing is written, nothing is sent, no new record is created.
   Invoices keep their own archived PDF (assets/invoice-pdf.js): a payment receipt never replaces an invoice. */

// ---------- minimal PDF writer: A4, Helvetica (WinAnsi), automatic page breaks ----------
var WINANSI={8364:128,8218:130,402:131,8222:132,8230:133,8224:134,8225:135,710:136,8240:137,352:138,8249:139,338:140,381:142,
 8216:145,8217:146,8220:147,8221:148,8226:149,8211:150,8212:151,732:152,8482:153,353:154,8250:155,339:156,382:158,376:159,8239:160,8201:32,8202:32};
function bytes(s){var out=[];for(var ch of String(s)){var n=ch.codePointAt(0);if(n<32&&n!==10&&n!==13)n=32;if(n>255)n=WINANSI[n]||63;out.push(n);}return out;}
function clean(v){return String(v==null?'':v).replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g,' ').replace(/\s+\n/g,'\n').trim();}
function pdfString(v){return clean(v).replace(/\n/g,' ').replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');}
function money(v){var n=Math.round(Number(v||0)*100)/100;return n.toFixed(2).replace('.',',').replace(/\B(?=(\d{3})+(?!\d))/g,' ')+' €';}
function frDate(v){if(!v)return '';var d=new Date(String(v).length===10?v+'T12:00:00':v);if(isNaN(d))return '';return d.toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'});}
function frDateTime(v){if(!v)return '';var d=new Date(v);if(isNaN(d))return '';return d.toLocaleString('fr-FR',{day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Paris'});}

function Doc(kind,ref){
 var pages=[],cmd=[],y=0,L=46,R=549;
 function page(){if(cmd.length)pages.push(cmd);cmd=[];y=790;
  cmd.push('BT /F2 9 Tf '+L+' 812 Td ('+pdfString('DZOFT  |  '+kind+(ref?'  '+ref:''))+') Tj ET');
  cmd.push('0.26 0.38 0.93 RG 0.8 w '+L+' 804 m '+R+' 804 l S 0 0 0 RG');}
 function need(h){if(y-h<70)page();}
 function wrap(v,size,width){var max=Math.max(10,Math.floor((width||(R-L))/(size*0.5))),lines=[];
  clean(v).split('\n').forEach(function(par){var line='';par.split(/\s+/).forEach(function(w){if(!w)return;
   while(w.length>max){if(line){lines.push(line);line='';}lines.push(w.slice(0,max));w=w.slice(max);}
   if((line?line+' '+w:w).length>max){lines.push(line);line=w;}else line=line?line+' '+w:w;});lines.push(line);});
  return lines;}
 function put(x,v,size,bold,color){cmd.push((color||'0 0 0')+' rg BT /'+(bold?'F2':'F1')+' '+size+' Tf '+x+' '+y+' Td ('+pdfString(v)+') Tj ET 0 0 0 rg');}
 var api={
  title:function(v){need(40);y-=8;put(L,v,19,true,'0.04 0.06 0.13');y-=26;},
  h:function(v){need(34);y-=10;put(L,String(v).toUpperCase(),10,true,'0.20 0.28 0.84');y-=6;cmd.push('0.85 0.88 0.96 RG 0.6 w '+L+' '+y+' m '+R+' '+y+' l S 0 0 0 RG');y-=14;},
  text:function(v,o){o=o||{};var size=o.size||10;wrap(v,size,o.width).forEach(function(line){need(size+5);put(L+(o.indent||0),line,size,o.bold,o.color);y-=size+4;});},
  // Label on the left, value on the right (amounts), wrapping the label.
  row:function(label,value,o){o=o||{};var size=o.size||10,lines=wrap(label,size,R-L-140);need(lines.length*(size+4)+2);
   lines.forEach(function(line,i){put(L+(o.indent||0),line,size,o.bold);if(i===0&&value!=null&&value!==''){var w=String(value).length*size*0.52;put(Math.max(L+200,R-w),String(value),size,o.bold);}y-=size+4;});},
  kv:function(label,value){if(value==null||value==='')return;api.text(label+' : '+value,{size:10});},
  gap:function(n){y-=n||8;},
  rule:function(){need(10);y-=4;cmd.push('0.85 0.88 0.96 RG 0.6 w '+L+' '+y+' m '+R+' '+y+' l S 0 0 0 RG');y-=10;},
  box:function(lines){var all=[];lines.forEach(function(l){all=all.concat(wrap(l,10,R-L-20));});var h=all.length*14+12;need(h+6);var top=y+4;
   cmd.push('0.95 0.97 1 rg '+L+' '+(top-h)+' '+(R-L)+' '+h+' re f 0.26 0.38 0.93 RG 0.8 w '+L+' '+(top-h)+' '+(R-L)+' '+h+' re S 0 0 0 RG 0 0 0 rg');
   y-=10;all.forEach(function(t){put(L+10,t,10,false);y-=14;});y=top-h-10;},
  blob:function(){
   if(cmd.length)pages.push(cmd);
   var total=pages.length,generated='Document généré le '+frDateTime(new Date().toISOString())+' à partir des données enregistrées.';
   pages.forEach(function(p,i){
    p.push('0.45 0.48 0.58 rg BT /F1 8 Tf '+L+' 40 Td ('+pdfString('DZOFT · Roland Dzoagbe, entrepreneur individuel · SIRET 104 838 727 00014 · roland.dzoagbe@hotmail.com')+') Tj ET');
    p.push('BT /F1 8 Tf '+L+' 28 Td ('+pdfString(generated)+') Tj ET');
    p.push('BT /F1 8 Tf 505 28 Td ('+pdfString('Page '+(i+1)+' / '+total)+') Tj ET 0 0 0 rg');
   });
   var chunks=['%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'],offsets=[0];
   function len(){return chunks.reduce(function(n,c){return n+bytes(c).length;},0);}
   function obj(id,body){offsets[id]=len();chunks.push(id+' 0 obj\n'+body+'\nendobj\n');}
   var kids=pages.map(function(_,i){return (5+i*2)+' 0 R';}).join(' ');
   obj(1,'<< /Type /Catalog /Pages 2 0 R >>');
   obj(2,'<< /Type /Pages /Kids [ '+kids+' ] /Count '+total+' >>');
   obj(3,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
   obj(4,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
   pages.forEach(function(p,i){var pid=5+i*2,sid=pid+1,stream=p.join('\n')+'\n';
    obj(pid,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents '+sid+' 0 R >>');
    obj(sid,'<< /Length '+bytes(stream).length+' >>\nstream\n'+stream+'endstream');});
   var last=4+total*2,xref=len();
   chunks.push('xref\n0 '+(last+1)+'\n0000000000 65535 f \n');
   for(var id=1;id<=last;id++)chunks.push(String(offsets[id]).padStart(10,'0')+' 00000 n \n');
   chunks.push('trailer\n<< /Size '+(last+1)+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n');
   return new Blob([Uint8Array.from(bytes(chunks.join('')))],{type:'application/pdf'});
  }
 };
 page();
 return api;
}

function provider(doc,f){
 doc.h('Prestataire');
 doc.text('Roland Dzoagbe, entrepreneur individuel (DZOFT)',{bold:true});
 doc.text('SIRET 104 838 727 00014');
 doc.text('07 82 88 46 46 · roland.dzoagbe@hotmail.com');
 if(f&&f.myaddr)doc.text(f.myaddr);
}
function customer(doc,f){
 doc.h('Client');
 doc.text(f.cname||'Client',{bold:true});
 if(f.corg)doc.text(f.corg);if(f.caddr)doc.text(f.caddr);if(f.ccontact)doc.text(f.ccontact);
}
function quoteData(q){return (q&&(q.accepted_data||q.data))||{};}
function amounts(d){
 var f=d.f||{},once=0,month=0,opt=0;
 (d.lines||[]).forEach(function(l){if(!l||l.h)return;var t=(Number(l.q)||0)*(Number(l.p)||0);if(l.o)opt+=t;else if(l.u==='mois')month+=t;else once+=t;});
 var novat=f.novat!==false&&f.novat!=='false',vat=novat?0:once*0.2,pct=Math.min(100,Math.max(0,parseFloat(f.deppct)||0));
 return {once:once,vat:vat,ttc:once+vat,month:month*(novat?1:1.2),opt:opt,pct:pct,dep:(once+vat)*pct/100,novat:novat};
}
function termsUrl(q){return 'https://rdzoagbe.github.io/dzoft/'+(q.accepted_terms==='v2026-10'?'cgv-2026-10.html':q.accepted_terms==='v2026-11'?'cgv-2026-11.html':'cgv.html');}
function signatureLines(name,at,method,target,extra){
 var how=method==='email'?'avec le code reçu par e-mail à '+(target||'l’adresse du client'):method==='sms'?'avec le code reçu par SMS au '+(target||'numéro du client'):'en ligne';
 return ['Signé électroniquement le '+frDateTime(at)+' par '+(name||'le client')+', '+how+'.'].concat(extra||[]);
}

// ---------- the signed quote (contract) ----------
function signedQuote(q){
 if(!q||!q.accepted_at)throw new Error('Ce devis n’est pas encore signé.');
 var d=quoteData(q),f=d.f||{},a=amounts(d),num=f.num||q.numero||'';
 var doc=Doc('DEVIS SIGNÉ',num);
 doc.title('Devis signé n° '+num);
 doc.kv('Date du devis',frDate(f.date));
 doc.kv('Signé le',frDate(q.accepted_at));
 provider(doc,f);customer(doc,f);
 if(f.desc){doc.h('Le projet');doc.text(f.desc);}
 doc.h('Prestations');
 (d.lines||[]).forEach(function(l){
  if(!l)return;
  if(l.h){doc.gap(4);doc.text(l.l||'',{bold:true});if(l.s)doc.text(l.s,{size:9,color:'0.35 0.38 0.48'});return;}
  if(!String(l.l||'').trim()&&!(Number(l.p)))return;
  var t=(Number(l.q)||0)*(Number(l.p)||0),per=l.u==='mois'?' / mois':'';
  doc.row((l.l||'')+(l.o?' (option, non comprise)':'')+'  ('+(Number(l.q)||0)+' '+(l.u||'')+' × '+money(l.p)+per+')',money(t)+per);
  if(l.s)doc.text(l.s,{size:9,indent:10,color:'0.35 0.38 0.48'});
 });
 doc.rule();
 doc.row('Total des prestations',money(a.once),{bold:true});
 if(!a.novat)doc.row('TVA 20 %',money(a.vat));
 doc.row(a.novat?'Net à payer':'Total TTC',money(a.ttc),{bold:true,size:11});
 if(Number(q.accepted_total)>0&&Math.round(Number(q.accepted_total)*100)!==Math.round(a.ttc*100))doc.row('Montant accepté enregistré à la signature',money(q.accepted_total),{bold:true});
 if(a.month)doc.row('Puis, suivi mensuel (optionnel)',money(a.month)+' / mois');
 if(a.opt)doc.row('Options proposées, non comprises',money(a.opt));
 if(a.pct)doc.row('Acompte à la signature ('+a.pct+' %)',money(a.dep));
 doc.text(a.novat?'TVA non applicable, article 293 B du CGI.':'Montants hors taxes ; TVA au taux de 20 %.',{size:9});
 var excl=String(f.excl||'').split('\n').map(function(l){return l.trim();}).filter(Boolean);
 if(excl.length){doc.h('Ce devis ne comprend pas');excl.forEach(function(l){doc.text('- '+l);});}
 if(f.delay||f.pay||f.fix||f.notes){doc.h('Conditions');doc.kv('Délai de réalisation',f.delay);doc.kv('Paiement',f.pay);doc.kv('Corrections',f.fix);if(f.notes)doc.text(f.notes);}
 doc.h('Accord du client');
 doc.box(signatureLines(q.accepted_name,q.accepted_at,q.accepted_method,q.accepted_target,
  (q.accepted_terms?['Conditions générales de vente acceptées (version '+String(q.accepted_terms).replace(/^v/,'')+') : '+termsUrl(q)]:['Conditions générales de vente : '+termsUrl(q)])
  .concat(q.accepted_early_start?['Le client a demandé le démarrage des travaux avant la fin du délai de rétractation.']:[])));
 doc.text('Ce document reprend le devis tel qu’il a été accepté en ligne et l’enregistrement de la signature.',{size:9,color:'0.35 0.38 0.48'});
 return doc.blob();
}

// ---------- a signed extra-work proposal ----------
function signedChange(r,q){
 if(!r||!r.decided_at||['approved','in_progress','completed'].indexOf(r.status)<0)throw new Error('Cette proposition n’est pas signée.');
 var f=quoteData(q).f||{},num=r.proposal_number||'';
 var doc=Doc('COMPLÉMENT SIGNÉ',num);
 doc.title('Complément au devis'+(num?' n° '+num:''));
 doc.kv('Devis d’origine',q&&q.numero);
 doc.kv('Objet',r.title);
 provider(doc,f);customer(doc,f);
 doc.h('Prestations');
 var lines=Array.isArray(r.lines)?r.lines:null;
 if(lines)lines.forEach(function(l){var free=Number(l.price)===0;doc.row((l.label||'')+'  ('+String(l.qty).replace('.',',')+' × '+(free?'offert':money(l.price))+')',free?'Offert':money((Number(l.qty)||0)*(Number(l.price)||0)));if(l.detail)doc.text(l.detail,{size:9,indent:10,color:'0.35 0.38 0.48'});});
 else if(r.proposed_scope)doc.text(r.proposed_scope);
 doc.rule();
 doc.row('Total du complément',money(r.extra_price),{bold:true,size:11});
 doc.text('TVA non applicable, article 293 B du CGI. Le prix du devis d’origine reste inchangé.',{size:9});
 doc.kv('Délai',r.timeline_impact||'aucun changement annoncé');
 if(r.already_done)doc.text('Ces travaux ont déjà été réalisés à la demande du client.');
 doc.h('Accord du client');
 doc.box(signatureLines(r.decision_name,r.decided_at,r.decision_method,r.decision_target,['Cette signature autorise uniquement les prestations détaillées ci-dessus.']));
 return doc.blob();
}

// ---------- a payment receipt ----------
var METHODS={transfer:'Virement bancaire',cash:'Espèces',card:'Carte bancaire',other:'Autre moyen'};
function paymentReceipt(rc,q,allReceipts){
 if(!rc||!(Number(rc.amount)>0)||!rc.received_on)throw new Error('Paiement incomplet.');
 var f=quoteData(q).f||{},inv=((q&&q.invoices)||[]).filter(function(x){return x&&x.id===rc.invoice_id;})[0]||null;
 var doc=Doc('REÇU DE PAIEMENT',inv&&inv.num?'facture '+inv.num:'');
 doc.title('Reçu de paiement');
 doc.text('DZOFT confirme avoir reçu le paiement ci-dessous.',{bold:true});
 provider(doc,f);customer(doc,f);
 doc.h('Paiement reçu');
 doc.row('Montant reçu',money(rc.amount),{bold:true,size:11});
 doc.kv('Reçu le',frDate(rc.received_on));
 doc.kv('Moyen de paiement',METHODS[rc.method]||'Paiement');
 if(rc.reference)doc.kv('Référence',rc.reference);
 doc.kv('Devis',q&&q.numero);
 if(inv){
  var paid=(allReceipts||[]).filter(function(x){return x&&x.invoice_id===inv.id;}).reduce(function(n,x){return n+Number(x.amount||0);},0);
  doc.h('Facture concernée');
  doc.row('Facture n° '+(inv.num||'—')+(inv.n?' · '+inv.n:''),money(inv.amt));
  doc.row('Total reçu sur cette facture',money(paid));
  doc.row('Reste à payer sur cette facture',money(Math.max(0,Number(inv.amt||0)-paid)),{bold:true});
 }
 doc.gap(6);
 doc.text('Ce reçu confirme un paiement. Il ne remplace pas la facture'+(inv&&inv.num?' n° '+inv.num:'')+', qui reste le document comptable.',{size:9,color:'0.35 0.38 0.48'});
 return doc.blob();
}

// ---------- a credit note (« avoir », 18 Nov 2026) ----------
/* CGI art. 289-I-5 and BOI-TVA-DECLA-30-20-20-20 § V: it refers explicitly to the original invoice (number and date)
   and carries the usual invoice mentions. Drawn from the recorded credit note, which can never be changed. */
function creditNote(cn,q,allCredits){
 if(!cn||!cn.number||!(Number(cn.amount)>0))throw new Error('Avoir incomplet.');
 var f=quoteData(q).f||{},novat=f.novat!==false&&f.novat!=='false';
 var doc=Doc('AVOIR',cn.number);
 doc.title('Avoir n° '+cn.number);
 doc.kv('Date de l’avoir',frDate(cn.issued_on));
 doc.text('Avoir se rapportant à la facture n° '+cn.invoice_number+(cn.invoice_issued_on?' du '+frDate(cn.invoice_issued_on):'')+'.',{bold:true});
 provider(doc,f);customer(doc,f);
 doc.h(cn.full_cancel?'Annulation de la facture':'Réduction de la facture');
 doc.text('Motif : '+cn.reason);
 doc.row('Montant de la facture n° '+cn.invoice_number,money(cn.invoice_amount));
 doc.row('Montant de cet avoir','-'+' '+money(cn.amount),{bold:true,size:11});
 var before=(allCredits||[]).filter(function(x){return x&&x.invoice_id===cn.invoice_id&&x.number!==cn.number&&String(x.issued_at||'')<String(cn.issued_at||'');}).reduce(function(n,x){return n+Number(x.amount||0);},0);
 if(before>0)doc.row('Avoirs précédents sur cette facture','-'+' '+money(before));
 doc.row('Montant de la facture après avoir(s)',money(Math.max(0,Number(cn.invoice_amount||0)-before-Number(cn.amount||0))),{bold:true});
 doc.kv('Devis',q&&q.numero);
 if(novat)doc.text('TVA non applicable, art. 293 B du CGI.',{size:9});
 doc.gap(6);
 doc.text(cn.full_cancel?'La facture n° '+cn.invoice_number+' est annulée en totalité par cet avoir.'+(cn.effect==='reissue'?' Une facture corrigée la remplace.':''):'La facture n° '+cn.invoice_number+' reste due pour le montant indiqué ci-dessus, déduction faite des paiements déjà reçus.',{size:9,color:'0.35 0.38 0.48'});
 return doc.blob();
}

function safeName(v){return String(v||'').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^A-Za-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80)||'document';}
function download(blob,name){
 var url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=safeName(name).replace(/\.pdf$/i,'')+'.pdf';a.rel='noopener';document.body.appendChild(a);a.click();
 setTimeout(function(){URL.revokeObjectURL(url);a.remove();},1500);
}
global.DzoftDocuments={signedQuote:signedQuote,signedChange:signedChange,paymentReceipt:paymentReceipt,creditNote:creditNote,download:download,fileName:safeName,_amounts:amounts};
})(window);
