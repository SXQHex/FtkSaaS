import fs from 'node:fs';
const contract=JSON.parse(fs.readFileSync(new URL('../../../packages/api-contracts/schema/contract.json',import.meta.url)));
// Build-time projection of the machine contract, matching the existing settings
// reader. These are public validation shapes, not live values or permissions.
function expand(input,depth=0){
 if(depth>30||!input||typeof input!=='object')throw Error('INVALID_SETTINGS_SCHEMA');
 if(input.$ref){const name=input.$ref.split('/').at(-1);return {...expand(contract.$defs[name],depth+1),reference:name};}
 const out={};
 for(const key of ['type','const','enum','required','minimum','maximum','minLength','maxLength','minItems','maxItems','uniqueItems','pattern','format'])if(input[key]!==undefined)out[key]=input[key];
 if(input.properties)out.properties=Object.fromEntries(Object.entries(input.properties).map(([key,value])=>[key,expand(value,depth+1)]));
 if(input.items)out.items=expand(input.items,depth+1);
 for(const key of ['anyOf','oneOf','allOf'])if(input[key])out[key]=input[key].map(value=>expand(value,depth+1));
 return out;
}
const directory=new URL('../../../.artifacts/spa-client/settings-shapes/',import.meta.url);fs.mkdirSync(directory,{recursive:true});
for(const [scope,definition] of Object.entries({user:'UserSettingsValues',member:'MemberSettingsValues',center:'CenterSettingsValues',organization:'OrganizationSettingsValues'}))fs.writeFileSync(new URL(scope+'.json',directory),JSON.stringify(expand(contract.$defs[definition]))+'\n');
console.log('Generated four public settings shapes from the canonical contract.');
