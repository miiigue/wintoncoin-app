'use strict';
const {Pool}=require('pg');
const businessPool=require('../config/db');
// Counters must commit even when all business connections hold open transactions.
// Use identical DB/TLS configuration; never log connection options or credentials.
module.exports=new Pool({...businessPool.options,max:4,connectionTimeoutMillis:5000,idleTimeoutMillis:10000,allowExitOnIdle:true});
module.exports.on('error',()=>console.error('[PIN] Conexión de protección temporalmente no disponible.'));
