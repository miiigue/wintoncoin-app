jest.mock('../src/config/db',()=>({connect:jest.fn()}));
jest.mock('../src/services/auditService',()=>({logAuditEvent:jest.fn()}));
jest.mock('../src/services/web3BridgeService',()=>({getUserAuditDetailed:jest.fn()}));
const db=require('../src/config/db'),bridge=require('../src/services/web3BridgeService');
const controller=require('../src/controllers/userController');
const address='0x'+'1'.repeat(40);
let client;
beforeEach(()=>{
 client={query:jest.fn(async sql=>sql.includes('FROM users')?{rows:[{username:'Prueba',web3_wallet_address:address,has_transaction_pin:true,liquid_blue_balance:'999',escrow_blue_balance:'0',red_balance:'999'}]}:{rows:[{setting_value:'false'}]}),release:jest.fn()};db.connect.mockResolvedValue(client);
});
const response=()=>{const res={};res.status=jest.fn().mockReturnValue(res);res.json=jest.fn().mockReturnValue(res);return res;};
test('dashboard usa saldos actuales del contrato y no los contadores antiguos de SQL',async()=>{
 bridge.getUserAuditDetailed.mockResolvedValue({success:true,wallet:address,blueAvailable:'35',blueLocked:'65',redCommitment:'10',credit:{isKYCVerified:true,baseLimit:'100',availableCapacity:'150',isDelinquent:false},collateralVault:{totalLocked:'60'},blockNumber:12,debtLots:[],pagination:{total:'0'}});
 const res=response();await controller.getMyBalance({user:{userId:1}},res);
 expect(res.status).toHaveBeenCalledWith(200);expect(res.json.mock.calls[0][0]).toMatchObject({blue_balance:'35',escrow_blue_balance:'65',red_balance:'10',available_capacity:'150',balance_source:'blockchain'});expect(client.release).toHaveBeenCalled();
});
test('fallo RPC no vuelve a presentar los saldos antiguos como actuales',async()=>{
 bridge.getUserAuditDetailed.mockResolvedValue({success:false});const res=response();await controller.getMyBalance({user:{userId:1}},res);expect(res.status).toHaveBeenCalledWith(503);expect(res.json.mock.calls[0][0].blue_balance).toBeUndefined();
});
