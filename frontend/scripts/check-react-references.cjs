// Catch missing bindings in React screens before publishing a build. Vite's
// transpilation alone does not reject `hasPin` after its declaration is removed.
const fs=require('node:fs');
const path=require('node:path');
const parser=require('@babel/parser');
const traverse=require('@babel/traverse').default;
const allowed=new Set([...Object.getOwnPropertyNames(globalThis),'window','document','navigator','localStorage','sessionStorage','alert','confirm','prompt','fetch','FormData','URL','URLSearchParams','FileReader','IntersectionObserver','ResizeObserver','requestAnimationFrame','cancelAnimationFrame','Image','crypto','atob','btoa','location']);
let files=0,errors=0;
function scan(dir){
 for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  const file=path.join(dir,entry.name);
  if(entry.isDirectory()){scan(file);continue;}
  if(!file.endsWith('.jsx'))continue;
  files++;
  const ast=parser.parse(fs.readFileSync(file,'utf8'),{sourceType:'module',plugins:['jsx']});
  traverse(ast,{ReferencedIdentifier(p){
   const name=p.node.name;
   if(!p.scope.hasBinding(name)&&!allowed.has(name)){
    console.error(`${file}:${p.node.loc.start.line}: referencia sin declarar: ${name}`);errors++;
   }
  }});
 }
}
scan(path.resolve(__dirname,'../src'));
console.log(`${files} componentes React revisados; ${errors} referencias sin declarar.`);
if(errors)process.exitCode=1;
