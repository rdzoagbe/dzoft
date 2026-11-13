/* DZOFT Today: display model only. Never modifies a receipt or queues an email.
 * Inputs are the already-authorized admin quotes and project_tracking results.
 * The host page owns authentication and all navigation actions. */
(function(root){
'use strict';
var esc=function(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c];});};
var cents=function(v){var n=Number(v);return Number.isFinite(n)?Math.round(n*100):0;};
var money=function(c,english){return new Intl.NumberFormat(english?'en-GB':'fr-FR',{style:'currency',currency:'EUR'}).format(c/100);};
function build(input){
 var projects=Array.isArray(input.projects)?input.projects:[],unread=Array.isArray(input.unread)?input.unread:[];
 var ready=!!input.ready,failures=Number(input.failures)||0;
 var actions=[],received=0,pending=0,documents=0;
 projects.forEach(function(p){
  var d=p.tracking;
  if(!d)return;
  received+=cents(d.received);
  (d.payment_statuses||[]).forEach(function(t){
   if(t.status!=='pending'&&t.status!=='sent_by_client')return;
   pending+=cents(t.amount);
   actions.push({category:t.status==='sent_by_client'?'reported':'pending',
    title:t.status==='sent_by_client'?'Virement annoncé par le client':'Paiement en attente',
    name:p.clientName+' · '+p.numero,amount:cents(t.amount),target:'follow:'+p.id,
    priority:t.status==='sent_by_client'?0:3});
  });
  var unbilled=(d.receipts||[]).filter(function(r){return !r.invoice_id;});
  if(unbilled.length){
   documents+=unbilled.length;
   actions.push({category:'invoice',title:unbilled.length+' facture'+(unbilled.length>1?'s':'')+' à établir / associer',
    name:p.clientName+' · '+p.numero,amount:unbilled.reduce(function(n,r){return n+cents(r.amount);},0),target:'follow:'+p.id,priority:2});
  }
 });
 var groups={};
 unread.forEach(function(m){
  var id=String(m.client_id||'');if(!id)return;
  if(!groups[id])groups[id]={name:m.clientName||'Client',count:0,id:id};
  groups[id].count++;
 });
 Object.keys(groups).forEach(function(id){
  var g=groups[id];
  actions.push({category:'message',priority:1,title:g.count+' message'+(g.count>1?'s':'')+' à traiter',
   name:g.name,amount:null,target:'thread:'+id});
 });
 actions.sort(function(a,b){return a.priority-b.priority||a.name.localeCompare(b.name);});
 return {ready:ready,failures:failures,received:received,pending:pending,
  documents:documents,messages:unread.length,actions:actions,projects:projects.length};
}
function render(node,input){
 if(!node)return;var en=!!input.english,m=build(input);
 var tr=function(fr,eng){return en?eng:fr;};
 var pretty=function(v){return money(v,en);};
 function card(label,value,kind){return '<div class="today-stat '+kind+'"><span>'+label+'</span><b>'+value+'</b></div>';}
 var moneyReady=m.ready&&(m.projects===0||m.failures<m.projects);
 var fmt=function(n){return moneyReady?pretty(n):'—';};
 var warning=m.ready&&m.failures?'<p class="today-data-note" role="status">'+tr('Certains projets n’ont pas pu être consultés. Les montants affichés sont partiels.','Some projects could not be loaded. Displayed amounts are partial.')+'</p>':!m.ready?'<p class="today-data-note" role="status">'+tr('Actualisation des montants confirmés…','Loading verified payment figures…')+'</p>':'';
 var entries=m.actions.slice(0,5).map(function(a){
  var title=a.category==='reported'?tr('Virement signalé — à vérifier','Client reported transfer — verify'):
   a.category==='pending'?tr('Paiement en attente','Payment pending'):
   a.category==='invoice'?tr('Facture à établir ou associer','Invoice to issue or attach'):
   tr('Message client à traiter','Client message to reply to');
  var action=a.category==='message'?tr('Répondre','Reply'):
   a.category==='invoice'?tr('Voir la facture','Open invoices'):
   tr('Vérifier','Verify');
  return '<div class="today-task"><span class="today-task-icon '+esc(a.category)+'" aria-hidden="true"></span>'+
   '<div class="today-task-copy"><strong>'+esc(title)+'</strong><span>'+esc(a.name)+(a.amount!==null?' · '+pretty(a.amount):'')+'</span></div>'+
   '<button type="button" class="btn sm line" data-go="'+esc(a.target)+'">'+esc(action)+'</button></div>';
 }).join('');
 var later=m.actions.length>5?'<p class="today-task-more">'+tr('+'+(m.actions.length-5)+' autres éléments à suivre dans les dossiers.','+'+(m.actions.length-5)+' additional items to review in cases.')+'</p>':'';
 node.innerHTML='<div class="today-title"><div><p class="simplified-eyebrow">DZOFT · '+tr('ACTIONS PRIORITAIRES','TOP PRIORITIES')+'</p>'+
 '<h3>'+tr('L’essentiel à traiter','What needs your attention')+'</h3><p>'+tr('Les virements annoncés ne sont pas des paiements reçus.','Client-reported transfers are not confirmed receipts.')+'</p></div>'+
 '<span class="today-count">'+(m.ready?m.actions.length:'…')+' '+tr('à suivre','to review')+'</span></div>'+
 '<div class="today-stats">'+
 card(tr('Reçu et confirmé','Received and verified'),fmt(m.received),'received')+
 card(tr('À vérifier (non reçu)','To verify (not received)'),fmt(m.pending),'pending')+
 card(tr('Factures à traiter','Invoices to address'),m.ready&&m.projects>0&&m.failures===m.projects?'—':m.ready?String(m.documents):'—','invoices')+
 card(tr('Messages à traiter','Messages to reply'),String(m.messages),'messages')+
 '</div>'+warning+
 '<div class="today-tasks">'+(m.actions.length?entries+later:'<p class="today-no-tasks">'+(m.ready?tr('Aucun paiement annoncé ni facture en attente détecté dans les projets accessibles.','No reported payments or outstanding invoices found in accessible projects.'):tr('Les actions apparaîtront après synchronisation.','Actions will appear after synchronization.'))+'</p>')+'</div>'+
 '<p class="today-safety-note">'+tr('Pour confirmer une réception, ouvrez le projet et vérifiez votre banque. Aucune validation automatique depuis ce tableau.','To confirm receipt, open the project and verify your bank. Nothing is confirmed automatically from this dashboard.')+'</p>';
}
root.DzoftToday={build:build,render:render};
})(window);
