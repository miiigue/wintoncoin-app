jest.mock('../src/config/db',()=>({query:jest.fn()}));
const db=require('../src/config/db'),jwt=require('jsonwebtoken');
const {authenticateToken}=require('../src/middleware/authMiddleware');
const saved=process.env.JWT_SECRET;
beforeEach(()=>{process.env.JWT_SECRET='synthetic-session-test-only';});
afterAll(()=>{if(saved===undefined)delete process.env.JWT_SECRET;else process.env.JWT_SECRET=saved;});
async function check(account){db.query.mockResolvedValue({rows:account?[account]:[]});const token=jwt.sign({userId:1,tokenType:'access'},process.env.JWT_SECRET);return new Promise(resolve=>{const res={status(n){this.code=n;return this;},json(body){resolve({code:this.code,body});}};authenticateToken({headers:{authorization:'Bearer '+token}},res,()=>resolve({code:200}));});}
test('sesión abierta de cuenta activa continúa',async()=>{expect((await check({account_status:'active'})).code).toBe(200);});
test.each(['suspended','banned',null])('sesión abierta queda bloqueada con estado %s',async status=>{expect((await check({account_status:status})).code).toBe(403);});
test('cuenta pendiente puede acceder al trámite de tutor; el servicio económico exige active',async()=>{expect((await check({account_status:'pending_tutor'})).code).toBe(200);});
test('cuenta eliminada invalida sesión existente',async()=>{expect((await check(null)).code).toBe(401);});
