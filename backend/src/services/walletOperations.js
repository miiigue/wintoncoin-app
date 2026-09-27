'use strict';
const {randomUUID}=require('crypto');
const {Contract,Interface,Wallet,parseUnits,formatEther,getAddress}=require('ethers');
const deployment=require('./chainDeployment');
const {ChainOperationStore,publicResult,error}=require('./chainOperationStore');
const {signStep}=require('./chainSigning');
const tokenABI=['function allowance(address,address) view returns(uint256)','function approve(address,uint256) returns(bool)','function transfer(address,uint256) returns(bool)','function balanceOf(address) view returns(uint256)'];
const coreABI=['function isKYCVerified(address) view returns(bool)','function amortizeWithBlue(uint256)'];
const vaultABI=['function deposit(uint256)','function withdraw(uint256)','function getFreeCollateral(address) view returns(uint256)','function repayWithCollateral(address,uint256)'];
const exchangeABI=['function createBlueOrder(uint128)','function createUsdtOrder(uint128)','function cancelOrder(uint64)','function resumeOrder(uint64)','function claimPendingRefunds()'];
const labels={deposit:'Depositar garantía USDT',withdraw:'Retirar garantía libre',transfer:'Retirar USDT a otra dirección',amortize:'Amortizar compromiso con BLUE',sell:'Vender BLUE',buy:'Comprar BLUE',repayCollateral:'Reservar garantía para amortizar',cancel:'Cancelar orden',resume:'Reactivar orden',claim:'Reclamar devoluciones'};
function normalized(input) {
    if(!Object.hasOwn(labels,input.action))throw error('Operación no admitida.',400);
    const out={action:input.action};
    if(['deposit','withdraw','transfer','amortize','sell','buy','repayCollateral'].includes(out.action)) {
        if(typeof input.amount!=='string'||!/^\d{1,12}(\.\d{1,6})?$/.test(input.amount)||parseUnits(input.amount,6)<=0n)throw error('Introduce un importe positivo con hasta seis decimales.',400);
        out.amount=input.amount;
    }
    if(['cancel','resume'].includes(out.action)) {
        if(!/^\d{1,20}$/.test(String(input.orderId))||BigInt(input.orderId)<1n||BigInt(input.orderId)>(1n<<64n)-1n)throw error('Orden inválida.',400);
        out.orderId=String(input.orderId);
    }
    if(out.action==='transfer') {
        try {out.destination=getAddress(input.destination);}catch {throw error('Dirección de destino inválida.',400);}
        if(/^0x0{40}$/i.test(out.destination))throw error('Destino inválido.',400);
    }
    return out;
}
function call(address,abi,name,args,label) {return {to:address,data:new Interface(abi).encodeFunctionData(name,args),value:'0',label};}
class WalletOperations {
    constructor(pool,rpc=deployment.provider(),config=deployment.configuration(),walletService=require('./walletService'),options={}) {
        this.pool=pool;this.rpc=rpc;this.config=config;this.walletService=walletService;
        this.store=new ChainOperationStore(pool,rpc,options);
    }
    async identity(userId) {
        const row=(await this.pool.query('SELECT id,web3_wallet_address,has_transaction_pin FROM users WHERE id=$1',[userId])).rows[0];
        if(!row?.has_transaction_pin)throw error('Configura tu PIN en Billetera antes de operar.',412);
        try {row.address=getAddress(row.web3_wallet_address);}catch {throw error('Tu cuenta necesita revisar su billetera.',409);}
        const count=await this.pool.query('SELECT id FROM users WHERE LOWER(web3_wallet_address)=LOWER($1)',[row.address]);
        if(count.rowCount!==1)throw error('La billetera está asociada a más de una cuenta.');
        return row;
    }
    async prepare(userId,input) {
        const p=normalized(input),user=await this.identity(userId),c=this.config.contracts;
        await deployment.validate(this.rpc,this.config);
        if(!await new Contract(c.CoreProtocol,coreABI,this.rpc).isKYCVerified(user.address))throw error('Necesitas KYC aprobado para esta operación.',403);
        const plan=[],amount=p.amount?parseUnits(p.amount,6):null;
        const approve=async(token,spender)=>{
            const erc=new Contract(token,tokenABI,this.rpc);
            if(await erc.balanceOf(user.address)<amount)throw error('Saldo insuficiente.');
            const allowance=await erc.allowance(user.address,spender);
            if(allowance<amount) {
                if(allowance>0n)plan.push(call(token,tokenABI,'approve',[spender,0n],'Restablecer autorización del token'));
                plan.push(call(token,tokenABI,'approve',[spender,amount],'Autorizar únicamente este importe'));
            }
        };
        switch(p.action) {
            case 'deposit': await approve(c.USDT,c.CollateralVault);plan.push(call(c.CollateralVault,vaultABI,'deposit',[amount],labels.deposit));break;
            case 'withdraw':
                if(await new Contract(c.CollateralVault,vaultABI,this.rpc).getFreeCollateral(user.address)<amount)throw error('Ese importe respalda compromisos o no está disponible.');
                plan.push(call(c.CollateralVault,vaultABI,'withdraw',[amount],labels.withdraw));break;
            case 'transfer':
                if(await new Contract(c.USDT,tokenABI,this.rpc).balanceOf(user.address)<amount)throw error('Saldo USDT disponible insuficiente. Retira primero la garantía libre.');
                plan.push(call(c.USDT,tokenABI,'transfer',[p.destination,amount],labels.transfer));break;
            case 'amortize':plan.push(call(c.CoreProtocol,coreABI,'amortizeWithBlue',[amount],labels.amortize));break;
            case 'repayCollateral':plan.push(call(c.CollateralVault,vaultABI,'repayWithCollateral',[user.address,amount],labels.repayCollateral));break;
            case 'sell':await approve(c.BlueToken,c.FifoExchange);plan.push(call(c.FifoExchange,exchangeABI,'createBlueOrder',[amount],labels.sell));break;
            case 'buy':await approve(c.USDT,c.FifoExchange);plan.push(call(c.FifoExchange,exchangeABI,'createUsdtOrder',[amount],labels.buy));break;
            case 'cancel':case 'resume':plan.push(call(c.FifoExchange,exchangeABI,p.action==='cancel'?'cancelOrder':'resumeOrder',[p.orderId],labels[p.action]));break;
            case 'claim':plan.push(call(c.FifoExchange,exchangeABI,'claimPendingRefunds',[],labels.claim));break;
        }
        const maxFeeWei=String(process.env.WALLET_MAX_STEP_FEE_WEI || '100000000000000');
        if(!/^\d+$/.test(maxFeeWei)||BigInt(maxFeeWei)<=0n)throw error('Presupuesto de red no configurado.',503);
        const id=randomUUID();
        const row=await this.store.prepare({id,userId,key:'wallet:'+id,chainId:this.config.chainId,sender:user.address,resource:'wallet:'+user.address.toLowerCase(),kind:p.action,
            payload:{...p,kycContract:c.CoreProtocol,fingerprint:this.config.fingerprint,plan,planLength:plan.length,maxFeeWei,expiresAt:Date.now()+15*60*1000}});
        return {...publicResult(row),title:labels[p.action],amount:p.amount,destination:p.destination||user.address,chainId:this.config.chainId,
            maxNetworkFeeEth:formatEther(BigInt(maxFeeWei)*BigInt(plan.length)),stepsCount:plan.length};
    }
    async authorize(userId,id,pin) {
        const user=await this.identity(userId);
        return this.store.authorize(id,userId,async(row,client)=>{
            if(row.sender!==user.address.toLowerCase()||row.payload.fingerprint!==this.config.fingerprint)throw error('La cuenta o el despliegue cambió.');
            if(!row.steps.length && row.payload.expiresAt<Date.now())throw error('La autorización venció. Consulta el estado antes de preparar otra operación.');
            await deployment.validate(this.rpc,this.config);
            if(!await new Contract(this.config.contracts.CoreProtocol,coreABI,this.rpc).isKYCVerified(user.address))throw error('Tu KYC no está aprobado.',403);
            let key;
            // Legacy keystore migration belongs to its own committed DB transaction.
            await client.query('BEGIN');
            try { key=await this.walletService.decryptPrivateKeyWithPin(client,userId,pin);await client.query('COMMIT'); }
            catch(e){await client.query('ROLLBACK');throw e;}
            try {
                const signer=new Wallet(key);
                if(signer.address.toLowerCase()!==row.sender)throw error('La firma no corresponde a tu billetera.');
                try {return [await signStep(this.rpc,signer,row.payload.plan[row.steps.length],row.chain_id,row.payload.maxFeeWei)];}
                catch(e) {
                    if(e.status!==402)throw e;
                    const funding=await require('./gasSponsorship').sponsor(this,row,e.requiredWei);
                    throw Object.assign(error('Se está preparando el gas patrocinado. Tu operación conserva su referencia.',202),{fundingOperationId:funding.operationId,operationId:row.id});
                }
            } finally {key=null;}
        });
    }
    async status(userId,id) {
        const row=await this.store.get(id,userId); // Ownership check before any reconciliation.
        const result=await this.store.reconcile(id);
        return {...result,title:labels[row.kind]||'Patrocinio de gas',amount:row.payload.amount,
            destination:row.payload.destination||row.sender,chainId:row.chain_id,stepsCount:row.payload.planLength||1,
            maxNetworkFeeEth:row.payload.maxFeeWei?formatEther(BigInt(row.payload.maxFeeWei)*BigInt(row.payload.planLength||1)):'0'};
    }
}
module.exports={WalletOperations,normalized};
