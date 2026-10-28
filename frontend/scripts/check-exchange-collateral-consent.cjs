'use strict';

const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const exchange=fs.readFileSync(path.join(root,'src/pages/Exchange.jsx'),'utf8');
const service=fs.readFileSync(path.join(root,'src/modules/web3OnChainService.js'),'utf8');

const requirements=[
    [exchange,'role="dialog"','diálogo de consentimiento'],
    [exchange,'contentHash.slice','hash visible'],
    [exchange,'Aceptar y continuar a la firma on-chain','separación consentimiento/firma'],
    [exchange,'setAutomaticExchangeCollateral(false)','desactivación on-chain previa'],
    [exchange,'revokeAutomaticCollateralConsent','revocación prospectiva'],
    [service,"operationRequest('/automatic-collateral-consent/accept'",'endpoint de aceptación'],
    [service,"operationRequest('/automatic-collateral-consent/revoke'",'endpoint de revocación']
];
for(const [source,needle,label] of requirements){
    if(!source.includes(needle))throw new Error(`Falta ${label}: ${needle}`);
}
console.log('Flujo frontend de consentimiento específico verificado.');
