"use strict";
// EXPERIMENT ONLY. No runtime imports or deployed-contract changes.
// protectedBase and riskAnchor are trusted snapshots supplied by the test model.
// Their authenticated production lifecycle and offline policy transitions remain to be designed.
const MONTH=30n*86400n,MAX=(1n<<256n)-1n;
function units(value){if(typeof value!=='bigint'||value<0n||value>MAX)throw Error('Invalid uint256');return value;}
function effectiveLimit({base,protectedBase,bonus,now,overdueSince=null,riskAnchor=null,curedAt=null,penalty=null,target=null}){
 [base,protectedBase,bonus,now].forEach(units);
 const entitled=(base>protectedBase?base:protectedBase)+bonus;
 if(entitled>MAX)throw Error('Overflow');
 if(overdueSince!==null){
  units(overdueSince);units(riskAnchor);
  if(curedAt!==null)throw Error('Ambiguous risk state');
  if(now>overdueSince){const cycles=1n+(now-overdueSince)/MONTH;return cycles>=256n?0n:riskAnchor>>cycles;}
 }
 if(curedAt!==null){
  [curedAt,penalty,target].forEach(units);
  if(curedAt>now||penalty>target)throw Error('Invalid recovery state');
  const ceiling=entitled<target?entitled:target;
  const months=(now-curedAt)/MONTH;
  if(months>=10n)return ceiling;
  const restored=penalty+months*ceiling/10n;
  return restored<ceiling?restored:ceiling;
 }
 return entitled;
}
module.exports={effectiveLimit,MONTH};
