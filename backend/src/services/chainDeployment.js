'use strict';
const {readFileSync}=require('fs');
const path=require('path');
const {Contract, getAddress, keccak256, toUtf8Bytes}=require('ethers');
const keys={CoreProtocol:'CORE_PROTOCOL_ADDRESS',CollateralVault:'COLLATERAL_VAULT_ADDRESS',FifoExchange:'FIFO_EXCHANGE_ADDRESS',BlueToken:'BLUE_TOKEN_ADDRESS',RedToken:'RED_TOKEN_ADDRESS',USDT:'USDT_TOKEN_ADDRESS',ProtocolTreasury:'PROTOCOL_TREASURY_ADDRESS'};
const demoEpochs={
    V4_ACTIVE:'optimism-sepolia-active-before-v5-2026-10-27.json',
    V5_CODEX_163:null
};
function readJson(relative){return JSON.parse(readFileSync(path.resolve(__dirname,relative),'utf8'));}
function configuration(env=process.env) {
    const currentManifest=readJson('../../../web3-contracts/deployment-manifest-v4.json');
    const isDev = env.NODE_ENV === 'development' || env.NODE_ENV === 'test' || /127\.0\.0\.1|localhost/.test(env.OPTIMISM_RPC_URL || '');
    const chainId=String(env.WINTON_CHAIN_ID || (isDev ? '31337' : currentManifest.chainId));
    if(!/^[1-9]\d*$/.test(chainId)) throw new Error('Red no configurada.');
    const demo=chainId==='11155420' && currentManifest.chainId==='11155420';
    const epoch=demo?(env.WINTON_DEPLOYMENT_EPOCH || 'V4_ACTIVE'):'LOCAL_OR_CUSTOM';
    if(demo&&!Object.prototype.hasOwnProperty.call(demoEpochs,epoch))throw new Error('Época de despliegue Demo no registrada.');
    const manifest=demo&&demoEpochs[epoch]
        ?readJson('../../../web3-contracts/deployments/'+demoEpochs[epoch])
        :currentManifest;
    if(demo&&String(manifest.chainId)!==chainId)throw new Error('La época seleccionada no corresponde a la red Demo.');
    const contracts={};
    for(const [key,variable] of Object.entries(keys)) {
        const configured=env[variable] || (key==='CoreProtocol'?env.WINTON_PROTOCOL_ADDRESS:key==='ProtocolTreasury'?env.WINTON_TREASURY_ADDRESS:undefined);
        if(demo && configured && manifest.contracts[key].toLowerCase()!==getAddress(configured).toLowerCase())
            throw new Error('La dirección '+key+' no pertenece a la época Demo seleccionada.');
        // Cada época Demo es una suite indivisible. Las variables del host solo
        // pueden confirmar esa suite; nunca pueden mezclar contratos entre épocas.
        contracts[key]=getAddress(demo?manifest.contracts[key]:(configured || manifest.contracts[key]));
        if(/^0x0{40}$/i.test(contracts[key]))throw new Error('Contrato no configurado: '+key);
    }
    const fingerprint=keccak256(toUtf8Bytes(JSON.stringify({chainId,epoch,contracts})));
    return {chainId,epoch,contracts,startBlocks:manifest.startBlocks||{},fingerprint};
}
function provider() {
    const {ChainRpcProvider,endpoints}=require('./chainRpcProvider');
    const config=configuration();
    return new ChainRpcProvider(endpoints(process.env,config.chainId),config.chainId);
}
async function validate(rpc,config=configuration()) {
    if(String((await rpc.getNetwork()).chainId)!==config.chainId)throw new Error('La red no corresponde al despliegue configurado.');
    for(const address of Object.values(config.contracts))if(await rpc.getCode(address)==='0x')throw new Error('No se encontró un contrato del despliegue.');
    const core=new Contract(config.contracts.CoreProtocol,['function blueToken() view returns(address)','function redToken() view returns(address)','function vault() view returns(address)','function treasury() view returns(address)'],rpc);
    const vault=new Contract(config.contracts.CollateralVault,['function collateralToken() view returns(address)','function coreProtocol() view returns(address)','function exchange() view returns(address)'],rpc);
    const exchange=new Contract(config.contracts.FifoExchange,['function blueToken() view returns(address)','function usdtToken() view returns(address)','function coreProtocol() view returns(address)'],rpc);
    const links=[[await core.blueToken(),'BlueToken'],[await core.redToken(),'RedToken'],[await core.vault(),'CollateralVault'],[await core.treasury(),'ProtocolTreasury'],[await vault.collateralToken(),'USDT'],[await vault.coreProtocol(),'CoreProtocol'],[await vault.exchange(),'FifoExchange'],[await exchange.blueToken(),'BlueToken'],[await exchange.usdtToken(),'USDT'],[await exchange.coreProtocol(),'CoreProtocol']];
    if(links.some(([address,key])=>address.toLowerCase()!==config.contracts[key].toLowerCase()))throw new Error('Los contratos no están enlazados al mismo despliegue.');
    for(const token of ['BlueToken','RedToken','USDT'])if(await new Contract(config.contracts[token],['function decimals() view returns(uint8)'],rpc).decimals()!==6n)throw new Error('Los tokens deben tener seis decimales.');
    return config;
}
module.exports={configuration,provider,validate};
