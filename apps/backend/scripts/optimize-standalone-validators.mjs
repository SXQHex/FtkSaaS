import {parse} from '@babel/parser';

const schemaName=/^schema\d+$/;
const validatorName=/^validate\d+$/;
const errorKeys=['instancePath','schemaPath','keyword','params'];
const singleParameter=new Map([
 ['type','type'],['required','missingProperty'],['additionalProperties','additionalProperty'],
 ['const','allowedValue'],['enum','allowedValues'],['pattern','pattern'],['format','format'],['if','failingKeyword'],
]);
const helpers=`
function createStandaloneError(instancePath,schemaPath,keyword,params){return {instancePath,schemaPath,keyword,params};}
function createStandaloneErrorWithoutSchemaPath(instancePath,keyword,params){return {instancePath,schemaPath:"",keyword,params};}
function rejectStandalone(validator,error){validator.errors=[error];return false;}
`+[...singleParameter].map(([keyword,parameter])=>
 `function standaloneError_${keyword}(instancePath,value){return {instancePath,schemaPath:"",keyword:${JSON.stringify(keyword)},params:{${parameter}:value}};}\n`
).join('');

function propertyName(node){
 if(node?.type==='Identifier')return node.name;
 if(node?.type==='StringLiteral'||node?.type==='NumericLiteral')return String(node.value);
}

function errorExpression(node,source){
 if(node?.type!=='ObjectExpression'||node.properties.length!==errorKeys.length)return;
 if(!node.properties.every((property,index)=>property.type==='ObjectProperty'&&!property.computed&&
  property.key.type==='Identifier'&&property.key.name===errorKeys[index]))return;
 const [path,schema,keyword,params]=node.properties.map(property=>property.value);
 if(schema.type!=='StringLiteral'||keyword.type!=='StringLiteral'||params.type!=='ObjectExpression')return;
 const value=part=>{
  const code=source.slice(part.start,part.end);
  return part.type==='SequenceExpression'?`(${code})`:code;
 };
 const parameter=singleParameter.get(keyword.value);
 const [property]=params.properties;
 if(schema.value===''&&parameter&&params.properties.length===1&&property.type==='ObjectProperty'&&
  !property.computed&&property.key.type==='Identifier'&&property.key.name===parameter){
  return `standaloneError_${keyword.value}(${value(path)},${value(property.value)})`;
 }
 return schema.value===''
  ?`createStandaloneErrorWithoutSchemaPath(${value(path)},${value(keyword)},${value(params)})`
  :`createStandaloneError(${value(path)},${value(schema)},${value(keyword)},${value(params)})`;
}

function staticPath(node,ancestors){
 const path=[];
 let object=node;
 for(let i=ancestors.length-1;i>=0;i--){
  const member=ancestors[i];
  if(member.type!=='MemberExpression'||member.object!==object)break;
  if(member.computed&&member.property.type==='Identifier')break;
  const key=propertyName(member.property);
  if(key===undefined)break;
  path.push(key);
  object=member;
 }
 return path;
}

function selectSchemaProperties(value,paths){
 // A use of a complete value (including iteration, method calls and dynamic
 // access) keeps that value. Array positions must remain stable.
 if(value===null||typeof value!=='object'||Object.hasOwn(value,'__proto__')||
  paths.some(path=>path.length===0||!Object.hasOwn(value,path[0])))return value;
 const selected=new Map();
 for(const [key,...rest] of paths){
  if(!selected.has(key))selected.set(key,[]);
  selected.get(key).push(rest);
 }
 if(Array.isArray(value))return value.map((item,index)=>{
  const rest=selected.get(String(index));
  return rest?selectSchemaProperties(item,rest):null;
 });
 return Object.fromEntries(Object.keys(value).filter(key=>selected.has(key))
  .map(key=>[key,selectSchemaProperties(value[key],selected.get(key))]));
}

export function optimizeStandaloneValidators(source){
 const {program}=parse(source,{sourceType:'unambiguous',attachComment:false});
 const schemas=new Map();
 for(const statement of program.body){
  if(statement.type!=='VariableDeclaration'||statement.kind!=='const')continue;
  for(const declaration of statement.declarations){
   if(declaration.id.type==='Identifier'&&schemaName.test(declaration.id.name)&&declaration.init?.type==='ObjectExpression'){
    schemas.set(declaration.id.name,{declaration,paths:[]});
   }
  }
 }
 const edits=[];
 const earlyErrors=new WeakSet();
 const ancestors=[];
 const add=(node,text,end=node.end)=>edits.push({start:node.start,end,text});
 function visit(node,parent,edge){
  if(node.type==='BlockStatement'){
   for(let i=0;i+1<node.body.length;i++){
    const statement=node.body[i],next=node.body[i+1];
    if(statement.type!=='ExpressionStatement'||next.type!=='ReturnStatement'||
     next.argument?.type!=='BooleanLiteral'||next.argument.value!==false)continue;
    const assignment=statement.expression;
    if(assignment.type!=='AssignmentExpression'||assignment.operator!=='='||
     assignment.left.type!=='MemberExpression'||assignment.left.computed||
     assignment.left.object.type!=='Identifier'||!validatorName.test(assignment.left.object.name)||
     assignment.left.property.name!=='errors'||assignment.right.type!=='ArrayExpression'||
     assignment.right.elements.length!==1)continue;
    const [error]=assignment.right.elements;
    const expression=errorExpression(error,source);
    if(expression===undefined)continue;
    earlyErrors.add(error);
    add(statement,`return rejectStandalone(${assignment.left.object.name},${expression});`,next.end);
   }
  }else if(node.type==='ObjectExpression'&&!earlyErrors.has(node)){
   const expression=errorExpression(node,source);
   if(expression!==undefined)add(node,expression);
  }else if(node.type==='Identifier'&&schemas.has(node.name)){
   const {declaration,paths}=schemas.get(node.name);
   const isDeclaration=parent===declaration&&edge==='id';
   const isPropertyKey=((parent?.type==='ObjectProperty'&&edge==='key')||
    (parent?.type==='MemberExpression'&&edge==='property'))&&!parent.computed;
   if(!isDeclaration&&!isPropertyKey)paths.push(staticPath(node,ancestors));
  }
  ancestors.push(node);
  for(const [key,value] of Object.entries(node)){
   if(Array.isArray(value)){
    for(const child of value)if(typeof child?.type==='string')visit(child,node,key);
   }else if(typeof value?.type==='string')visit(value,node,key);
  }
  ancestors.pop();
 }
 visit(program);
 for(const {declaration:{init},paths} of schemas.values()){
  if(paths.length===0)continue;
  const original=source.slice(init.start,init.end);
  const selected=JSON.stringify(selectSchemaProperties(JSON.parse(original),paths));
  if(selected.length<original.length)add(init,selected);
 }
 let offset=program.directives.at(-1)?.end??program.interpreter?.end??0;
 let output=source.slice(0,offset)+helpers;
 for(const {start,end,text} of edits.sort((a,b)=>a.start-b.start)){
  if(start<offset)throw new Error('Overlapping standalone validator edits');
  output+=source.slice(offset,start)+text;
  offset=end;
 }
 return output+source.slice(offset);
}
