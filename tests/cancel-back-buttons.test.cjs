// 18 Nov 2026: every form that saves only when you press a button can be closed without saving (Annuler / Plus tard /
// Retour). Forms that save as you type are left as they are (owner's choice).
const test=require('node:test'),assert=require('node:assert'),fs=require('fs'),path=require('path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('admin: two-step setup, payment settings and new-password screen can be left without saving',()=>{
 const html=read('admin/index.html');
 assert.match(html,/id="mfa-cancel" type="button">Annuler</);
 // Cancelling the setup removes the unfinished factor; nothing else changes.
 assert.match(html,/\$\('mfa-cancel'\)\.onclick = function\(\)\{[\s\S]{0,200}if \(mfaBusy \|\| !enrolling\) return;\n\s+var id = enrolling; enrolling = null;\n\s+sb\.mfa\.remove\(id\)/);
 // Cancel is locked while a code is being checked, so it can never delete a factor just verified.
 assert.match(html,/mfaBusy = true; \$\('mfa-ok'\)\.disabled = \$\('mfa-cancel'\)\.disabled = true;/);
 assert.match(html,/id="p-cancel" type="button">Annuler les modifications</);
 assert.match(html,/\$\('p-cancel'\)\.onclick = function\(\)\{ PAY\.forEach\(function\(k\)\{ \$\('p-' \+ k\)\.value = savedPay\[k\] \|\| ''; \}\);/);
 const np=html.slice(html.indexOf('<form id="f-newpass"'),html.indexOf('</form>',html.indexOf('<form id="f-newpass"')));
 assert.match(np,/<a class="go-login">Retour à la connexion<\/a>/);
});

test('work items: edit and publish have Annuler, which never saves nor publishes',()=>{
 const js=read('admin/work-items.js');
 assert.match(js,/editCancel\.onclick=function\(\)\{editInput\.value=item\.title;cat\.value=item\.category;edit\.open=false;\};/);
 assert.match(js,/pubCancel\.onclick=function\(\)\{if\(pubBtn\.disabled\)return;pubText\.value='';/);
 assert.doesNotMatch(js.slice(js.indexOf('pubCancel.onclick'),js.indexOf('pubCancel.onclick')+200),/rpc\(/);
});

test('extra work: client request (Annuler), proposal to sign (Plus tard), calculator and reject (Annuler)',()=>{
 const js=read('assets/change-requests.js');
 assert.match(js,/'Envoyer la demande','Submit request'\)\+'<\/button><button class="btn line" type="button" data-form-cancel>/);
 assert.match(js,/data-form-cancel="later">'\+tr\(en,'Plus tard','Later'\)/);
 assert.match(js,/data-form-cancel="calc">'\+tr\(en,'Annuler','Cancel'\)/);
 assert.match(js,/tr\(en,'Retirer la proposition','Withdraw the proposal'\)\)\+'<\/button><button class="btn ghost sm" type="button" data-form-cancel>'\+tr\(en,'Fermer sans rien changer'/);
 // The cancel handler only resets or hides: it never calls the server.
 const h=js.slice(js.indexOf("closest('[data-form-cancel]')"),js.indexOf('api.client=bindClient'));
 assert.doesNotMatch(h,/sb\.|rpc\(|fetch\(/);
});

test('monthly plan: « + Facture du suivi » asks before adding an invoice',()=>{
 assert.match(read('admin/suivi.html'),/if \(!confirm\('Ajouter la facture du suivi de ' \+ m \+ ' \(' \+ eur\(c\.price \|\| 0\) \+ '\) \?'\)\) return;/);
});
