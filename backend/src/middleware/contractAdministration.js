'use strict';
const pool=require('../config/db');
const {isAddress}=require('ethers');
async function guard(req,res,next) {
    if(['GET','HEAD','OPTIONS'].includes(req.method)) return next();
    if(!['admin','superadmin'].includes(req.user?.role)) return res.status(403).json({success:false,message:'No tienes permiso para modificar contratos.'});
    // Confirmation only reconciles an already owner-signed on-chain action.
    if(req.path==='/owner/confirm')return next();
    // Pausing contains an incident; resuming/changing economic rules follows governance.
    if((req.path==='/pause' && req.body?.action==='pause') ||
       (req.path==='/owner/prepare' && ['pause_protocol','pause_vault'].includes(req.body?.action))) return next();
    try {
        const result=await pool.query("SELECT COUNT(*) AS count FROM governance_guardians WHERE status='active'");
        if(Number(result.rows[0].count)>0) return res.status(403).json({success:false,governance_required:true,message:'Se requiere aprobación de gobernanza; este panel no puede omitirla.'});
        return next();
    } catch { return res.status(503).json({success:false,message:'No se pudo verificar la política de gobernanza.'}); }
}
async function resolveUser(req,res,next) {
    const username=req.body?.username;
    if(typeof username!=='string' || !username.trim() || username.length>100) return res.status(400).json({success:false,message:'Selecciona un nombre de usuario válido.'});
    try {
        const users=await pool.query('SELECT id,username,web3_wallet_address FROM users WHERE LOWER(username)=LOWER($1)',[username.trim().replace(/^@/,'')]);
        const user=users.rows[0];
        if(users.rows.length!==1 || !isAddress(user?.web3_wallet_address)) return res.status(409).json({success:false,message:'No se encontró una única cuenta con billetera asociada válida.'});
        const duplicates=await pool.query('SELECT id FROM users WHERE LOWER(web3_wallet_address)=LOWER($1)',[user.web3_wallet_address]);
        if(duplicates.rows.length!==1) return res.status(409).json({success:false,message:'La billetera requiere conciliación de identidad antes de modificarla.'});
        if(req.body.walletAddress && req.body.walletAddress.toLowerCase()!==user.web3_wallet_address.toLowerCase()) return res.status(409).json({success:false,message:'La billetera no corresponde al usuario.'});
        req.body.walletAddress=user.web3_wallet_address;
        req.targetUser=user;
        return next();
    } catch { return res.status(503).json({success:false,message:'No se pudo verificar al usuario.'}); }
}
const settingsKeys=['platform_commission_percentage','debt_cycle_days','red_credit_base_limit','red_credit_referral','red_credit_culture_quiz','red_credit_monthly_activity','red_credit_early_payment','gas_sponsor_enabled','gas_sponsor_daily_user_operations','gas_sponsor_daily_budget_wei','gas_sponsor_max_topup_wei','gas_sponsor_maintenance_daily_budget_wei','gas_sponsor_maintenance_max_step_wei'];
async function resolvePaymentUsers(req,res,next) {
    const payerRequest={body:{username:req.body?.payerUsername,walletAddress:req.body?.payerWallet}};
    await resolveUser(payerRequest,res,async()=>{
        const payeeRequest={body:{username:req.body?.payeeUsername,walletAddress:req.body?.payeeWallet}};
        await resolveUser(payeeRequest,res,()=>{
            req.body.payerWallet=payerRequest.targetUser.web3_wallet_address;
            req.body.payeeWallet=payeeRequest.targetUser.web3_wallet_address;
            return next();
        });
    });
}
async function getConfiguration(req,res) {
    try { const result=await pool.query('SELECT setting_key,setting_value FROM app_settings WHERE setting_key=ANY($1::text[])',[settingsKeys]);
        const status=await require('../services/web3BridgeService').getProtocolStatus();
        const settings=result.rows.filter(row=>!['platform_commission_percentage','debt_cycle_days'].includes(row.setting_key));
        if(status.success && status.parameters) {
            settings.push({setting_key:'platform_commission_percentage',setting_value:String(Number(status.parameters.commissionRateBps)/100)});
            settings.push({setting_key:'debt_cycle_days',setting_value:String(Number(status.parameters.commitmentDurationSeconds)/86400)});
        }
        res.json({success:true,settings,chainAvailable:status.success===true});
    } catch { res.status(503).json({success:false,message:'No se pudo leer la configuración.'}); }
}
function updateConfiguration(req,res,next) {
    if(!settingsKeys.includes(req.body?.key)) return res.status(400).json({success:false,message:'Parámetro no admitido.'});
    req.contractConfiguration=true; return next();
}
module.exports={guard,resolveUser,resolvePaymentUsers,getConfiguration,updateConfiguration};
