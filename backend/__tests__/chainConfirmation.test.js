const {confirmedReceipt}=require('../src/services/chainConfirmation');
const receipt={blockNumber:10,blockHash:'canonical-ten',status:1};
function rpc(){return {getBlock:jest.fn(async tag=>tag==='safe'||tag===12?{number:12,hash:'safe-twelve'}:{number:10,hash:'canonical-ten'}),getTransactionReceipt:jest.fn(async()=>receipt)};}
test('confirma solo recibo compatible con el bloque canónico y el punto seguro',async()=>{expect(await confirmedReceipt(rpc(),'tx')).toEqual(receipt);});
test('no confirma dos hashes distintos para la misma altura segura',async()=>{const p=rpc();p.getBlock=jest.fn(async tag=>tag==='safe'?{number:10,hash:'other-ten'}:{number:10,hash:'canonical-ten'});expect(await confirmedReceipt(p,'tx')).toBeNull();});
test('no confirma si el bloque seguro cambia durante la lectura',async()=>{const p=rpc();p.getBlock=jest.fn(async tag=>tag==='safe'?{number:12,hash:'safe-twelve'}:tag===12?{number:12,hash:'different-twelve'}:{number:10,hash:'canonical-ten'});expect(await confirmedReceipt(p,'tx')).toBeNull();});
test('no confirma si el recibo cambia de bloque durante la lectura',async()=>{const p=rpc();p.getTransactionReceipt.mockResolvedValueOnce(receipt).mockResolvedValueOnce({...receipt,blockHash:'changed'});expect(await confirmedReceipt(p,'tx')).toBeNull();});
test('recibo minado después del punto seguro sigue pendiente',async()=>{const p=rpc();p.getTransactionReceipt.mockResolvedValue({...receipt,blockNumber:13});expect(await confirmedReceipt(p,'tx')).toBeNull();});
test('no confirma recibo desaparecido entre las verificaciones',async()=>{const p=rpc();p.getTransactionReceipt.mockResolvedValueOnce(receipt).mockResolvedValueOnce(null);expect(await confirmedReceipt(p,'tx')).toBeNull();});
