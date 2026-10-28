'use strict';
const fs=require('fs'),path=require('path');
async function up(client){
 if(process.env.IS_DEMO_ENV!=='true')return;
 if(process.env.WINTON_DEPLOYMENT_EPOCH!=='V5_CODEX_163')return;
 const config=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../config/demo-reset-163.json'),'utf8'));
 const manifest=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../web3-contracts/deployment-manifest-v4.json'),'utf8'));
 if(config.epoch!=='CODEX-163'||config.chainId!=='11155420'||String(manifest.chainId)!==config.chainId||manifest.contracts.CoreProtocol.toLowerCase()!==config.core.toLowerCase())throw Error('Configuración de reinicio demo no corresponde a la suite activa.');
 const allowed=new Set(['platform_commission_percentage','debt_cycle_days','pre_launch_mode_enabled','red_credit_base_limit','red_credit_referral','red_credit_culture_quiz','red_credit_monthly_activity','red_credit_early_payment','gas_sponsor_enabled','gas_sponsor_daily_user_operations','gas_sponsor_daily_budget_wei','gas_sponsor_max_topup_wei','gas_sponsor_maintenance_daily_budget_wei','gas_sponsor_maintenance_max_step_wei']);
 for(const [key,value]of Object.entries(config.settings)){
  if(!allowed.has(key)||typeof value!=='string'||!/^(true|false|\d+(\.\d+)?)$/.test(value))throw Error('Parámetro demo no admitido.');
  await client.query('INSERT INTO app_settings(setting_key,setting_value) VALUES($1,$2) ON CONFLICT(setting_key) DO UPDATE SET setting_value=EXCLUDED.setting_value,updated_at=NOW()',[key,value]);
 }
}
module.exports={up,down:async()=>{throw Error('No se restaura configuración económica automáticamente.')}};
