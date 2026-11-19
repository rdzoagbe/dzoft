/* DZOFT new-quote calculator: catalogue suggestions are reviewed, NEVER applied automatically.
   This is independent of signed-project supplementary proposals. */
(function(root,factory){
 'use strict';
 var api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.DzoftQuotePricing=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 var SCOPES=['extra','pwa','mobile','both'];
 function normalize(s){return String(s==null?'':s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();}
 function euro(n){return Number(n||0).toLocaleString('fr-FR',{style:'currency',currency:'EUR'});}
 function validPrice(raw){if(raw==null||raw==='')return null;var n=Number(String(raw).replace(',','.'));return Number.isFinite(n)&&n>=0&&n<=1000000?Math.round(n*100)/100:null;}
 function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;'}[c];});}
 function isIncluded(block,kind){
  var scope=SCOPES.indexOf(block&&block.scope)>=0?block.scope:'extra';
  return (kind==='pwa'&&(scope==='pwa'||scope==='both'))||(kind==='mobile'&&(scope==='mobile'||scope==='both'));
 }
 function matchRequest(request,block){
  var text=' '+normalize(String(request).slice(0,4000))+' ';
  if(!text.trim())return false;
  var words=Array.isArray(block.words)?block.words:[];
  return words.slice(0,12).some(function(raw){
   var word=normalize(String(raw).slice(0,100));
   return word.length>=3&&text.indexOf(' '+word+' ')>=0;
  });
 }
 function analyze(request,kind,blocks){
  var included=[],extras=[];
  (Array.isArray(blocks)?blocks:[]).slice(0,200).forEach(function(block,index){
   if(!block||!String(block.label||'').trim()||!matchRequest(request,block))return;
   var price=validPrice(block.price);
   if(price===null)return;
   var item={id:'catalogue-'+index,label:String(block.label).trim(),description:String(block.description||'').slice(0,400),
    price:price,scope:SCOPES.includes(block.scope)?block.scope:'extra'};
   (isIncluded(item,kind)?included:extras).push(item);
  });
  return {included:included,extras:extras,unknown:!included.length&&!extras.length};
 }
 function attach(root,options){
  if(!root||!options||!Array.isArray(options.packages)||!options.packages.length)return null;
  var catalog=[],loaded=false,opening=false,busy=false,last=null,manual=new Map(),selected={};
  var pkg=options.packages;
  var packageOptions=pkg.map(function(p){return '<option value="'+esc(p.key)+'">'+esc(p.label)+' · '+euro(p.price)+'</option>';}).join('');
  root.innerHTML='<div class="qpc-top"><div><p class="qpc-eyebrow">DZOFT · CHIFFRAGE</p><h2>Calculateur du devis initial</h2><p>Repérez les prestations incluses et les demandes supplémentaires. Les montants restent des propositions à vérifier.</p></div><button class="qpc-close" type="button" data-qpc-close aria-label="Fermer le calculateur">×</button></div>'+
   '<div class="qpc-grid"><div class="qpc-input"><label for="qpc-kind">Forfait de base</label><select id="qpc-kind" data-qpc-kind>'+packageOptions+'</select>'+
   '<label for="qpc-request">Travail demandé par le client</label><textarea id="qpc-request" data-qpc-request maxlength="4000" rows="7" placeholder="Collez la demande du client : connexion, galerie photo, réservation…"></textarea>'+
   '<div class="qpc-actions"><button type="button" class="qpc-primary" data-qpc-detect>Analyser la demande</button><button type="button" class="qpc-secondary" data-qpc-cancel>Annuler</button></div>'+
   '<p class="qpc-assist">La détection repose sur les mots configurés dans votre Catalogue. Aucune IA ne devine le prix. Vérifiez chaque proposition avant application.</p>'+
   '<p class="qpc-error" data-qpc-error role="alert" hidden></p></div>'+
   '<div class="qpc-result" aria-live="polite"><div data-qpc-preview><p class="qpc-muted">Choisissez un forfait puis analysez la demande. Aucun devis n’est modifié avant votre validation.</p></div>'+
   '<div class="qpc-manual"><label for="qpc-manual">Ajouter une prestation de mon Catalogue</label><div class="qpc-manual-row"><select id="qpc-manual" data-qpc-manual><option value="">— Sélectionner —</option></select><button type="button" class="qpc-secondary" data-qpc-add>Ajouter</button></div></div>'+
   '<div class="qpc-bottom"><div><span>Total prévisionnel (hors TVA)</span><strong data-qpc-total>—</strong></div><button type="button" class="qpc-primary" data-qpc-apply disabled>Ajouter au devis</button></div>'+
   '<p class="qpc-assist">L’ajout remplit uniquement les lignes du devis en cours. Aucun e-mail, facture ni signature n’est généré.</p></div></div>';
  var $=function(s){return root.querySelector(s);};
  var kind=$('[data-qpc-kind]'),request=$('[data-qpc-request]'),message=$('[data-qpc-error]'),preview=$('[data-qpc-preview]'),apply=$('[data-qpc-apply]');
  function error(msg){message.textContent=msg||'';message.hidden=!msg;}
  function chosenPackage(){return pkg.find(function(p){return p.key===kind.value;})||pkg[0];}
  function allItems(){
   var items=analyze(request.value,chosenPackage().kind,catalog);
   manual.forEach(function(block,id){
    if(!items.included.concat(items.extras).some(function(x){return x.id===id})){
     (isIncluded(block,chosenPackage().kind)?items.included:items.extras).push(block);
    }
   });
   return items;
  }
  function itemHtml(x,included){
   var quoted=!!(options.isAlreadyQuoted&&options.isAlreadyQuoted(x)),mark=quoted||Object.prototype.hasOwnProperty.call(selected,x.id)?(quoted||selected[x.id]?'checked':''):(included?'checked':'');
   return '<label class="qpc-item"><input type="checkbox" data-qpc-select="'+esc(x.id)+'" '+mark+(quoted?' disabled':'')+'>'+
    '<span><b>'+esc(x.label)+'</b><small>'+esc(quoted?'Déjà inscrit au devis':(x.description||(included?'Déjà compris dans le forfait':'À chiffrer séparément')))+'</small></span>'+
    '<strong>'+ (included?'Inclus · 0 €':euro(x.price))+'</strong></label>';
  }
  function updateTotal(){
   if(!last)return;
   var p=chosenPackage(),extra=0;
   last.extras.forEach(function(x){var check=root.querySelector('[data-qpc-select="'+x.id+'"]');if(check&&check.checked&&!check.disabled)extra+=x.price;});
   // This is an estimate of the package + selected extras, not a replacement for
   // totals()/VAT/deposit from the original quotation editor.
   var current=options.currentTotal?options.currentTotal(p.key):null;
   var starting=current&&Number.isFinite(current.value)?current.value:p.price;
   $('[data-qpc-total]').textContent=euro(starting+extra);
  }
  function render(){
   var p=chosenPackage(),items=allItems();
   root.querySelectorAll('[data-qpc-select]').forEach(function(c){if(!c.disabled)selected[c.dataset.qpcSelect]=c.checked;});
   last=items;
   var included=items.included,extras=items.extras;
   preview.innerHTML='<div class="qpc-package"><span>Forfait sélectionné</span><strong>'+esc(p.label)+' · '+euro(p.price)+'</strong></div>'+
    '<div class="qpc-section"><h3>Inclus dans le forfait <span>'+included.length+'</span></h3>'+
    (included.length?included.map(function(x){return itemHtml(x,true);}).join(''):'<p class="qpc-muted">Aucune correspondance confirmée. Les prestations du forfait restent celles du modèle de devis.</p>')+'</div>'+
    '<div class="qpc-section"><h3>Prestations supplémentaires <span>'+extras.length+'</span></h3>'+
    (extras.length?extras.map(function(x){return itemHtml(x,false);}).join(''):'<p class="qpc-muted">Aucun supplément repéré. Ajoutez une prestation de votre Catalogue ou une ligne libre dans le devis.</p>')+'</div>'+
    '<p class="qpc-assist">Seules les lignes cochées seront ajoutées. Les lignes « incluses » coûtent 0 € en plus du forfait ; les autres sont facturées au prix affiché.</p>';
   var current=options.currentTotal?options.currentTotal(p.key):null;
   var conflict=!!(current&&current.conflict);
   if(conflict)error('Un autre forfait est déjà présent. Retirez-le manuellement pour en choisir un autre.');
   else if(message.textContent.indexOf('Un autre forfait')===0)error('');
   apply.disabled=!loaded||busy||conflict;
   updateTotal();
  }
  function clear(){
   request.value='';manual.clear();selected={};last=null;preview.innerHTML='<p class="qpc-muted">Demande effacée. Aucune modification du devis.</p>';
   apply.disabled=true;$('[data-qpc-total]').textContent='—';error('');
  }
  function close(){clear();root.hidden=true;opening=false;options.onClose&&options.onClose();}
  function refreshCatalog(){
   busy=true;apply.disabled=true;error('');
   return Promise.resolve().then(options.loadCatalog).then(function(result){
    var list=Array.isArray(result)?result:[];
    catalog=list.slice(0,200).filter(function(b){return b&&String(b.label||'').trim()&&validPrice(b.price)!==null;});
    loaded=true;
    $('[data-qpc-manual]').innerHTML='<option value="">— Sélectionner —</option>'+
     catalog.map(function(b,i){return '<option value="'+i+'">'+esc(b.label)+' · '+euro(b.price)+'</option>';}).join('');
    if(!catalog.length)error('Catalogue vide : les prestations du forfait restent disponibles ; ajoutez vos tarifs dans Devis → Catalogue.');
    if(last)render();
   }).catch(function(){
    loaded=false;catalog=[];error('Impossible de lire le Catalogue. Vérifiez votre connexion puis réouvrez le calculateur.');
    apply.disabled=true;
   }).finally(function(){busy=false;if(last)render();});
  }
  function open(){
   if(options.isLocked&&options.isLocked()){error('Devis signé ou en chargement : modification interdite.');return false;}
   if(opening)return true;
   root.hidden=false;opening=true;kind.value=options.initialKind?options.initialKind():pkg[0].key;
   if(!pkg.some(function(x){return x.key===kind.value;}))kind.value=pkg[0].key;
   var desc=options.initialRequest&&options.initialRequest();
   request.value=desc||'';manual.clear();selected={};last=null;
   refreshCatalog();
   if(request.value)render();
   root.scrollIntoView({behavior:'smooth',block:'start'});
   request.focus();
   return true;
  }
  root.addEventListener('click',function(ev){
   var b=ev.target.closest('button');if(!b)return;
   if(b.hasAttribute('data-qpc-close')||b.hasAttribute('data-qpc-cancel')){close();return;}
   if(b.hasAttribute('data-qpc-detect')){if(!loaded){error('Catalogue indisponible. Réessayez plus tard.');return;}error('');render();return;}
   if(b.hasAttribute('data-qpc-add')){
    var id=$('[data-qpc-manual]').value;if(id===''||!catalog[+id])return;
    var c=catalog[+id],item={id:'catalogue-'+id,label:String(c.label).trim(),description:String(c.description||''),price:validPrice(c.price),scope:c.scope||'extra'};
    manual.set(item.id,item);render();$('[data-qpc-manual]').value='';return;
   }
   if(b.hasAttribute('data-qpc-apply')){
    if(!loaded||busy||!last||options.isLocked&&options.isLocked())return;
    if(options.currentTotal&&options.currentTotal(chosenPackage().key).conflict)return;
    var selection=last.included.concat(last.extras).filter(function(x){var el=root.querySelector('[data-qpc-select="'+x.id+'"]');return el&&el.checked&&!el.disabled;});
    var included=selection.filter(function(x){return isIncluded(x,chosenPackage().kind);});
    var extras=selection.filter(function(x){return !isIncluded(x,chosenPackage().kind);});
    try{
     var result=options.apply({package:chosenPackage(),included:included,extras:extras});
     if(result===false)return;
     close();
    }catch(e){error(e&&e.message||'Application impossible : vérifiez le devis.');}
   }
  });
  kind.addEventListener('change',function(){selected={};if(last)render();});
  request.addEventListener('input',function(){selected={};last=null;apply.disabled=true;preview.innerHTML='<p class="qpc-muted">Demande modifiée : cliquez sur « Analyser la demande » pour actualiser le prix.</p>';$('[data-qpc-total]').textContent='—';});
  root.addEventListener('change',function(ev){if(ev.target.matches('[data-qpc-select]')){selected[ev.target.dataset.qpcSelect]=ev.target.checked;updateTotal();}});
  return {open:open,close:close,refreshCatalog:refreshCatalog};
 }
 return {normalize:normalize,validPrice:validPrice,isIncluded:isIncluded,matchRequest:matchRequest,analyze:analyze,attach:attach};
});
