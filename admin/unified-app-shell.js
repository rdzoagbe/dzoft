/* Shared DZOFT branding for all global workspace routes.
   Does not interfere with installed-app-menu.js (which owns the top mobile menu). */
(function(){
 'use strict';
 var app=document.getElementById('app');
 if(!app||app.querySelector('.dzoft-side-brand'))return;
 var link=document.createElement('a');
 link.className='dzoft-side-brand';
 link.href='#/tableau-de-bord';
 link.setAttribute('aria-label','DZOFT · Tableau de bord');
 link.innerHTML='<img src="../assets/dzoft-favicon.svg" alt=""><span>DZOFT</span>';
 app.appendChild(link);
})();
