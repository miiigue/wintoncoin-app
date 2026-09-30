'use strict';
// Pilot ceilings selected for WintonCoin, not values claimed as an industry standard.
// Never activate this test policy on a real-money network.
function demoGasPolicy(chainId) {
    if (String(chainId) !== '11155420') throw Error('DEMO_CHAIN_REQUIRED');
    return {
        gas_sponsor_enabled: 'true', gas_sponsor_daily_user_operations: '3',
        gas_sponsor_daily_budget_wei: '10000000000000000', // 0.01 test ETH per UTC day
        gas_sponsor_max_topup_wei: '100000000000000', // 0.0001 test ETH per step
        gas_sponsor_maintenance_daily_budget_wei: '2000000000000000', // 0.002 within global ceiling
        gas_sponsor_maintenance_max_step_wei: '100000000000000'
    };
}
module.exports = { demoGasPolicy };
