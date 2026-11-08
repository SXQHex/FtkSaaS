import fs from 'node:fs';
import {compile} from 'json-schema-to-typescript';
const path='../../packages/api-contracts/schema/contract.json';
const contract=JSON.parse(fs.readFileSync(path));
const emit=(path,content)=>{content=content.split('\n').map(x=>x.trimEnd()).join('\n').trimEnd()+'\n';if(process.argv.includes('--check')){if(fs.readFileSync(path,'utf8')!==content)throw new Error('GENERATED_DRIFT: '+path);}else fs.writeFileSync(path,content);};
// Root is a definitions catalog, not a payload. Reference every definition to emit all shared types.
const input={...contract,type:'object',properties:Object.fromEntries(Object.keys(contract.$defs).map(k=>[k,{$ref:'#/$defs/'+k}])),additionalProperties:false};
// A required-only alternative otherwise becomes an open index signature in the
// TS compiler. Expand closed-parent fields for typing; runtime JSON Schema stays
// authoritative. A single forbidden field is representable as optional never.
input.$defs=structuredClone(contract.$defs);
for(const schema of Object.values(input.$defs)){
 if(schema.type!=='object'||schema.additionalProperties!==false||!schema.properties||!schema.oneOf?.every(branch=>
  Object.keys(branch).every(k=>['required','not'].includes(k))&&Array.isArray(branch.required)&&
  Object.keys(branch.not??{}).length===1&&branch.not.required?.length===1))continue;
 schema.oneOf=schema.oneOf.map(branch=>({...branch,type:'object',additionalProperties:false,
  properties:Object.fromEntries(Object.entries(schema.properties).map(([key,value])=>[key,branch.not.required.includes(key)?false:value])),
  required:[...new Set([...(schema.required??[]),...branch.required])]}));
}
const types=await compile(input,'ContractCatalog',{bannerComment:'/* Generated from packages/api-contracts/schema/contract.json. Do not edit. */',unreachableDefinitions:true,additionalProperties:false,format:false});
emit('../../packages/api-contracts/src/generated.ts',types);
const typename=n=>n.split('_').map(x=>x[0].toUpperCase()+x.slice(1)).join('');
const ops=contract['x-contract'].operations;
emit('../../packages/api-contracts/src/operations.ts',`/* Generated. */\nimport type * as T from './generated.js';\nexport interface Operations {\n`+ops.map(o=>`  ${o.name}: {request: T.${typename(o.request.$ref.split('/').at(-1))}; response: T.${typename(o.success.$ref.split('/').at(-1))}};`).join('\n')+'\n}\n');
emit('../../packages/api-contracts/src/index.ts',"export type * from './generated.js';\nexport type * from './operations.js';\n");
console.log('Generated shared types:',Object.keys(contract.$defs).length,'operations:',ops.length);
