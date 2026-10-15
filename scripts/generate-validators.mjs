import fs from 'node:fs';import assert from 'node:assert/strict';import Ajv from 'ajv/dist/2020.js';import addFormats from 'ajv-formats';import standalone from 'ajv/dist/standalone/index.js';
const contract=JSON.parse(fs.readFileSync('supabase/functions/backend-v1/contract.json'));
const ajv=new Ajv({strict:false,allErrors:false,code:{source:true,esm:true,optimize:2}});addFormats(ajv);ajv.addSchema(contract,'contract');const exports={};
for(const op of contract['x-contract'].operations){exports['request_'+op.name]='contract'+op.request.$ref;exports['success_'+op.name]='contract'+op.success.$ref;}
let code=standalone(ajv,exports);
const modules={'ajv/dist/runtime/ucs2length':['ucs','ajv/dist/runtime/ucs2length.js'],'ajv/dist/runtime/equal':['equal','ajv/dist/runtime/equal.js'],'ajv-formats/dist/formats':['formats','ajv-formats/dist/formats.js']};
let imports='// Generated from the authoritative closed JSON contract; no runtime schema compiler.\n';
for(const [path,[binding,url]] of Object.entries(modules)){const ref='require('+JSON.stringify(path)+')';if(code.includes(ref)){imports+='import '+binding+' from '+JSON.stringify(url)+';\n';code=code.replaceAll(ref,binding);}}
assert(!code.includes('require('));code=imports+code+'\n';const path='supabase/functions/backend-v1/validators.js';
if(process.argv.includes('--check'))assert.equal(fs.readFileSync(path,'utf8'),code,'Runtime validator drift');else fs.writeFileSync(path,code);
console.log('Generated standalone request/response validators: '+Object.keys(exports).length);
