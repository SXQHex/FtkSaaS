import {compactValidatorErrors} from './compact-validator-errors.mjs';
import {optimizeStandaloneValidators} from './optimize-standalone-validators.mjs';
import fs from 'node:fs';import assert from 'node:assert/strict';import Ajv from 'ajv/dist/2020.js';import addFormats from 'ajv-formats';import standalone from 'ajv/dist/standalone/index.js';
const contract=JSON.parse(fs.readFileSync('supabase/functions/backend-v1/contract.json'));
const nestedMaps=['properties','patternProperties','$defs','definitions','dependentSchemas'];
const nestedLists=['allOf','anyOf','oneOf','prefixItems'];
const nestedSingles=['items','contains','not','if','then','else','additionalProperties','unevaluatedProperties','propertyNames'];
const annotations=['title','description','$comment','default','examples'];
const isSchemaObject=value=>value&&typeof value==='object'&&!Array.isArray(value);

// Visit schema positions only. Property names and literal data are untouched.
function children(schema,visit){
 if(!isSchemaObject(schema))return schema;
 const out={...schema};
 for(const key of nestedMaps)if(out[key])out[key]=Object.fromEntries(Object.entries(out[key]).map(([name,value])=>[name,visit(value)]));
 for(const key of nestedLists)if(out[key])out[key]=out[key].map(visit);
 for(const key of nestedSingles)if(isSchemaObject(out[key]))out[key]=visit(out[key]);
 return out;
}

// Ajv retains annotations in standalone constants. Keep them in the published contract.
function validationSchema(schema){
 if(!isSchemaObject(schema))return schema;
 const constraints=Object.fromEntries(Object.entries(schema).filter(([key])=>!key.startsWith('x-')&&!annotations.includes(key)));
 return children(constraints,validationSchema);
}
for(const [name,schema] of Object.entries(contract.$defs))contract.$defs[name]=validationSchema(schema);

// Identical collection and union schemas can share one compiled validator.
const shareable=schema=>isSchemaObject(schema)&&(
 schema.type==='object'||schema.type==='array'||Array.isArray(schema.anyOf)||Array.isArray(schema.oneOf)
);
const occurrences=new Map();
function count(schema){
 children(schema,count);
 if(shareable(schema)){
  const key=JSON.stringify(schema);
  occurrences.set(key,(occurrences.get(key)??0)+1);
 }
 return schema;
}
for(const schema of Object.values(contract.$defs))count(schema);
const shared=new Map([...occurrences].filter(([,count])=>count>1).map(([key],i)=>[key,'__shared_validation_'+i]));
for(const name of shared.values())assert(!Object.hasOwn(contract.$defs,name),'Internal validation name collision');
function intern(schema){const name=shared.get(JSON.stringify(schema));return name?{$ref:'#/$defs/'+name}:children(schema,intern);}
for(const [name,schema] of Object.entries(contract.$defs))contract.$defs[name]=intern(schema);
for(const [key,name] of shared)contract.$defs[name]=children(JSON.parse(key),intern);
// Share referenced validators instead of duplicating them in every operation.
// Validation rules and standalone (no runtime compiler) execution stay unchanged.
// Ajv emits a compact required-field loop for larger objects; every required
// field remains checked. Larger enums use Ajv's equivalent loop as well,
// avoiding repeated comparisons in the upload. Thresholds 7/4 were measured
// against the unchanged JSON upload budget; they alter code shape, not checks.
const ajv=new Ajv({strict:false,allErrors:false,messages:false,inlineRefs:false,loopRequired:7,loopEnum:4,code:{source:true,esm:true,optimize:2}});addFormats(ajv);ajv.addSchema(contract,'contract');const exports={};
exports.failure_envelope='contract#/$defs/FailureEnvelope';
for(const op of contract['x-contract'].operations){exports['request_'+op.name]='contract'+op.request.$ref;exports['success_'+op.name]='contract'+op.success.$ref;}
const modules={'ajv/dist/runtime/ucs2length':['ucs','ajv/dist/runtime/ucs2length.js'],'ajv/dist/runtime/equal':['equal','ajv/dist/runtime/equal.js'],'ajv-formats/dist/formats':['formats','ajv-formats/dist/formats.js']};
function writeValidators(selected,path,optimize=code=>code){
 let code=compactValidatorErrors(standalone(ajv,selected)),imports='// Generated from the authoritative closed JSON contract; no runtime schema compiler.\n';
 for(const [name,[binding,url]] of Object.entries(modules)){const ref='require('+JSON.stringify(name)+')';if(code.includes(ref)){imports+='import '+binding+' from '+JSON.stringify(url)+';\n';code=code.replaceAll(ref,binding);}}
 assert(!code.includes('require('));code=imports+optimize(code)+'\n';
 if(process.argv.includes('--check'))assert.equal(fs.readFileSync(path,'utf8'),code,'Runtime validator drift: '+path);else fs.writeFileSync(path,code);
 console.log('Generated standalone request/response validators: '+Object.keys(selected).length+' ('+path+')');
}
writeValidators(exports,'supabase/functions/backend-v1/validators.js',optimizeStandaloneValidators);
// The declared types follow the *same* authoritative operation inventory as the
// standalone validator JS. TypeScript never checks the generated 6 MB JS output.
const typeDeclarations=[
 '// Generated from contract.json; do not hand-edit. Runtime implementations are in validators.js.',
 "import type {Operations,FailureEnvelope} from '@ftksaas/api-contracts';",
 'export declare const failure_envelope: (value: unknown) => value is FailureEnvelope;',
 ...contract['x-contract'].operations.flatMap(({name})=>[
  'export declare const request_'+name+": (value: unknown) => value is Operations['"+name+"']['request'];",
  'export declare const success_'+name+": (value: unknown) => value is Operations['"+name+"']['response'];"
 ])
].join('\n')+'\n';
const declarationPath='supabase/functions/backend-v1/validators.d.ts';
if(process.argv.includes('--check'))assert.equal(fs.readFileSync(declarationPath,'utf8'),typeDeclarations,'Validator types drift');
else fs.writeFileSync(declarationPath,typeDeclarations);

// One canonical schema/compiler, only the four public validators needed by Worker.
const publicNames=['failure_envelope','request_public_calendar_get_v1','success_public_calendar_get_v1','request_public_application_submit_v1'];
writeValidators(Object.fromEntries(publicNames.map(name=>[name,exports[name]])),'transports/spa-validators.mjs');
