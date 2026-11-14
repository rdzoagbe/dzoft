/* DZOFT Brevo delivery status labels.
 * The outbox "sent" state is only provider API acceptance, NOT delivery.
 * Opened is an email tracking signal and does not prove human reading. */
(function(global){
 'use strict';
 function describe(job){
  var state=job&&job.status||'queued';
  if(state==='queued')return {label:'Queued',detail:'Waiting for Brevo',tone:'muted'};
  if(state==='processing')return {label:'Sending',detail:'Brevo is processing this notification',tone:'muted'};
  if(state==='failed')return {label:'Sending failed',detail:'The sender has not confirmed acceptance',tone:'error'};
  if(state!=='sent')return {label:'Unavailable',detail:'No delivery status',tone:'muted'};
  var d=job.delivery_status||'unconfirmed';
  switch(d){
   case 'delivered':return {label:'Delivered',detail:'Brevo reports acceptance by the receiving mail server',tone:'success'};
   case 'opened':return {label:'Opened (tracked)',detail:'An open-tracking signal was detected; this does not prove the person read it',tone:'success'};
   case 'hard_bounce':return {label:'Bounced',detail:'Brevo reports a permanent delivery failure',tone:'error'};
   case 'soft_bounce':return {label:'Temporary bounce',detail:'Brevo reports a temporary delivery failure',tone:'warning'};
   case 'blocked':return {label:'Blocked',detail:'Brevo reports delivery was blocked',tone:'error'};
   case 'invalid':return {label:'Invalid address',detail:'Brevo reports the email address was invalid',tone:'error'};
   case 'spam':return {label:'Spam complaint',detail:'Brevo reports a spam complaint',tone:'error'};
   case 'deferred':return {label:'Deferred',detail:'Recipient mail server delayed the message',tone:'warning'};
   case 'error':return {label:'Delivery error',detail:'Brevo reports a delivery error',tone:'error'};
   default:return {label:'Accepted by Brevo',detail:'Delivery not yet verified',tone:'muted'};
  }
 }
 global.DzoftDelivery={describe:describe};
})(window);
