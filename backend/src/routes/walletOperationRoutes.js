'use strict';
const express=require('express');
const {rateLimit}=require('express-rate-limit');
const {authenticateToken}=require('../middleware/authMiddleware');
const {trustedOrigin}=require('../middleware/adminSession');
const {WalletOperations}=require('../services/walletOperations');
const router=express.Router();
let instance;
const service=()=>instance ||= new WalletOperations(require('../config/db'));
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
router.get('/marketplace/terms',run(async()=>({success:true,...await require('../services/marketplacePayments').service().terms()})));
router.get('/marketplace/:id',run(req=>{
 if(!idValid(req.params.id))throw Object.assign(new Error('Referencia inválida.'),{status:400});
 return require('../services/marketplacePayments').service().status(req.user.userId,req.params.id);
}));
router.post('/prepare',limit,run(req=>service().prepare(req.user.userId,req.body)));
router.post('/:id/authorize',limit,run(req=>{
    if(!idValid(req.params.id))throw Object.assign(new Error('Referencia inválida.'),{status:400});
    return service().authorize(req.user.userId,req.params.id,req.body.pin);
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
