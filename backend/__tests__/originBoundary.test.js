const {execFileSync}=require('node:child_process');
const path=require('node:path');
test('origin boundary rejects forged Bearer headers and unsafe admin origins',()=>{
 const output=execFileSync(process.execPath,[path.join(__dirname,'../scripts/check-origin-boundary.cjs')],{encoding:'utf8'});
 expect(output).toContain('PASS: 18 origin boundary checks');
});
