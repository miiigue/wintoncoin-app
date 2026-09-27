'use strict';
const {readFileSync}=require('fs');
const path=require('path');
const {JsonRpcProvider, Contract, getAddress, keccak256, toUtf8Bytes}=require('ethers');
const keys={CoreProtocol:'CORE_PROTOCOL_ADDRESS',CollateralVault:'COLLATERAL_VAULT_ADDRESS',FifoExchange:'FIFO_EXCHANGE_ADDRESS',BlueToken:'BLUE_TOKEN_ADDRESS',RedToken:'RED_TOKEN_ADDRESS',USDT:'USDT_TOKEN_ADDRESS',ProtocolTreasury:'PROTOCOL_TREASURY_ADDRESS'};
function configuration(env=process.env) {
    const manifest=JSON.parse(readFileSync(path.resolve(__dirname,'../../../web3-contracts/deployment-manifest-v4.json'),'utf8'));
    const chainId=String(env.WINTON_CHAIN_ID || manifest.chainId);
    if(!/^[1-9]\d*$/.test(chainId)) throw new Error('Red no configurada.');
    const contracts={};
    for(const [key,variable] of Object.entries(keys)) {
        contracts[key]=getAddress(env[variable] || (key==='CoreProtocol'?env.WINTON_PROTOCOL_ADDRESS:key==='ProtocolTreasury'?env.WINTON_TREASURY_ADDRESS:undefined) || manifest.contracts[key]);
        if(/^0x0{40}$/i.test(contracts[key]))throw new Error('Contrato no configurado: '+key);
    }
    const fingerprint=keccak256(toUtf8Bytes(JSON.stringify({chainId,contracts})));
    return {chainId,contracts,fingerprint};
}
function provider() { return new JsonRpcProvider(process.env.OPTIMISM_RPC_URL || 'http://127.0.0.1:8545'); }
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
