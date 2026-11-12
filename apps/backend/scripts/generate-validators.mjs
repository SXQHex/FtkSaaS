import fs from 'node:fs';import assert from 'node:assert/strict';import Ajv from 'ajv/dist/2020.js';import addFormats from 'ajv-formats';import standalone from 'ajv/dist/standalone/index.js';
const contract=JSON.parse(fs.readFileSync('supabase/functions/backend-v1/contract.json'));
// Ajv retains schema annotations in standalone constants even though they do not
// validate data. Keep those in the published contract, outside the Edge upload.
function validationSchema(schema){
 if(!schema||typeof schema!=='object'||Array.isArray(schema))return schema;
 const result={};
 for(const [key,value] of Object.entries(schema)){
  if(key.startsWith('x-')||['title','description','$comment','default','examples'].includes(key))continue;
  if(['properties','patternProperties','$defs','definitions','dependentSchemas'].includes(key))result[key]=Object.fromEntries(Object.entries(value).map(([name,item])=>[name,validationSchema(item)]));
  else if(['allOf','anyOf','oneOf','prefixItems'].includes(key))result[key]=value.map(validationSchema);
  else if(['items','contains','not','if','then','else','additionalProperties','unevaluatedProperties','propertyNames'].includes(key))result[key]=validationSchema(value);
  else result[key]=value;
 }
 return result;
}
for(const [name,schema] of Object.entries(contract.$defs))contract.$defs[name]=validationSchema(schema);
// Intern identical nested object/array schemas before compilation. Ajv shares
// named refs; inline copies otherwise generate one validator per scope. Only
// schema positions are visited, so user property names and enum data stay data.
const nestedMaps=['properties','patternProperties','$defs','definitions','dependentSchemas'];
const nestedLists=['allOf','anyOf','oneOf','prefixItems'];
const nestedSingles=['items','contains','not','if','then','else','additionalProperties','unevaluatedProperties','propertyNames'];
function children(schema,visit){
 if(!schema||typeof schema!=='object'||Array.isArray(schema))return schema;
 const out={...schema};
 for(const key of nestedMaps)if(out[key])out[key]=Object.fromEntries(Object.entries(out[key]).map(([name,value])=>[name,visit(value)]));
 for(const key of nestedLists)if(out[key])out[key]=out[key].map(visit);
 for(const key of nestedSingles)if(out[key]&&typeof out[key]==='object')out[key]=visit(out[key]);
 return out;
}
const occurrences=new Map();
const count=schema=>{children(schema,count);if(schema&&typeof schema==='object'&&!Array.isArray(schema)&&(schema.type==='object'||schema.type==='array')){const key=JSON.stringify(schema);if(key.length>200)occurrences.set(key,(occurrences.get(key)??0)+1);}return schema;};
for(const schema of Object.values(contract.$defs))count(schema);
const shared=new Map([...occurrences].filter(([,count])=>count>1).map(([key],i)=>[key,'__shared_validation_'+i]));
for(const name of shared.values())assert(!Object.hasOwn(contract.$defs,name),'Internal validation name collision');
function intern(schema){const name=shared.get(JSON.stringify(schema));return name?{$ref:'#/$defs/'+name}:children(schema,intern);}
for(const [name,schema] of Object.entries(contract.$defs))contract.$defs[name]=intern(schema);
for(const [key,name] of shared)contract.$defs[name]=children(JSON.parse(key),intern);
// Share referenced validators instead of duplicating them in every operation.
// Validation rules and standalone (no runtime compiler) execution stay unchanged.
const ajv=new Ajv({strict:false,allErrors:false,messages:false,inlineRefs:false,code:{source:true,esm:true,optimize:2}});addFormats(ajv);ajv.addSchema(contract,'contract');const exports={};
for(const op of contract['x-contract'].operations){exports['request_'+op.name]='contract'+op.request.$ref;exports['success_'+op.name]='contract'+op.success.$ref;}
let code=standalone(ajv,exports);
const modules={'ajv/dist/runtime/ucs2length':['ucs','ajv/dist/runtime/ucs2length.js'],'ajv/dist/runtime/equal':['equal','ajv/dist/runtime/equal.js'],'ajv-formats/dist/formats':['formats','ajv-formats/dist/formats.js']};
let imports='// Generated from the authoritative closed JSON contract; no runtime schema compiler.\n';
for(const [path,[binding,url]] of Object.entries(modules)){const ref='require('+JSON.stringify(path)+')';if(code.includes(ref)){imports+='import '+binding+' from '+JSON.stringify(url)+';\n';code=code.replaceAll(ref,binding);}}
assert(!code.includes('require('));code=imports+code+'\n';const path='supabase/functions/backend-v1/validators.js';
if(process.argv.includes('--check'))assert.equal(fs.readFileSync(path,'utf8'),code,'Runtime validator drift');else fs.writeFileSync(path,code);
console.log('Generated standalone request/response validators: '+Object.keys(exports).length);
