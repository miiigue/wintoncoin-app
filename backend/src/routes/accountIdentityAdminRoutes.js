'use strict';
const router=require('express').Router();
const {authenticateAdmin}=require('../middleware/authMiddleware');
const {attachReviewedDocument}=require('../services/accountIdentity');
router.use(authenticateAdmin,(req,res,next)=>{res.set('Cache-Control','no-store');next();});
router.post('/reviewed-document',async(req,res)=>{
 const {username,country,type,number,evidenceReference}=req.body||{};
 if(typeof username!=='string'||username.length>100)return res.status(400).json({message:'Indica un nombre de usuario válido.'});
 const pool=require('../config/db'),client=await pool.connect();
 try{
  await client.query('BEGIN');
  const users=await client.query('SELECT id FROM users WHERE LOWER(username)=LOWER($1) FOR UPDATE',[username.replace(/^@/,'').trim()]);
  if(users.rowCount!==1)throw Object.assign(new Error('No se encontró un único usuario.'),{status:404});
  await attachReviewedDocument(client,{userId:users.rows[0].id,reviewerId:req.user.userId,country,type,number,evidenceReference},process.env.IDENTITY_DOCUMENT_HMAC_KEY);
  await client.query('COMMIT');
  return res.json({success:true,message:'Revisión registrada. Esto no aprueba el KYC en blockchain ni cambia el acceso a la billetera.'});
 }catch(e){await client.query('ROLLBACK');return res.status(e.status||503).json({success:false,message:e.status?e.message:'No se pudo registrar la revisión. No se modificó la identidad.'});}
 finally{client.release();}
});
module.exports=router;
