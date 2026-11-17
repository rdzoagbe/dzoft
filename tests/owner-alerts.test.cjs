const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('every reminder of the dashboard is visible, not only payments and messages (17 Nov)',()=>{
 const index=read('admin/index.html'),dash=read('admin/dashboard-v3.js');
 assert.match(index,/todo:todo\.map\(function\(t\)\{return \{text:t\[0\],target:t\[1\],action:t\[2\]\};\}\)/);
 assert.match(dash,/if\(Array\.isArray\(data\.todo\)\)/);
 assert.match(dash,/Voir les "\+more\+" autres actions/,'nothing is cut off: the rest opens below');
 // Reminders the owner relies on.
 for(const text of ['Nouvelle demande de ','Relancer ','en brouillon pour','sans réponse depuis','expiré le','Acompte à recevoir','Virement signalé par le client','a validé','Nouvel avis de','Échec d’e-mail','Facturer le suivi mensuel','Paiement à vérifier','dans la corbeille',
   'Demande de modification de ','pas encore envoyée','sans signature : pensez à relancer','travaux à réaliser','facture complémentaire à émettre'])
  assert.ok(index.includes(text),text);
 assert.match(index,/sb\.rpc\('owner_open_change_requests',\{\},true\)/);
});

test('client actions on extra work e-mail the owner (request, decline, withdrawal)',()=>{
 const sql=read('supabase/migrations/20261117220000_owner_alerts_for_client_change_actions.sql');
 const mail=read('supabase/functions/process-notification-outbox/index.ts');
 assert.match(sql,/new\.actor_type<>'client' or new\.event_type not in \('requested','declined','withdrawn'\)/);
 assert.match(sql,/c\.client_id,c\.quote_id,null,null,null,false,true,false\);/,'owner only, never the client');
 assert.match(sql,/create trigger dzoft_change_events_notify_owner after insert on public\.dzoft_change_events/);
 assert.match(sql,/if auth\.uid\(\) is null or not public\.is_owner\(\) then raise exception 'Owner access required'/);
 for(const t of ['change_requested','change_declined','change_withdrawn'])assert.match(mail,new RegExp(t+':'));
});
