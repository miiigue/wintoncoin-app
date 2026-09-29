'use strict';
require('../config');
const pool=require('../src/config/db');
const service=require('../src/services/web3Readiness');
const inspect=()=>service.inspect({pool});
if(require.main===module)inspect().then(result=>{console.log(JSON.stringify(result,null,2));process.exitCode=result.ready?0:1;}).catch(()=>{console.error('No se pudo completar la comprobación.');process.exitCode=1;}).finally(()=>pool.end());
module.exports={inspect};
