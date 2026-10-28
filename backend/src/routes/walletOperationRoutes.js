'use strict';
const express=require('express');
const {rateLimit}=require('express-rate-limit');
const {authenticateToken}=require('../middleware/authMiddleware');
const {trustedOrigin}=require('../middleware/adminSession');
const {WalletOperations}=require('../services/walletOperations');
const router=express.Router();
let instance;
const service=()=>instance ||= new WalletOperations(require('../config/db'));
const consent=require('../services/exchangeCollateralConsent');
const pool=require('../config/db');
const idValid=id=>/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id);
router.use(authenticateToken,(req,res,next)=>{
    res.set('Cache-Control','no-store');
    if(req.method!=='GET'&&!trustedOrigin(req))return res.status(403).json({message:'Origen no autorizado.'});
    next();
});
const limit=rateLimit({windowMs:15*60*1000,limit:60,keyGenerator:req=>String(req.user.userId),standardHeaders:true,legacyHeaders:false});
const run=fn=>async(req,res)=>{
    try {const result=await fn(req);res.status(result.success?200:202).json(result);}
    catch(e){res.status(e.status || 503).json({success:false,accepted:e.status===202,message:e.status?e.message:'No se pudo comprobar la operación. Consulta su estado antes de repetirla.',operationId:e.operationId,fundingOperationId:e.fundingOperationId});}
};
router.get('/publication-access',async(req,res)=>{
 try{
  const result=await require('../config/db').query('SELECT web3_wallet_address FROM users WHERE id = $1',[req.user.userId]);
  if(!result.rows[0])return res.status(404).json({message:'No se encontró tu cuenta.'});
  await require('../services/publicationKyc').requirePublicationKyc(result.rows[0]);
  return res.json({success:true,approved:true});
 }catch(error){
  if(error.code==='PUBLICATION_KYC_REQUIRED')return res.json({success:true,approved:false,message:error.message});
  return res.status(error.status||503).json({success:false,message:'No pudimos comprobar tu verificación de identidad. Intenta nuevamente.'});
 }
});
router.get('/marketplace/terms',run(async()=>({success:true,...await require('../services/marketplacePayments').service().terms()})));
router.get('/automatic-collateral-consent',run(async req=>({success:true,...await consent.getStatus(pool,req.user.userId)})));
router.post('/automatic-collateral-consent/accept',limit,run(async req=>{
    const client=await pool.connect();
    try{return {success:true,...await consent.accept(client,req.user.userId,req.body,req)};}
    finally{client.release();}
}));
router.post('/automatic-collateral-consent/revoke',limit,run(async req=>{
    const client=await pool.connect();
    try{return {success:true,...await consent.revoke(client,req.user.userId,req)};}
    finally{client.release();}
}));
router.get('/marketplace/:id',run(req=>{
 if(!idValid(req.params.id))throw Object.assign(new Error('Referencia inválida.'),{status:400});
 return require('../services/marketplacePayments').service().status(req.user.userId,req.params.id);
}));
router.post('/marketplace/:id/authorize',limit,run(req=>{
 if(!idValid(req.params.id))throw Object.assign(new Error('Referencia inválida.'),{status:400});
 return require('../services/marketplacePayments').service().authorize(req.user.userId,req.params.id,req.body.signature);
}));
router.post('/prepare',limit,run(req=>service().prepare(req.user.userId,req.body)));
router.post('/:id/authorize',limit,run(req=>{
    if(!idValid(req.params.id))throw Object.assign(new Error('Referencia inválida.'),{status:400});
    if(req.body.pin||req.body.passphrase)throw Object.assign(new Error('Nunca envíes tu frase al servidor. Actualiza la aplicación.'),{status:400});
    return service().authorize(req.user.userId,req.params.id,req.body.authorization);
}));
router.post('/:id/abandon',limit,run(req=>{
    if(!idValid(req.params.id))throw Object.assign(new Error('Referencia inválida.'),{status:400});
    return service().abandon(req.user.userId,req.params.id);
}));
router.get('/:id',run(req=>{
    if(!idValid(req.params.id))throw Object.assign(new Error('Referencia inválida.'),{status:400});
    return service().status(req.user.userId,req.params.id);
}));
module.exports=router;
