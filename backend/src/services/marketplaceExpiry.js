'use strict';
function canRenewUnsentPayment(row,blockTimestamp,settled){
 const deadline=Number(row.payload?.authorization?.deadline);
 return !settled&&row.state==='prepared'&&Array.isArray(row.steps)&&row.steps.length===0&&Number.isSafeInteger(deadline)&&deadline>0&&Number.isSafeInteger(blockTimestamp)&&blockTimestamp>deadline;
}
module.exports={canRenewUnsentPayment};
