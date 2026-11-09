'use strict';

const {Wallet,id:signatureId}=require('ethers');

const {
    ChainOperationStore,
    gateOperation,
    SAFE_CONTAINMENT_KINDS,
    PRELAUNCH_QUARANTINE,
    WRITE_GATE_QUARANTINE,
    DEPLOYMENT_QUARANTINE
}=require('../src/services/chainOperationStore');

const addresses={
    CoreProtocol:'0x0000000000000000000000000000000000000011',
    CollateralVault:'0x0000000000000000000000000000000000000012',
    FifoExchange:'0x0000000000000000000000000000000000000013',
    ProtocolTreasury:'0x0000000000000000000000000000000000000014'
};
const config={chainId:'11155420',epoch:'V5_CODEX_163',fingerprint:'0xdemo',contracts:addresses};
const deployment={configuration:jest.fn(()=>config)};
const prelaunchGate={
    operationalStatus:jest.fn(async()=>({enabled:false,preLaunchActive:true,reason:'PRELAUNCH_ACTIVE'})),
    isContainmentAction:jest.fn(operation=>['pause','owner:pause_protocol','owner:pause_vault','owner:pause_exchange','owner:pause_treasury','recovery_cancel'].includes(operation))
};
const normalGate={
    operationalStatus:jest.fn(async()=>({enabled:true,preLaunchActive:false,mode:'operational'})),
    isContainmentAction:prelaunchGate.isContainmentAction
};
const baseRow=(overrides={})=>({
    id:'11111111-1111-1111-1111-111111111111',
    chain_id:'11155420',
    sender:'0x0000000000000000000000000000000000000001',
    resource_key:'payment:test',
    kind:'marketplace',
    payload:{fingerprint:'0xdemo'},
    projection:{},
    steps:[],
    state:'pending',
    ...overrides
});
const client=()=>({query:jest.fn(async()=>({rows:[],rowCount:1}))});
const pausePayload=kind=>{
    const target=kind.includes('vault')?addresses.CollateralVault:kind.includes('exchange')?addresses.FifoExchange:
        kind.includes('treasury')?addresses.ProtocolTreasury:addresses.CoreProtocol;
    return {fingerprint:'0xdemo',to:target,data:signatureId('pause()').slice(0,10)};
};
const recoveryPayload={
    manifestHash:'0xmanifest',
    authorization:{chainId:'11155420',manifestHash:'0xmanifest',account:'0x0000000000000000000000000000000000000015'}
};
const storeOptions=(writeGate=prelaunchGate)=>({
    writeGate,deployment,env:{IS_DEMO_ENV:'true'},
    recoveryConfiguration:()=>({hash:'0xmanifest'}),
    recoveryValidator:jest.fn()
});
describe('cuarentena de operaciones durante Prelanzamiento',()=>{
    beforeEach(()=>jest.clearAllMocks());

    test('mapea únicamente la cancelación de recuperación a una acción segura',()=>{
        expect(gateOperation('accountRecoveryCancel')).toBe('recovery_cancel');
        expect(gateOperation('owner:unpause_protocol')).toBe('owner:unpause_protocol');
        expect(gateOperation('marketplace')).toBe('marketplace');
    });

    test('una operación económica pendiente sin recibo queda en cuarentena y nunca se retransmite',async()=>{
        const db=client();
        const provider={
            getNetwork:jest.fn(async()=>({chainId:11155420n})),
            getTransactionReceipt:jest.fn(async()=>null),
            getTransactionCount:jest.fn(),
            broadcastTransaction:jest.fn()
        };
        const store=new ChainOperationStore({},provider,storeOptions());
        const row=baseRow({steps:[{raw:'0x00',hash:'0xdead',confirmed:false}]});

        const result=await store.advanceLocked(row,db);

        expect(result).toMatchObject({state:'conflict',pending:false,accepted:true});
        expect(result.message).toMatch(/cuarentena/i);
        expect(db.query).toHaveBeenCalledWith(expect.stringContaining("error_code=$2"),[row.id,PRELAUNCH_QUARANTINE]);
        expect(provider.getTransactionCount).not.toHaveBeenCalled();
        expect(provider.broadcastTransaction).not.toHaveBeenCalled();
    });

    test.each(['pause','owner:pause_protocol','owner:pause_vault','owner:pause_exchange','owner:pause_treasury','accountRecoveryCancel'])(
        'permite reevaluar la acción segura %s sin cuarentena',async kind=>{
            const db=client();
            const store=new ChainOperationStore({}, {},storeOptions());

            const payload=kind==='accountRecoveryCancel'?recoveryPayload:pausePayload(kind);
            const result=await store.ensureBroadcastAllowed(baseRow({kind,payload}),db);

            expect(result.allowed).toBe(true);
            expect(db.query).not.toHaveBeenCalled();
        }
    );

    test('un unpause preparado queda en cuarentena durante Prelanzamiento',async()=>{
        const db=client();
        const store=new ChainOperationStore({}, {},storeOptions());
        const row=baseRow({state:'prepared',kind:'owner:unpause_protocol'});

        const result=await store.ensureBroadcastAllowed(row,db);

        expect(result.allowed).toBe(false);
        expect(result.result).toMatchObject({state:'conflict'});
        expect(db.query).toHaveBeenCalledWith(expect.stringContaining("state IN ('prepared','pending')"),[row.id,PRELAUNCH_QUARANTINE]);
    });

    test('el nombre pause no permite transmitir a un contrato o selector arbitrario',async()=>{
        const db=client();
        const store=new ChainOperationStore({}, {},storeOptions());
        const row=baseRow({kind:'pause',payload:{
            fingerprint:'0xdemo',to:'0x0000000000000000000000000000000000000099',data:signatureId('unpause()').slice(0,10)
        }});

        const result=await store.ensureBroadcastAllowed(row,db);

        expect(result.allowed).toBe(false);
        expect(result.result.message).toMatch(/cuarentena/i);
        expect(db.query.mock.calls.at(-1)[1][1]).toBe('CONTAINMENT_INTENT_INVALID_QUARANTINED');
    });

    test('un cambio de chain o fingerprint se bloquea antes de consultar la compuerta',async()=>{
        const db=client();
        const store=new ChainOperationStore({}, {},storeOptions(normalGate));
        const row=baseRow({payload:{fingerprint:'0xotro'}});

        const result=await store.ensureBroadcastAllowed(row,db);

        expect(result.allowed).toBe(false);
        expect(db.query).toHaveBeenCalledWith(expect.stringContaining('error_code=$2'),[row.id,DEPLOYMENT_QUARANTINE]);
        expect(normalGate.operationalStatus).not.toHaveBeenCalled();
    });

    test('si la compuerta no puede verificarse, falla cerrado y no transmite',async()=>{
        const db=client();
        const unavailableGate={
            operationalStatus:jest.fn(async()=>{throw new Error('unavailable');}),
            isContainmentAction:jest.fn(()=>false)
        };
        const store=new ChainOperationStore({}, {},storeOptions(unavailableGate));
        const row=baseRow();

        const result=await store.ensureBroadcastAllowed(row,db);

        expect(result.allowed).toBe(false);
        expect(db.query).toHaveBeenCalledWith(expect.stringContaining('error_code=$2'),[row.id,WRITE_GATE_QUARANTINE]);
    });

    test('fuera de contención permite una operación solo con compuerta operacional',async()=>{
        const db=client();
        const store=new ChainOperationStore({}, {},storeOptions(normalGate));

        const result=await store.ensureBroadcastAllowed(baseRow(),db);

        expect(result.allowed).toBe(true);
        expect(db.query).not.toHaveBeenCalled();
    });

    test('el barrido incluye pendientes y preparados no seguros solo cuando Prelanzamiento está activo',async()=>{
        const pool={query:jest.fn(async()=>({rows:[{id:'pending-id'},{id:'prepared-id'}],rowCount:2}))};
        const store=new ChainOperationStore(pool,{},storeOptions());
        store.reconcile=jest.fn(async()=>({success:false}));

        const result=await store.sweep(7);

        expect(result).toEqual({checked:2,confirmed:0});
        expect(pool.query).toHaveBeenCalledWith(expect.stringContaining("state='prepared'"),[
            7,SAFE_CONTAINMENT_KINDS,'pre_launch_mode_enabled'
        ]);
        expect(store.reconcile).toHaveBeenCalledTimes(2);
    });

    test('vuelve a comprobar la fase inmediatamente antes del broadcast y detecta una activación intermedia',async()=>{
        const wallet=Wallet.createRandom();
        const raw=await wallet.signTransaction({
            chainId:11155420n,nonce:0,to:'0x0000000000000000000000000000000000000020',value:0n,gasLimit:21000n,gasPrice:1n
        });
        const transitionGate={
            operationalStatus:jest.fn()
                .mockResolvedValueOnce({enabled:true,preLaunchActive:false})
                .mockResolvedValueOnce({enabled:false,preLaunchActive:true,reason:'PRELAUNCH_ACTIVE'}),
            isContainmentAction:jest.fn(()=>false)
        };
        const db=client();
        const provider={
            getNetwork:jest.fn(async()=>({chainId:11155420n})),
            getTransactionReceipt:jest.fn(async()=>null),
            getTransactionCount:jest.fn(async()=>0),
            broadcastTransaction:jest.fn()
        };
        const store=new ChainOperationStore({},provider,storeOptions(transitionGate));
        const row=baseRow({
            sender:wallet.address.toLowerCase(),
            steps:[{raw,hash:'0xdead',confirmed:false}]
        });

        const result=await store.advanceLocked(row,db);

        expect(transitionGate.operationalStatus).toHaveBeenCalledTimes(2);
        expect(result).toMatchObject({state:'conflict'});
        expect(db.query).toHaveBeenCalledWith(expect.stringContaining('error_code=$2'),[row.id,PRELAUNCH_QUARANTINE]);
        expect(provider.broadcastTransaction).not.toHaveBeenCalled();
    });
});
