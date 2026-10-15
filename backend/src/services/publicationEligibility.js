"use strict";
// One business rule for detail-page guidance and the authoritative acceptance route.
function publicationEligibility(pub, history, now = Date.now()) {
 const deny=(code,message,status=409)=>({allowed:false,code,message,status});
 if(pub.is_paused || pub.status==='paused')return deny('PUBLICATION_PAUSED','La publicación está pausada.');
 if(pub.expires_at && new Date(pub.expires_at).getTime()<=now)return deny('PUBLICATION_EXPIRED','La publicación ha vencido.');
 if(Number(pub.available_slots)<=0)return deny('NO_SLOTS','No quedan cupos disponibles.');
 if(history.some(r=>r.status==='rejected'))return deny('PARTICIPATION_REJECTED','Tu solicitud fue rechazada anteriormente.',403);
 if(history.some(r=>['pending_approval','approved','completed'].includes(r.status)))return deny('ACTIVE_PARTICIPATION','Ya tienes una solicitud activa para esta publicación.');
 const paid=history.filter(r=>r.status==='confirmed_paid');
 if(!pub.allow_repeat_participation && paid.length)return deny('REPEAT_DISABLED','Esta publicación no permite compras o participaciones repetidas.');
 if(pub.allow_repeat_participation && pub.max_repeat_per_user!=null && paid.length>=Number(pub.max_repeat_per_user))return deny('REPEAT_LIMIT','Has alcanzado el máximo de compras o participaciones permitido.');
 const hours=Number(pub.repeat_cooldown_hours||0);
 if(pub.allow_repeat_participation && paid.length && hours>0){
  if(paid.some(r=>!r.paid_recorded_at || !Number.isFinite(new Date(r.paid_recorded_at).getTime())))return deny('PAYMENT_DATE_REVIEW','Necesitamos comprobar la fecha de un pago anterior antes de permitir otra compra. Contacta con soporte.');
  const next=Math.max(...paid.map(r=>new Date(r.paid_recorded_at).getTime()))+hours*3600000;
  if(next>now)return {...deny('REPEAT_COOLDOWN','Aún no ha terminado el plazo entre compras. Podrás volver a intentarlo cuando finalice.',429),nextEligibleAt:new Date(next).toISOString()};
 }
 return {allowed:true};
}
module.exports={publicationEligibility};
