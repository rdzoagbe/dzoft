/* Owner-only, read-only weekly review. Never publishes, sends email, or copies
 * raw GitHub information. Uses only private work-item status and fixed categories. */
(function(){
"use strict";
var q=new URLSearchParams(location.search).get("q");
var root=document.getElementById("jr-weekly-slot");
var sb=window.RDsb;
if(q!=="c8a50cee-3856-4539-98a3-f5df201dbff0" || !root || !sb || !sb.session())return;
var loaded=false,loading=false;
var label={
 administration:"Administration",qr:"Venue QR codes",evenements:"Venues and events",
 profils:"Profiles and registration",securite:"Security and access",
 messagerie:"Messages and notifications",interface:"Interface and displays",
 donnees:"Data and configuration",tests:"Testing and fixes",
 livraison:"Deployments",fonctionnalites:"Features",other:"General maintenance"
};
function node(type,cls,txt){var e=document.createElement(type);if(cls)e.className=cls;if(txt!==undefined)e.textContent=txt;return e;}
function safeDay(value){return typeof value==="string" && /^\d{4}-\d{2}-\d{2}/.test(value)?value.slice(0,10):"";}
function monday(){
 var now=new Date();
 var offset=(now.getDay()+6)%7;
 now.setHours(12,0,0,0);now.setDate(now.getDate()-offset);
 return [now.getFullYear(),String(now.getMonth()+1).padStart(2,"0"),String(now.getDate()).padStart(2,"0")].join("-");
}
function summary(items){
 var start=monday();
 var rows=(Array.isArray(items)?items:[]).filter(function(v){return v&&safeDay(v.source_date)>=start&&
  Object.prototype.hasOwnProperty.call(label,v.source_group);});
 var counts={review:0,working:0,todo:0,done:0,published:0},categories={};
 rows.forEach(function(v){
  if(Object.prototype.hasOwnProperty.call(counts,v.status))counts[v.status]++;
  if(v.published_at)counts.published++;
  categories[v.source_group]=(categories[v.source_group]||0)+1;
 });
 var names=Object.keys(categories).sort().map(function(c){return label[c];});
 var text="UPZONE – Internal weekly progress review\nWeek starting "+start+
  "\nDevelopment topics detected: "+rows.length+
  "\nAreas: "+(names.join(", ")||"No recent activity")+
  "\nAwaiting verification: "+counts.review+
  "\nIn progress: "+counts.working+
  "\nCompleted internally: "+counts.done+
  "\nAlready shared with client: "+counts.published+
  "\n\nInternal draft only. Development activity does not prove delivery or testing. Review every task before any client communication.";
 return {start:start,counts:counts,names:names,total:rows.length,text:text};
}
function load(){
 if(loading)return;loading=true;
 root.replaceChildren(node("p","muted","Loading private weekly review…"));
 Promise.all([
  sb.rpc("list_project_work_items",{p_quote:q},true),
  sb.rpc("rodney_sync_overview",{},true)
 ]).then(function(pair){draw(summary(pair[0]),pair[1]||{});loaded=true;})
 .catch(function(){
  root.replaceChildren(node("p","jr-task-message error",
   "Weekly review is unavailable. Existing project notes remain safe."));
  var retry=node("button","btn sm line","Retry");retry.type="button";retry.onclick=load;root.append(retry);
 }).finally(function(){loading=false;});
}
function draw(report,state){
 root.replaceChildren();
 var section=node("section","jr-weekly-review");
 var head=node("div","jr-weekly-head");
 var title=node("div");title.append(node("h3","","This week's project review"));
 title.append(node("p","muted","Private summary based on tracked development activity; nothing is sent automatically."));
 head.append(title,node("span","jr-weekly-chip","INTERNAL ONLY"));section.append(head);
 var when=state&&state.last_success_at?new Date(state.last_success_at).toLocaleString("en-GB",
  {day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}):"Not yet confirmed";
 var now=Date.now(),recent=state&&state.last_success_at&&
  now-new Date(state.last_success_at).getTime()<4*3600000;
 var health=node("p","jr-weekly-health"+(recent?" good":""),
  "Background sync: "+(state&&state.backend_enabled===true?"enabled":"not confirmed")+
  " · Last successful run: "+when);
 section.append(health);
 var stats=node("div","jr-weekly-stats");
 [
  [String(report.total),"Activity groups"],
  [String(report.counts.review),"To verify"],
  [String(report.counts.working),"In progress"],
  [String(report.counts.done),"Completed"]
 ].forEach(function(v){
  var cell=node("div","jr-weekly-stat");
  cell.append(node("strong","",v[0]),node("span","",v[1]));stats.append(cell);
 });
 section.append(stats);
 var category=node("p","jr-work-help","Areas this week: "+(report.names.join(" · ")||"No recent categories"));
 section.append(category);
 var info=node("p","jr-work-help","This is a review aid, not an automatically generated client report. Completed work still requires your approval and a separate client-facing summary.");
 section.append(info);
 var actions=node("div","jr-weekly-actions");
 var copy=node("button","btn sm line","Copy private review");copy.type="button";
 copy.onclick=function(){
  if(!navigator.clipboard||typeof navigator.clipboard.writeText!=="function"){
   copy.textContent="Clipboard unavailable";return;
  }
  navigator.clipboard.writeText(report.text).then(function(){copy.textContent="Copied";},
   function(){copy.textContent="Unable to copy";});
 };
 var reload=node("button","btn sm ghost","Refresh summary");reload.type="button";reload.onclick=load;
 actions.append(copy,reload);section.append(actions);
 root.append(section);
}
window.DzoftWeeklyReview={summary:summary,refresh:load};
var fold=root.closest("details");
if(fold){
 fold.addEventListener("toggle",function(){if(fold.open)load();});
 if(fold.open)load();
}else load();
document.addEventListener("visibilitychange",function(){if(document.visibilityState==="visible"&&fold&&fold.open)load();});
})();
