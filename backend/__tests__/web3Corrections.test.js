jest.mock('../src/config/db',()=>({query:jest.fn().mockResolvedValue({rows:[]})}));
jest.mock('../src/services/auditService',()=>({logAuditEvent:jest.fn().mockResolvedValue(true)}));
jest.mock('../src/services/web3BridgeService',()=>({
 getProtocolStatus:jest.fn(),getUserAuditDetailed:jest.fn(),setKYCStatus:jest.fn(),
 setExtensionParams:jest.fn(),setUserBenefits:jest.fn(),setCommissionRate:jest.fn(),syncPaymentToBlockchain:jest.fn()
}));
const controller=require('../src/controllers/admin/adminWeb3Controller');
const service=require('../src/services/web3BridgeService');
const audit=require('../src/services/auditService');
const wallet='0x'+'1'.repeat(40);
const request=(body)=>({body,user:{id:7,username:'administrador'},params:{},query:{}});
const response=()=>{const r={};r.status=jest.fn().mockReturnValue(r);r.json=jest.fn().mockReturnValue(r);return r;};
beforeEach(()=>jest.clearAllMocks());
test('Fallo de lectura no se presenta como estado válido con ceros',async()=>{
 service.getProtocolStatus.mockResolvedValue({success:false,error:'RPC unavailable'});const r=response();
 await controller.getWeb3Status(request({}),r);expect(r.status).toHaveBeenCalledWith(503);
});
test('Cadena false no aprueba KYC por accidente',async()=>{
 const r=response();await controller.setKYCStatus(request({walletAddress:wallet,status:'false'}),r);
 expect(r.status).toHaveBeenCalledWith(400);expect(service.setKYCStatus).not.toHaveBeenCalled();
});
test('Comisión de prórroga cero es configuración válida confirmada',async()=>{
 service.setExtensionParams.mockResolvedValue({success:true,txHash:'0xconfirmed'});const req=request({extensionDays:30,extensionBps:0,enabled:true}),r=response();
 await controller.setExtensionParams(req,r);expect(service.setExtensionParams).toHaveBeenCalledWith(30,0,true);
 expect(r.status).toHaveBeenCalledWith(200);expect(audit.logAuditEvent.mock.calls[0][1]).toBe(req);
});
test.each([
 {extensionDays:0,extensionBps:500,enabled:true}, {extensionDays:30.5,extensionBps:500,enabled:true},
 {extensionDays:30,extensionBps:10001,enabled:true}, {extensionDays:30,extensionBps:500,enabled:'false'}
])('Rechaza configuración fuera de contrato %j',async body=>{
 const r=response();await controller.setExtensionParams(request(body),r);expect(r.status).toHaveBeenCalledWith(400);expect(service.setExtensionParams).not.toHaveBeenCalled();
});
test('No registra éxito cuando la escritura en blockchain falla',async()=>{
 service.setExtensionParams.mockResolvedValue({success:false,error:'revert'});const r=response();
 await controller.setExtensionParams(request({extensionDays:30,extensionBps:500,enabled:true}),r);
 expect(r.status).toHaveBeenCalledWith(503);expect(audit.logAuditEvent).not.toHaveBeenCalled();
});
test('Margen conserva seis decimales y nivel5 no obliga a margen positivo',async()=>{
 service.setUserBenefits.mockResolvedValue({success:true,txHash:'0xconfirmed'});const r=response();
 await controller.setUserBenefits(request({walletAddress:wallet,level:5,margin:'0.000001'}),r);
 expect(service.setUserBenefits).toHaveBeenCalledWith(wallet,5,'0.000001');expect(r.status).toHaveBeenCalledWith(200);
});
test('Margen mal formado no se redondea silenciosamente',async()=>{
 const r=response();await controller.setUserBenefits(request({walletAddress:wallet,level:5,margin:'1.0000001'}),r);
 expect(r.status).toHaveBeenCalledWith(400);expect(service.setUserBenefits).not.toHaveBeenCalled();
});
